# BizCore V260: Delivery Note Data Architecture & Live Migration: Handover Summary

**Project:** BizCore (Downtown Trading Est.) · Firebase project `bizcore-downtown` · GitHub Pages `musthafakm1100.github.io/bizcore`
**Status (11 Oct 2026):** V260 is **live** on the Firebase database and deployed to GitHub Pages. The migration is complete and verified. The current app build is **app.js v261**.
**Note:** all data in the database is still **test data**, to be cleaned before real use.

This work started in ChatGPT (V260 Production Data Architecture brief, V259/V260 packages, audit and migration plan, DN integration inventory) and was completed with Claude.

---

## 1. Why the migration was needed
In V259, each Sales Order was **one Firestore document**, and every Delivery Note was stored **inside** it (`so.deliveries[]`). Each DN change also stored a full "before/after" snapshot of the SO lines.

Older products had their **pictures embedded as base64** (~70 KB), and those were copied into every line and snapshot. Because of that, SO `SO-1790077442719` reached **840 KB**. Correcting **DN-2610-0002** would have exceeded Firestore's **1 MiB document limit**, and the save failed.

There were also integrity problems:
- two users could dispatch the same order at the same time,
- an interrupted save could create duplicate DNs on retry,
- there was no tamper-proof history.

The V260 package received from the ChatGPT phase was found to be largely non-functional. It had dormant activation, no stable SO line IDs, a crash on correction, a ledger race and duplicate DNs on retry. The architecture was therefore rebuilt.

## 2. New data architecture (schema version 3)

| Collection | Purpose |
|---|---|
| `salesOrders/{id}` | The order only. Each line has a permanent `lineId`. **No `deliveries`** (stripped after cutover). |
| `deliveryNotes/{dnId}` | One document per DN, with a `revision` number. Max 400 lines / 512 KB (app-enforced). |
| `deliveryNotes/{dnId}/dispatchEvents/{id}` | Immutable history of dispatch, correction and void (create-only). |
| `deliveryNotes/{dnId}/acceptanceEvents/{id}` | Immutable history of customer confirmation and its corrections (create-only). |
| `salesOrderFulfillment/{soId}` | The **ledger**: `lines.{lineId} = {inTransit, accepted, rejected}`. Bounded size. |
| `system/deliveryNoteStorage` | `{ mode: legacy \| migrating \| independent, minClientVersion: 260 }`. Changed only by the admin tool. |
| `migrationRuns/{id}` | Record of each migration run. |

**How writes work:**
- Every DN action (dispatch, correct, void, confirm acceptance) is **one Firestore transaction**. It reads the ledger and SO first, checks quantities, and then writes the DN, a new event and the ledger together.
- **The browser sends intent only.** Totals are recomputed inside the transaction.
- **Idempotency:** the DN id is `DN-<operationKey>` and the event id is `<kind>-<operationKey>`. A retried save never creates a duplicate.
- **Concurrency:** over-dispatch is refused against the ledger. A stale dialog is refused with "changed by another user" through `expectedRevision`. Contention is retried automatically.
- **Read model:** the app listens to `deliveryNotes` and projects them into `so.deliveries` **for display only**; the projection is stripped before any SO save.

**Security rules** (`firestore.rules`, published live):
- Collections are listed explicitly, with **no catch-all** rule.
- Events are create-only.
- A DN can change only together with a new event, the ledger and an incremented revision.
- DNs, events and ledgers can never be deleted.
- After cutover, SOs can't re-embed DNs, which blocks old cached V259 clients.
- SOs are read-only during the migration freeze.
- The storage-mode document is admin-only.
- Existing modules keep their current access for signed-in users. Role management is postponed.

## 3. Main code files

| File | Role |
|---|---|
| `js/delivery-core.mjs` | Domain rules, ledger maths, limits, snapshots, projections, legacy line IDs |
| `js/delivery-service.mjs` | Transactional service: `dispatch`, `correctDispatch`, `voidDispatch`, `recordAcceptance`, with retries |
| `js/delivery-migration.mjs` | Deterministic migration planner and verifier (`v260-dn-1`) |
| `js/app.js` | UI integration: DN screens, readable dispatch history, invoice fixes, freeze guards |
| `index.html` | Firebase setup, `BizCoreDN` mode listener, SO save guard, emulator switch, embedded-picture guard |
| `firestore.rules` | Security rules (published) |
| `tools/dn-migration/` | Admin CLI (Node + Admin SDK), with these commands: `status`, `init`, `backup`, `preflight`, `migrate`, `verify`, `reconcile`, `cutover`, `strip`, `unfreeze`, `rollback`, `restore`, `repair-ledgers` |
| `emulator/` | Local Firebase emulator setup with seed users and data |
| `tests/` | Simulator, browser (Playwright) and emulator test suites |

