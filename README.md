V187 Delivery Confirmation UX update

- Compact accepted/rejected controls on desktop and mobile
- Accepted green / Rejected red visual separation
- Keeps both quantity controls on one mobile row
- Independent quantity entry with immediate validation
- Inline invalid-line messages and status badges
- Confirmation scrolls/focuses first invalid line
- Fixed viewport action message above mobile sticky footer
- Rejection details expand only when rejected qty > 0

# BizCore — Downtown Trading Est.
## Consolidated Build — August 2026

This is the complete, consolidated BizCore package with all features built to date.
Replace your existing BizCore folder entirely with these files going forward, so
there's only ever one working copy to keep track of.

## How to run locally (for testing before uploading to GitHub)
1. Double-click `start_server.bat` (requires Python installed on your PC)
2. Open your browser to `http://localhost:8000`
3. Log in with your Firebase account exactly as on the live site
   (works locally because `http://localhost/*` is in the allowed Firebase domains)

## How to deploy
Upload all files/folders below to your GitHub repository (musthafakm1100/bizcore),
commit, and wait ~3 minutes for GitHub Pages to rebuild.

## File structure
```
index.html          — main app shell + Firebase module (auth, Firestore, offline cache)
login.html           — login screen with BizCore logo
js/app.js             — all application logic
css/main.css           — main stylesheet
css/bizcore-design.css  — design tokens
css/typography.css       — font/text styles
css/masters.css           — master data screens (Tax, UOM, etc.)
start_server.bat            — local test server (Windows, requires Python)
```

## Features included in this build

**Core workflow**
- RFQ → Quotation → Sales Order → Delivery → Invoice
- Customer, Supplier, Product, Employee directories
- Pricing sheet with per-line supplier tracking
- Tax Master, UOM Master, Cost Components, Margin Statuses
- Users, Roles, Permissions Matrix (foundation for future role-based access)
- Quotation Revisions

**Cloud & multi-user**
- Firebase Authentication — secure login, no shared passwords
- Firestore cloud database — shared data across all devices in real time
- Offline support — works with no internet, syncs automatically on reconnect
- Real-time sync with smart rendering — updates appear instantly without
  disrupting whatever screen a user currently has open
- Online/Offline status badge in the top bar

**Data integrity & safety**
- Atomic quotation numbering — guarantees no two users (even offline) can
  ever generate the same quotation number
- Offline-created quotations get a temporary tagged number, automatically
  renumbered to the correct sequential number once back online
- Document presence locking — warns if another user is already editing the
  same quotation/RFQ, with live "last active" status and a "Take over" option
- Delete restricted to Draft-only quotations with no linked Sales Order
- Deleted drafts go to a Recycle Bin (restore or permanently purge) —
  never an immediate, unrecoverable delete
- Cancel (with mandatory reason) for any quotation once it has been sent —
  the record and its number remain permanently for audit purposes
- Quotations linked to a Sales Order can never be deleted or cancelled

**Documents & printing**
- 4 quotation print templates: Professional, Classic, Modern Bold, Arabic/English
- Correct A4 print margins, repeating footer, and page numbering (Page X of Y)

**Data import**
- Excel bulk import for Customers, Suppliers, Products, Employees —
  downloadable template, validation, and duplicate detection

**Branding**
- BizCore logo (ascending bars, blue & orange) — used on login screen,
  browser tab favicon, and throughout the app

## Firebase project
Project ID: `bizcore-downtown`
Firestore security rules: only authenticated users can read/write
API key restricted to: `https://musthafakm1100.github.io/*` and `http://localhost/*`

## What's next (not yet built)
- Purchases module (supplier POs)
- Expenses
- Cash Ledger
- Bank Transactions
- Inventory / Stock
- Reports (P&L, aging receivables, sales summary, stock valuation)
- Role-based access control (Option B — restrict what different employees can see)

## Shared sticky toolbar alignment
- Normalized `.page-toolbar--sticky` from the later conflicting `top: 8px` override to `top: 0`.
- This applies the verified no-gap sticky behavior to all screens that currently use the shared sticky toolbar class (including Pricing and RFQ) and to future screens that adopt it.
- RFQ retains its tested table-header offset of 48px directly below its sticky toolbar.
- Quotation, Sales Order, Delivery Note, and Invoice layouts that are not currently implemented with this shared sticky toolbar were intentionally not forced into a new sticky layout.

