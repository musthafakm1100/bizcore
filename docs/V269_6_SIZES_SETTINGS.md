# V269.6 — Data plan steps 4 + 5: settings pictures, size guard, Data Health counts and largest records

Built 19 Oct 2026 with the choices Musthafa approved (19 Oct, 09:11). **Website files only — no rules change.**
With this, data plan steps 1–5 are complete.

## Settings split
- The company pictures (logo, stamp, signature) are kept in their own records: `settings/img_logo`, `settings/img_stamp`,
  `settings/img_signature`. `settings/main` keeps everything else (marked `_imagesSplit`) and stays small.
- A save writes a picture only when it changed. Other screens get a changed picture straight away.
- Old settings (pictures inside the main record) are read as before and moved out on the next "Save Settings".
- The other lists in the settings (categories, numbering, print options) are small and stay in `settings/main`.

## Size guard on every save
- Above **500 KB**: saved, with a warning ("Q-… is getting large (612 KB of 900 KB)") once per record per session.
- Above **900 KB**: refused, with a clear message (remove large pictures / long text, or split). The other changed
  records of the same save are still saved. Firestore's own limit is 1 MB a record.
- Applies to list saves, RFQ + pricing version saves and the settings (each picture on its own).

## Data Health (Administration)
- **Records in Firebase:** count per collection (quotations, RFQs, sales orders, delivery notes, invoices, credit notes,
  receipts, purchase invoices, supplier payments, cash lines, stock items, customers, suppliers, products, employees,
  notification log) and the total. Firebase counts them: about one read per 1,000 records, when Data Health opens
  (once per session; "Count again").
- **Largest records loaded now:** the 10 largest records on this screen, with OK / Large / Over the limit. Measured in
  the browser — no reads. (Older records that aren't loaded aren't measured.)

## Files
index.html, sw.js (bizcore-shell-v2696), js/app.js (?v=269.6), js/data-safety.js (?v=269.6).
Tests: tests/browser/sizes-settings.e2e.mjs (new); test double: getCountFromServer.

## Going live
Upload index.html, sw.js, js/app.js, js/data-safety.js. Ctrl+F5. Then once: Administration → Company Settings →
Save (moves the pictures out of the main settings record). No rules to publish.
