# V271.5.33 — Master Data register UI correction
Baseline: V271.5.32. UI-only.

Corrected Suppliers, Products, Employees, Units of Measure, and Categories. The preceding build depended on a DOMContentLoaded script to add UI classes and relocate controls; the actual user screenshots showed the original layout. This release places the standardized classes and the existing action buttons directly in HTML so the approved Customers/Pricing styling applies without runtime transformation.

Design: compact single-row toolbar on desktop, same global font/control tokens, icon-only Import/Delete where present, theme-tinted table header, 5px toolbar-table gap, rounded table container and last-column padding. Employee/UOM/Category forms remain in place and functional.

Only index.html and sw.js changed; the existing CSS master-registers-pricing-standard.css is unchanged but cache-busted to 271.5.33. The old master-registers-pricing-standard.js is no longer loaded, avoiding duplicate DOM manipulation.

Tests: 166/166 Node unit tests pass; structural checks find toolbar actions and table headers in each screen. Authenticated UI visual testing remains pending. No Firebase, data, sorting, selection or pagination logic touched.
