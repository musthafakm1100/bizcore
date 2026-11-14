# V266.6 — Register toolbar, top bar and small screen fixes (14 Oct 2026)

All approved by Musthafa from pictures on 14 Oct. Screen-only: no database, rules or Firebase changes.

## Registers (RFQs, Pricing, Quotations, Sales Orders, Delivery Notes, Invoices, Payment Receipts)
- Page header removed (title only in the top bar). Sort list removed (click a column; lists open newest first).
- Main button (New Quotation / New RFQ / Start Pricing / Create from Quotation / New Receipt) moved to the end of the filter bar.
- Filter bar is one line, 48 px, at every desktop / laptop / landscape-tablet width: fields shrink → Clear and Export icon-only (tooltips) → count hidden → main button "+" only. Below 860 px it may wrap (phones / portrait tablets — V266.7).
- Sticky offsets corrected for the removed header (filter bar at 0, table header at 48 px, monitors at 0).
- New Excel icon (original drawing, fixed green) on the export buttons and export dialogs.
- Numbers, dates, amounts and statuses no longer wrap in the register tables.

## Top bar and sidebar (`css/shell.css`, new)
- Top bar "B": very light theme tint, white search box. Top bar and logo area both 56 px (lowered from 64 px on 14 Oct).
- Breadcrumb "1": title 17 px bold + full breadcrumb at 12 px underneath; no longer clipped.
- Sidebar collapse button: inside the logo area (open) / centred row under the logo (collapsed) — fully visible, never on the logo.

## Small fixes
- Small labels 10 → 11.5 px and darker (monitor section labels and subtitles, Sales Order progress steps, Customer PO captions).
- Dates on screen DD-MM-YYYY everywhere: quotation "Valid until / Expires", employee document dates (were "21 Oct 2026" / "21/10/2026"). Date entry boxes unchanged (browser calendar).
- New Quotation: the first card is "Header information" again (the items heading code was renaming it "Quotation items").

## Known (for V266.7, phone / tablet)
- Portrait tablet (≈768 px) register layout: left shadow, folded monitor tab, empty band above the table, header over the first row — already so in V266.5.
- Phone registers show only two columns; cards planned.

## Files
New: `css/shell.css`, `tests/browser/shell.e2e.mjs`, this note. Changed: `index.html`, `js/app.js`, `css/register-standard.css`, `sw.js` (cache `bizcore-shell-v266g`), `package.json`, `tests/browser/registers.e2e.mjs`, `docs/UI_STANDARDS.md`, `docs/HANDOVER.md`.
Console: "Screens V266.6 ✅ …".

## Additions (14 Oct, after the first V266.6 package)
- Invoices and Payment Receipts registers use the same type scale as Quotations / Sales Orders: headings 12 px, rows 46 px, status badge 13 px, small tags 12 px, receipt amount regular (not bold).
- New Receipt button is navy like every other main button; the Receipt Monitor collapse button uses the same arrow as the other monitors.
- Top bar and sidebar logo area lowered to 56 px.
- Sidebar company name without "Est." (display only; documents keep the legal name).
- Notification bell: plain icon without the white box, red count badge.
- Files: index.html, sw.js (cache v266i), js/app.js, js/receipts.js, css/register-standard.css, css/shell.css.
