/** BROWSER INTEGRATION (simulator): V264 invoices through the real screens — advance, delivery invoice with
 *  deduction, order (bill-ahead) invoice completing the order, credit note, Billing Settings permissions, print. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { startHarness } from './harness.mjs';

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const playwright = createRequire(process.env.PLAYWRIGHT_FROM || import.meta.url)('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));

test('V264 invoicing: advance → delivery invoice (deduction) → order invoice (final) → credit note; permissions; print', { timeout: 240000 }, async () => {
  const h = await startHarness({ appDir, playwright, executablePath: process.env.CHROMIUM_PATH });
  try {
    h.fs.load({
      'system/deliveryNoteStorage': { mode: 'independent', minClientVersion: 260 },
      'system/invoiceStorage': { mode: 'independent' },
      'system/accessControl': { adminUids: ['u-boss'] },
      'quotations/Q-1': { id: 'Q-1', qno: 'Q-2610-0001', date: '2026-10-01', company: 'Al Noor', status: 'Sent', vatRate: 15,
        items: [{ desc: 'Pipe', qty: 10, uom: 'Pcs', up: 100 }, { desc: 'Valve', qty: 4, uom: 'Pcs', up: 50 }] },
    });
    const boss = await h.newUser({ uid: 'u-boss', email: 'boss@x', name: 'Boss' });
    const alice = await h.newUser({ uid: 'u-alice', email: 'alice@x', name: 'Alice' });
    await h.open(boss); await h.open(alice);
    const closeAll = p => p.evaluate(() => { document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m.id)); document.getElementById('document-summary-modal')?.classList.remove('open'); if (typeof closeValidationDialog === 'function') closeValidationDialog(); });
    const set = (p, sel, v) => p.evaluate(([s, v]) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, [sel, String(v)]);
    const invoices = () => Object.entries(h.fs.dump('customerInvoices/')).filter(([p]) => p.split('/').length === 2).map(([, d]) => d).sort((a, b) => a.invNo.localeCompare(b.invNo));
    const ledger = id => h.fs.peek('salesOrderFulfillment/' + id);
    // V264.7: saving asks for a second confirmation
    const confirmSave = async (p, btn) => { await p.click(btn); await p.waitForSelector('#app-confirm-overlay'); await p.click('#confirm-ok'); await sleep(1500); };

    // Sales Order
    await boss.evaluate(() => openCreateSO('Q-1'));
    await set(boss, '#so-po-no', 'PO-INV'); await boss.click('#so-save-btn'); await sleep(1200);
    const soId = await boss.evaluate(() => salesOrders[0].id);
    await closeAll(boss);

    // 1. Advance invoice 50% of the order (1,200 → 600 + VAT 90)
    // The busy overlay stays up for the whole opening (lock, reload AND the invoice balances), so the order
    // screen never shows through in between.
    await boss.evaluate(() => { const g = window.BizCoreInv.getLedger; window.BizCoreInv.getLedger = async (...a) => { window.__depthAtLedger = _screenTransitionDepth; return g(...a); }; });
    await boss.evaluate(id => openCreateInvoice(id), soId);
    await boss.waitForSelector('#inv-issue-modal.open');
    assert.ok(await boss.evaluate(() => window.__depthAtLedger) >= 1, 'overlay active while the balances load');
    assert.equal(await boss.evaluate(() => _screenTransitionDepth), 0, 'overlay gone once the screen is open');
    assert.equal(await boss.evaluate(() => document.querySelector('#inv-issue-modal .modal').classList.contains('inv-step1')), true, 'compact step 1');
    // Step 1: nothing is pre-selected; Continue stays disabled; Delivery is unavailable (nothing accepted)
    assert.equal(await boss.evaluate(() => document.getElementById('inv-issue-modal')._type), null);
    assert.equal(await boss.evaluate(() => document.getElementById('ii-continue').disabled), true);
    assert.equal(await boss.evaluate(() => document.querySelector('[data-inv-type="delivery"]').disabled), true);
    await boss.click('[data-inv-type="advance"]');
    assert.equal(await boss.evaluate(() => document.getElementById('ii-continue').disabled), false);
    await boss.click('#ii-continue');
    assert.match(await boss.textContent('#ii-steps'), /Advance invoice/);
    await set(boss, '#ii-adv-pct', 50);
    assert.match(await boss.textContent('#inv-issue-modal .so-summary-card'), /690\.00/);
    // Zoho invoice no. is mandatory: the footer says what is missing and Save stays disabled
    assert.equal(await boss.evaluate(() => document.getElementById('ii-save').disabled), true, 'Zoho number required');
    assert.match(await boss.textContent('#ii-footer-note'), /To continue:.*Zoho invoice no/);
    await set(boss, '#ii-zoho', 'ZB-1001');
    assert.match(await boss.textContent('#ii-footer-note'), /Ready/);
    // second confirmation: "Go back" saves nothing
    await boss.click('#ii-save'); await boss.waitForSelector('#app-confirm-overlay');
    assert.match(await boss.textContent('#app-confirm-overlay'), /ZB-1001/); assert.match(await boss.textContent('#app-confirm-overlay'), /690\.00/);
    await boss.click('#confirm-cancel'); await sleep(300);
    assert.equal(invoices().length, 0); assert.equal(await boss.evaluate(() => isModalOpen('inv-issue-modal')), true);
    await confirmSave(boss, '#ii-save');
    // after saving, the invoice is shown in the display screen; Back returns to the Sales Order
    assert.equal(await boss.evaluate(() => isModalOpen('inv-view-modal')), true);
    assert.match(await boss.textContent('#inv-view-body'), /ADVANCE INVOICE/);
    assert.match(await boss.textContent('#inv-view-modal .modal-header'), /Sales Order/);
    let inv = invoices();
    assert.equal(inv.length, 1); assert.equal(inv[0].type, 'advance'); assert.equal(inv[0].totals.subtotal, 600); assert.equal(inv[0].totals.total, 690);
    assert.equal(h.fs.peek('locks/salesOrder_' + soId), undefined, 'lock released after the invoice');
    assert.equal((h.fs.peek('salesOrders/' + soId).invoices || []).length, 0, 'the Sales Order document never stores invoices');
    await closeAll(boss);

    // 2. Deliver and accept 4 Pipes; delivery invoice proposes a 50% deduction (200)
    await boss.evaluate(id => openRecordDelivery(id), soId);
    await boss.waitForSelector('#so-delivery-modal.open');
    await set(boss, '#dn-qty-0', 4); await set(boss, '#dn-qty-1', 0); await boss.click('#dn-dispatch-save-btn'); await sleep(1200);
    await closeAll(boss);
    await boss.evaluate(id => openDeliveryAcceptance(id, 0), soId);
    await boss.waitForSelector('#dn-confirm-modal.open');
    await set(boss, '#dn-received-by', 'SK'); await boss.click('#dn-confirm-save-btn'); await sleep(1200);
    await closeAll(boss);
    await boss.evaluate(id => openCreateInvoice(id), soId);
    await boss.waitForSelector('#inv-issue-modal.open');
    assert.match(await boss.textContent('[data-inv-type="delivery"]'), /Suggested/);
    await closeAll(boss); await sleep(500);
    // … created from the Delivery Note: Create Invoice button → delivery invoice, quantities from that DN
    await boss.evaluate(id => viewDeliveryNote(id, 0), soId);
    await boss.waitForSelector('#dn-print-modal.open');
    assert.equal(await boss.isVisible('#dn-create-invoice-btn'), true, 'Create Invoice on an accepted DN');
    await boss.click('#dn-create-invoice-btn');
    await boss.waitForSelector('#inv-issue-modal.open');
    assert.equal(await boss.evaluate(() => document.getElementById('inv-issue-modal')._type), 'delivery');
    assert.equal(await boss.isVisible('#ii-save'), true, 'went straight to step 2');
    assert.match(await boss.textContent('#ii-items-help'), /Prefilled with the quantities accepted on DN-/);
    assert.equal(await boss.evaluate(() => isModalOpen('dn-print-modal')), false);
    assert.equal(await boss.inputValue('#ii-qty-0'), '4');
    // desktop-style spinner: the arrows step by the unit and respect the maximum
    assert.equal(await boss.evaluate(() => document.getElementById('ii-qty-0').parentElement.className), 'bc-spin-wrap');
    await boss.click('#ii-qty-0 + .bc-spin-arrows .bc-spin-down');
    assert.equal(await boss.inputValue('#ii-qty-0'), '3');
    await boss.click('#ii-qty-0 + .bc-spin-arrows .bc-spin-up'); await boss.click('#ii-qty-0 + .bc-spin-arrows .bc-spin-up');
    assert.equal(await boss.inputValue('#ii-qty-0'), '4', 'cannot go above the available quantity');
    assert.equal(await boss.inputValue('#ii-ded'), '200.00');
    assert.match(await boss.textContent('#inv-issue-modal .so-summary-card'), /230\.00/);
    // a Zoho number already used (case and spaces ignored) is refused on the screen
    await set(boss, '#ii-zoho', ' zb-1001 ');
    assert.equal(await boss.isVisible('#ii-zoho-msg'), true); assert.match(await boss.textContent('#ii-zoho-msg'), /Already used on INV-/);
    assert.equal(await boss.evaluate(() => document.getElementById('ii-save').disabled), true);
    await set(boss, '#ii-zoho', 'ZB-1002');
    await confirmSave(boss, '#ii-save');
    inv = invoices();
    const dInv = inv.find(i => i.type === 'delivery');
    assert.equal(dInv.totals.deductionSubtotal, 200); assert.equal(dInv.totals.total, 230);
    assert.equal(dInv.deductions[0].advanceInvNo, inv.find(i => i.type === 'advance').invNo);
    await closeAll(boss);
    // nothing accepted is left to invoice → the DN no longer offers the button
    await boss.evaluate(id => viewDeliveryNote(id, 0), soId);
    await boss.waitForSelector('#dn-print-modal.open');
    assert.equal(await boss.isVisible('#dn-create-invoice-btn'), false);
    await closeAll(boss);
    // Invoice view: A4 document (Delivery Note layout, invoice accent) + side panel + action bar
    await boss.evaluate(id => openInvoiceView(id), dInv.id);
    await boss.waitForSelector('#inv-view-modal.open');
    const vtxt = await boss.textContent('#inv-view-body');
    assert.match(vtxt, /TAX INVOICE/); assert.match(vtxt, /DELIVERY INVOICE/); assert.match(vtxt, /Less: advance INV-\d{4}-\d+ dated/);
    assert.match(vtxt, /Document flow/); assert.match(vtxt, /Billing status/);
    assert.match(await boss.getAttribute('#inv-view-body .bc-flow-chip:has(.bc-flow-tag)', 'title'), /Advance deducted/);
    // V265.2 compact view: window = A4 page + 300 px panel (max 1320 px), centred; buttons in the bottom bar
    await boss.setViewportSize({ width: 1920, height: 1000 });
    const box = await boss.evaluate(() => { const r = document.querySelector('#inv-view-modal>.modal').getBoundingClientRect(), p = document.querySelector('#inv-view-modal .inv-view-panel').getBoundingClientRect(), b = document.getElementById('inv-view-print-btn').getBoundingClientRect(); return { x: r.x, w: r.width, pw: p.width, by: b.bottom, mb: r.bottom, bx: b.right, mr: r.right }; });
    assert.equal(Math.round(box.w), 1320); assert.equal(Math.round(box.x), 300, 'centred'); assert.equal(Math.round(box.pw), 300);
    assert.ok(box.mb - box.by < 30 && box.mr - box.bx < 30, 'Print / PDF at the bottom right');
    await boss.setViewportSize({ width: 1440, height: 1000 });
    assert.equal(await boss.isVisible('#inv-view-credit-btn'), true);
    assert.equal(await boss.evaluate(() => getComputedStyle(document.querySelector('#inv-view-body .dn-items th')).backgroundColor), 'rgb(15, 118, 110)', 'teal invoice accent');
    await boss.screenshot({ path: (process.env.SHOTS || '/tmp') + '/invoice-view.png' }).catch(() => {});
    await closeAll(boss);

    // 3. Order invoice for everything else: the final invoice must deduct the remaining 400 (field locked)
    await boss.evaluate(id => openCreateInvoice(id), soId);
    await boss.waitForSelector('#inv-issue-modal.open');
    await boss.evaluate(() => setIssueInvoiceType('order'));
    await boss.evaluate(() => issueInvoiceFill(true));
    assert.equal(await boss.evaluate(() => document.getElementById('ii-save').disabled), true, 'reason required');
    await set(boss, '#ii-reason', 'Customer budget closing');
    assert.equal(await boss.inputValue('#ii-ded'), '400.00');
    assert.equal(await boss.evaluate(() => document.getElementById('ii-ded').readOnly), true);
    assert.match(await boss.textContent('#ii-ded-info'), /completes the order/);
    await set(boss, '#ii-zoho', 'ZB-1003');
    await confirmSave(boss, '#ii-save');
    const oInv = invoices().find(i => i.type === 'order');
    assert.deepEqual([oInv.totals.goodsSubtotal, oInv.totals.deductionSubtotal, oInv.totals.total], [800, 400, 460]);
    assert.equal(oInv.reason, 'Customer budget closing');
    const L = ledger(soId);
    assert.deepEqual(Object.values(L.lines).map(l => [l.invoicedDelivery || 0, l.invoicedAhead || 0]), [[4, 6], [0, 4]]);
    // SO view: billing summary
    await closeAll(boss);
    await boss.evaluate(id => viewSO(id), soId);
    const view = await boss.textContent('#so-view-body');
    assert.match(view, /Net Billed \(Ex-VAT\)\s*SAR 1,200\.00/); assert.match(view, /Still To Bill\s*SAR 0\.00/);   // V269.7: Finance tab
    assert.match(view, /Billed Ahead/); assert.match(view, /Advance/);

    // 4. Credit note: 1 Pipe from the delivery invoice → 100 goods, 50 advance given back → 57.50
    await closeAll(boss);
    await boss.evaluate(([s, i]) => openIssueCreditNote(s, i), [soId, dInv.id]);
    await boss.waitForSelector('#cn-issue-modal.open');
    // the disabled button is explained: what is still needed
    assert.equal(await boss.evaluate(() => document.getElementById('cn-save').disabled), true);
    assert.match(await boss.textContent('#cn-ready'), /To continue:.*Quantity to credit.*Reason/);
    await boss.click('#cn-qty-0 + .bc-spin-arrows .bc-spin-up');
    assert.equal(await boss.inputValue('#cn-qty-0'), '1');
    assert.match(await boss.textContent('#cn-ready'), /✓Quantity to credit/);
    await set(boss, '#cn-reason', 'One pipe returned damaged');
    assert.match(await boss.textContent('#cn-issue-modal .so-summary-card'), /57\.50/);
    await confirmSave(boss, '#cn-save');
    assert.equal(await boss.evaluate(() => isModalOpen('inv-view-modal')), true, 'credit note shown after saving');
    assert.match(await boss.textContent('#inv-view-body'), /CREDIT NOTE/);
    const cn = Object.entries(h.fs.dump('creditNotes/')).filter(([p]) => p.split('/').length === 2).map(([, d]) => d)[0];
    assert.equal(cn.total, 57.5); assert.equal(cn.invNo, dInv.invNo);
    assert.equal(h.fs.peek('customerInvoices/' + dInv.id).status, 'Partially credited');
    assert.equal(Object.values(ledger(soId).lines)[0].invoicedDelivery, 3);
    assert.equal(h.fs.peek('locks/salesOrder_' + soId), undefined);

    // 5. Print: the deduction line names the advance invoice and its date
    await boss.evaluate(id => printCustomerInvoice(id), dInv.id);
    const html = await boss.evaluate(() => window.__popups[window.__popups.length - 1].document.html);
    assert.match(html, /TAX INVOICE/); assert.match(html, /Less: advance INV-/);

    // Register: 3 invoices + 1 credit note, net billed = 690 + 230 + 460 − 57.50
    await closeAll(boss); await boss.evaluate(() => showPage('customerinvoices')); await sleep(300);
    assert.equal(await boss.evaluate(() => document.querySelectorAll('#invreg-body tr').length), 4);
    assert.equal(await boss.textContent('#invreg-a-net'), '1,322.50');
    await boss.$eval('[data-inv-kpi="credit"]', e => e.click()); /* V271.5: the old monitor rows are hidden behind the new cards; same handler */
    assert.equal(await boss.evaluate(() => document.querySelectorAll('#invreg-body tr').length), 1);
    await boss.click('#invreg-body tr'); await sleep(300);
    assert.match(await boss.textContent('#inv-view-body'), /CREDIT NOTE/);
    assert.match(await boss.textContent('#inv-view-body'), /One pipe returned damaged/);
    assert.equal(await boss.evaluate(() => getComputedStyle(document.querySelector('#inv-view-body .dn-items th')).backgroundColor), 'rgb(180, 35, 24)', 'red credit note accent');
    await boss.screenshot({ path: (process.env.SHOTS || '/tmp') + '/creditnote-view.png' }).catch(() => {});
    await closeAll(boss);
    await boss.screenshot({ path: (process.env.SHOTS || '/tmp') + '/invoice-register.png' }).catch(() => {});

    // 6. Permissions: a normal user cannot issue order/advance invoices or credit notes by default …
    await closeAll(alice);
    await alice.evaluate(id => viewSO(id), soId);
    assert.doesNotMatch(await alice.textContent('#so-view-body'), /Credit note<\/button>|ti-receipt-refund"><\/i>Credit note/);
    await closeAll(alice);
    await alice.evaluate(id => openCreateInvoice(id), soId);
    await alice.waitForSelector('#inv-issue-modal.open');
    assert.deepEqual(await alice.evaluate(() => { const a = document.getElementById('inv-issue-modal')._allowed; return [a.delivery.ok, a.order.ok, a.advance.ok]; }), [true, false, false]);
    assert.match(await alice.textContent('[data-inv-type="order"]'), /Special Right/);
    assert.equal(await alice.evaluate(() => document.querySelector('[data-inv-type="order"]').disabled), true);
    await closeAll(alice); await sleep(600);
    assert.equal(h.fs.peek('locks/salesOrder_' + soId), undefined, 'closing the screen released the lock');
    // … V270.4.3: Billing Settings keep only On / Off (order invoices On = roles with the Special Right) …
    await boss.evaluate(() => { closeModal('so-view-modal'); showPage('setup'); switchSetupTab('billing'); });
    await boss.waitForSelector('#bs-order');
    assert.deepEqual(await boss.evaluate(() => [...document.querySelectorAll('#bs-order option')].map(o => o.value)), ['admin', 'none']);
    await boss.selectOption('#bs-order', 'none'); await boss.click('#bs-save'); await sleep(800);
    assert.equal(h.fs.peek('settings/billing').allowOrderInvoices, 'none');
    assert.equal(Object.keys(h.fs.dump('settings/billing/changes/')).length, 1, 'change logged');
    await boss.selectOption('#bs-order', 'admin'); await boss.click('#bs-save'); await sleep(800);
    const aliceSettingsVisible = await alice.evaluate(() => { showPage('setup'); switchSetupTab('billing'); return { disabled: document.getElementById('bs-order').disabled, save: !!document.getElementById('bs-save') }; });
    assert.deepEqual(aliceSettingsVisible, { disabled: true, save: false });
    // … and gives Alice's role the Special Right "order invoices" (Roles & Permissions) …
    await boss.evaluate(() => switchSetupTab('roles')); await sleep(400);
    await boss.click('[data-ur="role-pick"][data-role="r-test-staff"]'); await sleep(200);
    await boss.click('[data-ur="role-tab"][data-tab="rights"]'); await sleep(200);
    await boss.click('[data-ur="right"][data-right="orderInvoices"]'); await sleep(100);
    await boss.click('[data-ur="role-save"]'); await boss.waitForSelector('#confirm-ok'); await boss.click('#confirm-ok'); await sleep(800);
    assert.ok(h.fs.peek('users/u-alice').perm.rightMods.includes('orderInvoices'), 'Alice\'s copy updated');
    // … Alice is asked to reload; after it she may bill ahead (the order is fully invoiced, so advance stays disabled)
    await alice.waitForSelector('#bc-perm-reload', { timeout: 5000 });
    await h.open(alice); await sleep(800);
    await alice.evaluate(id => openCreateInvoice(id), soId);
    await alice.waitForSelector('#inv-issue-modal.open');
    assert.deepEqual(await alice.evaluate(() => { const a = document.getElementById('inv-issue-modal')._allowed; return [a.order.ok, a.advance.ok]; }), [true, false]);
    await closeAll(alice);

    for (const p of [boss, alice]) assert.deepEqual(p.__errors, [], 'no page errors');
  } finally { await h.close(); }
});

