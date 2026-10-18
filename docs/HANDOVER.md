# BizCore handover — 14 Oct 2026 (V266 live; V266.1–V266.6 ready)

Use this note to continue in a new chat. Attach this file and the folder `C:\BizCore\v264\BizCore_v264`, or connect that folder.

## Where things are
- **Working copy:** `C:\BizCore\v264\BizCore_v264` (full package, including tests). It is also in `C:\BizCore\v264\BizCore_v264_Full_Package.zip`.
- **Website files for GitHub:** `C:\BizCore\v264\BizCore_v264_GitHub_Pages.zip`. The site is GitHub Pages `musthafakm1100.github.io/bizcore`.
- **Firebase project:** `bizcore-downtown`. Delivery notes and invoices are in independent mode. The rules are published (V264.7 Zoho rules).
- **Live version:** V265.7. The console line ends with "… compact views 1 · delivered by 1 · confirm open 1 · deliveries 3)".
- **Working copy version:** V266 (Payment Receipts, see `docs/V266_PAYMENT_RECEIPTS.md`). Console line ends with "… deliveries 3 · receipts 1)". V266 was uploaded and its rules published by Musthafa on 14 Oct. **V266.1** (bank charges, customer picker, A4 table header) is in the working copy: rules change again (bankCharges) — run the emulator, publish, upload. **V266.2** (picker on click, amount format) and **V266.3** (edit receipts/invoices with time limit, cancel & re-issue, receipt lock — rules change again) are also in the working copy, not uploaded. **V266.4** (Editing invoices moved to Invoicing rules with the 4-level scale, full = Cancel & re-issue; invoice edit in the Create Invoice layout; Zoho-number rule fix for edits) — rules change again; console "Payment receipts V266.4 ✅". **V266.5** (application theme covers the whole screen, saved with the user, 6 themes, fixed status colours — see `docs/V266_5_THEME.md`) — website files only, no rules change. **V266.6** (no page header, one-line register toolbar, top bar / breadcrumb / collapse button, small labels, DD-MM-YYYY — see `docs/V266_6_SCREENS.md`) — website files only. **Next:** V266.7 phone & tablet screens, then V267 Purchase Invoices (mockups shown; decisions recorded in this chat: POs occasional, Zoho bill no. optional, cost-limit + action in Administration, simple stock pool, bank charges = bank expense).
- **Baseline:** V259 stays unchanged as the reference (`C:\BizCore\V259`). It is used by the parity test.

## Working rules (agreed with Musthafa)
- Don't change the live database, the security rules or Firebase settings without explicit approval.
- Show a picture (mockup) before changing the look of an existing screen. Give 2–3 options when asked.
- Keep `start_server.bat` in packages. Configurable values go in Administration.
- Follow `docs/UI_STANDARDS.md` for every screen (registers, entry screens, compact display screens).
- Don't migrate or fix old test data; all data is test data.
- Before the final cleanup: delete and re-upload the product images.
- The cleanup must remove all test data whatever its structure (backup, dry run, subcollections and Storage; keep settings and users; ask about masters).
- Don't claim deployment or live testing that wasn't done.
- After each change:
  - bump the `?v=` version numbers and the `sw.js` CACHE_NAME;
  - run all tests;
  - copy the files to the PC and verify them;
  - list exactly which files to upload.

## Tests
- `npm test`: 72 unit and service tests.
- `npm run test:browser`: 28 browser tests (simulator).
- `npm run test:parity`: needs `V259_DIR`.
- `npm run test:emulator`: Firebase Emulator, run on the PC; last result 23/23.
- Environment: `PLAYWRIGHT_FROM=<playwright package.json> CHROMIUM_PATH=<chromium> V259_DIR=<V259 folder>`.

## Done in this chat (V264.6 → V265.7)
See `docs/V264_INVOICING.md` (a section per version) and `docs/UI_STANDARDS.md`. In short:
- **Invoices:** compact invoice and credit note screens; a mandatory, unique Zoho number; save confirmation; spinners.
- **Navigation:** back-navigation fixes; Sales Order refresh after a delivery note is saved.
- **Registers:** standard registers (Delivery Monitor style) and date filter "A".
- **Display screens:** compact document views (Quotation, DN, Invoice, Credit Note) at A4 width plus a right panel.
- **Delivery notes:**
  - "Delivered by" (staff or someone else, name only on the print);
  - monitor: "Out for Delivery", and the "Awaiting Delivery" row removed;
  - compact Confirm Delivery / Correct Confirmation for phone and tablet;
  - "1 Invalid" fix; "Could not open Delivery Confirmation" fix.
