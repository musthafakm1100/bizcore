/** BROWSER (simulator): V268.5 — data safety (settings moved from the browser to Firebase), administrator approval
 *  instead of the PIN, Data Health, + New Unit, + New Product on a stock line, Change Item (approved mockups V5_1–V5_6). */
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

/* what the administrator's PC had only in its browser */
const BOSS_LOCAL = {
  bizcore_uom_master: JSON.stringify([{ id: 'u1', code: 'Pcs', name: 'Pieces', decimals: 0, step: 1, active: true }, { id: 'u2', code: 'Doz', name: 'Dozen', decimals: 0, step: 1, active: true }, { id: 'u3', code: 'Ctn', name: 'Carton', decimals: 0, step: 1, active: true }]),
  bizcoreTaxMaster: JSON.stringify([{ id: 't1', code: 'VAT15', name: 'Standard VAT', rate: 15, effectiveFrom: '2018-01-01', effectiveTo: '', active: true, isDefault: true, remarks: '' }, { id: 't0', code: 'ZERO', name: 'Zero-rated', rate: 0, effectiveFrom: '2018-01-01', effectiveTo: '', active: true, isDefault: false, remarks: '' }]),
  bizcorePricingSettings: JSON.stringify({ decimals: 2, minMargin: 12, managerApproval: true }),
  bizcore_users: JSON.stringify([{ id: 'user-admin', username: 'admin', password: 'secret' }]),
  dtq_admin_pin: '4321',
};

