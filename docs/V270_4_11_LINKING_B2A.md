# V270.4.11 — Package B, Step B2a: linking quotation / sales order lines to items (31 Oct 2026)

Agreed with Musthafa on 31 Oct (mockups PB_2, PB_3, PB_4). Step B2b (several quotations → one Sales Order, PB_5)
follows separately: it changes how orders, delivery notes and invoices count quantities per quotation.

## 1. Quotation lines — linked / not linked (PB_2)
- Under every priced product line in the quotation screen: **green** "Linked: ITM-… name · change" or **orange**
  "Not linked — Link item…". Note / heading lines and contracting scope lines are never linked.
- The line text keeps the customer's wording and is printed as written; linking only stores the item id (`prodId`).
- **Link item…** opens the link window: closest items (memory of this customer first, then names that share real
  words — numbers alone never match; other sizes rank lower), **Search items…**, **+ New Product** (form opens with the
  line text; the new item is chosen after saving), **Make it a note line**.

## 2. Mark as Sent = reminder (PB_3)
- "Save & Mark Sent" (quotation screen) and the **Sent** status (quotation view): when priced lines are not linked,
  "Link items before sending?" lists them with their closest matches. **Link & mark as Sent** or **Send anyway**;
  Back / ✕ / Esc = not sent. From the view, "Make it a note line" is not offered (the quotation is not being edited).

## 3. Create Sales Order = required for the ordered lines (PB_4)
- Under each line: linked item, or **Link item… (required)**. Lines not ticked for this order need no link.
- A line linked in an earlier order of the same quotation keeps that link.
- Saving with an unlinked ordered line: "Link the items first" with the list; those rows are marked.
- **Customer wording memory**: "💡 Linked for this customer before: ITM-… · Use it".

## 4. Customer wording memory
- Kept on the customer record (`customers/{id}.wordings`: wording → item, with date and document), written when a
  quotation is marked Sent and when a Sales Order is saved, only when the wording differs from the item's name.
- Also found from the customer's loaded quotations / orders. Customers are loaded at start → **no extra reads**; one
  small write per new wording. Not shown in the customer's change history.
- **No rules change** (a customer update that keeps the VAT No. and code is already allowed for quotation / sales
  order users).

## Files to upload
index.html, sw.js (`bizcore-shell-v27056`), js/app.js (?v=270.56), **js/item-link.js (new)**, js/master-ui.js (?v=270.56),
css/main.css (?v=270.56). No rules, no data change.

## Tests
- `tests/browser/item-link-b2a.e2e.mjs` (new): markers, link window (closest match, text unchanged), Save & Mark Sent
  reminder → Send anyway, view Sent → reminder with the customer's earlier wording → Link & mark as Sent, memory saved
  on the customer, Create Sales Order refuses an unlinked ordered line and saves without the unticked line, link from
  the Sales Order screen via search.
- The browser test harness gets `requireLinks` (default off): tests written before linking keep creating orders from
  unlinked test quotations; the app itself always requires links.

## Try
1. Open a Draft quotation: orange "Not linked" under lines → Link item… → choose → green.
2. Save & Mark Sent with an unlinked line → reminder → Send anyway / Link & mark as Sent.
3. Won quotation → Create Sales Order: an unlinked line → "Link item… (required)"; untick it → saves.
4. Next quotation for the same customer with the same wording → "Linked for this customer before".
