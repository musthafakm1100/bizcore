/* ═══════════════════════════════════════════════════════════════════
   BizCore V268.12 — Purchasing → Purchase Invoices (approved mockups 4 + 7, 17 Oct 2026)
   V268.2: supplier payments at entry and later (Record payment), discount at payment, cash back, cancel payment
   V268.3: advances used as payment lines (banner + Use advances), edit invoice (limited / full) and payments, edit settings
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
const piLedgerOf = soId => {
  const base = (piLib() ? piLib().ledgers.get(soId) : null) || { lines: {} };
  const s = typeof piState === 'function' ? piState() : null, own = s && s.editOwn && s.editOwn.get(soId);
  if (!own) return base;
  // V268.3: full edit — this invoice's own quantities are bought again by the edited lines
  const lines = {}; Object.entries(base.lines || {}).forEach(([k, v]) => { lines[k] = { ...v, purchased: Math.max(0, (Number(v.purchased) || 0) - (own.get(k) || 0)) }; });
  return { ...base, lines };
};
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
    <div class="modal-header"><div><h2><span id="pe-title">New Purchase Invoice</span> <span class="pi-kind"><i class="ti ti-shopping-bag"></i>Purchase</span></h2><div class="so-create-subtitle" id="pe-subtitle">Number assigned on save</div></div><button class="close-btn" type="button" onclick="closeModal('pi-new-modal')" aria-label="Close">✕</button></div>
    <div class="modal-body"><div class="pi-entry-grid">
      <div class="pi-entry-main">
        <section class="so-entry-card"><div class="so-entry-card-title"><i class="ti ti-building-store"></i>Supplier &amp; bill</div>
          <div class="pi-head-grid">
            <div class="form-group pi-f-sup"><label for="pe-supplier">Supplier *</label><select id="pe-supplier" onchange="piHeadChanged()"></select></div>
            <div class="form-group"><label for="pe-invno">Supplier invoice no. *</label><input id="pe-invno" maxlength="60" autocomplete="off" oninput="piHeadChanged()"></div>
            <div class="form-group"><label for="pe-date">Invoice date *</label><input id="pe-date" type="date" onchange="piHeadChanged(true)"></div>
            <div class="form-group"><label for="pe-zoho">Zoho bill no. <em>Optional</em></label><input id="pe-zoho" maxlength="60" autocomplete="off" placeholder="Bill number"></div>
            <div class="form-group pi-f-total"><label for="pe-suptotal">Supplier's invoice total (incl. VAT) *</label><input id="pe-suptotal" class="pi-money" inputmode="decimal" autocomplete="off" placeholder="0.00" oninput="piRecalc()" onblur="piMoneyBlur(this)"></div>
            <div class="pi-f-match" id="pe-match"></div>
            <div class="pi-f-match" id="pe-adv"></div>
          </div>
        </section>
        <section class="so-entry-card"><div class="so-entry-card-title so-items-title"><span><i class="ti ti-list-details"></i>What was bought</span><span class="pi-actions"><button type="button" class="btn btn-primary btn-sm" onclick="piOpenPicker()"><i class="ti ti-shopping-cart-plus"></i>Add from sales orders</button><button type="button" class="btn btn-secondary btn-sm" onclick="piAddStockLine()"><i class="ti ti-box"></i>Add item for stock</button></span></div>
          <div class="pi-lines-wrap"><table class="pi-lines"><thead id="pe-lines-head"></thead><tbody id="pe-lines"></tbody></table></div>
          <p class="pi-note">Qty bought starts at what is still to buy — change it if the supplier delivered less. If you buy more than an order needs, you choose where the extra goes.</p>
        </section>
        <section class="so-entry-card"><div class="so-entry-card-title so-items-title"><span class="pi-title-ic"><i class="ti ti-receipt-2"></i><span id="pe-costs-title">Additional costs &amp; discount</span></span><span class="pi-actions"><button type="button" class="btn btn-secondary btn-sm" id="pe-add-disc" onclick="piAddDiscount()"><i class="ti ti-discount"></i>Add discount</button><button type="button" class="btn btn-secondary btn-sm" onclick="piAddCost()"><i class="ti ti-plus"></i>Add cost</button></span></div>
          <div id="pe-costs"></div>
        </section>
        <section class="so-entry-card" id="pe-pay-card"><div class="so-entry-card-title so-items-title"><span class="pi-title-ic"><i class="ti ti-cash"></i>Payments <span id="pe-pay-pill"></span><span class="pi-sub pi-pay-hint">· one line per account or advance; paying more than the total is not allowed</span></span><span class="pi-actions"><button type="button" class="btn btn-secondary btn-sm" id="pe-add-pay" onclick="piAddPayLine()"><i class="ti ti-plus"></i>Add payment</button></span></div>
          <div class="pi-lines-wrap"><table class="pi-lines pi-pay-table"><thead id="pe-pay-head"></thead><tbody id="pe-pay"></tbody></table></div>
          <div class="pi-pm-disc pi-pe-disc" id="pe-disc-row" hidden><i class="ti ti-discount"></i><b>Discount at payment</b><span class="pi-sub">Optional — the supplier accepts less than the balance</span><input id="pe-pay-disc" class="pi-cell pi-money" inputmode="decimal" placeholder="0.00" aria-label="Discount at payment" oninput="piRecalc()" onblur="piMoneyBlur(this)"></div>
          <div class="pi-due" id="pe-due-row"><i class="ti ti-clock"></i><span id="pe-due-text"></span><label for="pe-due">Payment due *</label><input id="pe-due" type="date" onchange="piState().dueTouched=true;piRecalc()"></div>
          <div class="pi-paid-full" id="pe-paid-full" hidden><i class="ti ti-circle-check"></i>Paid in full — nothing goes to the supplier's payable.</div>
        </section>
      </div>
      <aside class="pi-entry-side">
        <section class="so-entry-card so-summary-card"><div class="so-entry-card-title"><i class="ti ti-calculator"></i>Bill summary</div><div id="pe-summary"></div></section>
        <section class="so-entry-card" id="pe-cmp-card"><div class="so-entry-card-title"><i class="ti ti-chart-arrows"></i>Cost vs estimate <span class="pi-staff">STAFF ONLY</span></div><div id="pe-cmp"></div></section>
      </aside>
    </div><div class="pi-edit-why" id="pe-edit-row" hidden><i class="ti ti-pencil"></i><label for="pe-edit-why">Reason for the change *</label><input id="pe-edit-why" class="pi-why-input" maxlength="300" placeholder="e.g. supplier delivered 8, not 10" oninput="document.getElementById('pe-error').hidden=true;piRecalc()"></div><div id="pe-error" class="inv-error" hidden></div></div>
    <div class="modal-footer pi-footer"><b class="pi-tc">To continue:</b><div class="pi-todo" id="pe-todo"></div>
      <button class="btn btn-secondary" type="button" onclick="closeModal('pi-new-modal')">Cancel</button>
      <button class="btn btn-primary" type="button" id="pe-save" onclick="savePurchaseInvoice()" disabled><i class="ti ti-device-floppy"></i><span id="pe-save-text">Save Purchase Invoice</span></button></div>
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
  piSetEditMode(m, null);
  piStartAccounts();
  const sups = (typeof suppliers !== 'undefined' ? suppliers : []).slice().sort((a, b) => String(a.company || '').localeCompare(String(b.company || '')));
  document.getElementById('pe-supplier').innerHTML = '<option value="">Choose the supplier…</option>' + sups.map(s => `<option value="${piEsc(s.id)}">${piEsc(s.company || s.name || s.id)}</option>`).join('');
  bcPickEnhance('pe-supplier', { items: bcSupplierPickItems, addNew: BC_NEW_SUPPLIER, placeholder: 'Search supplier…', empty: 'No supplier matches. Check the spelling, or add the supplier in Master Data.' });   // V268.5
  ['pe-invno', 'pe-zoho', 'pe-suptotal', 'pe-pay-disc'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('pe-date').value = today;
  document.getElementById('pe-due').value = piAddDays(today, 30);
  const x = typeof docNumberParts === 'function' ? docNumberParts('purchaseInvoice') : { displayPrefix: 'PI-' };
  document.getElementById('pe-subtitle').textContent = `Number assigned on save · ${x.displayPrefix}…`;
  document.getElementById('pe-error').hidden = true;
  piRenderLines(); piRenderCosts(); piRenderPays(); piRecalc();
  if (typeof openModalWithSize === 'function') openModalWithSize('pi-new-modal'); else m.classList.add('open');
  setTimeout(() => bcPickFocus('pe-supplier'), 60);
}
function piHeadChanged(dateChanged){
  const s = piState(); if (!s) return;
  const key = piSupplierKey();
  if (s.pays.some(p => p.advanceId && (piAdvOf(p.advanceId) || {}).supplierKey !== key)) { s.pays = s.pays.filter(p => !p.advanceId || (piAdvOf(p.advanceId) || {}).supplierKey === key); piRenderPays(); }
  if (dateChanged) {
    const d = document.getElementById('pe-date').value; if (d && !s.dueTouched) document.getElementById('pe-due').value = piAddDays(d, 30);
    if (d) { s.pays.forEach(p => { if (!p.dateTouched || p.advanceId) p.date = d; }); piRenderPays(); }
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
      // V268.5: the item must be a product (approved mockup V5_2) — type to search, or + New Product
      const bad = !l.productId && String(l.desc || '').trim();
      rows = `<tr class="pi-line" data-i="${i}"><td class="pi-c-item"><input class="pi-cell pi-stock-desc${bad ? ' pi-bad' : ''}" value="${piEsc(l.desc)}" placeholder="Search product…" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="pi-prod-list" aria-label="Product" oninput="piProdOpen(${i},this)" onfocus="piProdOpen(${i},this)" onkeydown="piProdKey(${i},event)" onblur="piProdBlur(${i},this)"><div class="pi-sub">${l.productId ? `${piEsc([l.code, l.uom].filter(Boolean).join(' · '))} · <span class="pi-prod-ok"><i class="ti ti-package"></i> Product</span>` : bad ? '<span class="pi-red">Choose a product from the list, or add it with + New Product.</span>' : piEsc(l.uom || '')} · <span class="pi-stock-tag"><i class="ti ti-box"></i> for stock</span></div></td>
        ${qtyTd}${costTd}${discTd}${amtTd}${plTd}<td class="pi-c-goes"><span class="pi-dest stock"><i class="ti ti-box"></i>Unassigned stock · ${piQ(l.qty)}</span></td>${xTd}</tr>`;
    }
    if (tag.chk.kind === 'above' && piSettings().costLimitAction === 'reason')
      rows += `<tr class="pi-ask-row"><td colspan="${cols}"><div class="pi-reason"><i class="ti ti-alert-triangle"></i>Reason for the higher cost * <input class="pi-cell" maxlength="300" value="${piEsc(l.costReason)}" placeholder="e.g. supplier price increase, urgent purchase" oninput="piSetLine(${i},'costReason',this.value)"></div></td></tr>`;
    return rows;
  }).join('');
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
function piSetStockItem(i, value, productId){
  const s = piState(), l = s.lines[i]; if (!l) return;
  const all = typeof products !== 'undefined' ? products : [];
  const p = productId ? all.find(x => x.id === productId) : all.find(x => String(x.name || '').trim().toLowerCase() === String(value || '').trim().toLowerCase());
  l.desc = p ? p.name : value; l.productId = p ? p.id : ''; l.code = p ? (p.code || '') : ''; if (p && p.uom) l.uom = p.uom;
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
    ${g.map(x => { const k = x.so.id + '|' + x.it.lineId, dis = taken.has(k); return `<label class="pi-pick-row${dis ? ' dis' : ''}"><input type="checkbox" ${dis ? 'disabled checked' : (m._sel.has(k) ? 'checked' : '')} onchange="piPickToggle('${piEsc(k)}',this.checked)"><span>${piEsc(x.it.desc)}<small>${piEsc(x.it.uom || '')}${dis ? ' · already on this invoice' : ''}</small></span><span class="num">Still to buy <b>${piQ(x.left)}</b> of ${piQ(x.it.qty)}</span></label>`; }).join('')}</div>`).join('')
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
  const rows = s.costs.map((c, i) => `<div class="pi-cost-row"><input class="pi-cell pi-cost-label" maxlength="100" value="${piEsc(c.label)}" aria-label="Cost" oninput="piState().costs[${i}].label=this.value;piRecalc()"><span class="pi-sub">Shared by value over the lines</span><input class="pi-cell pi-cost-amt pi-money" inputmode="decimal" value="${piEsc(c.amount)}" placeholder="0.00" aria-label="Amount" oninput="piState().costs[${i}].amount=this.value;piRecalc()" onblur="piMoneyBlur(this)"><button type="button" class="pi-x" aria-label="Remove cost" onclick="piState().costs.splice(${i},1);piRenderCosts();piRecalc()"><i class="ti ti-x"></i></button></div>`).join('');
  const d = s.discount && invDisc ? `<div class="pi-cost-row pi-disc-row"><span class="pi-cost-label">Discount on the whole invoice</span><span class="pi-sub">Shared by value over the lines, lowers each item's cost</span>
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
const PI_TY = { cash: ['c', 'ti-cash'], card: ['k', 'ti-credit-card'], bank: ['b', 'ti-building-bank'], advance: ['a', 'ti-wallet'] };
/* V268.3: advances (paid before the invoice) — used like an account on an invoice payment */
const piAdvOf = id => (piLib() && piLib().payments || []).find(p => p.id === id) || null;
function piSupplierKey(){
  const sel = document.getElementById('pe-supplier'); if (!sel || !sel.value || !piCore()) return '';
  const sup = (typeof suppliers !== 'undefined' ? suppliers : []).find(x => x.id === sel.value);
  return sup ? piCore().supplierKeyOf({ supplierId: sup.id, supplierName: sup.company || sup.name || '' }) : '';
}
function piOpenAdvances(supplierKey){ return supplierKey && piCore() ? piCore().openAdvancesOf(piLib() ? piLib().payments : [], supplierKey) : []; }
function piAdvMap(list){ return new Map((list || []).map(a => [a.id, a])); }
function piAdvLabel(a){ return `Advance ${a.spNo} · ${piF(piCore().advanceLeftOf(a))} left`; }
function piAccIcon(t){ const m = PI_TY[t] || PI_TY.cash; return `<span class="pi-ty ${m[0]}"><i class="ti ${m[1]}"></i></span>`; }
function piAccLabel(a){ return a ? `${a.code} · ${a.name}` : ''; }
/** Account choices, grouped by type (only active accounts; the current one is kept). */
function piAccOptions(current, types, advances){
  const list = bcSortBy(piAccounts().filter(a => (a.active !== false || a.id === current) && (!types || types.includes(a.type))), a => a.code + ' ' + a.name);
  const grp = { cash: 'Cash', card: 'Card', bank: 'Bank' };
  const adv = (advances || []).length ? `<optgroup label="Advances">${advances.map(a => `<option value="adv:${piEsc(a.id)}"${'adv:' + a.id === current ? ' selected' : ''}>${piEsc(piAdvLabel(a))}</option>`).join('')}</optgroup>` : '';
  return '<option value="">Choose the account…</option>' + adv + Object.keys(grp).filter(t => list.some(a => a.type === t)).map(t =>
    `<optgroup label="${grp[t]}">${list.filter(a => a.type === t).map(a => `<option value="${piEsc(a.id)}"${a.id === current ? ' selected' : ''}>${piEsc(piAccLabel(a))}</option>`).join('')}</optgroup>`).join('');
}
/** What happens on this account: cash → the custodian confirms; card → from its linked bank; bank → bank charge. */
function piPayInfo(p, onCharge){
  if (p.advanceId) { const ad = piAdvOf(p.advanceId); const rest = ad ? Math.round((piCore().advanceLeftOf(ad) - piN(p.amount)) * 100) / 100 : 0;
    return `<span class="pi-sub pi-adv-info"><i class="ti ti-wallet"></i>From the advance — no money moves now · ${rest > 0.005 ? piF(rest) + ' stays open' : 'nothing left'}</span>`; }
  const a = piAccOf(p.accountId); if (!a) return '';
  if (a.type === 'cash') return `<span class="pi-wait">⏳ ${piEsc(String(a.custodianName || 'Custodian').split(/\s+/)[0])} confirms</span>`;
  if (a.type === 'card') { const b = piAccOf(a.linkedBankAccountId); return b ? `<span class="pi-via"><i class="ti ti-building-bank"></i>Via ${piEsc(b.name)} — bank balance, at once</span>` : '<span class="pi-red pi-via"><i class="ti ti-alert-triangle"></i>No linked bank account — set it in Administration → Payment Accounts</span>'; }
  return onCharge ? `<span class="pi-chg"><label>Bank charge</label><input class="pi-cell pi-money" inputmode="decimal" placeholder="0.00" value="${piEsc(p.bankCharge || '')}" aria-label="Bank charge" oninput="${onCharge}"></span><span class="pi-sub">→ Bank expense, not the supplier</span>` : '<span class="pi-sub">Bank — no confirmation</span>';
}
/** Payment lines of the new invoice → one payment per date. */
function piPayGroups(pays, invDate){
  const groups = new Map();
  (pays || []).forEach(p => {
    if (!p.accountId && !p.advanceId && !String(p.amount || '').trim()) return;
    const d = p.advanceId ? invDate : (p.date || invDate);   // V268.3: an advance is used on the invoice date
    if (!groups.has(d)) groups.set(d, []);
    groups.get(d).push(p.advanceId ? { advanceId: p.advanceId, amount: p.amount } : { accountId: p.accountId, amount: p.amount, reference: p.reference, bankCharge: p.bankCharge });
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
  const C = piCore(), accounts = piAccMap(), key = piSupplierKey();
  const inv = { status: 'Posted', totals: { total }, paid: 0, paymentDiscount: 0, cashBack: 0, supplierKey: key };
  const advances = piAdvMap(piOpenAdvances(key));
  const errors = [];
  groups.forEach(g => {
    const v = C.validateSupplierPayment({ kind: 'payment', date: g.date, lines: g.lines, discount: 0 }, { invoice: inv, accounts, advances, today: piToday() });
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
/** V268.3: adds the supplier's open advances as payment lines, up to what is left to pay. */
function piUseAdvances(){
  const s = piState(); if (!s) return;
  const date = document.getElementById('pe-date').value || piToday();
  const t = s._v ? s._v.totals : null, total = t ? (t.supplierTotal != null ? t.supplierTotal : t.calcTotal) : 0;
  let left = Math.round((total - piCheckPays(piPayGroups(s.pays, date), total).paid) * 100) / 100;
  piOpenAdvances(piSupplierKey()).filter(a => !s.pays.some(p => p.advanceId === a.id)).forEach(a => {
    const use = total > 0 ? Math.min(piCore().advanceLeftOf(a), Math.max(0, left)) : piCore().advanceLeftOf(a);
    if (use <= 0.005) return;
    s.pays.push({ advanceId: a.id, accountId: '', date, amount: piF(use), reference: '', bankCharge: '' }); left = Math.round((left - use) * 100) / 100;
  });
  piRenderPays(); piRecalc();
}
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
  if (field === 'accountId') {
    const adv = String(value || '').startsWith('adv:') ? value.slice(4) : '';
    p.advanceId = adv; if (adv) { p.accountId = ''; p.reference = ''; p.date = document.getElementById('pe-date').value || p.date; const ad = piAdvOf(adv); if (ad && piN(p.amount) > piCore().advanceLeftOf(ad)) p.amount = piF(piCore().advanceLeftOf(ad)); }
    const a = piAccOf(p.accountId); if (!a || a.type !== 'bank') p.bankCharge = '';
  }
  if (rerender) piRenderPays();
  piRecalc();
}
function piRenderPays(){
  const s = piState(); if (!s) return;
  document.getElementById('pe-pay-head').innerHTML = s.pays.length ? '<tr><th>Paid from (payment account)</th><th style="width:150px">Date</th><th class="num" style="width:130px">Amount</th><th style="width:160px">Reference</th><th style="width:250px">Confirmation</th><th style="width:34px"></th></tr>' : '';
  const body = document.getElementById('pe-pay');
  const advs = piOpenAdvances(piSupplierKey()), invDate = document.getElementById('pe-date').value;
  body.innerHTML = s.pays.length ? s.pays.map((p, i) => {
    const a = piAccOf(p.accountId), ad = p.advanceId ? piAdvOf(p.advanceId) : null;
    const opts = advs.slice(); if (ad && !opts.some(x => x.id === ad.id)) opts.push(ad);
    const advRef = ad ? ((ad.lines || []).map(l => l.reference).filter(Boolean)[0] || '—') : '';
    return `<tr class="pi-pay-line${ad ? ' pi-adv-line' : ''}" data-p="${i}"><td><span class="pi-pay-sel">${ad ? piAccIcon('advance') : a ? piAccIcon(a.type) : ''}<select class="pi-pay-acc" aria-label="Paid from" onchange="piSetPay(${i},'accountId',this.value,true)">${piAccOptions(ad ? 'adv:' + ad.id : p.accountId, null, opts)}</select></span></td>
      <td><input class="pi-cell pi-pay-date" type="date" value="${piEsc(ad ? (ad.date || invDate) : p.date)}" aria-label="Payment date"${ad ? ' disabled title="The date the advance was paid"' : ''} onchange="piSetPay(${i},'date',this.value)"></td>
      <td class="num"><input class="pi-cell pi-money pi-pay-amt" inputmode="decimal" placeholder="0.00" value="${piEsc(p.amount)}" aria-label="Amount" oninput="piSetPay(${i},'amount',this.value)" onblur="piMoneyBlur(this)"></td>
      <td><input class="pi-cell pi-pay-ref" maxlength="60" placeholder="Optional" value="${piEsc(ad ? advRef : p.reference)}" aria-label="Reference"${ad ? ' disabled' : ''} oninput="piSetPay(${i},'reference',this.value)"></td>
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
  // V268.3: open advances of this supplier
  const advBox = document.getElementById('pe-adv');
  if (advBox) {
    const advs = s.editOf ? [] : piOpenAdvances(piSupplierKey()), unused = advs.filter(a => !s.pays.some(p => p.advanceId === a.id));
    const sup = (document.getElementById('pe-supplier').selectedOptions[0] || {}).textContent || '';
    advBox.innerHTML = advs.length ? `<div class="pi-match adv"><i class="ti ti-wallet"></i><span><b>${piEsc(sup)} has ${advs.length} open advance${advs.length > 1 ? 's' : ''}: ${piF(advs.reduce((x, a) => x + piCore().advanceLeftOf(a), 0))}</b> (${advs.map(a => `${piEsc(a.spNo)} · ${piF(piCore().advanceLeftOf(a))}${a.soNo ? ' for ' + piEsc(a.soNo) : ''}`).join(' · ')}).</span>${unused.length ? '<button type="button" class="btn btn-secondary btn-sm" id="pe-use-adv" onclick="piUseAdvances()">Use advances</button>' : ''}</div>` : '';
  }
  // summary
  const vatInput = s.vatTouched ? s.vat : piF(t.vatCalculated);
  const sumEl = document.getElementById('pe-summary');
  if (!(keepVatFocus && document.activeElement && document.activeElement.id === 'pe-vat')) sumEl.innerHTML = `
    <div class="pi-ps"><span>Lines (ex-VAT)</span><b>${piF(t.linesTotal)}</b></div>
    ${t.costsTotal ? `<div class="pi-ps"><span>Additional costs</span><b>${piF(t.costsTotal)}</b></div>` : ''}
    ${t.discountAmount ? `<div class="pi-ps"><span>Discount</span><b class="pi-green">−${piF(t.discountAmount)}</b></div>` : ''}
    <div class="pi-ps"><span>VAT (${set.vatRate}%)</span><input id="pe-vat" class="pi-cell pi-vat" inputmode="decimal" value="${piEsc(vatInput)}" title="Adjust by a few halalas to match the supplier's VAT" oninput="piSetVat(this.value)"></div>
    <div class="pi-ps"><span>BizCore total</span><b>${piF(t.calcTotal)}</b></div>
    <div class="pi-ps"><span>Rounding <small>(To supplier's total)</small></span><b>${t.rounding == null ? '—' : (t.rounding > 0 ? '+' : '') + piF(t.rounding)}</b></div>
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
    <div class="pi-ps"><span>Actual</span><b>${piF(actual)}</b></div><div class="pi-ps"><span>Difference <small>(Lines with a reference)</small></span><b class="${diff > 0.005 ? 'pi-amber' : diff < -0.005 ? 'pi-blue' : ''}">${diff > 0 ? '+' : ''}${piF(diff)} (${pct > 0 ? '+' : ''}${pct.toFixed(1)}%)</b></div>
    ${piCanSeeProfit() && prof.sales > 0 ? piProfitBox(prof, true) : ''}`;
  // To continue
  const errs = v.errors, has = f => errs.some(e => f.includes(e.field));
  const chips = [];
  chips.push(has(['supplier', 'supplierInvoiceNo', 'date', 'dueDate']) ? '<span class="pi-todo-c">Supplier &amp; bill</span>' : '<span class="pi-todo-c ok"><i class="ti ti-check"></i>Supplier &amp; bill</span>');
  if (!s.lines.length) chips.push('<span class="pi-todo-c">Add lines</span>');
  const nReason = errs.filter(e => e.field === 'costReason').length; if (nReason) chips.push(`<span class="pi-todo-c">${nReason} Reason${nReason > 1 ? 's' : ''}</span>`);
  const nExtra = errs.filter(e => e.field === 'extra').length; if (nExtra) chips.push(`<span class="pi-todo-c">${nExtra} Extra qty to place</span>`);
  const nLine = errs.filter(e => ['qty', 'unitCost', 'desc', 'product', 'soLine', 'discountPct'].includes(e.field)).length; if (nLine) chips.push(`<span class="pi-todo-c">${nLine} Line${nLine > 1 ? 's' : ''} to complete</span>`);
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
  const btn = document.getElementById('pe-save');
  if (s.editOf) {   // V268.3: full edit (administrator)
    const why = document.getElementById('pe-edit-why').value.trim();
    if (!why) { err.hidden = false; err.dataset.pay = ''; err.textContent = 'Enter the reason for the change.'; document.getElementById('pe-edit-why').focus(); return; }
    btn.disabled = true; err.hidden = true;
    try {
      const r = await bcBusy('Saving changes…', () => lib.service.editPurchaseInvoice({ ...input, payments: [], operationId: s.op, invoiceId: s.editOf.id, expectedRevision: s.editOf.revision, mode: 'full', reason: why }));
      closeModal('pi-new-modal');
      if (typeof showToast === 'function') showToast(`${r.invoice.piNo} changed — total ${piF(r.invoice.totals.total)}`, 'success');
    } catch (e) { err.hidden = false; err.textContent = e.code === 'permission-denied' ? 'The server refused the change. Please reload and try again.' : (e.message || 'Could not save the changes.'); btn.disabled = false; }
    return;
  }
  const date = input.date ? new Date(input.date + 'T00:00:00') : new Date();
  const x = typeof docNumberParts === 'function' ? docNumberParts('purchaseInvoice', date) : { counterKey: 'doc_purchaseInvoice_all', displayPrefix: 'PI-' };
  btn.disabled = true; err.hidden = true;
  try {
    let r = await bcBusy('Saving purchase invoice…', () => lib.service.createPurchaseInvoice({ ...input, numbering: { counterKey: x.counterKey, displayPrefix: x.displayPrefix } }));
    // V268.21: the discount at payment typed on the new invoice — saved at once as a discount-only payment
    const disc = s._pay ? s._pay.discount : 0;
    if (disc > 0 && !r.alreadyApplied) {
      const dd = input.date && input.date <= piToday() ? input.date : piToday();
      try {
        const d = await bcBusy('Saving discount at payment…', () => lib.service.recordSupplierPayment({ operationId: s.op + '-disc', invoiceId: r.invoice.id, expectedRevision: r.invoice.revision, numbering: piPayNumbering(dd), date: dd, lines: [], discount: String(disc) }));
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
  else if (!m.classList.contains('open')) document.body.appendChild(m);   // V268.3: in front
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
      ${!v && pi.lastEditReason ? `<div class="pi-edit-note"><i class="ti ti-pencil"></i>Changed by ${piEsc(pi.updatedBy || '')} on ${piDate(String(pi.updatedAt || '').slice(0, 10))} — ${piEsc(pi.lastEditReason)}</div>` : ''}
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
      ${!v && piEditRight(pi).right ? `<button class="btn btn-secondary" type="button" id="pv-edit" onclick="piEditInvoiceClick('${piEsc(pi.id)}')"><i class="ti ti-pencil"></i>Edit</button>` : ''}
      ${!v && money.paid - money.cashBack > 0.005 ? `<button class="btn btn-secondary" type="button" id="pv-cashback" onclick="piOpenCashBack('${piEsc(pi.id)}')"><i class="ti ti-arrow-back-up"></i>Cash back</button>` : ''}
      ${!v && money.balance > 0.005 ? `<button class="btn btn-primary" type="button" id="pv-pay" onclick="piOpenPayModal('${piEsc(pi.id)}')"><i class="ti ti-cash"></i>Record payment</button>` : ''}</div></div>`;
  if (m.classList.contains('open')) return;   // live refresh of an open view
  if (typeof openModalWithSize === 'function') openModalWithSize('pi-view-modal'); else m.classList.add('open');
}
function piAskCancel(id){
  const pi = piInvoices().find(p => p.id === id); if (!pi) return;
  let m = document.getElementById('pi-void-modal');
  if (!m) { m = document.createElement('div'); m.className = 'modal-overlay'; m.id = 'pi-void-modal'; document.body.appendChild(m); }
  else if (!m.classList.contains('open')) document.body.appendChild(m);   // V268.3: in front
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
    await bcBusy(`Cancelling ${pi.piNo}…`, () => piLib().service.voidPurchaseInvoice({ operationId: 'piv-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10), invoiceId: id, reason: why, expectedRevision: pi.revision }));
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
  if (l.advanceId) return '<span class="pi-sub"><i class="ti ti-wallet"></i> From the advance — paid earlier</span>';
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
    const acc = ls.map(l => `<div class="pi-pv-acc"><span class="acc">${piAccIcon(l.accountType)}${l.advanceId ? piEsc(l.accountName) : `${piEsc(l.accountCode)} · ${piEsc(l.accountName)}`}</span>${l.viaAccountId ? `<div class="pi-sub pi-pv-via">From ${piEsc(l.viaAccountCode)} · ${piEsc(l.viaAccountName)}</div>` : ''}</div>`).join('')
      + (!ls.length && p.discount ? '<div class="pi-sub">Discount only — no money moved</div>' : '');
    const refs = ls.map(l => `<div>${l.reference ? piEsc(l.reference) : '<span class="pi-muted">—</span>'}</div>`).join('') + (p.note ? `<div class="pi-sub">${piEsc(p.note)}</div>` : '');
    const amt = ls.map(l => `<div>${piF(l.amount)}${l.bankCharge ? `<div class="pi-sub">+ Bank charge ${piF(l.bankCharge)}</div>` : ''}</div>`).join('') + (p.discount ? `<div class="pi-sub pi-green">Discount ${piF(p.discount)}</div>` : '');
    const conf = off ? `<span class="pi-status voided">Cancelled — ${piEsc(p.voidReason || '')}</span>` : ls.map(l => `<div>${piConfirmHtml(p, l)}</div>`).join('');
    return `<tr class="${off ? 'pi-pv-void' : ''}" data-pay="${piEsc(p.id)}"><td><b class="pi-spno">${piEsc(p.spNo)}</b>${cb ? '<span class="pi-cbtag">Cash back</span>' : ''}</td><td>${piDate(p.date)}</td>
      <td>${acc}</td><td class="pi-sub">${refs}</td><td class="num">${amt}</td><td>${conf}</td>
      <td class="pi-sub">${piEsc(p.createdBy || '')} · ${piEsc(String(p.created || '').slice(8, 10) + '-' + String(p.created || '').slice(5, 7))}</td>
      <td class="pi-pv-acts">${!off && !v ? `${piEditRight(p).right ? `<button type="button" class="pi-cancel-pay pi-edit-pay" onclick="spEditPaymentClick('${piEsc(p.id)}')">Edit</button>` : ''}<button type="button" class="pi-cancel-pay" onclick="piAskCancelPay('${piEsc(p.id)}')">Cancel</button>` : ''}</td></tr>`;
  }).join('');
  return `<section class="pi-pv-pays"><h4><i class="ti ti-cash"></i>Payments ${!v && (money.paid || money.paymentDiscount) ? piStatusPill(st) : ''}<span class="pi-pv-sum">${money.paid || money.paymentDiscount ? `Paid ${piF(money.paid)}${money.paymentDiscount ? ` + discount ${piF(money.paymentDiscount)}` : ''} of ${piF(money.total)}` : ''}${money.cashBack ? ` · cash back ${piF(money.cashBack)}` : ''}</span></h4>
    ${pays.length ? `<div class="pi-lines-wrap"><table class="pi-lines pi-pv-table"><thead><tr><th>Payment</th><th>Date</th><th>Paid from / received into</th><th>Reference</th><th class="num">Amount</th><th>Confirmation</th><th>Recorded by</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
      : `<p class="pi-muted pi-pv-none">No payments yet${v ? '' : ' — use <b>Record payment</b> when you pay this invoice'}.</p>`}</section>`;
}

/* Record payment (approved mockup PI_9) */
function piPayModalEl(){
  let m = document.getElementById('pi-pay-modal');
  if (!m) { m = document.createElement('div'); m.className = 'modal-overlay'; m.id = 'pi-pay-modal'; document.body.appendChild(m); }
  if (!m.classList.contains('open')) document.body.appendChild(m);   // V268.3: opens in front of the screen it is called from
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
      ${(() => { const advs = piOpenAdvances(pi.supplierKey); return advs.length ? `<div class="pi-match adv"><i class="ti ti-wallet"></i><span><b>${piEsc(pi.supplierName)} has ${advs.length} open advance${advs.length > 1 ? 's' : ''}: ${piF(advs.reduce((x, a) => x + piCore().advanceLeftOf(a), 0))}</b> — choose it in <b>Paid from</b>, under Advances.</span></div>` : ''; })()}
      <div class="form-group pi-pm-date"><label for="pm-date">Payment date *</label><input id="pm-date" type="date" value="${piToday()}" max="${piToday()}" onchange="piPayModalEl()._st.date=this.value;piPmRecalc()"></div>
      <div class="pi-lines-wrap"><table class="pi-lines pi-pay-table"><thead><tr><th>Paid from (payment account)</th><th class="num" style="width:140px">Amount</th><th style="width:160px">Reference</th><th style="width:230px"></th><th style="width:34px"></th></tr></thead><tbody id="pm-lines"></tbody></table></div>
      <div class="pi-pm-add"><button type="button" class="btn btn-secondary btn-sm" onclick="piPmAdd()"><i class="ti ti-plus"></i>Add account</button><span class="pi-sub">Split the payment over cash, card and bank</span></div>
      <div class="pi-pm-disc"><i class="ti ti-discount"></i><b>Discount at payment</b><span class="pi-sub">Optional</span><input id="pm-disc" class="pi-cell pi-money" inputmode="decimal" placeholder="0.00" aria-label="Discount at payment" oninput="piPayModalEl()._st.discount=this.value;piPmRecalc()" onblur="piMoneyBlur(this)"></div>
      <p class="pi-note">The supplier accepted less than the balance. Recorded as a supplier discount on this invoice — it lowers the cost of its items (and the P/L follows).</p>
      <div class="pi-pm-after" id="pm-after"></div>
      <p class="pi-note">Cash lines wait for the custodian to confirm; card lines take the money from the card's linked bank account. Paying more than the balance is not allowed — pay the extra as an advance (Purchasing → Supplier Payments).</p>
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
  if (field === 'accountId') {
    const adv = String(value || '').startsWith('adv:') ? value.slice(4) : '';
    l.advanceId = adv; if (adv) { l.accountId = ''; l.reference = ''; const ad = piAdvOf(adv); if (ad && piN(l.amount) > piCore().advanceLeftOf(ad)) l.amount = piF(piCore().advanceLeftOf(ad)); }
    const a = piAccOf(l.accountId); if (!a || a.type !== 'bank') l.bankCharge = '';
  }
  if (rerender) piPmRender(); else piPmRecalc();
}
function piPmRender(){
  const m = piPayModalEl(), pi = piInvoices().find(p => p.id === m._pi);
  const advs = piOpenAdvances(pi && pi.supplierKey);
  document.getElementById('pm-lines').innerHTML = m._st.lines.map((l, i) => {
    const a = piAccOf(l.accountId), ad = l.advanceId ? piAdvOf(l.advanceId) : null;
    const opts = advs.slice(); if (ad && !opts.some(x => x.id === ad.id)) opts.push(ad);
    return `<tr class="pi-pay-line${ad ? ' pi-adv-line' : ''}"><td><span class="pi-pay-sel">${ad ? piAccIcon('advance') : a ? piAccIcon(a.type) : ''}<select class="pi-pay-acc" aria-label="Paid from" onchange="piPmSet(${i},'accountId',this.value,true)">${piAccOptions(ad ? 'adv:' + ad.id : l.accountId, null, opts)}</select></span></td>
      <td class="num"><input class="pi-cell pi-money pi-pay-amt" inputmode="decimal" placeholder="0.00" value="${piEsc(l.amount)}" aria-label="Amount" oninput="piPmSet(${i},'amount',this.value)" onblur="piMoneyBlur(this)"></td>
      <td><input class="pi-cell pi-pay-ref" maxlength="60" placeholder="Optional" value="${piEsc(ad ? ((ad.lines || []).map(x => x.reference).filter(Boolean)[0] || '—') : l.reference)}" aria-label="Reference"${ad ? ' disabled' : ''} oninput="piPmSet(${i},'reference',this.value)"></td>
      <td class="pi-pay-info">${piPayInfo(l, `piPmSet(${i},'bankCharge',this.value)`)}</td>
      <td><button type="button" class="pi-x" title="Remove this account" aria-label="Remove account" onclick="piPayModalEl()._st.lines.splice(${i},1);piPmRender()"><i class="ti ti-x"></i></button></td></tr>`;
  }).join('') || '<tr><td colspan="5" class="pi-empty-lines pi-nopay"><i class="ti ti-cash-off"></i>No money paid now — enter the <b>discount at payment</b> below, or use <b>Add account</b>.</td></tr>';
  piPmRecalc();
}
function piPmInput(){
  const m = piPayModalEl();
  return { kind: 'payment', date: m._st.date, lines: m._st.lines.map(l => l.advanceId ? { advanceId: l.advanceId, amount: l.amount } : l), discount: m._st.discount };
}
function piPmRecalc(){
  const m = piPayModalEl(), pi = piInvoices().find(p => p.id === m._pi); if (!pi) return;
  const C = piCore(), money = C.invoiceMoneyOf(pi);
  const v = C.validateSupplierPayment(piPmInput(), { invoice: pi, accounts: piAccMap(), advances: piAdvMap(piOpenAdvances(pi.supplierKey)), today: piToday() });
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
    const r = await bcBusy('Saving payment…', () => lib.service.recordSupplierPayment({ ...piPmInput(), operationId: m._op, invoiceId: m._pi, expectedRevision: m._rev, numbering: piPayNumbering(m._st.date) }));
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
        <div class="form-group pi-cb-note"><label for="cb-note">Note <em>Optional</em></label><input id="cb-note" maxlength="200" placeholder="e.g. discount returned in cash by the salesman"></div>
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
    const r = await bcBusy('Saving cash back…', () => lib.service.recordSupplierCashBack({ ...input, operationId: m._op, invoiceId: m._pi, expectedRevision: m._rev, numbering: piPayNumbering(input.date) }));
    closeModal('pi-pay-modal');
    if (typeof showToast === 'function') showToast(`${r.payment.spNo} — cash back ${piF(r.payment.amount)} recorded`, 'success');
  } catch (e) { err.hidden = false; err.textContent = e.message || 'Could not save the cash back.'; btn.disabled = false; }
}

/* Cancel a payment / cash back (with a reason) */
function piAskCancelPay(payId){
  const p = (piLib().payments || []).find(x => x.id === payId); if (!p) return;
  const m = piPayModalEl(); m._pay = payId; m._op = 'spv-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  const what = p.kind === 'cashback' ? 'cash back' : p.kind === 'advance' ? 'advance' : 'payment';
  if (p.kind === 'advance' && piN(p.advanceUsed) > 0.005) { if (typeof showToast === 'function') showToast(`${p.spNo}: ${piF(p.advanceUsed)} is already used on an invoice — cancel that payment first.`, 'warning'); return; }
  m.innerHTML = `<div class="modal pi-paym" role="dialog" aria-modal="true" aria-labelledby="cp-title" style="--pi-w:480px">
    <div class="modal-header"><div class="modal-header-title-wrap"><h2 id="cp-title">Cancel ${piEsc(p.spNo)}</h2></div><button class="close-btn" type="button" onclick="closeModal('pi-pay-modal')" aria-label="Close">✕</button></div>
    <div class="modal-body"><p class="pi-note" style="margin-top:0">The ${what} of ${piF(p.amount)}${p.discount ? ` (+ discount ${piF(p.discount)})` : ''} stays in the list, marked Cancelled. Its cash / bank lines are cancelled in Cash &amp; Bank and ${p.kind === 'cashback' ? 'the item costs go back up' : p.kind === 'advance' ? `the open advance of ${piEsc(p.supplierName)} is removed` : `the balance of ${piEsc(p.piNo)} goes back up${(p.advanceIds || []).length ? ' and the advance it used is open again' : ''}`}. Enter it again correctly if needed.</p>
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
    await bcBusy(`Cancelling ${p.spNo}…`, () => piLib().service.voidSupplierPayment({ operationId: m._op, paymentId: p.id, reason: why, expectedRevision: p.revision }));
    closeModal('pi-pay-modal');
    if (typeof showToast === 'function') showToast(`${p.spNo} cancelled`, 'success');
  } catch (e) { err.hidden = false; err.textContent = e.message || 'Could not cancel.'; btn.disabled = false; }
}


/* ═══════════════════════════════ V268.3 EDIT (approved mockup PI_14) ═══════════════════════════════
   Limited (staff, within the edit days): numbers, dates and the reasons for a higher cost — the figures stay.
   Full (administrators, Administration → Purchase Settings): the normal invoice screen with every field open —
   only while the invoice has no payments. Same PI number; the reason and before → after are kept in its history. */
function piEditRight(doc){ const C = piCore(); return C && doc ? C.editRightOf(doc, { settings: piSettings(), isAdmin: piIsAdmin(), nowMs: Date.now() }) : { right: null, why: '' }; }
const PI_LOCK_MODALS = ['pi-new-modal', 'pi-edit-modal', 'sp-edit-modal'];
/** Runs open() while this user holds the document lock; the lock stays with the screen that open() shows. */
async function piWithLock(docType, id, label, activity, open){
  if (typeof acquireDocLock !== 'function') return open();
  if (typeof beginScreenTransition === 'function') beginScreenTransition('Opening ' + label + '…');
  try {
  const ok = await acquireDocLock(docType, id, label, activity); if (!ok) return false;
  const before = new Set(typeof openOverlayIds === 'function' ? openOverlayIds() : []);
  let res;
  try { res = await open(); } catch (e) { await releaseLock(); throw e; }
  const opened = (typeof openOverlayIds === 'function' ? openOverlayIds() : []).filter(x => PI_LOCK_MODALS.includes(x) && !before.has(x));
  if (opened.length && typeof _activeLock !== 'undefined' && _activeLock) _activeLock.modalId = opened[opened.length - 1];
  else await releaseLock();
  return res;
  } finally { if (typeof endScreenTransition === 'function') endScreenTransition(); }
}
const piHasMoney = pi => piN(pi.paid) > 0.005 || piN(pi.paymentDiscount) > 0.005 || piN(pi.cashBack) > 0.005;
function piEditInvoiceClick(id){
  const pi = piInvoices().find(p => p.id === id); if (!pi) return;
  const r = piEditRight(pi);
  if (!r.right) { if (typeof showToast === 'function') showToast(r.why || 'This invoice can\'t be edited.', 'warning'); return; }
  return piWithLock('purchaseInvoice', id, pi.piNo, 'Editing ' + pi.piNo, () => (r.right === 'full' && !piHasMoney(pi) ? piOpenFullEdit(id) : piOpenLimitedEdit(id)));
}
function piOpenLimitedEdit(id){
  const pi = piInvoices().find(p => p.id === id); if (!pi) return false;
  const r = piEditRight(pi), set = piSettings();
  let m = document.getElementById('pi-edit-modal');
  if (!m) { m = document.createElement('div'); m.className = 'modal-overlay'; m.id = 'pi-edit-modal'; document.body.appendChild(m); }
  else if (!m.classList.contains('open')) document.body.appendChild(m);   // V268.3: in front
  m._id = id; m._rev = pi.revision; m._op = 'pie-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  const why = piHasMoney(pi) ? 'this invoice has payments' : 'your role allows limited edits';
  const above = (pi.lines || []).filter(l => l.costCheck === 'above');
  m.innerHTML = `<div class="modal pi-paym" role="dialog" aria-modal="true" aria-labelledby="pie-title" style="--pi-w:660px">
    <div class="modal-header"><div><h2 id="pie-title">Edit ${piEsc(pi.piNo)}</h2><div class="so-create-subtitle">${piEsc(pi.supplierName)} · invoice ${piEsc(pi.supplierInvoiceNo)}</div></div><button class="close-btn" type="button" onclick="closeModal('pi-edit-modal')" aria-label="Close">✕</button></div>
    <div class="modal-body">
      <div class="pi-edit-mode lim"><i class="ti ti-lock"></i><span><b>Limited edit</b> — ${why}. Amounts and lines are fixed: ${piHasMoney(pi) ? 'to change them, cancel the payments first and an administrator edits it' : 'to change them an administrator edits it, or cancel it and enter it again'}.</span></div>
      <div class="pi-edit-grid">
        <div class="form-group"><label for="pie-inv">Supplier invoice no. *</label><input id="pie-inv" maxlength="60" value="${piEsc(pi.supplierInvoiceNo)}"></div>
        <div class="form-group"><label for="pie-zoho">Zoho bill no.</label><input id="pie-zoho" maxlength="60" value="${piEsc(pi.zohoBillNo || '')}"></div>
        <div class="form-group"><label for="pie-date">Invoice date *</label><input id="pie-date" type="date" value="${piEsc(pi.date)}"></div>
        <div class="form-group"><label for="pie-due">Payment due *</label><input id="pie-due" type="date" value="${piEsc(pi.dueDate)}"></div>
      </div>
      ${above.map(l => `<div class="form-group"><label for="pie-r${l.lineNo}">Reason for the higher cost (${piEsc(String(l.desc || '').slice(0, 40))})</label><input id="pie-r${l.lineNo}" data-line="${l.lineNo}" class="pie-reason" maxlength="300" value="${piEsc(l.costReason || '')}"></div>`).join('')}
      <div class="form-group"><label for="pie-why">Reason for the change *</label><input id="pie-why" maxlength="300" placeholder="e.g. supplier invoice no. typed wrong"></div>
      <p class="pi-note">${r.until ? `Editable until ${piDate(r.until)} (${set.editDays} days) · administrators any time · ` : ''}the invoice is locked while you edit · every change is kept in its history.</p>
      <div class="inv-error" id="pie-err" hidden></div>
    </div>
    <div class="modal-footer"><button class="btn btn-secondary" type="button" onclick="closeModal('pi-edit-modal')">Cancel</button><button class="btn btn-primary" type="button" id="pie-save" onclick="piSaveLimitedEdit()"><i class="ti ti-device-floppy"></i>Save changes</button></div></div>`;
  if (typeof openModalWithSize === 'function') openModalWithSize('pi-edit-modal'); else m.classList.add('open');
  setTimeout(() => document.getElementById('pie-inv').focus(), 60);
  return true;
}
async function piSaveLimitedEdit(){
  const m = document.getElementById('pi-edit-modal'), pi = piInvoices().find(p => p.id === m._id), err = document.getElementById('pie-err');
  if (!pi) return;
  const costReasons = {}; m.querySelectorAll('.pie-reason').forEach(e => { costReasons[e.dataset.line] = e.value; });
  const input = { supplierInvoiceNo: document.getElementById('pie-inv').value, zohoBillNo: document.getElementById('pie-zoho').value, date: document.getElementById('pie-date').value,
    dueDate: document.getElementById('pie-due').value, costReasons, reason: document.getElementById('pie-why').value };
  const v = piCore().validateInvoiceLimitedEdit(pi, input);
  if (!v.ok) { err.hidden = false; err.textContent = v.errors.map(e => e.message).join(' '); return; }
  const btn = document.getElementById('pie-save'); btn.disabled = true; err.hidden = true;
  try {
    await bcBusy('Saving changes…', () => piLib().service.editPurchaseInvoice({ ...input, operationId: m._op, invoiceId: pi.id, expectedRevision: m._rev, mode: 'limited' }));
    closeModal('pi-edit-modal');
    if (typeof showToast === 'function') showToast(`${pi.piNo} changed — ${v.changes.map(c => c.field).join(', ')}`, 'success');
  } catch (e) { err.hidden = false; err.textContent = e.code === 'permission-denied' ? 'The server refused the change. Please reload and try again.' : (e.message || 'Could not save.'); btn.disabled = false; }
}
/** Full edit: the invoice screen, pre-filled; this invoice's own quantities are "still to buy" again while editing. */
function piSetEditMode(m, pi){
  const on = !!pi;
  document.getElementById('pe-title').textContent = on ? `Edit ${pi.piNo}` : 'New Purchase Invoice';
  document.getElementById('pe-save-text').textContent = on ? 'Save changes' : 'Save Purchase Invoice';
  document.getElementById('pe-edit-row').hidden = !on;
  document.getElementById('pe-edit-why').value = '';
  m.querySelector('.modal').classList.toggle('pi-editing', on);
}
function piOpenFullEdit(id){
  const pi = piInvoices().find(p => p.id === id); if (!pi) return false;
  openNewPurchaseInvoice();
  const m = document.getElementById('pi-new-modal'), s = m._s;
  document.body.appendChild(m);   // in front of the open invoice view
  s.editOf = pi; s.op = 'pief-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10); s.dueTouched = true;
  s.editOwn = new Map();
  (pi.lines || []).forEach(l => (l.allocations || []).forEach(a => { if (!s.editOwn.has(a.soId)) s.editOwn.set(a.soId, new Map()); const x = s.editOwn.get(a.soId); x.set(a.soLineId, (x.get(a.soLineId) || 0) + piN(a.qty)); }));
  piSetEditMode(m, pi);
  const sel = document.getElementById('pe-supplier');
  if (![...sel.options].some(o => o.value === pi.supplierId)) sel.insertAdjacentHTML('beforeend', `<option value="${piEsc(pi.supplierId)}">${piEsc(pi.supplierName)}</option>`);
  sel.value = pi.supplierId; bcPickSync('pe-supplier');
  document.getElementById('pe-invno').value = pi.supplierInvoiceNo || '';
  document.getElementById('pe-zoho').value = pi.zohoBillNo || '';
  document.getElementById('pe-date').value = pi.date;
  document.getElementById('pe-due').value = pi.dueDate;
  document.getElementById('pe-suptotal').value = piF(pi.totals.supplierTotal != null ? pi.totals.supplierTotal : pi.totals.total);
  document.getElementById('pe-subtitle').textContent = `${pi.piNo} keeps its number · recorded by ${pi.createdBy || ''}`;
  s.lines = (pi.lines || []).map(l => {
    const base = { kind: l.kind, desc: l.desc, code: l.code || '', uom: l.uom || '', productId: l.productId || '', qty: l.qty, unitCost: l.unitCost, discountPct: l.discountPct || 0, reference: l.reference && l.reference.unit ? l.reference : null, costReason: l.costReason || '' };
    if (l.kind !== 'order') return base;
    const so = piSOs().find(x => x.id === l.soId), it = so && (so.items || []).find(x => x.lineId === l.soLineId);
    const second = (l.allocations || [])[1];
    return { ...base, soId: l.soId, soNo: l.soNo, customer: l.customer, soLineId: l.soLineId, orderedQty: it ? Number(it.qty) || 0 : l.orderedQty,
      extra: piN(l.stockQty) > 0 ? { to: 'stock' } : second ? { to: 'order', soId: second.soId, soLineId: second.soLineId } : null };
  });
  s.costs = (pi.costs || []).map(c => ({ label: c.label, amount: piF(c.amount) }));
  s.discount = pi.discount ? { mode: pi.discount.mode, value: String(pi.discount.value) } : null;
  const t = pi.totals || {};
  if (t.vat != null && t.vatCalculated != null && Math.abs(t.vat - t.vatCalculated) > 0.0049) { s.vatTouched = true; s.vat = piF(t.vat); }
  s.pays = [];
  piRenderLines(); piRenderCosts(); piRenderPays(); piRecalc();
  return true;
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
    <div class="form-group"><label for="ps-edit">Edit purchase invoices &amp; supplier payments</label><select id="ps-edit"${dis}>${[['off', 'Off — cancel and enter again'], ['limited', 'Limited for everyone'], ['limited-admin', 'Limited for staff, full for administrators'], ['full', 'Full for everyone']].map(([v, t]) => `<option value="${v}"${s.editMode === v ? ' selected' : ''}>${t}</option>`).join('')}</select><small>Limited: numbers, dates, references and reasons. Full: lines, amounts and accounts.</small></div>
    <div class="form-group"><label for="ps-edit-days">Edit time limit (days)</label><input id="ps-edit-days" inputmode="numeric" value="${s.editDays}"${dis}><small>After that only administrators edit; others cancel and enter again.</small></div>
    <div class="form-group"><label for="ps-newprod">+ New Product on a purchase invoice</label><select id="ps-newprod"${dis}>${[['everyone', 'Everyone'], ['admins', 'Administrators only']].map(([v, t]) => `<option value="${v}"${s.newProductRight === v ? ' selected' : ''}>${t}</option>`).join('')}</select><small>An item for stock must be a product. This decides who may add a missing one from the invoice.</small></div>
    <div class="form-group"><label for="ps-edit-paid">Full edit of an invoice with payments</label><select id="ps-edit-paid" disabled><option>Not allowed — cancel the payments first</option></select></div>
  </div><div class="inv-error" id="ps-error" hidden></div>
  <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px">${admin ? '<button class="btn btn-primary" type="button" id="ps-save" onclick="savePurchaseSettingsForm()"><i class="ti ti-device-floppy"></i>Save settings</button>' : '<span class="pi-muted">Only administrators can change these settings.</span>'}</div>`;
}
async function savePurchaseSettingsForm(){
  const g = id => document.getElementById(id).value;
  const btn = document.getElementById('ps-save'), err = document.getElementById('ps-error'); btn.disabled = true; err.hidden = true;
  try {
    await bcBusy('Saving settings…', () => piLib().service.savePurchaseSettings({ costLimitPct: g('ps-limit'), costLimitAction: g('ps-action'), discountMode: g('ps-disc'), roundingLimit: g('ps-round'), vatRate: g('ps-vat'), profitVisibility: g('ps-profit'), editMode: g('ps-edit'), editDays: g('ps-edit-days'), newProductRight: g('ps-newprod') }));
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
console.log('Purchase Invoices V268.3 ✅ (payments · advances · edit · discount at payment · cash back)');

/* ═══════════════════════════════ V268.5 TYPE-AND-SEARCH PICKER (approved mockup V5_1) ═══════════════════════════════
   Same look and keys as the customer picker on New Receipt. It enhances a <select>: the select stays (hidden) and keeps
   the value, so the code around it is unchanged. cfg: { items() → [{key,title,sub,right,text}], placeholder, empty,
   hint, clearLabel (optional field: × clears it), compact (filter bar) }. */
const BC_PK = {};
function bcPickEnhance(selId, cfg){
  const sel = document.getElementById(selId); if (!sel) return;
  cfg = cfg || {};
  let box = document.getElementById(selId + '-pk');
  if (!box) {
    box = document.createElement('div'); box.id = selId + '-pk';
    box.className = 'rct-picker bc-picker' + (cfg.compact ? ' bc-pick-compact' : '');
    box.innerHTML = `<div class="rct-pick-chosen" id="${selId}-chosen" hidden></div><div class="rct-pick-search" id="${selId}-search"><i class="ti ti-search"></i><input id="${selId}-q" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="${selId}-list">${cfg.lookup ? `<button type="button" class="bc-lk-btn" tabindex="-1" title="Open the list" aria-label="Open the list" onclick="bcLookupOpen('${selId}','')"><i class="ti ti-list-search"></i></button>` : ''}</div><div class="rct-pick-list" id="${selId}-list" role="listbox" hidden></div>`;
    sel.insertAdjacentElement('afterend', box); sel.hidden = true; sel.classList.add('bc-pick-native'); sel.tabIndex = -1;
    const q = document.getElementById(selId + '-q');
    q.addEventListener('input', () => { const c = BC_PK[selId]; if (c.lookup) { const t = q.value; q.value = ''; bcLookupOpen(selId, t); return; } c.idx = 0; bcPickOpen(selId); });
    q.addEventListener('click', () => { if (BC_PK[selId].lookup) bcLookupOpen(selId, ''); else bcPickOpen(selId); });
    q.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== q) bcPickClose(selId, true); }, 150));
    q.addEventListener('keydown', e => bcPickKey(selId, e));
    document.getElementById(selId + '-list').addEventListener('mousedown', e => e.preventDefault());
    document.querySelectorAll(`label[for="${selId}"]`).forEach(l => { l.htmlFor = selId + '-q'; });
    if (sel.getAttribute('aria-label')) q.setAttribute('aria-label', sel.getAttribute('aria-label'));
    sel.addEventListener('change', () => { if (BC_PK[selId] && !BC_PK[selId]._setting) bcPickSync(selId); });
  }
  BC_PK[selId] = { ...cfg, idx: 0, shown: [] };
  document.getElementById(selId + '-q').placeholder = cfg.placeholder || 'Type to search…';
  bcPickSync(selId);
}
function bcPickItems(selId){
  const c = BC_PK[selId], sel = document.getElementById(selId);
  if (c && typeof c.items === 'function') return c.items() || [];
  return [...(sel ? sel.options : [])].filter(o => o.value).map(o => ({ key: o.value, title: o.textContent, text: o.textContent }));
}
/** Shows the chosen value (call after the code sets select.value or rebuilds its options). */
function bcPickSync(selId){
  const sel = document.getElementById(selId), c = BC_PK[selId]; if (!sel || !c) return;
  const chosen = document.getElementById(selId + '-chosen'), search = document.getElementById(selId + '-search'), q = document.getElementById(selId + '-q');
  const it = sel.value ? (bcPickItems(selId).find(x => x.key === sel.value) || { key: sel.value, title: (sel.selectedOptions[0] || {}).textContent || sel.value }) : null;
  if (it) {
    const tail = sel.disabled ? '<span class="rct-pick-lock" title="Can\'t be changed here"><i class="ti ti-lock"></i></span>'
      : `<button type="button" class="rct-pick-change bc-pick-pen" title="Change" aria-label="Change" onclick="bcPickChange('${selId}')"><i class="ti ti-pencil"></i></button>${c.clearLabel ? `<button type="button" class="bc-pick-x" title="${piEsc(c.clearLabel)}" aria-label="${piEsc(c.clearLabel)}" onclick="bcPickClear('${selId}')"><i class="ti ti-x"></i></button>` : ''}`;
    chosen.title = [it.title, it.sub].filter(Boolean).join(' · ');
    chosen.innerHTML = `<span class="rct-pick-txt"><b>${piEsc(it.title)}</b>${it.sub && !c.compact ? `<small>${piEsc(it.sub)}</small>` : ''}</span>${tail}`;
    chosen.hidden = false; search.hidden = true;
    chosen.onclick = c.compact && !sel.disabled ? (e => { if (!e.target.closest('.bc-pick-x')) bcPickChange(selId); }) : null;
  } else { chosen.hidden = true; search.hidden = false; q.disabled = !!sel.disabled; }
  bcPickClose(selId);
}
function bcPickOpen(selId){
  const c = BC_PK[selId], q = document.getElementById(selId + '-q'), list = document.getElementById(selId + '-list'); if (!c || !q) return;
  const words = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const all = bcPickItems(selId).filter(it => { const h = String(it.text || ((it.title || '') + ' ' + (it.sub || ''))).toLowerCase(); return words.every(w => h.includes(w)); });
  c.shown = all.slice(0, c.max || 60); if (c.idx > c.shown.length || (c.idx === c.shown.length && !c.addNew)) c.idx = 0;
  list.innerHTML = (c.shown.length ? c.shown.map((it, i) => `<div class="rct-pick-opt${i === c.idx ? ' on' : ''}" role="option" id="${selId}-opt-${i}" aria-selected="${i === c.idx}" data-i="${i}"><span class="rct-pick-txt"><b>${piEsc(it.title)}</b>${it.sub ? `<small>${piEsc(it.sub)}</small>` : ''}</span>${it.right ? `<span class="rct-pick-amt bc-pick-right">${piEsc(it.right)}</span>` : ''}</div>`).join('')
      : `<div class="rct-pick-empty">${piEsc(c.empty || 'Nothing matches. Check the spelling.')}</div>`)
    + (all.length > c.shown.length ? `<div class="rct-pick-empty">${all.length - c.shown.length} more — type more to narrow the list</div>` : '')
    + (c.addNew ? (() => { const t = q.value.trim(); return `<div class="rct-pick-opt pi-np-opt bc-pick-add${c.idx === c.shown.length ? ' on' : ''}" role="option" data-i="${c.shown.length}"><span class="pi-np-plus"><i class="ti ti-plus"></i></span><span class="rct-pick-txt"><b>${piEsc(c.addNew.label)}${t ? ' “' + piEsc(t) + '”…' : '…'}</b><small>${piEsc(c.addNew.sub || '')}</small></span></div>`; })() : '')
    + (c.hint ? `<div class="bc-pick-hint">${piEsc(c.hint)}</div>` : '');
  list.querySelectorAll('.rct-pick-opt').forEach(e => {
    e.addEventListener('click', () => bcPickChoose(selId, +e.dataset.i));
    e.addEventListener('mousemove', () => { const i = +e.dataset.i; if (c.idx === i) return; c.idx = i; list.querySelectorAll('.rct-pick-opt').forEach((x, j) => x.classList.toggle('on', j === i)); });
  });
  list.hidden = false; q.setAttribute('aria-expanded', 'true'); document.getElementById(selId + '-pk').classList.add('open');
  bcPickPlace(selId);
}
/* V268.51: the list floats over the window, fits the space left on screen (below, or above when there is more room) */
function bcPickPlace(selId){
  const list = document.getElementById(selId + '-list'), box = document.getElementById(selId + '-pk'); if (!list || !box || list.hidden) return;
  const anchor = document.getElementById(selId + '-search').hidden ? document.getElementById(selId + '-chosen') : document.getElementById(selId + '-search');
  if (typeof bcFitList === 'function') bcFitList(list, anchor, BC_PK[selId] && BC_PK[selId].compact ? 300 : 0);
}
window.addEventListener('resize', () => Object.keys(BC_PK).forEach(id => bcPickClose(id, true)));
document.addEventListener('scroll', e => { if (e.target && e.target.closest && e.target.closest('.rct-pick-list')) return; Object.keys(BC_PK).forEach(id => { const l = document.getElementById(id + '-list'); if (l && !l.hidden) bcPickClose(id, true); }); }, true);
function bcPickClose(selId, restore){
  const list = document.getElementById(selId + '-list'), q = document.getElementById(selId + '-q'); if (!list) return;
  list.hidden = true; if (q) q.setAttribute('aria-expanded', 'false'); document.getElementById(selId + '-pk')?.classList.remove('open');
  if (restore) { const sel = document.getElementById(selId); if (sel && sel.value && document.getElementById(selId + '-chosen').hidden) { q.value = ''; bcPickSync(selId); } }
}
function bcPickKey(selId, e){
  const c = BC_PK[selId]; if (!c) return;
  if (c.lookup) { if (e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); bcLookupOpen(selId, ''); } return; }
  const list = document.getElementById(selId + '-list');
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault(); if (list.hidden) { bcPickOpen(selId); return; }
    const n = c.shown.length + (c.addNew ? 1 : 0); if (!n) return; c.idx = (c.idx + (e.key === 'ArrowDown' ? 1 : n - 1)) % n;
    list.querySelectorAll('.rct-pick-opt').forEach((x, j) => x.classList.toggle('on', j === c.idx));
    document.getElementById(selId + '-opt-' + c.idx)?.scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter') { if (!list.hidden && (c.shown.length || c.addNew)) { e.preventDefault(); bcPickChoose(selId, c.idx); } }
  else if (e.key === 'Escape') { if (!list.hidden) { e.preventDefault(); e.stopPropagation(); bcPickClose(selId, true); } }
}
function bcPickSetValue(selId, key){
  const sel = document.getElementById(selId); if (!sel) return;
  if (key && ![...sel.options].some(o => o.value === key)) { const it = bcPickItems(selId).find(x => x.key === key); const o = document.createElement('option'); o.value = key; o.textContent = it ? it.title : key; sel.appendChild(o); }
  sel.value = key || '';
  document.getElementById(selId + '-q').value = '';
  bcPickSync(selId);
  BC_PK[selId]._setting = true; try { sel.dispatchEvent(new Event('change', { bubbles: true })); } finally { BC_PK[selId]._setting = false; }
}
function bcPickChoose(selId, i){
  const c = BC_PK[selId]; if (!c) return;
  if (c.addNew && i === c.shown.length) { const t = (document.getElementById(selId + '-q') || {}).value || ''; bcPickClose(selId); c.addNew.open(selId, t.trim()); return; }
  const it = c.shown[i]; if (it) bcPickSetValue(selId, it.key);
}
function bcPickClear(selId){ bcPickSetValue(selId, ''); setTimeout(() => document.getElementById(selId + '-q')?.focus(), 0); }
function bcPickChange(selId){
  if (BC_PK[selId] && BC_PK[selId].lookup) { bcLookupOpen(selId, ''); return; }
  document.getElementById(selId + '-chosen').hidden = true; document.getElementById(selId + '-search').hidden = false;
  const q = document.getElementById(selId + '-q'); q.value = ''; q.disabled = false; q.focus();
}
function bcPickFocus(selId){ const sel = document.getElementById(selId); if (sel && sel.value) document.querySelector(`#${selId}-chosen .rct-pick-change`)?.focus(); else document.getElementById(selId + '-q')?.focus(); }
/* ═══ V268.6 LOOKUP WINDOW (approved mockup V6_2, option 3) ═══
   Clicking or typing in a picker opens "Choose …": a search box and a table; ↑ ↓, Enter or double-click chooses.
   cfg.lookup = { title, sub, noun, columns: [{ label, cls }] }; each item has cells: [...] in the same order. */
const BC_LK = { selId: null, idx: 0, shown: [] };
function bcLookupOpen(selId, text){
  const c = BC_PK[selId], sel = document.getElementById(selId); if (!c || !c.lookup || !sel || sel.disabled) return;
  let m = document.getElementById('bc-lookup-modal');
  if (!m) { m = document.createElement('div'); m.id = 'bc-lookup-modal'; m.className = 'modal-overlay bc-ds-overlay'; }
  document.body.appendChild(m);   // in front
  BC_LK.selId = selId; BC_LK.idx = 0;
  const L = c.lookup, cols = L.columns || [{ label: L.noun || 'Name' }];
  const sub = typeof L.sub === 'function' ? L.sub() : (L.sub || '');
  m.innerHTML = `<div class="modal pi-paym bc-lk" role="dialog" aria-modal="true" aria-labelledby="bclk-title" style="--pi-w:${L.width || 800}px">
    <div class="modal-header"><div><h2 id="bclk-title">${piEsc(L.title || 'Choose')}</h2>${sub ? `<div class="so-create-subtitle">${piEsc(sub)}</div>` : ''}</div><button class="close-btn" type="button" onclick="bcLookupClose()" aria-label="Close">✕</button></div>
    <div class="modal-body">
      <div class="rct-pick-search bc-lk-search"><i class="ti ti-search"></i><input id="bclk-q" autocomplete="off" placeholder="${piEsc(c.placeholder || 'Search…')}" aria-label="Search"></div>
      <div class="bc-lk-wrap"><table class="bc-lk-table"><thead><tr>${cols.map(k => `<th class="${k.cls || ''}">${piEsc(k.label)}</th>`).join('')}</tr></thead><tbody id="bclk-body"></tbody></table></div>
      <div class="bc-lk-foot" id="bclk-foot"></div>
    </div>
    <div class="modal-footer">${c.clearLabel && sel.value ? `<button class="btn btn-secondary" type="button" onclick="bcLookupPick(-1)"><i class="ti ti-x"></i>${piEsc(c.clearLabel)}</button><span style="flex:1"></span>` : ''}<button class="btn btn-secondary" type="button" onclick="bcLookupClose()">Cancel</button><button class="btn btn-primary" type="button" id="bclk-go" onclick="bcLookupPick(BC_LK.idx)" disabled>Choose</button></div></div>`;
  const z = Math.max(0, ...[...document.querySelectorAll('.modal-overlay.open')].filter(e => e !== m).map(e => Number(getComputedStyle(e).zIndex) || 0)); m.style.zIndex = z ? String(z + 1) : '';
  if (typeof openModalWithSize === 'function') openModalWithSize('bc-lookup-modal'); else m.classList.add('open');
  const q = document.getElementById('bclk-q'); q.value = text || '';
  q.addEventListener('input', () => { BC_LK.idx = 0; bcLookupRender(); });
  q.addEventListener('keydown', bcLookupKey);
  m.onkeydown = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); bcLookupClose(); } };
  bcLookupRender();
  const fq = () => { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }; fq(); setTimeout(fq, 30);
}
function bcLookupRender(){
  const c = BC_PK[BC_LK.selId]; if (!c) return;
  const q = document.getElementById('bclk-q'), body = document.getElementById('bclk-body'), sel = document.getElementById(BC_LK.selId);
  const words = q.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const all = bcPickItems(BC_LK.selId), hit = all.filter(it => { const h = String(it.text || ((it.title || '') + ' ' + (it.sub || ''))).toLowerCase(); return words.every(w => h.includes(w)); });
  BC_LK.shown = hit.slice(0, 200);
  if (!words.length && sel.value) { const i = BC_LK.shown.findIndex(it => it.key === sel.value); if (i >= 0 && BC_LK.idx === 0) BC_LK.idx = i; }
  if (BC_LK.idx >= BC_LK.shown.length) BC_LK.idx = 0;
  const cols = (c.lookup.columns || [{}]).length;
  body.innerHTML = BC_LK.shown.length ? BC_LK.shown.map((it, i) => `<tr data-i="${i}" class="${i === BC_LK.idx ? 'on' : ''}${it.key === sel.value ? ' cur' : ''}">${(it.cells || [it.title]).map((v, k) => `<td class="${(c.lookup.columns[k] || {}).cls || ''}">${piEsc(v == null ? '' : v)}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${cols}" class="bc-lk-empty">${piEsc(c.empty || 'Nothing matches. Check the spelling.')}</td></tr>`;
  body.querySelectorAll('tr[data-i]').forEach(tr => {
    tr.addEventListener('click', () => { BC_LK.idx = +tr.dataset.i; bcLookupMark(); });
    tr.addEventListener('dblclick', () => bcLookupPick(+tr.dataset.i));
  });
  const nounOf = n => { const w = c.lookup.noun || 'items'; return n === 1 ? w.replace(/s$/, '') : w; };
  document.getElementById('bclk-foot').textContent = `${hit.length === all.length ? all.length + ' ' + nounOf(all.length) : hit.length + ' of ' + all.length + ' ' + nounOf(all.length)}${hit.length > BC_LK.shown.length ? ' · first ' + BC_LK.shown.length + ' shown, type more to narrow' : ''} · ↑ ↓ to move · Enter or double-click to choose`;
  bcLookupMark();
}
function bcLookupMark(){
  const body = document.getElementById('bclk-body'); if (!body) return;
  body.querySelectorAll('tr[data-i]').forEach(tr => tr.classList.toggle('on', +tr.dataset.i === BC_LK.idx));
  const it = BC_LK.shown[BC_LK.idx], go = document.getElementById('bclk-go'), c = BC_PK[BC_LK.selId];
  go.disabled = !it; go.innerHTML = '<i class="ti ti-check"></i>' + (it ? 'Choose ' + piEsc(it.short || it.title) : 'Choose');
  body.querySelector('tr.on')?.scrollIntoView({ block: 'nearest' });
}
function bcLookupKey(e){
  const n = BC_LK.shown.length;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!n) return; BC_LK.idx = (BC_LK.idx + (e.key === 'ArrowDown' ? 1 : n - 1)) % n; bcLookupMark(); }
  else if (e.key === 'Enter') { e.preventDefault(); if (n) bcLookupPick(BC_LK.idx); }
}
function bcLookupClose(){
  const id = BC_LK.selId;
  if (typeof closeModal === 'function') closeModal('bc-lookup-modal'); else document.getElementById('bc-lookup-modal')?.classList.remove('open');
  if (id) { bcPickSync(id); setTimeout(() => bcPickFocus(id), 0); }
}
function bcLookupPick(i){
  const id = BC_LK.selId; if (!id) return;
  const it = i >= 0 ? BC_LK.shown[i] : null; if (i >= 0 && !it) return;
  if (typeof closeModal === 'function') closeModal('bc-lookup-modal'); else document.getElementById('bc-lookup-modal')?.classList.remove('open');
  bcPickSetValue(id, it ? it.key : '');
  setTimeout(() => bcPickFocus(id), 0);
}
/* Supplier list for the picker: the supplier master, newest name order */
function bcSupplierPickItems(){
  return (typeof suppliers !== 'undefined' ? suppliers : []).filter(s => s && s.id).slice().sort((a, b) => String(a.company || a.name || '').localeCompare(String(b.company || b.name || '')))
    .map(s => { const name = s.company || s.name || s.id; const sub = [s.contact || s.contactPerson || '', s.city || '', s.vat ? 'VAT ' + s.vat : ''].filter(Boolean).join(' · ');
      return { key: s.id, title: name, sub, text: [name, s.code || '', s.contact || '', s.city || '', s.vat || '', s.phone || ''].join(' '),
        cells: [name, s.contact || s.contactPerson || '', s.phone || s.mobile || '', s.city || '', s.vat || ''] }; });
}
/* V268.6 lookup window (mockup V6_2) — kept for later, not used now (V6_1 chosen) */
const BC_SUPPLIER_LOOKUP = { title: 'Choose Supplier', noun: 'suppliers', width: 860, columns: [{ label: 'Supplier' }, { label: 'Contact' }, { label: 'Phone' }, { label: 'City' }, { label: 'VAT no.' }] };

