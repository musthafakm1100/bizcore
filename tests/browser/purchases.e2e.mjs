/** BROWSER (simulator): V268.1 — Purchasing → Purchase Invoices (approved mockup 4). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { startHarness } from './harness.mjs';

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const playwright = createRequire(process.env.PLAYWRIGHT_FROM || import.meta.url)('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SHOTS = process.env.PI_SHOTS || '', TABLER = process.env.TABLER_DIR || '';
async function icons(p) {
  if (!SHOTS || !TABLER) return;
  const { readFile } = await import('node:fs/promises');
  await p.context().route(/@tabler\/icons-webfont/, async route => {
    const f = new URL(route.request().url()).pathname.split('/dist/')[1] || 'tabler-icons.min.css';
    const body = await readFile(TABLER + '/' + f).catch(() => null);
    if (!body) return route.fulfill({ status: 404, body: '' });
    route.fulfill({ status: 200, contentType: f.endsWith('.css') ? 'text/css' : 'font/woff2', body });
  });
}
const shot = async (p, name) => { if (SHOTS) await p.screenshot({ path: `${SHOTS}/${name}.png` }); };

const SO4 = { id: 'so4', soNo: 'SO-2610-0004', date: '2026-10-05', customer: 'SNC Lavalin Arabia', quotationId: 'q1', items: [
  { lineId: 'L1', origIdx: 0, desc: 'LED Panel 60x60', uom: 'Pcs', qty: 10, up: 160, amount: 1600 },
  { lineId: 'L2', origIdx: 1, desc: 'Cable 4 mm', uom: 'Roll', qty: 3, up: 70, amount: 210, code: 'CB4' },
  { lineId: 'L3', origIdx: 2, desc: 'Pelican Flashlight', uom: 'Pcs', qty: 6, up: 300, amount: 1800 },
], deliveries: [], invoices: [], payments: [], subtotal: 3610, vat: 541.5, total: 4151.5, created: '2026-10-05T08:00:00Z' };
const SO11 = { id: 'so11', soNo: 'SO-2610-0011', date: '2026-10-08', customer: 'MOHG', items: [{ lineId: 'M1', origIdx: 0, desc: 'Cable 4 mm', uom: 'Roll', qty: 4, up: 72, amount: 288, code: 'CB4' }],
  deliveries: [], invoices: [], payments: [], subtotal: 288, vat: 43.2, total: 331.2, created: '2026-10-08T08:00:00Z' };
const Q1 = { id: 'q1', qno: 'Q-2610-0001', rfqId: 'r1', pricingVersion: 1, status: 'Won', customer: 'SNC Lavalin Arabia', items: [
  { desc: 'LED Panel 60x60', uom: 'Pcs', qty: 10, up: 160 }, { desc: 'Cable 4 mm', uom: 'Roll', qty: 3, up: 70, code: 'CB4' }, { desc: 'Pelican Flashlight', uom: 'Pcs', qty: 6, up: 300 }] };
const R1 = { id: 'r1', rfqNo: 'RFQ-2610-0001', currentPricingVersion: 1, quotationId: 'q1', pricingVersions: [{ version: 1, status: 'Converted', pricingItems: [
  { desc: 'LED Panel 60x60', uom: 'Pcs', qty: 10, buy: 120, sell: 160 }, { desc: 'Cable 4 mm', code: 'CB4', uom: 'Roll', qty: 3, buy: 50, sell: 70 }, { desc: 'Pelican Flashlight', uom: 'Pcs', qty: 6, buy: 200, sell: 300 }] }] };

test('V268.1 purchase invoices: entry per mockup 4, saved as credit, register, cancel, settings', { timeout: 240000 }, async () => {
  const h = await startHarness({ appDir, playwright, executablePath: process.env.CHROMIUM_PATH });
  try {
    h.fs.load({
      'system/deliveryNoteStorage': { mode: 'independent', minClientVersion: 260 }, 'system/invoiceStorage': { mode: 'independent' }, 'system/accessControl': { adminUids: ['u-boss'] },
      'salesOrders/so4': SO4, 'salesOrders/so11': SO11, 'quotations/q1': Q1, 'rfqs/r1': R1,
      'suppliers/sup1': { id: 'sup1', company: 'ABC Trading Est', vat: '300000000000003' },
      'products/p1': { id: 'p1', name: 'Cable Ties 300 mm', code: 'CT300', uom: 'Pack' },
    });
    const boss = await h.newUser({ uid: 'u-boss', email: 'boss@x', name: 'Musthafa KM' });
    const aisha = await h.newUser({ uid: 'u-aisha', email: 'aisha@x', name: 'Aisha' });
    await icons(boss); await icons(aisha);
    await h.open(boss); await h.open(aisha);
    const set = (p, sel, v) => p.evaluate(([s, v]) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, String(v)]);
    const invoices = () => Object.entries(h.fs.dump('purchaseInvoices/')).filter(([k]) => k.split('/').length === 2).map(([, d]) => d);

    // register is empty; the page is no longer a placeholder
    await aisha.evaluate(() => showPage('purchaseinvoices')); await sleep(400);
    assert.match(await aisha.textContent('#pireg-body'), /No purchase invoices found/);
    await aisha.click('#pi-new-btn'); await aisha.waitForSelector('#pi-new-modal.open');
    assert.equal(await aisha.isDisabled('#pe-save'), true);
    await set(aisha, '#pe-supplier', 'sup1'); await set(aisha, '#pe-invno', 'INV-88213');
    // add the three lines of SO-2610-0004
    await aisha.click('#pi-new-modal button:has-text("Add from sales orders")'); await aisha.waitForSelector('#pi-pick-modal.open');
    for (const k of ['so4|L1', 'so4|L2', 'so4|L3']) await aisha.evaluate(k => piPickToggle(k, true), k);
    await aisha.evaluate(() => piPickAdd()); await sleep(200);
    const s0 = await aisha.evaluate(() => piState().lines.map(l => [l.qty, l.unitCost, l.reference && l.reference.source]));
    assert.deepEqual(s0, [[10, 120, 'pricing'], [3, 50, 'pricing'], [6, 200, 'pricing']], 'qty = still to buy, cost = estimate from Pricing');
    // cable: 5 bought (2 more than the order needs) at 52; flashlight: 4 at 224 (+12%)
    await set(aisha, '#pe-lines tr[data-i="1"] input[aria-label="Qty bought"]', '5');
    await set(aisha, '#pe-lines tr[data-i="1"] input[aria-label="Unit cost"]', '52');
    await set(aisha, '#pe-lines tr[data-i="2"] input[aria-label="Qty bought"]', '4');
    await set(aisha, '#pe-lines tr[data-i="2"] input[aria-label="Unit cost"]', '224');
    const body = await aisha.textContent('#pe-lines');
    assert.match(body, /2 more than SO-2610-0004 needs/); assert.match(body, /SO-2610-0011 · needs 4/); assert.match(body, /\+12\.0% — above 5% limit/); assert.match(body, /\+4\.0% — within limit/);
    // stock line with no reference
    await aisha.evaluate(() => piAddStockLine()); await sleep(100);
    // V268.5: the item must be a product (approved mockup V5_2): type to search; + New Product warns about a look-alike
    await aisha.fill('#pe-lines tr[data-i="3"] .pi-stock-desc', 'cable ties'); await sleep(120);
    const pl = await aisha.textContent('#pi-prod-list');
    assert.match(pl, /Cable Ties 300 mm/); assert.match(pl, /New Product “cable ties”/);
    await aisha.click('#pi-prod-list .pi-np-opt'); await aisha.waitForSelector('#pi-np-modal.open');
    assert.match(await aisha.textContent('#pnp-dup'), /Did you mean “Cable Ties 300 mm” \(CT300\)\?/);
    await aisha.click('#pnp-dup button'); await sleep(200);
    assert.equal(await aisha.evaluate(() => piState().lines[3].desc), 'Cable Ties 300 mm');
    assert.ok(await aisha.evaluate(() => piState().lines[3].productId));
    await set(aisha, '#pe-lines tr[data-i="3"] input[aria-label="Qty bought"]', '10');
    await set(aisha, '#pe-lines tr[data-i="3"] input[aria-label="Unit cost"]', '12');
    assert.match(await aisha.textContent('#pe-lines'), /No estimate or previous price/);
    // additional cost + discount
    await aisha.evaluate(() => piAddCost()); await set(aisha, '#pe-costs .pi-cost-amt', '50');
    await aisha.evaluate(() => piAddDiscount()); await set(aisha, '#pe-disc-val', '100');
    const todo1 = await aisha.textContent('#pe-todo');
    assert.match(todo1, /1 Reason/); assert.match(todo1, /1 Extra qty to place/); assert.match(todo1, /Supplier total/);
    assert.equal(await aisha.isDisabled('#pe-save'), true);
    await shot(aisha, 'V2681_entry_todo');
    // place the extra 2 in SO-2610-0011, give the reason
    await aisha.evaluate(() => piPlaceExtra(1, 'order', 'so11', 'M1'));
    await set(aisha, '#pe-lines .pi-reason input', 'Supplier price increase');
    // lines 1200 + 260 + 896 + 120 = 2476 ; +50 −100 = 2426 ; VAT 363.90 ; total 2789.90 → supplier 2789.50 (−0.40)
    const calc = await aisha.evaluate(() => piState()._v.totals.calcTotal);
    assert.equal(calc, 2789.9);
    await set(aisha, '#pe-suptotal', '2,800.00');
    assert.match(await aisha.textContent('#pe-match'), /more than the ±1\.00 rounding limit/);
    await set(aisha, '#pe-suptotal', '2789.50');
    assert.match(await aisha.textContent('#pe-match'), /difference -0\.40 recorded as rounding|difference −0\.40|-0\.40/);
    assert.equal(await aisha.isDisabled('#pe-save'), false, await aisha.textContent('#pe-todo'));
    await sleep(400);
    await shot(aisha, 'V2681_entry_ready');
    await aisha.click('#pe-save'); await sleep(900);
    assert.equal(await aisha.evaluate(() => isModalOpen('pi-new-modal')), false, await aisha.textContent('#pe-error'));
    const pi = invoices()[0];
    assert.equal(pi.piNo.startsWith('PI-'), true); assert.equal(pi.payStatus, 'Unpaid'); assert.equal(pi.totals.total, 2789.5); assert.equal(pi.totals.rounding, -0.4);
    assert.deepEqual(pi.lines[1].allocations.map(a => [a.soNo, a.qty]), [['SO-2610-0004', 3], ['SO-2610-0011', 2]]);
    assert.equal(h.fs.peek('salesOrderPurchasing/so4').lines.L2.purchased, 3);
    assert.equal(h.fs.peek('salesOrderPurchasing/so11').lines.M1.purchased, 2);
    assert.equal(h.fs.peek('stockItems/p_p1').qty, 10);
    // register
    await sleep(400);
    const reg = await aisha.textContent('#pireg-body');
    assert.match(reg, /ABC Trading Est/); assert.match(reg, /INV-88213/); assert.match(reg, /2,789\.50/); assert.match(reg, /Unpaid/);
    await shot(aisha, 'V2681_register');
    // still to buy updated for the next invoice: flashlight 2 of 6 left
    await aisha.click('#pi-new-btn'); await aisha.waitForSelector('#pi-new-modal.open');
    await aisha.click('#pi-new-modal button:has-text("Add from sales orders")'); await aisha.waitForSelector('#pi-pick-modal.open');
    const pick = await aisha.textContent('#pi-pick-list');
    assert.match(pick, /Pelican Flashlight/); assert.match(pick, /Still to buy 2 of 6/); assert.doesNotMatch(pick, /LED Panel/);
    await aisha.evaluate(() => { closeModal('pi-pick-modal'); closeModal('pi-new-modal'); });
    // the same supplier invoice no. is refused by the service
    // view + cancel
    await aisha.evaluate(id => openPurchaseInvoiceView(id), pi.id); await aisha.waitForSelector('#pi-view-modal.open');
    assert.match(await aisha.textContent('#pi-view-modal'), /Supplier price increase/);
    assert.doesNotMatch(await aisha.textContent('#pi-view-modal'), /Profit on these orders/, 'staff: profit hidden (admins only)');
    await shot(aisha, 'V2681_view');
    await boss.evaluate(id => openPurchaseInvoiceView(id), pi.id); await boss.waitForSelector('#pi-view-modal.open');
    assert.match(await boss.textContent('#pi-view-modal'), /Profit on these orders/);
    // V268.12: item · sales order in one column, Selling → P/L per line for allowed roles only
    assert.match(await boss.textContent('#pi-view-modal thead'), /Item · sales order[\s\S]*Selling → P\/L/);
    assert.match(await boss.textContent('#pi-view-modal tbody tr:first-child'), /LED Panel 60x60[\s\S]*SO-2610-0004 · SNC Lavalin Arabia[\s\S]*Sell 160\.00/);
    assert.doesNotMatch(await aisha.textContent('#pi-view-modal thead'), /P\/L/);
    await shot(boss, 'V26812_view');
    await boss.evaluate(() => closeModal('pi-view-modal'));
    await aisha.evaluate(id => piAskCancel(id), pi.id); await aisha.waitForSelector('#pi-void-modal.open');
    await set(aisha, '#pi-void-why', 'entered twice'); await aisha.click('#pi-void-save'); await sleep(700);
    assert.equal(invoices()[0].status, 'Voided');
    assert.equal(h.fs.peek('salesOrderPurchasing/so4').lines.L2.purchased, 0);
    assert.equal(h.fs.peek('stockItems/p_p1').qty, 0);
    // Administration → Purchase Settings: staff view-only, admin saves
    await aisha.evaluate(() => { showPage('setup'); switchSetupTab('purchase-settings'); }); await sleep(300);
    assert.equal(await aisha.locator('#ps-save').count(), 0);
    await boss.evaluate(() => { showPage('setup'); switchSetupTab('purchase-settings'); }); await sleep(300);
    await set(boss, '#ps-disc', 'both'); await set(boss, '#ps-round', '0.5'); await boss.click('#ps-save'); await sleep(500);
    assert.equal(h.fs.peek('settings/purchasing').discountMode, 'both');
    await shot(boss, 'V2681_settings');
    // per-line discount column appears for everyone
    await sleep(300);
    await aisha.evaluate(() => { showPage('purchaseinvoices'); openNewPurchaseInvoice(); }); await aisha.waitForSelector('#pi-new-modal.open');
    await aisha.evaluate(() => piAddStockLine()); await sleep(100);
    assert.equal(await aisha.locator('#pe-lines input[aria-label="Discount %"]').count(), 1);
    for (const p of [boss, aisha]) assert.deepEqual(p.__errors, [], 'no page errors');
  } finally { await h.close(); }
});

test('V268.12 lines layout (mockup 7): qty status, Selling → P/L for allowed roles, phone cards', { timeout: 240000 }, async () => {
  const h = await startHarness({ appDir, playwright, executablePath: process.env.CHROMIUM_PATH });
  try {
    h.fs.load({
      'system/deliveryNoteStorage': { mode: 'independent', minClientVersion: 260 }, 'system/invoiceStorage': { mode: 'independent' }, 'system/accessControl': { adminUids: ['u-boss'] },
      'salesOrders/so4': SO4, 'salesOrders/so11': SO11, 'quotations/q1': Q1, 'rfqs/r1': R1,
      'suppliers/sup1': { id: 'sup1', company: 'ABC Trading Est', vat: '300000000000003' },
    });
    const boss = await h.newUser({ uid: 'u-boss', email: 'boss@x', name: 'Musthafa KM' });
    const aisha = await h.newUser({ uid: 'u-aisha', email: 'aisha@x', name: 'Aisha' });
    const phone = await h.newUser({ uid: 'u-boss', email: 'boss@x', name: 'Musthafa KM', device: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } });
    await icons(boss); await icons(aisha); await icons(phone);
    await h.open(boss); await h.open(aisha); await h.open(phone);
    const set = (p, sel, v) => p.evaluate(([s, v]) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, String(v)]);
    const fill = async p => {
      await p.evaluate(() => { showPage('purchaseinvoices'); openNewPurchaseInvoice(); }); await p.waitForSelector('#pi-new-modal.open');
      await set(p, '#pe-supplier', 'sup1'); await set(p, '#pe-invno', 'INV-1');
      await p.evaluate(() => { piOpenPicker(); ['so4|L1', 'so4|L2', 'so4|L3'].forEach(k => piPickToggle(k, true)); piPickAdd(); }); await sleep(200);
      await set(p, '#pe-lines tr[data-i="1"] input[aria-label="Qty bought"]', '5');
      await set(p, '#pe-lines tr[data-i="2"] input[aria-label="Qty bought"]', '4');
    };
    // V268.14: the register looks exactly like the Receipts register (monitor, filter bar, date field, table, type sizes)
    const look = key => boss.evaluate(([key]) => { const P = document.getElementById('page-' + key), o = {};
      for (const sel of ['aside.bc-monitor', '.dn-overview-head', '.dn-overview-head strong', '.dn-overview-head span', '.dn-overview-total span', '.dn-overview-total strong', '.dn-overview-section-label', '.dn-overview-row.dn-kpi', '.dn-overview-row.dn-kpi>span', '.dn-overview-row.dn-kpi>strong', '.dn-overview-row .dn-dot', '.bc-monitor-metric>span', '.bc-monitor-metric>strong', '.bc-filterbar', '.bc-filter-sort', '.bc-filter-count', '.bc-filter-customer', '.bc-date .bc-date-btn', '.bc-filter-search', '.register-clear-filters', '.bc-filter-new', 'table thead th', 'table tbody td']) {
        const e = P.querySelector(sel), cs = e && getComputedStyle(e); if (!e) { o[sel] = null; continue; }
        o[sel] = ['display', 'font-size', 'font-weight', 'line-height', 'padding', 'color', 'background-color', 'border-radius'].map(k => k + ':' + cs.getPropertyValue(k)).join(';') + (/^(td|th)|table/.test(sel) ? '' : ';h:' + Math.round(e.getBoundingClientRect().height)) + (['aside.bc-monitor', '.dn-overview-head', '.dn-overview-row.dn-kpi'].includes(sel) ? ';w:' + Math.round(e.getBoundingClientRect().width) : ''); }
      return o; }, [key]);
    await boss.evaluate(() => showPage('receipts')); await sleep(500); const rct = await look('receipts');
    await boss.evaluate(() => showPage('purchaseinvoices')); await sleep(500); const pur = await look('purchaseinvoices');
    rct['aside.bc-monitor'] = rct['aside.bc-monitor'].replace(/;h:\d+/, ''); pur['aside.bc-monitor'] = pur['aside.bc-monitor'].replace(/;h:\d+/, '');   // different number of rows
    for (const k of Object.keys(rct)) assert.equal(pur[k], rct[k], 'same look as Receipts: ' + k);
    await fill(boss);
    const row = i => boss.textContent(`#pe-lines tr[data-i="${i}"]`);
    // item and sales order in one column; qty: "of N to buy" + one status line
    assert.match(await row(0), /LED Panel 60x60[\s\S]*Pcs · SO-2610-0004 · SNC Lavalin Arabia/);
    assert.match(await row(0), /Of 10 to buy\s*Complete/);
    assert.match(await row(1), /Of 3 to buy\s*\+2 extra/);
    assert.match(await row(2), /Of 6 to buy\s*2 still to buy/);
    assert.match(await row(0), /Est\. 120\.00/);
    // the status follows typing without a re-render
    await boss.evaluate(() => { const e = document.querySelector('#pe-lines tr[data-i="0"] input[aria-label="Qty bought"]'); e.value = '7'; e.dispatchEvent(new Event('input', { bubbles: true })); });
    assert.match(await row(0), /Of 10 to buy\s*3 still to buy/);
    await set(boss, '#pe-lines tr[data-i="0"] input[aria-label="Qty bought"]', '10');
    // Selling → P/L (admin): LED 10 × (160 − 120) = +400.00, 25.0 %
    assert.match(await boss.textContent('#pe-lines-head'), /Selling → P\/L/);
    assert.match(await boss.textContent('#pe-lines tr[data-i="0"] .pi-pl'), /Sell 160\.00\s*\+400\.00\s*25\.0%/);
    await boss.evaluate(() => piPlaceExtra(1, 'stock')); await sleep(100);
    assert.match(await boss.textContent('#pe-lines tr[data-i="1"] .pi-pl'), /Sell 70\.00\s*\+60\.00\s*28\.6% · 3 for the order/);
    await set(boss, '#pe-lines tr[data-i="2"] input[aria-label="Unit cost"]', '320');
    assert.match(await boss.textContent('#pe-lines tr[data-i="2"] .pi-pl'), /−80\.00|-80\.00/);
    assert.equal(await boss.locator('#pe-lines tr[data-i="2"] .pi-pl .pi-red').count() > 0, true, 'loss in red');
    await sleep(400); await shot(boss, 'V26812_entry_desktop');
    // staff (profit for administrators only): no P/L column
    await fill(aisha);
    assert.doesNotMatch(await aisha.textContent('#pe-lines-head'), /P\/L/);
    assert.equal(await aisha.locator('#pe-lines .pi-pl').count(), 0);
    // phone: each line is a card, no sideways scrolling
    // V268.13: on a phone the Purchase Monitor becomes status chips + Summary, like the other registers
    await phone.evaluate(() => showPage('purchaseinvoices')); await sleep(500);
    assert.match(await phone.textContent('#page-purchaseinvoices .bc-chiprow'), /All[\s\S]*Posted[\s\S]*Overdue[\s\S]*Summary/);
    assert.equal(await phone.evaluate(() => getComputedStyle(document.querySelector('#page-purchaseinvoices aside.bc-monitor')).display), 'none', 'monitor folded into chips');
    assert.equal(await phone.evaluate(() => !!document.querySelector('#page-purchaseinvoices .bc-mfilter')), true, 'filter icon');
    await shot(phone, 'V26813_register_phone');
    await fill(phone); await phone.evaluate(() => piPlaceExtra(1, 'stock')); await sleep(400);
    assert.equal(await phone.evaluate(() => getComputedStyle(document.querySelector('#pe-lines tr.pi-line')).display), 'grid');
    if (SHOTS) { await phone.evaluate(() => document.querySelector('#pe-lines').scrollIntoView()); await sleep(300); await shot(phone, 'V26812_entry_phone'); }
    assert.equal(await phone.evaluate(() => { const w = document.querySelector('#pi-new-modal .pi-lines-wrap'); return w.scrollWidth <= w.clientWidth + 1; }), true, 'no sideways scroll on a phone');
    for (const p of [boss, aisha, phone]) assert.deepEqual(p.__errors, [], 'no page errors');
  } finally { await h.close(); }
});
