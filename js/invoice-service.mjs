/**
 * BizCore — Customer invoice & credit note transaction service.
 *
 * Every operation is ONE Firestore transaction that reads the authoritative Sales Order, its
 * fulfillment ledger (delivery + billing quantities), the order lock, the Billing Settings and the
 * administrator list, validates with js/invoice-core.mjs, and writes atomically:
 *   invoice (or credit note) + immutable event(s) + ledger (+ document counter).
 * The Sales Order document itself is never written.
 *
 * Idempotency: document IDs derive from the client operation ID — a retried save is detected.
 * Concurrency: transactions are serialisable; together with the order lock no two users can bill
 * the same order at the same moment, and the ledger checks hold even if they could.
 */
import {
  INVOICE_COLLECTIONS, INVOICE_SCHEMA_VERSION, INVOICE_TYPES, ERR, BILLING_SETTINGS_PATH, PERMISSION_LEVELS,
  invoiceIdForOperation, creditNoteIdForOperation, effectiveBillingSettings, permitted, permissionFor,
  priceGoodsLines, deductionLimits, checkDeduction, allocateDeduction, priceAdvance, applyInvoiceToLedger, buildCreditNote, r2,
} from './invoice-core.mjs?v=264';
import {
  COLLECTIONS, SCHEMA_VERSION, DeliveryError, isSafeId, eventIdForOperation, emptyLedger, requireDate, requireReason, cleanText, assertSize,
} from './delivery-core.mjs?v=264';
import { LOCK_COLLECTION, LOCK_TYPES, lockId, lockHeldBy } from './lock-service.mjs?v=264';

const fail = (code, message, details) => { throw new DeliveryError(code, message, details); };
const ensure = (ok, code, message, details) => { if (!ok) fail(code, message, details); };
const INVOICE_BYTES = 512 * 1024, EVENT_BYTES = 256 * 1024;

