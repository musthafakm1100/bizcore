/** BROWSER (simulator): V270.4.8 — (1) every plain date field is the BizCore date field (DD-MM-YYYY shown, ISO behind
 *  it, typing and the calendar); (2) PDF names carry the customer PO number; (3) print pages: footer at the bottom of
 *  every page (8 mm), spread left → right, ≥ 8 mm above it, a long table continues with its header, "Page X of Y";
 *  (4) on screen the footer sits at the bottom of the A4 sheet. */
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
const N = 40;
const SEED = {
  'system/deliveryNoteStorage': { mode: 'independent', minClientVersion: 260 },
  'system/invoiceStorage': { mode: 'independent' },
  'system/accessControl': { adminUids: ['u-boss'] },
  'quotations/Q-1': { id: 'Q-1', qno: 'Q-2610-0008', date: '2026-10-01', company: 'SNC Lavalin Arabia', status: 'Sent', vatRate: 15,
    items: Array.from({ length: N }, (_, i) => ({ desc: 'Item ' + (i + 1) + ' battery lithium 3.6V', qty: 2, uom: 'EA', up: 40 })) },
};
const rawText = (p, sel) => p.evaluate(s => Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').get.call(document.querySelector(s)), sel);

test('V270.4.8 date field everywhere, PO in PDF names, footer at the bottom of every page', { timeout: 300000 }, async () => {
  const h = await startHarness({ appDir, playwright, executablePath: process.env.CHROMIUM_PATH });
  const popups = {};
  try {
    h.fs.load(SEED);
    const p = await h.newUser({ uid: 'u-boss', email: 'boss@x', name: 'Boss' });
    await h.open(p);
    const set = (sel, v) => p.evaluate(([s, v]) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, String(v)]);
    const closeAll = () => p.evaluate(() => { document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m.id)); });

    // 1. date fields: none of the plain browser date boxes is left; the screen still reads / writes ISO
    assert.equal(await p.evaluate(() => document.querySelectorAll('input[type="date"]').length), 0, 'no plain date boxes in the page');
    assert.ok(await p.evaluate(() => document.querySelectorAll('[data-bc-date-field]').length) >= 15);
    await p.evaluate(() => openCreateSO('Q-1')); await sleep(300);
    const today = await p.evaluate(() => BCDate.today());
    const soDate = await p.evaluate(() => document.getElementById('so-date').value);
    assert.match(soDate, /^\d{4}-\d{2}-\d{2}$/, 'value stays ISO');
    assert.equal(await rawText(p, '#so-date'), soDate.split('-').reverse().join('-'), 'box shows DD-MM-YYYY');
    // typing, then leaving the field
    await p.fill('#so-po-date', '151026'); await p.keyboard.press('Tab'); await sleep(100);
    assert.equal(await rawText(p, '#so-po-date'), '15-10-2026');
    assert.equal(await p.evaluate(() => document.getElementById('so-po-date').value), '2026-10-15');
    // calendar button
    await p.click('#so-expected-delivery + .bcd-btn'); await p.waitForSelector('.bcd-pop');
    await p.click('.bcd-pop [data-iso="' + today.slice(0, 8) + '20"]'); await sleep(100);
    assert.equal(await p.evaluate(() => document.getElementById('so-expected-delivery').value), today.slice(0, 8) + '20');
    // a window built later (Credit Note / New Invoice / purchase screens) is upgraded as it appears
    await set('#so-po-no', '2200005124'); await p.click('#so-save-btn'); await sleep(1200);
    const soId = await p.evaluate(() => salesOrders[0].id); await closeAll();
    await p.evaluate(id => openRecordDelivery(id), soId); await p.waitForSelector('#so-delivery-modal.open');
    assert.equal(await p.evaluate(() => document.getElementById('dn-date').type), 'text');
    assert.match(await rawText(p, '#dn-date'), /^\d{2}-\d{2}-\d{4}$/);
    for (let i = 0; i < N; i++) await set('#dn-qty-' + i, 2);
    await p.click('#dn-dispatch-save-btn'); await sleep(1500); await closeAll();
    await p.evaluate(id => openDeliveryAcceptance(id, 0), soId); await p.waitForSelector('#dn-confirm-modal.open');
    await set('#dn-received-by', 'Najah'); await p.click('#dn-confirm-save-btn'); await sleep(1500); await closeAll();

    // 2. PDF names: DN and Invoice end with the customer PO number (no "Accepted …" ending)
    await p.evaluate(id => viewDeliveryNote(id, 0), soId); await p.waitForSelector('#dn-print-modal.open'); await sleep(500);
    // 4. screen: the footer at the bottom of the A4 sheet, spread margin to margin
    const sc = await p.evaluate(() => { const sh = document.querySelector('#dn-print-modal .dn-a4'), f = sh.querySelector('.dn-foot'), ps = [...f.querySelectorAll('.dfp')], mm = 96 / 25.4, b = sh.getBoundingClientRect(), fb = f.getBoundingClientRect();
      return { fromBottom: (b.bottom - fb.bottom) / mm, left: (ps[0].getBoundingClientRect().left - b.left) / mm, right: (b.right - ps.at(-1).getBoundingClientRect().right) / mm, sep: [...f.querySelectorAll('.dfs')].some(x => x.offsetWidth > 0) }; });
    assert.ok(sc.fromBottom > 7 && sc.fromBottom < 10, 'screen footer near the sheet bottom ' + JSON.stringify(sc));
    assert.ok(Math.abs(sc.left - sc.right) < 1.5 && !sc.sep, 'screen footer spread left → right ' + JSON.stringify(sc));
    for (const f of ['accepted-standard', 'standard']) {
      await p.evaluate(f => printDeliveryNote(f), f);
      assert.match(await p.evaluate(() => window.__popups.at(-1).document.html), /<title>DN-\d{4}-\d{4} - SNC Lavalin Arabia - PO2200005124<\/title>/, f);
    }
    popups.dn = await p.evaluate(() => window.__popups.at(-1).document.html);
    await p.click('#dn-create-invoice-btn'); await p.waitForSelector('#inv-issue-modal.open');
    assert.equal(await p.evaluate(() => document.getElementById('ii-date').type), 'text', 'invoice window date field upgraded');
    await set('#ii-zoho', 'ZB-7001'); await p.click('#ii-save'); await p.waitForSelector('#app-confirm-overlay'); await p.click('#confirm-ok'); await sleep(1500);
    await closeAll();
    await p.evaluate(() => printCustomerInvoice(invoicesCache[0].id));
    popups.inv = await p.evaluate(() => window.__popups.at(-1).document.html);
    assert.match(popups.inv, /<title>INV-\d{4}-\d{4} - SNC Lavalin Arabia - PO2200005124<\/title>/);
    await p.evaluate(() => { _printQID = 'Q-1'; _quotationOutputOptions = { signature: false, stamp: false }; printQuotationProductA4('Q-1'); });
    popups.qerp = await p.evaluate(() => window.__popups.at(-1).document.html);
    await p.evaluate(() => printQuotationErpVariant('Q-1', 'contracting'));
    popups.qsvc = await p.evaluate(() => window.__popups.at(-1).document.html);
    assert.deepEqual(p.__errors, []);
  } finally { await h.close(); }

  // 3. the print windows themselves, opened in a real browser page: A4 pages, footer, gap, page numbers
  const b = await playwright.chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
  try {
    for (const [k, html] of Object.entries(popups)) {
      const file = join(appDir, '__test_print_' + k + '.html');
      writeFileSync(file, html.replace(/window\.print\(\)/g, 'void 0'));
      const pg = await (await b.newContext()).newPage();
      const errs = []; pg.on('pageerror', e => errs.push(e.message));
      try {
        await pg.goto('file://' + file); await sleep(700);
        const r = await pg.evaluate(() => {
          const mm = 96 / 25.4, pages = [...document.querySelectorAll('.bcp-page')];
          return pages.map(pg => {
            const b = pg.getBoundingClientRect(), f = pg.querySelector('.bcp-foot'), fb = f.getBoundingClientRect();
            const kids = [...pg.children].filter(c => c !== f && getComputedStyle(c).display !== 'none');
            const lowest = Math.max(...kids.map(c => c.getBoundingClientRect().bottom));
            const spans = [...f.children].filter(s => s.textContent.trim());
            return { h: +(b.height / mm).toFixed(1), fromBottom: +((b.bottom - fb.bottom) / mm).toFixed(1), gap: +((fb.top - lowest) / mm).toFixed(1),
              left: +((spans[0].getBoundingClientRect().left - b.left) / mm).toFixed(1), right: +((b.right - spans.at(-1).getBoundingClientRect().right) / mm).toFixed(1),
              no: (f.querySelector('.bcp-page-no') || {}).textContent || '', heads: pg.querySelectorAll('thead').length, rows: pg.querySelectorAll('tbody tr').length };
          });
        });
        assert.deepEqual(errs, [], k);
        assert.equal(r.length, 2, k + ': 40 lines → 2 pages ' + JSON.stringify(r));
        r.forEach((x, i) => {
          assert.ok(Math.abs(x.h - 296.5) < 0.6, k + ' page size'); assert.ok(x.fromBottom > 7.5 && x.fromBottom < 9, k + ' footer 8 mm from the bottom ' + x.fromBottom);
          assert.ok(x.gap >= 7.9, k + ' gap above the footer ' + x.gap); assert.ok(x.left > 10 && x.right > 10 && Math.abs(x.left - x.right) < 1.5, k + ' footer spread ' + JSON.stringify(x));
          assert.equal(x.no, 'Page ' + (i + 1) + ' of 2'); assert.ok(x.heads >= 1, k + ' table header on page ' + (i + 1));
        });
      } finally { unlinkSync(file); }
    }
  } finally { await b.close(); }
});

