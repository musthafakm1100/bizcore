/* ═══════════════════════════════════════════════════════════════════
   BizCore V264 — Customer invoices & credit notes (screens)

   Loaded BEFORE app.js (classic script; shares the global scope with app.js).
   Business rules live in js/invoice-core.mjs and are enforced again by js/invoice-service.mjs
   (one Firestore transaction) and by the security rules. These screens only collect input,
   preview the result with the same core functions, and call the service.

   Invoice storage mode (window.BizCoreInv.mode):
     legacy       invoices embedded in Sales Orders — the previous screens are used unchanged
     migrating    the administrator is migrating invoices — invoicing is paused
     independent  invoices / credit notes are their own documents (these screens)
═══════════════════════════════════════════════════════════════════ */
'use strict';

let invoicesCache = [], creditNotesCache = [];
let _invListenersStarted = false;

function invMode(){ return window.BizCoreInv ? window.BizCoreInv.mode : 'legacy'; }
function invIndependentMode(){ return invMode() === 'independent'; }
function invLib(){ return window.BizCoreInv && window.BizCoreInv.core; }
function invTypeLabel(t){ return t === 'advance' ? 'Advance invoice' : t === 'order' ? 'Order invoice (billed ahead)' : 'Delivery invoice'; }
function invTypeShort(t){ return t === 'advance' ? 'Advance' : t === 'order' ? 'Billed ahead' : 'Delivery'; }
function invTypeBadge(t){
  const c = t === 'advance' ? ['#EEF2FF','#3730A3','#C7D2FE'] : t === 'order' ? ['#FFF7ED','#9A3412','#FED7AA'] : ['#ECFDF5','#065F46','#A7F3D0'];
  return `<span style="background:${c[0]};color:${c[1]};border:1px solid ${c[2]};border-radius:10px;padding:1px 8px;font-size:10.5px;font-weight:700">${invTypeShort(t)}</span>`;
}
function invStatusBadge(s){
  if (s === 'Credited') return '<span style="background:#FEF2F2;color:#991B1B;border:1px solid #FECACA;border-radius:10px;padding:1px 8px;font-size:10.5px;font-weight:700">Credited</span>';
  if (s === 'Partially credited') return '<span style="background:#FFFBEB;color:#92400E;border:1px solid #FDE68A;border-radius:10px;padding:1px 8px;font-size:10.5px;font-weight:700">Partly credited</span>';
  return '';
}
const invMoney = n => documentMoney('customerInvoice', 'summary', Number(n) || 0);
const invEsc = v => escapeHtml(v == null ? '' : String(v));
const invNum = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/* ───────────── read model: invoices shown inside the Sales Orders ───────────── */
function invoicesForSO(soId){
  return invoicesCache.filter(i => i.salesOrderId === soId)
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.invNo || '').localeCompare(String(b.invNo || '')));
}
function creditNotesForSO(soId){
  return creditNotesCache.filter(c => c.salesOrderId === soId)
    .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.cnNo || '').localeCompare(String(b.cnNo || '')));
}
/** Called by app.js rebuildSalesOrderView(). Adds the view-only invoice projection (stripped before any save). */
function projectInvoicesIntoSalesOrders(list){
  if (!invIndependentMode() || !invLib()) return list;
  const C = invLib();
  return (list || []).map(so => ({ ...so, invoices: invoicesForSO(so.id).map(C.invoiceForDisplay), creditNotes: creditNotesForSO(so.id), _invoiceProjection: true }));
}
/** Net amount billed on an order (all invoices − all credit notes, incl. VAT). */
function soBilledTotal(so){
  const inv = (so.invoices || []).reduce((s, i) => s + invNum(i.total), 0);
  const cn = (so.creditNotes || []).reduce((s, c) => s + invNum(c.total), 0);
  return Math.round((inv - cn) * 100) / 100;
}
function upsertInvoiceCache(inv){
  if (!inv || !inv.id) return;
  const i = invoicesCache.findIndex(x => x.id === inv.id);
  if (i >= 0) { if (invNum(invoicesCache[i].revision) > invNum(inv.revision)) return; invoicesCache[i] = inv; }
  else invoicesCache = invoicesCache.concat([inv]);
}
function upsertCreditNoteCache(cn){
  if (!cn || !cn.id) return;
  if (!creditNotesCache.some(x => x.id === cn.id)) creditNotesCache = creditNotesCache.concat([cn]);
}
function refreshAfterInvoiceChange(){
  if (typeof rebuildSalesOrderView === 'function' && typeof dnIndependentMode === 'function' && dnIndependentMode()) rebuildSalesOrderView();
  if (typeof getActivePage === 'function' && getActivePage() === 'customerinvoices') renderInvoiceRegister();
  if (typeof smartRender === 'function') smartRender('salesorders', function(){ if (typeof renderSOPage === 'function') renderSOPage(); if (typeof renderDashboard === 'function') renderDashboard(); }, 'Invoices');
}

/** Started by app.js once Firebase is ready. */
function startInvoiceListeners(){
  if (_invListenersStarted || !window.BizCoreInv) return;
  _invListenersStarted = true;
  window.BizCoreInv.ready.then(mode => {
    if (mode === 'independent') {
      window.BizCoreInv.listenInvoices(rows => { invoicesCache = rows || []; refreshAfterInvoiceChange(); },
        err => showToast('Invoices could not be synchronised (' + (err && err.code || 'error') + '). Please reload.', 'error', 'Invoices'));
      window.BizCoreInv.listenCreditNotes(rows => { creditNotesCache = rows || []; refreshAfterInvoiceChange(); },
        err => showToast('Credit notes could not be synchronised (' + (err && err.code || 'error') + '). Please reload.', 'error', 'Credit Notes'));
    }
    window.BizCoreInv.onModeChange(next => {
      showToast('Invoice storage was changed by the administrator (' + next + '). BizCore will reload.', 'warning', 'Reloading');
      setTimeout(() => location.reload(), 2500);
    });
    window.BizCoreInv.onSettingsChange(() => { if (document.getElementById('setup-tab-billing')?.style.display === 'block') renderBillingSettings(); });
  });
}

/** Routing used by app.js openCreateInvoice(): 'legacy' → the previous screen; otherwise handled here. */
function invoiceModeRoute(soId){
  const m = invMode();
  if (m === 'legacy') return 'legacy';
  if (m === 'migrating') { showToast('The administrator is moving invoices to the new storage. Invoicing is paused until it completes.', 'warning', 'Invoicing Paused'); return false; }
  if (m !== 'independent') { showToast('Invoice storage could not be verified. Please reload BizCore.', 'error', 'Not Available'); return false; }
  return openIssueInvoice(soId);
}
function invoiceErrorMessage(e){
  const code = e && e.code || '';
  if (code === 'not-permitted' || code === 'over-invoice' || code === 'over-billing' || code === 'invalid-deduction' || code === 'over-credit') return e.message;
  if (code === 'permission-denied') return 'The database refused this invoice. Your editing lock may have expired, or Billing Settings do not allow it for your user. Nothing was saved — please open the order again.';
  return typeof deliveryErrorMessage === 'function' ? deliveryErrorMessage(e) : (e && e.message) || String(e);
}

/* ═══════════════════════════════════════════════════════════════════
   ISSUE INVOICE — step 1: choose the type (nothing pre-selected), step 2: details & items
   Layout follows the Create Sales Order workspace (cards, item grid, summary card).
═══════════════════════════════════════════════════════════════════ */
const INV_TYPE_INFO = {
  delivery: { icon: 'ti-truck-delivery', title: 'Delivery invoice', text: 'Bill goods the customer has accepted. Most invoices are this type.' },
  order: { icon: 'ti-file-time', title: 'Order invoice — bill ahead', text: 'Bill goods before they are delivered or accepted. A reason is required.' },
  advance: { icon: 'ti-cash', title: 'Advance invoice', text: 'Bill a down payment on the order (15% VAT). It is deducted on later invoices.' },
};
function ensureIssueInvoiceModal(){
  let m = document.getElementById('inv-issue-modal');
  if (m) return m;
  m = document.createElement('div');
  m.className = 'modal-overlay'; m.id = 'inv-issue-modal';
  m.innerHTML = `<div class="modal modal-normal so-create-workspace inv-workspace">
    <div class="modal-header"><div><h2 id="ii-title">Create Invoice</h2><div class="so-create-subtitle" id="ii-subtitle"></div></div><button class="close-btn" onclick="closeModal('inv-issue-modal')">✕</button></div>
    <div class="modal-body">
      <div class="so-flow-strip inv-steps" id="ii-steps"></div>
      <div id="ii-step-type">
        <div class="inv-step-head"><strong>What do you want to invoice?</strong><span>Choose the invoice type first. You can go back and change it before saving.</span></div>
        <div class="inv-type-grid" id="ii-types" role="radiogroup" aria-label="Invoice type"></div>
        <div class="inv-context-strip" id="ii-context"></div>
      </div>
      <div id="ii-step-form" hidden>
        <div class="so-header-grid">
          <section class="so-entry-card"><div class="so-entry-card-title"><i class="ti ti-file-invoice"></i>Invoice Details</div><div class="so-entry-fields two">
            <div class="form-group"><label>Invoice Number</label><input readonly class="so-readonly strong" value="Auto on Save"/></div>
            <div class="form-group"><label>Invoice Date *</label><input id="ii-date" type="date"/></div>
            <div class="form-group"><label>Payment Due Date</label><input id="ii-due" type="date"/></div>
            <div class="form-group"><label>Zoho Invoice No. <span class="inv-optional">Optional</span></label><input id="ii-zoho" placeholder="Enter after creating in Zoho Books"/></div>
            <div class="form-group inv-span-2" id="ii-reason-wrap"><label id="ii-reason-label">Reason</label><input id="ii-reason" maxlength="300" oninput="recalcIssueInvoice()"/></div>
          </div></section>
          <section class="so-entry-card"><div class="so-entry-card-title"><i class="ti ti-shopping-cart"></i>Order &amp; Billing</div><div class="inv-facts" id="ii-facts"></div></section>
        </div>
        <section class="so-entry-card" id="ii-advance" hidden><div class="so-entry-card-title"><i class="ti ti-cash"></i>Advance</div>
          <div class="inv-advance-row">
            <div class="form-group"><label>Calculate</label><div class="inv-segmented" role="radiogroup" aria-label="Advance calculation">
              <label><input type="radio" name="ii-adv-method" value="percentOrder" checked onchange="recalcIssueInvoice()"><span>% of order value</span></label>
              <label><input type="radio" name="ii-adv-method" value="percentLines" onchange="recalcIssueInvoice()"><span>% of selected lines</span></label>
              <label><input type="radio" name="ii-adv-method" value="full" onchange="recalcIssueInvoice()"><span>Full order value</span></label>
            </div></div>
            <div class="form-group" id="ii-adv-pct-wrap"><label>Percentage</label><div class="inv-input-suffix"><input id="ii-adv-pct" class="bc-num-input" type="number" min="0.01" max="100" step="0.01" value="50" oninput="recalcIssueInvoice()"/><span>%</span></div></div>
            <div class="inv-advance-base" id="ii-adv-base"></div>
          </div>
        </section>
        <section class="so-entry-card so-items-card">
          <div class="so-entry-card-title so-items-title"><span><i class="ti ti-list-check"></i><span id="ii-items-title">Items to Invoice</span></span><div id="ii-quick"><button type="button" class="btn btn-secondary btn-sm" onclick="issueInvoiceFill(true)"><i class="ti ti-check"></i>All available</button><button type="button" class="btn btn-secondary btn-sm" onclick="issueInvoiceFill(false)"><i class="ti ti-x"></i>Clear</button></div></div>
          <div class="so-items-help" id="ii-items-help"></div>
          <div class="inv-grid-scroll"><div class="inv-line-head" id="ii-items-head"></div><div id="ii-items"></div></div>
          <div id="ii-empty" class="inv-empty-row" hidden><i class="ti ti-info-circle"></i><span id="ii-empty-text"></span></div>
        </section>
        <div class="so-bottom-grid">
          <section class="so-entry-card"><div class="so-entry-card-title"><i class="ti ti-message"></i>Invoice Notes</div><div class="form-group"><label>Notes <span class="inv-optional">Optional</span></label><textarea id="ii-notes" class="inv-notes" placeholder="Payment terms, bank details reference, etc."></textarea></div></section>
          <section class="so-entry-card so-summary-card"><div class="so-entry-card-title"><i class="ti ti-calculator"></i>Invoice Summary</div><div id="ii-summary"></div>
            <div id="ii-deduction" hidden class="inv-deduction">
              <div class="inv-deduction-row"><label for="ii-ded">Less: advance <small id="ii-ded-mode"></small></label><div class="inv-input-prefix"><span>−</span><input id="ii-ded" class="bc-num-input" type="number" min="0" step="0.01" oninput="issueInvoiceDeductionTouched()"/></div></div>
              <div class="inv-deduction-info" id="ii-ded-info"></div>
            </div>
            <div id="ii-totals"></div>
          </section>
        </div>
        <div id="ii-error" class="inv-error" hidden></div>
      </div>
    </div>
    <div class="modal-footer"><span class="inv-footer-note" id="ii-footer-note"><i class="ti ti-hash"></i>Invoice number is assigned when you save</span>
      <button class="btn btn-secondary" id="ii-back" onclick="issueInvoiceStep(1)" hidden><i class="ti ti-arrow-left"></i>Change type</button>
      <button class="btn btn-secondary" onclick="closeModal('inv-issue-modal')">Cancel</button>
      <button class="btn btn-primary" id="ii-continue" onclick="issueInvoiceStep(2)" disabled><span>Continue</span><i class="ti ti-arrow-right"></i></button>
      <button class="btn btn-primary" id="ii-save" onclick="saveIssueInvoice()" hidden><i class="ti ti-file-invoice"></i><span id="ii-save-text">Create Invoice</span></button>
    </div>
  </div>`;
  document.body.appendChild(m);
  return m;
}