export function createInvoiceService(fs, options = {}) {
  const { db, doc, runTransaction } = fs || {};
  ensure(db && typeof doc === 'function' && typeof runTransaction === 'function', ERR.INVALID_INPUT, 'Firestore transaction API required');
  const serverTimestamp = typeof fs.serverTimestamp === 'function' ? fs.serverTimestamp : null;
  const now = options.now || (() => new Date().toISOString());
  const formatNumber = options.formatNumber || ((prefix, n) => prefix + String(n).padStart(4, '0'));
  const orderLock = options.orderLock || null; // { required(): boolean, sessionId(): string }
  const actorOf = () => {
    const a = (options.actor && options.actor()) || {};
    ensure(isSafeId(a.uid), ERR.INVALID_STATE, 'You must be signed in to issue invoices');
    return { name: cleanText(a.name || a.email || a.uid, 200), uid: a.uid };
  };
  const refs = {
    so: id => doc(db, COLLECTIONS.salesOrders, id),
    ledger: id => doc(db, COLLECTIONS.fulfillment, id),
    invoice: id => doc(db, INVOICE_COLLECTIONS.invoices, id),
    invoiceEvent: (invId, id) => doc(db, INVOICE_COLLECTIONS.invoices, invId, INVOICE_COLLECTIONS.invoiceEvents, id),
    creditNote: id => doc(db, INVOICE_COLLECTIONS.creditNotes, id),
    creditNoteEvent: (cnId, id) => doc(db, INVOICE_COLLECTIONS.creditNotes, cnId, INVOICE_COLLECTIONS.creditNoteEvents, id),
    counter: key => doc(db, COLLECTIONS.counters, key),
    lock: soId => doc(db, LOCK_COLLECTION, lockId(LOCK_TYPES.salesOrder, soId)),
    settings: () => doc(db, ...BILLING_SETTINGS_PATH),
    access: () => doc(db, 'system', 'accessControl'),
  };
  const stamp = () => (serverTimestamp ? { recordedAt: serverTimestamp() } : {});
  const CONTENTION = new Set(['aborted', 'failed-precondition', 'permission-denied']);
  const pause = n => new Promise(r => setTimeout(r, 60 * n + Math.floor(Math.random() * 120)));
  async function transact(fn) {
    for (let attempt = 1; ; attempt++) {
      try { return await runTransaction(db, fn); }
      catch (e) {
        if (attempt < 3 && (e?.code === ERR.INCONSISTENT || e?.code === ERR.OVER_INVOICE || e?.code === ERR.OVER_BILLING)) continue;
        if (attempt < 4 && CONTENTION.has(e?.code)) { await pause(attempt); continue; }
        throw e;
      }
    }
  }
  const lockRequired = () => !!(orderLock && orderLock.required && orderLock.required());

  /** Shared reads, in a fixed order (reads must precede writes). */
  async function readContext(tx, soId, extra = []) {
    const snaps = await Promise.all([
      tx.get(refs.so(soId)), tx.get(refs.ledger(soId)), tx.get(refs.settings()), tx.get(refs.access()),
      lockRequired() ? tx.get(refs.lock(soId)) : Promise.resolve(null), ...extra.map(r => tx.get(r)),
    ]);
    const [soSnap, ledgerSnap, settingsSnap, accessSnap, lockSnap, ...rest] = snaps;
    return { soSnap, ledgerSnap, settingsSnap, accessSnap, lockSnap, rest };
  }
  function checkContext(ctx, soId, actor) {
    ensure(ctx.soSnap.exists(), ERR.NOT_FOUND, `Sales Order ${soId} not found`);
    const so = ctx.soSnap.data();
    ensure(!(Array.isArray(so.invoices) && so.invoices.length), ERR.LEGACY_DATA,
      `${so.soNo || soId} still contains invoices stored the old way. The administrator must complete the invoice migration first.`);
    if (lockRequired()) {
      ensure(lockHeldBy(ctx.lockSnap && ctx.lockSnap.exists() ? ctx.lockSnap.data() : null, actor.uid, orderLock.sessionId && orderLock.sessionId()), ERR.LOCK_REQUIRED,
        `You no longer have ${so.soNo || 'this Sales Order'} open for editing (the lock expired or was released). Nothing was saved — please open it again.`);
    }
    const ledger = ctx.ledgerSnap.exists() ? ctx.ledgerSnap.data() : emptyLedger(soId);
    ensure(ledger.salesOrderId === soId, ERR.INCONSISTENT, 'Fulfillment ledger does not belong to this Sales Order');
    const settings = effectiveBillingSettings(ctx.settingsSnap.exists() ? ctx.settingsSnap.data() : null);
    const admins = ctx.accessSnap.exists() && Array.isArray(ctx.accessSnap.data().adminUids) ? ctx.accessSnap.data().adminUids : [];
    return { so, ledger, settings, isAdmin: admins.includes(actor.uid) };
  }
  function ledgerRecord(ledger, soId, { invoiceId, eventId, at, actor }) {
    const rec = {
      ...ledger, salesOrderId: soId, schemaVersion: SCHEMA_VERSION, revision: (Number(ledger.revision) || 0) + 1,
      lastInvoiceId: invoiceId, lastEventId: eventId, lastEventCollection: INVOICE_COLLECTIONS.invoiceEvents,
      updatedAt: at, updatedBy: actor.name, updatedByUid: actor.uid,
    };
    assertSize(rec, 256 * 1024, 'Fulfillment ledger');
    return rec;
  }
  function nextNumber(counterSnap, numbering) {
    ensure(numbering && isSafeId(numbering.counterKey) && typeof numbering.displayPrefix === 'string', ERR.INVALID_INPUT, 'Document numbering is required');
    const sequence = (Number(counterSnap.exists() ? counterSnap.data().value : 0) || 0) + 1;
    return { sequence, number: formatNumber(numbering.displayPrefix, sequence) };
  }

  /* ───────── issue an invoice (delivery | order | advance) ───────── */
  async function issueInvoice(input) {
    const { operationId, salesOrderId, type, numbering } = input || {};
    ensure(isSafeId(salesOrderId), ERR.INVALID_INPUT, 'Sales Order ID required');
    ensure(Object.values(INVOICE_TYPES).includes(type), ERR.INVALID_INPUT, 'Unknown invoice type');
    const invoiceId = invoiceIdForOperation(operationId);
    const eventId = eventIdForOperation('issue', operationId);
    const date = requireDate(input.date);
    const dueDate = input.dueDate ? requireDate(input.dueDate) : '';
    const reason = type === INVOICE_TYPES.order ? requireReason(input.reason) : cleanText(input.reason, 1000);
    const actor = actorOf(), at = now();
    ensure(numbering && isSafeId(numbering.counterKey), ERR.INVALID_INPUT, 'Document numbering is required');

    return transact(async tx => {
      const ctx = await readContext(tx, salesOrderId, [refs.invoice(invoiceId), refs.counter(numbering.counterKey)]);
      const [invSnap, counterSnap] = ctx.rest;
      if (invSnap.exists()) {
        const existing = invSnap.data();
        ensure(existing.creationOperationId === operationId && existing.salesOrderId === salesOrderId, ERR.ID_COLLISION, 'Invoice ID already used by another operation');
        return { alreadyApplied: true, invoice: existing };
      }
      const { so, ledger, settings, isAdmin } = checkContext(ctx, salesOrderId, actor);
      const level = permissionFor(type, settings);
      ensure(permitted(level, isAdmin), ERR.PERMISSION,
        level === PERMISSION_LEVELS.none ? `${type === INVOICE_TYPES.order ? 'Order' : 'Advance'} invoices are switched off in Billing Settings.`
          : `Only an administrator may issue ${type === INVOICE_TYPES.order ? 'order (bill-ahead)' : 'advance'} invoices (Billing Settings).`);

      let lines = [], deductions = [], advance = null, totals;
      if (type === INVOICE_TYPES.advance) {
        advance = priceAdvance(so, ledger, input.advance || {});
        totals = { goodsSubtotal: 0, goodsVat: 0, deductionSubtotal: 0, deductionVat: 0, subtotal: advance.amount, vat: advance.vat, total: r2(advance.amount + advance.vat) };
      } else {
        const g = priceGoodsLines(so, ledger, type, input.lines);
        const limits = deductionLimits(so, ledger, g.goodsSubtotal, g.addQty, settings.deductionMethod);
        const amount = checkDeduction(limits, input.deduction == null ? limits.proposal : input.deduction, settings.deductionMethod);
        deductions = allocateDeduction({ advances: (ledger.billing || {}).advances || {} }, amount);
        const dSub = r2(deductions.reduce((s, d) => s + d.subtotal, 0)), dVat = r2(deductions.reduce((s, d) => s + d.vat, 0));
        lines = g.lines;
        totals = { goodsSubtotal: g.goodsSubtotal, goodsVat: g.goodsVat, deductionSubtotal: dSub, deductionVat: dVat,
          subtotal: r2(g.goodsSubtotal - dSub), vat: r2(g.goodsVat - dVat), total: r2(g.goodsSubtotal - dSub + g.goodsVat - dVat) };
      }
      const { sequence, number } = nextNumber(counterSnap, numbering);
      const invoice = {
        id: invoiceId, schemaVersion: INVOICE_SCHEMA_VERSION, invNo: number, type, salesOrderId, soNo: so.soNo || '',
        customer: so.customer || '', custId: so.custId || '', poNo: so.poNo || '', quotationId: so.quotationId || '',
        date, dueDate, zohoNo: cleanText(input.zohoNo, 100), notes: cleanText(input.notes, 2000), reason,
        lines, deductions, advance, totals, credited: {}, creditNotes: [], status: 'Issued',
        revision: 1, lastEventId: eventId, creationOperationId: operationId,
        created: at, createdBy: actor.name, createdByUid: actor.uid, updatedAt: at, updatedBy: actor.name, updatedByUid: actor.uid,
      };
      assertSize(invoice, INVOICE_BYTES, 'Invoice');
      const event = {
        id: eventId, kind: 'issued', invoiceId, invNo: number, salesOrderId, type, operationId, toRevision: 1,
        totals, actor: actor.name, actorUid: actor.uid, at, ...stamp(),
      };
      assertSize(event, EVENT_BYTES, 'Invoice event');
      const nextLedger = ledgerRecord(applyInvoiceToLedger(ledger, invoice), salesOrderId, { invoiceId, eventId, at, actor });
      tx.set(refs.counter(numbering.counterKey), { value: sequence, updatedAt: Date.now() });
      tx.set(refs.ledger(salesOrderId), nextLedger);
      tx.set(refs.invoice(invoiceId), invoice);
      tx.set(refs.invoiceEvent(invoiceId, eventId), event);
      return { alreadyApplied: false, invoice };
    });
  }

  /* ───────── credit note against an invoice ───────── */
  async function issueCreditNote(input) {
    const { operationId, salesOrderId, invoiceId, numbering } = input || {};
    ensure(isSafeId(salesOrderId) && isSafeId(invoiceId), ERR.INVALID_INPUT, 'Invoice reference required');
    const cnId = creditNoteIdForOperation(operationId);
    const cnEventId = eventIdForOperation('cn', operationId);
    const invEventId = eventIdForOperation('credit', operationId);
    const date = requireDate(input.date);
    const reason = requireReason(input.reason);
    const actor = actorOf(), at = now();
    ensure(numbering && isSafeId(numbering.counterKey), ERR.INVALID_INPUT, 'Document numbering is required');

    return transact(async tx => {
      const ctx = await readContext(tx, salesOrderId, [refs.invoice(invoiceId), refs.creditNote(cnId), refs.counter(numbering.counterKey)]);
      const [invSnap, cnSnap, counterSnap] = ctx.rest;
      if (cnSnap.exists()) {
        const existing = cnSnap.data();
        ensure(existing.creationOperationId === operationId, ERR.ID_COLLISION, 'Credit note ID already used by another operation');
        return { alreadyApplied: true, creditNote: existing };
      }
      const { ledger, settings, isAdmin } = checkContext(ctx, salesOrderId, actor);
      ensure(permitted(settings.allowCreditNotes, isAdmin), ERR.PERMISSION, 'Only an administrator may issue credit notes (Billing Settings).');
      ensure(invSnap.exists(), ERR.NOT_FOUND, 'Invoice not found');
      const invoice = invSnap.data();
      ensure(invoice.salesOrderId === salesOrderId, ERR.INVALID_INPUT, 'The invoice does not belong to this Sales Order');
      if (input.expectedRevision != null) ensure(invoice.revision === input.expectedRevision, ERR.STALE_REVISION, `${invoice.invNo} was changed meanwhile. The latest version has been loaded — please review and try again.`);
      const built = buildCreditNote(invoice, ledger, input.type === 'advance' || invoice.type === INVOICE_TYPES.advance ? { amount: input.amount } : { lines: input.lines });
      const { sequence, number } = nextNumber(counterSnap, numbering);
      const creditNote = {
        id: cnId, schemaVersion: INVOICE_SCHEMA_VERSION, cnNo: number, invoiceId, invNo: invoice.invNo, invoiceDate: invoice.date, invoiceType: invoice.type,
        salesOrderId, soNo: invoice.soNo, customer: invoice.customer, custId: invoice.custId || '', date, reason,
        ...built.note, revision: 1, lastEventId: cnEventId, creationOperationId: operationId,
        created: at, createdBy: actor.name, createdByUid: actor.uid,
      };
      assertSize(creditNote, INVOICE_BYTES, 'Credit note');
      const revision = invoice.revision + 1;
      const nextInvoice = {
        ...invoice, credited: built.invoiceCredited, status: built.fully ? 'Credited' : 'Partially credited',
        creditNotes: [...(invoice.creditNotes || []), { id: cnId, cnNo: number, date, total: creditNote.total }],
        revision, lastEventId: invEventId, updatedAt: at, updatedBy: actor.name, updatedByUid: actor.uid,
      };
      assertSize(nextInvoice, INVOICE_BYTES, 'Invoice');
      const invEvent = { id: invEventId, kind: 'credited', invoiceId, invNo: invoice.invNo, salesOrderId, creditNoteId: cnId, cnNo: number, operationId,
        fromRevision: invoice.revision, toRevision: revision, reason, totals: { subtotal: creditNote.subtotal, vat: creditNote.vat, total: creditNote.total }, actor: actor.name, actorUid: actor.uid, at, ...stamp() };
      const cnEvent = { id: cnEventId, kind: 'issued', creditNoteId: cnId, cnNo: number, invoiceId, salesOrderId, operationId, toRevision: 1, reason,
        totals: { subtotal: creditNote.subtotal, vat: creditNote.vat, total: creditNote.total }, actor: actor.name, actorUid: actor.uid, at, ...stamp() };
      const nextLedger = ledgerRecord(built.ledger, salesOrderId, { invoiceId, eventId: invEventId, at, actor });
      tx.set(refs.counter(numbering.counterKey), { value: sequence, updatedAt: Date.now() });
      tx.set(refs.ledger(salesOrderId), nextLedger);
      tx.set(refs.invoice(invoiceId), nextInvoice);
      tx.set(refs.invoiceEvent(invoiceId, invEventId), invEvent);
      tx.set(refs.creditNote(cnId), creditNote);
      tx.set(refs.creditNoteEvent(cnId, cnEventId), cnEvent);
      return { alreadyApplied: false, creditNote, invoice: nextInvoice };
    });
  }

  return { issueInvoice, issueCreditNote };
}
