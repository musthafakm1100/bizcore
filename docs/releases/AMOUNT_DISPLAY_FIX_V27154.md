# BizCore V271.5.4 — Finance monitor amount display correction

Baseline: V271.5.3.

Issue: Finance monitor amount lines showed a dash although register rows had values.

Changes: `index.html` now includes permanent read-only finance KPI amount fields before scripts run, so the initial register calculations have valid targets. Version query strings for invoicing, receipts, purchases, supplier-payments, and monitor scripts are bumped to 271.5.4 so browsers request the current code. Financial calculations, data, saving, and status rules are not changed.

GitHub-only package contains ONLY root `index.html`; install this over the V271.5.3 package, which must already contain the four corresponding JavaScript source files.

Validation: 150 unit tests passed; duplicate-ID/placeholder/script-source checks passed; browser with actual Firebase TEST data not tested. Please hard-refresh (Ctrl+Shift+R), verify the invoice and receipt examples against register data, and report any mismatch.

Known limitation: Supplier Payments application breakdown remains unavailable by design; dashes there are expected.
