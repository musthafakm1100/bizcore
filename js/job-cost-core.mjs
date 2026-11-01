/**
 * BizCore V271.3 — Contracting actual cost: Job Expenses (approved mockup CC_2) and the job's Estimate vs Actual (CJ_2).
 * Pure rules, no Firebase.
 *
 * jobExpenses/{JE-<op>} { id, jeNo, operationId, jobId, jobNo, company, project, date,
 *   accountId, accountCode, accountName, accountType, viaAccountId, viaAccountName, postingAccountId, reference,
 *   lines:[{ lineNo, categoryId, category, costType, desc, paidTo, amount, vat }],
 *   amount (Σ cost, without VAT), vat (Σ VAT), total (paid), note, receipt { url, path, name } | null,
 *   entryId, status Posted | Voided, revision, voidReason…, created…, recordedAt }
 * cashEntries/jee-<op> + cashLines/jee-<op>__<account>: the money paid out (kind 'job-expense'); cash waits for the
 *   custodian like every cash line; a card is paid from its linked bank (the card line is a memo).
 */
export const JE_COLLECTION = 'jobExpenses';
export const JE_ENTRY_KIND = 'job-expense';
export const JE_STATUS = Object.freeze({ posted: 'Posted', voided: 'Voided' });
export const COST_TYPES = Object.freeze(['material', 'manpower', 'subcontract', 'other']);
export const COST_TYPE_LABELS = Object.freeze({ material: 'Material', manpower: 'Manpower', subcontract: 'Subcontract', other: 'Equipment / Other' });
export const JE_LIMITS = Object.freeze({ lines: 30, desc: 200, paidTo: 100, note: 500, reference: 60, amount: 10000000 });

export const r2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));
const isId = s => typeof s === 'string' && /^[A-Za-z0-9_.-]{1,200}$/.test(s);
/** "1,250.50" → 1250.5 ; empty → 0 ; more than 2 decimals or not a number → NaN */
function money(v) {
  const s = String(v == null ? '' : v).replace(/,/g, '').trim();
  if (s === '') return 0;
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) return NaN;
  return r2(Number(s));
}
export const jobExpenseIdForOperation = op => { const k = String(op || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 200); return k.length >= 8 ? 'JE-' + k : ''; };
export const jobExpenseEntryIdOf = id => 'jee-' + String(id || '').replace(/^JE-/, '');
export const ledgerLineIdOf = (entryId, accountId) => `${entryId}__${accountId}`;
const CLOSED = /^(closed|cancelled)$/i;

/**
 * input { jobId, date, accountId, reference, note, lines:[{ categoryId, category, costType, desc, paidTo, amount, vat }] }
 * ctx   { job (jobs doc), accounts: Map id → account (incl. the bank linked to a card), today }
 * → { ok, value, errors:[{field, message, line?}] }
 */
