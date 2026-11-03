# BizCore V271.5.4 — Consolidated master release

Generated 03-11-2026 from the latest V271.5.4 working copy.

This is a **packaging and integration audit**, not new functional development. The web application source has not been modified by consolidation.

## Packages
- `BizCore_Master_V271.5.4_Complete.zip`: full source including tests, reference docs, and local test scripts.
- `BizCore_Master_V271.5.4_GitHub_Full_Sync.zip`: all web application files found in the source (HTML/CSS/JS/manifest/service worker/favicon). Upload over the existing repository **without deleting other files**.
- `BizCore_Master_V271.5.4_Changed_Since_V271.3.2.zip`: only changed/new web application files compared against the supplied original V271.3.2 archive. Intended only if upgrading directly from exactly that baseline.

## Important repository caveats
- The source package contains references to `icons/*.png` but **does not include those icon files**. Keep the existing icon directory on GitHub; never use a delete/replace-all operation when deploying the full sync ZIP.
- Test Firebase remains connected by the existing app configuration. Deployment does not create or modify Firebase rules, indexes, or data.
- Existing browser cache / service worker behavior and full Firebase integration have not been revalidated with an authenticated live session.
- Some financial monitor metrics and workflow-dependent fields intentionally remain unavailable as previously disclosed.

## Audit
- Web deploy file count: 90
- Files changed/new since V271.3.2: 12
- Missing references outside icons: 0
- JavaScript syntax failures: 0

## Upload steps
1. Back up or tag the current GitHub commit.
2. Extract `GitHub_Full_Sync.zip` and upload its contents while preserving directory paths. **Do not delete GitHub files missing from the ZIP** (especially icons).
3. Commit once and hard-refresh the live TEST application with Ctrl+Shift+R.
4. Verify login, RFQ/Pricing/Quotation, Jobs, invoices, payment receipts, purchase invoices, supplier payments, and monitor amount lines.

