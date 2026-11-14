# V269.1 — Data plan step 2a: the sales side loads only open and recent records

Built 18 Oct 2026 from docs/DATA_PLAN_STEP2_RECENT_RECORDS.md (all 8 decisions as suggested). Website files only:
**no security-rule change, nothing to publish.**

## What is loaded when BizCore opens
| Records | Loaded | Also loaded (any age) |
|---|---|---|
| RFQs | dated in the last 12 months | status New / Pricing |
| Quotations | dated in the last 12 months | status Draft / Sent |
| Sales Orders | dated in the last 12 months | `isOpen == true` |
| Delivery notes | dated in the last 12 months | not confirmed (out for delivery) |
| Invoices, credit notes | dated in the last 12 months | — |
| Receipts | dated in the last 12 months | with unapplied money |
| Invoice payment records | changed in the last 12 months | — |

**Linked records come along**, by id: Sales Order → its quotation → its RFQ (and quotation revisions); an RFQ → its
quotations; a delivery note / invoice / credit note → its Sales Order; an invoice → its payment record and credit notes;
a payment record → its receipts; a receipt → its invoices. An **old Sales Order that is loaded** (still open, or read on
request) also brings **all its delivery notes, invoices and credit notes**. So every screen finds what it links to.

Masters (customers, suppliers, products, employees, terms, payment accounts) and purchasing / stock / cash are loaded in
full as before (purchasing, stock and cash come in part 2b).

## Older records — read only when asked
- **Date filter** on RFQs, Pricing, Quotations, Sales Orders, Delivery Notes, Invoices, Receipts: choosing **All Dates**
  (clicking it) or a date before the loaded period reads those records first ("Loading older records…"). The popup says
  what is loaded ("Loaded: open records and everything since DD-MM-YYYY…").
  *Changed from the plan:* the default stays "All Dates" (= what is loaded) instead of a new "Last 12 months" preset, so
  the filter bar looks exactly as before; the note in the popup explains it. Say if you want the count-line text instead
  (mockup first).
- **Search by number:** type a number in the register search and press **Enter** — older records with that number are read.
- **Dashboard:** clicking "All time", or a custom date before the period, reads the older quotations / RFQs / orders first.
- **Reports:** a line at the top "Figures include open records and everything since … · Include older records".
- **Backup** (Administration → Backup & Restore) reads all older records first, so the file is complete.
- Older records read once stay for the session.

## Sales Orders: the `isOpen` mark
A Sales Order is **open** until it is fully delivered (nothing out for delivery, all quantity accepted), fully invoiced
and every invoice is settled. BizCore keeps the mark right by itself (`bcHealOpenOrders`, 8 s after start and every
minute): when it sees a loaded order whose mark is wrong it changes only that field (one small write). New orders are
saved with `isOpen: true`. A finished order that is older than the period therefore isn't read any more; if it reopens
(e.g. a credit note), that happens on a loaded order and the mark is updated.
Old test orders without the mark that are older than the period aren't loaded (as agreed, no conversion).

## Delete checks for masters
Before a customer, product or supplier is moved to the Recycle Bin, BizCore now also asks Firebase whether a record that
isn't loaded uses it (quotations / RFQs / sales orders by customer id or name; products and suppliers through the new
`productIds`, `productCodes`, `supplierIds` lists that are saved with each document from now on). Offline → the delete
is refused with "could not be checked".

## Administration → Data Health
New card "Records loaded when BizCore opens": the number of months (administrators; default 12, takes effect the next
time BizCore opens) and how many records of each kind are loaded now, and how many of them are older (read on request /
linked).

## Safety
- The screens get the same lists as before; no screen code was changed to read data.
- A record that leaves the loaded period (e.g. an old quotation marked Lost) is **kept**, never treated as deleted: BizCore
  checks the server and drops it from the screen only if it really was deleted.
- When Firebase answers with an empty list for quotations / RFQs / orders, BizCore no longer fills it from the browser's
  old copy or the built-in sample quotations (that fallback is now only for "Firebase could not be read").
- Records BizCore reads itself (start-up, linked, older) don't show "updated by another user".

## Not in this part (2b / 2c)
Purchasing, stock, cash (running balances, last price) — 2b. Delivery notification log, browser copies of lists,
read count at start-up — 2c. Customer / supplier profiles count only loaded records ("all transactions" on request comes
with 2c). The Excel exports export what the register shows (after "All Dates" they include the older records).

## Files
index.html (BCWin store, routing of fbLoad / fbListen / DN / invoice / receipt listeners, fbMergeFields, productIds
stamping, ?v=269.1), js/app.js (isOpen, older-on-request hooks, delete check, Reports note, backup, empty-list fallback),
js/ui-standard.js (date filter hook + note), js/data-safety.js (Data Health card), css/shell.css (note styles),
sw.js (bizcore-shell-v2691). Tests: tests/browser/data-window.e2e.mjs (new); fake database: range / array-contains
operators. tests/browser/data-safety.e2e.mjs: its test RFQ got a date and status.

## Going live
Upload: index.html, sw.js, js/app.js, js/ui-standard.js, js/data-safety.js, css/shell.css. No rules to publish.