async function openIssueInvoice(soId){
  const so = salesOrders.find(x => x.id === soId); if (!so) return false;
  if (!navigator.onLine) { showToast('Invoices are saved directly to the cloud database. Please reconnect and try again.', 'error', 'Offline'); return false; }
  const C = invLib();
  let ledger;
  try { ledger = await window.BizCoreInv.getLedger(soId); }
  catch (e) { showToast('Could not read the latest order balances (' + (e.message || e) + '). Please try again.', 'error', 'Not Available'); return false; }
  const m = ensureIssueInvoiceModal();
  const settings = window.BizCoreInv.settings, isAdmin = !!window.BizCoreInv.isAdministrator;
  Object.assign(m, { _soId: soId, _ledger: ledger, _states: C.invoiceLineStates(so, ledger), _settings: settings, _opId: newDeliveryOperationId('invoice', soId), _dedTouched: false, _type: null,
    _allowed: { delivery: { ok: true, why: '' }, order: permState(settings.allowOrderInvoices, isAdmin), advance: permState(settings.allowAdvanceInvoices, isAdmin) } });
  document.getElementById('ii-title').textContent = 'Create Invoice — ' + so.soNo;
  document.getElementById('ii-subtitle').textContent = [so.customer, so.poNo ? 'Customer PO ' + so.poNo : ''].filter(Boolean).join(' · ');
  const today = new Date().toISOString().split('T')[0], due = new Date(); due.setDate(due.getDate() + 14);
  document.getElementById('ii-date').value = today; document.getElementById('ii-due').value = due.toISOString().split('T')[0];
  ['ii-zoho', 'ii-notes', 'ii-reason'].forEach(id => { document.getElementById(id).value = ''; });
  document.querySelector('input[name="ii-adv-method"][value="percentOrder"]').checked = true; document.getElementById('ii-adv-pct').value = '50';
  renderIssueInvoiceTypes();
  issueInvoiceStep(1);
  openModalWithSize('inv-issue-modal');
  return true;
}
function permState(level, isAdmin){
  if (level === 'all') return { ok: true, why: '' };
  if (level === 'admin') return isAdmin ? { ok: true, why: '' } : { ok: false, why: 'Only administrators may issue this type (Administration → Billing Settings).' };
  return { ok: false, why: 'Switched off in Administration → Billing Settings.' };
}
function issueInvoiceSnapshot(m){
  const C = invLib(), so = salesOrders.find(x => x.id === m._soId), b = C.billingOf(m._ledger), adv = C.advanceTotals(b);
  const value = C.orderValue(so), billed = C.netBilled(b);
  const r = v => Math.round(v * 100) / 100;
  const deliveryValue = r(m._states.reduce((s, x) => s + x.availableDelivery * x.up, 0));
  const orderGoods = r(m._states.reduce((s, x) => s + x.availableOrder * x.up, 0));
  return { so, value, billed, room: Math.max(0, r(value - billed)), adv, deliveryValue, deliveryLines: m._states.filter(x => x.availableDelivery > 1e-6).length, orderGoods, orderLines: m._states.filter(x => x.availableOrder > 1e-6).length };
}
function renderIssueInvoiceTypes(){
  const m = document.getElementById('inv-issue-modal'), s = issueInvoiceSnapshot(m);
  const avail = {
    delivery: s.deliveryLines ? { ok: true, line: `Ready to invoice: <b>${invMoney(s.deliveryValue)}</b> on ${s.deliveryLines} line${s.deliveryLines > 1 ? 's' : ''}` } : { ok: false, line: 'Nothing accepted is waiting to be invoiced' },
    order: s.orderLines ? { ok: true, line: `Not yet invoiced: <b>${invMoney(s.orderGoods)}</b> on ${s.orderLines} line${s.orderLines > 1 ? 's' : ''}` } : { ok: false, line: 'Every line is already invoiced' },
    advance: s.room > 0.004 ? { ok: true, line: `Still billable on this order: <b>${invMoney(s.room)}</b>` } : { ok: false, line: 'The whole order value is already billed' },
  };
  const recommended = avail.delivery.ok ? 'delivery' : null;
  document.getElementById('ii-types').innerHTML = ['delivery', 'order', 'advance'].map(t => {
    const info = INV_TYPE_INFO[t], perm = m._allowed[t], a = avail[t], enabled = perm.ok && a.ok, sel = m._type === t;
    return `<button type="button" class="inv-type-card${sel ? ' selected' : ''}" data-inv-type="${t}" role="radio" aria-checked="${sel}" ${enabled ? '' : 'disabled'} onclick="selectIssueInvoiceType('${t}')" ondblclick="selectIssueInvoiceType('${t}');issueInvoiceStep(2)">
      <span class="inv-type-check"><i class="ti ti-check"></i></span>
      <span class="inv-type-icon"><i class="ti ${info.icon}"></i></span>
      <span class="inv-type-title">${info.title}${recommended === t ? '<em>Suggested</em>' : ''}</span>
      <span class="inv-type-text">${info.text}</span>
      <span class="inv-type-meta ${a.ok ? '' : 'muted'}">${a.line}</span>
      ${perm.ok ? '' : `<span class="inv-type-lock"><i class="ti ti-lock"></i>${invEsc(perm.why)}</span>`}
    </button>`;
  }).join('');
  document.getElementById('ii-context').innerHTML = `<span>Order value <b>${invMoney(s.value)}</b></span><span>Billed so far <b>${invMoney(s.billed)}</b></span><span>Advance remaining <b>${invMoney(s.adv.remaining)}</b></span><span class="muted">Amounts before VAT</span>`;
  document.getElementById('ii-continue').disabled = !m._type;
}
function selectIssueInvoiceType(t){
  const m = document.getElementById('inv-issue-modal');
  const card = document.querySelector(`#ii-types [data-inv-type="${t}"]`); if (!card || card.disabled) return;
  m._type = t; renderIssueInvoiceTypes();
}
/** Kept for compatibility: choose a type and go straight to the form. */
function setIssueInvoiceType(t){ selectIssueInvoiceType(t); issueInvoiceStep(2); }
function issueInvoiceStep(n){
  const m = document.getElementById('inv-issue-modal');
  if (n === 2 && !m._type) return;
  const two = n === 2;
  document.getElementById('ii-step-type').hidden = two; document.getElementById('ii-step-form').hidden = !two;
  document.getElementById('ii-continue').hidden = two; document.getElementById('ii-save').hidden = !two; document.getElementById('ii-back').hidden = !two;
  document.getElementById('ii-footer-note').style.visibility = two ? 'visible' : 'hidden';
  document.getElementById('ii-steps').innerHTML = two
    ? `<span class="done">1 Invoice type ✓</span><i class="ti ti-arrow-right"></i><span class="active">2 Details &amp; amounts</span><span class="inv-type-chip"><i class="ti ${INV_TYPE_INFO[m._type].icon}"></i>${INV_TYPE_INFO[m._type].title}<button type="button" onclick="issueInvoiceStep(1)">Change</button></span>`
    : `<span class="active">1 Invoice type</span><i class="ti ti-arrow-right"></i><span>2 Details &amp; amounts</span>`;
  if (two) { m._dedTouched = false; renderIssueInvoiceLines(); recalcIssueInvoice(); }
  else renderIssueInvoiceTypes();
}
function issueInvoiceFacts(m){
  const s = issueInvoiceSnapshot(m);
  const f = (k, v) => `<div><span>${k}</span><strong>${v}</strong></div>`;
  document.getElementById('ii-facts').innerHTML = f('Sales Order', invEsc(s.so.soNo)) + f('Customer', invEsc(s.so.customer || '—')) + f('Customer PO', invEsc(s.so.poNo || '—'))
    + f('Order value (ex-VAT)', invMoney(s.value)) + f('Billed so far (ex-VAT)', invMoney(s.billed)) + f('Advance remaining', invMoney(s.adv.remaining));
}
function renderIssueInvoiceLines(){
  const m = document.getElementById('inv-issue-modal'), t = m._type;
  const adv = t === 'advance';
  issueInvoiceFacts(m);
  document.getElementById('ii-advance').hidden = !adv;
  const reasonLabel = { order: 'Reason for billing ahead *', advance: 'Description', delivery: 'Description' }[t];
  document.getElementById('ii-reason-label').innerHTML = reasonLabel + (t === 'order' ? '' : ' <span class="inv-optional">Optional</span>');
  document.getElementById('ii-reason').placeholder = t === 'order' ? 'e.g. customer request, budget closing' : t === 'advance' ? 'e.g. Advance payment as per PO terms' : 'Optional description shown on the invoice';
  document.getElementById('ii-quick').hidden = adv;
  const card = document.getElementById('ii-items-help').closest('.so-items-card'); if (card) card.hidden = false;
  document.getElementById('ii-items-title').textContent = adv ? 'Order Lines' : 'Items to Invoice';
  document.getElementById('ii-items-help').textContent = adv ? 'For "% of selected lines", tick the lines the advance is for.'
    : t === 'delivery' ? 'Only quantities the customer has accepted can be invoiced. Available = accepted − already invoiced.'
    : 'Bill ahead of delivery. Available = ordered − already invoiced.';
  const rows = m._states.filter(s => adv || (t === 'delivery' ? s.availableDelivery : s.availableOrder) > 1e-6);
  m._rows = rows;
  const grid = document.getElementById('ii-items-head').parentElement;
  grid.className = 'inv-grid-scroll ' + (adv ? 'inv-grid-advance' : 'inv-grid-goods');
  if (adv) {
    document.getElementById('ii-items-head').innerHTML = '<span></span><span>Select lines for the advance</span><span class="num">Ordered</span><span>UOM</span><span class="num">Unit Price</span><span class="num">Line Value</span>';
    document.getElementById('ii-items').innerHTML = rows.map((s, i) => `<label class="inv-line-row"><span><input type="checkbox" id="ii-sel-${i}" onchange="recalcIssueInvoice()"></span><span class="desc">${invEsc(s.line.desc || '—')}</span><span class="num">${formatQuantity(s.ordered)}</span><span class="muted">${invEsc(s.line.uom || '—')}</span><span class="num">${documentMoney('customerInvoice', 'unitPrice', s.up)}</span><span class="num strong">${documentMoney('customerInvoice', 'lineAmount', s.ordered * s.up)}</span></label>`).join('');
  } else {
    document.getElementById('ii-items-head').innerHTML = '<span>#</span><span>Item / Description</span><span class="num">Ordered</span><span class="num">Accepted</span><span class="num">Invoiced</span><span class="num">Available</span><span class="num">Invoice Qty</span><span>UOM</span><span class="num">Unit Price</span><span class="num">Amount</span>';
    document.getElementById('ii-items').innerHTML = rows.map((s, i) => {
      const avail = t === 'delivery' ? s.availableDelivery : s.availableOrder;
      return `<div class="inv-line-row"><span class="muted">${i + 1}</span><span class="desc">${invEsc(s.line.desc || '—')}</span><span class="num muted">${formatQuantity(s.ordered)}</span><span class="num">${formatQuantity(s.accepted)}</span><span class="num">${formatQuantity(s.invoiced)}${s.invoicedAhead > 0 ? `<small class="inv-ahead">${formatQuantity(s.invoicedAhead)} ahead</small>` : ''}</span><span class="num inv-avail">${formatQuantity(avail)}</span><span><input class="bc-num-input" id="ii-qty-${i}" type="number" min="0" max="${avail}" step="${qtyStep(s.line.uom)}" value="${t === 'delivery' ? avail : 0}" oninput="recalcIssueInvoice()" aria-label="Invoice quantity"></span><span class="muted">${invEsc(s.line.uom || '—')}</span><span class="num">${documentMoney('customerInvoice', 'unitPrice', s.up)}</span><span class="num strong" id="ii-amt-${i}">—</span></div>`;
    }).join('');
  }
  const empty = !rows.length;
  document.getElementById('ii-empty').hidden = !empty;
  document.getElementById('ii-empty-text').textContent = t === 'delivery' ? 'No customer-accepted quantity is waiting to be invoiced.' : 'Everything on this order has already been invoiced.';
  grid.hidden = empty;
}
function issueInvoiceFill(all){
  const m = document.getElementById('inv-issue-modal');
  (m._rows || []).forEach((s, i) => { const e = document.getElementById('ii-qty-' + i); if (e) e.value = all ? (m._type === 'delivery' ? s.availableDelivery : s.availableOrder) : 0; });
  m._dedTouched = false; recalcIssueInvoice();
}
function issueInvoiceDeductionTouched(){ const m = document.getElementById('inv-issue-modal'); m._dedTouched = true; recalcIssueInvoice(); }
const issueAdvanceMethod = () => (document.querySelector('input[name="ii-adv-method"]:checked') || {}).value || 'percentOrder';

