# BizCore Phase 2: Invoicing, Credit Notes & Document Locking — Design

**Status:** design agreed in discussion (11 Oct 2026). **Step 1 (document locking) built as V262** — see `V262_DOCUMENT_LOCKING.md`; **steps 2–5 (invoices, advances, credit notes, Billing Settings, migration) built as V264** — see `V264_INVOICING.md` (tested here; not yet deployed).
**Builds on:** V260 Delivery Note architecture (separate documents, immutable events, `salesOrderFulfillment` ledger, Firestore transactions, security rules).
**Goal:** remove the last part of the Sales Order that is still embedded and rewritten from the browser (invoices; payments later). Make concurrent work by several users impossible to corrupt. Support the real billing practices of Downtown Trading Est.

---

## 1. Document locking (ERP-style)

### 1.1 Behaviour
- **One lock per Sales Order.** It covers every action that changes the order or anything attached to it:
  - editing the SO,
  - dispatching, correcting or voiding a DN,
  - confirming or correcting an acceptance,
  - creating or cancelling an invoice, advance invoice or credit note.
- **The lock is taken when an action dialog opens**, not when viewing. It is released on save, cancel or close.
- **Fresh data:** the dialog loads the latest data from the server when the lock is granted.
- **Other users** see who holds the lock, what they are doing and since when, for example: "SO-2610-0012 is being worked on by Musthafa (Correcting acceptance, DN-2610-0005) since 10:42". **Viewing and printing are never blocked.**
- **Heartbeat** while the dialog is open. The lock expires automatically if the browser stops responding (crash, power cut, closed).
- **Idle warning**, then automatic release after inactivity. Unsaved entries in that dialog are lost.
- **Force release** from the Locks screen, with a mandatory reason. It is logged, and the original holder's save is then refused.

### 1.2 Enforcement
- **Security rules refuse** any write to an order's DNs, events, ledger, invoices or credit notes unless the writer holds an unexpired lock on that order.
- **A fixed maximum lock validity in the rules** (outer safety cap), whatever the settings say.
- **Existing checks remain** as a second line of defence: ledger quantity checks, document revision checks and idempotent operation IDs.

### 1.3 Administration → Document Locking (settings, not hard-coded)

| Setting | Default | Range |
|---|---|---|
| Idle time before release | 15 min | 5–120 min |
| Idle warning before release | 2 min | 1–5 min |
| Expiry when browser stops responding | 2 min | 1–10 min |
| Lock Sales Orders (+ DNs, invoices, credit notes) | On | Always on |
| Lock Quotations | On | On/Off |
| Lock RFQs | On | On/Off |
| Who can force-release | Administrator | → role permission later |

- Settings are stored in the database and apply to locks taken after a change.
- Every settings change is logged (who, what, when).
- The existing quotation and RFQ locks (today a hard-coded 30-minute idle) move to these settings.
- **Locks screen:** active locks, holder, activity, since; **Release** button (reason required).

## 2. Invoice types

