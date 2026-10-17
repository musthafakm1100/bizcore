/* ═══════════════════════════════════════════════════════════════════
   BizCore V268.1 — Purchasing → Purchase Invoices (approved mockup 4, 17 Oct 2026)
   • Register (standard register: monitor, one-line toolbar, table / phone cards)
   • New Purchase Invoice: supplier & bill (supplier's total required), lines from Sales Orders
     (qty filled in with what is still to buy) or for stock, cost vs estimate / last paid, extra quantity
     placed on purpose, additional costs & discount (Administration), VAT, rounding to the supplier's total.
     V268.1: no payments yet — every invoice is saved Unpaid (credit) with a payment due date.
   • View + Cancel (void with reason). Administration → Finance → Purchase Settings.
   Data: js/purchase-service.mjs / purchase-core.mjs via window.BizCorePI.
═══════════════════════════════════════════════════════════════════ */
'use strict';
const piLib = () => window.BizCorePI;
const piCore = () => window.BizCorePI && window.BizCorePI.core;
const piEsc = v => (typeof escapeHtml === 'function' ? escapeHtml(v == null ? '' : String(v)) : String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
const piN = v => { const n = Number(String(v == null ? '' : v).replace(/[,\s]/g, '')); return Number.isFinite(n) ? n : 0; };
const piF = n => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const piQ = n => { const x = Number(n) || 0; return Number.isInteger(x) ? String(x) : String(Math.round(x * 1000) / 1000); };
const piToday = () => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };
const piAddDays = (iso, d) => { const t = new Date(iso + 'T00:00:00'); t.setDate(t.getDate() + d); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };
const piDate = iso => (typeof fmtDate === 'function' ? fmtDate(iso) : iso);
const piSettings = () => (piLib() ? piLib().settings : null) || (piCore() ? piCore().effectivePurchaseSettings(null) : {});
const piIsAdmin = () => !!(piLib() && piLib().isAdministrator);
const piCanSeeProfit = () => piIsAdmin() || piSettings().profitVisibility === 'everyone';
const piInvoices = () => (piLib() ? piLib().invoices : []);
const piLedgerOf = soId => (piLib() ? piLib().ledgers.get(soId) : null) || { lines: {} };
const piSOs = () => (typeof salesOrders !== 'undefined' && Array.isArray(salesOrders) ? salesOrders : []);

/* ───────────── estimate from Pricing for a Sales Order line ───────────── */
function piEstimateFor(so, soLine){
  try {
    const qs = typeof quotations !== 'undefined' ? quotations : [], rs = typeof rfqs !== 'undefined' ? rfqs : [];
    const q = qs.find(x => x.id === so.quotationId || x.qno === so.quotationId);
    if (!q) return null;
    const r = rs.find(x => x.id === q.rfqId || x.rfqNo === q.rfqId) || rs.find(x => x.quotationId === q.id || x.quotationId === q.qno);
    if (!r) return null;
    const versions = typeof ensurePricingVersions === 'function' ? ensurePricingVersions(r) : (r.pricingVersions || []);
    const v = versions.find(x => Number(x.version) === Number(q.pricingVersion || r.currentPricingVersion || 1)) || versions[versions.length - 1];
    const items = (v && v.pricingItems) || r.pricingItems || [];
    const qi = (q.items || [])[Number(soLine.origIdx)] || {};
    const low = s => String(s || '').trim().toLowerCase();
    const prod = qi.prodId || soLine.prodId, code = low(qi.code || soLine.code), desc = low(qi.desc || soLine.desc);
    const hit = (prod && items.find(i => String(i.productId || '') === String(prod)))
      || (code && items.find(i => low(i.code) === code))
      || items.find(i => low(i.desc) === desc);
    const buy = hit ? Number(hit.buy) : 0;
    return buy > 0 ? { unit: buy, source: 'pricing', refNo: r.rfqNo ? 'PR-' + String(r.rfqNo).replace(/^RFQ-?/i, '') + '-V' + (v ? v.version : 1) : '', refDate: '' } : null;
  } catch (e) { return null; }
}
function piReferenceFor(line){
  if (line.kind === 'order') { const so = piSOs().find(s => s.id === line.soId); const sl = so && (so.items || []).find(x => x.lineId === line.soLineId); const est = so && sl ? piEstimateFor(so, sl) : null; if (est) return est; }
  const C = piCore(); if (!C) return null;
  return C.lastPaidOf(piInvoices(), C.itemKeyOf(line));
}
/** Open Sales Order lines with something still to buy. */
function piOpenOrderLines(){
  const out = [];
  piSOs().forEach(so => (so.items || []).forEach(it => {
    if (!it || !it.lineId) return;
    const left = piCore().stillToBuy(it.qty, (piLedgerOf(so.id).lines || {})[it.lineId]);
    if (left > 0) out.push({ so, it, left });
  }));
  return out;
}