- **Deliveries screen** (`js/deliveries.js`):
  - out-for-delivery cards in group boxes; Mine / All; search; QR scan (`delivery.html?t=`);
  - live refresh; loading state;
  - "open on this device"; `#deliveries` link; Android shortcut.
- **Delivery note view on phone and tablet:** Details / Document tabs, A4 fitted to the width, ⋯ More sheet.

## Next steps (agreed order — confirmed by Musthafa 13 Oct, 22:49)
1. **Payment Receipts — built in V266** (14 Oct). Answers: Zoho payment no. mandatory/optional is an Administration setting; unapplied money allowed; credit notes not on the receipt screen; who records / voids is an Administration setting; old "Record payment" hidden. Remaining: run `npm run test:emulator` on the PC, then (with approval) publish the rules and upload the files — see `docs/V266_PAYMENT_RECEIPTS.md`.
2. **Other screens** Musthafa plans.
3. **Mobile standards:** a "phone & tablet" section for `docs/UI_STANDARDS.md`.
4. **Full phone/tablet makeover** of the existing screens, with pictures first, one area at a time.

## Open points / ideas not done
- **`sw.js`:** it intercepts Firestore requests (console noise "Failed to convert value to 'Response'"). The fix: leave Firebase data traffic alone but keep caching gstatic and jsdelivr. Low priority; it was explained to Musthafa.
- **"Updated by another user" pill:** it appears after your own saves. Not fixed yet.
- **Security recommendation (Firebase Console, Musthafa's decision):** Authentication → Settings → User actions → untick "Enable create (sign-up)".
- **Possible next speed-up on phones:** show the cached data instantly at startup, then refresh.
- **Accountant to confirm:** the VAT treatment of advances.
- **Cleanup tool:** see "Working rules" above.


## V266.7 — phone & tablet screens (14 Oct)
See docs/V266_7_PHONE_TABLET.md. Next: V267 Purchase Invoices (redo mockups in theme colours with a small identity colour, discuss one by one).


## V267.1 — Payment Accounts (15 Oct)
See docs/V267_1_PAYMENT_ACCOUNTS.md. Plan agreed: 1 Payment Accounts (done) → 2 cash ledger + custodian confirmation → 3 Payment Receipts use accounts → 4 Purchase Invoices (split payments) → 5 supplier payments/advances → 6 unassigned stock, POs. Everything accounting-ready (balanced debit/credit records, account codes) for the future full chart of accounts. Rules must be published for V267.1.

## V267.2 — Cash ledger + custodian confirmation (15 Oct)
See docs/V267_2_CASH_LEDGER.md. Finance → Cash & Bank (staff), My Cash (mycash.html) for cash custodian logins (created from Administration → Users), handovers TRF-YYMM-####, confirm / query, statement. **All rules changed from "signed in" to staff()** — run RUN_EMULATOR_TESTS.bat on the PC (ledger.test.mjs is new) before publishing. Next: step 3, Payment Receipts use the payment accounts (cash receipts post a line for the custodian to confirm).

## V268.1 — Purchase Invoices, credit only (17 Oct)
See docs/V268_1_PURCHASE_INVOICES.md. This builds the approved mockup 4, except payments: every invoice is saved Unpaid (credit). New rules sections need the emulator run (purchases.test.mjs) before publishing.

Musthafa's decisions:
- Last price paid is the reference when there is no estimate.
- Supplier invoice no. is mandatory.
- A cost below the estimate is shown in blue.
- No estimate gets a light "attention" note.
- POS cards are linked to the bank account.
- Extra quantity must be placed on purpose.
- An unpaid amount goes to the payable, with a required due date.
- Supplier's total is required; rounding is matched within ±1.00 (set in Administration).
- Discount is mostly on the whole invoice; per line or both can be chosen in Administration.
- Discount at payment time comes in V268.2; cash back comes in step 5.
- Cheques: not used now, PDC design kept for later.

Open question: should advances go in V268.2 or step 5? Also: discuss before any code change.

## V268.12 — Purchase invoice lines (approved mockup 7, 17 Oct 2026)
- Entry lines: "Item · sales order" in one wide column (description, then unit · SO · customer). The separate Sales order and Still-to-buy columns are gone.
- Qty bought: the box sits level with the unit cost box. Under it is "of N to buy", then one status line: ✓ complete (green), +N extra (amber) or N still to buy (grey). Stock lines show only the box.
- Unit cost: the box, then "est. X" or "last paid X · date", then the cost tag.
- Selling → P/L column (only for roles allowed in Administration → Purchase Settings): sell price, profit or loss (red), and margin %. It uses the landed cost, so shared costs and discount count. "· N for the order" appears when part of the line goes to stock.
- Phone (≤760 px): each line is a card (description; qty and cost side by side; amount and P/L; goes to). The extra-quantity and reason prompts attach under the card.
- View screen: the same item column plus the Selling → P/L column.
- Files: js/purchases.js, css/purchases.css, index.html (?v=268.12), sw.js (bizcore-shell-v26812). Tests: tests/browser/purchases.e2e.mjs (second test). No change to data, rules or the service.
- Known, not fixed: on a phone the Purchase Monitor panel opens over the Purchase Invoices page. The other registers turn it into status chips (js/responsive.js REG + css/responsive.css page lists). Waiting on Musthafa.

## V268.13 — small changes (17 Oct 2026)
- Phone: the Purchase Invoices register follows the phone standard (status chips + Summary, filter icon with "Supplier", its own cards). The Purchase Monitor no longer covers the page. Done in js/responsive.js (REG.purchaseinvoices, a `who` label) and css/responsive.css (page lists).
- "Goes to" is centred in the entry and view tables. On a phone it stays left.
- The text under the boxes now starts with a capital: Of N to buy, Complete, Est., Last paid, As estimated, Same as last paid, No estimate or previous price, Sell, For stock, No reference, Reason.
- Upload: index.html, sw.js (bizcore-shell-v26813), js/purchases.js, css/purchases.css, js/responsive.js, css/responsive.css. This also covers V268.12.

## V268.14 — Purchase register matches the other registers (17 Oct 2026)
- Cause: Purchase Invoices was missing from the shared register styles. Fixes:
  - added `#page-purchaseinvoices` next to `#page-receipts` in css/register-standard.css (incl. @media/@container rules, `#pireg-table` beside `#rctreg-table`) and css/shell.css;
  - the register rules that css/receipts.css gives its own page are generated into css/purchases.css (block "V268.14: register look").
- Result: the monitor (245 px, head, total, rows, dots, figures), filter bar (sort hidden, count hidden like Receipts, icon-only Clear, widths), date field, table header/rows and type sizes are identical to Payment Receipts. The browser test compares them, so any future drift fails the test.
- "Goes to" is now right-aligned in the entry and view tables (phone: left).
- If you add a page to the register lists, add `#page-purchaseinvoices` too.
- Upload (covers V268.12–14): index.html, sw.js (bizcore-shell-v26814), js/purchases.js, css/purchases.css, js/responsive.js, css/responsive.css, css/register-standard.css, css/shell.css.

## Data plan — agreed order (17 Oct 2026)
Musthafa is on the Blaze (pay-as-you-go) plan. Finish purchasing first, then do the data work before go-live and before the 3-year import:
1. Pricing versions out of the RFQ document (subcollection, the RFQ points to the current version).
2. Registers load only open and recent records (last 12 months); older ones on demand; monitor counts from summary docs.
3. Per-record transactional saves for RFQ, Quotation, SO and masters (no whole-list fbSave, no implicit deletes).
4. Split settings, make the Recycle Bin a soft-delete marker, add size guards on every save.
5. Administration → Data health (counts, largest docs, reads).
Budget alert suggested: $5 a month (50/90/100%).
Pending small change: rename the register button "New Purchase Invoice" to "New Invoice" (approved) in the next package.

## V268.2 — Supplier payments (17 Oct 2026)
Built from approved mockups PI_4 / PI_8 / PI_9 / PI_10, plus cash back (approved without a mockup). Details are in docs/V268_2_SUPPLIER_PAYMENTS.md. Advances are not in this version; they come in step 5 (paying more than the balance is refused). The "New Invoice" button rename is included.
Order for going live: 1) run the emulator tests on the PC, 2) publish firestore.rules, 3) upload the files, 4) set the linked bank account on every card account (Administration → Payment Accounts).

