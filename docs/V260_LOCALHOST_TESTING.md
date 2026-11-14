# BizCore V260 — Localhost Testing Instructions

V260 runs in three ways on your PC. **Option 1 is the safest way to test the new Delivery Notes.**

## Option 1 — Local Firebase Emulator (recommended; no live data at all)
Requirements: Node.js 18+, Java 11+, Python (for `start_server.bat`).
```bat
cd emulator
npm install                      (first time)
START_EMULATOR.bat               (keep this window open; Emulator UI: http://127.0.0.1:4000)
SEED_EMULATOR.bat --independent  (another window: users + quotations, new-DN mode)
   or SEED_EMULATOR.bat --legacy-sample   to rehearse the migration (see the runbook)
cd ..
start_server.bat
```
Open **http://localhost:8000/login.html?emulator=1** and sign in as `alice@bizcore.test` / `Test1234!` (second user: `bob@bizcore.test`). An orange **EMULATOR** badge confirms you are on local data (project `demo-bizcore`). To return to the live project: open any page with `?emulator=0`.

### Suggested manual checklist (two browsers: Chrome as Alice, Edge as Bob)
1. Create a Sales Order from Q-2610-9001.
2. Create a DN with partial quantities; create a second DN against the same SO.
3. In Bob's window open *Create DN* for the same SO; in Alice's window dispatch the remaining balance; save Bob's → refused ("exceeds the ordered quantity").
4. Correct dispatch (change, add, remove a line) and Void another DN → history shows both.
5. Confirm a DN fully; confirm another partially with rejected quantity and reason.
6. Correct and Revise acceptance → History panel shows original, correction, revision with reasons.
7. Open the same DN's correction in both windows; save Alice, then Bob → Bob refused, sees latest version.
8. Print both formats; scan/copy the QR link → opens the confirmation screen.
9. Create an invoice from accepted quantities.
10. Try to edit/delete an SO that has DNs → refused.
11. Emulator UI → `salesOrders/<id>`: no `deliveries` field; `deliveryNotes/<id>/…Events` hold the history; `salesOrderFulfillment/<id>` holds the balances.
12. Try editing an event in the Emulator UI *as the app would*: not possible from the app (rules), only from the admin UI.

## Option 2 — Live test project (as before)
`start_server.bat` → http://localhost:8000. With no `system/deliveryNoteStorage` document the database is in **legacy mode** and V260 behaves exactly like V259 (verified by the parity test). The new Delivery Note model is only active after the migration/cutover described in the runbook — **that changes live data and needs your approval.**

## Option 3 — Automated tests
```bat
npm install                      (installs Playwright for the browser tests)
npx playwright install chromium  (first time)
npm test                         (29 simulator tests: service + migration)
npm run test:browser             (real app in Chromium against the simulator, two users)
set V259_DIR=C:\path\to\V259 && npm run test:parity
npm run test:emulator            (security rules + real transactions; needs Java)
```

## Deploying to GitHub Pages
Upload the application files only: `index.html`, `login.html`, `delivery.html`, `sw.js`, `manifest.json`, `favicon.ico`, `css/`, `js/`, `icons/`. The `tools/`, `tests/`, `emulator/` and `docs/` folders are not needed on the website (harmless, but keep them out of the public site if you prefer). **Never** place a service-account key inside the BizCore folder (`.gitignore` excludes `service-account*.json` and backups as a safety net).
After deploying, users may need one refresh (Ctrl+F5) for the new service worker (`bizcore-shell-v260`).
