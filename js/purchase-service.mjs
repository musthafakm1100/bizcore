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
import { accessWithRole } from './user-core.mjs?v=270.41';
import { formatSequence, nextSequence } from './numbering.mjs?v=270.25';
import {
  PURCHASE_COLLECTIONS as C, PURCHASE_SCHEMA_VERSION, PURCHASE_SETTINGS_PATH, PURCHASE_STATUS,
  effectivePurchaseSettings, validatePurchaseSettings, validatePurchaseInvoice, purchaseIdForOperation,
  supplierRefIdOf, r2, rq,
  PAYMENT_COLLECTION, PAYMENT_KINDS, paymentIdForOperation, paymentEntryIdOf, validateSupplierPayment, buildSupplierPaymentRecords,
  applyPaymentToInvoice, applyAdvanceUse, editRightOf, validateInvoiceLimitedEdit, validatePaymentLimitedEdit,
  STOCK_ALLOC_COLLECTION, allocationIdForOperation, validateAllocation,
  STOCK_CHANGE_COLLECTION, stockChangeIdForOperation, validateStockChange,
} from './purchase-core.mjs?v=269.7';
import { DeliveryError, isSafeId, eventIdForOperation, requireReason, cleanText, assertSize } from './delivery-core.mjs?v=266.0';

const fail = (code, message, details) => { throw new DeliveryError(code, message, details); };
const ensure = (ok, code, message, details) => { if (!ok) fail(code, message, details); };
export const PURCHASE_ERR = Object.freeze({
  INVALID_INPUT: 'invalid-input', NOT_FOUND: 'not-found', INVALID_STATE: 'invalid-state', STALE: 'stale-revision',
  DUPLICATE_SUPPLIER_INVOICE: 'duplicate-supplier-invoice', NOT_ADMIN: 'not-admin', STOCK_USED: 'stock-used', ID_COLLISION: 'id-collision',
  HAS_PAYMENTS: 'has-payments', ADVANCE_USED: 'advance-used', NOT_ALLOWED: 'not-allowed',
});
const PI_BYTES = 700 * 1024;

