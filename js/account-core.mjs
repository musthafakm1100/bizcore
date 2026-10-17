/**
 * BizCore V267.1 — Payment Accounts (cash, card and bank accounts), pure rules.
 *
 * Accounting-ready from day one (approved 15 Oct 2026):
 *  - every account has a unique Account code and a unique name;
 *  - an accounting class (asset → current assets → cash / card / bank) so the future chart of accounts
 *    can adopt these records as its cash and bank accounts (ledgerAccountId stays null until then);
 *  - the custodian (cash accounts only) is a NAME — the person may have no BizCore login — optionally
 *    linked to a BizCore user (custodianUid) so that, later, they can confirm their own cash ledger;
 *  - the opening balance (and the type) can't change once the account has entries (hasEntries).
 *  - V268.2: a card account names its LINKED bank account (linkedBankAccountId): card payments come out of that
 *    bank account at once; the card's own ledger shows them as memo lines.
 *
 * Firestore:
 *   paymentAccounts/{id}            the account
 *   paymentAccounts/{id}/changes/*  who changed what (immutable)
 *   paymentAccountKeys/{name_<key>|code_<key>}  one document per name / code → uniqueness
 * Only administrators (system/accessControl.adminUids) may write — enforced by the security rules.
 */
export const ACCOUNT_SCHEMA_VERSION = 1;
export const ACCOUNT_COLLECTIONS = Object.freeze({ accounts: 'paymentAccounts', changes: 'changes', keys: 'paymentAccountKeys' });
export const ACCOUNT_TYPES = Object.freeze(['cash', 'card', 'bank']);
export const ACCOUNT_TYPE_LABELS = Object.freeze({ cash: 'Cash', card: 'Card', bank: 'Bank' });
export const ACCOUNT_LIMITS = Object.freeze({ code: 20, name: 80, custodian: 80, zoho: 120 });

/** Where the account will sit in the chart of accounts (balance sheet → current assets). */
export function accountingClassOf(type) {
  return { nature: 'asset', group: 'current-assets', kind: ACCOUNT_TYPES.includes(type) ? type : 'cash' };
}

const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

/** Uniqueness key: case-insensitive, spaces and dash styles ignored ("Cash in Hand – Shabeeb" = "cash in hand - shabeeb"). */
export function nameKeyOf(name) {
  return clean(name, ACCOUNT_LIMITS.name).toLowerCase()
    .replace(/[\u2010-\u2015\u2212\/\\]/g, '-').replace(/\s*-\s*/g, '-').replace(/\s+/g, ' ').replace(/^_+/, '');
}
export function codeKeyOf(code) { return clean(code, ACCOUNT_LIMITS.code).toLowerCase(); }
export const CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9.\-]{0,19}$/;
export const keyDocId = (kind, key) => `${kind}_${key}`;

const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));
const r2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/**
 * Check and normalise an account from the form. `existing` is the stored account when editing.
 * Returns { ok, value, errors:[{field, message}] }.
 */
export function validateAccount(input = {}, existing = null) {
  const errors = [], err = (field, message) => errors.push({ field, message });
  const code = clean(input.code, ACCOUNT_LIMITS.code);
  const name = clean(input.name, ACCOUNT_LIMITS.name);
  const type = String(input.type || '').toLowerCase();
  const custodianName = clean(input.custodianName, ACCOUNT_LIMITS.custodian);
  const custodianUid = clean(input.custodianUid, 128);
  const linkedBankAccountId = clean(input.linkedBankAccountId, 128);
  const zohoName = clean(input.zohoName, ACCOUNT_LIMITS.zoho);
  const rawBal = String(input.openingBalance == null ? '' : input.openingBalance).replace(/[,\s]/g, '');
  const openingBalance = rawBal === '' ? 0 : Number(rawBal);
  const openingDate = String(input.openingDate || '').slice(0, 10);
  const active = input.active !== false;

  if (!code) err('code', 'Enter the account code.');
  else if (!CODE_PATTERN.test(code)) err('code', 'Account code: letters, digits, dot or dash only (up to 20).');
  if (!name) err('name', 'Enter the account name.');
  if (!ACCOUNT_TYPES.includes(type)) err('type', 'Choose Cash, Card or Bank.');
  if (type === 'cash' && !custodianName) err('custodianName', 'A cash account needs a custodian.');
  if (type === 'card' && !linkedBankAccountId) err('linkedBankAccountId', 'A card account needs its linked bank account.');
  if (!Number.isFinite(openingBalance)) err('openingBalance', 'Opening balance must be a number.');
  if (!isDate(openingDate)) err('openingDate', 'Enter the date of the opening balance.');

  if (existing && existing.hasEntries) {
    if (type !== existing.type) err('type', 'The type can\'t change: this account already has entries.');
    if (r2(openingBalance) !== r2(existing.openingBalance) || openingDate !== existing.openingDate)
      err('openingBalance', 'The opening balance can\'t change: this account already has entries.');
  }
  const value = {
    code, codeKey: codeKeyOf(code), name, nameKey: nameKeyOf(name), type,
    accountingClass: accountingClassOf(type),
    custodianName: type === 'cash' ? custodianName : '',
    custodianUid: type === 'cash' ? custodianUid : '',
    linkedBankAccountId: type === 'card' ? linkedBankAccountId : '',
    zohoName, openingBalance: r2(openingBalance), openingDate, active,
  };
  if (!value.nameKey && name) err('name', 'Enter a proper account name.');
  return { ok: errors.length === 0, value, errors };
}

/** Sorted for lists: active first, then by code. */
export function sortAccounts(list) {
  return [...(list || [])].sort((a, b) => (b.active !== false) - (a.active !== false) || String(a.code || '').localeCompare(String(b.code || ''), undefined, { numeric: true }));
}
/** Accounts that may be chosen for new entries (optionally of one type). */
export function selectableAccounts(list, type) {
  return sortAccounts(list).filter(a => a.active !== false && (!type || a.type === type));
}
export function accountLabel(a) { return a ? `${a.code} · ${a.name}` : ''; }
