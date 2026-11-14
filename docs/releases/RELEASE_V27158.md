# BizCore V271.5.8 — Supplier Payments allocation and Purchase Invoice monitor consistency

Baseline: V271.5.7. No Firebase data, security rules or accounting postings changed.

- Fully Applied: posted invoice-payment records, including applied advances exactly once as part of invoice payment value.
- Partially Applied: advance records partly consumed, displays applied portion.
- Unapplied: advances with remaining funds, including partly consumed advances, displays remaining amount.
- Advances: same available advance balance displayed as an amount KPI; do not add to Unapplied.
- Selecting an allocation card filters supplier payment rows and preserves active date/search/supplier filters.
- Purchase Invoice summary overdue/outstanding values now use the same filtered invoice scope as other status cards; payment status dropdown includes Unpaid/Partially Paid/Paid.
- Invoice and advance calculations are read-only. Live authenticated browser testing is pending.

Test notes: existing 150 automated tests and 4 allocation-specific tests passed.
