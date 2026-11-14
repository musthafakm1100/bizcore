# V270.4.13 — Categories & Units of Measure screens tidied · Merge into… (31 Oct 2026)

Asked by Musthafa on 31 Oct (mockups CM_1, CM_2, CM_3).
- Both tables compact (only as wide as needed), names in **regular weight** (not bold), numbers aligned.
- Standard search field; filter chips — Categories: All / Goods / Services / **Unused**; Units: All / Goods / Services /
  Both / **Unused**; click a heading to sort (Category / Used for / Items; Code / Used for / Items).
- **Items** column on Units (products using the unit); unused counts faded; Unit name grey when it only repeats the code.
- Row buttons always in the same place: **Merge into…** · Edit · Delete (Delete only when nothing uses it).
- Categories: likely duplicates marked "similar: …" (one name's words inside a same-type category's name; the most used
  one is suggested).
- **Merge into…**: Categories — only same-type categories offered (the similar one first); the items move over (their
  change history keeps the old category), the merged category is removed. Units — any unit; products change their unit
  (history kept); issued documents keep the old unit; refused when a product of that unit has stock.
- "Add suggested service units" moved next to Add UOM.
Files: index.html, sw.js (`bizcore-shell-v27058`), js/app.js (?v=270.58), css/main.css (?v=270.58). No rules change.
Test: tests/browser/b2b-categories-multiquote.e2e.mjs, second test.
