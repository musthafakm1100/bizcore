/** BROWSER (simulator): V268.3 — Supplier Payments register (same look as Receipts), Pay advance, using an advance on an
 *  invoice, editing invoices (limited / full) and payments (limited / full), phone. Approved mockups PI_11 – PI_14. */
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
const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

const SO4 = { id: 'so4', soNo: 'SO-2610-0004', date: '2026-10-05', customer: 'SNC Lavalin Arabia', items: [
  { lineId: 'L1', origIdx: 0, desc: 'LED Panel 60x60', uom: 'Pcs', qty: 10, up: 160, amount: 1600 },
  { lineId: 'L2', origIdx: 1, desc: 'Cable 4 mm', uom: 'Roll', qty: 3, up: 70, amount: 210, code: 'CB4' },
  { lineId: 'L3', origIdx: 2, desc: 'Roco Printing Paper A4', uom: 'Box', qty: 10, up: 113.46, amount: 1134.6 },
], deliveries: [], invoices: [], payments: [], subtotal: 1810, vat: 271.5, total: 2081.5, created: '2026-10-05T08:00:00Z' };
const acc = (id, code, name, type, extra = {}) => ({ id, code, codeKey: code, name, nameKey: name.toLowerCase(), type, active: true, openingBalance: 0, openingDate: '2026-10-01',
  custodianName: type === 'cash' ? 'Shabeeb' : '', custodianUid: '', linkedBankAccountId: '', accountingClass: { nature: 'asset', group: 'current-assets', kind: type }, revision: 1, hasEntries: false, ...extra });


