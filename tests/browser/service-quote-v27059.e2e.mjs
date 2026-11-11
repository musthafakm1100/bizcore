/** BROWSER (simulator): V270.4.14 — Service quotations and the quotation's internal cost (mockups SQ_1, SQ_2, RT_3,
 *  DQ_1): formatted descriptions (Format bar, clean HTML + plain text with the layout), service lines linked to SRV
 *  items, scope lines on purpose, the Cost 🔒 column (Show cost per user, hint, margin, internal box), Mark as Sent
 *  checks (cost missing → reminder; below the minimum margin → approval, self for an administrator), the print, the
 *  Sales Order (scope line without a link, the cost carried as the estimate), a long formatted line over two pages. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { writeFileSync, unlinkSync } from 'node:fs';
import { startHarness } from './harness.mjs';
const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const playwright = createRequire(process.env.PLAYWRIGHT_FROM || import.meta.url)('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const scope = (desc, extra = {}) => ({ lineType: 'item', rowKind: 'scope', type: 'contracting', desc, qty: 1, uom: 'Job', up: 1000, ...extra });
const SEED = {
  'system/deliveryNoteStorage': { mode: 'independent', minClientVersion: 260 },
  'system/invoiceStorage': { mode: 'independent' },
  'system/accessControl': { adminUids: ['u-boss'] },
  'customers/c1': { id: 'c1', code: 'CUS-00001', company: 'Al Noor Facilities', vat: '' },
  'products/s-ac': { id: 's-ac', type: 'service', code: 'SRV-000003', name: 'AC maintenance', uom: 'Unit', price: 150 },
  'products/s-tech': { id: 's-tech', type: 'service', code: 'SRV-000001', name: 'Manpower – technician / day', uom: 'Day', price: 350 },
  'products/p-paper': { id: 'p-paper', type: 'goods', code: 'ITM-000045', name: 'A4 copy paper 80gsm box', uom: 'Box', price: 92 },
  'quotations/Q-S': { id: 'Q-S', qno: 'Q-2610-0041', date: '2026-10-28', company: 'Al Noor Facilities', custId: 'c1', status: 'Draft', vatRate: 15, quoteType: 'contracting',
    items: [scope('Preventive maintenance of 12 split AC units at Olaya office', { qty: 12, up: 150 }), scope('Technician on site for 5 days', { qty: 5, up: 350, uom: 'Day' }), scope('Supply and fix gypsum false ceiling in reception', { up: 6400 })] },
  'quotations/Q-P': { id: 'Q-P', qno: 'Q-2610-0042', date: '2026-10-29', company: 'Al Noor Facilities', custId: 'c1', status: 'Draft', vatRate: 15, quoteType: 'product',
    items: [{ lineType: 'item', rowKind: 'product', type: 'product', desc: 'A4 copy paper 80gsm', prodId: 'p-paper', qty: 20, uom: 'Box', up: 92, estCost: 88 }] },
};

test('V270.4.14 service quotation: formatted lines, SRV links, scope lines, Cost column, Sent checks, print, Sales Order', { timeout: 300000 }, async () => {
  const h = await startHarness({ appDir, playwright, executablePath: process.env.CHROMIUM_PATH, requireLinks: true, costChecks: true });
  let printHtml = '';
  try {
    h.fs.load(SEED);
    const p = await h.newUser({ uid: 'u-boss', email: 'boss@x', name: 'Boss' });
    await h.open(p);
    const closeAll = () => p.evaluate(() => document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m.id)));

    // 1. cleaning and plain text: Word-like paste → only the allowed formatting; lists → "1." / "a." / "•" with indent
    const r1 = await p.evaluate(() => {
      const word = '<p class="MsoNormal" style="font-family:Calibri"><b>Scope</b> <span style="color:#C00000;font-size:16pt">Excluded</span> <span style="background:yellow">gas</span><img src="x.png"><o:p></o:p></p><table><tr><td>A</td><td>B</td></tr></table><script>alert(1)</script>';
      const html = '<b>AMC – HVAC</b><ol><li>Preventive maintenance<ol><li>Filters</li><li>Gas check</li></ol></li><li>Breakdown <i>within 24 h</i></li></ol><ul><li>Monthly report</li></ul><span class="rt-c-r">Excluded:</span> spare parts';
      return { clean: BCRich.clean(word), text: BCRich.toText(html), has: [BCRich.hasFormat('<div>a</div><div>b</div>'), BCRich.hasFormat(html)], upper: BCRich.toText('<ol type="A"><li>x</li><li>y</li></ol><ol type="i" start="3"><li>z</li></ol>') };
    });
    assert.equal(r1.clean, '<div><b>Scope</b> <span class="rt-c-r rt-z-h">Excluded</span> <span class="rt-hl">gas</span></div><div>A B </div>', 'Word paste cleaned (no fonts, tables, pictures, scripts)');
    assert.equal(r1.text, 'AMC – HVAC\n1. Preventive maintenance\n   a. Filters\n   b. Gas check\n2. Breakdown within 24 h\n• Monthly report\nExcluded: spare parts');
    assert.deepEqual(r1.has, [false, true]);
    assert.equal(r1.upper, 'A. x\nB. y\niii. z');

    // 2. edit the Service quotation: scope lines are formatted editors with SRV link markers; the Format bar works
    await p.evaluate(() => editQuotation('Q-S')); await p.waitForSelector('#quote-modal.open'); await sleep(500);
    assert.equal(await p.locator('#items-tbody .qt-scope.bc-rt[contenteditable="true"]').count(), 3);
    assert.equal(await p.locator('#items-tbody .qt-lk.not-linked').count(), 3, 'service lines show "Not linked"');
    assert.equal(await p.getAttribute('#qt-rtbar', 'class'), 'qt-rtbar bc-rtbar rtb-disabled', 'Format bar greyed until a description is focused');
    await p.click('#items-tbody tr:nth-child(1) .qt-scope'); await p.keyboard.press('Control+End');
    assert.doesNotMatch(await p.getAttribute('#qt-rtbar', 'class'), /rtb-disabled/);
    await p.keyboard.press('Enter'); await p.click('#qt-rtbar [data-rt="bold"]'); await p.keyboard.type('Excluded: gas');
    await p.keyboard.press('Enter'); await p.click('#qt-rtbar [data-rt="ol"]'); await p.click('.bc-rtpop [data-v="a"]');
    if (await p.evaluate(() => document.queryCommandState('bold'))) await p.click('#qt-rtbar [data-rt="bold"]');
    await p.keyboard.type('Filters'); await p.keyboard.press('Enter'); await p.keyboard.type('Drain line');
    const ed1 = await p.evaluate(() => { const e = document.querySelector('#items-tbody tr:nth-child(1) .qt-scope'); return { html: BCRich.htmlOf(e), value: e.value }; });
    assert.match(ed1.html, /<b>Excluded: gas<\/b>/); assert.match(ed1.html, /<ol type="a"><li>Filters<\/li><li>Drain line<\/li><\/ol>/);
    // V271.6: the line's title stays one line; the scope of work is the box under it
    assert.equal(ed1.value, 'Excluded: gas\na. Filters\nb. Drain line');
    assert.equal(await p.inputValue('#items-tbody tr:nth-child(1) .qt-title'), 'Preventive maintenance of 12 split AC units at Olaya office');
    // colour from the menu
    await p.keyboard.press('Shift+Home'); await p.click('#qt-rtbar [data-rt="color"]'); await p.click('.bc-rtpop [data-v="r"]');
    assert.match(await p.evaluate(() => BCRich.htmlOf(document.querySelector('#items-tbody tr:nth-child(1) .qt-scope'))), /<span class="rt-c-r">Drain line<\/span>/);

    // 3. link line 1 to SRV AC maintenance (unit follows the service), make line 3 a scope line from the ⋮ menu
    await p.click('#items-tbody tr:nth-child(1) .qt-lk-btn'); await p.waitForSelector('#bc-link-overlay:not([hidden])');
    assert.match(await p.textContent('#bc-link-overlay .bcl-acts'), /New Service[\s\S]*Scope line \(free text\)/);
    await p.click('#bc-link-overlay [data-a="search"]'); await p.fill('#bc-link-overlay .bcl-search input', 'AC maint'); await p.click('#bc-link-overlay .bcl-hit[data-id="s-ac"]');
    await p.click('#bc-link-overlay [data-f="link"]'); await sleep(200);
    assert.match(await p.textContent('#items-tbody tr:nth-child(1) .qt-lk'), /Linked: SRV-000003/);
    assert.equal(await p.inputValue('#items-tbody tr:nth-child(1) select'), 'Unit');
    await p.click('#items-tbody tr:nth-child(3) .qt-menu-btn'); await p.click('.qt-pop [data-act="scope"]'); await sleep(150);
    assert.match(await p.textContent('#items-tbody tr:nth-child(3) .qt-lk'), /Scope line · free text, not linked/);

    // 4. Cost 🔒: shown for this user; typed cost → margin; Show cost off hides the column and is remembered
    assert.equal(await p.isHidden('#qt-costsw'), false);
    assert.match(await p.getAttribute('#qt-items-table', 'class'), /qt-cost-on/);
    await p.fill('#items-tbody tr:nth-child(1) [data-quote-cost]', '100'); await p.press('#items-tbody tr:nth-child(1) [data-quote-cost]', 'Tab'); await sleep(150);
    assert.equal(await p.textContent('#items-tbody tr:nth-child(1) .qt-kc-m'), 'Markup 50.0%');
    assert.equal(await p.textContent('#items-tbody tr:nth-child(2) .qt-kc-m'), 'No cost entered');
    assert.equal(await p.isHidden('#quote-commercial-summary'), false, 'internal box for a quotation without Pricing');
    assert.match(await p.textContent('#quote-commercial-summary .qt-cov'), /1 of 3 priced lines costed — line 2, line 3 left out/);
    assert.equal(await p.textContent('#qcs-cost'), await p.evaluate(() => documentMoney('quotation', 'summary', 1200)));
    await p.click('#qt-costsw'); assert.doesNotMatch(await p.getAttribute('#qt-items-table', 'class'), /qt-cost-on/);
    assert.equal(await p.evaluate(() => localStorage.getItem('bc_qt_showcost:u-boss')), '0');
    await p.click('#qt-costsw'); assert.match(await p.getAttribute('#qt-items-table', 'class'), /qt-cost-on/);

    // 5. a formatted note line
    await p.evaluate(() => qtAddLine('note')); await sleep(150);
    await p.keyboard.type('Work during office hours'); await p.keyboard.press('Shift+Home'); await p.click('#qt-rtbar [data-rt="hl"]'); await p.click('.bc-rtpop [data-v="y"]');   // V271.7.4: highlight is a menu

    // 6. Mark as Sent: line 2 has no service link → reminder (Send anyway); line 2 has no cost → reminder (Enter cost first)
    let saving = p.evaluate(() => saveQuotation('sent')); saving.catch(() => {});
    await p.waitForSelector('#bc-link-overlay:not([hidden])');
    assert.match(await p.textContent('#bc-link-overlay .bcl-intro'), /1 of 2 priced lines is not linked/, 'the scope line is not asked');
    if (await p.locator('#bc-link-overlay input[value="s-tech"]').count()) await p.click('#bc-link-overlay input[value="s-tech"]');
    else { await p.click('#bc-link-overlay [data-a="search"]'); await p.fill('#bc-link-overlay .bcl-search input', 'technician'); await p.click('#bc-link-overlay .bcl-hit[data-id="s-tech"]'); }
    await p.click('#bc-link-overlay [data-f="link"]');
    await p.waitForSelector('#app-confirm-overlay'); assert.match(await p.textContent('#app-confirm-overlay'), /Cost missing on 2 lines[\s\S]*Line 2[\s\S]*Line 3/);
    await p.click('#confirm-cancel'); await saving; await sleep(200);
    assert.equal(await p.evaluate(() => document.activeElement?.closest('tr')?.querySelector('.qt-n')?.textContent), '2', '"Enter cost" goes to line 2');
    await p.fill('#items-tbody tr:nth-child(2) [data-quote-cost]', '340'); await p.press('#items-tbody tr:nth-child(2) [data-quote-cost]', 'Tab');
    await p.fill('#items-tbody tr:nth-child(3) [data-quote-cost]', '6200'); await p.press('#items-tbody tr:nth-child(3) [data-quote-cost]', 'Tab'); await sleep(150);
    // margin now below the 10 % minimum → an administrator approves himself (recorded on the quotation)
    saving = p.evaluate(() => saveQuotation('sent')); saving.catch(() => {});
    await p.waitForSelector('#app-confirm-overlay'); await p.click('#confirm-ok'); await saving; await sleep(1500);
    const q = h.fs.peek('quotations/Q-S');
    assert.equal(q.status, 'Sent');
    assert.deepEqual(q.items.map(i => [i.prodId || '', i.uom, i.estCost || 0, !!i.freeScope]), [['s-ac', 'Unit', 100, false], ['s-tech', 'Day', 340, false], ['', 'Job', 6200, true], ['', undefined, 0, false]]);
    // V271.6: the scope text is kept in the quotation's body record; the line keeps its title and a short preview
    const qb = h.fs.peek('quotations/Q-S/bodies/main');
    assert.match(qb.scopes[q.items[0].scopeKey], /<b>Excluded: gas<\/b>[\s\S]*<ol type="a">/);
    assert.equal(q.items[0].desc, 'Preventive maintenance of 12 split AC units at Olaya office');
    assert.equal(q.items[0].descHtml, undefined); assert.equal(q.scopeBody, true);
    assert.equal(q.items[1].descHtml, undefined, 'a line without formatting stays plain');
    assert.equal(q.items[3].lineType, 'note'); assert.match(q.items[3].textHtml, /rt-hl/);
    assert.equal(q.costApproval.id, 'admin-self'); assert.ok(q.costApproval.pct < 10);
    await closeAll();

    // 7. print (service template): formatting kept, SRV codes and costs never printed
    await p.evaluate(() => { _printQID = 'Q-S'; _quotationOutputOptions = { signature: false, stamp: false }; printQuotationErpVariant('Q-S', 'contracting'); });
    printHtml = await p.evaluate(() => window.__popups.at(-1).document.html);
    assert.match(printHtml, /class="bc-rtx[^"]*"[\s\S]*<b>Excluded: gas<\/b>/);
    assert.match(printHtml, /rt-hl/); assert.doesNotMatch(printHtml, /SRV-0000|6,200\.00 *<\/td>\s*<td[^>]*>6,400|Cost 🔒/);

    // 8. product quotation: the paper line's cost shows "Last estimate"; Sales Order from the service quotation:
    //    the scope line needs no link, the costs go with the lines (Profit estimate)
    await p.evaluate(() => editQuotation('Q-P')); await p.waitForSelector('#quote-modal.open'); await sleep(400);
    assert.equal(await p.inputValue('#items-tbody tr:nth-child(1) [data-quote-cost]'), '88.00');
    assert.equal(await p.textContent('#items-tbody tr:nth-child(1) .qt-kc-m'), 'Markup 4.5% · below 10%');
    await closeAll();
    await p.evaluate(() => commitStatus('Q-S', 'Won')); await sleep(600); await closeAll();
    await p.evaluate(() => openCreateSO('Q-S')); await p.waitForSelector('#so-create-modal.open');
    assert.equal(await p.textContent('#soc-lk-2'), '', 'scope line: no link asked');
    await p.fill('#so-po-no', 'PO-91'); await p.evaluate(() => saveSalesOrder()); await sleep(1500);
    const so = await p.evaluate(() => salesOrders[0]);
    assert.deepEqual(so.items.map(i => [i.estCost || 0, !!i.freeScope]), [[100, false], [340, false], [6200, true]]);
    const est = await p.evaluate(id => { const s = salesOrders.find(x => x.id === id); return s.items.map(it => sovEstimateLine(sovEstimate(s), s, it)); }, so.id);
    assert.deepEqual(est.map(e => e && e.unit), [100, 340, 6200], 'Profit: the quotation costs are the estimate');
    // product view: the sent quotation's cost is the item's estimate
    const usage = await p.evaluate(() => bcProductUsage(products.find(x => x.id === 's-ac')).docs.filter(d => d.kind === 'pricing').map(d => [d.label, d.price]));
    assert.deepEqual(usage, [['Quotation est.', 100]]);
    assert.deepEqual(p.__errors, []);
  } finally { await h.close(); }

  // 9. a long formatted line continues on the next page (print window in a real page)
  const b = await playwright.chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  try {
    const long = '<b>Scope</b><ol>' + Array.from({ length: 90 }, (_, i) => `<li>Activity ${i + 1}: inspect, clean and test the unit, record the readings</li>`).join('') + '</ol>';
    const h2 = await startHarness({ appDir, playwright, executablePath: process.env.CHROMIUM_PATH });
    let html = '';
    try {
      h2.fs.load({ ...SEED, 'quotations/Q-L': { id: 'Q-L', qno: 'Q-2610-0050', date: '2026-10-30', company: 'Al Noor Facilities', custId: 'c1', status: 'Sent', vatRate: 15, quoteType: 'contracting',
        items: [scope('Short line'), scope('Long', { descHtml: long }), scope('After')] } });
      const p2 = await h2.newUser({ uid: 'u-boss', email: 'boss@x', name: 'Boss' }); await h2.open(p2);
      await p2.evaluate(() => { _printQID = 'Q-L'; _quotationOutputOptions = { signature: false, stamp: false }; printQuotationErpVariant('Q-L', 'contracting'); });
      html = await p2.evaluate(() => window.__popups.at(-1).document.html);
    } finally { await h2.close(); }
    const file = join(appDir, '__test_print_rt.html'); writeFileSync(file, html.replace(/window\.print\(\)/g, 'void 0'));
    try {
      const pg = await (await b.newContext()).newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
      await pg.goto('file://' + file); await sleep(800);
      const r = await pg.evaluate(() => { const pages = [...document.querySelectorAll('.bcp-page')]; return { pages: pages.length, cont: document.querySelectorAll('tr.bcp-cont').length, starts: [...document.querySelectorAll('tr.bcp-cont ol')].map(o => o.getAttribute('start')), items: document.querySelectorAll('.bc-rtx li').length, clipped: pages.some(pg => { const b = pg.getBoundingClientRect(), f = pg.querySelector('.bcp-foot').getBoundingClientRect(); return [...pg.querySelectorAll('tbody tr')].some(tr => tr.getBoundingClientRect().bottom > f.top + 1); }) }; });
      assert.deepEqual(errs, []);
      assert.ok(r.pages >= 2 && r.cont >= 1, 'the line continues on the next page ' + JSON.stringify(r));
      assert.equal(r.items, 90, 'no list item lost'); assert.ok(Number(r.starts[0]) > 1, 'numbering carries on ' + JSON.stringify(r.starts));
      assert.equal(r.clipped, false, 'nothing runs under the footer');
    } finally { unlinkSync(file); }
  } finally { await b.close(); }
});

test('V270.4.14.1 lines follow the template: Service RFQ → Service quotation; product lines on a Service quotation rebuilt; template locked', { timeout: 200000 }, async () => {
  const { seedPricing } = await import('./pricing-seed.mjs');
  const h = await startHarness({ appDir, playwright, executablePath: process.env.CHROMIUM_PATH });
  try {
    seedPricing(h.fs, {});
    const r = h.fs.peek('rfqs/r22');
    h.fs.load({ 'rfqs/r22': { ...r, requestType: 'service' },
      'quotations/Q-MIX': { id: 'Q-MIX', qno: 'Q-2610-0099', date: '2026-10-31', company: 'Al Hammadi Hospital', status: 'Draft', vatRate: 15, quoteType: 'contracting',
        items: [{ lineType: 'item', rowKind: 'product', type: 'product', desc: 'Office Fitout', specs: 'Ground floor', code: 'X1', brand: 'B', qty: 1, uom: 'Lumpsum', up: 75000, pricingBuy: 35515.63 }] } });
    const p = await h.newUser({ uid: 'u-boss', email: 'boss@x', name: 'Boss' }); await h.open(p);
    await p.waitForFunction(() => typeof qtOnOpen === 'function' && rfqs.length >= 2, null, { timeout: 20000 });
    const shape = () => p.evaluate(() => ({ type: currentQuoteType, kinds: [...new Set([...document.querySelectorAll('#items-tbody tr[data-line-type=item]')].map(t => t.dataset.rowKind + ':' + t.cells.length))], head: document.querySelectorAll('#items-thead th').length }));
    // 1. Pricing of a Service RFQ → a Service quotation whose lines are service lines (formatted editors), cost from Pricing
    await p.evaluate(() => openPricingSheet('r22'));
    await p.waitForSelector('#pricing-modal.open #pricing-tbody tr', { state: 'attached' }); await sleep(300);
    await p.evaluate(() => { convertToQuotation(); }); await p.waitForSelector('#confirm-ok'); await p.click('#confirm-ok');
    await p.waitForSelector('#quote-modal.open'); await sleep(500);
    assert.deepEqual(await shape(), { type: 'contracting', kinds: ['scope:9'], head: 9 });
    await p.click('#items-tbody tr:nth-child(1) .qt-scope'); await sleep(100);
    assert.doesNotMatch(await p.getAttribute('#qt-rtbar', 'class'), /rtb-disabled/, 'Format bar active in a service line');
    assert.equal(await p.evaluate(() => document.querySelector('#items-tbody tr [data-quote-cost]').readOnly), true, 'cost from Pricing, read-only');
    // a locked template is not switched by a click
    assert.equal(await p.evaluate(() => { setQuoteType('product'); return currentQuoteType; }), 'contracting');
    await p.evaluate(() => document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m.id))); await sleep(300);
    // 2. a saved Service quotation with a product-shaped line opens with a service line (text + specs kept, columns aligned)
    await p.evaluate(() => editQuotation('Q-MIX')); await p.waitForSelector('#quote-modal.open'); await sleep(500);
    assert.deepEqual(await shape(), { type: 'contracting', kinds: ['scope:9'], head: 9 });
    // V271.6: the text becomes the line's title, the specifications its scope of work
    assert.deepEqual(await p.evaluate(() => [document.querySelector('#items-tbody [data-f="desc"]').value, document.querySelector('#items-tbody [data-f="scope"]').value]), ['Office Fitout', 'Ground floor']);
    assert.equal(await p.textContent('#qt-tot-label'), 'Total · 1 Line');
    assert.equal(await p.inputValue('#items-tbody tr:nth-child(1) select'), 'Lumpsum');
    assert.deepEqual(p.__errors, []);
  } finally { await h.close(); }
});

test('V270.4.14.2 Format bar: colour / size / highlight back and forth, typing in a colour, bold, lists, Tab indent, clear', { timeout: 200000 }, async () => {
  const h = await startHarness({ appDir, playwright, executablePath: process.env.CHROMIUM_PATH });
  try {
    h.fs.load(SEED);
    const p = await h.newUser({ uid: 'u-boss', email: 'boss@x', name: 'Boss' }); await h.open(p);
    await p.evaluate(() => editQuotation('Q-S')); await p.waitForSelector('#quote-modal.open'); await sleep(500);
    const ED = '#items-tbody tr:nth-child(2) .qt-scope';
    const html = () => p.evaluate(s => document.querySelector(s).innerHTML.replace(/​/g, ''), ED);
    const bar = a => p.click(`#qt-rtbar [data-rt="${a}"]`);
    const pick = async (a, v) => { await bar(a); await p.click(`.bc-rtpop [data-v="${v}"]`); };
    const selWord = w => p.evaluate(([s, w]) => { const ed = document.querySelector(s); const ts = []; const tw = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT); let t; while ((t = tw.nextNode())) ts.push(t);
      const all = ts.map(x => x.data).join(''), i = all.indexOf(w); if (i < 0) throw new Error('not found: ' + w);
      const at = x => { let n = 0; for (const t of ts) { if (x <= n + t.length) return [t, x - n]; n += t.length; } };
      const [a, ao] = at(i + (i === 0 ? 0 : 0)), [b, bo] = at(i + w.length); const r = document.createRange(); r.setStart(a, ao); r.setEnd(b, bo);
      if (ao === a.length && a !== b) { const k = ts.indexOf(a) + 1; r.setStart(ts[k], 0); }
      const sl = getSelection(); sl.removeAllRanges(); sl.addRange(r); return true; }, [ED, w]);
    await p.evaluate(s => { const ed = document.querySelector(s); ed.innerHTML = 'Technician on site for five days'; }, ED);
    await p.click(ED); await p.keyboard.press('Control+End');

    // colour: red → green → red → black, never nested
    await selWord('five'); await pick('color', 'r'); assert.match(await html(), /<span class="rt-c-r">five<\/span>/);
    await selWord('five'); await pick('color', 'g'); assert.match(await html(), /<span class="rt-c-g">five<\/span>/); assert.doesNotMatch(await html(), /rt-c-r/);
    await selWord('five'); await pick('color', 'r'); assert.match(await html(), /<span class="rt-c-r">five<\/span>/); assert.doesNotMatch(await html(), /rt-c-g/);
    await selWord('five'); await pick('color', 'k'); assert.equal(await html(), 'Technician on site for five days', 'back to black = no colour left');
    // part of a coloured word, then the whole line
    await selWord('Technician on site'); await pick('color', 'n'); await selWord('site'); await pick('color', 'r');
    assert.match(await html(), /<span class="rt-c-n">Technician on <\/span><span class="rt-c-r">site<\/span>/);
    // size and highlight back and forth
    await selWord('days'); await pick('size', 'lg'); assert.match(await html(), /<span class="rt-z-lg">days<\/span>/);
    await selWord('days'); await pick('size', 'h'); assert.match(await html(), /<span class="rt-z-h">days<\/span>/);
    await selWord('days'); await pick('size', 'n'); assert.doesNotMatch(await html(), /rt-z-/);
    await selWord('for'); await pick('hl', 'y'); assert.match(await html(), /<span class="rt-hl">for<\/span>/);
    await selWord('for'); await pick('hl', 'b'); assert.match(await html(), /<span class="rt-hl-b">for<\/span>/, 'V271.7.4: light blue');
    await selWord('for'); await pick('hl', 'none'); assert.doesNotMatch(await html(), /rt-hl/);
    // bold on / off
    await selWord('days'); await bar('bold'); assert.match(await html(), /<b>days<\/b>/);
    await selWord('days'); await bar('bold'); assert.doesNotMatch(await html(), /<b>/);
    // typing in a colour (nothing selected), then back to black
    await p.keyboard.press('Control+End'); await pick('color', 'r'); await p.keyboard.type(' urgent');
    await pick('color', 'k'); await p.keyboard.type(' ok');
    assert.match(await p.evaluate(s => BCRich.htmlOf(document.querySelector(s)), ED), /<span class="rt-c-r"> urgent<\/span> ok$/, 'stored without nesting');
    assert.equal(await p.evaluate(s => getComputedStyle([...document.querySelectorAll(s + ' span')].pop()).color, ED), 'rgb(15, 23, 42)', 'typed in black');
    // clear formatting
    await selWord('Technician on site'); await bar('clear'); assert.doesNotMatch(await html(), /rt-c-n|rt-c-r">site/);

    // lists: bullets, Tab nests, Shift+Tab back, Shift+Tab at the top leaves the list
    await p.keyboard.press('Control+End'); await p.keyboard.press('Enter'); await bar('ul');
    await p.keyboard.type('Filters'); await p.keyboard.press('Enter'); await p.keyboard.type('Gas check');
    await p.keyboard.press('Tab');
    assert.match(await html(), /<ul><li>Filters<ul><li>Gas check<\/li><\/ul><\/li><\/ul>/, 'Tab nests the list item');
    assert.equal(await p.evaluate(s => document.activeElement === document.querySelector(s), ED), true, 'focus stays in the line');
    await p.keyboard.press('Shift+Tab'); assert.match(await html(), /<ul><li>Filters<\/li><li>Gas check<\/li><\/ul>/);
    await p.keyboard.press('Tab'); await bar('outdent'); assert.match(await html(), /<ul><li>Filters<\/li><li>Gas check<\/li><\/ul>/, '⇤ button');
    await bar('indent'); assert.match(await html(), /<li>Filters<ul><li>Gas check/, '⇥ button');
    await p.keyboard.press('Shift+Tab'); await p.keyboard.press('Shift+Tab');
    assert.match(await html(), /<ul><li>Filters<\/li><\/ul><div>Gas check<\/div>/, 'top level Shift+Tab leaves the list');
    // numbering type A
    await selWord('Filters'); await pick('ol', 'A'); assert.match(await html(), /<ol type="A"><li>Filters<\/li><\/ol>/);
    // Tab at the start of an ordinary line indents it; Shift+Tab takes it back; Tab in the middle moves on
    await selWord('Gas check'); await p.keyboard.press('Home'); await p.keyboard.press('Tab');
    assert.match(await html(), /<div class="rt-ind-1">Gas check<\/div>/);
    await p.keyboard.press('Tab'); assert.match(await html(), /<div class="rt-ind-2">Gas check<\/div>/);
    await p.keyboard.press('Shift+Tab'); await p.keyboard.press('Shift+Tab'); assert.match(await html(), /<div>Gas check<\/div>/);
    await p.keyboard.press('Tab'); // indent again for the plain text
    const v = await p.evaluate(s => ({ text: document.querySelector(s).value, saved: BCRich.htmlOf(document.querySelector(s)) }), ED);
    assert.match(v.text, /A\. Filters\n   Gas check$/, 'plain text keeps the numbering and the indent: ' + JSON.stringify(v.text));
    assert.match(v.saved, /<div class="rt-ind-1">Gas check<\/div>/, 'indent kept when saved');
    await p.click(ED); await selWord('Technician'); await p.keyboard.press('End'); await p.keyboard.press('Tab'); await sleep(50);
    assert.equal(await p.evaluate(s => document.activeElement === document.querySelector(s), ED), false, 'Tab in the middle of a line moves to the next field');
    assert.deepEqual(p.__errors, []);
  } finally { await h.close(); }
});
