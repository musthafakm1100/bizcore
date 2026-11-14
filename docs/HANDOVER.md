# BizCore handover — 31 Oct 2026 (live V270.4.3; V270.4.4 – V270.4.14 ready, upload not confirmed)

> Start at **"NEXT CHAT — start here"** at the end. Working rules: section "Working rules".

Use this note to continue in a new chat: connect the folder `C:\BizCore` (or attach the latest full zip) and say
"Continue BizCore from V270.4.8.1. Read docs/HANDOVER.md first."

## Start here (29 Oct 2026)
- **Latest package:** `C:\BizCore\BizCore_V270.4.8.1_full.zip` (+ `BizCore_V270.4.8.1_upload\`, cumulative since V270.4.3:
  V270.4.4 faster sign-in, V270.4.5 mobile zoom, V270.4.6 invoiced DN locked, V270.4.7 phone "⋯" menu fix,
  V270.4.8 footer at the bottom of every page (js/doc-pages.js) + PO in DN / Invoice PDF names + BizCore date field
  everywhere; V270.4.8.1 date field: Tab / click elsewhere closes the calendar, picking a day keeps a date filter box open
  — docs/V270_4_8_PAGES_DATES.md). Delete js/print-ios.js on GitHub if V270.4.7 was uploaded.
  No rules / database change. Ask Musthafa: uploaded? iPhone PDF OK (IOS_ZOOM 0.71 in js/doc-pages.js may need tuning)?
- **Agreed 29 Oct (DN after invoicing, professional way):** Step 1 done in V270.4.6 (lock, wording, paid notice).
  **Step 2 later** with stock + Cash & Bank: Sales Return (Return Note) against the DN → credit note created from the
  return (types Return / Price adjustment) → customer credit (apply) or refund; BizCore credit notes carry the Zoho
  credit note number (official ZATCA credit notes are issued in Zoho Books).
- **Done in V270.4.8 (agreed 30 Oct):** footer at the bottom of every page (screen / PDF / print, all documents, all
  devices; 8 mm from the edge, spread left → right, ≥ 8 mm gap, "Page X of Y"); PDF names `DN-… - Customer - PO…` and
  `INV-… - Customer - PO…` (no "Accepted - Standard"); BizCore date field on every date input and filter.
- **Done in V270.4.9 = Package A (agreed 30–31 Oct, see docs/V270_4_9_MASTERS.md; rules need the emulator tests on
  his PC before publishing):** (mockups IM_1–IM_4 approved)
  1. Import: progress "Importing… n of N", one press only (button / Cancel / ✕ locked), rows repeated in the file flagged
     (only the first imported), existing name (capitals / spaces / dots ignored) or VAT No. → not imported, truly unique IDs.
     Cause found: the Import button stayed active during the save; Musthafa pressed it several times → every row twice.
  2. Customer + Supplier forms: same / similar name → notice ("Open it" / "It's a different company"); same VAT No. →
     blocked on screen AND in the database (rules change → emulator tests on his PC before publishing).
  3. Product form: same / similar name → notice; code is system-generated (no manual item code).
  4. Rename of a used record allowed with a confirmation (issued documents keep the old name); every link by internal ID
     (fix lookups by name, e.g. quotation print customer address); rename + VAT change in the record history; duplicate
     check also on rename; VAT change on a used customer → confirmation.
  5. Master codes, system-generated on save, never edited / reused, one sequence across companies, via the numbering
     counters (offline → temporary code): CUS-00001, SUP-00001, ITM-000001, EMP-0001 (format in Administration →
     Numbering). Shown in lists / search inside BizCore only — not printed (31 Oct: system item codes are hidden in the
     DN / Invoice Item Code column; a supplier's own code still prints). Import: codes in file order; an Excel code column kept as "Old code".
  Musthafa will wipe customer + product masters and re-import after this package (no duplicate clean-up tool).
- **Agreed 31 Oct — product linking on quotation / SO lines** (mockups PL_1, PL_2a, PL_2b): Product master gets Type
  Goods / Service; priced lines link to the Item Master (goods or service), note lines free text; line text keeps the
  customer's wording (print unchanged); markers green / orange as on RFQ; RFQ stays free. **Mark as Sent = reminder**
  ("Link items?" — closest matches, search, + New Product, make it a note, **Send anyway**); **Create Sales Order =
  required** (every priced line linked). Master grows only with items actually sold. Linking gives one price history
  per item (estimated / quoted / bought / sold) whatever the wording.
  Decided 31 Oct: customer wording memory YES (per customer: wording → item, suggested next time); item code shown in
  BizCore only (Item Code column on customer documents stays as today); contracting quotations keep free-text scope
  lines until the Contracting module; user manual started (Claude Docs "BizCore User Manual",
  https://claude.ai/artifact/G79ZKMYKYWxHaPPUjsx1du — written: About, Getting started, Delivery Notes, Invoices & Credit
  Notes, Payment Receipts; update the affected sections after every package).
  Also in V270.4.9: "today" defaults use the local (Riyadh) date, not UTC; quotation valid-until no longer a day early.
  Build plan: package A = masters (import fixes, duplicate notices, VAT unique incl. rules, rename handling, master codes);
  package B = product linking (Goods / Service type, markers, Sent reminder, SO required, wording memory).
  Decided 31 Oct (Package B): services get their own code sequence **SRV-000001** (goods keep ITM-000001); type is a
  field, the code never changes; codes are not built from category.
- **Next agreed:** 1) Cash & Bank step 3 — customer receipts post to Payment Accounts (cash receipts post a line for
  the custodian to confirm); write the choices down for Musthafa and wait for his OK before coding. 2) Company
  foundation (V270.5, see "Plan agreed 25 Oct").
- Known test status (29 Oct): unit 138/138; browser: see docs/V270_4_6_DN_INVOICE_LOCK.md; `dn-workflow` fails the same
  way on the untouched V270.4.4 (old); `users` "Cash Custodian" can fail inside the full run but passes alone (flaky).

## Where things are
- **Business:** Downtown Trading Est., Riyadh (Musthafa). RFQ → supplier pricing → quotation → sales order → delivery →
  VAT invoice → receipt; purchasing, stock, cash & bank.
- **App:** BizCore, Firebase / Firestore web app. Website: GitHub Pages `musthafakm1100.github.io/bizcore`.
  Firebase project `bizcore-downtown`, **Blaze plan** — keep within the free allowance (50,000 reads a day).
  Delivery notes and invoices are in independent mode. Custodian logins use `mycash.html`.
- **Packages on the PC:** `C:\BizCore\BizCore_V<version>_full.zip` (whole project incl. tests and docs) and
  `C:\BizCore\BizCore_V<version>_upload\` (only the files to upload). Emulator tests run from an extracted full
  package (`RUN_EMULATOR_TESTS.bat`).
- **Latest working copy:** V270.4.14.2 = `C:\BizCore\BizCore_V270.4.14.2_full.zip`.
- **Baseline:** V259 (`C:\BizCore\V259`) for the parity test.

## Version status (22 Oct 2026)
| Version | What | Rules | Status |
|---|---|---|---|
| V269 | Pricing versions in their own documents (data plan 1) | changed | live |
| V269.1 | Sales side loads open + last 12 months (2a) | — | live |
| V269.2 / .2.1 | Sales Orders screen (tiles, New Order, phone), iPhone edges; open-order mark fix | — | live |
| V269.3 | Purchasing / stock / cash windowed; running balances; last prices (2b) | changed, published | **live** (emulator 58/58) |
| V269.4 | Notification log 7 days, no browser copies, purchasing "in use" checks, read count (2c) | — | ready, upload not confirmed |
| V269.5 | One-record saves, revision check, Recycle Bin mark (3 + bin) | — | ready, upload not confirmed |
| V269.6 | Settings pictures split, size guard, Data Health counts / largest (4 + 5) | — | ready |
| V269.7 + .7.1 | Sales Order view redesign (SV_1 – SV_9): rings, document lists, tabs, Profit 🔒; .7.1: one font, item names normal, Finance colours, lines without a cost; .7.2: phone table cards fixed for Safari | — | ready |
| V270.1 + .1.1 | Pricing screen redesign (PR_29 – PR_44) + the BizCore date field DD-MM-YYYY (on Pricing's Quote Date); SO Profit `gross_margin` fix; .1.1: blue totals row, lighter ⋮, menu fits; .1.2: Buy → Sell while typing fixed; .1.3: line ref in place, Price History (the 4 Firestore indexes were created and Enabled on 23 Oct, docs/FIRESTORE_INDEXES.md), View mode in the same window with Edit — docs/V270_1_PRICING.md | — | ready |
| V270.2 + .2.1 | Quotation Entry redesign (QT_1 – QT_12): details band with Fold, tabs, grid, summary, phone cards; line discounts (% / SAR); note styles per quotation and per note line (frozen at Sent); VAT 0.00 fix on quotations from Pricing; .2.1: "Pricing not saved" (undefined field from a custom additional cost) + save guard — docs/V270_2_QUOTATION.md | — | ready |
Each version's upload list is in its doc (docs/V269_*.md) and in its `_upload` folder. V269.7 contains V269.4 – V269.6;
uploading it means: **index.html, sw.js, js/app.js, js/data-safety.js** (from 269.4 – 269.6) plus **js/so-view.js,
css/so-view.css, js/responsive.js, js/purchases.js, js/purchase-core.mjs, js/purchase-service.mjs** (269.7).
V270.1 adds **js/pricing-ui.js, js/bc-date.js, css/pricing.css, css/bc-date.css** and changes index.html, sw.js,
js/app.js, js/so-view.js.
V270.2 adds **js/quotation-ui.js, css/quotation.css** and changes index.html, sw.js, js/app.js, js/pricing-ui.js; V270.2.1 also changes js/account-service.mjs.
After V269.6: Company Settings → Save once. After V269.7 (optional): Purchase Settings → Save once.

## Working rules (agreed with Musthafa)
- Discuss before changing code and wait for his OK; when he points out a missing option, first show where it may exist.
- Don't change the live database, the security rules or Firebase settings without explicit approval. Never publish rules
  or upload files yourself; never claim deployment or live testing that wasn't done.
- Show a picture (mockup) before changing the look of an existing screen. Give 2–3 options when asked.
- Keep `start_server.bat` in packages. Configurable values go in Administration. Follow `docs/UI_STANDARDS.md`.
- All data is test data: don't migrate or fix old test data; no migration tools / backups for it (his decision, 18 Oct).
- Before the final cleanup: delete and re-upload the product images. The cleanup removes all test data whatever its
  structure (keep settings and users; ask about masters).
- After each change: bump the `?v=` numbers and the `sw.js` CACHE_NAME; run all tests; copy the package to `C:\BizCore`
  and verify the file sizes; list exactly which files to upload; rules changes → emulator tests on his PC first.
- When work is promised for "overnight", do it then — don't wait to be reminded (19 Oct feedback).

## Tests
- `npm test`: unit / service tests. `npm run test:browser`: browser tests (simulator, fake Firestore SDK in
  tests/browser/fake-sdk, store in tests/support/fake-firestore.mjs). `npm run test:parity`: needs `V259_DIR`.
- `npm run test:emulator` / `RUN_EMULATOR_TESTS.bat`: Firebase Emulator on the PC; last result 58/58 (V269.3).
- Environment (cloud): `PLAYWRIGHT_FROM=/opt/node-tools/node_modules/playwright/package.json
  CHROMIUM_PATH=/opt/pw-browsers/chromium-<n>/chrome-linux64/chrome` (27 Oct: chromium-1243; check `ls /opt/pw-browsers`).

## Data plan (17 Oct) — DONE
1 pricing versions (V269) · 2 open + recent records (V269.1 / .3 / .4) · 3 one-record saves (V269.5) · 4 Recycle Bin
mark, settings split, size guard (V269.5 / .6) · 5 Data Health counts, largest, reads (V269.4 / .6).
Key mechanisms (index.html unless noted):
- **BCWin** (`BC_WIN_SPECS`): per collection, open queries + date ≥ cutoff (Data Health months, default 12), linked
  records, older on request (`loadOlder`, `findNumber`, `loadWhere`, `anyWhere`).
- **Running totals** (js/running-totals.mjs): `cashBalances/{account}` (increment, `rebuiltAt` after a rebuild),
  `itemLastPrices/{itemKey}`; Cash & Bank "Brought forward" / "Show older lines".
- **Saves:** `fbSave` writes only changed records, deletes only `fbMarkDeleted` ids; quotations / RFQs / SOs carry
  `_rev/_savedBy/_savedAt` and are checked before writing (`_bcCheckedSet`); size guard `_bcSizeCheck`.
- **Recycle Bin:** `_deletedAt/_deletedBy` on the record (`fbSoftDelete`, filtered in every load path); read when opened.
- **Settings:** `settings/main` + `settings/img_logo|img_stamp|img_signature`.
- **Reads:** `window.BCReads` (wrappers around getDoc / getDocs / onSnapshot), shown in Data Health.

## Plan agreed 25 Oct 2026 (Users & Roles, then companies)
1. **Users & Roles** (approved mockups UR_1 – UR_5): V270.4.1 users + sign-in gate (**live 25 Oct**, emulator 62/62, docs/V270_4_1_USERS.md);
   V270.4.2 roles with the module grid (View / Create / Edit / Cancel, All / Own records) enforced in rules + screens (**live 25 Oct**, emulator 66/66 three times, docs/V270_4_2_ROLES.md);
   V270.4.3 special rights (Billing / Receipt / Purchase "all / admin" choices moved there, same effect at start) + "Forgot password" on login (**live 25 Oct**, docs/V270_4_3_RIGHTS.md);
   V270.4.4 faster sign-in (docs/V270_4_4_SIGNIN_SPEED.md).
   V270.4.5 mobile zoom: app frame never zooms, no zoom when typing, document pages zoom on their own (docs/V270_4_5_MOBILE_ZOOM.md).
   Next agreed candidates: Cash & Bank step 3 (customer receipts post to Payment Accounts — still open), then the
   Company foundation (V270.5); Musthafa also wants legacy / test-data cleaning (remind him: re-upload old product images).
2. **Company foundation:** company master (Downtown first, Fast Fix added unused), activity master (Trading, Contracting),
   company + activity on every new document, numbering per company, company details copied into issued documents.
3. Finish open items (quotation discount → SO, registers "Entered" column / sort, RFQ print, V270.3 date fields) →
   test-data cleanup → **go live with Downtown only** → 3-year import.
4. After go-live: accounting (chart of accounts / ledger per company, consolidated reports) → Contracting (projects,
   estimation, subcontracting, progress billing, estimate vs actual) → Fast Fix live, comparisons across companies.
- Employee operational roles (Master Data) stay separate from access roles; the employee link on a user is optional.

## Next (to agree with Musthafa)
- **V270.2 built (24 Oct):** the Quotation Entry redesign — try it on the PC, an iPad and the iPhone (discounts, note
  styles, Fold, phone cards). Open point: the quotation-level discount still doesn't go to the Sales Order (as before).
- **V270.3 (agreed 22 Oct, was "V270.2"):** the BizCore date field (js/bc-date.js, DD-MM-YYYY, typed or calendar) on every other
  date field — about 45 `type="date"` inputs (index.html, invoicing, purchases, cashbank, supplier-payments, receipts,
  stock, accounts, ui-standard, responsive, mycash.html). Values stay ISO.
- Try the new Pricing screen on the PC, an iPad and the iPhone (references, line menu, phone cards, date field).
- Confirm V269.4 – V269.7 are uploaded; check Data Health (reads at start-up, counts, balances "Up to date"); try the new
  Sales Order view on the PC, an iPad and the iPhone with real orders.
- Open from V269.2: Dashboard and the quotation register's order chips still include payment (mockup first); tiles
  for the other registers one by one, each with a mockup. (The SO view's progress bar is done in V269.7.)
- Later from V269.7: salesperson field on the SO; "other order costs" on Profit; report "cost over the estimate"
  across orders (summary record per order, as cashBalances).
- Earlier "later" list: product required on quotation / SO lines; Firebase Users & Roles screen; Stock Count;
  "from stock" on the SO view; chart of accounts (cashBalances is the base); the test-data cleanup tool before go-live
  and the 3-year import.
- Budget alert suggested: $5 a month (50 / 90 / 100 %).

## Open points / ideas not done
- **`sw.js`:** intercepts Firestore requests (console noise "Failed to convert value to 'Response'"). Fix: leave Firebase
  traffic alone, keep caching gstatic / jsdelivr. Low priority.
- **"Updated by another user" pill** can still appear after your own saves.
- **Firebase Console:** keep "Enable create (sign-up)" ticked — BizCore creates users from the browser; since V270.4.1 a
  self-made account has no user record and is refused everything.
- **Accountant to confirm:** the VAT treatment of advances.
- Old test orders with invoices / deliveries inside them can't be changed under the rules (by design; removed by cleanup).
- A record in the Recycle Bin still counts in the "in use" check when deleting a master (purge it first).

---
# History (newest last)

## V264.6 → V265.7 (13–14 Oct)
See `docs/V264_INVOICING.md` (a section per version) and `docs/UI_STANDARDS.md`. Compact invoice and credit note
screens, mandatory unique Zoho number, back-navigation fixes, standard registers and date filter "A", compact document
views (A4 + right panel), Delivery notes ("Delivered by", Out for Delivery, compact Confirm Delivery), Deliveries screen
(js/deliveries.js: cards, Mine / All, QR scan, live refresh), DN view on phone / tablet (Details / Document tabs).
V266 Payment Receipts (docs/V266_PAYMENT_RECEIPTS.md), V266.1 – V266.6 (bank charges, edit limits, theme, screens).

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
- **V268.7 (18 Oct, mockups V7_1 / V7_2):** a small pencil instead of "Change" on every chosen picker (✕ where the field may stay empty). **+ New Supplier "typed text"…** at the bottom of the supplier list (Pay advance, New Purchase Invoice): short form (company name, contact, phone, VAT no., city), "Did you mean …?" for a look-alike, same name or same VAT no. refused, chosen after saving; saved with createdFrom 'purchasing'. Everyone may use it (as in Master Data). No rule changes.

## V269 — Data plan step 1: pricing versions in their own documents (18 Oct 2026)
Musthafa's decisions: keep version history (option A); all data is test data, so no migration tool, backup, check or switch.
Details: docs/V269_PRICING_VERSIONS.md. Each version is rfqs/{id}/pricingVersions/v{N}; the RFQ keeps the current version's
working copy plus a small pricingIndex. Saved in one batch with the RFQ; old versions read only when opened; old-format RFQs
move automatically on the next RFQ save. Opening an older version no longer changes the RFQ's current version.
Rules changed: run the emulator tests on the PC (pricing-versions.test.mjs), publish the rules, then upload index.html, sw.js,
js/app.js, js/purchases.js. Next: data plan step 2 (registers load only open and recent records).

## V269.1 — Data plan step 2a: sales side loads only open + recent records (18 Oct 2026)
Musthafa approved all 8 decisions of docs/DATA_PLAN_STEP2_RECENT_RECORDS.md as suggested. Details: docs/V269_1_DATA_WINDOW.md.
BCWin (index.html) feeds the same lists to the screens: open + last 12 months + linked records; older on request (date
filter "All Dates"/earlier date, Enter in search, Dashboard All time, Reports, Backup). Sales Orders get isOpen (kept right
by bcHealOpenOrders). Master delete asks Firebase about records that aren't loaded. Data Health shows months + counts.
No rules change. Upload index.html, sw.js, js/app.js, js/ui-standard.js, js/data-safety.js, css/shell.css.
Next: part 2b (purchasing, stock, cash with running balances and last price), then 2c.

## V269.2 — Sales Orders screen + iPhone edges (19 Oct 2026)
Approved mockups (18–19 Oct): work-queue tiles instead of the monitor (To deliver dark tile; Confirmed, Out for delivery,
Partially delivered, To invoice — no overlap, count + value), breadcrumb kept, payment out of the order status in the
register (Invoiced = fully delivered + fully invoiced; "· to invoice" mark), "+ New Order" split button (style 1) with
"choose a quotation" and a greyed "Direct order", phone 2 × 2 tiles + slim bar while scrolling + round + with a bottom
menu, iPhone safe areas on every screen (viewport-fit=cover, css/safe-area.css). Details: docs/V269_2_SALES_ORDERS_SCREEN.md;
standard: docs/UI_STANDARDS.md §1 (tiles), §9, §10. No rules change.
Open: the SO view's progress bar, the Dashboard and the quotation register's order chips still include payment (mockup
first if wanted); the other registers get tiles one by one, each with its own mockup.
Next (agreed): data plan 2b → 2c → steps 3–5 with the suggested choices, overnight.

## V269.2.1 — open-order mark fix (19 Oct 2026, uploaded)
Old test orders with invoices inside them were refused every minute (console warnings + "updated by another user").
bcHealOpenOrders now skips them and anything the rules refuse. js/app.js?v=269.21.

## V269.3 — Data plan step 2b (19 Oct 2026)
Purchasing, stock and cash load open + last 12 months; running balance per account (cashBalances, increment, rebuilt by
staff on start / Data Health); last price per item (itemLastPrices); Cash & Bank "Brought forward" + "Show older lines".
Wrapper js/running-totals.mjs around runTransaction for the ledger and purchase services (index.html and mycash.html).
Rules changed. Details: docs/V269_3_RUNNING_TOTALS.md. Next: 2c, then steps 3–5 (suggested choices).

## V269.4 — Data plan step 2c (19 Oct 2026)
Notification log: last 7 days read, no new entries in independent mode (no deletion — would need rules). No browser
copies of quotations / RFQs / Sales Orders. Master delete also asks Firebase about purchase invoices, supplier payments
and stock. Data Health: records read from Firebase (window.BCReads, counted by wrappers around getDoc/getDocs/onSnapshot
in index.html). No rules change. Details: docs/V269_4_DATA_PLAN_2C.md. Data plan step 2 complete.
Next: steps 3–5 — write the choices down for Musthafa first.

## V269.5 — Data plan step 3 + Recycle Bin (19 Oct 2026)
fbSave never deletes implicitly (fbMarkDeleted for Delete RFQ / Sales Order / term). Quotations, RFQs, Sales Orders:
_rev/_savedBy/_savedAt and a read-before-write check (_bcCheckedSet) — refused with who/when if someone saved after
this screen's copy; offline without the check. Recycle Bin = _deletedAt/_deletedBy on the record (fbSoftDelete,
filtered in fbLoad/fbListen/_winNotify/_winLoad), read when opened, restore, purge + "Empty older than 90 days" for
administrators. No rules change. Details: docs/V269_5_RECORD_SAVES.md.

## V269.6 — Data plan steps 4 + 5 (19 Oct 2026)
Company pictures in settings/img_logo|img_stamp|img_signature (old inline settings read, moved on the next save); size
guard on every save (warn 500 KB, refuse 900 KB, the others still saved); Data Health: records per collection
(getCountFromServer, when opened) and the 10 largest loaded records. No rules change. Details:
docs/V269_6_SIZES_SETTINGS.md. Data plan complete.

## V269.7 — Sales Order view redesign (22 Oct 2026)
Approved mockups SV_1 – SV_5 (earlier chat), SV_6/7 (Delivery ring blue, Invoicing ring orange, no Overall ring; To
Invoice column; To Deliver blue / To Invoice orange; every label word capitalised), SV_8/9 (fixed-height cards, document
counts open a floating list on a PC / a bottom sheet on a phone, collapsed by default). Musthafa's choices: Estimate vs
Actual as a switch in Profit; flag above estimate 5% (Administration → Purchase Settings, `estimateFlagPct`); stock at
average cost; footer shows only possible actions; Salesperson = creator for now; Delivered % by value.
New js/so-view.js + css/so-view.css; viewSO hands over (old code kept as fallback). Read-only, nothing new stored on the
SO; Purchasing / Profit read an older order's purchase invoices once (`BCWin.loadContains`). No rules change.
Details: docs/V269_7_SO_VIEW.md; standard: docs/UI_STANDARDS.md §3.

## V270.1 — Pricing screen + BizCore date field (23 Oct)
See docs/V270_1_PRICING.md. Approved mockups PR_29 – PR_44: centred window, ← Back (Alt+←) with Leave Without Saving?,
supplier bar (Supplier Master only), tabs (Items / Additional Costs / Internal Notes / Vendor Quotes), one-column-set grid
with sticky header and totals, Markup On Buy %, line cost incl. its share of additional costs, Last Paid / Last Quoted
(same customer first, status in brackets, Draft / Revised excluded), line ⋮ menu (insert, duplicate, move, details,
lock, delete + Undo), summary panel → totals bar below 1200 px, phone cards. Date field DD-MM-YYYY on Quote Date;
V270.3 brings it to every screen.

## V270.4.1 — Users (25 Oct 2026)
See docs/V270_4_1_USERS.md. A login works only with an active `users/{uid}` record (owner always); Administration →
Users (list, New User incl. Cash Custodian, Give Access for logins without access, Edit, Deactivate live, reset email,
Activity); forced password change; Administrator role = administrator everywhere (rules + services); Roles &
Permissions tab (list only). Rules changed → emulator tests on the PC (users.test.mjs new; all tests seed staff records).

## V270.4.2 — Roles & Permissions (25 Oct 2026)
See docs/V270_4_2_ROLES.md. roles/{id} with perms + lists for the rules; every business collection follows the role;
"Own records only" on RFQs / Pricing / Quotations / Sales Orders via ownerUid (stamped on save); js/permissions-ui.js
hides modules and guards actions; the browser harness now simulates the read rules (a test fails if BizCore asks for
records the role can't read). Known flaky test (also on V270.4.1): data-safety "Code SetSet is free" (typing race).

## V270.4.3 — Special Rights (25 Oct 2026)
See docs/V270_4_3_RIGHTS.md. roles/{id}.rights + rightMods (copied to users/{uid}.perm.rightMods); rules use
hasRight(); Receipt record / void = Receipt module Create / Cancel; at the administrator's first sign-in the roles get the
rights with the same effect as the old settings (once, noted in the role history). Excel / Print follow rights;
approvals go to roles with "Approve pricing below the minimum margin". "Forgot password?" on login.html.
Rules changed → emulator tests on the PC (rights.test.mjs new).

## V270.4.4 — Faster sign-in (27 Oct 2026)
See docs/V270_4_4_SIGNIN_SPEED.md. Administrator role upkeep (built-in roles, Special Rights) runs in the background and
only when one roles read shows something missing; the user-permission repair pass after a change or once a day.
Normal users unchanged (user record + role read before anything opens). Harness: `latencyMs` + `page.__calls`.

## ZATCA Phase 2 decision (27 Oct 2026)
Zoho Books stays the official ZATCA solution for both companies (Downtown, Fast Fix — separate VAT). Later, after BizCore
development / fixes and the Company foundation: connect BizCore → Zoho (Cloud Function with the Zoho keys, customer /
item mapping, invoice types incl. advances and credit notes, Zoho no. + ZATCA status + QR back). Musthafa has no Zoho
development knowledge — guide him click by click (API Console → Self Client). Direct ZATCA integration only if BizCore
replaces Zoho for accounting. Check whether Fast Fix is in the 25th wave (deadline 1 Feb 2027).

## V270.4.5 — Mobile zoom (27 Oct 2026)
See docs/V270_4_5_MOBILE_ZOOM.md. Agreed: frame lock + no zoom when typing (fields keep their size, no Administration
switch); page-only zoom for Quotation / Delivery Note / Invoice / Credit Note / Receipt (pinch, pan, double-tap,
Ctrl + wheel, bar − % + Fit — mockup DZ_1). New js/doc-zoom.js (`BCDocZoom`) + css/mobile-zoom.css on all four pages;
fitDocuments / dnFitA4 hand over the fit scale. Details / Document tab bar now covers the body padding; tabs read Document | Details and Document opens by default. No data or rules change.
Desktop fix: pages held at A4 width so a zoom enlarges them (they were fluid on a PC). Drag to pan with the mouse
when the page is wider than its area (hand pointer; at normal size text can still be selected); Shift + wheel also pans sideways.


## V270.4.6 — Invoiced Delivery Note locked (29 Oct 2026)
See docs/V270_4_6_DN_INVOICE_LOCK.md. A DN covered by a delivery invoice (first confirmed = first invoiced, net of credit
notes) can't be corrected or revised (service code `invoiced` + Correct / Revise disabled with a note); credit note
screen shows what a credit on a paid invoice leaves owed to the customer; zoom bar hidden while the More menu is open.

## V270.4.7 — Phone "⋯" menu and iPhone PDF (29 Oct 2026)
See docs/V270_4_7_PHONE_MENU_PRINT.md. The Invoice / CN / Receipt phone action bar clipped the More menu (overflow) —
fixed. iPhone / iPad print windows get zoom .8 and an in-flow footer (js/print-ios.js); PC / Android unchanged; Safari's
own address / date line can't be removed by a page.

## V270.4.8 — Footer at the bottom of every page · PO in PDF names · date field everywhere (30 Oct 2026)
See docs/V270_4_8_PAGES_DATES.md. Print windows lay themselves out on A4 pages (js/doc-pages.js, BCPages.DN / ERP_QUOTE /
SERVICE_QUOTE); screen sheets keep the footer at the sheet bottom; company footer = parts (docFooterPartsHtml).
BCDate.upgrade() turns every input[type=date] into the BizCore date field automatically (.value stays ISO).

## V270.4.9 — Package A: masters (31 Oct 2026)
Import without duplicates (review tiles, one press, progress, Close), system codes CUS / SUP / ITM / EMP from the
numbering counters (never changed; offline temporary code), name notices, VAT No. unique per list (screen + database:
`partyVat` claims, `js/master-service.mjs`), rename / VAT change of a used record with confirmation and history,
links by id, system item code not printed, today's date local; Delete selected on masters shows a progress window
and checks / moves many records per database question (was one question per record). Rules changed → `RUN_EMULATOR_TESTS.bat` first
(`tests/emulator/masters.test.mjs`). Details: docs/V270_4_9_MASTERS.md. Next: Package B (mockups first).
V270.4.9.1 (31 Oct): Recycle Bin Select all / Restore selected / Purge selected with progress, 400 per save; a restore
that would bring back a VAT No. or name now used by an active record is refused with the reason.
Agreed 31 Oct (Package B): service items stay few and general (e.g. "AC maintenance", "Manpower – technician / day");
the job-specific description is written on the quotation line (as agreed: line text keeps the customer's wording).
Musthafa 31 Oct: when Package B (service lines) is built, put the service guideline in the user manual (Quotation
section): service items few and general (20–50, e.g. "AC maintenance", "Manpower – technician / day"); the job's
description is written on the quotation line (example: 12 split AC units … linked to SRV AC maintenance); the link gives
reports / price history / unit / account; new service only for work sold again; contracting scopes stay free text.
Package B additions agreed 31 Oct (mockups PB_1–PB_5, PF_1–PF_3): product form reorganised in sections (Basic /
Identification / Price / Specifications / Notes, image on the right with Replace / Remove and Uploading / Uploaded state,
window only as tall as its content; Service hides brand / model / image); Ctrl+V pastes a copied image; product view gets
"Usage & price history" (documents list from loaded data — no extra reads; "Show older" on request; last bought / sold,
average, margin). Musthafa reported the product image not showing until the form is reopened — check when building.
Agreed 31 Oct for Step B1: full change history on customers / suppliers / products — every field change (who, when, field,
old → new; image / specs as "changed"), saved in the same write inside the record (changeLog, last 100), shown in a
History tab on the view screen. Unit change on a used product asks first (issued documents keep the old unit); refused
while the product has stock. Package B is built in two steps: B1 product master (Type / SRV codes, new form, Ctrl+V,
image fix, product view with usage & price history, change history), B2 linking (markers, Sent reminder, SO required,
wording memory, several quotations → one SO).

## V270.4.10 — Package B Step B1: product master (31 Oct 2026)
Goods / Service (ITM / SRV sequences, type fixed once coded), product form in sections (PF_1/PF_2), image shown at once,
Ctrl+V / drop, image bug fixed (empty src + global "hide broken images" handler), category kept on edit, product view
with documents / price history / change history (PF_3, no extra reads; Show older on request), change history on
customers / suppliers / products (every field, same write, last 100), unit change check (refused with stock).
Details: docs/V270_4_10_PRODUCTS_B1.md. Next: Step B2 (linking: markers, Sent reminder, SO required, wording memory,
several quotations → one SO), then the service guideline in the manual's Quotation section.

## V270.4.11 — Package B Step B2a: linking (31 Oct 2026)
Quotation line markers + link window (js/item-link.js), Mark as Sent reminder (edit screen and view status), Create
Sales Order requires links for ordered lines (earlier order's link kept), customer wording memory on the customer
record (customers.wordings, no rules change). Service guideline written in the manual's Quotation section (asked by
Musthafa). Test harness option requireLinks (old tests run without the requirement). Details:
docs/V270_4_11_LINKING_B2A.md. Next: Step B2b — several quotations → one Sales Order (PB_5): lines keep their source
quotation / price / cost, header lists all quotations, first quotation's terms with a note, VAT rate / currency must match;
check every place that uses so.quotationId (progress, DN, invoices, registers, SO view).

## V270.4.12 — Package B Step B2b: categories & units for services · several quotations → one SO (31 Oct 2026)
Master Data → Categories (goods / services, sharedSettings/categories — RULES CHANGE, emulator tests first), units
"Used for" + suggested service units, product form lists by type, quotation scope lines use Services units; Sales Order
from several quotations of the same customer (quotationIds, line quotationId / qIdx, origIdx blocks of 10000).
Details: docs/V270_4_12_CATEGORIES_MULTIQUOTE.md. Package B complete. Next agreed: DN Return Note (step 2), Cash & Bank
step 3, V270.5 Company foundation.

## V270.4.13 — Categories / Units screens tidied + Merge into… (31 Oct 2026)
See docs/V270_4_13_MASTER_TABLES.md (mockups CM_1–CM_3 approved; regular-weight text — Musthafa: "don't use heavy fonts").

## V270.4.14 — Service quotations, formatted descriptions, Cost 🔒 column (31 Oct 2026)
See docs/V270_4_14_SERVICE_QUOTES.md (mockups SQ_1, SQ_2, RT_3, DQ_1; decisions a–g). One Services template: lines linked
to SRV items or made a scope line (⋮ menu, free text); formatted scope / note text (Format bar above the table header,
js/quote-rich.js; plain text with layout kept in desc / text for SO, DN, Invoice); internal Cost column on every
quotation (js/quote-cost.js; Show cost per user; Sent → cost reminder, approval below the minimum margin as Pricing,
kind 'quotation'); costs go to the SO estimate and the product's estimated price. **Rules changed (approvals kind) →
RUN_EMULATOR_TESTS.bat first.** Not uploaded yet.
V270.4.14.1 (31 Oct): a Service RFQ's Pricing opens a Service quotation; lines always follow the template (product-shaped
lines on a Service quotation rebuilt), locked template can't be switched by a click; wider service unit box.
V270.4.14.2 (31 Oct): Format bar engine — colour / size / highlight back and forth, Tab / ⇥ ⇤ indent in lists and lines,
Clear formatting; every button tested (docs/V270_4_14_SERVICE_QUOTES.md).

## NEXT CHAT — start here (31 Oct, after V270.4.14)
1. Ask Musthafa: V270.4.9 – V270.4.14.2 uploaded? Emulator tests run and rules published? Try on PC / iPad / iPhone: a
   long service quotation with formatting (Format bar, paste from Word), print / PDF (long line over two pages), Cost 🔒
   column + Show cost, Mark as Sent reminders, approval by a non-administrator.
2. **Cash & Bank step 3** (receipts → Payment Accounts, cash receipts confirmed by the custodian) — write the choices down
   for his OK first (discuss, mockups before code).
3. Then: Delivery Note return flow (step 2); V270.5 Company foundation (Fast Fix).
Also open: the old browser test step `dn-workflow` 9 (fails since V270.4.5 — offered to investigate); Sales Order view
estimate / profit reads only the first quotation's pricing for multi-quotation orders (lines with their own quotation
cost are fine since V270.4.14); sw.js lists a few older ?v= numbers that differ from index.html (numbering-controls.css,
delivery-core / ledger-service / account-service / numbering .mjs) — harmless, tidy when convenient.
Agreed small follow-ups (not built): none.
User manual (Claude Docs "BizCore User Manual", https://claude.ai/artifact/G79ZKMYKYWxHaPPUjsx1du): Quotation section
updated for V270.4.14; pending sections: RFQ, Pricing, rest of Sales Order, Purchasing, Stock, Cash & Bank,
Administration.
