# BizCore V271.5.37 — Housekeeping (no visual change)

Base: V271.5.36.
- `sw.js`: offline file list rebuilt from the exact versions `index.html`, `login.html`, `delivery.html`, `mycash.html` and the JS modules load (101 entries; 11 stale removed, 18 added). Cache name bumped.
- Tabler icons pinned to `@tabler/icons-webfont@3.51.0` in `index.html`, `login.html`, `mycash.html` (was `@latest`).
- `docs/UI_STANDARDS.md`: new section 11 (V271.5 desktop register standard) and a pointer in section 1.
- Tests: `registers.e2e.mjs` and `so-register.e2e.mjs` updated to the V271.5 design (optional Sort By, 13 px controls, new status wording, hidden old monitor rows; the old monitor collapse check retired).
- `js/master-registers-pricing-standard.js` is not loaded anywhere; left in the full set, left out of the GitHub set.
- No app logic, Firebase rules, indexes or data touched.

GitHub upload: `index.html`, `login.html`, `mycash.html`, `sw.js`, `docs/UI_STANDARDS.md` (the GitHub set also contains every other file; only these five changed).
