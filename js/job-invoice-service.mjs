/**
 * BizCore V271.13 — Contracting job invoices and their credit notes (Firestore transactions).
 *
 * A job invoice is an ordinary customer invoice (collection customerInvoices) that carries a jobId instead of a
 * salesOrderId, so the invoice register, Payment Receipts, receivables and the Dashboard pick it up with no
 * change. What a job may still be billed is decided by ONE document, jobBilling/{jobId}, read in the same
 * transaction — exactly as the Sales Order side uses salesOrderFulfillment/{soId}.
 *
 * Each action writes atomically: invoice (or credit note) + immutable event(s) + the billing ledger
 * (+ the document counter + the Zoho invoice-number claim).
 *
 * Idempotency: document IDs derive from the client operation ID — a retried save is detected.
 */
import { accessWithRole, actorMay } from './user-core.mjs?v=270.43';
import { formatSequence, nextSequence } from './numbering.mjs?v=270.25';
import { zohoNoKey, INVOICE_COLLECTIONS, INVOICE_SCHEMA_VERSION } from './invoice-core.mjs?v=266.0';
import { isSafeId, cleanText, isAcceptedStatus, r2, operationKey, WCC_COLLECTION } from './wcc-core.mjs?v=271.13';
import {
  JOB_BILLING_COLLECTION, JOB_INVOICE_TYPES, JOB_LIMITS, JB_ERR, JobBillingError, MONEY_EPSILON,
  emptyJobBilling, jobBillingState, jobContractValue, priceJobAdvance, priceJobWork, jobDeductionLimits,
  checkJobDeduction, allocateJobDeduction, applyJobInvoiceToLedger, buildJobCreditNote, jobInvoiceLine,
  effectiveJobBillingSettings, jobInvoiceTypeLabel,
} from './job-billing-core.mjs?v=271.13';

const fail = (code, message, details) => { throw new JobBillingError(code, message, details); };
const ensure = (ok, code, message, details) => { if (!ok) fail(code, message, details); };
const INVOICE_BYTES = 512 * 1024, EVENT_BYTES = 256 * 1024;
const byteSize = obj => { try { return new TextEncoder().encode(JSON.stringify(obj)).length; } catch (e) { return 0; } };
const assertSize = (obj, max, label) => ensure(byteSize(obj) <= max, JB_ERR.INVALID_INPUT, `${label} is too large to save (${Math.round(byteSize(obj) / 1024)} KB).`);
const requireDate = (v, label) => {
  const s = String(v == null ? '' : v).slice(0, 10);
  ensure(/^\d{4}-\d{2}-\d{2}$/.test(s), JB_ERR.INVALID_INPUT, `${label || 'Date'} is required (DD-MM-YYYY)`);
  const d = new Date(s + 'T00:00:00Z');
  ensure(!Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s, JB_ERR.INVALID_INPUT, `${label || 'Date'} is not a real date`);
  return s;
};
export const jobInvoiceId = operationId => 'INV-' + operationKey(operationId);
export const jobCreditNoteId = operationId => 'CN-' + operationKey(operationId);

