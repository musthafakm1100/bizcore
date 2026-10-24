/**
 * BizCore V267.1 — Payment Accounts transaction service.
 *
 * saveAccount is ONE Firestore transaction: it reads the account (when editing) and the name / code key
 * documents, refuses a name or code already used by another account, then writes
 *   the account + a change record + the new key documents (+ deletes the keys it no longer uses).
 * Two administrators saving the same name at the same moment can't both succeed (the key document is
 * read inside the transaction). Accounts are never deleted — only made inactive.
 */
import {
  ACCOUNT_COLLECTIONS, ACCOUNT_SCHEMA_VERSION, validateAccount, keyDocId,
} from './account-core.mjs?v=268.2';
import { DeliveryError, ERR, isSafeId } from './delivery-core.mjs?v=266.0';

const fail = (code, message, details) => { throw new DeliveryError(code, message, details); };
const ensure = (ok, code, message, details) => { if (!ok) fail(code, message, details); };
export const ACCOUNT_ERR = Object.freeze({ DUPLICATE_NAME: 'duplicate-name', DUPLICATE_CODE: 'duplicate-code', NOT_ADMIN: 'not-admin' });

export function createAccountService(fs, options = {}) {
  const { db, doc, runTransaction } = fs || {};
  ensure(db && typeof doc === 'function' && typeof runTransaction === 'function', ERR.INVALID_INPUT, 'Firestore transaction API required');
  const serverTimestamp = typeof fs.serverTimestamp === 'function' ? fs.serverTimestamp : null;
  const stamp = () => (serverTimestamp ? serverTimestamp() : new Date().toISOString());
  const now = options.now || (() => new Date().toISOString());
  const actorOf = () => {
    const a = (options.actor && options.actor()) || {};
    ensure(isSafeId(a.uid), ERR.INVALID_STATE, 'You must be signed in');
    return { uid: a.uid, name: String(a.name || a.email || a.uid).slice(0, 200) };
  };
  const refs = {
    account: id => doc(db, ACCOUNT_COLLECTIONS.accounts, id),
    change: (id, chg) => doc(db, ACCOUNT_COLLECTIONS.accounts, id, ACCOUNT_COLLECTIONS.changes, chg),
    key: id => doc(db, ACCOUNT_COLLECTIONS.keys, id),
    access: () => doc(db, 'system', 'accessControl'),
  };
  const newId = () => 'pa-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);

  /** Create (no id) or update (id) an account. Returns the saved account. */
  async function saveAccount(input, { id = null, expectedRevision = null } = {}) {
    const actor = actorOf();
    const accountId = id || newId();
    ensure(isSafeId(accountId), ERR.INVALID_INPUT, 'Invalid account');
    return runTransaction(db, async tx => {
      // ── reads ──
      const access = await tx.get(refs.access());
      const admins = access.exists() ? (access.data().adminUids || []) : [];
      ensure(admins.includes(actor.uid), ACCOUNT_ERR.NOT_ADMIN, 'Only administrators can manage payment accounts.');
      const snap = await tx.get(refs.account(accountId));
      const existing = snap.exists() ? snap.data() : null;
      if (id) ensure(existing, ERR.NOT_FOUND, 'This account no longer exists.');
      else ensure(!existing, ERR.ID_COLLISION, 'Please try again.');
      if (existing && expectedRevision != null)
        ensure(Number(existing.revision) === Number(expectedRevision), ERR.STALE_REVISION, 'Someone else changed this account. Close and open it again.');
      const v = validateAccount(input, existing);
      if (!v.ok) fail(ERR.INVALID_INPUT, v.errors.map(e => e.message).join(' '), { errors: v.errors });
      const val = v.value;
      // V268.2: a card's linked account must be an existing bank account
      if (val.type === 'card') {
        ensure(isSafeId(val.linkedBankAccountId) && val.linkedBankAccountId !== accountId, ERR.INVALID_INPUT, 'Choose the linked bank account.', { field: 'linkedBankAccountId' });
        const bank = await tx.get(refs.account(val.linkedBankAccountId));
        ensure(bank.exists() && bank.data().type === 'bank', ERR.INVALID_INPUT, 'The linked account must be a bank account.', { field: 'linkedBankAccountId' });
      }
      const nameKeyId = keyDocId('name', val.nameKey), codeKeyId = keyDocId('code', val.codeKey);
      const nameKeySnap = await tx.get(refs.key(nameKeyId));
      const codeKeySnap = await tx.get(refs.key(codeKeyId));
      if (nameKeySnap.exists() && nameKeySnap.data().accountId !== accountId)
        fail(ACCOUNT_ERR.DUPLICATE_NAME, `Another account is already called "${val.name}".`, { field: 'name' });
      if (codeKeySnap.exists() && codeKeySnap.data().accountId !== accountId)
        fail(ACCOUNT_ERR.DUPLICATE_CODE, `Account code ${val.code} is already used.`, { field: 'code' });

      // ── writes ──
      const at = now();
      const revision = existing ? Number(existing.revision || 0) + 1 : 1;
      const account = {
        ...(existing || {}),
        ...val,
        id: accountId,
        schemaVersion: ACCOUNT_SCHEMA_VERSION,
        ledgerAccountId: existing ? (existing.ledgerAccountId ?? null) : null,
        hasEntries: existing ? !!existing.hasEntries : false,
        revision,
        createdAt: existing ? (existing.createdAt ?? at) : at,   // V270.2.1: an older record without these never blocks the save
        createdByUid: existing ? (existing.createdByUid ?? actor.uid) : actor.uid,
        createdByName: existing ? (existing.createdByName ?? actor.name) : actor.name,
        updatedAt: stamp(), updatedByUid: actor.uid, updatedByName: actor.name,
      };
      tx.set(refs.account(accountId), account);
      if (!nameKeySnap.exists()) tx.set(refs.key(nameKeyId), { id: nameKeyId, kind: 'name', accountId, createdByUid: actor.uid });
      if (!codeKeySnap.exists()) tx.set(refs.key(codeKeyId), { id: codeKeyId, kind: 'code', accountId, createdByUid: actor.uid });
      if (existing && existing.nameKey && existing.nameKey !== val.nameKey) tx.delete(refs.key(keyDocId('name', existing.nameKey)));
      if (existing && existing.codeKey && existing.codeKey !== val.codeKey) tx.delete(refs.key(keyDocId('code', existing.codeKey)));
      const pick = a => a ? { code: a.code ?? '', name: a.name ?? '', type: a.type ?? '', custodianName: a.custodianName ?? '', custodianUid: a.custodianUid ?? '', linkedBankAccountId: a.linkedBankAccountId || '', zohoName: a.zohoName ?? '', openingBalance: a.openingBalance ?? 0, openingDate: a.openingDate ?? '', active: a.active ?? true } : null;   // V270.2.1: no undefined (refused by Firebase)
      const chgId = 'chg-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
      tx.set(refs.change(accountId, chgId), { id: chgId, accountId, toRevision: revision, before: pick(existing), after: pick(account), actorUid: actor.uid, actorName: actor.name, recordedAt: stamp() });
      return account;
    });
  }
  return { saveAccount };
}