export function validateJobExpense(input = {}, { job = null, accounts = new Map(), today = new Date().toISOString().slice(0, 10) } = {}) {
  const errors = [], err = (field, message, line) => errors.push(line == null ? { field, message } : { field, message, line });
  const date = String(input.date || '').slice(0, 10);
  if (!job) err('job', 'Choose the job.');
  else if (CLOSED.test(String(job.status || ''))) err('job', `${job.jobNo || 'This job'} is ${String(job.status).toLowerCase()} — no new costs.`);
  if (!isDate(date)) err('date', 'Enter the date.');
  else if (date > today) err('date', 'The date can\'t be in the future.');
  // the account the money was paid from
  const a = isId(input.accountId) ? accounts.get(input.accountId) : null;
  let via = null;
  if (!a) err('account', 'Choose the account it was paid from.');
  else {
    if (a.active === false) err('account', `${a.name} is inactive.`);
    if (a.type === 'card') {
      via = isId(a.linkedBankAccountId) ? accounts.get(a.linkedBankAccountId) : null;
      if (!via || via.type !== 'bank') err('account', `${a.name} has no linked bank account — set it in Administration → Payment Accounts.`);
      else if (via.active === false) err('account', `${a.name}: its bank account ${via.name} is inactive.`);
    }
    if (isDate(date)) for (const x of [a, via]) if (x && x.openingDate && date < x.openingDate) err('date', `The date is before the opening balance of ${x.name}.`);
  }
  const raw = (Array.isArray(input.lines) ? input.lines : []).filter(l => l && (clean(l.desc, 10) || String(l.amount == null ? '' : l.amount).trim() !== '' || String(l.vat == null ? '' : l.vat).trim() !== ''));
  if (!raw.length) err('lines', 'Add at least one expense line.');
  if (raw.length > JE_LIMITS.lines) err('lines', `At most ${JE_LIMITS.lines} lines.`);
  const lines = raw.slice(0, JE_LIMITS.lines).map((l, i) => {
    const n = i + 1, amount = money(l.amount), vat = money(l.vat);
    const line = { lineNo: n, categoryId: clean(l.categoryId, 40), category: clean(l.category, 60), costType: COST_TYPES.includes(l.costType) ? l.costType : '',
      desc: clean(l.desc, JE_LIMITS.desc), paidTo: clean(l.paidTo, JE_LIMITS.paidTo), amount: Number.isFinite(amount) ? amount : 0, vat: Number.isFinite(vat) ? vat : 0 };
    if (!line.desc) err('desc', `Line ${n}: enter what it was for.`, i);
    if (!line.costType) err('costType', `Line ${n}: choose the category.`, i);
    if (!(Number.isFinite(amount) && amount > 0)) err('amount', `Line ${n}: enter the amount (up to 2 decimals).`, i);
    else if (amount > JE_LIMITS.amount) err('amount', `Line ${n}: the amount is too large.`, i);
    if (!(Number.isFinite(vat) && vat >= 0)) err('vat', `Line ${n}: VAT must be a number (up to 2 decimals).`, i);
    else if (Number.isFinite(amount) && vat > amount) err('vat', `Line ${n}: the VAT can't be more than the amount.`, i);
    return line;
  });
  const amount = r2(lines.reduce((s, l) => s + l.amount, 0)), vat = r2(lines.reduce((s, l) => s + l.vat, 0));
  const value = {
    jobId: job ? clean(job.id, 120) : '', jobNo: job ? clean(job.jobNo, 40) : '', company: job ? clean(job.company, 200) : '', project: job ? clean(job.project, 200) : '',
    date, lines, amount, vat, total: r2(amount + vat), note: clean(input.note, JE_LIMITS.note), reference: clean(input.reference, JE_LIMITS.reference),
    accountId: a ? a.id : '', accountCode: a ? clean(a.code, 20) : '', accountName: a ? clean(a.name, 80) : '', accountType: a ? a.type : '',
    viaAccountId: via ? via.id : '', viaAccountName: via ? clean(via.name, 80) : '', postingAccountId: via ? via.id : a ? a.id : '',
  };
  return { ok: errors.length === 0, value, errors };
}

/** The records of one job expense: the document, its ledger entry and one posting per account (the paying account;
 *  for a card: the linked bank pays, the card carries a memo line). */
