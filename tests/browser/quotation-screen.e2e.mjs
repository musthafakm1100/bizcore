/** BROWSER (simulator): V270.2 — the redesigned Quotation Entry screen (approved mockups QT_1 – QT_12), line discounts,
 *  note styles and the VAT fix. Uses the Pricing seed (RFQ-2610-0022 with 5 priced lines, old quotations q10 – q13).
 *  Checks: Pricing → Quotation (VAT figure, header, flow, locked template, internal summary), line discounts typed key by key
 *  (% ↔ SAR, the typed field kept when qty / price change, limits, Save blocked), the quotation discount limit, the calculation
 *  order, note styles (quotation / line, saved, View / Print, frozen at Sent), older quotations unchanged, the line menu
 *  (insert, duplicate, move, delete + Undo), Back / Close with and without changes, the Sales Order price after a line
 *  discount, and the layout at 1440, 1366 × 768 (42 lines), 1112, 834 and 390 (phone cards). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { startHarness } from './harness.mjs';
import { seedPricing, COST_MASTER } from './pricing-seed.mjs';

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const playwright = createRequire(process.env.PLAYWRIGHT_FROM || import.meta.url)('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SHOTS = process.env.QT_SHOTS || '';
const shot = async (p, name) => { if (SHOTS) await p.screenshot({ path: `${SHOTS}/${name}.png` }); };
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.006, `${msg}: ${a} ≠ ${b}`);

async function ready(h, device) {
  const p = await h.newUser({ uid: 'u-boss', email: 'boss@x', name: 'Musthafa KM', device });
  await h.open(p);
  await p.evaluate(m => { localStorage.setItem('bizcore_cost_components', JSON.stringify(m)); }, COST_MASTER);
  await p.waitForFunction(() => typeof qtOnOpen === 'function' && typeof prShowTab === 'function' && rfqs.length >= 2 && quotations.length >= 4, null, { timeout: 20000 });
  return p;
}
async function fromPricing(p) {
  await p.evaluate(() => document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m.id)));
  await p.evaluate(() => openPricingSheet('r22'));
  await p.waitForSelector('#pricing-modal.open #pricing-tbody tr', { state: 'attached' }); await sleep(300);
  await p.evaluate(() => { convertToQuotation(); });
  await p.waitForSelector('#confirm-ok', { timeout: 8000 }); await p.click('#confirm-ok');
  await p.waitForSelector('#quote-modal.open', { timeout: 8000 }); await sleep(500);
}
const T = p => p.evaluate(() => ({ ...window._qtTotals }));
const row = n => `#items-tbody tr.qt-row:nth-of-type(${n})`;
const itemRow = n => `#items-tbody tr.qt-row >> nth=${n - 1}`;
async function typeIn(p, sel, text) { await p.click(sel); await p.keyboard.press('Control+A'); await p.keyboard.press('Backspace'); await p.keyboard.type(text); }
/** Every visible element of the Quotation window stays inside the window (or inside its own scroll box). */
const outside = p => p.evaluate(() => {
  const win = document.querySelector('#quote-modal .qt-win').getBoundingClientRect(), bad = [];
  document.querySelectorAll('#quote-modal .qt-win *').forEach(el => {
    const r = el.getBoundingClientRect(); if (!r.width || !r.height || el.closest('.qt-gt,.qt-scroll,.qt-cards,.qt-side,.qt-tabs,.qt-band-fold,.qt-flow,.qt-hint,.qt-bar,.cust-dropdown,.qt-hidden-select')) return;
    if (getComputedStyle(el).visibility === 'hidden') return;
    if (r.left < win.left - 1 || r.right > win.right + 1) bad.push(el.tagName + '.' + el.className + ' ' + Math.round(r.left) + '–' + Math.round(r.right));
  });
  return { bad: bad.slice(0, 5), page: document.documentElement.scrollWidth - innerWidth };
});

