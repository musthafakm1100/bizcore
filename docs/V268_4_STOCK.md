# V268.4 — Purchasing → Stock (Allocate to Order)

Built from the approved mockups ST_1 – ST_4 (18 Oct 2026). Musthafa chose the words **Allocate** and **Open Demand**.

## Screens
- **Purchasing → Stock** (`#page-stock`, js/stock.js). It uses the same register standard as Receipts: monitor, filter bar, date filter (last bought), table and phone cards. A browser test compares its look with Receipts.
  - **Monitor:**
    - Status: in stock, used up.
    - Attention: open demand, in stock over 90 days.
    - Figures: stock value, and "could go to orders" (open demand × average cost, up to what is in stock).
  - **Columns:** item, unit, in stock, average cost, value, last bought (PI · date · supplier), open demand (sales order chips) and the **Allocate** button.
  - The **Movements** button lists every stock movement, the latest first.
- **Item screen:**
  - Tiles: in stock, average cost, value, open demand.
  - **Movements** with their running balance: bought, invoice changed or cancelled, allocated to order, allocation cancelled. An allocation has a Cancel button.
  - **Open demand:** the open sales order lines for the same item, each with an **Allocate N** button.
  - "Stock Count" is shown for later; it is not active.
- **Allocate Stock to a Sales Order:**
  - Choose the order line; the quantity is limited to what the order still needs and what is in stock. Add a date and an optional note.
  - The result is shown before saving: whether the line becomes Complete, how the stock changes, and the cost at the average cost. Selling and P/L are shown only to the roles allowed in Administration.
  - No money moves.

## Data
- `stockAllocations/{SA-…}`:
  - item: itemKey, desc, uom;
  - order: soId, soNo, customer, soLineId;
  - figures: qty, unitCost (the average cost at that moment), value, sellUnit;
  - date, note;
  - status: Posted / Voided (cancelled with a reason).
- `salesOrderPurchasing/{soId}.lines[line]`: `purchased` goes up by the allocated qty, and `fromStock` keeps the part that came from stock. Purchase invoices keep `fromStock` when they change the line.
- `stockItems/{key}`: qty and value go down at the average cost. When the qty reaches 0, the value is 0.
- `stockMovements`: `allocated` (−qty) and `allocation-cancelled` (+qty), with the allocation, the order and the user.

## Rules (firestore.rules) — publish after the emulator tests pass
- New `stockAllocations`:
  - create only together with the stock and the order's purchased qty, each moving by exactly the allocated quantity;
  - cancel only with a reason, and everything goes back.
- `stockItems`, `salesOrderPurchasing` and `stockMovements` also accept a change that comes with a new allocation event.

## Tests
- Unit: tests/stock.test.mjs (3).
- Browser: tests/browser/stock.e2e.mjs.
- Emulator: 1 new test in tests/emulator/purchases.test.mjs.

## Not in this step
- Stock count / adjustment.
- Showing "from stock" on the sales order screen (the figure is stored, ready to show).
- Warehouses.
