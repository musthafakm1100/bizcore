/**
 * BizCore V266 — Customer payment receipt transaction service.
 *
 * Every operation is ONE Firestore transaction that reads the receipt settings, the administrator list,
 * the invoices concerned and their payment records, validates with js/receipt-core.mjs and writes:
 *   receipt + immutable event + invoicePayments/{invoiceId} for each invoice (+ counter, + Zoho claim).
 *
 * Idempotency: document IDs derive from the client operation ID — a retried save is detected.
 * Concurrency: transactions are serialisable, so two users can never apply the same balance twice.
 */
import {
  RECEIPT_COLLECTIONS, RECEIPT_SCHEMA_VERSION, RECEIPT_SETTINGS_PATH, RECEIPT_STATUS, ERR,
  receiptIdForOperation, effectiveReceiptSettings, permitted, checkReceiptHeader, checkAllocations,
  applyToPayment, receiptTotals, mergeAllocations, customerKeyOf, r2, MONEY_EPSILON, zohoNoKey,
} from './receipt-core.mjs?v=266.1';
import { COLLECTIONS, DeliveryError, isSafeId, eventIdForOperation, requireDate, requireReason, cleanText, assertSize } from './delivery-core.mjs?v=266.0';
import { INVOICE_COLLECTIONS } from './invoice-core.mjs?v=266.0';

const fail = (code, message, details) => { throw new DeliveryError(code, message, details); };
const ensure = (ok, code, message, details) => { if (!ok) fail(code, message, details); };
const RECEIPT_BYTES = 512 * 1024;