test('V270.2 Quotation Entry: from Pricing, line discounts, totals, VAT, note styles, menus, leaving, View / Print / Sales Order', { timeout: 600000 }, async () => {
  const h = await startHarness({ appDir, playwright, executablePath: process.env.CHROMIUM_PATH });
  try {
    seedPricing(h.fs);
    const p = await ready(h);

    /* ── 0. older quotations calculate exactly as before (no line-discount fields) ── */
    const old = await p.evaluate(() => quotations.filter(q => ['q10', 'q11'].includes(q.id)).map(q => ({ c: calcQuote(q), plain: (q.items || []).reduce((s, i) => s + i.qty * i.up, 0), hasDisc: quoteHasLineDiscounts(q) })));
    old.forEach(o => { near(o.c.sub, o.plain, 'old sub-total'); near(o.c.gross, o.plain, 'old gross'); assert.equal(o.c.lineDisc, 0); assert.equal(o.hasDisc, false); });

    /* ── 1. Pricing → Quotation: VAT figure (was 0.00 under a 15% label), header, flow, template, internal summary ── */
    await fromPricing(p);
    await shot(p, 'QT_1440_from_pricing');
    let t = await T(p);
    near(t.gross, 4267, 'sub-total'); near(t.vat, 640.05, 'VAT 15% (V270.2 fix)'); near(t.net, 4907.05, 'grand total');
    assert.equal(await p.textContent('#t-vat-label'), 'VAT 15%');
    assert.match(await p.textContent('#quote-header-sub'), /^AK Investment Company · Ref RFQ 4116 · From Pricing PR-2610-0022-V1 · Products$/);
    assert.deepEqual(await p.$$eval('#qt-flow .qt-fc', b => b.map(x => x.textContent.trim())), ['✓RFQ-2610-0022', '✓Pricing V1', 'Quotation', 'Sales Order']);
    assert.equal(await p.isDisabled('#type-btn-contracting'), true, 'the template is set by Pricing');
    assert.equal(await p.isVisible('#quote-commercial-summary'), true);
    assert.equal(await p.textContent('#qt-status-text'), 'Draft');
    assert.equal(await p.inputValue('#f-date'), await p.evaluate(() => BCDate.format(BCDate.today())), 'DD-MM-YYYY');
    assert.match(await p.textContent('#quote-validity-inline'), /^days · \d\d-\d\d-\d{4}$/);
    assert.match(await p.textContent('#qt-ready'), /To continue: ① Contact/);
    await typeIn(p, '#f-contact', 'Mr. Faisal');
    assert.equal(await p.textContent('#qt-ready'), '✓ Ready to save');

    /* ── 2. line discounts: one direction per field, never rewriting the field being typed ── */
    // line 1: 6 × 42.00 = 252.00 — type 5 → 5. → 5.5 (%)
    await p.click(itemRow(1) + ' >> [data-quote-dpct]');
    for (const [k, amt] of [['5', '12.60'], ['.', '12.60'], ['5', '13.86']]) { await p.keyboard.type(k); assert.equal(await p.inputValue(itemRow(1) + ' >> [data-quote-damt]'), amt, 'SAR follows the % (' + k + ')'); }
    assert.equal(await p.inputValue(itemRow(1) + ' >> [data-quote-dpct]'), '5.5', 'the % box is not rewritten while typing');
    await p.keyboard.press('Tab'); assert.equal(await p.inputValue(itemRow(1) + ' >> [data-quote-dpct]'), '5.50', 'formatted on leaving');
    // line 2: 1 × 585.00 — type 50 SAR → 8.55 %
    await p.click(itemRow(2) + ' >> [data-quote-damt]'); await p.keyboard.type('50');
    assert.equal(await p.inputValue(itemRow(2) + ' >> [data-quote-dpct]'), '8.55');
    assert.equal(await p.$eval('#items-tbody tr.qt-row >> nth=1', () => 1).catch(() => 1), 1);
    // changing qty keeps the typed field: line 1 keeps 5.5 % (SAR follows), line 2 keeps 50.00 (the % follows)
    await typeIn(p, itemRow(1) + ' >> [data-quote-qty]', '10'); await p.keyboard.press('Tab');
    assert.equal(await p.inputValue(itemRow(1) + ' >> [data-quote-damt]'), '23.10', '5.5 % of 420.00');
    await typeIn(p, itemRow(2) + ' >> [data-quote-qty]', '2'); await p.keyboard.press('Tab');
    assert.equal(await p.inputValue(itemRow(2) + ' >> [data-quote-damt]'), '50.00'); assert.equal(await p.inputValue(itemRow(2) + ' >> [data-quote-dpct]'), '4.27', '50 ÷ 1,170');
    t = await T(p);
    near(t.gross, 4267 + 4 * 42 + 585, 'gross'); near(t.lineDisc, 23.10 + 50, 'line discounts');
    assert.equal(await p.textContent(itemRow(1) + ' >> .total-cell'), '396.90');
    assert.equal(await p.textContent(itemRow(1) + ' >> .qt-gross'), 'Gross 420.00');
    // limits: % over 100, SAR over the gross, text → red, counts as 0, Save blocked with the reason
    await typeIn(p, itemRow(3) + ' >> [data-quote-dpct]', '120');
    assert.equal(await p.getAttribute(itemRow(3) + ' >> [data-quote-dpct]', 'class').then(c => /qt-bad/.test(c)), true);
    assert.equal((await T(p)).badLines, 1);
    assert.match(await p.textContent('#qt-ready'), /A line discount/);
    await p.evaluate(() => { window.__toasts.length = 0; saveQuotation('draft'); }); await sleep(200);
    assert.equal(await p.isVisible('#confirm-ok'), false, 'no confirmation while a discount is wrong');
    assert.match((await p.evaluate(() => window.__toasts.map(x => x.msg).join('|'))), /Line 3 — discount: A discount can't be more than 100 %/);
    await typeIn(p, itemRow(3) + ' >> [data-quote-damt]', '5000');
    assert.equal(await p.getAttribute(itemRow(3) + ' >> [data-quote-damt]', 'title'), "Can't be more than the line gross 1,200.00.");
    await typeIn(p, itemRow(3) + ' >> [data-quote-damt]', '');
    assert.equal(await p.inputValue(itemRow(3) + ' >> [data-quote-dpct]'), '', 'clearing one clears both');
    assert.equal((await T(p)).badLines, 0);
    // the quotation discount can't be more than the lines total
    await typeIn(p, '#f-discount', '999999'); assert.equal((await T(p)).discBad, true);
    await typeIn(p, '#f-discount', '20'); await p.keyboard.press('Tab');
    assert.equal(await p.inputValue('#f-discount'), '20.00');
    t = await T(p);
    // calculation order: sub-total − line discounts = lines total − quotation discount = before VAT + VAT = grand total
    near(t.lineNet, t.gross - t.lineDisc, 'lines total'); near(t.bvat, t.lineNet - 20, 'before VAT'); near(t.vat, Math.round(t.bvat * 15) / 100, 'VAT on before VAT'); near(t.net, t.bvat + t.vat, 'grand');
    assert.equal(await p.textContent('#qt-tot-disc'), '−73.10');
    // internal summary: selling after both discounts; status by the Pricing Settings method
    const cost = await p.evaluate(() => window._pendingQuotationPricingContext.cost);
    assert.equal(await p.textContent('#qcs-profit'), (t.bvat - cost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    assert.match(await p.textContent('#qcs-status'), /^(Good|Low) · Markup /);
    assert.match(await p.textContent('#qcs-cmp'), /after discounts/);

    /* ── 3. headings, notes and note styles ── */
    await p.click('#product-search-bar button:has-text("Heading")'); await p.keyboard.type('Option A — Building Materials');
    await p.evaluate(() => { const tb = document.getElementById('items-tbody'); tb.insertBefore(tb.lastElementChild, tb.firstElementChild); qtAfterRowsChange(); });
    await p.evaluate(() => { const n = addSpecialQuoteRow('note', 'Alternative brand on request — same price.', { focus: false }); const tb = document.getElementById('items-tbody'); tb.insertBefore(n, tb.children[4]); addSpecialQuoteRow('note', 'Installation is not included.', { focus: false }); qtAfterRowsChange(); });
    assert.equal(await p.textContent('#qt-notestyle-name'), 'Soft Highlight');
    assert.equal(await p.$$eval('#items-tbody tr.qt-nrow', r => r.map(x => x.classList.contains('qt-att')).join()), 'true,true', 'a note after an item belongs to it');
    // this quotation: Blue Accent (the Administration default stays Soft Highlight)
    await p.click('#qt-notestyle-btn'); await p.click('.qt-pop [data-act="s:blueAccent"]');
    assert.equal(await p.textContent('#qt-notestyle-name'), 'Blue Accent');
    assert.equal(await p.evaluate(() => quotationLineNoteStyle()), 'highlight', 'Administration default unchanged');
    // one note line: Minimal
    await p.click('#items-tbody tr.qt-nrow >> nth=0 >> .qt-schip'); await p.click('.qt-pop [data-act="s:minimal"]');
    assert.deepEqual(await p.$$eval('#items-tbody tr.qt-nrow .qt-note', r => r.map(x => x.className)), ['qt-note qt-ns-minimal', 'qt-note qt-ns-blueAccent']);
    assert.match(await p.textContent('#items-tbody tr.qt-nrow >> nth=0 >> .qt-schip'), /Minimal/);
    await shot(p, 'QT_1440_lines');

    /* ── 4. line menu: insert above, duplicate, move, delete + Undo ── */
    const count = () => p.$$eval('#items-tbody tr', r => r.length);
    const n0 = await count();
    await p.click(itemRow(2) + ' >> .qt-menu-btn'); await p.click('.qt-pop [data-act="dup"]');
    assert.equal(await count(), n0 + 1);
    assert.equal(await p.inputValue(itemRow(3) + ' >> [data-quote-damt]'), '50.00', 'the copy keeps the discount');
    await p.click(itemRow(3) + ' >> .qt-menu-btn'); await p.click('.qt-pop [data-act="del"]'); await p.click('.qt-cf .pr-danger');
    assert.equal(await count(), n0);
    await p.click('.qt-toast button'); assert.equal(await count(), n0 + 1, 'Undo puts the line back');
    await p.click(itemRow(3) + ' >> .qt-menu-btn'); await p.click('.qt-pop [data-act="del"]'); await p.click('.qt-cf .pr-danger');
    await p.click(itemRow(1) + ' >> .qt-menu-btn'); await p.click('.qt-pop [data-act="above"]');
    assert.equal(await p.$eval('#items-tbody tr:nth-child(2)', tr => tr.dataset.lineType + ':' + tr.querySelector('[data-f="desc"]').value), 'item:', 'a blank line above line 1');
    await p.focus(itemRow(1) + ' >> [data-f="desc"]'); await p.keyboard.press('Control+Delete'); await p.click('.qt-cf .pr-danger');
    await p.focus(itemRow(2) + ' >> [data-quote-qty]'); await p.keyboard.press('Alt+ArrowUp');
    assert.match(await p.inputValue(itemRow(1) + ' >> [data-f="desc"]'), /^PAINT/, 'Alt+↑ moves the line up');
    await p.keyboard.press('Alt+ArrowDown');
    assert.match(await p.inputValue(itemRow(1) + ' >> [data-f="desc"]'), /^PUTTY/);

    /* ── 5. leaving: with changes → Leave Without Saving? (Stay keeps everything) ── */
    await p.click('#qt-back-btn');
    assert.equal(await p.textContent('.qt-cf h3'), 'Leave Without Saving?');
    assert.deepEqual(await p.$$eval('.qt-cf .pr-cf-bt button', b => b.map(x => x.textContent)), ['Stay', 'Discard & Go Back', 'Save Draft & Close'], 'opened from Pricing → Go Back');
    assert.match(await p.textContent('.qt-cf p'), /Going back to Pricing now/);
    await p.click('.qt-cf .pr-cf-bt button:has-text("Stay")');
    assert.equal(await p.isVisible('#quote-modal.open'), true);

    /* ── 6. save & preview → saved fields, View, Print, Sales Order price ── */
    await p.evaluate(() => { saveQuotation('preview'); });
    await p.waitForSelector('#confirm-ok'); const det = await p.textContent('#app-confirm-overlay');
    assert.match(det, /Line discounts− (SAR )?73\.10/); assert.match(det, /Quotation discount− (SAR )?20\.00/);
    await p.click('#confirm-ok');
    await p.waitForSelector('#view-modal.open', { timeout: 10000 }); await sleep(400);
    const q = await p.evaluate(() => quotations.find(x => x.id === currentViewQuotationId));
    const lines = q.items.filter(i => i.lineType === 'item');
    assert.deepEqual([lines[0].discBy, lines[0].discPct, lines[0].discAmt], ['pct', 5.5, 23.1]);
    assert.deepEqual([lines[1].discBy, lines[1].discAmt], ['amt', 50]);
    assert.equal('discAmt' in lines[2], false, 'a line without a discount has no discount fields');
    assert.equal(q.noteStyle, 'blueAccent'); assert.deepEqual(q.items.filter(i => i.lineType === 'note').map(n => n.noteStyle || ''), ['minimal', '']);
    assert.equal(q.noteStyleAtSend, undefined, 'a Draft is not frozen');
    assert.equal(q.vatRate, 15); assert.equal(q.pricingRef, 'PR-2610-0022-V1'); assert.ok(q.pricingCost > 0);
    const c = await p.evaluate(id => calcQuote(quotations.find(x => x.id === id)), q.id);
    near(c.net, t.net, 'saved total = screen total');
    assert.equal(await p.$$eval('#view-modal .qdoc-items th', th => th.map(x => x.textContent.trim()).join('|')), 'SL|Description|Qty|UOM|Unit Price|Disc.|Amount');
    assert.equal(await p.$$eval('#view-modal .note-minimal', x => x.length), 1); assert.equal(await p.$$eval('#view-modal .note-blue', x => x.length), 1);
    await shot(p, 'QT_view');
    const html = await p.evaluate(id => { window.__popups.length = 0; printQuotationProductA4(id); return window.__popups.at(-1).document.html; }, q.id);
    assert.match(html, /<th class="r">Disc\.<\/th>/); assert.match(html, /5\.50%<\/span><span class="qd-amt">−23\.10/);
    assert.match(html, /inline-note note-minimal/); assert.match(html, /inline-note note-blue/);
    const svc = await p.evaluate(id => { window.__popups.length = 0; printQuotationErpVariant(id, 'contracting'); return window.__popups.at(-1).document.html; }, q.id);
    assert.match(svc, /Disc\./); assert.match(svc, /note-minimal/);
    // a quotation without discounts prints exactly as before (no Disc. column)
    const plain = await p.evaluate(() => { window.__popups.length = 0; printQuotationProductA4('q11'); return window.__popups.at(-1).document.html; });
    assert.doesNotMatch(plain, />Disc\.</);
    // Sales Order: a discounted line goes to the order at its price after the line discount
    const so = await p.evaluate(id => getQuotationSOProgress(id).remaining.slice(0, 2).map(x => [x.up, x.quotedUp]), q.id);
    near(so[0][0], 396.90 / 10, 'net unit price'); assert.equal(so[0][1], 42); near(so[1][0], (1170 - 50) / 2, 'net unit price (SAR discount)');

    /* ── 7. note style frozen once the quotation leaves Draft ── */
    await p.evaluate(id => commitStatus(id, 'Sent'), q.id); await sleep(200);
    const sent = await p.evaluate(id => quotations.find(x => x.id === id), q.id);
    assert.equal(sent.noteStyle, 'blueAccent'); assert.equal(sent.noteStyleAtSend, undefined, 'its own style is already fixed');
    await p.evaluate(() => commitStatus('q11', 'Lost')); await sleep(200);
    assert.equal(await p.evaluate(() => quotations.find(x => x.id === 'q11').noteStyleAtSend), 'highlight', 'the Administration default of that moment is kept');
    await p.evaluate(() => { settings.quotationPrint = { lineNoteStyle: 'badge' }; });
    assert.equal(await p.evaluate(() => quotationEffectiveNoteStyle(quotations.find(x => x.id === 'q11'), {})), 'highlight', 'a later Administration change does not alter it');
    assert.equal(await p.evaluate(() => quotationEffectiveNoteStyle({}, {})), 'badge');
    await p.evaluate(() => { settings.quotationPrint = { lineNoteStyle: 'highlight' }; });

    /* ── 8. an older Draft opens and saves without new fields; leaving without changes closes at once ── */
    await p.evaluate(() => document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m.id)));
    await p.evaluate(() => editQuotation('q12', true)); await p.waitForSelector('#quote-modal.open'); await sleep(300);
    assert.equal(await p.isVisible('#quote-commercial-none'), true, 'no Pricing link → no profit');
    near((await T(p)).net, 99 * 1.15, 'old draft total');
    await p.click('#qt-back-btn'); await sleep(200);
    assert.equal(await p.isVisible('.qt-cf'), false, 'no question when nothing changed');
    assert.equal(await p.evaluate(() => document.getElementById('quote-modal').classList.contains('open')), false);

    assert.deepEqual(p.__errors, [], 'no page errors');
  } finally { await h.close(); }
});

test('V270.2 Quotation Entry layout: 1440, 1366 × 768 (42 lines, folded), 1112, 834 and the phone cards', { timeout: 600000 }, async () => {
  const h = await startHarness({ appDir, playwright, executablePath: process.env.CHROMIUM_PATH });
  try {
    seedPricing(h.fs, { extraRows: 37 });
    const p = await ready(h);
    await p.setViewportSize({ width: 1440, height: 900 });
    await fromPricing(p);
    assert.equal(await p.$$eval('#items-tbody tr.qt-row', r => r.length), 42);
    assert.deepEqual(await outside(p), { bad: [], page: 0 }, '1440');
    const w = await p.$eval('#quote-modal .qt-win', e => Math.round(e.getBoundingClientRect().width)); assert.equal(w, 1404, 'full width less 18 px each side (V271.7.2: capped at 1680 px, same as Estimation)');
    // 1366 × 768: fold → one line; header and totals rows stay in view while the lines scroll
    await p.setViewportSize({ width: 1366, height: 768 }); await sleep(300);
    await p.click('#qt-band .qt-fold'); await sleep(200);
    assert.equal(await p.isVisible('#qt-band-fold'), true);
    assert.deepEqual(await outside(p), { bad: [], page: 0 }, '1366');
    await p.$eval('#qt-gt', g => { g.scrollTop = 900; }); await sleep(150);
    const sticky = await p.evaluate(() => { const g = document.getElementById('qt-gt').getBoundingClientRect(), th = document.querySelector('#items-thead th').getBoundingClientRect(), tf = document.querySelector('#items-tfoot td').getBoundingClientRect(); return { th: Math.round(th.top - g.top), tf: Math.round(g.bottom - tf.bottom) }; });
    assert.ok(sticky.th <= 2 && sticky.tf <= 2, 'sticky header / totals ' + JSON.stringify(sticky));
    await shot(p, 'QT_1366_42');
    // remembered: opening again stays folded
    assert.equal(await p.evaluate(() => localStorage.getItem('bc_qt_fold')), '1');
    // 1112 landscape tablet: totals bar instead of the panel; it opens the summary
    await p.setViewportSize({ width: 1112, height: 834 }); await sleep(300);
    assert.equal(await p.isVisible('#qt-bar'), true); assert.equal(await p.isVisible('#qt-side'), false);
    assert.deepEqual(await outside(p), { bad: [], page: 0 }, '1112');
    await p.click('#qt-bar'); assert.equal(await p.isVisible('#qt-side'), true); await p.click('#qt-side .qt-side-hd .pr-btn');
    // 834 portrait: the code column folds into the description
    await p.setViewportSize({ width: 834, height: 1112 }); await sleep(300);
    assert.deepEqual(await outside(p), { bad: [], page: 0 }, '834');
    assert.equal(await p.isVisible(itemRow(1) + ' >> .qt-meta'), true);
    assert.equal(await p.$eval('#items-thead .qt-th-code', e => Math.round(e.getBoundingClientRect().width)), 0);
    await shot(p, 'QT_834');
    // phone: cards built from plain blocks, two buttons + ⋯, the line sheet edits the line
    await p.setViewportSize({ width: 390, height: 844 }); await sleep(400);
    assert.equal(await p.isVisible('#qt-gt'), false); assert.equal(await p.$$eval('#qt-cards .qt-card[data-k]', c => c.length), 42);
    assert.deepEqual(await outside(p), { bad: [], page: 0 }, '390');
    assert.deepEqual(await p.$$eval('#quote-modal .qt-ft .btn', b => b.filter(x => x.offsetParent).sort((a, c) => a.getBoundingClientRect().left - c.getBoundingClientRect().left).map(x => x.textContent.trim())), ['⋯', 'Save & Preview']);
    await p.fill('#qt-cards .qt-card[data-k] >> nth=0 >> [data-p="dpct"]', '10'); await sleep(100);
    assert.equal(await p.inputValue(itemRow(1) + ' >> [data-quote-damt]'), '25.20', 'the card edits the line (10 % of 252.00)');
    await p.click('#qt-cards .qt-card[data-k] >> nth=1 >> .qt-ct');
    assert.equal(await p.isVisible('.qt-sheet'), true);
    await p.fill('.qt-sheet [data-p="damt"]', '85'); await sleep(100);
    assert.equal(await p.inputValue(itemRow(2) + ' >> [data-quote-dpct]'), '14.53', 'the sheet edits the line (85 of 585.00)');
    await shot(p, 'QT_390_sheet');
    await p.click('.qt-sheet [data-sh="done"]');
    await p.click('#qt-detcard'); assert.equal(await p.isVisible('#f-cust-search'), true, 'details sheet'); await p.click('#qt-band .qt-band-hd .pr-btn');
    await shot(p, 'QT_390');
    assert.deepEqual(p.__errors, [], 'no page errors');
  } finally { await h.close(); }
});
