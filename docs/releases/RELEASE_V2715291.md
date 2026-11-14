# BizCore V271.5.29.1 — Semantic monitor card color CSS fix

Baseline: V271.5.29. UI-only.

Cause: The default CSS selector `.bc5-strip:not(#nonexistent)` carried artificial ID-level specificity, overriding later semantic `[data-tone]` palette rules. Consequently RFQ Quoted and Overdue retained navy backgrounds despite green/red status colors, and matching icons were wrong.

Fix: Remove the artificial `:not(#nonexistent)` from the base monitor card selector; all semantic rules now outrank the fallback. This corrects full-card colors and their icon custom properties in shared monitor cards. Pricing's separate approved CSS with `#page-costing` remains unchanged. Jobs and Sales Orders implementations remain unchanged. No metrics, Firebase, filters or workflows were modified.

Verify RFQ amber/blue/teal/burgundy; Quotations Draft slate-purple, Sent blue, Won teal, Follow-up amber; Invoices/financial status colors and Stock; check Pricing unchanged.
