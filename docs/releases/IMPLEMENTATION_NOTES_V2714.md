# BizCore V271.4 — Register sorting and Jobs UI (review build)

Baseline: User-provided BizCore V271.3.2. This is an independent copy. The original package was not modified.

## Implemented
- Administration / Numbering: Added a **read-only Sorting Priority** column derived from the already-editable sequence reset rule. Monthly = Year / Month / Sequence; Yearly = Year / Sequence; Never = continuous sequence. No new setting is persisted and existing document numbers are untouched.
- Shared register column sorting: numeric sequence-aware document comparison for RFQ, Pricing, Quotation, Sales Order, Delivery Note, Customer Invoice, Purchase Invoice, Customer Receipt, and Supplier Payment. Number-format changes made historically need additional migration testing.
- RFQ: dropdown with Recently Created (default), RFQ Number ascending/descending, Date ascending/descending, Due Date, Customer. Column-header sorting and dropdown are aligned for common columns.
- Jobs: compact horizontal status monitor above the register; sorting dropdown, sortable headings, lighter text, and removal of the old 1500px width cap. Existing Job Expense action, quotation-to-job creation, filters, and data remain.

## Known limitations / next implementation passes
- The current Jobs data model supports Open, In Progress, Completed, Closed, Cancelled; it **does not** yet support On Hold or Job-to-Customer-Invoice linkage. For accuracy, the monitor uses these existing actual statuses instead of inventing an On Hold or To Invoice count. The approved visual layout will support replacing these when functionality is available.
- Other register-specific dropdowns and synchronization are not yet implemented (many already have clickable headers). The shared comparator upgrade does not introduce dropdowns throughout the application.
- No changes to Firebase rules, Firestore schema, saved data, document sequences, job calculations, or invoicing flows.
- All 150 baseline Node unit tests passed; Playwright browser checks could not run because Playwright is not installed.
- **Do not deploy directly to production** until the app is visually tested and existing record / historical numbering edge cases are checked in TEST Firebase.
