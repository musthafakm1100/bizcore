# V270.2 — Quotation Entry redesign, line discounts, note styles

Built on 24 Oct 2026 from the mockups Musthafa approved on 23 Oct (QT_1 – QT_12, "BizCore Quotation Entry — Mockups")
and his answers of the same day ("agree with all"):
1. The printed quotation / PDF shows a **Disc.** column only when at least one line has a discount.
2. When the qty or price changes, the discount field that was **typed** is kept and the other follows.
3. The "Low · below minimum" note in the internal summary is **information only** — it never blocks saving.
4. The note style is **frozen once a quotation leaves Draft**, so it always reprints as it was sent.

Only website files changed. **There is no rules change and nothing to publish.** The quotations rule has no field
list, so the new optional fields need nothing in Firebase.

## The screen
Same window, header, fields, tabs, grid and summary as Pricing (docs/V270_1_PRICING.md). css/quotation.css,
js/quotation-ui.js; the lines, totals and Save stay in js/app.js.

### Window and header
- A centred window: width min(1320 px, screen − 36 px); below 1200 px full width with a 12 px edge; at 760 px and below
  full screen.
- **← arrow** (Alt+←). Its tooltip names where it goes ("Back to Pricing (Alt+←)") or "Close (Alt+←)".
- Title as before ("New quotation — from RFQ-…", "Edit — Q-…", "Revise quotation — …"). Subtitle: customer · Ref ·
  From Pricing PR-… · Products / Services.
- **Status pill** (Draft ▾): the same six statuses as the old list (Draft, Sent, Won, Lost, Expired, Revised).
  Save Draft and Save & Mark Sent still set Draft / Sent.
- **● Internal Note** pill when there is an internal note (click → Internal Notes tab).
- **Document flow:** RFQ ✓ › Pricing V1 ✓ › Quotation › Sales Order. The done steps open their document (asking first
  if there are unsaved changes). Hidden below 1100 px; inside the details sheet on a phone.

### Details band (soft background, like Pricing's supplier bar)
- Row 1: Customer \* (+ New Customer; ✓ when from the Customer Master; address · VAT · CR under it), Contact \* (phone
  under it; "Save as a new contact" as before), Customer Ref. / PO No., Project / Site.
- Row 2: Quotation No. (Auto on Save), Date \* (the BizCore date field, DD-MM-YYYY), Validity (days · valid-until date
  inside the box), Delivery Terms, Payment Terms (with "＋ Add new term…" as before), **Fold**.
- **Fold** turns the band into one line of chips (customer, contact, ref, date, valid, delivery, payment) with
  **Edit Details**. The choice is remembered in the browser (`bc_qt_fold`, per person). With no choice yet the band
  starts folded on screens under 820 px high (1366 × 768 laptops).
- Phone: a details card (customer, contact · ref, date · valid · terms); tapping it opens the details as a full sheet
  with **Done**.

### Tabs
- **Items (n)**, **Remarks & Conditions** (green dot when it has text — prints), **🔒 Internal Notes** (orange dot —
  never printed). Phone: Items / Remarks / Internal.
- **Remarks & Conditions:** Customer Remarks and Additional Conditions (one per line), each marked "Prints on
  quotation", with counters, and a **How It Prints** preview of the Terms & Conditions (additional conditions
  highlighted in the preview only). A box points to Internal Notes.
- **Internal Notes:** the internal note, "Never printed".
- The template (Products / Services) is chosen when the quotation is started, as before, and locked.

### Items grid
One column set for the header, the lines and the totals row. Product: **# ⋮⋮ · Code · Brand / Model · Description &
Specifications · Qty + UOM · Unit Price · Disc % · Disc SAR · Line Total · ⋮**. Services: **# · Scope Of Work · Qty +
Unit · Rate · Disc % · Disc SAR · Line Total · ⋮**.
- Fields are quiet until hovered or focused. The description grows to 3 lines (scope to 8), then scrolls; Enter in the
  description moves to Specifications (no line breaks in a product description).
