/**
 * BizCore V270.4.1 — Users service (Administration → Users).
 *   saveUser            administrators: create / edit a user record (+ an event), in one transaction
 *   setActive           administrators: deactivate / reactivate (+ an event)
 *   logResetSent        administrators: note that a password-reset email was sent
 *   ensureOwnerRecord   the owner's own record is created automatically at sign-in (role Administrator)
 *   markPasswordChanged the user changed the temporary password
 *   loadEvents          the change history of one user
 * The Firebase login itself is created by index.html (a second app instance, so the administrator stays signed in).
 * The security rules (firestore.rules → "V270.4.1 Users") enforce the same limits.
 */
import {
  USER_COLLECTION as COL, USER_EVENTS, CUSTODIAN_ROLE, ROLES, validateUserInput, buildUserRecord, describeUserChange, roleOfUser,
} from './user-core.mjs?v=270.43';
import { DeliveryError, ERR, isSafeId } from './delivery-core.mjs?v=266.0';
import { builtInRole, userPermFrom } from './role-core.mjs?v=270.43';

const fail = (code, message, details) => { throw new DeliveryError(code, message, details); };
const ensure = (ok, code, message, details) => { if (!ok) fail(code, message, details); };
export const USER_ERR = Object.freeze({ NOT_ADMIN: 'not-admin', CONFLICT: 'conflict', SELF: 'self-lockout', OWNER: 'owner-record', CUSTODIAN: 'custodian-login' });

