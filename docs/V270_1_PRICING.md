# V270.1 — Pricing screen redesign + BizCore date field

Built on 23 Oct 2026 from the mockups Musthafa approved (PR_29 – PR_44) and his decisions of 22 Oct.

Only website files changed. **There is no rules change and nothing to publish.** Nothing stored changes shape. The only
addition is an optional `supNote` on a pricing line (the supplier note).

## The BizCore date field (js/bc-date.js, css/bc-date.css)
- **Format:** dates show and are typed as **DD-MM-YYYY** (e.g. 22-10-2026). What's stored stays ISO (YYYY-MM-DD).
- **Typing** is read when you leave the field or press Enter:
  - `22-10-2026`, `22/10/2026`, `22.10.26`, `22 10 2026`, `22102026`, `221026`;
  - `22/10` or `2210` (this year);
  - `t` / `today`, `y` / `yesterday`;
  - a pasted ISO date.
  A date it can't read stays as typed, outlined red.
- **Calendar:** the 📅 button, Alt+↓ or F4.
  - ‹ › change the month. Today is outlined; the chosen date is filled.
  - Arrows move by a day or a week, PageUp / PageDown by a month, Home / End to the week's start or end.
  - Enter or Space chooses; Esc closes only the calendar.
  - Buttons: Today, Yesterday, Clear.
  - On a phone it opens as a bottom sheet.
- **Limits:** days outside a screen's limits can't be picked. On Pricing these are no future dates and nothing older than
  six months. A typed date outside the limits gets the screen's message, as before (e.g. "Future quotation dates are not
  allowed.").
- Use it with `BCDate.attach(input, { min, max, allowEmpty, onCommit })` and `BCDate.getISO(input)`.
- **V270.3** (planned; V270.2 became the Quotation Entry redesign, which uses it on the quotation date) puts it on every other date field: about 45 `type="date"` inputs in index.html, invoicing, purchases,
  cash & bank, supplier payments, receipts, stock, accounts, ui-standard, responsive and mycash.html.
  - In V270.1 it is on Pricing's Quote Date only.

## Pricing screen

### Window and header
- A centred window over the dimmed app: width min(1320 px, screen − 36 px).
  - Below 1200 px it takes the full width with a 12 px edge.
  - At 760 px and below it is full screen.
- **← arrow** (tooltip "Back to RFQ (Alt+←)") replaces the old button. When Pricing was opened from a quotation it reads
  "Back to Quotation". The app's own "Back to …" button is hidden here.
- Title: **Pricing V1 — RFQ-…**. Subtitle: customer · Ref · Due · Target (Markup or Margin, per Pricing Settings)
  min – target %.
- Pills: the status (Draft / Saved / Revision Draft), and **● Internal Note** when there is a note (clicking it opens
  the Notes tab).

### Supplier bar
- **Primary Supplier \*** comes from the Supplier Master only.
  - A typed name that isn't in the master is outlined red.
  - Saving stops with "Supplier not in the Supplier Master", offering **Add New Supplier** or **Choose From List**.
  - "Add new supplier" stays in the list. A name typed in another case is matched to the master's spelling.
- **Supplier Quote Ref. \*** and **Quote Date \*** use the new date field.
- **Apply Supplier To Lines** fills lines that have no supplier. ▾ offers Fill Blank Lines, or Replace All Lines… with
  a confirmation.

