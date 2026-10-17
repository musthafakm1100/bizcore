/**
 * BizCore V268.1 — Purchase Invoice transaction service.
 *
 * createPurchaseInvoice is ONE transaction. It reads the purchase settings, the administrator list, the counter,
 * the supplier-invoice-no. claim, every Sales Order concerned and its purchasing record, and the stock items;
 * validates with js/purchase-core.mjs and writes:
 *   invoice + immutable event + claim (supplier + invoice no.) + salesOrderPurchasing/{soId} (purchased qty)
 *   + stockItems/{itemKey} and a stockMovement for every quantity that goes to stock.
 * Two people buying the last units of the same order line at the same moment can't both succeed (the purchasing
 * record is read inside the transaction). A retried save (same operation) is detected and changes nothing.
 * voidPurchaseInvoice reverses all of it (refused when the stock has already been used, or while payments exist).
 *
 * V268.2 — supplier payments (js/purchase-core.mjs → validateSupplierPayment / buildSupplierPaymentRecords):
 *   createPurchaseInvoice also takes payments made at entry (one payment per date), in the same transaction;
 *   recordSupplierPayment / recordSupplierCashBack / voidSupplierPayment are ONE transaction each:
 *   payment + balanced cash-ledger entry + postings (+ accounts hasEntries) + invoice figures + invoice event.
 */
import {
  PURCHASE_COLLECTIONS as C, PURCHASE_SCHEMA_VERSION, PURCHASE_SETTINGS_PATH, PURCHASE_STATUS,
  effectivePurchaseSettings, validatePurchaseSettings, validatePurchaseInvoice, purchaseIdForOperation,
  supplierRefIdOf, r2, rq,
  PAYMENT_COLLECTION, PAYMENT_KINDS, paymentIdForOperation, validateSupplierPayment, buildSupplierPaymentRecords,
  applyPaymentToInvoice,
} from './purchase-core.mjs?v=268.2';
import { DeliveryError, isSafeId, eventIdForOperation, requireReason, cleanText, assertSize } from './delivery-core.mjs?v=266.0';

const fail = (code, message, details) => { throw new DeliveryError(code, message, details); };
const ensure = (ok, code, message, details) => { if (!ok) fail(code, message, details); };
export const PURCHASE_ERR = Object.freeze({
  INVALID_INPUT: 'invalid-input', NOT_FOUND: 'not-found', INVALID_STATE: 'invalid-state', STALE: 'stale-revision',
  DUPLICATE_SUPPLIER_INVOICE: 'duplicate-supplier-invoice', NOT_ADMIN: 'not-admin', STOCK_USED: 'stock-used', ID_COLLISION: 'id-collision',
  HAS_PAYMENTS: 'has-payments',
});
const PI_BYTES = 700 * 1024;

