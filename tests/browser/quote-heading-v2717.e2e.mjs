/** BROWSER (simulator): V271.7.3 — quotation headings (boards 19–20): the heading prints inside the Description column
 *  (no band, no number), its title and its own scope are formatted with the Format bar, Insert Text puts a block into a
 *  heading's scope, an optional "grouped" heading carries 1 Lot + the sum of its lines on print (the lines show qty, unit,
 *  unit price), the estimate print style "Section Total with Item Rates", and a note under a Services line starts under
 *  the description. Real index.html; the database is the shared in-memory simulator (no rules). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { startHarness } from './harness.mjs';
const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const playwright = createRequire(process.env.PLAYWRIGHT_FROM || import.meta.url)('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const line = (desc, k, up, extra = {}) => ({ lineType: 'item', rowKind: 'scope', type: 'contracting', desc, qty: 1, uom: 'LS', up, workCat: 'Civil & finishing works', scopeKey: k, scopePreview: 'Size', ...extra });
const SEED = {
  'system/deliveryNoteStorage': { mode: 'independent', minClientVersion: 260 }, 'system/invoiceStorage': { mode: 'independent' },
  'system/accessControl': { adminUids: ['u-boss'] },
  'customers/c1': { id: 'c1', code: 'CUS-00001', company: 'Arnon Plastic Company', city: 'Riyadh' },
  'textBlocks/tb-scope': { id: 'tb-scope', title: 'Standard scope — shutter doors', section: 'Scope', appliesTo: ['service', 'contracting'], html: '<div>Supply, installation of automatic shutter doors as per site requirements.</div>', active: true, usedCount: 0 },
  'quotations/Q-H': { id: 'Q-H', qno: 'QT-2611-0071', date: '2026-11-11', company: 'Arnon Plastic Company', custId: 'c1', contact: 'Mr. Anzil', status: 'Draft', vatRate: 15, quoteType: 'contracting', scopeBody: true, workCategory: 'Civil & finishing works', validity: 7,
    items: [
      { lineType: 'heading', text: 'Project: Installation of Automatic Shutter Doors (4 Locations)' },
      line('Shutter Door Size: 512 × 510 cm', 'k1', 13800),
      line('Shutter Door Size: 450 × 500 cm', 'k2', 9800, { qty: 2 }),
      { lineType: 'note', text: 'This item is supply only, not installation', noteStyle: 'blueAccent' },
      line('Shutter Door Size: 455 × 500 cm', 'k3', 13100),
    ] },
  'quotations/Q-H/bodies/main': { qid: 'Q-H', qno: 'QT-2611-0071', scopes: { k1: '<div>Husky Warehouse</div>', k2: '<div>New Warehouse (Opposite Bandera)</div>', k3: '<div>New Warehouse (Opposite Bandera)</div>' }, updated: '2026-11-11' },
};

test('V271.7.3 headings: inside the description, formatted title + own scope, grouped print, Insert Text, note alignment', { timeout: 300000 }, async () => {
  const h = await startHarness({ appDir, playwright, executablePath: process.env.CHROMIUM_PATH, requireCats: true });
  try {
    h.fs.load(SEED);
    const p = await h.newUser({ uid: 'u-boss', email: 'boss@x', name: 'Boss' }); await h.open(p);
    await p.setViewportSize({ width: 1600, height: 1000 });
    await p.waitForFunction(() => window.BCScope && typeof editQuotation === 'function' && quotations.length >= 1, null, { timeout: 20000 });
    await p.evaluate(() => editQuotation('Q-H')); await p.waitForSelector('#quote-modal.open'); await sleep(700);

    /* the heading row: title editor + its own scope box; the note under line 2 starts under the description */
    const hr = '#items-tbody tr.qt-hrow';
    assert.equal(await p.locator(`${hr} div.quote-special-text[contenteditable="true"]`).count(), 1);
    assert.equal(await p.locator(`${hr} .qt-hscope[contenteditable="true"]`).count(), 1);
    const al = await p.evaluate(() => { const n = document.querySelector('#items-tbody tr.qt-nrow .qt-note').getBoundingClientRect().left, d = document.querySelector('#items-tbody tr[data-row-kind="scope"] [data-f="desc"]').getBoundingClientRect().left; return Math.round(n - d); });
    assert.ok(Math.abs(al) <= 12, 'the note box starts under the description: ' + al);

    /* format the title (underline) with the Format bar; type the heading's scope */
    await p.click(`${hr} div.quote-special-text`); await p.keyboard.press('Control+A');
    await p.click('#qt-rtbar [data-rt="underline"]'); await sleep(100);
    await p.click(`${hr} .qt-hscope`); await p.keyboard.type('Scope of Work: supply and installation at four locations.');

    /* Print Lines Grouped… from the heading menu */
    await p.click(`${hr} .qt-menu-btn`); await p.waitForSelector('.qt-pop [data-act="group"]');
    await p.click('.qt-pop [data-act="group"]'); await p.waitForSelector('.qt-gpop');
    await p.click('.qt-gpop input[name="qt-g"][value="1"]');
    await p.fill('.qt-gpop .qt-gu', 'Lot');
    await p.click('.qt-gpop [data-act="done"]'); await sleep(150);
    assert.equal(await p.locator('.qt-gpop').count(), 0);
    assert.match(await p.textContent(`${hr} .qt-gchip`), /Σ Grouped · 1 Lot/);
    assert.equal((await p.textContent(`${hr} .qt-hsum`)).trim(), '46,500.00');
    assert.equal(await p.locator('#items-tbody tr.qt-ingrp[data-line-type="item"]').count(), 3);

    /* Insert Text → into the selected heading's scope */
    await p.click(`${hr} .qt-hscope`);
    await p.click('#qs-ins-s'); await p.waitForSelector('.qs-pick .qs-pk-it');
    await p.click('.qs-pick [data-p="b:tb-scope"]');
    await p.click('.qs-pick input[name="qs-tgt"][value="hscope"]');
    await p.click('.qs-pick [data-p="insert"]'); await sleep(250);
    assert.match(await p.evaluate(() => document.querySelector('#items-tbody tr.qt-hrow .qt-hscope').value), /four locations[\s\S]*Supply, installation of automatic shutter doors/);
    assert.equal(await p.locator('#items-tbody tr.quote-special-row').count(), 2, 'no new rows');

    /* saved: formatted title, scope, grouped settings */
    { const sv = p.evaluate(() => saveQuotation()); sv.catch(() => {});
      await Promise.race([sv, p.waitForSelector('#app-confirm-overlay', { timeout: 8000 }).then(() => p.click('#confirm-ok')).catch(() => {})]); await sv; await sleep(1000); }
    const q = h.fs.peek('quotations/Q-H'), hd = q.items[0];
    assert.equal(hd.lineType, 'heading'); assert.equal(hd.text, 'Project: Installation of Automatic Shutter Doors (4 Locations)');
    assert.match(hd.textHtml || '', /<u>|rt-u|underline/);
    assert.match(hd.hScope, /four locations[\s\S]*shutter doors/);
    assert.equal(hd.grouped, true); assert.equal(hd.gQty, 1); assert.equal(hd.gUnit, 'Lot'); assert.equal(hd.gRates, undefined);
    await p.evaluate(() => document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m.id))); await sleep(300);

    const print = (tpl, mut) => p.evaluate(([tpl, mut]) => {
      const q = quotations.find(x => x.id === 'Q-H'); const keep = JSON.stringify(q.items), est = q.estimate;
      if (mut === 'ungroup') q.items[0].grouped = false;
      if (mut === 'norates') q.items[0].gRates = false;
      if (mut === 'est') { q.items[0].grouped = false; q.estimate = { style: 'grouped', showQty: true, version: 1 }; }
      _printQID = 'Q-H'; _quotationOutputOptions = { signature: false, stamp: false };
      BCScope.printBegin(q, 'inline');
      if (tpl === 'erpbox') printQuotationProductA4('Q-H'); else if (tpl === 'service') printQuotationErpVariant('Q-H', 'contracting'); else if (tpl === 'classic') printQuotationClassic('Q-H'); else printQuotation('Q-H');
      BCScope.printEnd(); q.items = JSON.parse(keep); if (est) q.estimate = est; else delete q.estimate;
      return window.__popups.at(-1).document.html;
    }, [tpl, mut || '']);
    const cells = async (html) => p.evaluate(h => { const doc = new DOMParser().parseFromString(h, 'text/html');
      return [...doc.querySelectorAll('table tbody tr')].filter(r => r.querySelector('td') && !r.querySelector('table')).map(r => [...r.children].map(td => td.textContent.replace(/\s+/g, ' ').trim()))
        .filter(c => c.length >= 5); }, html);

    /* grouped — Product A4 (erpbox): heading = 001 · title + scope · 1 · Lot · — · 46,500.00; lines: no number, rates, no amount */
    { const html = await print('erpbox'); const c = await cells(html);
      const hdr = c.find(r => /Project: Installation/.test(r.join('|')));
      assert.ok(hdr, 'heading row'); assert.equal(hdr[0], '001'); assert.match(hdr[1], /four locations/); assert.deepEqual(hdr.slice(2), ['1', 'Lot', '', '46,500.00']);
      const l1 = c.find(r => /512 × 510/.test(r[1])); assert.deepEqual([l1[0], l1[2], l1[3], l1[4], l1[5]], ['', '1', 'LS', '13,800.00', '']);
      const l2 = c.find(r => /450 × 500/.test(r[1])); assert.match(l2[1], /supply only/, 'the line note stays under its line'); assert.equal(l2[5], '');
      assert.match(html, /class="bc-qht"/); assert.doesNotMatch(html, /<tr class="heading">/, 'no heading band'); }
    /* not grouped — Service Quotation: heading row without number or figures, lines 01–03 with amounts */
    { const html = await print('service', 'ungroup'); const c = await cells(html);
      const hdr = c.find(r => /Project: Installation/.test(r.join('|'))); assert.deepEqual([hdr[0], hdr[2], hdr[3], hdr[4], hdr[5]], ['', '', '', '', '']);
      const nums = c.filter(r => /Shutter Door Size/.test(r[1])).map(r => [r[0], r[5]]);
      assert.deepEqual(nums, [['01', '13,800.00'], ['02', '19,600.00'], ['03', '13,100.00']]);
      assert.doesNotMatch(html, /background:#EEF4FB;color:#1F4E79;font-weight:800;border-top/, 'no band'); }
    /* grouped without the lines' unit prices */
    { const c = await cells(await print('service', 'norates')); const l1 = c.find(r => /512 × 510/.test(r[1])); assert.deepEqual([l1[0], l1[4], l1[5]], ['', '', '']); }
    /* an estimate quotation printed "Section Total with Item Rates" — every heading grouped, normal columns */
    { const html = await print('service', 'est'); const c = await cells(html); const hdr = c.find(r => /Project: Installation/.test(r.join('|')));
      assert.deepEqual([hdr[0], hdr[2], hdr[3], hdr[5]], ['01', '1', 'Lot', '46,500.00']); assert.doesNotMatch(html, /Lump Sum Price/); }
    /* the older templates follow too */
    { const c = await cells(await print('classic')); const hdr = c.find(r => /Project: Installation/.test(r.join('|'))); assert.equal(hdr[0], '01'); assert.equal(hdr[5], '46,500.00');
      const l1 = c.find(r => /512 × 510/.test(r[1])); assert.equal(l1[0], ''); assert.equal(l1[5], ''); }
    /* totals unchanged */
    assert.equal(await p.evaluate(() => calcQuote(quotations.find(x => x.id === 'Q-H')).sub), 46500);

    /* reopen: the heading keeps its title format, scope and grouped chip */
    await p.evaluate(() => editQuotation('Q-H')); await p.waitForSelector('#quote-modal.open'); await sleep(700);
    assert.match(await p.textContent(`${hr} .qt-gchip`), /Σ Grouped · 1 Lot/);
    assert.match(await p.evaluate(() => document.querySelector('#items-tbody tr.qt-hrow .qt-hscope').value), /four locations/);
    assert.match(await p.innerHTML(`${hr} div.quote-special-text`), /<u>|rt-u|underline/);
    assert.deepEqual(p.__errors, []);
  } finally { await h.close(); }
});