test('V264 invoicing: paused while the administrator migrates invoices; legacy screen unchanged in legacy mode', { timeout: 120000 }, async () => {
  const h = await startHarness({ appDir, playwright, executablePath: process.env.CHROMIUM_PATH });
  try {
    h.fs.load({
      'system/deliveryNoteStorage': { mode: 'independent', minClientVersion: 260 },
      'system/invoiceStorage': { mode: 'migrating' },
      'system/accessControl': { adminUids: ['u-boss'] },
      'salesOrders/SO-9': { id: 'SO-9', soNo: 'SO-2610-0009', customer: 'Beta', date: '2026-10-01', vatRate: 0.15, subtotal: 100, vat: 15, total: 115,
        items: [{ lineId: 'L-1', desc: 'Bolt', qty: 10, uom: 'Pcs', up: 10 }], invoices: [], payments: [] },
    });
    const boss = await h.newUser({ uid: 'u-boss', email: 'boss@x', name: 'Boss' });
    await h.open(boss);
    await boss.waitForFunction(() => window.BizCoreInv && window.BizCoreInv.mode === 'migrating');
    await boss.evaluate(() => openCreateInvoice('SO-9')); await sleep(800);
    assert.equal(await boss.evaluate(() => !!document.querySelector('#inv-issue-modal.open, #so-invoice-modal.open')), false);
    assert.ok((await boss.evaluate(() => window.__toasts)).some(t => /Invoicing is paused/.test(t.msg)));
    assert.equal(h.fs.peek('locks/salesOrder_SO-9'), undefined, 'no lock left behind');
    assert.deepEqual(boss.__errors, []);
  } finally { await h.close(); }
});

