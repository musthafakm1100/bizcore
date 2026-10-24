/* ═══════════════════════════════════════════════════════════════════
   BizCore V266 — Payment Receipts (approved mockups, 13 Oct 2026)
   • Sales → Payment Receipts: standard register (Receipt Monitor + filter bar), cards on a phone
   • New Receipt: customer → open invoices (oldest first) → settle in full or in part; unapplied money allowed
   • Receipt view: A4 receipt + staff panel in the shared document view (green accent); Apply, Void, Print / PDF
   • Invoices show Paid / Balance due; the Sales Order shows its receipts ("Record payment" is replaced)
   • Administration → Billing Settings → Payment receipts: Zoho payment no. mandatory / optional,
     who may record and void, deposit accounts
   Data: customerReceipts, invoicePayments, receiptZohoNumbers (js/receipt-service.mjs).
   Active only when invoices are independent documents (system/invoiceStorage = independent).
═══════════════════════════════════════════════════════════════════ */
'use strict';
let receiptsCache = [];
const invoicePaymentsCache = new Map();
let _rctListenersStarted = false;

const rctLib = () => window.BizCoreRct && window.BizCoreRct.core;
function receiptsActive(){ return !!(window.BizCoreRct && typeof invIndependentMode === 'function' && invIndependentMode()); }
const rctEsc = v => (typeof escapeHtml === 'function' ? escapeHtml(v == null ? '' : String(v)) : String(v == null ? '' : v));
const rctNum = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const rctR2 = n => Math.round((rctNum(n) + Number.EPSILON) * 100) / 100;
const rctF = v => formatNumber(rctNum(v), 2);
/* Money fields: typed as plain numbers, shown with thousands separators when the field is left (V266.2). */
const rctMoneyVal = id => { const e = document.getElementById(id); return e ? rctNum(String(e.value || '').replace(/[,\s]/g, '')) : 0; };
function rctMoneyFocus(el){ const v = String(el.value || '').replace(/[,\s]/g, ''); el.value = v; try { el.select(); } catch (e) {} }
function rctMoneyBlur(el){ const raw = String(el.value || '').replace(/[,\s]/g, ''); if (raw === '') return; const n = Number(raw); el.value = Number.isFinite(n) ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : el.value; }
const RCT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const rctShortDate = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? `${+m[3]} ${RCT_MONTHS[+m[2] - 1]}` : '—'; };
const rctToday = () => { const t = new Date(), p = n => String(n).padStart(2, '0'); return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`; };
const rctDaysUntil = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); if (!m) return null; const t = new Date(); return Math.round((new Date(+m[1], +m[2] - 1, +m[3]) - new Date(t.getFullYear(), t.getMonth(), t.getDate())) / 86400000); };
const rctSettings = () => (window.BizCoreRct ? window.BizCoreRct.settings : { zohoPaymentNo: 'mandatory', allowRecord: 'all', allowVoid: 'admin', accounts: [] });
const rctIsAdmin = () => !!(window.BizCoreRct && window.BizCoreRct.isAdministrator);
const rctCan = what => { const lvl = rctSettings()[what]; return lvl === 'all' || (lvl === 'admin' && rctIsAdmin()); };

/* ───────────── read model ───────────── */
function rctPaymentOf(invoiceId){ return invoicePaymentsCache.get(invoiceId) || null; }
function invoicePaidOf(inv){ return rctNum((rctPaymentOf(inv.id) || {}).paid); }
function invoiceBalanceOf(inv){ const C = rctLib(); return C ? C.invoiceBalance(inv, rctPaymentOf(inv.id)) : rctR2(rctNum(inv.totals && inv.totals.total) - invoicePaidOf(inv)); }
function invoicePayStatusOf(inv){ const C = rctLib(); return C ? C.invoicePaymentStatus(inv, rctPaymentOf(inv.id), rctToday()) : 'Unpaid'; }
function invoiceNetOf(inv){ const C = rctLib(); return C ? C.invoiceNet(inv) : rctNum(inv.totals && inv.totals.total); }
function rctPayPill(status){
  const cls = { Paid: 'paid', 'Partially paid': 'part', Unpaid: 'unpaid', Overdue: 'overdue', Overpaid: 'over', Credited: 'credited' }[status] || 'unpaid';
  return `<span class="rct-pay-pill ${cls}">${rctEsc(status)}</span>`;
}
function receiptPaidForSO(so){
  if (!so) return 0;
  return rctR2((typeof invoicesCache !== 'undefined' ? invoicesCache : []).filter(i => i.salesOrderId === so.id).reduce((s, i) => s + invoicePaidOf(i), 0));
}
function soHasOpenInvoices(so){
  return (typeof invoicesCache !== 'undefined' ? invoicesCache : []).some(i => i.salesOrderId === so.id && invoiceBalanceOf(i) > 0.005);
}
function receiptsForInvoice(invoiceId){ return receiptsCache.filter(r => (r.allocations || []).some(a => a.invoiceId === invoiceId)); }
function receiptsForSO(so){ return receiptsCache.filter(r => (r.allocations || []).some(a => a.salesOrderId === so.id)); }
function soReceiptCount(so){ return receiptsForSO(so).filter(r => r.status !== 'Voided').length; }
function soReceiptsHtml(so){
  const list = receiptsForSO(so).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  if (!list.length) return '<p style="font-size:12px;color:var(--gray)">No receipts yet. Use <b>New Receipt</b> to record money received against this order\'s invoices.</p>';
  return list.map(r => {
    const here = (r.allocations || []).filter(a => a.salesOrderId === so.id);
    const amt = here.reduce((s, a) => s + rctNum(a.amount), 0);
    const v = r.status === 'Voided';
    return `<div class="pay-card rct-so-card${v ? ' voided' : ''}" role="button" tabindex="0" onclick="openReceiptView('${rctEsc(r.id)}')" onkeydown="if(event.key==='Enter'){openReceiptView('${rctEsc(r.id)}')}">
      <div><span class="rct-link">${rctEsc(r.rctNo)}</span> · <span style="font-weight:600">${rctF(amt)}</span> · ${rctEsc(r.method)} · ${fmtDate(r.date)}${v ? ' <span class="rct-pay-pill credited">Voided</span>' : ''}</div>
      <div style="color:var(--gray)">${here.map(a => rctEsc(a.invNo)).join(', ')}${r.reference ? ' · ' + rctEsc(r.reference) : ''}${r.zohoPaymentNo ? ' · Zoho ' + rctEsc(r.zohoPaymentNo) : ''}</div>
    </div>`;
  }).join('');
}

/* ───────────── listeners ───────────── */
function upsertReceiptCache(r){ const i = receiptsCache.findIndex(x => x.id === r.id); if (i >= 0) receiptsCache[i] = r; else receiptsCache.push(r); }
function refreshAfterReceiptChange(){
  updateReceiptBadge();
  if (typeof getActivePage === 'function' && getActivePage() === 'receipts') renderReceiptRegister();
  if (typeof getActivePage === 'function' && getActivePage() === 'customerinvoices' && typeof renderInvoiceRegister === 'function') renderInvoiceRegister();
  if (typeof refreshAfterInvoiceChange === 'function') refreshAfterInvoiceChange();
  const m = document.getElementById('inv-view-modal');
  if (m && m.classList.contains('open') && m._docId) {
    if (m._kind === 'receipt') { const r = receiptsCache.find(x => x.id === m._docId); if (r) renderReceiptView(r); }
    else if (m._kind === 'invoice' && typeof renderInvoiceView === 'function') { const i = (invoicesCache || []).find(x => x.id === m._docId); if (i) renderInvoiceView(i, 'invoice'); }
  }
  if (isModalOpen('rct-new-modal')) renderNewReceiptInvoices(false);
}
function startReceiptListeners(){
  if (_rctListenersStarted || !window.BizCoreRct || !window.BizCoreInv) return;
  _rctListenersStarted = true;
  window.BizCoreRct.startSettingsListener();
  window.BizCoreRct.onSettingsChange(() => {
    if (document.getElementById('setup-tab-billing')?.style.display === 'block') { renderReceiptSettings(); if (typeof renderBillingSettings === 'function') renderBillingSettings(); }   // V266.4: Editing invoices is shown under Invoicing rules
    syncReceiptPageState();
  });
  window.BizCoreInv.ready.then(mode => {
    syncReceiptPageState();
    if (mode !== 'independent') return;
    window.BizCoreRct.listenReceipts(rows => { receiptsCache = rows || []; refreshAfterReceiptChange(); },
      err => showToast('Payment receipts could not be synchronised (' + (err && err.code || 'error') + '). Please reload.', 'error', 'Receipts'));
    window.BizCoreRct.listenPayments(rows => { invoicePaymentsCache.clear(); (rows || []).forEach(p => invoicePaymentsCache.set(p.invoiceId || p.id, p)); refreshAfterReceiptChange(); },
      err => showToast('Invoice payments could not be synchronised (' + (err && err.code || 'error') + '). Please reload.', 'error', 'Receipts'));
  });
}
function updateReceiptBadge(){
  const b = document.getElementById('receipts-badge'); if (!b) return;
  const n = receiptsCache.filter(r => r.status !== 'Voided' && rctNum(r.unapplied) > 0.005).length;
  b.textContent = n; b.style.display = n ? '' : 'none';
}
/** The register explains itself when receipts are not available yet; New Receipt follows the permission. */
function syncReceiptPageState(){
  const box = document.getElementById('rct-unavailable'), ws = document.getElementById('receipts-main-workspace');
  const on = receiptsActive();
  if (box) { box.hidden = on; box.innerHTML = on ? '' : '<i class="ti ti-info-circle"></i> Payment Receipts work with the new invoice storage. They become available after the administrator completes the invoice migration.'; }
  if (ws) ws.hidden = !on;
  document.querySelectorAll('.rct-new-btn,.rct-fab').forEach(b => {
    const ok = on && rctCan('allowRecord');
    b.disabled = !ok; b.title = !on ? 'Not available yet (invoice migration)' : ok ? 'Record money received' : 'Only an administrator may record receipts (Billing Settings)';
  });
}

/* ═══════════════════════════════════════════════════════════════════
   REGISTER
═══════════════════════════════════════════════════════════════════ */
let _rctKpi = 'all';
function filterReceiptKPI(k){
  if (k === 'overdue' || k === 'duesoon') { // invoice-based rows open the Invoices register
    if (typeof showPage === 'function') showPage('customerinvoices');
    if (typeof filterInvoiceKPI === 'function') filterInvoiceKPI(k === 'overdue' ? 'pay-overdue' : 'pay-duesoon');
    return;
  }
  _rctKpi = k;
  const st = document.getElementById('rctreg-status'); if (st) st.value = k === 'all' ? '' : k;
  renderReceiptRegister();
}
function setReceiptStatusFilter(v){ _rctKpi = v || 'all'; renderReceiptRegister(); }
function clearReceiptRegisterFilters(){
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
  set('rctreg-q', ''); set('rctreg-status', ''); set('rctreg-customer', ''); set('rctreg-sort', 'date-desc');
  if (window.BCDateFilter) BCDateFilter.set('rctreg', { preset: 'all' });
  _rctKpi = 'all'; renderReceiptRegister();
}
function openInvoicesSummary(){
  const list = (typeof invoicesCache !== 'undefined' ? invoicesCache : []).map(i => ({ i, bal: invoiceBalanceOf(i), days: rctDaysUntil(i.dueDate) })).filter(x => x.bal > 0.005);
  return { receivable: rctR2(list.reduce((s, x) => s + x.bal, 0)), overdue: list.filter(x => x.days !== null && x.days < 0).length, dueSoon: list.filter(x => x.days !== null && x.days >= 0 && x.days <= 7).length };
}
function renderReceiptRegister(){
  syncReceiptPageState();
  const body = document.getElementById('rctreg-body'); if (!body) return;
  const val = id => (document.getElementById(id)?.value || '');
  const q = val('rctreg-q').trim().toLowerCase(), sort = val('rctreg-sort') || 'date-desc';
  const ds = window.BCDateFilter ? BCDateFilter.get('rctreg') : { preset: 'all', from: '', to: '' };
  const from = ds.from || null, to = ds.to || null;
  const custSel = document.getElementById('rctreg-customer');
  if (custSel) { const cur = custSel.value; const names = [...new Set(receiptsCache.map(r => r.customer).filter(Boolean))].sort((a, b) => a.localeCompare(b)); custSel.innerHTML = '<option value="">All customers</option>' + names.map(n => `<option value="${rctEsc(n)}">${rctEsc(n)}</option>`).join(''); custSel.value = names.includes(cur) ? cur : ''; }
  const cust = custSel ? custSel.value : '';
  const scope = receiptsCache.filter(r => (!cust || r.customer === cust) && (!from || (r.date || '') >= from) && (!to || (r.date || '') <= to)
    && (!q || [r.rctNo, r.customer, r.reference, r.zohoPaymentNo, r.method, r.account, ...(r.allocations || []).map(a => a.invNo), ...(r.allocations || []).map(a => a.soNo)].some(v => String(v || '').toLowerCase().includes(q))));
  const posted = scope.filter(r => r.status !== 'Voided'), unapplied = posted.filter(r => rctNum(r.unapplied) > 0.005);
  const setT = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  const inv = openInvoicesSummary();
  setT('rctreg-k-total', scope.length); setT('rctreg-k-posted', posted.length); setT('rctreg-k-voided', scope.length - posted.length);
  setT('rctreg-k-unapplied', unapplied.length); setT('rctreg-k-overdue', inv.overdue); setT('rctreg-k-duesoon', inv.dueSoon);
  setT('rctreg-a-received', rctF(posted.reduce((s, r) => s + rctNum(r.amount), 0)));
  setT('rctreg-a-receivable', rctF(inv.receivable));
  setT('rctreg-a-charges', rctF(posted.reduce((s, r) => s + rctNum(r.bankCharges), 0)));
  setT('rctreg-a-unapplied', rctF(receiptsCache.filter(r => r.status !== 'Voided').reduce((s, r) => s + Math.max(0, rctNum(r.unapplied)), 0)));
  document.querySelectorAll('#page-receipts [data-rct-kpi]').forEach(e => { const on = e.dataset.rctKpi === _rctKpi; e.classList.toggle('active', on); e.setAttribute('aria-pressed', on ? 'true' : 'false'); });
  const st = document.getElementById('rctreg-status'); if (st) st.value = _rctKpi === 'all' ? '' : _rctKpi;
  let rows = scope.filter(r => _rctKpi === 'all' || (_rctKpi === 'unapplied' ? (r.status !== 'Voided' && rctNum(r.unapplied) > 0.005) : r.status === _rctKpi));
  const byNo = (a, b) => String(a.rctNo || '').localeCompare(String(b.rctNo || ''), undefined, { numeric: true });
  if (sort === 'date-asc') rows.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || byNo(a, b));
  else if (sort === 'no-asc') rows.sort(byNo);
  else if (sort === 'customer-asc') rows.sort((a, b) => String(a.customer || '').localeCompare(String(b.customer || '')));
  else if (sort === 'amount-desc') rows.sort((a, b) => rctNum(b.amount) - rctNum(a.amount));
  else rows.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || byNo(b, a));
  if (typeof sortRegisterRows === 'function') rows = sortRegisterRows(rows, 'rct', { no: r => r.rctNo, date: r => r.date, customer: r => r.customer, method: r => r.method, amount: r => rctNum(r.amount), status: r => r.status });
  setT('rctreg-count', `${rows.length} receipt${rows.length === 1 ? '' : 's'}`);
  const clear = document.getElementById('rctreg-clear');
  if (clear) { const active = !!(q || cust || ds.preset !== 'all' || sort !== 'date-desc' || _rctKpi !== 'all'); clear.disabled = !active; clear.classList.toggle('active', active); }
  const chips = r => {
    const a = r.allocations || [];
    if (r.status === 'Voided') return '<span class="rct-muted">— released —</span>';
    const shown = a.slice(0, 2).map(x => `<span class="rct-chip">${rctEsc(x.invNo)}</span>`).join('') + (a.length > 2 ? `<span class="rct-chip">+${a.length - 2}</span>` : '');
    return shown + (rctNum(r.unapplied) > 0.005 ? ` <span class="rct-pay-pill part">${rctF(r.unapplied)} unapplied</span>` : '') || '<span class="rct-muted">—</span>';
  };
  const status = r => r.status === 'Voided' ? '<span class="rct-status voided">Voided</span>' : '<span class="rct-status posted">Posted</span>';
  const open = r => `openReceiptView('${rctEsc(r.id)}')`;
  body.innerHTML = rows.length ? rows.map(r => `<tr class="quotation-clickable-row${r.status === 'Voided' ? ' rct-row-voided' : ''}" tabindex="0" role="button" data-rct="${rctEsc(r.id)}" onclick="${open(r)}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${open(r)}}">
      <td class="rct-no">${rctEsc(r.rctNo)}</td><td>${fmtDate(r.date)}</td><td>${rctEsc(r.customer || '—')}</td><td>${rctEsc(r.method || '—')}</td><td>${rctEsc(r.reference || '—')}</td><td>${rctEsc(r.zohoPaymentNo || '—')}</td>
      <td class="rct-applied">${chips(r)}</td><td class="num">${r.status === 'Voided' ? '<s>' + rctF(r.amount) + '</s>' : rctF(r.amount)}${rctNum(r.bankCharges) > 0.005 ? `<small class="rct-bc">${rctF(r.bankCharges)} bank charges</small>` : ''}</td><td>${status(r)}</td></tr>`).join('')
    : `<tr><td colspan="9"><div class="empty-state"><i class="ti ti-cash"></i><strong>No receipts found</strong><p>${receiptsCache.length ? 'Adjust the filters to see other receipts.' : 'Record money received with New Receipt.'}</p></div></td></tr>`;
  const cards = document.getElementById('rctreg-cards');
  if (cards) cards.innerHTML = rows.length ? rows.map(r => {
    const v = r.status === 'Voided', n = (r.allocations || []).length;
    const pill = v ? '<span class="rct-status voided">Voided</span>' : rctNum(r.unapplied) > 0.005 ? `<span class="rct-pay-pill part">${rctF(r.unapplied)} unapplied</span>` : '<span class="rct-status posted">Posted</span>';
    return `<article class="rct-card${v ? ' voided' : ''}" role="button" tabindex="0" onclick="${open(r)}"><div class="r1"><b>${rctEsc(r.rctNo)}</b>${pill}</div><div class="r2">${rctEsc(r.customer || '—')}</div>
      <div class="r3"><span>${rctShortDate(r.date)} · ${rctEsc(r.method)}${n ? ` · ${n} invoice${n === 1 ? '' : 's'}` : ''}</span><span class="amt">${v ? '<s>' + rctF(r.amount) + '</s>' : rctF(r.amount)}</span></div></article>`;
  }).join('') : '<div class="rct-empty">No receipts found</div>';
}

/* ═══════════════════════════════════════════════════════════════════
   NEW RECEIPT
═══════════════════════════════════════════════════════════════════ */
function ensureNewReceiptModal(){
  let m = document.getElementById('rct-new-modal');
  if (m) return m;
  m = document.createElement('div');
  m.className = 'modal-overlay'; m.id = 'rct-new-modal';
  m.innerHTML = `<div class="modal modal-normal so-create-workspace rct-workspace">
    <div class="modal-header"><div><h2 id="rn-title">New Payment Receipt</h2><div class="so-create-subtitle" id="rn-subtitle">Number assigned on save</div></div><button class="close-btn" onclick="closeModal('rct-new-modal')">✕</button></div>
    <div class="modal-body"><div class="rct-entry-grid">
      <div class="rct-entry-main">
        <section class="so-entry-card"><div class="so-entry-card-title"><i class="ti ti-user"></i>Customer &amp; payment</div>
          <div class="rct-fields">
            <div class="form-group rct-f-cust"><label for="rn-cust-q">Customer *</label><input type="hidden" id="rn-cust"/>
              <div class="rct-picker" id="rn-picker">
                <div class="rct-pick-chosen" id="rn-chosen" hidden></div>
                <div class="rct-pick-search" id="rn-pick-search"><i class="ti ti-search"></i><input id="rn-cust-q" autocomplete="off" placeholder="Search customer…" role="combobox" aria-expanded="false" aria-controls="rn-cust-list" oninput="rctPickerFilter()" onclick="rctPickerOpen()" onblur="rctPickerBlur()" onkeydown="rctPickerKey(event)"/></div>
                <div class="rct-pick-list" id="rn-cust-list" role="listbox" hidden onmousedown="event.preventDefault()"></div>
              </div></div>
            <div class="form-group rct-f-date"><label for="rn-date">Receipt date *</label><input id="rn-date" type="date" onchange="recalcNewReceipt()"/></div>
            <div class="form-group rct-f-amt"><label for="rn-amount">Amount received (SAR) *</label><input id="rn-amount" class="rct-amount-input rct-money" type="text" inputmode="decimal" autocomplete="off" placeholder="0.00" oninput="newReceiptAmountChanged()" onfocus="rctMoneyFocus(this)" onblur="rctMoneyBlur(this)"/></div>
            <div class="form-group rct-f-method"><label for="rn-method">Method *</label><select id="rn-method" onchange="recalcNewReceipt()"></select></div>
            <div class="form-group rct-f-acct"><label for="rn-account" id="rn-account-label">Deposited to (account)</label><span id="rn-account-wrap"></span></div>
            <div class="form-group rct-f-chg"><label for="rn-charges">Bank charges</label><input id="rn-charges" class="rct-money" type="text" inputmode="decimal" autocomplete="off" placeholder="0.00" oninput="recalcNewReceipt()" onfocus="rctMoneyFocus(this)" onblur="rctMoneyBlur(this)"/><div class="rct-hint" id="rn-charges-hint">Fee kept by our bank (if any)</div></div>
            <div class="form-group rct-f-ref"><label for="rn-ref">Payment reference</label><input id="rn-ref" maxlength="200" autocomplete="off" placeholder="Bank ref., cheque no.…"/></div>
            <div class="form-group rct-f-zoho"><label for="rn-zoho" id="rn-zoho-label">Zoho payment no.</label><input id="rn-zoho" maxlength="100" autocomplete="off" placeholder="e.g. PMT-00231" oninput="recalcNewReceipt()"/><div class="inv-field-msg" id="rn-zoho-msg" hidden></div></div>
            <div class="form-group rct-f-notes"><label for="rn-notes">Notes</label><input id="rn-notes" maxlength="2000" autocomplete="off" placeholder="Internal note (optional)…"/></div>
            <div class="form-group rct-f-why" id="rn-why-wrap" hidden><label for="rn-why">Reason for the change *</label><input id="rn-why" maxlength="300" autocomplete="off" placeholder="e.g. wrong invoice picked, typing mistake in the amount…" oninput="recalcNewReceipt()"/><div class="rct-hint" id="rn-edit-hint"></div></div>
          </div>
        </section>
        <section class="so-entry-card rct-inv-card">
          <div class="so-entry-card-title so-items-title"><span><i class="ti ti-file-invoice"></i><span id="rn-inv-title">Open invoices</span></span><div class="rct-inv-actions"><button type="button" class="btn btn-secondary btn-sm" id="rn-auto" onclick="newReceiptAutoApply()"><i class="ti ti-wand"></i>Auto-apply (oldest first)</button><button type="button" class="btn btn-secondary btn-sm" onclick="newReceiptClear()"><i class="ti ti-x"></i>Clear</button></div></div>
          <div class="rct-inv-head"><span></span><span>Invoice</span><span>Zoho No.</span><span>Date</span><span>Due</span><span>Sales Order</span><span class="num">Total</span><span class="num">Paid</span><span class="num">Balance due</span><span class="num">Apply now</span></div>
          <div id="rn-invoices"></div>
        </section>
      </div>
      <aside class="rct-entry-side">
        <section class="so-entry-card so-summary-card"><div class="so-entry-card-title"><i class="ti ti-calculator"></i>Receipt summary</div><div id="rn-summary"></div></section>
        <section class="so-entry-card"><div class="so-entry-card-title"><i class="ti ti-receipt"></i>Customer balance</div><div id="rn-balance"></div></section>
      </aside>
    </div>
    <div id="rn-error" class="inv-error" hidden></div></div>
    <div class="modal-footer rct-footer"><div class="rct-foot-figs" id="rn-foot-figs"></div><div class="inv-ready" id="rn-ready" aria-live="polite"></div>
      <button class="btn btn-secondary rct-cancel" onclick="closeModal('rct-new-modal')">Cancel</button>
      <button class="btn btn-success" id="rn-save" onclick="saveNewReceipt()" disabled><i class="ti ti-device-floppy"></i><span id="rn-save-text">Save Receipt</span></button>
    </div>
  </div>`;
  document.body.appendChild(m);
  return m;
}
/** Customers to choose from: those with open invoices first, then the rest of the customer master. */
function receiptCustomerOptions(){
  const C = rctLib(), map = new Map();
  (typeof invoicesCache !== 'undefined' ? invoicesCache : []).forEach(i => {
    const k = C.customerKeyOf(i); const bal = invoiceBalanceOf(i);
    const e = map.get(k) || { key: k, custId: i.custId || '', customer: i.customer || '', open: 0, due: 0, overdue: false, oldest: '' };
    if (bal > 0.005) { e.open++; e.due = rctR2(e.due + bal); if (!e.oldest || String(i.date || '') < e.oldest) e.oldest = String(i.date || ''); if (i.dueDate && i.dueDate < rctToday()) e.overdue = true; }
    map.set(k, e);
  });
  (typeof customers !== 'undefined' ? customers : []).forEach(c => {
    const name = (c.company || c.name || '').trim(); if (!name) return;
    const k = C.customerKeyOf({ custId: c.id, customer: name });
    if (!map.has(k) && !map.has(C.customerKeyOf({ customer: name }))) map.set(k, { key: k, custId: c.id || '', customer: name, open: 0, due: 0, overdue: false, oldest: '' });
  });
  return [...map.values()].sort((a, b) => (b.open > 0) - (a.open > 0) || a.customer.localeCompare(b.customer));
}
async function openNewReceipt(opts = {}){
  if (!receiptsActive()) { showToast('Payment Receipts become available after the invoice migration.', 'warning', 'Not Available'); return; }
  if (!rctCan('allowRecord')) { showToast('Only an administrator may record receipts (Administration → Billing Settings).', 'warning', 'Not Allowed'); return; }
  if (!navigator.onLine) { showToast('Receipts are saved directly to the cloud database. Please reconnect and try again.', 'error', 'Offline'); return; }
  const C = rctLib(), m = ensureNewReceiptModal();
  m._opId = 'rct-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  m._alloc = new Map(); m._touched = false; m._custKey = ''; m._edit = null;
  rctSetEditMode(m, null);
  const custs = receiptCustomerOptions(); m._custs = custs;
  // Opened from a Sales Order or an invoice: that customer, its invoices first in focus
  let pre = '';
  const inv = opts.invoiceId ? (invoicesCache || []).find(i => i.id === opts.invoiceId) : null;
  const so = opts.soId ? (salesOrders || []).find(s => s.id === opts.soId) : null;
  if (inv) pre = C.customerKeyOf(inv);
  else if (so) { const i = (invoicesCache || []).find(x => x.salesOrderId === so.id); pre = i ? C.customerKeyOf(i) : C.customerKeyOf({ custId: so.custId || so.customerId, customer: so.customer }); }
  m._focusSO = so ? so.id : (inv ? inv.salesOrderId : ''); m._focusInv = inv ? inv.id : '';
  m._returnSO = so ? so.id : (inv && isModalOpen('inv-view-modal') ? inv.salesOrderId : '');
  document.getElementById('rn-cust').value = custs.some(c => c.key === pre) ? pre : '';
  document.getElementById('rn-cust-q').value = ''; rctPickerClose();
  document.getElementById('rn-date').value = rctToday();
  document.getElementById('rn-amount').value = '';
  document.getElementById('rn-method').innerHTML = C.PAYMENT_METHODS.map(x => `<option>${rctEsc(x)}</option>`).join('');
  document.getElementById('rn-method').value = 'Bank transfer';
  const s = rctSettings();
  document.getElementById('rn-account-label').textContent = 'Deposited to (account)' + (s.accounts.length ? ' *' : '');
  document.getElementById('rn-account-wrap').innerHTML = s.accounts.length
    ? `<select id="rn-account" onchange="recalcNewReceipt()"><option value="">Choose the account…</option>${s.accounts.map(a => `<option>${rctEsc(a)}</option>`).join('')}</select>`
    : '<input id="rn-account" maxlength="60" autocomplete="off" placeholder="Bank / account (optional)" oninput="recalcNewReceipt()"/>';
  if (s.accounts.length === 1) document.getElementById('rn-account').value = s.accounts[0];
  document.getElementById('rn-zoho-label').textContent = 'Zoho payment no.' + (s.zohoPaymentNo === 'mandatory' ? ' *' : '');
  document.getElementById('rn-zoho').value = ''; document.getElementById('rn-ref').value = ''; document.getElementById('rn-charges').value = ''; document.getElementById('rn-notes').value = '';
  const x = docNumberParts('paymentReceipt');
  document.getElementById('rn-subtitle').textContent = `Number assigned on save · ${x.displayPrefix}…`;
  newReceiptCustomerChanged(true);
  openModalWithSize('rct-new-modal');
  setTimeout(() => { const f = document.getElementById(document.getElementById('rn-cust').value ? 'rn-amount' : 'rn-cust-q'); if (f && window.innerWidth > 760) f.focus(); }, 60);
}
/* ───────── customer picker (search list, approved option 1) ───────── */
const RCT_AV_COLORS = ['#2E75B6', '#0f766e', '#6f42c1', '#b45309', '#1d4ed8', '#be185d', '#047857', '#7c3aed'];
function rctInitials(name){ const w = String(name || '').replace(/[^A-Za-z0-9؀-ۿ ]/g, ' ').trim().split(/\s+/).filter(Boolean); return ((w[0] || '?')[0] + (w[1] ? w[1][0] : ((w[0] || '')[1] || ''))).toUpperCase(); }
function rctAvatar(c){
  let h = 0; for (const ch of String(c.customer || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const bg = !c.open ? '#94a3b8' : c.overdue ? '#b42318' : RCT_AV_COLORS[h % RCT_AV_COLORS.length];
  return `<span class="rct-av" style="background:${bg}">${rctEsc(rctInitials(c.customer))}</span>`;
}
function rctPickerItems(){
  const m = document.getElementById('rct-new-modal'); if (!m || !m._custs) return [];
  const q = (document.getElementById('rn-cust-q').value || '').trim().toLowerCase();
  return m._custs.filter(c => !q || c.customer.toLowerCase().includes(q));
}
function rctPickerRender(){
  const m = document.getElementById('rct-new-modal'), box = document.getElementById('rn-cust-list'); if (!m || !box) return;
  const items = rctPickerItems(); m._pickItems = items;
  if (m._pickIdx == null || m._pickIdx >= items.length) m._pickIdx = items.length ? 0 : -1;
  const open = items.filter(c => c.open), rest = items.filter(c => !c.open);
  const opt = (c, i) => `<div class="rct-pick-opt${i === m._pickIdx ? ' on' : ''}${c.open ? '' : ' quiet'}" role="option" id="rn-opt-${i}" data-key="${rctEsc(c.key)}" aria-selected="${i === m._pickIdx}" onclick="rctPickerChoose(${i})" onmousemove="rctPickerHover(${i})">
      ${rctAvatar(c)}<span class="rct-pick-txt"><b>${rctEsc(c.customer)}${c.overdue ? '<span class="rct-due overdue">overdue</span>' : ''}</b><small>${c.open ? `${c.open} open invoice${c.open === 1 ? '' : 's'} · oldest ${rctShortDate(c.oldest)}` : 'No open invoices · money kept on account'}</small></span>
      <span class="rct-pick-amt">${c.open ? rctF(c.due) : '—'}</span></div>`;
  let i = 0;
  box.innerHTML = !items.length ? '<div class="rct-pick-empty">No customer matches. Check the spelling, or add the customer in Master Data.</div>'
    : (open.length ? `<div class="rct-pick-grp"><span>With open invoices · ${open.length}</span><span>Due (SAR)</span></div>${open.map(c => opt(c, i++)).join('')}` : '')
    + (rest.length ? `<div class="rct-pick-grp"><span>Other customers · ${rest.length}</span><span></span></div>${rest.map(c => opt(c, i++)).join('')}` : '');
}
function rctPickerOpen(){
  const box = document.getElementById('rn-cust-list'); if (!box) return;
  rctPickerRender(); box.hidden = false; document.getElementById('rn-cust-q').setAttribute('aria-expanded', 'true');
  document.getElementById('rn-picker').classList.add('open');
}
function rctPickerClose(){
  const box = document.getElementById('rn-cust-list'); if (!box) return;
  box.hidden = true; document.getElementById('rn-cust-q').setAttribute('aria-expanded', 'false');
  document.getElementById('rn-picker').classList.remove('open');
}
function rctPickerBlur(){ setTimeout(() => { if (document.activeElement !== document.getElementById('rn-cust-q')) { rctPickerClose(); const m = document.getElementById('rct-new-modal'); if (m && m._custKey) rctPickerShowChosen(); } }, 150); }
function rctPickerFilter(){ const m = document.getElementById('rct-new-modal'); if (m) m._pickIdx = 0; rctPickerOpen(); }
function rctPickerHover(i){ const m = document.getElementById('rct-new-modal'); if (!m || m._pickIdx === i) return; m._pickIdx = i; document.querySelectorAll('#rn-cust-list .rct-pick-opt').forEach((e, j) => e.classList.toggle('on', j === i)); }
function rctPickerKey(e){
  const m = document.getElementById('rct-new-modal'); if (!m) return;
  const n = (m._pickItems || []).length;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault(); if (document.getElementById('rn-cust-list').hidden) { rctPickerOpen(); return; }
    m._pickIdx = n ? (m._pickIdx + (e.key === 'ArrowDown' ? 1 : -1) + n) % n : -1; rctPickerRender();
    const el = document.getElementById('rn-opt-' + m._pickIdx); if (el) el.scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter') { e.preventDefault(); if (m._pickIdx >= 0) rctPickerChoose(m._pickIdx); }
  else if (e.key === 'Escape') { if (!document.getElementById('rn-cust-list').hidden) { e.preventDefault(); e.stopPropagation(); rctPickerClose(); if (m._custKey) rctPickerShowChosen(); } }
}
function rctPickerChoose(i){
  const m = document.getElementById('rct-new-modal'); const c = (m._pickItems || [])[i]; if (!c) return;
  document.getElementById('rn-cust').value = c.key;
  rctPickerClose(); newReceiptCustomerChanged();
  setTimeout(() => { const a = document.getElementById('rn-amount'); if (a && window.innerWidth > 760) a.focus(); }, 30);
}
/** Chooses a customer by its key (used when opening from an order / invoice, and by the tests). */
function rctPickerSelectKey(key){ document.getElementById('rn-cust').value = key; rctPickerClose(); newReceiptCustomerChanged(); }
function rctPickerShowChosen(){
  const m = document.getElementById('rct-new-modal'), chosen = document.getElementById('rn-chosen'), search = document.getElementById('rn-pick-search');
  const c = (m._custs || []).find(x => x.key === m._custKey);
  if (!c) { chosen.hidden = true; search.hidden = false; return; }
  chosen.innerHTML = `${rctAvatar(c)}<span class="rct-pick-txt"><b>${rctEsc(c.customer)}${c.overdue ? '<span class="rct-due overdue">overdue</span>' : ''}</b><small>${c.open ? `${c.open} open · <b>${rctF(c.due)}</b> due` : 'No open invoices · money kept on account'}</small></span>${m._edit && !m._edit.rights.full ? '<span class="rct-pick-lock" title="Only a full edit may change the customer"><i class="ti ti-lock"></i></span>' : '<button type="button" class="rct-pick-change" id="rn-cust-change" onclick="rctPickerChange()">Change</button>'}`;
  chosen.hidden = false; search.hidden = true;
}
function rctPickerChange(){
  document.getElementById('rn-chosen').hidden = true; document.getElementById('rn-pick-search').hidden = false;
  const q = document.getElementById('rn-cust-q'); q.value = ''; q.focus(); rctPickerOpen();
}
function newReceiptCustomerChanged(initial){
  const m = document.getElementById('rct-new-modal'); if (!m) return;
  m._custKey = document.getElementById('rn-cust').value;
  rctPickerShowChosen();

  m._alloc = new Map(); m._touched = false;
  renderNewReceiptInvoices(true);
  if (!initial && rctMoneyVal('rn-amount') > 0) newReceiptAutoApply(true);
}
function newReceiptOpenList(m){
  const C = rctLib();
  if (!m._custKey) return [];
  let pays = invoicePaymentsCache;
  if (m._edit) { // editing: this receipt's own amounts count back into the balances
    pays = new Map(invoicePaymentsCache);
    (m._edit.rct.allocations || []).forEach(a => { const p = pays.get(a.invoiceId) || { paid: 0 }; pays.set(a.invoiceId, { ...p, paid: rctR2(rctNum(p.paid) - rctNum(a.amount)) }); });
  }
  const list = C.openInvoicesFor(m._custKey, typeof invoicesCache !== 'undefined' ? invoicesCache : [], pays);
  // invoices already in the allocation stay listed even if another user paid them meanwhile
  return list;
}
function renderNewReceiptInvoices(resetFocus){
  const m = document.getElementById('rct-new-modal'); if (!m) return;
  const open = newReceiptOpenList(m); m._open = open;
  const cust = (m._custs || []).find(c => c.key === m._custKey);
  const due = open.reduce((s, x) => s + x.balance, 0);
  document.getElementById('rn-inv-title').innerHTML = m._custKey ? `Open invoices — ${rctEsc(cust ? cust.customer : '')} <small>· ${open.length} open · SAR ${rctF(due)} due</small>` : 'Open invoices';
  document.getElementById('rn-auto').disabled = !open.length;
  // drop allocations of invoices that are no longer open (paid by someone else meanwhile)
  for (const id of [...m._alloc.keys()]) if (!open.some(x => x.invoice.id === id)) m._alloc.delete(id);
  const box = document.getElementById('rn-invoices');
  if (!m._custKey) { box.innerHTML = '<div class="inv-empty-row"><i class="ti ti-info-circle"></i><span>Choose the customer to see the open invoices.</span></div>'; recalcNewReceipt(); return; }
  if (!open.length) { box.innerHTML = '<div class="inv-empty-row"><i class="ti ti-info-circle"></i><span>This customer has no open invoices. You can still record the money — it is kept as unapplied (on account) and can be applied later.</span></div>'; recalcNewReceipt(); return; }
  const today = rctToday();
  box.innerHTML = open.map(x => {
    const i = x.invoice, a = m._alloc.get(i.id) || 0, d = rctDaysUntil(i.dueDate);
    const duePill = !i.dueDate ? '<span class="rct-muted">—</span>' : d < 0 ? `<span class="rct-due overdue">${-d} day${d === -1 ? '' : 's'} overdue</span>` : d <= 7 ? `<span class="rct-due soon">Due ${rctShortDate(i.dueDate)}</span>` : `<span class="rct-due later">Due ${rctShortDate(i.dueDate)}</span>`;
    const focus = (m._focusInv && m._focusInv === i.id) || (m._focusSO && m._focusSO === i.salesOrderId);
    return `<div class="rct-inv-row${a > 0 ? ' sel' : ''}${focus ? ' focus' : ''}" data-inv="${rctEsc(i.id)}">
      <label class="rct-inv-check"><input type="checkbox" ${a > 0 ? 'checked' : ''} onchange="newReceiptToggle('${rctEsc(i.id)}',this.checked)" aria-label="Apply to ${rctEsc(i.invNo)}"/></label>
      <span class="rct-inv-no"><button type="button" class="rct-link" onclick="openInvoiceView('${rctEsc(i.id)}')" title="View ${rctEsc(i.invNo)}">${rctEsc(i.invNo)}</button></span>
      <span class="rct-inv-zoho">${rctEsc(i.zohoNo || '—')}</span><span class="rct-inv-date">${rctShortDate(i.date)}</span><span class="rct-inv-due">${duePill}</span>
      <span class="rct-inv-so">${rctEsc(i.soNo || '—')}</span><span class="num rct-inv-total">${rctF(invoiceNetOf(i))}</span><span class="num rct-inv-paid">${rctF(rctNum((x.payment || {}).paid))}</span>
      <span class="num rct-inv-bal"><small>Due </small>${rctF(x.balance)}</span>
      <span class="rct-inv-apply"><input type="number" class="bc-num-input rct-apply-input" min="0" max="${x.balance.toFixed(2)}" step="0.01" inputmode="decimal" value="${a > 0 ? a.toFixed(2) : ''}" placeholder="0.00" oninput="newReceiptApplyInput('${rctEsc(i.id)}',this)" aria-label="Amount applied to ${rctEsc(i.invNo)}"/><button type="button" class="btn btn-secondary btn-sm rct-full" onclick="newReceiptFull('${rctEsc(i.id)}')" title="Settle in full">Full</button><small class="rct-left" id="rn-left-${rctEsc(i.id)}"></small></span>
    </div>`;
  }).join('');
  recalcNewReceipt();
}
function newReceiptAmountChanged(){
  const m = document.getElementById('rct-new-modal'); if (!m) return;
  if (!m._touched) newReceiptAutoApply(true); else recalcNewReceipt();
}
function newReceiptAutoApply(silent){
  const m = document.getElementById('rct-new-modal'); if (!m) return;
  const amt = rctMoneyVal('rn-amount');
  m._alloc = new Map((rctLib().autoApply(amt, m._open || [])).map(a => [a.invoiceId, a.amount]));
  if (silent !== true) m._touched = true;
  syncNewReceiptInputs(); recalcNewReceipt();
}
function newReceiptClear(){ const m = document.getElementById('rct-new-modal'); if (!m) return; m._alloc = new Map(); m._touched = true; syncNewReceiptInputs(); recalcNewReceipt(); }
function newReceiptLeft(m){ return rctR2(rctMoneyVal('rn-amount') - [...m._alloc.values()].reduce((s, v) => s + v, 0)); }
function newReceiptToggle(id, on){
  const m = document.getElementById('rct-new-modal'); if (!m) return;
  const x = (m._open || []).find(o => o.invoice.id === id); if (!x) return;
  m._touched = true;
  if (on) { const left = newReceiptLeft(m); m._alloc.set(id, rctR2(left > 0.005 ? Math.min(left, x.balance) : x.balance)); }
  else m._alloc.delete(id);
  syncNewReceiptInputs(); recalcNewReceipt();
}
function newReceiptFull(id){
  const m = document.getElementById('rct-new-modal'); if (!m) return;
  const x = (m._open || []).find(o => o.invoice.id === id); if (!x) return;
  m._touched = true; m._alloc.set(id, x.balance);
  syncNewReceiptInputs(); recalcNewReceipt();
}
function newReceiptApplyInput(id, el){
  const m = document.getElementById('rct-new-modal'); if (!m) return;
  m._touched = true;
  const v = rctR2(el.value);
  if (v > 0) m._alloc.set(id, v); else m._alloc.delete(id);
  const row = el.closest('.rct-inv-row'); if (row) { row.classList.toggle('sel', v > 0); const cb = row.querySelector('input[type=checkbox]'); if (cb) cb.checked = v > 0; }
  recalcNewReceipt();
}
function syncNewReceiptInputs(){
  const m = document.getElementById('rct-new-modal'); if (!m) return;
  document.querySelectorAll('#rn-invoices .rct-inv-row').forEach(row => {
    const a = m._alloc.get(row.dataset.inv) || 0;
    row.classList.toggle('sel', a > 0);
    const cb = row.querySelector('input[type=checkbox]'); if (cb) cb.checked = a > 0;
    const inp = row.querySelector('.rct-apply-input'); if (inp) inp.value = a > 0 ? a.toFixed(2) : '';
  });
}
function readNewReceipt(){
  const m = document.getElementById('rct-new-modal'), C = rctLib(), s = rctSettings();
  const amount = rctR2(rctMoneyVal('rn-amount'));
  const zoho = document.getElementById('rn-zoho').value.trim(), zKey = zoho ? C.zohoNoKey(zoho) : '';
  const dup = zKey ? receiptsCache.find(r => r.zohoPaymentNoKey === zKey && (!m._edit || r.id !== m._edit.rct.id)) : null;
  const account = (document.getElementById('rn-account')?.value || '').trim();
  const charges = rctR2(rctMoneyVal('rn-charges'));
  const allocations = [...m._alloc.entries()].filter(([, v]) => v > 0.005).map(([invoiceId, amount]) => ({ invoiceId, amount: rctR2(amount) }));
  const applied = rctR2(allocations.reduce((t, a) => t + a.amount, 0));
  const over = allocations.map(a => { const x = (m._open || []).find(o => o.invoice.id === a.invoiceId); return x && a.amount > x.balance + 0.005 ? x.invoice.invNo : null; }).filter(Boolean);
  const checks = [
    { ok: !!m._custKey, text: 'Choose the customer' },
    { ok: amount > 0.005, text: 'Enter the amount received' },
  ];
  const sameAsBefore = (v, k) => !!m._edit && v === (m._edit.rct[k] || '');
  if (s.accounts.length && !sameAsBefore(account, 'account')) checks.push({ ok: !!account, text: 'Choose the account' });
  if ((s.zohoPaymentNo === 'mandatory' && !sameAsBefore(zoho, 'zohoPaymentNo')) || zoho) checks.push({ ok: !!zKey && !dup, text: dup ? `Zoho payment no. (already used on ${dup.rctNo})` : 'Enter the Zoho payment no.' });
  if (over.length) checks.push({ ok: false, text: `Reduce ${over[0]} to its balance due` });
  if (applied > amount + 0.005) checks.push({ ok: false, text: 'Applied is more than the amount received' });
  if (charges < 0 || (charges > 0 && charges >= amount)) checks.push({ ok: false, text: 'Bank charges must be less than the amount received' });
  const cust = (m._custs || []).find(c => c.key === m._custKey);
  let changes = null;
  if (m._edit) {
    changes = rctEditChanges(m, { amount, charges: Math.max(0, charges), zoho, account, allocations, cust });
    checks.push({ ok: changes.length > 0, text: 'Change something' });
    checks.push({ ok: (document.getElementById('rn-why').value || '').trim().length >= 5, text: 'Reason for the change' });
  }
  return { changes, amount, charges: Math.max(0, charges), zoho, dup, account, allocations, applied, unapplied: rctR2(amount - applied), checks, errors: checks.filter(c => !c.ok).map(c => c.text), cust };
}
function recalcNewReceipt(){
  const m = document.getElementById('rct-new-modal'); if (!m || !m._custs) return;
  const r = readNewReceipt();
  const zm = document.getElementById('rn-zoho-msg');
  zm.hidden = !r.dup; zm.innerHTML = r.dup ? `<i class="ti ti-alert-circle"></i> Already used on ${rctEsc(r.dup.rctNo)}` : '';
  document.getElementById('rn-zoho').classList.toggle('rct-need', rctSettings().zohoPaymentNo === 'mandatory' && !r.zoho);
  // per-row "part · x left"
  (m._open || []).forEach(x => {
    const el = document.getElementById('rn-left-' + x.invoice.id); if (!el) return;
    const a = m._alloc.get(x.invoice.id) || 0;
    el.textContent = a > x.balance + 0.005 ? `max ${rctF(x.balance)}` : a > 0.005 && a < x.balance - 0.005 ? `part · ${rctF(x.balance - a)} left` : '';
    el.classList.toggle('bad', a > x.balance + 0.005);
  });
  const n = r.allocations.length;
  const partial = r.allocations.map(a => { const x = (m._open || []).find(o => o.invoice.id === a.invoiceId); return x && a.amount < x.balance - 0.005 ? `${x.invoice.invNo} stays <b>Partially paid</b> (${rctF(x.balance - a.amount)} due).` : null; }).filter(Boolean);
  const row = (k, v, cls = 'so-summary-row') => `<div class="${cls}"><span>${k}</span><span>${v}</span></div>`;
  const hint = document.getElementById('rn-charges-hint');
  if (hint) hint.textContent = r.charges > 0 && r.amount > r.charges ? `Reached the bank: ${rctF(r.amount - r.charges)}` : 'Fee kept by our bank (if any)';
  document.getElementById('rn-summary').innerHTML = row('Amount received', rctF(r.amount))
    + (r.charges > 0 ? row('Bank charges', `<span class="rct-warn-txt">− ${rctF(r.charges)}</span>`) + row('Reached the bank', rctF(r.amount - r.charges), 'so-summary-row rct-sum-sep') : '')
    + row(`Applied to ${n} invoice${n === 1 ? '' : 's'}`, rctF(r.applied))
    + row('Unapplied (on account)', `<span class="${r.unapplied > 0.005 ? 'rct-warn-txt' : ''}">${rctF(Math.max(0, r.unapplied))}</span>`)
    + `<div class="so-summary-total rct-total"><span>Receipt total</span><span>SAR ${rctF(r.amount)}</span></div>`
    + (partial.length ? `<div class="rct-note">${partial.join('<br>')}</div>` : '')
    + (r.unapplied > 0.005 && r.amount > 0 ? `<div class="rct-note">${rctF(r.unapplied)} is kept on the customer's account. Apply it later from the receipt.</div>` : '');
  const due = (m._open || []).reduce((s, x) => s + x.balance, 0);
  const credit = receiptsCache.filter(x => x.status !== 'Voided' && (x.custKey || rctLib().customerKeyOf(x)) === m._custKey).reduce((s, x) => s + Math.max(0, rctNum(x.unapplied)), 0);
  document.getElementById('rn-balance').innerHTML = m._custKey ? row('Open before', rctF(due)) + row('This receipt', `<span class="rct-green">− ${rctF(r.applied)}</span>`) + row('Open after', rctF(due - r.applied)) + row('Credit on account', rctF(credit + Math.max(0, r.unapplied)))
    : '<div class="rct-muted" style="font-size:12px">Choose the customer.</div>';
  document.getElementById('rn-foot-figs').innerHTML = `<span>Applied <b>${rctF(r.applied)}</b></span><span>Unapplied <b>${rctF(Math.max(0, r.unapplied))}</b></span>`;
  const save = document.getElementById('rn-save');
  save.disabled = r.errors.length > 0; save.title = r.errors[0] || '';
  document.getElementById('rn-ready').innerHTML = invReadyHtml(r.checks, m._edit ? 'Ready — check the changes, then save' : 'Ready — check the summary, then save the receipt');
  m._preview = r;
}
async function saveNewReceipt(){
  const m = document.getElementById('rct-new-modal'); if (!m) return null;
  if (m._edit) return saveEditReceipt(m);
  const r = readNewReceipt();
  if (r.errors.length) { showToast(r.errors[0], 'error', 'Check the Receipt'); return null; }
  const details = { Customer: rctEsc(r.cust ? r.cust.customer : ''), 'Receipt date': fmtDate(document.getElementById('rn-date').value), Method: rctEsc(document.getElementById('rn-method').value) };
  if (r.account) details['Deposited to'] = rctEsc(r.account);
  if (r.zoho) details['Zoho payment no.'] = '<b>' + rctEsc(r.zoho) + '</b>';
  if (r.charges > 0) details['Bank charges'] = rctF(r.charges) + ` (reached the bank: ${rctF(r.amount - r.charges)})`;
  details['Applied'] = r.allocations.length ? r.allocations.map(a => `${rctEsc(((m._open || []).find(o => o.invoice.id === a.invoiceId) || { invoice: {} }).invoice.invNo || '')} ${rctF(a.amount)}`).join('<br>') : '—';
  if (r.unapplied > 0.005) details['Unapplied (on account)'] = rctF(r.unapplied);
  details['Amount received'] = '<b>SAR ' + rctF(r.amount) + '</b>';
  const ok = await invConfirm({ icon: '💵', title: 'Save this receipt?', message: 'Please check the details. Later corrections are made with Edit (as allowed in Administration) or Void, and are recorded in the history.', details, confirmText: 'Yes, save receipt', confirmClass: 'btn-success' });
  if (!ok) return null;
  return runProtectedDocumentSave({ key: 'receipt:' + m._opId, message: 'Saving receipt…', buttonId: 'rn-save', buttonTextId: 'rn-save-text', busyText: 'Saving…',
    action: () => _saveNewReceiptCore(m), ready: x => !x || !isModalOpen('rct-new-modal') });
}
async function _saveNewReceiptCore(m){
  const r = readNewReceipt();
  if (r.errors.length) { showToast(r.errors[0], 'error', 'Check the Receipt'); return null; }
  if (!navigator.onLine) { showToast('Receipts are saved directly to the cloud database. Please reconnect and try again.', 'error', 'Offline'); return null; }
  const date = document.getElementById('rn-date').value;
  const x = docNumberParts('paymentReceipt', new Date((date || rctToday()) + 'T00:00:00'));
  const input = { operationId: m._opId, customer: r.cust.customer, custId: r.cust.custId || '', date, amount: r.amount,
    method: document.getElementById('rn-method').value, account: r.account, bankCharges: r.charges, reference: document.getElementById('rn-ref').value.trim(),
    zohoPaymentNo: r.zoho, notes: document.getElementById('rn-notes').value.trim(), allocations: r.allocations,
    numbering: { counterKey: x.counterKey, displayPrefix: x.displayPrefix, digits: x.digits, floor: x.floor } };
  try {
    const res = await window.BizCoreRct.service.createReceipt(input);
    upsertReceiptCache(res.receipt);
    // reflect the new paid amounts at once (the listener confirms them)
    (res.receipt.allocations || []).forEach(a => { const p = invoicePaymentsCache.get(a.invoiceId) || { invoiceId: a.invoiceId, paid: 0, receipts: {} }; if (!(p.receipts || {})[res.receipt.id]) invoicePaymentsCache.set(a.invoiceId, { ...p, paid: rctR2(rctNum(p.paid) + a.amount), receipts: { ...(p.receipts || {}), [res.receipt.id]: { rctNo: res.receipt.rctNo, amount: a.amount, date: res.receipt.date } } }); });
    closeModal('rct-new-modal');
    showToast(res.alreadyApplied ? `${res.receipt.rctNo} was already saved.` : `Receipt ${res.receipt.rctNo} saved`, res.alreadyApplied ? 'info' : 'success');
    refreshAfterReceiptChange();
    // Opened from a Sales Order (or one of its invoices): Back from the receipt returns to the refreshed order
    if (m._returnSO && typeof viewSO === 'function' && (salesOrders || []).some(x => x.id === m._returnSO)) viewSO(m._returnSO);
    openReceiptView(res.receipt.id);
    return res.receipt;
  } catch (e) {
    console.error('[BizCore receipt]', e);
    showValidationDialog('Receipt Not Saved', receiptErrorMessage(e), '', '');
    renderNewReceiptInvoices(false);
    return null;
  }
}
function receiptErrorMessage(e){
  const code = e && e.code || '';
  if (['over-apply', 'over-receipt', 'wrong-customer', 'duplicate-zoho-payment', 'not-permitted', 'invalid-input', 'stale-revision', 'invalid-state'].includes(code)) return e.message;
  if (code === 'permission-denied') return 'The database refused this receipt (security rules). Nothing was saved. If this keeps happening, the receipt rules may not be published yet.';
  return typeof deliveryErrorMessage === 'function' ? deliveryErrorMessage(e) : (e && e.message) || String(e);
}