test('V268.5 settings move to Firebase, Data Health, approvals, no PIN, New Unit, New Product, Change Item', { timeout: 300000 }, async () => {
  const h = await startHarness({ appDir, playwright, executablePath: process.env.CHROMIUM_PATH });
  try {
    h.fs.load({
      'system/deliveryNoteStorage': { mode: 'independent', minClientVersion: 260 }, 'system/invoiceStorage': { mode: 'independent' }, 'system/accessControl': { adminUids: ['u-boss'] },
      'suppliers/sup1': { id: 'sup1', company: 'ABC Trading Est' },
      'rfqs/r1': { id: 'r1', rfqNo: 'RFQ-2610-0007', company: 'MOHG', currentPricingVersion: 2, pricingVersions: [{ version: 1, status: 'Superseded' }, { version: 2, status: 'Draft' }] },
      'products/p-typo': { id: 'p-typo', name: 'Pelican 7600 flash light', code: '', uom: 'Pcs' },
      'products/p-pel': { id: 'p-pel', name: 'Pelican 7600 flashlight', code: 'PEL7600', uom: 'Pcs' },
      'products/p-box': { id: 'p-box', name: 'Roco Paper A4', code: 'ROCO', uom: 'Box' },
    });
    const boss = await h.newUser({ uid: 'u-boss', email: 'boss@x', name: 'Musthafa KM' });
    await boss.context().addInitScript(([local]) => {   // the administrator's PC: browser-only settings, and show the Move window
      try { sessionStorage.removeItem('bc_ds_later'); if (!localStorage.getItem('__seeded')) { Object.entries(local).forEach(([k, v]) => localStorage.setItem(k, v)); localStorage.setItem('__seeded', '1'); } } catch (e) {}
    }, [BOSS_LOCAL]);
    const aisha = await h.newUser({ uid: 'u-aisha', email: 'aisha@x', name: 'Aisha' });
    await icons(boss); await icons(aisha);
    await h.open(boss); await h.open(aisha);
    const docs = prefix => Object.entries(h.fs.dump(prefix)).filter(([k]) => k.split('/').length === 2).map(([, d]) => d);

    // ── 1. the administrator sees "Move settings to Firebase" (approved mockup V5_5) ──
    await boss.waitForSelector('#ds-move-modal.open', { timeout: 8000 });
    const mv = await boss.textContent('#ds-move-modal');
    assert.match(mv, /Units of Measure[\s\S]*3 units \(Pcs, Doz, Ctn\)[\s\S]*— none —[\s\S]*Same, shared/);
    assert.match(mv, /Tax master[\s\S]*Standard VAT 15% \(default\), Zero-rated 0%/);
    assert.match(mv, /Pricing settings[\s\S]*2 decimals · min\. margin 12% · manager approval on/);
    assert.match(mv, /old browser User Management list and the browser PIN/);
    await sleep(200); await shot(boss, 'V2685_move_settings');
    const dl = boss.waitForEvent('download', { timeout: 5000 }).catch(() => null);
    await boss.click('#dsm-go'); await sleep(900);
    assert.ok(await dl, 'a backup file is downloaded first');
    assert.equal(await boss.evaluate(() => document.getElementById('ds-move-modal').classList.contains('open')), false);
    const shared = Object.fromEntries(docs('sharedSettings/').map(d => [d.id, d]));
    assert.deepEqual(Object.keys(shared).sort(), ['costComponents', 'pricing', 'taxMaster', 'units']);   // margin statuses: never changed here → the defaults, nothing to move
    assert.ok(true);
    assert.deepEqual(JSON.parse(shared.units.json).map(u => u.code), ['Pcs', 'Doz', 'Ctn']);
    assert.equal(shared.units.updatedBy, 'Musthafa KM');
    assert.equal(await boss.evaluate(() => [localStorage.getItem('bizcore_users'), localStorage.getItem('dtq_admin_pin')].join('|')), '|');

    // ── 2. another PC gets the same settings from Firebase ──
    await sleep(400);
    assert.deepEqual(await aisha.evaluate(() => JSON.parse(localStorage.getItem('bizcore_uom_master')).map(u => u.code)), ['Pcs', 'Doz', 'Ctn']);
    assert.equal(await aisha.evaluate(() => UOM_LIST.includes('Doz')), true);
    assert.equal(await aisha.evaluate(() => readPricingSettings().minMargin), 12);
    assert.equal(await aisha.evaluate(() => readTaxMaster().length), 2);

    // ── 3. Data Health (approved mockup V5_6) ──
    await boss.evaluate(() => { showPage('setup'); switchSetupTab('data-health'); }); await sleep(300);
    const dh = await boss.textContent('#dh-body');
    assert.match(dh, /Nothing is saved only in this browser/); assert.match(dh, /Units of Measure[\s\S]*Musthafa KM[\s\S]*Shared/);
    await shot(boss, 'V2685_data_health');

    // ── 4. no PIN: Backup & Restore for administrators; the old User Management is gone ──
    await boss.evaluate(() => switchSetupTab('admin')); await sleep(100);
    assert.equal(await boss.isVisible('#admin-content'), true); assert.equal(await boss.isVisible('#admin-pin-gate'), false);
    assert.doesNotMatch(await boss.textContent('#admin-content'), /PIN/);
    await aisha.evaluate(() => { showPage('setup'); switchSetupTab('admin'); }); await sleep(100);
    assert.equal(await aisha.isVisible('#admin-content'), false); assert.match(await aisha.textContent('#admin-pin-gate'), /Administrators only/);
    await aisha.evaluate(() => switchSetupTab('users')); await sleep(100);
    const users = await aisha.textContent('#setup-tab-users');
    assert.doesNotMatch(users, /User accounts/); assert.match(users, /Cash custodian logins/);
    assert.equal(await aisha.evaluate(() => !!document.getElementById('stab-roles')), false);

    // ── 5. a Units change by staff reaches everyone; + New Unit in Add Product (approved mockup V5_3) ──
    await aisha.evaluate(() => { showPage('masters'); openAddProduct(); }); await sleep(300);
    await aisha.click('#prod-modal .bc-label-link'); await aisha.waitForSelector('#qu-modal.open');
    await aisha.fill('#qu-code', 'Doz'); assert.match(await aisha.textContent('#qu-hint'), /Code Doz already exists/);
    await aisha.fill('#qu-code', 'Set'); await aisha.fill('#qu-name', 'Set'); assert.match(await aisha.textContent('#qu-hint'), /Code Set is free/);
    await shot(aisha, 'V2685_new_unit');
    await aisha.click('#qu-modal .btn-primary'); await sleep(600);
    assert.equal(await aisha.inputValue('#pm-uom'), 'Set');
    assert.deepEqual(JSON.parse(docs('sharedSettings/').find(d => d.id === 'units').json).map(u => u.code), ['Pcs', 'Doz', 'Ctn', 'Set']);
    await sleep(300);
    assert.equal(await boss.evaluate(() => UOM_LIST.includes('Set')), true, 'the new unit reaches the other PC');
    await aisha.evaluate(() => closeModal('prod-modal')); await sleep(200);
    // staff can't change an administrator setting: refused and put back
    await aisha.evaluate(() => { const t = readTaxMaster(); t[0].rate = 5; writeTaxMaster(t); }); await sleep(500);
    assert.equal(await aisha.evaluate(() => readTaxMaster()[0].rate), 15);
    assert.equal(JSON.parse(docs('sharedSettings/').find(d => d.id === 'taxMaster').json)[0].rate, 15);

    // ── 6. manager approval from an administrator's own login (approved mockup V5_6) ──
    const metrics = () => { window.getLivePricingMetrics = () => ({ materialCost: 900, totalSell: 1000, internalTotal: 16, totalCost: 916, profit: 84, pct: 8.4 }); pricingRFQId = 'r1'; };
    await aisha.evaluate(metrics);
    const first = aisha.evaluate(() => bcPricingApproval()); await aisha.waitForSelector('#ds-ask-modal.open');
    const ask = await aisha.textContent('#ds-ask-modal');
    assert.match(ask, /Margin 8\.4% is below the minimum 12\.0% · PR-2610-0007-V2/); assert.match(ask, /Musthafa KM/);
    await aisha.fill('#dsa-note', 'Competitor price'); await shot(aisha, 'V2685_ask_approval');
    await aisha.click('#dsa-go'); assert.equal(await first, null); await sleep(500);
    const apr = docs('approvals/')[0];
    assert.deepEqual([apr.status, apr.ref, apr.approverUid, apr.requestedBy, apr.note, apr.marginPct], ['Pending', 'PR-2610-0007-V2', 'u-boss', 'Aisha', 'Competitor price', 8.4]);
    assert.equal(await aisha.evaluate(() => bcPricingApproval()), null, 'still waiting');
    assert.equal(await boss.evaluate(id => loadBizCoreNotifications().some(n => n.type === 'approval' && n.approvalId === id), apr.id), true, 'the administrator is notified');
    await boss.evaluate(id => openBizCoreNotification('apr:' + id), apr.id); await boss.waitForSelector('#ds-dec-modal.open');
    assert.match(await boss.textContent('#ds-dec-modal'), /Aisha[\s\S]*8\.4% \(minimum 12\.0%\)[\s\S]*Competitor price/);
    await shot(boss, 'V2685_decide_approval');
    await boss.click('#ds-dec-modal .btn-primary'); await sleep(500);
    assert.equal(docs('approvals/')[0].status, 'Approved'); assert.equal(docs('approvals/')[0].decidedBy, 'Musthafa KM');
    const ok = await aisha.evaluate(() => bcPricingApproval());
    assert.equal(ok.by, 'Musthafa KM'); assert.equal(ok.id, apr.id);
    assert.equal(await aisha.evaluate(id => loadBizCoreNotifications().some(n => n.id === 'apr-res:' + id + ':Approved'), apr.id), true, 'the requester is told');
    // an administrator approves at once
    await boss.evaluate(metrics);
    assert.equal((await boss.evaluate(() => bcPricingApproval())).by, 'Musthafa KM');

    // ── 7. Change Item (approved mockup V5_4): stock bought as the wrong product → the correct one ──
    await boss.evaluate(async (today) => {
      const x = docNumberParts('purchaseInvoice');
      await BizCorePI.service.createPurchaseInvoice({ operationId: 'op-br-chg-00001', numbering: { counterKey: x.counterKey, displayPrefix: x.displayPrefix }, supplierId: 'sup1', supplierName: 'ABC Trading Est',
        supplierInvoiceNo: 'C-1', date: today, dueDate: today, lines: [{ kind: 'stock', productId: 'p-typo', desc: 'Pelican 7600 flash light', uom: 'Pcs', qty: 3, unitCost: 620 }], supplierTotal: 2139 });
    }, today()); await sleep(600);
    await boss.evaluate(() => { document.querySelectorAll('.modal-overlay.open').forEach(m => m.id && closeModal(m.id)); showPage('stock'); }); await sleep(300);
    await boss.evaluate(() => openStockItem('p_p-typo')); await boss.waitForSelector('#st-view-modal.open'); await sleep(400);
    await boss.click('#st-view-modal .modal-footer button:has-text("Change Item")'); await boss.waitForSelector('#st-chg-modal.open');
    await boss.fill('#stg-prod-q', 'pelican'); await boss.waitForSelector('#bc-lookup-modal.open'); await sleep(80);
    const opts = await boss.textContent('#bclk-body');
    assert.match(opts, /Pelican 7600 flashlight/); assert.doesNotMatch(opts, /Roco/); assert.doesNotMatch(opts, /flash light/);   // same unit only, not itself
    await boss.keyboard.press('Enter'); await sleep(150); await boss.fill('#stg-qty', '3'); await boss.fill('#stg-why', 'Typed wrong on the purchase invoice'); await sleep(100);
    assert.match(await boss.textContent('#stg-result'), /Pelican 7600 flash light 3 → 0 · Pelican 7600 flashlight 0 → 3 \(1,860\.00 at 620\.00\)/);
    await shot(boss, 'V2685_change_item');
    await boss.click('#stg-save'); await sleep(900);
    const items = Object.fromEntries(docs('stockItems/').map(d => [d.itemKey, d]));
    assert.deepEqual([items['p_p-typo'].qty, items['p_p-pel'].qty, items['p_p-pel'].value], [0, 3, 1860]);
    assert.equal(docs('stockChanges/')[0].reason, 'Typed wrong on the purchase invoice');
    await boss.waitForSelector('#st-view-modal.open'); await sleep(500);
    assert.match(await boss.textContent('#stv-moves'), /Changed from ←[\s\S]*Pelican 7600 flash light[\s\S]*Typed wrong/);
    // staff don't see Change Item
    await aisha.evaluate(() => { showPage('stock'); openStockItem('p_p-pel'); }); await aisha.waitForSelector('#st-view-modal.open'); await sleep(300);
    assert.doesNotMatch(await aisha.textContent('#st-view-modal .modal-footer'), /Change Item/);
    // cancel the change (administrator)
    await boss.click('#stv-moves .pi-cancel-pay'); await boss.waitForSelector('#st-cancel-modal.open');
    await boss.fill('#stc-why', 'Chosen by mistake'); await boss.click('#stc-save'); await sleep(900);
    const back = Object.fromEntries(docs('stockItems/').map(d => [d.itemKey, d]));
    assert.deepEqual([back['p_p-typo'].qty, back['p_p-pel'].qty], [3, 0]);
    assert.equal(docs('stockChanges/')[0].status, 'Voided');
  } finally { await h.close(); }
});