test('emulator sample orders open correctly in the invoice screens', { timeout: 120000 }, async () => {
  const { adminAdapter, seedSampleOrders } = await import('../../emulator/sample-orders.mjs');
  const h = await startHarness({ appDir, playwright, executablePath: process.env.CHROMIUM_PATH });
  try {
    const fs = h.fs;
    fs.load({ 'system/deliveryNoteStorage': { mode: 'independent', minClientVersion: 260 }, 'system/invoiceStorage': { mode: 'independent' }, 'system/accessControl': { adminUids: ['u-alice'] } });
    const ref = path => ({ path, id: path.split('/').pop(), get: async () => ({ exists: fs.peek(path) !== undefined, data: () => fs.peek(path) }), set: async d => { fs.load({ [path]: d }); } });
    const admin = { doc: ref, runTransaction: fn => fs.runTransaction(fs.db, t => fn({ get: async r => { const s = await t.get(fs.doc(fs.db, r.path)); return { exists: s.exists(), data: () => s.data() }; }, set: (r, d) => t.set(fs.doc(fs.db, r.path), d) })) };
    await seedSampleOrders(adminAdapter(admin, fs.serverTimestamp), { log: () => {} });
    const alice = await h.newUser({ uid: 'u-alice', email: 'alice@bizcore.test', name: 'Alice' });
    await h.open(alice);
    await alice.waitForFunction(() => salesOrders.length === 4 && invoicesCache.length === 1);
    assert.deepEqual(await alice.evaluate(() => salesOrders.map(s => s.soNo + ':' + getSOStatus(s)).sort()),
      ['SO-2610-0901:Confirmed', 'SO-2610-0902:Partially Delivered', 'SO-2610-0903:Invoiced', 'SO-2610-0904:Out for Delivery']);
    await alice.evaluate(() => openCreateInvoice('SO-SAMPLE-3'));
    await alice.waitForSelector('#inv-issue-modal.open');
    await alice.evaluate(() => setIssueInvoiceType('delivery'));
    assert.equal(await alice.inputValue('#ii-ded'), '2250.00', '6 chairs + 2 desks = 4,500 goods × 50% advance');
    await alice.evaluate(() => closeModal('inv-issue-modal'));
    await alice.evaluate(() => openCreateInvoice('SO-SAMPLE-2'));
    await alice.waitForSelector('#inv-issue-modal.open');
    await alice.evaluate(() => setIssueInvoiceType('delivery'));
    assert.deepEqual([await alice.inputValue('#ii-qty-0'), await alice.inputValue('#ii-qty-1')], ['30', '39']);
    assert.deepEqual(alice.__errors, []);
  } finally { await h.close(); }
});
