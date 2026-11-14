# BizCore V271.13 — Work Completion Certificates and job invoicing (13 Nov 2026)

The last step of Contracting Basics. A contracting job can now be certified by the customer and invoiced:
**advance · progress · full & final**. Built from the approved mockups WCC_1 – WCC_4 and JI_1 – JI_3.
Details: `docs/V271_13_WCC_INVOICING.md`.

## 1. Work Completion Certificate (WCC)

A new document, **WCC-YYMM-NNNN**, made from the Job view. It carries **no prices**: the job's accepted scope
lines (the frozen copy) each with a completion %.

- **Partial** (a stage) or **Final** (every line at 100 %).
- The lines come with the % the customer already certified; a line can never go back below it.
- Only **one certificate at a time** waits for the customer, and none after the work is finally certified.
- **Record Acceptance:** Accepted · Accepted with remarks · Not accepted (a reason is required). Who accepted it
  and when is recorded — no file is uploaded; keep the signed paper copy with the job file.
- Locked once decided. It can be cancelled with a reason while nothing has been invoiced against it.
- The view **is** the Print / PDF copy (A4 frame + the staff panel), like the quotation view.
  The PDF file name is `WCC-2611-0004 - SNC Lavalin Arabia - PO2200005124`.

## 2. Job invoices

Job invoices are ordinary tax invoices, so they appear in the invoice register, in Payment Receipts, in
receivables and on the Dashboard with no change — they show the **job number** where a Sales Order invoice shows
the order number.

- **Advance** — % of the contract or an amount.
- **Progress** — an accepted certificate, % of the contract, or an amount. The certificate is remembered on the
  invoice and printed in the reference strip.
- **Full & Final** — bills everything still open and deducts the whole remaining advance; nothing to type.
- The advance deduction is suggested in proportion, following the existing Administration → Billing method.
- A job is **never billed more than its contract value**, and a credit note on a job invoice reverses its share
  of the advance deduction, so the job's position stays right.
- The printed invoice has one lump-sum line, the advance as its own negative line, and a short contract summary.
- The same permissions as a Sales Order: a job **advance** follows Billing Settings → *Advance invoices* (and the
  Special Right *Issue advance invoices*), a job **credit note** follows *Credit notes*. The screen disables the choice
  and the rules refuse it.

## 3. Job view → Completion & Billing (new tab)

Four cards: **Work done** (from the site) · **Certified** (accepted certificates) · **Invoiced** · **Received**.
Then the certificates (with what each certifies and the invoice that billed it), the job invoices with their
payment state, and a "Needs attention" note. The Overview tab gets a short billing summary, and the Jobs
register's **To Invoice** tile now counts jobs with contract value left to bill (it was a dash).

## 4. Administration → Billing Settings

New: **"Final invoice of a contracting job"** — *a warning only* (default), or *needs a final Work Completion
Certificate accepted by the customer*. The Sales Order billing rules are unchanged.

## 5. Before uploading

**The rules changed** (new `workCompletionCertificates`, `wccEvents` and `jobBilling`; the invoice and credit-note
rules now allow a job invoice, which has no Sales Order lock):

1. Run **RUN_EMULATOR_TESTS.bat** on your PC — the new test is `tests/emulator/wcc-billing.test.mjs`.
2. **Publish the rules** in the Firebase console.
3. Then upload the files.

New document type in **Administration → Numbering**: *Work Completion Certificate* (`WCC`, monthly) — it appears
with its default on its own; no action is needed unless you want another prefix.

## 5a. V271.13.1 — fix after upload (14 Nov)

**+ New WCC** and **+ New Job Invoice** said *"Job JOB-…-0001 was not found."* The new screens looked for the job in
a list the Jobs module keeps to itself; they now ask the Jobs module (`BCJobs.list()`), as the rest of BizCore does.
The same fix applies to the job's link on an invoice, its PDF file name, and a receipt's document flow.
Files: `js/job-billing-ui.js`, `js/invoicing.js`, `js/receipts.js`, `index.html`, `sw.js` (cache `bizcore-shell-v27113-1`).
No rules change.

## 5b. V271.13.3 — the seven changes from live testing (14 Nov)

All of them are in the Job's **Completion & Billing** tab and the certificate; no rules change, no data change.

**1 · Nothing over 100 %.** On *New WCC* the "Completed to date" field now corrects itself while it is typed —
anything above 100 becomes 100, and letters are dropped. **↑ and ↓ move between the rows** (and Enter steps to the
next one), so a long scope is filled in without the mouse.

**2 · The certificate view matches the other document views.** The A4 page now uses the quotation's own
typography — the same 10 px body, 9.5 px line text, 8 px table head, the same box headings and the same
terms-style panel at the bottom — and the page sits beside the staff panel exactly as a quotation or an invoice does.

**3 · The action bar is the quotation's.** Right-aligned on a white footer, equal-size buttons, *Print / PDF* as the
primary one at the end, *Cancel WCC* in red before it, and the job's own button next to *Close*. (The shared rules
only covered the invoice and the delivery-note views, so the certificate had none of them.)

