# V270.4.14 — Service quotations, formatted descriptions, internal Cost column (31 Oct 2026)

Approved mockups SQ_1, SQ_2 (service lines, print), RT_3 (Format bar above the table header), DQ_1 (Cost 🔒 column).
Musthafa's decisions (31 Oct):

| # | Decision |
|---|---|
| a | One **Services** template. A line is linked to an SRV item, or made a **scope line** on purpose from the ⋮ menu (contracting work, free text, not linked). No third "Contracting" template until the Contracting module. |
| b | The **Cost 🔒** column is on every quotation. From Pricing: Pricing's buy price, read-only ("From Pricing"). |
| c | Mark as Sent with priced lines without a cost → **reminder** (Send anyway / Enter cost). |
| d | **Show cost** remembers each user's last choice (this browser; first time: on). |
| e | Formatting on **service (scope) lines and note lines** only; product lines stay plain. |
| f | Delivery Note / Invoice print **plain text with the layout** (line breaks, bullets, numbers); Zoho only takes plain text. |
| g | **5 colours** (black, navy, red, green, grey), **4 sizes** (Small / Normal / Large / Heading), **one highlight** (light yellow); bold, italic, underline, bullets, numbering 1. / a. / A. / i. / I., indent 3 levels, clear formatting. |

## What changed
- **Service quotation lines** (`rowKind:'scope'`): linked to SRV items like product lines — green / orange marker, Mark as
  Sent reminder, link required at Create Sales Order. Linking sets the unit from the service item. A line made a scope line
  (`freeScope:true`, grey marker "Scope line · free text, not linked") is never asked for a link. The link window offers
  "New Service" and "Scope line (free text)" for service lines. Older test quotations whose service lines were never
  linked now need a link before a Sales Order (test data — not migrated).
- **Formatted text** (`js/quote-rich.js`, `BCRich`): the scope text and note text are `<div contenteditable>` editors with
  a `value` property (plain text in / out), so existing code keeps reading `.value`. Stored: `desc` / `text` = plain text
  with the layout (used by search, wording memory, links, SO, DN, Invoice) + `descHtml` / `textHtml` = cleaned HTML, only
  when there is formatting. Paste from Word keeps bold / italic / underline / lists / nearest colour / size; fonts,
  backgrounds, tables, pictures and scripts are removed (`BCRich.clean`, allow-list). Max 20,000 characters of HTML.
- **Format bar** `#qt-rtbar` between the toolbar and the table header; greyed until the caret is in a scope / note line.
  Ctrl+B / I / U, Tab / Shift+Tab inside lists. Phone: the line sheet has its own bar (the main bar is hidden on a phone).
- **Print**: the Service template (title now "SERVICE QUOTATION", template name "Service"), the ERP box, image,
  bilingual and older templates show the formatting (`bcLineDescHtml`, `bcNoteHtml`, styles injected by `_tplOpen`).
  `js/doc-pages.js` cuts a long formatted line between paragraphs / list items when it does not fit (continuation row,
  numbering carried on with `start`) — nothing runs under the footer.
- **Cost 🔒 column** (`js/quote-cost.js`, `BCQuoteCost`): only for the Special Right "See cost, margin and profit"; zero
  width when Show cost is off (one column set kept). Hint under the box: Last paid (itemLastPrices) else the last
  estimate — click to use. Per line: Markup / Margin % (Pricing Settings method), "below min", "Loss", "No cost entered".
  Internal box for a quotation without Pricing: cost, selling of the costed lines (quotation discount spread), profit,
  markup, margin, "n of m priced lines costed".
- **Mark as Sent** (editor and view): cost missing → reminder; own costs below the minimum margin and "Manager approval"
  on → approval like Pricing (`approvals` kind **'quotation'**, `rfqId` = the quotation id, `version` = revision no.);
  an administrator / the right "Sell below the minimum margin" approves himself; selling below cost follows "Allow selling
  below cost". A new quotation that needs approval is saved as Draft first, then the request is sent. Quotations from
  Pricing are not asked again (agreed 23 Oct: information only). The approval is noted on the quotation (`costApproval`).