v28 page action standard:
- Document-specific primary actions live in the document page header, not the global top bar.
- Quotation Recycle Bin moved to page header before New Quotation.
- Quotation filter bar now contains filters only; Clear Filters replaces Recycle Bin there.
- Quotation status selection is driven from the Overview; the legacy select remains hidden as state only.
- Added Revised and Cancelled to Quotation Overview.
- Sales Orders now has the same dedicated page-header action hierarchy, using Create from Quotation to respect the existing document flow.

## v29 — Register Toolbar & Typography Standard
- Added Clear Filters at the far right of RFQ, Pricing, Quotation and Sales Order filter toolbars.
- Quotation toolbar standardized: Sort at far left; Customer, Date, Search and Clear Filters at right.
- Quotation and Pricing table typography normalized to the RFQ register standard (header 12px/600; body 12.5px/400; key document/customer cells 13px).
- Delivery Note and Invoice registers remain foundation screens; this standard is to be inherited when their filters/registers are implemented.

## v32 Quotation RFQ typography sync
- Quotation register now uses RFQ register typography values as the visual source of truth.
- Quotation Number: 13px, RFQ document-number color (#173a5e), regular weight.
- Customer Name: 13px, RFQ customer color (#2f3a45), regular weight.
- Other body cells: 12.5px / regular / #334155.
- Header cells: 12px / 600 / #536273.
- RFQ-equivalent row height, padding, borders and hover behavior.

## v175 — Arabic / English template clean rebuild
- Deleted the separate legacy Arabic / English quotation renderer.
- Recreated Arabic / English directly from the approved Standard Product A4 print/PDF master.
- Arabic / English now inherits the same structure, dimensions, spacing, line notes, terms/totals arrangement, signatures, pagination and footer as Product.
- Only bilingual labels/content are added; there is no separate visual layout to drift from the approved base.

## V186 — Mobile-first Delivery Confirmation
- Redesigned Confirm Delivery as a compact, modern operational workspace.
- Added touch-friendly +/- quantity controls while retaining direct numeric entry.
- Added automatic Fully accepted / Partial / Rejected line states and live summary chips.
- Added clearer authenticated-user banner and Customer Receipt section.
- Added sticky mobile action bar, safe-area support, larger touch targets, and responsive layouts down to narrow phones.
- Existing delivery acceptance validation, rejection reasons/disposition, persistence, and confirmation workflow remain unchanged.

## v193 — Delivery Acceptance Correction, Revision & History
- Confirmed delivery acceptance is locked as an auditable event.
- Added Correct Confirmation for data-entry mistakes with mandatory reason.
- Added Revise Customer Acceptance for genuine post-confirmation acceptance changes with mandatory reason.
- Original confirmation and every later change are retained in an immutable-style acceptanceHistory event list.
- Current accepted/rejected quantities continue to drive SO remaining quantity calculations.
- Added compact History timeline to the DN acceptance card.

## v196 Responsive Audit
- Added screen-specific responsive system across phones, tablets, laptops and desktops.
- Fluid mode for forms/detail screens.
- Adaptive mode for registers and overview/toolbars.
- Wide Workspace mode for Pricing with controlled horizontal scrolling rather than squeezed columns.
- Improved modal sizing, touch targets, table scrollers, pagination, topbar, form stacking and landscape-phone handling.
- No business logic changes; V195 Delivery Confirmation quantity synchronization retained.

## v202 — DN notification trigger fix
- Delivery Confirmation now creates a notification immediately in the same logged-in session after the DN save succeeds.
- Rejected/partially accepted confirmations therefore update the bell count without refresh.
- Correction and Revision saves also create distinct notification entries.
- Operational events remain enabled for other logged-in sessions/devices; the local session is not dependent on its own realtime echo.

## v205 — Register header alignment & sticky restoration
- Restored desktop sticky register headers by removing the unintended overflow containing block around register workspaces.
- Corrected sortable numeric/center header geometry so headings align with their data columns.
- Preserved controlled horizontal scrolling on compact Pricing/Quotation/Sales Order workspaces.

V207: Refined Delivery Confirmation expanded details typography, filters, quantity cards, exception panel and metadata hierarchy.

V209: Delivery Note viewer now fills the available viewport edge-to-edge, removing the top/bottom modal gaps while preserving the sticky bottom action bar and print behavior.

V214 DN print return + Save-as-PDF filename
- Based directly on stable V209.
- After native print/save dialog closes, temporary DN print tab returns focus to BizCore DN and closes where browser permits.
- Print document title/default Save-as-PDF filename now uses: DN Number - Customer Name.
- Filename characters invalid on Windows/macOS are sanitized.
- No direct PDF generator, html2canvas, or print-layout redesign added.


V215 deployment consistency fix:
- Cache-busts app.js and core CSS for hosted/GitHub deployments.
- Bumps the PWA service-worker cache and disables service-worker update caching.
- Reasserts the DN print title immediately before printing so Save as PDF uses DN No. - Customer Name.
- Keeps the approved V214/V209 DN print template unchanged.


## v216
- Applied the proven DN hosted/PWA print lifecycle to quotation output.
- Save-as-PDF title uses Quotation No - Customer Name.
- After print/save, focus returns to the quotation screen and the temporary print window closes where allowed.
- Bumped app/service-worker cache version to v216 for GitHub/PWA consistency.

## v217
- Redesigned Delivery Note Format chooser as a compact centered visual modal with icon cards, clear selected state, compact footer, and responsive mobile sizing.


## V218
- Sales Order dispatch eligibility now uses accepted + in-transit quantities rather than historical dispatched quantity.
- Customer-rejected quantities return to Remaining and re-enable Dispatch delivery for replacement/redelivery.
- Existing SO status logic remains acceptance-based: rejected remainder results in Partially Delivered when some quantity was accepted.


## V219
- RFQ no longer advances to Pricing merely by opening the Pricing screen.
- RFQ advances to Pricing only after a successful Pricing save.
- Legacy RFQs falsely marked Pricing without saved pricing content display as New.
- RFQ status display uses the clearer label In Pricing.
- GitHub/PWA shell cache bumped to v219.


## V220
- RFQ Overview label changed from “Waiting Pricing” to “Awaiting Pricing”.
- Awaiting Pricing now counts RFQs whose workflow stage is New (no saved Pricing record yet), including overdue RFQs that are still unpriced.
- Overdue remains a separate overlapping urgency indicator and is not added on top of the Awaiting Pricing total.
- Clicking Awaiting Pricing now filters to the same New/unpriced RFQ population.
- GitHub/PWA shell cache bumped to v220.


## V221
- Added global context-aware return navigation for linked document view screens.
- Closing a linked Quotation, RFQ, Pricing detail, Sales Order, or Delivery Note returns to the exact source modal when available.
- Direct/register-opened documents still close normally to their register.
- Added reusable `closeViewWithReturn(modalId)` standard for future BizCore view/detail windows.
- GitHub/PWA shell cache bumped to v221.


## V222
- RFQ Detail -> Edit RFQ now returns to the same RFQ Detail on Cancel/Close.
- Saving an edited RFQ also returns to and refreshes the same RFQ Detail.
- Entry close transitions now honour the global V221 return-navigation stack.
- GitHub/PWA shell cache bumped to v222.

## V223 — Flicker-free RFQ View/Edit transition
- RFQ Detail -> Edit keeps the detail screen painted until the edit form is ready, then swaps atomically.
- Edit RFQ -> Close/Cancel returns synchronously to the same RFQ Detail without an intermediate register/transition render.
- Preserves the V221/V222 global return-navigation context and existing edit-lock behavior.


## V224 — RFQ Editor Blocking Overlay
- Edit RFQ now shows the global blocking overlay immediately while the editor and edit lock are being prepared.
- Overlay message: “Opening RFQ Editor…” with the standard BizCore progress treatment.
- Prevents clicks, keyboard interaction and duplicate actions on the RFQ Detail during the loading delay.
- Preserves V223 flicker-free behavior: RFQ Detail remains painted underneath until the editor is ready, then the editor is revealed directly.
- Uses the reusable global BizCore screen-transition manager so the same pattern is available to future slow screen transitions.


## V225 — Deterministic Repeated Edit Navigation
- Fixed intermittent RFQ Detail → Edit → Close → Edit race that could fall back to the RFQ Register.
- Modal return context is now unique per destination; stale Edit return entries are removed before a new transition.
- Editor UI closes synchronously before asynchronous document-lock release, preventing overlapping open/close states.
- Reopening Edit waits for any previous lock release to finish before reacquiring the RFQ lock; the V224 blocking overlay remains active during the wait.
- Applied the same lock-release serialization to quotation editing for the global navigation standard.

## V226 — Sales Order Accepted Delivery Status
- SO fulfilment status now follows customer-accepted quantity: any accepted partial quantity keeps the order at Partially Delivered even while the balance is in transit.
- Out for Delivery is used when nothing has yet been accepted and an unconfirmed DN is in transit.
- Delivery progress now measures accepted delivery only; in-transit quantity no longer inflates the accepted percentage.
- Order Items columns clarified to Accepted, In Transit, and To Dispatch.
- Added separate in-transit/to-dispatch indicators and previous rejection notice.

## V227 — Standard Price Revision Dialog
- Replaced the browser-native Pricing revision `prompt()` with the standard BizCore reason modal.
- Added Price Revision title, explanatory audit-history message, required multiline Revision Reason field, inline validation, Cancel and Revise Pricing actions.
- Revision logic/history remains unchanged; only the interaction is standardized.
- Enhanced the shared reason modal so future revision/cancellation workflows can reuse the same BizCore treatment.
- GitHub/PWA shell cache bumped to v227.

V229: Simplified Customer Invoice entry and added accepted-quantity partial invoicing. Available invoice quantity is customer accepted minus previously invoiced; invoice items and partial totals are stored per invoice.


## V231
- iPhone/Safari compatible repeated Delivery Note QR scanning.
- Uses native BarcodeDetector when available and jsQR camera-frame decoding fallback on Safari/iPhone.
- Fully releases video tracks/srcObject between scans and guards scanner restart state.


## v233
- Prevents Dashboard flash when a Delivery Note QR deep link is opened; a neutral Opening Delivery Confirmation overlay remains until the target workflow is ready.
- Scan Another QR routes inside the SPA instead of reloading index.html, avoiding Dashboard exposure between scans.
- iPhone/Safari QR fallback now attempts multiple decoder CDNs when native BarcodeDetector is unavailable.
- Scanner stays in Starting QR scanner state until a decoder is actually ready.
- PWA cache/version bumped to v233.


## v233
- Fixed repeated QR scanning session lifecycle on mobile: old deep-link/navigation state can no longer close a newly opened scanner.
- Mobile QR Finish now ends on a controlled completion screen and attempts to close the QR-opened window when the browser permits; it never exposes the ERP screens.
- Desktop QR Finish keeps BizCore open and returns to the completed Delivery Note.


### v234 – Mobile QR Cancel & Close controls
- Mobile QR Delivery Confirmation Cancel now asks for confirmation and never leaks into Dashboard/DN/ERP screens.
- Cancel Update ends on a controlled mobile screen with Scan Another QR and Close.
- Successful mobile QR completion now provides actual Scan Another QR and Close controls.
- Close attempts browser/tab close; when iOS Safari blocks scripted closing, BizCore remains on a protected exit screen with a Close Window control/instruction.
- Desktop/PC cancellation and completion retain normal BizCore behavior.

### v235 – Mobile QR Fast Open & Cancel Exit Fix
- QR deep links now open Delivery Confirmation directly once authenticated delivery data is ready, without first rendering the Delivery Note register/overview.
- Mobile QR flow state is retained explicitly so Cancel cannot fall through to Delivery Access/Login when responsive/device state changes.
- Cancel Update places the protected QR exit screen before closing the confirmation modal, preventing underlying ERP/login screens from flashing or becoming the destination.
- PWA app/SW cache references bumped to v235.


## v237 — Mobile QR terminal cancellation
- Rebased the V236 mobile QR terminal cancellation fix onto the latest GitHub main branch.
- Mobile QR Cancel/Back/Close remains in the protected QR exit flow and cannot fall through to Dashboard.
- Desktop navigation remains unchanged.
- PWA shell cache bumped to v237.