## V268.21 — Discount at payment on the new invoice (17 Oct 2026)
- In the Payments section of a new invoice, a "Discount at payment" field appears once there is a payment line. Payments plus the discount can settle the invoice, which is then saved as Paid with no due date. The discount is saved straight after the invoice as a discount-only payment (SP number, no money moved). If that second save fails, the invoice stays saved and a message says to use Record payment.
- In Record payment, the only payment line can be removed, so a discount on its own settles the balance.
- No rule changes. Upload: index.html, sw.js (bizcore-shell-v26821), js/purchases.js, css/purchases.css.

## V268.3 — Supplier advances, Supplier Payments page, edit (17 Oct 2026)
Built from the approved mockups PI_11 – PI_14; details are in docs/V268_3_ADVANCES_AND_EDIT.md.
- New page Purchasing → Supplier Payments (same look as Receipts) with **Pay Advance**.
- Advances are used on invoices as payment lines.
- Invoices and payments can be edited: limited by staff within the edit days; full by administrators. A full invoice edit is only possible while the invoice has no payments.
- New settings: editMode and editDays (Administration → Purchase Settings).
- Rules changed: run the emulator tests on the PC, then publish firestore.rules (don't upload it to GitHub).

## V268.31 / V268.32 (18 Oct 2026, overnight work)
- **V268.31:**
  - The edit screen opens in front of the invoice view.
  - Small grey texts start with a capital letter.
  - A "Saving…" overlay covers every save (purchasing, Cash & Bank, Payment Accounts).
  - Fix: between midnight and 03:00 Riyadh, a payment dated today was refused as "in the future" (the service used the UTC date).
- **V268.32:**
  - Rules: a full edit of a discount-only payment was refused (it has no ledger entry before or after). Fixed, with unit and emulator tests.
  - My Cash: "Saving…" overlay, and it now loads the current cash-ui.js.
  - "Optional" tags start with a capital.
  - The Supplier Payments menu badge was removed (it shortened the menu name; not in mockup PI_11).
  - More unit tests: discount-only edit, duplicate supplier invoice no. on a limited edit, stock already used on a full edit, cash back edit, the same edit sent twice, an advance can't be lowered below what has been used.
- **Stock mockups ST_1 – ST_4:** waiting for approval.
- **Data plan step 1:** the plan is in docs/DATA_PLAN_STEP1_PRICING_VERSIONS.md; decisions are needed.

## V268.4 — Purchasing → Stock (18 Oct 2026)
Built from the approved mockups ST_1 – ST_4, with the words "Allocate" and "Open Demand"; details are in docs/V268_4_STOCK.md.
- The rules changed (stock allocations): run the emulator tests, then publish.


## V268.5 — Data safety, approvals, pickers, New Product / New Unit, Change Item (18 Oct 2026)
Built from the approved mockups V5_1 – V5_6; details are in docs/V268_5_DATA_SAFETY.md.
- Browser-only settings (units, tax master, pricing settings, margin statuses, cost components) are now in Firebase (sharedSettings). An administrator moves them once ("Move settings to Firebase", backup first) — **on Musthafa's PC first**.
- The PIN and the old browser User Management are removed; Backup & Restore is for administrators; manager approval is asked from an administrator and given from their own login (approvals).
- Administration → Data Health. Type-and-search pickers. Product required on stock lines + New Product. New Unit. Change Item (stockChanges).
- Rules changed: run the emulator tests, then publish.
- Later (agreed): product required on quotation / SO lines; Firebase Users & Roles screen; Stock Count; "from stock" on the SO view; data plan step 1 decisions.
- **V268.51 (18 Oct):** pickers open only on click / typing (not when the screen opens); the list floats over the window and fits the space on screen (opens upwards when there is more room); sales orders show the SO no. first. No rule changes.
- **V268.52 (18 Oct):** all search lists float over the window and fit the screen (also the older ones: Quotation customer / contact / product, RFQ customer, Pricing supplier, New Receipt customer); lists open on click, typing or ↓, not when a screen opens; every list of names is A → Z (customers, suppliers, products, contacts with the default first, units, payment accounts by code, cash accounts, logins). Sales orders stay newest first; terms keep their own order. No rule changes.
- **V268.6 (18 Oct):** lookup window (approved mockup V6_2, option 3) for the pickers: Pay advance → Supplier and Sales order, New Purchase Invoice → Supplier, Change Item → Product. Clicking or typing in the field opens "Choose …" with a search box and a table (↑ ↓, Enter or double-click). Esc closes only the lookup. The Supplier Payments filter keeps its small list; the older lists (Quotation, RFQ, Pricing, New Receipt) keep the floating list from V268.52. No rule changes.
- **V268.61 (18 Oct):** Musthafa preferred mockup V6_1 after trying the lookup window: every list is as wide as its field and stays inside the open window (above the footer), scrolling inside the list; it opens upwards when there is more room above. Sales orders show the SO no. and date on the first line, customer · items on the second. Applies to the new pickers and the older lists (Quotation, RFQ, Pricing, New Receipt). The lookup window code (V6_2) stays in purchases.js, unused, in case it is wanted later. No rule changes.
- **V268.62 (18 Oct):** pickers in a form row have the same height as the other fields (34 px); the chosen supplier / order shows on one line (name, then the detail in grey, cut with … and shown in full on hover); a long item no longer stretches the Pay advance row. No rule changes.
