# V269.7 — Sales Order view redesign

Built on 22 Oct 2026 from the mockups Musthafa approved: SV_1 – SV_5 (earlier chat), SV_6 / SV_7 (rings, To Invoice) and
SV_8 / SV_9 (fixed-height cards, document lists).

Only website files changed. **There is no rules change and nothing to publish.**

## What the view shows

### Header
- The title line reads **SO no. — customer**. Under it: PO · SO Date · quotation · Salesperson.
  - Salesperson is the person who **created the order**, for now. New orders save `createdBy` / `createdByUid`; older
    orders show "—". A real salesperson field comes later.
- **Edit** is always visible. Once the order has delivery notes, invoices or payments it is disabled, and its tooltip
  gives the reason.
- **More** opens a menu: Customer PO (when attached), Open Quotation, Delete Order. Delete is disabled with a reason
  when it isn't allowed.
- On a phone the title is the SO number only; the second line is customer · PO.

### Four fixed-height cards (SV_6 / SV_8)
| Card | Shows |
|---|---|
| **Delivery** ring (blue) | Delivered % **by value** (accepted quantity only); the stage Confirmed → Out → Partial → Delivered; "N Items Pending Delivery"; "3 DNs ▾ · Latest DN-… (dd-mm) · 1 Out For Delivery" |
| **Invoicing** ring (orange) | Invoiced % by value (invoices − credit notes, incl. VAT); "Invoiced SAR x of y"; "N Items Delivered, Not Invoiced"; "2 Invoices ▾ · Latest INV-…" (+ credit notes) |
| Order Total | Total incl. VAT · lines · sub-total |
| Outstanding | Invoiced − received, with the pill Not Invoiced / Unpaid / Part Paid / Paid / Overdue, the amount received and the next due date |

- The cards keep the same height whatever the number of documents. A line that is too long is cut with "…" and shown in
  full on hover.
- Quantities are always given **per line with their unit**. Pcs and Rolls are never added together.

### Document lists
- **Collapsed by default.** A list opens only when its count is clicked: "3 DNs ▾", "2 Invoices ▾", and the Purchases,
  DN, INV and Receipt chips in Document Flow.
- On a PC or tablet the list floats below the card. If there's more room above, it opens upwards.
  - It sits on the window's overlay, so sticky headers and tables never clip it.
  - It follows the page when you scroll, and closes when its card scrolls out of view.
- On a phone it is a bottom sheet with a Close button, kept above the iPhone home bar.
- It closes on:
  - clicking the count again, clicking outside, or Esc (Esc closes only the list);
  - changing tab;
  - opening a document;
  - another screen opening on top.
- Each row has the document no. (a link that opens it), the date and a status pill. What each list adds:
  - **Delivery notes:** the quantities per item, and accepted / rejected.
  - **Invoices:** quantities net of credit notes, amount, received and due date. Credit notes appear in the list too.
- Each list ends with a per-line summary and the counting rules:
  - Rejected quantity goes back to To Deliver.
  - Voided delivery notes are not counted; they are listed last, greyed.
  - Credit notes are deducted. Cancelled invoices are not counted.

### Tabs
- **Overview:**
  - Order: customer, contact, Customer PO, PO date, Project / Delivery To, expected delivery.
  - Terms: payment and delivery terms, VAT, Created and Last Change (date · who).
  - Customer PO: the attachment (view / download), the notes, and the internal note marked as internal.
  - Document Flow: RFQ → Quotation → SO → Purchases → DN → INV → Receipt. A missing step is shown dashed.
- **Items:**
  - Columns: Ordered · Bought · From Stock · Delivered · Accepted · Invoiced · **To Deliver** (blue) · **To Invoice**
    (orange) · State.
  - A line with something on the way shows "N Out" under To Deliver.
  - Clicking a line lists its purchase invoices, stock allocations, delivery notes and invoice lines.
  - Below the table: Amounts and Still To Do (To Buy / To Deliver / To Invoice).
- **Purchasing:** still to buy per line with the pricing estimate, the purchase invoice lines for this order (landed
  unit cost, payment status), and the stock allocated (average cost).
- **Finance:**
  - Figures: order total, invoiced (net), received, outstanding, not yet invoiced.
  - Invoices: type, amount, credited, received, balance, due date, status.
  - Billing (Ex-VAT): goods, advances, net billed, still to bill.
  - Credit notes and receipts.
