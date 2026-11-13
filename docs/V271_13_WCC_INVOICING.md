# V271.13 — Work Completion Certificates and job invoicing (13 Nov 2026)

The last step of Contracting Basics: `V271.1 Estimation → V271.2 Quotation + Award → Job → V271.3 actual cost →
**V271.13 job invoicing + Work Completion Certificate**`. (The "V271.4" number was used later for the register
sorting work, so this step kept its place in the plan but took the next free version number.)

Built from the approved mockups **WCC_1 – WCC_4** (certificates) and **JI_1 – JI_3** (job invoices), and the
decisions of 13 Nov 2026.

| # | Decision (13 Nov 2026) |
|---|---|
| a | A **final invoice** without an accepted final certificate gives a **warning only**; an administrator can make it a requirement (Administration → Billing Settings). |
| b | **Retention** is not built now. |
| c | The signed certificate is **not uploaded** — BizCore records who accepted it and when (Firebase free tier). |
| d | **Variations** (extra work after the PO) stay for a later version, as agreed on 10 Nov. |
| e | The printed job invoice keeps the **advance as its own line** and a short **contract summary** box. |

## What a certificate is

A Work Completion Certificate (WCC) is the customer's acceptance of contracting work. It carries **no prices**: the
scope lines of the job — the frozen copy in `jobs/{id}/scope/main`, written when the job was created — each with a
completion percentage. Only the priced scope lines are certified; headings and note lines only print.

- **Partial** — a stage or part of the work. At least one line must go up.
- **Final** — every line must reach 100 %.
- Completion is the **plain average over the lines** (every line counts the same), because contracting work is sold
  lump sum and a certificate shows no prices.
- A line can never go back below what the customer already certified. Work already accepted is corrected with a
  credit note, not by lowering a certificate.
- Only **one certificate at a time** may wait for the customer. After the work is finally certified there are no more.

Status: `Pending Acceptance → Accepted | Accepted with remarks | Not accepted`, and `Cancelled` (with a reason,
only while nothing has been invoiced against it). Only an **accepted** certificate (with or without remarks)
certifies work and may be billed. Cancelling the accepted certificate that holds the certified position puts the job
back to the position that certificate itself recorded as the previous one.

## What a job invoice is

Contracting work is invoiced **lump sum**, so a job invoice has no quantities: it bills a **value** of the contract.
The three types are written as **ordinary customer invoices** (`customerInvoices`) carrying a `jobId` instead of a
`salesOrderId` — so the invoice register, Payment Receipts, receivables, the Dashboard, credit notes and the Zoho
invoice-number claim all work with no change.

| Type | Bills | Basis |
|---|---|---|
| `job-advance` | a down payment | % of the contract, or an amount |
| `job-progress` | the work done so far | an accepted WCC, % of the contract, or an amount |
| `job-final` | the balance of the contract | everything still open; deducts the whole remaining advance |

**Hard rules** (whatever the settings — the same wording and behaviour as the Sales Order side):

1. Never bill more than the contract: `work + advances − deductions ≤ contract value` (before VAT).
2. A deduction never exceeds the advance remaining nor the work value of its invoice.
3. The invoice that bills the contract in full must deduct all the remaining advance.
4. An advance that was deducted cannot be credited (only its undeducted part).
5. Work already certified by the customer is never un-certified by an invoice or a credit note.

A progress invoice **may** bill work the customer has not certified yet (sometimes agreed), but never past the
contract value; what is certified and not yet invoiced is shown apart, so the difference is visible.

## Data

```
workCompletionCertificates/{WCC-<operation>}            no prices; immutable once decided
  { id, wccNo, jobId, jobNo, quotationId, qno, custId, company, project, poNo, poDate,
    type: 'partial' | 'final', date, periodFrom, periodTo, stage,
    lines: [{ idx, n, title, workCat, qty, uom, prevPct, pct }],      idx = position in the job scope
    overallPct, previousPct, newPct, remarks, repName, repTitle,
    status, result, acceptance: { by, title, date, remarks } | null, certifiedPct,
    cancelReason, revision, lastEventId, creationOperationId, created/By/ByUid, … }
  workCompletionCertificates/{id}/wccEvents/{eventId}    immutable: created · decided · cancelled

jobBilling/{jobId}                                      ONE document per job — every rule is checked against it
  { jobId, jobNo, custId, contractValue,
    certified: { pct, byLine: { <idx>: pct }, wccId, wccNo, at },
    open: { wccId, wccNo },            a certificate waiting for the customer (blocks a second one)
    finalWccId,                        set when a final certificate is accepted
    wccs: { <wccId>: { wccNo, type, date, status, overallPct } },
    billedWccIds: { <wccId>: true },   a certificate that has been invoiced cannot be cancelled
    billing: { goodsValue, advances: { <invoiceId>: { invNo, date, subtotal, vatRate, deducted, credited } } },
    revision, lastWccId, lastInvoiceId, lastEventId, updatedAt/By/ByUid }

customerInvoices/{INV-<operation>}                      a job invoice adds:
  { jobId, jobNo, jobInvoiceType, wccId, wccNo, project, contractValue, contractPct,
    salesOrderId: '', soNo: '', lines: [],
    jobLine: { desc, percent, subtotal, vatRate, vat },   the one printed line
    advance | deductions, totals: { goodsSubtotal, goodsVat, deductionSubtotal, deductionVat, subtotal, vat, total } }
creditNotes/{CN-<operation>}                            the same, with jobId and an amount (no quantities)
```

