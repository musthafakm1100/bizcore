# V267.1 — Payment Accounts (step 1 of the purchase / accounting plan)

Approved 15 Oct 2026. Administration → **Finance → Payment Accounts**.

## What it is
The list of cash, card and bank accounts that receipts and payments will use. Built so the future full
chart of accounts (BizCore accounting) adopts these records as its cash and bank accounts — no rework.

| Field | Rule |
|---|---|
| Account code | required, unique (letters, digits, dot, dash; up to 20) |
| Account name | required, unique — case, spaces and dash styles ignored ("Cash in Hand – Shabeeb" = "cash in hand - shabeeb") |
| Type | Cash / Card / Bank → accounting class asset · current assets · cash/card/bank |
| Custodian | cash accounts only, required; a **name** (the person may have no BizCore login) |
| Zoho account name | optional |
| Opening balance + as-of date | fixed (with the type) once the account has entries |
| Active | inactive accounts can't be chosen for new entries; accounts are never deleted |

Only administrators (server list `system/accessControl.adminUids`) can add or change accounts; others can view.

## Data (Firestore)
- `paymentAccounts/{id}` — the account (`ledgerAccountId: null` until the chart of accounts exists; `hasEntries` set later by the posting service).
- `paymentAccounts/{id}/changes/{id}` — who changed what (before / after), immutable.
- `paymentAccountKeys/name_<key>`, `code_<key>` — one document per name / code → uniqueness, checked inside the save transaction.

## Files
- New: `js/account-core.mjs`, `js/account-service.mjs`, `js/accounts.js`, `css/accounts.css`,
  `tests/account-service.test.mjs`, `tests/browser/accounts.e2e.mjs`, `tests/emulator/accounts.test.mjs`.
- Changed: `index.html` (menu, screen, wiring), `js/app.js` (tab hook), `sw.js` (cache `bizcore-shell-v2671a`),
  `firestore.rules` + `emulator/firestore.rules` (new section "Payment Accounts (V267.1)"), `package.json`, `tests/emulator/package.json`.

## Going live — order
1. On the PC: `cd tests/emulator` → `npm test` (now includes `accounts.test.mjs`). All must pass.
2. Upload the website files (GitHub Pages).
3. Publish `firestore.rules` in the Firebase console (Firestore → Rules). Until the rules are published, saving an
   account is refused by the server (the screen shows "only administrators…").
   The new rules only ADD the two collections; nothing existing changes.

## Notes
- Users / Roles & Permissions are still stored per browser (localStorage), not enforced by the server. A server-backed
  roles system is needed before "permissions in Roles & Permissions" can really control money entries.
- Next (step 2): cash ledger with custodian confirmation. Open question there: custodians without a BizCore login.
