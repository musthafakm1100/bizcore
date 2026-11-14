# Data plan, step 2 — Load only open and recent records (2a BUILT in V269.1 — docs/V269_1_DATA_WINDOW.md; 2b BUILT in V269.3 — docs/V269_3_RUNNING_TOTALS.md; 2c BUILT in V269.4 — docs/V269_4_DATA_PLAN_2C.md)

Written 18 Oct 2026 for Musthafa's approval. No code has been changed for this step.

## 1. Why
Today, every time BizCore opens (on every PC and phone) it reads **every record** in about 25 collections:
- loaded in full: quotations, RFQs, Sales Orders, customers, suppliers, products, employees, terms;
- listened to in full: delivery notes, customer invoices, credit notes, receipts, invoice payments, purchase invoices,
  supplier payments, purchased qty per SO line, stock items, stock allocations, stock changes, cash lines, payment
  accounts, approvals, shared settings, the delivery notification log (`operationalEvents`).

Firestore charges per record read. The free allowance is **50,000 reads a day**. After importing 3 years of history,
one opening may read several thousand records; a few users opening BizCore a few times a day can pass the free allowance,
and phones get slower to start. The size of each record is no longer a problem (V260, V264, V269) — this step is about
**how many** records are read.

The delivery notification log only ever grows and is read in full by every open BizCore.
BizCore also keeps a full copy of quotations, RFQs and Sales Orders in each browser (`dtq_*`, ~5 MB browser limit);
after the import that copy silently stops updating.

## 2. The idea
Each register keeps in memory only:
- **open records** — still in progress, whatever their age (see the table), plus
- **recent records** — dated in the last **12 months** (a setting in Administration).

Everything older stays in Firebase and is read **only when asked**: a date filter before the window, a search for a
number, "Show older", a profile's "All transactions", or a report for an older period.

| Register | "Open" means | Read when older |
|---|---|---|
| RFQs | not Quoted / No Bid / Closed | date filter, search by RFQ no. |
| Quotations | Draft / Sent (not Won, Lost, Expired, Cancelled) | date filter, search by Q no. |
| Sales Orders | not fully delivered **or** not fully invoiced **or** not fully paid | date filter, search by SO no. |
| Delivery notes | not confirmed / out for delivery | with their Sales Order |
| Customer invoices / credit notes | unpaid or part paid | date filter, search, customer statement |
| Receipts | with unapplied money | date filter, search |
| Purchase invoices | unpaid or part paid | date filter, search |
| Supplier payments | advances not fully used | date filter, search |
| Cash lines | waiting for confirmation or queried | statement for an older period |
| Stock items / allocations | quantity left / still allocated | — |

**Masters stay fully loaded** (customers, suppliers, products, employees, terms, payment accounts): they are hundreds,
not tens of thousands, and every screen needs them.

## 3. What has to change with it
1. **An "open" mark on each record.** Every save sets `isOpen: true/false` (worked out from the status). Firebase
   can then send "open ones" and "dated after the window" as two small queries.
2. **Balances that today add up every line ever saved:**
   - Customer outstanding and supplier payables come from unpaid invoices — these are always "open", so they stay correct.
   - **Cash / bank account balances** add up every cash line. With only recent lines they would be wrong. They need a
     **running balance record per account** (`cashBalances/{account}`), changed in the same save as each line
     (see decision 3).
3. **"In use" checks for masters** (can this customer / product / supplier be deleted?) today look through every
   quotation, RFQ and order in memory. With only recent ones loaded they could miss old records. They become **one
   question to Firebase** at the moment of delete ("is there any record with this customer / product?"). For products and
   suppliers inside lines, each record gets small `productIds[]` / `supplierIds[]` lists when it is saved.
4. **Last paid price** (Purchase Invoices) today looks through every purchase invoice. See decision 4.
5. **Dashboard and Reports** for a period inside the window work as today. A period older than the window (e.g. "Last
   year" in 2028, "All time") reads that period first, with a short "Loading…" (see decision 5).
6. **Registers' default date filter** becomes "Last 12 months" instead of "All" (the count line says e.g. "248 records ·
   last 12 months · Show older").
7. **Excel export** exports what the register shows; "Include older records" reads them first.
8. **Delivery notification log:** read only the last 7 days; entries older than 30 days are removed (decision 6).
9. **Browser copies (`dtq_*`)** of business lists are removed. Firebase's own offline cache (already switched on) keeps
   working offline for what was loaded. This also follows the rule "business data in Firebase, not the browser".

## 4. Cost after the change (rough)
Opening BizCore reads: masters + open records + the last 12 months. With your volumes that is a stable number that
doesn't grow with the years; the 3-year import then costs reads only when old records are actually looked at.
Data Health (Administration) gets a line "records read at start-up" so we can see it.

## 5. Tests (before anything goes live)
- Unit: "open" mark for every status of every document type; window cut-off dates (Riyadh time); running cash balance.
- Browser: each register with old + recent + open records (old open ones are shown, old closed ones are not); date filter
  before the window loads them; search by number finds an old record; delete of a customer / product used only by an old
  record is refused; cash balance correct with old lines not loaded; dashboard "All time" loads first; export with older.
- Emulator: rules for `cashBalances` (changes only together with a cash line; never edited by hand); notification log
  clean-up rule.
- Read count: a test that counts the records read at start-up with 3 years of sample data.

## 6. Decisions I need from you
1. **Window:** 12 months, changeable in Administration? My suggestion: **yes, 12 months**.
2. **Masters always fully loaded** (customers, suppliers, products, employees, terms)? My suggestion: **yes**.
3. **Cash / bank balances:** a running balance record per account, updated with every cash line? My suggestion: **yes**
   (it is also the base for the chart of accounts later).
4. **Last paid price:** (a) only from the last 12 months, or (b) a small "last price" record per item, updated with
   every purchase invoice, so it is never lost. My suggestion: **(b)**.
5. **Dashboard / Reports older than the window:** read on demand (a few seconds, costs reads each time) for now; monthly
   summary records can come later with the accounting reports. My suggestion: **on demand for now**.
6. **Delivery notification log:** read the last 7 days, remove entries older than 30 days (by the app, no admin step)?
   My suggestion: **yes**.
7. **Browser copies of business lists:** remove them (Firebase's own offline cache stays)? My suggestion: **yes**.
8. **Order of work:** build in three parts, each tested and uploaded on its own —
   **2a** sales side (RFQs, quotations, Sales Orders, delivery notes, invoices, receipts) + registers' default filter;
   **2b** purchasing, stock and cash (with the running balances and last price);
   **2c** notification log, browser copies, "in use" checks, Data Health read count.
   My suggestion: **yes, 2a → 2b → 2c**.

Old test records without the new "open" mark: as agreed, nothing is converted — they show when they are within the last
12 months, and the cleanup before go-live removes them anyway.

## 7. Size of the job
About **3 working sessions** (one per part). No change to how the screens look, except: the date filter starts at "Last
12 months", a "Show older" link on registers and profiles, and a short "Loading…" when older records are read.
