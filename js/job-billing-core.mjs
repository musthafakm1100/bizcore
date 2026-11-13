/**
 * BizCore V271.13 — Contracting job billing core (pure functions, no I/O).
 *
 * Contracting work is sold LUMP SUM, so a job invoice has no quantities: it bills a VALUE of the contract.
 * Three kinds, written as ordinary customer invoices (collection customerInvoices) with a jobId:
 *
 *   job-advance    a down payment before / during the work   % of the contract, or an amount
 *   job-progress   work done so far                          an accepted WCC, % of the contract, or an amount
 *   job-final      the balance of the contract               bills everything still open and deducts the whole
 *                                                            remaining advance
 *
 * Billing state lives in jobBilling/{jobId}, next to the certified position, so every rule is checked inside ONE
 * transaction against ONE document:
 *   certified.pct              % of the work accepted by the customer (accepted WCCs)
 *   billing.goodsValue         value of work invoiced (net of credit notes)
 *   billing.advances.{invId}   { invNo, date, subtotal, vatRate, deducted, credited }
 *
 * Hard rules (whatever the settings):
 *   1. Never bill more than the contract: work + advances − deductions ≤ contract value (before VAT).
 *   2. A deduction never exceeds the advance remaining nor the work value of its invoice.
 *   3. The invoice that bills the contract in full must deduct all the remaining advance.
 *   4. An advance that was deducted cannot be credited (only its undeducted part).
 *   5. Work already certified by the customer is never un-certified by an invoice or a credit note.
 */
import { WCC_TYPES, WCC_STATUS, isAcceptedStatus, rPct, r2, isSafeId, cleanText, byLineRecord, operationKey } from './wcc-core.mjs?v=271.13';

export const JOB_BILLING_COLLECTION = 'jobBilling';
export const JOB_BILLING_SCHEMA_VERSION = 1;
export const JOB_INVOICE_TYPES = Object.freeze({ advance: 'job-advance', progress: 'job-progress', final: 'job-final' });
export const JOB_WORK_BASIS = Object.freeze({ wcc: 'wcc', percent: 'percent', amount: 'amount' });
export const JOB_ADVANCE_METHODS = Object.freeze({ percent: 'percent', amount: 'amount' });
export const JOB_BILLING_SETTINGS_PATH = ['settings', 'billing'];
/** Administration → Billing: may a final invoice be issued without an accepted final WCC? (off = warning only) */
export const JOB_BILLING_DEFAULTS = Object.freeze({ finalNeedsWcc: false });
export const MONEY_EPSILON = 0.005;
export const JOB_LIMITS = Object.freeze({ wccs: 200, advances: 60, bytes: 256 * 1024 });

export class JobBillingError extends Error {
  constructor(code, message, details = {}) { super(message); this.name = 'JobBillingError'; this.code = code; Object.assign(this, details); }
}
export const JB_ERR = Object.freeze({
  INVALID_INPUT: 'invalid-input',
  NOT_FOUND: 'not-found',
  INVALID_STATE: 'invalid-state',
  ID_COLLISION: 'id-collision',
  STALE_REVISION: 'stale-revision',
  PERMISSION: 'not-permitted',
  OVER_BILLING: 'over-billing',
  DEDUCTION: 'invalid-deduction',
  OVER_CREDIT: 'over-credit',
  NO_WCC: 'no-accepted-wcc',
  INCONSISTENT: 'inconsistent-data',
});
const fail = (code, message, details) => { throw new JobBillingError(code, message, details); };
const ensure = (ok, code, message, details) => { if (!ok) fail(code, message, details); };
const num = v => { const n = Number(String(v == null ? '' : v).replace(/,/g, '')); return Number.isFinite(n) ? n : NaN; };