export function createReceiptService(fs, options = {}) {
  const { db, doc, runTransaction } = fs || {};
  ensure(db && typeof doc === 'function' && typeof runTransaction === 'function', ERR.INVALID_INPUT, 'Firestore transaction API required');
  const serverTimestamp = typeof fs.serverTimestamp === 'function' ? fs.serverTimestamp : null;
  const now = options.now || (() => new Date().toISOString());
  const formatNumber = options.formatNumber || ((prefix, n) => prefix + String(n).padStart(4, '0'));
  const actorOf = () => {
    const a = (options.actor && options.actor()) || {};
    ensure(isSafeId(a.uid), ERR.INVALID_STATE, 'You must be signed in to record receipts');
    return { name: cleanText(a.name || a.email || a.uid, 200), uid: a.uid };
  };
  const refs = {
    receipt: id => doc(db, RECEIPT_COLLECTIONS.receipts, id),
    event: (rctId, id) => doc(db, RECEIPT_COLLECTIONS.receipts, rctId, RECEIPT_COLLECTIONS.receiptEvents, id),
    payment: invId => doc(db, RECEIPT_COLLECTIONS.invoicePayments, invId),
    invoice: invId => doc(db, INVOICE_COLLECTIONS.invoices, invId),
    zoho: key => doc(db, RECEIPT_COLLECTIONS.zohoNumbers, key),
    counter: key => doc(db, COLLECTIONS.counters, key),
    settings: () => doc(db, ...RECEIPT_SETTINGS_PATH),
    access: () => doc(db, 'system', 'accessControl'),
  };
  const stamp = () => (serverTimestamp ? { recordedAt: serverTimestamp() } : {});
  const CONTENTION = new Set(['aborted', 'failed-precondition']);
  const pause = n => new Promise(r => setTimeout(r, 60 * n + Math.floor(Math.random() * 120)));
  async function transact(fn) {
    for (let attempt = 1; ; attempt++) {
      try { return await runTransaction(db, fn); }
      catch (e) {
        if (attempt < 4 && CONTENTION.has(e?.code)) { await pause(attempt); continue; }
        throw e;
      }
    }
  }
  /** Settings + admin flag + invoices + payment records, all read before any write. */
  async function readBase(tx, invoiceIds, extra = []) {
    const ids = [...new Set(invoiceIds)];
    const snaps = await Promise.all([tx.get(refs.settings()), tx.get(refs.access()),
      ...ids.map(id => tx.get(refs.invoice(id))), ...ids.map(id => tx.get(refs.payment(id))), ...extra.map(r => tx.get(r))]);
    const [settingsSnap, accessSnap] = snaps;
    const invSnaps = snaps.slice(2, 2 + ids.length), paySnaps = snaps.slice(2 + ids.length, 2 + 2 * ids.length);
    const rest = snaps.slice(2 + 2 * ids.length);
    const invoices = new Map(), payments = new Map();
    ids.forEach((id, i) => { if (invSnaps[i].exists()) invoices.set(id, invSnaps[i].data()); if (paySnaps[i].exists()) payments.set(id, paySnaps[i].data()); });
    const settings = effectiveReceiptSettings(settingsSnap.exists() ? settingsSnap.data() : null);
    const admins = accessSnap.exists() && Array.isArray(accessSnap.data().adminUids) ? accessSnap.data().adminUids : [];
    return { settings, invoices, payments, rest, isAdminOf: uid => admins.includes(uid) };
  }
  const idsOf = list => (Array.isArray(list) ? list : []).filter(a => a && r2(a.amount) > MONEY_EPSILON).map(a => a.invoiceId).filter(isSafeId);
  function writePayments(tx, receipt, allocations, sign, at, base) {
    for (const a of allocations) {
      const invoice = base.invoices.get(a.invoiceId) || { id: a.invoiceId, invNo: a.invNo, salesOrderId: a.salesOrderId, custId: receipt.custId, customer: receipt.customer };
      const next = applyToPayment(base.payments.get(a.invoiceId), invoice, { rctId: receipt.id, rctNo: receipt.rctNo, date: receipt.date, amount: a.amount }, sign, at);
      next.lastEventId = receipt.lastEventId; next.updatedByUid = receipt.updatedByUid;
      base.payments.set(a.invoiceId, next);
      tx.set(refs.payment(a.invoiceId), next);
    }
  }

  /* ───────── record a new receipt ───────── */
  async function createReceipt(input) {
    const { operationId, numbering } = input || {};
    const rctId = receiptIdForOperation(operationId);
    const eventId = eventIdForOperation('post', operationId);
    const date = requireDate(input.date);
    const customer = cleanText(input.customer, 300), custId = cleanText(input.custId, 200);
    ensure(customer, ERR.INVALID_INPUT, 'Choose the customer');
    const custKey = customerKeyOf({ custId, customer });
    ensure(numbering && isSafeId(numbering.counterKey) && typeof numbering.displayPrefix === 'string', ERR.INVALID_INPUT, 'Document numbering is required');
    const actor = actorOf(), at = now();
    const zKeyPre = zohoNoKey(String(input.zohoPaymentNo == null ? '' : input.zohoPaymentNo).trim().slice(0, 100));
    ensure(zKeyPre.length <= 600, ERR.INVALID_INPUT, 'The Zoho payment no. is too long');

    return transact(async tx => {
      const extra = [refs.receipt(rctId), refs.counter(numbering.counterKey), ...(zKeyPre ? [refs.zoho(zKeyPre)] : [])];
      const base = await readBase(tx, idsOf(input.allocations), extra);
      const [rctSnap, counterSnap, zohoSnap] = base.rest;
      if (rctSnap.exists()) {
        const existing = rctSnap.data();
        ensure(existing.creationOperationId === operationId, ERR.ID_COLLISION, 'Receipt ID already used by another operation');
        return { alreadyApplied: true, receipt: existing };
      }
      ensure(permitted(base.settings.allowRecord, base.isAdminOf(actor.uid)), ERR.PERMISSION, 'Only an administrator may record payment receipts (Billing Settings).');
      const head = checkReceiptHeader(input, base.settings);
      if (zohoSnap && zohoSnap.exists()) {
        const z = zohoSnap.data() || {};
        fail(ERR.DUPLICATE_ZOHO_PAYMENT, `Zoho payment no. ${head.zohoPaymentNo} is already used on ${z.rctNo || 'another receipt'}. Check the number in Zoho Books.`);
      }
      const { allocations } = checkAllocations({ custKey, available: head.amount, allocations: input.allocations || [], invoices: base.invoices, payments: base.payments });
      const sequence = (Number(counterSnap.exists() ? counterSnap.data().value : 0) || 0) + 1;
      const rctNo = formatNumber(numbering.displayPrefix, sequence);
      const totals = receiptTotals(head.amount, allocations);
      const receipt = {
        id: rctId, schemaVersion: RECEIPT_SCHEMA_VERSION, rctNo, custId, customer, custKey, date,
        method: head.method, account: head.account, reference: cleanText(input.reference, 200),
        zohoPaymentNo: head.zohoPaymentNo, zohoPaymentNoKey: head.zohoPaymentNoKey,
        amount: head.amount, bankCharges: head.bankCharges, allocations, applied: totals.applied, unapplied: totals.unapplied,
        invoiceIds: allocations.map(a => a.invoiceId), notes: cleanText(input.notes, 2000),
        status: RECEIPT_STATUS.posted, revision: 1, lastEventId: eventId, creationOperationId: operationId,
        created: at, createdBy: actor.name, createdByUid: actor.uid, updatedAt: at, updatedBy: actor.name, updatedByUid: actor.uid,
      };
      assertSize(receipt, RECEIPT_BYTES, 'Receipt');
      const event = { id: eventId, kind: 'posted', receiptId: rctId, rctNo, operationId, toRevision: 1,
        amount: head.amount, allocations: allocations.map(a => ({ invoiceId: a.invoiceId, invNo: a.invNo, amount: a.amount })),
        actor: actor.name, actorUid: actor.uid, at, ...stamp() };
      tx.set(refs.counter(numbering.counterKey), { value: sequence, updatedAt: Date.now() });
      tx.set(refs.receipt(rctId), receipt);
      tx.set(refs.event(rctId, eventId), event);
      writePayments(tx, receipt, allocations, +1, at, base);
      if (head.zohoPaymentNoKey) tx.set(refs.zoho(head.zohoPaymentNoKey), { id: head.zohoPaymentNoKey, zohoPaymentNo: head.zohoPaymentNo, receiptId: rctId, rctNo, created: at, createdByUid: actor.uid });
      return { alreadyApplied: false, receipt };
    });
  }

  /* ───────── apply unapplied money to more invoices ───────── */
  async function applyReceipt(input) {
    const { operationId, receiptId } = input || {};
    ensure(isSafeId(receiptId), ERR.INVALID_INPUT, 'Receipt reference required');
    const eventId = eventIdForOperation('apply', operationId);
    const actor = actorOf(), at = now();
    return transact(async tx => {
      const base = await readBase(tx, idsOf(input.allocations), [refs.receipt(receiptId), refs.event(receiptId, eventId)]);
      const [rctSnap, evSnap] = base.rest;
      ensure(rctSnap.exists(), ERR.NOT_FOUND, 'Receipt not found');
      const rct = rctSnap.data();
      if (evSnap.exists()) return { alreadyApplied: true, receipt: rct };
      ensure(rct.status === RECEIPT_STATUS.posted, ERR.INVALID_STATE, `${rct.rctNo} is voided`);
      if (input.expectedRevision != null) ensure(rct.revision === input.expectedRevision, ERR.STALE_REVISION, `${rct.rctNo} was changed meanwhile. The latest version has been loaded — please review and try again.`);
      ensure(permitted(base.settings.allowRecord, base.isAdminOf(actor.uid)), ERR.PERMISSION, 'Only an administrator may apply receipts (Billing Settings).');
      const { allocations, total } = checkAllocations({ custKey: rct.custKey || customerKeyOf(rct), available: rct.unapplied, allocations: input.allocations || [], invoices: base.invoices, payments: base.payments });
      ensure(total > MONEY_EPSILON, ERR.INVALID_INPUT, 'Enter an amount to apply');
      const merged = mergeAllocations(rct.allocations, allocations);
      const totals = receiptTotals(rct.amount, merged), revision = rct.revision + 1;
      const next = { ...rct, allocations: merged, applied: totals.applied, unapplied: totals.unapplied, invoiceIds: merged.map(a => a.invoiceId),
        revision, lastEventId: eventId, updatedAt: at, updatedBy: actor.name, updatedByUid: actor.uid };
      assertSize(next, RECEIPT_BYTES, 'Receipt');
      tx.set(refs.receipt(receiptId), next);
      tx.set(refs.event(receiptId, eventId), { id: eventId, kind: 'applied', receiptId, rctNo: rct.rctNo, operationId, fromRevision: rct.revision, toRevision: revision,
        allocations: allocations.map(a => ({ invoiceId: a.invoiceId, invNo: a.invNo, amount: a.amount })), actor: actor.name, actorUid: actor.uid, at, ...stamp() });
      writePayments(tx, next, allocations, +1, at, base);
      return { alreadyApplied: false, receipt: next };
    });
  }

  /* ───────── void ───────── */
  async function voidReceipt(input) {
    const { operationId, receiptId } = input || {};
    ensure(isSafeId(receiptId), ERR.INVALID_INPUT, 'Receipt reference required');
    const eventId = eventIdForOperation('void', operationId);
    const reason = requireReason(input.reason);
    const actor = actorOf(), at = now();
    return transact(async tx => {
      // The allocations are only known after reading the receipt; read it first, then the rest.
      const rctSnap = await tx.get(refs.receipt(receiptId));
      ensure(rctSnap.exists(), ERR.NOT_FOUND, 'Receipt not found');
      const rct = rctSnap.data();
      if (rct.status === RECEIPT_STATUS.voided) { ensure(rct.lastEventId === eventId, ERR.INVALID_STATE, `${rct.rctNo} is already voided`); return { alreadyApplied: true, receipt: rct }; }
      if (input.expectedRevision != null) ensure(rct.revision === input.expectedRevision, ERR.STALE_REVISION, `${rct.rctNo} was changed meanwhile. The latest version has been loaded — please review and try again.`);
      const base = await readBase(tx, (rct.allocations || []).map(a => a.invoiceId));
      ensure(permitted(base.settings.allowVoid, base.isAdminOf(actor.uid)), ERR.PERMISSION, 'Only an administrator may void receipts (Billing Settings).');
      const revision = rct.revision + 1;
      const next = { ...rct, status: RECEIPT_STATUS.voided, voidReason: reason, voidedAt: at, voidedBy: actor.name, voidedByUid: actor.uid,
        revision, lastEventId: eventId, updatedAt: at, updatedBy: actor.name, updatedByUid: actor.uid };
      tx.set(refs.receipt(receiptId), next);
      tx.set(refs.event(receiptId, eventId), { id: eventId, kind: 'voided', receiptId, rctNo: rct.rctNo, operationId, fromRevision: rct.revision, toRevision: revision, reason,
        allocations: (rct.allocations || []).map(a => ({ invoiceId: a.invoiceId, invNo: a.invNo, amount: a.amount })), actor: actor.name, actorUid: actor.uid, at, ...stamp() });
      writePayments(tx, next, rct.allocations || [], -1, at, base);
      return { alreadyApplied: false, receipt: next };
    });
  }

  return { createReceipt, applyReceipt, voidReceipt };
}