**Why the ledger holds so much:** a Firestore client transaction cannot run a query. Keeping the certified position
per line, the open certificate and the small certificate index in `jobBilling/{jobId}` means every rule is checked
inside ONE transaction against ONE document — exactly as `salesOrderFulfillment/{soId}` does for the Sales Order side.

Numbering: **Administration → Numbering → Work Completion Certificate** (`WCC-YYMM-NNNN`, monthly, like the other
documents). Job invoices and their credit notes use the existing Customer Invoice and Credit Note sequences.

## Code

| File | What |
|---|---|
| `js/wcc-core.mjs` | certificate rules, pure (no I/O): the scope lines, the prior position, build / accept / cancel |
| `js/job-billing-core.mjs` | the money: contract cap, advance deduction, progress / final pricing, credit notes, the ledger |
| `js/wcc-service.mjs` | one transaction per action: certificate + event + ledger (+ counter) |
| `js/job-invoice-service.mjs` | one transaction per action: invoice / credit note + event(s) + ledger (+ counter, Zoho claim) |
| `js/job-billing-ui.js` | the screens: the Job view tab, New WCC, the certificate view = its print copy, Record Acceptance, New Job Invoice, the job credit note |
| `css/wcc.css` | the look, on the Jobs / document-view standard (teal is the certificate's accent) |
| `js/jobs.js` | the **Completion & Billing** tab, the Overview summary box, the footer buttons, the register's **To Invoice** tile |
| `js/invoicing.js` | the job invoice's A4 page (one lump-sum line, the advance line, the contract summary), the type labels and badges, the job-aware view and register |
| `js/receipts.js`, `js/receipt-core.mjs` | the job number where the Sales Order number is shown, and the job in a receipt's document flow |
| `js/app.js` | the WCC document numbering |
| `index.html` | the imports, the services (`window.BizCoreWcc`), the Billing setting, the data-window links |
| `firestore.rules` | `workCompletionCertificates` (+ `wccEvents`), `jobBilling`, and the job branch of the invoice / credit note rules |

## Screens

**Job view → Completion & Billing (WCC_1)** — four progress cards (Work done from the site, Certified by the
customer, Invoiced, Received), the certificates with what each certifies and the invoice that billed it, the job
invoices with their payment state, a "Needs attention" note and a footer line with the contract position.
**New WCC (WCC_2)** — type, date, work period, stage; the frozen scope lines with their previous % and a
desktop-style spinner for the completion to date; remarks and the customer's representative; the number on save.
**The certificate (WCC_3)** — the view **is** the Print / PDF copy (A4 frame + the staff panel), as agreed for
quotations on 13 Nov. **Record Acceptance (WCC_4)** — Accepted · Accepted with remarks · Not accepted, who accepted
it and when, no upload; the certificate is locked afterwards.
**New Job Invoice (JI_1 / JI_2)** — the type, what it bills, the advance deduction (suggested in proportion, the
Administration method), this invoice's totals and the job's position after saving.
**The job invoice (JI_3)** — the usual Tax Invoice template: one lump-sum line, the advance as a negative line, the
WCC in the reference strip and the contract summary in the notes box. The PDF file name keeps the
`INV-… - Customer - PO…` rule.

## Settings

**Administration → Billing Settings → "Final invoice of a contracting job"**: *a warning only* (default) or
*needs a final Work Completion Certificate accepted by the customer*. It is stored in the same `settings/billing`
document as the Sales Order billing rules and does not change them.

## Tests

| Test | What it covers |
|---|---|
| `tests/wcc-core.test.mjs` | 17 — the certificate rules (averages, final 100 %, never below certified, one open at a time, acceptance, cancel) |
| `tests/job-billing-core.test.mjs` | 23 — the money (contract cap, deductions forced and limited, the ledger, credit notes, the summary) |
| `tests/job-billing-service.test.mjs` | 15 — the transactions against an in-memory Firestore (numbering, retried saves, certificate ↔ invoice ↔ ledger) |
| `tests/emulator/wcc-billing.test.mjs` | the security rules on the emulator — **run `RUN_EMULATOR_TESTS.bat` and publish the rules before uploading** |

A browser pass with a stubbed host drove the whole flow (tab → new certificate → acceptance → job invoice →
phone width) with no console errors; the screenshots are in the version's folder.

## Not in this version (agreed)

Retention · variations · a signed-copy upload · the supplier side of a job · closing a job automatically
(BizCore only offers it when everything is invoiced and paid).
