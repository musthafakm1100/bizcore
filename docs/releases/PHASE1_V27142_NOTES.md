# BizCore V271.4.2 — Phase 1 register sorting review build

Base: V271.4.1 Jobs Monitor Fix. Original files and Firebase database not modified.

## Changed
- Consistent Sort By choices for Quotation, Pricing, Sales Orders, Delivery Notes, Customer Invoices / Credit Notes, Customer Receipts, Purchase Invoices, Supplier Payments.
- Shared dropdown / table-heading state and intelligent document-number order.
- Recently Created choice where usable, with document-date fallback for older records without a recorded creation timestamp.
- Existing business-specific sorting options and layout retained.

## Limitations / next validation
- 150 existing unit tests passed; browser tests have not run, and new UI behavior requires localhost verification.
- Customer Invoice / Credit Note combined display retains Document Date as default rather than assuming creation timestamps are available in flattened register rows.
- Other non-transaction registers (stock, master data, finance and job expenses) are outside this Phase 1 update.
- Historical number-format changes need full test with representative legacy records.

## Safe use
Test on localhost using TEST Firebase; back up current GitHub files before deployment. Do not treat unit-test success alone as deployment approval.
