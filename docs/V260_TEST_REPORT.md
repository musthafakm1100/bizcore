# BizCore ERP V260 — Tests Performed & Results

**Date:** 2026-10-11. **Environment:** Linux build workspace, Node 22, Chromium 141 (Playwright 1.56.1).

## What kind of test is what

| Category | What it is | Ran here? |
|---|---|---|
| **Simulator** | In-memory Firestore written for these tests (`tests/support/fake-firestore.mjs`). Optimistic transactions with version checks and retries, atomic batches, listeners, 1 MiB limit, fault injection (fail before commit / commit-but-lose-acknowledgement), async latency so concurrent operations genuinely interleave. **Not** Google's emulator. | ✅ |
| **Browser integration** | The real `index.html` + `js/app.js` in Chromium; Firebase SDK URLs answered by test doubles that forward every call to ONE shared simulator, so two browser pages are two users on one database. Real screens, real buttons. | ✅ |
| **Firebase Emulator** | Google's Firestore emulator enforcing `firestore.rules`, real SDK transactions, real Admin SDK migration. | ✅ **Run on the owner's PC (Windows, Node 24) on 2026-10-11: 9 / 9 passed** |
| **Live Firebase** | Your `bizcore-downtown` project. | ❌ **Not run** — no live data was read or changed (requires your approval). |

## Results

### Simulator — `npm test` → **30 / 30 passed** (15 consecutive clean runs; randomised/concurrency subset 25 further clean runs)

Service (19): partial dispatch (SO document byte-identical afterwards) · multiple DNs, sequential numbers · over-dispatch rejected atomically (no DN, event, counter or ledger change) · invalid input (zero/negative/NaN/unknown/duplicate line, bad date, short operation ID) · missing/legacy references (no SO, un-migrated SO, SO without line IDs, unknown DN, signed-out user) · **duplicate request after lost acknowledgement** (no second DN, number or ledger change; same for corrections) · **rollback** (failure before commit writes nothing) · correction incl. add/remove lines, reason required, balance enforced, before-snapshot kept · void releases quantity, voided DN immutable · full / partial / rejected acceptance, rejected qty re-dispatchable, reason and totals enforced server-side · acceptance correction & revision with history, cannot push accepted beyond ordered · stale revision refused · **8 users dispatching the same line at once** (exactly 3 succeed, unique numbers, conflicts really occurred) · correction racing acceptance (exactly one wins, ledger reconciles) · **150 corrections + 60 DNs**: SO size unchanged, DN < 64 KiB, ledger < 16 KiB · size guard refuses oversized DN · QR token persisted once · **randomised: 4 concurrent workers × 40 random operations × 3 seeds** — ledger always reconciles, one event per revision, no gaps · numbering continues from the existing counter.

Migration (11): `init` writes an explicit legacy mode once and never overrides an existing mode · preflight read-only and complete · planner deterministic and fail-closed (unlinkable item, invalid qty, duplicate DN ID, over-fulfilment, ambiguous SO lines) · **full lifecycle** backup → migrate (frozen) → verify → cutover → business continues → strip, with ID/number preservation, quantity reconciliation and audit history checked · un-migrated SO refused · **crash mid-migration → resume** (no duplicates; third run writes nothing) · pre-existing different document blocks migration; unfreeze returns to legacy · cutover refused if a migrated DN was altered · rollback before new activity restores legacy with source unchanged (only `lineId` added) · rollback refused after new activity or strip · restore from backup (tampered backup rejected by checksum) · **original failure reproduced:** SO near 1 MiB — one more legacy correction is rejected by the size limit; after migration + strip the SO is < 10 KB and 25 further corrections succeed · ledger tampering detected and repaired under a freeze.

### Browser integration — `npm run test:browser` / `test:parity` → **all passed** (workflow 11/11 steps, offline-mode 1/1, V259 parity 1/1)

