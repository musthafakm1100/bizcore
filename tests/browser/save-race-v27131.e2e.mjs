/** BROWSER (simulator): V271.3.1 — an RFQ saved while another PC changes RFQs is really saved and stays on the screen
 *  (before: the screen's list was refreshed from the server during the save, the new RFQ was not written, yet
 *  "RFQ logged" was shown). A quotation that Firebase refuses is reported, not "created". */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { startHarness } from './harness.mjs';

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const playwright = createRequire(process.env.PLAYWRIGHT_FROM || import.meta.url)('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));

test('V271.3.1 RFQ saved while another PC changes RFQs; failed quotation save is reported', { timeout: 240000 }, async () => {
  const h = await startHarness({ appDir, playwright, executablePath: process.env.CHROMIUM_PATH });
  try {
    h.fs.load({ 'system/deliveryNoteStorage': { mode: 'independent', minClientVersion: 260 }, 'system/invoiceStorage': { mode: 'independent' }, 'system/accessControl': { adminUids: ['u-boss', 'u-two'] },
      'customers/c1': { id: 'c1', company: 'MOHG', contacts: [{ name: 'Faisal', isDefault: true }] },
      'rfqs/rold': { id: 'rold', rfqNo: 'RFQ-2611-0018', company: 'MOHG', custId: 'c1', status: 'New', date: '2026-11-01', due: '2026-11-03', rfqLines: [], created: '2026-11-01T08:00:00Z' } });
    const a = await h.newUser({ uid: 'u-boss', email: 'boss@x', name: 'Musthafa KM' });
    const b = await h.newUser({ uid: 'u-two', email: 'two@x', name: 'Aisha' });
    await h.open(a); await h.open(b); await sleep(500);
    await a.addStyleTag({ content: '#toast{pointer-events:none!important}' });
    await a.evaluate(() => showPage('rfq'));
    // PC A: Firebase is slow to answer — PC B saves a change to another RFQ while A's save waits
    await a.evaluate(() => { const orig = window.FB.fbSaveRecordWith; window.FB.fbSaveRecordWith = async (...x) => { await new Promise(r => setTimeout(r, 1500)); return orig(...x); }; });
    const rows = Array.from({ length: 50 }, (_, i) => `Item ${i + 1}\t${i + 1}\tEA`).join('\n');
    for (let k = 0; k < 2; k++) {
      await a.evaluate(() => openNewRFQ()); await a.waitForSelector('#rfq-modal.open');
      await a.fill('#rfq-cust-search', 'MOH'); await sleep(200); await a.evaluate(() => selectRFQCustomer('c1'));
      await a.click('#rfq-type-seg label[data-type="product"]');   // V271.5.41: the request type is required, nothing is pre-selected
      await a.evaluate(t => BCRfq._pasteRows(t, 'product'), rows);
      const saving = a.evaluate(() => saveRFQ());
      await sleep(400);
      await b.evaluate(async n => { const r = rfqs.find(x => x.id === 'rold'); r.contact = 'Changed on PC B ' + n; return saveRFQs([r]); }, k);
      await saving; await sleep(1200);
    }
    const stored = Object.entries(h.fs.dump('rfqs/')).filter(([p]) => p.split('/').length === 2).map(([, d]) => d);
    assert.deepEqual(stored.map(d => d.rfqNo).sort(), ['RFQ-2611-0018', 'RFQ-2611-0019', 'RFQ-2611-0020'], 'both new RFQs are in Firebase');
    assert.equal(stored.find(d => d.rfqNo === 'RFQ-2611-0019').rfqLines.length, 50);
    assert.equal(stored.find(d => d.id === 'rold').contact, 'Changed on PC B 1', "PC B's change is kept");
    const onA = await a.evaluate(() => ({ list: rfqs.map(r => r.rfqNo).sort(), count: document.getElementById('rfq-register-count').textContent }));
    assert.deepEqual(onA.list, ['RFQ-2611-0018', 'RFQ-2611-0019', 'RFQ-2611-0020']);
    assert.equal(onA.count, '3 RFQs');
    await b.evaluate(() => showPage('rfq')); await sleep(300);
    assert.equal(await b.evaluate(() => document.getElementById('rfq-register-count').textContent), '3 RFQs', 'PC B sees them too');

    // a stale copy is refused, not written over the newer one: PC A edits rold from the version it read before B's change
    const stale = await a.evaluate(async () => { const r = JSON.parse(JSON.stringify(rfqs.find(x => x.id === 'rold'))); r._rev = 1; r.contact = 'Old copy'; return saveRFQs([r]); });
    assert.equal(stale, false);
    assert.equal(h.fs.peek('rfqs/rold').contact, 'Changed on PC B 1');

    // a quotation Firebase refuses: reported, the form stays open, nothing claimed as created
    await a.evaluate(() => { window.FB.fbSave = async (col, ...x) => { if (col === 'quotations') { window.BizCoreStorageDiagnostics.lastSaveError = { code: 'permission-denied', message: 'refused' }; return false; } return true; }; });
    const ok = await a.evaluate(async () => { const r = await saveQuotations(); return r; });
    assert.equal(ok, false, 'saveQuotations reports a failed save');
  } finally { await h.close(); }
});
