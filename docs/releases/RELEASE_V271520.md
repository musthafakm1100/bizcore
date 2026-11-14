# V271.5.20 — Global UI Foundation (Desktop trial)

Based on V271.5.19. Adds central CSS tokens and shared monitor, icon, toolbar, table, and scroll styles to the 8 compatible Phase5A registers plus Sales Orders for shared toolbar/table styling. Pricing accepted layout retained.

## Scope
- Global `css/bizcore-ui-global.css`: one edit for card sizes, typography, control height, colors, gaps, icons, header and row settings.
- Individual soft Phase5A monitors (RFQ, Pricing, Quotation, Delivery Notes, Customer Invoices, Receipts, Purchase Invoices, Supplier Payments).
- Shared toolbar/table appearance across RFQ, Pricing, Quotation, Sales Orders, Delivery Notes, Customer Invoices, Receipts, Purchase Invoices, Supplier Payments.
- Fixed monitors and toolbars with independently scrolling data and sticky table headers for table-based registers; Pricing implementation remains its already tested layout.
- Jobs, Stock, RFQ list, Master Data, document editors and mobile/tablet have different DOM structures; their full sticky component migration is **not** part of this safe initial rollout.
- Does not change Firebase access, record calculations, status or filter logic, pagination, data models or business workflows.

## Verification
Run tests; authenticated visual regression is still required at desktop sizes and themes before full adoption.

Accepted Pricing styles now consume global variables for card heights, gaps, icon sizes, toolbar controls and table headers.
The shared tokens are implemented in `css/bizcore-ui-global.css`.
