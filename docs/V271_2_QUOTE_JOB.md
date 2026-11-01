# V271.2 — Quotation from the Estimate, and Award → Job (1 Nov 2026)

Second step of Contracting Basics. Built from the approved mockups **CQ_1** (quotation from the estimate), **CQ_2** (the
two print styles) and **CJ_1** (Create Job), and Musthafa's decisions of 1 Nov 2026:
price only from the estimate (a new estimate version to change it), **only a quotation discount** on the quotation;
both print styles kept; Job fields as in CJ_1, retention / payment terms as a note; Firebase free allowance respected.

## Quotation from the estimate
- Estimation window → **Create Quotation** (or **Save & Create Quotation** when there are unsaved changes). Every item
  needs a cost; the role needs Quotations → Create. The estimate is saved first when needed.
- It opens the normal **Quotation Entry** with the **Service** template (numbering, terms, remarks, Format bar,
  Mark as Sent, approvals, print — all as today):
  - each section → a **heading line**; each item → a **scope line** (free text, not linked) with the estimate's
    quantity and unit; the Project / Site from the estimate;
  - each line's amount is its **share of the lump sum** (shared by cost): the rate is rounded up to the halala and the
    few halalas over are a line discount, so every line — and the total — is exact; **Qty, Rate and line discounts are
    locked** on these lines; the line text can be reworded (Format bar);
  - the internal cost per line is the estimate's cost with overheads and contingency; the internal card shows the
    estimated cost and the profit; the header shows *From Estimation EST-…-V1* and the flow RFQ › Estimation V1 ›
    Quotation › Job;
  - a **Contracting card** on the summary panel: **Print Style** (Lump Sum Only / With Section Totals, from the
    estimate, changeable per quotation) and **Show Qty / Unit on print**.
- Only the **quotation discount** can be given. Before saving, BizCore checks that all the estimate's lines are there
  with their amounts (they make the lump sum) — otherwise "Lines changed from the estimate".
- Saving a new quotation from the estimate marks the estimate version **Converted** (read only, "Open Quotation"), the
  RFQ becomes Quoted. A new estimate version + Create Quotation makes a **revision** of the quotation (as with Pricing).
- **Duplicate** of such a quotation is an ordinary service quotation (no estimate link, prices editable).

## Print (Service template)
- **Lump Sum Only**: # (A1, A2 … B1), Scope of Work, Unit, Qty (optional); section headings; no rates or amounts;
  totals **Lump Sum Price** − discount (if any) → VAT → Net Amount.
- **With Section Totals**: the same + an Amount column with **"Total — <section>"** after each section; the section
  amounts add up exactly to the lump sum; then Total − discount → VAT → Net.
- The line discounts of a few halalas are never printed.

## Award → Job
- A **Won** quotation from an estimate shows **Create Job** instead of Create Sales Order (and the "Quotation Won!"
  prompt offers Create Job). Rights: Sales Orders → Create.
- **Create Job** (CJ_1): Customer PO No. * and PO Date * (required, not in the future), Start Date, Planned Finish (not
  before the start), Site In-charge (Employee Master), Notes (retention, payment terms …); Contract Value = the
  quotation's total before VAT (after its discount); the **budget** by cost type + overheads + contingency from the
  estimate, and the planned profit. Confirmation, then the number **JOB-YYMM-NNNN** (Administration → Numbering:
  "Job (Contracting)", online only).
- The quotation keeps the job (button **JOB-…** instead of Create Job).
- **Job view** (summary until V271.3): cards Contract Value · Budget · Planned Profit 🔒 · Customer PO; the budget
  table; details; notes; buttons Estimate · Quotation · **Edit Details** (PO, dates, in-charge, notes, **Status**:
  Open / In Progress / Completed / Closed / Cancelled).
- **Sales → Jobs** register: the standard filter bar (count · Customer · Status · Date · Search · Clear Filters);
  Job No., Date, Customer, Project / Site, Customer PO, Contract, Budget, Start, Planned Finish, Status.

## Also in this update
- RFQ entry: the Request type box is wider — "Contracting" is no longer cut off (the Customer reference box is a
  little narrower).
- Estimation: a supplier / Item Master list closes when the cursor moves on with Tab; every **Unit** box shows the full
  list of units on entering it (Equipment / Other lines still start with "Day").

## Data and Firebase use
- `quotations/{id}`: `estimate { rfqId, rfqNo, version, ref, style, showQty, offer, itemCount, budget{…},
  plannedProfit, site, duration, sections[{ code, title, amount }] }`, `jobId`, `jobNo`; lines `estItemId`.
- `rfqs/{id}/estimates/v{N}`: `status: 'Converted'`, `quotationId` (one merge write).
- `jobs/{id}` (new, id = the job number). Registers load **open + last 12 months** (data window); no live listener.
- Writes: quotation save as before **+1** (estimate Converted); Create Job **3** (counter, job, quotation link).
  Reads: the Jobs register reads jobs once when first opened.

## Rules (publish after the emulator run)
- New `match /jobs/{id}`: read Sales Orders or Quotations view; create Sales Orders create (id = document, `jobNo`
  string, `quotationId` string, `contractValue` number); update Sales Orders edit / create (job number, quotation and id
  unchanged); delete administrators only.
- Estimates: unchanged rule (a Saved version may become Converted with its last change).

## Tests
- `tests/browser/quote-job-v2712.e2e.mjs` (new): Create Quotation from the estimate (sections, items, units, locked
  figures, total = lump sum), print style + quotation discount, a removed line is refused, save (estimate Converted,
  RFQ link), print both styles (section totals add up, no rates / discounts), Converted estimate read only with Open
  Quotation, Won → Create Job (required fields, budget), job saved (number, contract value, budget, profit), quotation
  shows the job, Edit Details status, Jobs register, Duplicate unlinked, RFQ type labels not cut off.
- `tests/emulator/estimates.test.mjs`: Converted by the quotation; jobs rules.
- Full unit and browser suites re-run.

## Upload
index.html, sw.js (bizcore-shell-v27120), js/app.js, js/estimate.js, **js/jobs.js (new)**, js/quotation-ui.js,
js/permissions-ui.js, js/role-core.mjs, js/role-service.mjs, js/user-service.mjs (import version), js/rfq-entry.js,
css/estimate.css, css/rfq-entry.css, css/register-standard.css, firestore.rules.
