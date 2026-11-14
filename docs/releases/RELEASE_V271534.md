# BizCore V271.5.34 — UOM and Categories table layout correction

Baseline: V271.5.33.

## UI-only changes
- Override legacy `table.cm-table {width:auto!important;margin:0 16px 8px}` for Units of Measure and Categories specifically.
- Tables fill their available register container, with a minimum width and horizontal scrolling where necessary.
- Reuse shared Pricing/Customers table headings (12px medium), body typography (14px regular), spacing and 24px right-edge padding.
- Preserve existing toolbar, forms, filter categories, buttons, data and event handlers.
- Bump shared Master Data CSS cache reference and service-worker cache name.

## Verification
- 166 Node unit tests passed.
- Full authenticated visual UI not run. Review both desktop screens and test UOM/Category edit, add, and merge dialogs after deploying to TEST.
