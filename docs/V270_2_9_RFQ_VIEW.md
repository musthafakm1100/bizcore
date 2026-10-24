# V270.2.9 — RFQ view (Layout A) and RFQ age badge (25 Oct 2026)

Approved mockup **RFQV_2** (Layout A refined).

## RFQ view
- **Header** (theme colour): RFQ number · status · **age badge**. Customer and reference are not repeated here.
- **Strip:** row 1 — **Customer** and **Customer RFQ reference / subject** in a larger font (16.5px);
  row 2 — Contact · Request type · Received (via channel) · Response due (in N days / due today / overdue by N days /
  answered) · Assigned to · Entered (date, time, who entered it — saved on new RFQs from now on).
- **Next step** with a progress line RFQ → Pricing → Quotation → Sales Order (dates, priced lines, document numbers);
  shown in red tones when the response is overdue.
- **Tabs:** Items (RFQ lines with remarks; after pricing, the pricing lines with Priced / Pending) · Requirements
  (location, required date, duration, scope text) · Attachments · **Activity** (built from what is stored: RFQ logged,
  pricing versions, quotations, Sales Orders, No Bid — no separate log).
- Footer actions unchanged (Delete only without pricing / quotation; Edit; No Bid / Reopen; Start / Edit / Revise
  pricing; Open quotation; Close / Back). Text is escaped.

## Age badge
- Days since **Date received**, only while the RFQ waits for a quotation (status New / In Pricing):
  Today · 1 day … 14 days · **14+ days**. Grey 0–2 days, amber 3–6, red 7 and more.
- Gone once a quotation is created (or Sales Order / No Bid) — the number no longer matters then.
- Shown in the RFQ view header and as a sortable **Age** column in the RFQ register (sort descending = the RFQs
  waiting longest first).
- Print / PDF of the RFQ: not included (later, if wanted).

## Files
- js/app.js — viewRFQ (Layout A), `rfqOpenAge`, `rfqAgeBadgeHtml`, `rfqViewTab`, register Age column, `createdBy`.
- css/rfq-entry.css — view and badge styles. index.html — versions. sw.js — `bizcore-shell-v27029`.
- Tests: tests/browser/rfq-view.e2e.mjs (new).
- Upload: **index.html, sw.js, js/app.js, css/rfq-entry.css** (+ earlier V270.2.5–2.8 files if not uploaded). No rules change.