- Saved per line: `estCost` (own unit cost; Pricing lines keep `pricingBuy`). Sent quotations' costs appear in the
  product view as **"Quotation est."** (estimated). The cost goes with the line to the Sales Order; the SO view's Profit
  uses it as the estimate when there is no Pricing estimate for the line.
- DN / Invoice prints: the description keeps its line breaks (`white-space:pre-line`).

## Rules
`approvals` create: `kind in ['pricing', 'quotation']` (was only 'pricing'). **Run `RUN_EMULATOR_TESTS.bat` on the PC
first** (tests/emulator/data-safety.test.mjs has the new case), then publish firestore.rules.

## Tests
- `tests/browser/service-quote-v27059.e2e.mjs` (new): cleaning / plain text, Format bar, SRV link + unit, scope line,
  Cost column + Show cost, formatted note, Sent reminders (link, cost) and self-approval, print, product estimate, Sales
  Order (scope line without link, costs carried, SO estimate), a 90-item formatted line over two pages.
- Harness option `costChecks` (older tests run without the Sent cost checks, like `requireLinks`).

## Upload
index.html, sw.js, js/app.js, js/quotation-ui.js, js/item-link.js, js/so-view.js, js/data-safety.js, js/doc-pages.js,
js/invoicing.js, **js/quote-rich.js (new)**, **js/quote-cost.js (new)**, **css/quote-rich.css (new)**.
Rules: firestore.rules (after the emulator run). No database change; no Company Settings save needed.

## V270.4.14.1 — lines follow the template (31 Oct 2026, Musthafa's screenshot)
Found on Al Hammadi Hospital / RFQ-1006: a Service quotation showed product-shaped lines (Code / Brand / Model, the
description under Qty, "Total · 0 Lines", Format bar never active).
- **Pricing of a Service RFQ** (`requestType 'service'`) now opens a **Service quotation**; its lines are service lines
  (formatted editors, cost from Pricing read-only). Product and Mixed RFQs stay Products.
- **The lines always follow the template** (`qtLinesFollowTemplate`, on opening and on every template change): a line built
  for the other template is rebuilt in this one — text (+ specifications as a second line), qty, unit, price, discount,
  link, cost and Pricing figures kept; note / heading rows get the right width.
- A **locked template is never switched by a click** (`setQuoteType` ignores it unless the screen is opening).
- Service quotations: wider unit box (Lumpsum, Month, Visit).
- Test: `service-quote-v27059.e2e.mjs` second test. Upload: index.html, sw.js (bizcore-shell-v27060), js/app.js,
  js/quotation-ui.js, css/quote-rich.css — plus the V270.4.14 files if not uploaded yet.

## V270.4.14.2 — Format bar fixed (31 Oct 2026, Musthafa: colours could not go back, Tab / indent not working)
- **Colour, size, highlight** now use BizCore's own engine (js/quote-rich.js `applyInline` / `flatten`) instead of the
  browser's: every piece of text has ONE span with its colour / size / highlight and the newest choice wins, so red →
  black, red → green → red, Large → Normal, highlight on → off all work, on selected words and while typing (caret only).
  Stored HTML is tidied (no nesting). Bold / italic / underline and lists stay the browser's commands.
- **Tab / Shift+Tab and ⇥ / ⇤**: in a list the item nests under the one above (up to 3 levels) or comes back out (at the
  top level it leaves the list); on an ordinary line (caret at its start, or several lines selected) the line is indented
  (`rt-ind-1…3`, kept in print and as spaces in the plain text). Tab in the middle of a line still moves to the next
  field.
- **Clear formatting** removes bold / italic / underline, colour, size and highlight of the selection only.
- Test: `service-quote-v27059.e2e.mjs` third test (every button and key). Upload: index.html, sw.js
  (bizcore-shell-v27061), js/quote-rich.js, css/quote-rich.css — plus V270.4.14 / .14.1 files if not uploaded yet.
