/**
 * BizCore V270.4.2 — Roles service (Administration → Roles & Permissions).
 *   ensureBuiltInRoles  administrators: create the built-in role records that don't exist yet (at sign-in)
 *   saveRole            administrators: create / edit a role (+ a change record), in one transaction
 *   loadChanges         the change history of one role
 *   syncUserPerms       administrators: every user record carries its role's lists (users/{uid}.perm) — repair any
 *                       record that differs (at sign-in). saveRole updates the role's users in the same commit.
 * The security rules (firestore.rules → "V270.4.2 Roles") enforce the same limits.
 */
import {
  ROLE_COLLECTION as COL, ROLE_CHANGES, BUILT_IN_ROLES, builtInRole, validateRoleInput, buildRoleRecord, describePermChange,
  userPermFrom, samePerm,
} from './role-core.mjs?v=270.42';
import { accessWithRole } from './user-core.mjs?v=270.42';
import { DeliveryError, ERR, isSafeId } from './delivery-core.mjs?v=266.0';

const fail = (code, message, details) => { throw new DeliveryError(code, message, details); };
const ensure = (ok, code, message, details) => { if (!ok) fail(code, message, details); };
export const ROLE_ERR = Object.freeze({ NOT_ADMIN: 'not-admin', CONFLICT: 'conflict', LOCKED: 'role-locked' });