export function createUserService(fs, options = {}) {
  const { db, doc, runTransaction } = fs || {};
  ensure(db && typeof doc === 'function' && typeof runTransaction === 'function', ERR.INVALID_INPUT, 'Firestore transaction API required');
  const stamp = () => (typeof fs.serverTimestamp === 'function' ? fs.serverTimestamp() : new Date().toISOString());
  const actorOf = () => {
    const a = (options.actor && options.actor()) || {};
    ensure(isSafeId(a.uid), ERR.INVALID_STATE, 'You must be signed in');
    return { uid: a.uid, name: String(a.name || a.email || a.uid).slice(0, 120), email: String(a.email || '') };
  };
  const refs = {
    access: () => doc(db, 'system', 'accessControl'),
    user: uid => doc(db, COL, uid),
    custodian: uid => doc(db, 'cashCustodians', uid),
    event: (uid, id) => doc(db, COL, uid, USER_EVENTS, id),
  };
  const newEventId = () => 'ev-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  /** Inside a transaction: is the actor the owner / an administrator? */
  async function whoIs(tx, uid) {
    const acc = await tx.get(refs.access());
    const owners = acc.exists() ? (acc.data().adminUids || []) : [];
    const me = await tx.get(refs.user(uid));
    const rec = me.exists() ? me.data() : null;
    const isOwner = owners.includes(uid);
    return { owners, isOwner, isAdmin: isOwner || !!(rec && rec.active !== false && roleOfUser(rec) === 'administrator') };
  }
  const addEvent = (tx, uid, actor, type, note) => {
    const id = newEventId();
    tx.set(refs.event(uid, id), { id, type, note: String(note || '').slice(0, 600), byUid: actor.uid, byName: actor.name, at: stamp() });
  };

  /** Create (no stored record) or edit. input as validateUserInput; opts.expectedRevision for edits. */
  async function saveUser(uid, input, opts = {}) {
    const actor = actorOf();
    ensure(isSafeId(uid), ERR.INVALID_INPUT, 'Invalid login');
    // V270.4.2: a custom role (roles/{id}) is accepted when its record exists (checked in the transaction)
    const custom = /^r-[a-zA-Z0-9_-]{1,38}$/.test(String(input.role || ''));
    const v = validateUserInput(input, { creating: !!opts.creating, roleIds: [...ROLES.map(r => r.id), ...(custom ? [String(input.role)] : [])] });
    if (!v.ok) fail(ERR.INVALID_INPUT, v.errors.map(e => e.message).join(' '), { errors: v.errors });
    ensure(v.value.role !== CUSTODIAN_ROLE.id, USER_ERR.CUSTODIAN, 'Cash custodian logins are created with the custodian form.');
    return runTransaction(db, async tx => {
      const who = await whoIs(tx, actor.uid);
      ensure(who.isAdmin, USER_ERR.NOT_ADMIN, 'Only administrators can manage users.');
      ensure(!who.owners.includes(uid) || uid === actor.uid, USER_ERR.OWNER, "Only the owner can change the owner's record.");
      const cust = await tx.get(refs.custodian(uid));
      ensure(!cust.exists(), USER_ERR.CUSTODIAN, 'This login is a cash custodian login (My Cash only).');
      // V270.4.2: the role's permission lists are copied onto the user record (what the rules read)
      const rs = await tx.get(doc(db, 'roles', v.value.role));
      if (custom) ensure(rs.exists(), ERR.INVALID_INPUT, 'That role no longer exists.');
      const perm = userPermFrom(rs.exists() ? rs.data() : builtInRole(v.value.role));
      const s = await tx.get(refs.user(uid));
      const prev = s.exists() ? s.data() : null;
      if (opts.expectedRevision != null && prev) ensure(Number(prev.revision) === Number(opts.expectedRevision), USER_ERR.CONFLICT, 'Someone else changed this user meanwhile. Close and open it again.');
      if (uid === actor.uid && !who.isOwner) ensure(v.value.active && v.value.role === 'administrator', USER_ERR.SELF, "You can't switch off or change your own administrator access.");
      const rec = buildUserRecord(prev, v.value, { uid, actor, stamp: stamp(), perm });
      tx.set(refs.user(uid), rec);
      const note = describeUserChange(prev, rec) + (opts.note ? ` · ${opts.note}` : '');
      addEvent(tx, uid, actor, prev ? (prev.active !== rec.active ? (rec.active ? 'reactivated' : 'deactivated') : 'edited') : 'created', note || 'No change');
      return rec;
    });
  }

  async function setActive(uid, active, reason = '') {
    const actor = actorOf();
    return runTransaction(db, async tx => {
      const who = await whoIs(tx, actor.uid);
      ensure(who.isAdmin, USER_ERR.NOT_ADMIN, 'Only administrators can manage users.');
      ensure(!who.owners.includes(uid) || uid === actor.uid, USER_ERR.OWNER, "Only the owner can change the owner's record.");
      ensure(uid !== actor.uid || who.isOwner || active, USER_ERR.SELF, "You can't switch off your own access.");
      const s = await tx.get(refs.user(uid));
      ensure(s.exists(), ERR.NOT_FOUND, 'This user no longer exists.');
      const prev = s.data();
      const rec = { ...prev, active: !!active, revision: (Number(prev.revision) || 0) + 1, updatedAt: stamp(), updatedByUid: actor.uid, updatedByName: actor.name };
      tx.set(refs.user(uid), rec);
      addEvent(tx, uid, actor, active ? 'reactivated' : 'deactivated', String(reason || '').trim() || (active ? 'Reactivated' : 'Deactivated'));
      return rec;
    });
  }

  async function logResetSent(uid, email) {
    const actor = actorOf();
    return runTransaction(db, async tx => {
      const who = await whoIs(tx, actor.uid);
      ensure(who.isAdmin, USER_ERR.NOT_ADMIN, 'Only administrators can manage users.');
      addEvent(tx, uid, actor, 'resetSent', `Password reset email sent to ${email}`);
    });
  }

  /** The owner (system/accessControl.adminUids) gets an Administrator record at sign-in when none exists. */
  async function ensureOwnerRecord() {
    const actor = actorOf();
    return runTransaction(db, async tx => {
      const who = await whoIs(tx, actor.uid);
      if (!who.isOwner) return null;
      const s = await tx.get(refs.user(actor.uid));
      if (s.exists()) return s.data();
      const rec = buildUserRecord(null, { name: actor.name, email: String(actor.email || '').toLowerCase(), role: 'administrator', active: true, mustChangePassword: false, employeeId: '', employeeName: '' },
        { uid: actor.uid, actor, stamp: stamp(), perm: userPermFrom(builtInRole('administrator')) });
      tx.set(refs.user(actor.uid), rec);
      addEvent(tx, actor.uid, actor, 'created', 'Owner record created automatically at sign-in');
      return rec;
    });
  }

  async function markPasswordChanged() {
    const actor = actorOf();
    ensure(typeof fs.updateDoc === 'function', ERR.INVALID_INPUT, 'updateDoc required');
    await fs.updateDoc(refs.user(actor.uid), { mustChangePassword: false, passwordChangedAt: stamp() });
  }

  async function loadEvents(uid) {
    const { getDocs, collection } = fs;
    if (typeof getDocs !== 'function') return [];
    const snap = await getDocs(collection(db, COL, uid, USER_EVENTS));
    const ms = t => (t && typeof t.toMillis === 'function' ? t.toMillis() : t && t.seconds ? t.seconds * 1000 : Date.parse(t) || 0);
    return snap.docs.map(d => d.data()).sort((a, b) => ms(b.at) - ms(a.at));
  }

  return { saveUser, setActive, logResetSent, ensureOwnerRecord, markPasswordChanged, loadEvents };
}
