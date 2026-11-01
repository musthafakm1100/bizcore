# V271.3.1 — RFQs lost when another PC changed RFQs during the save (1 Nov 2026)

## What happened
During a joint test (BizCore open on three PCs), RFQ-2611-0019 and 0020 showed "Saved successfully — RFQ logged" but
were never written to Firebase and never appeared in the register (not in search, Recycle Bin or the Firebase console).

Cause: saving an RFQ put it in the screen's list of RFQs and then saved "the list". Before saving the list, some
existing priced RFQs were written first, which waits for Firebase. If another PC changed any RFQ in that moment,
Firebase refreshed the screen's list from the server — without the new RFQ — and the list that was saved no longer
contained it. Nothing was written, but success was shown. Reproduced in the simulator with two PCs; the 50 pasted
lines and the Excel data were not involved.

## Fix
- An RFQ is saved as **that one record**, straight to Firebase (`saveRFQs([rfq])`), and put back in the screen's list if
  a refresh removed it. "RFQ logged" means it is in Firebase. Used by: RFQ entry (new / edit), Pricing save, line
  order, new pricing revision, No Bid / Reopen, quotation → RFQ link, quotation delete, Sales Order → RFQ status.
- Saving one RFQ no longer re-writes other RFQs (fewer Firebase writes).
- The revision check uses the version the screen edited: a change saved meanwhile on another PC is reported ("changed
  by … after this screen read it"), never written over.
- Quotations: `saveQuotations()` now reports a failed save. A quotation Firebase refuses shows "Quotation not saved",
  the form stays open, and the RFQ is marked Quoted only after the quotation is saved.
- Sales Orders and Jobs were checked: they already save the record itself — no change.

No security rule change.

## Tests
- `tests/browser/save-race-v27131.e2e.mjs` (new): two PCs — PC A saves two RFQs with 50 lines each while PC B saves a
  change to another RFQ; both are in Firebase and on both screens, PC B's change is kept, a stale copy is refused, a
  refused quotation save is reported.
- Full unit and browser suites re-run.

## Upload
index.html, sw.js (bizcore-shell-v27131), js/app.js — on top of V271.3.
