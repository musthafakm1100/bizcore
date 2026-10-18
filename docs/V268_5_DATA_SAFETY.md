# V268.5 — Data safety, administrator approval, pickers, New Product / New Unit, Change Item (18 Oct 2026)

Built from the approved mockups V5_1 – V5_6.

## 1. Settings that were saved only in one browser → Firebase
Found by the audit (18 Oct): these were kept in the browser of the PC where they were set, never in Firebase.

| Setting | Browser key (kept as a copy) | Firebase | Who may change |
|---|---|---|---|
| Units of Measure | bizcore_uom_master | sharedSettings/units | Everyone (as in Master Data) |
| Tax master | bizcoreTaxMaster | sharedSettings/taxMaster | Administrators |
| Pricing settings | bizcorePricingSettings | sharedSettings/pricing | Administrators |
| Margin statuses | bizcoreMarginStatuses | sharedSettings/marginStatuses | Administrators |
| Cost components | bizcore_cost_components | sharedSettings/costComponents | Administrators |
| Quick-add delivery / payment terms | dtq_delivery_terms / dtq_payment_terms | deliveryTerms / paymentTerms (as before) | Everyone |

- Every save writes Firebase (one document per setting, `revision` +1, who and when). Every PC and phone listens and updates its copy.
- Offline: the change stays on the PC and is sent when the connection is back ("Waiting to send" in Data Health).
- Staff changing an administrator setting: refused at once and put back (the rules refuse it too).
- **Terms:** a term added from a quotation is now saved to Firebase straight away. Older quick-add terms could not be recovered: BizCore replaced the browser copy with the Firebase list each time it started, so terms that never reached Firebase were already gone.

### Move settings to Firebase (administrators, once)
When an administrator opens V268.5, a window lists what is only in this browser next to what is in Firebase.
- **Move** downloads a backup file first (`BizCore_settings_backup_<date>.json`), then saves.
- Where Firebase already has something different, you choose: keep this browser's / keep Firebase's (Firebase's is preselected).
- **Later** hides it until the next login; Administration → Data Health has a button to open it again.
- **Do this on your PC first** (it holds the correct values). Other PCs then take the Firebase values; the old browser copy is kept as `bc_shared_old_<key>` in that browser, just in case.

## 2. No PIN; the old User Management removed
- Removed: the browser-only "User accounts" list (with passwords), the Roles & Permissions tab, the admin PIN (default 1234) and "Change admin PIN". The move deletes `bizcore_users`, `bizcore_roles`, `dtq_admin_pin` from the browser (they are in the backup file, without the passwords).
- Administration → Backup & Restore is open to **administrators** (system/accessControl.adminUids), no PIN.
- The Users tab keeps **Cash custodian logins**. A proper Firebase Users & Roles screen comes later.
- Backups (Export all data) no longer contain the old users; they now contain the shared settings.

## 3. Manager approval from an administrator's own login
When the pricing margin is below the minimum and "manager approval" is on:
- An **administrator** saving → approved at once (recorded with their name).
- **Staff** → "Ask an administrator" (choose who, optional note) → `approvals/{id}` Pending → the administrator gets a notification → Approve / Decline (optional note) → the requester gets a notification → save again.
- An approval is for that pricing version (PR-…-Vn) and that margin or better. A lower margin needs a new approval.
- The pricing records `pricingApprovedBy`, `pricingApprovedAt`, `pricingApprovalId`.
- Administrator names come from `userDirectory` (every login writes itself). An administrator who has not logged in since V267.2 shows as "Administrator (uid…)".

## 4. Administration → Data Health
Shows whether anything is left only in this browser, and when / by whom each shared setting was last saved. Lists what is kept in the browser on purpose (theme, font size, sidebar, rows per page, last page, drafts, notifications seen).

## 5. Type-and-search pickers (mockup V5_1)
Same look and keys as the customer picker on New Receipt (↑ ↓, Enter, Esc): Pay advance → Supplier and Sales order (search by SO no., customer or item; cancelled orders hidden; × clears), New Purchase Invoice → Supplier, Supplier Payments → supplier filter, Change Item → product.

## 6. Product required on stock lines + New Product (mockup V5_2)
- An "item for stock" on a purchase invoice must be a product from Master Data. Typed text that matches nothing shows an error and the invoice can't be saved (also checked by the service).
- **+ New Product** (bottom of the list): short form (name, code, category, unit, brand). Warns "Did you mean …?" for a look-alike name or the same code (Use it / add anyway). Saved to Products with `createdFrom: 'purchase-invoice'`, who and when.
- Administration → Purchase Settings → "+ New Product on a purchase invoice": Everyone (default) / Administrators only (a screen setting; Products can still be added in Master Data as before).

## 7. + New Unit in Add Product (mockup V5_3)
Short form (code, name, decimals, step); the code must be new; saved for everyone and selected. Also on the New Product form.

## 8. Change Item (mockup V5_4) — Purchasing → Stock → item
Administrators. The wrong item was chosen on a purchase invoice: part or all of the stock moves to the correct **existing** product with the **same unit**, at the same average cost; reason required. Both items get a movement ("Changed to → …" / "Changed from ← …"). Cancel (with a reason) puts it back while the stock is still on the new item. The purchase invoice is not changed. While stock of an invoice has moved, the invoice can't be cancelled (cancel the change first).
- New collection `stockChanges/{SC-…}`; rules: administrators only, coupled with both stock items and the two movements in one commit.

## Rules changed
`sharedSettings`, `approvals`, `stockChanges` (new); `stockItems` / `stockMovements` (Change Item coupling); `settings/purchasing` (newProductRight).
Run RUN_EMULATOR_TESTS.bat first (new file tests/emulator/data-safety.test.mjs + V268.5 tests in purchases.test.mjs), then publish firestore.rules. Don't upload firestore.rules to GitHub.

## Tests
Unit 120 / browser 44 pass here (new tests/browser/data-safety.e2e.mjs). Emulator tests: on your PC only.
