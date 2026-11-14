# BizCore V271.5.24 — Global desktop register UI audit correction

Baseline: V271.5.23.1. Visual reference: approved Pricing V271.5.19.

## Fixed / standardized
- Addressed the real HTML table IDs for Customer Invoices (`invreg-table`), Receipts (`rctreg-table`), Purchase Invoices (`pireg-table`), Supplier Payments (`spreg-table`), Stock (`streg-table`), Delivery Notes (`dn-register-table`), Quotations (`quotes-table`) and Sales Orders (`so-register-table`). Several were missed by V271.5.21 rules matching only `dn-register-table`.
- These tables now use zero-offset sticky headers, opaque theme-tinted header backgrounds, the same light text weighting and no vertical borders.
- Standardized opaque, bounded row scrollers, rounded register containers and the shared 5px toolbar-to-table separation.
- Stock horizontal monitor occupies full desktop width and uses the same independent-scroll register layout. Job register maintains fixed sticky header and rounded table container.
- CSS uses the existing `--bc-ui-*` shared global tokens. No overrides target the approved Pricing page.

## Scope & testing
- Changed only index.html stylesheet reference, sw.js cache name / cached resource, and a new `css/bizcore-ui-audit.css`. Existing app JS, business logic, Firebase rules, data and calculations unchanged.
- 150 node unit tests passed.
- CSS parsing passed. Isolated Chromium layout tests confirmed sticky header top=0 and fixed y during row scrolling for eight register table types. This is not authenticated end-to-end testing.
- Manual TEST application verification still required, particularly individual modules, viewport widths, themes, no-overflow and pagination views.
- Master Data, Administration and document editors have different components, and are *not* declared fully audited or modified by this release.

## GitHub upload
Upload `index.html`, `css/bizcore-ui-audit.css`, `sw.js`, preserving paths. Refresh browser after GitHub publish. The previous stylesheets remain needed.
