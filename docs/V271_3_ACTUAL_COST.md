# V271.3 — Contracting actual cost (1 Nov 2026)

Third step of Contracting Basics. Built from the approved mockups **CC_1** (purchase invoice line charged to a job),
**CC_2** (Job Expense) and **CJ_2** (Job view — Estimate vs Actual), and the decisions of 1 Nov 2026: four cost types;
expense categories mapped to cost types (Local Labour → Manpower, Food / Meals → Manpower, Consumables → Material,
Transport / Fuel → Equipment / Other, Equipment Rental → Equipment / Other); VAT entered separately; manual Work done %;
warnings amber at 90 % and red over 100 % (Contracting Settings); Firebase free allowance respected.

## 1. Purchase invoice → Charge to a job (CC_1)
- New button **Charge to a job** in *What was bought* (shown when there is an open job).
- The line: description (free text), **Job**, **Cost Type** (Material · Manpower · Subcontract · Equipment / Other), unit,
  qty, unit cost, line discount. The cost type starts from the supplier: manpower agency → Manpower, subcontractor →
  Subcontract, others → Material (Supplier Master → *Also supplies (Contracting)*); it can be changed per line.
- A job line puts **nothing in stock** and keeps **no last price**; it is not compared with an estimate price (the job's
  budget is the comparison). It counts at its **landed cost** — with its share of the invoice's extra costs and
  discount — without VAT.
- Payments, edit (limited / full), cancel: as for every purchase invoice. A cancelled invoice drops out of the job.
- The invoice view shows the job (click → Job view) and the cost type.

## 2. Job Expense (CC_2)
- From the Job view (**+ Job Expense**) or Sales → Jobs (**+ Job Expense**). Rights: **Cash & Bank → Create**
  (cancel: Cash & Bank → Cancel).
- Job *, Date * (not in the future), **Paid From** * (cash, card or bank account), Reference, lines: **Category**
  (the Expense Categories of Contracting Settings, or a cost type directly), Description, Paid To (optional),
  **Amount (without VAT)**, **VAT** (only when there is a VAT invoice). Receipt photo / PDF optional. Note.
- The job's cost = the amounts; the account pays amount + VAT. Number **JE-YYMM-NNNN** on save (Administration →
  Numbering: *Job Expense*), online only.
- Posted to the account's ledger in Cash & Bank in the same commit (kind *job-expense*): cash waits for the custodian's
  confirmation (My Cash), a bank needs none, a card is paid from its linked bank (the card shows a memo).
- **Cancel Expense** (with a reason): the expense stays, marked Cancelled; its cash / bank lines are cancelled and the
  job's cost goes back. A closed or cancelled job takes no new expenses.

## 3. Stock → Issue to Job
- Stock item → **Issue to Job**: job, quantity (not more than in stock), date, note. Out of stock at the **average
  cost**; it becomes the job's **Material** cost. No money moves. Movement *Issued to job* (click → Job view).
- Cancel from the item's movements (with a reason): the stock comes back and the cost comes off the job.

## 4. Job view (CJ_2)
- Header: job, project, customer, PO, quotation, dates, in-charge, status. Cards: **Contract Value · Actual Cost To Date
  (% of direct budget) · Budget (Total Cost) · Expected Profit 🔒** (Special Right *See cost, margin and profit*).
- Tabs: **Overview** (budget, details, notes) · **Estimate vs Actual** · **Costs (n)** · **Activity**.
- Estimate vs Actual: per cost type Budget · Actual · Used (bar + %) · Remaining; Direct Cost; Overheads and
  Contingency (budget only). A type goes **amber at 90 %** and **red over 100 %** of its budget (Contracting
  Settings). Click a row → its cost lines.
- **Expected profit** = contract value − (actual + the budget still to spend + overheads + contingency); an overrun
  lowers it. With no costs yet it equals the planned profit.
- **Progress (manual)**: *Set* the Work done % (0 – 100); compared with the cost used.
- Costs: every cost line (purchase invoice / job expense / from stock) with date, document (opens it), type,
  description, supplier / paid to, amount; filter by type; **Refresh**. A role that can't read a source sees a note.
- Buttons: Estimate · Quotation · Edit Details · **+ Job Expense**.

## Data and Firebase use
- `purchaseInvoices`: lines `kind: 'job'` `{ jobId, jobNo, costType, desc, uom, qty, unitCost… itemKey: '' }`;
  invoice `jobIds[]` (what the job looks for).
- `jobExpenses/{JE-op}` (new) — `{ jeNo, jobId, jobNo, date, account…, lines[{ category, costType, desc, paidTo, amount,
  vat }], amount, vat, total, receipt, entryId, status }`; `cashEntries/jee-…` + `cashLines/jee-…__<account>`.
- `stockAllocations`: `jobId, jobNo, costType` (no sales order); movements *issued-to-job* / *job-issue-cancelled*.
- `jobs/{id}`: `workDonePct, workDoneAt, workDoneBy`.
- **No new live listener.** The Job view reads that job's costs once when it opens (reads = its purchase invoices with
  job lines + its job expenses + its stock issues) and keeps them until Refresh.
- Writes: Job Expense 5 – 7 (counter, expense, entry, 1 – 2 lines, 1 – 2 running balances); its cancel 5 – 6.
  Issue to Job 3 (allocation, stock, movement). Work done 1. A purchase invoice with job lines writes less than one
  for stock (no stock, no last price).

## Rules (publish after the emulator run)
- `jobs`: read also by Purchase Invoices, Cash & Bank and Stock (view) — they charge costs to a job.
- New `match /jobExpenses/{id}`: read Sales Orders / Quotations / Cash & Bank; create Cash & Bank → Create, only with
  its ledger entry (same commit), job must exist; cancel Cash & Bank → Cancel, only with the entry voided; never deleted.
- `cashEntries` / `cashLines`: kind *job-expense* — created with their job expense; cash lines wait for the custodian;
  voided only with the entry.
- `stockAllocations`: an allocation to a job (no sales order) — the job must exist; cancel puts only the stock back.

## Tests
- `tests/job-cost.test.mjs` (new, simulator): job lines (checks, no stock / last price, landed cost, jobIds), job
  expense checks, cash and card postings with running balances, cancel, stock issued to a job and cancelled, Estimate
  vs Actual (amber / red, expected profit).
- `tests/browser/job-cost-v2713.e2e.mjs` (new): purchase invoice *Charge to a job* (cost type from the supplier), Issue
  to Job, Job view figures, + Job Expense (categories, VAT, cash line pending), Costs filter, Work done %, Activity,
  cancel the expense, phone width.
- `tests/emulator/job-costs.test.mjs` (new): job expense cash / card and cancel against the rules, loose writes
  refused, rights (Cash & Bank create / cancel, view), jobs readable by purchase / cash roles, stock to a job, purchase
  invoice with job lines found by `jobIds`.
- `tests/browser/numbering-format.e2e.mjs`: 18 numbering rows (+ Job Expense).

## Upload
index.html, sw.js (bizcore-shell-v27130), mycash.html, js/app.js, js/estimate.js, js/jobs.js, **js/job-cost-core.mjs
(new)**, **js/job-cost-service.mjs (new)**, js/purchase-core.mjs, js/purchase-service.mjs, js/purchases.js, js/stock.js,
js/cash-ui.js, js/role-core.mjs, js/role-service.mjs, js/user-service.mjs, css/estimate.css, firestore.rules,
start_server.bat.
