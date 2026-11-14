# V270.4.7 — Phone "⋯" menu and iPhone PDF (29 Oct 2026)

Reported by Musthafa on 29 Oct (iPhone, after V270.4.6): the "⋯" More menu does nothing on the Invoice and Payment
Receipt views; a Delivery Note saved as PDF from the iPhone looks wrong (DN-2610-0004, PC vs iPhone PDFs).

## 1. "⋯" More menu on the Invoice / Credit Note / Receipt views (phone)
- Cause: on a phone the bottom action bar of `#inv-view-modal` scrolls sideways (`overflow-x:auto`), which also clips
  everything outside the bar — and the menu opens *above* the bar, so it was cut away (it did open, invisibly).
  The Quotation footer has no such setting, so its menu worked. (V270.4.6's test only checked the zoom bar.)
- Fix (`css/invoicing.css`): when the bar has the More button (`.bc-has-more`, buttons collapsed into the menu) it no
  longer clips (`overflow:visible`). Without the More button the bar still scrolls sideways as before.

## 2. PDF / print on iPhone and iPad
Measured on the two PDFs of DN-2610-0004: iPhone Safari prints about **20% larger** and lays the page out about **20%
narrower** than A4 → the right side ("DELIVERY NOTE" box) was cut off; Safari also ignores the page margins we set,
drops the footer that is pinned to the page bottom (`position:fixed`), and adds its own web address / date / page line.
Android (Chrome) prints like the PC — checked by printing a test DN the Android Chrome way (same engine as the PC).

Fix, **iPhone / iPad only** (`js/print-ios.js`, new; PC and Android untouched):
- print windows get `@media print { html { zoom: .8 } }` → the same layout as the PC;
- the page footer (`.dn-foot`, quotation `.fixed-footer`) is placed at the end of the document instead of pinned to
  the page bottom (on a document longer than one page it appears once, at the end).
- Applied to every customer document: Delivery Note, Invoice, Credit Note, Payment Receipt (`invPrintDocument`),
  and all Quotation templates (`_tplOpen` and the Professional template).
- Not possible from a web page: removing Safari's own web-address / date line at the bottom (added by the iPhone).
- Internal prints (Sales Order status, Cash statement) are unchanged.

## Files to upload
index.html, sw.js (`bizcore-shell-v27050`), **js/print-ios.js (new, ?v=270.50)**, js/app.js (?v=270.50),
js/invoicing.js (?v=270.50), css/invoicing.css (?v=270.50). No rules, no data, no Firebase change.
(Includes V270.4.6 — if that is not uploaded yet, use the cumulative `BizCore_V270.4.7_upload` folder.)

## Tests
`tests/browser/phone-menu-print.e2e.mjs` (new): on a phone the More menu opens, is the top element where it is drawn
and stays inside the window — Quotation, Invoice, Credit Note, Receipt (fails without the fix); on a PC print windows get
no iPhone style; with an iPhone browser the Quotation and Receipt print windows carry it.
The iPhone result itself can only be checked on an iPhone (the simulator here is Chrome).

## Try on the iPhone
1. Invoice view → "⋯" → menu shows Close / Sales Order / Edit / … ; same on a Receipt and a Credit Note.
2. DN-2610-0004 → Print / PDF → Save as PDF: full width, nothing cut off, normal size, company footer after the
   signatures. Also an Invoice, a Receipt and a Quotation.
