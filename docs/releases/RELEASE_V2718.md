# BizCore V271.8 — New Dashboard (approved mockup "E · Final direction", 12 Nov 2026)

Base: V271.7.6. Replaces the day-one dashboard. **No security-rule changes, no data migration** — nothing to publish in Firebase.

## What the Dashboard shows (top to bottom)

1. **Dark header** — greeting, date and one line of filters: **Activity** (All / Trading / Contracting), **‹ Period ›**
   (the standard date filter, design "A"; ‹ › step one month; default this month), **Customer**, **Salesperson** (shown
   when there is more than one record owner), **vs** (previous period / same period last year / none) and the
   **Clear filters** icon. Activity and "vs" are remembered per user (this browser).
2. **Needs attention** (live, not affected by the period): RFQs to price · Quotes awaiting reply · Orders to deliver ·
   Ready to invoice · Overdue receivables · Supplier bills due (Contracting: Jobs running). Each tile opens its register
   with the matching filter.
3. **Sales target ring** — Sales Orders + awarded jobs in the period, before VAT, against the target (On track /
   Behind / Target reached). **Set target / Change target** (users with Administration edit): one amount for every
   month, optionally a different amount for the month shown. Saved with the company settings (`settings/main`,
   `salesTargets`).
   **Gross profit** (only with the Special Right "See cost, margin and profit"; otherwise **Orders won**), **Collected**
   (payment receipts) and **Cash & Bank** (all accounts today), with 12-month trend lines and the change against the
   comparison period.
4. **Sales & gross profit** — 12 months, before VAT; the current month striped (month-to-date); months outside the
   period lighter. **Sales pipeline** — RFQs received in the period → quoted → won → delivered → invoiced → paid, quote
   win rate, average days RFQ → quote.
5. **Next 2 weeks** — deliveries due (expected delivery), customer invoices due, supplier bills due, quotes expiring,
   jobs' planned finish. Click an entry to open the document. Phone: a date list.
6. **Receivables** (by age, most overdue) · **Top customers** (click one to filter) · **Contracting jobs** (open jobs,
   work done %, planned finish).

Gross profit uses the same figures as the Sales Order's Profit tab: actual purchase cost where bought, otherwise the
pricing estimate / quotation cost / last price paid. A job counts with its planned profit.

## Roles

A card or tile is shown only when the role can view its module; cost and profit only with "See cost, margin and
profit". Records already follow "Own records only".

## Firebase reads (free allowance)

- Sales side: nothing extra — the dashboard uses what BizCore loads at sign-in.
- Jobs: read once per session (as the Jobs screen).
- Cash & Bank: only the payment accounts and their running balances (one small record per account) — new
  `BizCoreCash.startBalances()`; no ledger lines. The balance rebuild still runs only when a Cash screen opens.
- Purchasing (supplier bills) is **not** loaded by the dashboard: the tile shows **Show** until purchasing is loaded in
  the session.

## Files

New: `js/dashboard.js`, `css/dashboard.css`, `tests/browser/dashboard-v2718.e2e.mjs`.
Changed: `index.html` (dashboard markup, stylesheet, script, `startBalances`), `js/app.js` (`renderDashboard` → the new
module; shown on opening the page; loaded as `?v=271.8`), `sw.js` (cache `bizcore-shell-v2718`), `package.json`,
`tests/browser/v27048-pages-dates.e2e.mjs` (the old dashboard From / To boxes are gone; the new Period filter is in the sweep).

## Testing (my workspace, simulator — no live data)

- Unit tests: 150 / 150 pass. Browser tests: 100 / 100 pass (99 earlier + 1 new dashboard test).
- Checked at 1440 × 900 and on a 390 px phone (no sideways scroll).
- Nothing was deployed, uploaded or published.

## Not in this version

Dark mode (later, app-wide, per user). The Company filter appears with the Company foundation (V270.5).

## V271.8.3 — theme colours worked out by BizCore (12 Nov; `css/theme.css` / `app.js?v=271.8.3`, cache `bizcore-shell-v27183`)

- **Cause:** theme colours were made by the browser with CSS relative colours (`oklch(from …)`). Some browsers lost the
  hue of the light tints there, so with Corporate Navy the top bar, filter bars and table headers showed pink.
- **Fix:** `css/theme.css` now holds only the original colours (no relative colours). Corporate Navy uses them exactly;
  any other theme is painted by `applyTheme()` (OKLCH maths in `js/app.js`, written as plain `#hex` in one
  `<style id="bc-theme-colours">`), so every browser shows the same. Other themes match their earlier look (≤ 2/255).
- `tools/theme/build_theme_css.py` updated to match. New test: `tests/browser/theme-v27183.e2e.mjs`.
- Changed: `css/theme.css`, `js/app.js`, `index.html`, `sw.js`, `package.json`, `tools/theme/build_theme_css.py`.

## V271.8.2 — quotation from an estimate: estimate link fix (12 Nov; `app.js` / `quotation-ui.js?v=271.8.2`, cache `bizcore-shell-v27182`)

- **Cause:** a quotation made from an estimate keeps an internal link to it (version, print style, section amounts). A
  save wrote that link only while it was still held on screen, so an edit could drop it; the quotation then said
  "Pricing EST-…-V1" and opened Pricing ("Pricing V1 of RFQ-… was not found"). The estimate records themselves were
  always saved in Firebase (`rfqs/{id}/estimates/v{N}`).
- **Fix 1:** saving an edited quotation never drops its estimate link (the saved one is kept).
- **Fix 2:** a quotation whose reference is `EST-…-V{n}` reads **Estimation** and opens that estimate version from the
  internal panel and the document flow, even when the link is missing (covers the quotations already affected; their
  contracting card / locked lines are not restored — test data).
- No rule or data changes. Changed: `js/app.js`, `js/quotation-ui.js`, `index.html`, `sw.js`, `package.json`.
  New test: `tests/browser/quote-estlink-v27182.e2e.mjs`.

## V271.8.1 — period fix and filter menus (mockup F, agreed 12 Nov; files `dashboard.*?v=271.8.1`, cache `bizcore-shell-v27181`)

**Period (fix)**
- **This Month / This Quarter (new) / This Year** cover the whole month / quarter / year: figures run to today, the
  target is for the whole period, "days left" counts to its end and On track / Behind compares with the days gone.
  (Before, "This Month" from the list became 1st → today: the target shrank, "0 days left" and a wrong "Behind".)
- **Last Month · Last 3 Months** are whole months; **Custom** is any From → To.
- **‹ ›** step one whole month and stop at the current month (no more empty future months).

**Filter menus (look)** — Activity, Period, Customer, Salesperson and vs open BizCore menus instead of the browser's lists:
white card, tick on the chosen line, grey hint on the right; ↑ ↓ Enter, Esc closes; a bottom sheet on a phone.
- Period: month row ‹ November 2026 › at the top, the presets with their dates, Custom range (BizCore date fields) + Apply.
- Customer: search box, All customers, Most sales in the period (top 5 with amounts), All A–Z.
- The Clear filters icon lights up when a filter differs from the default.

Changed: `js/dashboard.js`, `css/dashboard.css`, `index.html`, `sw.js`, `tests/browser/dashboard-v2718.e2e.mjs`
(menus, search, This Month / This Year target, custom range). Tests: dashboard, date-filter sweep and navigation pass.
