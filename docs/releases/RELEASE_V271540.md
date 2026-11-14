# BizCore V271.5.40 — Export to Excel opened for every role; several register bugs fixed

Base: V271.5.39.

## Changed
- **Export to Excel is no longer a restrictable Special Right.** It now works for every role, the same
  as every other register's export button (which was never gated by any right). `exportExcel` removed
  from `js/role-core.mjs`'s `RIGHTS` array and from the `GUARDS` map / button-hiding logic in
  `js/permissions-ui.js`. The Quotation and Pricing "Export to Excel" buttons stay visible for every role.

## Fixed (genuine application bugs, found while re-testing after the above change)
- **Sales-Order lock never released after a delivery-dispatch correction.** `saveDNDispatchAction()`'s
  success path called `closeModal('dn-dispatch-action-modal')` while the modal's own `_saving` flag was
  still `true` — and `closeModal()` silently no-ops for that exact id+flag combination. The modal (and the
  order lock it held) never actually closed, so the next person to open that Sales Order's delivery flow
  was wrongly blocked. (`js/app.js`)
- **An open document-list popup on a Sales-Order view could close itself** when a background Firestore
  sync refreshed the screen on mobile. The refresh re-queried by a `data-sov-pop` key shared by the
  desktop and phone card layouts and could grab the wrong (hidden) element, closing a popup that was
  still open and visible. (`js/so-view.js`)
- **"Clear Filters" showed as active (enabled) on a freshly opened register with no filters applied**, on
  Receipts, Purchase Invoices and Supplier Payments. Each register's default sort is "Recently Created"
  (`created-desc`), but the button's active/disabled check and its own reset compared against the old
  default, `date-desc` — so the button always looked "on" until the sort was touched. Receipts, Supplier
  Payments, Purchase Invoices, Quotations, Sales Orders and Delivery Notes all corrected to check against
  their actual default sort. (`js/receipts.js`, `js/purchases.js`, `js/supplier-payments.js`, `js/app.js`)
- Several browser tests were failing from unrelated staleness, now fixed:
  - `deliveries.e2e.mjs` hard-coded October's document-period code ("2610"), which breaks every month —
    now computed from the real clock, like the other register tests.
  - `receipts.e2e.mjs` still checked for the old vertical `.bc-monitor` panel and the orphaned
    `#invreg-pay-section`, both replaced by the Phase5a horizontal monitor strip.
  - `invoicing.e2e.mjs` clicked a monitor KPI that's now visually behind the new Phase5a cards (same click
    handler, different element).
  - `purchase-edit.e2e.mjs`: the Supplier Payments supplier-search picker's compact styling
    (`.bc-pick-compact` in `css/purchases.css`) didn't match the Receipts customer filter it's meant to
    look like — border colour, radius and input weight brought in line.

## Testing
- 150/150 unit tests pass.
- Full browser suite: 90/90 pass (`npm run test:browser`).

## GitHub upload
`index.html`, `sw.js`, `js/app.js`, `js/role-core.mjs`, `js/permissions-ui.js`, `js/receipts.js`,
`js/purchases.js`, `js/supplier-payments.js`, `js/so-view.js`, `css/purchases.css`,
`tests/browser/rights.e2e.mjs`, `tests/role-service.test.mjs`, `tests/browser/deliveries.e2e.mjs`,
`tests/browser/receipts.e2e.mjs`, `tests/browser/invoicing.e2e.mjs`.
