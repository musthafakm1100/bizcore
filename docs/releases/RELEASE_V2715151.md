# BizCore V271.5.15.1 — Red Void/Cancelled Statuses

Baseline: V271.5.15 Global Status. UI styling-only patch.

- Voided and Cancelled: soft red background #FEE2E2, dark red text #991B1B.
- Rejected: deeper red background #FECACA, dark red text #7F1D1D.
- Retain neutral Draft badges and all other approved status colors.
- Increase badge stylesheet URL version and service-worker cache name for reliable refresh.
- No JavaScript application logic, Firestore access, calculations, filtering or pagination changed.

Upload index.html, css/status-badges.css, sw.js to GitHub while preserving folders.
Authenticated browser verification still required.
