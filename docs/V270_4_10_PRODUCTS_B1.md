# V270.4.10 — Package B, Step B1: product master (31 Oct 2026)

Agreed with Musthafa on 31 Oct (mockups PF_1, PF_2, PF_3; Goods / Service and SRV codes; change history; Ctrl+V).

## 1. Goods / Service — ITM- and SRV- codes
- Product form: **Type** switch in the header (Goods / Service). Goods get ITM-000001…, services SRV-000001… — two
  separate sequences (`counters/doc_product_all`, `counters/doc_service_all`). The type is fixed once the product has
  its code. Administration → Numbering → Master Data shows "Product (goods)" and "Product (service)".
- Products list: **Type** column and filter (Goods & services / Goods / Services).
- Excel import: optional **Type** column (Goods / Service; empty = Goods); codes per type, in file order.
- Existing products have no type → treated as Goods. System codes (ITM / SRV) are not printed on customer documents.
- Purchase invoice "+ New Product" (a stock line) always makes Goods.

## 2. Product form reorganised (PF_1 / PF_2)
- Sections: **Basic** (name, category, unit) · **Identification** (brand, model) · **Price** · **Specifications** ·
  **Notes**; image on the right with **Replace / Remove**. The window is only as tall as its content.
- Service: brand, model, specifications and image are hidden; "Service name"; the note "keep services short and
  general — the job's description is written on the quotation line".
- Keyboard: Tab top → bottom; **Ctrl+S** saves; the name field has the focus when the form opens.
- **Image**: shown in the box as soon as it is chosen, **pasted (Ctrl+V)** or **dropped**; "Uploading… — Save waits until
  it finishes" → "✓ Uploaded". The uploaded copy replaces the local one only once it has loaded.
- **Fixed — image not visible until the form was reopened**: opening the form cleared the picture with an empty address;
  the page's "hide broken images" rule then hid the picture box for good. Now the box never gets an empty address and the
  picture is shown again each time.
- **Fixed — editing a product whose category is not in the list** (e.g. imported "Packing") cleared its category. The
  category is now kept (added to the list).
- Old picture files are removed only after the new one is saved (Remove + Cancel no longer deletes the saved picture).

## 3. Product view — Usage & price history (PF_3)
Click a product in the list:
- facts (category, unit, brand, model, specs, created by, **in stock**), notes;
- **Last bought** (supplier, invoice) · **Last sold** · **Average sold (12 months)** · **Margin (last)** — bought prices
  and margin only for users who may see cost (`seeCost`);
- **Documents** tab: Pricing / RFQ, Quotations, Sales orders, Invoices, Purchase invoices that use the product (linked
  lines only), with the line text as written, qty and price; filters by type; click to open; 8 shown, "Show all";
- **Price history** tab: estimated cost · quoted · ordered · sold · bought, over time;
- **Change history** tab.
Built from documents already loaded (last 12 months) — **no extra reads, no writes, no stored data**. **Show older**
asks the database once per document type (one read per matching document).

## 4. Change history — customers, suppliers, products
- Every field change is recorded in the record's `changeLog` (who, when, field, old → new; image / specifications /
  contacts as "changed"), **in the same save** — no extra writes or reads; the last 100 changes are kept.
- Shown in the **Change history** tab of the product view and a **Change history** box on the customer and supplier views.
- Rename / VAT change of a record in use: the confirmation of V270.4.9 stays.

## 5. Unit of a product in use
- A note under Unit as soon as it is changed: "Used in N documents as Roll — issued documents keep Roll".
- Saving asks first ("Change the unit of a product in use?").
- **Refused while the product has stock** ("…has 5 Pcs in stock — keep Pcs, or add a new product with the other unit").

## Files to upload
index.html, sw.js (`bizcore-shell-v27055`), js/app.js, js/master-ui.js, js/master-service.mjs, js/purchases.js,
css/main.css (all ?v=270.55). No rules change, no data change.

## Tests
- `tests/master-service.test.mjs`: SRV sequence next to ITM, reserve per type.
- `tests/browser/products-b1.e2e.mjs` (new): service form (fields hidden, SRV-000001), goods with an image **pasted**
  (shown at once — fails without the fix — uploaded, saved), type fixed once coded, every field change recorded,
  unit change confirmation, unit refused with stock, view documents / price history / change history / Show older,
  list Type filter, SRV code not printed.

## Try
1. Products → + Add: switch Service — brand / model / image disappear; save → SRV-000001.
2. + Add goods: copy any picture (e.g. Windows Snipping Tool) → Ctrl+V in the form → picture appears at once.
3. Edit a product: change price and unit → open it → Change history tab.
4. Open a product used in a quotation → Documents tab; Show older.
