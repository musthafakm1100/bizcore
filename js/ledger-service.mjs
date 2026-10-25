/**
 * BizCore V267.2 — Cash ledger transaction service.
 *
 *   recordHandover   ONE transaction: voucher number (counter) + balanced entry + the two postings
 *                    (+ marks both accounts hasEntries). Staff, or the giving custodian from My Cash.
 *   editHandover     staff: amount / date / note; an amount or date change sends the receiver's line back to ⏳.
 *   voidHandover     staff: the entry and its lines stay, marked void (not counted).
 *   confirmLine / queryLine   the line's custodian (an administrator only for a custodian without a login).
 *   registerSelf     every login records itself in userDirectory (to link custodians to logins).
 *   saveCustodian / setCustodianActive   administrators: the cash-only login record (cashCustodians/{uid}).
 *   relinkLines      administrators: after linking an account to a login, its existing lines follow.
 * The security rules enforce the same limits (firestore.rules → "Cash ledger (V267.2)").
 */
import {
  LEDGER_COLLECTIONS as C, LEDGER_SCHEMA_VERSION, LINE_STATUS, validateHandover, buildHandover,
  handoverNumbering, formatVoucher, confirmRight, validateQueryNote, directoryEntry, lineIdOf, r2,
} from './ledger-core.mjs?v=269.3';
import { DeliveryError, ERR, isSafeId, operationKey } from './delivery-core.mjs?v=266.0';

const fail = (code, message, details) => { throw new DeliveryError(code, message, details); };
const ensure = (ok, code, message, details) => { if (!ok) fail(code, message, details); };
export const LEDGER_ERR = Object.freeze({ NOT_ALLOWED: 'not-allowed', NOT_ADMIN: 'not-admin', CASH_ONLY: 'cash-only' });

