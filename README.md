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
