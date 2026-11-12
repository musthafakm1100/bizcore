/** BROWSER (simulator): V271.8 Dashboard (approved mockup E) — header filters, Needs attention tiles, sales target ring,
 *  trend cards, chart, pipeline, 2-week calendar, receivables, top customers, the target dialog (saved in settings/main),
 *  role rules (no cost without the Special Right) and the phone layout. Screenshots go to DASH_SHOTS when set. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { startHarness } from './harness.mjs';
const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const playwright = createRequire(process.env.PLAYWRIGHT_FROM || import.meta.url)('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const plus = n => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
const mk = (id, soNo, customer, date, lines, extra = {}) => {
  const items = lines.map(([desc, qty, up], i) => ({ lineId: `${id}-L${i + 1}`, origIdx: i, code: '', desc, uom: 'Pcs', qty, up, amount: qty * up, estCost: Math.round(up * 0.75 * 100) / 100 }));
  const subtotal = items.reduce((s, l) => s + l.amount, 0);
  return { id, soNo, date, customer, custId: '', quotationId: '', poNo: 'PO-' + id, items, subtotal, vat: subtotal * 0.15, total: subtotal * 1.15, vatRate: 0.15, deliveries: [], invoices: [], payments: [], ownerUid: 'u-alice', created: new Date().toISOString(), ...extra };
};

test('Dashboard V271.8: figures, filters, target, roles and phone layout', { timeout: 240000 }, async () => {
  const { adminAdapter, seedSampleOrders } = await import('../../emulator/sample-orders.mjs');
  const h = await startHarness({ appDir, playwright, executablePath: process.env.CHROMIUM_PATH });
  const shots = process.env.DASH_SHOTS || '';
  try {
    const fs = h.fs, t = iso(new Date());
    fs.load({
      'system/deliveryNoteStorage': { mode: 'independent', minClientVersion: 260 }, 'system/invoiceStorage': { mode: 'independent' }, 'system/accessControl': { adminUids: ['u-alice'] },
      'settings/main': { data: JSON.stringify({ coname: 'Downtown Trading Est.', salesTargets: { monthly: 20000, months: {} } }), updatedAt: Date.now() },
      'rfqs/R-1': { id: 'R-1', rfqNo: 'RFQ-2611-0001', date: plus(-6), company: 'Al Noor Trading', requestType: 'product', ownerUid: 'u-alice', items: [] },
      'rfqs/R-2': { id: 'R-2', rfqNo: 'RFQ-2611-0002', date: plus(-1), company: 'Gulf Supplies', requestType: 'product', ownerUid: 'u-alice', items: [] },
      'rfqs/R-3': { id: 'R-3', rfqNo: 'RFQ-2611-0003', date: plus(-3), company: 'Riyadh Office Mart', requestType: 'product', ownerUid: 'u-alice', items: [] },
      'quotations/Q-1': { id: 'Q-1', qno: 'Q-2611-0001', rfqId: 'R-3', date: plus(-2), company: 'Riyadh Office Mart', status: 'Sent', validity: 2, vatRate: 15, ownerUid: 'u-alice', items: [{ desc: 'Chair', qty: 10, uom: 'Pcs', up: 400 }] },
      'quotations/Q-2': { id: 'Q-2', qno: 'Q-2611-0002', rfqId: 'R-2', date: plus(-1), company: 'Gulf Supplies', status: 'Won', vatRate: 15, ownerUid: 'u-alice', items: [{ desc: 'Clip', qty: 100, uom: 'Pcs', up: 30 }] },
      'salesOrders/SO-M1': mk('SO-M1', 'SO-2611-0001', 'Gulf Supplies', t, [['Clip', 100, 30]], { quotationId: 'Q-2', expectedDelivery: plus(2) }),
      'salesOrders/SO-M2': mk('SO-M2', 'SO-2611-0002', 'Al Noor Trading', t, [['Paper', 50, 80]], { expectedDelivery: plus(-1) }),
    });
    const ref = path => ({ path, id: path.split('/').pop(), get: async () => ({ exists: fs.peek(path) !== undefined, data: () => fs.peek(path) }), set: async d => { fs.load({ [path]: d }); } });
    const admin = { doc: ref, runTransaction: fn => fs.runTransaction(fs.db, tx => fn({ get: async r => { const s = await tx.get(fs.doc(fs.db, r.path)); return { exists: s.exists(), data: () => s.data() }; }, set: (r, d) => tx.set(fs.doc(fs.db, r.path), d) })) };
    await seedSampleOrders(adminAdapter(admin, fs.serverTimestamp), { log: () => {} });

    const p = await h.newUser({ uid: 'u-alice', email: 'alice@bizcore.test', name: 'Alice Admin' });
    await p.setViewportSize({ width: 1440, height: 900 });
    const errors = []; p.on('pageerror', e => errors.push(String(e && e.message || e)));
    await h.open(p);
    await p.waitForFunction(() => salesOrders.length === 6 && window.BCDash && document.querySelector('#bd-tiles .bd-tile'), null, { timeout: 30000 });
    await p.evaluate(() => { showPage('dashboard'); BCDash.render(); }); await sleep(600);

    // header: greeting and the filter line (one line, the standard date filter inside)
    assert.match(await p.textContent('#bd-greet'), /Alice/);
    assert.ok(await p.isVisible('#bd-f-period'), 'period filter shown');
    const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], now = new Date();
    assert.equal(await p.textContent('#bd-f-period b'), MON[now.getMonth()] + ' ' + now.getFullYear());
    assert.ok(await p.isDisabled('#bd-next'), 'no future months');
    const filterRow = await p.evaluate(() => { const r = document.querySelector('.bd-filters'); return { h: r.getBoundingClientRect().height, wrap: getComputedStyle(r).flexWrap }; });
    assert.equal(filterRow.wrap, 'nowrap'); assert.ok(filterRow.h < 44, 'filters stay on one line');

    // needs attention
    const tiles = await p.$$eval('#bd-tiles .bd-tile', els => els.map(e => e.querySelector('.bd-tile-l').textContent + '=' + e.querySelector('.bd-tile-n').textContent));
    const tile = name => (tiles.find(x => x.startsWith(name + '=')) || '').split('=')[1];
    assert.equal(tile('RFQs to price'), '1', 'R-1 has no quotation; R-2 / R-3 are quoted: ' + tiles.join(' | '));
    assert.equal(tile('Quotes awaiting reply'), '1');
    assert.ok(Number(tile('Orders to deliver')) >= 2, 'to deliver ' + tile('Orders to deliver'));
    assert.match(await p.textContent('#bd-tiles'), /1 late/, 'SO-M2 expected yesterday');

    // ring: this month's orders 3,000 + 4,000 = 7,000 of 20,000 → 35 %
    const ring = await p.textContent('.bd-ring-card');
    assert.match(ring, /35%/, ring); assert.match(ring, /SAR 7K/); assert.match(ring, /of SAR 20K/);
    // trend cards for the administrator (cost right): Gross profit with the margin
    assert.match(await p.textContent('#bd-kpis'), /Gross profit/);
    assert.match(await p.textContent('#bd-kpis'), /25\.0% margin/, 'estCost 75 % of the price → 25 % margin');
    // chart + pipeline + calendar + receivables + customers
    assert.equal(await p.$$eval('#bd-chart-card .bd-bar', b => b.length), 12);
    assert.match(await p.textContent('#bd-pipe-card'), /RFQs received/);
    assert.match(await p.textContent('#bd-cal-card'), /SO-2611-0001/, 'delivery due in 2 days');
    assert.match(await p.textContent('#bd-cal-card'), /Q-2611-0001 expires/);
    assert.match(await p.textContent('#bd-cust-card'), /Al Noor Trading/);
    assert.ok(await p.isVisible('#bd-recv-card'), 'receivables shown (independent invoices)');
    if (shots) { await p.setViewportSize({ width: 1440, height: 2000 }); await sleep(300); await p.screenshot({ path: join(shots, 'dash-desktop.png') }); await p.setViewportSize({ width: 1440, height: 900 }); await sleep(200); }

    // customer filter (click a top customer)
    await p.click('#bd-cust-card .bd-cust[data-c="Al Noor Trading"]'); await sleep(300);
    assert.equal(await p.textContent('#bd-f-customer b'), 'Al Noor Trading');
    assert.match(await p.textContent('.bd-ring-card'), /SAR 4K/);
    await p.click('#bd-clear'); await sleep(300);
    assert.equal(await p.textContent('#bd-f-customer b'), 'All');

    // V271.8.1 — the Customer menu: search, pick, Esc
    await p.click('#bd-f-customer'); await p.waitForSelector('.bd-menu .bd-search');
    await p.fill('.bd-menu .bd-search', 'gulf'); await sleep(150);
    assert.deepEqual(await p.$$eval('.bd-menu .bd-mi:not([hidden])', b => b.map(x => x.textContent.trim())), ['Gulf Supplies']);
    await p.keyboard.press('Enter'); await sleep(300);
    assert.equal(await p.$('.bd-menu'), null, 'menu closed after picking');
    assert.equal(await p.textContent('#bd-f-customer b'), 'Gulf Supplies');
    assert.match(await p.textContent('.bd-ring-card'), /SAR 3K/);
    await p.click('#bd-f-customer'); await p.waitForSelector('.bd-menu');
    await p.keyboard.press('Escape'); await sleep(150);
    assert.equal(await p.$('.bd-menu'), null, 'Esc closes');
    await p.click('#bd-clear'); await sleep(300);

    // V271.8.1 — "This Month" from the Period menu keeps the whole month (target, days left)
    await p.click('#bd-f-period'); await p.waitForSelector('.bd-menu [data-preset="month"]');
    await p.click('.bd-menu [data-preset="month"]'); await sleep(400);
    const ringM = await p.textContent('.bd-ring-card');
    const left = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
    assert.match(ringM, new RegExp('of SAR 20K · ' + left + ' day'), ringM);
    // This Year: target for 12 months
    await p.click('#bd-f-period'); await p.click('.bd-menu [data-preset="year"]'); await sleep(400);
    assert.equal(await p.textContent('#bd-f-period b'), String(now.getFullYear()));
    assert.match(await p.textContent('.bd-ring-card'), /of SAR 240K/);
    // custom range
    await p.click('#bd-f-period'); await p.waitForSelector('.bd-menu .bd-apply');
    const cds = await p.$$('.bd-menu .bd-cd');
    await cds[0].fill('01-10-2026'); await cds[0].press('Tab'); await cds[1].fill('31-10-2026'); await cds[1].press('Tab');
    await p.click('.bd-menu .bd-apply'); await sleep(400);
    assert.equal(await p.textContent('#bd-f-period b'), 'Oct 2026');
    await p.click('#bd-clear'); await sleep(300);
    if (shots) {
      await p.click('#bd-f-period'); await sleep(250); await p.screenshot({ path: join(shots, 'menu-period.png'), clip: { x: 500, y: 40, width: 940, height: 640 } }); await p.keyboard.press('Escape');
      await p.click('#bd-f-customer'); await sleep(250); await p.screenshot({ path: join(shots, 'menu-customer.png'), clip: { x: 500, y: 40, width: 940, height: 640 } }); await p.keyboard.press('Escape');
    }

    // previous month with the stepper: October has the four sample orders (dated 05-10-2026)
    await p.click('#bd-prev'); await sleep(500);
    assert.equal(await p.textContent('#bd-f-period b'), 'Oct 2026');
    assert.match(await p.textContent('.bd-ring-card'), /Target reached|Below target/);
    await p.click('#bd-next'); await sleep(400);

    // target dialog → saved in settings/main
    await p.click('.bd-target-btn'); await p.waitForSelector('#bd-target-modal.open');
    await p.fill('#bd-tgt-monthly', '14000'); await p.click('#bd-tgt-save'); await sleep(800);
    assert.match(await p.textContent('.bd-ring-card'), /50%/);
    const saved = JSON.parse(fs.peek('settings/main').data);
    assert.equal(saved.salesTargets.monthly, 14000);

    // a tile opens its register with the filter
    await p.click('#bd-tiles [data-tile="deliver"]'); await sleep(500);
    assert.equal(await p.evaluate(() => document.querySelector('.page.active').id), 'page-salesorders');
    await p.evaluate(() => showPage('dashboard')); await sleep(400);

    // phone
    await p.setViewportSize({ width: 390, height: 844 }); await sleep(500);
    const ph = await p.evaluate(() => ({ cols: getComputedStyle(document.getElementById('bd-tiles')).gridTemplateColumns.split(' ').length, agenda: getComputedStyle(document.querySelector('.bd-agenda')).display, days: getComputedStyle(document.querySelector('.bd-days')).display, wide: document.documentElement.scrollWidth > window.innerWidth + 2 }));
    assert.equal(ph.cols, 2); assert.equal(ph.agenda, 'flex'); assert.equal(ph.days, 'none'); assert.equal(ph.wide, false, 'no sideways page scroll on a phone');
    if (shots) { await p.setViewportSize({ width: 390, height: 2600 }); await sleep(300); await p.screenshot({ path: join(shots, 'dash-phone.png') }); await p.setViewportSize({ width: 390, height: 844 }); await sleep(200);
      await p.click('#bd-f-period'); await sleep(300); await p.screenshot({ path: join(shots, 'menu-phone.png') }); await p.click('.bd-sheet-x'); await sleep(200); }
    assert.deepEqual(errors, [], 'no page errors: ' + errors.join(' | '));

    // a sales user without the cost right sees no profit
    const s = await h.newUser({ uid: 'u-sam', email: 'sam@bizcore.test', name: 'Sam Sales', role: 'sales' });
    await s.setViewportSize({ width: 1440, height: 900 });
    await h.open(s);
    await s.waitForFunction(() => window.BCDash && document.querySelector('#bd-tiles .bd-tile'), null, { timeout: 30000 });
    await s.evaluate(() => { showPage('dashboard'); BCDash.render(); }); await sleep(600);
    const k = await s.textContent('#bd-kpis');
    assert.doesNotMatch(k, /Gross profit/, 'no profit without the Special Right');
    assert.match(k, /Orders won/);
    assert.doesNotMatch(await s.textContent('#bd-tiles'), /Supplier bills/, 'no purchasing tile without the module');
    assert.equal(await s.$('.bd-target-btn'), null, 'no target button without Administration');
  } finally { await h.close(); }
});
