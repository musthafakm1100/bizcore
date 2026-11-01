/**
 * BizCore V271.3 / V271.3.2 — Job Expense submissions and reimbursements (Firestore). One transaction per action:
 *   create submission: counter + jobExpenses/{JE-op} + one cashEntry per date + account + its cashLines (+ cashBalances
 *                      by the running-totals wrapper)
 *   cancel submission: the expense Voided + every entry and line void (refused while part of it is paid back)
 *   reimburse:         counter + reimbursements/{RB-op} + its cashEntry / cashLines + the submissions' reimbursed figure
 *   cancel reimbursement: Voided + entry void + the submissions owed again
 * Reads: the job / the submissions, the accounts (+ linked banks), the counter, the record itself (retry check). No listeners.
 */
import { formatSequence, nextSequence } from './numbering.mjs?v=270.25';
import {
  validateJobExpense, buildJobExpenseRecords, jobExpenseIdForOperation, JE_COLLECTION, JE_STATUS,
  validateReimbursement, buildReimbursementRecords, reimbursementIdForOperation, applyReimbursement, RB_COLLECTION,
} from './job-cost-core.mjs?v=271.32';

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
    rb: id => doc(db, RB_COLLECTION, id),
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
  const checkNumbering = n => ensure(n && isSafeId(n.counterKey) && typeof n.displayPrefix === 'string', 'invalid-input', 'Document numbering is required');
  /** The accounts used (and the banks linked to the cards among them). */
  async function readAccounts(tx, ids) {
    const map = new Map();
    for (const id of [...new Set(ids.filter(isSafeId))]) { const s = await tx.get(refs.account(id)); if (s.exists()) map.set(id, { id, ...s.data() }); }
    const linked = [...new Set([...map.values()].filter(a => a.type === 'card' && isSafeId(a.linkedBankAccountId)).map(a => a.linkedBankAccountId))].filter(id => !map.has(id));
    for (const id of linked) { const s = await tx.get(refs.account(id)); if (s.exists()) map.set(id, { id, ...s.data() }); }
    return map;
  }
  function markAccounts(tx, ids, accounts) {
    for (const a of new Set(ids)) { const acc = accounts.get(a); if (acc && !acc.hasEntries) { tx.update(refs.account(a), { hasEntries: true }); acc.hasEntries = true; } }
  }
  async function readEntries(tx, entryIds) {
    const out = [];
    for (const id of entryIds || []) {
      const es = await tx.get(refs.entry(id));
      ensure(es.exists(), 'invalid-state', 'A ledger entry of this document is missing.');
      const entry = es.data(), lines = [];
      for (const a of entry.accountIds || []) { const ls = await tx.get(refs.line(`${entry.id}__${a}`)); if (ls.exists()) lines.push(ls.data()); }
      out.push({ entry, lines });
    }
    return out;
  }
  function voidEntries(tx, list, reason, actor) {
    for (const { entry, lines } of list) {
      const er = Number(entry.revision) + 1;
      tx.set(refs.entry(entry.id), { ...entry, void: true, voidReason: reason, revision: er, updatedByUid: actor.uid, updatedByName: actor.name, updatedAt: stamp() });
      for (const l of lines) tx.update(refs.line(l.id), { void: true, voidReason: reason, entryRevision: er });
    }
  }
  const reasonOf = r => { const s = String(r || '').replace(/\s+/g, ' ').trim().slice(0, 200); ensure(s.length >= 1, 'invalid-input', 'Enter the reason for cancelling.'); return s; };

  /* ── a submission ── */
  async function createJobExpense(input = {}) {
    const { operationId, numbering } = input;
    const id = jobExpenseIdForOperation(operationId);
    ensure(id, 'invalid-input', 'Operation reference required');
    checkNumbering(numbering);
    ensure(isSafeId(input.jobId), 'invalid-input', 'Choose the job.');
    const actor = actorOf(), at = now();
    return transact(async tx => {
      const [jeSnap, jobSnap, counterSnap] = await Promise.all([tx.get(refs.je(id)), tx.get(refs.job(input.jobId)), tx.get(refs.counter(numbering.counterKey))]);
      if (jeSnap.exists()) { const ex = jeSnap.data(); ensure(ex.operationId === operationId, 'id-collision', 'Expense ID already used'); return { alreadyApplied: true, expense: ex }; }
      const accounts = await readAccounts(tx, (input.lines || []).filter(l => l && !l.own).map(l => l.accountId));
      const job = jobSnap.exists() ? { id: input.jobId, ...jobSnap.data() } : null;
      const v = validateJobExpense(input, { job, accounts, today: todayLocal() });
      if (!v.ok) fail('invalid-input', v.errors.map(e => e.message).join(' '), { errors: v.errors });
      const seq = nextSequence(counterSnap.exists() ? counterSnap.data().value : 0, numbering);
      const jeNo = formatSequence(numbering.displayPrefix, seq, numbering.digits);
      const recs = buildJobExpenseRecords({ id, jeNo, value: v.value, accounts, actor, at, stamp: stamp(), operationId, receipt: input.receipt });
      tx.set(refs.counter(numbering.counterKey), { value: seq, updatedAt: Date.now() });
      tx.set(refs.je(id), recs.expense);
      for (const e of recs.entries) tx.set(refs.entry(e.id), e);
      for (const l of recs.lines) tx.set(refs.line(l.id), l);
      markAccounts(tx, recs.entries.flatMap(e => e.accountIds), accounts);
      return { alreadyApplied: false, expense: recs.expense };
    });
  }
  async function voidJobExpense(input = {}) {
    const { expenseId } = input;
    ensure(isSafeId(expenseId), 'invalid-input', 'Expense reference required');
    const reason = reasonOf(input.reason);
    const actor = actorOf(), at = now();
    return transact(async tx => {
      const s = await tx.get(refs.je(expenseId));
      ensure(s.exists(), 'not-found', 'Job expense not found');
      const je = s.data();
      if (je.status === JE_STATUS.voided) return { alreadyApplied: true, expense: je };
      if (input.expectedRevision != null) ensure(je.revision === input.expectedRevision, 'stale', `${je.jeNo} was changed meanwhile. Please open it again.`);
      ensure(!(Number(je.reimbursed) > 0.004), 'invalid-state', `${je.jeNo}: ${Number(je.reimbursed).toFixed(2)} of it is already paid back to ${je.submittedBy} — cancel that reimbursement first.`);
      const list = await readEntries(tx, je.entryIds || (je.entryId ? [je.entryId] : []));
      // nothing is owed on a cancelled submission (it leaves the "open own money" search)
      const next = { ...je, status: JE_STATUS.voided, voidReason: reason, voidedAt: at, voidedBy: actor.name, voidedByUid: actor.uid,
        ...(je.reimburseStatus && je.reimburseStatus !== 'none' ? { reimburseStatus: 'none' } : {}),
        revision: je.revision + 1, updatedAt: at, updatedBy: actor.name, updatedByUid: actor.uid };
      tx.set(refs.je(expenseId), next);
      voidEntries(tx, list, reason, actor);
      return { alreadyApplied: false, expense: next };
    });
  }

  /* ── paying back the in-charge's own money ── */
  async function createReimbursement(input = {}) {
    const { operationId, numbering } = input;
    const id = reimbursementIdForOperation(operationId);
    ensure(id, 'invalid-input', 'Operation reference required');
    checkNumbering(numbering);
    const ids = [...new Set((input.items || []).map(i => i && i.jobExpenseId).filter(isSafeId))];
    ensure(ids.length, 'invalid-input', 'Choose what is paid back.');
    const actor = actorOf(), at = now();
    return transact(async tx => {
      const [rbSnap, counterSnap] = await Promise.all([tx.get(refs.rb(id)), tx.get(refs.counter(numbering.counterKey))]);
      if (rbSnap.exists()) { const ex = rbSnap.data(); ensure(ex.operationId === operationId, 'id-collision', 'Reimbursement ID already used'); return { alreadyApplied: true, reimbursement: ex }; }
      const expenses = new Map();
      for (const x of ids) { const s = await tx.get(refs.je(x)); if (s.exists()) expenses.set(x, { id: x, ...s.data() }); }
      const accounts = await readAccounts(tx, [input.accountId]);
      const v = validateReimbursement(input, { expenses, accounts, today: todayLocal() });
      if (!v.ok) fail('invalid-input', v.errors.map(e => e.message).join(' '), { errors: v.errors });
      const seq = nextSequence(counterSnap.exists() ? counterSnap.data().value : 0, numbering);
      const rbNo = formatSequence(numbering.displayPrefix, seq, numbering.digits);
      const recs = buildReimbursementRecords({ id, rbNo, value: v.value, accounts, actor, at, stamp: stamp(), operationId });
      tx.set(refs.counter(numbering.counterKey), { value: seq, updatedAt: Date.now() });
      tx.set(refs.rb(id), recs.reimbursement);
      tx.set(refs.entry(recs.entry.id), recs.entry);
      for (const l of recs.lines) tx.set(refs.line(l.id), l);
      markAccounts(tx, recs.entry.accountIds, accounts);
      const updated = [];
      for (const it of v.value.items) {
        const je = expenses.get(it.jobExpenseId);
        const next = { ...je, ...applyReimbursement(je, it.amount, +1), lastReimbursementOp: recs.reimbursement.lastOp, lastReimbursementId: id, revision: je.revision + 1, updatedAt: at, updatedBy: actor.name, updatedByUid: actor.uid };
        tx.set(refs.je(je.id), next); updated.push(next);
      }
      return { alreadyApplied: false, reimbursement: recs.reimbursement, expenses: updated };
    });
  }
  async function voidReimbursement(input = {}) {
    const { reimbursementId, operationId } = input;
    ensure(isSafeId(reimbursementId), 'invalid-input', 'Reimbursement reference required');
    const reason = reasonOf(input.reason);
    const actor = actorOf(), at = now();
    const lastOp = 'void-' + String(operationId || Date.now().toString(36)).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 120);
    return transact(async tx => {
      const s = await tx.get(refs.rb(reimbursementId));
      ensure(s.exists(), 'not-found', 'Reimbursement not found');
      const rb = s.data();
      if (rb.status === JE_STATUS.voided) return { alreadyApplied: true, reimbursement: rb };
      const expenses = [];
      for (const it of rb.items || []) { const es = await tx.get(refs.je(it.jobExpenseId)); if (es.exists()) expenses.push([it, { id: it.jobExpenseId, ...es.data() }]); }
      const list = await readEntries(tx, [rb.entryId]);
      const next = { ...rb, status: JE_STATUS.voided, voidReason: reason, voidedAt: at, voidedBy: actor.name, voidedByUid: actor.uid, lastOp,
        revision: rb.revision + 1, updatedAt: at, updatedBy: actor.name, updatedByUid: actor.uid };
      tx.set(refs.rb(reimbursementId), next);
      voidEntries(tx, list, reason, actor);
      const updated = [];
      for (const [it, je] of expenses) {
        const n2 = { ...je, ...applyReimbursement(je, it.amount, -1), lastReimbursementOp: lastOp, lastReimbursementId: reimbursementId, revision: je.revision + 1, updatedAt: at, updatedBy: actor.name, updatedByUid: actor.uid };
        tx.set(refs.je(je.id), n2); updated.push(n2);
      }
      return { alreadyApplied: false, reimbursement: next, expenses: updated };
    });
  }

  return { createJobExpense, voidJobExpense, createReimbursement, voidReimbursement };
}
