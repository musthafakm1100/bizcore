# BizCore V271.5.38 — RFQ Type column/filter + RFQ Age/Reference/Type/Progress/Status sorting fix

Base: V271.5.37.

## Fixed
- **RFQ register column-header sorting.** `BC_REGISTER_SELECTS` was missing an entry for the `rfq` screen,
  so clicking any RFQ column header other than RFQ No., RFQ Date, Due Date or Customer (i.e. Reference,
  Status, Age or Progress) had its sort cleared on the very next render and silently did nothing. Found
  while investigating `tests/browser/rfq-view.e2e.mjs`'s "oldest waiting RFQ first" check. Fixed in
  `js/app.js`: `rfq:'rfq-sort'` added to `BC_REGISTER_SELECTS`, and the dropdown-option naming for RFQ No./
  Date/Due Date/Customer kept as before (no duplicate Sort By entries).
- Two tests had drifted from reality and are corrected, not loosened:
  - `tests/browser/estimation-v2711.e2e.mjs` used a fixed due date (05-11-2026) that had since passed,
    making the RFQ "Overdue" instead of ready for an estimate. Dates are now relative to today.
  - `tests/browser/offline-numbers.e2e.mjs` hard-coded October 2026's document-number period ("2610"),
    which breaks every month once the real clock moves on (document numbers reset monthly — see
    `docPeriod()` in `js/app.js`). Numbers are now computed from today's period, like the screens do.

## Added — RFQ Type column and filter (mockup approved)
- RFQ register: new **Type** column after Reference (coloured pill: Product/Service/Mixed/Contracting;
  an RFQ saved before this column existed shows "Product", matching the RFQ form's own default).
- New **Type** filter in the toolbar, between Customer and Status; narrows the RFQ Monitor counts too,
  the same way the Customer filter does. Included in Clear Filters.
- Column and filter both sort/filter by the RFQ's existing `requestType` field — no new data, no change
  to RFQ entry, Pricing, Estimation or any other screen.
- `css/register-standard.css`: RFQ-specific toolbar width rules so the extra filter still fits on one
  line at laptop/tablet widths (other registers are untouched — they have no Type filter).
- `css/status-badges.css`: four new pill colours (`rfq-type-product/service/mixed/contracting`).
- `docs/UI_STANDARDS.md` updated with the new filter/column.

## Testing
- 150/150 Node unit tests pass.
- Targeted browser tests pass: registers, so-register, rfq-view, rfq-entry, masters, responsive, theme,
  estimation, offline-numbers (4 cases).
- Full browser suite (90 cases) re-run after this version; see the chat for the result.
- No Firebase, data model, or business-logic changes.

## GitHub upload
`index.html`, `js/app.js`, `css/register-standard.css`, `css/status-badges.css`, `sw.js`,
`docs/UI_STANDARDS.md`.
