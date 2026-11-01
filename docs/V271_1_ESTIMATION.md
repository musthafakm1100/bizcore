# V271.1 — Contracting Estimation (1 Nov 2026)

First step of **Contracting Basics** (V271.1 Estimation → V271.2 Quotation + Award → Job → V271.3 Actual cost + Job view →
V271.4 Job invoicing + Work Completion Certificate). Built from the approved mockups **CE_1** (Estimation screen) and
**CE_2** (Cost Build-up) and Musthafa's decisions of 1 Nov 2026.

| # | Decision (1 Nov 2026) |
|---|---|
| a | Contracting works are done under **Downtown** now (Fast Fix / multi-company later). |
| b | Four cost types: **Material · Manpower · Subcontract · Equipment / Other**. |
| c | Labour is **hired manpower**: trade × men × days × day rate, the agency from the Supplier Master; a **Labour Rates** list. |
| d | **Overheads %** and **Contingency %** both kept (on the direct cost); **Markup %** on the total cost. |
| e | Customers are invoiced **lump sum** (V271.4); the quotation prints **Lump Sum Only** or **With Section Totals** (chosen per quotation, V271.2). |
| f | Price changes only through a **new estimate version**; on the quotation only a discount (V271.2). |
| g | Expense categories (V271.3): Local Labour, Food / Meals → Manpower; Consumables → Material; Transport / Fuel, Equipment Rental → Equipment / Other. |

## What changed
- **RFQ → Request type "Contracting"** (4th option). Its lines are *Scope Items* (service lines). Once an estimate exists
  the type and the lines are locked (like Pricing). The RFQ view shows **Start estimation / Edit estimation / Open
  estimation** instead of the Pricing buttons; the progress line shows **Estimation** with the version and status;
  activity lists the estimate versions. A Contracting RFQ with an estimate is "In Pricing" in the registers.
