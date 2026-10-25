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
import { accessWithRole, actorMay } from './user-core.mjs?v=270.43';
import { formatSequence, nextSequence } from './numbering.mjs?v=270.25';
import {
  INVOICE_COLLECTIONS, INVOICE_SCHEMA_VERSION, INVOICE_TYPES, ERR, BILLING_SETTINGS_PATH, PERMISSION_LEVELS,
  invoiceIdForOperation, creditNoteIdForOperation, effectiveBillingSettings, permitted, permissionFor,
  priceGoodsLines, deductionLimits, checkDeduction, allocateDeduction, priceAdvance, applyInvoiceToLedger, buildCreditNote, r2,
  zohoNoKey,
} from './invoice-core.mjs?v=266.0';
import {
  COLLECTIONS, SCHEMA_VERSION, DeliveryError, isSafeId, eventIdForOperation, emptyLedger, requireDate, requireReason, cleanText, assertSize,
} from './delivery-core.mjs?v=266.0';
import { LOCK_COLLECTION, LOCK_TYPES, lockId, lockHeldBy } from './lock-service.mjs?v=266.0';
import { RECEIPT_SETTINGS_PATH, effectiveReceiptSettings, invoiceEditRights } from './receipt-core.mjs?v=266.4';

const fail = (code, message, details) => { throw new DeliveryError(code, message, details); };
const ensure = (ok, code, message, details) => { if (!ok) fail(code, message, details); };
const INVOICE_BYTES = 512 * 1024, EVENT_BYTES = 256 * 1024;

