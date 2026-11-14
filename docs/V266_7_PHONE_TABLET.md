# V266.7 — Phone and tablet screens

Approved 14 Oct 2026 from the mockups (phone register, filter panel, Sales Order view; tablet portrait and landscape).

## Sizes
| Size | Width | Layout |
|---|---|---|
| Phone | ≤ 760 px | status chips · one-line toolbar (search, filter icon, Excel, +) · cards |
| Tablet portrait | 761–900 px | status chips · full toolbar on one line · table with the key columns · sidebar is a drawer (☰) |
| Tablet landscape / small laptop | 901–1279 px | sidebar starts as an icon rail, monitors start folded (until the user chooses) |
| Desktop | ≥ 1280 px | unchanged |

## How it works (no change to filtering, sorting or saving)
- `js/responsive.js` adds the pieces on top of the existing screens:
  - **Status chips** copy the monitor rows; a tap clicks the real monitor row. The last chip, **Summary**, moves the real monitor into a slide-up panel and puts it back on close.
  - **Filter icon** (phone) opens a slide-up panel with Customer, Status, Date (presets + custom range) and Sort. Each control drives the real toolbar control; the badge counts active filters. "Clear all" uses the page's own Clear button.
  - **Cards** (phone) are built from the table rows (column names come from the headings, per register in `REG`). A tap clicks the real row. Rebuilt whenever the table changes. Payment Receipts keeps its own cards; its floating button is replaced by the + in the toolbar.
  - **Tablet portrait** hides the less important columns per register (`tabletHide`).
  - **View / entry screens** (phone): when an action bar has more than 3 buttons, two stay (green + primary first) and the rest go under **⋯**. The Delivery Note view keeps its own phone bar.
  - **Order progress** (phone) shows "Step x of n · current step — Next: …" with a bar.
  - **A4 documents** (phone) are scaled to the screen width.
- `css/responsive.css` holds the layout (loaded after the other stylesheets).
- Fixed: at 761–900 px the sidebar stayed in the page and left a 240 px empty band; column headings stuck 48 px down over the first row when the table scrolls sideways.
- Sidebar: only a click on the collapse button is saved as the user's choice; the automatic tablet state is not saved. Monitors also start folded below 1280 px (was 1100) — Payment Receipts included.
- The new-button text in the toolbar turns into an icon below 800 px of toolbar width (was 720).

## Tests
`tests/browser/responsive.e2e.mjs` (chips, filter panel + badge, Summary, cards open documents, ⋯ menu, step line, tablet drawer, landscape rail and saved choice). `receipts.e2e.mjs` now expects the toolbar + instead of the floating button.

## Files
index.html, sw.js (cache `bizcore-shell-v2667a`), css/responsive.css (new), js/responsive.js (new), js/app.js, css/register-standard.css.

## V266.71 — fixes after testing on a Galaxy Tab A9 (14 Oct)
- Tablet landscape: the monitor sat 96 px down (gap above it) and scrolled away with the page. It now sticks to the top and scrolls on its own when taller than the screen.
- Column headings no longer cover the first row / leave an empty band when the table scrolls sideways (all widths below 1280 px). RFQs (table redrawn on every refresh) are set up again each time.
- The sidebar choice uses a new key (`bc_sidebar_pref`): the old key was saved automatically on every start, so tablets kept the full sidebar. Now tablets start with the icon rail until the user clicks the button.
- Very narrow toolbar (sidebar + monitor open): the date button shows only its icon so every button fits.
- Quotation, Invoice and Payment Receipt views below 900 px: **Document | Details** tabs like the Delivery Note view (Details first on a phone, Document first on a tablet); the A4 page is scaled to the width; Details shows the staff panel (status, figures, document flow, activity). Desktop and laptop views are unchanged (tested at 1366 and 1440 px).
- Console shows "Phone & tablet V266.7 ✅".
- Files: index.html, sw.js (cache `bizcore-shell-v2667b`), js/app.js, js/responsive.js, css/responsive.css, css/register-standard.css.

## V266.72 — Quotation, Invoice and Receipt documents as A4 on phone and tablet (14 Oct)
- The quotation document used to rearrange itself below 1100 px (boxes stacked one per row). Those small-screen rules were removed from `css/main.css` (they never applied above 1100 px, so desktop and laptop are unchanged): the page keeps its A4 layout and is scaled to the screen width — the same method as the Delivery Note view.
- Invoices and receipts likewise keep the A4 page size up to 1100 px and are scaled to fit.
- Phones no longer enlarge the document text (`text-size-adjust: 100%`).
- Checked: desktop (1366) quotation / invoice / receipt views and registers pixel-compared with V266.71 — only the "Back to…" label (navigation history) differs.
- Files: index.html, sw.js (cache `bizcore-shell-v2667c`), css/main.css, css/responsive.css, js/responsive.js (+ test harness option for real-phone emulation).

## V266.73 — Pricing on phone and tablet (14 Oct)
- Pricing register (and RFQs) scroll sideways on tablets (columns were cut off).
- RFQ monitor: the folded button sits at the top like on every other register (was 96 px down) — all screen sizes.
- Pricing document view below 900 px: **Details | Summary** tabs; the summary is a one-column list (label · amount); on a phone each line item is a small card (Qty, UOM, Buy, Sell, Profit, Margin).
- "Last updated" showed `11T10:25:38.291Z-10-2026`: `fmtDate` now shows the date of a full timestamp as DD-MM-YYYY (everywhere).
- Desktop pricing view unchanged.
- Files: index.html, sw.js (cache `bizcore-shell-v2667d`), js/app.js, js/responsive.js, css/responsive.css, css/register-standard.css.

## V266.74 — Pricing view: one Close button (15 Oct)
- The pricing view's action bar had "Close" twice; the plain one is removed (the remaining Close asks for confirmation as before). js/app.js, index.html, sw.js (cache `bizcore-shell-v2667e`).
