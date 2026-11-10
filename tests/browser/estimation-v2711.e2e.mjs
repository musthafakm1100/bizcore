/** BROWSER (simulator): V271.1 — Contracting Estimation (mockups CE_1, CE_2).
 *  Real index.html + js/estimate.js; the database is the shared in-memory simulator (not the emulator, no rules). */
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
// V271.5.38: dates below used to be a fixed 2026-11-01/04/05, which eventually falls into the past and
// turns the RFQs "Overdue" instead of the "not yet due" state this test needs. Keep them relative to today.
const p2 = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const today = () => new Date();
const inDays = n => { const x = today(); x.setDate(x.getDate() + n); return iso(x); };
const todayISO = iso(today());

const DATA = {
  'system/deliveryNoteStorage': { mode: 'independent', minClientVersion: 260 }, 'system/invoiceStorage': { mode: 'independent' }, 'system/accessControl': { adminUids: ['u-boss'] },
  'suppliers/s-gbm': { id: 's-gbm', company: 'Gulf Building Materials', code: 'SUP-0001' },
  'suppliers/s-waha': { id: 's-waha', company: 'Al Waha Manpower Co.', code: 'SUP-0002', supplierKinds: ['manpower'] },
  'suppliers/s-paint': { id: 's-paint', company: 'Pro Paint Contracting', code: 'SUP-0003', supplierKinds: ['subcontractor'] },
  'products/p-gb': { id: 'p-gb', name: 'Gypsum board 12.5 mm 1.2x2.4 m', code: 'ITM-0001', uom: 'Nos' },
  'products/p-stud': { id: 'p-stud', name: 'Metal stud 70 mm x 3 m', code: 'ITM-0002', uom: 'Nos' },
  'customers/c1': { id: 'c1', company: 'Al Rajhi Office Fit-out' },
  'rfqs/r1': { id: 'r1', rfqNo: 'RFQ-2611-0012', company: 'Al Rajhi Office Fit-out', custId: 'c1', ref: 'ENQ-778', status: 'New', date: todayISO, due: inDays(4), created: todayISO + 'T08:00:00Z',
    requestType: 'contracting', site: 'Olaya Tower, 7th floor', duration: '21 days',
    rfqLines: [
      { lineId: 'l1', kind: 'service', sortOrder: 1, desc: 'Gypsum board partition 12.5 mm, double side', qty: 120, uom: 'm²', remarks: '' },
      { lineId: 'l2', kind: 'service', sortOrder: 2, desc: 'Emulsion paint, 2 coats on walls', qty: 600, uom: 'm²', remarks: '' },
    ] },
  'rfqs/r2': { id: 'r2', rfqNo: 'RFQ-2611-0013', company: 'Al Rajhi Office Fit-out', custId: 'c1', status: 'New', date: todayISO, due: inDays(3), created: todayISO + 'T09:00:00Z', requestType: 'product' },
};