export const jobInvoiceIdForOperation = operationId => 'INV-' + operationKey(operationId);
export const jobCreditNoteIdForOperation = operationId => 'CN-' + operationKey(operationId);
export const effectiveJobBillingSettings = stored => ({
  ...JOB_BILLING_DEFAULTS,
  finalNeedsWcc: !!(stored && stored.finalNeedsWcc),
});
export const emptyJobBilling = jobId => ({
  jobId: String(jobId), schemaVersion: JOB_BILLING_SCHEMA_VERSION,
  certified: { pct: 0, byLine: {}, wccId: '', wccNo: '', at: '' },
  open: { wccId: '', wccNo: '' },
  finalWccId: '',
  wccs: {},
  billing: { goodsValue: 0, advances: {} },
  revision: 0,
});

/* ───────────────────────── state ───────────────────────── */

export const jobContractValue = job => r2(num(job && job.contractValue) || 0);
export const jobVatRate = job => { const r = Number(job && job.vatRate); return Number.isFinite(r) && r >= 0 ? r : 0.15; };

export function jobBillingOf(ledger) {
  const b = (ledger && ledger.billing) || {};
  return { goodsValue: r2(b.goodsValue || 0), advances: { ...(b.advances || {}) } };
}
export function jobAdvanceTotals(billing) {
  let invoiced = 0, deducted = 0, credited = 0;
  for (const a of Object.values((billing && billing.advances) || {})) {
    invoiced += Number(a.subtotal) || 0; deducted += Number(a.deducted) || 0; credited += Number(a.credited) || 0;
  }
  invoiced = r2(invoiced); deducted = r2(deducted); credited = r2(credited);
  return { invoiced, deducted, credited, net: r2(invoiced - credited), remaining: r2(invoiced - credited - deducted) };
}
/** What the customer has been billed so far (before VAT): work + advances − deductions. */
export function jobNetBilled(billing) {
  const a = jobAdvanceTotals(billing);
  return r2(billing.goodsValue + a.net - a.deducted);
}

/** The certified position from the accepted certificates (the ledger keeps the same number). */
export function certifiedPctOf(wccList) {
  let best = 0, src = null;
  (wccList || []).filter(w => w && isAcceptedStatus(w.status)).forEach(w => {
    const p = rPct(w.overallPct);
    if (p >= best) { best = p; src = w; }
  });
  return { pct: rPct(best), wcc: src };
}
export const acceptedFinalWcc = wccList => (wccList || []).find(w => w && w.type === WCC_TYPES.final && isAcceptedStatus(w.status)) || null;

/** Everything the billing screens and the Job view need. */
export function jobBillingState(job, ledger, wccList) {
  const contract = jobContractValue(job);
  const billing = jobBillingOf(ledger);
  const adv = jobAdvanceTotals(billing);
  const ledgerPct = rPct((ledger && ledger.certified && ledger.certified.pct) || 0);
  const fromList = certifiedPctOf(wccList);
  const certifiedPct = rPct(Math.max(ledgerPct, fromList.pct));
  const netBilled = jobNetBilled(billing);
  const workLeft = r2(Math.max(0, contract - billing.goodsValue));
  return {
    contract, vatRate: jobVatRate(job), certifiedPct,
    certifiedValue: r2(contract * certifiedPct / 100),
    certifiedWcc: fromList.wcc,
    finalWcc: acceptedFinalWcc(wccList),
    goodsValue: billing.goodsValue,
    invoicedPct: contract > 0 ? rPct(billing.goodsValue / contract * 100) : 0,
    advances: adv,
    netBilled,
    workLeft,
    roomTotal: r2(Math.max(0, contract - netBilled)),
    workCertifiedLeft: r2(Math.max(0, contract * certifiedPct / 100 - billing.goodsValue)),
    fullyInvoiced: contract > 0 && billing.goodsValue >= contract - MONEY_EPSILON,
    advances_: billing.advances,
  };
}

/* ───────────────────────── advance invoices ───────────────────────── */