`dn-workflow.e2e.mjs` (11 steps, two users):
1. **Legacy mode** (V259 behaviour): create SO, dispatch, partial acceptance, correction, void — DNs embedded in SO.
2. **Migration:** backup → migrate; open app reloads into read-only "migrating" (dispatch refused, no number consumed) → cutover; both users reload into independent mode.
3. Migrated DNs display exactly as before (numbers, statuses, quantities); dispatch history shows original dispatch + correction with reason.
4. New dispatch creates a DN document; **SO document byte-identical**; number continues (0004); ledger correct; second user sees it in real time.
5. **Two users:** Bob's dispatch screen opened before Alice dispatched the last 2 units → Bob is refused with "exceeds the ordered quantity"; ledger exact.
6. Partial acceptance with rejection reason → revision → correction; three acceptance events with reasons and actor; history panel shows them; Bob notified in real time.
7. **Stale screen:** Bob's correction dialog opened before Alice's correction → Bob refused ("changed by another user"); Alice's value kept, revision 2.
8. **Double click** → one DN. **Lost acknowledgement** → error shown, retry from the same screen reports "already saved"; still one DN; ledger exact.
9. Print (DN number present) · QR code contains a `delivery.html?t=<48 hex>` link · DN register count = stored DNs · **QR deep link** opens the confirmation screen for exactly that DN · invoice from accepted quantities (A 7, B 5) · SO edit refused (server ledger check).
10. Strip → no SO embeds deliveries; reload shows all DNs; reconciliation passes; **no SO write after cutover contained deliveries**.
11. No uncaught page errors in either browser.

`offline-mode.e2e.mjs`: storage mode withheld → app opens read-only; SO save refused with nothing written and no number consumed; when the mode arrives the app reloads into independent mode.

`invoice-remaining.e2e.mjs`: SO containing quotation lines 1 and 3 only → first invoice offers the correct accepted quantities (A 4, C 8); after a partial invoice an "Invoice remaining" button appears and offers the rest; once fully invoiced the button disappears. (The same scenario on V259 never offered line C.)

`embedded-images.e2e.mjs`: a quotation line holding a 70 KB embedded product picture is saved without it (Storage links kept); a Sales Order created from it contains no embedded picture; the product record keeps its picture and quotation printing still shows it (fallback to the product).

`legacy-parity.e2e.mjs`: identical screen actions on **V259** and **V260 (legacy mode)** produce identical stored Sales Order/DN structures (only difference: the new `lineId`).

### Firebase Emulator suite — **9 / 9 passed** (owner's PC, 2026-10-11)
Concurrency outcome with six simultaneous dispatches of 3 against 10 ordered: `ok, ok, ok, over-dispatch ×3` — ledger 9, three unique DN numbers, no duplicates. An earlier run showed the emulator answering contended commits with `permission-denied`; the service now retries contention outcomes (aborted / failed-precondition / permission-denied) with a short random back-off, which resolved it.

`tests/emulator/rules-and-service.test.mjs` (8) and `migration-admin.test.mjs` (1): unauthenticated denial; existing modules unchanged; legacy-mode refusal of independent writes; full workflow through the real service **passing the rules**; immutable events / no DN edit without event / no deletes / no ledger tampering / no forged actor / immutable identity fields; cutover guards (no re-embedding, no SO delete with activity, system admin-only, freeze); 6 parallel dispatches on real transactions; idempotent retry & stale revision; Admin-SDK migration → cutover → strip → client operations under rules. The files load and fail only at the emulator connection (checked).

### V262 Document Locking (11 Oct 2026, this workspace)
* `npm test` **44 / 44** (12 new lock tests), `npm run test:browser` **16 / 16** (DN workflow adapted to order locks + new `locking.e2e.mjs`), `npm run test:parity` **passed**.
* Emulator suite **14 / 14 passed** on the owner's PC (12 Oct 2026): rules for locks (cap, forged, expired, old-format), lock race (6 users → exactly one holder), SO business changes/delete require the lock, admin-only force release/settings, 6 parallel dispatches by the lock holder → 3 ok / 3 over-dispatch. The PERMISSION_DENIED lines in the log are the expected refusals. Details: `V262_DOCUMENT_LOCKING.md`.

## Not tested (and why)
* Rules evaluation, real SDK transaction behaviour, Admin SDK adapter — need the emulator (run on your PC).
* Live Firebase, real network latency/offline persistence of the real SDK, GitHub Pages hosting, service-worker upgrade of already-installed PWAs, mobile devices, printing on paper/PDF.
* Performance at 3 years of data (thousands of DNs in one listener) — architecture supports it, not measured.
* Modules outside the DN scope beyond smoke (no page errors) and parity.
