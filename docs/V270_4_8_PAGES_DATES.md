# V270.4.8 — Footer at the bottom of every page · PO in PDF names · BizCore date field everywhere (30 Oct 2026)

Agreed with Musthafa on 30 Oct.

## 1. Document footer at the bottom of every page — screen, PDF and print, every document, every device
Musthafa set the footer at the page bottom on purpose; V270.4.7's iPhone "footer after the content" was wrong and is gone
(`js/print-ios.js` removed). Mockup approved 30 Oct with: footer as low as is safe for printers, text spread from the
left margin to the right, a clear gap between the table and the footer.

**Print / PDF** — `js/doc-pages.js` (new, `window.BCPages`). The print window lays the document out on real A4 pages
itself before printing (browsers differ: Chrome let table rows run under its pinned footer, iPhone Safari dropped it):
- A4 page boxes; content from 10 mm top, 11 mm sides (12 mm service quotation);
- footer line **8 mm** above the bottom edge (printers can't print the last 4–5 mm);
- at least **8 mm** white space between the content and the footer line;
- an item table that doesn't fit continues on the next page with its header repeated (a table footer only on the last
  part); other blocks move to the next page whole;
- footer text spread left → right (company parts); **"Page X of Y"** at the right end when there is more than one page;
- the print rules are applied while measuring, so what is measured is what is printed; `@page { margin: 0 }`, so
  Chrome's own header / footer lines are not printed either;
- iPhone / iPad: the pages print at 71% (`IOS_ZOOM`), because Safari prints ~20% larger and keeps its own margins —
  **to be confirmed with a test print on the iPhone** (Safari's own address / date line can't be removed by a page).
- Used by: Delivery Note, Invoice, Credit Note, Payment Receipt (`BCPages.DN`), Quotation ERP / image / bilingual
  templates (`BCPages.ERP_QUOTE`, incl. attachment pages), Quotation service template (`BCPages.SERVICE_QUOTE`).
  Internal prints (SO status, Cash statement) and old templates not in the gallery are unchanged.

**Screen** — the A4 sheet in the Delivery Note / Invoice / Credit Note / Receipt / Quotation views: footer at the bottom
of the sheet (8 mm), spread left → right, at least 8 mm below the content (`css/main.css`).
The company footer is now made of parts (`docFooterPartsHtml`, `.dfp` parts with `.dfs` " | " separators).

## 2. PDF file names with the customer PO number
- Delivery Note: `DN-2610-0003 - SNC Lavalin Arabia - PO2200005124` — every format (no "Accepted - Standard / Progress").
- Invoice: `INV-2610-0001 - SNC Lavalin Arabia - PO2200005124` (the invoice's PO no., else the order's).
- No PO number → no PO part. A PO typed as "PO-123" / "P.O. No: 123" gives "PO123" (`docPoFilePart`).

## 3. BizCore date field everywhere
Every remaining plain date box is now the BizCore date field (DD-MM-YYYY, type it or pick from the calendar — as on
Pricing), including the filter dates (Dashboard, register custom range, Cash statement) and My Cash:
Sales Order, Delivery Note dispatch / correction, New / Edit Invoice, Credit Note, Receipt, Payment, Purchase invoice /
edit / payment, Supplier payment / edit, Payment account, cash handover, Stock adjustment, Employee expiries, Tax dates.
- `js/bc-date.js`: `BCDate.upgrade()` — automatic for every `<input type="date">`, also in windows built later. The
  screen's code is unchanged: the field's `.value` still gives / takes ISO (YYYY-MM-DD); the box shows DD-MM-YYYY;
  `min` / `max` keep limiting the calendar. Stored data unchanged.

## Files to upload
index.html, sw.js (`bizcore-shell-v27051`), mycash.html, **js/doc-pages.js (new)**, js/bc-date.js, js/app.js,
js/invoicing.js, js/receipts.js, css/main.css — and **delete js/print-ios.js** on GitHub if V270.4.7 was uploaded
(harmless if left). Cumulative folder `BizCore_V270.4.8_upload` (since V270.4.3). No rules, no data, no Firebase change.

## Tests
`tests/browser/v27048-pages-dates.e2e.mjs` (new): no plain date box left; ISO value / DD-MM-YYYY box, typing, calendar,
windows built later; DN (all formats) and Invoice file names; screen footer position; DN, Invoice, both Quotation
families with 40 lines → 2 A4 pages, footer 8 mm from the bottom, ≥ 8 mm gap, spread margin to margin, header on both
pages, "Page 1 of 2 / 2 of 2". `phone-menu-print.e2e.mjs` updated (every print window carries the page layout).
Tests that read a date box's text now expect DD-MM-YYYY.

## Try
1. PC: DN-2610-0004 → Print / PDF: footer at the page bottom, spread across; file name with the PO number.
2. A quotation with many lines (or any 2-page document): rows stop above the footer, page 2 repeats the header, "Page 1 of 2".
3. iPhone: the same PDF — send it if anything is off (the 71% value can be tuned).
4. Any screen with a date: type 151026 → 15-10-2026; 📅 picks a date; saving works as before.

## V270.4.8.1 — date field fixes (30 Oct 2026, reported by Musthafa)
1. New RFQ: calendar open, date typed in the box, Tab → the calendar stayed open. Now leaving the field (Tab, Enter or a
   click elsewhere) closes its calendar; focus moving into the calendar keeps it open.
2. Date filters (e.g. registers' "All Dates" → Custom range): picking a day in the calendar closed the whole filter box
   (the calendar sits on the page, so its click counted as "outside"). The calendar now handles its own clicks and
   keeps them from the page; a mouse press in it keeps the focus in the field. From and To can both be picked; Apply closes.
Files: js/bc-date.js (?v=270.52), index.html, mycash.html, sw.js (`bizcore-shell-v27052`).
Test: tests/browser/v27048-pages-dates.e2e.mjs, second test (fails on V270.4.8, passes now).
