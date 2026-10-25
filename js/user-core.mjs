/**
 * BizCore V270.4.1 — Users (Administration → Users). Pure rules, no Firebase.
 *
 * users/{uid} {
 *   uid, name, email, employeeId, employeeName,      // employee link is optional (names / records only, no access)
 *   active, mustChangePassword, passwordChangedAt?,
 *   companyRoles: { default: '<roleId>' },           // one role per company; 'default' = the current company until the
 *   defaultCompany: 'default',                       //   Company master (next step) gives companies their own ids
 *   revision, createdAt, createdByUid, createdByName, updatedAt, updatedByUid, updatedByName, schemaVersion }
 * users/{uid}/events/{id} { id, type, note, byUid, byName, at }   — never changed
 *
 * Cash custodian logins keep their own record (cashCustodians/{uid}) and never get a users record.
 * The security rules (firestore.rules → "V270.4.1 Users") enforce the same limits.
 */
export const USER_COLLECTION = 'users';
export const USER_EVENTS = 'events';
export const USER_SCHEMA_VERSION = 1;
export const DEFAULT_COMPANY = 'default';

/** Built-in roles (their permissions: js/role-core.mjs). V270.4.2: administrators can add roles (roles/{id}). */
export const ROLES = Object.freeze([
  { id: 'administrator', label: 'Administrator', builtIn: true },
  { id: 'manager', label: 'Manager' },
  { id: 'sales', label: 'Sales' },
  { id: 'purchasing', label: 'Purchasing' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'store', label: 'Store / Delivery' },
]);
export const CUSTODIAN_ROLE = Object.freeze({ id: 'cashCustodian', label: 'Cash Custodian', builtIn: true });
const _customLabels = new Map();
/** V270.4.2: names of the roles administrators added (roles/{id}). */
export function setRoleLabels(list = []) { _customLabels.clear(); for (const r of list) if (r && r.id && r.label) _customLabels.set(r.id, r.label); }
export const roleLabel = id => (ROLES.find(r => r.id === id) || (id === CUSTODIAN_ROLE.id ? CUSTODIAN_ROLE : null) || { label: _customLabels.get(id) || id || '—' }).label;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const clean = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);

/**
 * input { name, email, password?, employeeId?, employeeName?, role, active?, mustChangePassword? }
 * opts  { creating: bool }
 */
export function validateUserInput(input = {}, opts = {}) {
  const errors = [];
  const name = clean(input.name, 120);
  const email = clean(input.email, 200).toLowerCase();
  const role = clean(input.role, 40);
  const password = String(input.password || '');
  if (!name) errors.push({ field: 'name', message: 'Enter the full name.' });
  if (opts.creating) {
    if (!EMAIL_RE.test(email)) errors.push({ field: 'email', message: 'Enter a valid email address.' });
    if (password.length < 8) errors.push({ field: 'password', message: 'The temporary password needs at least 8 characters.' });
  }
  if (!role) errors.push({ field: 'role', message: 'Choose a role.' });
  else if (role !== CUSTODIAN_ROLE.id && !(opts.roleIds || ROLES.map(r => r.id)).includes(role)) errors.push({ field: 'role', message: 'Choose a role from the list.' });
  return {
    ok: errors.length === 0, errors,
    value: {
      name, email, password, role,
      employeeId: clean(input.employeeId, 120), employeeName: clean(input.employeeName, 120),
      active: input.active !== false, mustChangePassword: input.mustChangePassword !== false,
    },
  };
}

/** The record to write. prev = the stored record (or null for a new user). */
/** V270.4.2: the user record carries a copy of its role's permission lists (perm), so the security rules read only the
 *  user record (Firebase allows at most 10 record reads per checked document). Kept in step by js/role-service.mjs. */
export function buildUserRecord(prev, value, { uid, actor, stamp, now, perm }) {
  return {
    uid,
    name: value.name,
    email: prev ? prev.email : value.email,
    employeeId: value.employeeId || '', employeeName: value.employeeId ? (value.employeeName || '') : '',
    active: !!value.active,
    mustChangePassword: prev ? !!prev.mustChangePassword : !!value.mustChangePassword,
    ...(prev && prev.passwordChangedAt ? { passwordChangedAt: prev.passwordChangedAt } : {}),
    companyRoles: { ...((prev && prev.companyRoles) || {}), [DEFAULT_COMPANY]: value.role },
    defaultCompany: (prev && prev.defaultCompany) || DEFAULT_COMPANY,
    ...(perm ? { perm } : prev && prev.perm ? { perm: prev.perm } : {}),
    revision: prev ? (Number(prev.revision) || 0) + 1 : 1,
    createdAt: prev ? prev.createdAt : stamp, createdByUid: prev ? prev.createdByUid : actor.uid, createdByName: prev ? (prev.createdByName || '') : actor.name,
    updatedAt: stamp, updatedByUid: actor.uid, updatedByName: actor.name,
    schemaVersion: USER_SCHEMA_VERSION,
  };
}

