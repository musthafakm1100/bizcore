# V270.4.1 — Users (25 Oct 2026)

First step of Users & Roles, built from the approved mockups UR_1 (Users list), UR_2 (New User) and UR_5 (No access).
UR_3 / UR_4 (role permissions, special rights) are V270.4.2 and V270.4.3.

## Agreed with Musthafa (25 Oct 2026)
- Build the full Users & Roles before go-live, ready for several companies (a role **per company**); then the Company
  foundation (company master, company + activity on every document, numbering per company, company details copied
  into issued documents); go live with Downtown only; accounting, Contracting and multi-company later.
- Employee operational roles (Sales, Purchasing, Delivery … in Master Data) stay separate from access roles. They
  only decide "Assigned to" / salesperson. Linking a login to an employee is optional.
- Defaults for the open points: Sales sees everything, with an "Own records only" choice per role (V270.4.2);
  View / Create / Edit / Cancel per module + special rights; the activity limit (Trading / Contracting) is shown as
  "Later".

## What changed
- **A login works only with an active user record** (`users/{uid}`, Administration → Users). A login without one
  sees "No access to BizCore yet" (UR_5) and the database refuses everything. This closes the gap where anyone able to
  create a Firebase account with the public API key was treated as staff.
- **The owner** (`system/accessControl.adminUids`, Firebase Console only) always keeps access. His own record (role
  Administrator) is created automatically at his first sign-in. Only the owner can change the owner's record.
- **Administrators:** the owner, or an active user with the role **Administrator**. Everything that was
  "administrators only" (locking, billing / receipt / purchase settings, payment accounts, approvals, custodian logins…)
  now accepts both — in the rules and in the services (`accessWithRole` in js/user-core.mjs).
- **Administration → Users** (UR_1): tiles (active users, administrators, password not changed, signed in today), chips
  All / Active / Inactive / Cash Custodians, one row per login with its role in the company, status and last sign-in.
  ⋮ menu: Edit · Send password reset email · Activity · Deactivate / Reactivate. Cash custodian logins are listed too.
- **Logins without access:** a login that signed in but has no record is listed in a yellow note with
  **Give Access** (choose the role) and **Ignore** (hidden in this browser only).
- **New User** (UR_2): full name, email, temporary password (Generate), "Change password at first sign-in", employee
  (optional), company access (role; Activities "Later"). Choosing **Cash Custodian** shows the cash accounts and creates
  a My Cash login (as before). Confirmation before saving; a disabled button always says what is missing.
- **Edit:** name, employee, role, active. The email can't be changed here. Nobody can switch off or demote their own
  record (except the owner, who stays in through accessControl).
- **Deactivate** stops the person at their next action; an open BizCore shows "Your access has been switched off" at once.
- **Temporary password:** at sign-in the user must choose a new password first. The user menu has **Change Password**
  (replaces the old "My Profile" item, which opened the Users screen).
- **Activity:** every change is kept in `users/{uid}/events` (created, edited, deactivated, reactivated, reset email).
- **Roles & Permissions** (new tab under Security): the list of roles with user counts. The permission grid comes in
  V270.4.2; until then every role except Cash Custodian has today's staff access.
- Built-in roles: Administrator, Manager, Sales, Purchasing, Accounts, Store / Delivery, Cash Custodian.

## Data
```
users/{uid} { uid, name, email, employeeId, employeeName, active, mustChangePassword, passwordChangedAt?,
              companyRoles: { default: '<roleId>' }, defaultCompany: 'default', revision,
              createdAt, createdByUid, createdByName, updatedAt, updatedByUid, updatedByName, schemaVersion }
users/{uid}/events/{id} { id, type, note, byUid, byName, at }
```
`default` stands for the current company. When the Company master is added, `default` becomes the id of Downtown
Trading Est.'s company record (or is mapped to it) — no change for the users.

## Security rules (changed — run the emulator tests on the PC first)
- `staff()` = active users record **or** owner (was: any login that isn't a custodian).
- `isAdmin()` = owner **or** active record with role `administrator`.
- `users/{uid}`: read by staff (and the user himself); written only by administrators, validated, never deleted;
  never for a custodian login; nobody switches off / demotes himself; only the owner changes the owner's record;
  the user may only clear `mustChangePassword`.
- `users/{uid}/events`: administrators read / create; never changed.
- `cashCustodians/{uid}`: can't be created for a login that already has a users record.
- Reads per request stay the same: the users record replaces the custodian check in `staff()`.

## Firebase Console
Keep **Authentication → Settings → User actions → "Enable create (sign-up)" ticked**. BizCore creates users from the
browser (like custodian logins), which needs it. Self-made accounts get nothing anyway — they have no user record.
(This replaces the earlier open point "untick Enable create (sign-up)".)

## Files
New: `js/user-core.mjs`, `js/user-service.mjs`, `js/users.js`, `css/users.css`, `tests/user-service.test.mjs`,
`tests/browser/users.e2e.mjs`, `tests/emulator/users.test.mjs`, `tests/emulator/staff-seed.mjs`.
Changed: `index.html`, `sw.js` (bizcore-shell-v27041), `mycash.html` (version tag), `js/app.js` (tab switch),
`js/ledger-service.mjs`, `js/account-service.mjs`, `js/invoice-service.mjs`, `js/purchase-service.mjs`,
`js/receipt-service.mjs` (Administrator role), `firestore.rules` + `emulator/firestore.rules`,
`tests/browser/harness.mjs` (test logins get a staff record), all emulator tests (staff records seeded),
`package.json` files (new tests).

## Going live with this version
1. On the PC: `RUN_EMULATOR_TESTS.bat` (rules changed; new users.test.mjs).
2. Upload the files in the `_upload` folder (GitHub).
3. Open BizCore and sign in once as Musthafa → your Administrator record is created.
4. Publish `firestore.rules` (Firebase Console → Firestore → Rules). Don't upload it to GitHub.
5. Administration → Users: anyone else who has signed in appears under "Logins without access" → Give Access.

## Tests
- `npm test`: + tests/user-service.test.mjs (5). Known old failure unchanged: "V268.3 after 7 days only an administrator can edit".
- `npm run test:browser`: + tests/browser/users.e2e.mjs (2): gate, owner record, create, give access, edit,
  Administrator role live, deactivate live, reset email, activity, forced password change, custodian from New User.
- Emulator (PC): + tests/emulator/users.test.mjs (4) — could not be run in the cloud workspace (emulator download blocked).
