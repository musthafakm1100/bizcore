# V271.5.16 — Pricing register toolbar and header visual trial

Base: V271.5.15.1 Global Status (latest accepted). Scope: Pricing register **desktop only**.

- Existing one-line toolbar kept; same fields, order, sizes except icon-only Clear Filters and Export Excel.
- Subtle theme-aware toolbar and table heading backgrounds (using existing `--c-*` tokens).
- Soft neutral grey inputs `#f8fafc` and consistent 13px regular toolbar text.
- Header text slate `#475569`, 12px medium; subtle bottom separator, no vertical borders.
- Buttons preserve their existing handlers, title tooltips and Excel icon.
- No JS application logic, data operations, calculations, sorting, pagination or other registers changed.
- New CSS loaded last; cache version bumped to avoid stale styles.

GitHub upload: `index.html`, `css/pricing-toolbar-trial.css`, `sw.js`.
