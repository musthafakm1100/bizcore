# BizCore V271.5.13 — Pricing register typography parity with Quotation

Baseline: V271.5.12. CSS-only desktop change. The Quotation register is untouched.

- Pricing ordinary table cells, references, customers, versions, dates, amounts: 14px, normal 400 weight, fixed #111827 matching Quotation row renderer.
- Pricing headings: 12px, weight 600, #536273 matching Quotation headings.
- Negative profit/margin preserve warning color.
- Existing row separators, row heights, sortable headers, links, filters, statuses, monitor, theme accents and pagination unchanged.
- No JavaScript logic, Firestore, data model or mobile changes.

Upload `index.html` and `css/desktop-register-clean.css` from GitHub package. Hard refresh browser.
Browser verification requires authenticated session; validate Pricing and Quotation visually on the live TEST app.
