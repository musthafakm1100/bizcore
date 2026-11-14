# BizCore V271.5.11 — Desktop register table styling parity

Baseline: V271.5.10 (Sales Orders trial + V271.5.9 compact sidebar).

**Visual changes only** for desktop (viewport >= 761px) on primary register tables:
- RFQ, Pricing, Quotations, Jobs, Delivery Notes, Customer Invoices, Receipts, Purchase Invoices, Supplier Payments and Stock.
- Remove vertical table cell separators, preserve subtle horizontal row dividers.
- Regular weight for first-column document numbers / identifiers, matching the existing Sales Orders styling.
- Sales Orders keeps its V271.5.10 treatment; no duplicate rule in this stylesheet.

**Not touched:** JavaScript, HTML application structure, queries/Firestore, pagination, sorting, filters, status badges, entry forms, mobile layouts, sidebar or master-data tables.

Upload to GitHub preserving directory paths: `index.html`, `css/desktop-register-clean.css`.
Hard refresh (Ctrl+Shift+R). Inspect each register visually. Browser sign-in verification not performed.
