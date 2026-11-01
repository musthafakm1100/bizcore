/**
 * BizCore V271.3 — Contracting actual cost — and V271.3.2: a Job Expense is one SUBMISSION from the site in-charge
 * (approved mockups JE_3 – JE_6). Pure rules, no Firebase.
 *
 * jobExpenses/{JE-<op>} { id, jeNo, operationId, jobId, jobNo, company, project,
 *   date (submitted), submittedById, submittedBy, reference, note, receipt { url, path, name } | null,
 *   lines:[{ lineNo, date, categoryId, category, costType, desc, paidTo, vatInvoiceNo, supplierVat, amount, vat,
 *            payMode 'account' | 'own', accountId, accountName, accountType, viaAccountId, viaAccountName, postingAccountId }],
 *   amount (Σ cost, without VAT), vat (Σ VAT), total (Σ paid), paidFromAccounts, ownMoney (paid by the in-charge himself),
 *   reimbursed, reimburseStatus 'none' | 'open' | 'settled', lastReimbursementOp,
 *   entryIds[], status Posted | Voided, revision, voidReason…, created…, recordedAt }
 * cashEntries/jee-<op>-<n> + cashLines: one ledger entry per expense date + paying account, all with the JE number
 *   (kind 'job-expense'); cash waits for its custodian; a card is paid from its linked bank (the card line is a memo).
 * Own money is not in Cash & Bank until it is paid back: reimbursements/{RB-<op>} (kind 'staff-reimbursement').
 */
export const JE_COLLECTION = 'jobExpenses';
export const RB_COLLECTION = 'reimbursements';
export const JE_ENTRY_KIND = 'job-expense';
export const RB_ENTRY_KIND = 'staff-reimbursement';
export const JE_STATUS = Object.freeze({ posted: 'Posted', voided: 'Voided' });
export const COST_TYPES = Object.freeze(['material', 'manpower', 'subcontract', 'other']);
export const COST_TYPE_LABELS = Object.freeze({ material: 'Material', manpower: 'Manpower', subcontract: 'Subcontract', other: 'Equipment / Other' });
export const JE_LIMITS = Object.freeze({ lines: 60, groups: 20, desc: 200, paidTo: 100, note: 500, reference: 60, invoiceNo: 40, vatNo: 20, amount: 10000000, items: 20 });

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
const opKey = op => String(op || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 190);
export const jobExpenseIdForOperation = op => { const k = opKey(op); return k.length >= 8 ? 'JE-' + k : ''; };
export const reimbursementIdForOperation = op => { const k = opKey(op); return k.length >= 8 ? 'RB-' + k : ''; };
export const ledgerLineIdOf = (entryId, accountId) => `${entryId}__${accountId}`;
const CLOSED = /^(closed|cancelled)$/i;
export const reimburseStatusOf = (own, reimbursed) => (Number(own) || 0) <= 0.004 ? 'none' : r2((Number(own) || 0) - (Number(reimbursed) || 0)) <= 0.004 ? 'settled' : 'open';
export const owedOf = je => (je && je.status !== JE_STATUS.voided) ? Math.max(0, r2((Number(je.ownMoney) || 0) - (Number(je.reimbursed) || 0))) : 0;

/** The account checks shared by expenses and reimbursements → { a, via, posting, errors[] } */
function accountOf(accountId, accounts, date, where) {
  const errors = [], a = isId(accountId) ? accounts.get(accountId) : null;
  let via = null;
  if (!a) { errors.push(`${where}choose the account it was paid from.`); return { a, via, posting: null, errors }; }
  if (a.active === false) errors.push(`${where}${a.name} is inactive.`);
  if (a.type === 'card') {
    via = isId(a.linkedBankAccountId) ? accounts.get(a.linkedBankAccountId) : null;
    if (!via || via.type !== 'bank') errors.push(`${where}${a.name} has no linked bank account — set it in Administration → Payment Accounts.`);
    else if (via.active === false) errors.push(`${where}${a.name}: its bank account ${via.name} is inactive.`);
  }
  if (isDate(date)) for (const x of [a, via]) if (x && x.openingDate && date < x.openingDate) errors.push(`${where}the date is before the opening balance of ${x.name}.`);
  return { a, via, posting: via || a, errors };
}

/**
 * One submission.
 * input { jobId, date (submitted), submittedById, submittedBy, reference, note,
 *         lines:[{ date, categoryId, category, costType, desc, paidTo, own (bool), accountId, vatInvoiceNo, supplierVat, amount, vat }] }
 * ctx   { job (jobs doc), accounts: Map id → account (incl. the banks linked to cards), today }
 * → { ok, value, errors:[{field, message, line?}] }
 */
