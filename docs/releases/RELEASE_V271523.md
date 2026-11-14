# BizCore V271.5.23 — Jobs & Quotation SAR subtitles, Stock desktop monitor
Baseline: V271.5.22. Visual and read-only metric display changes only.

- Jobs cards: existing counts plus actual loaded/scoped contract values (SAR), icon alignment as Pricing; To Invoice remains unavailable, never invented.
- Quotation cards: actual net quotation SAR totals for active, Draft, Sent and Won from existing scoped quote data using `calcQuote` (VAT inclusive). No new query; Follow-up Due remains unavailable.
- Stock desktop: horizontal 5-card monitor using original hidden stock fields, unchanged filtering, stock value and can-go-to-orders amounts. Old sidebar remains in DOM for stock calculations; hidden on desktop only. Small gaps, rounded table and sticky table kept through shared CSS.
- All other screens stay untouched. No changes to Firestore, database, posting, sorting or pagination.
- Authenticated visual verification pending.
