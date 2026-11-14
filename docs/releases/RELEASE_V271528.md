# BizCore V271.5.28 — Global semantic monitor icon color correction

**Baseline:** V271.5.27 — approved Dark Premium monitor cards. This update corrects icon badge background and icon glyph color to match each metric's meaning instead of card position.

- RFQ: Awaiting Pricing amber; In Pricing blue; Quoted green; Overdue red.
- Quotations: Draft slate; Sent blue; Won green; Follow-up Due amber.
- Delivery Notes: Draft slate; Out for Delivery blue; Delivered green; Pending Acknowledgement amber.
- Customer / Purchase Invoices: Unpaid blue; Partially Paid light green; Paid green; Overdue red.
- Payment Receipts: Receipts blue; Fully Allocated green; Partially Allocated purple; Unallocated amber.
- Supplier Payments: Payments blue; Fully Applied green; Partially Applied purple; Unapplied amber; Advances purple.
- Stock: In Stock green; Used Up slate; Open Demand amber; Over 90 Days red.
- Jobs: Open blue; In Progress purple; Completed green; To Invoice amber.
- Pricing retains its previously approved semantic blue/purple/green/red icons.

**No changes** to dark card surfaces, layouts, typography, values, bar widths/calculations, filters, Firebase, or workflows. Stock In Stock progress accent changes from blue to green for consistency (width unchanged). The lead card remains theme-colored.

**Deployment:** upload `index.html`, `css/monitor-dark-premium-global.css`, `sw.js`. The CSS link and service-worker cache version were bumped to ensure fresh assets.

**Testing:** isolated CSS checks and unit tests; authenticated browser visual verification still required.
