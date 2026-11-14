# V270.4.5 — Mobile zoom (27 Oct 2026)

Agreed with Musthafa on 27 Oct: keep the app frame still on phones and tablets, no zoom when typing, and zoom
only the document pages. Field sizes unchanged (no 16 px fields), no Administration switch. Mockup DZ_1 (zoom bar).

## What changed
1. **App frame never zooms**
   - Viewport on index.html, mycash.html, delivery.html, login.html:
     `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no` (+ `viewport-fit=cover` where it was).
     Android Chrome: no pinch zoom, no zoom when a field is focused. iPhone: no zoom when a field is focused.
   - iPhone Safari ignores the pinch limit (Apple accessibility rule), so `js/doc-zoom.js` stops Safari's
     `gesturestart/gesturechange/gestureend` and any two-finger `touchmove`; `css/mobile-zoom.css` sets
     `touch-action: pan-x pan-y` on the root (no pinch / double-tap zoom, one-finger scrolling unchanged).
   - `overscroll-behavior: none` on html / body: no edge bounce or pull-to-refresh (the "floating" feel; a
     pull-to-refresh could also lose unsaved work).
   - The phone's own accessibility zoom and text-size settings still work.
2. **Document pages zoom on their own** (`js/doc-zoom.js`, `window.BCDocZoom`)
   - Pages: `.qdoc-sheet` (Quotation) and `.dn-a4` (Delivery Note, Invoice, Credit Note, Payment Receipt).
   - Pinch (two fingers) zooms the page around the fingers; one finger pans with normal scrolling.
   - Double-tap: Fit → 100% → 200% → Fit, centred on the finger.
   - PC: Ctrl + mouse wheel or a trackpad pinch zooms the page only.
   - Bar (mockup DZ_1) at the bottom right of the visible page, above the window buttons: − · % · + · Fit.
     100% = printed A4. Range: Fit (or 50% on a PC) to 400%. Steps 25 33 50 67 75 90 100 110 125 150 175 200 250
     300 400 %; − stops at Fit. Semi-transparent on a PC until the mouse is over it. Hidden on the Details tab and in
     Print / PDF.
   - The fit code hands its fit-to-width scale to `BCDocZoom.fit(doc, base)`: `fitDocuments` (js/responsive.js) and
     `dnFitA4` (js/app.js). A height-only resize (iPhone address bar) keeps the user's zoom; a width change
     (rotation) goes back to Fit. When zoomed wider than its area the page's container scrolls sideways
     (inline `overflow-x:auto !important`, `justify-content:flex-start`).
3. **Details / Document tab bar** (Quotation, Invoice, Credit Note, Receipt on a phone): it now sticks to the very
   top edge of the window body, over the body padding, so a scrolled or zoomed page no longer shows above or beside it.

4. **Document tab first** (Musthafa, 27 Oct): on Quotation, Invoice, Credit Note, Receipt and Delivery Note views the
   tabs read **Document | Details** and the Document tab opens by default on every screen size (was Details first on a phone).

5. **Desktop fix** (Musthafa, 27 Oct): on a PC the pages were fluid (Quotation `max-width:100%`, Delivery Note /
   Invoice / Credit Note / Receipt `width:auto`), so a zoom squeezed the content into the same width. BCDocZoom now
   holds every page at A4 (210 mm, `!important` inline) and the fit is worked out on every screen size
   (100%, smaller only when the area is narrower than A4).

6. **Drag to pan on a PC** (approved 27 Oct): when the page is zoomed wider than its area the pointer is a hand;
   hold the left button and drag in any direction (`.bcz-pan` / `.bcz-grabbing` on the page's container). At normal
   size nothing changes, so text can still be selected. Shift + wheel also scrolls sideways.

PDF attachments (vendor quotes) still open in the phone's own PDF viewer (its own zoom). Nothing is stored; no data,
rules or Firebase change.

## Files to upload
index.html, mycash.html, delivery.html, login.html, sw.js (`bizcore-shell-v27048`), **js/doc-zoom.js (new)**,
**css/mobile-zoom.css (new)**, js/responsive.js (?v=270.47), js/app.js (?v=270.47), js/doc-zoom.js + css/mobile-zoom.css (?v=270.48).

## Tests
tests/browser/mobile-zoom.e2e.mjs (new, 2 tests): frame (viewport, touch-action, no zoom on a pinch or on focus),
Quotation on a phone (fit, bar position, Details hides the bar, pinch, double-tap cycle, + / −, address-bar resize),
Delivery Note on a PC (Ctrl + wheel, Fit) and on a phone, Invoice on a phone.

## Try on the phone
iPhone and Android, in the browser and as the installed app: pinch on a register (nothing zooms), tap the search
box (no zoom), open a Quotation / Delivery Note / Invoice → Document → pinch, pan, double-tap, the bar.

Fixed: the desktop zoom issue (item 5).
Open (29 Oct, to fix with the next change): the phone "⋯" More menu opens behind the zoom bar.