/* ═══════════════════════════════ V268.7 NEW SUPPLIER from a picker (approved mockups V7_1 / V7_2) ═══════════════════════════════ */
const BC_NEW_SUPPLIER = { label: 'New Supplier', sub: 'Not in the list? Add it to Master Data → Suppliers', open: (selId, typed) => bcOpenNewSupplier(selId, typed) };
const bcSupNorm = v => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
function bcSimilarSuppliers(name, vat){
  const n = piNormName(name), v = String(vat || '').replace(/\D/g, '');
  return (typeof suppliers !== 'undefined' ? suppliers : []).filter(x => {
    if (v && String(x.vat || '').replace(/\D/g, '') === v) return true;
    const xn = piNormName(x.company || x.name); if (!n || !xn) return false;
    return xn === n || (n.length >= 5 && (xn.includes(n) || n.includes(xn))) || (n.length >= 6 && piLev(n, xn) <= 2);
  }).slice(0, 3);
}
function bcOpenNewSupplier(selId, typed){
  let m = document.getElementById('bc-ns-modal');
  if (!m) { m = document.createElement('div'); m.id = 'bc-ns-modal'; m.className = 'modal-overlay bc-ds-overlay'; }
  document.body.appendChild(m);   // in front
  m._sel = selId; m._warned = '';
  m.innerHTML = `<div class="modal pi-paym" role="dialog" aria-modal="true" aria-labelledby="bns-title" style="--pi-w:580px">
    <div class="modal-header"><div><h2 id="bns-title">New Supplier</h2><div class="so-create-subtitle">Added to Master Data → Suppliers and chosen here</div></div><button class="close-btn" type="button" onclick="bcCloseNewSupplier()" aria-label="Close">✕</button></div>
    <div class="modal-body">
      <div id="bns-dup"></div>
      <div class="pi-np-grid">
        <div class="form-group pi-np-wide"><label for="bns-name">Company name *</label><input id="bns-name" maxlength="200" value="${piEsc(typed || '')}" oninput="bcNewSupplierCheck()"></div>
        <div class="form-group"><label for="bns-contact">Contact person <em>Optional</em></label><input id="bns-contact" maxlength="120" placeholder="e.g. Muhammed"></div>
        <div class="form-group"><label for="bns-phone">Phone <em>Optional</em></label><input id="bns-phone" maxlength="40" placeholder="e.g. 05x xxx xxxx"></div>
        <div class="form-group"><label for="bns-vat">VAT no. <em>Optional</em></label><input id="bns-vat" maxlength="20" inputmode="numeric" placeholder="15 digits" oninput="bcNewSupplierCheck()"></div>
        <div class="form-group"><label for="bns-city">City <em>Optional</em></label><input id="bns-city" maxlength="80" placeholder="e.g. Riyadh"></div>
      </div>
      <p class="ds-note">The full supplier (address, bank, documents) can be completed later in Master Data → Suppliers. The same name or the same VAT no. as an existing supplier is refused.</p>
      <div class="inv-error" id="bns-err" hidden></div>
    </div>
    <div class="modal-footer"><button class="btn btn-secondary" type="button" onclick="bcCloseNewSupplier()">Cancel</button><button class="btn btn-primary" type="button" id="bns-save" onclick="bcSaveNewSupplier()"><i class="ti ti-plus"></i>Add supplier</button></div></div>`;
  const z = Math.max(0, ...[...document.querySelectorAll('.modal-overlay.open')].filter(e => e !== m).map(e => Number(getComputedStyle(e).zIndex) || 0)); m.style.zIndex = z ? String(z + 1) : '';
  if (typeof openModalWithSize === 'function') openModalWithSize('bc-ns-modal'); else m.classList.add('open');
  bcNewSupplierCheck();
  setTimeout(() => { const i = document.getElementById('bns-name'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 60);
}
function bcCloseNewSupplier(){ const m = document.getElementById('bc-ns-modal'); if (typeof closeModal === 'function') closeModal('bc-ns-modal'); else m?.classList.remove('open'); if (m && m._sel) setTimeout(() => bcPickFocus(m._sel), 0); }
function bcNewSupplierCheck(){
  const m = document.getElementById('bc-ns-modal'); if (!m) return;
  const e = document.getElementById('bns-err'); if (e) e.hidden = true;
  const sim = bcSimilarSuppliers(document.getElementById('bns-name').value, document.getElementById('bns-vat').value), key = sim.map(x => x.id).join(',');
  m._sim = sim; if (key !== m._warned) m._warned = '';
  document.getElementById('bns-dup').innerHTML = sim.length ? `<div class="pi-match warn pi-np-dup"><i class="ti ti-alert-triangle"></i><span><b>Did you mean ${sim.map(x => '“' + piEsc(x.company || x.name) + '”').join(' or ')}?</b> It looks the same. Use it instead — or continue to add a new supplier.</span>${sim.map(x => `<button type="button" class="btn btn-secondary btn-sm" onclick="bcUseExistingSupplier('${piEsc(x.id)}')">${sim.length > 1 ? 'Use ' + piEsc(String(x.company || x.name).slice(0, 18)) : 'Use it'}</button>`).join('')}</div>` : '';
  document.getElementById('bns-save').innerHTML = sim.length && m._warned !== key ? '<i class="ti ti-plus"></i>Add as a new supplier' : '<i class="ti ti-plus"></i>Add supplier';
}
function bcUseExistingSupplier(id){ const m = document.getElementById('bc-ns-modal'); if (!m) return; const sel = m._sel; if (typeof closeModal === 'function') closeModal('bc-ns-modal'); bcPickSetValue(sel, id); setTimeout(() => bcPickFocus(sel), 0); }
async function bcSaveNewSupplier(){
  const m = document.getElementById('bc-ns-modal'); if (!m) return;
  const err = document.getElementById('bns-err'); err.hidden = true;
  const fail = t => { err.textContent = t; err.hidden = false; };
  const company = document.getElementById('bns-name').value.trim(), vat = document.getElementById('bns-vat').value.trim();
  if (!company) { fail('Enter the company name.'); document.getElementById('bns-name').focus(); return; }
  if (vat && !/^\d{15}$/.test(vat.replace(/\s/g, ''))) { fail('The VAT no. has 15 digits.'); return; }
  const all = typeof suppliers !== 'undefined' ? suppliers : [];
  const sameName = all.find(x => bcSupNorm(x.company || x.name) === bcSupNorm(company));
  if (sameName) { fail(`“${sameName.company || sameName.name}” already exists. Use it from the list.`); return; }
  const v = vat.replace(/\s/g, ''), sameVat = v && all.find(x => String(x.vat || '').replace(/\D/g, '') === v);
  if (sameVat) { fail(`VAT no. ${v} is already used by “${sameVat.company || sameVat.name}”.`); return; }
  const sim = m._sim || [], key = sim.map(x => x.id).join(',');
  if (sim.length && m._warned !== key) { m._warned = key; bcNewSupplierCheck(); document.getElementById('bns-save').innerHTML = '<i class="ti ti-plus"></i>Yes, add a new supplier'; return; }
  const sup = { id: 's' + Date.now().toString(36), company, contact: document.getElementById('bns-contact').value.trim(), phone: document.getElementById('bns-phone').value.trim(), mobile: '', email: '',
    vat: v, city: document.getElementById('bns-city').value.trim(), createdFrom: 'purchasing', createdBy: (window.currentUser && window.currentUser.name) || '', createdAt: new Date().toISOString() };
  try {
    await bcBusy('Adding supplier…', async () => { suppliers.push(sup); try { await saveSuppliers(); } catch (e) { suppliers.splice(suppliers.indexOf(sup), 1); throw e; } });
  } catch (e) { fail('The supplier could not be saved: ' + (e && e.message || e)); return; }
  if (typeof renderSuppliers === 'function') try { renderSuppliers(); } catch (e) {}
  const sel = m._sel;
  if (typeof closeModal === 'function') closeModal('bc-ns-modal'); else m.classList.remove('open');
  bcPickSetValue(sel, sup.id); setTimeout(() => bcPickFocus(sel), 0);
  if (typeof showToast === 'function') showToast(`${company} added to Suppliers and chosen`, 'success');
}
/* ═══════════════════════════════ V268.5 PRODUCT ON STOCK LINES + NEW PRODUCT (approved mockup V5_2) ═══════════════════════════════ */
const PI_PP = { i: -1, idx: 0, shown: [], q: '' };
const piProducts = () => (typeof products !== 'undefined' && Array.isArray(products) ? products : []);
const piNormName = v => String(v || '').toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, '');
function piProdListEl(){
  let el = document.getElementById('pi-prod-list');
  if (!el) { el = document.createElement('div'); el.id = 'pi-prod-list'; el.className = 'rct-pick-list pi-prod-list'; el.setAttribute('role', 'listbox'); el.hidden = true; el.addEventListener('mousedown', e => e.preventDefault()); document.body.appendChild(el); }
  return el;
}
function piCanAddProduct(){ return piSettings().newProductRight !== 'admins' || piIsAdmin(); }
function piProdOpen(i, input){
  const el = piProdListEl(); PI_PP.i = i; PI_PP.input = input; PI_PP.q = input.value;
  const words = input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const all = bcSortBy(piProducts().filter(p => { const h = [p.name, p.code, p.brand, p.model, p.category].join(' ').toLowerCase(); return words.every(w => h.includes(w)); }), p => p.name);
  PI_PP.shown = all.slice(0, 40); if (PI_PP.idx >= PI_PP.shown.length + 1) PI_PP.idx = 0;
  const C = piCore();
  const opt = (p, k) => { let last = ''; try { const ref = C ? C.lastPaidOf(piInvoices(), C.itemKeyOf({ kind: 'stock', productId: p.id, code: p.code, desc: p.name, uom: p.uom })) : null; if (ref && ref.unit > 0) last = ` · last paid ${piF(ref.unit)}${ref.refNo ? ' (' + ref.refNo + ')' : ''}`; } catch (e) {}
    return `<div class="rct-pick-opt${k === PI_PP.idx ? ' on' : ''}" role="option" data-k="${k}"><span class="rct-pick-txt"><b>${piEsc(p.name)}</b><small>${piEsc([p.code, p.uom].filter(Boolean).join(' · '))} · Product${piEsc(last)}</small></span></div>`; };
  const typed = input.value.trim(), canAdd = piCanAddProduct();
  el.innerHTML = (PI_PP.shown.length ? PI_PP.shown.map(opt).join('') : `<div class="rct-pick-empty">No product matches${typed ? ' “' + piEsc(typed) + '”' : ''}.</div>`)
    + (all.length > PI_PP.shown.length ? `<div class="rct-pick-empty">${all.length - PI_PP.shown.length} more — type more to narrow the list</div>` : '')
    + (canAdd ? `<div class="rct-pick-opt pi-np-opt${PI_PP.idx === PI_PP.shown.length ? ' on' : ''}" role="option" data-k="${PI_PP.shown.length}"><span class="pi-np-plus"><i class="ti ti-plus"></i></span><span class="rct-pick-txt"><b>New Product${typed ? ' “' + piEsc(typed) + '”…' : '…'}</b><small>Not in the list? Add it to Master Data → Products</small></span></div>`
      : '<div class="bc-pick-hint">Not in the list? Ask an administrator to add it in Master Data → Products.</div>');
  el.querySelectorAll('.rct-pick-opt').forEach(e => {
    e.addEventListener('click', () => piProdChoose(+e.dataset.k));
    e.addEventListener('mousemove', () => { const k = +e.dataset.k; if (PI_PP.idx === k) return; PI_PP.idx = k; el.querySelectorAll('.rct-pick-opt').forEach(x => x.classList.toggle('on', +x.dataset.k === k)); });
  });
  const r = input.getBoundingClientRect(), w = Math.max(r.width, 340);
  el.style.position = 'fixed'; el.style.left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) + 'px'; el.style.width = w + 'px';
  const below = window.innerHeight - r.bottom;
  if (below < 260 && r.top > below) { el.style.top = 'auto'; el.style.bottom = (window.innerHeight - r.top + 4) + 'px'; } else { el.style.bottom = 'auto'; el.style.top = (r.bottom + 4) + 'px'; }
  el.style.maxHeight = Math.max(140, Math.min(340, (below < 260 && r.top > below ? r.top : below) - 14)) + 'px';
  el.style.zIndex = '100000'; el.hidden = false; input.setAttribute('aria-expanded', 'true');
}
function piProdClose(){ const el = document.getElementById('pi-prod-list'); if (el) el.hidden = true; if (PI_PP.input) PI_PP.input.setAttribute('aria-expanded', 'false'); }
function piProdChoose(k){
  const i = PI_PP.i, typed = PI_PP.input ? PI_PP.input.value.trim() : '';
  piProdClose();
  if (k < PI_PP.shown.length) { const p = PI_PP.shown[k]; PI_PP.input = null; piSetStockItem(i, p.name, p.id); return; }
  if (piCanAddProduct()) { PI_PP.adding = true; piOpenNewProduct(i, typed); }
}
function piProdKey(i, e){
  const el = piProdListEl(), n = PI_PP.shown.length + (piCanAddProduct() ? 1 : 0);
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (el.hidden) { piProdOpen(i, e.target); return; } if (!n) return; PI_PP.idx = (PI_PP.idx + (e.key === 'ArrowDown' ? 1 : n - 1)) % n; el.querySelectorAll('.rct-pick-opt').forEach(x => x.classList.toggle('on', +x.dataset.k === PI_PP.idx)); el.querySelector(`.rct-pick-opt[data-k="${PI_PP.idx}"]`)?.scrollIntoView({ block: 'nearest' }); }
  else if (e.key === 'Enter') { if (!el.hidden && n) { e.preventDefault(); piProdChoose(PI_PP.idx); } }
  else if (e.key === 'Escape') { if (!el.hidden) { e.preventDefault(); e.stopPropagation(); piProdClose(); } }
  else PI_PP.idx = 0;
}
function piProdBlur(i, input){
  setTimeout(() => {
    if (!input.isConnected || document.activeElement === input || document.getElementById('pi-np-modal')?.classList.contains('open')) return;   // re-drawn, still typing, or adding
    piProdClose();
    const s = piState(), l = s && s.lines[i]; if (!l) return;
    const v = input.value.trim();
    if (l.productId && v === String(l.desc || '').trim()) return;
    piSetStockItem(i, v);   // an exact product name is taken; anything else stays as typed and shows the error
  }, 160);
}
window.addEventListener('resize', piProdClose);
document.addEventListener('scroll', e => { if (!e.target.closest || !e.target.closest('#pi-prod-list')) piProdClose(); }, true);

