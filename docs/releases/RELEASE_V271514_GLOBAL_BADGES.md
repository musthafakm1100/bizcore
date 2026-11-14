# BizCore V271.5.14 — Global Status Badge Standard (replacement build)

**Baseline:** V271.5.13 (the previously distributed V271.5.14 is deliberately excluded).

- New `css/status-badges.css`, loaded immediately after the existing inline typography standard to resolve conflicting `.badge` font-size/weight overrides.
- Shared status badge typography: 12px, 500, 4px 10px, rounded pill.
- Existing Sales Order status classes receive fixed semantic colors independent of theme. Out for Delivery sky blue; Partially Delivered amber; Invoiced green; Paid dark green; Partially Paid light green.
- Existing `.rct-pay-pill` Paid and Partially Paid colors align with the agreed payment semantics.
- `To Invoice` is now a companion pill in Sales Orders rather than plain text. The existing `so._toInvoice` boolean is unchanged.
- RFQ, quotation, DN and other existing statuses retain their prior semantic color mappings; their shared `.badge` shape and typography are standardized.
- No data, Firebase, business status calculation, sorting, filtering, pagination or navigation behavior changed.

**Review note:** CSS-level changes still require real-browser visual verification in the user's authenticated TEST environment before this version is treated as an accepted visual baseline.
