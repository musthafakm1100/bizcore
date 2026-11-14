# BizCore UI standards (approved by Musthafa, October 2026)

Every new screen follows these rules. When something here doesn't fit a new screen, agree the exception first. Don't invent a new style.

## 1. Register screens (lists of documents)
> **Desktop registers: V271.5 supersedes parts of this section.** The side monitor (`aside.bc-monitor`) is hidden on desktop and replaced by the horizontal monitor cards in section 11; the filter bar now has an optional **Sort By** first, controls use 13 px text, and Clear Filters / Export show icons only. The phone and tablet rules below still apply unchanged. Where section 11 and this section disagree on a desktop register, follow section 11.

Layout (V266.6): **no page header** — the page name is in the top bar (title + breadcrumb). The **monitor** on the left and the **filter bar** above the table; the page's main button (New …) is the last item of the filter bar.

### Work-queue tiles (V269.2 — approved 19 Oct 2026, Sales Orders first)
Replaces the monitor column, one register at a time, each with its own mockup first. Sales Orders has it now; the other
registers keep the monitor below until their tiles are agreed.
- A strip above the filter bar (`.so-tiles`): one dark tile in the theme colour (the main work queue, count + value + a
  second line with context), then up to four tiles that **do not overlap** (label + count, value, a short grey line, a
  small bar in the status colour). The breadcrumb in the top bar stays.
- A tile filters the register; clicking it again shows everything. The Status list follows the chosen tile. Tiles react
  to Customer / Date / Search, not to the chosen tile. A grey line under the strip says what is shown.
- Only the stages that need action; payment is not part of the order status (it belongs to Invoices / Receipts).
- Narrow content (≤ 900 px, container query): the dark tile becomes a slim bar on top, the four tiles stay in one row.
- Phone: 2 × 2 tiles; once they scroll away, a slim bar with the counts stays under the top bar (tap = filter).
- Main button: **split button** ("+ New …" does the usual action; ▾ opens a menu with the other ways, unavailable
  ones greyed out). Phone: a round **+** in the bottom corner that opens the same menu from the bottom.

### Monitor (Delivery Monitor style)
- Markup: `aside.dn-overview-panel.module-monitor.bc-monitor`, then:
  - `.dn-overview-head`: title "<Document> Monitor", a one-line subtitle, and a collapse button that calls `toggleModuleMonitor(key)`;
  - `.dn-overview-body`.
- Body content, in order:
  1. a **total** row (`button.dn-overview-total`), clickable to show everything;
  2. section labels (`.dn-overview-section-label`) **STATUS**, then **ATTENTION** (exceptions), then **PERFORMANCE** (figures);
  3. clickable rows (`button.dn-overview-row`): a dot `i.dn-dot.bc-dot-<colour>`, the label, and the count;
  4. figure rows (`div.dn-overview-row.bc-monitor-metric`), which are not clickable.
- Dot colours: `slate amber green blue red orange purple yellow teal gray`.
- The active row is shown only by CSS (light background + blue bar). Never add per-status tints.
- Filtering hooks are data attributes (`data-…-filter`), not styling classes.
- Add the workspace id to `getModuleMonitorWorkspace()` so collapse / expand works. The rail button calls `toggleModuleMonitor(key)`.