/* ═══════════════════════════════════════════════════════════════════
   RECEIPT DOCUMENT (A4) AND VIEW
═══════════════════════════════════════════════════════════════════ */
const RCT_DOC_CSS = `
.inv-a4.rct-a4{--ia:#15803d;--ia-soft:#a7dcb8;--ia-tint:#f0fdf4;--ia-ink:#14532d}
.rct-a4 .rct-words{margin-top:10px;border:1px solid var(--ia-soft);border-left:3px solid var(--ia);background:var(--ia-tint);padding:7px 10px;font-size:10px;color:#1f3b2b}
.rct-a4 .rct-void{position:absolute;left:0;right:0;top:300px;text-align:center;font-size:110px;font-weight:900;letter-spacing:.12em;color:rgba(180,35,24,.13);transform:rotate(-22deg);pointer-events:none}
.rct-a4{position:relative}
.rct-a4 .rct-onacc td{color:#9a3412;font-style:italic}
.rct-a4 .dn-items th{white-space:nowrap}
.rct-a4 .rct-charges{margin-top:6px}
.rct-a4 .dn-items td{white-space:nowrap}
.rct-a4 .dn-items td[colspan]{white-space:normal}
`;
function receiptDocumentHtml(r, screenMode){
  const cp = dnCompanyProfile();
  const cv = typeof invCustomerVat === 'function' ? invCustomerVat(r.customer, r.custId) : { vat: '', nameAr: '' };
  const c = (typeof customers !== 'undefined' ? customers : []).find(x => (r.custId && x.id === r.custId) || (x.company || '').trim() === (r.customer || '').trim()) || {};
  const logo = cp.logo ? `<img src="${cp.logo}" alt="${rctEsc(cp.name)}" style="max-width:260px;max-height:78px;width:auto;height:auto;object-fit:contain">`
    : `<div style="font-size:23px;font-weight:900;color:#174b7a">${rctEsc(cp.name)}</div>${cp.nameAr ? `<div dir="rtl" style="font-size:15px;font-weight:700;color:#174b7a;margin-top:3px">${rctEsc(cp.nameAr)}</div>` : ''}`;
  const contactParts = [cp.pobox ? `P.O. Box ${rctEsc(cp.pobox)}` : '', cp.address ? rctEsc(cp.address) : '', cp.phone ? `Tel: ${rctEsc(cp.phone)}` : '', cp.email ? rctEsc(cp.email) : '', cp.website ? rctEsc(cp.website) : ''].filter(Boolean);
  const contact = contactParts.join('<br>') + (cp.vat ? `<br><b>VAT No.:</b> ${rctEsc(cp.vat)}` : '') + (cp.cr ? `<br><b>CR No.:</b> ${rctEsc(cp.cr)}` : '');
  const v = r.status === 'Voided';
  const addr = [c.address, c.city].filter(Boolean).join(', ');
  const from = `<strong>${rctEsc(r.customer)}</strong>${cv.nameAr ? `<div dir="rtl">${rctEsc(cv.nameAr)}</div>` : ''}${addr ? rctEsc(addr) + '<br>' : ''}${cv.vat ? `VAT No.: ${rctEsc(cv.vat)}` : ''}`;
  const pay = `Method: <strong style="display:inline">${rctEsc(r.method)}</strong>${r.reference ? `<br>Reference: ${rctEsc(r.reference)}` : ''}${r.account ? `<br>Deposited to: ${rctEsc(r.account)}` : ''}`;
  const refs = [['Receipt Date', fmtDate(r.date)], ['Payment Method', rctEsc(r.method)], ['Payment Reference', rctEsc(r.reference || '—')], ['Zoho Payment No.', rctEsc(r.zohoPaymentNo || '—')]];
  const rows = (r.allocations || []).map((a, i) => `<tr><td class="c">${i + 1}</td><td>${rctEsc(a.invNo)}</td><td>${fmtDate(a.invDate)}</td><td>${rctEsc(a.soNo || '—')}</td><td class="num">${rctF(a.invTotal)}</td><td class="num">${rctF(a.amount)}</td><td class="num">${rctF(Math.max(0, rctNum(a.balanceBefore) - rctNum(a.amount)))}</td></tr>`).join('')
    + (rctNum(r.unapplied) > 0.005 ? `<tr class="rct-onacc"><td class="c">${(r.allocations || []).length + 1}</td><td colspan="4">Received on account (not yet applied to an invoice)</td><td class="num">${rctF(r.unapplied)}</td><td class="num">—</td></tr>` : '')
    || '<tr><td colspan="7" style="text-align:center;color:#64748b">Received on account</td></tr>';
  const tr = (k, val, cls = '') => `<div${cls ? ` class="${cls}"` : ''}><span>${k}</span><strong>${val}</strong></div>`;
  const bc = rctNum(r.bankCharges);
  const totals = tr('Applied to invoices', rctF(r.applied)) + tr('On account', rctF(Math.max(0, rctNum(r.unapplied)))) + tr('Total received (SAR)', rctF(r.amount), 'grand');
  const charges = bc > 0.005 ? `<div class="inv-doc-totals rct-charges">${tr('Less: bank charges', '− ' + rctF(bc), 'ded')}${tr('Net deposited to bank', rctF(rctNum(r.amount) - bc))}</div>` : '';
  const notes = [r.notes ? `<p><b>Notes</b>${rctEsc(r.notes)}</p>` : '', v ? `<p><b>Voided</b>${rctEsc(r.voidReason || '')} — ${rctEsc(r.voidedBy || '')}, ${fmtDate(String(r.voidedAt || '').slice(0, 10))}</p>` : ''].filter(Boolean).join('') || '<p><b>Notes</b>—</p>';
  const chip = screenMode ? `<div class="dn-screen-status-row inv-status-row"><span class="inv-status-chip ${v ? 'credited' : 'issued'}"><i></i>${v ? 'Voided' : 'Posted'}</span></div>` : '';
  const style = typeof invDnBaseCss === 'function' ? invDnBaseCss() + INV_DOC_CSS : '';
  return `<div class="dn-a4 inv-a4 rct-a4${screenMode ? ' dn-a4-screen' : ''}"><style>${style}${RCT_DOC_CSS}</style>
  ${v ? '<div class="rct-void">VOID</div>' : ''}
  <div class="dn-head"><div>${logo}</div><div class="dn-contact">${contact || '&nbsp;'}</div><div class="dn-title-stack">${chip}<div class="dn-titlebox"><h1>PAYMENT RECEIPT<span>سند قبض</span></h1><div><small>Receipt No.</small><strong>${rctEsc(r.rctNo)}</strong></div><div><small>Date</small><strong>${fmtDate(r.date)}</strong></div></div></div></div>
  <div class="dn-subtitle">MONEY RECEIVED WITH THANKS</div>
  <div class="dn-two"><div class="dn-box"><h3>Received From</h3><div class="content">${from}</div></div><div class="dn-box"><h3>Payment Details</h3><div class="content">${pay}</div></div></div>
  <div class="dn-ref">${refs.map(([k, val]) => `<div><small>${k}</small><strong>${val}</strong></div>`).join('')}</div>
  <table class="dn-items"><thead><tr><th>#</th><th>Invoice No.</th><th>Invoice Date</th><th>Sales Order</th><th class="num">Invoice Total</th><th class="num">Amount Applied</th><th class="num">Balance After</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="inv-doc-sum"><div class="inv-doc-notes">${notes}</div><div><div class="inv-doc-totals">${totals}</div>${charges}</div></div>
  <div class="rct-words"><b>Amount in words:</b> ${rctEsc(rctLib() ? rctLib().amountInWords(r.amount) : '')}</div>
  <div class="dn-bottom"><div class="dn-sign"><h4>Received By</h4><div>Name: ${rctEsc(r.createdBy || '________________')}<br>Date: ${fmtDate(r.date)}<br>Signature: <span class="dn-line"></span></div></div><div class="dn-sign"><h4>Authorised Signature &amp; Stamp</h4><div>Name: ________________<br>Date: ________________<br>Signature: <span class="dn-line"></span></div></div><div class="dn-doc-qr-slot"></div></div>
  <div class="dn-foot"><div>${contactParts.join(' &nbsp; | &nbsp; ')}</div></div></div>`;
}
function openReceiptView(id){
  const r = receiptsCache.find(x => x.id === id);
  if (!r) { showToast('This receipt is not loaded yet. Please try again in a moment.', 'warning'); return; }
  ['view-modal', 'so-view-modal', 'dn-print-modal'].forEach(mid => { if (isModalOpen(mid)) closeModal(mid); });
  if (typeof closeDocumentSummary === 'function') closeDocumentSummary();
  renderReceiptView(r);
}
const rctViewGo = js => `closeModal('inv-view-modal');${js}`;
function renderReceiptView(r){
  const m = ensureInvoiceViewModal(), v = r.status === 'Voided';
  const kr = (k, val) => `<div class="qv-side-row"><span>${k}</span><strong>${val}</strong></div>`;
  const n = (r.allocations || []).length;
  const kpis = [{ label: 'Received', value: rctF(r.amount), tone: v ? 'muted' : 'green' }, { label: 'Applied', value: rctF(r.applied) },
    { label: 'Unapplied', value: rctF(Math.max(0, rctNum(r.unapplied))), tone: rctNum(r.unapplied) > 0.005 && !v ? 'red' : 'muted' }, { label: 'Invoices', value: String(n) }];
  const custOpen = (typeof invoicesCache !== 'undefined' ? invoicesCache : []).filter(i => rctLib().customerKeyOf(i) === (r.custKey || rctLib().customerKeyOf(r))).reduce((s, i) => s + Math.max(0, invoiceBalanceOf(i)), 0);
  const rows = kr('Status', v ? '<span class="rct-status voided">Voided</span>' : '<span class="rct-status posted">Posted</span>') + kr('Zoho payment', rctEsc(r.zohoPaymentNo || '—'))
    + (r.account ? kr('Deposited to', rctEsc(r.account)) : '')
    + (rctNum(r.bankCharges) > 0.005 ? kr('Bank charges', rctF(r.bankCharges)) + kr('Reached the bank', rctF(rctNum(r.amount) - rctNum(r.bankCharges))) : '') + kr('Recorded by', rctEsc(r.createdBy || '—')) + kr('Customer open now', rctF(custOpen))
    + (r.editCount ? kr('Revised', `${r.editCount}× · ${rctEsc(r.revisedBy || '')}`) : '')
    + (v ? kr('Void reason', rctEsc(r.voidReason || '—')) : '');
  const flow = [];
  const sos = [...new Map((r.allocations || []).filter(a => a.salesOrderId).map(a => [a.salesOrderId, a])).values()];
  sos.forEach(a => { const so = (salesOrders || []).find(s => s.id === a.salesOrderId); flow.push(so ? { label: 'Sales order', text: so.soNo, onclick: rctViewGo(`viewSO('${so.id}')`) } : { label: 'Sales order', text: a.soNo || '—' }); });
  (r.allocations || []).forEach(a => flow.push({ label: `Invoice · ${rctF(a.amount)} applied`, text: a.invNo, onclick: `openInvoiceView('${rctEsc(a.invoiceId)}')` }));
  flow.push({ label: 'Payment receipt', text: r.rctNo, state: 'current' });
  const act = [[`Receipt posted by ${r.createdBy || '—'}`, r.created || r.date]];
  if (v) act.push([`Voided by ${r.voidedBy || '—'} — ${r.voidReason || ''}`, r.voidedAt]);
  const panel = `<aside class="qv-erp-panel inv-view-panel" aria-label="Receipt information">
    <section class="qv-side-card"><div class="qv-side-head"><span><i class="ti ti-cash"></i>Receipt status</span><span class="qv-screen-only">Staff only</span></div>${bcKpiGrid(kpis)}<div class="bc-kpi-rows">${rows}</div></section>
    <section class="qv-side-card"><div class="qv-side-head"><span><i class="ti ti-route"></i>Document flow</span></div>${bcFlowChips(flow)}</section>
    <section class="qv-side-card"><div class="qv-side-head"><span><i class="ti ti-history"></i>Activity</span></div><div id="rct-activity">${bcActivityList(act)}</div></section>
  </aside>`;
  m._kind = 'receipt'; m._docId = r.id;
  const modal = m.querySelector('.modal');
  modal.classList.remove('inv-view-cn'); modal.classList.add('inv-view-rct');
  document.getElementById('inv-view-title').textContent = `${r.rctNo} — Payment Receipt`;
  document.getElementById('inv-view-body').innerHTML = `<div class="dn-view-workspace inv-view-workspace"><div class="dn-view-document">${receiptDocumentHtml(r, true)}</div>${panel}</div>`;
  const b = ['<div class="dn-view-actionbar-spacer"></div>', `<button class="btn btn-secondary" onclick="closeViewWithReturn('inv-view-modal')"><i class="ti ti-x"></i><span>Close</span></button>`];
  const er = rctEditRightsOf(r);
  if (!v && rctSettings().editReceipts !== 'none') b.push(`<button class="btn btn-secondary" id="rct-view-edit-btn" ${er.limited || er.full ? '' : `disabled title="${rctEsc(er.why)}"`} onclick="rctEditClick('${rctEsc(r.id)}')"><i class="ti ti-pencil"></i><span>Edit</span></button>`);
  if (!v && rctNum(r.unapplied) > 0.005 && rctCan('allowRecord')) b.push(`<button class="btn btn-secondary" id="rct-view-apply-btn" onclick="rctApplyClick('${rctEsc(r.id)}')"><i class="ti ti-arrows-join"></i><span>Apply ${rctF(r.unapplied)}</span></button>`);
  if (!v && rctCan('allowVoid')) b.push(`<button class="btn btn-danger" id="rct-view-void-btn" onclick="rctVoidClick('${rctEsc(r.id)}')"><i class="ti ti-ban"></i><span>Void…</span></button>`);
  b.push(`<button class="btn btn-success" id="rct-view-print-btn" onclick="printReceipt('${rctEsc(r.id)}')"><i class="ti ti-printer"></i><span>Print / PDF</span></button>`);
  document.getElementById('inv-view-actions').innerHTML = b.join('');
  if (!m.classList.contains('open')) openModalWithSize('inv-view-modal');
  // Full history (applied later …) from the event log
  if (window.BizCoreRct && window.BizCoreRct.loadEvents) window.BizCoreRct.loadEvents(r.id).then(evs => {
    if (m._docId !== r.id) return;
    const rowsA = evs.map(e => e.kind === 'posted' ? [`Receipt posted by ${e.actor || '—'}`, e.at] : e.kind === 'applied' ? [`${(e.allocations || []).map(a => a.invNo).join(', ')} applied (${rctF((e.allocations || []).reduce((s, a) => s + rctNum(a.amount), 0))}) by ${e.actor || '—'}`, e.at] : e.kind === 'voided' ? [`Voided by ${e.actor || '—'} — ${e.reason || ''}`, e.at]
      : e.kind === 'edited' ? [`Edited by ${e.actor || '—'} — ${e.reason || ''} (${(e.changes || []).map(c => c.label).join(', ')})`, e.at] : null).filter(Boolean);
    const box = document.getElementById('rct-activity'); if (box && rowsA.length) box.innerHTML = bcActivityList(rowsA);
  }).catch(() => {});
}
function printReceipt(id){
  const r = receiptsCache.find(x => x.id === id); if (!r) return;
  invPrintDocument(receiptDocumentHtml(r, false), [r.rctNo, typeof dnSafeFilePart === 'function' ? dnSafeFilePart(r.customer) : r.customer].filter(Boolean).join(' - '));
}

