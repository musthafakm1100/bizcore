# BizCore V271.9 — Estimates in the Pricing register · Service quotation on the Product layout (12 Nov 2026)

Agreed 12 Nov 2026 (mockups CQ_1–CQ_3, CQ_3c table, subtitle S2).

## 1. Pricing register — estimates listed
- Contracting estimates appear as `EST-…-V{n}` rows next to the `PRC-…` pricing documents (cost, selling, profit,
  margin, status, quotation). Click opens that estimate version.
- New **Type** filter: All types / Pricing / Estimation (tiles, counts and Excel export follow it; estimates have no
  line-items sheet).

## 2. Service / Contracting quotation print — Product layout
- Template "Service" now prints on the Product quotation layout: same header, title box, Quotation To /
  Reference boxes, totals, signatures and footer. Subtitle **Proposal for Works**.
- Info strip: Payment Terms · **Completion Period** · **Mobilization** · VAT / Currency.
- Terms: validity, completion period, mobilization, payment, "Work outside the above scope will be quoted separately."
- From an estimate, sections A, B… with numbered lines A1, A2… in the chosen print style:
  Lump Sum Only (Qty/UOM if shown, "Lump Sum Price") · With Section Totals (amount on the section row) ·
  Section Total with Item Rates (Qty, UOM, Unit Price per line; "Total — section" row).
- The quotation view screen shows the same subtitle, strip and terms.

## 3. Table style (Product and Service prints)
- Light row lines, light outer lines left and right, navy closing line; no inside vertical lines.

## 4. Quotation screen
- Service quotations show **Completion Period** and **Mobilization** (type-or-pick, "+ Add new term…") instead of
  Delivery Terms. Saved as `completion` / `mobilization` on the quotation.
- Lists managed in Administration → Defaults (cards next to Delivery / Payment Terms); kept in the settings document
  (no new Firebase collection, no rule change). Defaults: "2 weeks from site handover", "1 week from confirmed PO".
- Older service quotations without a completion period print their delivery terms there.

## Files
`index.html`, `sw.js` (cache `bizcore-shell-v2719`), `js/app.js`, `js/quotation-ui.js`, `js/estimate.js`,
`css/quotation.css`; test `tests/browser/service-quote-v2719.e2e.mjs`.

## V271.9.1 — line amounts · rates in whole halalas · print style at Print / PDF (12 Nov)
- **Line amounts** printed in "With Section Totals" and "Section Total with Item Rates".
- **Estimate rates in whole halalas:** each item's rate is rounded down or up so the lines (qty × rate) add up to the
  lump sum; an item with qty 1 takes any rest. No hidden halala line discounts on quotations any more. When the
  quantities cannot make the typed lump sum exactly (e.g. qty 120 and 600 move in steps of 1.20), the nearest amount is
  used and the estimate shows a note under Quoted Price.
- **Print style moved to Print / PDF:** the Quotation Output dialog shows "Print style" (and Show Qty / Unit) for a
  quotation made from an estimate with the Service template; the choice is remembered on the quotation. The quotation
  screen's Contracting panel only shows the style in use.
- Files: `js/app.js`, `js/estimate.js`, `index.html`, `sw.js` (cache `bizcore-shell-v27191`); tests updated
  (`estimation-v2711`, `quote-job-v2712`, `service-quote-v2719`).