/** input: { method:'percent'|'amount', percent, amount } → { base, percent, amount, vatRate, vat, method } */
export function priceJobAdvance(state, input) {
  const method = String(input && input.method || '');
  ensure(Object.values(JOB_ADVANCE_METHODS).includes(method), JB_ERR.INVALID_INPUT, 'Choose how the advance is calculated');
  ensure(state.contract > 0, JB_ERR.INVALID_STATE, 'This job has no contract value, so nothing can be invoiced.');
  let amount, percent;
  if (method === JOB_ADVANCE_METHODS.percent) {
    percent = num(input.percent);
    ensure(Number.isFinite(percent) && percent > 0 && percent <= 100, JB_ERR.INVALID_INPUT, 'The advance percentage must be more than 0 and at most 100');
    amount = r2(state.contract * percent / 100);
  } else {
    amount = r2(num(input.amount));
    ensure(Number.isFinite(amount) && amount > 0, JB_ERR.INVALID_INPUT, 'Enter the advance amount');
    percent = state.contract > 0 ? r2(amount / state.contract * 100) : 0;
  }
  ensure(amount > 0, JB_ERR.INVALID_INPUT, 'The advance amount must be greater than zero');
  ensure(amount <= state.roomTotal + MONEY_EPSILON, JB_ERR.OVER_BILLING,
    `This advance (${amount.toFixed(2)}) would bill more than the contract value. At most ${Math.max(0, state.roomTotal).toFixed(2)} can still be billed on this job.`,
    { room: state.roomTotal, amount });
  return { base: state.contract, percent, amount, vatRate: state.vatRate, vat: r2(amount * state.vatRate), method };
}

/* ───────────────────────── work (progress / final) invoices ───────────────────────── */

/**
 * input: { basis:'wcc'|'percent'|'amount', wccId, percent, amount }  (ignored for a final invoice: it bills the balance)
 * → { subtotal, percent, vatRate, vat, basis, wcc, isFinal }
 */
export function priceJobWork(state, type, input, wccList) {
  ensure(type === JOB_INVOICE_TYPES.progress || type === JOB_INVOICE_TYPES.final, JB_ERR.INVALID_INPUT, 'Unknown invoice type');
  ensure(state.contract > 0, JB_ERR.INVALID_STATE, 'This job has no contract value, so nothing can be invoiced.');
  const isFinal = type === JOB_INVOICE_TYPES.final;
  let subtotal, basis = String((input && input.basis) || JOB_WORK_BASIS.amount), wcc = null;
  if (isFinal) {
    basis = JOB_WORK_BASIS.amount;
    subtotal = state.workLeft;
    ensure(subtotal > MONEY_EPSILON, JB_ERR.OVER_BILLING, 'The whole contract value is already invoiced on this job.');
  } else {
    ensure(Object.values(JOB_WORK_BASIS).includes(basis), JB_ERR.INVALID_INPUT, 'Choose what this invoice bills');
    if (basis === JOB_WORK_BASIS.wcc) {
      const id = String((input && input.wccId) || '');
      wcc = (wccList || []).find(w => w && String(w.id) === id) || null;
      ensure(wcc, JB_ERR.NOT_FOUND, 'The work completion certificate was not found');
      ensure(isAcceptedStatus(wcc.status), JB_ERR.NO_WCC,
        `${wcc.wccNo || 'That certificate'} is not accepted by the customer yet, so the work on it cannot be invoiced.`);
      subtotal = r2(Math.max(0, state.contract * rPct(wcc.overallPct) / 100 - state.goodsValue));
      ensure(subtotal > MONEY_EPSILON, JB_ERR.OVER_BILLING,
        `The work certified by ${wcc.wccNo || 'this certificate'} (${rPct(wcc.overallPct)} %) is already invoiced.`);
    } else if (basis === JOB_WORK_BASIS.percent) {
      const pct = num(input && input.percent);
      ensure(Number.isFinite(pct) && pct > 0 && pct <= 100, JB_ERR.INVALID_INPUT, 'The percentage must be more than 0 and at most 100');
      subtotal = r2(state.contract * pct / 100);
    } else {
      subtotal = r2(num(input && input.amount));
      ensure(Number.isFinite(subtotal) && subtotal > 0, JB_ERR.INVALID_INPUT, 'Enter the amount to invoice');
    }
    ensure(subtotal <= state.workLeft + MONEY_EPSILON, JB_ERR.OVER_BILLING,
      `Only ${Math.max(0, state.workLeft).toFixed(2)} of work is still to be invoiced on this job (contract ${state.contract.toFixed(2)}, already invoiced ${state.goodsValue.toFixed(2)}).`,
      { workLeft: state.workLeft, requested: subtotal });
  }
  return {
    subtotal, percent: state.contract > 0 ? r2(subtotal / state.contract * 100) : 0,
    vatRate: state.vatRate, vat: r2(subtotal * state.vatRate), basis, wcc, isFinal,
  };
}