/* ───────────── void ───────────── */
function openVoidReceipt(id){
  const r = receiptsCache.find(x => x.id === id); if (!r) return;
  let m = document.getElementById('rct-void-modal');
  if (!m) {
    m = document.createElement('div'); m.className = 'modal-overlay'; m.id = 'rct-void-modal';
    m.innerHTML = `<div class="modal rct-small-modal"><div class="modal-header"><h2 id="rv-title">Void receipt</h2><button class="close-btn" onclick="closeModal('rct-void-modal')">✕</button></div>
      <div class="modal-body"><p id="rv-text" class="rct-void-text"></p><div class="form-group"><label for="rv-reason">Reason *</label><textarea id="rv-reason" class="inv-notes" maxlength="1000" placeholder="e.g. Cheque bounced, wrong customer selected…" oninput="document.getElementById('rv-save').disabled=this.value.trim().length<5"></textarea><div class="rct-muted" style="font-size:11px;margin-top:4px">At least 5 characters. Printed on the voided receipt.</div></div></div>
      <div class="modal-footer"><button class="btn btn-secondary" onclick="closeModal('rct-void-modal')">Go back</button><button class="btn btn-danger" id="rv-save" disabled onclick="saveVoidReceipt()"><i class="ti ti-ban"></i><span id="rv-save-text">Void receipt</span></button></div></div>`;
    document.body.appendChild(m);
  }
  m._id = id; m._rev = r.revision; m._opId = 'void-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  document.getElementById('rv-title').textContent = `Void ${r.rctNo}?`;
  document.getElementById('rv-text').innerHTML = `The receipt keeps its number and is marked <b>VOID</b>. ${(r.allocations || []).length ? `The amounts applied go back to ${r.allocations.map(a => `<b>${rctEsc(a.invNo)}</b> (${rctF(a.amount)})`).join(', ')}, which become due again.` : ''} Remember to delete or void the payment in Zoho Books as well.`;
  document.getElementById('rv-reason').value = ''; document.getElementById('rv-save').disabled = true;
  m.classList.add('open');
  setTimeout(() => document.getElementById('rv-reason').focus(), 50);
}
async function saveVoidReceipt(){
  const m = document.getElementById('rct-void-modal'); if (!m) return;
  const reason = document.getElementById('rv-reason').value.trim();
  if (reason.length < 5) return;
  return runProtectedDocumentSave({ key: 'void:' + m._opId, message: 'Voiding receipt…', buttonId: 'rv-save', buttonTextId: 'rv-save-text', busyText: 'Voiding…',
    action: async () => {
      try {
        const res = await window.BizCoreRct.service.voidReceipt({ operationId: m._opId, receiptId: m._id, reason, expectedRevision: m._rev });
        upsertReceiptCache(res.receipt);
        (res.receipt.allocations || []).forEach(a => { const p = invoicePaymentsCache.get(a.invoiceId); if (p && (p.receipts || {})[res.receipt.id]) { const rc = { ...p.receipts }; delete rc[res.receipt.id]; invoicePaymentsCache.set(a.invoiceId, { ...p, receipts: rc, paid: rctR2(rctNum(p.paid) - rctNum(a.amount)) }); } });
        closeModal('rct-void-modal');
        showToast(`${res.receipt.rctNo} voided`, 'success');
        refreshAfterReceiptChange(); renderReceiptView(res.receipt);
        return res.receipt;
      } catch (e) { console.error('[BizCore receipt void]', e); showValidationDialog('Receipt Not Voided', receiptErrorMessage(e), '', ''); return null; }
    }, ready: () => true });
}