## 4. Other fixes made along the way
- **Readable Dispatch History:** a before/after table instead of raw JSON.
- **Invoice line mapping (also a V259 bug):** for an SO built from only some quotation lines, accepted quantities of later lines were never offered for invoicing. Fixed.
- **"Invoice remaining" button:** allows another invoice for the remaining accepted quantity.
- **Migration size handling:** legacy history snapshots are de-duplicated. Migrated events may be up to 900 KB, with a compaction fallback.
- **New DNs don't copy bulky fields** (such as embedded pictures) from SO lines.
- **Embedded-picture guard (app.js v261):** quotation, SO and RFQ lines store only a picture **link**, never an embedded `data:` picture. Printing falls back to the product picture.

## 5. Testing performed
- **Simulator tests:** 32/32 passed.
- **Browser tests** (real `index.html`/`app.js`): 15/15 passed, covering DN workflow, offline mode, partial invoicing and embedded pictures.
- **V259 parity test:** passed. In legacy mode, V260 stores the same structure as V259.
- **Firebase Emulator suite on the owner's PC:** 9/9 passed. It covered rules, real transactions and the Admin-SDK migration; six simultaneous dispatches produced no over-dispatch and no duplicates.
- **Full rehearsal on the local emulator:** migrate, cutover, manual tests, strip and reconcile, with `ok: true`.

## 6. Live migration log: `bizcore-downtown`, 11 Oct 2026
1. **Preflight:** 32 SOs (30 with deliveries), 44 embedded DNs, 6 legacy history entries, 91 planned events.
   - The first run found 2 blockers (oversized history events on DN-2610-0002). After the fix: **0 blockers, 0 warnings**.
2. **Security rules published.** The previous rules were saved to `C:\secure\rules-before-v260.txt`. V259 was checked working under the new rules.
3. **`init`:** mode set to `legacy`. V260 was checked on localhost against live data.
4. **Backup:** `C:\secure\bizcore-pre-v260.json`, with a second copy kept.
5. **`migrate`:** line IDs assigned on 31 SOs; 44 DNs, 91 events and 30 ledgers written. **Verification passed.**
6. **Firebase Console spot-check:** OK.
7. **`cutover`:** mode set to `independent`.
8. **Smoke test:** passed. DN-2610-0002 was viewed and corrected (the save that used to fail), a new DN was created and an acceptance was confirmed.
9. **Backup:** `C:\secure\bizcore-pre-strip.json` (536 documents). Then **`strip`** removed the embedded DNs from 30 SOs.
10. **`reconcile`:** `ok: true`, no problems, with 32 SOs and 45 DNs.
11. **GitHub Pages updated:** V260 deployed and confirmed with `BizCoreDN.mode` = `independent`.

## 7. Open items / next steps
- **P0: Customer Invoices.** Invoices (and later payments) are still embedded in the SO and saved by rewriting the whole SO, so two users can overwrite each other and the SO keeps growing. Next phase: `customerInvoices/{id}` plus an `invoiced` quantity in `salesOrderFulfillment`, written in one transaction (the DN pattern).
- **Test-data cleanup before going live:**
  - keep the security rules,
  - keep `system/deliveryNoteStorage` at `independent`,
  - reset the number counters,
  - clear the test records, including DNs, events and ledgers,
  - **re-upload or delete old product pictures** stored as embedded `data:image` (they need to move to Firebase Storage).
  
  A safe reset procedure is to be prepared when the time comes.
- **Service-account key:** revoke it in Google Cloud and delete `C:\secure\bizcore-sa.json` (if not already done).
- **Future modules:** Purchase Orders, Purchase Invoices and Payments should be built on the V260 pattern from the start (separate documents, immutable events, ledger, transactions).
- **Postponed:** User Role Management; ZATCA compliance (handled outside BizCore).

## 8. Reference documents (in the V260 package, `docs/` folder)
- `V260_ARCHITECTURE_AND_IMPLEMENTATION.md`: full design.
- `V260_MIGRATION_AND_RECOVERY_RUNBOOK.md`: migration and recovery procedures.
- `V260_TEST_REPORT.md`: all tests and results.
- `V260_OUTSTANDING_ISSUES_AND_READINESS.md`: known issues and production readiness.
- `V260_LOCALHOST_TESTING.md`: local and emulator testing guide.
- `V260_HANDOVER_SUMMARY.md`: this document.
