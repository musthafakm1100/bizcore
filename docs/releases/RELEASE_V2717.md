# BizCore V271.7 — Estimation: typed selling price, quick cost, scope & category per item, better Cost Build-up

Base: V271.6 (with the Estimation close fix). Built to the mockups approved on 10 Nov 2026 (boards 14–17), plus the two
small Quotation changes agreed the same day. **No security-rule changes** — nothing to publish in Firebase.

## Quotation Entry (two small changes)

- The Items toolbar button is now **Insert Text…** (it opens Text Blocks and Previous Quotations).
- A line that follows the quotation's default work category shows only a small grey **Category: default ▾**. The full
  chip appears when the line has its own category (orange) or none (amber). Click either to change it.

## Estimation screen (board 14)

- **Typed selling price per item (🔒).** **Sell / Unit** and **Sell Amount** can be typed, like the Pricing screen.
  Typing either fixes the item's price (lock icon); click the lock, or clear the field, to release it. Each item shows
  its own markup (green / amber). Items not typed follow the Markup % as before.
  - Selling Price = calculated items + typed items (shown split in the panel); the Markup % is "for the calculated items".
  - **Round to**: the rounding difference goes to the calculated items only — typed prices reach the quotation exactly.
  - **A typed price with no cost is allowed.** The row turns amber ("typed · no cost — margin unknown"), Profit and
    margin are shown for the costed items with a note, and the quotation can still be made. An item with neither a
    cost nor a typed price still stops the quotation.
- **Quick cost.** An item without a Cost Build-up takes figures typed straight into its Material / Manpower /
  Subcontract / Equipment cells. Once an item has a build-up, its cells show the totals as links to it.
- **+ Add cost** link on items without cost (the whole Total Cost cell opens the build-up).
- **Cost / Unit** and **Sell / Unit** columns (on screens narrower than 1500 px the Cost / Unit column folds away;
  the figure stays in the Cost Build-up).
- **Scope of work per item** ("+ Scope of work" under the description, or the item menu): formatted text with the
  quotation's Format bar. The banner **"RFQ … has the customer's requirements — View · Use as scope of the selected
  item"** copies the RFQ text once.
- **Work category**: per section (chip on the section row — its items follow it) and per item when different
  (item menu → Work Category…, shown as an orange chip).
