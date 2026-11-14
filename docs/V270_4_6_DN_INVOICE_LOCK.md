# V270.4.6 — Invoiced Delivery Note locked (29 Oct 2026)

Agreed with Musthafa on 29 Oct (professional ERP practice, "Step 1"): once a Delivery Note is invoiced it stays exactly
as the customer signed it. Goods that come back after invoicing are handled with a credit note on the invoice; a
separate Sales Return (Return Note) document, credit note types (Return / Price adjustment) and customer credit /
refund come later ("Step 2", with stock and Cash & Bank). Found on DN-2610-0003 / SO-2610-0002 (invoiced and paid,
but Correct / Revise still opened).

## Rules
| Delivery Note | Correct Confirmation / Revise Acceptance | Correct Dispatch / Void |
|---|---|---|
| Not confirmed | — (confirm first) | allowed (unchanged) |
| Confirmed, not invoiced | allowed, with a reason (unchanged) | not allowed (unchanged) |
| Confirmed, invoiced (any line, any quantity) | **locked — every field** (quantities, Received by, remarks) | not allowed |
| Its invoiced quantity fully credited | allowed again (nothing on it is billed any more) | not allowed |

- **Which DN is invoiced:** invoices are issued per Sales Order line, not per DN. The invoiced quantity of each line
  (delivery invoices, net of credit notes) is matched to the order's confirmed DNs in the order they were confirmed —
  first confirmed = first invoiced. A DN is locked when any of its lines carries part of that quantity.
  Example: DN-1 accepted 4, DN-2 accepted 3, 2 invoiced → DN-1 locked, DN-2 can still be corrected; 5 invoiced → both locked.
- **Billing ahead** (order invoices) does not lock a DN — that invoice was not based on a delivery.
- **No time limit** and no administrator exception (agreed defaults).
- The old save check (accepted never below invoiced) stays as a second guard; its message now says
  "Issue a credit note on the invoice first" (BizCore never cancels invoices).

## Where it is enforced
- **Save** (`js/delivery-service.mjs` → `recordAcceptance`, correction / revision): the service reads the order's other
  DNs (query `deliveryNotes where salesOrderId ==`, then each one inside the transaction) and refuses with code
  `invoiced`. Without query support it treats the other DNs as confirmed first (never unlocks an invoiced DN).
- **Screen** (`js/app.js`): the DN view checks the order's billing (one read of `salesOrderFulfillment/{so}`) and, when
  invoiced, disables **Correct** and **Revise** and shows a short amber note ("Invoiced — locked …"). Clicking either
  checks again first and shows the reason instead of opening the screen.
- Core logic: `dnInvoiceCoverage`, `dnInvoicedMessage`, `ERR.INVOICED` in `js/delivery-core.mjs`.

## Credit note on a paid invoice (`js/invoicing.js`)
- Allowed as before (a return after payment is normal).
- New amber note in "Good to know" when the invoice has payments: "INV-… is paid — SAR 4,577.00 received. After this
  credit note SAR 2,288.50 is owed to the customer: keep it as customer credit (edit the receipt to apply it to another
  invoice) or refund it." Part-paid: shows the balance due after the credit.
- "Good to know" text corrected: a credit note does not change the delivery records or the stock; the DN stays as signed.

## Also fixed
- iPhone: the footer "⋯" More menu (Quotation, DN, Invoice, CN, Receipt views) opened behind the document zoom bar.
  The zoom bar is now hidden while the More menu is open (`css/mobile-zoom.css`).

## Files to upload (9)
index.html, sw.js (`bizcore-shell-v27049`), js/app.js (?v=270.49), js/invoicing.js (?v=270.49),
js/delivery-core.mjs (?v=270.46), js/delivery-service.mjs (?v=270.46), css/main.css (?v=270.49),
css/invoicing.css (?v=270.49), css/mobile-zoom.css (?v=270.49).
No Firestore rules change, no data change, no Firebase setting.
(delivery-core is loaded at ?v=270.46 by the delivery service and at ?v=266.0 by the other services — both are kept in
sw.js; the older copy only uses functions that did not change.)

## Tests
- Unit: `tests/lock-service.test.mjs` (+2: confirmation order, coverage), `tests/invoice-service.test.mjs` (partial credit
  keeps the lock, full credit releases it) — `npm test` 138/138.
- Browser: `tests/browser/dn-invoice-lock.e2e.mjs` (new): buttons free before invoicing, locked with the note after,
  change screen not opened, paid-invoice note on the credit note, More menu hides the zoom bar on a phone.
- Emulator (run on the PC, `RUN_EMULATOR_TESTS.bat`): `tests/emulator/invoices.test.mjs` now expects `invoiced` and lets
  the service run its DN query under the real rules.

## Try
1. DN-2610-0003 → the acceptance panel shows "Invoiced — locked", Correct / Revise greyed out.
2. A new order: deliver, confirm → Correct works; invoice it → locked.
3. INV-2610-0001 → Credit Note → enter a quantity → the amber "is paid … owed to the customer" note. (Cancel — don't issue.)
4. iPhone: Quotation view → "⋯" → the menu is fully visible, the zoom bar comes back when it closes.