export const roleOfUser = rec => (rec && rec.companyRoles && rec.companyRoles[DEFAULT_COMPANY]) || '';

/** before → after lines for the change history ("Role: Sales → Accounts"). */
export function describeUserChange(prev, next) {
  if (!prev) return `Created as ${roleLabel(roleOfUser(next))}${next.employeeName ? ' · employee ' + next.employeeName : ''}`;
  const out = [];
  if (prev.name !== next.name) out.push(`Name: ${prev.name} → ${next.name}`);
  if (roleOfUser(prev) !== roleOfUser(next)) out.push(`Role: ${roleLabel(roleOfUser(prev))} → ${roleLabel(roleOfUser(next))}`);
  if ((prev.employeeId || '') !== (next.employeeId || '')) out.push(`Employee: ${prev.employeeName || '—'} → ${next.employeeName || '—'}`);
  if (!!prev.active !== !!next.active) out.push(next.active ? 'Reactivated' : 'Deactivated');
  return out.join(' · ');
}

/** 'active' | 'inactive' | 'mustChange' */
export function userStatus(rec) {
  if (!rec || rec.active === false) return 'inactive';
  if (rec.mustChangePassword) return 'mustChange';
  return 'active';
}

/** Logins that signed in (userDirectory) but have no users record, aren't custodians and aren't the owner. */
export function loginsWithoutAccess({ directory = [], users = [], custodians = [], ownerUids = [], ignored = [] } = {}) {
  const known = new Set([...users.map(u => u.uid), ...custodians.map(c => c.uid), ...ownerUids, ...ignored]);
  return directory.filter(d => d && d.uid && !known.has(d.uid))
    .sort((a, b) => String(a.email || a.name).localeCompare(String(b.email || b.name)));
}

/** A readable temporary password: 3 letters + 4 digits + 3 letters (no look-alike characters). */
export function generatePassword(rand = Math.random) {
  const L = 'abcdefghjkmnpqrstuvwxyz', U = 'ABCDEFGHJKLMNPQRSTUVWXYZ', D = '23456789';
  const pick = s => s[Math.floor(rand() * s.length)];
  return pick(U) + pick(L) + pick(L) + pick(D) + pick(D) + pick(D) + pick(D) + pick(U) + pick(L) + pick(L);
}

/**
 * For the services' own checks (inside a transaction, during the reads): the accessControl snapshot, with the actor
 * added to adminUids when the actor's users record is active with the Administrator role — the same rule as isAdmin()
 * in firestore.rules. Returns an object shaped like a snapshot ({ exists(), data() }).
 */
export async function accessWithRole(tx, doc, db, uid) {
  const [a, u] = await Promise.all([tx.get(doc(db, 'system', 'accessControl')), uid ? tx.get(doc(db, USER_COLLECTION, uid)) : Promise.resolve(null)]);
  const base = a && a.exists() ? a.data() : {};
  const list = Array.isArray(base.adminUids) ? base.adminUids.slice() : [];
  const d = u && u.exists() ? u.data() : null;
  if (uid && d && d.active !== false && roleOfUser(d) === 'administrator' && !list.includes(uid)) list.push(uid);
  // V270.4.3: the actor's own permission lists (the copy on the user record) — Special Rights and module boxes
  const perm = d && d.active !== false && d.perm ? d.perm : {};
  const data = { ...base, adminUids: list, actorPerm: { rightMods: perm.rightMods || [], createMods: perm.createMods || [], cancelMods: perm.cancelMods || [] } };
  return { exists: () => !!(a && a.exists()) || list.length > 0, data: () => data };
}
/** V270.4.3: may the actor do this? (an accessWithRole snapshot) — administrators: everything.
 *  right: a Special Right id; or { mod, act: 'c' | 'x' } for a module box. */
export function actorMay(accessSnap, uid, what) {
  const d = accessSnap && accessSnap.exists() ? accessSnap.data() : {};
  if ((d.adminUids || []).includes(uid)) return true;
  const p = d.actorPerm || {};
  if (typeof what === 'string') return (p.rightMods || []).includes(what);
  return ((what.act === 'x' ? p.cancelMods : p.createMods) || []).includes(what.mod);
}