/** Deduction limits for a work invoice (same shape and wording as the Sales Order side). */
export function jobDeductionLimits(state, workSubtotal) {
  const remaining = Math.max(0, state.advances.remaining);
  const max = r2(Math.min(remaining, workSubtotal));
  const min = r2(Math.max(0, state.netBilled + workSubtotal - state.contract));
  const isFinal = state.goodsValue + workSubtotal >= state.contract - MONEY_EPSILON;
  const proposal = isFinal ? r2(remaining)
    : r2(Math.min(max, Math.max(min, state.contract > 0 ? workSubtotal * (state.advances.net / state.contract) : 0)));
  return { remaining: r2(remaining), min, max, proposal: r2(Math.min(max, Math.max(min, proposal))), isFinal, finalAmount: isFinal ? r2(remaining) : null };
}
export function checkJobDeduction(limits, amount) {
  const a = r2(num(amount));
  ensure(Number.isFinite(a) && a >= 0, JB_ERR.DEDUCTION, 'Enter a valid advance deduction');
  if (limits.isFinal) {
    ensure(Math.abs(a - limits.finalAmount) <= MONEY_EPSILON, JB_ERR.DEDUCTION,
      `This invoice bills the contract in full, so it must deduct the whole remaining advance (${limits.finalAmount.toFixed(2)}).`, { required: limits.finalAmount });
    ensure(limits.finalAmount <= limits.max + MONEY_EPSILON, JB_ERR.OVER_BILLING,
      'The remaining advance is larger than this final invoice. Issue a credit note for the unused advance first.', { remaining: limits.remaining, max: limits.max });
    return a;
  }
  ensure(a <= limits.max + MONEY_EPSILON, JB_ERR.DEDUCTION, `The deduction cannot be more than ${limits.max.toFixed(2)} (remaining advance or invoice value).`, { max: limits.max });
  ensure(a >= limits.min - MONEY_EPSILON, JB_ERR.OVER_BILLING,
    `At least ${limits.min.toFixed(2)} of the advance must be deducted, otherwise the customer would be billed more than the contract value.`, { min: limits.min });
  return a;
}
/** Splits a deduction over the open advances, oldest first. */
export function allocateJobDeduction(billing, amount) {
  let left = r2(amount);
  const out = [];
  const open = Object.entries((billing && billing.advances) || {})
    .map(([id, a]) => ({ id, ...a, open: r2((Number(a.subtotal) || 0) - (Number(a.credited) || 0) - (Number(a.deducted) || 0)) }))
    .filter(a => a.open > MONEY_EPSILON)
    .sort((x, y) => String(x.date || '').localeCompare(String(y.date || '')) || String(x.invNo || '').localeCompare(String(y.invNo || '')));
  for (const a of open) {
    if (left <= MONEY_EPSILON) break;
    const take = r2(Math.min(left, a.open));
    const vatRate = Number(a.vatRate) || 0;
    out.push({ advanceInvoiceId: a.id, advanceInvNo: a.invNo || '', advanceDate: a.date || '', subtotal: take, vatRate, vat: r2(take * vatRate) });
    left = r2(left - take);
  }
  ensure(left <= MONEY_EPSILON, JB_ERR.DEDUCTION, 'The deduction is larger than the advance remaining.');
  return out;
}

