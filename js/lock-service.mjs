/**
 * BizCore — Document locking (ERP-style exclusive edit locks).
 *
 * One lock document per business object:  locks/{docType}_{docId}
 *   { uid, name, email, docType, docId, label, activity, sessionId,
 *     since (server time), heartbeatAt (server time), ttlSec, lockVersion: 2 }
 *
 * A lock is LIVE while heartbeatAt + ttlSec is in the future (server clock).
 * The holder renews heartbeatAt periodically; if the browser stops (crash, power cut,
 * closed tab) the lock simply expires after ttlSec.  Security rules (firestore.rules)
 * enforce the same definition with request.time, so client clock differences cannot
 * be used to steal a live lock, and Sales Order business writes are refused unless the
 * writer holds a live lock on that order.
 *
 * Settings (Administration → Document Locking) live in settings/locking and are
 * validated here and again by the rules.
 */
export const LOCK_COLLECTION = 'locks';
export const LOCK_EVENTS_COLLECTION = 'lockEvents';
export const LOCK_SETTINGS_PATH = ['settings', 'locking'];
export const LOCK_VERSION = 2;
export const LOCK_TYPES = Object.freeze({ salesOrder: 'salesOrder', quotation: 'quotation', rfq: 'rfq' });

export const LOCK_DEFAULTS = Object.freeze({
  idleMinutes: 15,
  idleWarningMinutes: 2,
  crashExpiryMinutes: 2,
  lockQuotations: true,
  lockRFQs: true,
});
export const LOCK_RANGES = Object.freeze({
  idleMinutes: [5, 120],
  idleWarningMinutes: [1, 5],
  crashExpiryMinutes: [1, 10],
});
/** Outer safety cap, also hard-coded in the security rules (ttlSec <= 600). */
export const MAX_TTL_SEC = 600;

export class LockError extends Error {
  constructor(code, message, details) { super(message); this.name = 'LockError'; this.code = code; if (details !== undefined) this.details = details; }
}

export const lockId = (docType, docId) => `${docType}_${docId}`;

/** Firestore Timestamp | Date | ISO string | number → epoch milliseconds (0 when unknown). */
export function toMillis(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v.toMillis === 'function') return v.toMillis();
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'string') { const t = Date.parse(v); return Number.isFinite(t) ? t : 0; }
  if (typeof v.seconds === 'number') return v.seconds * 1000 + Math.floor((v.nanoseconds || 0) / 1e6);
  return 0;
}

/** True while the lock is live by the given clock. Locks of the old format (no heartbeatAt/ttlSec) are never live. */
export function lockIsLive(lock, nowMs) {
  if (!lock || lock.lockVersion !== LOCK_VERSION) return false;
  const hb = toMillis(lock.heartbeatAt);
  return hb > 0 && Number.isInteger(lock.ttlSec) && hb + lock.ttlSec * 1000 > nowMs;
}

/** Validates settings entered by an administrator. Returns { ok, errors, value }. */
export function validateLockSettings(input) {
  const errors = [];
  const value = { ...LOCK_DEFAULTS };
  for (const [key, [min, max]] of Object.entries(LOCK_RANGES)) {
    const n = Number(input?.[key]);
    if (!Number.isInteger(n) || n < min || n > max) errors.push({ field: key, message: `${labelOf(key)} must be a whole number from ${min} to ${max} minutes.` });
    else value[key] = n;
  }
  if (!errors.length && value.idleWarningMinutes >= value.idleMinutes) errors.push({ field: 'idleWarningMinutes', message: 'The idle warning must come before the idle release.' });
  for (const key of ['lockQuotations', 'lockRFQs']) {
    if (input && key in input) {
      if (typeof input[key] !== 'boolean') errors.push({ field: key, message: `${labelOf(key)} must be on or off.` });
      else value[key] = input[key];
    }
  }
  return { ok: errors.length === 0, errors, value };
}
function labelOf(key) {
  return ({ idleMinutes: 'Idle time before release', idleWarningMinutes: 'Idle warning', crashExpiryMinutes: 'Expiry when the browser stops responding', lockQuotations: 'Lock quotations', lockRFQs: 'Lock RFQs' })[key] || key;
}

/** Stored settings → effective settings (invalid or missing values fall back to the defaults). */
export function effectiveLockSettings(stored) {
  const out = { ...LOCK_DEFAULTS };
  for (const [key, [min, max]] of Object.entries(LOCK_RANGES)) {
    const n = Number(stored?.[key]);
    if (Number.isInteger(n) && n >= min && n <= max) out[key] = n;
  }
  if (out.idleWarningMinutes >= out.idleMinutes) out.idleWarningMinutes = Math.min(LOCK_DEFAULTS.idleWarningMinutes, out.idleMinutes - 1);
  for (const key of ['lockQuotations', 'lockRFQs']) if (typeof stored?.[key] === 'boolean') out[key] = stored[key];
  out.ttlSec = Math.min(MAX_TTL_SEC, out.crashExpiryMinutes * 60);
  out.heartbeatMs = Math.max(15000, Math.floor((out.ttlSec * 1000) / 3));
  return out;
}

/** Holder summary for messages / the Locks screen. */
export function describeLock(lock) {
  if (!lock) return null;
  return {
    uid: lock.uid, name: lock.name || lock.email || 'another user', email: lock.email || '',
    docType: lock.docType, docId: lock.docId, label: lock.label || '', activity: lock.activity || '',
    sinceMs: toMillis(lock.since), heartbeatMs: toMillis(lock.heartbeatAt), ttlSec: lock.ttlSec,
  };
}

