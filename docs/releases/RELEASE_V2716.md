# BizCore V271.6 — Scope of Work for Service / Contracting quotations

Base: V271.5.41. All three agreed phases (A, B, C) in one release, built to the mockups approved on 9–10 Nov 2026
(boards 6–13).

> **Before you publish:** this release adds security rules for three new record types. Run
> `RUN_EMULATOR_TESTS.bat` on your PC first (new test file `tests/emulator/scope-v2716.test.mjs`), then publish
> `firestore.rules` yourself. The emulator tests could not run in my workspace (the emulator download is blocked
> there), so **they have not been run yet**. Until the rules are published, saving a quotation that has scope text,
> Text Blocks, and the Job's scope copy will be refused by Firebase.

## Phase A — the scope line, work categories, RFQ → quotation

**Master Data: Products and Services are separate entries.** Both open the same Item Master, already filtered:
*Products* shows goods (ITM-…), *Services* shows services (SRV-…) without Image / Brand / Model, with a *Standard
scope* column. **+ Add** opens the form already set to the matching type. Nothing changes for Pricing, the
Quotation item search, RFQs or numbering — they use the same `type` flag as before. (The old Type filter is
replaced by the two entries.)

**A scope line = a short title + its full scope.** On a Services quotation every line has:
- the **title** (one line, up to 200 characters) — the only text that goes to the Sales Order, Delivery Note and
  Invoice;
- the **scope of work** under it, as wide as the line (under Qty … Line Total), with the existing Format bar
  (bold, italic, colour, size, highlight, lists, indent). Long scopes fold to a short preview with *Show all (n lines)*;
- **Expand** opens a full editor (title, scope on an A4-like sheet, category, qty / rate shown, word and size count,
  View customer's original, Insert block here, Insert from a previous quotation, Save selected text as block, Restore
  RFQ text).

**Work category — required on Services quotations.**
- RFQ (Contracting only): an optional *Work category* on the Requirements tab ("Not decided yet" allowed).
- Quotation: a **Category \*** in the Items toolbar — the default. It comes from the RFQ when the RFQ has one.
- Every priced line carries a category chip; a line can have its own (shown in orange when it differs from the
  default). Lines without their own category follow the default.
- Saving is blocked until the default and every line have a category. The categories are the *service* categories of
  Master Data → Categories; *+ New category…* adds one there.
- The summary panel shows **By work category** (internal, never printed).

