# V269.3 — Data plan step 2b: purchasing, stock and cash load only open + recent; running balances; last prices

Built 19 Oct 2026 with the choices Musthafa approved ("All you suggested choices"). **Rules change — run the emulator
tests on the PC, then publish the rules, then upload.** Includes the V269.2.1 fix (open-order mark, below).

## What loads when BizCore opens (same 12 months as V269.1)
| Records | Always loaded | Plus |
|---|---|---|
| Purchase invoices | Unpaid / Part paid | dated in the last 12 months |
| Supplier payments | advances with something left | last 12 months |
| Cash & bank lines | ⏳ waiting / ⚠ queried | last 12 months |
| Purchased quantities per order | for every loaded Sales Order | changed in the last 12 months |
| Stock allocations, stock item changes | — | last 12 months |
| Stock items, purchase settings, payment accounts | all (small) | |
Linked records come along (an invoice's payments, a payment's invoice and cash lines, …). Older ones are read when
opened (a purchase invoice or payment link), "Show older lines" in Cash & Bank, a statement for an older period.

## Running balance per account — `cashBalances/{accountId}`
- Kept up to date **in the same save** as the cash line (handover, edit, cancel, confirm, query, supplier payment,
  cash back, advance — from BizCore and from My Cash). Moves with `increment()`, so a custodian handing cash to someone
  else never needs to read the other account.
- Cash & Bank shows the recent lines and a **Brought forward** row (balance before the loaded period) with
  **Show older lines**; Waiting / Queried also show older waiting lines (without a running balance). The balance, the
  confirmed balance and the account list are the same as before.
- When BizCore opens (staff), an account with lines but no complete record is **rebuilt** once from all its lines
  (`rebuiltAt`). Administration → Data Health → *Running balances and last prices* shows each account and has
  **Rebuild balances** (only needed if a balance looks wrong).
- Statement: a period before the loaded lines reads the older lines first.

## Last price per item — `itemLastPrices/{itemKey}`
- Written with every purchase invoice save (new, edit, cancel). "Last paid" uses the newer of the loaded invoices and
  this record, so it no longer depends on which invoices are loaded. A cancelled invoice marks its price "stale"
  (the loaded invoices are used).

## Rules (firestore.rules = emulator/firestore.rules)
- `cashBalances`: staff read all; a custodian reads only his own account. Written by staff, or by a custodian only
  together with a line of that account in the same save and never as a rebuild. Fields and revision checked; no delete.
- `itemLastPrices`: staff only, fields and revision checked; no delete.
- `cashLines`: a custodian may look up a line that doesn't exist yet (needed when a handover creates the other line).
- Known limit: the rules can't check the amounts in a balance record; Rebuild corrects any difference.

## V269.2.1 (already uploaded) — open-order mark
Old test orders with an invoice saved inside them can't be changed under the rules; BizCore no longer tries to mark
them (and stops trying any order whose change is refused). Their data is not changed.

## Screens changed (small)
Cash & Bank: "Brought forward" row with "Show older lines" (phone: card). Data Health: one new card. Pictures:
V2693_cash_brought_forward.png, V2693_data_health_balances.png.

## Files
index.html, sw.js (bizcore-shell-v2693), mycash.html, js/running-totals.mjs (new), js/ledger-core.mjs,
js/ledger-service.mjs, js/cash-ui.js, js/cashbank.js, js/purchases.js, js/supplier-payments.js, js/data-safety.js,
js/app.js (V269.2.1), firestore.rules, emulator/firestore.rules.
Tests: tests/running-totals.test.mjs, tests/browser/running-totals.e2e.mjs, tests/emulator/running-totals.test.mjs (new).

## Going live
1. On the PC: RUN_EMULATOR_TESTS.bat — all must pass (new: running-totals.test.mjs).
2. Publish firestore.rules (Firebase console → Firestore → Rules).
3. Upload the files above (everything except the tests and emulator/).
4. Open BizCore once as staff: the balances are built in a few seconds (Data Health shows "Up to date").
