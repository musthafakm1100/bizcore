# BizCore V260 — Database Migration & Recovery Runbook

> **Every step that changes a database needs your explicit go-ahead.** Rehearse the whole runbook on the **local emulator** first (section A), then on live test data (section B). Nothing here has been run against `bizcore-downtown`.

## Concepts
* **Mode** (`system/deliveryNoteStorage.mode`): `legacy` → `migrating` (write freeze) → `independent`. Only this tool changes it; every change is logged in `system/deliveryNoteStorage/changes`.
* The migration is **additive and resumable**: it adds `lineId` to SO lines and creates DN/event/ledger documents; it never deletes or edits embedded DNs. Embedded copies are removed only by the separate **strip** step (after cutover, with a backup).
* Write commands are dry runs unless you add `--confirm <projectId>` with the exact project ID.

## Prerequisites (your PC)
1. Node.js 18+ (and Java 11+ for the emulator).
2. `cd tools/dn-migration && npm install`
3. **Live only:** a service-account key (Firebase Console → Project settings → Service accounts → Generate new private key). Store it **outside** the BizCore folder (e.g. `C:\secure\bizcore-sa.json`). Never commit or upload it. Delete it when finished.
4. Deploy V260 to localhost/GitHub Pages **before** cutover (V260 in legacy mode behaves exactly like V259), then run
   `node cli.mjs init --project bizcore-downtown --credentials … --confirm bizcore-downtown` once. It only writes
   `system/deliveryNoteStorage = { mode: "legacy" }`, so browsers that start offline can trust their cached mode
   (without it, an offline first start opens Sales Orders/DNs read-only until the server answers).
5. Do not work offline across the cutover: changes queued offline under the old mode are refused by the rules afterwards.

## A. Rehearsal on the local emulator (no live data)
```bat
cd emulator && npm install && START_EMULATOR.bat          REM window 1
cd emulator && SEED_EMULATOR.bat --legacy-sample          REM window 2: users + V259-style data
start_server.bat  → http://localhost:8000/login.html?emulator=1   (alice@bizcore.test / Test1234!)
set FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
cd tools\dn-migration
node cli.mjs status    --project demo-bizcore
node cli.mjs backup    --project demo-bizcore --out rehearsal-backup.json
node cli.mjs preflight --project demo-bizcore
node cli.mjs migrate   --project demo-bizcore --backup rehearsal-backup.json --confirm demo-bizcore
   → the open app shows "read-only (maintenance)". Check data in the emulator UI (http://127.0.0.1:4000).
node cli.mjs cutover   --project demo-bizcore --confirm demo-bizcore
   → the open app reloads into independent mode. Test the screens (see LOCALHOST_TESTING).
node cli.mjs strip     --project demo-bizcore --backup rehearsal-backup.json --confirm demo-bizcore
node cli.mjs reconcile --project demo-bizcore
```
Also rehearse recovery: `rollback`, `unfreeze`, `restore` (section D) and `npm run test:emulator` for the rules.

## B. Live migration (`bizcore-downtown`)
Do this at a quiet time; tell users the app will be read-only for a few minutes.

| Step | Command (add `--credentials C:\secure\bizcore-sa.json`) | Approval | Check |
|---|---|---|---|
| 1 | `node cli.mjs status --project bizcore-downtown` | read-only | mode `legacy`; counts look right |
| 2 | `node cli.mjs backup --project bizcore-downtown --out C:\secure\bizcore-pre-v260.json` | read-only | file written; copy it to a second location (USB/OneDrive). Optionally also a managed export: `gcloud firestore export gs://<bucket>/pre-v260` |
| 3 | `node cli.mjs preflight --project bizcore-downtown --report preflight.json` | read-only | **0 blockers**. Note `SO-1790077442719` appears as the largest SO. Warnings reviewed |
| 4 | `node cli.mjs migrate --project bizcore-downtown --backup C:\secure\bizcore-pre-v260.json --confirm bizcore-downtown` | **YES** | "Verification passed"; mode `migrating` (users read-only) |
| 5 | Spot-check in the Firestore console: a few `deliveryNotes`, their events, `salesOrderFulfillment` | — | DN numbers, quantities, statuses match V259 screens |
| 6 | Deploy and test `firestore.rules` (section C) | **YES** | emulator suite green first |
| 7 | `node cli.mjs cutover --project bizcore-downtown --confirm bizcore-downtown` | **YES** | mode `independent`; open apps reload |
| 8 | Smoke test: open DN-2610-0002, correct it, confirm another DN, create a DN | — | succeeds; SO document small |
| 9 | `node cli.mjs backup …` then `node cli.mjs strip --backup <that file> --confirm bizcore-downtown` | **YES** | embedded copies removed |
| 10 | `node cli.mjs reconcile --project bizcore-downtown` | read-only | `ok: true` |

If step 4 reports blockers, the database stays read-only: fix the data (or decide) and re-run `migrate` (idempotent), or `unfreeze` to return to normal.

**Test-data reset alternative** (your plan to reset test data before go-live): with an empty or reset database, run `backup`, `migrate` (assigns line IDs to any SOs; nothing else to copy) and `cutover` — the database then starts directly in independent mode.

## C. Security rules deployment
1. On your PC: `npm run test:emulator` → all tests must pass.
2. Firebase Console → Firestore → Rules → paste `firestore.rules` → **Publish** (or `firebase deploy --only firestore:rules`). Keep a copy of the current rules first.
3. Rules work in legacy mode too (they only add protections), so deploy them before cutover. If anything breaks, re-publish the saved previous rules.

## D. Recovery procedures
| Situation | Action |
|---|---|
| Migration interrupted (crash, network) | Re-run the same `migrate` command — completed documents are skipped, nothing duplicated |
| Blockers / you want to stop before cutover | `unfreeze` → back to `legacy`; V259 behaviour; migrated documents stay inert (re-migration verifies them) |
| Problem after cutover, **before strip, no new DN activity** | `rollback` → `legacy`. Refused automatically if anything new was recorded |
| Problem after new activity or after strip | `restore --backup <pre-migration file> --confirm …` restores Sales Orders and sets `legacy`. **Transactions entered after the backup must be re-entered** — the tool lists them in its refusal message; export them first (`backup`) |
| `reconcile` reports a ledger mismatch | Investigate first (which DN, which line). `repair-ledgers --confirm …` recomputes ledgers from DNs under a short freeze |
| Old cached app writing V259 data after cutover | Blocked by rules (no embedded deliveries). Ask the user to reload (Ctrl+F5) |

Backups are JSON files with a SHA-256 checksum; `restore` rejects modified files. Keep the pre-migration backup for at least the retention period your auditors require.
