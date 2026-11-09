/** BROWSER (simulator): V266 Payment Receipts — register, New Receipt (auto-apply, partial, unapplied),
 *  receipt view + print, invoice Paid / Balance, Apply later, Void, settings & permissions, phone layout. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { startHarness } from './harness.mjs';

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const playwright = createRequire(process.env.PLAYWRIGHT_FROM || import.meta.url)('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const inv = (id, invNo, total, day, extra = {}) => ({ id, invNo, schemaVersion: 1, type: 'delivery', salesOrderId: 'SO-1', soNo: 'SO-2610-0001', customer: 'Al Noor', custId: 'C1',
  date: `2026-10-0${day}`, dueDate: extra.dueDate || '', zohoNo: 'ZB-' + id, totals: { goodsSubtotal: total / 1.15, subtotal: total / 1.15, vat: total - total / 1.15, total },
  lines: [], deductions: [], credited: {}, creditNotes: [], status: 'Issued', revision: 1, created: `2026-10-0${day}T08:00:00Z`, createdBy: 'Boss' });

test('V266 payment receipts: record, view, invoice balances, apply later, void, settings, phone', { timeout: 240000 }, async () => {
  const h = await startHarness({ appDir, playwright, executablePath: process.env.CHROMIUM_PATH });
  try {
    h.fs.load({
      'system/deliveryNoteStorage': { mode: 'independent', minClientVersion: 260 },
      'system/invoiceStorage': { mode: 'independent' },
      'system/accessControl': { adminUids: ['u-boss'] },
      'customers/C1': { id: 'C1', company: 'Al Noor', city: 'Riyadh', vat: '300000000000003' },
      'customers/C2': { id: 'C2', company: 'Other Co' },
      'customerInvoices/I1': inv('I1', 'INV-2610-0001', 1150, 1, { dueDate: '2026-10-05' }),
      'customerInvoices/I2': inv('I2', 'INV-2610-0002', 2300, 2),
      'customerInvoices/I3': inv('I3', 'INV-2610-0003', 575, 3),
    });
    const boss = await h.newUser({ uid: 'u-boss', email: 'boss@x', name: 'Boss' });
    const alice = await h.newUser({ uid: 'u-alice', email: 'alice@x', name: 'Alice' });
    await h.open(boss); await h.open(alice);
    await boss.setViewportSize({ width: 1600, height: 1000 });
    const set = (p, sel, v) => p.evaluate(([s, v]) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, String(v)]);
    const closeAll = p => p.evaluate(() => { document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m.id)); });
    const receipts = () => Object.entries(h.fs.dump('customerReceipts/')).filter(([k]) => k.split('/').length === 2).map(([, d]) => d).sort((a, b) => a.rctNo.localeCompare(b.rctNo));
    const paid = id => (h.fs.peek('invoicePayments/' + id) || { paid: 0 }).paid;
    const shot = async (p, name) => { if (process.env.SHOTS) await p.screenshot({ path: `${process.env.SHOTS}/rct-${name}.png` }); };

    // 1. Register (empty) + monitor figures from the open invoices
    await boss.evaluate(() => showPage('receipts')); await sleep(500);
    assert.equal(await boss.textContent('#rctreg-k-total'), '0');
    assert.equal(await boss.textContent('#rctreg-a-receivable'), '4,025.00');
    // V271.5: the old vertical .bc-monitor panel was replaced by the Phase5a horizontal monitor strip
    assert.ok(await boss.isVisible('#receipts-main-workspace .bc5-strip'));

    // 2. New Receipt: customer → open invoices oldest first; amount auto-applies (oldest first, last one partly)
    await boss.click('#rct-new-btn'); await boss.waitForSelector('#rct-new-modal.open');
    assert.equal(await boss.isDisabled('#rn-save'), true);
    assert.match(await boss.textContent('#rn-ready'), /Choose the customer[\s\S]*amount received[\s\S]*Zoho payment no/);
    // V266.1 customer picker: list opens on focus, customers with open invoices first, type to filter, Enter picks
    await sleep(200); assert.equal(await boss.isVisible('#rn-cust-list'), false, 'list closed until the user clicks');
    await boss.click('#rn-cust-q'); await sleep(150);
    assert.match(await boss.textContent('#rn-cust-list'), /With open invoices · 1[\s\S]*Al Noor[\s\S]*3 open invoices[\s\S]*4,025\.00[\s\S]*Other customers · 1[\s\S]*Other Co/);
    assert.ok(await boss.isVisible('#rn-cust-list .rct-pick-opt .rct-due.overdue'), 'overdue marked');
    await shot(boss, 'picker-open');
    await boss.fill('#rn-cust-q', 'noor'); await sleep(100);
    assert.equal(await boss.$$eval('#rn-cust-list .rct-pick-opt', o => o.length), 1);
    await boss.keyboard.press('Enter'); await sleep(200);
    assert.equal(await boss.inputValue('#rn-cust'), 'id:C1');
    assert.ok(await boss.isVisible('#rn-chosen')); assert.equal(await boss.isVisible('#rn-pick-search'), false, 'search box replaced by the chosen customer'); assert.match(await boss.textContent('#rn-chosen'), /Al Noor[\s\S]*3 open · 4,025\.00 due[\s\S]*Change/);
    await shot(boss, 'picker-chosen');
    assert.deepEqual(await boss.$$eval('#rn-invoices .rct-inv-row', r => r.map(x => x.dataset.inv)), ['I1', 'I2', 'I3']);
    await set(boss, '#rn-amount', 2000); await sleep(150);
    await boss.focus('#rn-amount'); await boss.focus('#rn-ref'); assert.equal(await boss.inputValue('#rn-amount'), '2,000.00', 'thousands separator after leaving the field');
    assert.equal(await boss.evaluate(() => getComputedStyle(document.getElementById('rn-amount')).textAlign), 'right');
    assert.deepEqual(await boss.$$eval('#rn-invoices .rct-apply-input', r => r.map(x => x.value)), ['1150.00', '850.00', '']);
    assert.match(await boss.textContent('#rn-summary'), /Applied to 2 invoices\s*2,000\.00[\s\S]*INV-2610-0002 stays Partially paid \(1,450\.00 due\)/);
    // more money: still auto-applied while untouched (I3 gets the 550 left); untick / tick I3 → what is left
    await set(boss, '#rn-amount', 4000); await sleep(100);
    assert.deepEqual(await boss.$$eval('#rn-invoices .rct-apply-input', r => r.map(x => x.value)), ['1150.00', '2300.00', '550.00']);
    await boss.click('#rn-invoices .rct-inv-row[data-inv="I3"] input[type=checkbox]');
    assert.equal(await boss.inputValue('#rn-invoices .rct-inv-row[data-inv="I3"] .rct-apply-input'), '');
    await boss.click('#rn-invoices .rct-inv-row[data-inv="I3"] input[type=checkbox]');
    assert.equal(await boss.inputValue('#rn-invoices .rct-inv-row[data-inv="I3"] .rct-apply-input'), '550.00');
    assert.match(await boss.textContent('#rn-invoices .rct-inv-row[data-inv="I3"]'), /part · 25\.00 left/);
    await set(boss, '#rn-invoices .rct-inv-row[data-inv="I3"] .rct-apply-input', 700); await sleep(100);
    assert.match(await boss.textContent('#rn-ready'), /Reduce INV-2610-0003 to its balance due/);
    await set(boss, '#rn-invoices .rct-inv-row[data-inv="I3"] .rct-apply-input', 0);
    await set(boss, '#rn-invoices .rct-inv-row[data-inv="I2"] .rct-apply-input', 2000); await sleep(100);
    // 1150 + 2000 = 3150 applied of 4000 → 850 unapplied (allowed)
    assert.match(await boss.textContent('#rn-summary'), /Unapplied \(on account\)\s*850\.00/);
    await set(boss, '#rn-zoho', 'PMT-00231'); await set(boss, '#rn-ref', 'SNB 88213471');
    // our bank kept 15.00 (the customer paid 4,000 in full)
    await set(boss, '#rn-charges', 4000); await sleep(100);
    assert.match(await boss.textContent('#rn-ready'), /Bank charges must be less than the amount received/);
    await set(boss, '#rn-charges', 15); await sleep(100);
    assert.match(await boss.textContent('#rn-summary'), /Bank charges\s*− 15\.00\s*Reached the bank\s*3,985\.00/);
    assert.match(await boss.textContent('#rn-charges-hint'), /Reached the bank: 3,985\.00/);
    assert.equal(await boss.isDisabled('#rn-save'), false);
    await shot(boss, 'new');
    await boss.click('#rn-save'); await boss.waitForSelector('#app-confirm-overlay');
    assert.match(await boss.textContent('#app-confirm-overlay'), /Al Noor[\s\S]*PMT-00231[\s\S]*INV-2610-0001 1,150\.00[\s\S]*850\.00[\s\S]*4,000\.00/);
    await boss.click('#confirm-ok'); await sleep(1500);
    let R = receipts();
    assert.equal(R.length, 1); assert.equal(R[0].rctNo.slice(0, 4), 'RCT-'); assert.match(R[0].rctNo, /^RCT-\d{4}-0001$/);
    assert.deepEqual([R[0].amount, R[0].applied, R[0].unapplied, R[0].bankCharges], [4000, 3150, 850, 15]);
    assert.deepEqual([paid('I1'), paid('I2'), paid('I3')], [1150, 2000, 0]);
    // 3. The saved receipt opens in the document view (A4 + panel), green accent
    await boss.waitForSelector('#inv-view-modal.open .rct-a4');
    assert.match(await boss.textContent('#inv-view-title'), /RCT-\d{4}-0001 — Payment Receipt/);
    assert.match(await boss.textContent('#inv-view-body .rct-a4'), /PAYMENT RECEIPT[\s\S]*Al Noor[\s\S]*INV-2610-0001[\s\S]*Received on account[\s\S]*4,000\.00[\s\S]*Four thousand Saudi Riyals only/);
    assert.match(await boss.textContent('#inv-view-body .inv-view-panel'), /Received\s*4,000\.00[\s\S]*Unapplied\s*850\.00[\s\S]*Bank charges\s*15\.00[\s\S]*Reached the bank\s*3,985\.00/);
    assert.match(await boss.textContent('#inv-view-body .rct-a4 .rct-charges'), /Less: bank charges\s*− 15\.00\s*Net deposited to bank\s*3,985\.00/);
    assert.ok(await boss.isVisible('#rct-view-apply-btn')); assert.ok(await boss.isVisible('#rct-view-void-btn'));
    await shot(boss, 'view');
    await boss.click('#rct-view-print-btn');
    assert.match(await boss.evaluate(() => window.__popups.at(-1).document.html), /PAYMENT RECEIPT[\s\S]*window\.print/);
    // duplicate Zoho payment no. is refused on the screen
    await closeAll(boss);
    await boss.evaluate(() => openNewReceipt()); await boss.waitForSelector('#rct-new-modal.open');
    await boss.click('#rn-cust-q'); await boss.click('#rn-cust-list .rct-pick-opt[data-key="id:C1"]'); await set(boss, '#rn-amount', 10); await set(boss, '#rn-zoho', 'pmt-00231'); await sleep(100);
    assert.match(await boss.textContent('#rn-ready'), /already used on RCT-/); assert.equal(await boss.isDisabled('#rn-save'), true);
    await closeAll(boss);

    // 4. Register row; invoice register Paid / Balance and payment rows; invoice view panel
    await boss.evaluate(() => showPage('receipts')); await sleep(400);
    assert.match(await boss.textContent('#rctreg-body'), /RCT-\d{4}-0001[\s\S]*Al Noor[\s\S]*PMT-00231[\s\S]*INV-2610-0001[\s\S]*850\.00 unapplied[\s\S]*4,000\.00[\s\S]*Posted/);
    assert.equal(await boss.textContent('#rctreg-k-unapplied'), '1');
    assert.match(await boss.textContent('#rctreg-body'), /15\.00 bank charges/); assert.equal(await boss.textContent('#rctreg-a-charges'), '15.00');
    assert.equal(await boss.textContent('#receipts-badge'), '1');
    await boss.evaluate(() => showPage('customerinvoices')); await sleep(400);
    // V271.5: the old vertical #invreg-pay-section panel was replaced by the Phase5a horizontal monitor strip;
    // the KPI count elements below live inside its cards now (same ids, same values).
    assert.equal(await boss.isVisible('#customerinvoices-main-workspace .bc5-strip'), true);
    assert.equal(await boss.textContent('#invreg-k-pay-paid'), '1');
    assert.equal(await boss.textContent('#invreg-k-pay-partial'), '1');
    assert.equal(await boss.textContent('#invreg-k-pay-unpaid'), '1');
    await boss.evaluate(() => filterInvoiceKPI('pay-partial')); await sleep(100);
    assert.match(await boss.textContent('#invreg-body'), /INV-2610-0002[\s\S]*2,300\.00\s*2,000\.00\s*300\.00[\s\S]*Partially paid/);
    await boss.evaluate(() => openInvoiceView('I2')); await sleep(400);
    assert.match(await boss.textContent('#inv-view-body .inv-view-panel'), /Paid\s*2,000\.00[\s\S]*Balance due\s*300\.00[\s\S]*Partially paid/);
    assert.match(await boss.textContent('#inv-view-body .inv-view-panel'), /RCT-\d{4}-0001/);
    assert.ok(await boss.isVisible('#inv-view-receipt-btn'));
    await closeAll(boss);

    // 5. Alice (not admin): may record (default all users) but not void (default administrators)
    await alice.evaluate(() => openReceiptView(receiptsCache[0].id)); await sleep(400);
    assert.equal(await alice.isVisible('#rct-view-void-btn'), false);
    assert.ok(await alice.isVisible('#rct-view-apply-btn'));
    // Apply the 850 later: 300 to INV-0002 (settles it), 550 to INV-0003
    await alice.click('#rct-view-apply-btn'); await alice.waitForSelector('#rct-apply-modal.open');
    await alice.click('#rct-apply-modal .modal-footer .btn-secondary.btn-sm'); await sleep(100);
    assert.match(await alice.textContent('#ra-sum'), /Applying 850\.00 of 850\.00/);
    await alice.click('#ra-save'); await sleep(1500);
    R = receipts();
    assert.deepEqual([R[0].applied, R[0].unapplied, R[0].revision], [4000, 0, 2]);
    assert.deepEqual([paid('I1'), paid('I2'), paid('I3')], [1150, 2300, 550]);
    await closeAll(alice);

    // 6. Boss voids: reason required; amounts go back to the invoices; number kept
    await boss.evaluate(() => openReceiptView(receiptsCache[0].id)); await sleep(500);
    await boss.click('#rct-view-void-btn'); await boss.waitForSelector('#rct-void-modal.open');
    assert.equal(await boss.isDisabled('#rv-save'), true);
    await set(boss, '#rv-reason', 'Cheque bounced'); await boss.click('#rv-save'); await sleep(1500);
    R = receipts();
    assert.equal(R[0].status, 'Voided'); assert.equal(R[0].voidReason, 'Cheque bounced');
    assert.deepEqual([paid('I1'), paid('I2'), paid('I3')], [0, 0, 0]);
    assert.match(await boss.textContent('#inv-view-body .rct-a4'), /VOID[\s\S]*Cheque bounced/);
    assert.equal(await boss.isVisible('#rct-view-void-btn'), false);
    await closeAll(boss);

    // 7. Settings (administrator): Zoho optional, accounts list; V270.4.3: who records = the role's Receipt Create
    await boss.evaluate(() => { showPage('setup'); switchSetupTab('billing'); }); await sleep(400);
    await boss.selectOption('#rs-zoho', 'optional');
    await boss.fill('#rs-accounts', 'SNB Current\nCash box'); await boss.click('#rs-save'); await sleep(1200);
    assert.deepEqual(h.fs.peek('settings/receipts').accounts, ['SNB Current', 'Cash box']);
    assert.equal(h.fs.peek('settings/receipts').zohoPaymentNo, 'optional');
    await boss.evaluate(() => switchSetupTab('roles')); await sleep(400);
    await boss.click('[data-ur="role-pick"][data-role="r-test-staff"]'); await sleep(200);
    await boss.click('[data-ur="perm"][data-mod="receipt"][data-act="c"]'); await sleep(100);
    await boss.click('[data-ur="role-save"]'); await boss.waitForSelector('#confirm-ok'); await boss.click('#confirm-ok'); await sleep(800);
    await h.open(alice); await sleep(800);
    await alice.evaluate(() => { window.__toasts = []; showPage('receipts'); }); await sleep(400);
    assert.equal(await alice.evaluate(() => { const b = document.getElementById('rct-new-btn'); return !b || b.disabled || b.offsetParent === null; }), true, 'recording needs Receipt Create');
    await alice.evaluate(() => { showPage('setup'); switchSetupTab('billing'); }); await sleep(300);
    assert.equal(await alice.isDisabled('#rs-zoho'), true);
    // Boss: account is now mandatory, Zoho optional; a receipt with no invoices stays fully unapplied
    await boss.evaluate(() => openNewReceipt()); await boss.waitForSelector('#rct-new-modal.open');
    await boss.fill('#rn-cust-q', 'other'); await sleep(100); await boss.click('#rn-cust-list .rct-pick-opt[data-key="id:C2"]'); await set(boss, '#rn-amount', 500); await sleep(100);
    assert.match(await boss.textContent('#rn-invoices'), /no open invoices/);
    assert.match(await boss.textContent('#rn-ready'), /Choose the account/);
    await boss.selectOption('#rn-account', 'Cash box'); await set(boss, '#rn-method', 'Cash'); await sleep(100);
    assert.equal(await boss.isDisabled('#rn-save'), false);
    await boss.click('#rn-save'); await boss.waitForSelector('#app-confirm-overlay'); await boss.click('#confirm-ok'); await sleep(1500);
    R = receipts();
    assert.equal(R.length, 2); assert.deepEqual([R[1].customer, R[1].account, R[1].unapplied, R[1].zohoPaymentNo], ['Other Co', 'Cash box', 500, '']);
    await closeAll(boss);

    // 8. Phone: register as cards; V266.7: New Receipt is the + in the one-line toolbar (no floating button); entry screen in one column, Save at the bottom
    await boss.setViewportSize({ width: 390, height: 844 });
    await boss.evaluate(() => showPage('receipts')); await sleep(400);
    assert.equal(await boss.isVisible('#rctreg-table'), false);
    assert.equal(await boss.$$eval('#rctreg-cards .rct-card', c => c.length), 2);
    assert.equal(await boss.isVisible('.rct-fab'), false); assert.ok(await boss.isVisible('#rct-new-btn'));
    await shot(boss, 'phone-register');
    await boss.click('#rct-new-btn'); await boss.waitForSelector('#rct-new-modal.open');
    await boss.tap('#rn-cust-q').catch(() => boss.click('#rn-cust-q')); await sleep(150);
    await shot(boss, 'phone-picker');
    await boss.click('#rn-cust-list .rct-pick-opt[data-key="id:C1"]'); await set(boss, '#rn-amount', 1000); await sleep(200);
    await shot(boss, 'phone-new');
    const lay = await boss.evaluate(() => { const s = document.getElementById('rn-save').getBoundingClientRect(); const f = document.querySelector('#rct-new-modal .modal-footer').getBoundingClientRect(); const row = document.querySelector('#rn-invoices .rct-inv-row').getBoundingClientRect(); return { sw: Math.round(s.width), sb: Math.round(innerHeight - s.bottom), fb: Math.round(innerHeight - f.bottom), rw: Math.round(row.width), sx: scrollX, docW: document.documentElement.scrollWidth }; });
    assert.ok(lay.sw > 330 && lay.sb < 110 && lay.fb < 2, 'Save full width in the footer at the bottom ' + JSON.stringify(lay));
    assert.ok(lay.rw <= 390 && lay.docW <= 391, 'no sideways scrolling ' + JSON.stringify(lay));
    await shot(boss, 'phone-new');
    assert.deepEqual([...boss.__errors, ...alice.__errors], []);
  } finally { await h.close(); }
});

test('V266 Sales Order: receipts replace "Record payment"; New Receipt from the order and from the invoice', { timeout: 240000 }, async () => {
  const h = await startHarness({ appDir, playwright, executablePath: process.env.CHROMIUM_PATH });
  try {
    h.fs.load({
      'system/deliveryNoteStorage': { mode: 'independent', minClientVersion: 260 },
      'system/invoiceStorage': { mode: 'independent' },
      'system/accessControl': { adminUids: ['u-boss'] },
      'settings/receipts': { zohoPaymentNo: 'optional', allowRecord: 'all', allowVoid: 'admin', accounts: [] },
      'quotations/Q-1': { id: 'Q-1', qno: 'Q-2610-0001', date: '2026-10-01', company: 'Al Noor', status: 'Sent', vatRate: 15,
        items: [{ desc: 'Pipe', qty: 10, uom: 'Pcs', up: 100 }, { desc: 'Valve', qty: 4, uom: 'Pcs', up: 50 }] },
    });
    const p = await h.newUser({ uid: 'u-boss', email: 'boss@x', name: 'Boss' });
    await h.open(p); await p.setViewportSize({ width: 1600, height: 1000 });
    const closeAll = () => p.evaluate(() => { document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m.id)); });
    const set = (sel, v) => p.evaluate(([s, v]) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, String(v)]);
    const confirmSave = async btn => { await p.click(btn); await p.waitForSelector('#app-confirm-overlay'); await p.click('#confirm-ok'); await sleep(1500); };
    await p.evaluate(() => openCreateSO('Q-1')); await set('#so-po-no', 'PO-RCT'); await p.click('#so-save-btn'); await sleep(1200);
    const soId = await p.evaluate(() => salesOrders[0].id); await closeAll();
    await p.evaluate(id => openRecordDelivery(id), soId); await p.waitForSelector('#so-delivery-modal.open');
    await set('#dn-qty-0', 4); await set('#dn-qty-1', 0); await p.click('#dn-dispatch-save-btn'); await sleep(1200); await closeAll();
    await p.evaluate(id => openDeliveryAcceptance(id, 0), soId); await p.waitForSelector('#dn-confirm-modal.open');
    await set('#dn-received-by', 'SK'); await p.click('#dn-confirm-save-btn'); await sleep(1200); await closeAll();
    await p.evaluate(id => viewDeliveryNote(id, 0), soId); await p.waitForSelector('#dn-print-modal.open');
    await p.click('#dn-create-invoice-btn'); await p.waitForSelector('#inv-issue-modal.open');
    await set('#ii-zoho', 'ZB-7001'); await confirmSave('#ii-save');   // 400 + 15% = 460
    await closeAll();
    // Sales Order: no "Record payment"; New Receipt instead; payment history from receipts
    await p.evaluate(id => viewSO(id), soId); await p.waitForSelector('#so-view-modal.open');
    assert.equal(await p.$$eval('#so-view-footer button', b => b.some(x => /Record payment/.test(x.textContent))), false);
    assert.ok(await p.isVisible('#so-new-receipt-btn'));
    await p.click('#so-new-receipt-btn'); await p.waitForSelector('#rct-new-modal.open');
    assert.match(await p.inputValue('#rn-cust'), /id:|name:al noor/);
    assert.match(await p.textContent('#rn-chosen'), /Al Noor/, 'customer pre-chosen from the order');
    assert.equal(await p.$$eval('#rn-invoices .rct-inv-row.focus', r => r.length), 1, 'the order\'s invoice is marked');
    await set('#rn-amount', 200); await sleep(100);
    await p.click('#rn-save'); await p.waitForSelector('#app-confirm-overlay'); await p.click('#confirm-ok'); await sleep(1500);
    await closeAll();
    await p.evaluate(id => viewSO(id), soId); await sleep(500);
    const soText = await p.textContent('#so-view-modal');
    assert.match(soText, /Receipts[\s\S]*RCT-\d{4}-0001[\s\S]*200\.00/);   // V269.7: Finance tab
    assert.equal(await p.evaluate(id => getSOStatus(salesOrders.find(s => s.id === id)), soId), 'Partially Paid');
    // From the invoice: settle the rest (260)
    const invId = await p.evaluate(() => invoicesCache[0].id);
    await closeAll(); await p.evaluate(id => openInvoiceView(id), invId); await sleep(400);
    await p.click('#inv-view-receipt-btn'); await p.waitForSelector('#rct-new-modal.open');
    await set('#rn-amount', 260); await sleep(100);
    assert.equal(await p.inputValue('#rn-invoices .rct-apply-input'), '260.00');
    await p.click('#rn-save'); await p.waitForSelector('#app-confirm-overlay'); await p.click('#confirm-ok'); await sleep(1500);
    assert.equal(h.fs.peek('invoicePayments/' + invId).paid, 460);
    await closeAll(); await p.evaluate(id => openInvoiceView(id), invId); await sleep(400);
    assert.match(await p.textContent('#inv-view-body .inv-view-panel'), /Paid\s*460\.00[\s\S]*Balance due\s*0\.00[\s\S]*Paid/);
    assert.equal(await p.isVisible('#inv-view-receipt-btn'), false);
    await closeAll(); await p.evaluate(id => viewSO(id), soId); await sleep(400);
    assert.equal(await p.isVisible('#so-new-receipt-btn'), false, 'no open invoices left on the order');
    assert.deepEqual(p.__errors, []);
  } finally { await h.close(); }
});
