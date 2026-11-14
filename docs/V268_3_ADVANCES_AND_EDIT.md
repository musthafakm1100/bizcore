# V268.3 — Supplier advances, Supplier Payments page, editing invoices and payments

Built from the approved mockups PI_11 – PI_14 (17 Oct 2026). Decisions by Musthafa:
- edit and advances together; default edit right "Limited, admins full"; edit time limit 7 days;
- advances are paid on a new page Purchasing → Supplier Payments (button **Pay Advance**);
- an advance is used on an invoice as a payment line (Paid from → Advances), all or part of it;
- an advance can name a sales order (optional);
- a full edit of an invoice that has payments is not allowed (cancel the payments first);
- an advance that is already used can't be cancelled.

## Screens
- **Purchasing → Supplier Payments** (`#page-supplierpayments`, js/supplier-payments.js). It uses the same register standard as Receipts: the same monitor, filter bar, date filter, table and type sizes. A browser test compares the computed styles with Receipts.
  - **Monitor:** Type (invoice payments, advances, cash back, cancelled); Attention (open advances, cash waiting for the custodian); Figures (paid, open advances).
  - **Columns:** Payment No., Date, Supplier, Type, For (PI or SO), Paid from, Amount, and Advance / Status (what is left, or ⏳ custodian).
  - Clicking a row opens the payment view, with its lines, confirmation and where an advance was used. From there you can **Edit**, **Cancel** or open the invoice.
- **Pay advance:** supplier, date, optional sales order, one or more accounts (cash / card / bank, with bank charge), reference and note. It posts to Cash & Bank like any payment; cash waits for the custodian. The ledger kind is `supplier-advance`.
- **Invoice entry and Record payment:**
  - When the chosen supplier has open advances, a purple banner shows them, with a **Use advances** button.
  - Advances also appear in the Paid from list under "Advances".
  - An advance line moves no money: its date and reference are fixed, and the payment is dated on the invoice date.
- **Edit (with the document lock):**
  - **Invoice, limited:** supplier invoice no., Zoho bill no., invoice date, due date and the reasons for a higher cost. A reason for the change is required.
  - **Invoice, full:** for administrators, and only while the invoice has no payments. It opens the normal invoice screen pre-filled, with the same PI number. While editing, this invoice's own quantities count as "still to buy" again. Saving moves the purchased quantities and the stock from the old figures to the new ones.
  - **Payment, limited:** references and note.
  - **Payment, full:** for administrators. Date, accounts, amounts, bank charge and discount can change.
    - A NEW Cash & Bank entry `spe-…-r<revision>` replaces the old one; the old one is cancelled.
    - The invoice figures move by (new − old).
    - Not allowed for a payment that uses an advance.
    - An advance can't go below what has already been used.
- **Administration → Purchase Settings:**
  - Edit right: Off / Limited / Limited for staff, full for admins / Full.
  - Edit time limit: 0–365 days.
  - "Full edit of an invoice with payments": shown as Not allowed.
  - After the edit time limit, only administrators can edit.
- **Cash & Bank:** advance lines show and open the advance.

## Data
- `supplierPayments/{SPAY-…}` with `kind: 'advance'`:
  - `invoiceId: ''`, `soId`, `soNo`, `advanceUsed`, `advanceLeft`, `lastUseId`.
  - Each payment that uses advances stores `advanceIds` (max 3), `advanceAmounts {id: amount}` and `advanceTotal`.
  - In its journal, the advance part is credited to `supplier-advances`; only the rest moves money.
- `supplierPayments/{id}/events/*`: the history of an advance or payment (posted, edited limited/full, voided).
- Purchase invoices: event `edited` (mode limited / full), and `lastEditReason`. A payment edit also writes the invoice event `payment-edited` or `cashback-edited`.
- Settings `settings/purchasing`: `editMode`, `editDays`.

## Security rules (firestore.rules) — publish after the emulator tests pass
- `purEditRight()`: the edit mode and the edit days come from `settings/purchasing`. Administrators are not limited by the days.
- **supplierPayments:**
  - `advCreateOk`, `advUseOk` (the advance moves by exactly the amount of the payment that uses it or gives it back), `advVoidOk` (only when nothing is used).
  - `spLimitedEditOk`, `spFullEditOk`, and `advancesOk` on payment create.
  - The payment events subcollection.
- **cashEntries / cashLines:** kind `supplier-advance`; the new entry of a fully edited payment; cancelling the old entry.
- **purchaseInvoices:** `piPayOk` also accepts payment edits (new − old); `piEditOk` handles limited and full edits.
- **purchaseSupplierRefs:** the old claim is released when the supplier invoice no. changes.
- **Settings:** `editMode` and `editDays` are validated.

## Tests
- Unit: tests/purchase-edit.test.mjs (6).
- Browser: tests/browser/purchase-edit.e2e.mjs. It covers the look match with Receipts, pay advance, using an advance, limited and full edits, the settings and the phone layout.
- Emulator: 2 new tests in tests/emulator/purchases.test.mjs (advances; edits). Run RUN_EMULATOR_TESTS.bat on the PC before publishing the rules.
