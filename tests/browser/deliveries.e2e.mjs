/** BROWSER (simulator): V265.5 — Deliveries screen (out for delivery → confirm, Mine/All, search, QR code) and
 *  the Delivery Note view on phone / tablet (Details / Document tabs, A4 fitted to the width, ⋯ More). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { startHarness } from './harness.mjs';
const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const playwright = createRequire(process.env.PLAYWRIGHT_FROM || import.meta.url)('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SHOTS = process.env.SHOTS;
// V271.5.40: document numbers reset monthly as "YYMM" of the real clock (see docPeriod() in js/app.js) — this
// file used to hard-code October 2026's "2610", which breaks every month. P is today's period code.
const P = (() => { const d = new Date(); return String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0'); })();

test('V265.5 Deliveries screen and phone/tablet Delivery Note view', { timeout: 240000 }, async () => {
  const h = await startHarness({ appDir, playwright, executablePath: process.env.CHROMIUM_PATH });
  try {
    h.fs.load({
      'system/deliveryNoteStorage': { mode: 'independent', minClientVersion: 260 },
      'system/invoiceStorage': { mode: 'independent' },
      'system/accessControl': { adminUids: ['u-boss'] },
      'quotations/Q-1': { id: 'Q-1', qno: `Q-${P}-0001`, date: '2026-10-01', company: 'MOHG', status: 'Sent', vatRate: 15,
        items: [{ desc: 'Aquthem Pipe 32mm PN16', qty: 6, uom: 'Pcs', up: 100 }, { desc: 'Gate Valve 2"', qty: 4, uom: 'Pcs', up: 50 }] },
    });
    const p = await h.newUser({ uid: 'u-boss', email: 'boss@x', name: 'Boss' });
    await h.open(p);
    const shot = async name => { if (SHOTS) { await sleep(350); await p.screenshot({ path: `${SHOTS}/${name}.png` }); } };
    const closeAll = () => p.evaluate(() => { document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m.id)); document.getElementById('bc-action-sheet')?.remove(); });
    const set = (sel, v) => p.evaluate(([s, v]) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, String(v)]);
    await p.evaluate(() => {
      employees = [{ id: 'emp-boss', name: 'Boss', email: 'boss@x', active: true }, { id: 'emp-ahmed', name: 'Ahmed Ali', designation: 'Driver', active: true }];
      customers.push({ id: 'C-1', company: 'MOHG', buildingNo: '3602', street: 'King Fahd Rd', district: 'Al Olaya', city: 'Riyadh', contacts: [{ name: 'Mr. Nabhan', phone: '+966 50 123 4567', isDefault: true }] });
    });
    await p.evaluate(() => openCreateSO('Q-1')); await set('#so-po-no', 'PO-11244'); await p.click('#so-save-btn'); await sleep(1200);
    const soId = await p.evaluate(() => salesOrders[0].id); await closeAll();
    // three DNs: mine (2 pipes), Ahmed (2 pipes), someone else (2 pipes + valves)
    const dispatch = async (who, q0, q1) => {
      await p.evaluate(id => openRecordDelivery(id), soId); await p.waitForSelector('#so-delivery-modal.open');
      await set('#dn-qty-0', q0); await set('#dn-qty-1', q1);
      if (who === 'ahmed') await set('#dn-delivered-by', 'emp:emp-ahmed');
      if (who === 'other') { await set('#dn-delivered-by', 'other'); await set('#dn-delivered-by-other', 'Saleem (Al Majd)'); }
      await p.click('#dn-dispatch-save-btn'); await sleep(1300); await closeAll();
    };
    await dispatch('me', 2, 0); await dispatch('ahmed', 2, 0); await dispatch('other', 2, 4);

    // 0. V265.6: while the data is still loading the screen says so (never "Nothing is out for delivery")
    await p.evaluate(() => { window.__bcDataReady = false; showPage('deliveries'); });
    assert.match(await p.textContent('#dl-list'), /Loading deliveries/); assert.doesNotMatch(await p.textContent('#dl-list'), /Nothing is out/);
    await p.evaluate(() => { window.__bcDataReady = true; bcDeliveriesRefresh(); showPage('dashboard'); });

    // 1. Sidebar item + count; page opens from the sidebar
    assert.equal(await p.textContent('#deliveries-badge'), '3');
    await p.click('[data-nav-page="deliveries"]'); await sleep(300);
    assert.equal(await p.textContent('#page-title'), 'Deliveries');
    // Mine is the default when something is mine; counts
    assert.equal(await p.getAttribute('[data-dl-scope="mine"]', 'aria-pressed'), 'true');
    assert.deepEqual([await p.textContent('#dl-count-mine'), await p.textContent('#dl-count-all')], ['1', '3']);
    assert.equal(await p.locator('#dl-list .dl-card').count(), 1);
    await p.click('[data-dl-scope="all"]');
    assert.equal(await p.locator('#dl-list .dl-card').count(), 3);
    const txt = await p.textContent('#dl-list');
    assert.match(txt, /3602 King Fahd Rd, Al Olaya, Riyadh/); assert.match(txt, /Ahmed Ali/); assert.match(txt, /Saleem \(Al Majd\)/); assert.match(txt, /You/);
    // search
    await p.fill('#dl-search', `DN-${P}-0002`); await p.dispatchEvent('#dl-search', 'input');
    assert.equal(await p.locator('#dl-list .dl-card').count(), 1);
    await p.fill('#dl-search', ''); await p.dispatchEvent('#dl-search', 'input');
    await p.setViewportSize({ width: 1440, height: 900 }); await shot('deliveries-desktop');
    await p.setViewportSize({ width: 820, height: 1180 }); await shot('deliveries-tablet');
    await p.setViewportSize({ width: 390, height: 844 }); await shot('deliveries-phone');

    // 2. View on a phone: V270.4.5 Document tab first and open; Details on tap; ⋯ More
    await p.click('#dl-list .dl-card:nth-child(1) .dl-view'); await p.waitForSelector('#dn-print-modal.open'); await sleep(300);
    assert.equal(await p.getAttribute('#dn-print-body .dn-view-workspace', 'data-mtab'), 'doc');
    assert.deepEqual(await p.$$eval('#dn-print-body .dn-m-tabs [data-mtab]', b => b.map(x => x.dataset.mtab)), ['doc', 'details']);
    await p.evaluate(() => dnMobileTab('details')); await sleep(200);
    assert.equal(await p.isVisible('#dn-print-body .dn-m-details'), true);
    assert.equal(await p.isVisible('#dn-print-body .dn-view-document'), false);
    assert.match(await p.textContent('#dn-print-body .dn-m-details'), /Mr\. Nabhan · \+966 50 123 4567/);
    const bar = await p.evaluate(() => [...document.querySelectorAll('#dn-print-modal .dn-view-actionbar > *')].filter(e => e.offsetParent && getComputedStyle(e).display !== 'none').map(e => e.id || e.className));
    assert.deepEqual(bar.sort(), ['btn btn-secondary dn-m-more', 'dn-open-confirm-btn', 'dn-print-btn'].sort(), 'phone bar: More, Confirm, Print');
    const fits = await p.evaluate(() => { const b = document.querySelector('#dn-print-modal .dn-view-actionbar').getBoundingClientRect(); return b.right <= window.innerWidth + 1; });
    assert.ok(fits, 'bar fits the phone');
    await shot('dnview-phone-details');
    await p.click('#dn-print-body .dn-m-tabs [data-mtab="doc"]'); await sleep(300);
    const fit = await p.evaluate(() => { const a = document.querySelector('#dn-print-body .dn-a4').getBoundingClientRect(); return { r: a.right, w: window.innerWidth }; });
    assert.ok(fit.r <= fit.w, 'A4 fits the phone width ' + JSON.stringify(fit));
    await shot('dnview-phone-document');
    await p.click('#dn-print-modal .dn-m-more'); await p.waitForSelector('#bc-action-sheet');
    assert.deepEqual(await p.evaluate(() => [...document.querySelectorAll('#bc-action-sheet .bc-sheet-item')].map(b => b.textContent.trim())), ['Sales Order', 'Dispatch History', 'Correct Dispatch', 'Void', 'Close']);
    await shot('dnview-phone-more');
    await p.click('#bc-action-sheet .bc-sheet-cancel');
    await p.setViewportSize({ width: 820, height: 1180 }); await sleep(300);
    await closeAll(); await p.evaluate(() => bcDeliveriesView(salesOrders[0].id, salesOrders[0].deliveries[0].id)); await sleep(400);
    assert.equal(await p.getAttribute('#dn-print-body .dn-view-workspace', 'data-mtab'), 'doc', 'tablet opens on the Document tab');
    assert.equal(await p.isVisible('#dn-close-btn'), true, 'Close on a tablet');
    await shot('dnview-tablet');
    await closeAll();

    // 3. Confirm from the list → back to the list, card gone, count down
    await p.setViewportSize({ width: 390, height: 844 });
    await p.click('#dl-list .dl-card:nth-child(1) .dl-go'); await p.waitForSelector('#dn-confirm-modal.open');
    await set('#dn-received-by', 'Ahmed'); await p.click('#dn-confirm-save-btn'); await sleep(1600);
    assert.equal(await p.evaluate(() => isModalOpen('dn-print-modal')), false, 'not sent to the DN view');
    assert.equal(await p.evaluate(() => document.getElementById('page-deliveries').classList.contains('active')), true);
    assert.equal(await p.locator('#dl-list .dl-card').count(), 2);
    assert.equal(await p.textContent('#deliveries-badge'), '2');

    // 3b. V265.6: a missing "Received by" shows the standard validation dialog, before any busy overlay
    await p.click('#dl-list .dl-card:nth-child(1) .dl-go'); await p.waitForSelector('#dn-confirm-modal.open');
    await p.evaluate(() => { window.__busy = 0; const b = window.beginScreenTransition; const o = window.runProtectedDocumentSave; window.runProtectedDocumentSave = (...a) => { window.__busy++; return o(...a); }; });
    await p.click('#dn-confirm-save-btn'); await sleep(300);
    assert.equal(await p.isVisible('#validation-dialog'), true); assert.match(await p.textContent('#validation-dialog'), /Received by required/);
    assert.equal(await p.evaluate(() => window.__busy), 0, 'no busy overlay before the check');
    assert.equal(await p.evaluate(() => document.getElementById('dn-action-message')?.classList.contains('show') || false), false);
    await p.evaluate(() => closeValidationDialog()); await closeAll(); await sleep(500);

    // 3c. V265.6: confirmed on ANOTHER device → the card disappears here without a click
    const other = await h.newUser({ uid: 'u-alice', email: 'alice@x', name: 'Alice' }); await h.open(other);
    await other.evaluate(() => openDeliveryAcceptance(salesOrders[0].id, 2)); await other.waitForSelector('#dn-confirm-modal.open');
    await other.evaluate(() => { const e = document.getElementById('dn-received-by'); e.value = 'Site'; });
    await other.click('#dn-confirm-save-btn'); await sleep(2000);
    assert.equal(await p.locator('#dl-list .dl-card').count(), 1, 'remote confirmation removed the card');
    assert.equal(await p.textContent('#deliveries-badge'), '1');

    // 4. QR code text → opens the confirmation (token URL), typed DN number works, unknown code warns
    const tok = await p.evaluate(() => salesOrders[0].deliveries[1].deliveryAccessToken);
    assert.ok(tok);
    await p.evaluate(t => bcDeliveriesOpenFromCode('https://example.com/bizcore/delivery.html?t=' + t), tok); // the printed QR await p.waitForSelector('#dn-confirm-modal.open');
    assert.match(await p.textContent('#dn-confirm-sub'), new RegExp(`DN-${P}-0002`));
    await closeAll(); await sleep(500);
    assert.equal(await p.evaluate(period => bcDeliveriesOpenFromCode(`dn-${period}-0002`), P), true); await p.waitForSelector('#dn-confirm-modal.open'); await closeAll(); await sleep(500);
    assert.equal(await p.evaluate(() => bcDeliveriesOpenFromCode('nonsense')), false);

    // 4b. "Open Deliveries when BizCore starts on this device"
    await p.evaluate(() => showPage('deliveries')); await p.check('#dl-start-here');
    assert.equal(await p.evaluate(() => localStorage.getItem('bc_start_page')), 'deliveries');
    await p.uncheck('#dl-start-here'); assert.equal(await p.evaluate(() => localStorage.getItem('bc_start_page')), '');

    // 5. Desktop DN view unchanged: no tabs, normal bar
    await p.setViewportSize({ width: 1440, height: 900 });
    await p.evaluate(() => viewDeliveryNote(salesOrders[0].id, 0)); await sleep(300);
    assert.equal(await p.isVisible('#dn-print-body .dn-m-tabs'), false); assert.equal(await p.isVisible('#dn-print-body .dn-view-document'), true);
    assert.equal(await p.isVisible('#dn-print-modal .dn-m-more'), false); assert.equal(await p.isVisible('#dn-open-so-btn'), true);
  } finally { await h.close(); }
});