export function buildJobExpenseRecords({ id, jeNo, value, accounts, actor, at, stamp, operationId, receipt = null }) {
  const entryId = jobExpenseEntryIdOf(id);
  const description = clean(`Job expense · ${value.jobNo}${value.project ? ' · ' + value.project : ''}`, 200);
  const postings = { [value.postingAccountId]: { amountIn: 0, amountOut: value.total, memoOut: 0 } };
  if (value.viaAccountId) postings[value.accountId] = { amountIn: 0, amountOut: 0, memoOut: value.total };
  const accountIds = Object.keys(postings);
  const byType = {};
  value.lines.forEach(l => { byType[l.costType] = r2((byType[l.costType] || 0) + l.amount); });
  const journal = [
    ...Object.entries(byType).map(([t, amt]) => ({ accountId: '', ledger: 'job-cost-' + t, debit: amt, credit: 0 })),
    ...(value.vat > 0 ? [{ accountId: '', ledger: 'input-vat', debit: value.vat, credit: 0 }] : []),
    { accountId: value.postingAccountId, ledger: '', debit: 0, credit: value.total },
  ];
  const expense = {
    id, schemaVersion: 1, jeNo, operationId, ...value, receipt: receipt && receipt.url ? { url: clean(receipt.url, 1000), path: clean(receipt.path, 300), name: clean(receipt.name, 120) } : null,
    entryId, status: JE_STATUS.posted, revision: 1, accounting: { lines: journal },
    created: at, createdBy: actor.name, createdByUid: actor.uid, updatedAt: at, updatedBy: actor.name, updatedByUid: actor.uid, recordedAt: stamp,
  };
  const entry = {
    id: entryId, schemaVersion: 1, kind: JE_ENTRY_KIND, jobExpenseId: id, jobId: value.jobId, jobNo: value.jobNo,
    voucherNo: jeNo, date: value.date, amount: value.total, description, lines: journal, accountIds,
    postings: Object.fromEntries(accountIds.map(a => [a, postings[a]])),
    void: false, revision: 1, recordedByUid: actor.uid, recordedByName: actor.name, recordedAt: at,
    updatedByUid: actor.uid, updatedByName: actor.name, updatedAt: stamp,
  };
  const paidTo = [...new Set(value.lines.map(l => l.paidTo).filter(Boolean))].join(', ');
  const lines = accountIds.map(a => {
    const acc = accounts.get(a) || { id: a, name: a, type: 'bank' }, p = postings[a];
    const needsConfirm = acc.type === 'cash' && (p.amountIn > 0 || p.amountOut > 0);
    const details = [value.reference, value.viaAccountId && a === value.postingAccountId ? `by ${value.accountName}` : '', p.memoOut > 0 ? `paid by card — from ${value.viaAccountName || 'the linked bank'}` : ''].filter(Boolean).join(' · ');
    return {
      id: ledgerLineIdOf(entryId, a), entryId, voucherNo: jeNo, kind: JE_ENTRY_KIND, date: value.date, description,
      details: clean(details, 200), void: false, entryRevision: 1, schemaVersion: 1,
      recordedByUid: actor.uid, recordedByName: actor.name, recordedAt: at,
      accountId: a, accountName: clean(acc.name, 80), custodianUid: acc.custodianUid || '',
      counterpartAccountId: '', counterpartName: clean(paidTo || value.jobNo, 120), counterpartLineId: '',
      amountIn: p.amountIn, amountOut: p.amountOut, memoOut: p.memoOut, charge: 0,
      needsConfirm, status: needsConfirm ? 'pending' : 'none',
      statusByUid: '', statusByName: '', statusAt: null, statusNote: '', onBehalf: false,
      jobExpenseId: id, jobId: value.jobId, jobNo: value.jobNo,
    };
  });
  return { expense, entry, lines };
}

/* ═══════════════ the job's Estimate vs Actual (CJ_2) ═══════════════ */
/**
 * Every actual cost of a job as rows: purchase invoice job lines, job expense lines, stock issued to the job.
 *   invoices: purchaseInvoices with jobIds containing the job ; expenses: jobExpenses of the job ;
 *   allocations: stockAllocations of the job. Cancelled ones are left out.
 * → [{ source:'pi'|'je'|'stock', docId, docNo, date, costType, desc, party, amount }]
 */
