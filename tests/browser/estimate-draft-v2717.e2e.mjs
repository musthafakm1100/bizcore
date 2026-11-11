/** BROWSER (simulator): V271.7.5 (board 23) — a new estimate version updates the RFQ's Draft quotation (same number,
 *  no revision); once the quotation is Sent, a new version makes a revision. Printing a Draft reminds to mark it Sent.
 *  Real index.html + js/estimate.js; the database is the shared in-memory simulator (no rules). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { startHarness } from './harness.mjs';
const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const playwright = createRequire(process.env.PLAYWRIGHT_FROM || import.meta.url)('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SHOTS = process.env.BC_SHOTS || '';
const V1 = { rfqId: 'r3', version: 1, status: 'Saved', created: '2026-11-11T08:00:00Z', updated: '2026-11-11T08:00:00Z', estimateDate: '2026-11-11', quoteStyle: 'lumpsum', overheadPct: 0, contingencyPct: 0, markupPct: 20, roundTo: 0,
  sections: [{ id: 's1', title: 'Automatic shutter doors', items: [
    { id: 'i1', desc: 'Automatic shutter doors — 4 locations', unit: 'Nos', qty: 4, perUnit: true, sellLocked: true, sellBy: 'amt', sellAmt: 46500,
      build: { material: [], manpower: [], subcontract: [{ id: 'l1', desc: 'Shutter door supply & install', qty: 1, unit: 'Nos', rate: 8500, ref: 'SQ-1182' }], other: [] } }] }] };
const DATA = {
  'system/deliveryNoteStorage': { mode: 'independent', minClientVersion: 260 }, 'system/invoiceStorage': { mode: 'independent' }, 'system/accessControl': { adminUids: ['u-boss'] },
  'customers/c1': { id: 'c1', company: 'Arnon Plastic Company', city: 'Riyadh' },
  'rfqs/r3': { id: 'r3', rfqNo: 'RFQ-2611-0034', company: 'Arnon Plastic Company', custId: 'c1', status: 'Pricing', date: '2026-11-11', created: '2026-11-11T08:00:00Z', requestType: 'contracting',
    currentEstimateVersion: 1, estimateIndex: [{ version: 1, status: 'Saved', created: '2026-11-11T08:00:00Z', updated: '2026-11-11T08:00:00Z', itemCount: 1, offerPrice: 46500 }] },
  'rfqs/r3/estimates/v1': V1,
};

test('V271.7.5: a new estimate version updates a Draft quotation (same number); after Sent it makes a revision', { timeout: 300000 }, async () => {
  const h = await startHarness({ appDir, playwright, executablePath: process.env.CHROMIUM_PATH });
  try {
    h.fs.load(DATA);
    const p = await h.newUser({ uid: 'u-boss', email: 'boss@x', name: 'Musthafa KM' }); await h.open(p);
    await p.setViewportSize({ width: 1600, height: 1000 });
    await p.addStyleTag({ content: '#toast{pointer-events:none!important}' });
    await p.waitForFunction(() => typeof window.bcOpenEstimate === 'function');
    const saveQuote = async () => { const sv = p.evaluate(() => saveQuotation()); sv.catch(() => {});
      await Promise.race([sv, p.waitForSelector('#app-confirm-overlay', { timeout: 6000 }).then(() => p.click('#confirm-ok')).catch(() => {})]); await sv; await sleep(800); };
    const saveEst = async () => { await p.click('#es-save'); await p.click('#app-confirm-overlay button:has-text("Save Estimate")'); await p.waitForFunction(() => BCEst.state()?.status === 'Saved'); };

    /* V1 → the quotation (Draft) */
    await p.evaluate(() => bcOpenEstimate('r3')); await p.waitForFunction(() => BCEst.state()?.version === 1);
    assert.equal((await p.textContent('#es-quote')).trim(), 'Create Quotation');
    await p.click('#es-quote'); await p.waitForSelector('#quote-modal.open'); await sleep(500);
    await saveQuote();
    const q1 = await p.evaluate(() => quotations.filter(q => q.rfqId === 'r3' || q.estimate?.rfqId === 'r3').map(q => ({ id: q.id, qno: q.qno, status: q.status, rev: q.revisionNo || 0 })));
    assert.equal(q1.length, 1); assert.equal(q1[0].status, 'Draft'); const QID = q1[0].id, QNO = q1[0].qno;
    assert.equal(h.fs.peek('rfqs/r3/estimates/v1').status, 'Converted');

    /* printing the Draft: the reminder to mark it Sent */
    await p.evaluate(id => { _printQID = id; _templateGallerySelected = 'erpbox'; printWithSelectedTemplate(); }, QID); await p.waitForSelector('#quotation-output-modal.open');
    if (SHOTS) await p.screenshot({ path: SHOTS + '/V2717_print_draft.png' });
    assert.equal(await p.isVisible('#qout-draft'), true); assert.match(await p.textContent('#qout-draft'), /Sending this to the customer\?[\s\S]*Mark Sent & Print[\s\S]*Print as Draft/);
    await p.evaluate(() => closeModal('quotation-output-modal'));

    /* Revise → V2 (split into 2 items) → "Update Draft <same number>" */
    await p.evaluate(() => bcOpenEstimate('r3')); await p.waitForFunction(() => BCEst.state()?.version === 1 && BCEst.state()?.ro);
    await p.click('#es-revise'); await p.waitForFunction(() => BCEst.state()?.version === 2);
    await p.evaluate(() => { const it = BCEst.state().est.sections[0].items[0]; it.desc = 'Shutter Door Size: 512 × 510 cm'; it.qty = 1; it.sellAmt = 13800;
      const cp = JSON.parse(JSON.stringify(it)); cp.id = 'i2'; cp.desc = 'Shutter Door Size: 450 × 500 cm'; cp.qty = 3; cp.sellAmt = 32700; cp.build.subcontract[0].id = 'l2'; BCEst.state().est.sections[0].items.push(cp); BCEst.refresh ? BCEst.refresh() : null; });
    await saveEst();
    assert.equal((await p.textContent('#es-quote')).trim(), '⟳ Update Draft ' + QNO);
    if (SHOTS) await p.screenshot({ path: SHOTS + '/V2717_update_btn.png' });
    await p.click('#es-quote'); await p.waitForSelector('#app-confirm-overlay');
    if (SHOTS) { await sleep(300); await p.screenshot({ path: SHOTS + '/V2717_update_confirm.png' }); }
    assert.match(await p.textContent('#app-confirm-overlay'), new RegExp('Update draft quotation ' + QNO + '[\\s\\S]*keeps its number'));
    await p.click('#confirm-ok'); await p.waitForFunction(id => editingId === id && document.getElementById('quote-modal').classList.contains('open'), QID); await sleep(500);
    const rows = await p.$$eval('#items-tbody tr', rs => rs.map(r => r.dataset.lineType + ':' + (r.dataset.lineType === 'item' ? r.querySelector('[data-f="desc"]').value : r.querySelector('.quote-special-text').value)));
    assert.deepEqual(rows, ['heading:Automatic shutter doors', 'item:Shutter Door Size: 512 × 510 cm', 'item:Shutter Door Size: 450 × 500 cm'], 'one heading — the old estimate rows are replaced');
    assert.match(await p.inputValue('#f-internal-notes'), /Updated from Estimation V2 \(was V1\)/);
    await saveQuote();
    const after = await p.evaluate(() => quotations.filter(q => q.estimate?.rfqId === 'r3').map(q => ({ id: q.id, qno: q.qno, rev: q.revisionNo || 0, v: q.estimate.version, n: q.items.filter(i => i.lineType === 'item').length, sub: calcQuote(q).sub })));
    assert.deepEqual(after, [{ id: QID, qno: QNO, rev: 0, v: 2, n: 2, sub: 46500 }], 'same quotation, same number, no revision');
    assert.equal(h.fs.peek('rfqs/r3/estimates/v1').status, 'Superseded'); assert.equal(h.fs.peek('rfqs/r3/estimates/v2').status, 'Converted');
    assert.deepEqual(h.fs.peek('rfqs/r3').estimateIndex.map(e => [e.version, e.status]), [[1, 'Superseded'], [2, 'Converted']]);

    /* Sent → a new version makes a revision */
    await p.evaluate(id => commitStatus(id, 'Sent', { linkChecked: true, costChecked: true }), QID); await sleep(400);
    assert.equal(await p.evaluate(id => quotations.find(q => q.id === id).status, QID), 'Sent');
    await p.evaluate(() => document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m.id))); await sleep(300);
    await p.evaluate(() => bcOpenEstimate('r3')); await p.waitForFunction(() => BCEst.state()?.version === 2 && BCEst.state()?.ro);
    await p.click('#es-revise'); await p.waitForFunction(() => BCEst.state()?.version === 3);
    await p.evaluate(() => { BCEst.state().est.sections[0].items[0].sellAmt = 14000; });
    await saveEst();
    assert.equal((await p.textContent('#es-quote')).trim(), 'Create Revision ' + QNO.replace(/-R\d+$/, '') + '-R1');
    assert.deepEqual(p.__errors, []);
  } finally { await h.close(); }
});
