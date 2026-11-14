# BizCore Phase 5A — Horizontal monitor review build

Baseline: V271.4.3 Product Sort Hotfix (local test package). No production deployment or Firebase mutation.

## Included
- Removed the top global-search control visually (register-specific search is retained).
- Added compact, theme-aware horizontal monitors to RFQ, Pricing, Quotations, Delivery Notes, Customer Invoices, Payment Receipts, Purchase Invoices and Supplier Payments. Layout measures follow Sales Orders.
- Existing monitor DOM nodes remain in place (hidden from visual layout), so existing calculations and filters are preserved. New cards mirror existing supported metrics and invoke existing filter handlers where available.
- Updated Jobs to five desktop monitor cards: Total Jobs, Open, In Progress, Completed, To Invoice; original other statuses remain in the status dropdown.
- **Unavailable workflow metrics deliberately show an em dash and are not clickable.** This is not full functionality implementation.

## Functionality not yet implemented (requires separately tested data/workflow changes)
- Pricing Ready to Quote and target-date overdue (new completion/target data).
- Quotation Follow-up Due (follow-up schedule/record tracking).
- Jobs To Invoice (reliable job-to-invoice and milestone linking).
- Delivery Note Pending Acknowledgement and historical-status migration; also explicit Draft detection.
- Payment Receipt full vs partial allocations, Supplier Payment applied vs unapplied breakdown, Purchase Invoice payment breakdown.
- Some status controls only filter where their existing native monitor already filters.
- Comprehensive responsive/live Firebase end-to-end testing.

## Tests
- `npm test`: 150/150 passed.
- `node --check js/jobs.js` and `node --check js/phase5a-monitors.js`: passed.
- Headless browser DOM/component smoke: RFQ strip renders, filter invokes existing handler, count updates after data changes.
- Full app browser navigation was blocked by environment policy; visually test localhost before GitHub deployment.

## Files for GitHub (relative to the hotfixed V271.4.3 baseline)
- index.html
- css/phase5a-monitors.css (new)
- js/phase5a-monitors.js (new)
- js/jobs.js

Do not upload to your live GitHub environment before visually validating the screens and approving handling of missing metrics.
