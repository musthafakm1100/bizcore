/* ═══════════════════════════════════════════════════════════════════
   BizCore V268.12 — Purchasing → Purchase Invoices (approved mockups 4 + 7, 17 Oct 2026)
   V268.2: supplier payments at entry and later (Record payment), discount at payment, cash back, cancel payment
   V268.12: item · sales order in one wide column, qty "of N to buy" + status, Selling → P/L per line (allowed roles), phone cards
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
/** Paid / Part paid / Unpaid pill (credit = nothing paid at entry). */
function piStatusPill(st, credit){
  return st === 'Paid' ? '<span class="pi-pay paid">Paid</span>' : st === 'Part paid' ? '<span class="pi-pay open">Part paid</span>' : `<span class="pi-pay open">${credit ? 'Unpaid (credit)' : 'Unpaid'}</span>`;
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
        <section class="so-entry-card"><div class="so-entry-card-title so-items-title"><span class="pi-title-ic"><i class="ti ti-cash"></i>Payments <span id="pe-pay-pill"></span><span class="pi-sub pi-pay-hint">· one line per account; paying more than the total is not allowed yet</span></span><span class="pi-actions"><button type="button" class="btn btn-secondary btn-sm" id="pe-add-pay" onclick="piAddPayLine()"><i class="ti ti-plus"></i>Add payment</button></span></div>
          <div class="pi-lines-wrap"><table class="pi-lines pi-pay-table"><thead id="pe-pay-head"></thead><tbody id="pe-pay"></tbody></table></div>
          <div class="pi-pm-disc pi-pe-disc" id="pe-disc-row" hidden><i class="ti ti-discount"></i><b>Discount at payment</b><span class="pi-sub">optional — the supplier accepts less than the balance</span><input id="pe-pay-disc" class="pi-cell pi-money" inputmode="decimal" placeholder="0.00" aria-label="Discount at payment" oninput="piRecalc()" onblur="piMoneyBlur(this)"></div>
          <div class="pi-due" id="pe-due-row"><i class="ti ti-clock"></i><span id="pe-due-text"></span><label for="pe-due">Payment due *</label><input id="pe-due" type="date" onchange="piState().dueTouched=true;piRecalc()"></div>
          <div class="pi-paid-full" id="pe-paid-full" hidden><i class="ti ti-circle-check"></i>Paid in full — nothing goes to the supplier's payable.</div>
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
  m._s = { lines: [], costs: [], discount: null, vatTouched: false, pays: [], op: 'pi-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10) };
  piStartAccounts();
  const sups = (typeof suppliers !== 'undefined' ? suppliers : []).slice().sort((a, b) => String(a.company || '').localeCompare(String(b.company || '')));
  document.getElementById('pe-supplier').innerHTML = '<option value="">Choose the supplier…</option>' + sups.map(s => `<option value="${piEsc(s.id)}">${piEsc(s.company || s.name || s.id)}</option>`).join('');
  ['pe-invno', 'pe-zoho', 'pe-suptotal', 'pe-pay-disc'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('pe-date').value = today;
  document.getElementById('pe-due').value = piAddDays(today, 30);
  const x = typeof docNumberParts === 'function' ? docNumberParts('purchaseInvoice') : { displayPrefix: 'PI-' };
  document.getElementById('pe-subtitle').textContent = `Number assigned on save · ${x.displayPrefix}…`;
  document.getElementById('pe-error').hidden = true;
  piRenderLines(); piRenderCosts(); piRenderPays(); piRecalc();
  if (typeof openModalWithSize === 'function') openModalWithSize('pi-new-modal'); else m.classList.add('open');
  setTimeout(() => document.getElementById('pe-supplier').focus(), 60);
}
function piHeadChanged(dateChanged){
  const s = piState(); if (!s) return;
  if (dateChanged) {
    const d = document.getElementById('pe-date').value; if (d && !s.dueTouched) document.getElementById('pe-due').value = piAddDays(d, 30);
    if (d) { s.pays.forEach(p => { if (!p.dateTouched) p.date = d; }); piRenderPays(); }
  }
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
  if (chk.kind === 'none') return { chk, html: '<span class="pi-var att"><i class="ti ti-info-circle"></i> No estimate or previous price</span>' };
  if (line.unitCost === '' || line.unitCost == null) return { chk, html: '' };
  const pct = (chk.pct > 0 ? '+' : '') + chk.pct.toFixed(1) + '%';
  if (chk.kind === 'equal') return { chk, html: `<span class="pi-var eq">${what ? 'Same as last paid' : 'As estimated'}</span>` };
  if (chk.kind === 'below') return { chk, html: `<span class="pi-var dn">${pct} — below ${what ? 'last paid' : 'estimate'}</span>` };
  if (chk.kind === 'within') return { chk, html: `<span class="pi-var up">${pct} ${what || '— within limit'}</span>` };
  return { chk, html: `<span class="pi-var upr">${pct} ${what ? what + ' — ' : '— '}above ${set.costLimitPct}% limit</span>` };
}
/* V268.12 (mockup 7): qty box → "of N to buy" → ✓ complete / +N extra / N still to buy */
function piQtyInfo(l, i){
  if (l.kind !== 'order') return '';
  const left = piLeftFor(l, i), q = piN(l.qty);
  let st = '';
  if (q > 0) st = Math.abs(q - left) < 1e-9 ? '<div class="pi-qst ok"><i class="ti ti-check"></i> Complete</div>'
    : q > left ? `<div class="pi-qst ex">+${piQ(q - left)} extra</div>` : `<div class="pi-qst sh">${piQ(left - q)} still to buy</div>`;
  return `<div class="pi-ref-sub">Of ${piQ(left)} to buy</div>${st}`;
}
/** Selling → P/L of one line: selling price on the Sales Order × qty for the order(s) − landed cost of that qty. */
function piLinePL(vl, factor){
  if (!vl) return null;
  const allocs = vl.allocations || [], q = allocs.reduce((s, a) => s + piN(a.qty), 0);
  if (!(q > 0) || !Number.isFinite(Number(vl.landedUnitCost))) return null;
  const sales = allocs.reduce((s, a) => s + piN(a.sellUnit != null ? a.sellUnit : vl.sellUnit) * piN(a.qty), 0);
  // V268.2: discount at payment / cash back lower every item's cost by the same share
  const profit = sales - piN(vl.landedUnitCost) * (1 - (Number(factor) || 0)) * q;
  return { sell: piN(vl.sellUnit), q, sales, profit, pct: sales > 0 ? profit / sales * 100 : null, partial: piN(vl.stockQty) > 0 };
}
function piPLHtml(vl, factor){
  if (vl && vl.kind === 'stock') return '<span class="pi-sub">For stock</span>';
  const p = piLinePL(vl, factor); if (!p) return '<span class="pi-sub">—</span>';
  const loss = p.profit < -0.005, c = loss ? 'pi-red' : 'pi-green';
  return `<span class="pi-sub">Sell ${piF(p.sell)}</span><b class="pi-plv ${c}">${p.profit > 0.005 ? '+' : ''}${piF(p.profit)}</b><span class="pi-plp ${c}">${p.pct == null ? '' : p.pct.toFixed(1) + '%'}${p.partial ? ` · ${piQ(p.q)} for the order` : ''}</span>`;
}
function piRefLine(ref){
  if (!ref || !(Number(ref.unit) > 0)) return '';
  return ref.source === 'lastPaid' ? `<div class="pi-ref-sub">Last paid ${piF(ref.unit)}${ref.refDate ? ' · ' + piDate(ref.refDate) : ''}</div>` : `<div class="pi-ref-sub">Est. ${piF(ref.unit)}</div>`;
}
function piRenderLines(){
  const s = piState(); if (!s) return;
  const lineDisc = ['line', 'both'].includes(piSettings().discountMode), pl = piCanSeeProfit();
  const tbl = document.querySelector('#pi-new-modal table.pi-lines'); if (tbl) { tbl.classList.toggle('pi-has-disc', lineDisc); tbl.classList.toggle('pi-has-pl', pl); }
  document.getElementById('pe-lines-head').innerHTML = `<tr><th>Item · sales order</th><th class="num" style="width:96px">Qty bought</th><th class="num" style="width:136px">Unit cost</th>${lineDisc ? '<th class="num" style="width:76px">Disc. %</th>' : ''}<th class="num" style="width:96px">Amount</th>${pl ? '<th class="num pi-plh" style="width:118px">Selling → P/L</th>' : ''}<th class="pi-goesh" style="width:160px">Goes to</th><th style="width:34px"></th></tr>`;
  const cols = 5 + (lineDisc ? 1 : 0) + (pl ? 1 : 0) + 1;
  const body = document.getElementById('pe-lines');
  if (!s.lines.length) { body.innerHTML = `<tr><td colspan="${cols}" class="pi-empty-lines"><i class="ti ti-shopping-cart"></i>Add the items from the supplier's invoice: <b>Add from sales orders</b>, or <b>Add item for stock</b>.</td></tr>`; return; }
  body.innerHTML = s.lines.map((l, i) => {
    const tag = piCostTag(l);
    const amount = piN(l.qty) * piN(l.unitCost) * (1 - (lineDisc ? piN(l.discountPct) : 0) / 100);
    const qtyTd = `<td class="num pi-c-qty" data-label="Qty bought"><input class="pi-cell" inputmode="decimal" value="${piEsc(l.qty)}" aria-label="Qty bought" onchange="piSetLine(${i},'qty',this.value,true)" oninput="piSetLine(${i},'qty',this.value)"><div class="pi-qinfo">${piQtyInfo(l, i)}</div></td>`;
    const costTd = `<td class="num pi-c-cost" data-label="Unit cost"><input class="pi-cell pi-cost" inputmode="decimal" value="${l.unitCost === '' ? '' : piEsc(l.unitCost)}" aria-label="Unit cost" onchange="piSetLine(${i},'unitCost',this.value,true)" oninput="piSetLine(${i},'unitCost',this.value)">${piRefLine(l.reference)}${tag.html}</td>`;
    const discTd = lineDisc ? `<td class="num pi-c-disc" data-label="Disc. %"><input class="pi-cell pi-disc" inputmode="decimal" value="${piEsc(l.discountPct || '')}" aria-label="Discount %" onchange="piSetLine(${i},'discountPct',this.value,true)"></td>` : '';
    const amtTd = `<td class="num pi-c-amt" data-label="Amount"><span class="pi-amt">${piF(amount)}</span></td>`;
    const plTd = pl ? `<td class="num pi-c-pl pi-pl">${l.kind === 'stock' ? '<span class="pi-sub">For stock</span>' : ''}</td>` : '';
    const xTd = `<td class="pi-c-x"><button type="button" class="pi-x" title="Remove line" aria-label="Remove line" onclick="piRemoveLine(${i})"><i class="ti ti-x"></i></button></td>`;
    let rows = '';
    if (l.kind === 'order') {
      const left = piLeftFor(l, i), extra = Math.max(0, piN(l.qty) - left);
      const goes = `<span class="pi-dest"><i class="ti ti-shopping-cart"></i>${piEsc(l.soNo)}${extra > 0 ? ' · ' + piQ(Math.min(piN(l.qty), left)) : ''}</span>` + (extra > 0 ? (l.extra ? (l.extra.to === 'stock' ? `<span class="pi-dest stock"><i class="ti ti-box"></i>Unassigned stock · ${piQ(extra)}</span>` : `<span class="pi-dest"><i class="ti ti-shopping-cart"></i>${piEsc(l.extra.soNo)} · ${piQ(extra)}</span>`) : `<div class="pi-ref-sub warn">+ ${piQ(extra)} to place ↓</div>`) : '');
      rows = `<tr class="pi-line" data-i="${i}"><td class="pi-c-item"><div class="pi-idesc">${piEsc(l.desc)}</div><div class="pi-sub">${piEsc(l.uom)} · <span class="pi-so">${piEsc(l.soNo)}</span> · ${piEsc(l.customer || '')}</div></td>
        ${qtyTd}${costTd}${discTd}${amtTd}${plTd}<td class="pi-c-goes">${goes}</td>${xTd}</tr>`;
      if (extra > 0 && !l.extra) {
        const others = piOtherOrdersFor(l).filter(x => x.left >= extra);
        rows += `<tr class="pi-ask-row"><td colspan="${cols}"><div class="pi-ask"><i class="ti ti-help-circle"></i><b>${piQ(extra)} more than ${piEsc(l.soNo)} needs.</b> Where should they go? *
          <button type="button" class="pi-opt" onclick="piPlaceExtra(${i},'stock')"><i class="ti ti-box"></i>Unassigned stock</button>
          ${others.map(x => `<button type="button" class="pi-opt" onclick="piPlaceExtra(${i},'order','${piEsc(x.so.id)}','${piEsc(x.it.lineId)}')"><i class="ti ti-shopping-cart"></i>${piEsc(x.so.soNo)} · needs ${piQ(x.left)}</button>`).join('')}
          <button type="button" class="pi-opt" onclick="piSetLine(${i},'qty','${piQ(left)}',true)"><i class="ti ti-pencil"></i>Correct quantity to ${piQ(left)}</button></div></td></tr>`;
      } else if (extra > 0 && l.extra) rows += `<tr class="pi-ask-row"><td colspan="${cols}"><div class="pi-placed"><i class="ti ti-circle-check"></i>${piQ(extra)} extra → ${l.extra.to === 'stock' ? 'Unassigned stock' : piEsc(l.extra.soNo)} <button type="button" class="pi-link" onclick="piPlaceExtra(${i},null)">change</button></div></td></tr>`;
    } else {
      rows = `<tr class="pi-line" data-i="${i}"><td class="pi-c-item"><input class="pi-cell pi-stock-desc" list="pe-products" value="${piEsc(l.desc)}" placeholder="Item (product or description)" aria-label="Item" onchange="piSetStockItem(${i},this.value)"><div class="pi-sub"><input class="pi-cell pi-uom" value="${piEsc(l.uom)}" aria-label="Unit" onchange="piSetLine(${i},'uom',this.value,true)"> · <span class="pi-stock-tag"><i class="ti ti-box"></i> for stock</span></div></td>
        ${qtyTd}${costTd}${discTd}${amtTd}${plTd}<td class="pi-c-goes"><span class="pi-dest stock"><i class="ti ti-box"></i>Unassigned stock · ${piQ(l.qty)}</span></td>${xTd}</tr>`;
    }
    if (tag.chk.kind === 'above' && piSettings().costLimitAction === 'reason')
      rows += `<tr class="pi-ask-row"><td colspan="${cols}"><div class="pi-reason"><i class="ti ti-alert-triangle"></i>Reason for the higher cost * <input class="pi-cell" maxlength="300" value="${piEsc(l.costReason)}" placeholder="e.g. supplier price increase, urgent purchase" oninput="piSetLine(${i},'costReason',this.value)"></div></td></tr>`;
    return rows;
  }).join('');
  let dl = document.getElementById('pe-products');
  if (!dl) { dl = document.createElement('datalist'); dl.id = 'pe-products'; document.body.appendChild(dl); }
  dl.innerHTML = (typeof products !== 'undefined' ? products : []).map(p => `<option value="${piEsc(p.name)}">${piEsc([p.code, p.uom].filter(Boolean).join(' · '))}</option>`).join('');
}
/** Fill each line's Selling → P/L from the checked invoice (landed cost includes the shared costs and discount). */
function piFillLinePL(v){
  if (!piCanSeeProfit() || !v || !v.value) return;
  const s = piState();
  document.querySelectorAll('#pe-lines tr.pi-line').forEach(tr => {
    const i = Number(tr.dataset.i), l = s.lines[i], td = tr.querySelector('.pi-pl'); if (!td || !l) return;
    td.innerHTML = l.kind === 'stock' ? '<span class="pi-sub">For stock</span>' : (l.unitCost === '' || l.unitCost == null) ? '<span class="pi-sub">—</span>' : piPLHtml(v.value.lines[i]);
  });
}
function piSetLine(i, field, value, rerender){
  const s = piState(); const l = s && s.lines[i]; if (!l) return;
  l[field] = value;
  if (field === 'qty' && l.extra && piN(value) <= piLeftFor(l, i)) l.extra = null;
  if (rerender) { piRenderLines(); }
  else if (field === 'qty' || field === 'unitCost') {
    const tr = document.querySelector(`#pe-lines tr[data-i="${i}"]`);
    if (tr) { const a = tr.querySelector('.pi-amt'); if (a) a.textContent = piF(piN(l.qty) * piN(l.unitCost) * (1 - (['line', 'both'].includes(piSettings().discountMode) ? piN(l.discountPct) : 0) / 100));
      if (field === 'qty') { const q = tr.querySelector('.pi-qinfo'); if (q) q.innerHTML = piQtyInfo(l, i); } }
  }
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
    <small>Sales value ${piF(p.sales)} − cost ${piF(p.cost)}${p.reduced ? ` · cost lowered ${piF(p.reduced)} by discount at payment / cash back` : ''}${note ? ' · shown only to roles allowed in Administration' : ''}</small></div>`;
}
/* totals, checks, "To continue" */
function piReadInput(){
  const s = piState(), sel = document.getElementById('pe-supplier');
  const sup = (typeof suppliers !== 'undefined' ? suppliers : []).find(x => x.id === sel.value);
  return {
    operationId: s.op, supplierId: sup ? sup.id : '', supplierName: sup ? (sup.company || sup.name || '') : '', supplierVat: sup ? (sup.vat || '') : '',
    supplierInvoiceNo: document.getElementById('pe-invno').value, date: document.getElementById('pe-date').value,
    // V268.2: paid in full at entry → nothing is payable later; the due date is the invoice date
    dueDate: piIsFull(s) ? document.getElementById('pe-date').value : document.getElementById('pe-due').value,
    zohoBillNo: document.getElementById('pe-zoho').value, supplierTotal: document.getElementById('pe-suptotal').value,
    vat: s.vatTouched ? s.vat : null,
    costs: s.costs.map(c => ({ label: c.label, amount: piN(c.amount) })), discount: s.discount && piN(s.discount.value) > 0 ? { mode: s.discount.mode, value: piN(s.discount.value) } : null,
    lines: s.lines.map(l => ({ kind: l.kind, soId: l.soId, soLineId: l.soLineId, productId: l.productId, code: l.code, desc: l.desc, uom: l.uom, qty: l.qty, unitCost: l.unitCost === '' ? NaN : l.unitCost,
      discountPct: l.discountPct, reference: l.reference, costReason: l.costReason, extra: l.extra ? { to: l.extra.to, soId: l.extra.soId, soLineId: l.extra.soLineId } : null })),
    payments: piPayGroups(s.pays, document.getElementById('pe-date').value),
  };
}
/* ═══════════════════════════════ V268.2 PAYMENTS (approved mockups PI_4 / PI_8 / PI_9 / PI_10) ═══════════════════════════════ */
const piAccLib = () => window.BizCoreAcc;
const piAccounts = () => (piAccLib() ? piAccLib().accounts : []);
const piAccOf = id => piAccounts().find(a => a.id === id) || null;
const piAccMap = () => new Map(piAccounts().map(a => [a.id, a]));
function piStartAccounts(){ if (piAccLib()) piAccLib().start(); if (window.BizCoreCash) window.BizCoreCash.start(); }
const PI_TY = { cash: ['c', 'ti-cash'], card: ['k', 'ti-credit-card'], bank: ['b', 'ti-building-bank'] };
function piAccIcon(t){ const m = PI_TY[t] || PI_TY.cash; return `<span class="pi-ty ${m[0]}"><i class="ti ${m[1]}"></i></span>`; }
function piAccLabel(a){ return a ? `${a.code} · ${a.name}` : ''; }
/** Account choices, grouped by type (only active accounts; the current one is kept). */
function piAccOptions(current, types){
  const list = piAccounts().filter(a => (a.active !== false || a.id === current) && (!types || types.includes(a.type)));
  const grp = { cash: 'Cash', card: 'Card', bank: 'Bank' };
  return '<option value="">Choose the account…</option>' + Object.keys(grp).filter(t => list.some(a => a.type === t)).map(t =>
    `<optgroup label="${grp[t]}">${list.filter(a => a.type === t).map(a => `<option value="${piEsc(a.id)}"${a.id === current ? ' selected' : ''}>${piEsc(piAccLabel(a))}</option>`).join('')}</optgroup>`).join('');
}
/** What happens on this account: cash → the custodian confirms; card → from its linked bank; bank → bank charge. */
function piPayInfo(p, onCharge){
  const a = piAccOf(p.accountId); if (!a) return '';
  if (a.type === 'cash') return `<span class="pi-wait">⏳ ${piEsc(String(a.custodianName || 'Custodian').split(/\s+/)[0])} confirms</span>`;
  if (a.type === 'card') { const b = piAccOf(a.linkedBankAccountId); return b ? `<span class="pi-via"><i class="ti ti-building-bank"></i>via ${piEsc(b.name)} — bank balance, at once</span>` : '<span class="pi-red pi-via"><i class="ti ti-alert-triangle"></i>No linked bank account — set it in Administration → Payment Accounts</span>'; }
  return onCharge ? `<span class="pi-chg"><label>Bank charge</label><input class="pi-cell pi-money" inputmode="decimal" placeholder="0.00" value="${piEsc(p.bankCharge || '')}" aria-label="Bank charge" oninput="${onCharge}"></span><span class="pi-sub">→ bank expense, not the supplier</span>` : '<span class="pi-sub">Bank — no confirmation</span>';
}
/** Payment lines of the new invoice → one payment per date. */
function piPayGroups(pays, invDate){
  const groups = new Map();
  (pays || []).forEach(p => {
    if (!p.accountId && !String(p.amount || '').trim()) return;
    const d = p.date || invDate;
    if (!groups.has(d)) groups.set(d, []);
    groups.get(d).push({ accountId: p.accountId, amount: p.amount, reference: p.reference, bankCharge: p.bankCharge });
  });
  return [...groups].map(([date, lines]) => ({ date, lines, numbering: piPayNumbering(date) }));
}
function piPayNumbering(date){
  const d = /^\d{4}-\d{2}-\d{2}$/.test(String(date || '')) ? new Date(date + 'T00:00:00') : new Date();
  const x = typeof docNumberParts === 'function' ? docNumberParts('supplierPayment', d) : { counterKey: 'doc_supplierPayment_all', displayPrefix: 'SP-' };
  return { counterKey: x.counterKey, displayPrefix: x.displayPrefix };
}
/** Checks the entry's payments one after the other against what is left of the total. */
function piCheckPays(groups, total, discountRaw){
  const C = piCore(), accounts = piAccMap();
  const inv = { status: 'Posted', totals: { total }, paid: 0, paymentDiscount: 0, cashBack: 0 };
  const errors = [];
  groups.forEach(g => {
    const v = C.validateSupplierPayment({ kind: 'payment', date: g.date, lines: g.lines, discount: 0 }, { invoice: inv, accounts, today: piToday() });
    errors.push(...v.errors);
    if (v.ok) inv.paid = Math.round((inv.paid + v.value.amount) * 100) / 100;
  });
  // V268.21: discount at payment on the new invoice (saved right after the invoice, as a discount-only payment)
  const raw = String(discountRaw == null ? '' : discountRaw).replace(/[,\s]/g, '');
  let discount = 0;
  if (raw !== '') {
    if (!/^\d+(\.\d{1,2})?$/.test(raw)) errors.push({ field: 'discount', message: 'Discount at payment must be a number (up to 2 decimals).' });
    else {
      discount = Math.round(Number(raw) * 100) / 100;
      const room = Math.round((total - inv.paid) * 100) / 100;
      if (discount > room + 0.005) errors.push({ field: 'discount', message: `Discount at payment ${piF(discount)} is more than the balance ${piF(Math.max(0, room))}.` });
    }
  }
  const accts = new Set(groups.flatMap(g => g.lines.map(l => l.accountId)).filter(Boolean));
  return { paid: inv.paid, discount, errors, accounts: accts.size };
}
/** Paid in full at entry (payments + discount at payment cover the total) — no due date needed. */
function piIsFull(s){ return !!(s && s._pay && s._total > 0 && s._total - s._pay.paid - s._pay.discount <= 0.005 && !s._pay.errors.length); }
function piAddPayLine(){
  const s = piState(); if (!s) return;
  const date = document.getElementById('pe-date').value || piToday();
  const t = s._v ? s._v.totals : null, total = t ? (t.supplierTotal != null ? t.supplierTotal : t.calcTotal) : 0;
  const paid = piCheckPays(piPayGroups(s.pays, date), total).paid;
  const left = Math.max(0, Math.round((total - paid) * 100) / 100);
  s.pays.push({ accountId: '', date, amount: left > 0 ? piF(left) : '', reference: '', bankCharge: '' });
  piRenderPays(); piRecalc();
  setTimeout(() => { const el = document.querySelectorAll('#pe-pay .pi-pay-acc'); if (el.length) el[el.length - 1].focus(); }, 30);
}
function piSetPay(i, field, value, rerender){
  const s = piState(), p = s && s.pays[i]; if (!p) return;
  p[field] = value;
  if (field === 'date') p.dateTouched = true;
  if (field === 'accountId') { const a = piAccOf(value); if (!a || a.type !== 'bank') p.bankCharge = ''; }
  if (rerender) piRenderPays();
  piRecalc();
}
function piRenderPays(){
  const s = piState(); if (!s) return;
  document.getElementById('pe-pay-head').innerHTML = s.pays.length ? '<tr><th>Paid from (payment account)</th><th style="width:150px">Date</th><th class="num" style="width:130px">Amount</th><th style="width:160px">Reference</th><th style="width:250px">Confirmation</th><th style="width:34px"></th></tr>' : '';
  const body = document.getElementById('pe-pay');
  body.innerHTML = s.pays.length ? s.pays.map((p, i) => {
    const a = piAccOf(p.accountId);
    return `<tr class="pi-pay-line" data-p="${i}"><td><span class="pi-pay-sel">${a ? piAccIcon(a.type) : ''}<select class="pi-pay-acc" aria-label="Paid from" onchange="piSetPay(${i},'accountId',this.value,true)">${piAccOptions(p.accountId)}</select></span></td>
      <td><input class="pi-cell pi-pay-date" type="date" value="${piEsc(p.date)}" aria-label="Payment date" onchange="piSetPay(${i},'date',this.value)"></td>
      <td class="num"><input class="pi-cell pi-money pi-pay-amt" inputmode="decimal" placeholder="0.00" value="${piEsc(p.amount)}" aria-label="Amount" oninput="piSetPay(${i},'amount',this.value)" onblur="piMoneyBlur(this)"></td>
      <td><input class="pi-cell pi-pay-ref" maxlength="60" placeholder="optional" value="${piEsc(p.reference)}" aria-label="Reference" oninput="piSetPay(${i},'reference',this.value)"></td>
      <td class="pi-pay-info">${piPayInfo(p, `piSetPay(${i},'bankCharge',this.value)`)}</td>
      <td><button type="button" class="pi-x" title="Remove payment" aria-label="Remove payment" onclick="piState().pays.splice(${i},1);piRenderPays();piRecalc()"><i class="ti ti-x"></i></button></td></tr>`;
  }).join('') : `<tr><td class="pi-empty-lines pi-nopay"><i class="ti ti-cash-off"></i>No payment now — the whole total goes to the supplier's payable. Use <b>Add payment</b> if you paid all or part of it.</td></tr>`;
}
function piValidateLocal(input){
  const orders = new Map(), ledgers = new Map();
  input.lines.forEach(l => [l.soId, l.extra && l.extra.soId].filter(Boolean).forEach(id => { const so = piSOs().find(x => x.id === id); if (so) { orders.set(id, so); ledgers.set(id, piLedgerOf(id)); } }));
  return piCore().validatePurchaseInvoice(input, { settings: piSettings(), orders, ledgers, isAdmin: piIsAdmin() });
}
function piSetVat(v){ const s = piState(); s.vatTouched = true; s.vat = v; piRecalc(true); }
function piRecalc(keepVatFocus){
  const s = piState(); if (!s || !piCore()) return;
  let input = piReadInput(), v = piValidateLocal(input), t = v.totals;
  const set = piSettings();
  // V268.2: payments made now, checked against the total (paid in full → no due date needed)
  const total = t.supplierTotal != null ? t.supplierTotal : t.calcTotal;
  const pc = piCheckPays(input.payments, total, (document.getElementById('pe-pay-disc') || {}).value);
  const left = Math.round((total - pc.paid - pc.discount) * 100) / 100, stNow = piCore().payStatusFrom(total, pc.paid, pc.discount);
  const prevFull = piIsFull(s);
  s._pay = pc; s._total = total;
  const full = piIsFull(s);
  if (full !== !!prevFull) { input = piReadInput(); v = piValidateLocal(input); t = v.totals; }
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
    <div class="pi-ps"><span>Paid now${pc.accounts ? ` <small>(${pc.accounts} account${pc.accounts > 1 ? 's' : ''})</small>` : ''}</span><b>${piF(pc.paid)}</b></div>
    ${pc.discount ? `<div class="pi-ps"><span>Discount at payment</span><b class="pi-green">−${piF(pc.discount)}</b></div>` : ''}
    <div class="pi-ps"><span>Balance to pay later</span><b class="${left > 0.005 ? 'pi-amber' : 'pi-green'}">${piF(Math.max(0, left))}</b></div>
    <div class="pi-ps"><span>Payment status</span>${piStatusPill(stNow, true)}</div>
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
  if (pc.errors.length) chips.push('<span class="pi-todo-c">Payments to complete</span>');
  else if (pc.paid > 0 || pc.discount > 0) chips.push(`<span class="pi-todo-c ok"><i class="ti ti-check"></i>${full ? 'Paid in full' : `Part paid · ${piF(left)} due`}</span>`);
  document.getElementById('pe-todo').innerHTML = chips.join('');
  document.getElementById('pe-save').disabled = !v.ok || pc.errors.length > 0;
  // payment section: status, balance left / paid in full
  const pill = document.getElementById('pe-pay-pill'); if (pill) pill.innerHTML = pc.paid > 0 || pc.discount > 0 ? piStatusPill(stNow) : '';
  const discRow = document.getElementById('pe-disc-row'); if (discRow) discRow.hidden = !s.pays.length && !pc.discount;
  const dueRow = document.getElementById('pe-due-row'), fullRow = document.getElementById('pe-paid-full');
  if (dueRow) { dueRow.hidden = full; document.getElementById('pe-due-text').innerHTML = pc.paid > 0 || pc.discount > 0 ? `<b>Balance to pay later: ${piF(Math.max(0, left))}</b> — goes to the supplier's payable` : `Not paid now — the whole total <b>${piF(total)}</b> goes to the supplier's payable`; }
  if (fullRow) fullRow.hidden = !full;
  const errBox = document.getElementById('pe-error');
  if (errBox && !errBox.hidden && errBox.dataset.pay === '1' && !pc.errors.length) errBox.hidden = true;
  piFillLinePL(v);
  s._v = v;
}
async function savePurchaseInvoice(){
  const m = document.getElementById('pi-new-modal'), s = piState(), lib = piLib(); if (!s || !lib) return;
  piRecalc();
  const input = piReadInput(), v = piValidateLocal(input);
  const err = document.getElementById('pe-error');
  if (!v.ok) { err.hidden = false; err.dataset.pay = ''; err.textContent = v.errors.map(e => e.message).join(' '); return; }
  if (s._pay && s._pay.errors.length) { err.hidden = false; err.dataset.pay = '1'; err.textContent = s._pay.errors.map(e => e.message).join(' '); return; }
  const date = input.date ? new Date(input.date + 'T00:00:00') : new Date();
  const x = typeof docNumberParts === 'function' ? docNumberParts('purchaseInvoice', date) : { counterKey: 'doc_purchaseInvoice_all', displayPrefix: 'PI-' };
  const btn = document.getElementById('pe-save'); btn.disabled = true; err.hidden = true;
  try {
    let r = await lib.service.createPurchaseInvoice({ ...input, numbering: { counterKey: x.counterKey, displayPrefix: x.displayPrefix } });
    // V268.21: the discount at payment typed on the new invoice — saved at once as a discount-only payment
    const disc = s._pay ? s._pay.discount : 0;
    if (disc > 0 && !r.alreadyApplied) {
      const dd = input.date && input.date <= piToday() ? input.date : piToday();
      try {
        const d = await lib.service.recordSupplierPayment({ operationId: s.op + '-disc', invoiceId: r.invoice.id, expectedRevision: r.invoice.revision, numbering: piPayNumbering(dd), date: dd, lines: [], discount: String(disc) });
        if (d.invoice) r = { ...r, invoice: d.invoice };
      } catch (e2) {
        closeModal('pi-new-modal');
        if (typeof showToast === 'function') showToast(`${r.invoice.piNo} saved, but the discount at payment was not: ${e2.message} — use Record payment on the invoice.`, 'error');
        return;
      }
    }
    closeModal('pi-new-modal');
    const st = r.invoice.payStatus;
    if (typeof showToast === 'function') showToast(`${r.invoice.piNo} saved — ${st === 'Paid' ? 'Paid' : st === 'Part paid' ? `Part paid, ${piF(r.invoice.balance)} due ${piDate(r.invoice.dueDate)}` : `Unpaid, due ${piDate(r.invoice.dueDate)}`}`, 'success');
  } catch (e) {
    err.hidden = false;
    err.textContent = e.code === 'permission-denied' ? 'The server refused the invoice. Please reload and try again.' : (e.message || 'Could not save the invoice.');
    btn.disabled = false;
  }
}

/* ═══════════════════════════════ VIEW + CANCEL ═══════════════════════════════ */
function openPurchaseInvoiceView(id, retried){
  const pi = piInvoices().find(p => p.id === id);
  if (!pi) { if (!retried && piLib()) { piLib().start(); setTimeout(() => openPurchaseInvoiceView(id, true), 800); } return; }
  piStartAccounts();
  let m = document.getElementById('pi-view-modal');
  if (!m) { m = document.createElement('div'); m.className = 'modal-overlay'; m.id = 'pi-view-modal'; document.body.appendChild(m); }
  m._id = id;
  const t = pi.totals || {}, v = pi.status === 'Voided';
  const pl = piCanSeeProfit();
  const C = piCore(), f = C.costFactorOf(pi), money = C.invoiceMoneyOf(pi);
  const pays = piPaymentsOf(pi), livePays = pays.filter(p => p.status !== 'Voided');
  const lines = (pi.lines || []).map(l => {
    const goes = (l.allocations || []).map(a => `<span class="pi-dest"><i class="ti ti-shopping-cart"></i>${piEsc(a.soNo)} · ${piQ(a.qty)}</span>`).join('') + (piN(l.stockQty) > 0 ? `<span class="pi-dest stock"><i class="ti ti-box"></i>Unassigned stock · ${piQ(l.stockQty)}</span>` : '');
    const ref = l.reference && l.reference.unit ? `${l.reference.source === 'lastPaid' ? 'Last paid ' : 'Est. '}${piF(l.reference.unit)}` : 'No reference';
    const pct = l.costPct != null ? ` (${l.costPct > 0 ? '+' : ''}${Number(l.costPct).toFixed(1)}%)` : '';
    const sub = l.kind === 'stock' ? `${piEsc(l.uom)} · <span class="pi-stock-tag"><i class="ti ti-box"></i> for stock</span>` : `${piEsc(l.uom)} · <span class="pi-so">${piEsc(l.soNo)}</span> · ${piEsc(l.customer || '')}`;
    return `<tr class="pi-line"><td class="pi-c-item"><div class="pi-idesc">${piEsc(l.desc)}</div><div class="pi-sub">${sub}</div>${l.costReason ? `<div class="pi-sub">Reason: ${piEsc(l.costReason)}</div>` : ''}</td>
      <td class="num pi-c-qty" data-label="Qty">${piQ(l.qty)}</td><td class="num pi-c-cost" data-label="Unit cost">${piF(l.unitCost)}<div class="pi-sub ${l.costCheck === 'above' ? 'pi-red' : l.costCheck === 'below' ? 'pi-blue' : ''}">${ref}${pct}</div></td>
      <td class="num pi-c-disc" data-label="Disc.">${piN(l.discountPct) ? piN(l.discountPct) + '%' : '—'}</td><td class="num pi-c-amt" data-label="Amount"><span class="pi-amt">${piF(l.amount)}</span></td><td class="num pi-c-land" data-label="Landed unit cost">${piF(l.landedUnitCost)}</td>
      ${pl ? `<td class="num pi-c-pl pi-pl">${piPLHtml(l, f)}</td>` : ''}<td class="pi-c-goes">${goes}</td></tr>`;
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
      <div class="pi-lines-wrap"><table class="pi-lines pi-view-lines${pl ? ' pi-has-pl' : ''}"><thead><tr><th>Item · sales order</th><th class="num">Qty</th><th class="num">Unit cost</th><th class="num">Disc.</th><th class="num">Amount</th><th class="num">Landed unit cost</th>${pl ? '<th class="num pi-plh">Selling → P/L</th>' : ''}<th class="pi-goesh">Goes to</th></tr></thead><tbody>${lines}</tbody></table></div>
      ${piPaymentsSection(pi, pays, money)}
      <div class="pi-view-foot">
        <div>${(pi.costs || []).map(c => `<div class="pi-ps"><span>${piEsc(c.label)}</span><b>${piF(c.amount)}</b></div>`).join('')}${pi.discount ? `<div class="pi-ps"><span>Discount on the whole invoice${pi.discount.mode === 'percent' ? ' (' + pi.discount.value + '%)' : ''}</span><b class="pi-green">−${piF(pi.discount.amount)}</b></div>` : ''}</div>
        <div class="pi-view-sum"><div class="pi-ps"><span>Lines (ex-VAT)</span><b>${piF(t.linesTotal)}</b></div>${t.costsTotal ? `<div class="pi-ps"><span>Additional costs</span><b>${piF(t.costsTotal)}</b></div>` : ''}${t.discount ? `<div class="pi-ps"><span>Discount</span><b class="pi-green">−${piF(t.discount)}</b></div>` : ''}
          <div class="pi-ps"><span>VAT (${t.vatRate}%)</span><b>${piF(t.vat)}</b></div>${t.rounding ? `<div class="pi-ps"><span>Rounding</span><b>${t.rounding > 0 ? '+' : ''}${piF(t.rounding)}</b></div>` : ''}
          <div class="pi-tot"><span>Total (SAR)</span><span>${piF(t.total)}</span></div>
          ${money.paid ? `<div class="pi-ps"><span>Paid</span><b>${piF(money.paid)}</b></div>` : ''}
          ${money.paymentDiscount ? `<div class="pi-ps"><span>Discount at payment</span><b class="pi-green">−${piF(money.paymentDiscount)}</b></div>` : ''}
          <div class="pi-ps"><span>Balance to pay</span><b class="${money.balance > 0.005 ? 'pi-amber' : 'pi-green'}">${v ? '—' : piF(money.balance)}</b></div>
          ${money.cashBack ? `<div class="pi-ps"><span>Cash back received</span><b class="pi-green">${piF(money.cashBack)}</b></div>` : ''}
          ${piCanSeeProfit() && pi.profit && pi.profit.sales > 0 ? piProfitBox(C.profitAfterDiscounts(pi), false) : ''}</div>
      </div>
      <div class="inv-error" id="pv-error" hidden></div>
    </div>
    <div class="modal-footer">${v ? '' : `<button class="btn btn-danger" type="button" style="margin-right:auto" ${livePays.length ? `title="Cancel its payments first" onclick="piViewError('${piEsc(pi.piNo)} has payments — cancel them first, then the invoice.')"` : `onclick="piAskCancel('${piEsc(pi.id)}')"`}><i class="ti ti-ban"></i>Cancel invoice</button>`}<button class="btn btn-secondary" type="button" onclick="closeModal('pi-view-modal')">Close</button>
      ${!v && money.paid - money.cashBack > 0.005 ? `<button class="btn btn-secondary" type="button" id="pv-cashback" onclick="piOpenCashBack('${piEsc(pi.id)}')"><i class="ti ti-arrow-back-up"></i>Cash back</button>` : ''}
      ${!v && money.balance > 0.005 ? `<button class="btn btn-primary" type="button" id="pv-pay" onclick="piOpenPayModal('${piEsc(pi.id)}')"><i class="ti ti-cash"></i>Record payment</button>` : ''}</div></div>`;
  if (m.classList.contains('open')) return;   // live refresh of an open view
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

/* ───────── V268.2: payments on the invoice view (approved mockup PI_8) ───────── */
function piPaymentsOf(pi){
  return (piLib() && piLib().payments || []).filter(p => p.invoiceId === pi.id)
    .sort((a, b) => String(a.created || '').localeCompare(String(b.created || '')) || String(a.spNo || '').localeCompare(String(b.spNo || ''), undefined, { numeric: true }));
}
function piViewError(msg){ const e = document.getElementById('pv-error'); if (e) { e.hidden = !msg; e.textContent = msg || ''; } }
/** The custodian's answer for a cash line / what happens on a bank or card line. */
function piConfirmHtml(p, l){
  if (p.status === 'Voided') return '';
  const cash = window.BizCoreCash, posting = l.viaAccountId || l.accountId;
  if (l.accountType === 'cash') {
    const line = cash && (cash.lines || []).find(x => x.id === `${p.entryId}__${posting}`);
    const who = String((piAccOf(l.accountId) || {}).custodianName || 'custodian').split(/\s+/)[0];
    if (line && line.status === 'confirmed') return `<span class="pi-ok"><i class="ti ti-check"></i> Confirmed by ${piEsc(String(line.statusByName || who).split(/\s+/)[0])}</span>`;
    if (line && line.status === 'queried') return `<span class="pi-qry"><i class="ti ti-alert-triangle"></i> Queried: “${piEsc(line.statusNote)}”</span>`;
    return `<span class="pi-wait">⏳ ${piEsc(who)} confirms</span>`;
  }
  if (l.accountType === 'card') return `<span class="pi-sub">Card — from the bank</span>`;
  return `<span class="pi-sub">Bank — no confirmation</span>`;
}
function piPaymentsSection(pi, pays, money){
  const v = pi.status === 'Voided';
  const st = piCore().payStatusOf(pi);
  const rows = pays.map(p => {
    const off = p.status === 'Voided', cb = p.kind === 'cashback';
    const ls = p.lines || [];
    const acc = ls.map(l => `<div class="pi-pv-acc"><span class="acc">${piAccIcon(l.accountType)}${piEsc(l.accountCode)} · ${piEsc(l.accountName)}</span>${l.viaAccountId ? `<div class="pi-sub pi-pv-via">from ${piEsc(l.viaAccountCode)} · ${piEsc(l.viaAccountName)}</div>` : ''}</div>`).join('')
      + (!ls.length && p.discount ? '<div class="pi-sub">Discount only — no money moved</div>' : '');
    const refs = ls.map(l => `<div>${l.reference ? piEsc(l.reference) : '<span class="pi-muted">—</span>'}</div>`).join('') + (p.note ? `<div class="pi-sub">${piEsc(p.note)}</div>` : '');
    const amt = ls.map(l => `<div>${piF(l.amount)}${l.bankCharge ? `<div class="pi-sub">+ bank charge ${piF(l.bankCharge)}</div>` : ''}</div>`).join('') + (p.discount ? `<div class="pi-sub pi-green">discount ${piF(p.discount)}</div>` : '');
    const conf = off ? `<span class="pi-status voided">Cancelled — ${piEsc(p.voidReason || '')}</span>` : ls.map(l => `<div>${piConfirmHtml(p, l)}</div>`).join('');
    return `<tr class="${off ? 'pi-pv-void' : ''}" data-pay="${piEsc(p.id)}"><td><b class="pi-spno">${piEsc(p.spNo)}</b>${cb ? '<span class="pi-cbtag">Cash back</span>' : ''}</td><td>${piDate(p.date)}</td>
      <td>${acc}</td><td class="pi-sub">${refs}</td><td class="num">${amt}</td><td>${conf}</td>
      <td class="pi-sub">${piEsc(p.createdBy || '')} · ${piEsc(String(p.created || '').slice(8, 10) + '-' + String(p.created || '').slice(5, 7))}</td>
      <td>${!off && !v ? `<button type="button" class="pi-cancel-pay" onclick="piAskCancelPay('${piEsc(p.id)}')">Cancel</button>` : ''}</td></tr>`;
  }).join('');
  return `<section class="pi-pv-pays"><h4><i class="ti ti-cash"></i>Payments ${!v && (money.paid || money.paymentDiscount) ? piStatusPill(st) : ''}<span class="pi-pv-sum">${money.paid || money.paymentDiscount ? `Paid ${piF(money.paid)}${money.paymentDiscount ? ` + discount ${piF(money.paymentDiscount)}` : ''} of ${piF(money.total)}` : ''}${money.cashBack ? ` · cash back ${piF(money.cashBack)}` : ''}</span></h4>
    ${pays.length ? `<div class="pi-lines-wrap"><table class="pi-lines pi-pv-table"><thead><tr><th>Payment</th><th>Date</th><th>Paid from / received into</th><th>Reference</th><th class="num">Amount</th><th>Confirmation</th><th>Recorded by</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
      : `<p class="pi-muted pi-pv-none">No payments yet${v ? '' : ' — use <b>Record payment</b> when you pay this invoice'}.</p>`}</section>`;
}

/* Record payment (approved mockup PI_9) */
function piPayModalEl(){
  let m = document.getElementById('pi-pay-modal');
  if (!m) { m = document.createElement('div'); m.className = 'modal-overlay'; m.id = 'pi-pay-modal'; document.body.appendChild(m); }
  return m;
}
function piOpenPayModal(id){
  const pi = piInvoices().find(p => p.id === id); if (!pi) return;
  piStartAccounts();
  const m = piPayModalEl(), money = piCore().invoiceMoneyOf(pi);
  m._pi = id; m._rev = pi.revision; m._op = 'spay-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  m._st = { date: piToday(), lines: [{ accountId: '', amount: piF(money.balance), reference: '', bankCharge: '' }], discount: '' };
  m.innerHTML = `<div class="modal pi-paym" role="dialog" aria-modal="true" aria-labelledby="pm-title" style="--pi-w:860px">
    <div class="modal-header"><div><h2 id="pm-title">Record payment</h2><div class="so-create-subtitle">${piEsc(pi.piNo)} · ${piEsc(pi.supplierName)} · invoice ${piEsc(pi.supplierInvoiceNo)}</div></div><button class="close-btn" type="button" onclick="closeModal('pi-pay-modal')" aria-label="Close">✕</button></div>
    <div class="modal-body">
      <div class="pi-bal3"><div><span>Invoice total</span><b>${piF(money.total)}</b></div><div><span>Paid so far</span><b>${piF(money.paid + money.paymentDiscount)}</b></div><div><span>Balance</span><b class="pi-amber">${piF(money.balance)}</b></div></div>
      <div class="form-group pi-pm-date"><label for="pm-date">Payment date *</label><input id="pm-date" type="date" value="${piToday()}" max="${piToday()}" onchange="piPayModalEl()._st.date=this.value;piPmRecalc()"></div>
      <div class="pi-lines-wrap"><table class="pi-lines pi-pay-table"><thead><tr><th>Paid from (payment account)</th><th class="num" style="width:140px">Amount</th><th style="width:160px">Reference</th><th style="width:230px"></th><th style="width:34px"></th></tr></thead><tbody id="pm-lines"></tbody></table></div>
      <div class="pi-pm-add"><button type="button" class="btn btn-secondary btn-sm" onclick="piPmAdd()"><i class="ti ti-plus"></i>Add account</button><span class="pi-sub">split the payment over cash, card and bank</span></div>
      <div class="pi-pm-disc"><i class="ti ti-discount"></i><b>Discount at payment</b><span class="pi-sub">optional</span><input id="pm-disc" class="pi-cell pi-money" inputmode="decimal" placeholder="0.00" aria-label="Discount at payment" oninput="piPayModalEl()._st.discount=this.value;piPmRecalc()" onblur="piMoneyBlur(this)"></div>
      <p class="pi-note">The supplier accepted less than the balance. Recorded as a supplier discount on this invoice — it lowers the cost of its items (and the P/L follows).</p>
      <div class="pi-pm-after" id="pm-after"></div>
      <p class="pi-note">Cash lines wait for the custodian to confirm; card lines take the money from the card's linked bank account. Paying more than the balance is not allowed (advances come later).</p>
      <div class="inv-error" id="pm-error" hidden></div>
    </div>
    <div class="modal-footer"><button class="btn btn-secondary" type="button" onclick="closeModal('pi-pay-modal')">Cancel</button><button class="btn btn-primary" type="button" id="pm-save" onclick="piSavePayment()"><i class="ti ti-device-floppy"></i>Save payment</button></div></div>`;
  piPmRender();
  if (typeof openModalWithSize === 'function') openModalWithSize('pi-pay-modal'); else m.classList.add('open');
  setTimeout(() => { const el = m.querySelector('.pi-pay-acc'); if (el) el.focus(); }, 60);
}
function piPmAdd(){ const m = piPayModalEl(); m._st.lines.push({ accountId: '', amount: '', reference: '', bankCharge: '' }); piPmRender(); }
function piPmSet(i, field, value, rerender){
  const m = piPayModalEl(), l = m._st.lines[i]; if (!l) return;
  l[field] = value;
  if (field === 'accountId') { const a = piAccOf(value); if (!a || a.type !== 'bank') l.bankCharge = ''; }
  if (rerender) piPmRender(); else piPmRecalc();
}
function piPmRender(){
  const m = piPayModalEl();
  document.getElementById('pm-lines').innerHTML = m._st.lines.map((l, i) => {
    const a = piAccOf(l.accountId);
    return `<tr class="pi-pay-line"><td><span class="pi-pay-sel">${a ? piAccIcon(a.type) : ''}<select class="pi-pay-acc" aria-label="Paid from" onchange="piPmSet(${i},'accountId',this.value,true)">${piAccOptions(l.accountId)}</select></span></td>
      <td class="num"><input class="pi-cell pi-money pi-pay-amt" inputmode="decimal" placeholder="0.00" value="${piEsc(l.amount)}" aria-label="Amount" oninput="piPmSet(${i},'amount',this.value)" onblur="piMoneyBlur(this)"></td>
      <td><input class="pi-cell pi-pay-ref" maxlength="60" placeholder="optional" value="${piEsc(l.reference)}" aria-label="Reference" oninput="piPmSet(${i},'reference',this.value)"></td>
      <td class="pi-pay-info">${piPayInfo(l, `piPmSet(${i},'bankCharge',this.value)`)}</td>
      <td><button type="button" class="pi-x" title="Remove this account" aria-label="Remove account" onclick="piPayModalEl()._st.lines.splice(${i},1);piPmRender()"><i class="ti ti-x"></i></button></td></tr>`;
  }).join('') || '<tr><td colspan="5" class="pi-empty-lines pi-nopay"><i class="ti ti-cash-off"></i>No money paid now — enter the <b>discount at payment</b> below, or use <b>Add account</b>.</td></tr>';
  piPmRecalc();
}
function piPmInput(){
  const m = piPayModalEl();
  return { kind: 'payment', date: m._st.date, lines: m._st.lines, discount: m._st.discount };
}
function piPmRecalc(){
  const m = piPayModalEl(), pi = piInvoices().find(p => p.id === m._pi); if (!pi) return;
  const C = piCore(), money = C.invoiceMoneyOf(pi);
  const v = C.validateSupplierPayment(piPmInput(), { invoice: pi, accounts: piAccMap(), today: piToday() });
  const left = Math.round((money.balance - v.value.amount - v.value.discount) * 100) / 100;
  const st = C.payStatusFrom(money.total, money.paid + v.value.amount, money.paymentDiscount + v.value.discount);
  document.getElementById('pm-after').innerHTML = `<div class="pi-pm-after-box ${left > 0.005 ? 'part' : left < -0.005 ? 'bad' : 'ok'}"><span>${piF(money.balance)} − paid ${piF(v.value.amount)}${v.value.discount ? ` − discount ${piF(v.value.discount)}` : ''} = <b>${piF(left)}</b> left</span>
    <b>${left < -0.005 ? 'More than the balance' : st === 'Paid' ? 'Invoice becomes Paid' : 'Invoice stays Part paid'}</b></div>`;
  document.getElementById('pm-save').disabled = !v.ok;
  m._v = v;
}
async function piSavePayment(){
  const m = piPayModalEl(), lib = piLib(); piPmRecalc();
  const err = document.getElementById('pm-error'), v = m._v;
  if (!v || !v.ok) { err.hidden = false; err.textContent = (v ? v.errors : []).map(e => e.message).join(' ') || 'Check the payment.'; return; }
  const btn = document.getElementById('pm-save'); btn.disabled = true; err.hidden = true;
  try {
    const r = await lib.service.recordSupplierPayment({ ...piPmInput(), operationId: m._op, invoiceId: m._pi, expectedRevision: m._rev, numbering: piPayNumbering(m._st.date) });
    closeModal('pi-pay-modal');
    if (typeof showToast === 'function') showToast(`${r.payment.spNo} saved — ${r.invoice ? (r.invoice.payStatus === 'Paid' ? 'invoice Paid' : `${piF(r.invoice.balance)} left`) : 'payment recorded'}`, 'success');
  } catch (e) { err.hidden = false; err.textContent = e.code === 'permission-denied' ? 'The server refused the payment. Please reload and try again.' : (e.message || 'Could not save the payment.'); btn.disabled = false; }
}

/* Cash back from the supplier (after payment, no credit note) */
function piOpenCashBack(id){
  const pi = piInvoices().find(p => p.id === id); if (!pi) return;
  piStartAccounts();
  const m = piPayModalEl(), money = piCore().invoiceMoneyOf(pi), max = Math.round((money.paid - money.cashBack) * 100) / 100;
  m._pi = id; m._rev = pi.revision; m._op = 'scb-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  m.innerHTML = `<div class="modal pi-paym" role="dialog" aria-modal="true" aria-labelledby="cb-title" style="--pi-w:640px">
    <div class="modal-header"><div><h2 id="cb-title">Cash back from supplier</h2><div class="so-create-subtitle">${piEsc(pi.piNo)} · ${piEsc(pi.supplierName)} · invoice ${piEsc(pi.supplierInvoiceNo)}</div></div><button class="close-btn" type="button" onclick="closeModal('pi-pay-modal')" aria-label="Close">✕</button></div>
    <div class="modal-body">
      <div class="pi-bal3"><div><span>Paid on this invoice</span><b>${piF(money.paid)}</b></div><div><span>Cash back so far</span><b>${piF(money.cashBack)}</b></div><div><span>At most now</span><b>${piF(max)}</b></div></div>
      <div class="pi-cb-grid">
        <div class="form-group"><label for="cb-date">Date *</label><input id="cb-date" type="date" value="${piToday()}" max="${piToday()}" oninput="piCbRecalc()"></div>
        <div class="form-group"><label for="cb-amt">Amount received *</label><input id="cb-amt" class="pi-money" inputmode="decimal" placeholder="0.00" oninput="piCbRecalc()" onblur="piMoneyBlur(this)"></div>
        <div class="form-group pi-cb-acc"><label for="cb-acc">Received into *</label><select id="cb-acc" onchange="piCbRecalc()">${piAccOptions('', ['cash', 'bank'])}</select><small id="cb-info"></small></div>
        <div class="form-group pi-cb-note"><label for="cb-note">Note <em>optional</em></label><input id="cb-note" maxlength="200" placeholder="e.g. discount returned in cash by the salesman"></div>
      </div>
      <p class="pi-note">The supplier's invoice stays as it is (same total, still ${piEsc(piCore().payStatusOf(pi))}). The cash back is recorded as a discount after payment: it lowers the cost of this invoice's items, and the P/L follows. VAT stays as on the supplier's invoice.</p>
      <div class="inv-error" id="cb-error" hidden></div>
    </div>
    <div class="modal-footer"><button class="btn btn-secondary" type="button" onclick="closeModal('pi-pay-modal')">Cancel</button><button class="btn btn-primary" type="button" id="cb-save" onclick="piSaveCashBack()" disabled><i class="ti ti-device-floppy"></i>Save cash back</button></div></div>`;
  if (typeof openModalWithSize === 'function') openModalWithSize('pi-pay-modal'); else m.classList.add('open');
  setTimeout(() => document.getElementById('cb-amt').focus(), 60);
}
function piCbInput(){
  return { date: document.getElementById('cb-date').value, lines: [{ accountId: document.getElementById('cb-acc').value, amount: document.getElementById('cb-amt').value }], note: document.getElementById('cb-note').value };
}
function piCbRecalc(){
  const m = piPayModalEl(), pi = piInvoices().find(p => p.id === m._pi); if (!pi) return;
  const v = piCore().validateSupplierPayment({ ...piCbInput(), kind: 'cashback' }, { invoice: pi, accounts: piAccMap(), today: piToday() });
  const a = piAccOf(document.getElementById('cb-acc').value);
  document.getElementById('cb-info').innerHTML = a ? (a.type === 'cash' ? `⏳ ${piEsc(String(a.custodianName || 'The custodian').split(/\s+/)[0])} confirms receiving it` : 'Bank — no confirmation') : '';
  document.getElementById('cb-save').disabled = !v.ok;
  m._v = v;
}
async function piSaveCashBack(){
  const m = piPayModalEl(), lib = piLib(); piCbRecalc();
  const err = document.getElementById('cb-error'), v = m._v;
  if (!v || !v.ok) { err.hidden = false; err.textContent = (v ? v.errors : []).map(e => e.message).join(' '); return; }
  const btn = document.getElementById('cb-save'); btn.disabled = true; err.hidden = true;
  const input = piCbInput();
  try {
    const r = await lib.service.recordSupplierCashBack({ ...input, operationId: m._op, invoiceId: m._pi, expectedRevision: m._rev, numbering: piPayNumbering(input.date) });
    closeModal('pi-pay-modal');
    if (typeof showToast === 'function') showToast(`${r.payment.spNo} — cash back ${piF(r.payment.amount)} recorded`, 'success');
  } catch (e) { err.hidden = false; err.textContent = e.message || 'Could not save the cash back.'; btn.disabled = false; }
}

/* Cancel a payment / cash back (with a reason) */
function piAskCancelPay(payId){
  const p = (piLib().payments || []).find(x => x.id === payId); if (!p) return;
  const m = piPayModalEl(); m._pay = payId; m._op = 'spv-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  const what = p.kind === 'cashback' ? 'cash back' : 'payment';
  m.innerHTML = `<div class="modal pi-paym" role="dialog" aria-modal="true" aria-labelledby="cp-title" style="--pi-w:480px">
    <div class="modal-header"><div class="modal-header-title-wrap"><h2 id="cp-title">Cancel ${piEsc(p.spNo)}</h2></div><button class="close-btn" type="button" onclick="closeModal('pi-pay-modal')" aria-label="Close">✕</button></div>
    <div class="modal-body"><p class="pi-note" style="margin-top:0">The ${what} of ${piF(p.amount)}${p.discount ? ` (+ discount ${piF(p.discount)})` : ''} stays in the list, marked Cancelled. Its cash / bank lines are cancelled in Cash &amp; Bank and ${p.kind === 'cashback' ? 'the item costs go back up' : `the balance of ${piEsc(p.piNo)} goes back up`}. Enter it again correctly if needed.</p>
      <div class="form-group"><label for="cp-why">Reason *</label><input id="cp-why" maxlength="300" placeholder="e.g. wrong amount, wrong account"></div><div class="inv-error" id="cp-err" hidden></div></div>
    <div class="modal-footer"><button class="btn btn-secondary" type="button" onclick="closeModal('pi-pay-modal')">Go back</button><button class="btn btn-danger" type="button" id="cp-save" onclick="piDoCancelPay()"><i class="ti ti-ban"></i>Cancel ${what}</button></div></div>`;
  if (typeof openModalWithSize === 'function') openModalWithSize('pi-pay-modal'); else m.classList.add('open');
  setTimeout(() => document.getElementById('cp-why').focus(), 60);
}
async function piDoCancelPay(){
  const m = piPayModalEl(), p = (piLib().payments || []).find(x => x.id === m._pay);
  const why = document.getElementById('cp-why').value.trim(), err = document.getElementById('cp-err');
  if (!p) return;
  if (why.length < 5) { err.hidden = false; err.textContent = 'Enter the reason for cancelling (at least 5 characters).'; return; }
  const btn = document.getElementById('cp-save'); btn.disabled = true;
  try {
    await piLib().service.voidSupplierPayment({ operationId: m._op, paymentId: p.id, reason: why, expectedRevision: p.revision });
    closeModal('pi-pay-modal');
    if (typeof showToast === 'function') showToast(`${p.spNo} cancelled`, 'success');
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
      // V268.2: an open invoice view follows its payments; an open new invoice follows the accounts
      const vm = document.getElementById('pi-view-modal'); if (vm && vm.classList.contains('open') && vm._id) openPurchaseInvoiceView(vm._id);
      const nm = document.getElementById('pi-new-modal'), ae = document.activeElement;
      if (nm && nm.classList.contains('open') && nm._s && !(ae && ae.closest && ae.closest('#pe-pay'))) piRenderPays();
    });
    lib.start();
    if (window.BCDateFilter) BCDateFilter.register('pireg', () => renderPurchaseRegister());
  };
  go();
})();
console.log('Purchase Invoices V268.21 ✅ (payments · discount at payment · cash back)');