- **Estimation window** (`js/estimate.js`, `css/estimate.css`) — the Pricing window pattern (navy header, ← back to the
  RFQ with Alt+←, ✕ close, Stay / Discard / Save when something changed, Esc):
  - Fields: Project / Site and Est. Duration (from the RFQ), Estimate Date (BizCore date field, not in the future),
    Quotation Style (Lump Sum Only / With Section Totals — used by V271.2).
  - Tabs: **Sections & Items** · **Manpower** (all hired manpower, man-days) · **Subcontracts** · **Internal Notes**
    (orange dot + "Internal Note" pill).
  - Grid: sections (A, B, …, title editable) and items (A1, A2 …: description, unit, qty) with the four cost columns,
    Total Cost and Sell Amount; section subtotals; Direct Cost totals. Item ⋮: Cost Build-up (F2), Insert Below,
    Duplicate, Move Up / Down (across sections), Move To Section, Delete (asks). Section ⋮: Add Item, Move, Delete.
    Enter on Qty → next item / a new one. A new estimate starts from the RFQ's scope items (one section "Scope of work").
  - Summary panel: Direct Cost By Type (bar), Overheads % + Contingency % (of the direct cost), Total Cost, Markup %,
    **Selling Price**, **Round to (lump sum)** with a "Use …" chip (rounded down to the step in Contracting Settings),
    Quoted Price, Profit, Margin · Markup — green / amber (below Pricing Settings' minimum, information only) / red (loss).
  - Sell Amount per item = its share of the selling price (adds up exactly); the quotation's section amounts (V271.2) are
    shares of the rounded lump sum.
  - Footer checklist: "To continue: ① …" (no items, no description / quantity, a supplier name not in the Supplier
    Master, negative figures) or "✓ Ready to save · n items without cost". Save asks for confirmation with the figures.
- **Cost Build-up** (panel over the window): Material (Item Master search or free text, green dot when linked, unit from
  the master, **Last Paid** price with "use"; supplier optional), Manpower (Trade from the Labour Rates — the day rate is
  filled in when empty; manpower agencies listed first), Subcontract (subcontractors listed first), Equipment / Other.
  Each group shows its total; the side card shows the item's cost by type, cost per unit, sell amount and sell rate.
  **Copy From**: the build-up of a costed item of this estimate or of the current version of other Contracting RFQs,
  scaled to this item's quantity (material / subcontract / other qty, manpower days). ‹ Previous / Next › / Done.
- **Versions**: Versions ▾ (or the status pill) lists V1, V2 … with status and price; **Save As New Version** starts
  V(n+1) from the estimate on screen — saving it marks the current Saved version **Superseded** (kept, read only).
  A superseded version opens read only with "Revise — New Version" on the latest one.
- **Supplier Master**: "Also supplies (Contracting)": **Manpower agency**, **Subcontractor** (`supplierKinds`).
- **Administration → Contracting Settings** (administrators; shared in Firebase as `sharedSettings/contracting`):
  Estimate Defaults (Overheads 5 %, Contingency 3 %, Markup 15 %, rounding step 100), Job Budget Warnings (90 % / 100 %,
  for V271.3), Labour Rates (trade, rate / day), Expense Categories (name, cost type — for V271.3).
- Permissions: the Estimation uses the **Pricing** module rights (view = read only; create / edit = change).

## Data
- `rfqs/{id}`: `estimateIndex[]` `{ version, status, created, updated, savedBy, previousVersion, itemCount, directCost,
  totalCost, sellTotal, offerPrice, marginPct }`, `currentEstimateVersion`.
- `rfqs/{id}/estimates/v{N}`: `{ rfqId, version, status, created, updated, savedBy, previousVersion, site, duration,
  estimateDate, quoteStyle, overheadPct, contingencyPct, markupPct, roundTo, sections[{ id, title, items[{ id, desc, unit,
  qty, rfqLineId, build{ material[], manpower[], subcontract[], other[] } }] }], internalNotes, summary{…} }`.
  Written in the same batch as the RFQ (`fbSaveRecordWith`). Status `Saved` → `Superseded` / `Converted` (V271.2).
- Nothing existing changes shape; no migration.

## Rules (publish after the emulator run)
- New `match /rfqs/{rfqId}/estimates/{vid}` (like the pricing versions): read with Pricing / RFQ / Quotation view;
  create `Saved` only, id = `v{version}`, `rfqId` matches; a `Saved` version may change; a fixed one only its status;
  delete administrators only.
- `sharedSettings`: `contracting` added (administrators).
- **Run `RUN_EMULATOR_TESTS.bat` on the PC first** (new `tests/emulator/estimates.test.mjs`), then publish firestore.rules.

## Tests
- `tests/browser/estimation-v2711.e2e.mjs` (new): RFQ view buttons, start from the RFQ lines, build-up through the
  screen (Item Master pick, Labour Rate, manpower agency / subcontractor lists, supplier not in master), the figures
  (5 % / 3 % / 15 %, rounding, item sell amounts add up), sections, notes, Manpower tab, save (RFQ + V1 in one batch),
  reopen, new version (V1 Superseded, figures kept, read only), Copy From with scaling, leave without saving, Product
  RFQs unaffected, RFQ entry type locked, supplier flags, Contracting Settings saved to Firebase.
- Full unit and browser suites re-run (see the package notes).

## Upload
index.html, sw.js (bizcore-shell-v27101), js/app.js, js/rfq-entry.js, js/data-safety.js, js/permissions-ui.js,
**js/estimate.js (new)**, **css/estimate.css (new)**, css/rfq-entry.css.
Rules: firestore.rules (after the emulator run). No Company Settings save needed.

## V271.1.1 — Special Right for Labour Rates & Expense Categories (1 Nov 2026)
Musthafa's decision: sales / senior staff may keep the **Labour Rates** and **Expense Categories** up to date; the
**estimate defaults** (Overheads, Contingency, Markup, rounding) and the **budget warnings** stay with administrators.
- New Special Right **"Manage Labour Rates & Expense Categories"** (Roles & Permissions → Special Rights → Pricing &
  profit). Administrators always have it.
- A user with the right (and no Administration access) sees **Administration** with only **Contracting Settings**; the
  defaults are shown read only, the two lists can be changed and saved.
- Storage: the lists moved to their own shared record **`sharedSettings/contractingRates`** (key
  `bizcoreContractingRates`); `sharedSettings/contracting` keeps only the defaults. Lists saved by V271.1 inside
  `contracting` are still read until the next save, which moves them.
- Rules: `contractingRates` may be written by administrators **or** the Special Right (`hasRight('contractingRates')`);
  `contracting` stays administrators only. No extra reads (the rights are on the user record).
- Emulator test fixed (not related to V271.1): `receipts.test.mjs` "receipt edit" used a receipt dated 13-10-2026; since
  November the rule "receipts can be edited only during the month of their date" stopped it — the receipt is now dated today.
- Tests: `estimation-v2711.e2e.mjs` part 11 (Special Right), `tests/emulator/estimates.test.mjs` (contractingRates rule);
  rights, permissions, users, data-safety, RFQ entry / view browser tests re-run.
- Upload (in addition to V271.1): js/role-core.mjs, js/role-service.mjs, js/user-service.mjs (import version only),
  js/permissions-ui.js, js/data-safety.js, js/estimate.js, index.html, sw.js (bizcore-shell-v27111), firestore.rules.