/* ───────────── apply unapplied money ───────────── */
function openApplyReceipt(id){
  const r = receiptsCache.find(x => x.id === id); if (!r) return;
  const C = rctLib();
  let m = document.getElementById('rct-apply-modal');
  if (!m) {
    m = document.createElement('div'); m.className = 'modal-overlay'; m.id = 'rct-apply-modal';
    m.innerHTML = `<div class="modal rct-small-modal rct-apply-wide"><div class="modal-header"><div><h2 id="ra-title">Apply receipt</h2><div class="so-create-subtitle" id="ra-sub"></div></div><button class="close-btn" onclick="closeModal('rct-apply-modal')">✕</button></div>
      <div class="modal-body"><div id="ra-list"></div><div class="rct-apply-sum" id="ra-sum"></div></div>
      <div class="modal-footer"><button class="btn btn-secondary btn-sm" onclick="applyReceiptAuto()"><i class="ti ti-wand"></i>Auto-apply</button><span style="flex:1"></span><button class="btn btn-secondary" onclick="closeModal('rct-apply-modal')">Cancel</button><button class="btn btn-success" id="ra-save" disabled onclick="saveApplyReceipt()"><i class="ti ti-arrows-join"></i><span id="ra-save-text">Apply</span></button></div></div>`;
    document.body.appendChild(m);
  }
  m._id = id; m._rev = r.revision; m._opId = 'apply-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  m._avail = rctNum(r.unapplied); m._open = C.openInvoicesFor(r.custKey || C.customerKeyOf(r), invoicesCache || [], invoicePaymentsCache); m._alloc = new Map();
  document.getElementById('ra-title').textContent = `Apply ${r.rctNo}`;
  document.getElementById('ra-sub').textContent = `${r.customer} · ${rctF(m._avail)} unapplied`;
  const box = document.getElementById('ra-list');
  box.innerHTML = m._open.length ? m._open.map(x => `<div class="rct-apply-row" data-inv="${rctEsc(x.invoice.id)}"><span><b>${rctEsc(x.invoice.invNo)}</b><small>${rctShortDate(x.invoice.date)} · ${rctEsc(x.invoice.soNo || '')} · due ${rctF(x.balance)}</small></span><input type="number" class="bc-num-input" min="0" max="${x.balance.toFixed(2)}" step="0.01" inputmode="decimal" placeholder="0.00" oninput="applyReceiptInput('${rctEsc(x.invoice.id)}',this)"/></div>`).join('')
    : '<div class="inv-empty-row"><i class="ti ti-info-circle"></i><span>This customer has no open invoices at the moment.</span></div>';
  recalcApplyReceipt();
  openModalWithSize('rct-apply-modal');
}
function applyReceiptInput(id, el){ const m = document.getElementById('rct-apply-modal'); const v = rctR2(el.value); if (v > 0) m._alloc.set(id, v); else m._alloc.delete(id); recalcApplyReceipt(); }
function applyReceiptAuto(){
  const m = document.getElementById('rct-apply-modal'); if (!m) return;
  m._alloc = new Map(rctLib().autoApply(m._avail, m._open).map(a => [a.invoiceId, a.amount]));
  document.querySelectorAll('#ra-list .rct-apply-row').forEach(row => { const a = m._alloc.get(row.dataset.inv) || 0; row.querySelector('input').value = a ? a.toFixed(2) : ''; });
  recalcApplyReceipt();
}
function recalcApplyReceipt(){
  const m = document.getElementById('rct-apply-modal'); if (!m) return;
  const total = rctR2([...m._alloc.values()].reduce((s, v) => s + v, 0));
  const over = [...m._alloc.entries()].some(([id, v]) => { const x = m._open.find(o => o.invoice.id === id); return !x || v > x.balance + 0.005; });
  const bad = over || total > m._avail + 0.005 || total <= 0.005;
  document.getElementById('ra-sum').innerHTML = `<span>Applying <b>${rctF(total)}</b> of ${rctF(m._avail)}</span>${total > m._avail + 0.005 ? '<span class="rct-bad-txt">More than the unapplied amount</span>' : over ? '<span class="rct-bad-txt">More than an invoice balance</span>' : `<span>Left unapplied <b>${rctF(m._avail - total)}</b></span>`}`;
  document.getElementById('ra-save').disabled = bad;
}
async function saveApplyReceipt(){
  const m = document.getElementById('rct-apply-modal'); if (!m) return;
  const allocations = [...m._alloc.entries()].filter(([, v]) => v > 0.005).map(([invoiceId, amount]) => ({ invoiceId, amount }));
  return runProtectedDocumentSave({ key: 'apply:' + m._opId, message: 'Applying receipt…', buttonId: 'ra-save', buttonTextId: 'ra-save-text', busyText: 'Saving…',
    action: async () => {
      try {
        const res = await window.BizCoreRct.service.applyReceipt({ operationId: m._opId, receiptId: m._id, expectedRevision: m._rev, allocations });
        upsertReceiptCache(res.receipt);
        closeModal('rct-apply-modal');
        showToast(`${res.receipt.rctNo} applied`, 'success');
        refreshAfterReceiptChange(); openReceiptView(res.receipt.id);
        return res.receipt;
      } catch (e) { console.error('[BizCore receipt apply]', e); showValidationDialog('Not Applied', receiptErrorMessage(e), '', ''); return null; }
    }, ready: x => !x || !isModalOpen('rct-apply-modal') });
}