export function validateJobExpense(input = {}, { job = null, accounts = new Map(), today = new Date().toISOString().slice(0, 10) } = {}) {
  const errors = [], err = (field, message, line) => errors.push(line == null ? { field, message } : { field, message, line });
  const date = String(input.date || '').slice(0, 10);
  if (!job) err('job', 'Choose the job.');
  else if (CLOSED.test(String(job.status || ''))) err('job', `${job.jobNo || 'This job'} is ${String(job.status).toLowerCase()} — no new costs.`);
  if (!isDate(date)) err('date', 'Enter the date submitted.');
  else if (date > today) err('date', 'The date submitted can\'t be in the future.');
  const submittedBy = clean(input.submittedBy, 100);
  if (!submittedBy) err('submittedBy', 'Choose who submitted the expenses.');
  const raw = (Array.isArray(input.lines) ? input.lines : []).filter(l => l && (clean(l.desc, 10) || String(l.amount == null ? '' : l.amount).trim() !== '' || String(l.vat == null ? '' : l.vat).trim() !== ''));
  if (!raw.length) err('lines', 'Add at least one expense line.');
  if (raw.length > JE_LIMITS.lines) err('lines', `At most ${JE_LIMITS.lines} lines in one submission.`);
  const lines = raw.slice(0, JE_LIMITS.lines).map((l, i) => {
    const n = i + 1, amount = money(l.amount), vat = money(l.vat), ld = String(l.date || '').slice(0, 10), own = !!l.own;
    const line = { lineNo: n, date: ld, categoryId: clean(l.categoryId, 40), category: clean(l.category, 60), costType: COST_TYPES.includes(l.costType) ? l.costType : '',
      desc: clean(l.desc, JE_LIMITS.desc), paidTo: clean(l.paidTo, JE_LIMITS.paidTo), vatInvoiceNo: clean(l.vatInvoiceNo, JE_LIMITS.invoiceNo), supplierVat: clean(l.supplierVat, JE_LIMITS.vatNo),
      amount: Number.isFinite(amount) ? amount : 0, vat: Number.isFinite(vat) ? vat : 0, payMode: own ? 'own' : 'account',
      accountId: '', accountName: '', accountType: '', viaAccountId: '', viaAccountName: '', postingAccountId: '' };
    if (!isDate(ld)) err('lineDate', `Line ${n}: enter the expense date.`, i);
    else if (ld > today) err('lineDate', `Line ${n}: the date can't be in the future.`, i);
    else if (isDate(date) && ld > date) err('lineDate', `Line ${n}: the expense date is after the date submitted.`, i);
    if (!line.desc) err('desc', `Line ${n}: enter what it was for.`, i);
    if (!line.costType) err('costType', `Line ${n}: choose the category.`, i);
    if (!(Number.isFinite(amount) && amount > 0)) err('amount', `Line ${n}: enter the amount (up to 2 decimals).`, i);
    else if (amount > JE_LIMITS.amount) err('amount', `Line ${n}: the amount is too large.`, i);
    if (!(Number.isFinite(vat) && vat >= 0)) err('vat', `Line ${n}: VAT must be a number (up to 2 decimals).`, i);
    else if (Number.isFinite(amount) && vat > amount) err('vat', `Line ${n}: the VAT can't be more than the amount.`, i);
    else if (vat > 0 && !line.vatInvoiceNo) err('vatInvoiceNo', `Line ${n}: enter the VAT invoice no. (needed to claim the VAT).`, i);
    if (!own) {
      const x = accountOf(l.accountId, accounts, ld, `Line ${n}: `);
      x.errors.forEach(m => err('account', m, i));
      if (x.a) Object.assign(line, { accountId: x.a.id, accountName: clean(x.a.name, 80), accountType: x.a.type, viaAccountId: x.via ? x.via.id : '', viaAccountName: x.via ? clean(x.via.name, 80) : '', postingAccountId: x.posting ? x.posting.id : '' });
    }
    return line;
  });
  const amount = r2(lines.reduce((s, l) => s + l.amount, 0)), vat = r2(lines.reduce((s, l) => s + l.vat, 0));
  const ownMoney = r2(lines.filter(l => l.payMode === 'own').reduce((s, l) => s + l.amount + l.vat, 0));
  const total = r2(amount + vat);
  const groups = groupsOf(lines);
  if (groups.length > JE_LIMITS.groups) err('lines', `At most ${JE_LIMITS.groups} different date + account pairs in one submission — split it in two.`);
  const value = {
    jobId: job ? clean(job.id, 120) : '', jobNo: job ? clean(job.jobNo, 40) : '', company: job ? clean(job.company, 200) : '', project: job ? clean(job.project, 200) : '',
    date, submittedById: clean(input.submittedById, 120), submittedBy, reference: clean(input.reference, JE_LIMITS.reference), note: clean(input.note, JE_LIMITS.note),
    lines, amount, vat, total, ownMoney, paidFromAccounts: r2(total - ownMoney), reimbursed: 0, reimburseStatus: reimburseStatusOf(ownMoney, 0),
  };
  return { ok: errors.length === 0, value, errors };
}

