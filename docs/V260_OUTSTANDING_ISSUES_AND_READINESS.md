# BizCore ERP V260 — Outstanding Issues, Risks & Production-Readiness Assessment

## 1. Production-readiness verdict

**V260 is ready for structured user-acceptance testing on the local emulator and on test data. It is not yet production-ready.** The Delivery Note architecture problem is solved in code and proven in simulator and browser tests, but three gates remain that can only be passed on your side:

| Readiness criterion (from the brief) | Status | Evidence / what is missing |
|---|---|---|
| DN histories no longer grow SO documents | ✅ Met (simulator + browser) | SO byte-identical after DN operations; 150 corrections + 60 DNs leave SO unchanged |
| Original 1 MiB failure resolved | ✅ Met (simulator) | Reproduced near-1 MiB SO; after migration + strip the SO is < 10 KB and corrections succeed. **Live confirmation on `SO-1790077442719` pending migration** |
| SO and DN quantities reconcile | ✅ Met (simulator + browser) | `reconcile` after every scenario incl. randomised concurrent runs |
| Transactional consistency verified | ✅ Emulator (9/9 on owner's PC) | Live confirmation during smoke test |
| Audit histories preserved | ✅ Met | One immutable event per revision; legacy history converted 1:1 |
| Migration & recovery tested | ⚠️ Simulator + browser | Emulator test of the Admin-SDK adapter pending; live rehearsal pending your approval |
| Security safeguards validated | ✅ Emulator (9/9) | Publish rules per runbook section C |
| Complete workflow passes integration testing | ✅ Simulator-backed browser | Real app, two users, 11-step workflow; live/manual UAT pending |
| No critical regressions | ✅ For DN scope | V259-parity test identical; no page errors; other modules smoke-tested only |

**Go-live sequence:** emulator suite green → manual UAT on emulator (checklist in LOCALHOST_TESTING) → backup + migrate + cutover + strip on test data (approval) → UAT on live test data → test-data reset decision → production use.

## 2. Outstanding issues and risks — Delivery Note scope

| Priority | Item | Mitigation / next step |
|---|---|---|
| P0 | No live run of migration | Rehearse on emulator, then on live test data with backup (runbook) |
| P1 | Role-based permissions postponed: any signed-in employee can dispatch/accept/void | Rules already enforce integrity; add role claims (e.g. `request.auth.token.role`) in the Role Management phase |
| P1 | Rules cannot verify arithmetic: they enforce that every DN change is paired with a new immutable event and a ledger update by the same signed-in user, but a signed-in employee bypassing the app (browser developer tools) could still write a consistent-looking but wrong quantity | Every such write is audited (actor + server time) and `reconcile` detects ledger/DN disagreement. For full server-side enforcement move the transaction service into Cloud Functions (callable) in the Role Management phase |
| P1 | All DNs are loaded by one listener (fine for thousands; three years of history may reach that) | Phase 2: paginate the DN register, query by SO/status/date, keep closed DNs out of the live listener |
| P1 | Implicit strip: after cutover any ordinary SO save writes the SO without its inert embedded copies | Intended (copies verified first); run `strip` right after cutover anyway; rollback then needs `restore` |
| P1 | Event `at` uses the client clock (display); `recordedAt` is server time (authoritative) | Use `recordedAt` for audit reports |
| P2 | DN numbers continue to be allocated by the shared counter; a failed transaction consumes nothing, but legacy V259-mode saves can still leave gaps (pre-existing) | Accept, or add a gap report |
| P2 | Already-installed PWAs keep V259 until refreshed | Rules block their DN writes after cutover; tell users to refresh once |
| P2 | Delivery confirmation still requires an employee sign-in (unchanged by design) | — |

## 3. Wider ERP architecture review (outside the DN implementation)

Reviewed by reading the V259/V260 source; no live data inspected. The aim: name concrete structural risks, not rewrite stable modules.

| Priority | Module / area | Finding | Risk | Recommendation |
|---|---|---|---|---|
| Fixed in V260 | Customer Invoice — line mapping | V259 looked up accepted quantities by SO row but DNs record the quotation line index; on an SO containing only some quotation lines, accepted quantities of later lines were never offered for invoicing. The Create-invoice button also vanished after the first partial invoice | Lost/blocked invoicing | Fixed: items linked by stable line ID / SO row; "Invoice remaining" button and Pending-invoice KPI follow the un-invoiced accepted quantity (browser test `invoice-remaining.e2e.mjs`) |
| Fixed in V260 (v261 build) | Embedded pictures in lines | Products created in older versions keep their picture embedded as base64 (~70 KB); V259/V260 copied it into every quotation / SO line (main cause of the 840 KB SO-1790077442719) | A quotation or SO with ~14 such lines would exceed 1 MiB and fail to save | Fixed: lines keep only a Storage link; `fbSave` drops any embedded `data:` picture from quotations / Sales Orders / RFQs; print falls back to the product picture (browser test `embedded-images.e2e.mjs`). Re-upload old product pictures when cleaning data so products themselves use Storage |
| **P0** | **Customer Invoice** | Invoices are embedded in `so.invoices` and saved by rewriting the whole SO document from the browser copy (`fbSave` set). The availability re-check before saving is local only | Two users invoicing the same SO at the same time can overwrite each other's invoice (lost financial record) or invoice the same quantity twice; invoices also grow the SO document | **V262 mitigation:** creating an invoice now requires the Sales Order lock (also enforced by the rules), the order is reloaded from the server when the lock is granted, and the save writes only that order and reports failures — so two users can no longer invoice the same order at the same time, and an acceptance cannot be corrected below the invoiced quantity. **V264 (built, not yet deployed):** invoices are `customerInvoices/{id}` documents with billing quantities in `salesOrderFulfillment`, written by one transaction and enforced by the rules; advances, bill-ahead invoices and credit notes; migration tool for the embedded invoices — see `V264_INVOICING.md` |
| Fixed in V262 | Concurrent work on one order | Two users could open the same Sales Order actions (dispatch, acceptance, invoice, payment, edit) at the same time | Conflicting changes; lost invoice/payment entries | ERP-style order lock enforced by app, service and rules; Administration → Document Locking (settings, history) and Active Locks (force release, logged). See `V262_DOCUMENT_LOCKING.md` |
| **P0** | Persistence layer (`fbSave`) — all modules | Whole-collection sync: writes any record whose JSON differs from the last server copy (last write wins, no revision check) and **deletes server records missing from the local array** | A stale or partially loaded browser can overwrite newer data or delete records in RFQ, Quotation, Masters, SO headers | Phase 2: per-record saves with `revision` preconditions (transactions) and no implicit deletes; deletes only by explicit action |
| P1 | Payments (future) | `so.payments` array on the SO | Same as invoices | Separate `customerPayments` collection with allocations |
| P1 | RFQ / Pricing | `pricingVersions[]` each holding full `pricingItems`, `vendorQuotes`, `internalCosts` snapshots inside the RFQ document | RFQ document grows with every pricing revision; large RFQs × many versions can approach 1 MiB | `pricingDocuments/{id}` + `versions/{v}` subcollection; RFQ keeps a pointer to the current version |
| P1 | Quotation revisions | Quotation is one document with embedded items; revisions create new documents (OK) | Very large quotations only | Size guard (warn ≥ 512 KiB already logged by V260's diagnostics) |
| P1 | Settings | One `settings/main` document storing the entire settings object as a JSON string (incl. logo/letterhead references, numbering, templates) | Grows with modules; a stale browser overwrites all settings at once | Split by area (`settings/company`, `settings/numbering`, …) with field-level updates |
| P1 | Users, roles, cost components, UOM master, admin PIN | Stored only in the browser's `localStorage` (`bizcore_users`, `bizcore_roles`, `bizcore_uom_master`, `bizcore_cost_components`, `dtq_admin_pin`) | Not shared between users/devices, lost when browser data is cleared; the PIN is not a security control | Move to Firestore with rules; real authorisation via Firebase custom claims |
| P1 | Recycle Bin | Deleted records are copied whole into `recycleBin` | A deleted large record (e.g. an RFQ with many versions) can exceed 1 MiB; restore can resurrect stale data | Store a pointer + soft-delete flag on the original document instead of a copy |
| P1 | Local cache | Full arrays mirrored to `localStorage` | Quota errors with 3 years of data; stale data shown before sync | Rely on Firestore's persistent cache; keep only UI preferences locally |
| P2 | Purchase Order / Purchase Invoice (future) | Not implemented | — | Build on the V260 standard from day one (below) |
| P2 | Historical import (≈ 3 years from Excel) | — | Import through the browser would hit the issues above | Admin-SDK import tool reusing `tools/dn-migration` patterns (deterministic IDs, preflight, verify, idempotent batches) |

### Standard for every new or refactored module (adopted from V260)
1. One business document per Firestore document; no unbounded arrays of child transactions or history.
2. Immutable line IDs; never link by row position.
3. Quantities/balances in a bounded ledger updated in the **same transaction** as the business document.
4. Immutable audit events in a subcollection; rules make them create-only.
5. Deterministic operation IDs for idempotency; `expectedRevision` captured when the screen opens.
6. Browser sends intent; the transaction reads authoritative data and validates.
7. Size guards below 1 MiB; structured error codes; no "network error" for data errors.
8. Migration through an admin tool: backup → preflight → freeze → migrate → verify → cutover.

## 4. Recommended phased plan
* **Phase 1 (now):** close the DN gates above; go live with independent DNs.
* **Phase 2:** Customer Invoices + Payments on the DN pattern (P0 before real invoicing); per-record saves with revisions for SO headers; DN register pagination.
* **Phase 3:** Role Management with Firebase custom claims and role-aware rules; move users/roles/UOM/cost components to Firestore.
* **Phase 4:** Pricing versions as subcollections; settings split; recycle-bin redesign.
* **Phase 5:** Purchase Orders / Purchase Invoices / Finance on the standard; Excel historical import tool.
* ZATCA Phase 2 e-invoicing stays with Zoho Books as previously decided.
