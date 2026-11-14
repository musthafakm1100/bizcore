# V268.1 — Purchase Invoices, credit only (17 Oct 2026)

This builds the approved mockup 4, without the Payments part, which comes in V268.2. Every invoice is saved as **Unpaid (credit)**.

## What the user sees
- **Purchasing → Purchase Invoices.** A standard register with:
  - **Monitor:** All, Posted, Cancelled, Overdue, Due ≤ 7 days, Purchases, Payable to suppliers, Unassigned stock value.
  - **Toolbar filters:** sort, supplier, status, date, search.
  - **Phone:** cards instead of the table.
  - **Nav badge:** the number of overdue invoices.
- **New Purchase Invoice:**
  - **Supplier & bill:** supplier, supplier invoice no. (required and unique per supplier), date, Zoho bill no. (optional), and the **supplier's invoice total** (required). A green box means the totals match within the rounding limit; a red box means they don't.
  - **Add from sales orders:** shows only open order lines that still have something to buy. Qty bought starts at what is still to buy. The unit cost is taken from the Pricing estimate. When there is no estimate, the **last price paid** is used as the reference instead.
  - **Cost tags:**
    - as estimated (green)
    - below the estimate (blue)
    - within the limit (amber)
    - above the limit (red): asks for a reason, or blocks the save if Administration says so
    - no estimate or previous price (grey, for attention only)
  - **Extra quantity:** if more is bought than the order still needs, the line asks where the extra goes:
    - Unassigned stock
    - another open order for the same item (only offered when one exists)
    - correct the quantity
  - **Add item for stock:** a product or free text, with its unit.
  - **Additional costs and discount:**
    - Discount on the whole invoice, in SAR or %. A per-line discount column appears if Administration allows it.
    - Both costs and discount are shared over the lines by value, which gives the **landed unit cost** of each line.
  - **Bill summary:** lines, costs, discount, VAT, BizCore total, rounding, total, paid 0, balance, Unpaid (credit).
    - VAT can be adjusted to match the supplier's VAT, but only within the rounding limit.
  - **Cost vs estimate** (staff only): the estimate total, the last-paid total, the total with no reference, and the difference. **Profit on these orders** is shown according to Administration.
  - **Payment due date** is required.
  - The **"To continue" bar** lists what is still missing. Save is enabled only when everything is OK.
- **View:** the lines with their reference and tag, landed cost, where each line goes, the totals, and **Cancel invoice** (a reason is required).
  - Cancelling puts the quantities back to "still to buy" and removes the stock.
  - The supplier invoice no. can then be entered again.
  - Cancelling is refused if that stock has already been used.
- **Administration → Finance → Purchase Settings** (administrators only):
  - cost increase limit % (default 5)
  - above the limit: ask for a reason, or don't allow saving
  - supplier discount: whole invoice (default), per line, or both
  - rounding limit (±1.00 SAR)
  - VAT rate
  - profit shown to: administrators only, or everyone

## Data
| Collection | What it holds |
|---|---|
| `purchaseInvoices/{PI-…}` | The invoice, with an immutable `events` subcollection. It includes lines with allocations, stockQty, reference, cost check and landed cost; costs; discount; totals; paid / balance / payStatus; profit; and an accounting summary (Dr purchases + input VAT, Cr supplier payable, ± rounding). |
| `purchaseSupplierRefs/{supplierKey__invNo}` | A supplier invoice can be recorded only once. The record is released when the invoice is cancelled. |
| `salesOrderPurchasing/{soId}` | Purchased quantity per Sales Order line, which gives "still to buy". |
| `stockItems/{itemKey}` + `stockMovements/{id}` | Unassigned stock. It is given to orders in step 6. |
| `settings/purchasing` | The settings above, for administrators. |

Everything is written in **one transaction**. If two people buy the last units of the same order line at the same time, only one succeeds. A retried save changes nothing.

## Security rules
A new section, "Purchase Invoices (V268.1)":
- Writes are allowed only when they happen together with a new invoice event in the same commit.
- An invoice's figures can never change. The only change allowed is cancelling, with an event and a reason.
- Nothing is deleted, except the supplier-invoice-no. claim of a cancelled invoice.
- Settings can be written by administrators only.
- Custodian logins can't read any of it.

**Run `RUN_EMULATOR_TESTS.bat` on the PC before publishing.** The new test file is `tests/emulator/purchases.test.mjs`.

## Files
- **New:**
  - `js/purchase-core.mjs`, `js/purchase-service.mjs`, `js/purchases.js`
  - `css/purchases.css`
  - `tests/purchase-service.test.mjs`, `tests/browser/purchases.e2e.mjs`, `tests/emulator/purchases.test.mjs`
- **Changed:**
  - `index.html`: register page, Purchase Settings tab, BizCorePI
  - `js/app.js`: page hook, settings tab hook, monitor
  - `firestore.rules`, `emulator/firestore.rules`
  - `sw.js`
  - `package.json`, `tests/emulator/package.json`

## Next (V268.2)
- Payment lines from any account, with cash lines confirmed by the custodian.
- Card payments go into the linked bank account.
- Discount at payment time.
- Part paid / Paid status.
- Advances: still to decide, either V268.2 or step 5.
