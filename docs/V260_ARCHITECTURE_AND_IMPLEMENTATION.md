# BizCore ERP V260 — Architecture & Implementation Summary

**Scope:** Delivery Note (DN) data-architecture modernisation, migration tooling, security foundation.
**Baseline:** V259 (kept unchanged). **Status:** integrated testing package — *not deployed, not run against live Firebase.*

---

## 1. What was wrong (evidence from the V260 package as received)

| # | Finding | Evidence | Consequence |
|---|---|---|---|
| 1 | Independent mode could never be switched on | `createDeliveryStorageBridge().activate()` required three flags that no code ever set | Every save still embedded DNs in the SO; **the 1 MiB failure was not fixed** |
| 2 | Sales Order lines had no stable ID | `lineId` existed only on Pricing lines; SO create/edit never assigned one | Independent dispatch would fail on every SO; the migration planner would block on all data |
| 3 | "Correct Dispatch" crashed in independent mode | `let next;` inside the branch hid the outer `next` → `next.items` of `undefined` | Correction impossible; service also rejected adding/removing lines that the UI allows |
| 4 | Lost-update race on the ledger | DN transactions wrote the ledger *into the SO document*, while every ordinary SO save (`fbSave`) overwrote the whole SO from the browser copy | A stale browser could silently erase the ledger → over-dispatch |
| 5 | Browser-controlled records | Service accepted the complete DN object from the browser (`next`) | DN number, dates, confirmer etc. could be altered by any client |
| 6 | Duplicate DNs on retry | DN ID `'DN-'+Date.now()` and DN number allocated per attempt | A committed-but-unacknowledged save, retried, created a second DN and number |
| 7 | Wrong-record risk | Modals addressed DNs by array position; projection sorted by date | Another user's new DN could shift positions → a save hitting a different DN |
| 8 | N+1 reads | `project()` ran one query per SO on every SO snapshot | Hundreds of reads per change |
| 9 | Switch-over not controlled | Mode was per-browser; no migration writer/backup/verify/rollback; no rules | Old V259 tabs could keep embedding DNs; no recovery path |
| 10 | Tests did not test the risk | 43 unit tests with a mock that never simulated concurrent commits; no app integration | Defects 1–8 were invisible to the test suite |

Additional defects found and fixed during this work (by the new tests):
dialogs used the DN revision at *save* time instead of *open* time (a second user could overwrite a change without warning); a dispatch attempted during the migration freeze consumed a DN number; a torn read inside a transaction could report a misleading "ledger disagrees" error; an offline first start could guess "legacy" for a cut-over database.

## 2. Data model (schemaVersion 3)

```
salesOrders/{soId}                         header + items[]  (every line has an immutable lineId)
                                           NO deliveries, NO audit arrays
salesOrderFulfillment/{soId}               bounded ledger, one entry per SO line:
                                           lines.{lineId} = { inTransit, accepted, rejected }
deliveryNotes/{dnId}                       one physical DN (current state, revision, lastEventId)
deliveryNotes/{dnId}/dispatchEvents/{id}   immutable: dispatch, correct, void
deliveryNotes/{dnId}/acceptanceEvents/{id} immutable: confirmation, correction, revision
system/deliveryNoteStorage                 { mode: legacy | migrating | independent, minClientVersion }
counters/{key}                             unchanged — DN numbers continue the existing sequence
```

* **Remaining to dispatch = ordered − inTransit − accepted.** Rejected quantity becomes available for redelivery (same rule as V259).
* **Line identity:** new SO lines get a random opaque `lineId` (`L-xxxxxxxxxxxx`); edits keep the ID of the same quotation line. Existing lines get a deterministic ID frozen from V259's own link key (`L-q<origIdx>`, or `L-r<row>` for very old SOs), so migration is repeatable.
* **Size:** the SO no longer grows with delivery activity at all. A DN holds only its current state; each change is a separate small event. Guards: DN < 512 KiB, event < 256 KiB, ledger < 256 KiB, ≤ 400 lines per DN — all far below Firestore's 1 MiB.

## 3. How a Delivery Note operation works (`js/delivery-service.mjs`)

Every operation is **one Firestore transaction**:

1. **Read** (ledger and SO first, then DN and event) — authoritative server copies, never browser-computed balances.
2. **Apply a whitelisted change** — the browser sends intent only: `{lineId, qty}` for dispatch/correction, `{lineId, acceptedQty, rejectedQty, reason…}` for acceptance. DN display data is copied from the SO line read inside the transaction.
3. **Validate** — quantities, reasons, state rules (no change after acceptance, voided DNs immutable, revision must match the screen the user saw), and the ledger (`inTransit + accepted ≤ ordered` whenever committed quantity grows).
4. **Write atomically** — DN (revision + 1, `lastEventId`), one immutable event (before/after snapshots, ledger deltas, actor, `recordedAt` = server time), the ledger, and for a new DN the number counter.

