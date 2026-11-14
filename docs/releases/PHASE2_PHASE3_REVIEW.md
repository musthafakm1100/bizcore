# BizCore V271.4.3 — Phase 2 + Phase 3 review build

Baseline: V271.4.2 Phase 1 plus the approved sorting-control CSS hotfix. No Firebase or production records were changed.

## Phase 2 — numbering sorting validation
- Existing document-number comparison retained.
- Five new targeted tests validate yearly-reset ordering, cross-year transitions, monthly ordering, never-reset continuous sequence, YYYYMM formats, and quotation revisions.
- No format, counter, sequence, or historical document-number mutation.
- Known limit: historical documents created under subsequently changed numbering configurations may not sort perfectly. Robust handling needs immutable sequence/year/reset metadata or numbering version on each record, a separately reviewed migration.

## Phase 3 — Master Data register sorting
- Customer, Supplier, Product (goods/services), and Employee directories have visible Sort By dropdowns.
- Existing clickable headers and search/filters remain, with dropdown selections synchronized.
- Defaults: company A–Z for customers and suppliers; product name A–Z; employee A–Z.
- Pagination resets when selection changes. Records remain unchanged.

## Validation
- Node syntax check passed for js/app.js.
- 150 existing unit tests and five focused comparator tests passed.
- Visual browser and Firebase emulator tests have not been run. Test locally before publishing.
