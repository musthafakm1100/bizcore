# V270.4.3 — Special Rights (25 Oct 2026)

Third step of Users & Roles, built from the approved mockup UR_4 (Special Rights tab).
V270.4.1 Users and V270.4.2 Roles & Permissions are live (emulator 62/62, then 66/66 three times).

## Agreed with Musthafa (25 Oct 2026)
- The "all users / administrators only" choices in Billing, Receipts and Purchasing settings move into the roles.
- The moved settings **start with the same effect as today**: where today only administrators may do something
  (e.g. issue credit notes), Manager / Accounts start without that right. Administrators can switch rights on later.
- "Forgot password?" on the sign-in page.

## Special Rights (Administration → Roles & Permissions → Special Rights)
| Right | Was |
|---|---|
| See cost & profit (purchase price, margin on SO / purchase invoices) | Purchasing → profit visibility |
| Approve below minimum margin (decide pricing approvals) | administrators |
| Sell below minimum margin without approval | administrators |
| Order invoices | Billing → order invoices |
| Advance invoices | Billing → advance invoices |
| Issue credit notes, cancel & re-issue invoices | Billing → credit notes |
| Edit after the edit time limit | administrators |
| Full edit (cancel & re-issue receipts / purchase invoices) | administrators |
| Force-release another user's lock | administrators |
| Back-date documents | — (RFQ date limit) |
| Export to Excel | everyone (on by default) |
| Print / PDF | everyone (on by default) |

Administrator always has every right (locked). Each change is kept in the role's history ("Order invoices: On").

## What else changed
- **Receipts:** "who may record / void" is now the Receipt module's **Create** / **Cancel** box in the role grid.
- **Billing settings:** order / advance invoices show **On — roles with the Special Right** or **Off**; credit notes
  can't be switched off. A note points to Roles & Permissions.
- **Purchasing settings:** profit visibility moved to the right "See cost & profit".
- **Approvals:** sent to the owner, Administrators and roles with "Approve below minimum margin".
- **Excel / Print buttons** hide or refuse without the right.
- **Sign-in:** "Forgot password?" sends Firebase's reset email (same message whether or not the email has a login).

## First sign-in as administrator after upload
BizCore adds the rights to every existing role once (not Administrator), from today's settings:
order / advance invoices and credit notes on only where the setting was "all users" **and** the role creates
invoices; see cost on only if profit visibility was "everyone"; Receipt Create / Cancel switched off where the
setting was administrators only. History note: "Special Rights added — same effect as the Administration settings
before V270.4.3". Then the users' copies (perm) are refreshed.

## Data
`roles/{id}.rights { rightId: bool }` and `rightMods` (list of rights that are on); `users/{uid}.perm.rightMods` (copy).

## Security rules (changed — run the emulator tests on the PC first)
- `hasRight(r)` = the user's `perm.rightMods` contains r, or administrator.
- Approvals decided with `approveMargin`; force-release of a live lock and lockEvents with `forceRelease`;
  order / advance invoices and credit notes with the right when the setting is On; receipts: create = Receipt
  Create, void = Receipt Cancel, full edit = `fullEdit`; purchase edits after the limit = `editAfterLimit`,
  full edit = `fullEdit`.

## Going live
1. On the PC: `RUN_EMULATOR_TESTS.bat` 2–3 times (new rights.test.mjs).
2. Upload the files in the `_upload` folder (GitHub).
3. Open BizCore and sign in as Musthafa → the rights are added to the roles.
4. Publish `firestore.rules` (Firebase Console → Firestore → Rules).
5. Check Administration → Roles & Permissions → Special Rights; switch on what Manager / Accounts should have.

## Files to upload (GitHub)
index.html, login.html, sw.js (bizcore-shell-v27043), css/users.css; js/: app.js, users.js, permissions-ui.js,
user-core.mjs, user-service.mjs, role-core.mjs, role-service.mjs, so-view.js, account-service.mjs, invoice-service.mjs,
purchase-service.mjs, receipt-service.mjs, receipt-core.mjs, purchase-core.mjs, invoicing.js, receipts.js, purchases.js,
data-safety.js, rfq-entry.js. `firestore.rules` → Firebase Console only.

## Tests
- `npm test`: + Special Rights migration test (tests/role-service.test.mjs); receipts tests seed module rights.
- Emulator: + tests/emulator/rights.test.mjs (3); receipts.test.mjs uses Receipt Create / Cancel.
- Browser: + tests/browser/rights.e2e.mjs (migration at sign-in, Special Rights tab, Excel hidden without the right);
  invoicing.e2e.mjs: order invoices via the Special Right. Fix found on the way: buttons hidden by a permission stayed
  visible in register toolbars (their display rule was stronger) — css/users.css.
