# BizCore V264: Invoices, Advances and Credit Notes (Phase 2, steps 2–5)

**Status (12 Oct 2026):** built and tested here (simulator + real browser). **Not yet deployed.** Not yet run against the Firebase Emulator (that runs on your PC) and not yet run against the live database.

Design reference: `PHASE2_INVOICING_AND_LOCKING_DESIGN.md` (sections 2–5, deduction setting, hard rules, KSA layout).

## What changes for users

### Three kinds of invoice, created from the Sales Order ("Create invoice")
| Type | What it bills | Limit per line | Notes |
|---|---|---|---|
| **Delivery invoice** | Goods the customer accepted | accepted − already invoiced | Always allowed |
| **Order invoice (bill ahead)** | Goods not yet delivered / accepted | ordered − already invoiced | Reason required. Who may issue it: Billing Settings |
| **Advance invoice** | A down payment: % of the order, % of selected lines, or the full order value | — | 15% VAT. Who may issue it: Billing Settings |

- Each invoice is its own document (`customerInvoices`), with its own number (INV-YYMM-####, same counter as before) and an audit event.
- **Advance deduction.** Later goods invoices show "Less: advance INV-… dated …". How much is deducted is set in Billing Settings:
  - **Automatic proposal, editable** (default): the advance % applied to each invoice. For example, with a 50% advance, half of each invoice's goods value is deducted.
  - **Automatic, fixed**: the same proposal, but the user can't change it.
  - **Manual**: the user enters the amount, within the allowed range shown on screen.
- **Hard rules (whatever the setting):**
  1. The customer is never billed more than the order value (before VAT).
  2. A deduction never exceeds the advance remaining or the invoice's goods value.
  3. The invoice that completes the order deducts the whole remaining advance (the field is locked).
  4. Only the part of an advance that hasn't been deducted yet can be credited.
  5. An accepted quantity can't be reduced below what delivery invoices have billed (from V262).
- **Your example:** 50% advance (600 + VAT) then a 100% invoice (1,200 goods − 600 advance = 600 + VAT). The total billed equals the order.

### Credit notes (`CN-YYMM-####`)
- **Where:** from the invoice card in the Sales Order or from the invoice view.
- **Goods invoice:** credit chosen quantities. The advance deducted on that invoice is given back in proportion, so it can be deducted again later.
- **Advance invoice:** credit an amount, at most the part not yet deducted.
- **The invoice itself is never changed:** it shows "Partly credited" / "Credited" and lists its credit notes.
- A reason is required. Who may issue credit notes is set in Billing Settings (administrators or all users; it can't be switched off).

### Sales Order view
The invoice history shows:
- a billing summary: order value, goods invoiced, advances, advance remaining, net billed and still to bill,
- one card per invoice with its type, status, deduction lines and credit notes.

### Sales → Invoices
Now a register of all invoices and credit notes, with search, type filter and totals (the page was a placeholder before).

### Print
- **Invoice and credit note:** a printable copy with company header, lines, the "Less: advance INV-… dated …" lines and the VAT totals.
- **Official tax invoices:** Zoho Books still issues these. The Zoho number field is kept.

### Administration → Security → Billing Settings (new)
- **Settings:**
  - deduction method,
  - who may issue order invoices / advance invoices (all users, administrators only, or nobody),
  - who may issue credit notes (all users or administrators only).
- **Default:** automatic, editable proposal; administrators only for the rest.
- **Where they're stored:** `settings/billing`. Every change is logged in `settings/billing/changes`. Only administrators (`system/accessControl.adminUids`) can change them.

### Busy overlay
Opening an order action shows a "working" overlay. It also ignores a second click while the order is being locked and reloaded.

### V264.6 screen improvements
- **Create invoice, step 1** is a compact dialog: the three types are radio rows with the amount available for each on the right.
- **One busy overlay** covers the whole opening (lock, reload, invoice balances), so the order screen no longer shows in between.
- **Create Invoice on the Delivery Note.** Shown when the DN is accepted and accepted goods are still uninvoiced. It opens a delivery invoice directly at step 2, prefilled with that DN's accepted quantities (within what is still uninvoiced).
- **Invoice / credit note view** now has the same layout as the Delivery Note and Quotation views: A4 document on the left, a panel (summary, document flow, activity) on the right, and an action bar (Close, Sales Order, Credit Note, Print / PDF). Invoices use a teal accent and credit notes a red one, so they're easy to tell apart. Print / PDF uses the same A4 document.

### V264.7 changes
- **Zoho invoice number is mandatory and unique.** It's checked in three places:
  - **Screen:** shows "Already used on INV-…". Case and spaces are ignored.
  - **Invoice service:** one transaction.
  - **Security rules:** each invoice claims `invoiceZohoNumbers/{key}` in the same commit. That document can never be changed or deleted, so a number can be used only once, even by two users at the same moment.
- **Second confirmation before saving** an invoice or credit note. It shows a summary; "Go back" saves nothing.
- **After saving,** the invoice or credit note opens in its display screen. Back returns to the Sales Order.
- **Entry footers explain a disabled Save button.** They show a checklist: "To continue: ① Invoice quantity ② Zoho invoice no.", or "Quantity to credit / Reason".
- **Totals block on the invoice / credit note document** uses the Quotation style: white bold total on the teal (invoice) or red (credit note) bar.
- **Desktop-style spinner** (small up/down arrows inside the field) on quantity fields: Create Sales Order, Create Delivery Note (dispatch), Correct Dispatch, Create Invoice, Credit Note, and the previous (legacy) invoice screen.
- **Deployment order:**
  1. Run `npm run test:emulator` on the PC (23 tests).
  2. Upload the app.
  3. Publish `firestore.rules` right after.
  
  Between steps 2 and 3, invoices can't be saved (refused, nothing partial is written).

### V264.8 Back / close navigation
- **The bug:** a screen opened within about 1 second of another screen closing recorded that closed screen as its "Back" target. After an invoice was saved, the refreshed Sales Order therefore pointed back to the already-saved Create Invoice form, and closing the Sales Order reopened it. Credit notes had the same problem.
- **The fix:** the entry forms of the order workflow are never Back targets once they close (saved or cancelled):
  - Create SO,
  - Dispatch,
  - Delivery Confirmation,
  - Correct Dispatch,
  - Create Invoice,
  - Credit Note,
  - Payment,
  - legacy Invoice.
- **Test:** `tests/browser/navigation.e2e.mjs` checks the close sequence of 11 flows.

### V264.9 Sales Order view stays current
- **The bug:** the Sales Order view stays open underneath the screens opened from it (Delivery Note, invoice …), but it wasn't redrawn after a save. After dispatching or confirming a delivery, closing the Delivery Note showed the old figures until the order was closed and opened again.
- **The fix:** the open Sales Order view is now redrawn in place (same order, same scroll position):
  - whenever order data changes, from a save here or another user's change arriving,
  - when a screen on top of it is closed.
- **Test:** `tests/browser/navigation.e2e.mjs` checks that the new DN, the confirmation and the payment appear without reopening.

### V265 Standard register screens
- **Monitors.** All six registers (RFQs, Pricing, Quotations, Sales Orders, Delivery Notes, Invoices) use the Delivery Monitor layout: dark header, a total row, STATUS / ATTENTION / PERFORMANCE sections, dot + label + count rows, and a blue bar on the active row. The per-status coloured tints were removed.
- **Filter bar.** Every register uses the same filter bar in the same order: [Sort] [count] … [Customer] [Status] [Date] [Search] [Clear Filters] [Export Excel where available]. Every control is 34 px high and uses 12.5 px text, with the same widths everywhere. The styles are in `css/register-standard.css`.
- **Filters added:**
  - Customer on RFQs, Pricing, Delivery Notes and Invoices.
  - Status on RFQs, Pricing and Sales Orders.
  - The Quotations Status filter was hidden; it is now visible.
- **Status and monitor stay in sync.** The Status filter and the monitor are one filter: picking a status highlights the monitor row, and clicking a row sets the Status filter. Exception: on Invoices, the monitor filters by type and Status by credit status.
- **Collapse fix.** The Delivery Monitor collapse button now works (it did nothing before).
- **Test:** `tests/browser/registers.e2e.mjs`.

### V265.2 Compact document views
- **Screens:** Quotation, Delivery Note, Invoice and Credit Note.
- **Window:** on screens 1200 px wide or more, the window is the A4 page plus a 300 px panel (max 1320 px), centred, with the app dimmed around it. Smaller screens stay full screen. The A4 page itself is unchanged.
- **Panel:**
  - **Invoice** — "Billing status": Invoice total, Credited, Net after credit, and Advance deducted (or, on an advance invoice, Deducted so far and Advance left). Then Status, Type, Payment due with the days left or overdue, Zoho no. and Created by.
    - A note says that payments are recorded on the Sales Order. Paid and balance per invoice need payment allocation, which is still open.
  - **Credit note** — "Credit status": Credit total, VAT credited, Invoice total, and the invoice net after all its credit notes. Then Against invoice, Reason and Created by.
  - **Quotation** — Internal information: Estimated cost, Gross profit, Margin and Valid for. Then Pricing reference, Revision and the internal note.
  - **Delivery Note** — the acceptance panel is unchanged, in the narrower column.
  - **All four** — the document flow is shown on one line of chips, and the activity as compact rows.
- **Buttons:** unchanged, at the bottom right.
- **Files:** `css/doc-view.css` (new) and the helpers `bcKpiGrid` / `bcFlowChips` / `bcActivityList` in `js/ui-standard.js`.
- **Test:** `tests/browser/doc-views.e2e.mjs`.

### V265.3 Delivery screens
- **Delivery Monitor:** the "Awaiting Delivery" row is removed. It could never count anything, because a Delivery Note only exists once goods are dispatched. "Awaiting Confirmation" is now **"Out for Delivery"** in the monitor and in the Status filter.
- **Delivered by** (Create Delivery Note, and Correct Dispatch):
  - The default is the signed-in user. You can pick any active employee, or choose "Someone else" and type the name.
  - It is stored on the DN as `deliveredBy`, `deliveredByType` (`staff` / `other`) and `deliveredByEmployeeId`.
  - The print / PDF shows a **DELIVERED BY** box with the name only. Older DNs without the field don't show the box.
  - Dispatch History shows the name and marks outside people as "outside". This is for staff only.
  - No change to the Firestore rules.
- **Confirm Delivery / Correct Confirmation / Revise Acceptance** — compact layout for tablet and phone:
  - one back button;
  - no security banner and no extra headings ("Signed in as …" is in the footer);
  - one row per item with large −/+ buttons;
  - reason and disposition only appear when something is rejected;
  - "Accept all";
  - Received by and Remarks on one line;
  - the reason box at the top for corrections. "Save Correction" stays inactive until a reason is entered, and changed lines show "was A / R".
- **Fix:** the screen checked the lines against the previously opened Delivery Note. That caused the false "1 Invalid" chip, and in a correction it could validate against the wrong DN.
- **Fix (V265.4):** Delivery Confirmation opened from the Delivery Note screen showed "Could not open Delivery Confirmation" first and then opened. The button checked before the lock had finished opening the screen. It now waits.
- **Tests:** `tests/browser/delivery-compact.e2e.mjs`, plus a service unit test. The parity test ignores the three new fields and checks everything else exactly.

### V265.5 Deliveries screen and the Delivery Note view on phone / tablet
- **Deliveries** (new sidebar item, with a count; direct link `index.html#deliveries`):
  - Lists only Delivery Notes that are Out for Delivery, as cards, oldest first, grouped Earlier / Today.
  - Each card shows the customer address (from the customer record), the number of items, the SO, the dispatch date and who delivers it.
  - The age badge is green today, amber after 1 day and red after 2 days or more.
  - **Mine / All:** Mine means "Delivered by" is the signed-in user, matched by employee ID or name. Mine is the default when the user has any; the choice is remembered in the browser.
  - **Search** by DN number, customer, SO or PO.
  - **View** opens the Delivery Note. **Confirm delivery** opens the compact confirmation; after saving you return to the list, the card disappears and the count goes down.
  - **Scan QR** reads the QR printed on the DN (`?delivery=<token>`, older `?dn=<id>`), or you can type the DN number. It uses the browser's QR reader where available, otherwise jsQR 1.4.0 from jsdelivr. Camera access needs HTTPS or localhost.
  - No new Firestore data or rules.
- **Delivery Note view below 900 px:**
  - Two tabs: **Details** (customer, address, tap-to-call contact, references, items with large quantities, remarks, acceptance) and **Document** (the A4 page at its real size, scaled to the screen width).
  - The phone opens on Details and the tablet on Document.
  - The action bar shows ⋯ More, Delivery Confirmation / View Acceptance and Print, plus Close on a tablet. Everything else is in the More sheet: Sales Order, Dispatch History, Correct Dispatch, Create Invoice, Void and Close.
  - The desktop view is unchanged.
- **Files:** `js/deliveries.js` (new, loaded after app.js) and `css/delivery-compact.css`.
- **Test:** `tests/browser/deliveries.e2e.mjs`.

### V265.6 Deliveries fixes
- **Live list:** a DN confirmed on another device now disappears from an open Deliveries screen at once, and the sidebar count updates. The real-time listeners call `bcDeliveriesRefresh`.
- **QR scan:** the printed QR is `delivery.html?t=<token>`; the scanner now reads that format (it only knew `?delivery=`).
- **Confirmation checks:**
  - Missing "Received by", a missing reason, or a wrong line quantity now uses the standard validation dialog.
  - The check runs before the busy overlay, so the screen no longer flashes.
- **Start on Deliveries:** a tick box "Open Deliveries when BizCore starts on this device" is stored in that browser only.
  - `#deliveries` now survives the sign-in page.
  - The sign-in page only returns to a BizCore page, never to another website.
  - The app manifest has a "Deliveries" shortcut (Android: long-press the icon).
- **Layout (Design 1):** each group (Earlier / Today) sits in its own white box with an amber or green top line and a count, with the same cards as on the phone inside.

### V265.7 Deliveries on phones
- **Loading state:** until the data has arrived, the screen shows "Loading deliveries…" with placeholder cards. It used to say "Nothing is out for delivery" for 8–12 seconds.
- **Faster start:** the Delivery Notes now load at the same time as the other data, instead of after all of it.
- **Back to the screen:** when the phone shows the page again (unlocked, or switched back from another app), the list refreshes at once.

## How it is enforced
| Layer | Check |
|---|---|
| Screen | Shows only what Billing Settings allow. The screen previews the result with the same rules as the server |
| Invoice service (`js/invoice-service.mjs`) | **One transaction** reads the Sales Order, ledger, Billing Settings, administrator list, order lock and number counter, then writes the counter, ledger, invoice and event together. It re-checks every limit and permission on the server copy. A retry from the same screen never creates a second invoice |
| Security rules | **Invoices:**<ul><li>created only while invoices are independent,</li><li>only by the holder of the order lock,</li><li>only for permitted types,</li><li>only together with a new event and a matching ledger write.</li></ul>**Issued figures are immutable.** Only credit bookkeeping can change, and nothing can be deleted.<br>**Credit notes:** follow the same rules.<br>**Ledger writes:**<ul><li>Delivery Note writes can't touch `billing`.</li><li>Invoice writes must be coupled to an invoice event.</li></ul>**Sales Orders:** can't embed invoices after the cutover, and can't change embedded invoices during the migration |

## Data
| Collection / document | Content |
|---|---|
| `customerInvoices/{id}` (+ `invoiceEvents/{id}`) | type, lines, deductions, advance, totals, credited, creditNotes[], status, revision |
| `creditNotes/{id}` (+ `creditNoteEvents/{id}`) | invoice reference, lines or advance amount, deduction reversal, totals, reason |
| `salesOrderFulfillment/{soId}` | Delivery fields unchanged, plus: <ul><li>`lines.*.invoicedDelivery` / `invoicedAhead`</li><li>`billing.goodsValue`</li><li>`billing.advances.{id}` with subtotal, deducted and credited</li><li>`lastInvoiceId`</li></ul> |
| `settings/billing` (+ `changes`) | Billing Settings |
| `system/invoiceStorage` | `mode`: legacy → migrating → independent (set only by the migration tool) |
| `invoiceZohoNumbers/{key}` (V264.7) | one per Zoho invoice number: `zohoNo`, `invoiceId`, `invNo`, `soNo`. Create-only |

## Migration of the existing (embedded) invoices
**Tool:** `tools/dn-migration` (same as V260), new commands:

| Command | Writes? | Purpose |
|---|---|---|
| `invoice-status` | no | Counts of embedded and independent invoices, and the current mode |
| `invoice-preflight` | no | Plan + blockers (unlinked line, over-invoiced line, duplicate number, Delivery Note migration not done) |
| `invoice-migrate --backup … --confirm …` | yes | Freezes invoices (mode = migrating) and writes the invoice documents, events and ledger billing figures. It is idempotent and verifies at the end |
| `invoice-verify` | no | Re-plans and compares |
| `invoice-cutover --backup … --confirm …` | yes | Verifies, removes the embedded copies from the Sales Orders (still in the backup), and sets mode = independent |
| `invoice-unfreeze --confirm …` | yes | Before cutover only: removes what invoice-migrate wrote and returns to legacy mode |

- **Original numbers, dates and amounts are kept;** nothing is re-priced.
- **How each old invoice is classified:**
  - **delivery invoice:** if its quantities were covered by accepted deliveries,
  - **order invoice:** otherwise, with the reason "Migrated: billed before delivery acceptance was recorded".
- Very old full-order invoices (no lines) become an order invoice for every line.
- **Payments stay on the Sales Order,** unchanged.

## Deployment steps (each live step needs your go-ahead)
1. **Emulator tests on your PC.**
   - Folder: `C:\BizCore\v264\BizCore_v264`.
   - Command: `npm run test:emulator`.
   - Expected: 20 tests, all pass (the earlier 14 plus 6 new invoice tests).
2. **Upload the app (V264) to GitHub Pages.**
   - With no `system/invoiceStorage` document, it works exactly like V263 (embedded invoices, the previous invoice screen).
   - Check the site loads and normal work is fine.
3. **Publish the security rules.**
   - Save the current rules to `C:\secure\rules-before-v264.txt` first.
   - Then paste `firestore.rules` into the Firebase Console and click Publish.
4. **Migrate invoices.** This needs a new service-account key in `C:\secure\`. Delete it afterwards.
   ```
   cd C:\BizCore\v264\BizCore_v264\tools\dn-migration
   npm install
   node cli.mjs backup            --project bizcore-downtown --credentials C:\secure\bizcore-sa.json --out C:\secure\bizcore-pre-v264.json
   node cli.mjs invoice-preflight --project bizcore-downtown --credentials C:\secure\bizcore-sa.json
   node cli.mjs invoice-migrate   --project bizcore-downtown --credentials C:\secure\bizcore-sa.json --backup C:\secure\bizcore-pre-v264.json --confirm bizcore-downtown
   node cli.mjs invoice-cutover   --project bizcore-downtown --credentials C:\secure\bizcore-sa.json --backup C:\secure\bizcore-pre-v264.json --confirm bizcore-downtown
   ```
   - Open BizCore: it reloads into the new invoice screens.
   - In Administration → Billing Settings, choose the settings.
5. **Check on the live site:**
   - an advance invoice,
   - a delivery invoice with a deduction,
   - a credit note,
   - the Invoices register.

**Rollback:**
- **Before step 4's cutover:** `invoice-unfreeze`.
- **After the cutover:** `restore --backup C:\secure\bizcore-pre-v264.json --all-collections`, then set `system/invoiceStorage` back to legacy, then use V263 rules.

## Tests
| Suite | Result here |
|---|---|
| Unit + service + migration (`npm test`) | **67/67 pass** — including 10 invoice-core, 8 invoice-service and 5 invoice-migration tests |
| Real browser, simulator (`npm run test:browser`) | **18/18 pass** (7 scenarios) — includes the new invoicing flow: advance → delivery invoice with deduction → final order invoice → credit note → print → register → Billing Settings permissions → paused during migration |
| V259 parity (`npm run test:parity`) | pass |
| Firebase Emulator (`npm run test:emulator`, `tests/emulator/invoices.test.mjs` new) | **not run here** — run on your PC |

## Open points
- **Accountant to confirm:** the VAT treatment of advances (tax invoice at 15% on receipt; deduction at the same rate on the final invoice). This is the KSA practice described in the design.
- **Payments:** they are still recorded against the order total (unchanged). Allocating payments to individual invoices is a later step.
- **Credit notes and stock:** a credit note does not change delivery records. If goods come back, record it on the Delivery Note.
- **Test-data clean-up (reminder):** delete the old product images and upload them again.
