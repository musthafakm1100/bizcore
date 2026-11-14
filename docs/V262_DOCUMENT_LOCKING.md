# BizCore V262: Document Locking (Phase 2, Step 1)

**Status (12 Oct 2026):** **LIVE** on `bizcore-downtown` and GitHub Pages as build **V263** (V262 + new module URLs and a startup guard after a stale-cache incident). Emulator 14/14 on the owner's PC; administrator configured in `system/accessControl`; rules published (previous rules saved at `C:\secure\rules-before-v262.txt`); live checks passed (settings, Active Locks, second-window takeover, normal DN work).

**Not yet done:**
- Firebase Emulator rules tests: these must run on the owner's PC.
- Deployment to the live database.

Design reference: `PHASE2_INVOICING_AND_LOCKING_DESIGN.md`, section 1.

## What changes for users
- **Sales Order actions take a lock on the order.** Opening any of these windows takes the lock:
  - Edit Order,
  - Dispatch delivery,
  - Confirm / Correct / Revise acceptance,
  - Correct / Void dispatch,
  - Create invoice,
  - Record payment,
  - Delete.
- **Another user who tries to change the same order** sees *"Document in use: Musthafa is working on this sales order — Creating an invoice. Since 10:42."*
  - They can view and print, but they can't change anything.
- **The lock is released** when the window closes (after save, cancel or Esc).
- **Automatic expiry:** if the browser stops responding (crash, power cut, closed tab), the lock expires after the configured time (default 2 minutes).
- **Idle handling:**
  - After *idle − warning* minutes without activity, the user sees "Are you still working?".
  - At the idle limit (default 15 minutes) the lock is released and the window closes. Unsaved entries in that window are lost.
- **Same user, two windows:** the newest window gets the lock. The older window closes with "Editing lock lost".
- **Fresh data:** when a lock is granted, the order is reloaded from the server before the window opens.
- **Quotations and RFQs:** they keep their editor lock, now governed by the same settings, and each can be switched off.
- **Accepted below invoiced:** a correction, revision or void that would reduce an accepted quantity below what is already invoiced is refused. The message is "… already invoiced … cancel the invoice or issue a credit note first".

## Administration
- **Administration → Security → Document Locking:**
  - idle time (5–120 min),
  - idle warning (1–5 min, must be before the idle release),
  - expiry when the browser stops responding (1–10 min),
  - quotation and RFQ locks on/off.

  Values are stored in `settings/locking`, apply to every user immediately (to locks taken afterwards), and every change is recorded in `settings/locking/changes`.
- **Administration → Security → Active Locks:** a live list showing document, user, activity, since and last active.
  - Administrators see a **Release** button. It requires a reason and is logged in `lockEvents`.
- **Who is an administrator:**
  - Server-trusted list `system/accessControl.adminUids`, maintained in the Firebase Console. The app can't write `system`, so nobody can make themselves an administrator.
  - Non-administrators see the settings read-only, together with their own user ID, so it can be added to the list.

## How it is enforced
| Layer | Check |
|---|---|
| App | The action window opens only after the lock is granted. Heartbeat, idle timers and loss detection run while it's open |
| Delivery Note service | Inside every transaction: the order lock must belong to this user **and this window**, otherwise `lock-required` |
| Security rules | DN / event / ledger writes, and Sales Order changes to `items`, `invoices`, `payments` or `deliveries`, plus Sales Order delete: refused unless the writer holds a **live** lock. Liveness = `heartbeatAt` (server time) + `ttlSec` > now |
| Lock rules | A user can only write a lock in their own name, with `heartbeatAt` = server time and `ttlSec` 30–600 (10-minute outer cap) |
| Lock rules | A live lock of another user can't be overwritten or deleted. Expired or old-format locks can. Administrators can force-delete |
| Settings rules | `settings/locking` is writable only by administrators, with the same ranges validated in the rules |

Header-only Sales Order edits (for example notes or PO number) and creating a new Sales Order don't need a lock. Background saves now write one Sales Order at a time, so a locked order can't block others.

## Files
- **New:** `js/lock-service.mjs`.
- **Changed:**
  - `js/delivery-service.mjs` (order lock, below-invoiced guard),
  - `js/delivery-core.mjs` (`invoicedQtyByLine`, error codes),
  - `index.html` (lock service, settings and access listeners, `fbSave` `onlyIds`, server fetch, Administration tabs),
  - `js/app.js` (locking UI, Sales Order action wrappers, scoped saves with failure handling, settings and Locks screens),
  - `firestore.rules`,
  - `sw.js`.
- **Version:** all module URLs are `?v=262`. The service-worker cache is `bizcore-shell-v262`.

## Tests
- **`npm test`: 44/44 passed.**
  - Includes 12 new lock tests:
    - settings validation,
    - grant and refusal with holder/activity,
    - same user in another window,
    - expiry and takeover,
    - old-format locks,
    - release and force release with log,
    - race between two users,
    - `lock-required` for dispatch and acceptance,
    - stale window,
    - below-invoiced for correction, revision and void.
- **`npm run test:browser`: 16/16 passed.**
  - The DN workflow now covers:
    - the order lock across two users (Bob dispatches, Alice blocked from dispatch **and** invoice, then free again),
    - a correction blocked for another user,
    - a second window of the same user taking over.
  - New `locking.e2e.mjs` covers:
    - the below-invoiced refusal in the UI,
    - the Active Locks screen,
    - an administrator force release (the holder's window closes),
    - non-administrator read-only settings,
    - settings validation and saving with history,
    - live propagation to other users,
    - the idle warning and idle release.
- **`npm run test:parity`: passed.** In legacy mode V262 still stores the same structure as V259.
- **Emulator: `tests/emulator/rules-and-service.test.mjs` updated (13 tests) — to be run on the owner's PC.** The tests cover:
  - the existing tests, now using locks,
  - a lock race between 6 users,
  - a live lock that can't be taken, deleted or forged (cap, client time, wrong ID),
  - expired and old-format locks,
  - Sales Order business changes and delete requiring the lock,
  - administrator-only force release, `lockEvents` and settings.

  `migration-admin.test.mjs` was updated to take the lock.

## Deployment order (live)
1. Emulator suite on the PC: `npm run test:emulator`. All tests must pass; this is the first real check of the new rules.
2. Firebase Console → Firestore:
   - create the document `system/accessControl` with the field `adminUids` (array) containing the administrator's **User UID**,
   - find the UID under Authentication → Users.
3. Deploy the app files (GitHub Pages and the localhost folder). Do this **before** the rules: V261 browsers don't take locks and would be refused by the new rules.
4. Firestore → Rules:
   - save the current rules,
   - paste `firestore.rules`,
   - click **Publish**.
5. Everyone presses Ctrl+F5.
6. Check:
   - Administration → Document Locking is editable for the administrator,
   - Active Locks shows a lock while a Sales Order window is open,
   - a second browser (another user, or the same user in another window) is blocked or takes over as described.

**Rollback:** re-publish the saved rules and redeploy the previous app files. No data migration is involved; the lock documents are disposable.

## Release note — V263 (12 Oct 2026)
After the V262 upload, one browser kept an old cached `delivery-core.mjs` (served before GitHub Pages finished publishing) and the app hung on "Loading". V263 gives every module a new URL (`?v=263`) and adds a startup guard: if the modules fail to load, after 20 s the loading screen shows "BizCore could not start" with a **Reload with latest files** button (clears this site's caches/service worker). **Every future release must bump the module version token in `index.html`, `js/delivery-service.mjs` and `sw.js`.**
