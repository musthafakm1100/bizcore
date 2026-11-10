/** BROWSER (simulator): V271.6 — Contracting / Service quotation scope (mockups 6–13):
 *  Master Data Products / Services split, required work categories (default + per line), RFQ requirements copied once
 *  as the starting scope, the scope body record (saved with the quotation, loaded when it opens), the full editor,
 *  Text Blocks (library tab, insert, use count), Insert from a previous quotation, print with Annexure A, the Job's
 *  frozen scope tab. Real index.html + js/quote-scope.js; the database is the shared in-memory simulator (no rules). */
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
const line = (desc, extra = {}) => ({ lineType: 'item', rowKind: 'scope', type: 'contracting', desc, qty: 1, uom: 'Job', up: 1000, ...extra });
const RFQ_TEXT = 'Partition for the new admin area, ground floor, Building C.\nAbout 120 m2, height 3 m, two doors.\nRelocate the electrical points to the new walls.';
const LONG = Array.from({ length: 14 }, (_, i) => `<div>${i + 1}. Step ${i + 1} of the works — supply, install, test and hand over.</div>`).join('');
const SEED = {
  'system/deliveryNoteStorage': { mode: 'independent', minClientVersion: 260 },
  'system/invoiceStorage': { mode: 'independent' },
  'system/accessControl': { adminUids: ['u-boss'] },
  'customers/c1': { id: 'c1', code: 'CUS-00001', company: 'Arnon Plastic Company', vat: '' },
  'products/s-part': { id: 's-part', type: 'service', code: 'SRV-000010', name: 'Gypsum partition works', uom: 'm²', price: 350, category: 'Civil & finishing works' },
  'products/s-el': { id: 's-el', type: 'service', code: 'SRV-000011', name: 'Electrical point relocation', uom: 'Nos', price: 1000, category: 'Electrical works', stdScope: true },
  'products/p-paper': { id: 'p-paper', type: 'goods', code: 'ITM-000045', name: 'A4 copy paper 80gsm box', uom: 'Box', price: 92, brand: 'Double A', model: 'A4-80' },
  'textBlocks/svc_s-el': { id: 'svc_s-el', serviceId: 's-el', title: 'Standard scope — Electrical point relocation', section: 'Scope', appliesTo: ['service', 'contracting'], html: '<div>Relocate points incl. conduit, wiring to the nearest junction box and testing.</div>', active: true },
  'textBlocks/tb-exc': { id: 'tb-exc', title: 'Standard exclusions — interior works', section: 'Exclusions', appliesTo: ['service', 'contracting'], html: '<ul><li>Painting finish</li><li>Floor protection beyond the work area</li></ul>', active: true, usedCount: 4 },
  'textBlocks/tb-war': { id: 'tb-war', title: 'Warranty — 12 months', section: 'Warranty', appliesTo: ['service', 'contracting'], html: '<div>12 months workmanship warranty from handover.</div>', active: true, usedCount: 1 },
  'rfqs/r5': { id: 'r5', rfqNo: 'RFQ-2611-0012', date: '2026-11-08', company: 'Arnon Plastic Company', custId: 'c1', requestType: 'service', status: 'New', desc: RFQ_TEXT, ref: '', workCategory: 'Civil & finishing works' },
  'quotations/Q-R': { id: 'Q-R', qno: 'QT-2611-0042', date: '2026-11-09', company: 'Arnon Plastic Company', custId: 'c1', rfqId: 'r5', status: 'Draft', vatRate: 15, quoteType: 'contracting',
    items: [line('Gypsum board partitions with doors', { qty: 120, uom: 'm²', up: 350 }), line('Relocate electrical points', { qty: 6, uom: 'Nos', up: 1000 })] },
  'quotations/Q-OLD': { id: 'Q-OLD', qno: 'QT-2610-0031', date: '2026-10-12', company: 'Arnon Plastic Company', custId: 'c1', status: 'Won', vatRate: 15, quoteType: 'contracting', scopeBody: true, workCategory: 'Civil & finishing works',
    items: [line('Ceiling tiles 600 × 600 — supply & install', { qty: 80, uom: 'm²', up: 120, workCat: 'Civil & finishing works', scopeKey: 'skold1', scopePreview: 'Mineral fibre tiles' }), { lineType: 'note', text: 'Work during office hours only.' }] },
  'quotations/Q-OLD/bodies/main': { qid: 'Q-OLD', qno: 'QT-2610-0031', scopes: { skold1: '<div><b>Mineral fibre tiles</b> 600 × 600 mm on exposed grid T24.</div>' }, updated: '2026-10-12' },
  'jobs/JOB-2611-0007': { id: 'JOB-2611-0007', jobNo: 'JOB-2611-0007', status: 'Open', date: '2026-11-12', quotationId: 'Q-OLD', qno: 'QT-2610-0031', company: 'Arnon Plastic Company', contractValue: 9600, vatRate: 15, budget: { totalCost: 7000 }, plannedProfit: 2600, created: '2026-11-12T08:00:00Z', updated: '2026-11-12T08:00:00Z' },
  'jobs/JOB-2611-0007/scope/main': { jobId: 'JOB-2611-0007', jobNo: 'JOB-2611-0007', quotationId: 'Q-OLD', qno: 'QT-2610-0031', revisionNo: 1, company: 'Arnon Plastic Company', acceptedAt: '2026-11-12T08:00:00Z',
    lines: [{ k: 'line', n: 1, title: 'Ceiling tiles 600 × 600 — supply & install', html: '<div><b>Mineral fibre tiles</b> on exposed grid.</div>', workCat: 'Civil & finishing works', qty: 80, uom: 'm²', amount: 9600 }, { k: 'note', text: 'Work during office hours only.', html: '' }] },
};

