/**
 * BizCore V271.3 — Job Expense service (Firestore). One transaction per action:
 *   create: number counter + jobExpenses/{JE-op} + cashEntries/jee-op + cashLines (+ cashBalances by the wrapper)
 *   cancel: the expense Voided + the entry and its lines void (the balances move back)
 * Reads: the job, the account (+ its linked bank for a card), the counter, the expense (retry check). No listeners.
 */
import { formatSequence, nextSequence } from './numbering.mjs?v=270.25';
import { validateJobExpense, buildJobExpenseRecords, jobExpenseIdForOperation, JE_COLLECTION, JE_STATUS } from './job-cost-core.mjs?v=271.3';

export class JobCostError extends Error { constructor(code, message, extra = {}) { super(message); this.code = code; Object.assign(this, extra); } }
const fail = (code, message, extra) => { throw new JobCostError(code, message, extra); };
const ensure = (c, code, message) => { if (!c) fail(code, message); };
const isSafeId = s => typeof s === 'string' && /^[A-Za-z0-9_.-]{1,240}$/.test(s);

export function createJobCostService(fs, options = {}) {
  const { db, doc, runTransaction } = fs || {};
  ensure(db && typeof doc === 'function' && typeof runTransaction === 'function', 'invalid-input', 'Firestore transaction API required');
  const stamp = () => (typeof fs.serverTimestamp === 'function' ? fs.serverTimestamp() : new Date().toISOString());
  const now = options.now || (() => new Date().toISOString());
  const todayLocal = () => { if (options.today) return options.today(); const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const actorOf = () => { const a = (options.actor && options.actor()) || {}; ensure(isSafeId(a.uid), 'invalid-state', 'You must be signed in'); return { uid: a.uid, name: String(a.name || a.email || a.uid).slice(0, 200) }; };
  const refs = {
    je: id => doc(db, JE_COLLECTION, id),
    job: id => doc(db, 'jobs', id),
    account: id => doc(db, 'paymentAccounts', id),
    counter: k => doc(db, 'counters', k),
    entry: id => doc(db, 'cashEntries', id),
    line: id => doc(db, 'cashLines', id),
  };
  const CONTENTION = new Set(['aborted', 'failed-precondition']);
  async function transact(fn) {
    for (let attempt = 1; ; attempt++) {
      try { return await runTransaction(db, fn); }
      catch (e) { if (attempt < 4 && CONTENTION.has(e && e.code)) { await new Promise(r => setTimeout(r, 60 * attempt + Math.floor(Math.random() * 120))); continue; } throw e; }
    }
  }

  async function createJobExpense(input = {}) {
    const { operationId, numbering } = input;
    const id = jobExpenseIdForOperation(operationId);
    ensure(id, 'invalid-input', 'Operation reference required');
    ensure(numbering && isSafeId(numbering.counterKey) && typeof numbering.displayPrefix === 'string', 'invalid-input', 'Document numbering is required');
    ensure(isSafeId(input.jobId), 'invalid-input', 'Choose the job.');
    const actor = actorOf(), at = now();
    return transact(async tx => {
      const [jeSnap, jobSnap, counterSnap] = await Promise.all([tx.get(refs.je(id)), tx.get(refs.job(input.jobId)), tx.get(refs.counter(numbering.counterKey))]);
      if (jeSnap.exists()) { const ex = jeSnap.data(); ensure(ex.operationId === operationId, 'id-collision', 'Expense ID already used'); return { alreadyApplied: true, expense: ex }; }
      const accounts = new Map();
      if (isSafeId(input.accountId)) {
        const s = await tx.get(refs.account(input.accountId));
        if (s.exists()) {
          const a = { id: input.accountId, ...s.data() }; accounts.set(a.id, a);
          if (a.type === 'card' && isSafeId(a.linkedBankAccountId)) { const b = await tx.get(refs.account(a.linkedBankAccountId)); if (b.exists()) accounts.set(a.linkedBankAccountId, { id: a.linkedBankAccountId, ...b.data() }); }
        }
      }
      const job = jobSnap.exists() ? { id: input.jobId, ...jobSnap.data() } : null;
      const v = validateJobExpense(input, { job, accounts, today: todayLocal() });
      if (!v.ok) fail('invalid-input', v.errors.map(e => e.message).join(' '), { errors: v.errors });
      const seq = nextSequence(counterSnap.exists() ? counterSnap.data().value : 0, numbering);
      const jeNo = formatSequence(numbering.displayPrefix, seq, numbering.digits);
      const recs = buildJobExpenseRecords({ id, jeNo, value: v.value, accounts, actor, at, stamp: stamp(), operationId, receipt: input.receipt });
      tx.set(refs.counter(numbering.counterKey), { value: seq, updatedAt: Date.now() });
      tx.set(refs.je(id), recs.expense);
      tx.set(refs.entry(recs.entry.id), recs.entry);
      for (const l of recs.lines) tx.set(refs.line(l.id), l);
      for (const a of recs.entry.accountIds) { const acc = accounts.get(a); if (acc && !acc.hasEntries) tx.update(refs.account(a), { hasEntries: true }); }
      return { alreadyApplied: false, expense: recs.expense };
    });
  }

  async function voidJobExpense(input = {}) {
    const { expenseId } = input;
    ensure(isSafeId(expenseId), 'invalid-input', 'Expense reference required');
    const reason = String(input.reason || '').replace(/\s+/g, ' ').trim().slice(0, 200);
    ensure(reason.length >= 1, 'invalid-input', 'Enter the reason for cancelling.');
    const actor = actorOf(), at = now();
    return transact(async tx => {
      const s = await tx.get(refs.je(expenseId));
      ensure(s.exists(), 'not-found', 'Job expense not found');
      const je = s.data();
      if (je.status === JE_STATUS.voided) return { alreadyApplied: true, expense: je };
      if (input.expectedRevision != null) ensure(je.revision === input.expectedRevision, 'stale', `${je.jeNo} was changed meanwhile. Please open it again.`);
      const es = await tx.get(refs.entry(je.entryId));
      ensure(es.exists(), 'invalid-state', 'The ledger entry of this expense is missing.');
      const entry = es.data(), lines = [];
      for (const a of entry.accountIds || []) { const ls = await tx.get(refs.line(`${entry.id}__${a}`)); if (ls.exists()) lines.push(ls.data()); }
      const next = { ...je, status: JE_STATUS.voided, voidReason: reason, voidedAt: at, voidedBy: actor.name, voidedByUid: actor.uid,
        revision: je.revision + 1, updatedAt: at, updatedBy: actor.name, updatedByUid: actor.uid };
      tx.set(refs.je(expenseId), next);
      const er = Number(entry.revision) + 1;
      tx.set(refs.entry(entry.id), { ...entry, void: true, voidReason: reason, revision: er, updatedByUid: actor.uid, updatedByName: actor.name, updatedAt: stamp() });
      for (const l of lines) tx.update(refs.line(l.id), { void: true, voidReason: reason, entryRevision: er });
      return { alreadyApplied: false, expense: next };
    });
  }

  return { createJobExpense, voidJobExpense };
}