- **Round down / Round up** suggestions by the Contracting Settings rounding step.
- **Copy from a previous estimate…** (under the items): pick any saved estimate (this customer's first), tick
  sections / items, choose whether to copy the cost build-ups, the scope and category, and the typed prices; insert as
  new sections or into the selected item's section. The other estimate is not changed.

### Screen fit (no sideways scrolling on laptops)

- The Estimation window now uses the full screen width (it was capped at 1320 px).
- **Cost / Unit** folds away when the table itself is short of room (measured from the table, not the screen); the
  figure stays in the Cost Build-up.
- The summary panel is 280 px on screens up to 1600 px.
- **Small laptops (901–1365 px):** the summary panel folds into a strip above the table — Selling Price, Quoted,
  Total Cost, Margin · Markup — and **Summary & markup ▸** opens the full panel over the table (✕, Esc or a click
  outside closes it). Tablets and phones keep their stacked layout.
- Checked at 1280 × 800, 1366 × 768, 1440 × 900 and 1920 × 1080: the table fits with no sideways scroll at all four.
  On a short screen (768 px high) the rows scroll up and down inside the table; header and footer stay.

## Cost Build-up (board 17)

- Only the cost types in use are shown; the others are buttons (**+ Material · + Manpower · + Subcontract ·
  + Equipment / Other**).
- **Cost entered: For the whole item / Per 1 unit × qty.** Per unit: material, subcontract and equipment lines are for
  one unit and multiplied by the item's quantity (switching converts the quantities, the total stays). Manpower is
  always for the whole item.
- **Waste %** on material lines (added to the amount).
- **Supplier quote reference** (internal, never printed) under the supplier of material, manpower and subcontract lines.
- Material from the Item Master shows **Last bought** (as before) and **last estimate** cost (from estimates opened in
  this session); one click uses it.
- **Own staff** manpower lines (besides Hired): no agency, costed at the trade's **own-staff rate**. Labour Rates in
  Contracting Settings has a new **Own staff / Day** column. Panels show manpower hired / own staff separately; both
  count as Manpower in the job budget.
- A trade with no rate is flagged: "No rate for … — set it in Administration → Contracting Settings → Labour Rates".
- The side card's **Sell Amount / Sell Rate** can be typed (same 🔒 as the grid).
- **Scope of Work** tab next to Cost Build-up.

## Fixes from the review of 10 Nov (V271.7.1 — files loaded as `?v=271.7.1`, cache `bizcore-shell-v27171`)

1. **RFQ — Unit list showed only "Lot".** It was the browser's suggestion list, which hides what doesn't match the
   field. Now a dropdown with all active units of **Master Data → Units**: service units first on service / contracting
   lines, goods units first on product lines, then the rest (the usual units are still offered if the master lacks them).
2. **RFQ — a service / scope not in the master** stays free text on that RFQ (as before). New: the search list has
   **+ Add "…" to the Services master…** (Item Master on product lines) — the item form opens with the text; once
   saved, the line is linked. Shown only to roles that can create items.
3. **Cost Build-up — the Material list opened by itself** when the line was added. The Item Master and Supplier lists now
   open on a click, on typing or with ↓.
4. **Cost Build-up — a material not in the Item Master** stays free text on the estimate (costs and totals as usual; no
   "last bought" hint). New: **+ Add "…" to the Item Master…** in the list, same as point 2.
5–6. **Units in the Cost Build-up** come from **Master Data → Units** (e.g. "Drum" now appears): material lines show
   goods units first, items / subcontract / equipment show service units first, then the rest. A free-text material
   starts with no unit (was "Nos"); one picked from the Item Master takes its own unit, as before.
7. **Overheads, Contingency, Markup, Round to** — typing rebuilt the field after every key (an emptied field became
   "0" again and the cursor jumped to the start, so 3 became 30). The field being typed in is now left alone; the
   other figures follow. **Limits:** Overheads and Contingency 0–100 %, Markup 0–500 %, Round to ≥ 0 — outside shows
   amber and stops the save.

Changed for these: `js/estimate.js`, `css/estimate.css`, `js/rfq-entry.js`, `css/rfq-entry.css`, `js/app.js`
(`bcAddToMaster`), `index.html`, `sw.js`, `tests/browser/estimation-v2717.e2e.mjs` (second test).

## V271.7.2 — review of 11 Nov (files loaded as `?v=271.7.2`, cache `bizcore-shell-v27172`)

1. **Estimation too wide on a big monitor.** The window now stops at **1680 px**, centred. Laptops and screens up to
   about 1700 px wide are unchanged (full width).
2. **Quotation window — same size as Estimation** (was capped at 1320 px): up to 1680 px, centred. Below 1200 px it
   keeps its full-width layout as before.
3. **Subtotal and total rows stand out** (board 18, option C): a line above each section subtotal; **Total Cost** and
   **Sell Amount** in bold navy; the Direct Cost total row light blue with a navy line above, its two key figures larger.
4. **↑ / ↓ move to the same column** in the item above / below (Estimation grid), skipping section, scope and subtotal
   rows; in the Cost Build-up, within the lines of the same cost type. In a multi-line description the arrows first move
   inside the text and leave it from its first / last line. At the first / last row the cursor stays put.
   - The Unit list that opens when you enter the field no longer takes the arrows. To go into a list from the keyboard:
     **Alt+↓** (or start typing). Once you are in the list, ↑ / ↓ move in it and Enter picks.
   - The Material / Supplier lists in the Cost Build-up open on a click, on typing or with **Alt+↓** (was ↓).
5. Held for discussion: the **Create Quotation** button stays off while an item has neither a cost nor a typed price.

Changed for these: `js/estimate.js`, `css/estimate.css`, `css/quotation.css`, `index.html`, `sw.js`,
`tests/browser/estimation-v2717.e2e.mjs` (third test; second test uses Alt+↓), `tests/browser/quotation-screen.e2e.mjs`
(expects the new width). No rule or data changes.

## V271.7.6 — fix (12 Nov; `quotation-ui.js?v=271.7.6`, cache `bizcore-shell-v27176`)

- **Quotation made from an estimate → internal panel link** said "Pricing EST-…-V1" and opened the old Pricing screen
  ("Pricing V1 of RFQ-… was not found"). It now reads **Estimation EST-…-V1** and opens that estimate version.
  Changed: `js/quotation-ui.js`, `index.html`, `sw.js`, `tests/browser/estimate-draft-v2717.e2e.mjs`.

## V271.7.5 — a new estimate version updates a Draft quotation (board 23, agreed 12 Nov; files `?v=271.7.5`, cache `bizcore-shell-v27175`)

- **Rule:** while the RFQ's latest quotation is still a **Draft** (never marked Sent), a new estimate version **updates
  that draft** — same number, no "-R". Once the quotation is **Sent**, a new version makes a **revision** (R1), as before.
- Estimation footer: after **Revise — New Version** and Save, the button reads **⟳ Update Draft Q-…** (or
  **Create Revision Q-…-R1** when the quotation was Sent; **Create Quotation** when the RFQ has none).
- **Update Draft** asks first ("Update draft quotation Q-…? It hasn't been sent to the customer, so it keeps its number"),
  then opens the draft with the estimate's lines (and section headings) replaced by the new version's. The header,
  terms, remarks, discount and the headings / notes you added are kept; the new lines go where the old ones were.
  Internal Notes get "Updated from Estimation V2 (was V1) — date". Check and save as usual.
- On saving: the new version becomes **Converted**, the version it replaced **Superseded** (estimate history kept).
- **Printing a Draft:** the Quotation Output window shows "Sending this to the customer? Mark it Sent so that later price
  changes become a revision" with **Mark Sent & Print** (the usual Sent checks apply) or **Print as Draft**.
- Not built (kept for later, board 22): one estimate item quoted as several lines. Today: one item per location —
  Duplicate Item copies the cost build-up.

Changed: `js/estimate.js`, `js/app.js`, `index.html` (Output reminder), `css/quotation.css`, `css/estimate.css`, `sw.js`,
`package.json`. New: `tests/browser/estimate-draft-v2717.e2e.mjs`. Tests: 150 unit, 99 / 99 browser. Data: quotation heading lines from an estimate carry
`estSec: true` (older drafts are matched by the section titles). Firestore rules unchanged.

## V271.7.4 — heading alignment, Black headings, more colours (board 21, agreed 11 Nov; files `?v=271.7.4`, cache `bizcore-shell-v27174`)

- **Heading in Quotation Entry:** the HEADING badge sits on top; the title and its scope start **12 px to the left of
  the lines' description**, so the lines sit inside the heading (measured per screen — Products lines have the item code
  first, Services lines don't).
- **Black headings:** a heading's default colour is navy; choosing **Black** now keeps it black on screen and on print
  (good for black & white printing). The colour menu in a heading also has **Default (navy)**. Clear formatting returns
  a heading to navy. Elsewhere Black stays the normal colour, as before.
- **More colours (Format bar, everywhere it is used):** text colours **Blue, Teal, Orange, Maroon** (9 in all);
  highlight is now a menu — **Yellow, Light green, Light blue, Light orange, Light grey** and **No highlight**.
  Older text keeps its yellow highlight.

Changed: `js/quote-rich.js`, `css/quote-rich.css`, `js/app.js`, `js/quotation-ui.js`, `css/quotation.css`, `index.html`,
`sw.js`, `tests/browser/quote-heading-v2717.e2e.mjs` (colours, Black, alignment), `tests/browser/service-quote-v27059.e2e.mjs`
(highlight is a menu now). Tests: 150 unit, 98 / 98 browser.

## V271.7.3 — quotation headings (boards 19 and 20, agreed 11 Nov; files `?v=271.7.3`, cache `bizcore-shell-v27173`)

**Heading inside the description (board 20)**
- On every quotation print (all templates) and in Quotation View, a Heading now sits **inside the Description column**:
  no band, no SL number, the other columns empty with their lines running through. Default look: bold navy.
- In Quotation Entry the heading title is formatted with the **Format bar** (bold, italic, underline, size, colour) and
  the heading has its own **Scope of work** box under it (optional, also with the Format bar, up to about a page). It
  prints under the title. Notes stay as they were: a note under a line item, and customer notes in Remarks & Conditions.
- **Insert Text:** "New heading + note" is now **New heading — text as its scope** (the heading takes the block's
  section name, the text goes into its scope). New: **Scope of the selected heading** (click in a heading first).
  "Note under the selected line" and "Add to the Remarks tab" are unchanged.

**Grouped heading (board 19)** — heading ⋮ menu → **Print Lines Grouped…** (or click its chip)
- **Each with its own total** (default, as before) or **Grouped — one total on the heading**.
- Grouped: the heading line prints SL 001, **1 Lot** (both editable, e.g. "1 Job") and the **sum of its lines** (up to the
  next heading); its lines print Qty, Unit and Unit Price with no number and no amount. Untick **Print the unit prices
  of the lines** to print them as description + qty / unit only.
- On screen: the heading shows a navy chip **Σ Grouped · 1 Lot ▾** and the group total; its lines show their totals in
  grey ("in group"). Totals, discounts and VAT are unchanged — this is print layout only. Sales Order, Delivery Note
  and Invoice print the lines as usual.
- A quotation **made from an estimate** gets a third Print Style, **Section Total with Item Rates**: every section prints
  this way (Service Quotation template). The Estimation's Quotation Style list has it too.

**Fix:** a note under a Services line now starts under the description (it was 146 px in, aligned for product lines).

Changed: `js/app.js`, `js/quotation-ui.js`, `js/quote-scope.js`, `js/estimate.js`, `css/quotation.css`, `index.html`,
`sw.js`, `package.json`, `tests/browser/scope-v2716.e2e.mjs` (Insert Text now fills the heading's scope). New:
`tests/browser/quote-heading-v2717.e2e.mjs`. Data: optional heading fields `hScope`, `grouped`, `gQty`, `gUnit`,
`gRates` (and `textHtml` for its format); estimate print style `grouped`. Firestore rules unchanged.

## Quotation from the estimate (board 16)

Each line gets the item's scope (copied once; a long multi-line description: first line = title, the rest on top of
the scope) and its work category (item's own, else the section's); the quotation's default category = the first
section's. Typed prices arrive exactly; only calculated items absorb the rounding. When the estimate already used the
RFQ requirements, the quotation's banner shows them as used.

## Data

New optional fields in the estimate version document (`rfqs/{id}/estimates/v{N}`): section `workCat`; item `scopeHtml`,
`scopeSrc`, `workCat`, `perUnit`, `sellLocked`, `sellBy`, `sellAmt` / `sellRate`; line `quick`, `waste`, `ref`, `own`.
Labour Rates: `ownRate`. Older estimates open unchanged. Firestore rules unchanged (the estimate document's existing rules
cover the new fields).

## Files

Changed: `js/estimate.js`, `css/estimate.css`, `js/quote-scope.js`, `css/quote-scope.css`, `js/rfq-entry.js`,
`css/rfq-entry.css`, `js/app.js`, `index.html`, `sw.js` (cache `bizcore-shell-v27171`), `package.json`, `tests/browser/estimation-v2711.e2e.mjs` (adjusted: empty cost types are
buttons now, Round down / up, the panel's own-staff figure). New: `tests/browser/estimation-v2717.e2e.mjs`.

## Testing (my workspace, simulator — no live data)

- Unit tests: 150 / 150 pass.
- Full browser suite: 98 / 98 pass (94 earlier + 4 new). The new test covers quick cost, unit columns, section category,
  RFQ requirements as scope, Copy from a previous estimate, the build-up (per unit, waste, last estimate, own staff,
  no-rate warning, quote ref, Scope tab), typed prices (amount, rate, without cost), round up, the saved fields and the
  quotation made from it (scope, category, exact typed prices, default category, Insert Text…, quiet chip).
- Nothing was deployed, uploaded or published.