/** The one printed line of a job invoice. */
export function jobInvoiceLine(job, type, priced, wcc, text) {
  const what = type === JOB_INVOICE_TYPES.advance ? 'Advance payment'
    : type === JOB_INVOICE_TYPES.final ? 'Final payment' : 'Progress payment';
  const pctPart = priced.percent ? `${r2(priced.percent).toFixed(2)} % of contract value` : '';
  const auto = [
    `${what} — ${pctPart || 'as agreed'} for ${job.project || 'the works'}`,
    wcc && wcc.wccNo ? `as per ${wcc.wccNo}` : '',
    job.poNo ? `PO ${job.poNo}` : '',
  ].filter(Boolean).join(', ') + '.';
  return {
    desc: cleanText(text, 1200) || auto,
    percent: r2(priced.percent), subtotal: r2(priced.subtotal != null ? priced.subtotal : priced.amount),
    vatRate: priced.vatRate, vat: priced.vat,
  };
}

/* ───────────────────────── ledger updates ───────────────────────── */

export function applyJobInvoiceToLedger(ledger, invoice) {
  const billing = jobBillingOf(ledger);
  const advances = { ...billing.advances };
  if (invoice.type === JOB_INVOICE_TYPES.advance) {
    advances[invoice.id] = {
      invNo: invoice.invNo, date: invoice.date, subtotal: invoice.totals.subtotal,
      vatRate: (invoice.advance && invoice.advance.vatRate) || 0, deducted: 0, credited: 0,
    };
  } else {
    billing.goodsValue = r2(billing.goodsValue + invoice.totals.goodsSubtotal);
    for (const d of invoice.deductions || []) {
      const a = advances[d.advanceInvoiceId];
      ensure(a, JB_ERR.INCONSISTENT, 'Advance invoice not found in the job billing ledger');
      advances[d.advanceInvoiceId] = { ...a, deducted: r2((Number(a.deducted) || 0) + d.subtotal) };
    }
  }
  return { ...(ledger || {}), billing: { goodsValue: billing.goodsValue, advances } };
}

/** An accepted certificate raises the certified position (it never goes down). */
export function applyWccToLedger(ledger, wcc) {
  const cur = (ledger && ledger.certified) || {};
  const pct = rPct(wcc && wcc.overallPct);
  if (rPct(cur.pct) >= pct) return { ...(ledger || {}) };
  return {
    ...(ledger || {}),
    certified: {
      ...cur, pct, byLine: { ...(cur.byLine || {}), ...byLineRecord(wcc && wcc.lines) },
      wccId: String((wcc && wcc.id) || ''), wccNo: String((wcc && wcc.wccNo) || ''),
      at: String((wcc && wcc.acceptance && wcc.acceptance.date) || (wcc && wcc.date) || ''),
    },
  };
}

/** The small per-job index of certificates kept in the ledger (what the rules and the screens need). */
const wccSummary = wcc => ({
  wccNo: String((wcc && wcc.wccNo) || ''), type: String((wcc && wcc.type) || ''), date: String((wcc && wcc.date) || ''),
  status: String((wcc && wcc.status) || ''), overallPct: rPct(wcc && wcc.overallPct),
});
/** A new certificate is waiting for the customer: it blocks a second one until it is decided or cancelled. */
export function applyWccCreatedToLedger(ledger, wcc) {
  const base = { ...(ledger || {}) };
  const wccs = { ...(base.wccs || {}) };
  wccs[String(wcc.id)] = wccSummary(wcc);
  ensure(Object.keys(wccs).length <= JOB_LIMITS.wccs, JB_ERR.INVALID_STATE,
    'This job already has the maximum number of work completion certificates.');
  return { ...base, wccs, open: { wccId: String(wcc.id), wccNo: String(wcc.wccNo || '') } };
}
/** The customer's decision: accepted (raises the certified position) · accepted with remarks · not accepted. */
export function applyWccDecisionToLedger(ledger, wcc, decision) {
  let next = { ...(ledger || {}) };
  const wccs = { ...(next.wccs || {}) };
  wccs[String(wcc.id)] = { ...wccSummary(wcc), status: decision.status };
  next.wccs = wccs;
  if (next.open && String(next.open.wccId) === String(wcc.id)) next.open = { wccId: '', wccNo: '' };
  if (decision.certifies != null) {
    next = applyWccToLedger(next, { ...wcc, status: decision.status, acceptance: decision.acceptance });
    if (wcc.type === WCC_TYPES.final) next.finalWccId = String(wcc.id);
  }
  return next;
}
/**
 * A cancelled certificate certifies nothing any more. An ACCEPTED one may only be cancelled while it still
 * holds the certified position and nothing has been billed against it (the service checks that), so the
 * position goes back to what the certificate itself recorded as the previous one.
 */
