# V266 — Payment Receipts (13 Oct 2026)

Built from the approved mockups (register, New Receipt, receipt view + A4, phone).

## Decisions (Musthafa, 13 Oct)
| Question | Answer |
|---|---|
| Zoho payment no. mandatory? | **Setting in Administration**: Mandatory (default) or Optional. When given it can be used only once. |
| Unapplied / on-account money? | **Allowed.** Kept on the receipt and applied later ("Apply" on the receipt). |
| Credit notes on the receipt screen? | **Not now.** Credit notes keep reducing the invoice balance as before. |
| Who may record / void? | **Settings in Administration.** Defaults: all users record, administrators void. |
| Old "Record payment" on the Sales Order? | **Hidden** once receipts are active; the order shows its receipts and a **New Receipt** button. |

## What the user sees
- **Sales → Payment Receipts** (new menu item, badge = receipts with unapplied money).
  - Receipt Monitor: All · Posted · Voided · Not fully applied · Overdue invoices · Invoices due ≤ 7 days (these two open the Invoices register filtered) · Received · Receivable · Unapplied.
  - Standard filter bar (Sort, count, Customer, Status, Date "A", Search, Clear Filters).
  - Phone (≤ 760 px): cards + floating **New Receipt** button.
- **New Receipt** (from the register, a Sales Order or an invoice):
  - customer (customers with open invoices first) → open invoices, oldest first;
  - amount received → applied automatically oldest first until you change a line ("Auto-apply" and "Clear" buttons; tick / Full / type an amount per invoice);
  - method, deposited-to account (mandatory choice when Administration lists accounts), reference, Zoho payment no., notes;
  - summary (received / applied / unapplied) and customer balance; checklist "To continue: …"; confirmation; then the receipt opens.
  - Tablet: one column, invoice lines as cards. Phone: full screen, Save fixed at the bottom.
- **Receipt view**: A4 "PAYMENT RECEIPT / سند قبض" in the shared document layout, green accent `#15803d`, amount in words, VOID watermark when voided; panel with Received / Applied / Unapplied / Invoices, flow chips (orders → invoices → receipt), activity from the event log. Buttons: Close · Apply x.xx (unapplied money) · Void… (reason ≥ 5 characters) · Print / PDF.
- **Invoices**: the view shows **Paid** and **Balance due**, a payment status (Unpaid / Partially paid / Paid / Overdue / Overpaid), receipts in the document flow and a **New Receipt** button. The register gets **Paid** and **Balance** columns and a **Payment** section in the monitor.
- **Sales Order**: "Payment history" lists the receipts that touch its invoices; Paid / Partially Paid status comes from them.
- **Administration → Billing Settings → Payment receipts**: Zoho payment no. (Mandatory / Optional), who may record, who may void, deposit accounts (one per line). Administrators only; changes are logged.
- Receipt numbers: `RCT-YYMM-####` (Administration → Document Numbering, "Payment Receipt").

## Data (new — needs the new rules)
| Collection | What |
|---|---|
| `customerReceipts/{id}` | the receipt; `allocations[]` = invoices and amounts; `applied`, `unapplied`, `status` Posted/Voided |
| `customerReceipts/{id}/receiptEvents/{id}` | posted / applied / voided — never changed |
| `invoicePayments/{invoiceId}` | `paid` and `receipts{}` per invoice |
| `receiptZohoNumbers/{key}` | claims a Zoho payment no. (no duplicates) |
| `settings/receipts` (+ `changes/`) | the Administration settings |

One Firestore transaction per action (`js/receipt-service.mjs`); invoices and Sales Orders are **not** written, so no order lock is needed and one receipt can settle invoices of several orders. Balance due = invoice total − credit notes − paid.

Receipts work only when invoices are independent (`system/invoiceStorage = independent`, which is the live state).

## Files
New: `js/receipt-core.mjs`, `js/receipt-service.mjs`, `js/receipts.js`, `css/receipts.css`, `tests/receipt-service.test.mjs`, `tests/browser/receipts.e2e.mjs`, `tests/emulator/receipts.test.mjs`, this note.
Changed: `index.html`, `js/app.js`, `js/invoicing.js`, `css/register-standard.css`, `firestore.rules` (+ copy in `emulator/`), `sw.js`, `package.json`, `tests/emulator/package.json`, `tests/browser/navigation.e2e.mjs`; version strings only: `js/delivery-service.mjs`, `js/invoice-core.mjs`, `js/invoice-service.mjs`.