- A changed price shows **Pricing 180.00 ↑** under it (click to put the Pricing price back).
- Line Total is after the line discount, with "Gross 300.00" under it when discounted.
- Headings and notes span the middle columns. A note right after an item is indented under it (it prints inside that
  item's description, as before).
- The header and totals row stay in view while 20 – 50+ lines scroll (tested with 42).
- Toolbar: product search (F3), + Blank Item, Heading, Note, New Product, **Notes: <style> ▾**, ⋯ (Add Heading, Add
  Note, New Product…, Clear All Lines…). Below 1100 px Heading / Note / New Product are in ⋯.
- **Line ⋮ menu** (a bottom sheet on a phone): Edit Line… (phone), Insert Line Above, Duplicate Line, Move Up (Alt+↑),
  Move Down (Alt+↓), Price History… (F2 — the Pricing Price History window, Selling / Buying), Clear Line Discount,
  Delete Line (Ctrl+Del, asks first, toast with **Undo**).
- Keys: Enter next field, Ctrl+Enter new line, Alt+↑/↓ move, F2 price history, F3 search, Ctrl+Del delete, Ctrl+S save
  draft, Alt+← back, Esc closes a menu / list / calendar first.
- Drag ⋮⋮ to reorder (PC / tablet).
- ≤ 900 px (portrait tablet): the Code column folds into the description — a grey "PT-25 · Roco A3-500" line under it
  opens the line sheet to edit code / brand / model.

### Summary panel (284 px)
- **Quotation Total:** Sub-total (Σ qty × price), Line Discounts, Quotation Discount (SAR, typed here), Total Before
  VAT, VAT %, **Grand Total** (navy).
- **🔒 Internal · Never Printed** (quotations from Pricing): Estimated Cost (material + Pricing's additional costs),
  Selling (Ex-VAT, after both discounts), Profit / Markup / Margin tiles, the status by the Pricing Settings method and
  minimum ("Good · Markup 27.1%", "Low · Markup below 15.0% minimum", "Loss · … below cost"), and
  "Pricing V1 markup 29.7% → 27.1% after discounts and 1 price change." Green / orange / red like Pricing.
  Information only.
- Without a Pricing link: "No Pricing is linked … cost and profit are not available."
- Below 1200 px the panel is a **totals bar** (Sub-total · Discounts · VAT · Grand Total · 🔒 Margin) that opens the
  panel over the window.

### Footer
"● Unsaved changes · Ctrl+S to save", the **To continue: ① Customer ② Contact …** line (✓ Ready to save), then
**Close · Save Draft · Save & Preview · Save & Mark Sent** — same actions, same confirmation (it now lists line
discounts and the quotation discount). Phone: ⋯ (Save Draft, Save & Mark Sent, Close) + Save & Preview.

### Leaving
Back, Close, ✕ and Esc: nothing changed → leaves at once (back to where it was opened from, as before). Changed →
**Leave Without Saving?** Stay · Discard & Close (or Discard & Go Back) · **Save Draft & Close** (saves as a draft
without the second question). Before V270.2, Close always asked.

### Phone (≤ 760 px)
Each line is a card built from plain blocks (never restyled table rows — the V269.7.2 Safari lesson): "n description",
code · brand model, specifications, Qty / Unit Price / Disc % boxes, "Disc −12.60 · Gross 252.00" and the line total.
Tap the description for the **line sheet** (every field incl. Disc SAR, Delete Line, Done). Headings and notes are cards
too (note with its style chip). The grid stays the record; the cards edit it.

## Line discounts
Saved on the line only when there is a discount: `discAmt` (SAR, 2 decimals), `discPct` (the exact %), `discBy`
('pct' | 'amt' — the one that was typed). A line without them works exactly as before.
| You type in | What follows |
|---|---|
| Disc % | Disc SAR = gross × % ÷ 100, rounded to 0.01 |
| Disc SAR | Disc % = SAR ÷ gross × 100 (exact kept, 2 decimals shown) |
| Qty or price | the typed field stays; the other is worked out again |
| leaving a field | only formats it |
| clearing either | both clear |
- The field being typed in is never rewritten (5 → 5. → 5.5 works). The worked-out field is grey.
- % above 100, SAR above the line gross, negative or text: outlined red with the reason, counts as 0, **Save stops**
  ("Line 3 — discount: …") and the footer says so.
- **Order:** Sub-total − line discounts = lines total − quotation discount (≤ lines total) = Total Before VAT + VAT =
  Grand Total. `calcQuote` returns `gross` and `lineDisc` too; `sub` stays the sum of the line totals (what the printed
  lines add up to), so registers, dashboards, customer pages and exports show the discounted totals.
- **Profit:** after both discounts (Total Before VAT − cost).
- **View / Print / PDF:** a **Disc.** column ("5.50%" over "−23.10") only when a line is discounted; Amount after the
  discount; Subtotal = sum of the line amounts. Quotations without line discounts print exactly as before. Both live
  print builders (Product / Arabic-English / Item Image, and Contracting).
- **Sales Order:** a discounted line goes to the order at its price **after** the line discount (`up` = line total ÷
  qty, `quotedUp` keeps the quoted price), so deliveries and invoices follow it.
- Pricing's **Last Quoted** and **Price History** use the price after the line discount.
- Excel line export: new **Disc %** and **Disc SAR** columns; Line Amount after the discount.

## Note styles
- The four Administration styles (Soft Highlight, Blue Accent, Minimal, Note Badge).
- **This quotation:** Items toolbar → **Notes: <style> ▾** — "Administration Default · Soft Highlight" or one of the
  four (saved as `noteStyle` on the quotation; blank = the default). "Reset line styles (n) to this style".
- **One note line:** its style chip — "Quotation Style · …" or one of the four (saved as `noteStyle` on the line);
  blue dot = its own style. "Use <style> for all notes in this quotation".
- The notes show in their style on the screen. **View, Print, PDF** (all live templates and the image attachment page)
  use one helper: line → quotation → the style frozen at Sent → Administration default.
- **Frozen at Sent:** when a quotation without its own style leaves Draft (Save & Mark Sent, or a status change in the
  view), the Administration default of that moment is saved as `noteStyleAtSend`. A revision keeps the quotation's own
  choice, not the frozen one.
- Fixed: Quotation View always showed the yellow note; the Contracting template's image attachment page ignored the
  setting.
- Administration → Quotation Print says that quotations can choose their own style.

## Fixes
- **VAT 0.00 under "VAT (15%)"** on a quotation made from Pricing: the rate was never set on that path and an unset
  rate counted as 0 % for the figure while the label used the Tax Master. Now the rate is set, and an unset rate always
  means the Tax Master rate (`qtVatPercent`).
- A quotation made from Pricing no longer keeps the internal notes / additional conditions of the quotation opened
  before it.
- The internal summary uses the full Pricing cost (material + additional costs); before, only material.
- The quotation date uses the BizCore date field (typing or calendar, DD-MM-YYYY).

## Saved fields (all optional)
- Quotation: `noteStyle`, `noteStyleAtSend`, `pricingRef`, `pricingCost`, `pricingSell`.
- Line: `discAmt`, `discPct`, `discBy`, `pricingSell`, `pricingBuy` (items); `noteStyle` (notes).
- Not changed: numbering, conversion, links to RFQ / Pricing / Sales Order, VAT snapshot, revision logic.

## Not changed / noted
- The **quotation-level** discount still does not go to the Sales Order (as before V270.2) — only line discounts do.
  To discuss.
- The older print templates no longer offered in the gallery (Professional, Classic, Modern, Executive, info layouts)
  were not given the Disc. column; their totals use `calcQuote`.

## Files
| File | Change |
|---|---|
| `css/quotation.css`, `js/quotation-ui.js` (new) | The screen |
| `js/app.js` | Lines (named fields), discounts, totals, VAT rate, save / open paths, note styles, View, Print, SO price, Excel |
| `js/pricing-ui.js` | Last Quoted / Price History after line discounts; Price History opens from a quotation line |
| `index.html` | The Quotation window markup; Quotation Print note; loads the new files; `?v=270.2` |
| `sw.js` | `bizcore-shell-v2702` and the new files |
| `tests/browser/quotation-screen.e2e.mjs` (new) | 2 tests (below) |

Tests: `quotation-screen.e2e.mjs` — older quotations unchanged; Pricing → Quotation (VAT, header, flow, template,
summary); discounts typed key by key, the typed field kept, limits, Save blocked; quotation discount limit; the
calculation order; note styles (quotation, line, saved, View, Print, frozen at Sent); line menu (duplicate, delete + Undo,
insert, Ctrl+Del, Alt+↑/↓); Leave Without Saving?; saved fields; Sales Order price; layout at 1440, 1366 × 768 with 42
lines (folded, sticky header / totals), 1112, 834 and 390 (cards, line sheet, details sheet).

## Going live
Upload: **index.html, sw.js, js/app.js, js/pricing-ui.js, js/quotation-ui.js, css/quotation.css**.
Also upload V269.4 – V270.1.3 if not uploaded yet (docs/HANDOVER.md). No rules, no settings to save.
