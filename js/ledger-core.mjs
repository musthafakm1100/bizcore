/**
 * BizCore V267.2 — Cash ledger with custodian confirmation, pure rules.
 *
 * Accounting shape (approved 15 Oct 2026, ready for the future chart of accounts):
 *   cashEntries/{entryId}   one balanced entry (a "journal"): lines [{accountId, debit, credit}], Σdebit = Σcredit
 *   cashLines/{entryId}__{accountId}   the posting of that entry on ONE payment account — this is what a
 *                           custodian sees and confirms. amountIn = debit, amountOut = credit.
 * The opening balance is not a posting: it is shown as the first ledger row from the account itself
 * (set by an administrator, already agreed). The chart-of-accounts step will post it as a journal.
 *
 * Confirmation never holds an entry back: the entry counts in the balance at once; the custodian's line
 * is just ⏳ until confirmed (✓) or queried (⚠, with a note — the office sees it).
 *   status 'pending' | 'confirmed' | 'queried'  for lines that need the custodian (needsConfirm)
 *   status 'none'                              for lines that don't (e.g. the giver's side of a handover:
 *                                              only the receiver confirms; the giver's line mirrors that
 *                                              in counterpartStatus).
 * An edit of the amount or date sends a confirmed / queried line back to ⏳.
 */
export const LEDGER_SCHEMA_VERSION = 1;
export const LEDGER_COLLECTIONS = Object.freeze({
  entries: 'cashEntries', lines: 'cashLines', custodians: 'cashCustodians', directory: 'userDirectory',
});
export const ENTRY_KINDS = Object.freeze(['handover']);
export const LINE_STATUS = Object.freeze({ PENDING: 'pending', CONFIRMED: 'confirmed', QUERIED: 'queried', NONE: 'none' });
export const LEDGER_LIMITS = Object.freeze({ description: 200, note: 200, amount: 1e9 });

const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
export const r2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));

export const lineIdOf = (entryId, accountId) => `${entryId}__${accountId}`;

/** Handover vouchers: TRF-YYMM-0001, own monthly counter (not configurable — custodians have no settings access). */
export function handoverNumbering(date) {
  const d = String(date || '');
  // counter key carries YYYYMM (the security rules rebuild it from the date); the voucher shows YYMM
  return { counterKey: 'doc_cashTransfer_' + d.slice(0, 4) + d.slice(5, 7), displayPrefix: 'TRF-' + d.slice(2, 4) + d.slice(5, 7) + '-' };
}
export const formatVoucher = (prefix, n) => prefix + String(n).padStart(4, '0');

export function parseAmount(v) {
  const raw = String(v == null ? '' : v).replace(/[,\s]/g, '');
  if (raw === '' || !/^\d+(\.\d{1,2})?$/.test(raw)) return NaN;
  return r2(Number(raw));
}

/**
 * Check a handover (cash given by one custodian to another). `from` / `to` are the stored accounts.
 * Returns { ok, value, errors:[{field, message}] }.
 */
export function validateHandover(input = {}, { from = null, to = null, today = new Date().toISOString().slice(0, 10) } = {}) {
  const errors = [], err = (field, message) => errors.push({ field, message });
  const date = String(input.date || '').slice(0, 10);
  const amount = parseAmount(input.amount);
  const description = clean(input.description, LEDGER_LIMITS.description);
  if (!from) err('fromAccountId', 'Choose who gives the cash.');
  if (!to) err('toAccountId', 'Choose who receives the cash.');
  if (from && to && from.id === to.id) err('toAccountId', 'Giver and receiver must be different accounts.');
  if (from && from.type !== 'cash') err('fromAccountId', 'A handover is from a cash account.');
  if (to && to.type !== 'cash') err('toAccountId', 'A handover is to a cash account.');
  if (from && from.active === false) err('fromAccountId', `${from.name} is inactive.`);
  if (to && to.active === false) err('toAccountId', `${to.name} is inactive.`);
  if (!isDate(date)) err('date', 'Enter the date.');
  else {
    if (date > today) err('date', 'The date can\'t be in the future.');
    for (const a of [from, to]) if (a && a.openingDate && date < a.openingDate) err('date', `The date is before the opening balance of ${a.name} (${a.openingDate}).`);
  }
  if (!Number.isFinite(amount) || amount <= 0) err('amount', 'Enter an amount greater than zero (up to 2 decimals).');
  else if (amount > LEDGER_LIMITS.amount) err('amount', 'The amount is too large.');
  return { ok: errors.length === 0, value: { date, amount, description, fromAccountId: from?.id || '', toAccountId: to?.id || '' }, errors };
}