/* ═══════════════════════════════════════════════════════════════════
   ADMINISTRATION → BILLING SETTINGS → Payment receipts
═══════════════════════════════════════════════════════════════════ */
function renderReceiptSettings(){
  const box = document.getElementById('receipt-settings-body'); if (!box) return;
  const B = window.BizCoreRct;
  if (!B) { box.innerHTML = '<div style="color:var(--gray)">Not connected.</div>'; return; }
  const s = B.settings, stored = B.storedSettings, isAdmin = !!B.isAdministrator, dis = isAdmin ? '' : 'disabled';
  const sel = (id, value, opts) => `<select id="${id}" ${dis}>${opts.map(([v, l]) => `<option value="${v}" ${v === value ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  const who = [['all', 'All users'], ['admin', 'Administrators only']];
  box.innerHTML = `
    ${isAdmin ? '' : `<div style="background:#FFFBEA;border:1px solid #F0D77B;border-radius:8px;padding:10px 12px;font-size:12.5px;color:#7A5A00;margin-bottom:14px"><i class="ti ti-shield-lock" style="margin-right:6px"></i>Only an administrator can change these settings.</div>`}
    <div class="form-grid">
      <div class="form-group"><label for="rs-zoho">Zoho payment no. on receipts</label>${sel('rs-zoho', s.zohoPaymentNo, [['mandatory', 'Mandatory'], ['optional', 'Optional']])}<div style="font-size:11.5px;color:var(--gray);margin-top:4px">When given, a Zoho payment no. can be used only once, whatever this setting.</div></div>
      <div class="form-group"><label for="rs-record">Who may record receipts</label>${sel('rs-record', s.allowRecord, who)}<div style="font-size:11.5px;color:var(--gray);margin-top:4px">Also applies to applying unapplied money later.</div></div>
      <div class="form-group"><label for="rs-void">Who may void receipts</label>${sel('rs-void', s.allowVoid, who)}</div>
      <div class="form-group"><label for="rs-edit-rct">Editing receipts</label>${sel('rs-edit-rct', s.editReceipts, [['none', 'Nobody — corrections by Void only'], ['limited', 'Limited edit for all users'], ['limited-admin-full', 'Limited for all users, full for administrators'], ['full', 'Full edit for all users']])}<div style="font-size:11.5px;color:var(--gray);margin-top:4px">Limited: reference, notes, account, method, Zoho no. and the invoices applied. Full: also customer, date, amount and bank charges.</div></div>
      <div class="form-group"><label for="rs-edit-limit">Edit time limit (receipts and invoices)</label><div style="display:flex;gap:8px;align-items:center">${sel('rs-edit-limit', s.editLimit, [['month', 'Current month only'], ['days', 'Within a number of days'], ['none', 'No limit']]).replace('<select', '<select onchange="document.getElementById(\'rs-edit-days-wrap\').hidden=this.value!==\'days\'"')}<span id="rs-edit-days-wrap" ${s.editLimit === 'days' ? '' : 'hidden'}><input id="rs-edit-days" type="number" min="1" max="365" step="1" value="${s.editDays}" ${dis} style="width:80px"/> days</span></div>
        <label style="display:flex;gap:8px;align-items:center;margin-top:8px;font-weight:500;text-transform:none;letter-spacing:0"><input type="checkbox" id="rs-admin-after" ${s.adminsAfterLimit ? 'checked' : ''} ${dis}/> Administrators may still edit after the limit</label>
        <div style="font-size:11.5px;color:var(--gray);margin-top:4px">Counted from the receipt / invoice date. After the limit: Void (receipt) or credit note (invoice).</div></div>
      <div class="form-group"><label for="rs-accounts">Deposit accounts (one per line)</label><textarea id="rs-accounts" ${dis} rows="4" placeholder="e.g. SNB Current ••4410&#10;Al Rajhi ••2201&#10;Cash box">${rctEsc((s.accounts || []).join('\n'))}</textarea><div style="font-size:11.5px;color:var(--gray);margin-top:4px">When the list is filled, "Deposited to" is a mandatory choice on every receipt. Leave empty to keep it optional free text.</div></div>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px;flex-wrap:wrap">
      <div style="font-size:12px;color:var(--gray)">${stored && stored.updatedByName ? 'Last changed by ' + rctEsc(stored.updatedByName) + (stored.updatedAt && window.BizCoreLocks ? ' · ' + new Date(window.BizCoreLocks.core.toMillis(stored.updatedAt)).toLocaleString() : '') : 'Using the default values (Zoho payment no. mandatory; all users record; administrators void).'}</div>
      ${isAdmin ? '<button class="btn btn-primary" id="rs-save" onclick="saveReceiptSettings()"><i class="ti ti-device-floppy"></i>Save settings</button>' : ''}
    </div>`;
}
async function saveReceiptSettings(){
  const v = id => document.getElementById(id).value;
  const btn = document.getElementById('rs-save'); if (btn) btn.disabled = true;
  try {
    await window.BizCoreRct.saveSettings({ zohoPaymentNo: v('rs-zoho'), allowRecord: v('rs-record'), allowVoid: v('rs-void'), accounts: v('rs-accounts').split('\n'),
      editReceipts: v('rs-edit-rct'), editInvoices: window.BizCoreRct.settings.editInvoices, editLimit: v('rs-edit-limit'), editDays: parseInt(v('rs-edit-days'), 10) || 7, adminsAfterLimit: document.getElementById('rs-admin-after').checked });
    showToast('Receipt settings saved.', 'success', 'Settings Saved');
  } catch (e) { showToast(e.code === 'permission-denied' ? 'Only an administrator can change these settings (or the receipt rules are not published yet).' : e.message, 'error', 'Not Saved'); }
  finally { if (btn) btn.disabled = false; }
}
/* ═══════════════════════════════════════════════════════════════════
   V266.3 — EDIT RECEIPT (limited / full, Administration settings) + receipt lock
═══════════════════════════════════════════════════════════════════ */
const RCT_LOCK_MODALS = ['rct-new-modal', 'rct-apply-modal', 'rct-void-modal'];
/** Runs open() while this user holds the receipt lock; the lock stays with the screen that open() shows. */
async function rctWithLock(id, activity, open){
  const r = receiptsCache.find(x => x.id === id); if (!r) return false;
  if (typeof acquireDocLock !== 'function') return open();
  if (typeof beginScreenTransition === 'function') beginScreenTransition('Opening ' + r.rctNo + '…');
  try {
    const ok = await acquireDocLock('receipt', id, r.rctNo, activity);
    if (!ok) return false;
    const before = new Set(typeof openOverlayIds === 'function' ? openOverlayIds() : []);
    let res;
    try { res = await open(); } catch (e) { await releaseLock(); throw e; }
    const opened = (typeof openOverlayIds === 'function' ? openOverlayIds() : []).filter(x => RCT_LOCK_MODALS.includes(x) && !before.has(x));
    if (opened.length && typeof _activeLock !== 'undefined' && _activeLock) _activeLock.modalId = opened[opened.length - 1];
    else await releaseLock();
    return res;
  } finally { if (typeof endScreenTransition === 'function') endScreenTransition(); }
}
function rctEditRightsOf(r){ return rctLib().receiptEditRights(r, rctSettings(), rctIsAdmin(), rctToday()); }
function rctEditClick(id){ const r = receiptsCache.find(x => x.id === id); return rctWithLock(id, 'Editing ' + (r ? r.rctNo : 'the receipt'), () => openEditReceipt(id)); }
function rctApplyClick(id){ return rctWithLock(id, 'Applying unapplied money', () => openApplyReceipt(id)); }
function rctVoidClick(id){ return rctWithLock(id, 'Voiding the receipt', () => openVoidReceipt(id)); }

function rctSetEditMode(m, edit){
  const on = !!edit, full = on && edit.rights.full;
  document.getElementById('rn-why-wrap').hidden = !on;
  document.getElementById('rn-why').value = '';
  document.getElementById('rn-save-text').textContent = on ? 'Save Changes' : 'Save Receipt';
  m.querySelector('.modal').classList.toggle('rct-editing', on);
  ['rn-date', 'rn-amount', 'rn-charges'].forEach(id => { const e = document.getElementById(id); e.disabled = on && !full; e.title = on && !full ? 'Only a full edit (administrator) may change this' : ''; });
  if (on) document.getElementById('rn-edit-hint').textContent = full ? 'Full edit: every field can be changed.' : 'Limited edit: customer, date, amount and bank charges stay as they are.';
}
async function openEditReceipt(id){
  const r = receiptsCache.find(x => x.id === id); if (!r) return false;
  const rights = rctEditRightsOf(r);
  if (!rights.limited && !rights.full) { showToast(rights.why || 'This receipt cannot be edited.', 'warning', 'Not Allowed'); return false; }
  if (!navigator.onLine) { showToast('Receipts are saved directly to the cloud database. Please reconnect and try again.', 'error', 'Offline'); return false; }
  const C = rctLib(), m = ensureNewReceiptModal();
  ['view-modal', 'inv-view-modal'].forEach(mid => { if (isModalOpen(mid)) closeModal(mid); });
  m._opId = 'edit-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  m._edit = { rct: r, rights }; m._touched = true; m._focusSO = ''; m._focusInv = ''; m._returnSO = '';
  m._custs = receiptCustomerOptions();
  const key = r.custKey || C.customerKeyOf(r);
  if (!m._custs.some(c => c.key === key)) m._custs.push({ key, custId: r.custId || '', customer: r.customer, open: 0, due: 0, overdue: false, oldest: '' });
  rctSetEditMode(m, m._edit);
  document.getElementById('rn-title').textContent = 'Edit ' + r.rctNo;
  document.getElementById('rn-subtitle').textContent = `${r.customer} · ${fmtDate(r.date)} · revision ${r.revision}${r.editCount ? ' · edited ' + r.editCount + '×' : ''}`;
  document.getElementById('rn-cust').value = key; document.getElementById('rn-cust-q').value = ''; rctPickerClose();
  document.getElementById('rn-date').value = r.date;
  const money = v => rctNum(v) ? rctNum(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
  document.getElementById('rn-amount').value = money(r.amount);
  document.getElementById('rn-charges').value = money(r.bankCharges);
  document.getElementById('rn-method').innerHTML = C.PAYMENT_METHODS.map(x => `<option>${rctEsc(x)}</option>`).join('');
  document.getElementById('rn-method').value = r.method;
  const s = rctSettings(), accs = s.accounts.includes(r.account || '') || !r.account ? s.accounts : [r.account, ...s.accounts];
  document.getElementById('rn-account-label').textContent = 'Deposited to (account)' + (s.accounts.length ? ' *' : '');
  document.getElementById('rn-account-wrap').innerHTML = s.accounts.length
    ? `<select id="rn-account" onchange="recalcNewReceipt()"><option value="">Choose the account…</option>${accs.map(a => `<option>${rctEsc(a)}</option>`).join('')}</select>`
    : '<input id="rn-account" maxlength="60" autocomplete="off" placeholder="Bank / account (optional)" oninput="recalcNewReceipt()"/>';
  document.getElementById('rn-account').value = r.account || '';
  document.getElementById('rn-zoho-label').textContent = 'Zoho payment no.' + (s.zohoPaymentNo === 'mandatory' ? ' *' : '');
  document.getElementById('rn-zoho').value = r.zohoPaymentNo || ''; document.getElementById('rn-ref').value = r.reference || ''; document.getElementById('rn-notes').value = r.notes || '';
  ['rn-ref', 'rn-notes'].forEach(id => { document.getElementById(id).oninput = recalcNewReceipt; });
  m._custKey = key; rctPickerShowChosen();
  m._alloc = new Map((r.allocations || []).map(a => [a.invoiceId, rctNum(a.amount)]));
  renderNewReceiptInvoices(false);
  openModalWithSize('rct-new-modal');
  setTimeout(() => { const f = document.getElementById('rn-why'); if (f && window.innerWidth > 760) f.focus(); }, 60);
  return true;
}
/** [{ label, before, after }] between the receipt and the screen. */
function rctEditChanges(m, r){
  const o = m._edit.rct, out = [], add = (label, a, b) => { if (String(a) !== String(b)) out.push({ label, before: a === '' ? '—' : a, after: b === '' ? '—' : b }); };
  add('Customer', o.customer, r.cust ? r.cust.customer : '');
  add('Receipt date', fmtDate(o.date), fmtDate(document.getElementById('rn-date').value));
  add('Amount received', rctF(o.amount), rctF(r.amount));
  add('Bank charges', rctF(o.bankCharges || 0), rctF(r.charges));
  add('Method', o.method, document.getElementById('rn-method').value);
  add('Deposited to', o.account || '', r.account);
  add('Payment reference', o.reference || '', document.getElementById('rn-ref').value.trim());
  add('Zoho payment no.', o.zohoPaymentNo || '', r.zoho);
  add('Notes', o.notes || '', document.getElementById('rn-notes').value.trim());
  const name = id => ((invoicesCache || []).find(i => i.id === id) || (o.allocations || []).find(a => a.invoiceId === id) || {}).invNo || id;
  const fmtA = list => list.length ? list.map(a => `${name(a.invoiceId)} ${rctF(a.amount)}`).join(', ') : '—';
  add('Invoices applied', fmtA((o.allocations || []).map(a => ({ invoiceId: a.invoiceId, amount: rctR2(a.amount) })).sort((a, b) => a.invoiceId.localeCompare(b.invoiceId))), fmtA([...r.allocations].sort((a, b) => a.invoiceId.localeCompare(b.invoiceId))));
  return out;
}
async function saveEditReceipt(m){
  const r = readNewReceipt();
  if (r.errors.length) { showToast(r.errors[0], 'error', 'Check the Changes'); return null; }
  const details = {};
  r.changes.forEach(c => { details[rctEsc(c.label)] = `<span class="rct-before">${rctEsc(c.before)}</span> → <b>${rctEsc(c.after)}</b>`; });
  details['Reason'] = rctEsc(document.getElementById('rn-why').value.trim());
  const ok = await invConfirm({ icon: '✏️', title: `Save changes to ${m._edit.rct.rctNo}?`, message: 'The receipt keeps its number; the change and its reason are recorded in the history. Remember to make the same change in Zoho Books.', details, confirmText: 'Yes, save changes', confirmClass: 'btn-success' });
  if (!ok) return null;
  return runProtectedDocumentSave({ key: 'receipt-edit:' + m._opId, message: 'Saving changes…', buttonId: 'rn-save', buttonTextId: 'rn-save-text', busyText: 'Saving…',
    action: async () => {
      const x = readNewReceipt(), o = m._edit.rct;
      const changes = { reference: document.getElementById('rn-ref').value.trim(), notes: document.getElementById('rn-notes').value.trim(), method: document.getElementById('rn-method').value,
        account: x.account, zohoPaymentNo: x.zoho, allocations: x.allocations };
      if (m._edit.rights.full) Object.assign(changes, { customer: x.cust.customer, custId: x.cust.custId || '', date: document.getElementById('rn-date').value, amount: x.amount, bankCharges: x.charges });
      try {
        const res = await window.BizCoreRct.service.editReceipt({ operationId: m._opId, receiptId: o.id, expectedRevision: o.revision, reason: document.getElementById('rn-why').value.trim(), today: rctToday(), changes });
        upsertReceiptCache(res.receipt);
        closeModal('rct-new-modal');
        showToast(`${res.receipt.rctNo} updated`, 'success');
        refreshAfterReceiptChange(); openReceiptView(res.receipt.id);
        return res.receipt;
      } catch (e) { console.error('[BizCore receipt edit]', e); showValidationDialog('Changes Not Saved', receiptErrorMessage(e), '', ''); return null; }
    }, ready: v => !v || !isModalOpen('rct-new-modal') });
}

console.log('Payment receipts V266.4 ✅ (invoice edit levels under Invoicing rules · invoice edit screen · cancel and re-issue = full · receipt edit · locks)');