export function applyWccCancelToLedger(ledger, wcc) {
  const next = { ...(ledger || {}) };
  const wccs = { ...(next.wccs || {}) };
  wccs[String(wcc.id)] = { ...wccSummary(wcc), status: WCC_STATUS.cancelled };
  next.wccs = wccs;
  if (next.open && String(next.open.wccId) === String(wcc.id)) next.open = { wccId: '', wccNo: '' };
  if (String(next.finalWccId || '') === String(wcc.id)) next.finalWccId = '';
  const cur = next.certified || {};
  if (String(cur.wccId || '') === String(wcc.id)) {
    const back = {};
    (wcc.lines || []).forEach(l => { if (l && l.idx != null) back[String(l.idx)] = rPct(l.prevPct); });
    next.certified = { pct: rPct(wcc.previousPct), byLine: back, wccId: '', wccNo: '', at: '' };
  }
  return next;
}

/* ───────────────────────── credit notes ───────────────────────── */

/** What is still creditable on a job invoice (one lump-sum line → one amount). */
export function jobCreditableOf(invoice) {
  const credited = invoice.credited || {};
  if (invoice.type === JOB_INVOICE_TYPES.advance) {
    return { kind: 'advance', left: r2((invoice.totals.subtotal || 0) - (Number(credited.advanceSubtotal) || 0)) };
  }
  const goodsLeft = r2((invoice.totals.goodsSubtotal || 0) - (Number(credited.goodsSubtotal) || 0));
  const deductionLeft = r2((invoice.totals.deductionSubtotal || 0) - (Number(credited.deductionSubtotal) || 0));
  return { kind: 'work', left: goodsLeft, deductionLeft };
}

/**
 * Credit note against a job invoice. input: { amount } (the work value, or the advance, to credit).
 * The invoice's advance deduction is reversed in proportion, so the job's position stays right.
 */