test('V271.6 Products / Services split in Master Data; standard scope of a service item', { timeout: 200000 }, async () => {
  const h = await startHarness({ appDir, playwright, executablePath: process.env.CHROMIUM_PATH });
  try {
    h.fs.load(SEED);
    const p = await h.newUser({ uid: 'u-boss', email: 'boss@x', name: 'Boss' }); await h.open(p);
    await p.evaluate(() => { showPage('masters'); switchMastersTab('services'); }); await sleep(300);
    assert.match(await p.getAttribute('#masters-tab-products', 'class'), /prod-view-service/);
    assert.match(await p.textContent('#prod-reg-title'), /Service database/);
    assert.equal((await p.textContent('#prod-add-lbl')).trim(), 'Add service');
    const svcRows = await p.$$eval('#products-tbody tr', rs => rs.map(r => r.textContent));
    assert.equal(svcRows.length, 2); assert.ok(svcRows.every(t => /SRV-/.test(t)), 'services only');
    assert.equal(await p.isVisible('#masters-tab-products thead th:nth-child(6)'), false, 'Brand hidden for services');
    // Add service → the form starts as a service, with the Standard scope section
    await p.click('#prod-add-btn'); await sleep(300);
    assert.equal(await p.isVisible('#pm-stdscope-sec'), true);
    await p.evaluate(() => document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m.id))); await sleep(200);
    await p.evaluate(() => switchMastersTab('products')); await sleep(300);
    const goods = await p.$$eval('#products-tbody tr', rs => rs.map(r => r.textContent));
    assert.equal(goods.length, 1); assert.match(goods[0], /ITM-000045/);
    assert.equal(await p.isVisible('#masters-tab-products thead th:nth-child(6)'), true);
    // a service with a standard scope: the form loads it from its text block
    await p.evaluate(() => { switchMastersTab('services'); openEditProduct('s-el'); });
    await p.waitForFunction(() => /conduit/.test(document.getElementById('pm-stdscope')?.textContent || ''));
    await p.evaluate(() => document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m.id))); await sleep(200);
    // RFQ: the optional Work category shows for Contracting only, with the service categories
    await p.evaluate(() => { showPage('rfq'); openNewRFQ(); }); await p.waitForSelector('#rfq-modal.open');
    const wcHidden = () => p.evaluate(() => document.getElementById('rfq-wcat-wrap').hidden);
    assert.equal(await wcHidden(), true);
    await p.click('#rfq-type-seg label[data-type="service"]'); assert.equal(await wcHidden(), true);
    await p.click('#rfq-type-seg label[data-type="contracting"]'); assert.equal(await wcHidden(), false);
    await p.evaluate(() => BCRfq.showTab('reqs')); assert.equal(await p.isVisible('#rfq-wcat'), true, 'on the Requirements tab');
    const opts = await p.$$eval('#rfq-wcat option', o => o.map(x => x.value));
    assert.equal(opts[0], '', '"Not decided yet" first'); assert.ok(opts.includes('Electrical works') && !opts.includes('Stationery'));
    await p.selectOption('#rfq-wcat', 'Electrical works');
    assert.equal(await p.evaluate(() => BCRfq.collect ? BCRfq.collect().workCategory : document.getElementById('rfq-wcat').value), 'Electrical works');
    assert.deepEqual(p.__errors, []);
  } finally { await h.close(); }
});