/**
 * @param fs        { db, doc, runTransaction, serverTimestamp }
 * @param options   { actor(): {uid,name,email}, sessionId, now(), settings(): effective settings }
 */
export function createLockService(fs, { actor, sessionId, now = () => Date.now(), settings = () => effectiveLockSettings(null) } = {}) {
  if (!fs || !fs.db || typeof fs.doc !== 'function' || typeof fs.runTransaction !== 'function') throw new Error('Lock service needs { db, doc, runTransaction }');
  if (!sessionId) throw new Error('Lock service needs a sessionId');
  const serverTs = () => (typeof fs.serverTimestamp === 'function' ? fs.serverTimestamp() : new Date(now()).toISOString());
  const ref = (t, id) => fs.doc(fs.db, LOCK_COLLECTION, lockId(t, id));
  const me = () => { const a = actor ? actor() : null; if (!a || !a.uid) throw new LockError('unauthenticated', 'Sign in to edit documents.'); return a; };
  const check = (t, id) => { if (!t || !id || String(id).includes('/')) throw new LockError('invalid-argument', 'Invalid lock target'); };

  /** Acquire (or renew) the lock. → { granted:true, lock, ownOtherSession } | { granted:false, holder } */
  async function acquire({ docType, docId, label = '', activity = '' }) {
    check(docType, docId);
    const a = me();
    const ttlSec = settings().ttlSec;
    return fs.runTransaction(fs.db, async tx => {
      const snap = await tx.get(ref(docType, docId));
      const cur = snap.exists() ? snap.data() : null;
      const live = lockIsLive(cur, now());
      if (live && cur.uid !== a.uid) return { granted: false, holder: describeLock(cur) };
      const ownOtherSession = !!(live && cur.uid === a.uid && cur.sessionId !== sessionId);
      const keepSince = live && cur.uid === a.uid && cur.sessionId === sessionId;
      const lock = {
        uid: a.uid, name: a.name || a.email || a.uid, email: a.email || '',
        docType, docId: String(docId), label: String(label || '').slice(0, 200), activity: String(activity || '').slice(0, 200),
        sessionId, since: keepSince ? cur.since : serverTs(), heartbeatAt: serverTs(), ttlSec, lockVersion: LOCK_VERSION,
      };
      tx.set(ref(docType, docId), lock);
      return { granted: true, lock, ownOtherSession };
    });
  }

  /** Renew. → { held:true } or { held:false, holder } when the lock was lost (taken over, force-released). */
  async function heartbeat({ docType, docId, activity }) {
    check(docType, docId);
    const a = me();
    const ttlSec = settings().ttlSec;
    return fs.runTransaction(fs.db, async tx => {
      const snap = await tx.get(ref(docType, docId));
      const cur = snap.exists() ? snap.data() : null;
      if (!cur || cur.uid !== a.uid || cur.sessionId !== sessionId) return { held: false, holder: describeLock(cur) };
      tx.set(ref(docType, docId), { ...cur, heartbeatAt: serverTs(), ttlSec, ...(activity != null ? { activity: String(activity).slice(0, 200) } : {}) });
      return { held: true };
    });
  }

  /** Release our own lock (no-op when it is not ours any more). */
  async function release({ docType, docId }) {
    check(docType, docId);
    const a = me();
    return fs.runTransaction(fs.db, async tx => {
      const snap = await tx.get(ref(docType, docId));
      const cur = snap.exists() ? snap.data() : null;
      if (!cur || cur.uid !== a.uid || cur.sessionId !== sessionId) return { released: false };
      tx.delete(ref(docType, docId));
      return { released: true };
    });
  }

  /** Administrator: remove someone else's lock, with a reason (logged in lockEvents). */
  async function forceRelease({ docType, docId, reason, operationId }) {
    check(docType, docId);
    const a = me();
    const why = String(reason || '').trim();
    if (why.length < 5) throw new LockError('invalid-argument', 'Enter a reason (at least 5 characters).');
    const evId = 'force-' + (operationId || `${lockId(docType, docId)}-${now()}`);
    return fs.runTransaction(fs.db, async tx => {
      const snap = await tx.get(ref(docType, docId));
      if (!snap.exists()) return { released: false, reason: 'not-locked' };
      const cur = snap.data();
      tx.delete(ref(docType, docId));
      tx.set(fs.doc(fs.db, LOCK_EVENTS_COLLECTION, evId), {
        id: evId, kind: 'force-release', lockId: lockId(docType, docId), docType, docId: String(docId),
        previousHolder: { uid: cur.uid || '', name: cur.name || '', email: cur.email || '', activity: cur.activity || '' },
        reason: why.slice(0, 500), actorUid: a.uid, actorName: a.name || a.email || a.uid, recordedAt: serverTs(),
      });
      return { released: true, previousHolder: describeLock(cur) };
    });
  }

  return { acquire, heartbeat, release, forceRelease, sessionId };
}

/** Used inside business transactions: does `uid`/`sessionId` hold this lock document? (expiry is enforced by the rules with server time) */
export function lockHeldBy(lockData, uid, sessionId) {
  return !!lockData && lockData.lockVersion === LOCK_VERSION && lockData.uid === uid && (!sessionId || lockData.sessionId === sessionId);
}
