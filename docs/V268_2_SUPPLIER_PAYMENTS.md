# V268.2 — Supplier payments, discount at payment, cash back (17 Oct 2026)

Step 4 (purchase invoices), payments part. Approved mockups: PI_4 (payments in the entry), PI_8 (invoice view), PI_9 (Record payment), PI_10 (card → linked bank account). Musthafa approved cash back without a mockup.

## What the user sees
- **New purchase invoice → Payments.** Add one line per account: account, date, amount and reference.
  - Cash lines show "⏳ Shabeeb confirms".
  - Card lines show "via <bank> — bank balance, at once".
  - Bank lines have a **Bank charge** field (it goes to bank expense, not to the supplier).
  - The first line starts at what is still unpaid.
  - The summary shows Paid now, Balance to pay later and the status (Unpaid (credit) / Part paid / Paid).
  - If something is left, **Payment due** is required. If it's paid in full, the due date is hidden.
  - Paying more than the total is refused. Lines with different dates become separate payments.
- **Invoice view → Payments section.** It lists each SP number, date, account (a card shows the bank it came from), reference, amount (+ bank charge, discount), the custodian's confirmation and who recorded it. Each row has a **Cancel** button (a reason is required; the payment stays in the list, struck through).
  - **Record payment** appears while a balance is left.
  - **Cash back** appears once something has been paid.
  - **Cancel invoice** is refused while there are payments ("cancel them first").
- **Record payment:** date, lines (cash / card / bank, split allowed), **Discount at payment** (the supplier accepts less), and a line showing what is left and whether the invoice becomes Paid.
- **Cash back** (the supplier gives money back after payment, with no credit note):
  - Enter date, amount, the account it's received into (cash or bank) and a note.
  - The invoice keeps its total and status.
  - The cash custodian confirms receiving it.
- **Administration → Payment Accounts:** a card account has a required **Linked bank account** field. The list shows the bank under the card ("Custodian / bank" column).
- **Finance → Cash & Bank:**
  - A payment appears on the account it was paid from: cash (⏳ until the custodian confirms) or bank ("No confirmation", with the bank charge included).
  - A card's own ledger shows card payments as memo amounts **(in brackets)**, without changing the card's balance.
  - Click the SP voucher to open the purchase invoice.
- **Numbering:** new series **Supplier Payment, SP-YYMM-####** (Administration → Numbering). Cash back uses the same series.

## How the figures work
- Invoice fields: `paid`, `paymentDiscount`, `cashBack`, `balance` (= total − paid − paymentDiscount), `payStatus`, `paymentCount`.
- **Discount at payment** and **cash back** lower the cost of the invoice's items, shared by value (`costFactorOf`). The profit box and the P/L per line use the lowered cost (`profitAfterDiscounts`).
- VAT is not changed: there is no credit note. (Musthafa's accountant should confirm this treatment.)
- The unassigned stock value is not revalued; that comes with step 6 (stock).

## Data (accounting-ready)
| Collection | What it holds |
|---|---|
| `supplierPayments/{SPAY-<op>[-n]}` | One payment or cash back on one invoice: `kind` payment/cashback, `spNo`, `lines [{accountId, accountType, amount, reference, bankCharge, viaAccountId (bank of a card)}]`, `amount`, `bankCharges`, `discount`, `entryId`, `status` Posted/Voided, `accounting.lines` (journal). |
| `cashEntries/spe-…` | Balanced journal. Payment: Dr supplier-payable (amount + discount), Dr bank-charges, Cr each account, Cr purchase-discount. Cash back: Dr cash/bank, Cr purchase-discount. `postings {accountId: {amountIn, amountOut, memoOut}}`. |
| `cashLines/<entry>__<account>` | One posting per account. Cash: needs the custodian (pending). Bank: status none. Card: memo only (`memoOut`, no amounts). |
| `purchaseInvoices/{id}/events` | New event kinds: payment, payment-voided, cashback, cashback-voided (`paymentId`); the posted event lists `paymentIds`. |
| `paymentAccounts` | `linkedBankAccountId` on card accounts. |

## Security rules (firestore.rules) — run the emulator tests before publishing
- `supplierPayments`: created only together with the invoice's event (and its ledger entry); cancelled only with a payment-voided event; never deleted.
- `purchaseInvoices`: the money figures move only with a payment event, and only by exactly that payment's amount and discount; the balance and status must add up; an invoice with payments can't be cancelled.
- `cashEntries` / `cashLines`: supplier payment entries need their payment document. The postings must equal the entry's. Cash lines start ⏳ for the account's custodian. Lines are only ever cancelled (void) with their entry.
- `paymentAccounts`: a card must name an existing **bank** account (other types: none).
- New emulator tests are in `tests/emulator/purchases.test.mjs` (2 tests). The emulator could not be downloaded in the build workspace, so **run `RUN_EMULATOR_TESTS.bat` on the PC.**

## Files
- **Changed:**
  - `js/purchase-core.mjs`, `js/purchase-service.mjs`
  - `js/purchases.js`, `css/purchases.css`
  - `js/account-core.mjs`, `js/account-service.mjs`, `js/accounts.js`, `css/accounts.css`
  - `js/cash-ui.js`, `js/cashbank.js`, `css/cash.css`
  - `js/app.js` (SP numbering), `index.html`, `mycash.html`, `sw.js`
  - `firestore.rules`, `emulator/firestore.rules`
- **Tests:**
  - `tests/supplier-payments.test.mjs` (new, 4)
  - `tests/browser/supplier-payments.e2e.mjs` (new)
  - `tests/emulator/purchases.test.mjs` (+2)
  - `tests/account-service.test.mjs`, `tests/browser/accounts.e2e.mjs`
