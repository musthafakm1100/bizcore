# V269.2 — Sales Orders screen: work-queue tiles, New Order, phone, iPhone edges

Built 19 Oct 2026 from the mockups Musthafa approved on 18–19 Oct (option E with the breadcrumb kept, the phone
mockups with the slim bar, button style 1). Website files only — **no rules change, nothing to publish**.

## Tiles (instead of the Sales Order Monitor column)
| Tile | Counts | Value (incl. VAT, like the Net Amount column) |
|---|---|---|
| **To deliver** (dark, theme colour) | Confirmed + Partially delivered | what is still to deliver |
| Confirmed | nothing delivered yet | the order value |
| Out for delivery | on the road now (nothing accepted yet) | what is still to deliver |
| Partially delivered | part accepted | the balance to deliver |
| **To invoice** (orange) | accepted quantity not yet invoiced (same rule as the old "Pending Invoice") | the accepted, not invoiced part |
- Second line of the dark tile: "N open · N orders" (open = Confirmed / Out for delivery / Partially delivered).
- Each tile filters the table; clicking it again shows all orders. The Status list follows. The tiles follow
  Customer / Date / Search. The grey line under the strip says what is shown.
- The value of a part of an order is its share of the order total (line amounts → incl. VAT), so the tiles match the
  Net Amount column.

## Order status without payment (register only)
Confirmed → Out for Delivery → Partially Delivered → Delivered → **Invoiced** (fully delivered and every quantity
invoiced). "Partially Paid" and "Paid" are no longer order statuses in the register — payment is followed in Invoices
and Payment Receipts. A delivered (or partly delivered) quantity that isn't invoiced yet shows **· to invoice** next to
the status. An order billed before delivery keeps its delivery status.
**Not changed (needs a mockup first):** the Sales Order view (its progress bar still ends with payment), the Dashboard
and the quotation register's order chips still use the old status with payment.

Status list: All statuses, Confirmed, Out for Delivery, Partially Delivered, Delivered, Invoiced, To deliver,
To invoice, Open orders.

## + New Order (split button)
- "+ New Order" opens **New Order — choose a quotation**: won quotations with something still to order ("First order"
  or "N of M lines still to order"), then sent quotations ("Open it and mark it Won" — opens the quotation). Search by
  number or customer; ↑ ↓ Enter; Enter on a number also looks for an older quotation (not loaded). Choosing a won
  quotation opens the usual Create Sales Order form.
- ▾ opens the menu: **From quotation…** and **Direct order** (greyed out — "later, if wanted").
- Narrow toolbar: "+" and ▾ only.

## Phone
- 2 × 2 tiles under the dark "To deliver" bar; cards as before.
- When the tiles have mostly scrolled away, a **slim bar** with the counts (To deliver · Confirmed · Out · Partial ·
  Invoice) stays under the top bar; tapping a count filters; back at the top the full tiles show again.
- A round **+** in the bottom corner (above the home bar) opens the menu from the bottom. The list ends with room so
  the + never covers the last order. (The other registers still have the + in the toolbar, as in V266.7.)

## iPhone / iPad edges (every screen)
- index.html and mycash.html: `viewport-fit=cover`, and css/safe-area.css:
  - the app stays below the status bar / notch (that area gets the top bar's colour) and away from the side notch;
  - the end of every page, window footers, slide-up menus, date filter pop-up on a phone, round buttons, the "Saving"
    messages and the "updated by another user" note stay above the home bar;
  - My Cash: top bar, menu, windows and messages likewise.
- On screens without such edges (PC, Android) nothing moves.
- Tested in the simulator with the edges of an iPhone 14/15 (47 px top, 34 px bottom). **Please also check on your
  iPhone** — in Safari and as an app on the home screen.

## Also fixed
- V269.1: on a fresh start, "Quotations updated by another user" could appear (BizCore's own first read was counted as
  a change). Fixed.

## Files
index.html (page markup, viewport, links, ?v=269.2), js/app.js (status, tiles, New Order, picker, phone bar),
css/so-register.css (new), css/safe-area.css (new), mycash.html (viewport + safe-area.css), sw.js (bizcore-shell-v2692).
Tests: tests/browser/so-register.e2e.mjs (new); tests/browser/registers.e2e.mjs (Sales Orders has tiles, no monitor).

## Going live
Upload: index.html, sw.js, mycash.html, js/app.js, css/so-register.css, css/safe-area.css. No rules to publish.