## Tests
| Suite | Result here |
|---|---|
| `npm test` | **81/81 pass** (9 new receipt tests: rules, idempotent retry, over-apply, two users at once, Zoho, settings, apply later, void) |
| `npm run test:browser` | **30/30 pass** (2 new: full receipt flow incl. phone; Sales Order / invoice integration; navigation test updated for "New Receipt") |
| `npm run test:parity` | pass |
| `npm run test:emulator` | **not run here** (the emulator download is blocked in this environment). New `tests/emulator/receipts.test.mjs` — run on the PC before publishing the rules. |

## Publishing (needs Musthafa's approval)
1. On the PC: `npm run test:emulator` → all pass.
2. Firebase Console → Firestore → Rules: publish the new `firestore.rules` (adds receipts; nothing else changes).
3. Upload the website files (list in the handover).
4. Administration → Billing Settings → Payment receipts: choose the settings (optional — defaults work).

Until the rules are published, saving a receipt on the live site fails with "The database refused this receipt (security rules)". Nothing else is affected.

## Open points
- A credit note issued **after** an invoice was paid makes it "Overpaid" (shown on the invoice). Refunds / moving that money to another invoice are not built.
- Old test payments recorded on Sales Orders (`so.payments`) are no longer shown when receipts are active (test data, not migrated).
- Not built yet: customer statement, receipts on the Dashboard, Excel export of receipts.

## V266.1 (14 Oct) — bank charges, customer picker, A4 table header
Approved by Musthafa from pictures A, B, C.
- **Bank charges** (fee kept by *our* bank): optional field on New Receipt. *Amount received* = what the customer paid and it settles the invoices (as in Zoho Books "Record Payment" → "Bank Charges (if any)"). The screen shows "Reached the bank". Printed on the A4 receipt under the totals: "Less: bank charges" and "Net deposited to bank". Staff panel, register (under the amount) and monitor ("Bank charges (shown)") show it too. Stored as `bankCharges`; it can't be changed after posting. The rules check 0 ≤ bankCharges < amount.
  - A shortfall caused by the *customer's* bank is not a bank charge: the invoice stays partly due.
- **Customer picker** (option 1): search box, list opens on focus, customers with open invoices first (avatar, open count, oldest invoice, amount due, "overdue"), others below; ↑ ↓ Enter Esc; after choosing, a compact card with **Change**. On a phone the list opens in the page.
- **A4 table header** on Invoice, Credit Note and Receipt views: the screen showed the header and lines larger than the printed page (app-wide table styles leaked in). The table now uses the print sizes on screen too.
- Notes moved into the "Customer & payment" card (one line).
- Files: `js/receipts.js`, `js/receipt-core.mjs`, `js/receipt-service.mjs`, `js/invoicing.js`, `css/receipts.css`, `index.html`, `sw.js`, `firestore.rules` (+ emulator copy), tests. Console: "Payment receipts V266.1 ✅ …".
- Tests here: `npm test` 82/82, browser 30/30, parity pass. Emulator: run on the PC (receipts test now posts a receipt with bank charges).

## V266.2 (14 Oct) — small changes asked by Musthafa
- The customer list opens only when the user clicks the search box (or types / presses ↓), no longer by itself when New Receipt opens.
- Customer names in the list and on the chosen card are lighter (regular weight); amounts semi-bold.
- Amount received and Bank charges are right-aligned and shown with thousands separators (e.g. 4,000.00) when you leave the field; while typing they are plain numbers.
- Files: `js/receipts.js`, `css/receipts.css`, `index.html`, `sw.js`, `tests/browser/receipts.e2e.mjs`. No rules change. Console: "Payment receipts V266.2 ✅ …".

## V266.3 (14 Oct) — editing receipts and invoices, with locks
Decisions (Musthafa): settings in Administration with a time limit; invoices: limited edit + "Cancel and re-issue"; default limit **current month**; **administrators may edit after the limit**.

**Administration → Billing Settings → Payment receipts** (stored in `settings/receipts`):
| Setting | Choices (default **bold**) |
|---|---|
| Editing receipts | Nobody · Limited for all · **Limited for all, full for administrators** · Full for all |
| Editing invoices (limited) | Nobody · Administrators · **All users** |
| Edit time limit | **Current month** (of the document date) · Within N days · No limit |
| Administrators may still edit after the limit | **Yes** |

**Receipt edit** (receipt view → **Edit**; the New Receipt screen opens in edit mode):
- Limited: reference, notes, deposited-to account, method, Zoho payment no., invoices applied. Full: also customer, date, amount, bank charges (fields are greyed out when not allowed).
- Reason for the change (≥ 5 characters) required; confirmation shows **before → after**; receipt number kept; revision +1, `editCount`, `revisedBy`, `lastEditReason`; event `edited` with the list of changes (Activity panel). Invoice balances are recomputed; a changed Zoho no. frees the old one.
- After the time limit the Edit button is disabled with the reason (administrators keep it when allowed).

