# V270.2.6 — RFQ entry screen (24 Oct 2026)

Approved mockup **RFQ_2 — Layout C** (header strip + tabs), with the dark header in the application theme colour.

## Screen (Log new RFQ / Edit RFQ)
- **Header:** dark, `var(--blue)` — the same theme colour as Pricing and Quotation Entry (follows Administration →
  System Preferences → Application theme). "New record · number assigned on save" / the RFQ number when editing.
- **Strip, two rows (12-column grid):**
  Customer · Contact person · Received via · Assigned to /
  Customer reference / subject (wider, up to 200 characters) · Request type · Date received · Response due.
- **Request type:** Product / Service / Mixed (default Product). It decides the tabs:
  | Type | Tabs | Requirement fields |
  |---|---|---|
  | Product | Items · Requirements · Attachments | Delivery location, Required delivery, General requirements |
  | Service | Services · Scope of work · Attachments | Site / location, Required start, Expected duration, Scope of work |
  | Mixed | Items · Services · Scope & requirements · Attachments | all of them |
  Changing the type when lines of the other kind exist asks first; those lines stay on screen (back with Mixed) but are
  not saved with a Product-only / Service-only RFQ.
- **Lines (optional):** SL (automatic) · Item / Product (search the Item Master by code, name, brand, model) ·
  Description (filled from the master, can be edited) · Qty · UOM / Unit (from the master, can be changed; Service
  units Lot, Job, Visit, Hour, Day, Week, Month, Year, LS) · Remarks / Specs.
  - ● = from the Item Master, ○ = not in the master: type the text and choose "Use … — not in Item Master" (or just
    leave the field) — kept on this RFQ only, nothing is added to the master.
  - Enter on Qty adds the next line · Alt+N adds a line · Alt+↑ / Alt+↓ (or the ↑ ↓ buttons, or drag ⋮⋮) reorder ·
    ✕ deletes · **Paste from Excel** (description · qty · UOM · remarks columns; also Ctrl+V in an item / description
    cell) adds lines.
  - A line with a description needs a quantity above 0 (message, the cell is focused).
  - The tab area keeps one height; long lists scroll inside it. On a phone each line is a card.
- **Dates:** the standard BizCore date field (DD-MM-YYYY, typed or from the calendar) for Date received, Response due
  and the required date. Response due may not be before Date received.
- **Attachments** tab (same upload as before), count on the tab.
- Footer: Cancel · **Save & New** (new RFQ only — saves and opens a blank form) · Save RFQ / Update RFQ.
  Keys: Ctrl+S save · Alt+N add line · Alt+1…4 tabs.

## Saving
- New fields on the RFQ: `requestType` ('product' | 'service' | 'mixed'), `rfqLines` [{ lineId, kind, sortOrder,
  productId, code, desc, qty, uom, remarks }], `site`, `requiredDate` (ISO), `duration`. `lineId` never changes;
  `sortOrder` is the display order. Existing fields unchanged; old RFQs open as Product with no lines (their
  Description / requirements stays in the requirements box).
- **Success only after Firebase confirms.** If the save is refused, "RFQ not saved" with the reason, the form stays
  open, the list keeps the stored version. A new RFQ keeps its id and number for the retry (same received date), so no
  number is used twice or skipped.
- The number is allocated on Save (V270.2.5 numbering, from the received date).

## RFQ → Pricing
- A **first** pricing starts with the RFQ lines (product, code, description, qty, UOM; remarks added to the description
  as "… — remarks"), in the RFQ order, and remembers each line's `rfqLineId`. A message says how many lines were
  taken. Only when the RFQ has no pricing at all — saved pricing lines are never replaced.
- Once the RFQ has pricing (or a quotation), its lines and request type are **read only** on the RFQ ("Pricing has
  started — the lines are changed in Pricing."). Other RFQ fields can still be edited.

## RFQ view
- "Request type" row; Required Items shows the RFQ lines (with remarks; Product / Service tag for Mixed) until pricing
  exists, then the pricing lines with their status as before; requirement details (location, required date, duration)
  and the scope / general requirements under it. Text is escaped.

## Files
- js/rfq-entry.js (new) — screen logic (`BCRfq`).
- js/app.js — openNewRFQ / editRFQ / saveRFQ (dates, new fields, Firebase-confirmed save, Save & New), RFQ view,
  first pricing from the lines (`rfqLinesForPricing`, `rfqLineId` kept on pricing lines).
- index.html — RFQ form markup; loads css/rfq-entry.css and js/rfq-entry.js; app.js version.
- css/rfq-entry.css (new). sw.js — `bizcore-shell-v27026`.

## Tests
- tests/browser/rfq-entry.e2e.mjs (new): dark header, standard dates, default tabs; master item by search + Enter;
  free-text item; Enter on Qty adds a line; Alt+↑ reorder (ids kept, order renumbered); paste; delete; Mixed tabs and
  service unit; requirement labels / duration / typed date; quantity check; saved fields; RFQ view; edit reloads;
  first pricing from the lines with remarks and rfqLineId; lines read only after pricing and kept on update; old RFQ
  opens as Product; Save & New; a refused save keeps the form open with no success message.

No security-rule change.

## V270.2.8 — dates, description-only lines, automatic response due (24 Oct 2026)
- **Date received:** never in the future; at most **N days back** — Administration → Numbering & Defaults → Document
  Defaults → **RFQ backdate allowed** (days, default 30, `settings.rfqBackdateDays`). The calendar greys out the days
  outside; Save explains ("…can be entered up to N days back (from DD-MM-YYYY)…"). An RFQ being edited keeps its own
  older received date.
- **Response due = Date received + the response period** (Administration → RFQ response due, hours, rounded up to whole
  days; default 48 h = 2 days). Recalculated at once whenever the received date changes — typed, picked or Today /
  Yesterday. It can still be changed by hand afterwards, and may not be before the received date.
- **Lines without item codes:** the Item / Product column is gone. **Item / Description** is the search field (Item
  Master by name, brand, model or code — the code is never shown, only kept with the line). While typing, the first
  choice **"Keep … as typed"** is highlighted — Enter keeps the text (not in master); ↓ then Enter takes an Item
  Master item (description and UOM filled). A line taken from the master keeps its link when its description is
  edited; clearing the description removes the link. Description and Remarks are wider. The RFQ view's line table has
  no Code column either.
- Tests: tests/browser/rfq-entry.e2e.mjs (dates, due recalculation, backdate setting, search / keep-as-typed),
  tests/browser/date-sync.e2e.mjs (now on the required date).
- Upload: **index.html, sw.js, js/app.js, js/rfq-entry.js, css/rfq-entry.css** (`bizcore-shell-v27028`).
