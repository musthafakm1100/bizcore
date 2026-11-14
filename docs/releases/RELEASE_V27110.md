# BizCore V271.10 — Service vs Contracting, view = Print / PDF, Type everywhere (13 Nov 2026)

Ten points agreed on 12–13 Nov 2026 (mockups QV_1, QV_2).

1. **Service vs Contracting terms** — a quotation is *contracting* when made from an Estimation or for a Contracting
   RFQ (Completion Period + Mobilization); other Services quotations (repair, maintenance, fabrication) keep
   **Delivery Terms**, like products. (`bcQuoteKind`)
2. **Work Category picker** (quotation lines) — search box: type to filter, Enter picks the first match (or offers the
   typed text as a new category), ↑ ↓ move, Esc closes.
3. **RFQ line items** — ↑ / ↓ go to the same field in the line above / below (Alt+↑↓ still moves the line).
4. **Quotation from Pricing** — Project / Site comes from the RFQ; the customer is cleared first, so nothing is left
   from the quotation opened before.
5. **No internal RFQ number** on any customer copy (all print templates and the view).
6. **Two templates** — *Service* (Commercial Offer, Delivery Terms, Scope of Work) and the new *Contracting*
   (Proposal for Works, Completion / Mobilization, sections in 3 print styles). The gallery opens on the template of
   the quotation's kind (Product keeps the last product template used). Print style bar only with Contracting.
7. **Type column + filter** — Pricing and Quotations registers: Product / Service / Contracting / Mixed (estimates =
   Contracting). The Pricing Type filter now uses these choices.
8. **Type badge in title bars** — quotation edit, quotation view, Pricing (Estimation already shows Contracting; RFQ
   view already had it). "· Services" removed from the quotation sub-title.
9. **"QUOTATION" centred** in its box on every template.
10. **Quotation view = Print / PDF** — the view shows the real print document (same template: the last one printed for
    the quotation, else its kind's default), in an A4 frame with the usual zoom; staff panels unchanged. A quotation
    from an estimate has a **Print style** bar (remembered on the quotation, used by Print / PDF).

Files: `index.html`, `sw.js` (cache `bizcore-shell-v27110`), `js/app.js`, `js/quotation-ui.js`, `js/estimate.js`,
`js/quote-scope.js`, `js/rfq-entry.js`, `css/main.css`, `css/quote-scope.css`, `css/register-standard.css`.
Tests: new `tests/browser/v27110.e2e.mjs`; updated `registers`, `service-quote-v2719`.
No Firebase rules change. New quotation fields: `printTemplate` (template last printed).

## V271.11 — quotation view layout (QV_3), print style names, one-click fix (13 Nov)
1. **Quotation view (QV_3):** slim title bar (QUOTATION + number on one line), type badge on the right before ✕;
   **Status** and **Print style** in a left column (the status row above the document is gone); the document sits
   higher and wider. Tablets / phones: the left column becomes compact rows above the document.
2. **Print style — one click:** the choice now always works on the current quotation record (the first click was lost
   when the view's copy had been replaced by a later save).
3. **Print style names:** **Detailed** (first, default) · **Section Totals** · **Lump Sum** — in the view, Print / PDF,
   the quotation's Contracting panel, the Estimation "Quotation Style" (new estimates default to Detailed) and the
   Contracting gallery card. A quotation with no saved style prints Detailed.
Files: `index.html`, `sw.js` (cache `bizcore-shell-v27111`), `js/app.js`, `js/estimate.js`, `css/main.css`.
Tests updated: `v27110`, `mobile-zoom`.