test('V268.5 + New Product on a stock line: only products, a look-alike warning, saved to Products', { timeout: 300000 }, async () => {
  const h = await startHarness({ appDir, playwright, executablePath: process.env.CHROMIUM_PATH });
  try {
    h.fs.load({
      'system/deliveryNoteStorage': { mode: 'independent', minClientVersion: 260 }, 'system/invoiceStorage': { mode: 'independent' }, 'system/accessControl': { adminUids: ['u-boss'] },
      'suppliers/sup1': { id: 'sup1', company: 'ABC Trading Est' },
      'products/p-pel': { id: 'p-pel', name: 'Pelican 7600 flashlight', code: 'PEL7600', uom: 'Pcs' },
    });
    const aisha = await h.newUser({ uid: 'u-aisha', email: 'aisha@x', name: 'Aisha' });
    await icons(aisha); await h.open(aisha);
    const docs = prefix => Object.entries(h.fs.dump(prefix)).filter(([k]) => k.split('/').length === 2).map(([, d]) => d);
    await aisha.evaluate(() => { showPage('purchaseinvoices'); openNewPurchaseInvoice(); }); await aisha.waitForSelector('#pi-new-modal.open');
    // supplier: type-and-search
    await aisha.fill('#pe-supplier-q', 'abc'); await aisha.waitForSelector('#bc-lookup-modal.open'); await aisha.keyboard.press('Enter'); await sleep(120);
    assert.equal(await aisha.inputValue('#pe-supplier'), 'sup1');
    await aisha.evaluate(() => piAddStockLine()); await sleep(100);
    // typed text that matches nothing → error, can't save
    await aisha.fill('#pe-lines .pi-stock-desc', 'Pelican 7600 flash light'); await sleep(100);
    assert.match(await aisha.textContent('#pi-prod-list'), /Pelican 7600 flashlight[\s\S]*New Product “Pelican 7600 flash light”…/);
    await aisha.keyboard.press('Escape'); await aisha.click('#pe-invno'); await sleep(300);
    assert.match(await aisha.textContent('#pe-lines'), /Choose a product from the list, or add it with \+ New Product/);
    assert.match(await aisha.textContent('#pe-todo'), /Lines? to complete/); assert.equal(await aisha.isDisabled('#pe-save'), true);
    // + New Product: look-alike warning first, then added
    await aisha.click('#pe-lines .pi-stock-desc'); await sleep(100);
    await aisha.click('#pi-prod-list .pi-np-opt'); await aisha.waitForSelector('#pi-np-modal.open');
    assert.match(await aisha.textContent('#pnp-dup'), /Did you mean “Pelican 7600 flashlight” \(PEL7600\)\?/);
    await aisha.fill('#pnp-code', 'PEL7600'); await aisha.click('#pnp-save'); await sleep(100);
    assert.match(await aisha.textContent('#pnp-err'), /code PEL7600 is already used/);
    await aisha.fill('#pnp-code', 'PEL7600-B'); await aisha.fill('#pnp-brand', 'Pelican');
    await shot(aisha, 'V2685_new_product');
    await aisha.click('#pnp-save'); await sleep(100);
    assert.match(await aisha.textContent('#pnp-save'), /Yes, add a new product/);
    await aisha.click('#pnp-save'); await sleep(700);
    const p = docs('products/').find(x => x.code === 'PEL7600-B');
    assert.ok(p, 'saved to Products'); assert.deepEqual([p.name, p.uom, p.brand, p.createdFrom, p.createdBy], ['Pelican 7600 flash light', 'Pcs', 'Pelican', 'purchase-invoice', 'Aisha']);
    assert.equal(await aisha.evaluate(() => piState().lines[0].productId), p.id);
    assert.match(await aisha.textContent('#pe-lines'), /PEL7600-B · Pcs ·\s+Product/);
    // Administration → Purchase Settings: + New Product for administrators only
    const boss = await h.newUser({ uid: 'u-boss', email: 'boss@x', name: 'Musthafa KM' }); await h.open(boss);
    await boss.evaluate(() => BizCorePI.service.savePurchaseSettings({ costLimitPct: 5, costLimitAction: 'reason', discountMode: 'invoice', roundingLimit: 1, vatRate: 15, profitVisibility: 'admins', editMode: 'limited-admin', editDays: 7, newProductRight: 'admins' }));
    assert.equal(h.fs.peek('settings/purchasing').newProductRight, 'admins');
    await sleep(400);
    await aisha.evaluate(() => piAddStockLine()); await sleep(100);
    await aisha.fill('#pe-lines tr[data-i="1"] .pi-stock-desc', 'Something new'); await sleep(100);
    const l2 = await aisha.textContent('#pi-prod-list');
    assert.doesNotMatch(l2, /New Product/); assert.match(l2, /Ask an administrator to add it/);
  } finally { await h.close(); }
});
