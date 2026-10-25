# V270.4.2 — Roles & Permissions (25 Oct 2026)

Built from the approved mockup UR_3 (role list + module grid). Special Rights (UR_4) are V270.4.3.

## Agreed with Musthafa (25 Oct 2026)
- **Owner of a record** (for "Own records only"): new RFQs, quotations and Sales Orders store `ownerUid` — the creator, or
  for an RFQ the assigned employee's login when the employee is linked to a user. A quotation made from an RFQ and a
  Sales Order made from a quotation keep the same owner. Old test records have no owner (Own users don't see them).
- **All / Own** on RFQs, Pricing, Quotations and Sales Orders only. Delivery Notes, invoices and receipts: All.
- **Starting permissions** of the built-in roles (changeable in the grid):

| Role | View · Create · Edit (+ Cancel where shown) | View only | No access |
|---|---|---|---|
| Administrator | everything (locked) | — | — |
| Manager | every module incl. Cancel | — | Administration |
| Sales | RFQs (+ Cancel), Pricing, Quotations (+ Cancel), Sales Orders, Customers, Products | Delivery Notes, Invoices, Stock, Suppliers, Employees, Reports | Receipts, Purchasing, Cash, Administration |
| Purchasing | Purchase Invoices, Supplier Payments, Suppliers, Products; Stock (edit) | Sales Orders, Customers, Employees, Reports | Sales documents, Invoices, Receipts, Cash |
| Accounts | Invoices, Receipts, Supplier Payments, Cash & Bank (all + Cancel) | RFQs, Pricing, Quotations, Sales Orders, Delivery Notes, Purchase Invoices, Stock, masters, Reports | Administration |
| Store / Delivery | Delivery Notes; Stock (edit) | Sales Orders, Customers, Products, Employees | prices and money modules |

## What changed
- **Administration → Roles & Permissions** (UR_3): role list with user counts and **New** (name + start from an
  existing role or empty); the grid **View / Create / Edit / Cancel** per module, **Records All / Own** where it applies;
  Create / Edit / Cancel need View (unticking View clears the row). **Duplicate**, **Changes** (history), **Discard**,
  **Save Role** (confirmation lists every change and how many users get it). Administrator and Cash Custodian are locked.
  Switching role with unsaved changes asks first. The Special Rights tab says what comes in V270.4.3.
- Modules in the grid: RFQs, Pricing, Quotations, Sales Orders, Delivery Notes, Customer Invoices (incl. credit notes),
  Payment Receipts, Purchase Invoices, Supplier Payments, Stock (View / Edit = allocate, change item), Cash & Bank,
  Customers / Suppliers / Products / Employees (Cancel = delete), Reports (View), Administration (View / Edit = general
  settings; the security settings stay with administrators).
- **Users → New / Edit:** the role list includes the roles you added. Fix: the top bar's **New User** opened the form
  as "Edit User".
- **For a user with a role:**
  - modules without View leave the sidebar (a group with nothing left disappears) and their page can't be opened;
  - an action the role may not do stops with "Sales can't create Purchase Invoices. Ask an administrator…" — every
    button and shortcut that leads to it (the entry functions are guarded in js/permissions-ui.js); register **New**
    buttons are disabled with the reason in the tooltip;
  - Sales Order view: the Purchasing tab needs Purchase Invoices / Supplier Payments (View), Finance needs Invoices /
    Receipts (View), Profit also needs the purchases;
  - the data layer never asks the database for records the role can't see; "Own" users read only their own records
    (all of them, any age — no 12-month window, no extra Firebase index needed);
  - when an administrator changes the role (or the user's role) while the user works, a bar asks to **Reload**;
  - a role record that doesn't exist yet → "Your role is not set up yet" (administrators create the built-in roles
    automatically when they open BizCore).
- "Is this customer / product / supplier used anywhere?" before deleting: a role that can't see every record of a
  collection is told so instead of being allowed to delete.

## Data
```
roles/{roleId} { id, label, builtIn, locked, perms: { <module>: { v, c, e, x, own } },
                 viewMods, createMods, editMods, cancelMods, writeMods, ownMods,      ← what the rules read
                 revision, updatedAt, updatedByUid, updatedByName, schemaVersion }
roles/{roleId}/changes/{id} { id, note, byUid, byName, at }                          ← never changed
users/{uid}: + perm { roleId, viewMods, createMods, editMods, cancelMods, writeMods, ownMods }   ← copy of the role's lists
rfqs / quotations / salesOrders: + ownerUid
```
Built-in role ids: administrator, manager, sales, purchasing, accounts, store. Added roles: `r-<name>`.

## Security rules (changed — run the emulator tests on the PC first)
- `canV / canC / canE / canX / canW(modules)`: the lists on the user's own record (one `hasAny` each) — or an administrator.
- Reads: each business collection needs View of its module (e.g. purchase invoices: Purchase Invoices, Supplier Payments
  or Cash & Bank; delivery notes: Delivery Notes or Invoices). Support records (locks, counters, settings, stock items,
  running totals, terms…) stay readable by every staff login.
- Writes: Create / Edit / Cancel of the module — plus the writes other modules make as part of their own work
  (e.g. a new Sales Order marks its quotation, a delivery note updates its order, a supplier payment updates its
  invoice). Masters: delete needs Cancel.
- "Own": `ownOk(module, record)` on read / update / delete of RFQs, quotations, Sales Orders and pricing versions
  (via their RFQ); a list must ask for `ownerUid == me`.
- `roles/{id}`: read by staff, written by administrators, validated, never deleted; Administrator's permissions can't change.
- Settings: `settings/uiPrefs_<own uid>` for everyone; `settings/main` with Administration (Edit) or Products (write —
  the product form saves new categories there). Known limit: a product editor could also change other main settings.

## Notes
- **Rules limits (fixed 25 Oct, before go-live):** Firebase allows at most 10 record reads and 1000 evaluated
  expressions per checked document. The first V270.4.2 rules read the role record in every check, which pushed invoice
  and receipt saves over those limits now and then. Now **each user record carries a copy of its role's lists**
  (`users/{uid}.perm`), so a check reads only the user record — as many reads as V270.4.1. The copy is kept in step:
  saving a role updates its users in the same commit; giving a user a role copies its lists; when an administrator opens
  BizCore, every user record whose copy differs is repaired (`syncUserPerms`; the owner's record only by the owner).
  The receipt edit rule also works out its changed fields and settings once. Run the emulator tests 2–3 times.
- Test fix: "V268.3 after 7 days only an administrator can edit" now moves on from the real date (it failed once the real
  date passed 23 Oct because the record time comes from the database clock).
- Cost and profit inside the same records are hidden on screen only (Special Rights, V270.4.3).
- The price history on Pricing / Quotation for an "Own" user shows only their own quotations.

## Files
New: `js/role-core.mjs`, `js/role-service.mjs`, `js/permissions-ui.js`, `tests/role-service.test.mjs`,
`tests/browser/permissions.e2e.mjs`, `tests/emulator/roles.test.mjs`.
Changed: `index.html`, `sw.js` (bizcore-shell-v27042), `js/users.js`, `css/users.css`, `js/user-core.mjs`,
`js/user-service.mjs`, `js/so-view.js`, `js/app.js`, `js/account-service.mjs`, `js/invoice-service.mjs`,
`js/purchase-service.mjs`, `js/receipt-service.mjs` (version tag), `firestore.rules` + `emulator/firestore.rules`,
`tests/browser/harness.mjs` (roles seeded; test logins get a "Test Staff" role with every module; **the read rules are
simulated** — a test fails if BizCore asks for records the role can't read), `tests/emulator/staff-seed.mjs` (roles).

## Going live with this version
1. On the PC: `RUN_EMULATOR_TESTS.bat` (rules changed; new roles.test.mjs).
2. Upload the files in the `_upload` folder (GitHub).
3. Open BizCore and sign in as Musthafa → the built-in roles are created (Administration → Roles & Permissions).
4. Publish `firestore.rules` (Firebase Console → Firestore → Rules).
5. Check each user's role in Administration → Users; adjust the roles' permissions if needed.