test('V271.6 Services quotation: categories, RFQ starting scope, full editor, blocks, previous quotation, body record, Annexure A', { timeout: 300000 }, async () => {
  const h = await startHarness({ appDir, playwright, executablePath: process.env.CHROMIUM_PATH, requireCats: true });
  try {
    h.fs.load(SEED);
    const p = await h.newUser({ uid: 'u-boss', email: 'boss@x', name: 'Boss' }); await h.open(p);
    await p.waitForFunction(() => window.BCScope && typeof editQuotation === 'function' && quotations.length >= 2, null, { timeout: 20000 });

    /* 1. open: the title + scope box per line, the default category from the RFQ, the RFQ banner */
    await p.evaluate(() => editQuotation('Q-R')); await p.waitForSelector('#quote-modal.open'); await sleep(600);
    assert.equal(await p.locator('#items-tbody tr[data-row-kind="scope"] .qt-title').count(), 2);
    assert.equal(await p.locator('#items-tbody tr[data-row-kind="scope"] .qt-sbody[contenteditable="true"]').count(), 2);
    assert.equal(await p.inputValue('#f-wcat'), 'Civil & finishing works', 'default category taken from the RFQ');
    assert.equal(await p.isVisible('#qs-banner'), true);
    assert.match(await p.textContent('#qs-banner'), /RFQ-2611-0012[\s\S]*Use as starting scope/);
    const w = await p.evaluate(() => { const b = document.querySelector('#items-tbody tr .qt-sbw').getBoundingClientRect(); const t = document.querySelector('#items-tbody tr .qt-title').getBoundingClientRect(); return [Math.round(b.width), Math.round(t.width)]; });
    assert.ok(w[0] > w[1] + 150, 'the scope box spans under Qty … Line Total: ' + w);
    // the customer's original, then copy it once as the starting scope of line 1
    await p.click('#qs-banner [data-qs="orig"]'); await p.waitForSelector('.qs-cf .qs-orig');
    assert.match(await p.textContent('.qs-cf .qs-orig'), /About 120 m2/);
    await p.keyboard.press('Escape');
    await p.click('#items-tbody tr:nth-child(1) .qt-title');
    await p.click('#qs-banner [data-qs="use"]'); await sleep(200);
    assert.match(await p.evaluate(() => document.querySelector('#items-tbody tr:nth-child(1) [data-f="scope"]').value), /^Partition for the new admin area[\s\S]*Relocate the electrical points/);
    assert.match(await p.textContent('#items-tbody tr:nth-child(1) .qs-tags'), /Copied from RFQ · RFQ-2611-0012/);
    assert.match(await p.textContent('#qs-banner'), /Scope copied from RFQ-2611-0012/);
    assert.equal(await p.locator('#qs-banner [data-qs="use"]').count(), 0, 'copied once');
    await p.keyboard.type(' Rewritten.'); await sleep(100);
    assert.match(await p.textContent('#items-tbody tr:nth-child(1) .qs-tags'), /Edited/);
    assert.equal(h.fs.peek('rfqs/r5').desc, RFQ_TEXT, 'the RFQ keeps the original');

    /* 2. a line's own category (from the chip); the summary totals by category */
    await p.click('#items-tbody tr:nth-child(2) .qt-lmeta .qt-wcat'); await p.waitForSelector('.qs-catmenu');
    await p.click('.qs-catmenu [data-cat="Electrical works"]'); await sleep(150);
    assert.match(await p.textContent('#items-tbody tr:nth-child(2) .qt-lmeta .qt-wcat'), /Electrical works/);
    assert.match(await p.getAttribute('#items-tbody tr:nth-child(2) .qt-lmeta .qt-wcat', 'class'), /is-other/);
    assert.match(await p.textContent('#qs-catbox'), /Civil & finishing works\s*42,000\.00[\s\S]*Electrical works\s*6,000\.00/);

    /* 3. the full editor: title, scope, insert a block at the cursor, Done */
    await p.click('#items-tbody tr:nth-child(2) .qs-exp'); await p.waitForSelector('.qs-ov .qs-ed');
    assert.equal(await p.inputValue('.qs-ed .qs-ed-title'), 'Relocate electrical points');
    assert.match(await p.textContent('.qs-ed .qs-ed-fig'), /6 Nos/);
    await p.click('.qs-ed .qs-ed-doc'); await p.keyboard.type('Relocate 6 nos. socket and switch points to the new walls.');
    await p.click('.qs-ed [data-ed="block"]'); await p.waitForSelector('.qs-pick .qs-pk-it');
    await p.click('.qs-pick [data-p="b:tb-war"]'); await p.click('.qs-pick [data-p="insert"]'); await sleep(200);
    assert.match(await p.textContent('.qs-ed .qs-ed-doc'), /socket and switch[\s\S]*12 months workmanship warranty/);
    if (SHOTS) await p.screenshot({ path: SHOTS + '/V2716_editor.png' });
    await p.click('.qs-ed [data-ed="done"]'); await sleep(200);
    assert.equal(await p.locator('.qs-ov').count(), 0);
    assert.match(await p.evaluate(() => document.querySelector('#items-tbody tr:nth-child(2) [data-f="scope"]').value), /socket and switch[\s\S]*warranty/);

    /* 4. Insert… → a text block as a new heading + plain note; the use count moves */
    await p.click('#qs-ins-s'); await p.waitForSelector('.qs-pick .qs-pk-it');
    assert.match(await p.textContent('.qs-pick .qs-pk-list'), /Standard exclusions — interior works[\s\S]*used 4×/);
    assert.doesNotMatch(await p.textContent('.qs-pick .qs-pk-list'), /Standard scope —/, 'service standard scopes are not listed');
    await p.click('.qs-pick [data-p="b:tb-exc"]');
    assert.match(await p.textContent('.qs-pick .qs-tgts'), /New heading \+ note — "Exclusions & Assumptions"[\s\S]*Note under the selected line[\s\S]*Add to the Remarks tab/);
    await p.click('.qs-pick [data-p="insert"]'); await sleep(300);
    const special = await p.$$eval('#items-tbody tr.quote-special-row', rs => rs.map(r => [r.dataset.lineType, r.querySelector('.quote-special-text').value, r.dataset.noteStyle || '', r.querySelector('.qt-note-l') ? getComputedStyle(r.querySelector('.qt-note-l')).display : '']));
    assert.deepEqual(special[0].slice(0, 2), ['heading', 'Exclusions & Assumptions']);
    assert.equal(special[1][0], 'note'); assert.match(special[1][1], /Painting finish/); assert.equal(special[1][2], 'text');
    assert.equal(special[1][3], 'none', 'a plain text note shows no "Note:" label');
    await p.waitForFunction(() => true); await sleep(200);
    assert.equal(h.fs.peek('textBlocks/tb-exc').usedCount, 5);
    assert.equal(h.fs.peek('textBlocks/tb-exc').html, SEED['textBlocks/tb-exc'].html, 'the block itself is not changed');

    /* 5. Insert from a previous quotation (its body record loads on choosing it) → a new line, no rate */
    await p.click('#qs-ins-s'); await p.waitForSelector('.qs-pick');
    await p.click('.qs-pick [data-p="tab-prev"]'); await p.waitForSelector('.qs-pick [data-p="q:Q-OLD"]');
    await p.click('.qs-pick [data-p="q:Q-OLD"]'); await p.waitForSelector('.qs-pick input[data-p="pl:0"]');
    assert.match(await p.textContent('.qs-pick .qs-pk-pv'), /Mineral fibre tiles 600 × 600 mm/);
    await p.click('.qs-pick input[data-p="pl:0"]');
    await p.click('.qs-pick [data-p="insert-prev"]'); await sleep(300);
    const rows = await p.$$eval('#items-tbody tr[data-row-kind="scope"]', rs => rs.map(r => [r.querySelector('.qt-title').value, r.querySelector('[data-quote-price]')?.value || '', r.querySelector('.qs-tags').textContent, r.querySelector('[data-f="scope"]').value]));
    const got = rows.find(r => /Ceiling tiles/.test(r[0]));
    assert.ok(got, 'line copied'); assert.match(got[2], /From QT-2610-0031/); assert.match(got[3], /Mineral fibre tiles/);
    assert.ok(!Number(String(got[1]).replace(/,/g, '')), 'no rate copied');
    await p.evaluate(() => { const tr = [...document.querySelectorAll('#items-tbody tr[data-row-kind="scope"]')].find(r => /Ceiling/.test(r.querySelector('.qt-title').value)); tr.querySelector('[data-quote-price]').value = '115'; tr.querySelector('[data-quote-price]').dispatchEvent(new Event('input', { bubbles: true })); calcTotals(); });

    /* 6. required categories: no default → save blocked */
    await p.evaluate(() => { document.getElementById('f-wcat').value = ''; document.querySelectorAll('#items-tbody tr[data-row-kind="scope"]').forEach(tr => { if (tr.dataset.wcat === 'Civil & finishing works') tr.dataset.wcat = ''; }); });
    await p.evaluate(() => saveQuotation()); await sleep(300);
    assert.equal(h.fs.peek('quotations/Q-R').scopeBody, undefined, 'not saved without a category');
    assert.match(await p.getAttribute('#qs-wdef-b', 'class'), /is-missing/);
    await p.click('#qs-wdef-b'); await p.waitForSelector('.qs-catmenu'); await p.click('.qs-catmenu [data-cat="Civil & finishing works"]'); await sleep(150);
    // a long scope on line 1 (printed as Annexure A)
    await p.evaluate(html => { const ed = document.querySelector('#items-tbody tr:nth-child(1) [data-f="scope"]'); ed.innerHTML = html; ed.dispatchEvent(new Event('input', { bubbles: true })); }, LONG);
    if (SHOTS) await p.screenshot({ path: SHOTS + '/V2716_quote.png' });
    { const sv = p.evaluate(() => saveQuotation()); sv.catch(() => {}); await p.waitForSelector('#app-confirm-overlay'); assert.match(await p.textContent('#app-confirm-overlay'), /Save changes to quotation/); await p.click('#confirm-ok'); await sv; await sleep(1200); }

    /* 7. saved: lines keep title / category / key / preview; the text is in the body record */
    const q = h.fs.peek('quotations/Q-R'), b = h.fs.peek('quotations/Q-R/bodies/main');
    assert.equal(q.workCategory, 'Civil & finishing works'); assert.equal(q.scopeBody, true); assert.equal(q.rfqScopeUsed, true);
    const L = q.items.filter(i => i.lineType === 'item');
    assert.deepEqual(L.map(i => [i.desc, i.workCat]), [['Gypsum board partitions with doors', 'Civil & finishing works'], ['Relocate electrical points', 'Electrical works'], ['Ceiling tiles 600 × 600 — supply & install', 'Civil & finishing works']]);
    assert.ok(L.every(i => i.scopeKey && i.scopePreview && !i.descHtml));
    assert.notEqual(L[2].scopeKey, 'skold1', 'a copied scope gets its own key');
    assert.match(b.scopes[L[0].scopeKey], /Step 14 of the works/); assert.match(b.scopes[L[1].scopeKey], /warranty/); assert.match(b.scopes[L[2].scopeKey], /Mineral fibre/);
    assert.equal(L[0].scopeSrc, 'rfq:RFQ-2611-0012'); assert.equal(L[0].scopeEdited, true); assert.equal(L[2].scopeSrc, 'prev:QT-2610-0031');
    assert.ok(JSON.stringify(q).length < 6000, 'the quotation itself stays small: ' + JSON.stringify(q).length);
    assert.match(h.fs.peek('quotations/Q-OLD/bodies/main').scopes.skold1, /Mineral fibre/, 'the source quotation is not changed');
    await p.evaluate(() => document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m.id))); await sleep(300);

    /* 8. print: Automatic → line 1 (long) as Annexure A, the short ones inline; Always inline → no annexure */
    const pr = await p.evaluate(() => { const q = quotations.find(x => x.id === 'Q-R'); _printQID = 'Q-R'; _quotationOutputOptions = { signature: false, stamp: false };
      BCScope.printBegin(q, 'auto'); printQuotationErpVariant('Q-R', 'contracting'); BCScope.printEnd(); const a = window.__popups.at(-1).document.html;
      BCScope.printBegin(q, 'inline'); printQuotationErpVariant('Q-R', 'contracting'); BCScope.printEnd(); const b = window.__popups.at(-1).document.html; return { a, b }; });
    assert.match(pr.a, /Detailed scope: Annexure A, item 1/);
    assert.match(pr.a, /Annexure A — Scope of Work[\s\S]*Item 1 — Gypsum board partitions with doors[\s\S]*Step 14 of the works/);
    assert.equal(pr.a.split('Item 1 — Gypsum').length, 2, 'one annexure item per line'); assert.doesNotMatch(pr.a, /Annexure A, item 2/);
    assert.match(pr.a, /class="bc-rtx bc-scb"[^>]*>[\s\S]*socket and switch/, 'a short scope prints under its line');
    assert.doesNotMatch(pr.b, /Annexure A/); assert.match(pr.b, /Step 14 of the works/);

    /* 9. a fresh session: the body record is read when the quotation opens */
    const p2 = await h.newUser({ uid: 'u-boss', email: 'boss@x', name: 'Boss' }); await h.open(p2);
    await p2.waitForFunction(() => window.BCScope && quotations.some(q => q.id === 'Q-R'), null, { timeout: 20000 });
    assert.equal(await p2.evaluate(() => BCScope.needsBody(quotations.find(q => q.id === 'Q-R'))), true);
    await p2.evaluate(() => editQuotation('Q-R')); await p2.waitForSelector('#quote-modal.open'); await sleep(700);
    assert.match(await p2.evaluate(() => document.querySelector('#items-tbody tr:nth-child(1) [data-f="scope"]').value), /Step 14 of the works/);
    assert.equal(await p2.inputValue('#f-wcat'), 'Civil & finishing works');
    assert.match(await p2.textContent('#qs-banner'), /Scope copied from RFQ-2611-0012/);
    assert.deepEqual(p.__errors, []); assert.deepEqual(p2.__errors, []);
  } finally { await h.close(); }
});