### Tabs
- **Items (n)**, **Additional Costs (SAR total)**, **Internal Notes** (orange dot when there's a note), **Vendor Quotes (n)**.
- On a phone the tabs read Items / Costs / Notes / Quotes.

### Items grid
One column set is shared by the header, the lines, Add Item and the totals:
- **# ⋮⋮** — drag to reorder (as before; reordering still auto-saves the draft).
- **Item · Code · Supplier**
  - The description shows in full, up to 3 lines, and is edited in place.
  - Under it: the code, the line's supplier (Supplier Master), and the line's quote ref. and ✎ Note when set.
- **Qty** — quantity and unit in one box, heading centred over it.
- **Buy Price** with **Last Paid 19.50** under it.
- **Markup On Buy %** = (Sell − Buy) ÷ Buy, whatever the Pricing Settings method.
- **Sell Price** with **Last Quoted 24.50 (Lost)** under it. A 🔒 shows when the price is locked.
- **Line Total**.
- **Profit**, with Markup % · Margin % under it.
- **⋮** — the line menu.

The header and the totals row stay in view while the lines scroll; 20 – 50 lines work. The hint line shows the keys.

### Figures (approved formulas)
- Line cost = Buy × Qty + the line's share of the additional costs, shared by buy value.
- Profit = Sell − line cost. Markup % = Profit ÷ cost. Margin % = Profit ÷ Sell.
- The line figures add up exactly to the summary.
- Lines with a sell but no buy price show "No Buy Price".
- The status (Margin Status master), the target / minimum check and manager approval use the Pricing Settings method on
  the totals including additional costs, as before.
- **Fixed:** before V270.1:
  - the line % ignored the additional costs;
  - the summary "Margin" showed the markup when the method was Markup;
  - the line "Margin" was an amount.

### Last Paid / Last Quoted
- **Last Paid** comes from posted purchase invoices (loaded ones plus the item's last-price record). Voided invoices
  don't count.
- **Last Quoted** comes from quotations that were Sent, Won, Lost or Expired, with the status in brackets.
  - This customer's quotations come first. Another customer's shows as **Other Customer 158.00 (Won)**, in purple.
  - Draft and Revised quotations are never used. Cancelled ones don't count either: no such status exists today.
- Click the reference, or press **F2** in the price box, for the last 3: price, PI / quotation no., date, supplier or
  customer, status. **Use** puts the price in.

### Line menu (⋮; a bottom sheet on a phone)
- **Insert Line Above** and **Duplicate Line** (the copy goes under the original).
- **Move Up** (Alt+↑) and **Move Down** (Alt+↓).
- **Line Details · Quote Ref. · Supplier Note:** quantity, unit, supplier, quote ref. and an internal supplier note
  (up to 300 characters). The note is saved as `supNote`.
- **Lock / Unlock Sell Price** — the target drag leaves locked lines alone.
- **Delete Line** (Ctrl+Del):
  - The confirmation names the line, quantity, supplier and sell value.
  - Everything is worked out again at once.
  - A toast offers **Undo**. Nothing is saved until Save.

### Summary panel (284 px)
- **Cost:** Material, Additional, Total Cost.
- **Selling:** Total Sell (ex-VAT), VAT, Total (incl. VAT).
- **Result card:** Profit, Markup % and Margin % tiles, the target, the meter and the status pill ("Good · Markup 24.0%",
  plus "Manager approval required" below the minimum).
  - The card is green normally, orange below the minimum and red at a loss.
  - Dragging or clicking the meter sets the target and adjusts the unlocked sell prices, as the old vertical gauge did.
- Below 1200 px the panel becomes a **totals bar**: Cost · Sell · Profit · Markup · Margin · status.

### Additional Costs tab
- Columns: # · Cost Item (Cost Master / Custom tag; a locked one is shown greyed with 🔒) · Method · Value · Amount ·
  How It Is Worked Out (e.g. "1.50% × 3,290.99 material").
- Under the costs:
  - **Add cost from Cost Master…** lists only the costs not on the pricing yet, plus Other (Custom Cost);
  - **+ Add All Default Costs**;
  - the total, as a % of material and of selling.
- ⋮ on a cost: Move Up / Move Down (the order matters for % Of Total Cost), Delete Cost (confirmed).
- Boxes: **Shared Over The Lines** (each line's share; Show All past 6), and **Methods**.

### Internal Notes and Vendor Quotes tabs
- **Notes:** textarea with a counter; the dot and the header pill appear as soon as there is text.
- **Vendor Quotes:** a table with File, Supplier, Quote Ref., Date, Size and View · ⤓ · 🗑.
  - Removing asks first.
  - Drop PDF or image files on the tab, or click Attach (several at once, 10 MB each).
  - New attachments keep their size (`size`).

### Footer
- "● Unsaved changes" / "Saved · ready to convert", then **Close**, **Save** and **Save & Convert To Quotation**
  (Convert … once saved). Cancel is gone; ✕ and Close do the same.
- **Leaving with changes** (← / Alt+←, Close, ✕, Esc) asks **Leave Without Saving?** with three choices:
  - Stay;
  - Discard & Go Back (or Discard & Close);
  - Save & Go Back (or Save & Close), which saves with the usual checks, without the second "Save pricing?" question.

  With no changes it leaves at once. Before V270.1, Close always asked.

### Phone (≤760 px)
- Each line is a card:
  - "n · description", with quantity · supplier · code under it, and ⋮;
  - Buy / Markup On Buy % / Sell, level, with Last references;
  - Total and Profit · Markup / Margin.
  The card edits the line itself; the grid stays the record.
- Add Item stays under the cards. Costs are cards too. Vendor quotes show the file with details under it and ⋮.
- Save / Convert are full-width; the totals bar is above them.
- On the iPhone the cards are plain blocks, not restyled table rows — the V269.7.2 Safari lesson.

### Quieter item search
A line that already has its description no longer opens "No matching items" when you click or Tab into it. Typing,
or ↓, opens the list.

## Sales Order view fix
The Profit tab read the Pricing Settings method as `'margin'`, but Pricing Settings stores `'gross_margin'`, so it
always showed Markup first. Fixed in js/so-view.js.

## Files
| File | Change |
|---|---|
| `js/bc-date.js`, `css/bc-date.css` (new) | The date field |
| `js/pricing-ui.js`, `css/pricing.css` (new) | Tabs, menus, references, dialogs, phone cards; the layout |
| `js/app.js` | Pricing lines, figures, summary, costs, vendor quotes, open / close, date helpers (DD-MM-YYYY), supplier check |
| `index.html` | The Pricing window markup; loads the new files; `?v=270.1` |
| `js/so-view.js` | The `gross_margin` fix |
| `sw.js` | `bizcore-shell-v2701` and the new files |

Tests:
- New: `tests/browser/pricing-screen.e2e.mjs` (2 tests) with the shared seed in `tests/browser/pricing-seed.mjs`.
- It covers the figures, the references, the line menu, the costs, the notes, the supplier check, the date field, saving,
  Back / Close, and the layout at 1440, 1366 × 768 (50 lines), the 834 tablet and the 390 phone.

## Going live
Upload: **index.html, sw.js, js/app.js, js/so-view.js, js/pricing-ui.js, js/bc-date.js, css/pricing.css,
css/bc-date.css**. Also upload the V269.4 – V269.7.2 files if they aren't uploaded yet; the full list is in
docs/HANDOVER.md.

No rules and no settings to save.

## V270.1.1 — small visual refinements (23 Oct 2026)
- **Totals row:** the label and figures (Buy, Total Sell, Profit, Markup · Margin %) are a muted blue (#2f5d8a) and a
  little stronger (600; the % line 500). Background and layout are unchanged. There is no Qty total: the lines are in
  different units.
- **⋮ button:** lighter and smaller (grey, dark on hover / while open).
- **Line menu:**
  - The text is normal weight.
  - "Line Details" has "Quote Ref. · Supplier Note" in small grey text under it.
  - The menu is 272 px wide, with no horizontal scrollbar.
  - It always stays 8 px inside the screen: above the line when there's no room below.
- **Summary panel:** ordinary amounts are normal weight; Total Cost and Total (Incl. VAT) stay semi-bold.
- Upload: **css/pricing.css, js/pricing-ui.js, index.html, sw.js** (`bizcore-shell-v27011`).

## V270.1.2 — Buy / Markup / Sell while typing (23 Oct 2026)
**The bug (reported by Musthafa):** with Markup 20%, typing Buy 55 gave Sell 6.00 and −89.1%.
- **Cause:** the Buy field ran one shared function, `calcPricingRow`, on every keystroke. It filled Sell from the %
  only while Sell was empty, so the first key set Sell = 6.00. From the second key on, it saw a Sell already there and
  worked out the % backwards from it: (6 − 55) ÷ 55 = −89.1%.
- That backward step came from the old screen. It also ran when leaving the Buy field and when the quantity changed.

**Now — one direction per field, never a reverse calculation while typing:**
| You type in | What follows |
|---|---|
| Buy Price | Sell = Buy × (1 + Markup On Buy %). If the sell price is locked 🔒, Sell stays and the % follows. |
| Markup On Buy % | Sell = Buy × (1 + %) |
| Sell Price | Markup On Buy % = (Sell − Buy) ÷ Buy |
| Qty, unit, supplier — or leaving any field | Prices stay; only Profit, Markup %, Margin %, the cost shares and the totals are worked out again |

- The field being typed in is never rewritten, so several digits and decimals (55, 55.5) work.
- The exact % behind the one-decimal % on screen is kept. A later Buy change then doesn't move the Sell by a few
  halalas: after Sell 70 on Buy 55.5 (26.1%), Buy 60 gives 75.68.
- A saved line still opens with the % worked out from its saved Buy and Sell.
- The same rules apply to the phone cards, to **Use** from Last Paid, and to the target drag.
- Code: `calcFromBuy` (new), `calcFromMarkup`, `calcFromSell`, `calcPricingRow` (quantity etc.: figures only),
  `pricingMarkupOf` / `pricingSetMarkupFrom`, and `endPriceEdit` (only formats Buy).
- Test: pricing-screen.e2e types key by key — 5 → 55 → 55.5, % 25, Sell 70, Buy 60, locked sell — and checks that the
  line profits still add up to the summary.
- Upload: **js/app.js, js/pricing-ui.js, index.html, sw.js** (`bizcore-shell-v27012`).


## V270.1.3 — line quote ref. in place, Price History, View mode (23 Oct 2026)
Approved 23 Oct: in-place ref, the Firebase index file, and the View design with Edit / Revise Pricing.

### Line supplier quote ref. in place
- Under each item: click **Ref 123**, or **+ Ref** on a line without one. Enter or clicking away keeps it; Esc cancels.
- On a phone, tap the ref in the card's grey line; it opens a small box.
- ⋮ → Line Details still edits it, together with qty, supplier and note.

### Price History (js/pricing-ui.js `prOpenHistory`, index.html `BCWin.page` / `BCWin.addDocs`)
- The quick Last Paid / Last Quoted list (last 3, no reads) now ends with **View Price History ›**.
- The History window:
  - **Buying / Selling** tabs.
  - Filters: Supplier (Buying); All Customers / This Customer and Status (Selling); period (3 / 6 / 12 months / all time).
  - Columns: Date, PI / Quotation no. (opens it), Supplier / Customer, Qty, Unit Price, Status (pay status / quotation
    status).
  - **Load 5 More**.
  - On a phone it is a bottom sheet with cards.
- **Selling:** quotations that were Sent, Won, Lost or Expired. Draft and Revised are left out by the query itself.
- **Firebase:**
  - Indexed queries: `itemKeys array-contains` + filters, newest first, 5 a page, a cursor for the next page.
  - It only works once the indexes in firestore.indexes.json are set up (docs/FIRESTORE_INDEXES.md).
  - The session cache means no second read. A document opened from the list joins the loaded records, so opening it
    reads nothing more. Browsing writes nothing.
- **Quotations** now save `itemKeys`, in the same write.

### View mode — the same window (replaces the old Pricing read-only window)
- `viewPricingReadOnly` / `openPricingDocument` open `#pricing-modal` with `mode:'view'`. An older version shows with
  its own data, as before.
- Same header, tabs, grid, summary, cards. **🔒 View Only** pill. The status pill reads Saved / Converted (green) /
  Superseded / Revision Draft.
- Everything is read only. Hidden in View:
  - Add Item, drag handles, the line / cost ⋮ menus;
  - Apply Supplier, the calendar, the cost picker, the drop area;
  - the target bar, Save / Convert, and Remove on attachments.
  Ctrl+S, Ctrl+Del and Alt+↑/↓ do nothing; the price references have no **Use**.
- **Footer:**
  - The status and date ("Converted to Q-… · date", the number opening the quotation).
  - **View RFQ**, **View Quotation** (when converted), **Close**.
  - **✎ Edit** (switches the same window to entry) or **Revise Pricing** (converted / superseded / an older version).
  - On a phone: ⋯ (View RFQ / View Quotation / Close) + the main button.
- Only the costs that were saved are shown (no Cost Master defaults added in View).

### Files
- Changed: js/app.js, js/pricing-ui.js, js/bc-date.js (no calendar on a read-only date), css/pricing.css, index.html,
  sw.js (`bizcore-shell-v27013`).
- New: firestore.indexes.json and docs/FIRESTORE_INDEXES.md.
- Tests: tests/browser/fake-sdk/firebase-firestore.js now applies orderBy / startAfter / limit; pricing-seed.mjs;
  pricing-screen.e2e (new 3rd test); pricing-versions.e2e (View mode instead of the old window).
- Upload: **index.html, sw.js, js/app.js, js/pricing-ui.js, js/bc-date.js, css/pricing.css**.
- Firebase: create the 4 indexes (docs/FIRESTORE_INDEXES.md). There is no rules change.