export function createPurchaseService(fs, options = {}) {
  const { db, doc, runTransaction } = fs || {};
  ensure(db && typeof doc === 'function' && typeof runTransaction === 'function', PURCHASE_ERR.INVALID_INPUT, 'Firestore transaction API required');
  const serverTimestamp = typeof fs.serverTimestamp === 'function' ? fs.serverTimestamp : null;
  const stamp = () => (serverTimestamp ? serverTimestamp() : new Date().toISOString());
  const now = options.now || (() => new Date().toISOString());
  const formatNumber = options.formatNumber || ((prefix, n) => prefix + String(n).padStart(4, '0'));
  const actorOf = () => {
    const a = (options.actor && options.actor()) || {};
    ensure(isSafeId(a.uid), PURCHASE_ERR.INVALID_STATE, 'You must be signed in');
    return { uid: a.uid, name: cleanText(a.name || a.email || a.uid, 200) };
  };
  const refs = {
    pi: id => doc(db, C.invoices, id),
    event: (id, ev) => doc(db, C.invoices, id, C.events, ev),
    ref: key => doc(db, C.supplierRefs, key),
    so: id => doc(db, 'salesOrders', id),
    ledger: id => doc(db, C.soPurchasing, id),
    stock: key => doc(db, C.stockItems, key),
    move: id => doc(db, C.stockMoves, id),
    counter: key => doc(db, 'counters', key),
    settings: () => doc(db, ...PURCHASE_SETTINGS_PATH),
    access: () => doc(db, 'system', 'accessControl'),
    payment: id => doc(db, PAYMENT_COLLECTION, id),
    account: id => doc(db, 'paymentAccounts', id),
    cashEntry: id => doc(db, 'cashEntries', id),
    cashLine: id => doc(db, 'cashLines', id),
  };
  /** Reads the payment accounts used by payment lines, and the bank accounts linked to the cards among them. */
  async function readAccounts(tx, groups) {
    const map = new Map();
    const ids = [...new Set(groups.flatMap(g => (g.lines || []).map(l => l && l.accountId)).filter(isSafeId))];
    for (const id of ids) { const s = await tx.get(refs.account(id)); if (s.exists()) map.set(id, { id, ...s.data() }); }
    const linked = [...new Set([...map.values()].filter(a => a.type === 'card' && isSafeId(a.linkedBankAccountId)).map(a => a.linkedBankAccountId))].filter(id => !map.has(id));
    for (const id of linked) { const s = await tx.get(refs.account(id)); if (s.exists()) map.set(id, { id, ...s.data() }); }
    return map;
  }
  /** Reads the number counters of the payments (several payments may share a counter). */
  async function readCounters(tx, keys) {
    const out = new Map();
    for (const k of [...new Set(keys)]) { ensure(isSafeId(k), PURCHASE_ERR.INVALID_INPUT, 'Document numbering is required'); const s = await tx.get(refs.counter(k)); out.set(k, Number(s.exists() ? s.data().value : 0) || 0); }
    return out;
  }
  const checkNumbering = n => ensure(n && isSafeId(n.counterKey) && typeof n.displayPrefix === 'string', PURCHASE_ERR.INVALID_INPUT, 'Payment numbering is required');
  /** Writes one payment's records (payment + ledger entry + postings + accounts marked as having entries). */
  function writePaymentRecords(tx, recs, accounts) {
    tx.set(refs.payment(recs.payment.id), recs.payment);
    if (recs.entry) {
      tx.set(refs.cashEntry(recs.entry.id), recs.entry);
      for (const l of recs.lines) tx.set(refs.cashLine(l.id), l);
      for (const a of recs.entry.accountIds) { const acc = accounts.get(a); if (acc && !acc.hasEntries) { tx.update(refs.account(a), { hasEntries: true }); acc.hasEntries = true; } }
    }
  }
  const CONTENTION = new Set(['aborted', 'failed-precondition']);
  const pause = n => new Promise(r => setTimeout(r, 60 * n + Math.floor(Math.random() * 120)));
  async function transact(fn) {
    for (let attempt = 1; ; attempt++) {
      try { return await runTransaction(db, fn); }
      catch (e) { if (attempt < 4 && CONTENTION.has(e?.code)) { await pause(attempt); continue; } throw e; }
    }
  }
  const soIdsOf = lines => [...new Set((lines || []).flatMap(l => [l && l.kind !== 'stock' ? l.soId : null, l && l.extra && l.extra.to === 'order' ? l.extra.soId : null]).filter(isSafeId))];

  /* ───────── record a supplier invoice (Unpaid / credit in V268.1) ───────── */
  async function createPurchaseInvoice(input = {}) {
    const { operationId, numbering } = input;
    const id = purchaseIdForOperation(operationId);
    const eventId = eventIdForOperation('post', operationId);
    ensure(numbering && isSafeId(numbering.counterKey) && typeof numbering.displayPrefix === 'string', PURCHASE_ERR.INVALID_INPUT, 'Document numbering is required');
    const actor = actorOf(), at = now();
    const soIds = soIdsOf(input.lines);
    ensure(soIds.length <= 40, PURCHASE_ERR.INVALID_INPUT, 'One invoice can cover at most 40 sales orders.');
    // the stock keys depend on validation; read the candidates (product / description keys) up front
    return transact(async tx => {
      const [settingsSnap, accessSnap, piSnap, counterSnap] = await Promise.all([tx.get(refs.settings()), tx.get(refs.access()), tx.get(refs.pi(id)), tx.get(refs.counter(numbering.counterKey))]);
      if (piSnap.exists()) {
        const ex = piSnap.data();
        ensure(ex.creationOperationId === operationId, PURCHASE_ERR.ID_COLLISION, 'Invoice ID already used by another operation');
        return { alreadyApplied: true, invoice: ex };
      }
      const settings = effectivePurchaseSettings(settingsSnap.exists() ? settingsSnap.data() : null);
      const admins = accessSnap.exists() && Array.isArray(accessSnap.data().adminUids) ? accessSnap.data().adminUids : [];
      const soSnaps = await Promise.all(soIds.map(s => tx.get(refs.so(s))));
      const ledSnaps = await Promise.all(soIds.map(s => tx.get(refs.ledger(s))));
      const orders = new Map(), ledgers = new Map();
      soIds.forEach((s, i) => { if (soSnaps[i].exists()) orders.set(s, { id: s, ...soSnaps[i].data() }); if (ledSnaps[i].exists()) ledgers.set(s, ledSnaps[i].data()); });
      const v = validatePurchaseInvoice(input, { settings, orders, ledgers, isAdmin: admins.includes(actor.uid) });
      if (!v.ok) fail(PURCHASE_ERR.INVALID_INPUT, v.errors.map(e => e.message).join(' '), { errors: v.errors });
      const val = v.value;
      const refKey = supplierRefIdOf(val.supplierKey, val.supplierInvoiceNo);
      ensure(isSafeId(refKey), PURCHASE_ERR.INVALID_INPUT, 'Invalid supplier invoice no.');
      const refSnap = await tx.get(refs.ref(refKey));
      if (refSnap.exists()) {
        const r = refSnap.data() || {};
        fail(PURCHASE_ERR.DUPLICATE_SUPPLIER_INVOICE, `${val.supplierName} invoice ${val.supplierInvoiceNo} is already recorded as ${r.piNo || 'another purchase invoice'}.`, { field: 'supplierInvoiceNo' });
      }
      const stockKeys = [...v.stock.keys()];
      const stockSnaps = await Promise.all(stockKeys.map(k => tx.get(refs.stock(k))));
      // V268.2: payments made at entry (one payment per date) — read their accounts and number counters now
      const groups = (Array.isArray(input.payments) ? input.payments : []).filter(g => g && Array.isArray(g.lines) && g.lines.some(l => l && (l.accountId || String(l.amount || '').trim())));
      ensure(groups.length <= 5, PURCHASE_ERR.INVALID_INPUT, 'At most 5 payment dates on one invoice.');
      groups.forEach(g => checkNumbering(g.numbering));
      const payAccounts = groups.length ? await readAccounts(tx, groups) : new Map();
      const payCounters = groups.length ? await readCounters(tx, groups.map(g => g.numbering.counterKey)) : new Map();

      // ── writes ──
      const seq = (Number(counterSnap.exists() ? counterSnap.data().value : 0) || 0) + 1;
      const piNo = formatNumber(numbering.displayPrefix, seq);
      const invoice = {
        id, schemaVersion: PURCHASE_SCHEMA_VERSION, piNo, ...val, supplierRefKey: refKey,
        status: PURCHASE_STATUS.posted, revision: 1, lastEventId: eventId, creationOperationId: operationId,
        created: at, createdBy: actor.name, createdByUid: actor.uid, updatedAt: at, updatedBy: actor.name, updatedByUid: actor.uid, recordedAt: stamp(),
        paymentDiscount: 0, cashBack: 0, paymentCount: 0,
      };
      // payments at entry: checked one after the other against the balance left
      const payRecs = [];
      groups.forEach((g, i) => {
        const pv = validateSupplierPayment({ kind: PAYMENT_KINDS.payment, date: g.date, lines: g.lines, discount: 0 }, { invoice, accounts: payAccounts, today: (options.today ? options.today() : at.slice(0, 10)) });
        if (!pv.ok) fail(PURCHASE_ERR.INVALID_INPUT, pv.errors.map(e => e.message).join(' '), { errors: pv.errors, field: 'payments' });
        const n = payCounters.get(g.numbering.counterKey) + 1; payCounters.set(g.numbering.counterKey, n);
        const recs = buildSupplierPaymentRecords({ id: paymentIdForOperation(operationId, i + 1), spNo: formatNumber(g.numbering.displayPrefix, n), value: pv.value, invoice, accounts: payAccounts, actor, at, stamp: stamp(), operationId });
        Object.assign(invoice, applyPaymentToInvoice(invoice, recs.payment, +1));
        invoice.paymentCount += 1;
        payRecs.push(recs);
      });
      assertSize(invoice, PI_BYTES, 'Purchase invoice');
      tx.set(refs.counter(numbering.counterKey), { value: seq, updatedAt: Date.now() });
      tx.set(refs.pi(id), invoice);
      tx.set(refs.event(id, eventId), { id: eventId, kind: 'posted', invoiceId: id, piNo, operationId, toRevision: 1, total: val.totals.total,
        soIds: val.soIds, paymentIds: payRecs.map(r => r.payment.id), paid: invoice.paid, actor: actor.name, actorUid: actor.uid, at, recordedAt: stamp() });
      for (const [k, n] of payCounters) tx.set(refs.counter(k), { value: n, updatedAt: Date.now() });
      payRecs.forEach(r => writePaymentRecords(tx, r, payAccounts));
      tx.set(refs.ref(refKey), { id: refKey, supplierKey: val.supplierKey, supplierInvoiceNo: val.supplierInvoiceNo, invoiceId: id, piNo, createdByUid: actor.uid, created: at });
      writeLedgers(tx, soIds, orders, ledgers, v.deltas, +1, { id, eventId, actor, at });
      stockKeys.forEach((k, i) => {
        const s = v.stock.get(k), cur = stockSnaps[i].exists() ? stockSnaps[i].data() : null;
        const qty = rq((cur ? Number(cur.qty) : 0) + s.qty), value = r2((cur ? Number(cur.value) : 0) + s.value);
        tx.set(refs.stock(k), { itemKey: k, productId: s.productId, code: s.code, desc: s.desc, uom: s.uom, qty, value,
          revision: (cur ? Number(cur.revision) || 0 : 0) + 1, lastInvoiceId: id, lastEventId: eventId, updatedByUid: actor.uid, updatedAt: at });
        const moveId = `${id}__${k}__in`.slice(0, 700);
        tx.set(refs.move(moveId), { id: moveId, itemKey: k, kind: 'purchase', qty: s.qty, value: s.value, invoiceId: id, piNo, eventId, date: val.date, actorUid: actor.uid, at });
      });
      return { alreadyApplied: false, invoice };
    });
  }

  function writeLedgers(tx, soIds, orders, ledgers, deltas, sign, { id, eventId, actor, at }) {
    for (const soId of soIds) {
      const d = deltas.get(soId); if (!d) continue;
      const cur = ledgers.get(soId) || { salesOrderId: soId, lines: {}, revision: 0 };
      const lines = { ...(cur.lines || {}) };
      for (const [lineId, q] of d) {
        const prev = lines[lineId] || { purchased: 0 };
        const purchased = rq((Number(prev.purchased) || 0) + sign * q);
        ensure(purchased >= -1e-9, PURCHASE_ERR.INVALID_STATE, 'Purchased quantity would become negative.');
        lines[lineId] = { purchased: Math.max(0, purchased) };
      }
      tx.set(refs.ledger(soId), { salesOrderId: soId, soNo: (orders.get(soId) || {}).soNo || cur.soNo || '', lines,
        revision: (Number(cur.revision) || 0) + 1, lastInvoiceId: id, lastEventId: eventId, updatedByUid: actor.uid, updatedAt: at });
    }
  }

  /* ───────── cancel (void) ───────── */
  async function voidPurchaseInvoice(input = {}) {
    const { operationId, invoiceId } = input;
    ensure(isSafeId(invoiceId), PURCHASE_ERR.INVALID_INPUT, 'Invoice reference required');
    const eventId = eventIdForOperation('void', operationId);
    const reason = requireReason(input.reason);
    const actor = actorOf(), at = now();
    return transact(async tx => {
      const piSnap = await tx.get(refs.pi(invoiceId));
      ensure(piSnap.exists(), PURCHASE_ERR.NOT_FOUND, 'Purchase invoice not found');
      const pi = piSnap.data();
      if (pi.status === PURCHASE_STATUS.voided) { ensure(pi.lastEventId === eventId, PURCHASE_ERR.INVALID_STATE, `${pi.piNo} is already cancelled`); return { alreadyApplied: true, invoice: pi }; }
      if (input.expectedRevision != null) ensure(pi.revision === input.expectedRevision, PURCHASE_ERR.STALE, `${pi.piNo} was changed meanwhile. Please open it again.`);
      ensure(!(Number(pi.paid) > 0.005 || Number(pi.paymentDiscount) > 0.005 || Number(pi.cashBack) > 0.005), PURCHASE_ERR.HAS_PAYMENTS, `${pi.piNo} has payments — cancel them first.`);
      const soIds = pi.soIds || [];
      const stockLines = (pi.lines || []).filter(l => Number(l.stockQty) > 0);
      const stockKeys = [...new Set(stockLines.map(l => l.itemKey))];
      const ledSnaps = await Promise.all(soIds.map(s => tx.get(refs.ledger(s))));
      const stockSnaps = await Promise.all(stockKeys.map(k => tx.get(refs.stock(k))));
      const ledgers = new Map(); soIds.forEach((s, i) => { if (ledSnaps[i].exists()) ledgers.set(s, ledSnaps[i].data()); });
      const deltas = new Map();
      (pi.lines || []).forEach(l => (l.allocations || []).forEach(a => { if (!deltas.has(a.soId)) deltas.set(a.soId, new Map()); const m = deltas.get(a.soId); m.set(a.soLineId, rq((m.get(a.soLineId) || 0) + Number(a.qty))); }));
      const stockOut = new Map();
      stockLines.forEach(l => { const s = stockOut.get(l.itemKey) || { qty: 0, value: 0 }; s.qty = rq(s.qty + Number(l.stockQty)); s.value = r2(s.value + Number(l.landedUnitCost) * Number(l.stockQty)); stockOut.set(l.itemKey, s); });
      stockKeys.forEach((k, i) => {
        const cur = stockSnaps[i].exists() ? stockSnaps[i].data() : null;
        ensure(cur && Number(cur.qty) + 1e-9 >= stockOut.get(k).qty, PURCHASE_ERR.STOCK_USED, `Some of the stock from ${pi.piNo} (${(cur && cur.desc) || k}) has already been used — it can't be cancelled.`);
      });
      const revision = pi.revision + 1;
      const next = { ...pi, status: PURCHASE_STATUS.voided, voidReason: reason, voidedAt: at, voidedBy: actor.name, voidedByUid: actor.uid,
        revision, lastEventId: eventId, updatedAt: at, updatedBy: actor.name, updatedByUid: actor.uid };
      tx.set(refs.pi(invoiceId), next);
      tx.set(refs.event(invoiceId, eventId), { id: eventId, kind: 'voided', invoiceId, piNo: pi.piNo, operationId, fromRevision: pi.revision, toRevision: revision, reason,
        actor: actor.name, actorUid: actor.uid, at, recordedAt: stamp() });
      // the supplier invoice no. becomes free again (it can be entered correctly)
      if (pi.supplierRefKey) tx.delete(refs.ref(pi.supplierRefKey));
      writeLedgers(tx, soIds, new Map(), ledgers, deltas, -1, { id: invoiceId, eventId, actor, at });
      stockKeys.forEach((k, i) => {
        const cur = stockSnaps[i].data(), o = stockOut.get(k);
        tx.set(refs.stock(k), { ...cur, qty: rq(Number(cur.qty) - o.qty), value: r2(Math.max(0, Number(cur.value) - o.value)), revision: (Number(cur.revision) || 0) + 1,
          lastInvoiceId: invoiceId, lastEventId: eventId, updatedByUid: actor.uid, updatedAt: at });
        const moveId = `${invoiceId}__${k}__void`.slice(0, 700);
        tx.set(refs.move(moveId), { id: moveId, itemKey: k, kind: 'purchase-cancelled', qty: -o.qty, value: -o.value, invoiceId, piNo: pi.piNo, eventId, date: at.slice(0, 10), actorUid: actor.uid, at });
      });
      return { alreadyApplied: false, invoice: next };
    });
  }

  /* ───────── V268.2: payment / cash back on a saved invoice ───────── */
  async function recordOnInvoice(input, kind) {
    const { operationId, invoiceId, numbering } = input;
    ensure(isSafeId(invoiceId), PURCHASE_ERR.INVALID_INPUT, 'Invoice reference required');
    checkNumbering(numbering);
    const id = paymentIdForOperation(operationId);
    const eventId = eventIdForOperation(kind === PAYMENT_KINDS.cashback ? 'cashback' : 'pay', operationId);
    const actor = actorOf(), at = now();
    return transact(async tx => {
      const [piSnap, paySnap] = await Promise.all([tx.get(refs.pi(invoiceId)), tx.get(refs.payment(id))]);
      if (paySnap.exists()) { const ex = paySnap.data(); ensure(ex.operationId === operationId, PURCHASE_ERR.ID_COLLISION, 'Payment ID already used'); return { alreadyApplied: true, payment: ex }; }
      ensure(piSnap.exists(), PURCHASE_ERR.NOT_FOUND, 'Purchase invoice not found');
      const pi = piSnap.data();
      ensure(pi.status === PURCHASE_STATUS.posted, PURCHASE_ERR.INVALID_STATE, `${pi.piNo} is cancelled.`);
      if (input.expectedRevision != null) ensure(pi.revision === input.expectedRevision, PURCHASE_ERR.STALE, `${pi.piNo} was changed meanwhile. Please open it again.`);
      const accounts = await readAccounts(tx, [{ lines: input.lines || [] }]);
      const counters = await readCounters(tx, [numbering.counterKey]);
      const pv = validateSupplierPayment({ ...input, kind }, { invoice: pi, accounts, today: options.today ? options.today() : at.slice(0, 10) });
      if (!pv.ok) fail(PURCHASE_ERR.INVALID_INPUT, pv.errors.map(e => e.message).join(' '), { errors: pv.errors });
      const seq = counters.get(numbering.counterKey) + 1;
      const recs = buildSupplierPaymentRecords({ id, spNo: formatNumber(numbering.displayPrefix, seq), value: pv.value, invoice: pi, accounts, actor, at, stamp: stamp(), operationId });
      const revision = pi.revision + 1;
      const figures = applyPaymentToInvoice(pi, recs.payment, +1);
      const next = { ...pi, ...figures, paymentCount: (Number(pi.paymentCount) || 0) + 1, revision, lastEventId: eventId, updatedAt: at, updatedBy: actor.name, updatedByUid: actor.uid };
      tx.set(refs.counter(numbering.counterKey), { value: seq, updatedAt: Date.now() });
      writePaymentRecords(tx, recs, accounts);
      tx.set(refs.pi(invoiceId), next);
      tx.set(refs.event(invoiceId, eventId), { id: eventId, kind: kind === PAYMENT_KINDS.cashback ? 'cashback' : 'payment', invoiceId, piNo: pi.piNo, operationId,
        paymentId: id, spNo: recs.payment.spNo, amount: recs.payment.amount, discount: recs.payment.discount,
        fromRevision: pi.revision, toRevision: revision, actor: actor.name, actorUid: actor.uid, at, recordedAt: stamp() });
      return { alreadyApplied: false, payment: recs.payment, invoice: next };
    });
  }
  const recordSupplierPayment = input => recordOnInvoice(input || {}, PAYMENT_KINDS.payment);
  const recordSupplierCashBack = input => recordOnInvoice({ ...(input || {}), discount: 0 }, PAYMENT_KINDS.cashback);

  /** Cancel a payment / cash back: it stays (void, with the reason); the ledger entry and the invoice go back. */
  async function voidSupplierPayment(input = {}) {
    const { operationId, paymentId } = input;
    ensure(isSafeId(paymentId), PURCHASE_ERR.INVALID_INPUT, 'Payment reference required');
    const reason = requireReason(input.reason);
    const eventId = eventIdForOperation('payvoid', operationId);
    const actor = actorOf(), at = now();
    return transact(async tx => {
      const paySnap = await tx.get(refs.payment(paymentId));
      ensure(paySnap.exists(), PURCHASE_ERR.NOT_FOUND, 'Payment not found');
      const pay = paySnap.data();
      if (pay.status === PURCHASE_STATUS.voided) { ensure(pay.voidEventId === eventId, PURCHASE_ERR.INVALID_STATE, `${pay.spNo} is already cancelled`); return { alreadyApplied: true, payment: pay }; }
      if (input.expectedRevision != null) ensure(pay.revision === input.expectedRevision, PURCHASE_ERR.STALE, `${pay.spNo} was changed meanwhile. Please open it again.`);
      const piSnap = await tx.get(refs.pi(pay.invoiceId));
      ensure(piSnap.exists(), PURCHASE_ERR.NOT_FOUND, 'Purchase invoice not found');
      const pi = piSnap.data();
      let entry = null; const lineSnaps = [];
      if (pay.entryId) {
        const es = await tx.get(refs.cashEntry(pay.entryId));
        ensure(es.exists(), PURCHASE_ERR.INVALID_STATE, 'The ledger entry of this payment is missing.');
        entry = es.data();
        for (const a of entry.accountIds || []) { const ls = await tx.get(refs.cashLine(`${entry.id}__${a}`)); if (ls.exists()) lineSnaps.push(ls.data()); }
      }
      const figures = applyPaymentToInvoice(pi, pay, -1);
      ensure(figures.paid >= -0.005 && figures.paymentDiscount >= -0.005, PURCHASE_ERR.INVALID_STATE, 'The invoice figures would become negative.');
      if (pay.kind !== PAYMENT_KINDS.cashback) ensure(figures.cashBack <= figures.paid + 0.005, PURCHASE_ERR.INVALID_STATE, `Cancel the cash back of ${pi.piNo} first — it would be more than what is paid.`);
      const revision = pi.revision + 1;
      tx.set(refs.payment(paymentId), { ...pay, status: PURCHASE_STATUS.voided, voidReason: reason, voidedAt: at, voidedBy: actor.name, voidedByUid: actor.uid, voidEventId: eventId,
        revision: pay.revision + 1, updatedAt: at, updatedBy: actor.name, updatedByUid: actor.uid });
      if (entry) {
        const er = Number(entry.revision) + 1;
        tx.set(refs.cashEntry(entry.id), { ...entry, void: true, voidReason: reason.slice(0, 200), revision: er, updatedByUid: actor.uid, updatedByName: actor.name, updatedAt: stamp() });
        for (const l of lineSnaps) tx.update(refs.cashLine(l.id), { void: true, voidReason: reason.slice(0, 200), entryRevision: er });
      }
      const next = { ...pi, ...figures, revision, lastEventId: eventId, updatedAt: at, updatedBy: actor.name, updatedByUid: actor.uid };
      tx.set(refs.pi(pi.id), next);
      tx.set(refs.event(pi.id, eventId), { id: eventId, kind: pay.kind === PAYMENT_KINDS.cashback ? 'cashback-voided' : 'payment-voided', invoiceId: pi.id, piNo: pi.piNo, operationId,
        paymentId, spNo: pay.spNo, amount: pay.amount, discount: pay.discount, reason, fromRevision: pi.revision, toRevision: revision, actor: actor.name, actorUid: actor.uid, at, recordedAt: stamp() });
      return { alreadyApplied: false, invoice: next };
    });
  }

  /* ───────── Administration → Purchase settings ───────── */
  async function savePurchaseSettings(input = {}) {
    const actor = actorOf();
    const v = validatePurchaseSettings(input);
    if (!v.ok) fail(PURCHASE_ERR.INVALID_INPUT, v.errors.map(e => e.message).join(' '), { errors: v.errors });
    return transact(async tx => {
      const [accessSnap, curSnap] = await Promise.all([tx.get(refs.access()), tx.get(refs.settings())]);
      const admins = accessSnap.exists() && Array.isArray(accessSnap.data().adminUids) ? accessSnap.data().adminUids : [];
      ensure(admins.includes(actor.uid), PURCHASE_ERR.NOT_ADMIN, 'Only administrators can change the purchase settings.');
      const revision = (curSnap.exists() ? Number(curSnap.data().revision) || 0 : 0) + 1;
      const next = { ...v.value, revision, updatedByUid: actor.uid, updatedBy: actor.name, updatedAt: stamp() };
      tx.set(refs.settings(), next);
      return next;
    });
  }

  return { createPurchaseInvoice, voidPurchaseInvoice, savePurchaseSettings, recordSupplierPayment, recordSupplierCashBack, voidSupplierPayment };
}