export function createJobInvoiceService(fs, options = {}) {
  const { db, doc, runTransaction } = fs || {};
  ensure(db && typeof doc === 'function' && typeof runTransaction === 'function', JB_ERR.INVALID_INPUT, 'Firestore transaction API required');
  const serverTimestamp = typeof fs.serverTimestamp === 'function' ? fs.serverTimestamp : null;
  const now = options.now || (() => new Date().toISOString());
  const formatNumber = options.formatNumber || formatSequence;
  const today = options.today || (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
  const actorOf = () => {
    const a = (options.actor && options.actor()) || {};
    ensure(isSafeId(a.uid), JB_ERR.INVALID_STATE, 'You must be signed in to issue invoices');
    return { uid: a.uid, name: cleanText(a.name || a.email || a.uid, 200) };
  };
  const refs = {
    job: id => doc(db, 'jobs', id),
    ledger: id => doc(db, JOB_BILLING_COLLECTION, id),
    wcc: id => doc(db, WCC_COLLECTION, id),
    invoice: id => doc(db, INVOICE_COLLECTIONS.invoices, id),
    invoiceEvent: (invId, id) => doc(db, INVOICE_COLLECTIONS.invoices, invId, INVOICE_COLLECTIONS.invoiceEvents, id),
    creditNote: id => doc(db, INVOICE_COLLECTIONS.creditNotes, id),
    creditNoteEvent: (cnId, id) => doc(db, INVOICE_COLLECTIONS.creditNotes, cnId, INVOICE_COLLECTIONS.creditNoteEvents, id),
    zohoNo: key => doc(db, INVOICE_COLLECTIONS.zohoNumbers, key),
    counter: key => doc(db, 'counters', key),
    settings: () => doc(db, 'settings', 'billing'),
    access: () => doc(db, 'system', 'accessControl'),
  };
  const stamp = () => (serverTimestamp ? { recordedAt: serverTimestamp() } : {});
  const CONTENTION = new Set(['aborted', 'failed-precondition', 'permission-denied']);
  async function transact(fn) {
    for (let attempt = 1; ; attempt++) {
      try { return await runTransaction(db, fn); }
      catch (e) {
        if (attempt < 3 && (e && (e.code === JB_ERR.OVER_BILLING || e.code === JB_ERR.INCONSISTENT))) continue;
        if (attempt < 4 && CONTENTION.has(e && e.code)) { await new Promise(r => setTimeout(r, 60 * attempt + Math.floor(Math.random() * 120))); continue; }
        throw e;
      }
    }
  }
  function nextNumber(counterSnap, numbering) {
    ensure(numbering && isSafeId(numbering.counterKey) && typeof numbering.displayPrefix === 'string', JB_ERR.INVALID_INPUT, 'Document numbering is required');
    const sequence = nextSequence(counterSnap.exists() ? counterSnap.data().value : 0, numbering);
    return { sequence, number: formatNumber(numbering.displayPrefix, sequence, numbering.digits) };
  }
  async function readContext(tx, jobId, extra = []) {
    const actor = actorOf();
    const snaps = await Promise.all([
      tx.get(refs.job(jobId)), tx.get(refs.ledger(jobId)), tx.get(refs.settings()),
      accessWithRole(tx, doc, db, actor.uid), ...extra.map(r => tx.get(r)),
    ]);
    const [jobSnap, ledgerSnap, settingsSnap, accessSnap, ...rest] = snaps;
    ensure(jobSnap.exists(), JB_ERR.NOT_FOUND, `Job ${jobId} was not found`);
    const job = { id: jobId, ...jobSnap.data() };
    ensure(!/^(cancelled)$/i.test(String(job.status || '')), JB_ERR.INVALID_STATE, `${job.jobNo || jobId} is cancelled, so it cannot be invoiced.`);
    ensure(jobContractValue(job) > 0, JB_ERR.INVALID_STATE, `${job.jobNo || jobId} has no contract value, so nothing can be invoiced.`);
    const ledger = ledgerSnap.exists() ? ledgerSnap.data() : emptyJobBilling(jobId);
    ensure(String(ledger.jobId) === String(jobId), JB_ERR.INVALID_STATE, 'The billing ledger does not belong to this job');
    const admins = accessSnap && accessSnap.exists() && Array.isArray(accessSnap.data().adminUids) ? accessSnap.data().adminUids : [];
    return {
      actor, job, ledger, rest,
      settings: effectiveJobBillingSettings(settingsSnap.exists() ? settingsSnap.data() : null),
      isAdmin: admins.includes(actor.uid),
      may: what => actorMay(accessSnap, actor.uid, what),
    };
  }
  function ledgerRecord(ledger, job, { invoiceId, eventId, at, actor, billedWcc }) {
    const rec = {
      ...ledger, jobId: String(job.id), jobNo: job.jobNo || '', custId: job.custId || '', contractValue: jobContractValue(job),
      schemaVersion: ledger.schemaVersion || 1, revision: (Number(ledger.revision) || 0) + 1,
      ...(billedWcc ? { billedWccIds: { ...(ledger.billedWccIds || {}), [String(billedWcc)]: true } } : {}),
      lastInvoiceId: invoiceId || '', lastEventId: eventId || '', updatedAt: at, updatedBy: actor.name, updatedByUid: actor.uid,
    };
    assertSize(rec, JOB_LIMITS.bytes, 'The job billing record');
    return rec;
  }

  /* ───────── issue a job invoice (advance | progress | final) ───────── */
  async function issueJobInvoice(input) {
    const { operationId, jobId, type, numbering } = input || {};
    ensure(isSafeId(jobId), JB_ERR.INVALID_INPUT, 'Job reference required');
    ensure(Object.values(JOB_INVOICE_TYPES).includes(type), JB_ERR.INVALID_INPUT, 'Unknown invoice type');
    const invoiceId = jobInvoiceId(operationId), eventId = 'issue-' + operationKey(operationId);
    const date = requireDate(input.date, 'The invoice date');
    ensure(date <= today(), JB_ERR.INVALID_INPUT, 'The invoice date cannot be in the future');
    const dueDate = input.dueDate ? requireDate(input.dueDate, 'The due date') : '';
    if (dueDate) ensure(dueDate >= date, JB_ERR.INVALID_INPUT, 'The due date cannot be before the invoice date');
    const zohoNo = cleanText(input.zohoNo, 100), zKey = zohoNo ? zohoNoKey(zohoNo) : '';
    const wantWccId = cleanText(input.wccId, 240);

    return transact(async tx => {
      const extra = [refs.invoice(invoiceId), refs.counter((numbering || {}).counterKey || 'x')];
      if (zKey) extra.push(refs.zohoNo(zKey));
      if (wantWccId && isSafeId(wantWccId)) extra.push(refs.wcc(wantWccId));
      const ctx = await readContext(tx, jobId, extra);
      const [invSnap, counterSnap, ...more] = ctx.rest;
      const zohoSnap = zKey ? more.shift() : null;
      const wccSnap = (wantWccId && isSafeId(wantWccId)) ? more.shift() : null;
      if (invSnap.exists()) {
        const existing = invSnap.data();
        ensure(existing.creationOperationId === operationId && String(existing.jobId) === String(jobId), JB_ERR.ID_COLLISION, 'Invoice ID already used by another operation');
        return { alreadyApplied: true, invoice: existing };
      }
      if (zohoSnap && zohoSnap.exists()) {
        const z = zohoSnap.data() || {};
        fail(JB_ERR.INVALID_INPUT, `Zoho invoice no. ${zohoNo} is already used on ${z.invNo || 'another invoice'}. Check the number in Zoho Books.`);
      }
      const { job, ledger, actor } = ctx;
      const at = now();
      const wcc = wccSnap && wccSnap.exists() ? { id: wantWccId, ...wccSnap.data() } : null;
      if (wcc) ensure(String(wcc.jobId) === String(jobId), JB_ERR.INVALID_INPUT, 'That certificate belongs to another job');
      const state = jobBillingState(job, ledger, wcc ? [wcc] : []);

      let advance = null, jobLine = null, deductions = [], totals, priced;
      if (type === JOB_INVOICE_TYPES.advance) {
        priced = priceJobAdvance(state, input.advance || {});
        advance = { method: priced.method, percent: priced.percent, base: priced.base, amount: priced.amount, vatRate: priced.vatRate };
        jobLine = jobInvoiceLine(job, type, priced, null, input.lineText);
        totals = { goodsSubtotal: 0, goodsVat: 0, deductionSubtotal: 0, deductionVat: 0, subtotal: priced.amount, vat: priced.vat, total: r2(priced.amount + priced.vat) };
      } else {
        // The final invoice: an accepted FINAL certificate is required only when Administration says so.
        if (type === JOB_INVOICE_TYPES.final && ctx.settings.finalNeedsWcc) {
          const finalId = String(ledger.finalWccId || '');
          ensure(finalId, JB_ERR.NO_WCC,
            'A final invoice needs a final Work Completion Certificate accepted by the customer (Administration → Billing Settings).');
        }
        priced = priceJobWork(state, type, input.work || {}, wcc ? [wcc] : []);
        if (priced.basis === 'wcc') ensure(wcc && isAcceptedStatus(wcc.status), JB_ERR.NO_WCC, 'The certificate for this invoice is not accepted by the customer.');
        const limits = jobDeductionLimits(state, priced.subtotal);
        const amount = checkJobDeduction(limits, input.deduction == null ? limits.proposal : input.deduction);
        deductions = amount > MONEY_EPSILON ? allocateJobDeduction(ledger.billing || {}, amount) : [];
        const dSub = r2(deductions.reduce((s, d) => s + d.subtotal, 0)), dVat = r2(deductions.reduce((s, d) => s + d.vat, 0));
        jobLine = jobInvoiceLine(job, type, priced, wcc, input.lineText);
        totals = {
          goodsSubtotal: priced.subtotal, goodsVat: priced.vat, deductionSubtotal: dSub, deductionVat: dVat,
          subtotal: r2(priced.subtotal - dSub), vat: r2(priced.vat - dVat), total: r2(priced.subtotal - dSub + priced.vat - dVat),
        };
      }
      ensure(totals.total > -MONEY_EPSILON, JB_ERR.INVALID_INPUT, 'This invoice would come to a negative total.');
      const { sequence, number } = nextNumber(counterSnap, numbering);
      const invoice = {
        id: invoiceId, schemaVersion: INVOICE_SCHEMA_VERSION, invNo: number, type,
        jobId: String(jobId), jobNo: job.jobNo || '', salesOrderId: '', soNo: '',
        jobInvoiceType: jobInvoiceTypeLabel(type),
        wccId: wcc ? String(wcc.id) : '', wccNo: wcc ? (wcc.wccNo || '') : '',
        customer: job.company || '', custId: job.custId || '', poNo: job.poNo || '', poDate: job.poDate || '',
        quotationId: job.quotationId || '', qno: job.qno || '', project: job.project || '',
        contractValue: state.contract, contractPct: priced.percent || 0,
        date, dueDate, zohoNo, zohoNoKey: zKey, notes: cleanText(input.notes, 2000), reason: cleanText(input.reason, 1000),
        lines: [], jobLine, advance, deductions, totals, credited: {}, creditNotes: [], status: 'Issued',
        revision: 1, lastEventId: eventId, creationOperationId: operationId,
        created: at, createdBy: actor.name, createdByUid: actor.uid, updatedAt: at, updatedBy: actor.name, updatedByUid: actor.uid,
      };
      assertSize(invoice, INVOICE_BYTES, 'The invoice');
      const event = {
        id: eventId, kind: 'issued', invoiceId, invNo: number, jobId: String(jobId), type, operationId, toRevision: 1,
        totals, wccId: invoice.wccId, wccNo: invoice.wccNo, actor: actor.name, actorUid: actor.uid, at, ...stamp(),
      };
      assertSize(event, EVENT_BYTES, 'The invoice event');
      const nextLedger = ledgerRecord(applyJobInvoiceToLedger(ledger, invoice), job, {
        invoiceId, eventId, at, actor, billedWcc: invoice.wccId || null,
      });
      tx.set(refs.counter(numbering.counterKey), { value: sequence, updatedAt: Date.now() });
      tx.set(refs.ledger(jobId), nextLedger);
      tx.set(refs.invoice(invoiceId), invoice);
      tx.set(refs.invoiceEvent(invoiceId, eventId), event);
      if (zKey) tx.set(refs.zohoNo(zKey), { id: zKey, zohoNo, invoiceId, invNo: number, jobId: String(jobId), jobNo: job.jobNo || '', created: at, createdByUid: actor.uid });
      return { alreadyApplied: false, invoice, ledger: nextLedger };
    });
  }

  /* ───────── credit note against a job invoice ───────── */
  async function issueJobCreditNote(input) {
    const { operationId, jobId, invoiceId, numbering } = input || {};
    ensure(isSafeId(jobId) && isSafeId(invoiceId), JB_ERR.INVALID_INPUT, 'Invoice reference required');
    const cnId = jobCreditNoteId(operationId), cnEventId = 'cn-' + operationKey(operationId), invEventId = 'credit-' + operationKey(operationId);
    const date = requireDate(input.date, 'The credit note date');
    const reason = cleanText(input.reason, 600);
    ensure(reason.length >= 3, JB_ERR.INVALID_INPUT, 'Write why the invoice is credited');

    return transact(async tx => {
      const ctx = await readContext(tx, jobId, [refs.invoice(invoiceId), refs.creditNote(cnId), refs.counter((numbering || {}).counterKey || 'x')]);
      const [invSnap, cnSnap, counterSnap] = ctx.rest;
      if (cnSnap.exists()) {
        const existing = cnSnap.data();
        ensure(existing.creationOperationId === operationId, JB_ERR.ID_COLLISION, 'Credit note ID already used by another operation');
        return { alreadyApplied: true, creditNote: existing };
      }
      ensure(invSnap.exists(), JB_ERR.NOT_FOUND, 'Invoice not found');
      const invoice = invSnap.data();
      ensure(String(invoice.jobId) === String(jobId), JB_ERR.INVALID_INPUT, 'The invoice does not belong to this job');
      if (input.expectedRevision != null) ensure(invoice.revision === input.expectedRevision, JB_ERR.STALE_REVISION,
        `${invoice.invNo} was changed meanwhile. The latest version has been loaded — please review and try again.`);
      const { job, ledger, actor } = ctx;
      const at = now();
      const built = buildJobCreditNote(invoice, ledger, { amount: input.amount });
      const { sequence, number } = nextNumber(counterSnap, numbering);
      const creditNote = {
        id: cnId, schemaVersion: INVOICE_SCHEMA_VERSION, cnNo: number, invoiceId, invNo: invoice.invNo,
        invoiceDate: invoice.date, invoiceType: invoice.type,
        jobId: String(jobId), jobNo: job.jobNo || '', salesOrderId: '', soNo: '',
        customer: invoice.customer || '', custId: invoice.custId || '', poNo: invoice.poNo || '', project: invoice.project || '',
        date, reason, lines: [], ...built.note,
        revision: 1, lastEventId: cnEventId, creationOperationId: operationId,
        created: at, createdBy: actor.name, createdByUid: actor.uid,
      };
      assertSize(creditNote, INVOICE_BYTES, 'The credit note');
      const revision = (Number(invoice.revision) || 1) + 1;
      const nextInvoice = {
        ...invoice, credited: built.invoiceCredited, status: built.fully ? 'Credited' : 'Partially credited',
        creditNotes: [...(invoice.creditNotes || []), { id: cnId, cnNo: number, date, total: creditNote.total }],
        revision, lastEventId: invEventId, updatedAt: at, updatedBy: actor.name, updatedByUid: actor.uid,
      };
      assertSize(nextInvoice, INVOICE_BYTES, 'The invoice');
      const money = { subtotal: creditNote.subtotal, vat: creditNote.vat, total: creditNote.total };
      const invEvent = { id: invEventId, kind: 'credited', invoiceId, invNo: invoice.invNo, jobId: String(jobId), creditNoteId: cnId, cnNo: number, operationId, fromRevision: invoice.revision, toRevision: revision, reason, totals: money, actor: actor.name, actorUid: actor.uid, at, ...stamp() };
      const cnEvent = { id: cnEventId, kind: 'issued', creditNoteId: cnId, cnNo: number, invoiceId, jobId: String(jobId), operationId, toRevision: 1, reason, totals: money, actor: actor.name, actorUid: actor.uid, at, ...stamp() };
      const nextLedger = ledgerRecord(built.ledger, job, { invoiceId, eventId: invEventId, at, actor });
      tx.set(refs.counter(numbering.counterKey), { value: sequence, updatedAt: Date.now() });
      tx.set(refs.ledger(jobId), nextLedger);
      tx.set(refs.invoice(invoiceId), nextInvoice);
      tx.set(refs.invoiceEvent(invoiceId, invEventId), invEvent);
      tx.set(refs.creditNote(cnId), creditNote);
      tx.set(refs.creditNoteEvent(cnId, cnEventId), cnEvent);
      return { alreadyApplied: false, creditNote, invoice: nextInvoice };
    });
  }

  /** The billing ledger of one job (one read). */
  async function ledgerOf(jobId, getDoc) {
    if (typeof getDoc !== 'function') return null;
    try { const s = await getDoc(refs.ledger(String(jobId))); return s.exists() ? s.data() : null; }
    catch (e) { if (e && e.code === 'permission-denied') return null; throw e; }
  }

  return { issueJobInvoice, issueJobCreditNote, ledgerOf, _refs: refs };
}