test('V268.3 supplier payments page, advances, edits', { timeout: 300000 }, async () => {
  const h = await startHarness({ appDir, playwright, executablePath: process.env.CHROMIUM_PATH });
  try {
    h.fs.load({
      'system/deliveryNoteStorage': { mode: 'independent', minClientVersion: 260 }, 'system/invoiceStorage': { mode: 'independent' }, 'system/accessControl': { adminUids: ['u-boss'] },
      'salesOrders/so4': SO4, 'suppliers/sup1': { id: 'sup1', company: 'ABC Trading Est', vat: '300000000000003' }, 'suppliers/sup2': { id: 'sup2', company: 'Blue Crystal' },
      'paymentAccounts/cash1': acc('cash1', '1111', 'Cash in Hand – Shabeeb', 'cash'),
      'paymentAccounts/bank1': acc('bank1', '1201', 'Al Rajhi – Current', 'bank'),
    });
    const aisha = await h.newUser({ uid: 'u-aisha', email: 'aisha@x', name: 'Aisha' });
    const boss = await h.newUser({ uid: 'u-boss', email: 'boss@x', name: 'Musthafa KM' });
    const phone = await h.newUser({ uid: 'u-boss', email: 'boss@x', name: 'Musthafa KM', device: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } });
    await icons(aisha); await icons(boss); await icons(phone);
    await h.open(aisha); await h.open(boss); await h.open(phone);
    const set = (p, sel, v) => p.evaluate(([s, v]) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, String(v)]);
    const pick = (p, sel, v) => p.evaluate(([s, v]) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, v]);
    const docs = prefix => Object.entries(h.fs.dump(prefix)).filter(([k]) => k.split('/').length === 2).map(([, d]) => d);

    // ── 1. the page: nav item, same look as Receipts (monitor, filter bar, date field, table, type sizes) ──
    assert.equal(await boss.evaluate(() => !!document.querySelector('.nav-item[data-nav-page="supplierpayments"]')), true);
    const look = key => boss.evaluate(([key]) => { const P = document.getElementById('page-' + key), o = {};
      for (const sel of ['aside.bc-monitor', '.dn-overview-head', '.dn-overview-head strong', '.dn-overview-head span', '.dn-overview-total span', '.dn-overview-total strong', '.dn-overview-section-label', '.dn-overview-row.dn-kpi', '.dn-overview-row.dn-kpi>span', '.dn-overview-row.dn-kpi>strong', '.dn-overview-row .dn-dot', '.bc-monitor-metric>span', '.bc-monitor-metric>strong', '.bc-filterbar', '.bc-filter-sort', '.bc-filter-count', '.bc-filter-customer', '.bc-filter-status', '.bc-date .bc-date-btn', '.bc-filter-search', '.register-clear-filters', '.bc-filter-new', 'table thead th', 'table tbody td']) {
        const e = P.querySelector(sel), cs = e && getComputedStyle(e); if (!e) { o[sel] = null; continue; }
        o[sel] = ['display', 'font-size', 'font-weight', 'font-family', 'line-height', 'padding', 'color', 'background-color', 'border-radius'].map(k => k + ':' + cs.getPropertyValue(k)).join(';') + (/^(td|th)|table/.test(sel) ? '' : ';h:' + Math.round(e.getBoundingClientRect().height)) + (['aside.bc-monitor', '.dn-overview-head', '.dn-overview-row.dn-kpi'].includes(sel) ? ';w:' + Math.round(e.getBoundingClientRect().width) : ''); }
      return o; }, [key]);
    await boss.evaluate(() => showPage('receipts')); await sleep(500); const rct = await look('receipts');
    await boss.evaluate(() => showPage('supplierpayments')); await sleep(500); const sp = await look('supplierpayments');
    rct['aside.bc-monitor'] = rct['aside.bc-monitor'].replace(/;h:\d+/, ''); sp['aside.bc-monitor'] = sp['aside.bc-monitor'].replace(/;h:\d+/, '');   // different number of rows
    for (const o of [rct, sp]) o['.dn-overview-row .dn-dot'] = o['.dn-overview-row .dn-dot'].replace(/background-color:[^;]+;/, '');   // the first type has its own colour
    // V268.5: the supplier filter is a type-and-search picker (approved mockup V5_1) — same size, font, border and colour as the Receipts customer filter
    delete rct['.bc-filter-customer']; delete sp['.bc-filter-customer'];
    for (const k of Object.keys(rct)) assert.equal(sp[k], rct[k], 'same look as Receipts: ' + k);
    const fbox = (key, boxSel, txtSel) => boss.evaluate(([key, boxSel, txtSel]) => { showPage(key); const P = document.getElementById('page-' + key), b = P.querySelector(boxSel), t = P.querySelector(txtSel), cb = getComputedStyle(b), ct = getComputedStyle(t);
      return ['h:' + Math.round(b.getBoundingClientRect().height), cb.borderRadius, cb.backgroundColor, cb.borderTopColor, ct.fontSize, ct.fontWeight, ct.fontFamily].join(';'); }, [key, boxSel, txtSel]);
    assert.equal(await fbox('supplierpayments', '#spreg-supplier-pk .rct-pick-search', '#spreg-supplier-q'), await fbox('receipts', '.bc-filter-customer', '.bc-filter-customer'), 'supplier filter looks like the Receipts customer filter');
    assert.match(await boss.textContent('#spreg-body'), /No supplier payments found/);

    // ── 2. Pay advance 500 (bank) to ABC for SO-2610-0004 ──
    await aisha.evaluate(() => showPage('supplierpayments')); await sleep(300);
    await aisha.click('#sp-new-btn'); await aisha.waitForSelector('#sp-adv-modal.open');
    assert.equal(await aisha.isDisabled('#spa-save'), true);
    // V268.5: type-and-search pickers (approved mockup V5_1)
    assert.equal(await aisha.isVisible('#spa-sup-list'), false, 'no list until the field is clicked');
    await aisha.click('#spa-sup-q'); await sleep(60);
    const fits = await aisha.evaluate(() => { const r = document.getElementById('spa-sup-list').getBoundingClientRect(); return r.bottom <= window.innerHeight && r.top >= 0; });
    assert.equal(fits, true, 'the list fits in the window');
    await aisha.fill('#spa-sup-q', 'abc'); await sleep(80);
    assert.match(await aisha.textContent('#spa-sup-list'), /ABC Trading Est/); assert.doesNotMatch(await aisha.textContent('#spa-sup-list'), /Blue Crystal/);
    await aisha.press('#spa-sup-q', 'Enter'); await sleep(80);
    assert.equal(await aisha.inputValue('#spa-sup'), 'sup1'); assert.match(await aisha.textContent('#spa-sup-chosen'), /ABC Trading Est/);
    await aisha.fill('#spa-so-q', 'snc 0004'); await sleep(80);
    assert.match(await aisha.textContent('#spa-so-list'), /SO-2610-0004 · SNC Lavalin Arabia/);
    await aisha.keyboard.press('Enter'); await sleep(80);
    assert.equal(await aisha.inputValue('#spa-so'), 'so4');
    await sleep(200); await shot(aisha, 'V2685_pay_advance_picker');
    await pick(aisha, '#spa-lines .pi-pay-acc', 'bank1'); await sleep(60);
    await set(aisha, '#spa-lines .pi-pay-amt', '500'); await set(aisha, '#spa-lines .pi-pay-ref', 'TRF 55120');
    assert.match(await aisha.textContent('#spa-info'), /stays open for ABC Trading Est \(500\.00\)/);
    await sleep(300); await shot(aisha, 'V2683_pay_advance');
    await aisha.click('#spa-save'); await sleep(900);
    assert.equal(await aisha.evaluate(() => isModalOpen('sp-adv-modal')), false, await aisha.textContent('#spa-error'));
    const adv = docs('supplierPayments/').find(p => p.kind === 'advance');
    assert.deepEqual([adv.amount, adv.advanceLeft, adv.soNo, adv.supplierName], [500, 500, 'SO-2610-0004', 'ABC Trading Est']);
    assert.ok(docs('cashLines/').some(l => l.kind === 'supplier-advance' && l.accountId === 'bank1' && l.amountOut === 500));
    await sleep(300);
    assert.match(await aisha.textContent('#spreg-body'), /Advance[\s\S]*SO-2610-0004[\s\S]*1201 · Al Rajhi – Current[\s\S]*500\.00[\s\S]*500\.00 left/);
    assert.equal(await aisha.textContent('#spreg-k-open'), '1');

    // ── 3. the invoice of ABC: banner, Use advances, the rest in cash ──
    await aisha.evaluate(() => { showPage('purchaseinvoices'); openNewPurchaseInvoice(); }); await aisha.waitForSelector('#pi-new-modal.open');
    await set(aisha, '#pe-supplier', 'sup1'); await set(aisha, '#pe-invno', 'INV-9001'); await set(aisha, '#pe-date', today());
    await aisha.evaluate(() => { piOpenPicker(); piPickToggle('so4|L1', true); piPickAdd(); }); await sleep(150);
    await set(aisha, '#pe-lines tr[data-i="0"] input[aria-label="Unit cost"]', '120'); await set(aisha, '#pe-suptotal', '1380'); await sleep(100);
    assert.match(await aisha.textContent('#pe-adv'), /ABC Trading Est has 1 open advance: 500\.00/);
    await aisha.click('#pe-use-adv'); await sleep(150);
    assert.match(await aisha.textContent('#pe-pay tr[data-p="0"]'), /From the advance — no money moves now · nothing left/);
    assert.equal(await aisha.inputValue('#pe-pay tr[data-p="0"] .pi-pay-amt'), '500.00');
    await aisha.click('#pe-add-pay'); await sleep(100);
    await pick(aisha, '#pe-pay tr[data-p="1"] .pi-pay-acc', 'cash1'); await sleep(60); await set(aisha, '#pe-pay tr[data-p="1"] .pi-pay-amt', '200');
    assert.match(await aisha.textContent('#pe-summary'), /Paid now[\s\S]*700\.00[\s\S]*Balance to pay later\s*680\.00/);
    await sleep(300); await shot(aisha, 'V2683_use_advance');
    await aisha.click('#pe-save'); await sleep(1000);
    assert.equal(await aisha.evaluate(() => isModalOpen('pi-new-modal')), false, await aisha.textContent('#pe-error'));
    let pi = docs('purchaseInvoices/')[0];
    assert.deepEqual([pi.paid, pi.balance, pi.payStatus], [700, 680, 'Part paid']);
    assert.deepEqual([h.fs.peek('supplierPayments/' + adv.id).advanceUsed, h.fs.peek('supplierPayments/' + adv.id).advanceLeft], [500, 0]);
    const pay = docs('supplierPayments/').find(p => p.kind === 'payment');
    assert.deepEqual([pay.amount, pay.advanceTotal], [700, 500]);
    assert.ok(docs('cashLines/').some(l => l.entryId === pay.entryId && l.accountId === 'cash1' && l.amountOut === 200), 'only the cash moves');
    await aisha.evaluate(() => showPage('supplierpayments')); await sleep(400);
    assert.match(await aisha.textContent(`#spreg-body tr[data-sp="${adv.id}"]`), /Fully used[\s\S]*500\.00 used · PI-/);
    assert.match(await aisha.textContent(`#spreg-body tr[data-sp="${pay.id}"]`), /Payment[\s\S]*PI-[\s\S]*1111 · Cash in Hand – Shabeeb \+1[\s\S]*700\.00[\s\S]*Shabeeb/);
    await shot(aisha, 'V2683_register');
    // the advance view lists where it was used; it can't be cancelled while used
    await aisha.evaluate(id => openSupplierPaymentView(id), adv.id); await aisha.waitForSelector('#sp-view-modal.open');
    assert.match(await aisha.textContent('#sp-view-modal'), /Used on invoices[\s\S]*PI-[\s\S]*500\.00/);
    await aisha.evaluate(id => piAskCancelPay(id), adv.id); await sleep(200);
    assert.equal(await aisha.evaluate(() => isModalOpen('pi-pay-modal')), false, 'a used advance is not offered for cancelling');
    await aisha.evaluate(() => closeModal('sp-view-modal'));

    // ── 4. limited edit of the payment (staff): the reference ──
    await aisha.evaluate(id => openSupplierPaymentView(id), pay.id); await aisha.waitForSelector('#sp-view-modal.open');
    await aisha.click('#spv-edit'); await aisha.waitForSelector('#sp-edit-modal.open');
    assert.match(await aisha.textContent('#sp-edit-modal'), /Limited edit/);
    await set(aisha, '#sp-edit-modal .spe-ref[data-i="1"]', 'Voucher 77'); await set(aisha, '#spe-why', 'voucher no. missing');
    await aisha.click('#spe-save'); await sleep(800);
    assert.equal(await aisha.evaluate(() => isModalOpen('sp-edit-modal')), false, await aisha.textContent('#spe-err'));
    assert.equal(h.fs.peek('supplierPayments/' + pay.id).lines[1].reference, 'Voucher 77');
    assert.equal(h.fs.peek('supplierPayments/' + pay.id).amount, 700);
    await aisha.evaluate(() => closeModal('sp-view-modal'));

    // ── 5. limited edit of the invoice (it has payments): invoice no. and due date ──
    await boss.evaluate(id => { showPage('purchaseinvoices'); openPurchaseInvoiceView(id); }, pi.id); await boss.waitForSelector('#pi-view-modal.open'); await sleep(300);
    await boss.click('#pv-edit'); await boss.waitForSelector('#pi-edit-modal.open');
    assert.match(await boss.textContent('#pi-edit-modal'), /Limited edit — this invoice has payments/);
    await set(boss, '#pie-inv', 'INV-9001A'); await set(boss, '#pie-why', 'letter missing');
    await sleep(200); await shot(boss, 'V2683_edit_invoice_limited');
    await boss.click('#pie-save'); await sleep(800);
    assert.equal(await boss.evaluate(() => isModalOpen('pi-edit-modal')), false, await boss.textContent('#pie-err'));
    pi = docs('purchaseInvoices/')[0];
    assert.deepEqual([pi.supplierInvoiceNo, pi.lastEditReason, pi.totals.total], ['INV-9001A', 'letter missing', 1380]);
    await sleep(300);
    assert.match(await boss.textContent('#pi-view-modal'), /Changed by Musthafa KM[\s\S]*letter missing/);
    await boss.evaluate(() => closeModal('pi-view-modal'));

    // ── 6. full edit (administrator) of an unpaid invoice: the entry screen, 3 rolls instead of 5 ──
    await boss.evaluate(() => { showPage('purchaseinvoices'); openNewPurchaseInvoice(); }); await boss.waitForSelector('#pi-new-modal.open');
    await set(boss, '#pe-supplier', 'sup2'); await set(boss, '#pe-invno', 'BC-1'); await set(boss, '#pe-date', today());
    await boss.evaluate(() => { piOpenPicker(); piPickToggle('so4|L2', true); piPickAdd(); }); await sleep(150);
    await set(boss, '#pe-lines tr[data-i="0"] input[aria-label="Unit cost"]', '50'); await set(boss, '#pe-suptotal', '172.50'); await sleep(100);
    await boss.click('#pe-save'); await sleep(900);
    let pi2 = docs('purchaseInvoices/').find(p => p.supplierInvoiceNo === 'BC-1');
    assert.equal(h.fs.peek('salesOrderPurchasing/so4').lines.L2.purchased, 3);
    await boss.evaluate(id => { openPurchaseInvoiceView(id); }, pi2.id); await boss.waitForSelector('#pi-view-modal.open'); await sleep(200);
    await boss.click('#pv-edit'); await sleep(600);
    assert.equal(await boss.evaluate(() => isModalOpen('pi-new-modal')), true, 'full edit uses the invoice screen');
    assert.equal(await boss.evaluate(() => { const v = document.getElementById('pi-view-modal'), n = document.getElementById('pi-new-modal'); return !!(v.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING); }), true, 'the edit screen is in front of the invoice view');
    assert.match(await boss.textContent('#pe-title'), new RegExp('Edit ' + pi2.piNo));
    assert.match(await boss.textContent('#pe-lines tr[data-i="0"]'), /Of 3 to buy\s*Complete/, 'its own quantities count as still to buy');
    await set(boss, '#pe-lines tr[data-i="0"] input[aria-label="Qty bought"]', '2'); await set(boss, '#pe-suptotal', '115'); await sleep(100);
    await boss.click('#pe-save'); await sleep(300);
    assert.match(await boss.textContent('#pe-error'), /reason for the change/);
    await set(boss, '#pe-edit-why', 'only 2 rolls came');
    await sleep(200); await shot(boss, 'V2683_edit_invoice_full');
    await boss.click('#pe-save'); await sleep(900);
    assert.equal(await boss.evaluate(() => isModalOpen('pi-new-modal')), false, await boss.textContent('#pe-error'));
    pi2 = docs('purchaseInvoices/').find(p => p.id === pi2.id);
    assert.deepEqual([pi2.piNo, pi2.totals.total, pi2.revision, pi2.lines[0].qty], [pi2.piNo, 115, 2, 2]);
    assert.equal(h.fs.peek('salesOrderPurchasing/so4').lines.L2.purchased, 2);
    await boss.evaluate(() => closeModal('pi-view-modal'));

    // ── 7. full edit of a payment (administrator): bank payment 100 → 90 ──
    await boss.evaluate(id => { openPurchaseInvoiceView(id); }, pi2.id); await boss.waitForSelector('#pi-view-modal.open'); await sleep(200);
    await boss.click('#pv-pay'); await boss.waitForSelector('#pi-pay-modal.open');
    await pick(boss, '#pm-lines .pi-pay-acc', 'bank1'); await sleep(60); await set(boss, '#pm-lines .pi-pay-amt', '100');
    await boss.click('#pm-save'); await sleep(900);
    const bp = docs('supplierPayments/').find(p => p.invoiceId === pi2.id);
    await boss.evaluate(id => spEditPaymentClick(id), bp.id); await boss.waitForSelector('#sp-edit-modal.open');
    assert.match(await boss.textContent('#sp-edit-modal'), /Full edit \(administrator\)/);
    await set(boss, '#spe-lines .pi-pay-amt', '90');
    assert.match(await boss.textContent('#spe-after'), /100\.00 → 90\.00[\s\S]*balance becomes 25\.00[\s\S]*Part paid/);
    await set(boss, '#spe-why', 'bank slip says 90');
    await sleep(200); await shot(boss, 'V2683_edit_payment_full');
    await boss.click('#spe-save'); await sleep(900);
    assert.equal(await boss.evaluate(() => isModalOpen('sp-edit-modal')), false, await boss.textContent('#spe-err'));
    assert.deepEqual([docs('purchaseInvoices/').find(p => p.id === pi2.id).paid, h.fs.peek('supplierPayments/' + bp.id).amount], [90, 90]);
    assert.equal(h.fs.peek('cashEntries/' + bp.entryId).void, true, 'the old Cash & Bank entry is cancelled');
    await boss.evaluate(() => closeModal('pi-view-modal'));

    // ── 8. Administration → Purchase Settings: edit settings ──
    await boss.evaluate(() => renderPurchaseSettings());   // Administration → Purchase Settings (form rendered in place)
    assert.equal(await boss.inputValue('#ps-edit'), 'limited-admin'); assert.equal(await boss.inputValue('#ps-edit-days'), '7');
    await pick(boss, '#ps-edit', 'limited'); await set(boss, '#ps-edit-days', '3');
    await boss.evaluate(() => document.getElementById('ps-save').click()); await sleep(700);
    assert.deepEqual([h.fs.peek('settings/purchasing').editMode, h.fs.peek('settings/purchasing').editDays], ['limited', 3]);

    // ── 9. phone: cards, no sideways scroll ──
    await phone.evaluate(() => showPage('supplierpayments')); await sleep(600);
    assert.equal(await phone.evaluate(() => getComputedStyle(document.querySelector('#page-supplierpayments aside.bc-monitor')).display), 'none', 'monitor folded into chips');
    assert.ok(await phone.locator('#spreg-cards .sp-card').count() >= 3);
    assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true, 'no sideways scroll');
    await shot(phone, 'V2683_register_phone');
    // the Pay advance and payment view screens fit the phone
    await phone.evaluate(() => openPayAdvance()); await phone.waitForSelector('#sp-adv-modal.open'); await sleep(300);
    assert.equal(await phone.evaluate(() => { const b = document.querySelector('#sp-adv-modal .modal-body'); return b.scrollWidth <= b.clientWidth + 1; }), true, 'Pay advance: no sideways scroll');
    await shot(phone, 'V2683_pay_advance_phone');
    await phone.evaluate(() => closeModal('sp-adv-modal'));
    await phone.evaluate(id => openSupplierPaymentView(id), adv.id); await phone.waitForSelector('#sp-view-modal.open'); await sleep(300);
    assert.equal(await phone.evaluate(() => { const b = document.querySelector('#sp-view-modal .modal-body'); return b.scrollWidth <= b.clientWidth + 1; }), true, 'payment view: no sideways scroll');
    await shot(phone, 'V2683_payment_view_phone');
    await phone.evaluate(() => closeModal('sp-view-modal'));
    for (const p of [aisha, boss, phone]) assert.deepEqual(p.__errors, [], 'no page errors');
  } finally { await h.close(); }
});