| Type | What is billed | Limit per line | Notes |
|---|---|---|---|
| **Delivery invoice** (normal) | Accepted goods | accepted − invoiced | Default type |
| **Order invoice** (billing ahead) | **Chosen** lines and quantities of the order, delivered or not | ordered − invoiced | Reason required; permission controlled. The quantity not yet accepted is tracked as **"Invoiced, delivery pending"** |
| **Advance invoice** (down payment) | An **amount**, calculated as: a **percentage of the order**, a **percentage of selected line items**, or the **full order value** | Total advances ≤ order value (or ≤ selected lines' value) | Not a quantity. Deducted on later invoices (§2.2) |

### 2.1 Order invoice (billing ahead)
- The user selects lines and enters quantities: part or all of the undelivered quantity.
- Later deliveries of that quantity **do not** create a new invoice. They reduce "delivery pending".
- Order reports show **Invoiced, delivery pending** per line, so you can see what is still owed to the customer.

### 2.2 Advance deduction
- Later delivery/order invoices on the same SO show the advance and **deduct** it.
- **How the deduction is proposed is an Administration setting** (Administration → Billing Settings → *Advance deduction method*), not hard-coded:
  - **Automatic, proportional — editable** *(default)*: BizCore proposes the advance share of each invoice (e.g. 30 % advance → 30 % of the invoice value is deducted); the user may change it.
  - **Automatic, proportional — fixed**: same calculation, the user cannot change it (strict control).
  - **Manual**: no amount is proposed; the user enters the deduction on each invoice (0 allowed).
- Whatever the method, these **hard rules** (enforced in the transaction and by the security rules) keep the books correct — the setting only changes what is *proposed*, never what is *allowed*:
  1. **Never bill more than the order:** total of all invoices' net amounts (goods invoiced − advances deducted + advances invoiced) can never exceed the order value.
  2. A deduction never exceeds the advance still remaining on the order, nor the value of the invoice it is on.
  3. **Final invoice clears the advance:** an invoice that brings the order to 100 % invoiced *must* deduct all remaining advance (cannot be saved otherwise).
  4. An advance invoice that has already been (partly) deducted cannot be credited/cancelled beyond the undeducted part.
- Worked example (order 10,000 + 15 % VAT): advance 50 % → 5,000 + 750 VAT. Later invoice for 100 % of the goods → 10,000 − advance 5,000 = 5,000 + 750 VAT. Customer pays 5,750 + 5,750 = 11,500 = order total. With *Manual* method and the user entering 0, rule 3 refuses the save, so double billing is impossible.
- The setting is validated by the security rules, administrator-only, and every change is logged (same pattern as Document Locking).
- **KSA practice adopted for the documents** (to be confirmed with the accountant): the advance invoice is a full tax invoice with 15 % VAT ("Advance payment against SO-…"; in ZATCA e-invoicing a *prepayment* invoice). The later invoice shows the **full value of the goods**, then a separate **"Less: advance invoice INV-… dated …"** line with the **same VAT rate**, reducing taxable amount and VAT; the advance invoice number and date are always printed (in Zoho/ZATCA XML this maps to the prepayment reference and prepaid amount).
- VAT treatment of advances: **to be confirmed with the accountant** (in Saudi Arabia VAT on an advance is generally due when invoiced/received and the final invoice references and deducts it). ZATCA-compliant invoicing remains outside BizCore.

### 2.3 Permissions (Administration now → User Role Management later)
- **Allow order invoices (billing ahead):** All users / Administrator only / Nobody.
- **Allow advance invoices:** All users / Administrator only / Nobody.
- **Allow credit notes:** All users / Administrator only.
- When User Role Management is built, these become role permissions.
- The rules also enforce the permission, not just the screen.

## 3. Credit notes
- Reverse or reduce an issued invoice: full cancellation or chosen lines and quantities, with a reason.
- Reduce the "invoiced" quantities (or the advance amount) in the ledger in the same transaction.
- An invoice is never edited or deleted after issue. Corrections are always made by credit note plus a new invoice (audit trail).

## 4. Data model

| Collection | Content |
|---|---|
| `customerInvoices/{id}` | Type (delivery / order / advance), SO link, lines (lineId, qty, price, VAT), totals, advance deductions, status (issued / partially credited / credited), revision |
| `customerInvoices/{id}/events/{id}` | Immutable history (issued, credited…) |
| `creditNotes/{id}` | Linked invoice, lines or amount, reason |
| `salesOrderFulfillment/{soId}` | Per line: `inTransit, accepted, rejected` (existing), **plus** `invoicedByDelivery, invoicedAhead`. At order level: `advanceInvoiced, advanceDeducted` |
| `locks/{type:id}` | Holder (uid, name), activity, acquiredAt, expiresAt |
| `settings/locking`, `settings/billingPermissions` | Administration settings |

Invoice numbering uses the existing counters, inside the transaction, with no gaps from retries.

## 5. Rules enforced in every transaction (and by security rules)
1. **Total invoiced** (by delivery + ahead) for a line is never more than the **ordered** quantity.
2. **A delivery invoice** never exceeds the **accepted − invoiced** quantity.
3. **An acceptance correction, DN correction or void** can't reduce accepted below **invoiced by delivery**. The message tells the user to cancel the invoice or issue a credit note first. Quantity billed ahead doesn't block it; it stays "delivery pending".
4. **If goods billed ahead are rejected,** BizCore flags that a credit note is needed.
5. **Advances:** total advances ≤ order (or selected lines') value; total deductions ≤ total advances.
6. **The writer must hold the order lock** (§1.2).

All of these checks read and write the same ledger document in one transaction, so simultaneous actions are serialised by Firestore and re-checked with fresh numbers.

## 6. Migration
- Existing data is test data. Embedded `so.invoices` will be converted by the admin tool, using the same backup → preflight → migrate → verify → cutover steps, or cleared during the test-data reset.
- After cutover, rules block re-embedding invoices in Sales Orders.

## 7. Build & test plan
1. Locking: settings screen, lock service, rules, Locks screen; quotation and RFQ locks moved to the new settings.
2. Invoice service (delivery / order / advance), credit notes, ledger extensions, rules.
3. Invoice and credit note screens, printing, SO view (invoiced, delivery pending, advance balance).
4. Migration tool extension for embedded invoices.
5. Tests:
   - simulator (all rules in §5, concurrency),
   - browser (screens),
   - emulator (rules, locks, expiry, force release, permissions),
   - local rehearsal, then live deployment step by step with approvals.

## 8. Open points to confirm before building
- ~~Advance deduction~~ → decided: Administration setting (default *automatic proportional, editable*).
- **Advance VAT treatment:** confirm with the accountant.
- **Payments module:** same pattern later (`customerPayments` with allocations); not in this phase unless requested.
