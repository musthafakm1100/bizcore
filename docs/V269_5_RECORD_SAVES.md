# V269.5 — Data plan step 3 + Recycle Bin (step 4): one record per save, revision check, Recycle Bin mark

Built 19 Oct 2026 with the choices Musthafa approved (19 Oct, 09:11). **Website files only — no rules change.**

## One record per save; nothing deleted by accident
- A save writes only the records that changed (as before) — and a record is **deleted from Firebase only when the app
  deletes it on purpose** (`fbMarkDeleted`: Delete RFQ, Delete Sales Order, delete a term). Before, any record missing
  from the screen's list was deleted on the next save of that list.

## Two people, one record (quotations, RFQs, Sales Orders)
- Each save stamps the record: `_rev` (counts saves), `_savedBy`, `_savedAt`.
- Before writing, BizCore reads the record (one read). If someone else saved it after the copy this screen has, the save
  is **refused** and the user sees: "Q-2610-0012 was changed by Aisha on 19/10, 10:32 after this screen read it. Your
  change was not saved — reload to see the latest version, then make your change again."
- Locks (V262) still stop two people editing the same Sales Order / quotation / RFQ; this check covers a slow
  connection or a screen that hadn't received the other save yet.
- Offline: saved without the check (Firebase sends it when back online), as before.
- Customers, products, suppliers, terms, employees: the last save wins (no check).
- Start-up upkeep of old records (relationship ids, VAT snapshot) doesn't show the message.

## Recycle Bin = a mark on the record
- Moving a quotation, customer, supplier, product or employee to the Recycle Bin now **keeps it in its own collection**
  with `_deletedAt` / `_deletedBy`; every list leaves it out (on every screen at once). Nothing is kept in the browser.
- The Recycle Bin reads the marked records from Firebase **when it is opened** (no reads at start-up any more).
- **Restore** removes the mark — the record is back everywhere.
- **Purge** and **Empty older than 90 days**: administrators only.
- The old `recycleBin` collection (test data) is no longer read.
- A deleted record is still counted by the "in use" check when deleting a master (e.g. a customer whose only quotation
  is in the Recycle Bin can't be deleted until that quotation is purged).

## Files
index.html, sw.js (bizcore-shell-v2695), js/app.js (?v=269.5).
Tests: tests/browser/record-saves.e2e.mjs (new); test doubles: deleteField().

## Going live
Upload index.html, sw.js, js/app.js. Ctrl+F5. No rules to publish.
