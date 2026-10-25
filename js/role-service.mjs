/**
 * BizCore V270.4.2 — Roles service (Administration → Roles & Permissions).
 *   ensureBuiltInRoles  administrators: create the built-in role records that don't exist yet (at sign-in)
 *   saveRole            administrators: create / edit a role (+ a change record), in one transaction
 *   loadChanges         the change history of one role
 *   migrateRights       administrators, once (V270.4.3): roles without Special Rights get the rights that give the same
 *                       effect as the Administration settings they replace (billing levels, receipts, profit visibility)
 *   syncUserPerms       administrators: every user record carries its role's lists (users/{uid}.perm) — repair any
 *                       record that differs (at sign-in). saveRole updates the role's users in the same commit.
 * The security rules (firestore.rules → "V270.4.2 Roles") enforce the same limits.
 */
import {
  ROLE_COLLECTION as COL, ROLE_CHANGES, BUILT_IN_ROLES, builtInRole, validateRoleInput, buildRoleRecord, describePermChange,
  userPermFrom, samePerm, normalizeRights, normalizePerms, RIGHTS,
} from './role-core.mjs?v=270.43';
import { accessWithRole } from './user-core.mjs?v=270.43';
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

  /**
   * V270.4.3, once per role: a role saved before Special Rights existed gets them, with the same effect as today's settings.
   * settings = { billing, receipts, purchasing } as stored (missing → the old defaults).
   *  • order / advance invoices, credit notes: "all" → roles that may create invoices; "admin" → nobody (administrators have every right)
   *  • receipts: "who may record / void" → the Payment Receipts module's Create / Cancel (admin → off for the roles)
   *  • profit visibility "everyone" → See cost, margin and profit for every role
   */
  async function migrateRights(settings = {}) {
    const actor = actorOf();
    const { getDocs, collection } = fs;
    if (typeof getDocs !== 'function') return [];
    const snap = await getDocs(collection(db, COL));
    const todo = snap.docs.map(d => d.data()).filter(r => r && !r.locked && (r.rights === undefined || r.rights === null));
    const b = settings.billing || {}, rc = settings.receipts || {}, pu = settings.purchasing || {};
    const done = [];
    for (const r of todo) {
      const perms = normalizePerms(r.perms || {});
      const canInvoice = perms.invoice.c;
      const rights = normalizeRights({
        orderInvoices: (b.allowOrderInvoices || 'admin') === 'all' && canInvoice,
        advanceInvoices: (b.allowAdvanceInvoices || 'admin') === 'all' && canInvoice,
        creditNotes: (b.allowCreditNotes || 'admin') === 'all' && canInvoice,
        seeCost: pu.profitVisibility === 'everyone',
      });
      perms.receipt.c = perms.receipt.c && (rc.allowRecord || 'all') === 'all';
      perms.receipt.x = perms.receipt.x && (rc.allowVoid || 'admin') === 'all';
      try {
        await saveRole({ id: r.id, label: r.label, perms, rights }, { expectedRevision: r.revision, note: 'Special Rights added — same effect as the Administration settings before V270.4.3' });
        done.push(r.id);
      } catch (e) { console.warn('[BizCore] rights not added to role', r.id, e.code || '', e.message); }
    }
    return done;
  }

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
      const note = prev ? (describePermChange(prev.perms, rec.perms, prev.rights, rec.rights) || (prev.label !== rec.label ? `Renamed: ${prev.label} → ${rec.label}` : 'No change'))
        : `Created${opts.copyOf ? ' as a copy of ' + opts.copyOf : ''}`;
      const fullNote = opts.note ? `${opts.note}${note && note !== 'No change' ? ' · ' + note : ''}` : note;
      const cid = newId();
      tx.set(changeRef(rec.id, cid), { id: cid, note: fullNote.slice(0, 2000), byUid: actor.uid, byName: actor.name, at: stamp() });
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

  return { ensureBuiltInRoles, saveRole, loadChanges, syncUserPerms, migrateRights };
}
