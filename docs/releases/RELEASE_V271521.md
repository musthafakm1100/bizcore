# BizCore V271.5.21 — Desktop Register Header and Scroll Correction

Baseline: V271.5.20 (Pricing V271.5.19 remains approved visual reference).

- RFQ: stable scroll viewport, sticky 0-offset heading, rounded table container, 5px gap, theme-tinted header.
- Quotations: correct legacy 48px table-header offset and opaque scroll viewport; retain rounded table container and 5px gap.
- Other compatible transaction registers: unify header offset, theme tint, table corners, and 5px toolbar gap.
- UI-only: no changes to records, Firebase, sorting, filtering calculations, document status or pagination code.
- Stock's specialized vertical monitor remains structurally unchanged and needs dedicated review.

Browser validation: static local fixture only; authenticated Firebase screens still require visual confirmation.
