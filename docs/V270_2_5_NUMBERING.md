# V270.2.5 — Document Numbering: number format and sequence reset set separately (24 Oct 2026)

Mockups NUM_1 / NUM_2 (approved). Administration → Numbering & Defaults → Document Numbering.

## What the user sets, per document type
| Setting | Choices |
|---|---|
| Prefix | letters / digits, up to 8 (typed in lower case → capitals) |
| Date part | None · YY · YYYY · YYMM · YYMMDD |
| Separators | after the prefix, after the date: `-` `/` `.` or none (the second is off when there is no date part) |
| Digits | 3 · 4 · 5 · 6 |
| Sequence reset | YYMM / YYMMDD → Yearly, Monthly, Never · YY / YYYY → Yearly, Never · None → Never only |

Examples: `RFQ-YYMM-####`, `RFQ-YYMM####` (= RFQ-26100028), `RFQ/YYYY/#####`, `RFQYYMM-####`.
The order is always prefix → date → sequence.

## Screen (NUM_2)
- Rows grouped **Sales** / **Purchases**; each row: Prefix, Date part, Separators, Digits, Sequence reset,
  Format pattern + next number. Changed rows show **Changed**.
- **Apply to all documents** bar (date part, separators, digits, reset; prefixes untouched).
- Panel for the selected row: next number with prefix / date / sequence highlighted; **How the sequence runs**
  (today, next month, new year); **Change on Save** (old pattern, which counter is used, where numbering continues).
  Beside the table when the screen is wide, above it otherwise (one column on a phone).
- **Discard changes** / **Save Numbering** (active only with changes); Save asks for confirmation listing each change.
- Sequence Management follows the reset: "Current period" shows e.g. *Oct 2026*, *2026* or *Continuous*; counter and
  next number use the chosen digits.

## How numbers are made
- Number = prefix + sep1 + date part + sep2 + sequence (padded to the digits).
- **The date part comes from the document date** (RFQ date received, quotation date, SO date, DN / invoice / receipt
  / PI / payment date). Quotation now also uses its quotation date (it used today's date).
- **The reset picks the counter**, with the same keys as before: monthly `doc_<type>_YYMM`, yearly `doc_<type>_YY`,
  never `doc_<type>_all`. Settings that are not changed keep counting exactly as before.
- **Old settings** (prefix + reset only) are read with the date part the reset used to give: monthly → YYMM,
  yearly → YY, never → none; separators `-`, 4 digits. Nothing to convert.
- **No repeated numbers after a change:** every new number is above (a) the counter and (b) the highest existing
  number of that type that reads the same in front of the sequence **ignoring separators** (RFQ-2610-0028 and
  RFQ-26100028 count as the same). Only sequences up to the chosen digits count, so switching between formats without
  separators does not cause a big jump. The check is done inside the same transaction as the counter
  (`nextSequence` in js/numbering.mjs), for every document type: RFQ, Quotation, Sales Order (cloud counter),
  Delivery Note, Customer Invoice, Credit Note, Payment Receipt, Purchase Invoice, Supplier Payment (services), and the
  final number of documents created offline.
  - Example: RFQ was `RFQ-YYMM-####` monthly with RFQ-2610-0001…0028 issued. Changed to `RFQ-YYMM####` yearly →
    next is **RFQ-26100029** (the yearly counter is new, the existing October numbers are skipped).
  - "Existing numbers" are the records loaded in BizCore (open records + the last 12 months, V269.1). A change that
    could repeat a number older than that would need a document dated more than 12 months back.
- Issued numbers are never changed. Quotation revisions keep the `-R1`, `-R2` suffix.
- Offline numbers always contain `-OFF-` whatever separators are chosen (e.g. `RFQ2610-OFF-ab12-12345`).
- **Pricing** and **Purchase Order** rows are kept on the screen, but nothing allocates numbers from them yet
  (Pricing numbers are `PRC-<RFQ no>-V<n>`; Purchase Orders are not built) — unchanged.

## Files
- js/app.js — numbering settings, parts, floor, screen, Sequence Management; quotation number from the quotation date.
- js/numbering.mjs — `formatSequence`, `nextSequence`, `numberingFloor`, `sequenceDigits`; offline final numbers use
  digits + floor.
- js/delivery-service.mjs, js/invoice-service.mjs, js/receipt-service.mjs, js/purchase-service.mjs — digits + floor.
- js/invoicing.js, js/purchases.js, js/receipts.js — pass digits + floor.
- index.html — screen markup; `getNextDocSequence(counterKey, floor)`; asset versions.
- css/numbering-controls.css — screen styles. sw.js — `bizcore-shell-v27025`.

## Tests
- tests/browser/numbering-format.e2e.mjs (new): old settings read as before; screen rows, preview, Changed, allowed
  resets, discard, save; RFQ-YYMM#### yearly continues above existing RFQ-YYMM-0003; document date of last month;
  YYYY / 5 digits / slash; offline number keeps "-OFF-"; Sequence Management period.
- tests/numbering.test.mjs: digits, floor, offline final number with digits + floor.
- tests/delivery-service.test.mjs: DN with 5 digits and floor inside the transaction.

No security-rule change. Upload: see the list under Files.