**Invoice limited edit** (invoice view → **Edit**): Zoho invoice no., payment due date, customer PO no., description (reason for billing ahead), notes. Figures never change (ZATCA). Reason required, before → after, history (`edited` event, "Revised" row and Activity line). Old Zoho no. freed.

**Cancel and re-issue** (invoice view, credit-note permission, invoice not yet credited, no payments on it, advance not yet deducted): confirm → **step 1** credit note screen prefilled for the whole invoice → **step 2** Create Invoice opens prefilled from the old one (type, quantities, due date, notes, description) — enter the new Zoho no. and save. The new invoice records `reissueOf`. If the invoice has receipts, BizCore asks to edit those receipts first (take the invoice off, money stays on account).

**Locks** (V262 mechanism, timings from Document Locking): receipt **Edit / Apply / Void** take the receipt lock (`locks/receipt_{id}`); invoice **Edit / Cancel and re-issue** take the Sales Order lock. Another user gets "Document in use — <name>"; Save / Cancel / Back / closing releases it; administrators can force-release in Active Locks. The rules refuse receipt changes without the receipt lock and invoice edits without the order lock.

**Rules (publish again):** receipt update split into void / apply / limited / full by setting; invoice update gets an "edit" branch (only the five fields + edit metadata, new `edited` event, setting); Zoho number documents may be deleted only by the edit of their own document. The **time limit is checked by the screen and the service, not by the rules** (dates/time zones).

Tests: `npm test` 87/87 (new: receipt edit limited/full/time limit/lock, invoice edit), browser 32/32 (new `tests/browser/edits.e2e.mjs`: two-user lock conflicts, limited/full edit, settings, invoice edit, cancel & re-issue), parity pass. Emulator: `tests/emulator/receipts.test.mjs` extended (edit under the rules, lock required, invoice edit) — run on the PC.

**V266.3 rules fix (14 Oct, after the first emulator run on the PC: 27/29):** the two new edit tests failed because a Zoho number document (`receiptZohoNumbers` / `invoiceZohoNumbers`) could only be created together with a *new* receipt or invoice, so changing the Zoho no. in an edit was refused. The create rule now also accepts the receipt / invoice being edited to that number in the same commit (revision + 1, number different from before). Only `firestore.rules` (+ emulator copy) changed; website files unchanged.

## V266.4 (14 Oct) — invoice edit levels and edit screen
Decisions (Musthafa): move "Editing invoices" under **Invoicing rules**; same four choices as receipts; "full" for invoices = **Cancel & re-issue** (figures are never edited — ZATCA); edit screen like the receipt edit.
- **Administration → Billing Settings → Invoicing rules → Editing invoices**: Nobody (corrections by credit note only) · Limited edit for all users · **Limited for all users, full for administrators** (default) · Full edit for all users. Still stored in `settings/receipts.editInvoices`; saving Invoicing rules writes it only when it changed. Removed from the Payment receipts section; the edit time limit there now says "receipts and invoices".
- Old V266.3 values are read as the new default: `all` and `admin` → `limited-admin-full`.
- **Limited** = Edit (Zoho no., due date, customer PO no., description, notes). **Full** = Edit + **Cancel & re-issue**. Cancel & re-issue also needs the credit-note permission: when a user has "full" but credit notes are for administrators, the button is shown disabled with the reason. The time limit applies to both (administrators after the limit when allowed).
- **Invoice edit screen** now uses the Create Invoice layout: blue "Limited edit" bar; Invoice Details (number, date and type greyed out with a lock; due date, Zoho no., customer PO no., description open); Order & Billing facts (incl. paid / balance); Invoiced Items and Invoice Summary read-only ("As issued — cannot be changed" / "Fixed"); Notes + **Reason for the change**. Same checks, confirmation (before → after), order lock and history as V266.3.
- Rules: `editInvoices` accepts the four values; the limited edit is allowed for any value except `none`. Plus the Zoho-number fix above (edit to a new number).
- Files: `js/receipt-core.mjs`, `js/invoicing.js`, `js/receipts.js`, `css/receipts.css`, `index.html`, `sw.js` (cache `bizcore-shell-v266e`), `js/invoice-service.mjs` / `js/receipt-service.mjs` (version strings), `firestore.rules` (+ emulator copy), tests, docs.
- Tests here: `npm test` 88/88, browser 32/32 (edits test extended: locked fields, setting location, Full for all / Nobody), parity pass. Emulator: run on the PC.