/* ═══════════════════════════════ REGISTER ═══════════════════════════════ */
let _piKpi = 'all';
function filterPurchaseKPI(k){ _piKpi = k; const st = document.getElementById('pireg-status'); if (st) st.value = k === 'all' ? '' : k; renderPurchaseRegister(); }
function clearPurchaseRegisterFilters(){
  ['pireg-q', 'pireg-status', 'pireg-supplier'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
  const s = document.getElementById('pireg-sort'); if (s) s.value = 'date-desc';
  if (window.BCDateFilter) BCDateFilter.set('pireg', { preset: 'all' });
  _piKpi = 'all'; renderPurchaseRegister();
}
function piPayPill(pi){
  if (pi.status === 'Voided') return '<span class="pi-status voided">Cancelled</span>';
  const C = piCore(), st = C.payStatusOf(pi), d = C.daysUntil(pi.dueDate, piToday());
  if (st === 'Paid') return '<span class="pi-pay paid">Paid</span>';
  const due = d === null ? '' : d < 0 ? ` · ${-d}d overdue` : d === 0 ? ' · due today' : ` · due ${piDate(pi.dueDate)}`;
  return `<span class="pi-pay ${d !== null && d < 0 ? 'over' : 'open'}">${piEsc(st)}${due}</span>`;
}
function renderPurchaseRegister(){
  const lib = piLib(), body = document.getElementById('pireg-body'); if (!lib || !body) return;
  lib.start();
  const C = piCore(), today = piToday();
  const val = id => (document.getElementById(id)?.value || '');
  const q = val('pireg-q').trim().toLowerCase(), sort = val('pireg-sort') || 'date-desc';
  const ds = window.BCDateFilter ? BCDateFilter.get('pireg') : { preset: 'all', from: '', to: '' };
  const supSel = document.getElementById('pireg-supplier');
  const all = piInvoices();
  if (supSel) { const cur = supSel.value; const names = [...new Set(all.map(p => p.supplierName).filter(Boolean))].sort((a, b) => a.localeCompare(b)); supSel.innerHTML = '<option value="">All suppliers</option>' + names.map(n => `<option value="${piEsc(n)}">${piEsc(n)}</option>`).join(''); supSel.value = names.includes(cur) ? cur : ''; }
  const sup = supSel ? supSel.value : '';
  const scope = all.filter(p => (!sup || p.supplierName === sup) && (!ds.from || (p.date || '') >= ds.from) && (!ds.to || (p.date || '') <= ds.to)
    && (!q || [p.piNo, p.supplierName, p.supplierInvoiceNo, p.zohoBillNo, ...(p.lines || []).map(l => l.soNo), ...(p.lines || []).map(l => l.desc)].some(v => String(v || '').toLowerCase().includes(q))));
  const posted = scope.filter(p => p.status !== 'Voided');
  const open = all.filter(p => p.status !== 'Voided' && C.payStatusOf(p) !== 'Paid');
  const overdue = open.filter(p => { const d = C.daysUntil(p.dueDate, today); return d !== null && d < 0; });
  const soon = open.filter(p => { const d = C.daysUntil(p.dueDate, today); return d !== null && d >= 0 && d <= 7; });
  const setT = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  setT('pireg-k-total', scope.length); setT('pireg-k-posted', posted.length); setT('pireg-k-voided', scope.length - posted.length);
  setT('pireg-k-overdue', overdue.length); setT('pireg-k-duesoon', soon.length);
  setT('pireg-a-purchases', piF(posted.reduce((s, p) => s + piN(p.totals && p.totals.total), 0)));
  setT('pireg-a-payable', piF(open.reduce((s, p) => s + piN(p.balance), 0)));
  setT('pireg-a-stock', piF([...(lib.stock || new Map()).values()].reduce((s, x) => s + piN(x.value), 0)));
  document.querySelectorAll('#page-purchaseinvoices [data-pi-kpi]').forEach(e => { const on = e.dataset.piKpi === _piKpi; e.classList.toggle('active', on); e.setAttribute('aria-pressed', on ? 'true' : 'false'); });
  const st = document.getElementById('pireg-status'); if (st) st.value = _piKpi === 'all' ? '' : _piKpi;
  let rows = scope.filter(p => _piKpi === 'all' || (_piKpi === 'Posted' ? p.status !== 'Voided' : _piKpi === 'Voided' ? p.status === 'Voided'
    : _piKpi === 'overdue' ? overdue.includes(p) : _piKpi === 'duesoon' ? soon.includes(p) : true));
  const byNo = (a, b) => String(a.piNo || '').localeCompare(String(b.piNo || ''), undefined, { numeric: true });
  if (sort === 'date-asc') rows.sort((a, b) => String(a.date).localeCompare(String(b.date)) || byNo(a, b));
  else if (sort === 'no-asc') rows.sort(byNo);
  else if (sort === 'supplier-asc') rows.sort((a, b) => String(a.supplierName).localeCompare(String(b.supplierName)));
  else if (sort === 'amount-desc') rows.sort((a, b) => piN(b.totals && b.totals.total) - piN(a.totals && a.totals.total));
  else if (sort === 'due-asc') rows.sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
  else rows.sort((a, b) => String(b.date).localeCompare(String(a.date)) || byNo(b, a));
  if (typeof sortRegisterRows === 'function') rows = sortRegisterRows(rows, 'pi', { no: p => p.piNo, date: p => p.date, supplier: p => p.supplierName, amount: p => piN(p.totals && p.totals.total), due: p => p.dueDate, status: p => p.status });
  setT('pireg-count', `${rows.length} invoice${rows.length === 1 ? '' : 's'}`);
  const clear = document.getElementById('pireg-clear');
  if (clear) { const active = !!(q || sup || ds.preset !== 'all' || sort !== 'date-desc' || _piKpi !== 'all'); clear.disabled = !active; clear.classList.toggle('active', active); }
  const orders = p => { const s = [...new Set((p.lines || []).flatMap(l => (l.allocations || []).map(a => a.soNo)).filter(Boolean))]; const stock = (p.lines || []).some(l => piN(l.stockQty) > 0);
    return s.slice(0, 2).map(x => `<span class="pi-chip">${piEsc(x)}</span>`).join('') + (s.length > 2 ? `<span class="pi-chip">+${s.length - 2}</span>` : '') + (stock ? '<span class="pi-chip stock"><i class="ti ti-box"></i>stock</span>' : '') || '<span class="pi-muted">—</span>'; };
  const openFn = p => `openPurchaseInvoiceView('${piEsc(p.id)}')`;
  body.innerHTML = rows.length ? rows.map(p => `<tr class="quotation-clickable-row${p.status === 'Voided' ? ' pi-row-voided' : ''}" tabindex="0" role="button" data-pi="${piEsc(p.id)}" onclick="${openFn(p)}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${openFn(p)}}">
      <td class="pi-no">${piEsc(p.piNo)}</td><td>${piDate(p.date)}</td><td>${piEsc(p.supplierName)}</td><td>${piEsc(p.supplierInvoiceNo)}</td><td>${piEsc(p.zohoBillNo || '—')}</td>
      <td class="pi-orders">${orders(p)}</td><td class="num">${p.status === 'Voided' ? '<s>' + piF(p.totals.total) + '</s>' : piF(p.totals.total)}</td><td>${piPayPill(p)}</td></tr>`).join('')
    : `<tr><td colspan="8"><div class="empty-state"><i class="ti ti-file-invoice"></i><strong>No purchase invoices found</strong><p>${all.length ? 'Adjust the filters to see other invoices.' : 'Record a supplier invoice with New Purchase Invoice.'}</p></div></td></tr>`;
  const cards = document.getElementById('pireg-cards');
  if (cards) cards.innerHTML = rows.length ? rows.map(p => `<article class="pi-card${p.status === 'Voided' ? ' voided' : ''}" role="button" tabindex="0" onclick="${openFn(p)}"><div class="r1"><b>${piEsc(p.piNo)}</b>${piPayPill(p)}</div><div class="r2">${piEsc(p.supplierName)}</div>
      <div class="r3"><span>${piDate(p.date)} · ${piEsc(p.supplierInvoiceNo)}</span><span class="amt">${piF(p.totals.total)}</span></div></article>`).join('') : '<div class="pi-empty">No purchase invoices found</div>';
  const nb = document.getElementById('pi-badge'); if (nb) { nb.textContent = overdue.length; nb.style.display = overdue.length ? '' : 'none'; nb.title = overdue.length ? `${overdue.length} purchase invoice(s) overdue` : ''; }
}

/* ═══════════════════════════════ NEW PURCHASE INVOICE ═══════════════════════════════ */
function piEnsureModal(){
  let m = document.getElementById('pi-new-modal'); if (m) return m;
  m = document.createElement('div'); m.className = 'modal-overlay'; m.id = 'pi-new-modal';
  m.innerHTML = `<div class="modal modal-normal so-create-workspace pi-workspace">
    <div class="modal-header"><div><h2>New Purchase Invoice <span class="pi-kind"><i class="ti ti-shopping-bag"></i>Purchase</span></h2><div class="so-create-subtitle" id="pe-subtitle">Number assigned on save</div></div><button class="close-btn" type="button" onclick="closeModal('pi-new-modal')" aria-label="Close">✕</button></div>
    <div class="modal-body"><div class="pi-entry-grid">
      <div class="pi-entry-main">
        <section class="so-entry-card"><div class="so-entry-card-title"><i class="ti ti-building-store"></i>Supplier &amp; bill</div>
          <div class="pi-head-grid">
            <div class="form-group pi-f-sup"><label for="pe-supplier">Supplier *</label><select id="pe-supplier" onchange="piHeadChanged()"></select></div>
            <div class="form-group"><label for="pe-invno">Supplier invoice no. *</label><input id="pe-invno" maxlength="60" autocomplete="off" oninput="piHeadChanged()"></div>
            <div class="form-group"><label for="pe-date">Invoice date *</label><input id="pe-date" type="date" onchange="piHeadChanged(true)"></div>
            <div class="form-group"><label for="pe-zoho">Zoho bill no. <em>optional</em></label><input id="pe-zoho" maxlength="60" autocomplete="off" placeholder="Bill number"></div>
            <div class="form-group pi-f-total"><label for="pe-suptotal">Supplier's invoice total (incl. VAT) *</label><input id="pe-suptotal" class="pi-money" inputmode="decimal" autocomplete="off" placeholder="0.00" oninput="piRecalc()" onblur="piMoneyBlur(this)"></div>
            <div class="pi-f-match" id="pe-match"></div>
          </div>
        </section>
        <section class="so-entry-card"><div class="so-entry-card-title so-items-title"><span><i class="ti ti-list-details"></i>What was bought</span><span class="pi-actions"><button type="button" class="btn btn-primary btn-sm" onclick="piOpenPicker()"><i class="ti ti-shopping-cart-plus"></i>Add from sales orders</button><button type="button" class="btn btn-secondary btn-sm" onclick="piAddStockLine()"><i class="ti ti-box"></i>Add item for stock</button></span></div>
          <div class="pi-lines-wrap"><table class="pi-lines"><thead id="pe-lines-head"></thead><tbody id="pe-lines"></tbody></table></div>
          <p class="pi-note">Qty bought starts at what is still to buy — change it if the supplier delivered less. If you buy more than an order needs, you choose where the extra goes.</p>
        </section>
        <section class="so-entry-card"><div class="so-entry-card-title so-items-title"><span class="pi-title-ic"><i class="ti ti-receipt-2"></i><span id="pe-costs-title">Additional costs &amp; discount</span></span><span class="pi-actions"><button type="button" class="btn btn-secondary btn-sm" id="pe-add-disc" onclick="piAddDiscount()"><i class="ti ti-discount"></i>Add discount</button><button type="button" class="btn btn-secondary btn-sm" onclick="piAddCost()"><i class="ti ti-plus"></i>Add cost</button></span></div>
          <div id="pe-costs"></div>
        </section>
        <section class="so-entry-card"><div class="so-entry-card-title"><i class="ti ti-cash"></i>Payment <span class="pi-pay open" style="margin-left:6px">Unpaid (credit)</span></div>
          <div class="pi-due"><i class="ti ti-clock"></i><span>Payments are added in the next version. This invoice is saved <b>Unpaid (credit)</b> — the whole total goes to the supplier's payable.</span><label for="pe-due">Payment due *</label><input id="pe-due" type="date" onchange="piRecalc()"></div>
        </section>
      </div>
      <aside class="pi-entry-side">
        <section class="so-entry-card so-summary-card"><div class="so-entry-card-title"><i class="ti ti-calculator"></i>Bill summary</div><div id="pe-summary"></div></section>
        <section class="so-entry-card" id="pe-cmp-card"><div class="so-entry-card-title"><i class="ti ti-chart-arrows"></i>Cost vs estimate <span class="pi-staff">STAFF ONLY</span></div><div id="pe-cmp"></div></section>
      </aside>
    </div><div id="pe-error" class="inv-error" hidden></div></div>
    <div class="modal-footer pi-footer"><b class="pi-tc">To continue:</b><div class="pi-todo" id="pe-todo"></div>
      <button class="btn btn-secondary" type="button" onclick="closeModal('pi-new-modal')">Cancel</button>
      <button class="btn btn-primary" type="button" id="pe-save" onclick="savePurchaseInvoice()" disabled><i class="ti ti-device-floppy"></i>Save Purchase Invoice</button></div>
  </div>`;
  document.body.appendChild(m);
  return m;
}
const piState = () => document.getElementById('pi-new-modal')?._s;
function openNewPurchaseInvoice(){
  const lib = piLib(); if (!lib) return;
  lib.start();
  const m = piEnsureModal();
  const today = piToday();
  m._s = { lines: [], costs: [], discount: null, vatTouched: false, op: 'pi-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10) };
  const sups = (typeof suppliers !== 'undefined' ? suppliers : []).slice().sort((a, b) => String(a.company || '').localeCompare(String(b.company || '')));
  document.getElementById('pe-supplier').innerHTML = '<option value="">Choose the supplier…</option>' + sups.map(s => `<option value="${piEsc(s.id)}">${piEsc(s.company || s.name || s.id)}</option>`).join('');
  ['pe-invno', 'pe-zoho', 'pe-suptotal'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('pe-date').value = today;
  document.getElementById('pe-due').value = piAddDays(today, 30);
  const x = typeof docNumberParts === 'function' ? docNumberParts('purchaseInvoice') : { displayPrefix: 'PI-' };
  document.getElementById('pe-subtitle').textContent = `Number assigned on save · ${x.displayPrefix}…`;
  document.getElementById('pe-error').hidden = true;
  piRenderLines(); piRenderCosts(); piRecalc();
  if (typeof openModalWithSize === 'function') openModalWithSize('pi-new-modal'); else m.classList.add('open');
  setTimeout(() => document.getElementById('pe-supplier').focus(), 60);
}
function piHeadChanged(dateChanged){
  const s = piState(); if (!s) return;
  if (dateChanged) { const d = document.getElementById('pe-date').value; if (d && !s.dueTouched) document.getElementById('pe-due').value = piAddDays(d, 30); }
  piRecalc();
}
function piMoneyBlur(el){ const raw = String(el.value || '').replace(/[,\s]/g, ''); if (raw === '' || !Number.isFinite(Number(raw))) return; el.value = piF(Number(raw)); }

/* lines */
function piLineFromOrder(so, it, left){
  const line = { kind: 'order', soId: so.id, soNo: so.soNo, customer: so.customer, soLineId: it.lineId, desc: it.desc, code: it.code || '', uom: it.uom || '', productId: it.prodId || '',
    orderedQty: Number(it.qty) || 0, left, qty: left, unitCost: '', reference: null, extra: null, costReason: '' };
  line.reference = piReferenceFor(line);
  if (line.reference) line.unitCost = line.reference.unit;
  return line;
}
function piAddStockLine(){
  const s = piState(); if (!s) return;
  s.lines.push({ kind: 'stock', desc: '', code: '', uom: 'Pcs', productId: '', qty: 1, unitCost: '', reference: null, costReason: '' });
  piRenderLines(); piRecalc();
  setTimeout(() => { const el = document.querySelectorAll('#pe-lines .pi-stock-desc'); if (el.length) el[el.length - 1].focus(); }, 30);
}
function piRemoveLine(i){ const s = piState(); s.lines.splice(i, 1); piRenderLines(); piRecalc(); }
function piLeftFor(line, i){
  // still to buy on this order line, less what earlier lines of this invoice already take
  const s = piState(), base = piCore().stillToBuy(line.orderedQty, (piLedgerOf(line.soId).lines || {})[line.soLineId]);
  let used = 0;
  s.lines.forEach((l, j) => { if (j >= i) return; if (l.kind === 'order' && l.soId === line.soId && l.soLineId === line.soLineId) used += Math.min(piN(l.qty), base); if (l.extra && l.extra.to === 'order' && l.extra.soId === line.soId && l.extra.soLineId === line.soLineId) used += Math.max(0, piN(l.qty) - piLeftFor(l, j)); });
  return Math.max(0, base - used);
}
function piOtherOrdersFor(line){
  const C = piCore(), key = C.itemKeyOf(line);
  return piOpenOrderLines().filter(x => !(x.so.id === line.soId && x.it.lineId === line.soLineId) && C.itemKeyOf({ productId: x.it.prodId, code: x.it.code, desc: x.it.desc, uom: x.it.uom }) === key);
}
function piCostTag(line){
  const C = piCore(), set = piSettings();
  const chk = C.costCheck(piN(line.unitCost), line.reference, set);
  const what = line.reference && line.reference.source === 'lastPaid' ? 'vs last paid' : '';
  if (chk.kind === 'none') return { chk, html: '<span class="pi-var att"><i class="ti ti-info-circle"></i> no estimate or previous price</span>' };
  if (line.unitCost === '' || line.unitCost == null) return { chk, html: '' };
  const pct = (chk.pct > 0 ? '+' : '') + chk.pct.toFixed(1) + '%';
  if (chk.kind === 'equal') return { chk, html: `<span class="pi-var eq">${what ? 'same as last paid' : 'as estimated'}</span>` };
  if (chk.kind === 'below') return { chk, html: `<span class="pi-var dn">${pct} — below ${what ? 'last paid' : 'estimate'}</span>` };
  if (chk.kind === 'within') return { chk, html: `<span class="pi-var up">${pct} ${what || '— within limit'}</span>` };
  return { chk, html: `<span class="pi-var upr">${pct} ${what ? what + ' — ' : '— '}above ${set.costLimitPct}% limit</span>` };
}
function piRenderLines(){
  const s = piState(); if (!s) return;
  const lineDisc = ['line', 'both'].includes(piSettings().discountMode);
  document.getElementById('pe-lines-head').innerHTML = `<tr><th style="width:150px">Sales order</th><th>Item</th><th class="num" style="width:96px">Still to buy</th><th class="num" style="width:96px">Qty bought</th><th class="num" style="width:180px">Unit cost<br><span class="pi-th-sub">estimate → actual</span></th>${lineDisc ? '<th class="num" style="width:76px">Disc. %</th>' : ''}<th class="num" style="width:100px">Amount</th><th style="width:170px">Goes to</th><th style="width:34px"></th></tr>`;
  const cols = lineDisc ? 9 : 8;
  const body = document.getElementById('pe-lines');
  if (!s.lines.length) { body.innerHTML = `<tr><td colspan="${cols}" class="pi-empty-lines"><i class="ti ti-shopping-cart"></i>Add the items from the supplier's invoice: <b>Add from sales orders</b>, or <b>Add item for stock</b>.</td></tr>`; return; }
  body.innerHTML = s.lines.map((l, i) => {
    const tag = piCostTag(l);
    const ref = l.reference;
    const refTxt = ref ? `<span class="pi-ref">${ref.source === 'lastPaid' ? 'last paid ' : ''}${piF(ref.unit)} →</span>` : '';
    const refSub = ref && ref.source === 'lastPaid' ? `<div class="pi-ref-sub">no estimate · last bought ${piDate(ref.refDate)}</div>` : '';
    const amount = piN(l.qty) * piN(l.unitCost) * (1 - (lineDisc ? piN(l.discountPct) : 0) / 100);
    let rows = '';
    if (l.kind === 'order') {
      const left = piLeftFor(l, i), extra = Math.max(0, piN(l.qty) - left);
      const goes = `<span class="pi-dest"><i class="ti ti-shopping-cart"></i>${piEsc(l.soNo)}${extra > 0 ? ' · ' + piQ(Math.min(piN(l.qty), left)) : ''}</span>` + (extra > 0 ? (l.extra ? (l.extra.to === 'stock' ? `<span class="pi-dest stock"><i class="ti ti-box"></i>Unassigned stock · ${piQ(extra)}</span>` : `<span class="pi-dest"><i class="ti ti-shopping-cart"></i>${piEsc(l.extra.soNo)} · ${piQ(extra)}</span>`) : `<div class="pi-ref-sub warn">+ ${piQ(extra)} to place ↓</div>`) : '');
      rows = `<tr data-i="${i}"><td><span class="pi-so">${piEsc(l.soNo)}</span><div class="pi-sub">${piEsc(l.customer || '')}</div></td><td>${piEsc(l.desc)}<div class="pi-sub">${piEsc(l.uom)}</div></td>
        <td class="num">${piQ(left)} of ${piQ(l.orderedQty)}</td>
        <td class="num"><input class="pi-cell" inputmode="decimal" value="${piEsc(l.qty)}" aria-label="Qty bought" onchange="piSetLine(${i},'qty',this.value,true)" oninput="piSetLine(${i},'qty',this.value)"></td>
        <td class="num">${refTxt} <input class="pi-cell pi-cost" inputmode="decimal" value="${l.unitCost === '' ? '' : piEsc(l.unitCost)}" aria-label="Unit cost" onchange="piSetLine(${i},'unitCost',this.value,true)" oninput="piSetLine(${i},'unitCost',this.value)"><br>${tag.html}${refSub}</td>
        ${lineDisc ? `<td class="num"><input class="pi-cell pi-disc" inputmode="decimal" value="${piEsc(l.discountPct || '')}" aria-label="Discount %" onchange="piSetLine(${i},'discountPct',this.value,true)"></td>` : ''}
        <td class="num pi-amt">${piF(amount)}</td><td>${goes}</td><td><button type="button" class="pi-x" title="Remove line" aria-label="Remove line" onclick="piRemoveLine(${i})"><i class="ti ti-x"></i></button></td></tr>`;
      if (extra > 0 && !l.extra) {
        const others = piOtherOrdersFor(l).filter(x => x.left >= extra);
        rows += `<tr class="pi-ask-row"><td colspan="${cols}"><div class="pi-ask"><i class="ti ti-help-circle"></i><b>${piQ(extra)} more than ${piEsc(l.soNo)} needs.</b> Where should they go? *
          <button type="button" class="pi-opt" onclick="piPlaceExtra(${i},'stock')"><i class="ti ti-box"></i>Unassigned stock</button>
          ${others.map(x => `<button type="button" class="pi-opt" onclick="piPlaceExtra(${i},'order','${piEsc(x.so.id)}','${piEsc(x.it.lineId)}')"><i class="ti ti-shopping-cart"></i>${piEsc(x.so.soNo)} · needs ${piQ(x.left)}</button>`).join('')}
          <button type="button" class="pi-opt" onclick="piSetLine(${i},'qty','${piQ(left)}',true)"><i class="ti ti-pencil"></i>Correct quantity to ${piQ(left)}</button></div></td></tr>`;
      } else if (extra > 0 && l.extra) rows += `<tr class="pi-ask-row"><td colspan="${cols}"><div class="pi-placed"><i class="ti ti-circle-check"></i>${piQ(extra)} extra → ${l.extra.to === 'stock' ? 'Unassigned stock' : piEsc(l.extra.soNo)} <button type="button" class="pi-link" onclick="piPlaceExtra(${i},null)">change</button></div></td></tr>`;
    } else {
      rows = `<tr data-i="${i}"><td><span class="pi-stock-tag"><i class="ti ti-box"></i> for stock</span></td>
        <td><input class="pi-cell pi-stock-desc" list="pe-products" value="${piEsc(l.desc)}" placeholder="Item (product or description)" aria-label="Item" onchange="piSetStockItem(${i},this.value)"><div class="pi-sub"><input class="pi-cell pi-uom" value="${piEsc(l.uom)}" aria-label="Unit" onchange="piSetLine(${i},'uom',this.value,true)"></div></td>
        <td class="num">—</td>
        <td class="num"><input class="pi-cell" inputmode="decimal" value="${piEsc(l.qty)}" aria-label="Qty bought" onchange="piSetLine(${i},'qty',this.value,true)" oninput="piSetLine(${i},'qty',this.value)"></td>
        <td class="num">${refTxt} <input class="pi-cell pi-cost" inputmode="decimal" value="${l.unitCost === '' ? '' : piEsc(l.unitCost)}" aria-label="Unit cost" onchange="piSetLine(${i},'unitCost',this.value,true)" oninput="piSetLine(${i},'unitCost',this.value)"><br>${tag.html}${refSub}</td>
        ${lineDisc ? `<td class="num"><input class="pi-cell pi-disc" inputmode="decimal" value="${piEsc(l.discountPct || '')}" aria-label="Discount %" onchange="piSetLine(${i},'discountPct',this.value,true)"></td>` : ''}
        <td class="num pi-amt">${piF(amount)}</td><td><span class="pi-dest stock"><i class="ti ti-box"></i>Unassigned stock · ${piQ(l.qty)}</span></td><td><button type="button" class="pi-x" title="Remove line" aria-label="Remove line" onclick="piRemoveLine(${i})"><i class="ti ti-x"></i></button></td></tr>`;
    }
    if (tag.chk.kind === 'above' && piSettings().costLimitAction === 'reason')
      rows += `<tr class="pi-ask-row"><td colspan="${cols}"><div class="pi-reason"><i class="ti ti-alert-triangle"></i>Reason for the higher cost * <input class="pi-cell" maxlength="300" value="${piEsc(l.costReason)}" placeholder="e.g. supplier price increase, urgent purchase" oninput="piSetLine(${i},'costReason',this.value)"></div></td></tr>`;
    return rows;
  }).join('');
  let dl = document.getElementById('pe-products');
  if (!dl) { dl = document.createElement('datalist'); dl.id = 'pe-products'; document.body.appendChild(dl); }
  dl.innerHTML = (typeof products !== 'undefined' ? products : []).map(p => `<option value="${piEsc(p.name)}">${piEsc([p.code, p.uom].filter(Boolean).join(' · '))}</option>`).join('');
}
function piSetLine(i, field, value, rerender){
  const s = piState(); const l = s && s.lines[i]; if (!l) return;
  l[field] = value;
  if (field === 'qty' && l.extra && piN(value) <= piLeftFor(l, i)) l.extra = null;
  if (rerender) { piRenderLines(); }
  else if (field === 'qty' || field === 'unitCost') { const tr = document.querySelector(`#pe-lines tr[data-i="${i}"] .pi-amt`); if (tr) tr.textContent = piF(piN(l.qty) * piN(l.unitCost) * (1 - (['line', 'both'].includes(piSettings().discountMode) ? piN(l.discountPct) : 0) / 100)); }
  piRecalc();
}
function piSetStockItem(i, value){
  const s = piState(), l = s.lines[i]; if (!l) return;
  const p = (typeof products !== 'undefined' ? products : []).find(x => String(x.name || '').trim().toLowerCase() === String(value || '').trim().toLowerCase());
  l.desc = value; l.productId = p ? p.id : ''; l.code = p ? (p.code || '') : ''; if (p && p.uom) l.uom = p.uom;
  l.reference = piReferenceFor(l);
  if (l.reference && (l.unitCost === '' || l.unitCost == null)) l.unitCost = l.reference.unit;
  piRenderLines(); piRecalc();
}
function piPlaceExtra(i, to, soId, soLineId){
  const s = piState(), l = s.lines[i]; if (!l) return;
  if (!to) l.extra = null;
  else if (to === 'stock') l.extra = { to: 'stock' };
  else { const so = piSOs().find(x => x.id === soId); l.extra = { to: 'order', soId, soLineId, soNo: so ? so.soNo : '' }; }
  piRenderLines(); piRecalc();
}

/* sales order picker */
function piOpenPicker(){
  const s = piState(); if (!s) return;
  let m = document.getElementById('pi-pick-modal');
  if (!m) { m = document.createElement('div'); m.className = 'modal-overlay'; m.id = 'pi-pick-modal'; document.body.appendChild(m); }
  m.innerHTML = `<div class="modal pi-pick" role="dialog" aria-modal="true" aria-labelledby="pi-pick-title" style="width:min(860px,96vw);max-width:860px;height:auto;max-height:90vh">
    <div class="modal-header"><div class="modal-header-title-wrap"><h2 id="pi-pick-title">Add from sales orders</h2></div><button class="close-btn" type="button" onclick="closeModal('pi-pick-modal')" aria-label="Close">✕</button></div>
    <div class="modal-body"><input id="pi-pick-q" class="pi-pick-q" placeholder="Search order, customer or item…" oninput="piRenderPicker()" autocomplete="off"><div id="pi-pick-list"></div></div>
    <div class="modal-footer"><span class="pi-muted" id="pi-pick-count"></span><button class="btn btn-secondary" type="button" onclick="closeModal('pi-pick-modal')">Cancel</button><button class="btn btn-primary" type="button" onclick="piPickAdd()"><i class="ti ti-plus"></i>Add selected</button></div></div>`;
  m._sel = new Set();
  piRenderPicker();
  if (typeof openModalWithSize === 'function') openModalWithSize('pi-pick-modal'); else m.classList.add('open');
  setTimeout(() => document.getElementById('pi-pick-q').focus(), 60);
}
function piRenderPicker(){
  const m = document.getElementById('pi-pick-modal'), s = piState(); if (!m || !s) return;
  const q = (document.getElementById('pi-pick-q').value || '').trim().toLowerCase();
  const taken = new Set(s.lines.filter(l => l.kind === 'order').map(l => l.soId + '|' + l.soLineId));
  const rows = piOpenOrderLines().filter(x => !q || [x.so.soNo, x.so.customer, x.it.desc, x.it.code].some(v => String(v || '').toLowerCase().includes(q)));
  const groups = new Map(); rows.forEach(x => { if (!groups.has(x.so.id)) groups.set(x.so.id, []); groups.get(x.so.id).push(x); });
  document.getElementById('pi-pick-list').innerHTML = rows.length ? [...groups.values()].map(g => `<div class="pi-pick-group"><div class="pi-pick-head"><b>${piEsc(g[0].so.soNo)}</b> · ${piEsc(g[0].so.customer || '')}</div>
    ${g.map(x => { const k = x.so.id + '|' + x.it.lineId, dis = taken.has(k); return `<label class="pi-pick-row${dis ? ' dis' : ''}"><input type="checkbox" ${dis ? 'disabled checked' : (m._sel.has(k) ? 'checked' : '')} onchange="piPickToggle('${piEsc(k)}',this.checked)"><span>${piEsc(x.it.desc)}<small>${piEsc(x.it.uom || '')}${dis ? ' · already on this invoice' : ''}</small></span><span class="num">still to buy <b>${piQ(x.left)}</b> of ${piQ(x.it.qty)}</span></label>`; }).join('')}</div>`).join('')
    : '<div class="pi-empty">No open sales order lines' + (q ? ' match the search' : ' — everything ordered has been bought') + '.</div>';
  document.getElementById('pi-pick-count').textContent = m._sel.size ? `${m._sel.size} selected` : '';
}
function piPickToggle(k, on){ const m = document.getElementById('pi-pick-modal'); if (on) m._sel.add(k); else m._sel.delete(k); document.getElementById('pi-pick-count').textContent = m._sel.size ? `${m._sel.size} selected` : ''; }
function piPickAdd(){
  const m = document.getElementById('pi-pick-modal'), s = piState(); if (!m || !s) return;
  const open = piOpenOrderLines();
  m._sel.forEach(k => { const x = open.find(o => o.so.id + '|' + o.it.lineId === k); if (x) s.lines.push(piLineFromOrder(x.so, x.it, x.left)); });
  closeModal('pi-pick-modal');
  piRenderLines(); piRecalc();
}

/* additional costs & discount */
function piAddCost(){ const s = piState(); s.costs.push({ label: 'Delivery charge', amount: '' }); piRenderCosts(); piRecalc(); setTimeout(() => { const el = document.querySelectorAll('#pe-costs .pi-cost-amt'); if (el.length) el[el.length - 1].focus(); }, 30); }
function piAddDiscount(){ const s = piState(); if (!s.discount) s.discount = { mode: 'amount', value: '' }; piRenderCosts(); piRecalc(); setTimeout(() => document.getElementById('pe-disc-val')?.focus(), 30); }
function piRenderCosts(){
  const s = piState(); if (!s) return;
  const invDisc = ['invoice', 'both'].includes(piSettings().discountMode);
  const b = document.getElementById('pe-add-disc'); if (b) b.style.display = !invDisc || s.discount ? 'none' : '';
  document.getElementById('pe-costs-title').innerHTML = invDisc ? 'Additional costs &amp; discount' : 'Additional costs';
  const rows = s.costs.map((c, i) => `<div class="pi-cost-row"><input class="pi-cell pi-cost-label" maxlength="100" value="${piEsc(c.label)}" aria-label="Cost" oninput="piState().costs[${i}].label=this.value;piRecalc()"><span class="pi-sub">shared by value over the lines</span><input class="pi-cell pi-cost-amt pi-money" inputmode="decimal" value="${piEsc(c.amount)}" placeholder="0.00" aria-label="Amount" oninput="piState().costs[${i}].amount=this.value;piRecalc()" onblur="piMoneyBlur(this)"><button type="button" class="pi-x" aria-label="Remove cost" onclick="piState().costs.splice(${i},1);piRenderCosts();piRecalc()"><i class="ti ti-x"></i></button></div>`).join('');
  const d = s.discount && invDisc ? `<div class="pi-cost-row pi-disc-row"><span class="pi-cost-label">Discount on the whole invoice</span><span class="pi-sub">shared by value over the lines, lowers each item's cost</span>
      <span class="pi-disc-in"><select id="pe-disc-mode" aria-label="Discount type" onchange="piState().discount.mode=this.value;piRecalc()"><option value="amount"${s.discount.mode === 'amount' ? ' selected' : ''}>SAR</option><option value="percent"${s.discount.mode === 'percent' ? ' selected' : ''}>%</option></select><input id="pe-disc-val" class="pi-cell pi-money" inputmode="decimal" value="${piEsc(s.discount.value)}" placeholder="0.00" aria-label="Discount" oninput="piState().discount.value=this.value;piRecalc()"></span>
      <button type="button" class="pi-x" aria-label="Remove discount" onclick="piState().discount=null;piRenderCosts();piRecalc()"><i class="ti ti-x"></i></button></div>` : '';
  document.getElementById('pe-costs').innerHTML = rows + d || '<p class="pi-muted" style="margin:2px 0">No additional costs' + (invDisc ? ' or discount' : '') + '.</p>';
}

/** Profit (green) or loss (red) on the orders: selling price on the Sales Orders × qty bought − landed cost. */
function piProfitBox(p, note){
  const loss = Number(p.profit) < -0.005;
  return `<div class="pi-hl${loss ? ' loss' : ''}"><div class="pi-ps"><span>${loss ? 'Loss' : 'Profit'} on these orders</span><b class="${loss ? 'pi-red' : 'pi-green'}">${piF(p.profit)}</b></div>
    <small>Sales value ${piF(p.sales)} − cost ${piF(p.cost)}${note ? ' · shown only to roles allowed in Administration' : ''}</small></div>`;
}
/* totals, checks, "To continue" */
function piReadInput(){
  const s = piState(), sel = document.getElementById('pe-supplier');
  const sup = (typeof suppliers !== 'undefined' ? suppliers : []).find(x => x.id === sel.value);
  return {
    operationId: s.op, supplierId: sup ? sup.id : '', supplierName: sup ? (sup.company || sup.name || '') : '', supplierVat: sup ? (sup.vat || '') : '',
    supplierInvoiceNo: document.getElementById('pe-invno').value, date: document.getElementById('pe-date').value, dueDate: document.getElementById('pe-due').value,
    zohoBillNo: document.getElementById('pe-zoho').value, supplierTotal: document.getElementById('pe-suptotal').value,
    vat: s.vatTouched ? s.vat : null,
    costs: s.costs.map(c => ({ label: c.label, amount: piN(c.amount) })), discount: s.discount && piN(s.discount.value) > 0 ? { mode: s.discount.mode, value: piN(s.discount.value) } : null,
    lines: s.lines.map(l => ({ kind: l.kind, soId: l.soId, soLineId: l.soLineId, productId: l.productId, code: l.code, desc: l.desc, uom: l.uom, qty: l.qty, unitCost: l.unitCost === '' ? NaN : l.unitCost,
      discountPct: l.discountPct, reference: l.reference, costReason: l.costReason, extra: l.extra ? { to: l.extra.to, soId: l.extra.soId, soLineId: l.extra.soLineId } : null })),
  };
}
function piValidateLocal(input){
  const orders = new Map(), ledgers = new Map();
  input.lines.forEach(l => [l.soId, l.extra && l.extra.soId].filter(Boolean).forEach(id => { const so = piSOs().find(x => x.id === id); if (so) { orders.set(id, so); ledgers.set(id, piLedgerOf(id)); } }));
  return piCore().validatePurchaseInvoice(input, { settings: piSettings(), orders, ledgers, isAdmin: piIsAdmin() });
}
function piSetVat(v){ const s = piState(); s.vatTouched = true; s.vat = v; piRecalc(true); }
function piRecalc(keepVatFocus){
  const s = piState(); if (!s || !piCore()) return;
  const input = piReadInput(), v = piValidateLocal(input), t = v.totals, set = piSettings();
  // supplier total check
  const match = document.getElementById('pe-match');
  if (t.supplierTotal == null) match.innerHTML = `<div class="pi-match idle"><i class="ti ti-info-circle"></i><span>Type the total printed on the supplier's invoice. BizCore's total: <b>${piF(t.calcTotal)}</b></span></div>`;
  else if (Math.abs(t.rounding) <= set.roundingLimit + 1e-9) match.innerHTML = `<div class="pi-match ok"><i class="ti ti-circle-check"></i><span>Matches BizCore's total ${piF(t.calcTotal)}${Math.abs(t.rounding) > 0.0049 ? ` · difference <b>${t.rounding > 0 ? '+' : ''}${piF(t.rounding)}</b> recorded as rounding (limit ±${piF(set.roundingLimit)})` : ''}</span></div>`;
  else match.innerHTML = `<div class="pi-match bad"><i class="ti ti-alert-triangle"></i><span>BizCore's total is <b>${piF(t.calcTotal)}</b> — difference ${t.rounding > 0 ? '+' : ''}${piF(t.rounding)} is more than the ±${piF(set.roundingLimit)} rounding limit. Check quantities and prices.</span></div>`;
  // summary
  const vatInput = s.vatTouched ? s.vat : piF(t.vatCalculated);
  const sumEl = document.getElementById('pe-summary');
  if (!(keepVatFocus && document.activeElement && document.activeElement.id === 'pe-vat')) sumEl.innerHTML = `
    <div class="pi-ps"><span>Lines (ex-VAT)</span><b>${piF(t.linesTotal)}</b></div>
    ${t.costsTotal ? `<div class="pi-ps"><span>Additional costs</span><b>${piF(t.costsTotal)}</b></div>` : ''}
    ${t.discountAmount ? `<div class="pi-ps"><span>Discount</span><b class="pi-green">−${piF(t.discountAmount)}</b></div>` : ''}
    <div class="pi-ps"><span>VAT (${set.vatRate}%)</span><input id="pe-vat" class="pi-cell pi-vat" inputmode="decimal" value="${piEsc(vatInput)}" title="Adjust by a few halalas to match the supplier's VAT" oninput="piSetVat(this.value)"></div>
    <div class="pi-ps"><span>BizCore total</span><b>${piF(t.calcTotal)}</b></div>
    <div class="pi-ps"><span>Rounding <small>(to supplier's total)</small></span><b>${t.rounding == null ? '—' : (t.rounding > 0 ? '+' : '') + piF(t.rounding)}</b></div>
    <div class="pi-tot"><span>Total (SAR)</span><span>${piF(t.supplierTotal != null ? t.supplierTotal : t.calcTotal)}</span></div>
    <div class="pi-ps"><span>Paid now</span><b>0.00</b></div>
    <div class="pi-ps"><span>Balance to pay later</span><b class="pi-amber">${piF(t.supplierTotal != null ? t.supplierTotal : t.calcTotal)}</b></div>
    <div class="pi-ps"><span>Payment status</span><span class="pi-pay open">Unpaid (credit)</span></div>
    <p class="pi-note">Discount type (${set.discountMode === 'both' ? 'whole invoice and per line' : set.discountMode === 'line' ? 'per line' : 'whole invoice'}) and the rounding limit are set in Administration → Purchase Settings.</p>`;
  // cost vs estimate
  let est = 0, last = 0, none = 0, actual = 0, refd = 0;
  v.value.lines.forEach(l => { const amt = piN(l.amount); actual += amt; const r = l.reference || {}; if (r.source === 'pricing') { est += r.unit * l.qty; refd += amt; } else if (r.source === 'lastPaid') { last += r.unit * l.qty; refd += amt; } else none += amt; });
  const diff = refd - est - last, pct = est + last > 0 ? diff / (est + last) * 100 : 0;
  const prof = v.value.profit;
  document.getElementById('pe-cmp').innerHTML = `<div class="pi-ps"><span>Estimated (pricing)</span><b>${piF(est)}</b></div><div class="pi-ps"><span>Last paid (no estimate)</span><b>${piF(last)}</b></div><div class="pi-ps"><span>No reference</span><b>${piF(none)}</b></div>
    <div class="pi-ps"><span>Actual</span><b>${piF(actual)}</b></div><div class="pi-ps"><span>Difference <small>(lines with a reference)</small></span><b class="${diff > 0.005 ? 'pi-amber' : diff < -0.005 ? 'pi-blue' : ''}">${diff > 0 ? '+' : ''}${piF(diff)} (${pct > 0 ? '+' : ''}${pct.toFixed(1)}%)</b></div>
    ${piCanSeeProfit() && prof.sales > 0 ? piProfitBox(prof, true) : ''}`;
  // To continue
  const errs = v.errors, has = f => errs.some(e => f.includes(e.field));
  const chips = [];
  chips.push(has(['supplier', 'supplierInvoiceNo', 'date', 'dueDate']) ? '<span class="pi-todo-c">Supplier &amp; bill</span>' : '<span class="pi-todo-c ok"><i class="ti ti-check"></i>Supplier &amp; bill</span>');
  if (!s.lines.length) chips.push('<span class="pi-todo-c">Add lines</span>');
  const nReason = errs.filter(e => e.field === 'costReason').length; if (nReason) chips.push(`<span class="pi-todo-c">${nReason} Reason${nReason > 1 ? 's' : ''}</span>`);
  const nExtra = errs.filter(e => e.field === 'extra').length; if (nExtra) chips.push(`<span class="pi-todo-c">${nExtra} Extra qty to place</span>`);
  const nLine = errs.filter(e => ['qty', 'unitCost', 'desc', 'soLine', 'discountPct'].includes(e.field)).length; if (nLine) chips.push(`<span class="pi-todo-c">${nLine} Line${nLine > 1 ? 's' : ''} to complete</span>`);
  if (has(['costs', 'discount', 'vat'])) chips.push('<span class="pi-todo-c">Costs / discount / VAT</span>');
  chips.push(has(['supplierTotal']) ? '<span class="pi-todo-c">Supplier total</span>' : '<span class="pi-todo-c ok"><i class="ti ti-check"></i>Supplier total matches</span>');
  document.getElementById('pe-todo').innerHTML = chips.join('');
  document.getElementById('pe-save').disabled = !v.ok;
  s._v = v;
}
async function savePurchaseInvoice(){
  const m = document.getElementById('pi-new-modal'), s = piState(), lib = piLib(); if (!s || !lib) return;
  const input = piReadInput(), v = piValidateLocal(input);
  const err = document.getElementById('pe-error');
  if (!v.ok) { err.hidden = false; err.textContent = v.errors.map(e => e.message).join(' '); return; }
  const date = input.date ? new Date(input.date + 'T00:00:00') : new Date();
  const x = typeof docNumberParts === 'function' ? docNumberParts('purchaseInvoice', date) : { counterKey: 'doc_purchaseInvoice_all', displayPrefix: 'PI-' };
  const btn = document.getElementById('pe-save'); btn.disabled = true; err.hidden = true;
  try {
    const r = await lib.service.createPurchaseInvoice({ ...input, numbering: { counterKey: x.counterKey, displayPrefix: x.displayPrefix } });
    closeModal('pi-new-modal');
    if (typeof showToast === 'function') showToast(`${r.invoice.piNo} saved — Unpaid, due ${piDate(r.invoice.dueDate)}`, 'success');
  } catch (e) {
    err.hidden = false;
    err.textContent = e.code === 'permission-denied' ? 'The server refused the invoice. Please reload and try again.' : (e.message || 'Could not save the invoice.');
    btn.disabled = false;
  }
}

/* ═══════════════════════════════ VIEW + CANCEL ═══════════════════════════════ */
function openPurchaseInvoiceView(id){
  const pi = piInvoices().find(p => p.id === id); if (!pi) return;
  let m = document.getElementById('pi-view-modal');
  if (!m) { m = document.createElement('div'); m.className = 'modal-overlay'; m.id = 'pi-view-modal'; document.body.appendChild(m); }
  const t = pi.totals || {}, v = pi.status === 'Voided';
  const lines = (pi.lines || []).map(l => {
    const goes = (l.allocations || []).map(a => `<span class="pi-dest"><i class="ti ti-shopping-cart"></i>${piEsc(a.soNo)} · ${piQ(a.qty)}</span>`).join('') + (piN(l.stockQty) > 0 ? `<span class="pi-dest stock"><i class="ti ti-box"></i>Unassigned stock · ${piQ(l.stockQty)}</span>` : '');
    const ref = l.reference && l.reference.unit ? `${l.reference.source === 'lastPaid' ? 'last paid ' : 'est. '}${piF(l.reference.unit)}` : 'no reference';
    const pct = l.costPct != null ? ` (${l.costPct > 0 ? '+' : ''}${Number(l.costPct).toFixed(1)}%)` : '';
    return `<tr><td>${piEsc(l.desc)}<div class="pi-sub">${piEsc(l.uom)}${l.costReason ? ' · reason: ' + piEsc(l.costReason) : ''}</div></td><td class="num">${piQ(l.qty)}</td><td class="num">${piF(l.unitCost)}<div class="pi-sub ${l.costCheck === 'above' ? 'pi-red' : l.costCheck === 'below' ? 'pi-blue' : ''}">${ref}${pct}</div></td>
      ${piN(l.discountPct) ? `<td class="num">${piN(l.discountPct)}%</td>` : '<td class="num">—</td>'}<td class="num">${piF(l.amount)}</td><td class="num">${piF(l.landedUnitCost)}</td><td>${goes}</td></tr>`;
  }).join('');
  m.innerHTML = `<div class="modal pi-view" role="dialog" aria-modal="true" aria-labelledby="pi-view-title" style="width:min(1100px,96vw);max-width:1100px;height:auto;max-height:92vh">
    <div class="modal-header"><div><h2 id="pi-view-title">${piEsc(pi.piNo)} ${piPayPill(pi)}</h2><div class="so-create-subtitle">${piEsc(pi.supplierName)} · invoice ${piEsc(pi.supplierInvoiceNo)} · ${piDate(pi.date)}</div></div><button class="close-btn" type="button" onclick="closeModal('pi-view-modal')" aria-label="Close">✕</button></div>
    <div class="modal-body">
      ${v ? `<div class="pi-void-note"><i class="ti ti-ban"></i>Cancelled by ${piEsc(pi.voidedBy)} on ${piDate(String(pi.voidedAt || '').slice(0, 10))} — ${piEsc(pi.voidReason)}</div>` : ''}
      <div class="pi-view-head">
        <div><label>Supplier</label><b>${piEsc(pi.supplierName)}</b>${pi.supplierVat ? `<small>VAT ${piEsc(pi.supplierVat)}</small>` : ''}</div>
        <div><label>Supplier invoice no.</label><b>${piEsc(pi.supplierInvoiceNo)}</b></div>
        <div><label>Invoice date</label><b>${piDate(pi.date)}</b></div>
        <div><label>Payment due</label><b>${piDate(pi.dueDate)}</b></div>
        <div><label>Zoho bill no.</label><b>${piEsc(pi.zohoBillNo || '—')}</b></div>
        <div><label>Recorded by</label><b>${piEsc(pi.createdBy)}</b><small>${piDate(String(pi.created || '').slice(0, 10))}</small></div>
      </div>
      <div class="pi-lines-wrap"><table class="pi-lines"><thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Unit cost</th><th class="num">Disc.</th><th class="num">Amount</th><th class="num">Landed unit cost</th><th>Goes to</th></tr></thead><tbody>${lines}</tbody></table></div>
      <div class="pi-view-foot">
        <div>${(pi.costs || []).map(c => `<div class="pi-ps"><span>${piEsc(c.label)}</span><b>${piF(c.amount)}</b></div>`).join('')}${pi.discount ? `<div class="pi-ps"><span>Discount on the whole invoice${pi.discount.mode === 'percent' ? ' (' + pi.discount.value + '%)' : ''}</span><b class="pi-green">−${piF(pi.discount.amount)}</b></div>` : ''}</div>
        <div class="pi-view-sum"><div class="pi-ps"><span>Lines (ex-VAT)</span><b>${piF(t.linesTotal)}</b></div>${t.costsTotal ? `<div class="pi-ps"><span>Additional costs</span><b>${piF(t.costsTotal)}</b></div>` : ''}${t.discount ? `<div class="pi-ps"><span>Discount</span><b class="pi-green">−${piF(t.discount)}</b></div>` : ''}
          <div class="pi-ps"><span>VAT (${t.vatRate}%)</span><b>${piF(t.vat)}</b></div>${t.rounding ? `<div class="pi-ps"><span>Rounding</span><b>${t.rounding > 0 ? '+' : ''}${piF(t.rounding)}</b></div>` : ''}
          <div class="pi-tot"><span>Total (SAR)</span><span>${piF(t.total)}</span></div><div class="pi-ps"><span>Balance to pay</span><b class="pi-amber">${v ? '—' : piF(pi.balance)}</b></div>
          ${piCanSeeProfit() && pi.profit && pi.profit.sales > 0 ? piProfitBox(pi.profit, false) : ''}</div>
      </div>
      <div class="inv-error" id="pv-error" hidden></div>
    </div>
    <div class="modal-footer">${v ? '' : `<button class="btn btn-danger" type="button" style="margin-right:auto" onclick="piAskCancel('${piEsc(pi.id)}')"><i class="ti ti-ban"></i>Cancel invoice</button>`}<button class="btn btn-secondary" type="button" onclick="closeModal('pi-view-modal')">Close</button></div></div>`;
  if (typeof openModalWithSize === 'function') openModalWithSize('pi-view-modal'); else m.classList.add('open');
}
function piAskCancel(id){
  const pi = piInvoices().find(p => p.id === id); if (!pi) return;
  let m = document.getElementById('pi-void-modal');
  if (!m) { m = document.createElement('div'); m.className = 'modal-overlay'; m.id = 'pi-void-modal'; document.body.appendChild(m); }
  m.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="pi-void-title" style="width:min(480px,96vw);max-width:480px;height:auto">
    <div class="modal-header"><div class="modal-header-title-wrap"><h2 id="pi-void-title">Cancel ${piEsc(pi.piNo)}</h2></div><button class="close-btn" type="button" onclick="closeModal('pi-void-modal')" aria-label="Close">✕</button></div>
    <div class="modal-body"><p class="pi-note" style="margin-top:0">The invoice stays in the register, marked Cancelled. The quantities go back to "still to buy" on the orders, its stock is removed, and supplier invoice ${piEsc(pi.supplierInvoiceNo)} can be entered again.</p>
      <div class="form-group"><label for="pi-void-why">Reason *</label><input id="pi-void-why" maxlength="300" placeholder="e.g. wrong supplier, entered twice"></div><div class="inv-error" id="pi-void-err" hidden></div></div>
    <div class="modal-footer"><button class="btn btn-secondary" type="button" onclick="closeModal('pi-void-modal')">Go back</button><button class="btn btn-danger" type="button" id="pi-void-save" onclick="piDoCancel('${piEsc(pi.id)}')"><i class="ti ti-ban"></i>Cancel invoice</button></div></div>`;
  if (typeof openModalWithSize === 'function') openModalWithSize('pi-void-modal'); else m.classList.add('open');
  setTimeout(() => document.getElementById('pi-void-why').focus(), 60);
}
async function piDoCancel(id){
  const pi = piInvoices().find(p => p.id === id), why = document.getElementById('pi-void-why').value.trim(), err = document.getElementById('pi-void-err');
  if (!why) { err.hidden = false; err.textContent = 'Enter the reason for cancelling.'; return; }
  const btn = document.getElementById('pi-void-save'); btn.disabled = true;
  try {
    await piLib().service.voidPurchaseInvoice({ operationId: 'piv-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10), invoiceId: id, reason: why, expectedRevision: pi.revision });
    closeModal('pi-void-modal'); closeModal('pi-view-modal');
    if (typeof showToast === 'function') showToast(`${pi.piNo} cancelled`, 'success');
  } catch (e) { err.hidden = false; err.textContent = e.message || 'Could not cancel.'; btn.disabled = false; }
}

/* ═══════════════════════════════ ADMINISTRATION → PURCHASE SETTINGS ═══════════════════════════════ */
function renderPurchaseSettings(){
  const host = document.getElementById('ps-form'); if (!host || !piLib()) return;
  piLib().start();
  const s = piSettings(), admin = piIsAdmin(), dis = admin ? '' : ' disabled';
  host.innerHTML = `<div class="ps-grid">
    <div class="form-group"><label for="ps-limit">Cost increase limit (%)</label><input id="ps-limit" inputmode="decimal" value="${s.costLimitPct}"${dis}><small>Compared with the Pricing estimate, or the last price paid when there is none.</small></div>
    <div class="form-group"><label for="ps-action">Above the limit</label><select id="ps-action"${dis}><option value="reason"${s.costLimitAction === 'reason' ? ' selected' : ''}>Ask for a reason</option><option value="block"${s.costLimitAction === 'block' ? ' selected' : ''}>Don't allow saving</option></select></div>
    <div class="form-group"><label for="ps-disc">Supplier discount</label><select id="ps-disc"${dis}><option value="invoice"${s.discountMode === 'invoice' ? ' selected' : ''}>On the whole invoice</option><option value="line"${s.discountMode === 'line' ? ' selected' : ''}>Per line</option><option value="both"${s.discountMode === 'both' ? ' selected' : ''}>Both</option></select></div>
    <div class="form-group"><label for="ps-round">Rounding limit (SAR, ±)</label><input id="ps-round" inputmode="decimal" value="${s.roundingLimit}"${dis}><small>Largest accepted difference between BizCore's total and the supplier's invoice total.</small></div>
    <div class="form-group"><label for="ps-vat">VAT rate (%)</label><input id="ps-vat" inputmode="decimal" value="${s.vatRate}"${dis}></div>
    <div class="form-group"><label for="ps-profit">Profit on orders is shown to</label><select id="ps-profit"${dis}><option value="admins"${s.profitVisibility === 'admins' ? ' selected' : ''}>Administrators only</option><option value="everyone"${s.profitVisibility === 'everyone' ? ' selected' : ''}>Everyone</option></select></div>
  </div><div class="inv-error" id="ps-error" hidden></div>
  <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px">${admin ? '<button class="btn btn-primary" type="button" id="ps-save" onclick="savePurchaseSettingsForm()"><i class="ti ti-device-floppy"></i>Save settings</button>' : '<span class="pi-muted">Only administrators can change these settings.</span>'}</div>`;
}
async function savePurchaseSettingsForm(){
  const g = id => document.getElementById(id).value;
  const btn = document.getElementById('ps-save'), err = document.getElementById('ps-error'); btn.disabled = true; err.hidden = true;
  try {
    await piLib().service.savePurchaseSettings({ costLimitPct: g('ps-limit'), costLimitAction: g('ps-action'), discountMode: g('ps-disc'), roundingLimit: g('ps-round'), vatRate: g('ps-vat'), profitVisibility: g('ps-profit') });
    if (typeof showToast === 'function') showToast('Purchase settings saved', 'success');
  } catch (e) { err.hidden = false; err.textContent = e.message || 'Could not save.'; }
  finally { btn.disabled = false; }
}

(function piWire(){
  const go = () => {
    const lib = piLib(); if (!lib) return setTimeout(go, 300);
    lib.onChange(() => {
      const p = document.getElementById('page-purchaseinvoices'); if (p && p.classList.contains('active')) renderPurchaseRegister(); else { try { renderPurchaseRegister(); } catch (e) {} }
      const t = document.getElementById('setup-tab-purchase-settings'); if (t && t.style.display !== 'none') renderPurchaseSettings();
    });
    lib.start();
    if (window.BCDateFilter) BCDateFilter.register('pireg', () => renderPurchaseRegister());
  };
  go();
})();
console.log('Purchase Invoices V268.1 ✅');
