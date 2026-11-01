# V271.3.2 — Job Expense as a submission, reimbursement, vouchers; product picture fix (2 Nov 2026)

Built from the approved mockups **JE_3** (submission), **JE_4** (tracking and reimbursement), **JE_5** (Job Expense
Voucher) and **JE_6** (Reimbursement Voucher), and the decisions of 1–2 Nov 2026: the site in-charge brings his receipts
2–3 times a week; one screen per bundle, one job per screen, one receipt file per bundle; he pays mostly from his cash
advance and sometimes from his own money; designed for the chart of accounts later.

## Job Expense = one submission
- **+ Job Expense** (Job view or Sales → Jobs). Header: **Job** · **Submitted by** (the in-charge, Employee Master —
  starts with the job's site in-charge) · **Date submitted** · Received by (you) · Reference.
- Lines: **Expense Date** (standard date field) · Category (cost-type chip) · Description · Paid To · **Paid From** ·
  **VAT Inv. No.** · **Supplier VAT No.** · Amount (without VAT) · VAT. The expense date and Paid From copy down; Enter
  on VAT adds the next line.
- **Paid From**: the in-charge's own cash account first (his site advance — a cash account whose custodian is him),
  then **Own money — reimburse**, then the other cash / bank / card accounts.
- The advance strip shows his advance before → this submission → after (when the account's running balance is
  complete) and the own money to reimburse; when the advance is short it says so.
- A VAT amount needs its invoice no.; an invoice already in an earlier submission of the job gives a warning.
- Totals: job cost by cost type, by who paid, VAT invoices / input VAT. One receipts photo / PDF for the bundle.
- **One number** (JE-YYMM-NNNN). In Cash & Bank one line per expense date + account, all with that number; cash waits
  for its custodian. Own money is not in Cash & Bank until it is paid back.
- Job cost: each line on its own expense date, without VAT (Estimate vs Actual, Costs).

## Tracking and paying back (JE_4)
- Job view → **Submissions (n)**: number, date submitted, by, lines, job cost, paid, status (… to reimburse /
  Reimbursed / Settled / Cancelled). Click → the submission: its lines, **Print Voucher**, **Cancel Submission**
  (refused while part of it is paid back), and the reimbursements that paid it.
- **Owed to staff (own money)** → **Reimburse…**: all his open submissions (every job); choose what is paid now
  (part payment allowed), date, **Paid from** (office cash / bank / card). Number **RB-YYMM-NNNN** (Administration →
  Numbering: *Reimbursement (staff)*). Posted in Cash & Bank (kind *staff-reimbursement*). Print, or Cancel with a
  reason (the amount is owed again).
- Top up his advance = the existing Cash & Bank handover into his cash account.

## Prints (A4, internal, letterhead, footer at the bottom)
- **Job Expense Voucher**: job, customer, PO, submitted by, received by, reference; lines by date (own-money lines
  shaded); job cost by type, paid by, totals with input VAT; his advance and what is owed; amount in words;
  signatures Submitted by · Received by · Approved by.
- **Reimbursement Voucher**: paid to / from, the submissions it settles, owed before → paid → still owed, amount in
  words; signatures Received by · Paid by · Approved by.

## Accounting (for the chart of accounts later)
Each submission carries its journal: job cost by type + input VAT (debit) / paying accounts + **employee payable** for
own money (credit). A reimbursement: employee payable (debit) / paying account (credit).

## Product pictures (scheduled fix)
- **Add product** no longer deletes the previous product's picture file (it cleared the form by "removing" the
  picture, which deleted the saved file — the 403 errors).
- Product details: a picture whose file is missing shows **Picture missing** in its own place (the details no longer
  slide into the picture column); Edit product says "Picture missing — paste or choose it again".
- Employees: **Remove** / a new photo deletes the saved photo only after the employee is saved (Cancel keeps it).
- Pictures already deleted can't be recovered: open each affected product, paste the picture again and save.

## Also
- Saved times shown as the user's own day (Work done "set …" after midnight Riyadh showed yesterday).

## Data and Firebase use
- `jobExpenses/{JE-op}`: `submittedById, submittedBy, lines[{ date, payMode, accountId…, vatInvoiceNo, supplierVat }],
  ownMoney, paidFromAccounts, reimbursed, reimburseStatus, entryIds[]` (schemaVersion 2).
- `reimbursements/{RB-op}` (new): `employeeId, employeeName, date, account…, items[{ jobExpenseId, jeNo, amount,
  owedBefore }], jobExpenseIds, amount, entryId, status`.
- Writes: a submission = counter + 1 + (entry + 1–2 lines + balance) per date + account — e.g. 3 dates from one cash
  account ≈ 11. A reimbursement ≈ 5 + 1 per submission paid. Reads: the Reimburse window reads that person's open
  submissions once (two equality filters — no extra index). No new listener.

## Rules (publish after the emulator run)
- `jobExpenses`: create with its entries (`entryIds`, none when all is own money); own money starts owed; cancel only
  when nothing is paid back and with its entries voided; the paid-back figure moves only with a reimbursement in the
  same commit.
- New `reimbursements`: create with its ledger entry (Cash & Bank → Create); cancel (Cash & Bank → Cancel) with the
  entry voided; never deleted.
- `cashEntries` / `cashLines`: kinds *job-expense* (one per date + account of a submission) and *staff-reimbursement*.

## Tests
- `tests/job-cost.test.mjs`: submission checks; several dates / accounts → one number, entries per date + account,
  balances, own money; cancel; reimbursement (part payment, over-payment and another person refused, cancel).
- `tests/browser/job-cost-v2713.e2e.mjs`: submission screen (advance, VAT invoice, own money), Submissions tab, Owed to
  staff → Reimburse → voucher → cancel; Job Expense Voucher content.
- `tests/browser/pictures-v27132.e2e.mjs` (new): Add product keeps the picture; Picture missing layout; employee photo.
- `tests/emulator/job-costs.test.mjs`: submissions over dates / accounts with own money, reimbursement and cancel,
  loose writes refused, the open-own-money query.
- `tests/browser/numbering-format.e2e.mjs`: 19 numbering rows.

## Upload
index.html, sw.js (bizcore-shell-v27132), mycash.html, js/app.js, js/jobs.js, js/job-cost-core.mjs,
js/job-cost-service.mjs, js/cash-ui.js, js/role-core.mjs, js/role-service.mjs, js/user-service.mjs, css/estimate.css,
firestore.rules, start_server.bat — and, if V271.3.1 is not uploaded yet, everything of V271.3 / V271.3.1 (the upload
package contains all of it).