/** Account lines grouped by expense date + paying account (+ the card) — one ledger entry each. */
export function groupsOf(lines) {
  const m = new Map();
  (lines || []).forEach(l => {
    if (l.payMode !== 'account' || !l.postingAccountId) return;
    const k = `${l.date}|${l.postingAccountId}|${l.accountId}`;
    const g = m.get(k) || { date: l.date, postingAccountId: l.postingAccountId, accountId: l.accountId, accountName: l.accountName, viaAccountId: l.viaAccountId, viaAccountName: l.viaAccountName, lines: [], total: 0 };
    g.lines.push(l); g.total = r2(g.total + l.amount + l.vat); m.set(k, g);
  });
  return [...m.values()].sort((a, b) => a.date.localeCompare(b.date) || a.postingAccountId.localeCompare(b.postingAccountId));
}

/** The records of one submission: the document, and per date + account a ledger entry with its postings. */
export function buildJobExpenseRecords({ id, jeNo, value, accounts, actor, at, stamp, operationId, receipt = null }) {
  const key = String(id).replace(/^JE-/, '');
  const groups = groupsOf(value.lines);
  const entries = [], lines = [];
  groups.forEach((g, gi) => {
    const entryId = `jee-${key}-${gi + 1}`;
    const description = clean(`Job expense · ${value.jobNo}${value.project ? ' · ' + value.project : ''} · ${value.submittedBy}`, 200);
    const postings = { [g.postingAccountId]: { amountIn: 0, amountOut: g.total, memoOut: 0 } };
    if (g.viaAccountId) postings[g.accountId] = { amountIn: 0, amountOut: 0, memoOut: g.total };
    const accountIds = Object.keys(postings);
    const byType = {};
    let vatSum = 0;
    g.lines.forEach(l => { byType[l.costType] = r2((byType[l.costType] || 0) + l.amount); vatSum = r2(vatSum + l.vat); });
    const journal = [
      ...Object.entries(byType).map(([t, amt]) => ({ accountId: '', ledger: 'job-cost-' + t, debit: amt, credit: 0 })),
      ...(vatSum > 0 ? [{ accountId: '', ledger: 'input-vat', debit: vatSum, credit: 0 }] : []),
      { accountId: g.postingAccountId, ledger: '', debit: 0, credit: g.total },
    ];
    entries.push({
      id: entryId, schemaVersion: 1, kind: JE_ENTRY_KIND, jobExpenseId: id, jobId: value.jobId, jobNo: value.jobNo,
      voucherNo: jeNo, date: g.date, amount: g.total, description, lines: journal, accountIds,
      postings: Object.fromEntries(accountIds.map(a => [a, postings[a]])),
      void: false, revision: 1, recordedByUid: actor.uid, recordedByName: actor.name, recordedAt: at,
      updatedByUid: actor.uid, updatedByName: actor.name, updatedAt: stamp,
    });
    const paidTo = [...new Set(g.lines.map(l => l.paidTo).filter(Boolean))].join(', ');
    accountIds.forEach(a => {
      const acc = accounts.get(a) || { id: a, name: a, type: 'bank' }, p = postings[a];
      const needsConfirm = acc.type === 'cash' && (p.amountIn > 0 || p.amountOut > 0);
      const details = [`${g.lines.length} receipt${g.lines.length === 1 ? '' : 's'}`, value.reference, g.viaAccountId && a === g.postingAccountId ? `by ${g.accountName}` : '', p.memoOut > 0 ? `paid by card — from ${g.viaAccountName || 'the linked bank'}` : ''].filter(Boolean).join(' · ');
      lines.push({
        id: ledgerLineIdOf(entryId, a), entryId, voucherNo: jeNo, kind: JE_ENTRY_KIND, date: g.date, description,
        details: clean(details, 200), void: false, entryRevision: 1, schemaVersion: 1,
        recordedByUid: actor.uid, recordedByName: actor.name, recordedAt: at,
        accountId: a, accountName: clean(acc.name, 80), custodianUid: acc.custodianUid || '',
        counterpartAccountId: '', counterpartName: clean(paidTo || value.jobNo, 120), counterpartLineId: '',
        amountIn: p.amountIn, amountOut: p.amountOut, memoOut: p.memoOut, charge: 0,
        needsConfirm, status: needsConfirm ? 'pending' : 'none',
        statusByUid: '', statusByName: '', statusAt: null, statusNote: '', onBehalf: false,
        jobExpenseId: id, jobId: value.jobId, jobNo: value.jobNo,
      });
    });
  });
  // the journal of the whole submission (for the chart of accounts later): own money → owed to the employee
  const byType = {};
  value.lines.forEach(l => { byType[l.costType] = r2((byType[l.costType] || 0) + l.amount); });
  const journal = [
    ...Object.entries(byType).map(([t, amt]) => ({ accountId: '', ledger: 'job-cost-' + t, debit: amt, credit: 0 })),
    ...(value.vat > 0 ? [{ accountId: '', ledger: 'input-vat', debit: value.vat, credit: 0 }] : []),
    ...groups.map(g => ({ accountId: g.postingAccountId, ledger: '', debit: 0, credit: g.total })),
    ...(value.ownMoney > 0 ? [{ accountId: '', ledger: 'employee-payable', party: value.submittedBy, debit: 0, credit: value.ownMoney }] : []),
  ];
  const expense = {
    id, schemaVersion: 2, jeNo, operationId, ...value, receipt: receipt && receipt.url ? { url: clean(receipt.url, 1000), path: clean(receipt.path, 300), name: clean(receipt.name, 120) } : null,
    entryIds: entries.map(e => e.id), lastReimbursementOp: '', status: JE_STATUS.posted, revision: 1, accounting: { lines: journal },
    created: at, createdBy: actor.name, createdByUid: actor.uid, updatedAt: at, updatedBy: actor.name, updatedByUid: actor.uid, recordedAt: stamp,
  };
  return { expense, entries, lines };
}