export function createLedgerService(fs, options = {}) {
  const { db, doc, runTransaction } = fs || {};
  ensure(db && typeof doc === 'function' && typeof runTransaction === 'function', ERR.INVALID_INPUT, 'Firestore transaction API required');
  const serverTimestamp = typeof fs.serverTimestamp === 'function' ? fs.serverTimestamp : null;
  const stamp = () => (serverTimestamp ? serverTimestamp() : new Date().toISOString());
  const now = options.now || (() => new Date().toISOString());
  const today = options.today || (() => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); });
  const actorOf = () => {
    const a = (options.actor && options.actor()) || {};
    ensure(isSafeId(a.uid), ERR.INVALID_STATE, 'You must be signed in');
    return { uid: a.uid, name: String(a.name || a.email || a.uid).slice(0, 200), email: String(a.email || '') };
  };
  const refs = {
    access: () => doc(db, 'system', 'accessControl'),
    account: id => doc(db, 'paymentAccounts', id),
    entry: id => doc(db, C.entries, id),
    line: id => doc(db, C.lines, id),
    custodian: uid => doc(db, C.custodians, uid),
    directory: uid => doc(db, C.directory, uid),
    counter: key => doc(db, 'counters', key),
  };
  /** Reads (inside a transaction) who the actor is: administrator? cash-only custodian login? */
  async function roleIn(tx, uid) {
    const access = await tx.get(refs.access());
    const cust = await tx.get(refs.custodian(uid));
    const admins = access.exists() ? (access.data().adminUids || []) : [];
    // V270.4.1: an active user with the Administrator role is an administrator too
    const u = await tx.get(doc(db, 'users', uid));
    const ud = u.exists() ? u.data() : null;
    const roleAdmin = !!(ud && ud.active !== false && ud.companyRoles && ud.companyRoles.default === 'administrator');
    return { isAdmin: admins.includes(uid) || roleAdmin, cashOnly: cust.exists(), active: cust.exists() ? cust.data().active !== false : true };
  }
  const staffOnly = role => ensure(!role.cashOnly, LEDGER_ERR.CASH_ONLY, 'Only office staff can do this.');
  const accountOf = async (tx, id, label) => {
    ensure(isSafeId(id), ERR.INVALID_INPUT, `Choose ${label}.`, { field: label });
    const s = await tx.get(refs.account(id));
    ensure(s.exists(), ERR.NOT_FOUND, 'That account no longer exists.');
    return s.data();
  };

  /* ───────── handovers ───────── */
  async function recordHandover(input = {}) {
    const actor = actorOf();
    const entryId = 'trf-' + operationKey(input.operationId);
    return runTransaction(db, async tx => {
      const role = await roleIn(tx, actor.uid);
      ensure(role.active, LEDGER_ERR.NOT_ALLOWED, 'This login is not active.');
      const from = await accountOf(tx, input.fromAccountId, 'fromAccountId');
      const to = await accountOf(tx, input.toAccountId, 'toAccountId');
      const existing = await tx.get(refs.entry(entryId));
      if (existing.exists()) return { entry: existing.data(), duplicate: true }; // retried save — already recorded
      if (role.cashOnly) ensure(from.custodianUid === actor.uid, LEDGER_ERR.NOT_ALLOWED, 'You can only hand over cash from your own account.');
      const v = validateHandover(input, { from, to, today: today() });
      if (!v.ok) fail(ERR.INVALID_INPUT, v.errors.map(e => e.message).join(' '), { errors: v.errors });
      const num = handoverNumbering(v.value.date);
      const counter = await tx.get(refs.counter(num.counterKey));
      const seq = (Number(counter.exists() ? counter.data().value : 0) || 0) + 1;
      const voucherNo = formatVoucher(num.displayPrefix, seq);
      const { entry, lines } = buildHandover({ id: entryId, voucherNo, value: v.value, from, to, actor, at: now(), stamp: stamp() });
      tx.set(refs.counter(num.counterKey), { value: seq, updatedAt: Date.now() });
      tx.set(refs.entry(entryId), entry);
      for (const l of lines) tx.set(refs.line(l.id), l);
      for (const a of [from, to]) if (!a.hasEntries) tx.update(refs.account(a.id), { hasEntries: true });
      return { entry, lines };
    });
  }

  async function loadHandover(tx, entryId, expectedRevision) {
    ensure(isSafeId(entryId), ERR.INVALID_INPUT, 'Invalid entry');
    const s = await tx.get(refs.entry(entryId));
    ensure(s.exists(), ERR.NOT_FOUND, 'This entry no longer exists.');
    const entry = s.data();
    ensure(entry.kind === 'handover', ERR.INVALID_STATE, 'Only handovers are edited here.');
    ensure(!entry.void, ERR.INVALID_STATE, 'This handover is cancelled.');
    if (expectedRevision != null) ensure(Number(entry.revision) === Number(expectedRevision), ERR.STALE_REVISION, 'Someone else changed this entry. Close and open it again.');
    const inS = await tx.get(refs.line(lineIdOf(entryId, entry.toAccountId)));
    const outS = await tx.get(refs.line(lineIdOf(entryId, entry.fromAccountId)));
    ensure(inS.exists() && outS.exists(), ERR.INCONSISTENT, 'The entry lines are missing.');
    return { entry, inLine: inS.data(), outLine: outS.data() };
  }

  async function editHandover(entryId, input = {}, { expectedRevision = null } = {}) {
    const actor = actorOf();
    return runTransaction(db, async tx => {
      const role = await roleIn(tx, actor.uid); staffOnly(role);
      const { entry, inLine, outLine } = await loadHandover(tx, entryId, expectedRevision);
      const from = await accountOf(tx, entry.fromAccountId, 'fromAccountId');
      const to = await accountOf(tx, entry.toAccountId, 'toAccountId');
      // accounts are fixed — to change who gave / received, cancel and record a new handover
      const v = validateHandover({ ...input, fromAccountId: from.id, toAccountId: to.id }, { from: { ...from, active: true }, to: { ...to, active: true }, today: today() });
      if (!v.ok) fail(ERR.INVALID_INPUT, v.errors.map(e => e.message).join(' '), { errors: v.errors });
      const reconfirm = r2(v.value.amount) !== r2(entry.amount) || v.value.date !== entry.date;
      const revision = Number(entry.revision) + 1;
      tx.set(refs.entry(entryId), {
        ...entry, date: v.value.date, amount: v.value.amount, description: v.value.description,
        lines: [{ accountId: to.id, debit: v.value.amount, credit: 0 }, { accountId: from.id, debit: 0, credit: v.value.amount }],
        revision, updatedByUid: actor.uid, updatedByName: actor.name, updatedAt: stamp(),
      });
      const common = { date: v.value.date, description: v.value.description, entryRevision: revision };
      const inUpd = { ...common, amountIn: v.value.amount };
      const outUpd = { ...common, amountOut: v.value.amount };
      if (reconfirm && inLine.status !== LINE_STATUS.PENDING) {
        Object.assign(inUpd, { status: LINE_STATUS.PENDING, statusByUid: '', statusByName: '', statusAt: null, onBehalf: false });
        Object.assign(outUpd, { counterpartStatus: LINE_STATUS.PENDING, counterpartStatusByName: '', counterpartStatusAt: null });
      }
      tx.update(refs.line(inLine.id), inUpd);
      tx.update(refs.line(outLine.id), outUpd);
      return { revision, reconfirm };
    });
  }

  async function voidHandover(entryId, reason, { expectedRevision = null } = {}) {
    const actor = actorOf();
    const why = String(reason || '').replace(/\s+/g, ' ').trim().slice(0, 200);
    ensure(why, ERR.INVALID_INPUT, 'Enter the reason for cancelling.');
    return runTransaction(db, async tx => {
      const role = await roleIn(tx, actor.uid); staffOnly(role);
      const { entry, inLine, outLine } = await loadHandover(tx, entryId, expectedRevision);
      const revision = Number(entry.revision) + 1;
      tx.set(refs.entry(entryId), { ...entry, void: true, voidReason: why, revision, updatedByUid: actor.uid, updatedByName: actor.name, updatedAt: stamp() });
      for (const l of [inLine, outLine]) tx.update(refs.line(l.id), { void: true, voidReason: why, entryRevision: revision });
      return { revision };
    });
  }

  /* ───────── confirmation ───────── */
  async function setLineStatus(lineId, status, note) {
    const actor = actorOf();
    ensure(isSafeId(lineId), ERR.INVALID_INPUT, 'Invalid line');
    return runTransaction(db, async tx => {
      const role = await roleIn(tx, actor.uid);
      ensure(role.active, LEDGER_ERR.NOT_ALLOWED, 'This login is not active.');
      const s = await tx.get(refs.line(lineId));
      ensure(s.exists(), ERR.NOT_FOUND, 'This line no longer exists.');
      const line = s.data();
      const right = confirmRight(line, { uid: actor.uid, isAdmin: role.isAdmin && !role.cashOnly });
      ensure(right, LEDGER_ERR.NOT_ALLOWED, line.void ? 'This entry was cancelled.' : 'Only the custodian of this account can confirm it.');
      if (line.status === status && status === LINE_STATUS.CONFIRMED) return { line, unchanged: true };
      const at = stamp();
      const upd = { status, statusByUid: actor.uid, statusByName: actor.name, statusAt: at, statusNote: note || '', onBehalf: right.onBehalf };
      tx.update(refs.line(lineId), upd);
      // the other side of a handover (the giver's line, which needs no confirmation) shows the receiver's answer
      if (line.kind === 'handover' && line.counterpartLineId)
        tx.update(refs.line(line.counterpartLineId), { counterpartStatus: status, counterpartStatusByName: actor.name, counterpartStatusAt: at, counterpartStatusNote: note || '' });
      return { line: { ...line, ...upd } };
    });
  }
  const confirmLine = lineId => setLineStatus(lineId, LINE_STATUS.CONFIRMED, '');
  function queryLine(lineId, note) {
    const n = validateQueryNote(note);
    if (!n.ok) return Promise.reject(new DeliveryError(ERR.INVALID_INPUT, n.message, { field: 'note' }));
    return setLineStatus(lineId, LINE_STATUS.QUERIED, n.value);
  }
  /** Confirm several lines (one transaction each, so one refused line doesn't stop the rest). */
  async function confirmLines(lineIds) {
    const done = [], failed = [];
    for (const id of lineIds || []) {
      try { await confirmLine(id); done.push(id); } catch (e) { failed.push({ id, code: e.code, message: e.message }); }
    }
    return { done, failed };
  }

  /* ───────── logins ───────── */
  async function registerSelf() {
    const actor = actorOf();
    if (typeof fs.setDoc !== 'function') return null;
    const e = directoryEntry({ uid: actor.uid, email: actor.email, name: actor.name });
    await fs.setDoc(refs.directory(actor.uid), { ...e, lastSeenAt: stamp() }, { merge: true });
    return e;
  }

  async function saveCustodian({ uid, name, email, accountIds = [], mustChangePassword = true }) {
    const actor = actorOf();
    ensure(isSafeId(uid), ERR.INVALID_INPUT, 'Invalid login');
    return runTransaction(db, async tx => {
      const role = await roleIn(tx, actor.uid);
      ensure(role.isAdmin && !role.cashOnly, LEDGER_ERR.NOT_ADMIN, 'Only administrators can create custodian logins.');
      const s = await tx.get(refs.custodian(uid));
      const prev = s.exists() ? s.data() : null;
      const rec = {
        uid, name: String(name || '').slice(0, 120), email: String(email || '').toLowerCase().slice(0, 200),
        accountIds: [...new Set(accountIds)].slice(0, 20), active: prev ? prev.active !== false : true,
        mustChangePassword: !!mustChangePassword, schemaVersion: LEDGER_SCHEMA_VERSION,
        createdByUid: prev ? prev.createdByUid : actor.uid, createdByName: prev ? prev.createdByName : actor.name,
        createdAt: prev ? prev.createdAt : now(), updatedByUid: actor.uid, updatedAt: stamp(),
      };
      tx.set(refs.custodian(uid), rec);
      return rec;
    });
  }
  async function setCustodianActive(uid, active) {
    const actor = actorOf();
    return runTransaction(db, async tx => {
      const role = await roleIn(tx, actor.uid);
      ensure(role.isAdmin && !role.cashOnly, LEDGER_ERR.NOT_ADMIN, 'Only administrators can change custodian logins.');
      const s = await tx.get(refs.custodian(uid));
      ensure(s.exists(), ERR.NOT_FOUND, 'This login no longer exists.');
      tx.update(refs.custodian(uid), { active: !!active, updatedByUid: actor.uid, updatedAt: stamp() });
      return { uid, active: !!active };
    });
  }
  /** The custodian changed the temporary password (called by My Cash after updatePassword). */
  async function markPasswordChanged() {
    const actor = actorOf();
    if (typeof fs.updateDoc !== 'function') return;
    await fs.updateDoc(refs.custodian(actor.uid), { mustChangePassword: false, passwordChangedAt: stamp() });
  }

  /** After an account is linked to another login, its existing lines follow (administrators). */
  async function relinkLines(accountId) {
    actorOf();
    const { getDocs, query, where, collection, writeBatch } = fs;
    ensure(typeof getDocs === 'function' && typeof writeBatch === 'function', ERR.INVALID_INPUT, 'Query API required');
    const acc = await fs.getDoc(refs.account(accountId));
    ensure(acc.exists(), ERR.NOT_FOUND, 'That account no longer exists.');
    const uid = acc.data().custodianUid || '';
    const snap = await getDocs(query(collection(db, C.lines), where('accountId', '==', accountId)));
    const todo = snap.docs.filter(d => (d.data().custodianUid || '') !== uid);
    for (let i = 0; i < todo.length; i += 400) {
      const b = writeBatch(db);
      for (const d of todo.slice(i, i + 400)) b.update(refs.line(d.id), { custodianUid: uid });
      await b.commit();
    }
    return { updated: todo.length };
  }

  return { recordHandover, editHandover, voidHandover, confirmLine, queryLine, confirmLines, registerSelf, saveCustodian, setCustodianActive, markPasswordChanged, relinkLines };
}
