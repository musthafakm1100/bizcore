# V271.5.31 — Customer Directory Pricing-standard trial

Based on V271.5.30. Scope: Customers toolbar/table styling only.

- Retains option-B Master Data navigation.
- Uses Pricing shared tokens for control sizes, fonts, theme tint and table header.
- Single toolbar contains existing search, sort, import, delete-selected and new-customer actions, preserving all original handlers.
- Import and delete actions icon-only, titles and accessible labels preserved.
- Independent customer-table scrolling on wide desktop with opaque sticky column heading.
- 5px toolbar-to-table separation, rounded table corners.
- Existing master record two-line name/code, pagination, sorting and selection untouched.

UI-only; no Firebase or business logic changes. Browser visual verification in authenticated TEST remains necessary.