/** Builds the service input from the screen and previews it with the same core rules. */
function readIssueInvoice(){
  const m = document.getElementById('inv-issue-modal'), C = invLib(), so = salesOrders.find(x => x.id === m._soId);
  const out = { type: m._type, errors: [] };
  if (m._type === 'advance') {
    const method = issueAdvanceMethod();
    const lineIds = (m._rows || []).filter((s, i) => document.getElementById('ii-sel-' + i)?.checked).map(s => s.lineId);
    out.advance = { method, percent: Number(document.getElementById('ii-adv-pct').value), lineIds };
    try { out.priced = C.priceAdvance(so, m._ledger, out.advance); }
    catch (e) { out.errors.push(e.message); }
    return out;
  }
  const lines = [];
  (m._rows || []).forEach((s, i) => {
    const e = document.getElementById('ii-qty-' + i); if (!e) return;
    const limit = m._type === 'delivery' ? s.availableDelivery : s.availableOrder;
    let q = roundQtyForUom(e.value, s.line.uom); q = Math.max(0, Math.min(limit, q));
    if (Number(e.value) !== q && e.value !== '') e.value = q;
    e.classList.toggle('has-value', q > 0);
    const amt = document.getElementById('ii-amt-' + i); if (amt) amt.textContent = documentMoney('customerInvoice', 'lineAmount', q * s.up);
    if (q > 0) lines.push({ lineId: s.lineId, qty: q });
  });
  out.lines = lines;
  if (!lines.length) { out.errors.push('Enter at least one invoice quantity.'); return out; }
  try {
    const g = C.priceGoodsLines(so, m._ledger, m._type, lines);
    const limits = C.deductionLimits(so, m._ledger, g.goodsSubtotal, g.addQty, m._settings.deductionMethod);
    out.goods = g; out.limits = limits;
    const dedEl = document.getElementById('ii-ded');
    let ded = limits.proposal;
    if (!limits.forced && m._dedTouched && dedEl.value !== '') ded = Number(dedEl.value);
    out.deduction = Math.round((Number(ded) || 0) * 100) / 100;
    try { C.checkDeduction(limits, out.deduction, m._settings.deductionMethod); }
    catch (e) { out.errors.push(e.message); }
  } catch (e) { out.errors.push(e.message); }
  if (m._type === 'order' && document.getElementById('ii-reason').value.trim().length < 3) out.errors.push('Enter the reason for billing ahead of delivery.');
  return out;
}
function recalcIssueInvoice(){
  const m = document.getElementById('inv-issue-modal'); if (!m || !m._soId || !m._type || document.getElementById('ii-step-form').hidden) return;
  const so = salesOrders.find(x => x.id === m._soId); const C = invLib();
  const r = readIssueInvoice();
  const adv = C.advanceTotals(C.billingOf(m._ledger));
  const row = (k, v, cls = 'so-summary-row') => `<div class="${cls}"><span>${k}</span><span>${v}</span></div>`;
  if (r.type === 'advance') {
    const method = issueAdvanceMethod();
    document.getElementById('ii-adv-pct-wrap').hidden = method === 'full';
    const linesCard = document.getElementById('ii-items-help').closest('.so-items-card'); if (linesCard) linesCard.hidden = method !== 'percentLines';
    const s = issueInvoiceSnapshot(m);
    document.getElementById('ii-adv-base').innerHTML = `Order value <b>${invMoney(s.value)}</b><br>Still billable <b>${invMoney(s.room)}</b>${adv.invoiced ? `<br>Advances so far <b>${invMoney(adv.net)}</b>` : ''}`;
  }
  // Deduction (inside the summary card)
  const showDed = r.type !== 'advance' && adv.remaining > 0.004;
  document.getElementById('ii-deduction').hidden = !showDed;
  if (showDed) {
    const modeLabel = { 'auto-editable': 'proposed — you may change it', 'auto-fixed': 'automatic', manual: 'enter the amount' }[m._settings.deductionMethod] || '';
    const el = document.getElementById('ii-ded');
    if (r.limits) {
      el.readOnly = r.limits.forced;
      document.getElementById('ii-ded-mode').textContent = r.limits.isFinal ? 'final invoice — whole remaining advance' : modeLabel;
      if (r.limits.forced || !m._dedTouched) el.value = r.limits.proposal.toFixed(2);
      el.min = r.limits.min; el.max = r.limits.max;
      const advList = Object.values(C.billingOf(m._ledger).advances).filter(a => invNum(a.subtotal) - invNum(a.credited) - invNum(a.deducted) > 0.004).map(a => `${invEsc(a.invNo)} dated ${fmtDate(a.date)}`).join(', ');
      document.getElementById('ii-ded-info').innerHTML = r.limits.isFinal
        ? `<i class="ti ti-info-circle"></i> This invoice completes the order, so the whole remaining advance (${formatNumber(adv.remaining, 2)}) is deducted. From ${advList}.`
        : `<i class="ti ti-info-circle"></i> Advance remaining ${formatNumber(adv.remaining, 2)} · allowed ${formatNumber(r.limits.min, 2)} – ${formatNumber(r.limits.max, 2)}. From ${advList}.`;
    } else { el.readOnly = true; el.value = ''; document.getElementById('ii-ded-mode').textContent = ''; document.getElementById('ii-ded-info').innerHTML = `<i class="ti ti-info-circle"></i> Advance remaining ${formatNumber(adv.remaining, 2)} — enter quantities to see the deduction.`; }
  }
  const vatPct = Math.round((Number(so.vatRate) >= 0 ? Number(so.vatRate) : 0.15) * 100);
  let top = '', totals = '';
  if (r.type === 'advance') {
    const p = r.priced;
    top = row(p ? `Advance (${formatNumber(p.percent, 2)}% of ${invMoney(p.base)})` : 'Advance', invMoney(p ? p.amount : 0), 'so-summary-row muted');
    totals = '<div class="so-summary-divider"></div>' + row('Subtotal', invMoney(p ? p.amount : 0)) + row(`VAT (${p ? Math.round(p.vatRate * 100) : vatPct}%)`, invMoney(p ? p.vat : 0))
      + `<div class="so-summary-total"><span>TOTAL</span><span>${documentMoney('customerInvoice', 'grandTotal', p ? p.amount + p.vat : 0)}</span></div>`;
  } else {
    const goods = r.goods ? r.goods.goodsSubtotal : 0, goodsVat = r.goods ? r.goods.goodsVat : 0;
    const ded = r.limits ? (Number(r.deduction) || 0) : 0, dedVat = Math.round(ded * vatPct) / 100;
    const sub = Math.round((goods - ded) * 100) / 100, vat = Math.round((goodsVat - dedVat) * 100) / 100;
    top = row('Goods (ex-VAT)', invMoney(goods), 'so-summary-row muted');
    totals = '<div class="so-summary-divider"></div>' + row('Subtotal', invMoney(sub)) + row(`VAT (${vatPct}%)`, invMoney(vat))
      + `<div class="so-summary-total"><span>TOTAL</span><span>${documentMoney('customerInvoice', 'grandTotal', sub + vat)}</span></div>`;
  }
  document.getElementById('ii-summary').innerHTML = top;
  document.getElementById('ii-totals').innerHTML = totals;
  const err = document.getElementById('ii-error');
  const show = r.errors.filter(x => !/at least one invoice quantity|reason for billing ahead/i.test(x));
  err.hidden = !show.length; err.innerHTML = show.map(x => '<i class="ti ti-alert-circle"></i> ' + invEsc(x)).join('<br>');
  document.getElementById('ii-save').disabled = r.errors.length > 0;
  document.getElementById('ii-save-text').textContent = r.type === 'advance' ? 'Create Advance Invoice' : r.type === 'order' ? 'Create Order Invoice' : 'Create Delivery Invoice';
  m._preview = r;
}
async function saveIssueInvoice(){
  const m = document.getElementById('inv-issue-modal'); if (!m || !m._soId || !m._type) return null;
  return runProtectedDocumentSave({
    key: 'invoice:' + m._opId, message: 'Saving invoice…', buttonId: 'ii-save', buttonTextId: 'ii-save-text', busyText: 'Saving…',
    action: () => _saveIssueInvoiceCore(m), ready: r => !r || !isModalOpen('inv-issue-modal'),
  });
}
async function _saveIssueInvoiceCore(m){
  const so = salesOrders.find(x => x.id === m._soId); if (!so) return null;
  const date = document.getElementById('ii-date').value;
  if (!date) { showToast('Please enter the invoice date', 'error'); return null; }
  const r = readIssueInvoice();
  if (r.errors.length) { showToast(r.errors[0], 'error', 'Check the Invoice'); return null; }
  if (!navigator.onLine) { showToast('Invoices are saved directly to the cloud database. Please reconnect and try again.', 'error', 'Offline'); return null; }
  const x = docNumberParts('customerInvoice', new Date(date + 'T00:00:00'));
  const input = {
    operationId: m._opId, salesOrderId: so.id, type: r.type, date, dueDate: document.getElementById('ii-due').value || '',
    zohoNo: document.getElementById('ii-zoho').value.trim(), notes: document.getElementById('ii-notes').value.trim(),
    reason: document.getElementById('ii-reason').value.trim(), numbering: { counterKey: x.counterKey, displayPrefix: x.displayPrefix },
  };
  if (r.type === 'advance') input.advance = r.advance; else { input.lines = r.lines; if (r.limits && r.limits.remaining > 0.004) input.deduction = r.deduction; }
  try {
    const res = await window.BizCoreInv.service.issueInvoice(input);
    upsertInvoiceCache(res.invoice); refreshAfterInvoiceChange();
    closeModal('inv-issue-modal');
    showToast(res.alreadyApplied ? `${res.invoice.invNo} was already saved.` : `${invTypeShort(res.invoice.type)} invoice ${res.invoice.invNo} created`, res.alreadyApplied ? 'info' : 'success');
    if (typeof renderSOPage === 'function') renderSOPage();
    if (typeof viewSO === 'function') viewSO(so.id);
    return res.invoice;
  } catch (e) {
    console.error('[BizCore invoice]', e);
    showValidationDialog('Invoice Not Saved', invoiceErrorMessage(e), '', '');
    try { m._ledger = await window.BizCoreInv.getLedger(so.id); m._states = invLib().invoiceLineStates(so, m._ledger); renderIssueInvoiceLines(); recalcIssueInvoice(); } catch (_) {}
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════════
   CREDIT NOTE
═══════════════════════════════════════════════════════════════════ */
function ensureCreditNoteModal(){
  let m = document.getElementById('cn-issue-modal');
  if (m) return m;
  m = document.createElement('div');
  m.className = 'modal-overlay'; m.id = 'cn-issue-modal';
  m.innerHTML = `<div class="modal modal-normal so-create-workspace inv-workspace">
    <div class="modal-header"><div><h2 id="cn-title">Credit Note</h2><div class="so-create-subtitle" id="cn-subtitle"></div></div><button class="close-btn" onclick="closeModal('cn-issue-modal')">✕</button></div>
    <div class="modal-body">
      <div class="so-header-grid">
        <section class="so-entry-card"><div class="so-entry-card-title"><i class="ti ti-receipt-refund"></i>Credit Note Details</div><div class="so-entry-fields two">
          <div class="form-group"><label>Credit Note Number</label><input readonly class="so-readonly strong" value="Auto on Save"/></div>
          <div class="form-group"><label>Credit Note Date *</label><input id="cn-date" type="date"/></div>
          <div class="form-group inv-span-2"><label>Reason *</label><input id="cn-reason" maxlength="300" placeholder="e.g. goods returned, price correction, order cancelled" oninput="recalcCreditNote()"/></div>
        </div></section>
        <section class="so-entry-card"><div class="so-entry-card-title"><i class="ti ti-file-invoice"></i>Original Invoice</div><div class="inv-facts" id="cn-facts"></div></section>
      </div>
      <section class="so-entry-card so-items-card" id="cn-lines-wrap">
        <div class="so-entry-card-title so-items-title"><span><i class="ti ti-list-check"></i>Quantities to Credit</span><div><button type="button" class="btn btn-secondary btn-sm" onclick="creditNoteFill(true)"><i class="ti ti-check"></i>Credit all</button><button type="button" class="btn btn-secondary btn-sm" onclick="creditNoteFill(false)"><i class="ti ti-x"></i>Clear</button></div></div>
        <div class="so-items-help">At most the quantity still on the invoice can be credited.</div>
        <div class="inv-grid-scroll inv-grid-credit"><div class="inv-line-head"><span>#</span><span>Item / Description</span><span class="num">Invoiced</span><span class="num">Credited</span><span class="num">Can Credit</span><span class="num">Credit Qty</span><span>UOM</span><span class="num">Unit Price</span><span class="num">Amount</span></div><div id="cn-lines"></div></div>
      </section>
      <section class="so-entry-card" id="cn-amount-wrap" hidden><div class="so-entry-card-title"><i class="ti ti-cash"></i>Advance to Credit</div>
        <div class="inv-advance-row"><div class="form-group"><label>Amount (before VAT)</label><div class="inv-input-prefix"><span>SAR</span><input id="cn-amount" class="bc-num-input" type="number" min="0" step="0.01" oninput="recalcCreditNote()"/></div></div><div class="inv-advance-base" id="cn-amount-help"></div></div>
      </section>
      <div class="so-bottom-grid">
        <section class="so-entry-card"><div class="so-entry-card-title"><i class="ti ti-info-circle"></i>Good to know</div><div class="inv-note-text" id="cn-note"></div></section>
        <section class="so-entry-card so-summary-card"><div class="so-entry-card-title"><i class="ti ti-calculator"></i>Credit Note Summary</div><div id="cn-summary"></div></section>
      </div>
      <div id="cn-error" class="inv-error" hidden></div>
    </div>
    <div class="modal-footer"><span class="inv-footer-note"><i class="ti ti-hash"></i>Credit note number is assigned when you save</span>
      <button class="btn btn-secondary" onclick="closeModal('cn-issue-modal')">Cancel</button>
      <button class="btn btn-danger" id="cn-save" onclick="saveCreditNote()"><i class="ti ti-receipt-refund"></i><span id="cn-save-text">Issue Credit Note</span></button>
    </div>
  </div>`;
  document.body.appendChild(m);
  return m;
}
async function openIssueCreditNote(soId, invoiceId){
  if (!invIndependentMode()) return false;
  const inv = invoicesCache.find(i => i.id === invoiceId); if (!inv) { showToast('Invoice not found', 'error'); return false; }
  const settings = window.BizCoreInv.settings, isAdmin = !!window.BizCoreInv.isAdministrator;
  const p = permState(settings.allowCreditNotes, isAdmin);
  if (!p.ok) { showToast('Only an administrator may issue credit notes (Administration → Billing Settings).', 'warning', 'Not Allowed'); return false; }
  if (inv.status === 'Credited') { showToast(inv.invNo + ' is already fully credited.', 'info'); return false; }
  if (!navigator.onLine) { showToast('Credit notes are saved directly to the cloud database. Please reconnect and try again.', 'error', 'Offline'); return false; }
  let ledger;
  try { ledger = await window.BizCoreInv.getLedger(soId); } catch (e) { showToast('Could not read the latest order balances. Please try again.', 'error'); return false; }
  const C = invLib(), m = ensureCreditNoteModal();
  Object.assign(m, { _soId: soId, _invoiceId: invoiceId, _invoice: inv, _ledger: ledger, _opId: newDeliveryOperationId('credit', soId) });
  document.getElementById('cn-title').textContent = 'Credit Note — ' + inv.invNo;
  document.getElementById('cn-subtitle').textContent = `${invTypeLabel(inv.type)} · ${inv.customer || ''} · ${inv.soNo || ''}`;
  document.getElementById('cn-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('cn-reason').value = '';
  const credited = (inv.creditNotes || []).reduce((s, c) => s + invNum(c.total), 0);
  const f = (k, v) => `<div><span>${k}</span><strong>${v}</strong></div>`;
  document.getElementById('cn-facts').innerHTML = f('Invoice', `${invEsc(inv.invNo)} ${invTypeBadge(inv.type)}`) + f('Invoice date', fmtDate(inv.date)) + f('Sales Order', invEsc(inv.soNo))
    + f('Invoice total', invMoney(inv.totals.total)) + f('Already credited', invMoney(credited)) + f('Status', invStatusBadge(inv.status) || 'Issued');
  const isAdv = inv.type === 'advance';
  document.getElementById('cn-lines-wrap').hidden = isAdv;
  document.getElementById('cn-amount-wrap').hidden = !isAdv;
  if (isAdv) {
    const a = C.billingOf(ledger).advances[inv.id] || {};
    const undeducted = Math.max(0, Math.round((invNum(a.subtotal) - invNum(a.credited) - invNum(a.deducted)) * 100) / 100);
    m._maxAdvance = undeducted;
    document.getElementById('cn-amount').value = undeducted.toFixed(2);
    document.getElementById('cn-amount-help').innerHTML = `Advance <b>${formatNumber(invNum(a.subtotal), 2)}</b><br>Deducted on later invoices <b>${formatNumber(invNum(a.deducted), 2)}</b><br>Already credited <b>${formatNumber(invNum(a.credited), 2)}</b><br>Can be credited <b>${formatNumber(undeducted, 2)}</b>`;
    document.getElementById('cn-note').textContent = 'Only the part of an advance that has not been deducted on later invoices can be credited.';
  } else {
    m._lines = C.creditableOf(inv).lines.filter(l => l.creditable > 1e-6);
    document.getElementById('cn-lines').innerHTML = m._lines.map((l, i) => `<div class="inv-line-row"><span class="muted">${i + 1}</span><span class="desc">${invEsc(l.desc || '—')}</span><span class="num muted">${formatQuantity(l.qty)}</span><span class="num">${formatQuantity(l.qty - l.creditable)}</span><span class="num inv-avail">${formatQuantity(l.creditable)}</span><span><input class="bc-num-input" id="cn-qty-${i}" type="number" min="0" max="${l.creditable}" step="${qtyStep(l.uom)}" value="0" oninput="recalcCreditNote()" aria-label="Credit quantity"></span><span class="muted">${invEsc(l.uom || '—')}</span><span class="num">${documentMoney('customerInvoice', 'unitPrice', l.up)}</span><span class="num strong" id="cn-amt-${i}">—</span></div>`).join('');
    document.getElementById('cn-note').textContent = (inv.totals?.deductionSubtotal > 0 ? 'The advance deducted on this invoice is given back in proportion to the goods credited, so it can be deducted again later. ' : '')
      + (inv.type === 'delivery' ? 'A credit note does not change the delivery records; record returns on the Delivery Note if goods come back.' : 'The credited quantity can be invoiced again later.');
  }
  openModalWithSize('cn-issue-modal');
  recalcCreditNote();
  return true;
}
function creditNoteFill(all){
  const m = document.getElementById('cn-issue-modal');
  (m._lines || []).forEach((l, i) => { const e = document.getElementById('cn-qty-' + i); if (e) e.value = all ? l.creditable : 0; });
  recalcCreditNote();
}
function readCreditNote(){
  const m = document.getElementById('cn-issue-modal'), C = invLib(), inv = m._invoice;
  const out = { errors: [] };
  if (inv.type === 'advance') out.amount = Math.round(invNum(document.getElementById('cn-amount').value) * 100) / 100;
  else {
    out.lines = [];
    (m._lines || []).forEach((l, i) => {
      const e = document.getElementById('cn-qty-' + i); if (!e) return;
      let q = roundQtyForUom(e.value, l.uom); q = Math.max(0, Math.min(l.creditable, q));
      e.classList.toggle('has-value', q > 0);
      const amt = document.getElementById('cn-amt-' + i); if (amt) amt.textContent = documentMoney('customerInvoice', 'lineAmount', q * l.up);
      if (q > 0) out.lines.push({ lineId: l.lineId, qty: q });
    });
    if (!out.lines.length) out.errors.push('Enter at least one quantity to credit.');
  }
  if (!out.errors.length) {
    try { out.built = C.buildCreditNote(inv, m._ledger, inv.type === 'advance' ? { amount: out.amount } : { lines: out.lines }); }
    catch (e) { out.errors.push(e.message); }
  }
  if (document.getElementById('cn-reason').value.trim().length < 3) out.errors.push('Enter the reason for the credit note.');
  return out;
}
function recalcCreditNote(){
  const m = document.getElementById('cn-issue-modal'); if (!m || !m._invoice) return;
  const r = readCreditNote();
  const n = r.built && r.built.note;
  const rev = n ? n.deductionReversal.reduce((s, d) => s + d.subtotal, 0) : 0;
  const row = (k, v, cls = 'so-summary-row') => `<div class="${cls}"><span>${k}</span><span>${v}</span></div>`;
  let html;
  if (n && n.kind === 'goods') html = row('Goods credited (ex-VAT)', invMoney(n.goodsSubtotal), 'so-summary-row muted') + (rev > 0 ? row('Less: advance given back', '− ' + invMoney(rev)) : '');
  else html = row('Advance credited (ex-VAT)', invMoney(n ? n.advanceSubtotal : 0), 'so-summary-row muted');
  html += '<div class="so-summary-divider"></div>' + row('Subtotal', invMoney(n ? n.subtotal : 0)) + row('VAT', invMoney(n ? n.vat : 0))
    + `<div class="so-summary-total"><span>TOTAL CREDIT</span><span>${documentMoney('customerInvoice', 'grandTotal', n ? n.total : 0)}</span></div>`;
  document.getElementById('cn-summary').innerHTML = html;
  const err = document.getElementById('cn-error');
  const show = r.errors.filter(x => !/at least one quantity|reason for the credit/i.test(x));
  err.hidden = !show.length; err.innerHTML = show.map(x => '<i class="ti ti-alert-circle"></i> ' + invEsc(x)).join('<br>');
  document.getElementById('cn-save').disabled = r.errors.length > 0;
}
async function saveCreditNote(){
  const m = document.getElementById('cn-issue-modal'); if (!m || !m._invoice) return null;
  return runProtectedDocumentSave({
    key: 'creditNote:' + m._opId, message: 'Saving credit note…', buttonId: 'cn-save', buttonTextId: 'cn-save-text', busyText: 'Saving…',
    action: () => _saveCreditNoteCore(m), ready: r => !r || !isModalOpen('cn-issue-modal'),
  });
}
async function _saveCreditNoteCore(m){
  const inv = m._invoice;
  const date = document.getElementById('cn-date').value;
  if (!date) { showToast('Please enter the credit note date', 'error'); return null; }
  const r = readCreditNote();
  if (r.errors.length) { showToast(r.errors[0], 'error', 'Check the Credit Note'); return null; }
  const x = docNumberParts('creditNote', new Date(date + 'T00:00:00'));
  const input = { operationId: m._opId, salesOrderId: m._soId, invoiceId: inv.id, date, reason: document.getElementById('cn-reason').value.trim(),
    expectedRevision: inv.revision, numbering: { counterKey: x.counterKey, displayPrefix: x.displayPrefix } };
  if (inv.type === 'advance') input.amount = r.amount; else input.lines = r.lines;
  try {
    const res = await window.BizCoreInv.service.issueCreditNote(input);
    upsertCreditNoteCache(res.creditNote); if (res.invoice) upsertInvoiceCache(res.invoice); refreshAfterInvoiceChange();
    closeModal('cn-issue-modal');
    showToast(res.alreadyApplied ? `${res.creditNote.cnNo} was already saved.` : `Credit note ${res.creditNote.cnNo} issued against ${inv.invNo}`, res.alreadyApplied ? 'info' : 'success');
    if (typeof viewSO === 'function') viewSO(m._soId);
    return res.creditNote;
  } catch (e) {
    console.error('[BizCore credit note]', e);
    showValidationDialog('Credit Note Not Saved', invoiceErrorMessage(e), '', '');
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════════
   SALES ORDER VIEW: billing summary + invoices + credit notes
═══════════════════════════════════════════════════════════════════ */
function soBillingSummaryHtml(so){
  const C = invLib(); if (!C) return '';
  const invs = invoicesForSO(so.id), cns = creditNotesForSO(so.id);
  let goods = 0, advances = 0, deducted = 0;
  invs.forEach(i => { if (i.type === 'advance') advances += invNum(i.totals.subtotal); else { goods += invNum(i.totals.goodsSubtotal); deducted += invNum(i.totals.deductionSubtotal); } });
  cns.forEach(c => { goods -= invNum(c.goodsSubtotal); advances -= invNum(c.advanceSubtotal); deducted -= (c.deductionReversal || []).reduce((s, d) => s + invNum(d.subtotal), 0); });
  const r = v => Math.round(v * 100) / 100;
  const orderValue = C.orderValue(so), remainingAdv = r(advances - deducted), net = r(goods + advances - deducted);
  const cell = (label, value, strong) => `<div style="flex:1;min-width:120px;border:1px solid var(--border);border-radius:8px;padding:8px 10px;background:#fbfcfe"><div style="font-size:10.5px;color:var(--gray);font-weight:600;text-transform:uppercase;letter-spacing:.3px">${label}</div><div style="font-size:13px;font-weight:${strong ? 800 : 600};margin-top:2px">${invMoney(value)}</div></div>`;
  return `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
    ${cell('Order value (ex-VAT)', orderValue)}${cell('Goods invoiced', r(goods))}${cell('Advances', r(advances))}${cell('Advance remaining', remainingAdv)}${cell('Net billed (ex-VAT)', net, true)}${cell('Still to bill', r(orderValue - net))}
  </div>`;
}
function soInvoicesSectionHtml(so){
  const invs = invoicesForSO(so.id), cns = creditNotesForSO(so.id);
  const settings = window.BizCoreInv.settings, canCredit = permState(settings.allowCreditNotes, !!window.BizCoreInv.isAdministrator).ok;
  const cards = invs.map(inv => {
    const idx = (so.invoices || []).findIndex(x => x.id === inv.id);
    const ded = (inv.deductions || []).map(d => `Less advance ${invEsc(d.advanceInvNo)} (${fmtDate(d.advanceDate)}): ${invMoney(d.subtotal)}`).join(' · ');
    const myCns = cns.filter(c => c.invoiceId === inv.id);
    return `<div class="inv-card"><div style="flex:1">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><button class="btn btn-secondary" style="padding:3px 7px;font-weight:700;font-size:11px" onclick="openInvoiceDocument('${so.id}',${idx})"><i class="ti ti-link"></i>${invEsc(inv.invNo)}</button>${invTypeBadge(inv.type)}${invStatusBadge(inv.status)}<span style="color:var(--gray);font-size:11px">${fmtDate(inv.date)}</span></div>
        <div style="font-size:11px;color:var(--gray);margin-top:3px">${inv.type === 'advance' ? `Advance ${formatNumber(inv.advance?.percent || 0, 2)}%` : (inv.lines || []).map(l => `${invEsc(l.desc)} × ${formatQuantity(l.qty)}`).join(' | ')}${ded ? '<br>' + ded : ''}</div>
        <div style="font-size:11px;color:var(--gray);margin-top:2px">Zoho: ${invEsc(inv.zohoNo || '—')} · Due: ${fmtDate(inv.dueDate)} · Total: <strong>${fmt(inv.totals.total)}</strong>${inv.reason ? ' · ' + invEsc(inv.reason) : ''}</div>
        ${myCns.map(c => `<div style="font-size:11px;color:#991B1B;margin-top:2px"><i class="ti ti-receipt-refund"></i> ${invEsc(c.cnNo)} · ${fmtDate(c.date)} · −${fmt(c.total)} · ${invEsc(c.reason)}</div>`).join('')}
      </div>
      <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end">
        <button class="abtn abtn-view" onclick="openInvoiceDocument('${so.id}',${idx})"><i class="ti ti-eye"></i>View</button>
        ${canCredit && inv.status !== 'Credited' ? `<button class="abtn abtn-edit" onclick="openIssueCreditNote('${so.id}','${inv.id}')"><i class="ti ti-receipt-refund"></i>Credit note</button>` : ''}
      </div></div>`;
  }).join('');
  return soBillingSummaryHtml(so) + (cards || '<p style="font-size:12px;color:var(--gray)">No invoice created yet.</p>');
}
/** Can anything be invoiced on this order by this user right now? (button visibility) */
function soCanIssueInvoice(so){
  if (!invIndependentMode()) return null;
  const settings = window.BizCoreInv.settings, isAdmin = !!window.BizCoreInv.isAdministrator;
  if (typeof soHasInvoiceableQty === 'function' && soHasInvoiceableQty(so)) return true;
  const C = invLib();
  const net = (so.invoices || []).reduce((s, i) => s + (i.type === 'advance' ? invNum(i.totals.subtotal) : invNum(i.totals.goodsSubtotal) - invNum(i.totals.deductionSubtotal)), 0)
    - (so.creditNotes || []).reduce((s, c) => s + invNum(c.subtotal), 0);
  const room = C.orderValue(so) - net > 0.004;
  const goodsLeft = (so.items || []).some((it, i) => {
    const invoiced = (so.invoices || []).filter(x => x.type !== 'advance').reduce((s, x) => s + (x.items || []).filter(l => l.soLineId === it.lineId).reduce((a, l) => a + invNum(l.qty), 0), 0);
    return invNum(it.qty) - invoiced > 0.000001;
  });
  return (goodsLeft && permState(settings.allowOrderInvoices, isAdmin).ok) || (room && permState(settings.allowAdvanceInvoices, isAdmin).ok);
}

/* ═══════════════════════════════════════════════════════════════════
   INVOICE / CREDIT NOTE DOCUMENT VIEW + PRINT
═══════════════════════════════════════════════════════════════════ */
function openIndependentInvoiceDocument(soId, invoiceId){
  const so = salesOrders.find(x => x.id === soId);
  const inv = invoicesCache.find(i => i.id === invoiceId); if (!inv) return;
  closeModal('view-modal'); closeModal('so-view-modal'); closeModal('dn-print-modal');
  const modal = ensureDocumentSummaryModal();
  const box = modal.querySelector('.modal'); if (box) box.style.width = 'min(880px,94vw)';
  const cns = creditNotesCache.filter(c => c.invoiceId === inv.id);
  const canCredit = permState(window.BizCoreInv.settings.allowCreditNotes, !!window.BizCoreInv.isAdministrator).ok && inv.status !== 'Credited';
  const row = (k, v) => `<div class="detail-row"><span class="dk">${k}</span><span>${v}</span></div>`;
  document.getElementById('document-summary-title').textContent = inv.invNo + ' — ' + invTypeLabel(inv.type);
  document.getElementById('document-summary-body').innerHTML = `
    <div class="section-title" style="margin-top:0">Invoice information</div>
    ${row('Invoice number', `<strong style="color:var(--blue)">${invEsc(inv.invNo)}</strong> ${invTypeBadge(inv.type)} ${invStatusBadge(inv.status)}`)}
    ${row('Date', fmtDate(inv.date))}${row('Due date', fmtDate(inv.dueDate))}${row('Customer', invEsc(inv.customer))}${row('Sales Order', invEsc(inv.soNo))}
    ${row('Zoho invoice', invEsc(inv.zohoNo || '—'))}${inv.reason ? row(inv.type === 'order' ? 'Billed ahead because' : 'Description', invEsc(inv.reason)) : ''}${inv.notes ? row('Notes', invEsc(inv.notes)) : ''}
    ${inv.migratedFrom ? row('Origin', 'Migrated from the Sales Order (V264)') : row('Created by', invEsc(inv.createdBy || '—'))}
    <div class="section-title">${inv.type === 'advance' ? 'Advance' : 'Lines'}</div>
    <div style="overflow-x:auto">${invoiceLinesTableHtml(inv)}</div>
    ${cns.length ? `<div class="section-title">Credit notes</div>${cns.map(c => `<div class="detail-row"><span class="dk">${invEsc(c.cnNo)} · ${fmtDate(c.date)}</span><span>−${fmt(c.total)} · ${invEsc(c.reason)} <button class="btn btn-secondary btn-sm" style="margin-left:6px" onclick="printCreditNote('${c.id}')"><i class="ti ti-printer"></i></button></span></div>`).join('')}` : ''}
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap">
      ${so ? `<button class="btn btn-secondary" onclick="closeDocumentSummary();viewSO('${so.id}')"><i class="ti ti-shopping-cart"></i>${invEsc(so.soNo)}</button>` : ''}
      <button class="btn btn-secondary" onclick="printCustomerInvoice('${inv.id}')"><i class="ti ti-printer"></i>Print</button>
      ${canCredit ? `<button class="btn btn-danger" onclick="closeDocumentSummary();openIssueCreditNote('${inv.salesOrderId}','${inv.id}')"><i class="ti ti-receipt-refund"></i>Credit note</button>` : ''}
    </div>`;
  modal.classList.add('open');
}
function invoiceLinesTableHtml(inv){
  const t = inv.totals || {};
  if (inv.type === 'advance') {
    const a = inv.advance || {};
    const basis = a.method === 'full' ? 'Full order value' : a.method === 'percentLines' ? `${formatNumber(a.percent, 2)}% of selected lines (${formatNumber(a.base, 2)})` : `${formatNumber(a.percent, 2)}% of order value (${formatNumber(a.base, 2)})`;
    return `<table class="inv-items-table"><tbody>
      <tr><td>Advance payment — ${invEsc(basis)}</td><td style="text-align:right">${invMoney(t.subtotal)}</td></tr>
      <tr><td>VAT (${Math.round((a.vatRate || 0) * 100)}%)</td><td style="text-align:right">${invMoney(t.vat)}</td></tr>
      <tr><td><strong>Total</strong></td><td style="text-align:right"><strong>${invMoney(t.total)}</strong></td></tr></tbody></table>`;
  }
  const credited = inv.credited?.lines || {};
  return `<table class="inv-items-table"><thead><tr><th>#</th><th>Description</th><th>Qty</th><th>UOM</th><th>Unit price</th><th>VAT</th><th style="text-align:right">Amount</th></tr></thead><tbody>
    ${(inv.lines || []).map((l, i) => `<tr><td>${i + 1}</td><td>${invEsc(l.desc)}${credited[l.lineId] ? `<div style="font-size:10.5px;color:#991B1B">${formatQuantity(credited[l.lineId])} credited</div>` : ''}</td><td>${formatQuantity(l.qty)}</td><td>${invEsc(l.uom)}</td><td>${documentMoney('customerInvoice', 'unitPrice', l.up)}</td><td>${Math.round(l.vatRate * 100)}%</td><td style="text-align:right">${documentMoney('customerInvoice', 'lineAmount', l.subtotal)}</td></tr>`).join('')}
    <tr><td colspan="6" style="text-align:right">Goods (ex-VAT)</td><td style="text-align:right">${invMoney(t.goodsSubtotal)}</td></tr>
    ${(inv.deductions || []).map(d => `<tr><td colspan="6" style="text-align:right">Less: advance ${invEsc(d.advanceInvNo)} dated ${fmtDate(d.advanceDate)}</td><td style="text-align:right">− ${invMoney(d.subtotal)}</td></tr>`).join('')}
    ${t.deductionSubtotal ? `<tr><td colspan="6" style="text-align:right">Sub-total (ex-VAT)</td><td style="text-align:right">${invMoney(t.subtotal)}</td></tr>` : ''}
    <tr><td colspan="6" style="text-align:right">VAT</td><td style="text-align:right">${invMoney(t.vat)}</td></tr>
    <tr><td colspan="6" style="text-align:right"><strong>Invoice total</strong></td><td style="text-align:right"><strong>${invMoney(t.total)}</strong></td></tr></tbody></table>`;
}
function invPrintShell(title, number, bodyHtml){
  const s = typeof settings === 'object' && settings ? settings : {};
  const addr = [s.building, s.street, s.district, s.city, s.postal, s.country].filter(Boolean).map(invEsc).join(', ');
  const w = window.open('', '_blank');
  if (!w) { showToast('Allow pop-ups for BizCore to print.', 'warning'); return; }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${invEsc(number)}</title><style>
    body{font-family:Arial,Helvetica,sans-serif;color:#1f2937;margin:28px;font-size:12px}
    h1{font-size:20px;margin:0 0 4px;color:#1F4E79} .muted{color:#6b7280} table{width:100%;border-collapse:collapse;margin-top:12px}
    th{background:#1F4E79;color:#fff;text-align:left;padding:6px;font-size:11px} td{padding:6px;border-bottom:1px solid #e5e7eb;vertical-align:top}
    .r{text-align:right} .tot td{border:none;padding:4px 6px} .grand td{font-weight:800;font-size:13px;border-top:2px solid #1F4E79}
    .hdr{display:flex;justify-content:space-between;gap:20px;border-bottom:3px solid #1F4E79;padding-bottom:10px;margin-bottom:12px} .box{border:1px solid #d1d5db;border-radius:6px;padding:8px 10px}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px} @media print{body{margin:12mm}}
  </style></head><body>
    <div class="hdr"><div>${s.logo ? `<img src="${s.logo}" style="max-height:60px;max-width:220px"><br>` : ''}<strong style="font-size:14px">${invEsc(s.coname || 'BizCore')}</strong>${s.conameAr ? `<div>${invEsc(s.conameAr)}</div>` : ''}<div class="muted">${addr}</div>${s.vat ? `<div>VAT No: ${invEsc(s.vat)}</div>` : ''}${s.cr ? `<div>CR: ${invEsc(s.cr)}</div>` : ''}</div>
    <div style="text-align:right"><h1>${invEsc(title)}</h1><div style="font-size:15px;font-weight:800">${invEsc(number)}</div></div></div>
    ${bodyHtml}
    <script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>`);
  w.document.close();
}
function printCustomerInvoice(invoiceId){
  const inv = invoicesCache.find(i => i.id === invoiceId); if (!inv) return;
  const t = inv.totals || {};
  const info = `<div class="grid"><div class="box"><div class="muted">Bill to</div><strong>${invEsc(inv.customer)}</strong></div>
    <div class="box">Date: <strong>${fmtDate(inv.date)}</strong><br>Due: ${fmtDate(inv.dueDate)}<br>Sales Order: ${invEsc(inv.soNo)}${inv.poNo ? '<br>Customer PO: ' + invEsc(inv.poNo) : ''}${inv.zohoNo ? '<br>Zoho: ' + invEsc(inv.zohoNo) : ''}</div></div>`;
  let lines;
  if (inv.type === 'advance') {
    const a = inv.advance || {};
    const basis = a.method === 'full' ? 'full order value' : `${formatNumber(a.percent, 2)}% of ${a.method === 'percentLines' ? 'selected lines' : 'order value'} (${formatNumber(a.base, 2)})`;
    lines = `<table><thead><tr><th>Description</th><th class="r">Amount</th></tr></thead><tbody><tr><td>Advance payment against Sales Order ${invEsc(inv.soNo)} — ${invEsc(basis)}${inv.reason ? '<br>' + invEsc(inv.reason) : ''}</td><td class="r">${formatNumber(t.subtotal, 2)}</td></tr></tbody></table>
      <table class="tot"><tr><td class="r">Sub-total (ex-VAT)</td><td class="r" style="width:140px">${formatNumber(t.subtotal, 2)}</td></tr><tr><td class="r">VAT ${Math.round((a.vatRate || 0) * 100)}%</td><td class="r">${formatNumber(t.vat, 2)}</td></tr><tr class="grand"><td class="r">Total (SAR)</td><td class="r">${formatNumber(t.total, 2)}</td></tr></table>`;
  } else {
    lines = `<table><thead><tr><th>#</th><th>Description</th><th class="r">Qty</th><th>UOM</th><th class="r">Unit price</th><th class="r">Amount</th></tr></thead><tbody>
      ${(inv.lines || []).map((l, i) => `<tr><td>${i + 1}</td><td>${invEsc(l.desc)}</td><td class="r">${formatQuantity(l.qty)}</td><td>${invEsc(l.uom)}</td><td class="r">${formatNumber(l.up, 2)}</td><td class="r">${formatNumber(l.subtotal, 2)}</td></tr>`).join('')}</tbody></table>
      <table class="tot"><tr><td class="r">Goods (ex-VAT)</td><td class="r" style="width:140px">${formatNumber(t.goodsSubtotal, 2)}</td></tr>
      ${(inv.deductions || []).map(d => `<tr><td class="r">Less: advance ${invEsc(d.advanceInvNo)} dated ${fmtDate(d.advanceDate)}</td><td class="r">−${formatNumber(d.subtotal, 2)}</td></tr>`).join('')}
      <tr><td class="r">Sub-total (ex-VAT)</td><td class="r">${formatNumber(t.subtotal, 2)}</td></tr><tr><td class="r">VAT</td><td class="r">${formatNumber(t.vat, 2)}</td></tr><tr class="grand"><td class="r">Total (SAR)</td><td class="r">${formatNumber(t.total, 2)}</td></tr></table>`;
  }
  invPrintShell('TAX INVOICE', inv.invNo, info + lines + (inv.notes ? `<p class="muted">${invEsc(inv.notes)}</p>` : ''));
}
function printCreditNote(cnId){
  const c = creditNotesCache.find(x => x.id === cnId); if (!c) return;
  const info = `<div class="grid"><div class="box"><div class="muted">Customer</div><strong>${invEsc(c.customer)}</strong></div>
    <div class="box">Date: <strong>${fmtDate(c.date)}</strong><br>Against invoice: <strong>${invEsc(c.invNo)}</strong> dated ${fmtDate(c.invoiceDate)}<br>Sales Order: ${invEsc(c.soNo)}<br>Reason: ${invEsc(c.reason)}</div></div>`;
  const body = c.kind === 'advance'
    ? `<table><thead><tr><th>Description</th><th class="r">Amount</th></tr></thead><tbody><tr><td>Advance credited</td><td class="r">${formatNumber(c.advanceSubtotal, 2)}</td></tr></tbody></table>`
    : `<table><thead><tr><th>#</th><th>Description</th><th class="r">Qty</th><th>UOM</th><th class="r">Unit price</th><th class="r">Amount</th></tr></thead><tbody>${(c.lines || []).map((l, i) => `<tr><td>${i + 1}</td><td>${invEsc(l.desc)}</td><td class="r">${formatQuantity(l.qty)}</td><td>${invEsc(l.uom)}</td><td class="r">${formatNumber(l.up, 2)}</td><td class="r">${formatNumber(l.subtotal, 2)}</td></tr>`).join('')}</tbody></table>
      ${(c.deductionReversal || []).length ? `<table class="tot">${c.deductionReversal.map(d => `<tr><td class="r">Less: advance ${invEsc(d.advanceInvNo)} given back</td><td class="r" style="width:140px">−${formatNumber(d.subtotal, 2)}</td></tr>`).join('')}</table>` : ''}`;
  invPrintShell('CREDIT NOTE', c.cnNo, info + body + `<table class="tot"><tr><td class="r">Sub-total (ex-VAT)</td><td class="r" style="width:140px">${formatNumber(c.subtotal, 2)}</td></tr><tr><td class="r">VAT</td><td class="r">${formatNumber(c.vat, 2)}</td></tr><tr class="grand"><td class="r">Total credited (SAR)</td><td class="r">${formatNumber(c.total, 2)}</td></tr></table>`);
}

/* ═══════════════════════════════════════════════════════════════════
   ADMINISTRATION → BILLING SETTINGS
═══════════════════════════════════════════════════════════════════ */
function renderBillingSettings(){
  const box = document.getElementById('billing-settings-body'); if (!box) return;
  const B = window.BizCoreInv;
  if (!B) { box.innerHTML = '<div style="color:var(--gray)">Not connected.</div>'; return; }
  const s = B.settings, stored = B.storedSettings, isAdmin = !!B.isAdministrator, dis = isAdmin ? '' : 'disabled';
  const sel = (id, value, opts) => `<select id="${id}" ${dis}>${opts.map(([v, l]) => `<option value="${v}" ${v === value ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  const who = [['all', 'All users'], ['admin', 'Administrators only'], ['none', 'Nobody (switched off)']];
  box.innerHTML = `
    ${isAdmin ? '' : `<div style="background:#FFFBEA;border:1px solid #F0D77B;border-radius:8px;padding:10px 12px;font-size:12.5px;color:#7A5A00;margin-bottom:14px"><i class="ti ti-shield-lock" style="margin-right:6px"></i>Only an administrator can change these settings.</div>`}
    <div style="font-size:12px;color:var(--gray);margin-bottom:10px">Invoice storage: <strong>${invEsc(B.mode)}</strong>${B.mode !== 'independent' ? ' — these settings apply after the administrator completes the invoice migration.' : ''}</div>
    <div class="form-grid">
      <div class="form-group"><label for="bs-ded">Advance deduction on later invoices</label>${sel('bs-ded', s.deductionMethod, [['auto-editable', 'Automatic proposal — user may change it'], ['auto-fixed', 'Automatic — fixed'], ['manual', 'Entered by the user']])}
        <div style="font-size:11.5px;color:var(--gray);margin-top:4px">Automatic = the advance % of the order applied to each invoice (50% advance → 50% of each invoice's goods). Whatever the setting: the invoice that completes the order always deducts the whole remaining advance, and the customer is never billed more than the order value.</div></div>
      <div class="form-group"><label for="bs-order">Who may issue order invoices (bill ahead of delivery)</label>${sel('bs-order', s.allowOrderInvoices, who)}<div style="font-size:11.5px;color:var(--gray);margin-top:4px">Delivery invoices (accepted goods) are always allowed.</div></div>
      <div class="form-group"><label for="bs-adv">Who may issue advance invoices</label>${sel('bs-adv', s.allowAdvanceInvoices, who)}</div>
      <div class="form-group"><label for="bs-cn">Who may issue credit notes</label>${sel('bs-cn', s.allowCreditNotes, who.slice(0, 2))}<div style="font-size:11.5px;color:var(--gray);margin-top:4px">Corrections must stay possible, so credit notes cannot be switched off.</div></div>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px;flex-wrap:wrap">
      <div style="font-size:12px;color:var(--gray)">${stored && stored.updatedByName ? 'Last changed by ' + invEsc(stored.updatedByName) + (stored.updatedAt ? ' · ' + new Date(window.BizCoreLocks.core.toMillis(stored.updatedAt)).toLocaleString() : '') : 'Using the default values (deduction: automatic proposal; order/advance invoices and credit notes: administrators only).'}</div>
      ${isAdmin ? '<button class="btn btn-primary" id="bs-save" onclick="saveBillingSettings()"><i class="ti ti-device-floppy"></i>Save settings</button>' : ''}
    </div>
    <div style="margin-top:18px"><button class="btn btn-secondary" onclick="showBillingHistory()"><i class="ti ti-history"></i>Change history</button></div>
    <div id="billing-history" style="margin-top:10px"></div>`;
}
async function saveBillingSettings(){
  const v = id => document.getElementById(id).value;
  const btn = document.getElementById('bs-save'); if (btn) btn.disabled = true;
  try { await window.BizCoreInv.saveSettings({ deductionMethod: v('bs-ded'), allowOrderInvoices: v('bs-order'), allowAdvanceInvoices: v('bs-adv'), allowCreditNotes: v('bs-cn') }); showToast('Billing settings saved.', 'success', 'Settings Saved'); }
  catch (e) { showToast(e.code === 'permission-denied' ? 'Only an administrator can change these settings.' : e.message, 'error', 'Not Saved'); }
  finally { if (btn) btn.disabled = false; }
}
async function showBillingHistory(){
  const box = document.getElementById('billing-history'); if (!box) return;
  box.innerHTML = '<div style="color:var(--gray);font-size:12px">Loading…</div>';
  const lbl = { 'auto-editable': 'auto (editable)', 'auto-fixed': 'auto (fixed)', manual: 'manual', all: 'all', admin: 'admins', none: 'off' };
  const f = x => x ? `deduction ${lbl[x.deductionMethod] || x.deductionMethod} · order ${lbl[x.allowOrderInvoices]} · advance ${lbl[x.allowAdvanceInvoices]} · credit ${lbl[x.allowCreditNotes]}` : 'defaults';
  try {
    const rows = await window.BizCoreInv.loadSettingsHistory();
    box.innerHTML = rows.length ? `<table class="uom-table"><thead><tr><th>When</th><th>By</th><th>Before</th><th>After</th></tr></thead><tbody>${rows.map(r => `<tr><td>${new Date(window.BizCoreLocks.core.toMillis(r.recordedAt)).toLocaleString()}</td><td>${invEsc(r.actorName || '')}</td><td>${invEsc(f(r.before))}</td><td>${invEsc(f(r.after))}</td></tr>`).join('')}</tbody></table>` : '<div style="color:var(--gray);font-size:12px">No changes recorded yet.</div>';
  } catch (e) { box.innerHTML = '<div style="color:#DC2626;font-size:12px">' + invEsc(e.message) + '</div>'; }
}

/* ═══════════════════════════════════════════════════════════════════
   SALES → INVOICES register (invoices + credit notes)
═══════════════════════════════════════════════════════════════════ */
let _invRegKpi = 'all';
function invoiceRegisterRows(){
  const rows = [];
  if (invIndependentMode()) {
    invoicesCache.forEach(i => rows.push({ kind: 'invoice', id: i.id, soId: i.salesOrderId, no: i.invNo, type: i.type, date: i.date, customer: i.customer, soNo: i.soNo, status: i.status || 'Issued', total: invNum(i.totals?.total), ref: i.zohoNo ? 'Zoho ' + i.zohoNo : (i.reason || ''), updated: i.updatedAt || i.created || '' }));
    creditNotesCache.forEach(c => rows.push({ kind: 'credit', id: c.id, soId: c.salesOrderId, no: c.cnNo, type: 'credit', date: c.date, customer: c.customer, soNo: c.soNo, status: 'Credit note', total: -invNum(c.total), ref: 'Against ' + c.invNo + (c.reason ? ' · ' + c.reason : ''), updated: c.created || '' }));
  } else {
    (salesOrders || []).forEach(so => (so.invoices || []).forEach((i, idx) => rows.push({ kind: 'legacy', idx, soId: so.id, no: i.invNo, type: 'delivery', date: i.date, customer: so.customer, soNo: so.soNo, status: 'Issued', total: invNum(i.total), ref: i.zohoNo ? 'Zoho ' + i.zohoNo : '' })));
  }
  return rows;
}
function invRegDateRange(v){
  const d = new Date(), iso = x => x.toISOString().slice(0, 10), y = d.getFullYear(), mo = d.getMonth();
  if (v === 'today') return [iso(d), iso(d)];
  if (v === 'week') { const s = new Date(d); s.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return [iso(s), iso(d)]; }
  if (v === 'month') return [iso(new Date(y, mo, 1)), iso(d)];
  if (v === 'lastmonth') return [iso(new Date(y, mo - 1, 1)), iso(new Date(y, mo, 0))];
  if (v === 'last3months') return [iso(new Date(y, mo - 2, 1)), iso(d)];
  if (v === 'year') return [y + '-01-01', iso(d)];
  return [null, null];
}
function filterInvoiceKPI(k){ _invRegKpi = k; renderInvoiceRegister(); }
function clearInvoiceRegisterFilters(){
  ['invreg-q'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
  set('invreg-status', ''); set('invreg-date', 'all'); set('invreg-sort', 'date-desc'); _invRegKpi = 'all';
  renderInvoiceRegister();
}
function renderInvoiceRegister(){
  const body = document.getElementById('invreg-body'); if (!body) return;
  const val = id => (document.getElementById(id)?.value || '');
  const q = val('invreg-q').trim().toLowerCase(), st = val('invreg-status'), dp = val('invreg-date') || 'all', sort = val('invreg-sort') || 'date-desc';
  const [from, to] = invRegDateRange(dp);
  const scope = invoiceRegisterRows().filter(r => (!st || r.status === st) && (!from || (r.date || '') >= from) && (!to || (r.date || '') <= to)
    && (!q || [r.no, r.customer, r.soNo, r.ref].some(v => String(v || '').toLowerCase().includes(q))));
  const count = t => scope.filter(r => r.type === t).length;
  const sum = f => Math.round(scope.filter(f).reduce((s, r) => s + r.total, 0) * 100) / 100;
  const setT = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  setT('invreg-k-total', scope.length); ['delivery', 'order', 'advance', 'credit'].forEach(t => setT('invreg-k-' + t, count(t)));
  setT('invreg-a-invoiced', formatNumber(sum(r => r.kind !== 'credit'), 2)); setT('invreg-a-credited', formatNumber(Math.abs(sum(r => r.kind === 'credit')), 2)); setT('invreg-a-net', formatNumber(sum(() => true), 2));
  document.querySelectorAll('#page-customerinvoices [data-inv-kpi]').forEach(e => { const on = e.dataset.invKpi === _invRegKpi; e.classList.toggle('active', on); e.setAttribute('aria-pressed', on ? 'true' : 'false'); });
  let rows = scope.filter(r => _invRegKpi === 'all' || r.type === _invRegKpi);
  if (sort === 'date-asc') rows.sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.no || '').localeCompare(b.no || '', undefined, { numeric: true }));
  else if (sort === 'no-asc') rows.sort((a, b) => (a.no || '').localeCompare(b.no || '', undefined, { numeric: true }));
  else if (sort === 'customer-asc') rows.sort((a, b) => (a.customer || '').localeCompare(b.customer || ''));
  else if (sort === 'total-desc') rows.sort((a, b) => b.total - a.total);
  else rows.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.no || '').localeCompare(a.no || '', undefined, { numeric: true }));
  if (typeof sortRegisterRows === 'function') rows = sortRegisterRows(rows, 'inv', { no: r => r.no, type: r => r.type, date: r => r.date, customer: r => r.customer, so: r => r.soNo, total: r => r.total, status: r => r.status });
  setT('invreg-count', `${rows.length} document${rows.length === 1 ? '' : 's'}`);
  const clear = document.getElementById('invreg-clear');
  if (clear) { const active = !!(q || st || dp !== 'all' || sort !== 'date-desc' || _invRegKpi !== 'all'); clear.disabled = !active; clear.classList.toggle('active', active); }
  const statusBadge = r => r.kind === 'credit' ? '<span class="badge inv-badge-credit">Credit note</span>'
    : r.status === 'Credited' ? '<span class="badge inv-badge-credited">Credited</span>' : r.status === 'Partially credited' ? '<span class="badge inv-badge-partcredit">Partly credited</span>' : '<span class="badge inv-badge-issued">Issued</span>';
  const typeBadge = r => r.kind === 'credit' ? '<span class="inv-type-pill credit">Credit note</span>' : `<span class="inv-type-pill ${r.type}">${invTypeShort(r.type)}</span>`;
  const open = r => r.kind === 'credit' ? `openCreditNoteDocument('${r.id}')` : r.kind === 'invoice' ? `openIndependentInvoiceDocument('${r.soId}','${r.id}')` : `openInvoiceDocument('${r.soId}',${r.idx})`;
  body.innerHTML = rows.length ? rows.map(r => `<tr class="quotation-clickable-row" tabindex="0" role="button" onclick="${open(r)}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${open(r)}}"><td>${invEsc(r.no || '—')}</td><td>${typeBadge(r)}</td><td>${fmtDate(r.date)}</td><td>${invEsc(r.customer || '—')}</td><td>${invEsc(r.soNo || '—')}</td><td class="inv-reg-ref">${invEsc(r.ref || '—')}</td><td class="num${r.total < 0 ? ' neg' : ''}">${formatNumber(r.total, 2)}</td><td>${statusBadge(r)}</td></tr>`).join('')
    : '<tr><td colspan="8"><div class="empty-state"><i class="ti ti-file-invoice"></i><strong>No invoices found</strong><p>Invoices are created from the Sales Order (Create invoice). Adjust the filters to see other documents.</p></div></td></tr>';
}
/** Credit note view (summary modal) with print. */
function openCreditNoteDocument(cnId){
  const c = creditNotesCache.find(x => x.id === cnId); if (!c) return;
  const modal = ensureDocumentSummaryModal();
  const box = modal.querySelector('.modal'); if (box) box.style.width = 'min(880px,94vw)';
  const row = (k, v) => `<div class="detail-row"><span class="dk">${k}</span><span>${v}</span></div>`;
  document.getElementById('document-summary-title').textContent = c.cnNo + ' — Credit Note';
  const lines = c.kind === 'advance' ? `<div class="detail-row"><span class="dk">Advance credited (ex-VAT)</span><span>${invMoney(c.advanceSubtotal)}</span></div>`
    : `<div style="overflow-x:auto"><table class="inv-items-table"><thead><tr><th>#</th><th>Description</th><th>Qty</th><th>UOM</th><th>Unit price</th><th style="text-align:right">Amount</th></tr></thead><tbody>${(c.lines || []).map((l, i) => `<tr><td>${i + 1}</td><td>${invEsc(l.desc)}</td><td>${formatQuantity(l.qty)}</td><td>${invEsc(l.uom)}</td><td>${formatNumber(l.up, 2)}</td><td style="text-align:right">${formatNumber(l.subtotal, 2)}</td></tr>`).join('')}
      ${(c.deductionReversal || []).map(d => `<tr><td colspan="5" style="text-align:right">Less: advance ${invEsc(d.advanceInvNo)} given back</td><td style="text-align:right">− ${formatNumber(d.subtotal, 2)}</td></tr>`).join('')}</tbody></table></div>`;
  document.getElementById('document-summary-body').innerHTML = `<div class="section-title" style="margin-top:0">Credit note information</div>
    ${row('Credit note', `<strong style="color:var(--blue)">${invEsc(c.cnNo)}</strong>`)}${row('Date', fmtDate(c.date))}${row('Against invoice', `${invEsc(c.invNo)} dated ${fmtDate(c.invoiceDate)}`)}${row('Customer', invEsc(c.customer))}${row('Sales Order', invEsc(c.soNo))}${row('Reason', invEsc(c.reason))}${row('Created by', invEsc(c.createdBy || '—'))}
    <div class="section-title">Credited</div>${lines}
    ${row('Subtotal (ex-VAT)', invMoney(c.subtotal))}${row('VAT', invMoney(c.vat))}${row('<strong>Total credited</strong>', `<strong>${invMoney(c.total)}</strong>`)}
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px"><button class="btn btn-secondary" onclick="closeDocumentSummary();openIndependentInvoiceDocument('${c.salesOrderId}','${c.invoiceId}')"><i class="ti ti-file-invoice"></i>${invEsc(c.invNo)}</button><button class="btn btn-secondary" onclick="printCreditNote('${c.id}')"><i class="ti ti-printer"></i>Print</button></div>`;
  modal.classList.add('open');
}