test('V270.4.8.1 date field: Tab closes the open calendar; picking a day keeps a date filter box open', { timeout: 200000 }, async () => {
  const h = await startHarness({ appDir, playwright, executablePath: process.env.CHROMIUM_PATH });
  try {
    h.fs.load(SEED);
    const p = await h.newUser({ uid: 'u-boss', email: 'boss@x', name: 'Boss' });
    await h.open(p);
    // 1. New RFQ: open the calendar, type the date in the box, Tab → calendar closed, next field, date kept
    await p.evaluate(() => openNewRFQ()); await sleep(600);
    await p.click('#rfq-date + .bcd-btn'); await p.waitForSelector('.bcd-pop');
    await p.click('#rfq-date', { clickCount: 3 }); await p.keyboard.type('13/10/2026'); await sleep(100);
    assert.equal(await p.$eval('.bcd-day.bcd-sel', b => b.dataset.iso), '2026-10-13', 'the open calendar follows the typing');
    await p.keyboard.press('Tab'); await sleep(150);
    assert.equal(await p.$('.bcd-pop'), null, 'calendar closed by Tab');
    assert.equal(await rawText(p, '#rfq-date'), '13-10-2026');
    assert.notEqual(await p.evaluate(() => document.activeElement && document.activeElement.id), 'rfq-date', 'focus moved on');
    // a click elsewhere also closes it
    await p.click('#rfq-due + .bcd-btn'); await p.waitForSelector('.bcd-pop');
    await p.mouse.click(20, 20); await sleep(150);
    assert.equal(await p.$('.bcd-pop'), null, 'calendar closed by a click elsewhere');
    await p.evaluate(() => { document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m.id)); });

    // 2. a register's date filter: pick From and To from the calendar — the filter box stays open until Apply
    await p.evaluate(() => showPage('rfq')); await sleep(500);
    const host = '[data-bc-date="rfq"]';
    await p.click(host + ' .bc-date-btn'); await p.waitForSelector(host + ' .bc-date-pop:not([hidden])');
    await p.click(host + ' .bc-date-from + .bcd-btn'); await p.waitForSelector('.bcd-pop');
    const month = await p.evaluate(() => BCDate.today().slice(0, 8));
    await p.click(`.bcd-pop [data-iso="${month}05"]`); await sleep(150);
    assert.equal(await p.$eval(host + ' .bc-date-pop', e => e.hidden), false, 'filter box still open after picking From');
    await p.click(host + ' .bc-date-to + .bcd-btn'); await p.waitForSelector('.bcd-pop');
    await p.click(`.bcd-pop [data-iso="${month}10"]`); await sleep(150);
    assert.equal(await p.$eval(host + ' .bc-date-pop', e => e.hidden), false, 'filter box still open after picking To');
    assert.deepEqual(await p.evaluate(h => [document.querySelector(h + ' .bc-date-from').value, document.querySelector(h + ' .bc-date-to').value], host), [month + '05', month + '10']);
    await p.click(host + ' .bc-date-apply'); await sleep(200);
    assert.equal(await p.$eval(host + ' .bc-date-pop', e => e.hidden), true, 'Apply closes the filter box');
    assert.match(await p.textContent(host + ' .bc-date-label'), /05|5/);
    assert.deepEqual(p.__errors, []);
  } finally { await h.close(); }
});

