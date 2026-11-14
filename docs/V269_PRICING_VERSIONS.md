# V269 — Pricing versions in their own documents (data plan step 1)

Built 18 Oct 2026. Musthafa chose option A: keep pricing version history (V1 → V2 → V3) and change only how it is stored.
Because all data is test data, there is **no migration tool, no backup file, no check report and no storage switch**.

## What is stored where
```
rfqs/{id}                       RFQ header + the CURRENT version's working copy (pricingItems, internalCosts, vendorQuotes,
                                pricingAttachment, internalNotes, supplier fields) — as before
   currentPricingVersion: 2
   pricingIndex: [ {version, status, revisionReason, previousVersion, created, updated, convertedDate, quotationId,
                    supplierName, supplierId, supRef, supDate, lineCount, materialCost, extraCost, totalSell, supplierRefs[]} ]
   pricingProductRefs: [ {productId, code, desc} ]   ← products used by the earlier versions ("product in use" check)
   (pricingVersions[] is gone)
rfqs/{id}/pricingVersions/v1    the full version: lines, costs, vendor quotes, attachment, notes + the index fields
rfqs/{id}/pricingVersions/v2
```

## How it works
- **Saving** (`saveRFQs` in js/app.js): an RFQ whose pricing changed is written **on its own, together with its version
  document(s), in one batch** (`FB.fbSaveRecordWith` in index.html). Other changed RFQs are saved as before.
- **Fixed versions:** a Converted / Superseded / Cancelled version is never rewritten; when a newer version is converted,
  the older one gets only its new status (merge write). The rules enforce this.
- **Reading:** lists, registers, the Pricing register, supplier/product "in use" checks and the supplier profile use only
  the RFQ document (the index). An older version is read **only when it is opened** (Pricing register row, Excel export
  with lines, Purchase Invoice estimate) and is then kept in memory for the session (`pvCache`).
- **Opening an older version** shows it read-only and **no longer changes the RFQ** (before V269 it moved the RFQ's current
  version back to the old one in memory, and the next save stored that). "Revise pricing" from that view still starts the
  new version from the version shown.
- **Offline / not found:** a clear message ("You are offline. Connect to open pricing V1." / "…could not be loaded…").
- **Purchase Invoices:** the estimate comes from the version the quotation was made from. Opening New Purchase Invoice reads
  those versions ahead (only for orders with something still to buy, only when it is not the current version). Until it is
  read, the last paid price is used.
- **Old RFQs** (with the embedded `pricingVersions[]` array) are readable straight away and are moved to their own
  documents automatically the next time RFQs are saved (often at start-up). No action needed.
- **Delete:** an RFQ with any pricing version still can't be deleted (Close as No Bid instead), so version documents are
  never left behind.

## Not done (on purpose)
- Backup & Restore (Administration) does not include the version documents — the backup file holds the RFQs with their
  current version only.
- The rules don't check that the RFQ is in the same batch (would cost an extra read per save).

## Files
index.html (fbSaveRecordWith, fbSyncedJSON, fbReadDoc, fbReadAll; fbSave `skipIds`; ?v=269), js/app.js (pricing version
layer at the top; saveRFQs; pricing save / reorder auto-save / revise / convert / register / export / supplier & product
checks / RFQ edit / delete), js/purchases.js (estimate + read-ahead), sw.js (bizcore-shell-v269), firestore.rules and
emulator/firestore.rules (rfqs/{id}/pricingVersions/{vid}).

Tests: tests/browser/pricing-versions.e2e.mjs (new), tests/emulator/pricing-versions.test.mjs (new — run on the PC).

## Going live
1. Run `RUN_EMULATOR_TESTS.bat` on the PC (the new rules are in pricing-versions.test.mjs).
2. Publish firestore.rules (Firebase Console → Firestore → Rules). Don't upload it to GitHub.
3. Upload: index.html, sw.js, js/app.js, js/purchases.js.
Publish the rules **before** uploading the files: the new files write version documents, which the old rules refuse.
