/** BROWSER (simulator): V270.4.10 (Package B1) — Goods / Service with ITM / SRV codes, the reorganised product form
 *  (service hides brand / model / image, type fixed once coded), image shown at once and pasted with Ctrl+V, product
 *  view with documents / price history / change history, every field change recorded, unit check. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { startHarness } from './harness.mjs';
const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const playwright = createRequire(process.env.PLAYWRIGHT_FROM || import.meta.url)('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
const SEED = {
  'system/deliveryNoteStorage': { mode: 'independent', minClientVersion: 260 },
  'system/invoiceStorage': { mode: 'independent' },
  'system/accessControl': { adminUids: ['u-boss'] },
  'products/p-tape': { id: 'p-tape', type: 'goods', code: 'ITM-000312', name: 'Masking Tape 2" x 50m', uom: 'Roll', price: 6, category: 'Packing' },
  'quotations/Q-1': { id: 'Q-1', qno: 'Q-2610-0014', date: '2026-10-05', company: 'SNC Lavalin Arabia', status: 'Sent', vatRate: 15,
    items: [{ desc: 'Masking tape 2 inch', qty: 50, uom: 'Roll', up: 6, prodId: 'p-tape' }, { desc: 'Other', qty: 1, uom: 'Pcs', up: 1 }] },
};

test('V270.4.10 products: Goods / Service, form, image paste, view, history, unit check', { timeout: 300000 }, async () => {
  const h = await startHarness({ appDir, playwright, executablePath: process.env.CHROMIUM_PATH });
  try {
    h.fs.load(SEED);
    const p = await h.newUser({ uid: 'u-boss', email: 'boss@x', name: 'Boss' });
    await h.open(p);
    const peekP = () => Object.values(h.fs.dump('products/'));

    // 1. new service: brand / model / image hidden, "Service name", SRV code
    await p.evaluate(() => openAddProduct()); await p.waitForSelector('#prod-modal.open');
    assert.equal(await p.isVisible('#pm-brand'), true); assert.equal(await p.isVisible('#pm-img-area'), true);
    await p.check('#pm-type-service', { force: true }); await sleep(100);
    assert.equal(await p.isVisible('#pm-brand'), false); assert.equal(await p.isVisible('#pm-img-area'), false);
    assert.equal(await p.textContent('#pm-name-label'), 'Service name *'); assert.equal(await p.isVisible('#pm-svc-note'), true);
    assert.equal(await p.textContent('#prod-modal-title'), 'Add service');
    await p.fill('#pm-name', 'AC maintenance'); await p.selectOption('#pm-uom', { index: 0 });
    await p.keyboard.press('Control+s'); await sleep(1200);
    const srv = peekP().find(x => x.name === 'AC maintenance');
    assert.deepEqual([srv.type, srv.code, srv.image], ['service', 'SRV-000001', null]);

    // 2. new goods with an image pasted (Ctrl+V): shown at once, uploaded, saved; ITM code continues
    await p.evaluate(() => openAddProduct()); await p.waitForSelector('#prod-modal.open');
    assert.equal(await p.isChecked('#pm-type-goods'), true, 'Goods by default');
    await p.fill('#pm-name', 'Insect Killer Light 32W'); await p.fill('#pm-brand', 'Sylvania');
    await p.evaluate(b64 => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      const dt = new DataTransfer(); dt.items.add(new File([u], 'shot.png', { type: 'image/png' }));
      document.getElementById('pm-name').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }, PNG);
    await p.waitForFunction(() => document.getElementById('pm-img-area').classList.contains('has-img') && /^data:image/.test(document.getElementById('pm-img-thumb').src), null, { timeout: 5000 });
    assert.equal(await p.isVisible('#pm-img-thumb'), true, 'picture shown at once');
    await p.waitForFunction(() => document.getElementById('pm-img-area')._imagePath, null, { timeout: 8000 });
    await p.click('#pm-save-btn'); await sleep(1200);
    const lamp = peekP().find(x => x.name === 'Insect Killer Light 32W');
    assert.equal(lamp.type, 'goods'); assert.equal(lamp.code, 'ITM-000313', 'continues after the highest existing ITM code? counter');
    assert.ok(lamp.image && lamp.imagePath, 'image saved');

    // 3. edit: type fixed once coded; every field change recorded; unit change on a used product asks first
    await p.evaluate(() => openEditProduct('p-tape')); await p.waitForSelector('#prod-modal.open');
    assert.equal(await p.isDisabled('#pm-type-service'), true, 'type fixed once the product has its code');
    await p.fill('#pm-price', '6.5'); await p.fill('#pm-brand', '3M');
    await p.selectOption('#pm-uom', { index: 1 }); await sleep(100);
    assert.match(await p.textContent('#pm-uom-note'), /Used in 1 document as Roll/);
    const saving = p.evaluate(() => saveProduct());
    await p.waitForSelector('#app-confirm-overlay'); assert.match(await p.textContent('#app-confirm-overlay'), /used in 1 document.*Roll/s);
    await p.click('#confirm-ok'); await saving; await sleep(1000);
    const tape = h.fs.peek('products/p-tape');
    const fields = tape.changeLog.map(l => l.field).sort();
    assert.deepEqual(fields, ['brand', 'price', 'uom']);
    assert.ok(tape.changeLog.every(l => l.by === 'Boss' && l.at));
    assert.deepEqual(tape.changeLog.find(l => l.field === 'price'), { ...tape.changeLog.find(l => l.field === 'price'), from: '6', to: '6.5' });

    // 3b. a product with stock: the unit can't change
    const lampId = lamp.id;
    await p.evaluate(id => { const k = BizCorePI.core.itemKeyOf({ productId: id }); BizCorePI.stock.set(k, { itemKey: k, productId: id, qty: 5, uom: 'Pcs' }); openEditProduct(id); }, lampId);
    await p.waitForSelector('#prod-modal.open'); await p.selectOption('#pm-uom', { index: 2 }); await sleep(100);
    assert.match(await p.textContent('#pm-uom-note'), /In stock as .* \(5\) — the unit can't change/);
    await p.evaluate(() => saveProduct()); await p.waitForSelector('#validation-dialog.open');
    assert.match(await p.textContent('#validation-dialog-message'), /5 .* in stock/);
    await p.click('#validation-dialog-ok'); await p.evaluate(() => { clearDirty(); closeModal('prod-modal'); });
    assert.equal(h.fs.peek('products/' + lampId).uom, lamp.uom, 'unit unchanged');

    // 4. product view: documents from loaded data, price history, change history
    await p.evaluate(() => viewProduct('p-tape')); await p.waitForSelector('#prod-view-modal.open');
    assert.match(await p.textContent('#prod-view-body .pv-table'), /Q-2610-0014[\s\S]*SNC Lavalin Arabia[\s\S]*Masking tape 2 inch[\s\S]*50[\s\S]*6\.00/);
    assert.equal(await p.locator('#prod-view-body .pv-table tbody tr').count(), 1, 'only the linked line');
    await p.click('#prod-view-body .pv-tab:has-text("Price history")');
    assert.match(await p.textContent('#prod-view-body .pv-pane'), /Quoted/);
    await p.click('#prod-view-body .pv-tab:has-text("Change history")');
    assert.match(await p.textContent('#prod-view-body .pv-pane'), /Boss[\s\S]*Default price: 6 → 6\.5|Boss[\s\S]*Default price: 6\s*6\.5/);
    await p.click('#prod-view-body .pv-tab:has-text("Documents")'); await p.click('#pv-older-btn'); await sleep(800);
    assert.match(await p.textContent('#prod-view-body .pv-more'), /Including older documents/);
    // list: Type column and filter
    await p.evaluate(() => { closeModal('prod-view-modal'); showPage('products'); }); await sleep(300);
    // V271.6: Master Data → Services (the Type filter is replaced by the Products / Services entries)
    await p.evaluate(() => { showPage('masters'); switchMastersTab('services'); }); await sleep(300);
    assert.deepEqual(await p.$$eval('#products-tbody tr', r => r.map(x => x.textContent.includes('AC maintenance'))), [true]);
    assert.equal(await p.evaluate(() => docPrintItemCode('SRV-000001')), '', 'service code not printed');
  } finally { await h.close(); }
});