export function buildJobCreditNote(invoice, ledger, input) {
  ensure(invoice.status !== 'Credited', JB_ERR.INVALID_STATE, `${invoice.invNo} is already fully credited`);
  const billing = jobBillingOf(ledger);
  const advances = { ...billing.advances };
  const amount = r2(num(input && input.amount));
  ensure(Number.isFinite(amount) && amount > 0, JB_ERR.INVALID_INPUT, 'Enter the amount to credit');
  const left = jobCreditableOf(invoice);

  if (left.kind === 'advance') {
    const a = advances[invoice.id];
    ensure(a, JB_ERR.INCONSISTENT, 'Advance invoice not found in the job billing ledger');
    const undeducted = r2((Number(a.subtotal) || 0) - (Number(a.credited) || 0) - (Number(a.deducted) || 0));
    ensure(amount <= undeducted + MONEY_EPSILON, JB_ERR.OVER_CREDIT,
      `Only ${Math.max(0, undeducted).toFixed(2)} of this advance can be credited — the rest has already been deducted on later invoices.`, { undeducted });
    advances[invoice.id] = { ...a, credited: r2((Number(a.credited) || 0) + amount) };
    const vatRate = Number(a.vatRate) || 0, vat = r2(amount * vatRate);
    return {
      note: { kind: 'advance', goodsSubtotal: 0, goodsVat: 0, deductionReversal: [], advanceSubtotal: amount, advanceVat: vat, vatRate, subtotal: amount, vat, total: r2(amount + vat) },
      ledger: { ...(ledger || {}), billing: { goodsValue: billing.goodsValue, advances } },
      invoiceCredited: { ...(invoice.credited || {}), advanceSubtotal: r2((Number(invoice.credited && invoice.credited.advanceSubtotal) || 0) + amount) },
      fully: r2((invoice.totals.subtotal || 0) - ((Number(invoice.credited && invoice.credited.advanceSubtotal) || 0) + amount)) <= MONEY_EPSILON,
    };
  }

  ensure(amount <= left.left + MONEY_EPSILON, JB_ERR.OVER_CREDIT,
    `At most ${Math.max(0, left.left).toFixed(2)} can still be credited on ${invoice.invNo}.`, { left: left.left });
  const vatRate = (invoice.jobLine && Number(invoice.jobLine.vatRate)) || 0;
  const goodsVat = r2(amount * vatRate);
  const fully = amount >= left.left - MONEY_EPSILON;
  let toReverse = 0;
  if (left.deductionLeft > MONEY_EPSILON) {
    toReverse = fully ? left.deductionLeft : r2(Math.min(left.deductionLeft, left.left > 0 ? left.deductionLeft * amount / left.left : 0));
  }
  const deductionReversal = [];
  const already = { ...((invoice.credited && invoice.credited.deductionByAdvance) || {}) };
  for (const d of [...(invoice.deductions || [])].reverse()) {
    if (toReverse <= MONEY_EPSILON) break;
    const open = r2(d.subtotal - (Number(already[d.advanceInvoiceId]) || 0));
    const take = r2(Math.min(open, toReverse));
    if (take <= MONEY_EPSILON) continue;
    const a = advances[d.advanceInvoiceId];
    ensure(a, JB_ERR.INCONSISTENT, 'Advance invoice not found in the job billing ledger');
    advances[d.advanceInvoiceId] = { ...a, deducted: r2(Math.max(0, (Number(a.deducted) || 0) - take)) };
    already[d.advanceInvoiceId] = r2((Number(already[d.advanceInvoiceId]) || 0) + take);
    deductionReversal.push({ advanceInvoiceId: d.advanceInvoiceId, advanceInvNo: d.advanceInvNo, advanceDate: d.advanceDate, subtotal: take, vatRate: d.vatRate, vat: r2(take * d.vatRate) });
    toReverse = r2(toReverse - take);
  }
  const revSub = r2(deductionReversal.reduce((s, d) => s + d.subtotal, 0));
  const revVat = r2(deductionReversal.reduce((s, d) => s + d.vat, 0));
  const subtotal = r2(amount - revSub), vat = r2(goodsVat - revVat);
  return {
    note: { kind: 'work', goodsSubtotal: amount, goodsVat, deductionReversal, advanceSubtotal: 0, advanceVat: 0, vatRate, subtotal, vat, total: r2(subtotal + vat) },
    ledger: { ...(ledger || {}), billing: { goodsValue: r2(Math.max(0, billing.goodsValue - amount)), advances } },
    invoiceCredited: {
      ...(invoice.credited || {}),
      goodsSubtotal: r2((Number(invoice.credited && invoice.credited.goodsSubtotal) || 0) + amount),
      deductionSubtotal: r2((Number(invoice.credited && invoice.credited.deductionSubtotal) || 0) + revSub),
      deductionByAdvance: already,
    },
    fully,
  };
}

/* ───────────────────────── read model ───────────────────────── */

export const isJobInvoice = inv => !!(inv && inv.jobId) && Object.values(JOB_INVOICE_TYPES).includes(inv.type);
export const jobInvoiceTypeLabel = t => t === JOB_INVOICE_TYPES.advance ? 'Advance' : t === JOB_INVOICE_TYPES.final ? 'Full & Final' : 'Progress';

/** The Job view's Completion & Billing figures (money + what was received). */
export function jobFinanceSummary(state, invoices, paidOf) {
  const list = (invoices || []).filter(isJobInvoice);
  const invoiced = r2(list.reduce((s, i) => s + (Number((i.totals || {}).total) || 0), 0));
  const received = r2(list.reduce((s, i) => s + (Number(paidOf ? paidOf(i) : 0) || 0), 0));
  return {
    ...state,
    invoiceCount: list.length,
    invoicedTotal: invoiced,
    receivedTotal: received,
    balanceTotal: r2(invoiced - received),
    receivedPct: invoiced > 0 ? rPct(received / invoiced * 100) : 0,
    toInvoice: r2(state.roomTotal),
    readyToInvoice: r2(Math.max(0, state.workCertifiedLeft)),
  };
}