**RFQ requirements → starting scope (copied once).** When the RFQ has requirements text, a banner offers
**Use as starting scope**: the text is copied into the selected (or first empty) line's scope, tagged
*Copied from RFQ*, and marked *Edited* once you change it. It is a copy — the RFQ keeps the customer's original
(**View customer's original** at any time), and later RFQ edits don't change the quotation. A wrong RFQ is still
corrected with Edit RFQ.

**Storage (Firebase free tier).** The scope text is **not** stored in the quotation record (registers load all
quotations at start-up). Each quotation with scope text has one body record,
`quotations/{id}/bodies/main`, written in the **same commit** as the quotation and read only when the quotation is
opened, printed, revised or duplicated (1 read). The quotation line keeps the title, the category and a 180-character
preview. Limits: 30,000 characters of formatted text per line, 700,000 for a quotation. Revisions and duplicates get
their own copy (new keys) — nothing is ever linked between quotations.

**Older Services quotations** open as before; on opening, a line's old formatted description becomes its scope and
its first line becomes the title (check and shorten the title when you next edit it). Quotations you don't edit
print exactly as before.

## Phase B — Text Blocks (Master Data → Proposal Text)

- **Master Data → Proposal Text → Text Blocks**: title, section (Scope, Technical spec, Deliverables, Inclusions,
  Exclusions, Assumptions, Warranty, Terms), applies to (Product / Service / Contracting), formatted text, use count;
  New, Save, Deactivate / Activate. Changing a block changes only later inserts.
- **Insert…** (Items toolbar, both templates) → the picker: search, section chips, preview, and the three agreed
  targets — **New heading + note**, **Note under the selected line**, **Add to the Remarks tab**. Notes inserted
  this way use the new note style **Plain Text** (no "Note:" label). In the full editor a block goes in at the cursor.
- **Save as Text Block…** from the line menu of a note, or *Save selected text as block…* in the full editor.
- Blocks are read only when the picker or the tab opens (kept 2 minutes).
- New permission **Master Data → Text Blocks** (View / Create / Edit / Cancel = deactivate). Inserting a block needs
  only Quotations. Built-in Sales role: View / Create / Edit; Administrators: everything.
  **Custom roles:** tick *Text Blocks* in Administration → Roles & Permissions for the people who maintain the library.

## Phase C — previous quotations, standard scope, annexure printing, Job scope

- **Insert from a previous quotation** (second tab of the picker): this customer's quotations first; tick lines;
  insert as **new lines** (title, scope, qty, unit — no rate) or **into the scope of the selected line**. Tagged
  *From QT-…*. The source quotation is not changed.
- **Standard scope on a service item** (optional, Master Data → Services → the item form). When a line is linked to
  that service and its scope is still empty, the standard scope is copied in (tagged *Service standard scope*); the
  service's category becomes the line's category if the line has none. Stored as `textBlocks/svc_{item}`.
- **Printing long scopes** — Settings → Quotation Print → *Long Scope of Work*: **Automatic** (default: inline when
  short; a line with more than about 10 lines / 900 characters goes to the annexure), **Always inline**,
  **Always as annexure**. The same choice appears in the Print / PDF window for each print. Annexure lines show
  "Detailed scope: Annexure A, item N"; **Annexure A — Scope of Work** follows the quotation on its own pages, with the
  template's footer and page numbers (Arabic heading on bilingual templates). The *Professional* template always
  prints inline.
- **Job → Scope tab**: when a job is created from a won quotation, its accepted scope is copied to the job
  (`jobs/{id}/scope/main`, same commit) and **frozen** — later quotation changes don't touch it. The tab shows the lines
  with categories and amounts, *Scope by work category*, and **Print scope for site team** (no prices). Jobs created
  before V271.6 show a note pointing to the quotation. Variations are for a later version, as agreed.

## Fix — the Estimation screen that could not be closed (since V271.2)

Estimation (view only) → **Open Quotation** → Edit → Close → Close brought the Estimation screen back **empty**
("Back" only showed the window again; *Open Quotation* had already cleared it), so its Close / ✕ / Versions / Revise
did nothing. Now "Back" loads that estimate again (same RFQ and version), and Close / ✕ always close the screen.
`js/estimate.js`, `js/app.js` (loaded as `?v=271.6.1`, service-worker cache `bizcore-shell-v27161`, so browsers that
already have V271.6 pick the fix up). Test: `tests/browser/quote-job-v2712.e2e.mjs` (second test).

## Security rules (firestore.rules) — publish after the emulator tests

- `quotations/{id}/bodies/{bid}` — read with Quotations → View (and the own-records rule of the quotation);
  written only as `main`, with its own quotation id, together with an existing quotation, by Quotations create/edit;
  deleted by administrators only.
- `textBlocks/{id}` — read with Text Blocks, Quotations or Products → View; add / change / deactivate with the Text
  Blocks rights; Quotations users may only move the use count; `svc_…` (standard scopes) are saved with the Products
  rights; deleted by administrators only.
- `jobs/{id}/scope/{sid}` — created only as `main`, together with the new job, by Sales Orders → Create; never changed;
  deleted by administrators only.

## Files

New: `js/quote-scope.js`, `css/quote-scope.css`, `tests/browser/scope-v2716.e2e.mjs`,
`tests/emulator/scope-v2716.test.mjs`.
Changed: `index.html`, `sw.js` (cache `bizcore-shell-v27161`), `js/app.js`, `js/quotation-ui.js`, `js/jobs.js`,
`js/rfq-entry.js`, `js/estimate.js`, `js/permissions-ui.js`, `js/role-core.mjs`, `js/role-service.mjs`, `js/user-service.mjs`
(import version only), `js/quote-rich.js` (longer formatted text allowed), `firestore.rules`, `package.json`,
`tests/emulator/package.json`, `tests/browser/harness.mjs`, `tests/browser/service-quote-v27059.e2e.mjs`,
`tests/browser/products-b1.e2e.mjs`, `tests/browser/quote-job-v2712.e2e.mjs`.

## Testing (my workspace, simulator — no live data)

- Unit tests: 150 / 150 pass.
- Full browser suite (`npm run test:browser`): 94 / 94 pass (90 earlier + 4 new). The new
  `scope-v2716.e2e.mjs` covers the Products / Services split, the RFQ work category, required categories, the RFQ
  starting scope, the full editor, Text Blocks (tab, insert, use count), insert from a previous quotation, the body
  record saved and read back in a new session, Annexure A printing, and the Job's Scope tab and site print.
- Emulator rules tests: **not run** (blocked here) — run `RUN_EMULATOR_TESTS.bat` before publishing the rules.
- Nothing was deployed, uploaded or published.
