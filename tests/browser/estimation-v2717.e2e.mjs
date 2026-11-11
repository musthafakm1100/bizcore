/** BROWSER (simulator): V271.7 — Estimation improvements (mockups 14–17): a cost typed straight in the grid, the
 *  selling price typed per item (🔒, by amount or rate, with or without a cost), Cost / Sell per unit, the item's scope
 *  of work (from the RFQ requirements) and work category, round up / down, Copy from a previous estimate, and in the
 *  Cost Build-up: only the cost types in use, per-unit costing, waste %, own staff with its internal rate, the
 *  "no rate" warning, quote references, last-estimate cost, the Scope tab. The quotation made from it carries the
 *  scope, the category and the typed prices exactly. Also the Quotation's "Insert Text…" and the quiet default chip. */
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
const L = o => ({ id: 'l' + Math.random().toString(36).slice(2, 8), ...o });
const REQ = 'Gypsum partition for the new admin area, ground floor.\nAbout 120 m2, height 3 m.';
const OLD = { rfqId: 'r2', version: 1, status: 'Converted', created: '2026-10-20T08:00:00Z', updated: '2026-10-21T08:00:00Z', estimateDate: '2026-10-20', quoteStyle: 'lumpsum', overheadPct: 5, contingencyPct: 3, markupPct: 15, roundTo: 0,
  sections: [{ id: 'os1', title: 'Ceilings', workCat: 'Civil & finishing works', items: [
    { id: 'oi1', desc: 'Ceiling tiles 600 × 600', unit: 'm²', qty: 80, perUnit: true, scopeHtml: '<div><b>Mineral fibre tiles</b> on exposed grid T24.</div>', sellLocked: true, sellBy: 'amt', sellAmt: 9999,
      build: { material: [L({ productId: 'p-gyp', desc: 'Gypsum board 12.5 mm', qty: 1.05, unit: 'm²', rate: 21 })], manpower: [L({ trade: 'Helper', men: 2, days: 3, rate: 110 })], subcontract: [], other: [] } }] }] };
const DATA = {
  'system/deliveryNoteStorage': { mode: 'independent', minClientVersion: 260 }, 'system/invoiceStorage': { mode: 'independent' }, 'system/accessControl': { adminUids: ['u-boss'] },
  'customers/c1': { id: 'c1', company: 'Al Hammadi Hospital', city: 'Riyadh' },
  'products/p-gyp': { id: 'p-gyp', type: 'goods', code: 'ITM-000312', name: 'Gypsum board 12.5 mm MR', uom: 'm²', price: 25 },
  'rfqs/r1': { id: 'r1', rfqNo: 'RFQ-2611-0032', company: 'Al Hammadi Hospital', custId: 'c1', ref: 'Civil-11', status: 'New', date: '2026-11-10', due: '2026-11-12', created: '2026-11-10T08:00:00Z',
    requestType: 'contracting', site: 'Admin block', desc: REQ, workCategory: '',
    rfqLines: [{ lineId: 'rl1', desc: 'Gypsum board partition, double side', qty: 120, uom: 'm²', sortOrder: 1 }, { lineId: 'rl2', desc: 'Emulsion paint, 2 coats', qty: 600, uom: 'm²', sortOrder: 2 }] },
  'rfqs/r2': { id: 'r2', rfqNo: 'RFQ-2610-0044', company: 'Al Hammadi Hospital', custId: 'c1', status: 'Quoted', date: '2026-10-20', created: '2026-10-20T08:00:00Z', requestType: 'contracting',
    currentEstimateVersion: 1, estimateIndex: [{ version: 1, status: 'Converted', created: '2026-10-20T08:00:00Z', updated: '2026-10-21T08:00:00Z', itemCount: 1, offerPrice: 9999 }] },
  'rfqs/r2/estimates/v1': OLD,
};

