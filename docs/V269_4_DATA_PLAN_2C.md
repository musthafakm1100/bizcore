# V269.4 — Data plan step 2c: notification log, browser copies, "in use" checks, read count

Built 19 Oct 2026 with the choices Musthafa approved. **Website files only — no rules change, nothing to publish.**
This finishes data plan step 2 (2a V269.1, 2b V269.3, 2c V269.4).

## 1. Delivery notification log (`operationalEvents`)
- BizCore reads only the **last 7 days** of the log (it read the whole log before, on every opening).
- In independent delivery mode (yours) **no new entries are written**: the Delivery Note listener already brings a
  confirmed delivery to every open BizCore, so the entry was never used. The log stops growing.
- Changed from the plan: entries older than 30 days are **not deleted** by the app — that needed a rules change, and with
  the log no longer growing it isn't needed. The old test entries go with the clean-up before go-live.

## 2. No browser copies of business lists
- Quotations, RFQs and Sales Orders are no longer copied into each browser (`dtq_quotations`, `dtq_rfqs`,
  `dtq_salesorders`); the old copies are removed when BizCore opens. Firebase's own offline cache keeps working offline.
- If Firebase can't be read at all, BizCore no longer fills the Quotations list with the built-in sample quotations.
- Masters and settings copies are unchanged (small).

## 3. "In use" checks for purchasing
Deleting a master now also asks Firebase (any age, one small read each):
- supplier → purchase invoices, supplier payments (advances);
- product → purchase invoices, stock.
(Before, these weren't checked at all — only quotations, RFQs and Sales Orders.)

## 4. Data Health: records read from Firebase
Administration → Data Health → "Records loaded when BizCore opens" has a new last row: records read in the first
minute ("when BizCore opened"), the total since, and the collections read most. Free allowance: 50,000 a day for
everyone together. Reads from the browser's own cache are free and not counted.

## Files
index.html, sw.js (bizcore-shell-v2694), js/app.js (?v=269.4), js/data-safety.js (?v=269.4).
Test: tests/browser/data-plan-2c.e2e.mjs (new).

## Going live
Upload index.html, sw.js, js/app.js, js/data-safety.js. Ctrl+F5. No rules to publish.
