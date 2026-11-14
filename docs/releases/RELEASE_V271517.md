# BizCore V271.5.17 — Pricing pinned table trial

Based on V271.5.16. UI-only changes to Pricing.

- Added 10px gap between Pricing toolbar and column headers.
- Pinned all Pricing page elements except the row list. The table scrolls inside an opaque white container; column headings remain visible.
- Prevented records from appearing in gaps between monitoring cards, toolbar and header.
- Pricing Clear Filters icon is disabled/grey unless customer, status, date, search or monitor status filtering is active. Sorting alone does not count as a filter.
- The existing Clear Filters handler, monitor filters, Firebase, sorting, pagination and transaction code are unchanged.
- Tablet/mobile layouts are intentionally not modified.
- Browser visual testing in authenticated GitHub deployment is still required.