export function createPurchaseService(fs, options = {}) {
  const { db, doc, runTransaction } = fs || {};
  ensure(db && typeof doc === 'function' && typeof runTransaction === 'function', PURCHASE_ERR.INVALID_INPUT, 'Firestore transaction API required');
  const serverTimestamp = typeof fs.serverTimestamp === 'function' ? fs.serverTimestamp : null;
  const stamp = () => (serverTimestamp ? serverTimestamp() : new Date().toISOString());
  const now = options.now || (() => new Date().toISOString());
  const formatNumber = options.formatNumber || formatSequence;
  const actorOf = () => {
    const a = (options.actor && options.actor()) || {};
    ensure(isSafeId(a.uid), PURCHASE_ERR.INVALID_STATE, 'You must be signed in');
    return { uid: a.uid, name: cleanText(a.name || a.email || a.uid, 200) };
  };
  // V268.31: "today" is the user's own calendar day (Riyadh), not the UTC day — from midnight to 03:00 Riyadh, UTC is still on yesterday
  const todayLocal = () => { if (options.today) return options.today(); const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
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
    payEvent: (id, ev) => doc(db, PAYMENT_COLLECTION, id, 'events', ev),
    alloc: id => doc(db, STOCK_ALLOC_COLLECTION, id),
    change: id => doc(db, STOCK_CHANGE_COLLECTION, id),
    product: id => doc(db, 'products', id),
  };
  /** V268.3: the advances used by payment lines (read inside the transaction). */
  async function readAdvances(tx, groups) {
    const map = new Map();
    const ids = [...new Set(groups.flatMap(g => (g.lines || []).map(l => l && l.advanceId)).filter(isSafeId))];
    for (const id of ids) { const s = await tx.get(refs.payment(id)); if (s.exists()) map.set(id, { ...s.data() }); }
    return map;
  }
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
  function writePaymentRecords(tx, recs, accounts, advances, actor, at) {
    tx.set(refs.payment(recs.payment.id), recs.payment);
    // V268.3: the advances this payment uses — each moves by exactly its amount, pointing at this payment
    for (const advId of recs.payment.advanceIds || []) {
      const adv = advances.get(advId);
      const next = { ...adv, ...applyAdvanceUse(adv, recs.payment.advanceAmounts[advId], +1), revision: (Number(adv.revision) || 1) + 1, lastUseId: recs.payment.id, updatedAt: at, updatedBy: actor.name, updatedByUid: actor.uid };
      tx.set(refs.payment(advId), next); advances.set(advId, next);
    }
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
      const [settingsSnap, accessSnap, piSnap, counterSnap] = await Promise.all([tx.get(refs.settings()), accessWithRole(tx, doc, db, actorOf().uid), tx.get(refs.pi(id)), tx.get(refs.counter(numbering.counterKey))]);
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
      const payAdvances = groups.length ? await readAdvances(tx, groups) : new Map();
      const advSeen = new Set();
      const payCounters = groups.length ? await readCounters(tx, groups.map(g => g.numbering.counterKey)) : new Map();

      // ── writes ──
      const seq = nextSequence(counterSnap.exists() ? counterSnap.data().value : 0, numbering);
      const piNo = formatNumber(numbering.displayPrefix, seq, numbering.digits);
      const invoice = {
        id, schemaVersion: PURCHASE_SCHEMA_VERSION, piNo, ...val, supplierRefKey: refKey,
        status: PURCHASE_STATUS.posted, revision: 1, lastEventId: eventId, creationOperationId: operationId,
        created: at, createdBy: actor.name, createdByUid: actor.uid, updatedAt: at, updatedBy: actor.name, updatedByUid: actor.uid, recordedAt: stamp(),
        paymentDiscount: 0, cashBack: 0, paymentCount: 0,
      };
      // payments at entry: checked one after the other against the balance left
      const payRecs = [];
      groups.forEach((g, i) => {
        const pv = validateSupplierPayment({ kind: PAYMENT_KINDS.payment, date: g.date, lines: g.lines, discount: 0 }, { invoice, accounts: payAccounts, advances: payAdvances, today: (todayLocal()) });
        if (!pv.ok) fail(PURCHASE_ERR.INVALID_INPUT, pv.errors.map(e => e.message).join(' '), { errors: pv.errors, field: 'payments' });
        for (const a of pv.value.advanceIds) { ensure(!advSeen.has(a), PURCHASE_ERR.INVALID_INPUT, 'An advance can be used only once on one invoice.'); advSeen.add(a); }
        const n = nextSequence(payCounters.get(g.numbering.counterKey), g.numbering); payCounters.set(g.numbering.counterKey, n);
        const recs = buildSupplierPaymentRecords({ id: paymentIdForOperation(operationId, i + 1), spNo: formatNumber(g.numbering.displayPrefix, n, g.numbering.digits), value: pv.value, invoice, accounts: payAccounts, actor, at, stamp: stamp(), operationId });
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
      payRecs.forEach(r => writePaymentRecords(tx, r, payAccounts, payAdvances, actor, at));
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
        lines[lineId] = { ...prev, purchased: Math.max(0, purchased) };   // V268.4: keeps fromStock
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
        tx.set(refs.move(moveId), { id: moveId, itemKey: k, kind: 'purchase-cancelled', qty: -o.qty, value: -o.value, invoiceId, piNo: pi.piNo, eventId, date: todayLocal(), actorUid: actor.uid, at });
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
      const advances = await readAdvances(tx, [{ lines: input.lines || [] }]);
      const counters = await readCounters(tx, [numbering.counterKey]);
      const pv = validateSupplierPayment({ ...input, kind }, { invoice: pi, accounts, advances, today: todayLocal() });
      if (!pv.ok) fail(PURCHASE_ERR.INVALID_INPUT, pv.errors.map(e => e.message).join(' '), { errors: pv.errors });
      const seq = nextSequence(counters.get(numbering.counterKey), numbering);
      const recs = buildSupplierPaymentRecords({ id, spNo: formatNumber(numbering.displayPrefix, seq, numbering.digits), value: pv.value, invoice: pi, accounts, actor, at, stamp: stamp(), operationId });
      const revision = pi.revision + 1;
      const figures = applyPaymentToInvoice(pi, recs.payment, +1);
      const next = { ...pi, ...figures, paymentCount: (Number(pi.paymentCount) || 0) + 1, revision, lastEventId: eventId, updatedAt: at, updatedBy: actor.name, updatedByUid: actor.uid };
      tx.set(refs.counter(numbering.counterKey), { value: seq, updatedAt: Date.now() });
      writePaymentRecords(tx, recs, accounts, advances, actor, at);
      tx.set(refs.pi(invoiceId), next);
      tx.set(refs.event(invoiceId, eventId), { id: eventId, kind: kind === PAYMENT_KINDS.cashback ? 'cashback' : 'payment', invoiceId, piNo: pi.piNo, operationId,
        paymentId: id, spNo: recs.payment.spNo, amount: recs.payment.amount, discount: recs.payment.discount,
        fromRevision: pi.revision, toRevision: revision, actor: actor.name, actorUid: actor.uid, at, recordedAt: stamp() });
      return { alreadyApplied: false, payment: recs.payment, invoice: next };
    });
  }
  const recordSupplierPayment = input => recordOnInvoice(input || {}, PAYMENT_KINDS.payment);
  const recordSupplierCashBack = input => recordOnInvoice({ ...(input || {}), discount: 0 }, PAYMENT_KINDS.cashback);

  /** Reads a payment's ledger entry and its postings (inside the transaction). */
  async function readEntry(tx, entryId) {
    if (!entryId) return { entry: null, lines: [] };
    const es = await tx.get(refs.cashEntry(entryId));
    ensure(es.exists(), PURCHASE_ERR.INVALID_STATE, 'The ledger entry of this payment is missing.');
    const entry = es.data(), lines = [];
    for (const a of entry.accountIds || []) { const ls = await tx.get(refs.cashLine(`${entry.id}__${a}`)); if (ls.exists()) lines.push(ls.data()); }
    return { entry, lines };
  }
  function voidEntry(tx, entry, lines, why, actor) {
    if (!entry) return;
    const er = Number(entry.revision) + 1;
    tx.set(refs.cashEntry(entry.id), { ...entry, void: true, voidReason: why.slice(0, 200), revision: er, updatedByUid: actor.uid, updatedByName: actor.name, updatedAt: stamp() });
    for (const l of lines) tx.update(refs.cashLine(l.id), { void: true, voidReason: why.slice(0, 200), entryRevision: er });
  }
  async function roleOf(tx, uid) {
    const [accessSnap, settingsSnap] = await Promise.all([accessWithRole(tx, doc, db, actorOf().uid), tx.get(refs.settings())]);
    const admins = accessSnap.exists() && Array.isArray(accessSnap.data().adminUids) ? accessSnap.data().adminUids : [];
    return { isAdmin: admins.includes(uid), settings: effectivePurchaseSettings(settingsSnap.exists() ? settingsSnap.data() : null) };
  }

  /** Cancel a payment / cash back / advance: it stays (void, with the reason); the ledger entry, the invoice and any advance go back. */
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
      const isAdv = pay.kind === PAYMENT_KINDS.advance;
      if (isAdv) ensure(!(Number(pay.advanceUsed) > 0.005), PURCHASE_ERR.ADVANCE_USED, `${pay.spNo} is already used on an invoice (${Number(pay.advanceUsed).toFixed(2)}) — remove it from that invoice's payment first.`);
      let pi = null;
      if (!isAdv) { const piSnap = await tx.get(refs.pi(pay.invoiceId)); ensure(piSnap.exists(), PURCHASE_ERR.NOT_FOUND, 'Purchase invoice not found'); pi = piSnap.data(); }
      const advances = await readAdvances(tx, [{ lines: pay.lines || [] }]);
      const { entry, lines } = await readEntry(tx, pay.entryId);
      let figures = null;
      if (pi) {
        figures = applyPaymentToInvoice(pi, pay, -1);
        ensure(figures.paid >= -0.005 && figures.paymentDiscount >= -0.005, PURCHASE_ERR.INVALID_STATE, 'The invoice figures would become negative.');
        if (pay.kind !== PAYMENT_KINDS.cashback) ensure(figures.cashBack <= figures.paid + 0.005, PURCHASE_ERR.INVALID_STATE, `Cancel the cash back of ${pi.piNo} first — it would be more than what is paid.`);
      }
      tx.set(refs.payment(paymentId), { ...pay, status: PURCHASE_STATUS.voided, voidReason: reason, voidedAt: at, voidedBy: actor.name, voidedByUid: actor.uid, voidEventId: eventId,
        revision: pay.revision + 1, lastEventId: eventId, updatedAt: at, updatedBy: actor.name, updatedByUid: actor.uid });
      tx.set(refs.payEvent(paymentId, eventId), { id: eventId, kind: 'voided', paymentId, spNo: pay.spNo, operationId, reason, toRevision: pay.revision + 1, actor: actor.name, actorUid: actor.uid, at, recordedAt: stamp() });
      voidEntry(tx, entry, lines, reason, actor);
      // the advances it used become available again
      for (const advId of pay.advanceIds || []) {
        const adv = advances.get(advId); if (!adv) continue;
        tx.set(refs.payment(advId), { ...adv, ...applyAdvanceUse(adv, (pay.advanceAmounts || {})[advId], -1), revision: (Number(adv.revision) || 1) + 1, lastUseId: paymentId, updatedAt: at, updatedBy: actor.name, updatedByUid: actor.uid });
      }
      if (!pi) return { alreadyApplied: false, payment: { ...pay, status: PURCHASE_STATUS.voided } };
      const revision = pi.revision + 1;
      const next = { ...pi, ...figures, revision, lastEventId: eventId, updatedAt: at, updatedBy: actor.name, updatedByUid: actor.uid };
      tx.set(refs.pi(pi.id), next);
      tx.set(refs.event(pi.id, eventId), { id: eventId, kind: pay.kind === PAYMENT_KINDS.cashback ? 'cashback-voided' : 'payment-voided', invoiceId: pi.id, piNo: pi.piNo, operationId,
        paymentId, spNo: pay.spNo, amount: pay.amount, discount: pay.discount, reason, fromRevision: pi.revision, toRevision: revision, actor: actor.name, actorUid: actor.uid, at, recordedAt: stamp() });
      return { alreadyApplied: false, invoice: next };
    });
  }

  /* ───────── V268.3: advance (paid before the invoice) ───────── */
  async function payAdvance(input = {}) {
    const { operationId, numbering } = input;
    checkNumbering(numbering);
    const id = paymentIdForOperation(operationId);
    const eventId = eventIdForOperation('adv', operationId);
    const actor = actorOf(), at = now();
    return transact(async tx => {
      const paySnap = await tx.get(refs.payment(id));
      if (paySnap.exists()) { const ex = paySnap.data(); ensure(ex.operationId === operationId, PURCHASE_ERR.ID_COLLISION, 'Payment ID already used'); return { alreadyApplied: true, payment: ex }; }
      const accounts = await readAccounts(tx, [{ lines: input.lines || [] }]);
      const counters = await readCounters(tx, [numbering.counterKey]);
      const pv = validateSupplierPayment({ ...input, kind: PAYMENT_KINDS.advance, discount: 0, lines: (input.lines || []).filter(l => !l.advanceId) }, { accounts, today: todayLocal() });
      if (!pv.ok) fail(PURCHASE_ERR.INVALID_INPUT, pv.errors.map(e => e.message).join(' '), { errors: pv.errors });
      const seq = nextSequence(counters.get(numbering.counterKey), numbering);
      const recs = buildSupplierPaymentRecords({ id, spNo: formatNumber(numbering.displayPrefix, seq, numbering.digits), value: pv.value, invoice: null, accounts, actor, at, stamp: stamp(), operationId });
      recs.payment.lastEventId = eventId;
      tx.set(refs.counter(numbering.counterKey), { value: seq, updatedAt: Date.now() });
      writePaymentRecords(tx, recs, accounts, new Map(), actor, at);
      tx.set(refs.payEvent(id, eventId), { id: eventId, kind: 'posted', paymentId: id, spNo: recs.payment.spNo, operationId, amount: recs.payment.amount, toRevision: 1, actor: actor.name, actorUid: actor.uid, at, recordedAt: stamp() });
      return { alreadyApplied: false, payment: recs.payment };
    });
  }

  /* ───────── V268.3: edit a payment / cash back / advance ───────── */
  async function editSupplierPayment(input = {}) {
    const { operationId, paymentId, mode } = input;
    ensure(isSafeId(paymentId), PURCHASE_ERR.INVALID_INPUT, 'Payment reference required');
    const reason = String(input.reason || '').replace(/\s+/g, ' ').trim().slice(0, 300);
    ensure(reason, PURCHASE_ERR.INVALID_INPUT, 'Enter the reason for the change.');
    const eventId = eventIdForOperation('payedit', operationId);
    const actor = actorOf(), at = now();
    return transact(async tx => {
      const paySnap = await tx.get(refs.payment(paymentId));
      ensure(paySnap.exists(), PURCHASE_ERR.NOT_FOUND, 'Payment not found');
      const pay = paySnap.data();
      if (pay.lastEventId === eventId) return { alreadyApplied: true, payment: pay };
      if (input.expectedRevision != null) ensure(pay.revision === input.expectedRevision, PURCHASE_ERR.STALE, `${pay.spNo} was changed meanwhile. Please open it again.`);
      const role = await roleOf(tx, actor.uid);
      const right = editRightOf(pay, { settings: role.settings, isAdmin: role.isAdmin, nowMs: Date.parse(at) });
      ensure(right.right, PURCHASE_ERR.NOT_ALLOWED, right.why || 'You can\'t edit this payment.');
      const revision = pay.revision + 1;
      if (mode !== 'full') {
        const v = validatePaymentLimitedEdit(pay, input);
        if (!v.ok) fail(PURCHASE_ERR.INVALID_INPUT, v.errors.map(e => e.message).join(' '), { errors: v.errors });
        tx.set(refs.payment(paymentId), { ...pay, lines: v.value.lines, note: v.value.note, revision, lastEventId: eventId, lastEditReason: reason, updatedAt: at, updatedBy: actor.name, updatedByUid: actor.uid });
        tx.set(refs.payEvent(paymentId, eventId), { id: eventId, kind: 'edited', mode: 'limited', paymentId, spNo: pay.spNo, operationId, reason, changes: v.changes, toRevision: revision, actor: actor.name, actorUid: actor.uid, at, recordedAt: stamp() });
        return { alreadyApplied: false, payment: { ...pay, lines: v.value.lines, note: v.value.note, revision } };
      }
      ensure(right.right === 'full', PURCHASE_ERR.NOT_ALLOWED, 'Only administrators can change the amounts and accounts (Administration → Purchase Settings).');
      ensure(!(pay.advanceIds || []).length, PURCHASE_ERR.NOT_ALLOWED, `${pay.spNo} uses an advance — cancel it and enter it again.`);
      const isAdv = pay.kind === PAYMENT_KINDS.advance;
      let pi = null, base = null;
      if (!isAdv) {
        const piSnap = await tx.get(refs.pi(pay.invoiceId)); ensure(piSnap.exists(), PURCHASE_ERR.NOT_FOUND, 'Purchase invoice not found'); pi = piSnap.data();
        ensure(pi.status === PURCHASE_STATUS.posted, PURCHASE_ERR.INVALID_STATE, `${pi.piNo} is cancelled.`);
        base = { ...pi, ...applyPaymentToInvoice(pi, pay, -1) };   // the invoice without this payment
      }
      const accounts = await readAccounts(tx, [{ lines: input.lines || [] }]);
      const { entry, lines } = await readEntry(tx, pay.entryId);
      const pv = validateSupplierPayment({ ...input, kind: pay.kind, lines: (input.lines || []).filter(l => !l.advanceId),
        ...(isAdv ? { supplierId: pay.supplierId, supplierName: pay.supplierName } : {}) }, { invoice: base, accounts, today: todayLocal() });
      if (!pv.ok) fail(PURCHASE_ERR.INVALID_INPUT, pv.errors.map(e => e.message).join(' '), { errors: pv.errors });
      if (isAdv) {
        ensure(pv.value.amount + 0.005 >= (Number(pay.advanceUsed) || 0), PURCHASE_ERR.INVALID_INPUT, `${Number(pay.advanceUsed).toFixed(2)} of this advance is already used — the amount can't be less.`);
        pv.value.supplier.supplierKey = pay.supplierKey;
      }
      const newEntryId = `${paymentEntryIdOf(paymentId)}-r${revision}`;
      const recs = buildSupplierPaymentRecords({ id: paymentId, spNo: pay.spNo, value: pv.value, invoice: base, accounts, actor, at, stamp: stamp(), operationId: pay.operationId, entryId: newEntryId, revision });
      const keep = { created: pay.created, createdBy: pay.createdBy, createdByUid: pay.createdByUid, recordedAt: pay.recordedAt };
      const nextPay = { ...recs.payment, ...keep, lastEventId: eventId, lastEditReason: reason,
        ...(isAdv ? { soId: pay.soId || '', soNo: pay.soNo || '', advanceUsed: Number(pay.advanceUsed) || 0, advanceLeft: Math.round(((pv.value.amount) - (Number(pay.advanceUsed) || 0)) * 100) / 100, lastUseId: pay.lastUseId || '' } : {}) };
      voidEntry(tx, entry, lines, `Changed (${pay.spNo} edited): ${reason}`, actor);
      if (recs.entry) {
        tx.set(refs.cashEntry(recs.entry.id), recs.entry);
        for (const l of recs.lines) tx.set(refs.cashLine(l.id), l);
        for (const a of recs.entry.accountIds) { const acc = accounts.get(a); if (acc && !acc.hasEntries) tx.update(refs.account(a), { hasEntries: true }); }
      }
      tx.set(refs.payment(paymentId), nextPay);
      const sum = p => ({ date: p.date, amount: p.amount, discount: p.discount || 0, bankCharges: p.bankCharges || 0, accounts: (p.lines || []).map(l => `${l.accountCode || l.advanceNo || ''} ${l.amount}`).join(', ') });
      tx.set(refs.payEvent(paymentId, eventId), { id: eventId, kind: 'edited', mode: 'full', paymentId, spNo: pay.spNo, operationId, reason, before: sum(pay), after: sum(nextPay), toRevision: revision, actor: actor.name, actorUid: actor.uid, at, recordedAt: stamp() });
      if (pi) {
        const figures = applyPaymentToInvoice(base, nextPay, +1);
        if (pay.kind === PAYMENT_KINDS.payment) ensure(figures.cashBack <= figures.paid + 0.005, PURCHASE_ERR.INVALID_STATE, 'The cash back would be more than what is paid.');
        const pr = pi.revision + 1;
        tx.set(refs.pi(pi.id), { ...pi, ...figures, revision: pr, lastEventId: eventId, updatedAt: at, updatedBy: actor.name, updatedByUid: actor.uid });
        tx.set(refs.event(pi.id, eventId), { id: eventId, kind: pay.kind === PAYMENT_KINDS.cashback ? 'cashback-edited' : 'payment-edited', invoiceId: pi.id, piNo: pi.piNo, operationId,
          paymentId, spNo: pay.spNo, amount: nextPay.amount, discount: nextPay.discount, before: sum(pay), reason, fromRevision: pi.revision, toRevision: pr, actor: actor.name, actorUid: actor.uid, at, recordedAt: stamp() });
      }
      return { alreadyApplied: false, payment: nextPay };
    });
  }

  /* ───────── V268.3: edit a purchase invoice ───────── */
  async function editPurchaseInvoice(input = {}) {
    const { operationId, invoiceId, mode } = input;
    ensure(isSafeId(invoiceId), PURCHASE_ERR.INVALID_INPUT, 'Invoice reference required');
    const reason = String(input.reason || '').replace(/\s+/g, ' ').trim().slice(0, 300);
    ensure(reason, PURCHASE_ERR.INVALID_INPUT, 'Enter the reason for the change.');
    const eventId = eventIdForOperation('edit', operationId);
    const actor = actorOf(), at = now();
    return transact(async tx => {
      const piSnap = await tx.get(refs.pi(invoiceId));
      ensure(piSnap.exists(), PURCHASE_ERR.NOT_FOUND, 'Purchase invoice not found');
      const pi = piSnap.data();
      if (pi.lastEventId === eventId) return { alreadyApplied: true, invoice: pi };
      if (input.expectedRevision != null) ensure(pi.revision === input.expectedRevision, PURCHASE_ERR.STALE, `${pi.piNo} was changed meanwhile. Please open it again.`);
      const role = await roleOf(tx, actor.uid);
      const right = editRightOf(pi, { settings: role.settings, isAdmin: role.isAdmin, nowMs: Date.parse(at) });
      ensure(right.right, PURCHASE_ERR.NOT_ALLOWED, right.why || 'You can\'t edit this invoice.');
      const revision = pi.revision + 1;
      if (mode !== 'full') {
        const v = validateInvoiceLimitedEdit(pi, input);
        if (!v.ok) fail(PURCHASE_ERR.INVALID_INPUT, v.errors.map(e => e.message).join(' '), { errors: v.errors });
        const newKey = supplierRefIdOf(pi.supplierKey, v.value.supplierInvoiceNo);
        ensure(isSafeId(newKey), PURCHASE_ERR.INVALID_INPUT, 'Invalid supplier invoice no.');
        if (newKey !== pi.supplierRefKey) {
          const refSnap = await tx.get(refs.ref(newKey));
          if (refSnap.exists()) fail(PURCHASE_ERR.DUPLICATE_SUPPLIER_INVOICE, `${pi.supplierName} invoice ${v.value.supplierInvoiceNo} is already recorded as ${refSnap.data().piNo || 'another purchase invoice'}.`, { field: 'supplierInvoiceNo' });
        }
        const next = { ...pi, supplierInvoiceNo: v.value.supplierInvoiceNo, supplierInvoiceKey: v.value.supplierInvoiceKey, supplierRefKey: newKey, zohoBillNo: v.value.zohoBillNo,
          date: v.value.date, dueDate: v.value.dueDate, lines: v.value.lines, revision, lastEventId: eventId, lastEditReason: reason, updatedAt: at, updatedBy: actor.name, updatedByUid: actor.uid };
        tx.set(refs.pi(invoiceId), next);
        tx.set(refs.event(invoiceId, eventId), { id: eventId, kind: 'edited', mode: 'limited', invoiceId, piNo: pi.piNo, operationId, reason, changes: v.changes, fromRevision: pi.revision, toRevision: revision, actor: actor.name, actorUid: actor.uid, at, recordedAt: stamp() });
        if (newKey !== pi.supplierRefKey) {
          tx.set(refs.ref(newKey), { id: newKey, supplierKey: pi.supplierKey, supplierInvoiceNo: v.value.supplierInvoiceNo, invoiceId, piNo: pi.piNo, createdByUid: actor.uid, created: at });
          if (pi.supplierRefKey) tx.delete(refs.ref(pi.supplierRefKey));
        }
        return { alreadyApplied: false, invoice: next, changes: v.changes };
      }
      // full edit: same number; the purchased quantities and the stock move from the old figures to the new ones
      ensure(right.right === 'full', PURCHASE_ERR.NOT_ALLOWED, 'Only administrators can change the lines and amounts (Administration → Purchase Settings).');
      ensure(!(Number(pi.paid) > 0.005 || Number(pi.paymentDiscount) > 0.005 || Number(pi.cashBack) > 0.005), PURCHASE_ERR.HAS_PAYMENTS, `${pi.piNo} has payments — cancel them first, then change the lines and amounts.`);
      const oldDeltas = new Map();
      (pi.lines || []).forEach(l => (l.allocations || []).forEach(a => { if (!oldDeltas.has(a.soId)) oldDeltas.set(a.soId, new Map()); const m = oldDeltas.get(a.soId); m.set(a.soLineId, rq((m.get(a.soLineId) || 0) + Number(a.qty))); }));
      const soIds = [...new Set([...(pi.soIds || []), ...soIdsOf(input.lines)])];
      ensure(soIds.length <= 40, PURCHASE_ERR.INVALID_INPUT, 'One invoice can cover at most 40 sales orders.');
      const soSnaps = await Promise.all(soIds.map(x => tx.get(refs.so(x))));
      const ledSnaps = await Promise.all(soIds.map(x => tx.get(refs.ledger(x))));
      const orders = new Map(), ledgers = new Map(), ledgersAdj = new Map();
      soIds.forEach((x, i) => {
        if (soSnaps[i].exists()) orders.set(x, { id: x, ...soSnaps[i].data() });
        if (ledSnaps[i].exists()) {
          const cur = ledSnaps[i].data(); ledgers.set(x, cur);
          const lines = {}; Object.entries(cur.lines || {}).forEach(([k, v]) => { lines[k] = { purchased: Math.max(0, rq((Number(v.purchased) || 0) - ((oldDeltas.get(x) || new Map()).get(k) || 0))) }; });
          ledgersAdj.set(x, { ...cur, lines });
        }
      });
      const v = validatePurchaseInvoice({ ...input, operationId: pi.creationOperationId || operationId }, { settings: role.settings, orders, ledgers: ledgersAdj, isAdmin: role.isAdmin });
      if (!v.ok) fail(PURCHASE_ERR.INVALID_INPUT, v.errors.map(e => e.message).join(' '), { errors: v.errors });
      const val = v.value;
      const newKey = supplierRefIdOf(val.supplierKey, val.supplierInvoiceNo);
      ensure(isSafeId(newKey), PURCHASE_ERR.INVALID_INPUT, 'Invalid supplier invoice no.');
      if (newKey !== pi.supplierRefKey) {
        const refSnap = await tx.get(refs.ref(newKey));
        if (refSnap.exists()) fail(PURCHASE_ERR.DUPLICATE_SUPPLIER_INVOICE, `${val.supplierName} invoice ${val.supplierInvoiceNo} is already recorded as ${refSnap.data().piNo || 'another purchase invoice'}.`, { field: 'supplierInvoiceNo' });
      }
      // stock: old quantities out, new quantities in
      const oldStock = new Map();
      (pi.lines || []).filter(l => Number(l.stockQty) > 0).forEach(l => { const x = oldStock.get(l.itemKey) || { qty: 0, value: 0 }; x.qty = rq(x.qty + Number(l.stockQty)); x.value = r2(x.value + Number(l.landedUnitCost) * Number(l.stockQty)); oldStock.set(l.itemKey, x); });
      const stockKeys = [...new Set([...oldStock.keys(), ...v.stock.keys()])];
      const stockSnaps = await Promise.all(stockKeys.map(k => tx.get(refs.stock(k))));
      // ── writes ──
      const next = { ...val, id: invoiceId, schemaVersion: pi.schemaVersion, piNo: pi.piNo, supplierRefKey: newKey, status: PURCHASE_STATUS.posted, revision, lastEventId: eventId,
        creationOperationId: pi.creationOperationId, created: pi.created, createdBy: pi.createdBy, createdByUid: pi.createdByUid, recordedAt: pi.recordedAt,
        paymentDiscount: 0, cashBack: 0, paymentCount: Number(pi.paymentCount) || 0, lastEditReason: reason, updatedAt: at, updatedBy: actor.name, updatedByUid: actor.uid };
      assertSize(next, PI_BYTES, 'Purchase invoice');
      tx.set(refs.pi(invoiceId), next);
      tx.set(refs.event(invoiceId, eventId), { id: eventId, kind: 'edited', mode: 'full', invoiceId, piNo: pi.piNo, operationId, reason,
        before: { total: pi.totals.total, lines: (pi.lines || []).length, soIds: pi.soIds || [] }, after: { total: next.totals.total, lines: next.lines.length, soIds: next.soIds },
        fromRevision: pi.revision, toRevision: revision, actor: actor.name, actorUid: actor.uid, at, recordedAt: stamp() });
      if (newKey !== pi.supplierRefKey) {
        tx.set(refs.ref(newKey), { id: newKey, supplierKey: val.supplierKey, supplierInvoiceNo: val.supplierInvoiceNo, invoiceId, piNo: pi.piNo, createdByUid: actor.uid, created: at });
        if (pi.supplierRefKey) tx.delete(refs.ref(pi.supplierRefKey));
      }
      const deltas = new Map();
      soIds.forEach(x => {
        const m = new Map(), o = oldDeltas.get(x) || new Map(), n = v.deltas.get(x) || new Map();
        new Set([...o.keys(), ...n.keys()]).forEach(k => { const q = rq((n.get(k) || 0) - (o.get(k) || 0)); if (Math.abs(q) > 1e-9) m.set(k, q); });
        if (m.size) deltas.set(x, m);
      });
      writeLedgers(tx, [...deltas.keys()], orders, ledgers, deltas, +1, { id: invoiceId, eventId, actor, at });
      stockKeys.forEach((k, i) => {
        const cur = stockSnaps[i].exists() ? stockSnaps[i].data() : null, o = oldStock.get(k) || { qty: 0, value: 0 }, n = v.stock.get(k) || { qty: 0, value: 0, productId: '', code: '', desc: '', uom: '' };
        const dq = rq(n.qty - o.qty), dv = r2(n.value - o.value);
        if (Math.abs(dq) < 1e-9 && Math.abs(dv) < 0.005) return;
        const qty = rq((cur ? Number(cur.qty) : 0) + dq);
        ensure(qty >= -1e-9, PURCHASE_ERR.STOCK_USED, `Some of the stock from ${pi.piNo} (${(cur && cur.desc) || k}) has already been used — it can't be reduced.`);
        tx.set(refs.stock(k), { ...(cur || { itemKey: k, productId: n.productId, code: n.code, desc: n.desc, uom: n.uom }), itemKey: k, qty: Math.max(0, qty), value: r2(Math.max(0, (cur ? Number(cur.value) : 0) + dv)),
          revision: (cur ? Number(cur.revision) || 0 : 0) + 1, lastInvoiceId: invoiceId, lastEventId: eventId, updatedByUid: actor.uid, updatedAt: at });
        const moveId = `${invoiceId}__${k}__edit${revision}`.slice(0, 700);
        tx.set(refs.move(moveId), { id: moveId, itemKey: k, kind: 'purchase-edited', qty: dq, value: dv, invoiceId, piNo: pi.piNo, eventId, date: todayLocal(), actorUid: actor.uid, at });
      });
      return { alreadyApplied: false, invoice: next };
    });
  }


  /* ───────── V268.4: allocate stock to a sales order line (and cancel it) ───────── */
  async function allocateStock(input = {}) {
    const { operationId, itemKey, soId } = input;
    const id = allocationIdForOperation(operationId);
    ensure(isSafeId(id) && isSafeId(itemKey) && isSafeId(soId), PURCHASE_ERR.INVALID_INPUT, 'Choose the stock item and the sales order line.');
    const eventId = eventIdForOperation('alloc', operationId);
    const actor = actorOf(), at = now();
    return transact(async tx => {
      const [aSnap, iSnap, soSnap, lSnap] = await Promise.all([tx.get(refs.alloc(id)), tx.get(refs.stock(itemKey)), tx.get(refs.so(soId)), tx.get(refs.ledger(soId))]);
      if (aSnap.exists()) { const ex = aSnap.data(); ensure(ex.operationId === operationId, PURCHASE_ERR.ID_COLLISION, 'Allocation ID already used'); return { alreadyApplied: true, allocation: ex }; }
      const item = iSnap.exists() ? iSnap.data() : null, so = soSnap.exists() ? { id: soId, ...soSnap.data() } : null, ledger = lSnap.exists() ? lSnap.data() : null;
      const v = validateAllocation(input, { item, so, ledger, today: todayLocal() });
      if (!v.ok) fail(PURCHASE_ERR.INVALID_INPUT, v.errors.map(e => e.message).join(' '), { errors: v.errors });
      const val = v.value;
      const allocation = { id, schemaVersion: PURCHASE_SCHEMA_VERSION, operationId, status: PURCHASE_STATUS.posted, revision: 1, lastEventId: eventId,
        itemKey, desc: val.desc, uom: val.uom, soId, soNo: val.soNo, customer: val.customer, soLineId: val.soLineId,
        qty: val.qty, unitCost: val.unitCost, value: val.value, sellUnit: val.sellUnit, date: val.date, note: val.note,
        created: at, createdBy: actor.name, createdByUid: actor.uid, updatedAt: at, updatedBy: actor.name, updatedByUid: actor.uid, recordedAt: stamp() };
      tx.set(refs.alloc(id), allocation);
      writeStockForAllocation(tx, item, -val.qty, -val.value, { id, eventId, actor, at });
      writeLedgerForAllocation(tx, so, ledger, val.soLineId, +val.qty, { id, eventId, actor, at });
      const moveId = `${id}__out`;
      tx.set(refs.move(moveId), { id: moveId, itemKey, kind: 'allocated', qty: -val.qty, value: -val.value, allocationId: id, soId, soNo: val.soNo, soLineId: val.soLineId,
        eventId, date: val.date, note: val.note, actor: actor.name, actorUid: actor.uid, at });
      return { alreadyApplied: false, allocation };
    });
  }
  async function cancelStockAllocation(input = {}) {
    const { operationId, allocationId } = input;
    ensure(isSafeId(allocationId), PURCHASE_ERR.INVALID_INPUT, 'Allocation reference required');
    const reason = requireReason(input.reason);
    const eventId = eventIdForOperation('allocvoid', operationId);
    const actor = actorOf(), at = now();
    return transact(async tx => {
      const aSnap = await tx.get(refs.alloc(allocationId));
      ensure(aSnap.exists(), PURCHASE_ERR.NOT_FOUND, 'Allocation not found');
      const a = aSnap.data();
      if (a.status === PURCHASE_STATUS.voided) { ensure(a.lastEventId === eventId, PURCHASE_ERR.INVALID_STATE, 'This allocation is already cancelled.'); return { alreadyApplied: true, allocation: a }; }
      const [iSnap, soSnap, lSnap] = await Promise.all([tx.get(refs.stock(a.itemKey)), tx.get(refs.so(a.soId)), tx.get(refs.ledger(a.soId))]);
      const ledger = lSnap.exists() ? lSnap.data() : null;
      const cur = ledger && (ledger.lines || {})[a.soLineId];
      ensure(cur && Number(cur.purchased) + 1e-9 >= a.qty, PURCHASE_ERR.INVALID_STATE, `${a.soNo} no longer has this quantity bought.`);
      const next = { ...a, status: PURCHASE_STATUS.voided, voidReason: reason, voidedAt: at, voidedBy: actor.name, voidedByUid: actor.uid,
        revision: a.revision + 1, lastEventId: eventId, updatedAt: at, updatedBy: actor.name, updatedByUid: actor.uid };
      tx.set(refs.alloc(allocationId), next);
      const item = iSnap.exists() ? iSnap.data() : { itemKey: a.itemKey, desc: a.desc, uom: a.uom, qty: 0, value: 0, revision: 0 };
      writeStockForAllocation(tx, item, +a.qty, +a.value, { id: allocationId, eventId, actor, at });
      writeLedgerForAllocation(tx, soSnap.exists() ? { id: a.soId, ...soSnap.data() } : { id: a.soId, soNo: a.soNo }, ledger, a.soLineId, -a.qty, { id: allocationId, eventId, actor, at });
      const moveId = `${allocationId}__back`;
      tx.set(refs.move(moveId), { id: moveId, itemKey: a.itemKey, kind: 'allocation-cancelled', qty: a.qty, value: a.value, allocationId, soId: a.soId, soNo: a.soNo, soLineId: a.soLineId,
        eventId, date: todayLocal(), note: reason, actor: actor.name, actorUid: actor.uid, at });
      return { alreadyApplied: false, allocation: next };
    });
  }
  function writeStockForAllocation(tx, item, dq, dv, { id, eventId, actor, at }) {
    const qty = rq((Number(item.qty) || 0) + dq);
    ensure(qty >= -1e-9, PURCHASE_ERR.STOCK_USED, `Not enough ${item.desc || 'stock'} in stock.`);
    tx.set(refs.stock(item.itemKey), { ...item, qty: Math.max(0, qty), value: qty <= 1e-9 ? 0 : r2(Math.max(0, (Number(item.value) || 0) + dv)),
      revision: (Number(item.revision) || 0) + 1, lastAllocationId: id, lastEventId: eventId, updatedByUid: actor.uid, updatedAt: at });
  }
  function writeLedgerForAllocation(tx, so, ledger, lineId, dq, { id, eventId, actor, at }) {
    const cur = ledger || { salesOrderId: so.id, lines: {}, revision: 0 };
    const prev = (cur.lines || {})[lineId] || { purchased: 0 };
    const purchased = rq((Number(prev.purchased) || 0) + dq), fromStock = rq((Number(prev.fromStock) || 0) + dq);
    ensure(purchased >= -1e-9 && fromStock >= -1e-9, PURCHASE_ERR.INVALID_STATE, 'Purchased quantity would become negative.');
    tx.set(refs.ledger(so.id), { ...cur, salesOrderId: so.id, soNo: so.soNo || cur.soNo || '', lines: { ...(cur.lines || {}), [lineId]: { ...prev, purchased: Math.max(0, purchased), fromStock: Math.max(0, fromStock) } },
      revision: (Number(cur.revision) || 0) + 1, lastAllocationId: id, lastEventId: eventId, updatedByUid: actor.uid, updatedAt: at });
  }

  /* ───────── V268.5: Change Item (administrators) ───────── */
  async function adminsOf(tx) { const a = await accessWithRole(tx, doc, db, actorOf().uid); return a.exists() && Array.isArray(a.data().adminUids) ? a.data().adminUids : []; }
  async function changeStockItem(input = {}) {
    const { operationId, itemKey } = input;
    const id = stockChangeIdForOperation(operationId);
    ensure(isSafeId(id) && isSafeId(itemKey), PURCHASE_ERR.INVALID_INPUT, 'Choose the stock item.');
    const product = input.product || null;
    const eventId = eventIdForOperation('chg', operationId);
    const actor = actorOf(), at = now();
    return transact(async tx => {
      const [cSnap, iSnap, admins] = await Promise.all([tx.get(refs.change(id)), tx.get(refs.stock(itemKey)), adminsOf(tx)]);
      if (cSnap.exists()) { const ex = cSnap.data(); ensure(ex.operationId === operationId, PURCHASE_ERR.ID_COLLISION, 'Change ID already used'); return { alreadyApplied: true, change: ex }; }
      ensure(admins.includes(actor.uid), PURCHASE_ERR.NOT_ADMIN, 'Only administrators can change the item of stock.');
      const item = iSnap.exists() ? iSnap.data() : null;
      const v = validateStockChange(input, { item, product, today: todayLocal() });
      if (!v.ok) fail(PURCHASE_ERR.INVALID_INPUT, v.errors.map(e => e.message).join(' '), { errors: v.errors });
      const val = v.value;
      const toSnap = await tx.get(refs.stock(val.toKey));
      const to = toSnap.exists() ? toSnap.data() : { itemKey: val.toKey, productId: val.toProductId, code: val.toCode, desc: val.toDesc, uom: val.uom, qty: 0, value: 0, revision: 0 };
      const change = { id, schemaVersion: PURCHASE_SCHEMA_VERSION, operationId, status: PURCHASE_STATUS.posted, revision: 1, lastEventId: eventId, ...val,
        created: at, createdBy: actor.name, createdByUid: actor.uid, updatedAt: at, updatedBy: actor.name, updatedByUid: actor.uid, recordedAt: stamp() };
      tx.set(refs.change(id), change);
      writeStockForChange(tx, item, -val.qty, -val.value, { id, eventId, actor, at });
      writeStockForChange(tx, to, +val.qty, +val.value, { id, eventId, actor, at });
      const mv = (suffix, key, q, value, kind, other) => { const moveId = `${id}__${suffix}`; tx.set(refs.move(moveId), { id: moveId, itemKey: key, kind, qty: q, value, changeId: id, otherKey: other.key, otherDesc: other.desc,
        eventId, date: val.date, note: val.reason, actor: actor.name, actorUid: actor.uid, at }); };
      mv('out', val.fromKey, -val.qty, -val.value, 'changed-to', { key: val.toKey, desc: val.toDesc });
      mv('in', val.toKey, +val.qty, +val.value, 'changed-from', { key: val.fromKey, desc: val.fromDesc });
      return { alreadyApplied: false, change };
    });
  }
  async function cancelStockChange(input = {}) {
    const { operationId, changeId } = input;
    ensure(isSafeId(changeId), PURCHASE_ERR.INVALID_INPUT, 'Change reference required');
    const reason = requireReason(input.reason);
    const eventId = eventIdForOperation('chgvoid', operationId);
    const actor = actorOf(), at = now();
    return transact(async tx => {
      const [cSnap, admins] = await Promise.all([tx.get(refs.change(changeId)), adminsOf(tx)]);
      ensure(cSnap.exists(), PURCHASE_ERR.NOT_FOUND, 'Change not found');
      const c = cSnap.data();
      if (c.status === PURCHASE_STATUS.voided) { ensure(c.lastEventId === eventId, PURCHASE_ERR.INVALID_STATE, 'This change is already cancelled.'); return { alreadyApplied: true, change: c }; }
      ensure(admins.includes(actor.uid), PURCHASE_ERR.NOT_ADMIN, 'Only administrators can cancel a change of item.');
      const [fSnap, tSnap] = await Promise.all([tx.get(refs.stock(c.fromKey)), tx.get(refs.stock(c.toKey))]);
      const to = tSnap.exists() ? tSnap.data() : null;
      ensure(to && Number(to.qty) + 1e-9 >= c.qty, PURCHASE_ERR.STOCK_USED, `${c.toDesc} no longer has ${c.qty} in stock — some was allocated or used. Cancel that first.`);
      const from = fSnap.exists() ? fSnap.data() : { itemKey: c.fromKey, desc: c.fromDesc, code: c.fromCode, uom: c.uom, qty: 0, value: 0, revision: 0 };
      const next = { ...c, status: PURCHASE_STATUS.voided, voidReason: reason, voidedAt: at, voidedBy: actor.name, voidedByUid: actor.uid,
        revision: c.revision + 1, lastEventId: eventId, updatedAt: at, updatedBy: actor.name, updatedByUid: actor.uid };
      tx.set(refs.change(changeId), next);
      const back = Math.abs(c.qty - (Number(to.qty) || 0)) < 1e-9 ? r2(Number(to.value) || 0) : c.value;
      writeStockForChange(tx, to, -c.qty, -back, { id: changeId, eventId, actor, at });
      writeStockForChange(tx, from, +c.qty, +back, { id: changeId, eventId, actor, at });
      const mv = (suffix, key, q, value, other) => { const moveId = `${changeId}__${suffix}`; tx.set(refs.move(moveId), { id: moveId, itemKey: key, kind: 'change-cancelled', qty: q, value, changeId, otherKey: other.key, otherDesc: other.desc,
        eventId, date: todayLocal(), note: reason, actor: actor.name, actorUid: actor.uid, at }); };
      mv('back-out', c.toKey, -c.qty, -back, { key: c.fromKey, desc: c.fromDesc });
      mv('back-in', c.fromKey, +c.qty, +back, { key: c.toKey, desc: c.toDesc });
      return { alreadyApplied: false, change: next };
    });
  }
  function writeStockForChange(tx, item, dq, dv, { id, eventId, actor, at }) {
    const qty = rq((Number(item.qty) || 0) + dq);
    ensure(qty >= -1e-9, PURCHASE_ERR.STOCK_USED, `Not enough ${item.desc || 'stock'} in stock.`);
    tx.set(refs.stock(item.itemKey), { ...item, qty: Math.max(0, qty), value: qty <= 1e-9 ? 0 : r2(Math.max(0, (Number(item.value) || 0) + dv)),
      revision: (Number(item.revision) || 0) + 1, lastChangeId: id, lastEventId: eventId, updatedByUid: actor.uid, updatedAt: at });
  }

  /* ───────── Administration → Purchase settings ───────── */
  async function savePurchaseSettings(input = {}) {
    const actor = actorOf();
    const v = validatePurchaseSettings(input);
    if (!v.ok) fail(PURCHASE_ERR.INVALID_INPUT, v.errors.map(e => e.message).join(' '), { errors: v.errors });
    return transact(async tx => {
      const [accessSnap, curSnap] = await Promise.all([accessWithRole(tx, doc, db, actorOf().uid), tx.get(refs.settings())]);
      const admins = accessSnap.exists() && Array.isArray(accessSnap.data().adminUids) ? accessSnap.data().adminUids : [];
      ensure(admins.includes(actor.uid), PURCHASE_ERR.NOT_ADMIN, 'Only administrators can change the purchase settings.');
      const revision = (curSnap.exists() ? Number(curSnap.data().revision) || 0 : 0) + 1;
      const next = { ...v.value, revision, updatedByUid: actor.uid, updatedBy: actor.name, updatedAt: stamp() };
      tx.set(refs.settings(), next);
      return next;
    });
  }

  return { createPurchaseInvoice, voidPurchaseInvoice, savePurchaseSettings, recordSupplierPayment, recordSupplierCashBack, voidSupplierPayment, payAdvance, editSupplierPayment, editPurchaseInvoice, allocateStock, cancelStockAllocation, changeStockItem, cancelStockChange };
}