| Property | Mechanism |
|---|---|
| No over-dispatch | Ledger checked and written in the same serialisable transaction as the DN |
| Concurrent users | Firestore transactions re-run on conflict; losing operation re-validates against fresh data |
| Stale screens | `expectedRevision` captured when the dialog opens; mismatch → "changed by another user", dialog reopens with latest data |
| Idempotency | DN ID = `DN-<operationId>`, event ID = `<kind>-<operationId>`; a retried operation finds its own document and returns `alreadyApplied` — no second DN, no second number |
| Audit | Every revision has exactly one event; events are create-only (rules) |
| Rollback | Business errors throw before any write; Firestore commits all-or-nothing |
| Errors | `DeliveryError` with codes (`over-dispatch`, `stale-revision`, `invalid-state`, `size-limit`, …); size errors are never shown as "network" errors |

`js/delivery-core.mjs` holds the shared pure rules (identity, quantities, ledger maths, snapshots, read model, reconciliation) used by the app, the migration tool and the tests.

## 4. Application integration (`index.html`, `js/app.js`)

* **Storage mode** is read from `system/deliveryNoteStorage` after sign-in. `legacy` (or absent) → V259 behaviour, byte-for-byte (verified by the parity test). `migrating` → all SO/DN writes refused up-front (no document numbers consumed). `independent` → new model. If the server never confirms the mode (offline first start), the app opens **read-only** and reloads when the mode arrives. A mode change while open triggers an automatic reload.
* **Read model:** one real-time listener on `deliveryNotes` (not one query per SO). DNs are projected into `so.deliveries` **for display only**, in creation order, so all existing screens (SO view, DN register, dashboard KPIs, print, invoice eligibility, QR links, notifications) keep working. Projected deliveries are stripped before any SO save — in `saveSalesOrders`, again in the `fbSave` persistence guard, and (after cutover) by security rules.
* **Screens switched to transactions:** create DN, correct dispatch (add/remove/change lines), void, confirm acceptance (full/partial/rejected), correct confirmation, revise acceptance, QR token for older DNs. All dialogs address the DN by **stable ID** and use the revision captured when they opened.
* **History:** dispatch and acceptance history are loaded from the event subcollections when a DN is opened.
* **Protection:** SO edit/delete checks the server ledger (not just the possibly-incomplete local view). Browser backup *restore* is disabled in independent mode (it cannot restore DNs/events/ledgers consistently — the admin tool does that). Backup *export* includes DNs.
* **Unchanged:** RFQ, Pricing, Quotation, Masters, Administration, Recycle Bin, invoice creation logic.

## 5. Migration tool (`tools/dn-migration/`)

`planMigration` (pure, deterministic) → `engine.mjs` (backup, preflight, migrate, verify, reconcile, cutover, strip, unfreeze, rollback, restore, repair-ledgers) → `cli.mjs` (Admin SDK; production or emulator). Keeps original DN IDs and numbers; converts each legacy history entry into an immutable event (plus the implicit initial dispatch/confirmation), recomputes ledgers, and fails closed on anything ambiguous. Full procedure: `V260_MIGRATION_AND_RECOVERY_RUNBOOK.md`.

## 6. Security rules (`firestore.rules`)

Role management is postponed, so every signed-in employee keeps today's access to existing modules. Added, role-independent integrity rules:

* audit events: **create-only**, must reference the DN revision written in the same commit, actor must be the signed-in user, timestamp must be server time;
* DN: create/update only with a new event **and** the ledger in the same commit; revision must increase by exactly 1; identity fields immutable; voided DNs frozen; **no deletes**;
* ledger: only together with a DN change and a new event; **no deletes**;
* after cutover, SOs cannot embed `deliveries` (blocks old cached V259 clients); an SO with delivery activity cannot be deleted; during `migrating` SOs are read-only;
* `system/*` and `migrationRuns/*`: read-only to the app (admin tool only);
* there is **no catch-all rule** (Firestore rules are OR-ed — a catch-all would reopen everything).

⚠️ The rules have **not yet been executed in the Firebase Emulator** (the emulator download is blocked in the build environment). `tests/emulator/` contains the suite to run on your PC before deployment.

## 7. Files

| File | Status |
|---|---|
| `js/delivery-core.mjs` | **new** — domain rules, read model, reconciliation |
| `js/delivery-service.mjs` | **new** — transactional DN service |
| `js/delivery-migration.mjs` | **new** — deterministic migration planner/verifier |
| `js/app.js`, `index.html` | integrated (see §4); emulator switch for localhost |
| `login.html`, `delivery.html` | emulator switch only |
| `sw.js` | cache `bizcore-shell-v260`, new modules cached |
| `firestore.rules` | **new** — see §6 |
| `tools/dn-migration/` | **new** — admin migration/recovery CLI |
| `emulator/` | **new** — local emulator kit (seed users/sample data) |
| `tests/` | **new** — simulator, unit, migration, browser, emulator suites |
| removed | `delivery-repository / -storage-bridge / -read-model / -reservation / -cutover-plan / -migration-preflight / -transaction-service .mjs` and their tests (superseded; valid ideas carried over) |