/* + New Product — short form; warns when a similar name or the same code already exists */
function piProdCategories(){
  const built = ['Electrical', 'Mechanical', 'Safety', 'Cleaning', 'Stationery', 'Tools', 'Plumbing', 'Hardware', 'Consumables', 'Food & Beverages', 'IT Hardware & Software', 'Other'];
  const custom = (typeof settings !== 'undefined' && settings && settings.customCategories) || [];
  return [...new Set([...built, ...custom, ...piProducts().map(p => p.category).filter(Boolean)])].sort((a, b) => a.localeCompare(b));
}
function piLev(a, b){ if (Math.abs(a.length - b.length) > 2) return 3; const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; }
/** Products that look the same: same code, or a name equal / contained / 1–2 letters apart (spaces and signs ignored). */
function piSimilarProducts(name, code){
  const n = piNormName(name), c = String(code || '').trim().toLowerCase();
  return piProducts().filter(p => {
    const pn = piNormName(p.name);
    if (c && String(p.code || '').trim().toLowerCase() === c) return true;
    if (!n || !pn) return false;
    return pn === n || (n.length >= 6 && (pn.includes(n) || n.includes(pn))) || (n.length >= 6 && piLev(n, pn) <= 2);
  }).slice(0, 3);
}
function piOpenNewProduct(lineIdx, typed){
  const m = document.getElementById('pi-np-modal') || Object.assign(document.createElement('div'), { id: 'pi-np-modal', className: 'modal-overlay bc-ds-overlay' });
  document.body.appendChild(m);   // in front of the invoice
  m._line = lineIdx; m._warned = '';
  const units = bcSortBy((typeof uomMaster !== 'undefined' ? uomMaster : []).filter(u => u.active), u => u.code);
  const s = piState(), l = s && s.lines[lineIdx], defUom = (l && l.uom) || 'Pcs';
  m.innerHTML = `<div class="modal pi-paym" role="dialog" aria-modal="true" aria-labelledby="pnp-title" style="--pi-w:560px">
    <div class="modal-header"><div><h2 id="pnp-title">New Product</h2><div class="so-create-subtitle">Added to Master Data → Products and used on this line</div></div><button class="close-btn" type="button" onclick="piCloseNewProduct()" aria-label="Close">✕</button></div>
    <div class="modal-body">
      <div id="pnp-dup"></div>
      <div class="pi-np-grid">
        <div class="form-group pi-np-wide"><label for="pnp-name">Product name *</label><input id="pnp-name" maxlength="200" value="${piEsc(typed || '')}" oninput="piNewProductCheck()"></div>
        <div class="form-group"><label for="pnp-code">Item code / SKU <em>Optional</em></label><input id="pnp-code" maxlength="100" placeholder="e.g. PEL7600-B" oninput="piNewProductCheck()"></div>
        <div class="form-group"><label for="pnp-cat">Category</label><select id="pnp-cat"><option value="">— Choose —</option>${piProdCategories().map(c => `<option>${piEsc(c)}</option>`).join('')}</select></div>
        <div class="form-group"><label class="bc-label-row" for="pnp-uom"><span>Unit *</span><button class="bc-label-link" type="button" onclick="openQuickUom('pnp-uom')"><i class="ti ti-plus"></i>New Unit</button></label><select id="pnp-uom">${units.map(u => `<option value="${piEsc(u.code)}"${u.code === defUom ? ' selected' : ''}>${piEsc(u.code)} — ${piEsc(u.name)}</option>`).join('')}</select></div>
        <div class="form-group"><label for="pnp-brand">Brand <em>Optional</em></label><input id="pnp-brand" maxlength="100"></div>
      </div>
      <p class="ds-note">The full product (picture, specifications, price) can be completed later in Master Data → Products.</p>
      <div class="inv-error" id="pnp-err" hidden></div>
    </div>
    <div class="modal-footer"><button class="btn btn-secondary" type="button" onclick="piCloseNewProduct()">Cancel</button><button class="btn btn-primary" type="button" id="pnp-save" onclick="piSaveNewProduct()"><i class="ti ti-plus"></i>Add product</button></div></div>`;
  const z = Math.max(0, ...[...document.querySelectorAll('.modal-overlay.open')].filter(e => e !== m).map(e => Number(getComputedStyle(e).zIndex) || 0)); m.style.zIndex = z ? String(z + 1) : '';
  if (typeof openModalWithSize === 'function') openModalWithSize('pi-np-modal'); else m.classList.add('open');
  piNewProductCheck();
  setTimeout(() => document.getElementById('pnp-name')?.focus(), 60);
}
function piCloseNewProduct(){ if (typeof closeModal === 'function') closeModal('pi-np-modal'); else document.getElementById('pi-np-modal')?.classList.remove('open'); }
function piNewProductCheck(){
  const m = document.getElementById('pi-np-modal'); if (!m) return;
  const name = document.getElementById('pnp-name').value, code = document.getElementById('pnp-code').value;
  const sim = piSimilarProducts(name, code), box = document.getElementById('pnp-dup');
  m._sim = sim;
  box.innerHTML = sim.length ? `<div class="pi-match warn pi-np-dup"><i class="ti ti-alert-triangle"></i><span><b>Did you mean ${sim.map(p => `“${piEsc(p.name)}”${p.code ? ' (' + piEsc(p.code) + ')' : ''}`).join(' or ')}?</b> It looks the same. Use it instead — or continue to add a new product.</span>${sim.map(p => `<button type="button" class="btn btn-secondary btn-sm" onclick="piUseExistingProduct('${piEsc(p.id)}')">Use ${piEsc(p.code || p.name.slice(0, 18))}</button>`).join('')}</div>` : '';
  const key = sim.map(p => p.id).join(',');
  if (key !== m._warned) m._warned = '';   // a new match must be seen again
  document.getElementById('pnp-save').innerHTML = sim.length && m._warned !== key ? '<i class="ti ti-plus"></i>Add as a new product' : '<i class="ti ti-plus"></i>Add product';
}
function piUseExistingProduct(id){
  const m = document.getElementById('pi-np-modal'), p = piProducts().find(x => x.id === id); if (!m || !p) return;
  piCloseNewProduct(); piSetStockItem(m._line, p.name, p.id);
}
async function piSaveNewProduct(){
  const m = document.getElementById('pi-np-modal'); if (!m) return;
  const err = document.getElementById('pnp-err'); err.hidden = true;
  const name = document.getElementById('pnp-name').value.trim(), code = document.getElementById('pnp-code').value.trim(), uom = document.getElementById('pnp-uom').value;
  if (!name) { err.textContent = 'Enter the product name.'; err.hidden = false; document.getElementById('pnp-name').focus(); return; }
  if (!uom) { err.textContent = 'Choose the unit.'; err.hidden = false; return; }
  if (code && piProducts().some(p => String(p.code || '').trim().toLowerCase() === code.toLowerCase())) { err.textContent = `The code ${code} is already used by another product. Use that product, or give a different code.`; err.hidden = false; return; }
  if (piProducts().some(p => String(p.name || '').trim().toLowerCase().replace(/\s+/g, ' ') === name.toLowerCase().replace(/\s+/g, ' '))) { err.textContent = `A product named “${name}” already exists. Use it from the list.`; err.hidden = false; return; }
  const sim = m._sim || [], key = sim.map(p => p.id).join(',');
  if (sim.length && m._warned !== key) { m._warned = key; piNewProductCheck(); document.getElementById('pnp-save').innerHTML = '<i class="ti ti-plus"></i>Yes, add a new product'; return; }
  if (!piCanAddProduct()) { err.textContent = 'Only administrators may add a new product (Administration → Purchase Settings).'; err.hidden = false; return; }
  const p = { id: 'p' + Date.now().toString(36), name, code, brand: document.getElementById('pnp-brand').value.trim(), model: '', category: document.getElementById('pnp-cat').value, uom, price: 0, notes: '', specs: [], image: null, imagePath: null,
    createdFrom: 'purchase-invoice', createdBy: (window.currentUser && window.currentUser.name) || '', createdAt: new Date().toISOString() };
  try {
    await bcBusy('Adding product…', async () => { products.unshift(p); try { await saveProducts(); } catch (e) { products.splice(products.indexOf(p), 1); throw e; } });
  } catch (e) { err.textContent = 'The product could not be saved: ' + (e && e.message || e); err.hidden = false; return; }
  if (typeof renderProducts === 'function') try { renderProducts(); } catch (e) {}
  piCloseNewProduct();
  piSetStockItem(m._line, p.name, p.id);
  if (typeof showToast === 'function') showToast(`${p.name} added to Products and used on this line`, 'success');
}