test('V271.6 Text Blocks library (Master Data → Proposal Text) and the Job\'s frozen Scope tab', { timeout: 200000 }, async () => {
  const h = await startHarness({ appDir, playwright, executablePath: process.env.CHROMIUM_PATH });
  try {
    h.fs.load(SEED);
    const p = await h.newUser({ uid: 'u-boss', email: 'boss@x', name: 'Boss' }); await h.open(p);
    await p.evaluate(() => { showPage('masters'); switchMastersTab('textblocks'); });
    await p.waitForSelector('#tb-host tr[data-tb]');
    const list = await p.$$eval('#tb-host tr[data-tb]', rs => rs.map(r => r.dataset.tb));
    assert.deepEqual(list.sort(), ['tb-exc', 'tb-war'], 'service standard scopes are kept out of the library');
    await p.click('#tb-new'); await p.fill('#tb-title', 'Assumptions — site access'); await p.selectOption('#tb-section', 'Assumptions');
    await p.click('#tb-html'); await p.keyboard.type('Site access, power and water by the client.');
    await p.click('#tb-save'); await sleep(500);
    const saved = Object.values(h.fs.dump('textBlocks/')).find(b => b.title === 'Assumptions — site access');
    assert.ok(saved, 'block saved'); assert.equal(saved.section, 'Assumptions'); assert.match(saved.html, /power and water/); assert.equal(saved.active, true);
    if (SHOTS) await p.screenshot({ path: SHOTS + '/V2716_textblocks.png' });
    // deactivate
    await p.click(`#tb-host tr[data-tb="${saved.id}"]`); await p.click('#tb-onoff'); await sleep(400);
    assert.equal(h.fs.peek('textBlocks/' + saved.id).active, false);

    // the job view: Scope tab with the frozen copy; print for the site team without prices
    await p.evaluate(() => BCJobs.view('JOB-2611-0007'));
    await p.waitForFunction(() => document.getElementById('job-view-modal')?.classList.contains('open'));
    assert.match(await p.textContent('#jv-tabs'), /Overview\s*Scope/);
    await p.evaluate(() => BCJobs._tab('scope')); await p.waitForSelector('#jv-scope .js-banner');
    assert.match(await p.textContent('#jv-scope'), /Accepted scope — frozen[\s\S]*QT-2610-0031[\s\S]*Ceiling tiles[\s\S]*9,600\.00/);
    if (SHOTS) await p.screenshot({ path: SHOTS + '/V2716_jobscope.png' });
    await p.click('#js-print'); await sleep(300);
    const html = await p.evaluate(() => window.__popups.at(-1).document.html);
    assert.match(html, /Scope of Work — JOB-2611-0007[\s\S]*Mineral fibre tiles/); assert.doesNotMatch(html, /9,600/);
    // the scope copy written with a new job (unit check of the document)
    const d = await p.evaluate(() => BCScope.jobScopeDoc({ id: 'Q-X', qno: 'QT-1', revisionNo: 2, items: [{ lineType: 'heading', text: 'A' }, { lineType: 'item', desc: 'Line', qty: 2, up: 50, discAmt: 10, workCat: 'Electrical works', scopeHtml: '' }] }, { id: 'J1', jobNo: 'J1' }));
    assert.deepEqual(d.lines, [{ k: 'heading', text: 'A' }, { k: 'line', n: 1, title: 'Line', html: '', workCat: 'Electrical works', qty: 2, uom: '', amount: 90 }]);
    assert.equal(d.jobId, 'J1'); assert.equal(d.quotationId, 'Q-X');
    assert.deepEqual(p.__errors, []);
  } finally { await h.close(); }
});