/** The balanced entry and its two postings for a handover. */
export function buildHandover({ id, voucherNo, value, from, to, actor, at, stamp }) {
  const amount = value.amount;
  const entry = {
    id, schemaVersion: LEDGER_SCHEMA_VERSION, kind: 'handover', voucherNo, date: value.date, amount,
    description: value.description,
    lines: [{ accountId: to.id, debit: amount, credit: 0 }, { accountId: from.id, debit: 0, credit: amount }],
    accountIds: [to.id, from.id],
    fromAccountId: from.id, toAccountId: to.id,
    void: false, revision: 1,
    recordedByUid: actor.uid, recordedByName: actor.name, recordedAt: at,
    updatedByUid: actor.uid, updatedByName: actor.name, updatedAt: stamp,
  };
  const base = {
    entryId: id, voucherNo, kind: 'handover', date: value.date, description: value.description,
    void: false, entryRevision: 1, schemaVersion: LEDGER_SCHEMA_VERSION,
    recordedByUid: actor.uid, recordedByName: actor.name, recordedAt: at,
  };
  const inLine = {
    ...base, id: lineIdOf(id, to.id), accountId: to.id, accountName: to.name, custodianUid: to.custodianUid || '',
    counterpartAccountId: from.id, counterpartName: from.name, counterpartLineId: lineIdOf(id, from.id),
    amountIn: amount, amountOut: 0, needsConfirm: true, status: LINE_STATUS.PENDING,
    statusByUid: '', statusByName: '', statusAt: null, statusNote: '', onBehalf: false,
  };
  const outLine = {
    ...base, id: lineIdOf(id, from.id), accountId: from.id, accountName: from.name, custodianUid: from.custodianUid || '',
    counterpartAccountId: to.id, counterpartName: to.name, counterpartLineId: lineIdOf(id, to.id),
    amountIn: 0, amountOut: amount, needsConfirm: false, status: LINE_STATUS.NONE,
    statusByUid: '', statusByName: '', statusAt: null, statusNote: '', onBehalf: false,
    counterpartStatus: LINE_STATUS.PENDING, counterpartStatusByName: '', counterpartStatusAt: null, counterpartStatusNote: '',
  };
  return { entry, lines: [inLine, outLine] };
}

/** Is the entry balanced? (Σdebit = Σcredit, every line one-sided, positive) */
export function isBalanced(entry) {
  const lines = entry?.lines || [];
  if (lines.length < 2) return false;
  let d = 0, c = 0;
  for (const l of lines) {
    const dr = Number(l.debit) || 0, cr = Number(l.credit) || 0;
    if (dr < 0 || cr < 0 || (dr > 0) === (cr > 0)) return false;
    d += dr; c += cr;
  }
  return r2(d) === r2(c) && d > 0;
}

/** Who may confirm / query this line: its custodian; an administrator only when the custodian has no login. */
export function confirmRight(line, { uid, isAdmin = false } = {}) {
  if (!line || !line.needsConfirm || line.void) return null;
  if (line.custodianUid && line.custodianUid === uid) return { onBehalf: false };
  if (!line.custodianUid && isAdmin) return { onBehalf: true };
  return null;
}

export function validateQueryNote(note) {
  const v = clean(note, LEDGER_LIMITS.note);
  return v ? { ok: true, value: v } : { ok: false, value: v, message: 'Say what is wrong (for example: not received).' };
}

const ms = v => (v && typeof v === 'object' && typeof v.toMillis === 'function') ? v.toMillis()
  : (v && typeof v === 'object' && 'seconds' in v) ? v.seconds * 1000 : (Date.parse(v) || 0);

/**
 * The ledger of one account: opening row + its postings oldest → newest with a running balance.
 * Void lines are listed (struck through) but don't count.
 */
export function buildLedger(account, lines) {
  const opening = r2(account?.openingBalance || 0);
  const mine = (lines || []).filter(l => l.accountId === account?.id)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || ms(a.recordedAt) - ms(b.recordedAt) || String(a.id).localeCompare(String(b.id)));
  let bal = opening, confirmed = opening;
  const t = { waiting: 0, waitingIn: 0, waitingOut: 0, queried: 0, queriedAmount: 0 };
  const rows = mine.map(l => {
    if (l.void) return { ...l, balance: null };
    const net = r2((Number(l.amountIn) || 0) - (Number(l.amountOut) || 0));
    bal = r2(bal + net);
    if (l.status === LINE_STATUS.CONFIRMED || l.status === LINE_STATUS.NONE) confirmed = r2(confirmed + net);
    if (l.status === LINE_STATUS.PENDING) { t.waiting++; t.waitingIn = r2(t.waitingIn + (Number(l.amountIn) || 0)); t.waitingOut = r2(t.waitingOut + (Number(l.amountOut) || 0)); }
    if (l.status === LINE_STATUS.QUERIED) { t.queried++; t.queriedAmount = r2(t.queriedAmount + Math.abs(net)); }
    return { ...l, balance: bal };
  });
  return {
    opening: { date: account?.openingDate || '', amount: opening, setBy: account?.createdByName || '' },
    rows, balance: bal, confirmedBalance: confirmed, ...t,
  };
}

/** Lines that the given user may confirm right now (for "Confirm all"). */
export function confirmableLines(lines, who) {
  return (lines || []).filter(l => l.status === LINE_STATUS.PENDING && confirmRight(l, who));
}

/** Directory entry (every login registers itself) — used to link an account custodian to a login. */
export function directoryEntry({ uid, email, name }) {
  return { uid, email: clean(email, 200).toLowerCase(), name: clean(name, 120) || clean(email, 200).split('@')[0] };
}

/** New cash custodian login — form check (the Auth account itself is created by the browser). */
export function validateCustodianLogin(input = {}) {
  const errors = [], err = (field, message) => errors.push({ field, message });
  const name = clean(input.name, 120), email = clean(input.email, 200).toLowerCase(), password = String(input.password || '');
  const accountIds = [...new Set((input.accountIds || []).filter(x => typeof x === 'string' && x))];
  if (!name) err('name', 'Enter the full name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) err('email', 'Enter a valid email address.');
  if (password.length < 8) err('password', 'The temporary password needs at least 8 characters.');
  if (!accountIds.length) err('accountIds', 'Choose at least one cash account.');
  return { ok: errors.length === 0, value: { name, email, password, accountIds, mustChangePassword: input.mustChangePassword !== false }, errors };
}
