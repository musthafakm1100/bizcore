/** BROWSER (simulator): V270.2.6 — RFQ entry (Layout C): request type, product / service lines, requirements,
 *  standard date fields, save confirmed by Firebase, Save & New, lines read only after pricing, first pricing from the lines. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { startHarness } from './harness.mjs';

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const playwright = createRequire(process.env.PLAYWRIGHT_FROM || import.meta.url)('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const p2 = n => String(n).padStart(2, '0');
const now = new Date(), iso = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const dmy = d => `${p2(d.getDate())}-${p2(d.getMonth() + 1)}-${d.getFullYear()}`;

async function confirmDialogs(p) {
  // click through the save confirmations (blank reference / duplicate / final confirmation)
  for (let i = 0; i < 4; i++) {
    const b = await p.$('.safe-exit-dialog button.primary, .safe-exit-dialog .btn-primary, [class*="safe"] button.primary');
    if (!b) { await sleep(150); continue; }
    await b.click(); await sleep(250);
  }
}

test('V270.2.6 RFQ entry: type, lines, requirements, save, pricing', { timeout: 240000 }, async () => {
  const h = await startHarness({ appDir, playwright, executablePath: process.env.CHROMIUM_PATH });
  try {
    h.fs.load({
      'system/deliveryNoteStorage': { mode: 'independent', minClientVersion: 260 }, 'system/invoiceStorage': { mode: 'independent' },
      'system/accessControl': { adminUids: ['u-boss'] },
      'customers/c1': { id: 'c1', company: 'MOHG', contacts: [{ name: 'Faisal', isDefault: true }] },
      'products/p1': { id: 'p1', code: 'LED-PNL-60', name: 'LED Panel Light 60x60 40W', uom: 'Pcs', price: 50 },
      'products/p2': { id: 'p2', code: 'CBL-3C-4', name: 'Power Cable 3 Core 4mm', uom: 'Mtr', price: 9 },
      'products/p3': { id: 'p3', code: 'SRV-INST-01', name: 'Installation labour service', type: 'service', uom: 'Lot', price: 100 },
      'employees/e1': { id: 'e1', name: 'Musthafa', roles: ['Sales'], active: true },
    });
    const p = await h.newUser({ uid: 'u-boss', email: 'boss@x', name: 'Musthafa KM' });
    await h.open(p); await sleep(300);
    await p.evaluate(() => { showPage('rfq'); openNewRFQ(); });
    await p.waitForSelector('#rfq-modal.open');

    // header: dark, theme colour; dates are the standard date field (DD-MM-YYYY)
    const hd = await p.evaluate(() => { const h = document.querySelector('#rfq-modal .rq-hd'); const blue = getComputedStyle(document.documentElement).getPropertyValue('--blue'); return { bg: getComputedStyle(h).backgroundColor, blue }; });
    assert.notEqual(hd.bg, 'rgb(255, 255, 255)', 'dark header');
    assert.equal(await p.inputValue('#rfq-date'), dmy(now));
    assert.equal(await p.evaluate(() => !!document.getElementById('rfq-date')._bcdate), true, 'BCDate attached');
    // V271.5.41: Request type is required — nothing is pre-selected; only Requirements / Attachments show until one is picked
    assert.deepEqual(await p.$$eval('#rfq-tabs .rq-tb', b => b.map(x => x.dataset.tab)), ['reqs', 'att']);
    assert.equal(await p.evaluate(() => BCRfq.validate()?.title), 'Request type required');
    assert.equal(await p.evaluate(() => document.getElementById('rfq-type-group').classList.contains('is-missing')), true, 'amber label + message shown after validate()');
    // picking Product: Items · Requirements · Attachments; the required hint clears
    await p.click('#rfq-type-seg label[data-type="product"]');
    assert.deepEqual(await p.$$eval('#rfq-tabs .rq-tb', b => b.map(x => x.dataset.tab)), ['product', 'reqs', 'att']);
    assert.equal(await p.evaluate(() => document.getElementById('rfq-type-group').classList.contains('is-missing')), false, 'hint clears once a type is picked');

    // V270.2.8 dates: Response due = received + 48 h, recalculated at once; no future date; backdate limit (Administration)
    const ago = n => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
    const plus = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
    assert.equal(await p.inputValue('#rfq-due'), dmy(plus(now, 2)));
    await p.fill('#rfq-date', dmy(ago(5)));
    assert.equal(await p.inputValue('#rfq-due'), dmy(plus(ago(5), 2)), 'due follows the received date while typing');
    await p.click('#rfq-date ~ .bcd-btn'); await p.waitForSelector('.bcd-pop');
    assert.equal(await p.getAttribute(`.bcd-pop .bcd-day[data-iso="${iso(plus(now, 1))}"]`, 'aria-disabled').catch(() => 'true'), 'true', 'tomorrow cannot be picked');
    await p.click(`.bcd-pop .bcd-day[data-iso="${iso(ago(1))}"]`);
    assert.equal(await p.inputValue('#rfq-due'), dmy(plus(ago(1), 2)), 'due follows a picked date');
    await p.evaluate(() => { settings.rfqDefaultHours = 72; });
    await p.fill('#rfq-date', dmy(now));
    assert.equal(await p.inputValue('#rfq-due'), dmy(plus(now, 3)), 'the response period from Administration');
    await p.evaluate(() => { settings.rfqDefaultHours = 48; });
    await p.fill('#rfq-date', dmy(now));
    let prob = await p.evaluate(() => { BCDate.setISO(document.getElementById('rfq-date'), (d => { d.setDate(d.getDate() + 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })(new Date())); return BCRfq.validate(); });
    assert.equal(prob && prob.title, 'Date received is in the future');
    await p.evaluate(() => { settings.rfqBackdateDays = 14; });
    prob = await p.evaluate(v => { BCDate.setISO(document.getElementById('rfq-date'), v); return BCRfq.validate(); }, iso(ago(20)));
    assert.equal(prob, null, 'V270.4.3: an administrator has the Special Right "Backdate beyond the limit"');
    prob = await p.evaluate(v => { const r = window.bcRight; window.bcRight = id => id === 'backdate' ? false : r(id); BCDate.setISO(document.getElementById('rfq-date'), v); const out = BCRfq.validate(); window.bcRight = r; return out; }, iso(ago(20)));
    assert.equal(prob && prob.title, 'Date received is too far back');
    assert.match(prob.message, /14 days/);
    prob = await p.evaluate(v => { BCDate.setISO(document.getElementById('rfq-date'), v); return BCRfq.validate(); }, iso(ago(10)));
    assert.equal(prob, null);
    await p.evaluate(() => { settings.rfqBackdateDays = 30; });
    await p.fill('#rfq-date', dmy(now));
    assert.equal(await p.inputValue('#rfq-due'), dmy(plus(now, 2)));
    // Administration field
    assert.equal(await p.evaluate(() => !!document.getElementById('s-rfqbackdays')), true);

    // customer
    await p.fill('#rfq-cust-search', 'MOH'); await sleep(200);
    await p.evaluate(() => selectRFQCustomer('c1'));
    await p.fill('#rfq-ref', 'RFQ 5512 — Lighting upgrade and maintenance, Building C (Phase 2)');

    // line 1 from the Item Master (search, Enter → qty)
    // V270.2.8: no code column — the description is the Item Master search; ↓ + Enter picks, Enter alone keeps the text
    assert.deepEqual(await p.$$eval('#rfq-panel-product thead th', t => t.map(x => x.textContent.trim()).filter(Boolean)), ['SL', 'Item / Description', 'Qty', 'UOM', 'Remarks / Specs']);
    const desc1 = '#rfq-panel-product tr[data-line]:nth-child(1) [data-f="desc"]';
    await p.click(desc1); await p.keyboard.type('led');
    await p.waitForSelector('.rq-dd .rq-ddi[data-i="0"]');
    assert.match(await p.textContent('.rq-dd .rq-ddi.on'), /Keep “led” as typed/);
    assert.doesNotMatch(await p.textContent('.rq-dd'), /LED-PNL-60/, 'no item code shown');
    await p.keyboard.press('ArrowDown');
    await p.keyboard.press('Enter');
    assert.equal(await p.evaluate(() => document.activeElement.dataset.f), 'qty', 'focus moves to Qty');
    await p.keyboard.type('120');
    await p.keyboard.press('Enter');   // adds line 2
    assert.equal(await p.locator('#rfq-panel-product tr[data-line]').count(), 2);
    // line 2: free text (not in master)
    await p.keyboard.type('Emergency exit sign 3h');
    await p.waitForSelector('.rq-dd .rq-ddfree');
    await p.keyboard.press('Enter');   // keep as typed
    await p.keyboard.type('14');
    await p.fill('#rfq-panel-product tr[data-line]:nth-child(2) [data-f="remarks"]', 'Philips or equivalent');
    let st = await p.evaluate(() => BCRfq.collect());
    assert.equal(st.rfqLines.length, 2);
    assert.deepEqual([st.rfqLines[0].productId, st.rfqLines[0].code, st.rfqLines[0].desc, st.rfqLines[0].qty, st.rfqLines[0].uom], ['p1', 'LED-PNL-60', 'LED Panel Light 60x60 40W', 120, 'Pcs']);
    assert.deepEqual([st.rfqLines[1].productId, st.rfqLines[1].desc, st.rfqLines[1].qty, st.rfqLines[1].remarks], ['', 'Emergency exit sign 3h', 14, 'Philips or equivalent']);
    // reorder with Alt+↑ (display order changes, ids stay)
    const ids = st.rfqLines.map(l => l.lineId);
    await p.focus('#rfq-panel-product tr[data-line]:nth-child(2) [data-f="desc"]');
    await p.keyboard.press('Alt+ArrowUp');
    st = await p.evaluate(() => BCRfq.collect());
    assert.deepEqual(st.rfqLines.map(l => l.lineId), [ids[1], ids[0]]);
    assert.deepEqual(st.rfqLines.map(l => l.sortOrder), [1, 2]);
    // paste from Excel
    await p.evaluate(() => BCRfq._pasteRows('Cable tray 300mm\t40\tPcs\nCable gland 20mm\t200\tPcs', 'product'));
    assert.equal((await p.evaluate(() => BCRfq.collect())).rfqLines.length, 4);
    // delete a line
    await p.click('#rfq-panel-product tr[data-line]:nth-child(4) .rq-del');
    assert.equal((await p.evaluate(() => BCRfq.collect())).rfqLines.length, 3);

    // Mixed: Items · Services · Scope & requirements · Attachments; a service line
    await p.click('#rfq-type-seg label[data-type="mixed"]');
    assert.deepEqual(await p.$$eval('#rfq-tabs .rq-tb', b => b.map(x => x.dataset.tab)), ['product', 'service', 'reqs', 'att']);
    // V271.5.41: Item Description now searches only the matching half of the Item Master — a Product line never matches a service-only item
    await p.click('#rfq-panel-product [data-act="add"]');
    await p.keyboard.type('install');
    await p.waitForSelector('.rq-dd .rq-ddfree');
    assert.doesNotMatch(await p.textContent('.rq-dd'), /Installation labour service/, 'a Product line does not match a service-only item');
    await p.keyboard.press('Enter');   // keep as typed, then discard the whole line
    await p.click('#rfq-panel-product tr[data-line]:last-child .rq-del');
    assert.equal((await p.evaluate(() => BCRfq.collect())).rfqLines.length, 3);
    await p.click('#rfq-tabs [data-tab="service"]');
    // …while a Service line does match it
    await p.click('#rfq-panel-service tr[data-line]:nth-child(1) [data-f="desc"]');
    await p.keyboard.type('install');
    await p.waitForSelector('.rq-dd');
    assert.match(await p.textContent('.rq-dd'), /Installation labour service/, 'a Service line matches a service item');
    await p.keyboard.press('Enter');   // keep as typed for now; overwritten with the real text next
    await p.fill('#rfq-panel-service tr[data-line]:nth-child(1) [data-f="desc"]', 'Installation & commissioning');
    await p.fill('#rfq-panel-service tr[data-line]:nth-child(1) [data-f="qty"]', '1');
    assert.equal(await p.inputValue('#rfq-panel-service tr[data-line]:nth-child(1) [data-f="uom"]'), 'Lot');
    // requirements tab adapts
    await p.keyboard.press('Alt+3');
    assert.equal(await p.isVisible('#rfq-panel-reqs'), true);
    assert.equal(await p.textContent('#rfq-site-lbl'), 'Delivery / site location');
    assert.equal(await p.isVisible('#rfq-duration'), true);
    await p.fill('#rfq-site', 'Building C, Al Malaz');
    await p.fill('#rfq-reqdate', '151126'); await p.press('#rfq-reqdate', 'Tab');
    assert.equal(await p.inputValue('#rfq-reqdate'), '15-11-2026');
    await p.fill('#rfq-duration', '3 weeks');
    await p.fill('#rfq-desc', 'Approved brands: Philips / Schneider.');

    // validation: a line with no quantity
    await p.click('#rfq-tabs [data-tab="product"]');
    await p.fill('#rfq-panel-product tr[data-line]:nth-child(1) [data-f="qty"]', '');
    await p.evaluate(() => saveRFQ());
    await p.waitForSelector('.validation-dialog-overlay, #validation-dialog.open, .validation-dialog', { timeout: 5000 });
    assert.match(await p.evaluate(() => document.body.innerText), /has no quantity/);
    await p.evaluate(() => { document.querySelectorAll('.validation-dialog-overlay,.validation-dialog').forEach(x => x.remove()); const v = document.getElementById('validation-dialog'); if (v) v.classList.remove('open'); });
    await p.fill('#rfq-panel-product tr[data-line]:nth-child(1) [data-f="qty"]', '14');

    // save (Firebase confirms) → stored with type, lines, requirement fields
    await p.evaluate(() => saveRFQ()); await sleep(800);
    const saved = Object.values(h.fs.dump('rfqs/'))[0];
    assert.ok(saved, 'RFQ stored');
    assert.equal(saved.requestType, 'mixed');
    assert.deepEqual(saved.rfqLines.map(l => [l.kind, l.desc, l.qty]), [['product', 'Emergency exit sign 3h', 14], ['product', 'LED Panel Light 60x60 40W', 120], ['product', 'Cable tray 300mm', 40], ['service', 'Installation & commissioning', 1]]);
    assert.deepEqual([saved.site, saved.requiredDate, saved.duration, saved.date], ['Building C, Al Malaz', '2026-11-15', '3 weeks', iso(now)]);
    assert.equal(await p.evaluate(() => document.getElementById('rfq-modal').classList.contains('open')), false);
    assert.ok((await p.evaluate(() => window.__toasts)).some(t => /RFQ logged/.test(t.msg)));

    // (code kept internally for the master line)
    // the RFQ view lists the RFQ lines and the requirement details
    await p.evaluate(id => viewRFQ(id), saved.id); await p.waitForSelector('#rfq-view-modal.open');
    const view = await p.textContent('#rfq-view-body');
    assert.match(view, /Mixed/); assert.match(view, /Installation & commissioning/); assert.match(view, /Philips or equivalent/); assert.match(view, /Building C, Al Malaz/);
    // V271.5.41: a colored type badge sits in the header, right next to Close
    assert.equal(await p.textContent('#rfq-view-type-badge'), 'Mixed');
    assert.equal(await p.evaluate(() => document.getElementById('rfq-view-type-badge').firstElementChild.className), 'rv-type-badge rv-type-mixed');
    await p.evaluate(() => closeModal('rfq-view-modal'));

    // edit: loads type, lines, dates
    await p.evaluate(id => editRFQ(id), saved.id); await p.waitForSelector('#rfq-modal.open'); await sleep(300);
    assert.equal(await p.evaluate(() => BCRfq._state.type), 'mixed');
    assert.equal((await p.evaluate(() => BCRfq.collect())).rfqLines.length, 4);
    assert.equal(await p.isHidden('#rfq-save-new-btn'), true, 'no Save & New when editing');
    await p.evaluate(() => { clearDirty(); closeModal('rfq-modal'); });

    // first pricing starts from the RFQ lines (remarks added to the description)
    await p.evaluate(id => openPricingSheet(id), saved.id); await p.waitForSelector('#pricing-modal.open'); await sleep(500);
    const pr = await p.evaluate(() => [...document.querySelectorAll('#pricing-tbody tr.pr-row')].map(tr => [tr.querySelector('[data-role="desc"]').value, tr.querySelector('[data-role="qty"]').value, tr.dataset.rfqLineId || '']));
    assert.equal(pr.length, 4);
    assert.equal(pr[0][0], 'Emergency exit sign 3h — Philips or equivalent');
    assert.ok(pr.every(x => x[2]), 'pricing lines keep the RFQ line id');
    // save pricing with a cost → RFQ lines become read only
    await p.evaluate(() => { const tr = document.querySelector('#pricing-tbody tr.pr-row'); const b = tr.querySelector('[data-role="buy"]'); b.value = '10'; b.dispatchEvent(new Event('input', { bubbles: true })); });
    // (Pricing's own save needs a supplier and prices — unchanged; here the lines read from the screen are stored)
    const items = await p.evaluate(async id => { const r = rfqs.find(x => x.id === id); r.pricingItems = readPricingItemsFromDOM(); r.status = 'Pricing'; await saveRFQs(); return r.pricingItems; }, saved.id);
    assert.equal(items.length, 4);
    assert.ok(items.every(i => i.rfqLineId), 'saved pricing lines keep rfqLineId');
    assert.equal(h.fs.peek('rfqs/' + saved.id).pricingItems.length, 4);
    await p.evaluate(() => { try { clearPricingDirty?.(); } catch (e) {} closeModal('pricing-modal'); });
    await p.evaluate(id => editRFQ(id), saved.id); await p.waitForSelector('#rfq-modal.open'); await sleep(300);
    assert.equal(await p.evaluate(() => BCRfq._state.locked), true);
    assert.equal(await p.getAttribute('#rfq-panel-product tr[data-line]:nth-child(1) [data-f="desc"]', 'readonly'), '');
    assert.equal(await p.locator('#rfq-panel-product .rq-del').count(), 0);
    assert.match(await p.textContent('#rfq-tab-note'), /changed in Pricing/);
    // an update keeps the lines unchanged
    await p.fill('#rfq-ref', 'RFQ 5512 — updated subject');
    await p.evaluate(() => saveRFQ()); await sleep(800);
    assert.equal(h.fs.peek('rfqs/' + saved.id).rfqLines.length, 4);
    assert.equal(h.fs.peek('rfqs/' + saved.id).ref, 'RFQ 5512 — updated subject');

    // old RFQ (no type, no lines) opens as Product with an empty line; saving adds nothing unexpected
    // (V271.3.1: saved as a real record — a save writes only the RFQ being saved, never other records held on the screen)
    await p.evaluate(() => { rfqs.push({ id: 'r-old', rfqNo: 'RFQ-2609-0001', company: 'MOHG', custId: 'c1', date: '2026-09-10', due: '2026-09-12', status: 'New', desc: 'Old free text', pricingItems: [] }); return saveRFQs([rfqs.find(r => r.id === 'r-old')]); });
    await p.evaluate(() => editRFQ('r-old')); await p.waitForSelector('#rfq-modal.open'); await sleep(200);
    assert.equal(await p.evaluate(() => BCRfq._state.type), 'product');
    assert.equal(await p.inputValue('#rfq-desc'), 'Old free text');
    assert.equal(await p.inputValue('#rfq-date'), '10-09-2026');
    await p.evaluate(() => { clearDirty(); closeModal('rfq-modal'); });

    // Save & New → a blank new form after the save
    await p.evaluate(() => openNewRFQ()); await p.waitForSelector('#rfq-modal.open');
    await p.evaluate(() => selectRFQCustomer('c1'));
    await p.click('#rfq-type-seg label[data-type="product"]');
    await p.fill('#rfq-ref', 'Second RFQ');
    await p.evaluate(() => { rfqSaveNewAfter = true; return saveRFQ(); }); await sleep(1200);
    assert.ok(Object.values(h.fs.dump('rfqs/')).some(r => r && r.ref === 'Second RFQ'), 'second RFQ stored');
    assert.equal(await p.evaluate(() => document.getElementById('rfq-modal').classList.contains('open')), true, 'a new blank form is open');
    assert.equal(await p.inputValue('#rfq-ref'), '');

    // a save Firebase refuses: no success message, the form stays open, the list keeps the stored version
    await p.evaluate(() => { clearDirty(); closeModal('rfq-modal'); });
    await p.evaluate(() => editRFQ('r-old')); await p.waitForSelector('#rfq-modal.open'); await sleep(200);
    await p.fill('#rfq-ref', 'Changed but refused');
    const toastsBefore = (await p.evaluate(() => window.__toasts)).length;
    for (let i = 0; i < 6; i++) h.fs.injectFault('before');
    await p.evaluate(() => saveRFQ()); await sleep(1500);
    const tt = (await p.evaluate(() => window.__toasts)).slice(toastsBefore);
    assert.ok(tt.some(t => t.type === 'error' && /RFQ not saved/.test(t.title)), JSON.stringify(tt));
    assert.ok(!tt.some(t => /RFQ updated/.test(t.msg)), 'no success message');
    assert.equal(await p.evaluate(() => document.getElementById('rfq-modal').classList.contains('open')), true, 'form stays open');
    assert.notEqual(await p.evaluate(() => rfqs.find(r => r.id === 'r-old').ref), 'Changed but refused');
    h.fs.raw && h.fs.raw.clearFaults && h.fs.raw.clearFaults();
    assert.deepEqual(p.__errors, []);
  } finally { await h.close(); }
});