test('V271.1 Contracting Estimation: start from the RFQ, cost build-up, figures, save, versions, copy, settings', { timeout: 300000 }, async () => {
  const h = await startHarness({ appDir, playwright, executablePath: process.env.CHROMIUM_PATH });
  try {
    h.fs.load(DATA);
    const boss = await h.newUser({ uid: 'u-boss', email: 'boss@x', name: 'Musthafa KM' });
    await h.open(boss);
    await boss.waitForFunction(() => typeof window.bcOpenEstimate === 'function' && typeof viewRFQ === 'function');
    await boss.addStyleTag({ content: '#toast{pointer-events:none!important}' });   // toasts never block a click in this test
    // Contracting Settings: Labour Rates (administrator) — saved as a shared setting
    await boss.evaluate(() => { localStorage.setItem('bizcoreContractingSettings', JSON.stringify({ ...BCEst.DEFAULTS(), labourRates: [{ id: 'a', trade: 'Gypsum Carpenter', rate: 160, unit: 'Day' }, { id: 'b', trade: 'Helper', rate: 110, unit: 'Day' }] })); });

    /* ── 1. RFQ view of a Contracting RFQ: Start estimation (not Start pricing) ── */
    const v = await boss.evaluate(() => { viewRFQ('r1'); const f = document.getElementById('rfq-view-footer').textContent, b = document.getElementById('rfq-view-body').textContent; return { f, b }; });
    assert.match(v.f, /Start estimation/); assert.doesNotMatch(v.f, /Start pricing/);
    assert.match(v.b, /Contracting/); assert.match(v.b, /Estimation/);
    await boss.click('#rfq-view-footer button:has-text("Start estimation")');
    await boss.waitForFunction(() => document.getElementById('estimate-modal')?.classList.contains('open'));
    const s0 = await boss.evaluate(() => ({ title: document.getElementById('es-title').textContent, items: BCEst.state().est.sections[0].items.map(i => [i.desc, i.qty, i.unit]), site: document.getElementById('es-site').value, rfqView: document.getElementById('rfq-view-modal').classList.contains('open'), oh: BCEst.state().est.overheadPct }));
    assert.equal(s0.title, 'Estimation V1 — RFQ-2611-0012');
    assert.deepEqual(s0.items, [['Gypsum board partition 12.5 mm, double side', 120, 'm²'], ['Emulsion paint, 2 coats on walls', 600, 'm²']]);
    assert.equal(s0.site, 'Olaya Tower, 7th floor'); assert.equal(s0.rfqView, false); assert.equal(s0.oh, 5);
    assert.match(await boss.textContent('#es-chk'), /2 items without cost/);

    // V271.7: a cost type with no lines shows as a "+ Material / + Manpower …" button; inside a shown type, "+ Add …"
    const addLine = async k => { const inGroup = `#es-bu .es-grpbox[data-k="${k}"] [data-act="add-line"]`; if (await boss.locator(inGroup).count()) await boss.click(inGroup); else await boss.click(`#es-bu [data-act="show-k"][data-k="${k}"]`); };
    /* ── 2. Cost Build-up of item A1 through the screen: material from the Item Master, hired manpower ── */
    await boss.click('#es-grid tr.es-it >> nth=0 >> td.es-tot');
    await boss.waitForSelector('#es-bu:not([hidden])');
    await addLine('material');
    await boss.fill('#es-bu .es-grpbox[data-k="material"] tr[data-lid] [data-f="desc"]', 'gypsum');
    await boss.waitForSelector('.es-dd button');
    await boss.click('.es-dd button:has-text("Gypsum board 12.5 mm")');
    await boss.fill('#es-bu .es-grpbox[data-k="material"] tr[data-lid] [data-f="qty"]', '90');
    await boss.fill('#es-bu .es-grpbox[data-k="material"] tr[data-lid] [data-f="rate"]', '28');
    await addLine('manpower');
    const mp = '#es-bu .es-grpbox[data-k="manpower"] tr[data-lid]';
    await boss.fill(`${mp} [data-f="trade"]`, 'Gypsum Carpenter');
    await boss.dispatchEvent(`${mp} [data-f="trade"]`, 'change');
    assert.equal(await boss.inputValue(`${mp} [data-f="rate"]`), '160', 'day rate from Labour Rates');
    await boss.fill(`${mp} [data-f="supplierName"]`, 'waha');
    await boss.waitForSelector('.es-dd .es-dd-h:has-text("Manpower agencies")');
    await boss.click('.es-dd button:has-text("Al Waha Manpower")');
    await boss.fill(`${mp} [data-f="men"]`, '3');
    await boss.fill(`${mp} [data-f="days"]`, '5');
    await addLine('other');
    await boss.fill('#es-bu .es-grpbox[data-k="other"] tr[data-lid] [data-f="desc"]', 'Scaffolding rental');
    await boss.fill('#es-bu .es-grpbox[data-k="other"] tr[data-lid] [data-f="qty"]', '5');
    await boss.fill('#es-bu .es-grpbox[data-k="other"] tr[data-lid] [data-f="rate"]', '60');
    const side = await boss.textContent('#es-bu-side');
    assert.match(side, /Total Cost\s*5,220\.00/);   // 2,520 + 2,400 + 300
    assert.match(side, /Cost per m²\s*43\.50/);
    if (SHOTS) await boss.screenshot({ path: SHOTS + '/CE_2_live.png' });
    // a supplier name that is not in the master is outlined and stops the save
    await addLine('subcontract');
    await boss.fill('#es-bu .es-grpbox[data-k="subcontract"] tr[data-lid] [data-f="supplierName"]', 'Unknown Painters');
    await boss.keyboard.press('Escape');   // closes the list
    await boss.click('#es-bu .es-gh');      // leaves the field
    await sleep(250);
    assert.equal(await boss.locator('#es-bu .es-grpbox[data-k="subcontract"] [data-f="supplierName"].is-bad').count(), 1);
    await boss.click('#es-bu .es-grpbox[data-k="subcontract"] [data-act="del-line"]');
    // Next ›: item A2, subcontracted painting (subcontractor listed first)
    await boss.click('#es-bu [data-act="bu-next"]');
    await addLine('subcontract');
    const sc = '#es-bu .es-grpbox[data-k="subcontract"] tr[data-lid]';
    await boss.fill(`${sc} [data-f="desc"]`, 'Painting, 2 coats');
    await boss.click(`${sc} [data-f="supplierName"]`);
    await boss.waitForSelector('.es-dd .es-dd-h:has-text("Subcontractors")');
    await boss.click('.es-dd button:has-text("Pro Paint")');
    await boss.fill(`${sc} [data-f="qty"]`, '600');
    await boss.fill(`${sc} [data-f="rate"]`, '13');
    await boss.click('#es-bu-done');

    /* ── 3. The figures: overheads 5 %, contingency 3 %, markup 15 %, rounded lump sum ── */
    const c1 = await boss.evaluate(() => { const c = BCEst.calc(BCEst.state().est); return { direct: c.direct, by: c.by, oh: c.overhead, ct: c.contingency, tc: c.totalCost, mk: c.markup, sell: c.sell, sells: c.flat.map(x => x.sell) }; });
    assert.deepEqual(c1.by, { material: 2520, manpower: 2400, subcontract: 7800, other: 300, manpowerOwn: 0 });
    assert.equal(c1.direct, 13020); assert.equal(c1.oh, 651); assert.equal(c1.ct, 390.6); assert.equal(c1.tc, 14061.6); assert.equal(c1.mk, 2109.24); assert.equal(c1.sell, 16170.84);
    assert.equal(Math.round((c1.sells[0] + c1.sells[1]) * 100), 1617084, 'item sell amounts add up to the selling price');
    assert.match(await boss.textContent('#es-grid tr.es-it >> nth=1'), /Subcontract/, 'subcontract-only item is tagged');
    // round to 16,000 with the "Use" chip (rounding step 100 → 16,100), then type 16,000
    assert.match(await boss.textContent('#es-side'), /Round down to 16,100\.00[\s\S]*Round up to 16,200\.00/);
    await boss.fill('#es-side [data-f="roundTo"]', '16000');
    const res = await boss.textContent('#es-side .es-res');
    assert.match(res, /Quoted Price\s*16,000\.00/); assert.match(res, /Profit\s*1,938\.40/);
    // overheads changed for this estimate only
    await boss.fill('#es-side [data-f="overheadPct"]', '6');
    assert.equal(await boss.evaluate(() => BCEst.calc(BCEst.state().est).overhead), 781.2);
    await boss.fill('#es-side [data-f="overheadPct"]', '5');
    // a second section with an item, via the grid
    await boss.click('#es-grid [data-act="add-section"]');
    await boss.keyboard.type('Electrical');
    await boss.fill('#es-grid tr.es-it >> nth=2 >> [data-f="desc"]', 'Supply & install LED panel 60x60');
    await boss.fill('#es-grid tr.es-it >> nth=2 >> [data-f="unit"]', 'Nos');
    await boss.fill('#es-grid tr.es-it >> nth=2 >> [data-f="qty"]', '40');
    await boss.click('#es-tabs [data-tab="notes"]');
    await boss.fill('#es-notes', 'Rates valid for working hours 7 am – 5 pm.');
    assert.equal(await boss.isVisible('#es-note-pill'), true, 'Internal Note pill');
    await boss.click('#es-tabs [data-tab="manpower"]');
    assert.match(await boss.textContent('#es-manpower'), /Gypsum Carpenter.*Al Waha Manpower Co\..*15.*2,400\.00/s);
    await boss.click('#es-tabs [data-tab="items"]');
    assert.match(await boss.textContent('#es-chk'), /1 item without cost/);
    if (SHOTS) await boss.screenshot({ path: SHOTS + '/CE_1_live.png' });

    /* ── 4. Save: the RFQ and estimate V1 in one batch ── */
    await boss.click('#es-save');
    await boss.click('#app-confirm-overlay button:has-text("Save Estimate"), .confirm-overlay button:has-text("Save Estimate")');
    await boss.waitForFunction(() => BCEst.state()?.status === 'Saved');
    const d1 = h.fs.dump('rfqs/r1');
    const doc1 = d1['rfqs/r1/estimates/v1'], rfq1 = d1['rfqs/r1'];
    assert.ok(doc1, 'estimate V1 document');
    assert.equal(doc1.status, 'Saved'); assert.equal(doc1.rfqId, 'r1'); assert.equal(doc1.version, 1); assert.equal(doc1.savedBy, 'Musthafa KM');
    assert.equal(doc1.summary.offerPrice, 16000); assert.equal(doc1.summary.directCost, 13020); assert.equal(doc1.summary.itemCount, 3);
    assert.equal(doc1.sections.length, 2); assert.equal(doc1.sections[1].title, 'Electrical');
    assert.equal(doc1.sections[0].items[0].build.material[0].productId, 'p-gb');
    assert.equal(doc1.sections[0].items[0].build.manpower[0].supplierId, 's-waha');
    assert.equal(doc1.sections[0].items[0].rfqLineId, 'l1');
    assert.equal(doc1.internalNotes, 'Rates valid for working hours 7 am – 5 pm.');
    assert.equal(rfq1.currentEstimateVersion, 1); assert.equal(rfq1.estimateIndex.length, 1); assert.equal(rfq1.estimateIndex[0].offerPrice, 16000); assert.equal(rfq1.status, 'Pricing');
    assert.ok(!('pricingItems' in rfq1) || !rfq1.pricingItems?.length, 'no pricing lines');
    assert.equal(await boss.evaluate(() => getRFQWorkflowStage(rfqs.find(r => r.id === 'r1'))), 'Pricing');

    /* ── 5. Back to the RFQ: Edit estimation; reopening reads the saved version ── */
    await boss.click('#es-back');
    await boss.waitForFunction(() => document.getElementById('rfq-view-modal').classList.contains('open'));
    assert.match(await boss.textContent('#rfq-view-footer'), /Edit estimation/);
    assert.match(await boss.textContent('#rfq-view-body'), /Estimate ready/);
    await boss.evaluate(() => BCEst.cache.clear());
    await boss.click('#rfq-view-footer button:has-text("Edit estimation")');
    await boss.waitForFunction(() => BCEst.state()?.version === 1 && document.getElementById('estimate-modal').classList.contains('open'));
    assert.equal(await boss.evaluate(() => BCEst.calc(BCEst.state().est).offer), 16000);
    assert.equal(await boss.evaluate(() => document.getElementById('es-save').disabled), false);

    /* ── 6. New version: V2 supersedes V1 (V1 keeps its figures, read only) ── */
    await boss.evaluate(() => document.getElementById('es-more').click());
    await boss.click('.es-menu button:has-text("Save As New Version")');
    assert.equal(await boss.textContent('#es-title'), 'Estimation V2 — RFQ-2611-0012');
    // Copy From: the LED item copies A1's build-up? — copy the painting build-up of A2 into the LED item (scaled 40 / 600)
    await boss.click('#es-grid tr.es-it >> nth=2 >> td.es-tot');
    await boss.click('#es-copy');
    await boss.waitForSelector('.es-dd button:has-text("Emulsion paint")');
    await boss.click('.es-dd button:has-text("Emulsion paint")');
    const copied = await boss.evaluate(() => BCEst.state().est.sections[1].items[0].build.subcontract.map(l => [l.qty, l.rate, l.supplierId]));
    assert.deepEqual(copied, [[40, 13, 's-paint']]);
    await boss.click('#es-bu-done');
    await boss.fill('#es-side [data-f="roundTo"]', '16500');
    await boss.click('#es-save');
    await boss.click('#app-confirm-overlay button:has-text("Save Estimate"), .confirm-overlay button:has-text("Save Estimate")');
    await boss.waitForFunction(() => BCEst.state()?.version === 2 && BCEst.state()?.status === 'Saved');
    const d2 = h.fs.dump('rfqs/r1');
    assert.equal(d2['rfqs/r1/estimates/v1'].status, 'Superseded');
    assert.equal(d2['rfqs/r1/estimates/v1'].summary.offerPrice, 16000, 'V1 keeps its figures');
    assert.equal(d2['rfqs/r1/estimates/v2'].status, 'Saved'); assert.equal(d2['rfqs/r1/estimates/v2'].previousVersion, 1);
    assert.equal(d2['rfqs/r1'].currentEstimateVersion, 2);
    assert.deepEqual(d2['rfqs/r1'].estimateIndex.map(e => [e.version, e.status]), [[1, 'Superseded'], [2, 'Saved']]);
    // V1 opens read only
    await boss.evaluate(() => document.getElementById('es-st').click());
    await boss.click('.es-menu button:has-text("V1 ·")');
    await boss.waitForFunction(() => BCEst.state()?.version === 1);
    const ro1 = await boss.evaluate(() => ({ ro: BCEst.state().ro, save: document.getElementById('es-save').hidden, view: document.getElementById('es-view').hidden, dis: document.querySelector('#es-grid [data-f="desc"]').disabled }));
    assert.deepEqual(ro1, { ro: true, save: true, view: false, dis: true });
    await boss.keyboard.press('Escape');
    await boss.waitForFunction(() => !document.getElementById('estimate-modal').classList.contains('open'));

    /* ── 7. Unsaved changes ask before leaving ── */
    await boss.evaluate(() => bcOpenEstimate('r1'));
    await boss.waitForFunction(() => BCEst.state()?.version === 2 && document.getElementById('estimate-modal').classList.contains('open'));
    await boss.fill('#es-site', 'Olaya Tower, 8th floor');
    await boss.click('#es-close');
    await boss.waitForSelector('.safe-exit-dialog');
    assert.match(await boss.textContent('.safe-exit-dialog'), /Leave Without Saving/);
    await boss.click('.safe-exit-dialog button:has-text("Discard & Close")');
    assert.equal(await boss.evaluate(() => document.getElementById('estimate-modal').classList.contains('open')), false);

    /* ── 8. A Product RFQ is not estimated; RFQ entry offers Contracting ── */
    assert.equal(await boss.evaluate(() => bcOpenEstimate('r2')), false);
    await boss.evaluate(() => { viewRFQ('r2'); });
    assert.match(await boss.textContent('#rfq-view-footer'), /Start pricing/);
    await boss.evaluate(() => closeModal('rfq-view-modal'));
    await boss.evaluate(() => editRFQ('r1'));
    await boss.waitForFunction(() => document.querySelector('#rfq-type-seg label.on'));
    const seg = await boss.evaluate(() => { return { types: [...document.querySelectorAll('#rfq-type-seg label')].map(l => l.dataset.type), on: document.querySelector('#rfq-type-seg label.on')?.dataset.type, locked: document.getElementById('rfq-type-seg').classList.contains('is-locked'), tab: document.querySelector('#rfq-tabs .rq-tb')?.textContent }; });
    assert.deepEqual(seg.types, ['product', 'service', 'mixed', 'contracting']);
    assert.equal(seg.on, 'contracting'); assert.equal(seg.locked, true, 'type locked once estimated'); assert.match(seg.tab, /Scope Items/);
    if (SHOTS) { await boss.screenshot({ path: SHOTS + '/RFQ_entry_live.png' }); }
    await boss.evaluate(() => closeModal('rfq-modal'));

    /* ── 9. Supplier form: Also supplies (Contracting) ── */
    const sk = await boss.evaluate(async () => { openEditSupplier('s-gbm'); document.getElementById('sm-kind-subcontractor').checked = true; await saveSupplier(); return suppliers.find(s => s.id === 's-gbm').supplierKinds; });
    assert.deepEqual(sk, ['subcontractor']);
    await sleep(300);
    assert.deepEqual(h.fs.dump('suppliers/s-gbm')['suppliers/s-gbm'].supplierKinds, ['subcontractor']);

    /* ── 10. Administration → Contracting Settings ── */
    await boss.evaluate(() => { document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m.id)); showPage('setup'); switchSetupTab('contracting-settings'); });
    await boss.waitForSelector('#bc-contracting-settings [data-k="markupPct"]');
    await boss.fill('#bc-contracting-settings [data-k="markupPct"]', '18');
    await boss.click('#bc-contracting-settings [data-add="lr"]');
    await boss.fill('#bc-contracting-settings [data-lr="2"][data-f="trade"]', 'Painter');
    await boss.fill('#bc-contracting-settings [data-lr="2"][data-f="rate"]', '120');
    if (SHOTS) await boss.screenshot({ path: SHOTS + '/CS_settings_live.png', fullPage: false });
    await boss.click('#cs-save');
    await boss.click('#app-confirm-overlay button:has-text("Save Settings"), .confirm-overlay button:has-text("Save Settings")');
    await boss.waitForFunction(() => JSON.parse(localStorage.getItem('bizcoreContractingSettings')).markupPct === 18);
    await sleep(500);
    const shared = h.fs.dump('sharedSettings/contracting')['sharedSettings/contracting'];
    assert.ok(shared, 'saved in Firebase (shared settings)');
    const cs = JSON.parse(shared.json);
    assert.equal(cs.markupPct, 18); assert.equal(cs.labourRates, undefined, 'V271.1.1: the lists have their own record');
    const rates = JSON.parse(h.fs.dump('sharedSettings/contractingRates')['sharedSettings/contractingRates'].json);
    assert.deepEqual(rates.labourRates.map(l => [l.trade, l.rate]), [['Gypsum Carpenter', 160], ['Helper', 110], ['Painter', 120]]);
    assert.equal(rates.expenseCategories.length, 5);

    /* ── 11. V271.1.1 Special Right "Manage Labour Rates & Expense Categories": Contracting Settings only, lists only ── */
    const RC = await import('../../js/role-core.mjs');
    const perms = Object.fromEntries(RC.MODULES.map(m => [m.id, { v: ['rfq', 'pricing', 'quotation', 'suppliers', 'products'].includes(m.id), c: m.id === 'pricing', e: m.id === 'pricing', x: false, own: false }]));
    const mkRole = (id, rights) => ({ id, label: id, builtIn: false, locked: false, perms: RC.normalizePerms(perms), rights: RC.normalizeRights(rights), ...RC.derivedLists(perms, rights), revision: 1, updatedAt: '2026-10-01T00:00:00.000Z', updatedByUid: 'test', updatedByName: 'Test', schemaVersion: 1 });
    h.fs.load({ 'roles/r-est': mkRole('r-est', { contractingRates: true }), 'roles/r-est2': mkRole('r-est2', {}) });
    const sara = await h.newUser({ uid: 'u-sara', email: 'sara@x', name: 'Sara', role: 'r-est' });
    await h.open(sara);
    await sara.waitForFunction(() => typeof window.bcRight === 'function' && window.bcRight('contractingRates') && typeof window.bcRenderContractingSettings === 'function');
    await sara.addStyleTag({ content: '#toast{pointer-events:none!important}' });
    await sara.evaluate(() => showPage('setup'));
    await sara.waitForSelector('#bc-contracting-settings [data-lr="0"]');
    const view = await sara.evaluate(() => ({
      tabs: [...document.querySelectorAll('#page-setup .setup-tab')].filter(t => !t.classList.contains('bc-perm-hidden')).map(t => t.id),
      defs: document.querySelector('#bc-contracting-settings [data-k="markupPct"]').disabled, rate: document.querySelector('#bc-contracting-settings [data-lr="0"][data-f="rate"]').disabled,
      note: document.querySelector('#bc-contracting-settings .cs-ro')?.textContent || '' }));
    assert.deepEqual(view.tabs, ['stab-contracting-settings']); assert.equal(view.defs, true); assert.equal(view.rate, false);
    assert.match(view.note, /You can change the Labour Rates/);
    await sara.fill('#bc-contracting-settings [data-lr="1"][data-f="rate"]', '115');
    await sara.click('#cs-save');
    await sara.click('#app-confirm-overlay button:has-text("Save Settings"), .confirm-overlay button:has-text("Save Settings")');
    await sara.waitForFunction(() => JSON.parse(localStorage.getItem('bizcoreContractingRates') || '{}').labourRates?.[1]?.rate === 115);
    await sleep(500);
    assert.equal(JSON.parse(h.fs.dump('sharedSettings/contractingRates')['sharedSettings/contractingRates'].json).labourRates[1].rate, 115);
    assert.equal(JSON.parse(h.fs.dump('sharedSettings/contracting')['sharedSettings/contracting'].json).markupPct, 18, 'defaults untouched');
    // without the right: no Administration at all
    const omar = await h.newUser({ uid: 'u-omar', email: 'omar@x', name: 'Omar', role: 'r-est2' });
    await h.open(omar);
    await omar.waitForFunction(() => typeof window.bcRight === 'function' && document.querySelector('[data-nav-page="setup"]'));
    await sleep(500);
    assert.equal(await omar.evaluate(() => document.querySelector('[data-nav-page="setup"]').classList.contains('bc-perm-hidden')), true);
    assert.deepEqual(sara.__errors, [], 'no page errors (Sara)');

    assert.deepEqual(boss.__errors, [], 'no page errors');
  } finally { await h.close(); }
});