export function createInvoiceService(fs, options = {}) {
  const { db, doc, runTransaction } = fs || {};
  ensure(db && typeof doc === 'function' && typeof runTransaction === 'function', ERR.INVALID_INPUT, 'Firestore transaction API required');
  const serverTimestamp = typeof fs.serverTimestamp === 'function' ? fs.serverTimestamp : null;
  const now = options.now || (() => new Date().toISOString());
  const formatNumber = options.formatNumber || formatSequence;
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
    zohoNo: key => doc(db, INVOICE_COLLECTIONS.zohoNumbers, key),
    creditNoteEvent: (cnId, id) => doc(db, INVOICE_COLLECTIONS.creditNotes, cnId, INVOICE_COLLECTIONS.creditNoteEvents, id),
    counter: key => doc(db, COLLECTIONS.counters, key),
    lock: soId => doc(db, LOCK_COLLECTION, lockId(LOCK_TYPES.salesOrder, soId)),
    settings: () => doc(db, ...BILLING_SETTINGS_PATH),
    access: () => doc(db, 'system', 'accessControl'),
    editSettings: () => doc(db, ...RECEIPT_SETTINGS_PATH),
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
      tx.get(refs.so(soId)), tx.get(refs.ledger(soId)), tx.get(refs.settings()), accessWithRole(tx, doc, db, actorOf().uid),
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
    // V270.4.3: Special Rights (administrators: every right)
    const may = what => actorMay(ctx.accessSnap, actor.uid, what);
    return { so, ledger, settings, isAdmin: admins.includes(actor.uid), may, editRights: { full: may('fullEdit'), afterLimit: may('editAfterLimit') } };
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
    const sequence = nextSequence(counterSnap.exists() ? counterSnap.data().value : 0, numbering);
    return { sequence, number: formatNumber(numbering.displayPrefix, sequence, numbering.digits) };
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
    const zohoNo = cleanText(input.zohoNo, 100), zKey = zohoNoKey(zohoNo);
    ensure(zKey && zKey.length <= 600, ERR.INVALID_INPUT, 'Enter the Zoho invoice number (create the invoice in Zoho Books first).');
    const actor = actorOf(), at = now();
    ensure(numbering && isSafeId(numbering.counterKey), ERR.INVALID_INPUT, 'Document numbering is required');

    return transact(async tx => {
      const ctx = await readContext(tx, salesOrderId, [refs.invoice(invoiceId), refs.counter(numbering.counterKey), refs.zohoNo(zKey)]);
      const [invSnap, counterSnap, zohoSnap] = ctx.rest;
      if (invSnap.exists()) {
        const existing = invSnap.data();
        ensure(existing.creationOperationId === operationId && existing.salesOrderId === salesOrderId, ERR.ID_COLLISION, 'Invoice ID already used by another operation');
        return { alreadyApplied: true, invoice: existing };
      }
      if (zohoSnap.exists()) {
        const z = zohoSnap.data() || {};
        ensure(false, ERR.DUPLICATE_ZOHO, `Zoho invoice no. ${zohoNo} is already used on ${z.invNo || 'another invoice'}${z.soNo ? ' (' + z.soNo + ')' : ''}. Check the number in Zoho Books.`);
      }
      const { so, ledger, settings, may } = checkContext(ctx, salesOrderId, actor);
      const level = permissionFor(type, settings);
      ensure(permitted(level, type === INVOICE_TYPES.order ? may('orderInvoices') : type === INVOICE_TYPES.advance ? may('advanceInvoices') : true), ERR.PERMISSION,
        level === PERMISSION_LEVELS.none ? `${type === INVOICE_TYPES.order ? 'Order' : 'Advance'} invoices are switched off in Billing Settings.`
          : `Issuing ${type === INVOICE_TYPES.order ? 'order (bill-ahead)' : 'advance'} invoices needs the Special Right (Administration → Roles & Permissions).`);

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
        date, dueDate, zohoNo, zohoNoKey: zKey, notes: cleanText(input.notes, 2000), reason,
        lines, deductions, advance, totals, credited: {}, creditNotes: [], status: 'Issued',
        ...(input.reissueOf && isSafeId(input.reissueOf.id) ? { reissueOf: { id: input.reissueOf.id, invNo: cleanText(input.reissueOf.invNo, 100) } } : {}),
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
      tx.set(refs.zohoNo(zKey), { id: zKey, zohoNo, invoiceId, invNo: number, salesOrderId, soNo: so.soNo || '', created: at, createdByUid: actor.uid });
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
      const { ledger, settings, may } = checkContext(ctx, salesOrderId, actor);
      ensure(permitted(settings.allowCreditNotes, may('creditNotes')), ERR.PERMISSION, 'Issuing credit notes needs the Special Right (Administration → Roles & Permissions).');
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

  /* ───────── V266.3 limited edit (due date, PO no., description, notes, Zoho no.) ─────────
     Invoice figures (lines, prices, VAT, date, customer) are never edited: a tax invoice is corrected with a credit
     note ("Cancel and re-issue"). The edit is done by the holder of the Sales Order lock, like credit notes. */
  async function editInvoice(input) {
    const { operationId, salesOrderId, invoiceId } = input || {};
    ensure(isSafeId(salesOrderId) && isSafeId(invoiceId), ERR.INVALID_INPUT, 'Invoice reference required');
    const eventId = eventIdForOperation('edit', operationId);
    const editReason = requireReason(input.reason);
    const ch = input.changes || {};
    const actor = actorOf(), at = now();
    const t = new Date(), today = input.today || `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    const newZoho = ch.zohoNo === undefined ? null : cleanText(ch.zohoNo, 100);
    const newKey = newZoho == null ? null : zohoNoKey(newZoho);
    if (newZoho != null) ensure(newKey && newKey.length <= 600, ERR.INVALID_INPUT, 'Enter the Zoho invoice number.');
    return transact(async tx => {
      const ctx = await readContext(tx, salesOrderId, [refs.invoice(invoiceId), refs.invoiceEvent(invoiceId, eventId), refs.editSettings(), ...(newKey ? [refs.zohoNo(newKey)] : [])]);
      const [invSnap, evSnap, esSnap, zSnap] = ctx.rest;
      const oldKeySnap = newKey && invSnap.exists() && invSnap.data().zohoNoKey && invSnap.data().zohoNoKey !== newKey ? await tx.get(refs.zohoNo(invSnap.data().zohoNoKey)) : null;
      ensure(invSnap.exists(), ERR.NOT_FOUND, 'Invoice not found');
      const inv = invSnap.data();
      if (evSnap.exists()) return { alreadyApplied: true, invoice: inv };
      ensure(inv.salesOrderId === salesOrderId, ERR.INVALID_INPUT, 'The invoice does not belong to this Sales Order');
      const { editRights } = checkContext(ctx, salesOrderId, actor);
      if (input.expectedRevision != null) ensure(inv.revision === input.expectedRevision, ERR.STALE_REVISION, `${inv.invNo} was changed meanwhile. The latest version has been loaded — please review and try again.`);
      const rights = invoiceEditRights(inv, effectiveReceiptSettings(esSnap.exists() ? esSnap.data() : null), editRights, today);
      ensure(rights.ok, ERR.PERMISSION, rights.why);
      const nv = {
        dueDate: ch.dueDate === undefined ? (inv.dueDate || '') : (ch.dueDate ? requireDate(ch.dueDate) : ''),
        poNo: ch.poNo === undefined ? (inv.poNo || '') : cleanText(ch.poNo, 200),
        reason: ch.reason === undefined ? (inv.reason || '') : (inv.type === INVOICE_TYPES.order ? requireReason(ch.reason) : cleanText(ch.reason, 1000)),
        notes: ch.notes === undefined ? (inv.notes || '') : cleanText(ch.notes, 2000),
        zohoNo: newZoho == null ? (inv.zohoNo || '') : newZoho,
      };
      const labels = { dueDate: 'Payment due date', poNo: 'Customer PO no.', reason: inv.type === INVOICE_TYPES.order ? 'Reason for billing ahead' : 'Description', notes: 'Notes', zohoNo: 'Zoho invoice no.' };
      const changes = Object.keys(nv).filter(k => String(nv[k]) !== String(inv[k] || '')).map(k => ({ field: k, label: labels[k], before: inv[k] || '', after: nv[k] }));
      ensure(changes.length > 0, ERR.INVALID_INPUT, 'Nothing was changed.');
      const zohoChanged = newKey && newKey !== inv.zohoNoKey;
      if (zohoChanged && zSnap && zSnap.exists()) {
        const z = zSnap.data() || {};
        ensure(z.invoiceId === invoiceId, ERR.DUPLICATE_ZOHO, `Zoho invoice no. ${newZoho} is already used on ${z.invNo || 'another invoice'}${z.soNo ? ' (' + z.soNo + ')' : ''}. Check the number in Zoho Books.`);
      }
      const revision = inv.revision + 1;
      const next = { ...inv, ...nv, ...(zohoChanged ? { zohoNoKey: newKey } : {}), revision, lastEventId: eventId, updatedAt: at, updatedBy: actor.name, updatedByUid: actor.uid,
        revisedAt: at, revisedBy: actor.name, revisedByUid: actor.uid, editCount: (Number(inv.editCount) || 0) + 1, lastEditReason: editReason };
      assertSize(next, INVOICE_BYTES, 'Invoice');
      tx.set(refs.invoice(invoiceId), next);
      tx.set(refs.invoiceEvent(invoiceId, eventId), { id: eventId, kind: 'edited', invoiceId, invNo: inv.invNo, salesOrderId, operationId, fromRevision: inv.revision, toRevision: revision,
        reason: editReason, changes, actor: actor.name, actorUid: actor.uid, at, ...stamp() });
      if (zohoChanged) {
        tx.set(refs.zohoNo(newKey), { id: newKey, zohoNo: newZoho, invoiceId, invNo: inv.invNo, salesOrderId, soNo: inv.soNo || '', created: at, createdByUid: actor.uid });
        if (oldKeySnap && oldKeySnap.exists() && (oldKeySnap.data() || {}).invoiceId === invoiceId) tx.delete(refs.zohoNo(inv.zohoNoKey));
      }
      return { alreadyApplied: false, invoice: next, changes };
    });
  }

  return { issueInvoice, issueCreditNote, editInvoice };
}