test('V270.4.8.1 sweep: every register date filter (PC + phone sheet) and entry-window date fields', { timeout: 400000 }, async () => {
  const h = await startHarness({ appDir, playwright, executablePath: process.env.CHROMIUM_PATH });
  try {
    h.fs.load(SEED);
    const p = await h.newUser({ uid: 'u-boss', email: 'boss@x', name: 'Boss' });
    await h.open(p);
    const month = await p.evaluate(() => BCDate.today().slice(0, 8));
    const closeAll = () => p.evaluate(() => { document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m.id)); });
    const keys = await p.evaluate(() => [...document.querySelectorAll('[data-bc-date]')].map(x => x.dataset.bcDate));
    assert.ok(keys.length >= 10, 'all register date filters found: ' + keys.join(','));
    const done = [];
    // 1. PC: each register's date filter — From and To picked from the calendar, the box stays open, Apply closes it
    for (const k of keys) {
      const host = `[data-bc-date="${k}"]`;
      const page = await p.evaluate(h => (document.querySelector(h).closest('.page') || {}).id || '', host);
      await p.evaluate(pg => showPage(pg.replace(/^page-/, '')), page); await sleep(350);
      if (!(await p.isVisible(host + ' .bc-date-btn'))) { done.push(k + ':not-visible'); continue; }
      await p.click(host + ' .bc-date-btn'); await p.waitForSelector(host + ' .bc-date-pop:not([hidden])');
      for (const [cls, day] of [['.bc-date-from', '05'], ['.bc-date-to', '10']]) {
        await p.click(`${host} ${cls} + .bcd-btn`); await p.waitForSelector('.bcd-pop');
        await p.click(`.bcd-pop [data-iso="${month}${day}"]`); await sleep(120);
        assert.equal(await p.$('.bcd-pop'), null, k + ' calendar closes after a pick');
        assert.equal(await p.$eval(host + ' .bc-date-pop', e => e.hidden), false, k + ': filter box stays open after picking ' + cls);
        assert.equal(await p.$eval(`${host} ${cls}`, e => e.value), month + day, k + ' ' + cls + ' value');
      }
      // typing + Tab in the filter's own field also closes its calendar and keeps the box open
      await p.click(`${host} .bc-date-to + .bcd-btn`); await p.waitForSelector('.bcd-pop');
      await p.click(`${host} .bc-date-to`, { clickCount: 3 }); await p.keyboard.type(month.slice(8) + '12' + '/' + month.slice(5, 7) + '/' + month.slice(0, 4));
      await p.keyboard.press('Tab'); await sleep(120);
      assert.equal(await p.$('.bcd-pop'), null, k + ': Tab closes the calendar');
      assert.equal(await p.$eval(host + ' .bc-date-pop', e => e.hidden), false, k + ': filter box still open after Tab');
      await p.click(host + ' .bc-date-apply'); await sleep(150);
      assert.equal(await p.$eval(host + ' .bc-date-pop', e => e.hidden), true, k + ': Apply closes the box');
      await p.click(host + ' .bc-date-btn'); await p.click(host + ' .bc-date-clear'); await sleep(100);
      done.push(k);
    }
    assert.ok(done.filter(x => !x.includes(':')).length >= 8, 'filters checked: ' + done.join(', '));

    // 2. entry windows: open the calendar, type in the box, Tab → closed + kept; a click elsewhere also closes it
    const forms = [
      ['Sales Order', () => p.evaluate(() => openCreateSO('Q-1')), ['so-po-date', 'so-date', 'so-expected-delivery']],
      ['Receipt', () => p.evaluate(() => openNewReceipt()), ['rn-date']],
      ['Employee', () => p.evaluate(() => { showPage('masters'); switchMastersTab('employees'); openEmployeeForm(); }), ['emp-iqama-expiry', 'emp-passport-expiry', 'emp-license-expiry']],
    ];
    for (const [name, open, ids] of forms) {
      await open(); await sleep(500);
      for (const id of ids) {
        if (!(await p.isVisible('#' + id))) { done.push(name + ':' + id + ':hidden'); continue; }
        await p.click(`#${id} + .bcd-btn`); await p.waitForSelector('.bcd-pop');
        await p.click('#' + id, { clickCount: 3 }); await p.keyboard.type('13/10/2026'); await p.keyboard.press('Tab'); await sleep(120);
        assert.equal(await p.$('.bcd-pop'), null, name + ' ' + id + ': Tab closes the calendar');
        assert.equal(await p.evaluate(i => document.getElementById(i).value, id), '2026-10-13', name + ' ' + id);
        await p.click(`#${id} + .bcd-btn`); await p.waitForSelector('.bcd-pop');
        await p.evaluate(() => document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))); await sleep(120);
        assert.equal(await p.$('.bcd-pop'), null, name + ' ' + id + ': click elsewhere closes the calendar');
      }
      await closeAll(); await sleep(150);
      await p.evaluate(() => { const b = document.getElementById('confirm-ok') || document.querySelector('#app-confirm-overlay [data-act="discard"]'); }); // nothing to confirm
    }

    // 3. phone: the Filters sheet → Custom → From / To from the calendar sheet; the Filters sheet stays open
    await p.setViewportSize({ width: 390, height: 844 }); await sleep(300);
    for (const k of ['rfq', 'so', 'invreg']) {
      const host = `[data-bc-date="${k}"]`;
      const page = await p.evaluate(h => (document.querySelector(h).closest('.page') || {}).id || '', host);
      await p.evaluate(pg => showPage(pg.replace(/^page-/, '')), page); await sleep(400);
      const btn = await p.evaluate(pg => { const b = document.querySelector('#' + pg + ' .bc-mfilter'); if (b) b.id = '__mf'; return !!(b && b.offsetParent); }, page);
      if (!btn) { done.push(k + ':no-phone-filter'); continue; }
      await p.click('#__mf'); await p.waitForSelector('#bc-filter-sheet:not([hidden])'); await sleep(250);
      await p.click('#bc-filter-sheet [data-date="custom"]'); await sleep(150);
      for (const [attr, day] of [['data-from', '05'], ['data-to', '10']]) {
        await p.click(`#bc-filter-sheet [${attr}] + .bcd-btn`); await p.waitForSelector('.bcd-pop.bcd-sheet');
        await p.click(`.bcd-pop [data-iso="${month}${day}"]`); await sleep(200);
        assert.equal(await p.$eval('#bc-filter-sheet', e => e.hidden), false, k + ' phone: Filters sheet stays open after ' + attr);
        assert.equal(await p.$eval(`#bc-filter-sheet [${attr}]`, e => e.value), month + day);
      }
      await p.click('#bc-filter-sheet [data-act="apply-date"]'); await sleep(300);
      assert.equal(await p.$eval(host + ' .bc-date-from', e => e.value), month + '05', k + ' phone: range applied');
      await p.evaluate(() => { window.bcCloseSheets(); document.getElementById('__mf')?.removeAttribute('id'); }); await sleep(250);
      done.push(k + ':phone');
    }
    console.log('SWEEP', done.join(', '));
    assert.equal(done.filter(x => x.includes(':hidden') || x.includes(':not-visible') || x.includes(':no-phone')).length, 0, 'everything was reachable: ' + done.join(', '));
    assert.deepEqual(p.__errors, []);
  } finally { await h.close(); }
});