/* ═══════════════ paying back what the in-charge paid himself (JE_4 / JE_6) ═══════════════ */
/**
 * input { employeeId, employeeName, date, accountId, reference, note, items:[{ jobExpenseId, amount }] }
 * ctx   { expenses: Map id → jobExpenses doc, accounts: Map, today }
 */
export function validateReimbursement(input = {}, { expenses = new Map(), accounts = new Map(), today = new Date().toISOString().slice(0, 10) } = {}) {
  const errors = [], err = (field, message) => errors.push({ field, message });
  const date = String(input.date || '').slice(0, 10);
  const employeeName = clean(input.employeeName, 100);
  if (!employeeName) err('employee', 'Choose who is paid back.');
  if (!isDate(date)) err('date', 'Enter the date paid.'); else if (date > today) err('date', 'The date can\'t be in the future.');
  const x = accountOf(input.accountId, accounts, date, '');
  x.errors.forEach(m => err('account', m.charAt(0).toUpperCase() + m.slice(1)));
  const raw = (Array.isArray(input.items) ? input.items : []).filter(i => i && i.jobExpenseId && String(i.amount == null ? '' : i.amount).trim() !== '');
  if (!raw.length) err('items', 'Choose what is paid back.');
  if (raw.length > JE_LIMITS.items) err('items', `At most ${JE_LIMITS.items} submissions in one payment.`);
  const seen = new Set();
  const items = raw.slice(0, JE_LIMITS.items).map(i => {
    const je = expenses.get(i.jobExpenseId), amount = money(i.amount);
    if (!je) { err('items', 'A submission no longer exists.'); return null; }
    if (seen.has(je.id)) err('items', `${je.jeNo} is listed twice.`); seen.add(je.id);
    if (je.status === JE_STATUS.voided) err('items', `${je.jeNo} is cancelled.`);
    if (clean(input.employeeId, 120) && je.submittedById && je.submittedById !== clean(input.employeeId, 120)) err('items', `${je.jeNo} was submitted by ${je.submittedBy}.`);
    const owed = owedOf(je);
    if (!(Number.isFinite(amount) && amount > 0)) err('items', `${je.jeNo}: enter the amount paid back.`);
    else if (amount > owed + 0.004) err('items', `${je.jeNo}: only ${owed.toFixed(2)} is owed.`);
    return { jobExpenseId: je.id, jeNo: je.jeNo, jobId: je.jobId, jobNo: je.jobNo, project: clean(je.project, 200), submitted: je.date, owedBefore: owed, amount: Number.isFinite(amount) ? amount : 0 };
  }).filter(Boolean);
  const amount = r2(items.reduce((s, i) => s + i.amount, 0));
  return { ok: errors.length === 0, errors, value: {
    employeeId: clean(input.employeeId, 120), employeeName, date, reference: clean(input.reference, JE_LIMITS.reference), note: clean(input.note, JE_LIMITS.note),
    accountId: x.a ? x.a.id : '', accountName: x.a ? clean(x.a.name, 80) : '', accountType: x.a ? x.a.type : '', viaAccountId: x.via ? x.via.id : '', viaAccountName: x.via ? clean(x.via.name, 80) : '',
    postingAccountId: x.posting ? x.posting.id : '', items, amount, jobExpenseIds: items.map(i => i.jobExpenseId) } };
}
/** A submission after a reimbursement (sign +1) or its cancel (−1). */
export function applyReimbursement(je, amount, sign = 1) {
  const reimbursed = Math.max(0, r2((Number(je.reimbursed) || 0) + sign * (Number(amount) || 0)));
  return { reimbursed, reimburseStatus: reimburseStatusOf(je.ownMoney, reimbursed) };
}
export function buildReimbursementRecords({ id, rbNo, value, accounts, actor, at, stamp, operationId }) {
  const entryId = 'rbe-' + String(id).replace(/^RB-/, '');
  const description = clean(`Reimbursement to ${value.employeeName} · ${value.items.map(i => i.jeNo).join(', ')}`, 200);
  const postings = { [value.postingAccountId]: { amountIn: 0, amountOut: value.amount, memoOut: 0 } };
  if (value.viaAccountId) postings[value.accountId] = { amountIn: 0, amountOut: 0, memoOut: value.amount };
  const accountIds = Object.keys(postings);
  const journal = [{ accountId: '', ledger: 'employee-payable', party: value.employeeName, debit: value.amount, credit: 0 }, { accountId: value.postingAccountId, ledger: '', debit: 0, credit: value.amount }];
  const rb = { id, schemaVersion: 1, rbNo, operationId, ...value, entryId, lastOp: 'create-' + operationId, status: JE_STATUS.posted, revision: 1, accounting: { lines: journal },
    created: at, createdBy: actor.name, createdByUid: actor.uid, updatedAt: at, updatedBy: actor.name, updatedByUid: actor.uid, recordedAt: stamp };
  const entry = { id: entryId, schemaVersion: 1, kind: RB_ENTRY_KIND, reimbursementId: id, voucherNo: rbNo, date: value.date, amount: value.amount, description, lines: journal, accountIds,
    postings: Object.fromEntries(accountIds.map(a => [a, postings[a]])), void: false, revision: 1,
    recordedByUid: actor.uid, recordedByName: actor.name, recordedAt: at, updatedByUid: actor.uid, updatedByName: actor.name, updatedAt: stamp };
  const lines = accountIds.map(a => {
    const acc = accounts.get(a) || { id: a, name: a, type: 'bank' }, p = postings[a];
    const needsConfirm = acc.type === 'cash' && (p.amountIn > 0 || p.amountOut > 0);
    return { id: ledgerLineIdOf(entryId, a), entryId, voucherNo: rbNo, kind: RB_ENTRY_KIND, date: value.date, description,
      details: clean([value.reference, value.viaAccountId && a === value.postingAccountId ? `by ${value.accountName}` : '', p.memoOut > 0 ? `paid by card — from ${value.viaAccountName || 'the linked bank'}` : ''].filter(Boolean).join(' · '), 200),
      void: false, entryRevision: 1, schemaVersion: 1, recordedByUid: actor.uid, recordedByName: actor.name, recordedAt: at,
      accountId: a, accountName: clean(acc.name, 80), custodianUid: acc.custodianUid || '', counterpartAccountId: '', counterpartName: value.employeeName, counterpartLineId: '',
      amountIn: p.amountIn, amountOut: p.amountOut, memoOut: p.memoOut, charge: 0, needsConfirm, status: needsConfirm ? 'pending' : 'none',
      statusByUid: '', statusByName: '', statusAt: null, statusNote: '', onBehalf: false, reimbursementId: id };
  });
  return { reimbursement: rb, entry, lines };
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
    (je.lines || []).forEach(l => rows.push({ source: 'je', docId: je.id, docNo: je.jeNo || '', ref: l.category || '', date: l.date || je.date || '', costType: COST_TYPES.includes(l.costType) ? l.costType : 'other',
      desc: l.desc || '', qty: 0, uom: '', party: l.paidTo || (l.payMode === 'own' ? 'Own money · ' + (je.submittedBy || '') : l.accountName || je.accountName || ''), amount: r2(Number(l.amount) || 0) }));
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