test('V271.7 Estimation: typed cost & price, unit rates, scope & category, copy, build-up options → quotation', { timeout: 300000 }, async () => {
  const h = await startHarness({ appDir, playwright, executablePath: process.env.CHROMIUM_PATH });
  try {
    h.fs.load(DATA);
    const p = await h.newUser({ uid: 'u-boss', email: 'boss@x', name: 'Musthafa KM' }); await h.open(p);
    await p.waitForFunction(() => typeof window.bcOpenEstimate === 'function' && window.BCScope && typeof viewRFQ === 'function');
    await p.addStyleTag({ content: '#toast{pointer-events:none!important}' });
    await p.evaluate(() => localStorage.setItem('bizcoreContractingRates', JSON.stringify({ labourRates: [{ id: 'a', trade: 'Helper', rate: 110, unit: 'Day' }, { id: 'b', trade: 'Foreman', rate: 220, ownRate: 150, unit: 'Day' }], expenseCategories: [] })));
    const st = () => p.evaluate(() => BCEst.state());
    const calc = () => p.evaluate(() => { const c = BCEst.calc(BCEst.state().est); return { sell: c.sell, offer: c.offer, locked: c.lockedSum, free: c.freeSell, items: c.flat.map(x => ({ code: x.code, cost: x.cost.total, sell: x.sell, offer: x.offer, locked: x.locked })), pnc: c.pricedNoCost, unc: c.uncosted }; });

    /* 1. a new estimate from the RFQ: the requirements banner, new columns */
    await p.evaluate(() => bcOpenEstimate('r1')); await p.waitForFunction(() => BCEst.state()?.version === 1);
    assert.equal(await p.isVisible('#es-rfqbn'), true);
    assert.match(await p.textContent('#es-rfqbn'), /RFQ-2611-0032[\s\S]*Use as scope of the selected item/);
    assert.match(await p.textContent('#es-grid thead'), /Total Cost\s*Cost \/ Unit\s*Sell \/ Unit\s*Sell Amount/);
    assert.equal(await p.locator('#es-grid tr.es-it >> nth=0 >> [data-f="q-material"]').count(), 1, 'cost cells take a figure when the item has no build-up');

    /* 2. a cost typed straight in a cell (item A2) */
    await p.fill('#es-grid tr.es-it >> nth=1 >> [data-f="q-subcontract"]', '7800');
    let c = await calc();
    assert.equal(c.items[1].cost, 7800);
    assert.equal((await p.textContent('#es-grid tr.es-it >> nth=1 >> td[data-c="crate"]')).trim(), '13.00');
    assert.equal(Math.round(c.items[1].sell * 100), Math.round(7800 * 1.08 * 1.15 * 100), 'sell = cost + overheads + contingency + markup');

    /* 3. the section's work category; the RFQ requirements as the scope of A1 */
    await p.click('#es-grid tr.es-sec >> nth=0 >> [data-act="sec-cat"]'); await p.waitForSelector('.es-menu');
    await p.click('.es-menu button:has-text("Civil & finishing works")');
    assert.equal((await st()).est.sections[0].workCat, 'Civil & finishing works');
    await p.click('#es-grid tr.es-it >> nth=0 >> [data-f="desc"]');
    await p.click('#es-rfqbn [data-act="bn-use"]'); await sleep(150);
    assert.match(await p.textContent('#es-grid .es-scdoc[data-scope]'), /Gypsum partition for the new admin area[\s\S]*About 120 m2/);
    assert.equal((await st()).est.sections[0].items[0].scopeSrc, 'rfq');

    /* 4. Copy from a previous estimate: an item with its build-up, scope and category; the typed price stays behind */
    await p.click('#es-grid [data-act="copy-est"]'); await p.waitForSelector('.es-cp');
    await p.click('.es-cp [data-cp="v:r2#1"]'); await p.waitForSelector('.es-cp input[data-pi="0:0"]');
    assert.match(await p.textContent('.es-cppv'), /Ceiling tiles 600 × 600[\s\S]*Copy typed selling prices/);
    await p.click('.es-cp input[data-pi="0:0"]');
    assert.equal(await p.textContent('.es-cp [data-cp="go"]'), 'Copy 1 item');
    await p.click('.es-cp [data-cp="go"]'); await sleep(200);
    let est = (await st()).est;
    assert.equal(est.sections.length, 2);
    const cp = est.sections[1].items[0];
    assert.equal(est.sections[1].title, 'Ceilings'); assert.equal(est.sections[1].workCat, 'Civil & finishing works');
    assert.match(cp.scopeHtml, /Mineral fibre tiles/); assert.equal(cp.perUnit, true); assert.equal(cp.build.material.length, 1);
    assert.equal(cp.sellLocked, undefined, 'typed price not copied (option off)'); assert.notEqual(cp.id, 'oi1');
    assert.equal(h.fs.peek('rfqs/r2/estimates/v1').sections[0].items[0].id, 'oi1', 'the other estimate is not changed');

    /* 5. Cost Build-up of A1: only the cost types in use, per unit × 120, material with waste and the last-estimate cost */
    await p.click('#es-grid tr.es-it >> nth=0 >> td.es-tot'); await p.waitForSelector('#es-bu:not([hidden])');
    assert.equal(await p.locator('#es-bu .es-grpbox').count(), 0, 'no empty cost types');
    assert.match(await p.textContent('#es-bu .es-addtypes'), /\+ Material[\s\S]*\+ Manpower[\s\S]*\+ Subcontract[\s\S]*\+ Equipment \/ Other/);
    await p.click('#es-bu [data-act="bu-per"][data-v="unit"]');
    assert.equal((await st()).est.sections[0].items[0].perUnit, true);
    await p.click('#es-bu [data-act="show-k"][data-k="material"]');
    const mat = '#es-bu .es-grpbox[data-k="material"] tr[data-lid]';
    await p.fill(`${mat} [data-f="desc"]`, 'gypsum'); await p.waitForSelector('.es-dd button');
    await p.click('.es-dd button:has-text("Gypsum board 12.5 mm MR")'); await sleep(150);
    assert.match(await p.textContent(`${mat} .es-ref`), /last estimate 21\.00 · RFQ-2610-0044 V1/);
    await p.click(`${mat} [data-act="use-rate"]`);
    await p.fill(`${mat} [data-f="qty"]`, '2.1'); await p.fill(`${mat} [data-f="waste"]`, '5');
    await p.fill(`${mat} [data-f="ref"]`, 'SQ-114 (08-11)');
    assert.equal((await p.textContent(`${mat} [data-amt]`)).trim(), '46.31');
    assert.match(await p.textContent('#es-bu .es-grpbox[data-k="material"] .es-gh'), /per 1 m²[\s\S]*46\.31 per m² × 120 =\s*5,557\.20/);
    // manpower: own staff at its internal rate; a hired trade with no rate is flagged
    await p.click('#es-bu [data-act="show-k"][data-k="manpower"]');
    const mp = '#es-bu .es-grpbox[data-k="manpower"] tr[data-lid]';
    await p.click(`${mp} >> nth=0 >> [data-act="toggle-own"]`);
    await p.fill(`${mp} >> nth=0 >> [data-f="trade"]`, 'Foreman'); await p.press(`${mp} >> nth=0 >> [data-f="trade"]`, 'Tab');
    assert.equal(await p.inputValue(`${mp} >> nth=0 >> [data-f="rate"]`), '150', 'own-staff rate from Labour Rates');
    await p.fill(`${mp} >> nth=0 >> [data-f="days"]`, '5');
    await p.click('#es-bu .es-grpbox[data-k="manpower"] [data-act="add-line"]');
    await p.fill(`${mp} >> nth=1 >> [data-f="trade"]`, 'Painter'); await p.press(`${mp} >> nth=1 >> [data-f="trade"]`, 'Tab'); await sleep(100);
    assert.match(await p.textContent(`${mp} >> nth=1`), /No rate for Painter — set it in Administration → Contracting Settings → Labour Rates/);
    await p.click(`${mp} >> nth=1 >> [data-act="del-line"]`);
    assert.match(await p.textContent('#es-bu-side'), /Manpower · own staff\s*750\.00[\s\S]*Total Cost\s*6,307\.20/);
    // the Scope of Work tab holds the item's scope
    await p.click('#es-bu [data-act="bu-tab"][data-v="scope"]');
    assert.match(await p.textContent('#es-bu .es-buscdoc'), /Gypsum partition for the new admin area/);
    if (SHOTS) await p.screenshot({ path: SHOTS + '/V2717_scope_tab.png' });
    await p.click('#es-bu [data-act="bu-tab"][data-v="cost"]');
    if (SHOTS) await p.screenshot({ path: SHOTS + '/V2717_buildup.png' });
    await p.click('#es-bu-done');

    /* 6. typed selling prices: A2 by amount; a new item priced by rate with no cost */
    await p.fill('#es-grid tr.es-it >> nth=1 >> [data-f="sellAmt"]', '10000');
    await p.click('#es-grid tr.es-it >> nth=0 >> [data-f="desc"]'); await sleep(100);
    assert.match(await p.textContent('#es-grid tr.es-it >> nth=1 >> .es-snote'), /typed · markup/);
    assert.equal(await p.locator('#es-grid tr.es-it >> nth=1 >> .es-lk').count(), 1, 'lock shown');
    await p.click('#es-grid tr.es-it >> nth=0 >> [data-f="desc"]');
    await p.click('#es-grid tr.es-add [data-act="add-item"]'); await sleep(150);
    const b1 = '#es-grid tr.es-it >> nth=2';
    await p.fill(`${b1} >> [data-f="desc"]`, 'Relocate socket & switch points');
    await p.fill(`${b1} >> [data-f="qty"]`, '6');
    await p.fill(`${b1} >> [data-f="sellRate"]`, '1000'); await p.click('#es-grid tr.es-it >> nth=0 >> [data-f="desc"]'); await sleep(100);
    c = await calc();
    const B = c.items.find(x => x.code === 'A3'), A2 = c.items.find(x => x.code === 'A2');
    assert.equal(A2.sell, 10000); assert.equal(B.sell, 6000); assert.equal(B.cost, 0); assert.equal(c.pnc, 1); assert.equal(c.unc, 0);
    assert.match(await p.getAttribute(b1, 'class'), /is-pnc/);
    assert.match(await p.textContent(`${b1} >> .es-snote`), /no cost — margin unknown/);
    assert.match(await p.textContent('#es-side'), /Typed 🔒 · 2 items\s*16,000\.00[\s\S]*Profit \(costed items\)[\s\S]*selling price but no cost/);
    assert.match(await p.textContent('#es-chk'), /1 item priced by hand without cost/);

    /* 7. round up: the rounding goes to the calculated items only */
    const upBtn = '#es-side [data-act="use-round"]:has-text("Round up")';
    const upV = Number(await p.getAttribute(upBtn, 'data-v'));
    await p.click(upBtn);
    c = await calc();
    assert.equal(c.offer, upV);
    assert.equal(c.items.find(x => x.code === 'A2').offer, 10000); assert.equal(c.items.find(x => x.code === 'A3').offer, 6000);
    assert.equal(Math.round(c.items.reduce((a, x) => a + x.offer, 0) * 100), Math.round(upV * 100));
    if (SHOTS) await p.screenshot({ path: SHOTS + '/V2717_grid.png' });

    /* 8. save: the new fields are kept */
    await p.click('#es-save'); await p.click('#app-confirm-overlay button:has-text("Save Estimate"), .confirm-overlay button:has-text("Save Estimate")'); await sleep(800);
    const doc = h.fs.peek('rfqs/r1/estimates/v1');
    const a1 = doc.sections[0].items[0], a2 = doc.sections[0].items[1], a3 = doc.sections[0].items[2];
    assert.equal(a1.perUnit, true); assert.equal(a1.scopeSrc, 'rfq'); assert.match(a1.scopeHtml, /admin area/);
    assert.deepEqual(a1.build.material.map(l => [l.productId, l.qty, l.rate, l.waste, l.ref]), [['p-gyp', 2.1, 21, 5, 'SQ-114 (08-11)']]);
    assert.deepEqual(a1.build.manpower.map(l => [l.trade, !!l.own, l.rate, l.days]), [['Foreman', true, 150, 5]]);
    assert.equal(a2.build.subcontract[0].quick, true); assert.equal(a2.sellLocked, true); assert.equal(a2.sellAmt, 10000);
    assert.equal(a3.sellBy, 'rate'); assert.equal(a3.sellRate, 1000);
    assert.equal(doc.sections[0].workCat, 'Civil & finishing works');

    /* 9. the quotation: scope, categories and the typed prices exactly */
    await p.click('#es-quote'); await p.waitForSelector('#quote-modal.open'); await sleep(600);
    const q = await p.evaluate(() => [...document.querySelectorAll('#items-tbody tr[data-line-type="item"]')].map(tr => ({ title: tr.querySelector('.qt-title').value, scope: tr.querySelector('[data-f="scope"]').value, cat: tr.dataset.wcat, total: tr.querySelector('.total-cell')?.textContent.trim() })));
    assert.equal(q.length, 4);
    assert.match(q[0].scope, /Gypsum partition for the new admin area/); assert.equal(q[0].cat, 'Civil & finishing works');
    assert.equal(q[1].total, '10,000.00'); assert.equal(q[2].total, '6,000.00');
    assert.match(q[3].scope, /Mineral fibre tiles/);
    assert.equal(await p.inputValue('#f-wcat'), 'Civil & finishing works', 'the default category comes from the estimate');
    // the quiet chip for lines that follow the default; the toolbar button's new label
    assert.equal((await p.textContent('#items-tbody tr:nth-child(2) .qt-lmeta .qt-wcat')).replace('▾', '').trim(), 'Category: default');
    assert.match(await p.textContent('#qs-ins-s'), /Insert Text…/);
    assert.match(await p.textContent('#qs-banner'), /Scope copied from RFQ-2611-0032/, 'the estimate already used the requirements');
    if (SHOTS) await p.screenshot({ path: SHOTS + '/V2717_quote.png' });

    /* 10. Labour Rates: the own-staff column in Contracting Settings */
    assert.equal(await p.evaluate(() => BCEst.settings().labourRates.find(l => l.trade === 'Foreman').ownRate), 150);
    assert.deepEqual(p.__errors, []);
  } finally { await h.close(); }
});

