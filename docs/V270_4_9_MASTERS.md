# V270.4.9 — Package A: master records without duplicates · system codes · safe import · today's date (31 Oct 2026)

Agreed with Musthafa on 30–31 Oct (mockups IM_1–IM_4). Cause of the doubled customers / products: the Import button
was pressed several times while saving, because nothing showed it was working.

## 1. Excel import (Customers, Suppliers, Products, Employees)
- **Review (IM_1)**: four tiles — Rows found · Ready to import · Repeated in this file · Already in BizCore / errors —
  with an amber list "Repeated in this file — only the first one is imported" and a red list "Not imported" (row, name, why).
- Same name = capitals, spaces and dots ignored ("Bnoon." = "BNOON"); products also ignore spaces ("3Pin" = "3 Pin").
  Customers / suppliers: the same VAT No. counts as the same company (in the file and against BizCore).
- **Importing (IM_2)**: one press only — the button, Cancel and ✕ are locked, "Importing… n / N" with a progress bar;
  the window can't be closed until it finishes. Needs a connection.
- **Done (IM_3)**: "N imported", what was left out, **Close** button.
- Each record gets a random unique id and its code in **file order**. A product / employee code column in an old file is
  kept as **Old code** (`oldCode`), not as the BizCore code.

## 2. System codes — CUS-00001 · SUP-00001 · ITM-000001 · EMP-0001
- Given by BizCore on the first save, from the numbering counters (`counters/doc_customer_all` …), in one transaction
  with the record: two users never get the same code. Never edited, never given again, one sequence for all companies.
- Shown inside BizCore only (form header chip, Customer / Supplier lists, search by code or VAT). **Not printed** on
  customer documents (DN / Invoice Item Code column hides system codes; a supplier's own code still prints).
- Offline: a temporary code (`…-OFF-…`), replaced by the real one when back online.
- Existing records without a code get one automatically when an administrator opens BizCore (sorted by name).
- Administration → Numbering shows a new **Master Data** group (prefix / digits can be set; reset is never).
- Product and Employee forms: the code box is read-only ("Given on save").

## 3. Customer / Supplier / Product forms
- Same or similar name (also "AK Investment Co." ~ "AK Investment Company"): amber notice under the name with
  **Open it** / **It's a different …**. Saving without answering asks once more. Names are never blocked.
- Same VAT No. as another customer (supplier): red message, Save refused — **also by the database** (`partyVat`
  claims + security rules), so two screens at the same moment can't both save it. A company may be both customer and supplier.
- Renaming a record used in documents, or changing a used customer's VAT No.: a confirmation ("issued documents keep
  the old name"); the change is kept in the record's history (`changeLog`). The duplicate check runs on rename too.
- Quotations and orders find their customer by id first (a rename doesn't break the link).

## 4. Today's date in Riyadh time
New documents defaulted to the **UTC** date (between midnight and 03:00 it was still yesterday). All "today" defaults
now use the device's local date (`bcLocalISO`). Quotation "valid until" was worked out in UTC and showed one day
early — fixed.

## 5. Delete selected (Customers / Suppliers / Products) — progress and speed (asked 31 Oct)
Pressing Delete selected showed nothing until the confirmation came, which took long: BizCore asked the database about
older documents one question at a time, 3–8 per record (≈ 300 for 50 customers), then moved the records one by one.
- A progress window opens at once ("Checking 50 customers…", then "Moving 50 customers to the Recycle Bin… n of N");
  the page is locked behind it and a second press does nothing.
- The check asks about up to 30 records per question, all questions at the same time (50 customers: 6 questions
  instead of ≈ 300 → seconds, and far fewer database reads). Same rules: a record used in documents is refused with
  the list of documents; two confirmations as before.
- The move to the Recycle Bin is one save for up to 400 records. If the connection drops, BizCore says how many
  were moved and the rest stay selected.

## Database / rules
- New collection **`partyVat`** (`customers_<VAT>` / `suppliers_<VAT>`), customers / suppliers create & update must
  hold their VAT claim; customers / suppliers / products / employees may not change a given code.
- **Run `RUN_EMULATOR_TESTS.bat` on the PC first** (new `tests/emulator/masters.test.mjs`); publish `firestore.rules`
  only when all pass. Upload the files and publish the rules together.
- No data change needed: existing customers keep working (an unchanged VAT No. needs no claim); Musthafa will wipe the
  customer and product test masters and re-import.

## Files to upload
index.html, sw.js (`bizcore-shell-v27053`), js/app.js, js/invoicing.js, js/purchases.js, css/main.css,
**js/master-service.mjs (new)**, **js/master-ui.js (new)**, firestore.rules (publish after emulator tests).

## Tests
- `tests/master-service.test.mjs` (unit): names, VAT, ids, codes in order / kept / temporary replaced, 4 saves at once,
  VAT claim / refuse / release / Recycle Bin.
- `tests/browser/masters.e2e.mjs`: code given to an old record; code chip; similar-name notice; VAT refused; "It's a
  different customer"; rename of a used customer (confirm, history, code kept); customer import (7 rows → 3 imported,
  2 repeated, 2 already in BizCore, pressed 3×, locked, can't close, codes in order); product import (Old code,
  ITM codes); system code not printed; today's date; delete selected (progress at once, used customer refused, the rest in one save).
- `tests/emulator/masters.test.mjs` (PC): VAT refused by the rules even bypassing the screen; claim can't be taken
  over or deleted while held; code can't be changed; 4 devices → 4 codes.
- Updated: numbering-format (15 rows / 3 groups), data-safety (+ New Product: code given by BizCore).

## Try
1. Administration → Numbering: Master Data group. Open BizCore as admin → customers get CUS-… codes.
2. New customer "AK Investment Co." when "AK Investment Company" exists → notice; give an existing VAT No. → refused.
3. Rename a customer used in a quotation → confirmation; old quotation PDF keeps the old name.
4. Wipe customers / products, import the Excel file, press Import → progress, then Close. Import the same file again →
   everything "Already in BizCore".

## V270.4.9.1 — Recycle Bin: Select all · Restore selected · Purge selected (31 Oct 2026, asked by Musthafa)
600+ records in the bin could only be restored / purged one by one.
- A tick box on every row and **Select all (n)** for the open tab (All / Customers / Products …).
- **Restore selected** (everyone who can restore) and **Purge selected** (administrators; two confirmations, can't be undone).
- A progress window ("Permanently deleting 600 records… n of 600"); up to 400 records per save.
- Restoring a customer / supplier / product whose VAT No. or name is now used by an active record: it stays in the bin
  and the reason is shown (also for the single Restore) — so a restore can't bring back a duplicate.
- "Empty older than 90 days" stays as before.
- Also: the "VAT No. already used" message showed "&amp;" for names with "&" — fixed (plain text).
Files: index.html, sw.js (`bizcore-shell-v27054`), js/app.js (?v=270.54), js/master-ui.js (?v=270.54), css/main.css (?v=270.54).
Test: tests/browser/masters.e2e.mjs step 8.
