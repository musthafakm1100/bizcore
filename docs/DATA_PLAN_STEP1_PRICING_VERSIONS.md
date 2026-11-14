# Data plan, step 1 — Pricing versions out of the RFQ document (BUILT in V269 — see docs/V269_PRICING_VERSIONS.md; migration, backup and switch dropped: test data only)

Written 18 Oct 2026 for Musthafa's approval. No code has been changed for this step.

## 1. Why
Today every RFQ is **one Firestore document** that carries **all its pricing versions**: `rfqs/{id}.pricingVersions[]`. Each version holds its own copy of:
- `pricingItems` (every line with buy / sell / supplier),
- `internalCosts`,
- `vendorQuotes`,
- `pricingAttachment`,
- `internalNotes`.

The current version is also copied a second time into the RFQ itself (`syncRFQFromPricingVersion`).

So every revision (V2, V3 …) makes the RFQ document bigger, and it never gets smaller. Firestore refuses any document over **1 MiB**. BizCore already warns at 512 KB and calls 768 KB "critical" (`BIZCORE_RECORD_WARN_BYTES`). A large RFQ with 80–150 lines and 4–5 revisions can reach that.

A big document also costs more, every time:
- **Reads:** every phone and PC downloads the whole document when it starts, and again after every change made by anyone.
- **Writes:** every save re-sends the whole document.

## 2. What changes (design)
```
rfqs/{rfqId}                         ← stays: RFQ header + the CURRENT version's working copy (as today)
   pricingIndex: [ {version, status, created, updated, quotationId, convertedDate,
                    supplierName, lineCount, totalSell, totalCost} ]   ← small summary of every version
   currentPricingVersion: 3
   (pricingVersions[] is removed)
rfqs/{rfqId}/pricingVersions/v1      ← one document per version (full lines, costs, quotes, notes)
rfqs/{rfqId}/pricingVersions/v2
rfqs/{rfqId}/pricingVersions/v3
```
- **Each version document also stores** `productIds[]` and `supplierKeys[]`. These answer "is this product or supplier used anywhere?" with one query, without loading every version.
- **Old versions load only when they are opened:** version history, view an old version, revise from it. Lists, registers and the Pricing screen use the RFQ document, which now stays small.
- **Saving pricing** writes the RFQ and the version document in **one batch** (both or neither). It saves only that RFQ, not the whole RFQ list. This starts step 3 of the data plan for RFQs.
- **Converted / Superseded / Cancelled versions are fixed.** The rules refuse any change to their lines; only the status may change (Converted → Superseded).

## 3. Code that has to follow (about 40 places in js/app.js, 2 in js/purchases.js)
| Place | Today | After |
|---|---|---|
| `ensurePricingVersions`, `getCurrentPricingVersion`, `syncRFQFromPricingVersion` | Read the array | Read `pricingIndex` + the loaded version documents (a small cache per RFQ) |
| Revise pricing (≈ line 6857), convert to quotation (≈ 5470) | Push / change array items | Create / update the version document in the same batch as the RFQ |
| Product used? (≈ 1746, 1766), supplier rename stamping (≈ 1681), supplier usage (≈ 6944) | Loop over every version of every RFQ | One query on `pricingVersions` (`productIds` / `supplierKeys`) |
| Version history list (≈ 6948) | The array | `pricingIndex` (no extra reads) |
| Purchase Invoices → estimate from Pricing (`piEstimateFor`) | The version inside the RFQ | The current version is in the RFQ (as today); an older converted version → one document read, then cached |
| Recycle Bin (delete / restore RFQ) | The RFQ document | The RFQ **and** its version documents (see decision 3) |
| Print / PDF of an old pricing version | The array | Load that version first (with a short "Loading…") |

## 4. Moving the existing data (migration)
This follows the same pattern as the earlier invoice and delivery note migrations:
1. **Administration → Data → "Move pricing versions"** (administrators only). Before anything is changed:
   - it shows how many RFQs and versions there are, and the 10 largest RFQ documents with their size;
   - it downloads a **backup file** (JSON).
2. **For each RFQ, in one transaction:**
   - write `pricingVersions/vN` for each version;
   - write `pricingIndex`;
   - remove `pricingVersions[]`.

   This is safe to run again: an RFQ that is already moved is skipped. If it stops halfway, run it again.
3. **Check:** count the versions before and after, compare every line total, and list any difference. Nothing switches on until the check is clean.
4. **Switch:** set `system/pricingStorage = { mode: 'split', minClientVersion: 269 }`. Older copies of BizCore that are still open are asked to reload, so they can't save the old way.
5. **Way back:** while the mode is still `legacy`, a restore from the backup file is possible. Once switched, a "move back" tool can be added if you want it (see decision 5).

## 5. Tests (before anything goes live)
- **Unit:** split / merge of an RFQ (versions in, index out); migration of the sample data; the largest RFQ; an RFQ with no pricing; an RFQ whose quotation was converted.
- **Browser:** the full pricing flow (V1 → revise V2 → convert → quotation); open an old version; print it; Purchase Invoice estimate; product and supplier "in use" checks; Recycle Bin delete / restore; offline open of an old version shows a clear message.
- **Emulator:** rules for version documents (staff read / write; fixed versions can't change; the batch must include the RFQ); the migration on the emulator.
- **Size check:** after the move, the largest RFQ document must be under 100 KB. The Data health screen (step 5) will show it later.

## 6. Decisions I need from you
1. **Keep the current version in two places?** It would stay in the RFQ document (as today, quick to open) **and** in its version document. My suggestion: **yes** — it is small, and it keeps the screens fast.
2. **When to run the move:** after purchasing is finished and tested — a quiet hour, with everyone else logged out.
3. **Recycle Bin for an RFQ:** keep the version documents (marked deleted) so the RFQ can be fully restored. My suggestion: **yes**, kept for 90 days.
4. **Old versions on a phone:** load only when tapped? My suggestion: **yes**.
5. **"Move back" tool after switching:** needed, or is the backup file enough? My suggestion: **the backup file is enough**.

## 7. Size of the job
- About **2 working sessions**: build, tests and migration tool; then a test run on a copy (the emulator with your exported data).
- No change to how the screens look, except a short "Loading…" when an old version opens.

## 8. Before we start — please check (2 minutes, on your PC)
To see how big the RFQ documents are today:
1. Open BizCore.
2. Press F12 → Console.
3. Paste this and press Enter:
   ```js
   BizCoreStorageDiagnostics.inspect('rfqs', rfqs).slice(0, 10)
   ```
4. Send me the list. It shows the 10 largest RFQs in bytes, which tells us how urgent this step is.