test('V271.7 fixes: Units master in the lists, Material list opens on demand, + Add to the master, panel percentages', { timeout: 300000 }, async () => {
  const h = await startHarness({ appDir, playwright, executablePath: process.env.CHROMIUM_PATH });
  try {
    h.fs.load(DATA);
    const p = await h.newUser({ uid: 'u-boss', email: 'boss@x', name: 'Musthafa KM' }); await h.open(p);
    await p.waitForFunction(() => typeof window.bcOpenEstimate === 'function' && typeof openNewRFQ === 'function');
    await p.addStyleTag({ content: '#toast{pointer-events:none!important}' });
    // a unit only in Master Data → Units
    await p.evaluate(() => { uomMaster.push({ id: 'uom-drum', code: 'Drum', name: 'Drum', decimals: 0, step: 1, active: true, usedFor: 'goods' }); });

    /* RFQ (Contracting): the Unit list shows all units, not only the one in the field */
    await p.evaluate(() => { showPage('rfq'); openNewRFQ(); }); await p.waitForSelector('#rfq-modal.open');
    await p.click('#rfq-type-seg label[data-type="contracting"]');
    await p.fill('#rfq-pane tr.rq-lr >> nth=0 >> [data-f="desc"]', 'Pipeline replacement work');
    await p.click('#rfq-pane tr.rq-lr >> nth=0 >> [data-f="uom"]'); await p.waitForSelector('.rq-udd [data-u]');
    const units = await p.$$eval('.rq-udd [data-u]', els => els.map(e => e.textContent.replace(' ✓', '').trim()));
    assert.ok(units.length > 5 && units.includes('Lot') && units.includes('Job') && units.includes('Drum'), units.join(','));
    assert.ok(units.indexOf('Lot') < units.indexOf('Drum'), 'service units first on a contracting line');
    await p.click('.rq-udd [data-u]:has-text("Job")');
    assert.equal(await p.inputValue('#rfq-pane tr.rq-lr >> nth=0 >> [data-f="uom"]'), 'Job');
    // + Add to the Services master: the form opens with the typed text; saved → the line is linked
    await p.fill('#rfq-pane tr.rq-lr >> nth=0 >> [data-f="desc"]', 'Pipeline replacement works'); await p.waitForSelector('.rq-dd [data-i="-2"]');
    assert.match(await p.textContent('.rq-dd [data-i="-2"]'), /Add “Pipeline replacement works” to the Services master/);
    await p.dispatchEvent('.rq-dd [data-i="-2"]', 'mousedown'); await p.waitForSelector('#prod-modal.open');
    assert.equal(await p.inputValue('#pm-name'), 'Pipeline replacement works');
    await p.evaluate(() => saveProduct()); await p.waitForFunction(() => !document.getElementById('prod-modal').classList.contains('open')); await sleep(300);
    const svc = await p.evaluate(() => products.find(x => x.name === 'Pipeline replacement works'));
    assert.equal(svc.type, 'service');
    assert.match(await p.getAttribute('#rfq-pane tr.rq-lr >> nth=0 >> .rq-src', 'class'), /\bm\b/, 'the line is linked to the new service');
    await p.evaluate(() => { document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open')); });

    /* Estimation: the panel's percentages type normally; limits */
    await p.evaluate(() => bcOpenEstimate('r1')); await p.waitForFunction(() => BCEst.state()?.version === 1);
    const oh = '#es-side [data-f="overheadPct"]';
    await p.waitForTimeout(300); await p.focus(oh); await p.keyboard.press('Control+A'); await p.keyboard.press('Backspace');
    assert.equal(await p.inputValue(oh), '', 'an emptied field stays empty while typing');
    await p.keyboard.type('3');
    assert.equal(await p.inputValue(oh), '3');
    assert.equal(Number((await p.evaluate(() => BCEst.state().est.overheadPct))), 3);
    await p.keyboard.type('00');
    assert.match(await p.getAttribute(oh, 'class'), /is-bad/, '300 % is out of range');
    assert.match(await p.textContent('#es-chk'), /Overheads must be between 0 and 100 %/);
    await p.keyboard.press('Backspace'); await p.keyboard.press('Backspace');
    assert.doesNotMatch(String(await p.getAttribute(oh, 'class')), /is-bad/);

    /* Cost Build-up: + Material does not pop the list; the Units master in the unit list (goods first); + Add to the Item Master */
    await p.click('#es-grid tr.es-it >> nth=0 >> td.es-tot'); await p.waitForSelector('#es-bu:not([hidden])');
    await p.click('#es-bu [data-act="show-k"][data-k="material"]'); await sleep(200);
    assert.equal(await p.locator('.es-dd').count(), 0, 'no list until typing, Alt+↓ or a click');
    const mat = '#es-bu .es-grpbox[data-k="material"] tr[data-lid]';
    assert.equal(await p.inputValue(`${mat} [data-f="unit"]`), '', 'a free-text material starts with no unit');
    await p.press(`${mat} [data-f="desc"]`, 'Alt+ArrowDown'); await p.waitForSelector('.es-dd button'); await p.keyboard.press('Escape');
    await p.click(`${mat} [data-f="unit"]`); await p.waitForSelector('.es-dd button');
    const ul = await p.$$eval('.es-dd > *', els => els.map(e => e.textContent.replace(' ✓', '').trim()));
    assert.equal(ul[0], 'Goods units'); assert.ok(ul.includes('Drum') && ul.includes('LS'), ul.join(','));
    assert.ok(ul.indexOf('Drum') < ul.indexOf('LS'), 'goods units first for material');
    await p.click('.es-dd button:has-text("Drum")');
    await p.fill(`${mat} [data-f="desc"]`, 'White enamel paint'); await p.waitForSelector('.es-dd .es-ddadd');
    await p.click('.es-dd button:has(.es-ddadd)'); await p.waitForSelector('#prod-modal.open');
    assert.equal(await p.inputValue('#pm-name'), 'White enamel paint');
    await p.evaluate(() => saveProduct()); await p.waitForFunction(() => !document.getElementById('prod-modal').classList.contains('open')); await sleep(300);
    const l = await p.evaluate(() => BCEst.state().est.sections[0].items[0].build.material[0]);
    const np = await p.evaluate(() => products.find(x => x.name === 'White enamel paint'));
    assert.equal(np.type, 'goods'); assert.equal(l.productId, np.id); assert.equal(l.desc, 'White enamel paint');
    assert.deepEqual(p.__errors, []);
  } finally { await h.close(); }
});

test('V271.7.2: window width cap, subtotal / total rows, ↑ / ↓ in the same column', { timeout: 300000 }, async () => {
  const h = await startHarness({ appDir, playwright, executablePath: process.env.CHROMIUM_PATH });
  try {
    h.fs.load(DATA);
    const p = await h.newUser({ uid: 'u-boss', email: 'boss@x', name: 'Musthafa KM' }); await h.open(p);
    await p.waitForFunction(() => typeof window.bcOpenEstimate === 'function');
    await p.addStyleTag({ content: '#toast{pointer-events:none!important}' });
    await p.setViewportSize({ width: 2400, height: 1100 });
    await p.evaluate(() => bcOpenEstimate('r1')); await p.waitForFunction(() => BCEst.state()?.version === 1);
    await p.waitForSelector('#es-grid tr.es-it >> nth=1');

    /* big monitor: 1680 px, centred; the Quotation window is the same size */
    const box = await p.locator('#estimate-modal .es-win').boundingBox();
    assert.equal(Math.round(box.width), 1680); assert.ok(Math.abs(box.x - (2400 - 1680) / 2) < 3, 'centred: ' + box.x);
    const qw = await p.evaluate(() => { const m = document.getElementById('quote-modal'); m.classList.add('open'); const w = m.querySelector('.qt-win').getBoundingClientRect().width; m.classList.remove('open'); return w; });
    assert.equal(Math.round(qw), 1680);

    /* subtotal and total rows: Total Cost and Sell Amount bold navy; total row light blue */
    await p.fill('#es-grid tr.es-it >> nth=0 >> [data-f="q-material"]', '1000'); await p.keyboard.press('Tab');
    const st = await p.evaluate(() => {
      const css = el => { const c = getComputedStyle(el); return { color: c.color, weight: c.fontWeight, bg: c.backgroundColor }; };
      const sub = document.querySelectorAll('#es-grid tr.es-sub[data-subof] td.es-key'), foot = document.querySelectorAll('#es-grid tfoot td.es-key');
      return { n: sub.length, f: foot.length, sub: css(sub[0]), foot: css(foot[0]), footBg: css(document.querySelector('#es-grid tfoot td')).bg };
    });
    assert.equal(st.n, 2); assert.equal(st.f, 2);
    assert.equal(st.sub.color, 'rgb(23, 58, 94)'); assert.equal(st.sub.weight, '800');
    assert.equal(st.foot.color, 'rgb(23, 58, 94)'); assert.equal(st.foot.weight, '800'); assert.equal(st.footBg, 'rgb(238, 244, 251)');

    /* grid: ↑ / ↓ go to the same column of the item above / below */
    const row = i => `#es-grid tr.es-it >> nth=${i}`;
    const at = () => p.evaluate(() => { const a = document.activeElement, tr = a.closest('tr.es-it'); return tr ? [...document.querySelectorAll('#es-grid tr.es-it')].indexOf(tr) + ':' + a.dataset.f : 'none'; });
    await p.focus(`${row(0)} >> [data-f="qty"]`); await p.keyboard.press('ArrowDown');
    assert.equal(await at(), '1:qty');
    await p.keyboard.press('ArrowDown'); assert.equal(await at(), '1:qty', 'last item: stays');
    await p.keyboard.press('ArrowUp'); assert.equal(await at(), '0:qty');
    await p.focus(`${row(1)} >> [data-f="sellAmt"]`); await p.keyboard.press('ArrowUp'); assert.equal(await at(), '0:sellAmt');
    // a multi-line description: the arrows move inside it until its first / last line
    await p.fill(`${row(0)} >> [data-f="desc"]`, 'Line one\nLine two');
    await p.evaluate(() => { const t = document.querySelector('#es-grid tr.es-it [data-f="desc"]'); t.focus(); t.setSelectionRange(0, 0); });
    await p.keyboard.press('ArrowDown'); assert.equal(await at(), '0:desc', 'moves to the second line first');
    await p.evaluate(() => { const t = document.activeElement; t.setSelectionRange(t.value.length, t.value.length); });
    await p.keyboard.press('ArrowDown'); assert.equal(await at(), '1:desc');
    // the Unit list that opens on entering the field doesn't take the arrows; Alt+↓ goes into it
    await p.focus(`${row(0)} >> [data-f="unit"]`); await p.waitForSelector('.es-dd button');
    await p.keyboard.press('ArrowDown'); assert.equal(await at(), '1:unit');
    await p.waitForSelector('.es-dd button'); await p.keyboard.press('Alt+ArrowDown');
    assert.equal(await at(), '1:unit'); assert.equal(await p.locator('.es-dd button.on').count(), 1, 'Alt+↓ highlights the first unit');
    await p.keyboard.press('Escape');

    /* Cost Build-up: same, within the lines of one cost type */
    await p.click(`${row(1)} >> td.es-tot`); await p.waitForSelector('#es-bu:not([hidden])');
    await p.click('#es-bu [data-act="show-k"][data-k="material"]');
    await p.click('#es-bu .es-grpbox[data-k="material"] [data-act="add-line"]'); await sleep(150);
    const mat = '#es-bu .es-grpbox[data-k="material"] tr[data-lid]';
    assert.ok(await p.locator(mat).count() >= 2);
    const bat = () => p.evaluate(() => { const a = document.activeElement, tr = a.closest('tr[data-lid]'); return tr ? [...tr.closest('.es-grpbox').querySelectorAll('tr[data-lid]')].indexOf(tr) + ':' + a.dataset.f : 'none'; });
    await p.focus(`${mat} >> nth=0 >> [data-f="rate"]`); await p.keyboard.press('ArrowDown'); assert.equal(await bat(), '1:rate');
    await p.keyboard.press('ArrowUp'); assert.equal(await bat(), '0:rate');
    await p.focus(`${mat} >> nth=0 >> [data-f="desc"]`); await p.keyboard.press('ArrowDown');
    assert.equal(await bat(), '1:desc'); assert.equal(await p.locator('.es-dd').count(), 0, '↓ moves, no list');
    await p.keyboard.press('Alt+ArrowDown'); await p.waitForSelector('.es-dd button'); await p.keyboard.press('Escape');
    assert.deepEqual(p.__errors, []);
  } finally { await h.close(); }
});