**4 · The scope of work prints exactly as on the quotation.** Sections **A**, **B**… with their sub-text, lines
numbered **A1, A2, B1**…, the full accepted description (bold title, the extra lines, the italics) and the **Qty**
and **UOM** columns, followed by **Completed** and **Status**. The certificate keeps its own copy of this, so it
always prints as it was certified. Certificates made before this version keep printing their flat line numbers.

**5 · Graphite for the customer's copy.** The printed certificate uses the **Graphite** theme (#2f3a45) chosen from
the seven options: formal and quiet, prints well in black and white, and lets the blue logo stand out. The logo and
the screens are unchanged.

**6 · "+ New Job Invoice" works again.** It did nothing and said nothing: a line added in V271.13 replaced
`window.permState` with a copy of itself, so the screen died silently (this also affected the Sales Order invoice
screens). The line is gone and a browser test now opens the window on every run.

**7 · The Completion & Billing tab is re-arranged.** One **Contract position** card — a single bar the three
positions share, with the open certificate marked on it, and the five figures under it; one full-width
**Needs attention** banner with *Record acceptance* on it; then the two tables at full width with a count beside
each title, an **Open ›** link on every row and a **Total** row under the invoices.

Files: `js/wcc-core.mjs`, `js/job-billing-ui.js`, `css/wcc.css`, `js/invoicing.js`, `index.html`,
`sw.js` (cache `bizcore-shell-v271133-1`). Tests: `tests/wcc-core.test.mjs` (3 new),
`tests/browser/wcc-v27113.e2e.mjs` (the seven changes are checked in the real app).


## 6. The package is tidier

The loose notes in the main folder (59 `RELEASE_*.md` and the review / fix notes) moved to **`docs/releases/`**,
with `docs/releases/README.md` as an index — version, file and what it covers, newest first. The main folder now
holds only the application, the settings files, the run scripts, `README.md` and the current release note. Nothing
in the app reads those files, so this changes nothing in BizCore; on GitHub they can stay where they are.

## 7. `icons/` is back in the package

The app icons (`icons/bizcore-icon-*.png`, the two maskable PNGs and the two SVGs) were missing from the packages —
they are on GitHub, so the live app was never affected, but running the folder on localhost left the icons blank
and, because `sw.js` caches `bizcore-icon-192.png` and `-512.png` as part of the app shell, the service worker
failed to install. The folder is in the full set again.

## Files

New: `js/wcc-core.mjs`, `js/wcc-service.mjs`, `js/job-billing-core.mjs`, `js/job-invoice-service.mjs`,
`js/job-billing-ui.js`, `css/wcc.css`, `docs/V271_13_WCC_INVOICING.md`,
`tests/wcc-core.test.mjs`, `tests/job-billing-core.test.mjs`, `tests/job-billing-service.test.mjs`,
`tests/emulator/wcc-billing.test.mjs`.
Changed: `index.html`, `sw.js` (cache `bizcore-shell-v27113`), `firestore.rules`, `js/app.js`, `js/jobs.js`,
`js/invoicing.js`, `js/receipts.js`, `js/receipt-core.mjs`, `js/receipt-service.mjs`, `js/invoice-service.mjs`.
A receipt allocation carries `jobId` / `jobNo` **only** for a contracting job invoice, so a Sales Order
allocation is written exactly as it was before this version.

## Tests

**Unit tests:** `npm test` runs **221 tests — all pass.** The 55 new ones are the certificate rules (17), the money
(23) and the transactions against an in-memory Firestore (15); the rest is your existing suite, including every
invoice and receipt test. Four tests that were on disk but not in the list (`phase23-number-sort`,
`phase5a-allocation`, `sorting-v2714`, `supplier-monitor-amounts`) are now listed — they pass.

**Browser tests (the real app in Chromium, fake Firestore):** run on V271.12 and on V271.13 and compared —
**no test fails on V271.13 that passes on V271.12.** 95 of 100 pass. The same 5 fail on both versions, so they are
older tests that no longer match screens redesigned since V271.5 (compact document views, Quotation Entry,
Contracting Estimation, quotation from the estimate, the register filter bar) — worth refreshing when convenient.

**Emulator (rules) tests:** `RUN_EMULATOR_TESTS.bat` — 19 files, now including `wcc-billing.test.mjs` (12 tests). Run on your PC
before publishing the rules (the emulator cannot be downloaded in Claude's workspace).

**The `tests/` folder is back in the full package,** complete from the newest copy (V271.8.1 full) plus this
version's tests. Four browser tests listed in `package.json` were never in any package
(`quote-estlink-v27182`, `theme-v27183`, `service-quote-v2719`, `v27110` — those versions were delivered as GitHub-only
sets); they may still be on the laptop.

## Not in this version (as agreed)

Retention · variations (extra work after the PO) · uploading the signed certificate · the supplier side of a job.
