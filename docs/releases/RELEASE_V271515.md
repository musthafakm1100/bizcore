# BizCore V271.5.15 — Global status badge consistency

Based on V271.5.14.1 confirmed working release. Presentation-only changes.

- Shared 12px/500/4px × 10px badge design covers Sales Order, RFQ, Quotation, Delivery Notes (including Partially Accepted and Rejected), Customer Invoice issuance/credit and payment states, receipts, supplier invoice/payment statuses and delivery acceptance chips.
- Out for Delivery (sky), SO Partially Delivered (amber), DN Partially Accepted (purple), Rejected/Overdue (red), Paid (dark green), Part paid (light green), To Invoice (orange), and Voided (neutral).
- Invoice issuance and payment remain separate badges; status computation, selection, data operations, and filtering are untouched.
- Purchase Invoice partial payment receives an existing-state-derived CSS class, no change to calculation.
- Quotation and RFQ states receive fixed colors and consistent typography.
- Existing decorative chips, monitor cards and document-type pills are excluded from the shared status badge rules.
- Cache revisions ensure the new stylesheet and existing purchase renderer load.

Test authenticated screens to confirm visual styling; test run results are recorded separately.
- Receipt amounts labelled unapplied use amber rather than the light-green Partially Paid indicator.
