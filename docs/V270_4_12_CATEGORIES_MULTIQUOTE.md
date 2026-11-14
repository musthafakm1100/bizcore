# V270.4.12 — Package B, Step B2b: categories & units for services · several quotations in one Sales Order (31 Oct 2026)

Agreed with Musthafa on 31 Oct (mockups CU_1, CU_2, CU_3, PB_5).

## 1. Master Data → Categories (new screen, CU_1)
- One shared list; each category is for **Goods** or for **Services**. Add, rename, switch off (Off = not offered for new
  items, stays on existing ones); delete only when no item uses it. Filters All / Goods / Services; item count.
- First time: the old fixed list + categories added before ("+ Add new category…") + categories used by items
  (e.g. imported "Packing") → Goods; plus 14 service categories (Electrical works, HVAC / AC services, Plumbing works,
  Civil & finishing works, Fabrication & welding, Installation & commissioning, Maintenance & repair (AMC), Manpower
  supply, Transportation & logistics, Equipment rental, Cleaning services, Inspection & testing, Design & engineering,
  IT services). Nothing is written until someone edits the list.
- Renaming a category in use asks first and renames it on its items (in their change history). The type can't change
  while items use it.
- Saved for everyone in `sharedSettings/categories` (like Units of Measure — every staff member).
  **Rules change** — run `RUN_EMULATOR_TESTS.bat` first (tests/emulator/data-safety.test.mjs), then publish.

## 2. Units of Measure — "Used for" (CU_2)
- Each unit: Goods / Services / Both. Units saved before get a sensible default without being changed: Job, Lot,
  Lump sum, Visit, Month, Man-day, Man-hour, Trip → Services; Hours, Days, EA, Nos, Mtr, Sq.m, Cu.m → Both; others Goods.
- **Add suggested service units** button: Month, Visit, Trip, Man-day, Man-hour, Sq.m, Cu.m (only the missing ones).
- Quotation service (scope) lines now use the Services units of this list (were a fixed list).

## 3. Product form lists by type (CU_3)
- Goods: goods categories and goods units; Service: service categories and service units (default Job).
- "+ Add new category…" adds the category with the form's type. "+ New Unit" from a service form makes a Services unit.
- An item's own category / unit is always kept and shown, even if switched off or of the other type.

## 4. One Sales Order from several quotations (PB_5)
- Create / Edit Sales Order: **Add lines from another quotation** — Sent / Won quotations of the **same customer**
  with open lines. A different VAT rate or currency is shown but can't be chosen.
- "Quotations: Q-… Q-…" above the lines (remove an added one), each line shows its quotation; different payment terms →
  note "Using the first quotation's terms — you can change them".
- Saved: `quotationId` = the first quotation (as before), `quotationIds` = all; each line keeps `quotationId`, `qIdx`
  (row in its quotation), its price and (for Purchasing) the cost of its own quotation's pricing.
- Line numbers stay unique within the order (`origIdx`: first quotation = its row; k-th added = k×10000 + row), so
  delivery notes and invoices never mix two quotations' lines.
- Each quotation's ordered / remaining quantities count only its own lines; quotations / RFQs show "Sales Order" for
  every quotation in the order; Sales Orders register "Q-… +1"; Sales Order view lists all quotations (chips, subtitle).
- Linking (B2a) applies to every line; an earlier order's link is taken over per quotation line.

## Files to upload
index.html, sw.js (`bizcore-shell-v27057`), js/app.js (?v=270.57), js/purchases.js (?v=270.57), js/so-view.js
(?v=270.57), js/data-safety.js (?v=270.57), css/main.css (?v=270.57) — and **firestore.rules** (publish after the
emulator tests).

## Tests
- `tests/browser/b2b-categories-multiquote.e2e.mjs` (new): categories built and saved for everyone, service category,
  rename of a used one (item follows, history), type locked; suggested service units, "Used for"; product form lists
  for goods / service (default Job); Sales Order from two quotations (other customer not offered, different VAT
  refused, terms note), saved lines / origIdx blocks, per-quotation progress, register "+1", delivery note quantities,
  edit keeps both quotations.
- `tests/emulator/data-safety.test.mjs`: staff may write `sharedSettings/categories`, revision must go up by one.

## Notes
- Sales Order view estimate / profit is still read from the first quotation's pricing for the order header; Purchasing
  uses each line's own quotation.
