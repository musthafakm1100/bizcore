# BizCore V271.5.27 — Dark Premium monitors global rollout

**Base:** V271.5.26.1. The user approved Dark Premium Pricing cards and typography (title 15px, main count 23px, detail/SAR 13px).

## Scope
- New CSS `css/monitor-dark-premium-global.css` applies dark premium fills and shared typography to desktop monitor cards in RFQ, Quotations, Delivery Notes, Customer Invoices, Payment Receipts, Purchase Invoices, Supplier Payments, Stock, Jobs, and Sales Orders. Pricing keeps its previously approved dark styling, with matching shared font tokens.
- First/lead card retains the current theme color; subsequent monitor cards use navy, purple, teal, burgundy (and neutral for fifth or later cards).
- Existing layout, icons, counts, progress-width computation, sorting/filter actions, sticky tables and screen workflows preserved.
- Only changes: `index.html` CSS link, `css/monitor-dark-premium-global.css` added, `sw.js` cache/version bump.

## Validation
- Node JS syntax validation on `sw.js` passed.
- 150 unit tests passed (node --test, no failures).
- Visual browser checks attempted but unavailable: Chromium requests were blocked by administrator in this runtime. Authenticated TEST visual inspection must be done after upload.

## Validation after upload
Check Pricing unchanged, then Jobs, Sales Orders, RFQ, Quotations, Stock, both invoice screens, Delivery Notes, and both payment registers at desktop widths and with different themes. Confirm long SAR amounts remain legible, selected card outline visible, zero-count bar empty, and card icon/title alignment stable. Mobile/tablet unchanged.