### Filter bar
- RFQ only (V271.5.38): a **Type** filter sits between Customer and Status (`#rfq-type-filter`, values `product`/`service`/`mixed`/`contracting`), and the register has its own matching **Type** column after Reference, shown as a small coloured pill (`rfqTypeBadgeHtml()` in `js/app.js`, colours in `css/status-badges.css`). An RFQ with no stored type shows "Product" (the form's own default). This filter also narrows the RFQ Monitor counts, like Customer.
- Markup: `.page-control-bar.bc-filterbar`.
  - `.bc-filterbar-left` holds the count (`.bc-filter-count`, e.g. "12 orders"). **No sort list** (V266.6): sorting is by clicking a column header; lists open newest first. (A hidden `.bc-filter-sort` may stay for old code.)
  - `.bc-filterbar-right` holds, **in this order**:
    1. **Customer** (`.bc-filter-customer`, "All customers", built from the data);
    2. **Status** (`.bc-filter-status`, "All statuses");
    3. **Date** (the standard date filter, below);
    4. **Search** (`.bc-filter-search`);
    5. **Clear Filters** (`.register-clear-filters.bc-filter-btn`);
    6. **Export Excel** (optional, `.bc-filter-btn`, icon `<i class="bc-xls-ico"></i>`);
    7. the page's **main button** (`.btn.bc-filter-new`, e.g. "+ New Quotation"), always last.
- **One line, 48 px high, at every desktop / laptop / landscape-tablet width.** When space is short: fields shrink → Clear and Export show only their icon (tooltip keeps the name) → the count hides → the main button shows only "+". Below 860 px (phones, portrait tablets) the bar may wrap until the phone / tablet design (V266.7).
- Sticky offsets: the filter bar sticks at 0, the table header at 48 px (no page header above them).
- Every control is 34 px high, uses 12.5 px text, has a 1 px `#d5dde7` border and an 8 px radius.
- Widths: Customer up to 170, Status up to 140, Date 132, Search flexible (150–360); numbers, dates, amounts and statuses in register tables never wrap.
- The styles are in `css/register-standard.css`. Add the new page id to `PAGES` in its generator.
- **The Status filter and the monitor are one filter.** Choosing a status highlights the monitor row; clicking a row sets the Status select.
- The **Customer** filter also narrows the monitor counts.
- **Clear Filters** resets everything: Customer, Status, Date, Search and the column sort.

### Date filter (design "A")
- Place the component with `<div class="bc-date" data-bc-date="KEY" data-bc-date-title="Invoice date"></div>`.
- Wire it with `BCDateFilter.register('KEY', state => …)`. The state is `{ preset, from, to }` with dates as `YYYY-MM-DD` or `''`.
- In Clear Filters, call `BCDateFilter.set('KEY', { preset: 'all' })`.
- **Presets are the same everywhere:** All Dates, Today, This Week, This Month, Last Month, Last 30 Days, Last 3 Months, This Year. They are defined in `BCDateFilter.range`.
  - Ranges end today; Last Month is the full month.
  - "This Week" starts on the day set in **Administration → General Defaults → Week starts on** (Sunday by default).
- The popup shows each preset with its dates in grey and a tick on the chosen one. It has a Custom range section (From → To, Clear, Apply). If From is after To, the range is refused with a message.
- The button shows the preset name, or the custom range (e.g. "1 – 30 Sep").

## 2. Entry screens (create / edit a document)
- Use the Create Sales Order workspace layout (`so-create-workspace`): cards, an item grid, and a summary card.
- **Quantity fields** are `input[type=number].bc-spin`. They show the desktop-style up/down arrows (`bcSpinEnhance`), step by the unit's step and respect min/max.
  - Exception: the Delivery Confirmation screen keeps its large −/+ buttons for phone use.
- **Before saving**, ask for confirmation (`invConfirm`) with a summary of the key figures. "Go back" saves nothing.
- **A disabled Save button is always explained.** The footer checklist (`invReadyHtml`) shows "To continue: ① … ② …" and turns green when the form is complete. The button's tooltip names the first missing item.
- **After saving**, open the saved document in its display screen. Back returns to the screen the user started from, refreshed.
- Mandatory external references (e.g. the Zoho invoice no.) are checked on the screen, in the service transaction, and in the security rules.
- Numbers are assigned on save ("Auto on Save").
- **Screens used on a tablet or phone** (e.g. Confirm Delivery) follow the compact layout in `css/delivery-compact.css`:
  - one back button and a title with a one-line subtitle;
  - no explanatory banners or headings;
  - one row per item with 40 px −/+ buttons;
  - details that appear only when needed;
  - the action buttons fixed at the bottom (full width on a phone).
- **People on documents:** record the person's name; whether they are staff or outside is internal and never printed for the customer.

### Dates (V270.1 — decided 22 Oct 2026)
- Every date shows and is typed as **DD-MM-YYYY** (22-10-2026), with the BizCore date field (`js/bc-date.js`):
  typing (`22/10`, `22.10.26`, `22102026`, `t` today, `y` yesterday) or the calendar (📅, Alt+↓; Today / Yesterday / Clear).
- The value behind it stays ISO. Limits (e.g. no future dates) are set per field and greyed out in the calendar.
- V270.1: Pricing's Quote Date; V270.2: Quotation Date; V270.3 (planned): every other date field.

### Pricing screen (V270.1 — approved PR_29 – PR_44)
- A centred window (not full screen) over the dimmed app; ← arrow to go back (Alt+←), asking Stay / Discard / Save only
  when something changed.
- Tabs for the parts of the document; a dot on a tab, and a pill in the header, show that a note exists.
- Item grids: ONE column set for header, lines, add row and totals; sticky header and totals; numeric headings end at
  their field; a reference line (Last Paid / Last Quoted) under a price, opened with a click or F2.
- Line actions in a ⋮ menu (a bottom sheet on a phone); delete asks first and offers Undo.
- Phone: each line is a card built from plain blocks (never a restyled table row — Safari), labels level with their fields.

### Contracting Estimation (V271.1 — approved CE_1, CE_2, docs/V271_1_ESTIMATION.md)
- The Pricing window pattern for a Contracting RFQ: field bar, tabs (Sections & Items · Manpower · Subcontracts ·
  Internal Notes), one grid with section rows / subtotals, the summary panel (cost by type, Overheads % + Contingency %,
  Markup %, Selling Price, Round to (lump sum), result card in green / amber / red).
- Line detail opens as a panel over the window (Cost Build-up) with ‹ Previous / Next › / Done; Esc closes the panel first.
- Cost type colours everywhere: Material blue `#2e75b6`, Manpower orange `#ea6a10`, Subcontract teal `#0f766e`,
  Equipment / Other grey `#94a3b8`.

### Contracting Job view & Job Expense (V271.3 — approved CJ_2, CC_1, CC_2, docs/V271_3_ACTUAL_COST.md)
- Job windows share the navy header band (`#173a5e`), four summary cards (the first dark) and tabs under the header
  (Overview · Estimate vs Actual · Costs (n) · Activity); the side column holds Progress and Activity.
- Budget vs actual rows: Budget · Actual · Used (bar in the cost-type colour + %) · Remaining; amber / red replace the
  bar colour at the Contracting Settings limits; a row click filters the Costs tab.
- Cost types show as small coloured chips (same colours as the Cost Build-up) on purchase lines, expense lines and costs.
- Job Expense: header fields in one row (Job · Date · Paid From · Reference), a line table (Category with its cost-type
  chip under it · Description · Paid To · Amount · VAT), totals right-aligned (Cost to the job · VAT · Paid), "To
  continue" / "✓ Ready" in the footer like Create Job.

### Quotation Entry (V270.2 — approved QT_1 – QT_12, docs/V270_2_QUOTATION.md)
- The Pricing window pattern for a customer document: details band (Fold to one line of chips, remembered per person),
  tabs Items / Remarks & Conditions (green dot — prints) / 🔒 Internal Notes (orange dot — never printed), a "How It
  Prints" preview, the summary panel with an "Internal · Never Printed" card, a totals bar below 1200 px.
- Discounts entered two ways (% and amount) follow the Pricing rule: one direction per field, the typed field is never
  rewritten and is the one kept when qty / price change; the worked-out field is grey; a wrong value is red and blocks
  Save with the reason.
- A choice that overrides an Administration default on one document (e.g. note style) shows as "Administration
  Default · <name>" in its menu and a blue dot where it is overridden; it never changes the default.

## 3. Display screens (view a document)
Approved compact layout (V265.2). Used by Quotation, Delivery Note, Invoice and Credit Note.
- **Window size.** On screens 1200 px wide or more, the window is only as wide as the A4 page plus the panel: `min(1320px, 100vw − 36px)`. It is centred, 18 px from the top and bottom, with rounded corners, and the app shows dimmed around it. Below 1200 px it stays full screen. The styles are in `css/doc-view.css`; add the new modal id there.
- **Layout.** The workspace grid is `minmax(0, 794px) 300px`, centred, with a 20 px gap.
  - Left: the **A4 document**, in the shared DN layout. Never restyle the page for the screen.
  - Right: the **panel**, 300 px. It holds only information that the page does not already show prominently.
  - Don't repeat document details in the header. The header holds the title (and Back / ✕).
- **The panel, top to bottom:**
  1. A summary card marked "Staff only". It starts with a 2 × 2 figure grid (`bcKpiGrid`, tones `red` / `green` / `muted`), then a few label/value rows (`.bc-kpi-rows`).
  2. **Document flow** on one line of chips (`bcFlowChips`). The current document is highlighted, linked documents are clickable, and a missing step shows as "Label —".
  3. **Activity**: dot, text and date rows (`bcActivityList`).
  - The Delivery Note keeps its acceptance panel in the same 300 px column.
- **Action bar** at the bottom right: Close, related documents, actions, and Print / PDF last.
- Each document type has its own accent colour so it is quickly recognisable. Invoice: teal `#0f766e`. Credit note: red `#b42318`. Payment receipt: green `#15803d` (V266).
- Totals follow the Quotation typography: rows of label + figure, and a bold white total on the accent colour.
- Print / PDF uses the same A4 builder as the screen.

### Sales Order view (V269.7 — agreed exception to the A4 + panel layout)
The order is not a customer document, so its view is a dashboard (docs/V269_7_SO_VIEW.md):
- Header: title + one-line subtitle, Edit (disabled with the reason when not allowed) and More.
- Four **fixed-height** cards: Delivery ring (blue `#1d63d8`), Invoicing ring (orange `#ea6a10`), Order Total and
  Outstanding. Percentages are by value.
- Document counts ("3 DNs ▾") open a floating list (PC / tablet) or a bottom sheet (phone).
  - They are collapsed by default and only one is open at a time.
  - They close on outside click, Esc, a tab change, opening a document, or a screen on top.
  - They are placed on the window overlay, so nothing clips them.
- Then tabs, sticky under the header.
- Quantities are always given per line with their unit, never added across units.
- Colours: To Deliver blue, To Invoice orange (also on the Sales Orders register tile).
- Labels, headings, statuses and tags capitalise every word ("Part Est.", "Not Bought Yet"). Explanation sentences stay
  in sentence case.
- Phone footer: ⋯ More + the next step.
- Profit follows Purchase Settings → Profit visibility; the tab is left out of the page for others.

## 4. Navigation
- An entry screen that has been saved or cancelled is never a "Back" target (`modalNavEntryScreens`). Add new entry screens to that list.
- A view that stays open underneath another screen is redrawn when data changes and when the screen on top closes (see `refreshOpenSalesOrderView`).
- One busy overlay covers an action from the first click until the next screen is ready (`beginScreenTransition` / `endScreenTransition`, which can be nested).

## 5. General
- Configurable values belong in **Administration** settings, not in code.
- Use the same fonts, sizes and controls as the existing screens. Modern and uniform; no old-style boxy fields.
- Show a picture (mockup) before changing the look of an existing screen.

## 6. Editing saved documents (V266.3)
- An **Edit** button on the display screen; when not allowed it stays visible but disabled, and its tooltip says why (setting, time limit).
- Edit reuses the entry screen in an edit mode: title "Edit <number>", fields that may not change are greyed out, a **Reason for the change** field (required).
- Before saving, the confirmation lists **before → after** for every changed value plus the reason. The document keeps its number; the change goes to the history (Activity).
- Editing takes the document lock (receipts: their own lock; anything on a Sales Order: the order lock). Save, Cancel, Back and closing release it.
- Tax invoice figures are never edited; corrections go through a credit note ("Cancel and re-issue").
- Edit levels use one scale everywhere: Nobody · Limited for all · Limited for all, full for administrators · Full for all. For invoices "full" means **Cancel & re-issue** (V266.4). The invoice edit screen has the Create Invoice layout with the items and summary shown read-only ("As issued — cannot be changed").


## 7. Colours and the application theme (V266.5)
- **Screen colours come from the theme.** Never write a brand colour (navy / blue) directly in new CSS or screen HTML: use `var(--blue)`, `var(--blue-mid)`, `var(--blue-pale)`, `var(--accent)` or a `var(--c-<hex>)` token from `css/theme.css`. A new shade is added with `python tools/theme/convert.py .` (replaces raw colours by tokens) and `python tools/theme/build_theme_css.py`.
- **Not themed (fixed):** printed / A4 documents (they use their own fixed colours), document identity colours (invoice teal `#0f766e`, credit note red `#b42318`, receipt green `#15803d`), neutral greys, and status colours.
- **Status colours — one list of 7 tones** (`--st-<tone>-bg` / `--st-<tone>-fg` in `css/theme.css`). Every status label uses one of them; the same status always looks the same:
  | Tone | Used for |
  |---|---|
  | neutral (grey) | draft, new-not-started, unpaid, cancelled, voided, no bid |
  | blue | sent, confirmed, awaiting, quoted (document) |
  | amber | in progress / needs attention: pricing, out for delivery, partially delivered / paid / credited, invoiced (not paid), expired |
  | green | done: won, quoted (RFQ), delivered (DN), issued, posted, paid |
  | red | problem: lost, overdue, rejected, credit note, cancelled (document) |
  | purple | changed: revised, partial DN, overpaid |
  | teal | delivered (Sales Order) |
- **Themes (System Preferences → Appearance):** Corporate Navy (default, original colours), Professional Slate, Modern Teal, Forest Green, Royal Purple, Burgundy. Saved with the user (`settings/uiPrefs_<uid>`) and in the browser. A theme is three numbers (hue shift, colour strength, lightness lift); every shade keeps its original contrast.

## 8. Top bar and sidebar (V266.6)
- Top bar: very light theme tint (`--blue-pale`), search box white, 56 px high — the same height as the sidebar logo area so their bottom lines meet. Styles in `css/shell.css`.
- Title 17 px bold, the full breadcrumb underneath at 12 px (current page in the theme colour, bold). Nothing is clipped.
- Sidebar collapse button: inside the logo area on the right when the sidebar is open; its own centred row under the logo when collapsed — never on top of the logo or the top bar.
- Small labels are at least 11.5 px (monitor section labels and subtitles, progress steps, captions).
- Dates on screen are always **DD-MM-YYYY** (`fmtDate`). Date entry boxes follow the browser's calendar for now.
- Notification bell: plain icon (no white box) with a red count badge on its top-right corner.
- Sidebar shows the company's short name (the legal suffix "Est." is dropped); documents always print the full legal name from Administration.

## 9. Phone and tablet (V266.7)
- Phone ≤ 760 px: status chips instead of the monitor (last chip "Summary" opens the monitor), one-line toolbar (search · filter icon with count · Excel · +), cards instead of tables, filters in a slide-up panel.
- Tablet portrait 761–900 px: sidebar is a drawer, chips + one-line toolbar + table with the key columns.
- Tablet landscape 901–1279 px: sidebar starts as an icon rail and monitors start folded until the user chooses.
- View screens on a phone: at most two buttons + "⋯"; progress as "Step x of n"; documents scaled to the width.
- New registers (e.g. purchasing) get all of this by using the standard toolbar (`.bc-filterbar`, `.bc-filter-customer/-status/-search`, `.bc-date`, `.bc-filter-new`), the standard monitor (`aside.bc-monitor` with `.dn-overview-total/-row`) and an entry in `REG` in js/responsive.js.
- V269.2: Sales Orders uses the work-queue tiles on the phone (2 × 2, slim bar while scrolling) and a round **+** button
  in the bottom corner instead of the + in the toolbar. The other registers keep the V266.7 phone layout until their
  tiles are agreed.

## 10. iPhone / iPad screen edges (V269.2)
- index.html and mycash.html use `viewport-fit=cover`; css/safe-area.css keeps the app below the notch / status bar and
  away from the side notch, and every bottom bar, sheet, round button and the end of every list above the home bar.
- New fixed or sticky elements use `var(--sa-top / --sa-bottom / --sa-left / --sa-right)` (not `env()` directly), so
  the browser tests can show an iPhone (they set the variables to 47 px / 34 px).

## 11. Desktop register standard (V271.5 — approved reference: Pricing V271.5.19)
Applies to desktop (≥ 1101 px) registers. Visual only: it never changes data, filters, sorting or workflows. Phone and tablet layouts keep sections 9–10.

### Shared tokens
- All values live in `css/bizcore-ui-global.css` as `--bc-ui-*` variables. Change a value there, not in each screen.
- Card: 112 px high, 8 px gap, 10 px radius, 1 px `#e1e7ef` border, light shadow. Lead card 200 px wide.
- Toolbar 48 px high; controls 34 px high with 13 px text; inputs `#f8fafc` with a `#cbd5e1` border.
- Table header 39 px, 12 px medium, `#475569`, theme-tinted and opaque; row text 14 px regular `#111827`; thin horizontal row dividers only (no vertical borders).
- Gap between monitor, toolbar and table: 5 px.

### Layout of a register
1. **Monitor strip** on top (`.bc5-strip`, built in `js/phase5a-monitors.js`): one lead card (the theme colour) then individual cards with title, count, a SAR or description line and a count-based progress bar. A card filters the register; selecting it again shows everything.
2. **Toolbar** in one row: Sort By (when the register has it), Customer, Status, Date, Search, Clear Filters (icon only), Export Excel (icon only), main button last. Clear Filters is enabled only while a filter is active (sorting alone doesn't count).
3. **Table** inside a rounded, opaque container. Monitor and toolbar stay fixed; only the rows scroll, under a sticky header at top 0. The last column keeps right-edge padding.
- Cards whose measure can't be calculated yet show a dash. Never invent a count.

### Monitor cards
- Dark-premium fills (`css/monitor-dark-premium-global.css`): the lead card keeps the theme colour; the next cards use navy, purple, teal, burgundy, then neutral. Pricing keeps its own approved styling.
- Title 15 px, count 23 px, detail / SAR line 13 px.
- Card icon and badge colour follow the **meaning**, not the position: blue = open / sent / unpaid, green = done / won / paid / delivered, amber = waiting / follow-up / unapplied, red = overdue, purple = partial / in progress / advance, slate = draft / used up.

### Status badges (`css/status-badges.css`)
- One shape everywhere: 12 px, weight 500, 4 × 10 px padding, pill. Applies to Sales Orders, RFQ, Quotations, Delivery Notes, Customer Invoices, Receipts, Purchase Invoices and Supplier Payments.
- Colours: Out for Delivery = sky, Partially Delivered = amber, Partially Accepted = purple, Rejected / Overdue / Cancelled = red, Paid = dark green, Part Paid = light green, To Invoice = orange (its own badge). Voided: the colour set in `css/status-badges.css` is the reference.
- Invoice issuance and payment are **separate** badges. Receipt amounts shown as unapplied use amber, never the Part Paid green.

### Master Data screens
- Customers, Suppliers, Products, Employees, Units of Measure and Categories use the same themed toolbar, 13 px controls, table header, 5 px gap, rounded scrolling table and right-edge padding. Import / Delete show icons only; UOM and Category tables are full width.
- The standard classes and action buttons are written in the HTML itself — don't rely on a script that moves them afterwards.
- Master Data sidebar (Option B): 205 px, collapsing to a 56 px icon rail; 13 px regular items, 14 px medium heading, 17 px icons. On small screens the full-text grid is kept and the collapse button is hidden.
- Main sidebar: compact text (`css/sidebar-compact.css`).

### Customer and Supplier details window
- Two tabs: **Information** (company and contacts, national address, change history, supplier notes) and **Activity & Usage** (usage figures and recent transactions).
- Company name on one line (medium weight); ID, type and created date in the header when they exist. Field labels and values regular weight. Missing values show "–".
- One scroll area with a fixed footer.

### Rules for adding or changing a screen
- Use the shared tokens and classes above; don't add a new override file for one screen. If a screen needs its own rules, put them in that screen's existing stylesheet.
- Avoid new `!important` rules; the existing override files use many, so a new rule that fights them usually means the old rule should be edited instead.
- Real HTML table IDs are used by the shared rules (for example `invreg-table`, `rctreg-table`, `pireg-table`, `spreg-table`, `streg-table`, `dn-register-table`, `quotes-table`, `so-register-table`). Give a new register's table an ID in the same style and add it to the shared selectors.
- Every UI change gets a visual check in a signed-in browser at desktop, laptop and tablet widths, with at least two themes.
- Icons: Tabler webfont, pinned to version 3.51.0 in `index.html`, `login.html` and `mycash.html`. Change the pinned version deliberately and check the icons after.
