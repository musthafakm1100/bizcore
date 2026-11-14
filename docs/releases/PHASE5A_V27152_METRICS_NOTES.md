# BizCore V271.5.2 — Monitor data wiring, step 1

Baseline: V271.5.1 layout fix. No Firebase rule, schema, number or record changes.

Connected cards:
- Payment Receipts: Fully Allocated, Partially Allocated, Unallocated (strictly zero applied) from receipt `amount` and `unapplied`; excludes voided records; all three filter the register. The prior Unapplied amount and existing receipt status remain unchanged.
- Purchase Invoices: Unpaid, Partially Paid, Paid, using existing purchase-core payment status and filtered non-void records. Cards filter the purchase register.
- Supplier Payments: Payments card shows the count of nonvoid payment/advance records in the visible register scope, but does not activate a misleading 'invoice payment only' filter.

Deferred: RFQ/Pricing/Quotation/Jobs/DN new workflow state, bank reconciliation, supplier payment application breakdown, historical metadata.

Warning: Counts in receipt/Purchase Invoice monitors follow their existing customer/supplier, date and text scope. Supplier Payments total uses existing currently displayed row rules.

No changes to accounting data, saving, or existing invoices. Verify on TEST Firebase.
