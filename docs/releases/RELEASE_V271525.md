# BizCore V271.5.25 — Monitor progress-bar correction

Baseline: V271.5.24 complete master. UI/read-only only.

- Customer Invoices: bars reflect status counts divided by the sum of Unpaid, Partially Paid, Paid and Overdue counts. This excludes credit-note records.
- Sales Orders: bars reflect count of orders in each tile divided by order count in the current monitor scope; To Invoice can overlap delivery statuses.
- Other Phase 5A monitor bars: show count-based ratios only when an existing total KPI is available. Zero/unavailable statuses display unfilled tracks.
- Invoice/Purchase Invoice status bar colors: Unpaid blue, Partially Paid light green, Paid dark green, Overdue red.
- Hover tooltip explains count/denominator/percentage. Currency amount subtitles and card counting logic are unchanged.
- No new Firestore reads/writes, backend, sorting, filtering, pagination or financial calculations.
- 150 unit tests passed, JS syntax checks passed. Full authenticated browser testing pending.