export function createRoleService(fs, options = {}) {
  const { db, doc, runTransaction } = fs || {};
  ensure(db && typeof doc === 'function' && typeof runTransaction === 'function', ERR.INVALID_INPUT, 'Firestore transaction API required');
  const stamp = () => (typeof fs.serverTimestamp === 'function' ? fs.serverTimestamp() : new Date().toISOString());
  const actorOf = () => {
    const a = (options.actor && options.actor()) || {};
    ensure(isSafeId(a.uid), ERR.INVALID_STATE, 'You must be signed in');
    return { uid: a.uid, name: String(a.name || a.email || a.uid).slice(0, 120) };
  };
  const ref = id => doc(db, COL, id);
  const changeRef = (id, cid) => doc(db, COL, id, ROLE_CHANGES, cid);
  const newId = () => 'chg-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  async function requireAdmin(tx, actor) {
    const acc = await accessWithRole(tx, doc, db, actor.uid);
    ensure((acc.data().adminUids || []).includes(actor.uid), ROLE_ERR.NOT_ADMIN, 'Only administrators can change roles.');
  }

  async function ownerUids(tx) { const a = await tx.get(doc(db, 'system', 'accessControl')); return a.exists() ? (a.data().adminUids || []) : []; }
  async function usersWithRole(id) {
    const { getDocs, query, where, collection } = fs;
    if (typeof getDocs !== 'function' || typeof query !== 'function') return [];
    const snap = await getDocs(query(collection(db, 'users'), where('companyRoles.default', '==', id)));
    return snap.docs.map(d => d.id);
  }
  const withPerm = (u, perm, actor) => ({ ...u, perm, revision: (Number(u.revision) || 0) + 1, updatedAt: stamp(), updatedByUid: actor.uid, updatedByName: actor.name });

  /** Every user record carries its role's lists; records that differ are repaired (e.g. made before V270.4.2). */
  async function syncUserPerms() {
    const actor = actorOf();
    const { getDocs, collection } = fs;
    if (typeof getDocs !== 'function') return [];
    const [us, rs] = await Promise.all([getDocs(collection(db, 'users')), getDocs(collection(db, COL))]);
    const roles = new Map(rs.docs.map(d => [d.id, d.data()]));
    const todo = us.docs.map(d => d.data()).filter(u => {
      const rid = (u.companyRoles || {}).default || '';
      const want = userPermFrom(roles.get(rid) || builtInRole(rid));
      return !samePerm(u.perm, want);
    }).map(u => u.uid);
    const fixed = [];
    for (const uid of todo) {
      try {
        await runTransaction(db, async tx => {
          await requireAdmin(tx, actor);
          const owners = await ownerUids(tx);
          if (owners.includes(uid) && uid !== actor.uid) return;   // only the owner changes the owner's record
          const s = await tx.get(doc(db, 'users', uid)); if (!s.exists()) return;
          const u = s.data(), rid = (u.companyRoles || {}).default || '';
          const r = await tx.get(ref(rid));
          const want = userPermFrom(r.exists() ? r.data() : builtInRole(rid));
          if (samePerm(u.perm, want)) return;
          tx.set(doc(db, 'users', uid), withPerm(u, want, actor));
          fixed.push(uid);
        });
      } catch (e) { console.warn('[BizCore] user permissions not refreshed:', uid, e.code || '', e.message); }
    }
    return fixed;
  }

  async function ensureBuiltInRoles() {
    const actor = actorOf();
    return runTransaction(db, async tx => {
      await requireAdmin(tx, actor);
      const snaps = await Promise.all(BUILT_IN_ROLES.map(r => tx.get(ref(r.id))));
      const made = [];
      BUILT_IN_ROLES.forEach((r, i) => {
        if (snaps[i].exists()) return;
        const rec = buildRoleRecord(null, { id: r.id, label: r.label, perms: r.perms }, { actor, stamp: stamp(), builtIn: true, locked: !!r.locked });
        tx.set(ref(r.id), rec);
        const cid = newId() + '-' + r.id;
        tx.set(changeRef(r.id, cid), { id: cid, note: 'Created with the starting permissions', byUid: actor.uid, byName: actor.name, at: stamp() });
        made.push(r.id);
      });
      return made;
    });
  }

  /** input { id?, label, perms }; opts { creating, expectedRevision, existingIds } */
  async function saveRole(input, opts = {}) {
    const actor = actorOf();
    const v = validateRoleInput(input, { creating: !!opts.creating, existingIds: opts.existingIds || [] });
    if (!v.ok) fail(ERR.INVALID_INPUT, v.errors.map(e => e.message).join(' '), { errors: v.errors });
    // the users who have this role get the new lists in the same commit (the owner keeps every right anyway)
    const userIds = opts.creating ? [] : await usersWithRole(v.value.id);
    return runTransaction(db, async tx => {
      await requireAdmin(tx, actor);
      const owners = await ownerUids(tx);
      const s = await tx.get(ref(v.value.id));
      const prev = s.exists() ? s.data() : null;
      const users = (await Promise.all(userIds.filter(u => !owners.includes(u)).map(u => tx.get(doc(db, 'users', u))))).filter(x => x.exists()).map(x => x.data());
      if (opts.creating) ensure(!prev, ERR.INVALID_INPUT, 'A role with this name already exists.');
      else ensure(prev, ERR.NOT_FOUND, 'This role no longer exists.');
      const builtIn = builtInRole(v.value.id);   // a built-in role saved before its starting record was made
      ensure(!(prev && prev.locked) && !(builtIn && builtIn.locked), ROLE_ERR.LOCKED, 'The Administrator role always has every right.');
      if (prev && opts.expectedRevision != null) ensure(Number(prev.revision) === Number(opts.expectedRevision), ROLE_ERR.CONFLICT, 'Someone else changed this role meanwhile. Open it again.');
      const rec = buildRoleRecord(prev, builtIn && !prev ? { ...v.value, label: builtIn.label } : v.value, { actor, stamp: stamp(), builtIn: !!builtIn });
      tx.set(ref(rec.id), rec);
      const perm = userPermFrom(rec);
      for (const u of users) if ((u.companyRoles || {}).default === rec.id && !samePerm(u.perm, perm)) tx.set(doc(db, 'users', u.uid), withPerm(u, perm, actor));
      const note = prev ? (describePermChange(prev.perms, rec.perms) || (prev.label !== rec.label ? `Renamed: ${prev.label} → ${rec.label}` : 'No change'))
        : `Created${opts.copyOf ? ' as a copy of ' + opts.copyOf : ''}`;
      const cid = newId();
      tx.set(changeRef(rec.id, cid), { id: cid, note: note.slice(0, 2000), byUid: actor.uid, byName: actor.name, at: stamp() });
      return rec;
    });
  }

  async function loadChanges(id) {
    const { getDocs, collection } = fs;
    if (typeof getDocs !== 'function') return [];
    const snap = await getDocs(collection(db, COL, id, ROLE_CHANGES));
    const ms = t => (t && typeof t.toMillis === 'function' ? t.toMillis() : t && t.seconds ? t.seconds * 1000 : Date.parse(t) || 0);
    return snap.docs.map(d => d.data()).sort((a, b) => ms(b.at) - ms(a.at));
  }

  return { ensureBuiltInRoles, saveRole, loadChanges, syncUserPerms };
}