- **Profit 🔒**, shown only when *Administration → Purchase Settings → Profit on orders is shown to* allows it (otherwise
  the tab isn't in the page at all):
  - **Summary (SV_3):**
    - Revenue, cost (final + still estimated), gross profit with the figure at pricing.
    - The main % follows Pricing Settings (Markup / Margin); the other is shown small.
    - Target pill: On Target / Below Target / Below Minimum, using Pricing Settings' target and minimum.
    - Per line: the cost source (PI · supplier, × stock at average, still to buy at the estimate), and the tag
      Final / Part Est. / Estimate.
  - **Estimate vs Actual (SV_5):**
    - The estimate is the pricing version the quotation came from (fixed once converted). It is the buy price plus
      the line's share of the pricing's additional costs, if any.
    - The actual cost is purchase invoices (landed, after discount at payment / cash back) plus stock at average
      cost. What isn't bought yet counts at the estimate.
    - Purchase and stock are shown separately, never blended: "ABC Trading · 117.00 × 6", then "Stock 116.00 × 2".
    - Variance in SAR and %: higher in red, better in green.
    - Notes: Higher, Better, As Estimated, Open, **⚠ Over N%**, Supplier Changed.
    - When no pricing estimate is linked, the last price paid is used.
- **Activity:** created, last saved, bought, allocated from stock, dispatched / accepted / voided, invoices, credit
  notes, receipts — newest first, with who and when. It is built from the loaded records.

### Footer
- Shows only what is possible now:
  - **+ Delivery Note** while something is still to send;
  - **+ Invoice** while something can be invoiced;
  - **+ New Receipt** while an invoice is open (Record Payment for old, legacy-mode orders);
  - Print and Close always.
- **Print** gives an internal "Order Status" A4 sheet: figures, items, DNs and invoices. **No costs or profit.**
- **Phone:** ⋯ More + the next step. The next step is chosen in this order:
  1. collect money (New Receipt);
  2. invoice what was delivered;
  3. deliver;
  4. bill ahead or take an advance.

  More opens a bottom sheet with the other actions, Edit, Print, Quotation, Delete and Close.

## New setting
- **Administration → Purchase Settings → "Sales Order profit: flag cost above estimate by (%)"**. The default is **5**,
  allowed range 0 – 100.
- It is saved in `settings/purchasing` as `estimateFlagPct`.
- The security rules for that document don't restrict extra fields, so **no rules change**. Saving the settings once
  writes the new value.

## Reads (Firebase free allowance)
- Nothing new is stored on the Sales Order, and records don't grow. Everything is worked out when the view opens, from
  data that is already loaded.
- Extra reads happen only when the **Purchasing** or **Profit** tab is opened:
  - If the purchased quantity is more than the loaded purchase invoices / allocations explain (an older order), it
    reads that order's purchase invoices (`soIds array-contains`, new `BCWin.loadContains`) and stock allocations,
    **once per order per session**.
  - Profit reads an older pricing version only when the quotation came from one.

## Files
| File | Change |
|---|---|
| `js/so-view.js` (new) | The view |
| `css/so-view.css` (new) | Its styles |
| `js/app.js` | `viewSO` hands over to the new view; the old code stays only as a fallback. New orders save `createdBy` |
| `index.html` | Loads the two new files; `BCWin.loadContains`; `?v=` numbers |
| `js/responsive.js` | The phone footer leaves the SO view alone (it has its own) |
| `js/purchases.js` | The new setting in Purchase Settings |
| `js/purchase-core.mjs` | `estimateFlagPct` (default 5, 0 – 100) |
| `js/purchase-service.mjs` | Import version only |
| `sw.js` | `bizcore-shell-v2697` and the new files |

Tests:
- New: `tests/browser/so-view.e2e.mjs` (2 tests).
- Updated to the new wording: invoice-remaining, invoicing, navigation, receipts, responsive.
- `tests/purchase-service.test.mjs` covers the new setting.

## Going live
Upload: **index.html, sw.js, js/app.js, js/so-view.js, css/so-view.css, js/responsive.js, js/purchases.js,
js/purchase-core.mjs, js/purchase-service.mjs**. If V269.4 – V269.6 were not uploaded yet, also upload
**js/data-safety.js**.

There are no rules to publish. After uploading, open Administration → Purchase Settings and press **Save settings** once.
This is optional: until then the default of 5% is used.

## Not done / later
- A salesperson field on the Sales Order (agreed: later).
- "Other order costs" (transport, expenses linked to the order) on the Profit tab, when that feature exists.
- A report across orders, "cost over the estimate" by supplier / salesperson, using a summary record per order.
- The Dashboard and the quotation register's order chips still use the old status with payment (unchanged; mockup first).

## V269.7.1 — fonts, item names, Finance colours, lines without a cost (22 Oct 2026)
- **Font:** the whole view now uses the app's font (Inter → Segoe UI Variable → Segoe UI). Before this fix, tabs, tags,
  links and buttons had their own "Inter, system-ui" list, which fell back to a different Segoe face on Windows.
- **Item names:** normal weight and the table's text size in every tab (Items, Profit, Estimate vs Actual, phone cards),
  as on Purchasing.
- **Finance:**
  - Received is green only when money was actually received; at 0.00 it shows in the normal text colour.
  - Not Yet Invoiced is orange when there is something left to invoice.
- **Profit — lines without a cost:** a line that isn't bought and has no pricing estimate and no last price paid no
  longer counts as cost 0.00, which showed full profit and "Margin 100%".
  - Its Cost, Profit and % show "—", with the tag **No Cost** (or **Part Cost** when only part of it is bought).
  - Such lines are left out of the totals, and the totals say how many were left out.
  - When no line has a cost, Gross Profit reads **Not Available Yet**.
- Upload: **js/so-view.js, css/so-view.css, index.html, sw.js** (`bizcore-shell-v26971`).

## V269.7.2 — phone cards on the iPhone (22 Oct 2026)
- On the iPhone (Safari), the Purchasing, Finance and Profit tables, turned into cards with CSS, kept their table cell
  heights: long supplier names were cut off and the Estimate text ran out of its box.
- Now, on a phone, each row is shown as a real card built from plain blocks with the same content: label above the
  value, two per line.
  - Wide fields (Item, Supplier, Estimate, Actual, Note, Invoices, Reason) take the full width and wrap.
  - The line no. is shown before the item name.
  - The tables stay as they were on PC / tablet.
- Upload: **js/so-view.js, css/so-view.css, index.html, sw.js** (`bizcore-shell-v26972`).
