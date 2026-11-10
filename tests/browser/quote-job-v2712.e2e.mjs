/** BROWSER (simulator): V271.2 — quotation from the Contracting estimate (CQ_1, CQ_2) and Award → Job (CJ_1).
 *  Real index.html + js/estimate.js + js/jobs.js; the database is the shared in-memory simulator (no rules). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { startHarness } from './harness.mjs';

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const playwright = createRequire(process.env.PLAYWRIGHT_FROM || import.meta.url)('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SHOTS = process.env.BC_SHOTS || '';
const L = (id, k, o) => ({ id, ...o });
// estimate V1: A (2 items) + B (1 item); overheads 5 %, contingency 3 %, markup 15 %, lump sum 23,600
const EST = {
  rfqId: 'r1', version: 1, status: 'Saved', created: '2026-11-01T08:00:00Z', updated: '2026-11-01T08:00:00Z', savedBy: 'Musthafa KM',
  site: 'Olaya Tower, 7th floor', duration: '21 days', estimateDate: '2026-11-01', quoteStyle: 'lumpsum', overheadPct: 5, contingencyPct: 3, markupPct: 15, roundTo: 23600, internalNotes: '',
  sections: [
    { id: 's1', title: 'Partitions & painting', items: [
      { id: 'i1', desc: 'Gypsum board partition 12.5 mm, double side', unit: 'm²', qty: 120, build: { material: [L('l1', 'material', { desc: 'Gypsum board', qty: 90, unit: 'Nos', rate: 28 })], manpower: [L('l2', 'manpower', { trade: 'Gypsum Carpenter', supplierId: 's-waha', supplierName: 'Al Waha Manpower Co.', men: 3, days: 5, rate: 160 })], subcontract: [], other: [L('l3', 'other', { desc: 'Scaffolding', qty: 5, unit: 'Day', rate: 60 })] } },
      { id: 'i2', desc: 'Emulsion paint, 2 coats on walls', unit: 'm²', qty: 600, build: { material: [], manpower: [], subcontract: [L('l4', 'subcontract', { desc: 'Painting', supplierId: 's-paint', supplierName: 'Pro Paint', qty: 600, unit: 'm²', rate: 13 })], other: [] } }] },
    { id: 's2', title: 'Electrical', items: [
      { id: 'i3', desc: 'Supply & install LED panel 60x60', unit: 'Nos', qty: 40, build: { material: [L('l5', 'material', { desc: 'LED panel', qty: 40, unit: 'Nos', rate: 110 })], manpower: [L('l6', 'manpower', { trade: 'Electrician', supplierId: 's-waha', supplierName: 'Al Waha Manpower Co.', men: 2, days: 4, rate: 200 })], subcontract: [], other: [] } }] },
  ],
};
const DATA = {
  'system/deliveryNoteStorage': { mode: 'independent', minClientVersion: 260 }, 'system/invoiceStorage': { mode: 'independent' }, 'system/accessControl': { adminUids: ['u-boss'] },
  'suppliers/s-waha': { id: 's-waha', company: 'Al Waha Manpower Co.', supplierKinds: ['manpower'] },
  'suppliers/s-paint': { id: 's-paint', company: 'Pro Paint', supplierKinds: ['subcontractor'] },
  'customers/c1': { id: 'c1', company: 'Al Rajhi Office Fit-out', city: 'Riyadh' },
  'employees/e1': { id: 'e1', name: 'Rashid K.', designation: 'Site Supervisor', roles: ['Operations'], active: true },
  'rfqs/r1': { id: 'r1', rfqNo: 'RFQ-2611-0012', company: 'Al Rajhi Office Fit-out', custId: 'c1', ref: 'ENQ-778', contact: '', status: 'Pricing', date: '2026-11-01', due: '2026-11-05', created: '2026-11-01T08:00:00Z',
    requestType: 'contracting', site: 'Olaya Tower, 7th floor', currentEstimateVersion: 1, estimateIndex: [{ version: 1, status: 'Saved', created: '2026-11-01T08:00:00Z', updated: '2026-11-01T08:00:00Z', offerPrice: 23600 }] },
  'rfqs/r1/estimates/v1': EST,
};

test('V271.2 quotation from the estimate (both print styles, locked prices) and Award → Job', { timeout: 300000 }, async () => {
  const h = await startHarness({ appDir, playwright, executablePath: process.env.CHROMIUM_PATH });
  try {
    h.fs.load(DATA);
    const boss = await h.newUser({ uid: 'u-boss', email: 'boss@x', name: 'Musthafa KM' });
    await h.open(boss);
    await boss.waitForFunction(() => typeof window.bcOpenEstimate === 'function' && window.BCJobs && typeof viewRFQ === 'function');
    await boss.addStyleTag({ content: '#toast{pointer-events:none!important}' });
    const offer = await boss.evaluate(e => BCEst.calc(e).offer, EST);
    assert.equal(offer, 23600);

    /* ── 1. Estimation → Create Quotation: the Quotation Entry with the estimate's sections, items and lump sum ── */
    await boss.evaluate(() => bcOpenEstimate('r1'));
    await boss.waitForFunction(() => BCEst.state()?.version === 1 && !document.getElementById('es-quote').hidden);
    assert.equal(await boss.textContent('#es-quote'), 'Create Quotation');
    await boss.click('#es-quote');
    await boss.waitForFunction(() => document.getElementById('quote-modal').classList.contains('open'));
    const q1 = await boss.evaluate(() => {
      const rows = [...document.querySelectorAll('#items-tbody tr')];
      return { kinds: rows.map(r => r.dataset.lineType), heads: rows.filter(r => r.dataset.lineType === 'heading').map(r => r.querySelector('.quote-special-text')?.value),
        qty: rows.filter(r => r.dataset.lineType === 'item').map(r => [r.querySelector('[data-quote-qty]').value, r.querySelector('select')?.value]),
        locked: rows.filter(r => r.dataset.lineType === 'item').every(r => r.querySelector('[data-quote-price]').readOnly && r.querySelector('[data-quote-qty]').readOnly),
        net: window._qtTotals.lineNet, card: !document.getElementById('qt-est-card').hidden, type: currentQuoteType, title: document.getElementById('modal-title').textContent };
    });
    assert.deepEqual(q1.kinds, ['heading', 'item', 'item', 'heading', 'item']);
    assert.deepEqual(q1.heads, ['Partitions & painting', 'Electrical']);
    assert.deepEqual(q1.qty.map(x => x[1]), ['m²', 'm²', 'Nos']);
    assert.equal(q1.locked, true); assert.equal(q1.card, true); assert.equal(q1.type, 'contracting');
    assert.equal(Math.round(q1.net * 100), 2360000, 'the lines add up exactly to the lump sum');
    assert.match(q1.title, /Estimation V1 · RFQ-2611-0012/);
    if (SHOTS) await boss.screenshot({ path: SHOTS + '/CQ_1_live.png' });
    // Print Style: With Section Totals; a negotiated quotation discount of 500
    await boss.click('#qt-est-card input[value="sections"]');
    await boss.evaluate(() => { const d = document.getElementById('f-discount'); d.value = '500'; d.dispatchEvent(new Event('input', { bubbles: true })); calcTotals(); });
    // a removed estimate line stops the save
    const blocked = await boss.evaluate(async () => {
      const tr = document.querySelectorAll('#items-tbody tr[data-est-item]')[2], parent = tr.parentElement, next = tr.nextSibling;
      tr.remove(); calcTotals();
      const ok = window.bcEstQuoteValidate(); document.querySelector('#app-confirm-overlay button, .confirm-overlay button')?.click();
      parent.insertBefore(tr, next); calcTotals(); return ok;
    });
    assert.equal(blocked, false);
    // save
    const saving = boss.evaluate(() => saveQuotation('save'));
    await boss.waitForSelector('#app-confirm-overlay, .confirm-overlay');
    await boss.click('#app-confirm-overlay .btn-primary, .confirm-overlay .btn-primary, #app-confirm-overlay button:last-child');
    const saved = await saving;
    assert.ok(saved && saved.qno, 'quotation saved');
    await sleep(400);
    const qrec = h.fs.dump('quotations/')['quotations/' + saved.id];
    assert.equal(qrec.estimate.version, 1); assert.equal(qrec.estimate.style, 'sections'); assert.equal(qrec.estimate.offer, 23600);
    assert.equal(qrec.items.filter(i => i.estItemId).length, 3); assert.equal(qrec.discount, 500); assert.equal(qrec.rfqId, 'r1');
    assert.equal(await boss.evaluate(id => calcQuote(quotations.find(q => q.id === id)).bvat, saved.id), 23100);
    const est1 = h.fs.dump('rfqs/r1')['rfqs/r1/estimates/v1'];
    assert.equal(est1.status, 'Converted'); assert.equal(est1.quotationId, saved.id); assert.equal(est1.markupPct, 15, 'figures kept');
    const r1 = h.fs.dump('rfqs/r1')['rfqs/r1'];
    assert.equal(r1.quotationId, saved.id); assert.equal(r1.estimateIndex[0].status, 'Converted');

    /* ── 2. Print: With Section Totals and Lump Sum Only ── */
    const pr = await boss.evaluate(id => { window.__popups = []; printQuotationErpVariant(id, 'contracting'); const a = window.__popups.pop()?.document.html || '';
      const q = quotations.find(x => x.id === id); q.estimate.style = 'lumpsum'; printQuotationErpVariant(id, 'contracting'); const b = window.__popups.pop()?.document.html || ''; q.estimate.style = 'sections'; return { a, b }; }, saved.id);
    assert.match(pr.a, /Total — Partitions &amp; painting/); assert.match(pr.a, /Total — Electrical/); assert.match(pr.a, />Amount</);
    assert.doesNotMatch(pr.a, />Rate</); assert.doesNotMatch(pr.a, />Disc\./);
    assert.match(pr.a, /23,600\.00/); assert.match(pr.a, /500\.00/);
    assert.doesNotMatch(pr.b, /Total — Electrical/); assert.match(pr.b, /Lump Sum Price/); assert.doesNotMatch(pr.b, />Amount</);
    assert.match(pr.b, />A1</); assert.match(pr.b, />B1</);
    // the sections' amounts add up to the lump sum
    const secAmts = [...pr.a.matchAll(/Total — [^<]+<\/td><td class="r"[^>]*>([\d,.]+)/g)].map(m => Number(m[1].replace(/,/g, '')));
    assert.equal(Math.round(secAmts.reduce((s, x) => s + x, 0) * 100), 2360000);

    /* ── 3. The estimate is Converted: read only, "Open Quotation" ── */
    await boss.evaluate(() => { closeModal('view-modal'); bcOpenEstimate('r1'); });
    await boss.waitForFunction(() => BCEst.state()?.status === 'Converted');
    assert.equal(await boss.textContent('#es-quote'), 'Open Quotation');
    assert.equal(await boss.evaluate(() => BCEst.state().ro), true);
    await boss.keyboard.press('Escape');

    /* ── 4. Won → Create Job ── */
    await boss.evaluate(async id => { const q = quotations.find(x => x.id === id); q.status = 'Won'; await saveQuotations(); viewQuotation(id); }, saved.id);
    await boss.waitForFunction(() => document.getElementById('view-modal').classList.contains('open'));
    const foot = await boss.textContent('#view-footer');
    assert.match(foot, /Create Job/); assert.doesNotMatch(foot, /Create Sales Order/);
    await boss.click('#view-footer button:has-text("Create Job")');
    await boss.waitForFunction(() => document.getElementById('job-modal')?.classList.contains('open'));
    assert.equal(await boss.evaluate(() => document.getElementById('jb-save').disabled), true, 'PO No. and date required');
    assert.match(await boss.textContent('#jb-budget'), /Total Budget\s*20,541\.60/);
    await boss.fill('#jb-po', 'PO-45110238');
    await boss.evaluate(() => { BCDate.setISO(document.getElementById('jb-podate'), BCDate.today()); document.getElementById('jb-podate').dispatchEvent(new Event('input', { bubbles: true })); document.getElementById('jb-incharge').value = 'e1'; document.getElementById('jb-notes').value = 'Retention 10 % for 12 months'; });
    await boss.dispatchEvent('#jb-po', 'input');
    assert.equal(await boss.evaluate(() => document.getElementById('jb-save').disabled), false);
    if (SHOTS) await boss.screenshot({ path: SHOTS + '/CJ_1_live.png' });
    await boss.click('#jb-save');
    await boss.click('#app-confirm-overlay button:has-text("Create Job"), .confirm-overlay button:has-text("Create Job")');
    await boss.waitForFunction(() => document.getElementById('job-view-modal')?.classList.contains('open'));
    await sleep(300);
    const jobs = h.fs.dump('jobs/');
    const job = Object.values(jobs)[0];
    assert.ok(job, 'job saved');
    assert.match(job.jobNo, /^JOB-\d{4}-0001$/);
    assert.equal(job.quotationId, saved.id); assert.equal(job.contractValue, 23100); assert.equal(job.budget.totalCost, 20541.6);
    assert.equal(job.plannedProfit, 2558.4); assert.equal(job.poNo, 'PO-45110238'); assert.equal(job.siteInCharge, 'Rashid K.'); assert.equal(job.status, 'Open');
    assert.equal(job.notes, 'Retention 10 % for 12 months'); assert.equal(job.rfqId, 'r1'); assert.equal(job.estimateVersion, 1);
    assert.equal(h.fs.dump('quotations/')['quotations/' + saved.id].jobId, job.id);
    // V271.6: the accepted scope is kept with the job (written in the same commit), shown on its Scope tab
    const jsc = h.fs.peek('jobs/' + job.id + '/scope/main');
    assert.ok(jsc && jsc.lines.some(l => l.k === 'line'), 'the accepted scope is kept with the job');
    assert.equal(jsc.quotationId, saved.id); assert.equal(jsc.jobId, job.id);
    await boss.evaluate(() => BCJobs._tab('scope')); await boss.waitForSelector('#jv-scope .js-banner');
    assert.match(await boss.textContent('#jv-scope'), /Accepted scope — frozen/);
    await boss.evaluate(() => BCJobs._tab('overview'));
    assert.match(await boss.textContent('#job-view-modal'), /Expected Profit 🔒\s*2,558\.40/);   // V271.3: the planned profit until costs come in
    if (SHOTS) await boss.screenshot({ path: SHOTS + '/CJ_2_job_view_live.png' });
    // the quotation now shows the job instead of Create Job
    await boss.evaluate(id => { closeModal('job-view-modal'); viewQuotation(id); }, saved.id);
    assert.match(await boss.textContent('#view-footer'), new RegExp(job.jobNo));

    /* ── 5. Edit Details: status ── */
    await boss.evaluate(id => { closeModal('view-modal'); BCJobs.openEdit(id); }, job.id);
    await boss.selectOption('#jb-status', 'In Progress');
    await boss.click('#jb-save');
    await sleep(300);
    assert.equal(Object.values(h.fs.dump('jobs/'))[0].status, 'In Progress');
    await boss.evaluate(() => closeModal('job-view-modal'));

    /* ── 6. Jobs register ── */
    await boss.evaluate(() => showPage('jobs'));
    await boss.waitForFunction(() => document.querySelectorAll('#jbreg-body tr[data-jid]').length === 1);
    assert.match(await boss.textContent('#jbreg-body'), /PO-45110238.*23,100\.00.*20,541\.60.*In Progress/s);
    assert.equal(await boss.textContent('#jbreg-count'), '1 job');
    if (SHOTS) await boss.screenshot({ path: SHOTS + '/Jobs_register_live.png' });

    /* ── 7. a duplicate is an ordinary service quotation (no estimate, no job) ── */
    const dup = await boss.evaluate(async id => {
      const orig = window.showConfirm; window.showConfirm = o => o.onConfirm && o.onConfirm();
      try { await duplicateQuotation(id); } finally { window.showConfirm = orig; }
      const c = quotations[0]; closeModal('quote-modal'); return { est: c.estimate === undefined, job: c.jobId === undefined, lines: (c.items || []).some(i => i.estItemId) };
    }, saved.id);
    assert.deepEqual(dup, { est: true, job: true, lines: false });

    /* ── 8. RFQ entry: the four request types are shown in full ── */
    await boss.evaluate(() => editRFQ('r1'));
    await boss.waitForFunction(() => document.querySelector('#rfq-type-seg label.on'));
    const cut = await boss.evaluate(() => [...document.querySelectorAll('#rfq-type-seg label')].filter(l => l.scrollWidth > l.clientWidth + 1).map(l => l.dataset.type));
    assert.deepEqual(cut, [], 'no request type label is cut off');
    if (SHOTS) await boss.screenshot({ path: SHOTS + '/RFQ_type_live.png' });

    assert.deepEqual(boss.__errors, [], 'no page errors');
  } finally { await h.close(); }
});