export function jobCostRows(jobId, { invoices = [], expenses = [], allocations = [] } = {}) {
  const rows = [];
  invoices.forEach(pi => {
    if (!pi || pi.status === 'Voided') return;
    (pi.lines || []).forEach(l => {
      if (!l || l.kind !== 'job' || l.jobId !== jobId) return;
      rows.push({ source: 'pi', docId: pi.id, docNo: pi.piNo || '', ref: pi.supplierInvoiceNo || '', date: pi.date || '', costType: COST_TYPES.includes(l.costType) ? l.costType : 'material',
        desc: l.desc || '', qty: Number(l.qty) || 0, uom: l.uom || '', party: pi.supplierName || '', amount: r2(Number(l.landedAmount != null ? l.landedAmount : l.amount) || 0) });
    });
  });
  expenses.forEach(je => {
    if (!je || je.status === JE_STATUS.voided || je.jobId !== jobId) return;
    (je.lines || []).forEach(l => rows.push({ source: 'je', docId: je.id, docNo: je.jeNo || '', ref: l.category || '', date: je.date || '', costType: COST_TYPES.includes(l.costType) ? l.costType : 'other',
      desc: l.desc || '', qty: 0, uom: '', party: l.paidTo || je.accountName || '', amount: r2(Number(l.amount) || 0) }));
  });
  allocations.forEach(a => {
    if (!a || a.status === 'Voided' || a.jobId !== jobId) return;
    rows.push({ source: 'stock', docId: a.id, docNo: 'Stock', ref: '', date: a.date || '', costType: COST_TYPES.includes(a.costType) ? a.costType : 'material',
      desc: a.desc || '', qty: Number(a.qty) || 0, uom: a.uom || '', party: 'From stock', amount: r2(Number(a.value) || 0) });
  });
  return rows.sort((x, y) => String(y.date).localeCompare(String(x.date)) || String(y.docNo).localeCompare(String(x.docNo), undefined, { numeric: true }));
}

/**
 * Budget vs actual by cost type, with the warnings of Contracting Settings.
 *   job: { budget { material, manpower, subcontract, other, overhead, contingency, totalCost }, contractValue }
 *   settings: { warnAmberPct (90), warnRedPct (100) }
 * → { types:[{ type, label, budget, actual, usedPct, remaining, state:'ok'|'amber'|'red' }], direct{…}, overhead, contingency,
 *     actualTotal, expectedCost, expectedProfit, expectedMarginPct }
 * Expected profit = contract value − (actual + what is left of each budget); an overrun reduces it.
 */
export function jobBudgetVsActual(job = {}, rows = [], settings = {}) {
  const amber = Number.isFinite(Number(settings.warnAmberPct)) && Number(settings.warnAmberPct) > 0 ? Number(settings.warnAmberPct) : 90;
  const red = Number.isFinite(Number(settings.warnRedPct)) && Number(settings.warnRedPct) > 0 ? Number(settings.warnRedPct) : 100;
  const b = job.budget || {};
  const actualBy = {};
  rows.forEach(r => { actualBy[r.costType] = r2((actualBy[r.costType] || 0) + (Number(r.amount) || 0)); });
  const stateOf = (budget, actual) => {
    if (budget <= 0) return actual > 0 ? 'red' : 'ok';
    const p = actual / budget * 100;
    return p > red + 1e-9 ? 'red' : p >= amber - 1e-9 ? 'amber' : 'ok';
  };
  const line = (type, label, budget, actual) => ({ type, label, budget: r2(budget), actual: r2(actual),
    usedPct: budget > 0 ? Math.round(actual / budget * 1000) / 10 : (actual > 0 ? null : 0), remaining: r2(budget - actual), state: stateOf(budget, actual) });
  const types = COST_TYPES.map(t => line(t, COST_TYPE_LABELS[t], Number(b[t]) || 0, actualBy[t] || 0));
  const dB = r2(types.reduce((s, t) => s + t.budget, 0)), dA = r2(types.reduce((s, t) => s + t.actual, 0));
  const direct = line('direct', 'Direct Cost', dB, dA);
  const overhead = r2(Number(b.overhead) || 0), contingency = r2(Number(b.contingency) || 0);
  // what is still to be spent: each type's remaining budget (never below zero) + overheads + contingency
  const toCome = r2(types.reduce((s, t) => s + Math.max(0, t.remaining), 0) + overhead + contingency);
  const expectedCost = r2(dA + toCome);
  const cv = r2(Number(job.contractValue) || 0);
  const expectedProfit = r2(cv - expectedCost);
  return { types, direct, overhead, contingency, actualTotal: dA, expectedCost, expectedProfit,
    expectedMarginPct: cv > 0 ? Math.round(expectedProfit / cv * 10000) / 100 : 0, amber, red };
}
