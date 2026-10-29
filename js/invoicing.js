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

/* ───────────── Desktop-style quantity spinner (V264.7) ─────────────
   Any <input type="number" class="bc-spin"> gets small up/down arrows inside the field. Typing and the
   keyboard arrow keys work as before; each click adds or subtracts the field's step (the unit's step,
   e.g. 1 for Pcs, 0.5 for meters), stays within min/max, and fires the same input/change events as typing.
   Holding an arrow repeats. Inputs are enhanced automatically when a screen is rendered. */
function bcSpinStep(input, dir){
  if (input.disabled || input.readOnly) return;
  const step = Number(input.step) > 0 ? Number(input.step) : 1;
  const dec = (String(input.step).split('.')[1] || '').length;
  const cur = Number(input.value) || 0;
  let next = Math.round((cur + dir * step) / step) * step;
  if (input.min !== '' && Number.isFinite(Number(input.min))) next = Math.max(Number(input.min), next);
  if (input.max !== '' && Number.isFinite(Number(input.max))) next = Math.min(Number(input.max), next);
  next = Number(next.toFixed(Math.max(dec, 0) + 2));
  if (String(next) === input.value) return;
  input.value = String(next);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
function bcSpinEnhance(root){
  const scope = root && root.querySelectorAll ? root : document;
  const list = scope.matches && scope.matches('input.bc-spin') ? [scope] : scope.querySelectorAll('input.bc-spin');
  list.forEach(input => {
    if (input.dataset.spun || input.type !== 'number' || !input.parentNode) return;
    input.dataset.spun = '1';
    const wrap = document.createElement('span');
    wrap.className = 'bc-spin-wrap' + (input.classList.contains('so-qty-input') ? ' bc-spin-narrow' : '');
    input.parentNode.insertBefore(wrap, input); wrap.appendChild(input);
    const arrows = document.createElement('span');
    arrows.className = 'bc-spin-arrows';
    arrows.innerHTML = '<button type="button" tabindex="-1" class="bc-spin-up" aria-label="Increase"><svg viewBox="0 0 10 6" aria-hidden="true"><path d="M1 5l4-4 4 4"/></svg></button><button type="button" tabindex="-1" class="bc-spin-down" aria-label="Decrease"><svg viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1l4 4 4-4"/></svg></button>';
    wrap.appendChild(arrows);
    arrows.querySelectorAll('button').forEach(btn => {
      const dir = btn.classList.contains('bc-spin-up') ? 1 : -1;
      let delay = null, repeat = null;
      const stop = () => { clearTimeout(delay); clearInterval(repeat); delay = repeat = null; };
      btn.addEventListener('pointerdown', e => {
        if (e.button !== 0) return;
        e.preventDefault(); stop();
        bcSpinStep(input, dir);
        delay = setTimeout(() => { repeat = setInterval(() => bcSpinStep(input, dir), 70); }, 420);
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => btn.addEventListener(ev, stop));
      btn.addEventListener('click', e => { if (e.detail === 0) bcSpinStep(input, dir); });   // keyboard / programmatic click
    });
  });
}
(function bcSpinObserve(){
  const start = () => {
    bcSpinEnhance(document);
    new MutationObserver(muts => { for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1 && (n.matches('input.bc-spin') || n.querySelector('input.bc-spin'))) bcSpinEnhance(n); })
      .observe(document.body, { childList: true, subtree: true });
  };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();

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
function invoiceModeRoute(soId, opts){
  const m = invMode();
  if (m === 'legacy') return 'legacy';
  if (m === 'migrating') { showToast('The administrator is moving invoices to the new storage. Invoicing is paused until it completes.', 'warning', 'Invoicing Paused'); return false; }
  if (m !== 'independent') { showToast('Invoice storage could not be verified. Please reload BizCore.', 'error', 'Not Available'); return false; }
  return openIssueInvoice(soId, opts);
}
function invoiceErrorMessage(e){
  const code = e && e.code || '';
  if (code === 'duplicate-zoho-number' || code === 'not-permitted' || code === 'over-invoice' || code === 'over-billing' || code === 'invalid-deduction' || code === 'over-credit') return e.message;
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
        <div class="inv-step-head"><strong>What do you want to invoice?</strong><span>You can change it before saving</span></div>
        <div class="inv-type-grid" id="ii-types" role="radiogroup" aria-label="Invoice type"></div>
        <div class="inv-context-strip" id="ii-context"></div>
      </div>
      <div id="ii-step-form" hidden>
        <div class="so-header-grid">
          <section class="so-entry-card"><div class="so-entry-card-title"><i class="ti ti-file-invoice"></i>Invoice Details</div><div class="so-entry-fields two">
            <div class="form-group"><label>Invoice Number</label><input readonly class="so-readonly strong" value="Auto on Save"/></div>
            <div class="form-group"><label>Invoice Date *</label><input id="ii-date" type="date"/></div>
            <div class="form-group"><label>Payment Due Date</label><input id="ii-due" type="date"/></div>
            <div class="form-group"><label for="ii-zoho">Zoho Invoice No. *</label><input id="ii-zoho" maxlength="100" autocomplete="off" placeholder="Number from Zoho Books" oninput="recalcIssueInvoice()"/><div class="inv-field-msg" id="ii-zoho-msg" hidden></div></div>
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
    <div class="modal-footer"><div class="inv-ready" id="ii-footer-note" aria-live="polite"></div>
      <button class="btn btn-secondary" id="ii-back" onclick="issueInvoiceStep(1)" hidden><i class="ti ti-arrow-left"></i>Change type</button>
      <button class="btn btn-secondary" onclick="closeModal('inv-issue-modal')">Cancel</button>
      <button class="btn btn-primary" id="ii-continue" onclick="issueInvoiceStep(2)" disabled><span>Continue</span><i class="ti ti-arrow-right"></i></button>
      <button class="btn btn-primary" id="ii-save" onclick="saveIssueInvoice()" hidden><i class="ti ti-file-invoice"></i><span id="ii-save-text">Create Invoice</span></button>
    </div>
  </div>`;
  document.body.appendChild(m);
  return m;
}

async function openIssueInvoice(soId, opts = {}){
  const so = salesOrders.find(x => x.id === soId); if (!so) return false;
  if (!navigator.onLine) { showToast('Invoices are saved directly to the cloud database. Please reconnect and try again.', 'error', 'Offline'); return false; }
  const C = invLib();
  let ledger;
  try { ledger = await window.BizCoreInv.getLedger(soId); }
  catch (e) { showToast('Could not read the latest order balances (' + (e.message || e) + '). Please try again.', 'error', 'Not Available'); return false; }
  const m = ensureIssueInvoiceModal();
  const settings = window.BizCoreInv.settings, isAdmin = !!window.BizCoreInv.isAdministrator;
  Object.assign(m, { _soId: soId, _ledger: ledger, _states: C.invoiceLineStates(so, ledger), _settings: settings, _opId: newDeliveryOperationId('invoice', soId), _dedTouched: false, _type: null,
    _allowed: { delivery: { ok: true, why: '' }, order: permState(settings.allowOrderInvoices, (typeof window.bcRight === 'function' ? window.bcRight('orderInvoices') : !!window.BizCoreInv.isAdministrator)), advance: permState(settings.allowAdvanceInvoices, (typeof window.bcRight === 'function' ? window.bcRight('advanceInvoices') : !!window.BizCoreInv.isAdministrator)) } });   // V270.4.3 Special Rights
  document.getElementById('ii-title').textContent = 'Create Invoice — ' + so.soNo;
  document.getElementById('ii-subtitle').textContent = [so.customer, so.poNo ? 'Customer PO ' + so.poNo : ''].filter(Boolean).join(' · ');
  const today = new Date().toISOString().split('T')[0], due = new Date(); due.setDate(due.getDate() + 14);
  document.getElementById('ii-date').value = today; document.getElementById('ii-due').value = due.toISOString().split('T')[0];
  ['ii-zoho', 'ii-notes', 'ii-reason'].forEach(id => { document.getElementById(id).value = ''; });
  document.querySelector('input[name="ii-adv-method"][value="percentOrder"]').checked = true; document.getElementById('ii-adv-pct').value = '50';
  m._fromDn = null; m._reissueOf = null;
  renderIssueInvoiceTypes();
  issueInvoiceStep(1);
  if (opts && opts.fromDnId) issueInvoiceFromDN(m, so, opts.fromDnId);
  if (opts && opts.reissue) issueInvoiceFromReissue(m, opts.reissue);
  openModalWithSize('inv-issue-modal');
  return true;
}
/** V266.3 Cancel and re-issue: the new invoice starts as a copy of the cancelled one (type, quantities, texts) — correct it, enter the new Zoho no., save. */
function issueInvoiceFromReissue(m, old){
  m._reissueOf = { id: old.id, invNo: old.invNo };
  const card = document.querySelector(`#ii-types [data-inv-type="${old.type}"]`);
  if (!card || card.disabled) { showToast(`A ${invTypeShort(old.type).toLowerCase()} invoice cannot be created for this order right now — choose the type.`, 'warning', 'Re-issue'); return; }
  m._type = old.type;
  document.getElementById('ii-subtitle').textContent += ' · Re-issue of ' + old.invNo;
  if (old.dueDate) document.getElementById('ii-due').value = old.dueDate;
  document.getElementById('ii-notes').value = old.notes || '';
  document.getElementById('ii-reason').value = old.reason || '';
  if (old.type === 'advance' && old.advance) {
    const a = old.advance, radio = document.querySelector(`input[name="ii-adv-method"][value="${a.method}"]`); if (radio) radio.checked = true;
    if (a.percent) document.getElementById('ii-adv-pct').value = String(a.percent);
  }
  issueInvoiceStep(2);
  if (old.type === 'advance') (m._rows || []).forEach((r, i) => { const e = document.getElementById('ii-sel-' + i); if (e) e.checked = ((old.advance || {}).lineIds || []).includes(r.lineId); });
  else (m._rows || []).forEach((r, i) => { const e = document.getElementById('ii-qty-' + i); if (!e) return; const l = (old.lines || []).find(x => x.lineId === r.lineId); e.value = l ? Math.min(l.qty, old.type === 'delivery' ? r.availableDelivery : r.availableOrder) : 0; });
  recalcIssueInvoice();
}
/** Opened from a Delivery Note: delivery invoice, quantities = what that DN's customer accepted (within what is still uninvoiced). */
function issueInvoiceFromDN(m, so, dnId){
  const d = (so.deliveries || []).find(x => x.id === dnId); if (!d) return;
  const card = document.querySelector('#ii-types [data-inv-type="delivery"]');
  if (!card || card.disabled) return;   // nothing accepted is waiting — stay on step 1 and let the user choose
  const accepted = {};
  (d.items || []).forEach(it => {
    const row = typeof soRowOfItem === 'function' ? soRowOfItem(so, it, 'dn') : null;
    const lineId = it.soLineId || (row != null && so.items[row] ? so.items[row].lineId : null);
    if (lineId) accepted[lineId] = (accepted[lineId] || 0) + deliveryAcceptedQty(d, it);
  });
  m._type = 'delivery';
  m._fromDn = { id: d.id, dnNo: d.dnNo, accepted };
  document.getElementById('ii-subtitle').textContent += ' · From ' + (d.dnNo || 'Delivery Note');
  issueInvoiceStep(2);
}
function permState(level, isAdmin){
  if (level === 'all') return { ok: true, why: '' };
  if (level === 'admin') return isAdmin ? { ok: true, why: '' } : { ok: false, why: 'Your role doesn\'t have the Special Right for this (Administration → Roles & Permissions).' };   // V270.4.3: isAdmin = has the right
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
    delivery: s.deliveryLines ? { ok: true, line: `<small>Ready to invoice</small><b>${invMoney(s.deliveryValue)}</b><small>${s.deliveryLines} line${s.deliveryLines > 1 ? 's' : ''}</small>` } : { ok: false, line: '<small>Nothing accepted is waiting to be invoiced</small>' },
    order: s.orderLines ? { ok: true, line: `<small>Not yet invoiced</small><b>${invMoney(s.orderGoods)}</b><small>${s.orderLines} line${s.orderLines > 1 ? 's' : ''}</small>` } : { ok: false, line: '<small>Every line is already invoiced</small>' },
    advance: s.room > 0.004 ? { ok: true, line: `<small>Still billable</small><b>${invMoney(s.room)}</b><small>on this order</small>` } : { ok: false, line: '<small>The whole order value is already billed</small>' },
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
  m.querySelector('.modal').classList.toggle('inv-step1', !two);
  document.getElementById('ii-step-type').hidden = two; document.getElementById('ii-step-form').hidden = !two;
  document.getElementById('ii-continue').hidden = two; document.getElementById('ii-save').hidden = !two; document.getElementById('ii-back').hidden = !two;
  document.getElementById('ii-footer-note').style.visibility = two ? 'visible' : 'hidden';
  if (!two) document.getElementById('ii-footer-note').innerHTML = '';
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
    : t === 'delivery' && m._fromDn ? `Prefilled with the quantities accepted on ${m._fromDn.dnNo} (within what is still uninvoiced). Use "All available" to include other accepted deliveries.`
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
      return `<div class="inv-line-row"><span class="muted">${i + 1}</span><span class="desc">${invEsc(s.line.desc || '—')}</span><span class="num muted">${formatQuantity(s.ordered)}</span><span class="num">${formatQuantity(s.accepted)}</span><span class="num">${formatQuantity(s.invoiced)}${s.invoicedAhead > 0 ? `<small class="inv-ahead">${formatQuantity(s.invoicedAhead)} ahead</small>` : ''}</span><span class="num inv-avail">${formatQuantity(avail)}</span><span><input class="bc-num-input bc-spin" id="ii-qty-${i}" type="number" min="0" max="${avail}" step="${qtyStep(s.line.uom)}" value="${t === 'delivery' ? issueInvoiceDefaultQty(m, s, avail) : 0}" oninput="recalcIssueInvoice()" aria-label="Invoice quantity"></span><span class="muted">${invEsc(s.line.uom || '—')}</span><span class="num">${documentMoney('customerInvoice', 'unitPrice', s.up)}</span><span class="num strong" id="ii-amt-${i}">—</span></div>`;
    }).join('');
  }
  const empty = !rows.length;
  document.getElementById('ii-empty').hidden = !empty;
  document.getElementById('ii-empty-text').textContent = t === 'delivery' ? 'No customer-accepted quantity is waiting to be invoiced.' : 'Everything on this order has already been invoiced.';
  grid.hidden = empty;
}
function issueInvoiceDefaultQty(m, s, avail){
  if (!m._fromDn) return avail;
  const a = m._fromDn.accepted[s.lineId] || 0;
  return roundQtyForUom(Math.max(0, Math.min(avail, a)), s.line.uom);
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
  const out = { type: m._type, errors: [], checks: [] };
  const zoho = issueInvoiceZohoCheck(C);
  if (m._type === 'advance') {
    const method = issueAdvanceMethod();
    const lineIds = (m._rows || []).filter((s, i) => document.getElementById('ii-sel-' + i)?.checked).map(s => s.lineId);
    out.advance = { method, percent: Number(document.getElementById('ii-adv-pct').value), lineIds };
    try { out.priced = C.priceAdvance(so, m._ledger, out.advance); }
    catch (e) { out.errors.push(e.message); }
    out.checks.push({ ok: !!(out.priced && out.priced.amount > 0), text: 'Advance amount' });
    out.checks.push(zoho.check); if (zoho.error) out.errors.push(zoho.error);
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
  out.checks.push({ ok: lines.length > 0, text: 'Invoice quantity' });
  out.checks.push(zoho.check); if (zoho.error) out.errors.push(zoho.error);
  if (m._type === 'order') out.checks.push({ ok: document.getElementById('ii-reason').value.trim().length >= 3, text: 'Reason for billing ahead' });
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
/** Zoho invoice number: required and not used on another invoice (the server and the rules check again). */
function issueInvoiceZohoCheck(C){
  const el = document.getElementById('ii-zoho'), msg = document.getElementById('ii-zoho-msg');
  const z = el.value.trim(), key = C.normalizeZohoNo(z);
  const dup = key ? invoicesCache.find(i => i.zohoNo && C.normalizeZohoNo(i.zohoNo) === key) : null;
  const error = !z ? 'Enter the Zoho invoice number.' : dup ? `Zoho invoice no. ${z} is already used on ${dup.invNo}${dup.soNo ? ' (' + dup.soNo + ')' : ''}.` : '';
  el.classList.toggle('is-invalid', !!dup);
  msg.hidden = !dup; msg.innerHTML = dup ? '<i class="ti ti-alert-circle"></i> Already used on ' + invEsc(dup.invNo) + (dup.soNo ? ' · ' + invEsc(dup.soNo) : '') : '';
  return { error, check: { ok: !!z && !dup, text: dup ? 'Zoho invoice no. (already used)' : 'Zoho invoice no.' } };
}
/** Footer checklist: tells the user exactly what is still needed before the save button becomes active. */
function invReadyHtml(checks, doneText){
  const todo = checks.filter(c => !c.ok);
  if (!todo.length) return `<span class="inv-ready-done"><i class="ti ti-circle-check-filled"></i>${invEsc(doneText)}</span>`;
  return `<span class="inv-ready-lead">To continue:</span>` + checks.map((c, i) => `<span class="inv-ready-item ${c.ok ? 'ok' : 'todo'}"><b>${c.ok ? '✓' : i + 1}</b>${invEsc(c.text)}</span>`).join('');
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
  const show = r.errors.filter(x => !/at least one invoice quantity|reason for billing ahead|zoho invoice n/i.test(x));
  err.hidden = !show.length; err.innerHTML = show.map(x => '<i class="ti ti-alert-circle"></i> ' + invEsc(x)).join('<br>');
  document.getElementById('ii-save').disabled = r.errors.length > 0;
  document.getElementById('ii-footer-note').innerHTML = invReadyHtml(r.checks || [], 'Ready — check the summary, then create the invoice');
  document.getElementById('ii-save').title = r.errors.length ? r.errors[0] : '';
  document.getElementById('ii-save-text').textContent = r.type === 'advance' ? 'Create Advance Invoice' : r.type === 'order' ? 'Create Order Invoice' : 'Create Delivery Invoice';
  m._preview = r;
}
/** Second confirmation before an invoice or credit note is saved (they cannot be edited or deleted afterwards). */
function invConfirm({ title, message, details, confirmText, confirmClass = 'btn-primary', icon = '🧾' }){
  return new Promise(resolve => {
    let done = false; const finish = v => { if (!done) { done = true; resolve(v); } };
    showConfirm({ icon, title, message, details, confirmText, confirmClass, cancelText: 'Go back', onConfirm: () => finish(true), onCancel: () => finish(false) });
  });
}
async function saveIssueInvoice(){
  const m = document.getElementById('inv-issue-modal'); if (!m || !m._soId || !m._type) return null;
  const so = salesOrders.find(x => x.id === m._soId);
  const r = readIssueInvoice();
  if (r.errors.length) { showToast(r.errors[0], 'error', 'Check the Invoice'); return null; }
  const total = r.type === 'advance' ? (r.priced ? r.priced.amount + r.priced.vat : 0)
    : (() => { const g = r.goods || {}; const vatPct = Math.round((Number(so.vatRate) >= 0 ? Number(so.vatRate) : 0.15) * 100); const ded = invNum(r.deduction); return Math.round(((g.goodsSubtotal || 0) - ded + (g.goodsVat || 0) - Math.round(ded * vatPct) / 100) * 100) / 100; })();
  const details = {
    'Invoice type': invEsc(INV_TYPE_INFO[r.type].title), 'Sales Order': invEsc(so.soNo), 'Customer': invEsc(so.customer || '—'),
    'Zoho invoice no.': '<b>' + invEsc(document.getElementById('ii-zoho').value.trim()) + '</b>', 'Invoice date': fmtDate(document.getElementById('ii-date').value),
  };
  if (r.type === 'advance') details['Advance'] = invEsc(r.priced ? `${formatNumber(r.priced.percent, 2)}% of ${formatNumber(r.priced.base, 2)}` : '—');
  else { details['Lines'] = String(r.lines.length); if (invNum(r.deduction) > 0) details['Less: advance'] = '− ' + invMoney(r.deduction); }
  details['Total incl. VAT'] = '<b>' + invMoney(total) + '</b>';
  const ok = await invConfirm({ title: `Create ${INV_TYPE_INFO[r.type].title.split(' — ')[0].toLowerCase()}?`, message: 'Please check the details. Once saved, the invoice cannot be edited or deleted. Corrections are made with a credit note.', details, confirmText: 'Yes, create invoice' });
  if (!ok) return null;
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
    reason: document.getElementById('ii-reason').value.trim(), numbering: { counterKey: x.counterKey, displayPrefix: x.displayPrefix, digits: x.digits, floor: x.floor },
    ...(m._reissueOf ? { reissueOf: m._reissueOf } : {}),
  };
  if (r.type === 'advance') input.advance = r.advance; else { input.lines = r.lines; if (r.limits && r.limits.remaining > 0.004) input.deduction = r.deduction; }
  try {
    const res = await window.BizCoreInv.service.issueInvoice(input);
    upsertInvoiceCache(res.invoice); refreshAfterInvoiceChange();
    closeModal('inv-issue-modal');
    showToast(res.alreadyApplied ? `${res.invoice.invNo} was already saved.` : `${invTypeShort(res.invoice.type)} invoice ${res.invoice.invNo} created`, res.alreadyApplied ? 'info' : 'success');
    if (typeof renderSOPage === 'function') renderSOPage();
    // Show the saved invoice; Back returns to the (refreshed) Sales Order.
    if (typeof viewSO === 'function') viewSO(so.id);
    openInvoiceView(res.invoice.id);
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
        <div class="so-items-help">Enter the quantity to credit on each line (at most the quantity still on the invoice), or use <b>Credit all</b>.</div>
        <div class="inv-grid-scroll inv-grid-credit"><div class="inv-line-head"><span>#</span><span>Item / Description</span><span class="num">Invoiced</span><span class="num">Credited</span><span class="num">Can Credit</span><span class="num">Credit Qty</span><span>UOM</span><span class="num">Unit Price</span><span class="num">Amount</span></div><div id="cn-lines"></div></div>
      </section>
      <section class="so-entry-card" id="cn-amount-wrap" hidden><div class="so-entry-card-title"><i class="ti ti-cash"></i>Advance to Credit</div>
        <div class="inv-advance-row"><div class="form-group"><label>Amount (before VAT)</label><div class="inv-input-prefix"><span>SAR</span><input id="cn-amount" class="bc-num-input" type="number" min="0" step="0.01" oninput="recalcCreditNote()"/></div></div><div class="inv-advance-base" id="cn-amount-help"></div></div>
      </section>
      <div class="so-bottom-grid">
        <section class="so-entry-card"><div class="so-entry-card-title"><i class="ti ti-info-circle"></i>Good to know</div><div class="cn-paid-note" id="cn-paid-note" role="note" hidden></div><div class="inv-note-text" id="cn-note"></div></section>
        <section class="so-entry-card so-summary-card"><div class="so-entry-card-title"><i class="ti ti-calculator"></i>Credit Note Summary</div><div id="cn-summary"></div></section>
      </div>
      <div id="cn-error" class="inv-error" hidden></div>
    </div>
    <div class="modal-footer"><div class="inv-ready" id="cn-ready" aria-live="polite"></div>
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
  const p = permState(settings.allowCreditNotes, (typeof window.bcRight === 'function' ? window.bcRight('creditNotes') : !!window.BizCoreInv.isAdministrator));
  if (!p.ok) { showToast('Only an administrator may issue credit notes (Administration → Billing Settings).', 'warning', 'Not Allowed'); return false; }
  if (inv.status === 'Credited') { showToast(inv.invNo + ' is already fully credited.', 'info'); return false; }
  if (!navigator.onLine) { showToast('Credit notes are saved directly to the cloud database. Please reconnect and try again.', 'error', 'Offline'); return false; }
  let ledger;
  try { ledger = await window.BizCoreInv.getLedger(soId); } catch (e) { showToast('Could not read the latest order balances. Please try again.', 'error'); return false; }
  const C = invLib(), m = ensureCreditNoteModal();
  Object.assign(m, { _soId: soId, _invoiceId: invoiceId, _invoice: inv, _ledger: ledger, _opId: newDeliveryOperationId('credit', soId), _reissue: null });
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
    document.getElementById('cn-lines').innerHTML = m._lines.map((l, i) => `<div class="inv-line-row"><span class="muted">${i + 1}</span><span class="desc">${invEsc(l.desc || '—')}</span><span class="num muted">${formatQuantity(l.qty)}</span><span class="num">${formatQuantity(l.qty - l.creditable)}</span><span class="num inv-avail">${formatQuantity(l.creditable)}</span><span><input class="bc-num-input bc-spin" id="cn-qty-${i}" type="number" min="0" max="${l.creditable}" step="${qtyStep(l.uom)}" value="0" oninput="recalcCreditNote()" aria-label="Credit quantity"></span><span class="muted">${invEsc(l.uom || '—')}</span><span class="num">${documentMoney('customerInvoice', 'unitPrice', l.up)}</span><span class="num strong" id="cn-amt-${i}">—</span></div>`).join('');
    document.getElementById('cn-note').textContent = (inv.totals?.deductionSubtotal > 0 ? 'The advance deducted on this invoice is given back in proportion to the goods credited, so it can be deducted again later. ' : '')
      + (inv.type === 'delivery' ? 'A credit note does not change the delivery records or the stock. The Delivery Note stays as the customer signed it.' : 'The credited quantity can be invoiced again later.');
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
  const out = { errors: [], checks: [] };
  if (inv.type === 'advance') { out.amount = Math.round(invNum(document.getElementById('cn-amount').value) * 100) / 100; out.checks.push({ ok: out.amount > 0, text: 'Amount to credit' }); }
  else {
    out.lines = [];
    (m._lines || []).forEach((l, i) => {
      const e = document.getElementById('cn-qty-' + i); if (!e) return;
      let q = roundQtyForUom(e.value, l.uom); q = Math.max(0, Math.min(l.creditable, q));
      e.classList.toggle('has-value', q > 0);
      const amt = document.getElementById('cn-amt-' + i); if (amt) amt.textContent = documentMoney('customerInvoice', 'lineAmount', q * l.up);
      if (q > 0) out.lines.push({ lineId: l.lineId, qty: q });
    });
    out.checks.push({ ok: out.lines.length > 0, text: 'Quantity to credit' });
    if (!out.lines.length) out.errors.push('Enter at least one quantity to credit.');
  }
  if (!out.errors.length) {
    try { out.built = C.buildCreditNote(inv, m._ledger, inv.type === 'advance' ? { amount: out.amount } : { lines: out.lines }); }
    catch (e) { out.errors.push(e.message); }
  }
  const reasonOk = document.getElementById('cn-reason').value.trim().length >= 3;
  out.checks.push({ ok: reasonOk, text: 'Reason' });
  if (!reasonOk) out.errors.push('Enter the reason for the credit note.');
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
  else if (m._invoice.type === 'advance') html = row('Advance credited (ex-VAT)', invMoney(n ? n.advanceSubtotal : 0), 'so-summary-row muted');
  else html = row('Goods credited (ex-VAT)', invMoney(0), 'so-summary-row muted');
  html += '<div class="so-summary-divider"></div>' + row('Subtotal', invMoney(n ? n.subtotal : 0)) + row('VAT', invMoney(n ? n.vat : 0))
    + `<div class="so-summary-total"><span>TOTAL CREDIT</span><span>${documentMoney('customerInvoice', 'grandTotal', n ? n.total : 0)}</span></div>`;
  document.getElementById('cn-summary').innerHTML = html;
  // V270.4.6: the invoice is already (partly) paid → say what the credit leaves owed to the customer.
  const pn = document.getElementById('cn-paid-note');
  if (pn) {
    const inv = m._invoice, paid = typeof invoicePaidOf === 'function' ? invNum(invoicePaidOf(inv)) : 0;
    const net = typeof invoiceNetOf === 'function' ? invNum(invoiceNetOf(inv)) : invNum(inv.totals && inv.totals.total);
    const credit = n ? invNum(n.total) : 0, owed = Math.round((paid - (net - credit)) * 100) / 100;
    pn.hidden = !(paid > 0.004);
    if (!pn.hidden) pn.innerHTML = `<i class="ti ti-cash"></i><span><strong>${invEsc(inv.invNo)} is ${paid >= net - 0.004 ? 'paid' : 'partly paid'}</strong> — ${invMoney(paid)} received.`
      + (owed > 0.004 ? ` After this credit note <strong>${invMoney(owed)}</strong> is owed to the customer: keep it as customer credit (edit the receipt to apply it to another invoice) or refund it.`
        : ` After this credit note the balance due is ${invMoney(Math.max(0, -owed))}.`) + `</span>`;
  }
  const err = document.getElementById('cn-error');
  const show = r.errors.filter(x => !/at least one quantity|reason for the credit/i.test(x));
  err.hidden = !show.length; err.innerHTML = show.map(x => '<i class="ti ti-alert-circle"></i> ' + invEsc(x)).join('<br>');
  document.getElementById('cn-save').disabled = r.errors.length > 0;
  document.getElementById('cn-save').title = r.errors.length ? r.errors[0] : '';
  document.getElementById('cn-ready').innerHTML = invReadyHtml(r.checks || [], 'Ready — check the summary, then issue the credit note');
}
async function saveCreditNote(){
  const m = document.getElementById('cn-issue-modal'); if (!m || !m._invoice) return null;
  const r = readCreditNote();
  if (r.errors.length) { showToast(r.errors[0], 'error', 'Check the Credit Note'); return null; }
  const inv = m._invoice, n = r.built && r.built.note;
  const details = { 'Against invoice': invEsc(inv.invNo) + ' · ' + fmtDate(inv.date), 'Customer': invEsc(inv.customer || '—'), 'Sales Order': invEsc(inv.soNo || '—'),
    'Credit note date': fmtDate(document.getElementById('cn-date').value), 'Reason': invEsc(document.getElementById('cn-reason').value.trim()) };
  if (inv.type === 'advance') details['Advance credited'] = invMoney(r.amount); else details['Lines'] = String(r.lines.length);
  details['Total credit incl. VAT'] = '<b>' + invMoney(n ? n.total : 0) + '</b>';
  const ok = await invConfirm({ icon: '↩️', title: 'Issue credit note?', message: `Please check the details. Once saved, the credit note cannot be edited or deleted, and ${invEsc(inv.invNo)} will show it as credited.`, details, confirmText: 'Yes, issue credit note', confirmClass: 'btn-danger' });
  if (!ok) return null;
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
    expectedRevision: inv.revision, numbering: { counterKey: x.counterKey, displayPrefix: x.displayPrefix, digits: x.digits, floor: x.floor } };
  if (inv.type === 'advance') input.amount = r.amount; else input.lines = r.lines;
  try {
    const res = await window.BizCoreInv.service.issueCreditNote(input);
    upsertCreditNoteCache(res.creditNote); if (res.invoice) upsertInvoiceCache(res.invoice); refreshAfterInvoiceChange();
    closeModal('cn-issue-modal');
    showToast(res.alreadyApplied ? `${res.creditNote.cnNo} was already saved.` : `Credit note ${res.creditNote.cnNo} issued against ${inv.invNo}`, res.alreadyApplied ? 'info' : 'success');
    if (typeof renderSOPage === 'function') renderSOPage();
    // V266.3 Cancel and re-issue: continue with the new invoice, prefilled from the cancelled one
    if (m._reissue) {
      const old = m._reissue; m._reissue = null;
      setTimeout(() => { if (typeof viewSO === 'function') viewSO(m._soId); openCreateInvoice(m._soId, { reissue: old }); }, 50);
      return res.creditNote;
    }
    // Show the saved credit note; Back returns to the (refreshed) Sales Order.
    if (typeof viewSO === 'function') viewSO(m._soId);
    openCreditNoteView(res.creditNote.id);
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
  const settings = window.BizCoreInv.settings, canCredit = permState(settings.allowCreditNotes, (typeof window.bcRight === 'function' ? window.bcRight('creditNotes') : !!window.BizCoreInv.isAdministrator)).ok;
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
  return (goodsLeft && permState(settings.allowOrderInvoices, (typeof window.bcRight === 'function' ? window.bcRight('orderInvoices') : !!window.BizCoreInv.isAdministrator)).ok) || (room && permState(settings.allowAdvanceInvoices, (typeof window.bcRight === 'function' ? window.bcRight('advanceInvoices') : !!window.BizCoreInv.isAdministrator)).ok);
}

/* ═══════════════════════════════════════════════════════════════════
   INVOICE / CREDIT NOTE VIEW + PRINT (V264.6)
   Same arrangement as the Delivery Note and Quotation views: the A4 document on the left, an information
   panel on the right, an action bar at the bottom. The document reuses the Delivery Note layout (header,
   boxes, reference strip, items table, signatures, footer) with its own accent colour for quick
   identification: teal for invoices, red for credit notes. The same builder produces the printed copy.
═══════════════════════════════════════════════════════════════════ */
let _invDnBaseCss = null;
/** The Delivery Note document stylesheet (one source of truth for the A4 layout). */
function invDnBaseCss(){
  if (_invDnBaseCss !== null) return _invDnBaseCss;
  try {
    const h = buildDeliveryNoteDocument({ id: '', items: [], deliveries: [] }, { id: '', items: [], dnNo: '', date: '' }, 0, 'standard', false);
    const m = /<style>([\s\S]*?)<\/style>/.exec(h); _invDnBaseCss = m ? m[1] : '';
  } catch (e) { _invDnBaseCss = ''; }
  return _invDnBaseCss;
}
const INV_DOC_CSS = `
.inv-a4{--ia:#0f766e;--ia-soft:#9fd6cd;--ia-tint:#effaf7;--ia-ink:#134e48}
.inv-a4.inv-cn{--ia:#b42318;--ia-soft:#f3b8b2;--ia-tint:#fef3f2;--ia-ink:#7a1a12}
.inv-a4 .dn-head{border-bottom-color:var(--ia)}
.inv-a4 .dn-titlebox{border-color:var(--ia-soft)}
.inv-a4 .dn-titlebox h1{background:var(--ia);color:#fff;font-size:19px;font-weight:700}
.inv-a4 .dn-titlebox h1 span{display:block;font-size:10px;font-weight:700;letter-spacing:0;opacity:.9;margin-top:1px;font-family:Tahoma,Arial,sans-serif}
.inv-a4 .dn-titlebox div{border-top-color:var(--ia-soft)}
.inv-a4 .dn-box{border-color:var(--ia-soft)}
.inv-a4 .dn-box h3{color:var(--ia);background:var(--ia-tint);border-bottom-color:var(--ia-soft)}
.inv-a4 .dn-ref>div{background:var(--ia-tint);border-color:var(--ia-soft)}
.inv-a4 .dn-items th{background:var(--ia);border-color:var(--ia)}
.inv-a4 .dn-items .num{text-align:right}
.inv-a4 .dn-items th{font-size:8.5px!important;font-weight:700!important;text-transform:uppercase!important;letter-spacing:.04em!important;line-height:1.25!important;padding:7px 6px!important;white-space:nowrap;vertical-align:middle}
.inv-a4 .dn-items td{font-size:9.5px!important;line-height:1.35!important;padding:6px 6px!important;vertical-align:top}
.inv-a4 .dn-items th.num{text-align:right}
.inv-a4 .dn-items td.desc{white-space:normal}
.inv-a4 .dn-items td.c{text-align:center}
.inv-a4 .dn-items td small{display:block;color:#b42318;font-size:8px;margin-top:2px}
.inv-a4 .dn-foot{border-top-color:var(--ia)}
.inv-a4 .dn-subtitle{color:var(--ia-ink)}
.inv-doc-sum{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:12px;margin-top:10px;align-items:start}
.inv-doc-notes{border:1px solid #cbd8e5;padding:8px 9px;font-size:9.5px;line-height:1.5;color:#3b5068;min-height:60px}
.inv-doc-notes b{display:block;font-size:8px;text-transform:uppercase;color:var(--ia);margin-bottom:3px}
.inv-doc-notes p{margin:0 0 6px}.inv-doc-notes p:last-child{margin:0}
.inv-doc-totals{border:1px solid #cbd8e5;border-radius:4px;overflow:hidden}
.inv-doc-totals>div{display:flex;justify-content:space-between;align-items:baseline;gap:14px;padding:7px 11px;border-bottom:1px solid #edf0f3;font-size:10.5px}
.inv-doc-totals>div:last-child{border-bottom:0}
.inv-doc-totals span{color:#65748a}
.inv-doc-totals strong{color:#26384a;font-weight:700;white-space:nowrap;font-variant-numeric:tabular-nums}
.inv-doc-totals .ded span,.inv-doc-totals .ded strong{color:#9a3412}
.inv-doc-totals .sub{background:#f8fafc}.inv-doc-totals .sub span{color:#26384a;font-weight:700}
.inv-doc-totals .grand{background:var(--ia);padding:10px 11px;border-bottom:0}
.inv-doc-totals .grand span,.inv-doc-totals .grand strong{color:#fff;font-weight:800}
.inv-doc-totals .grand strong{font-size:13px}
.inv-doc-credited{margin-top:6px;font-size:9px;color:#b42318;text-align:right}
.inv-status-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:999px;font-size:9.5px;font-weight:800;white-space:nowrap}
.inv-status-chip i{font-style:normal;width:7px;height:7px;border-radius:50%;background:currentColor}
.inv-status-chip.issued{color:#0f766e;background:#ccfbef}.inv-status-chip.partial{color:#6941c6;background:#eee7ff}.inv-status-chip.credited{color:#b42318;background:#fee4e2}
@media print{.inv-status-row{display:none!important}}
`;
function invDocStatusChip(status){
  const cls = status === 'Credited' ? 'credited' : /partial/i.test(status || '') ? 'partial' : 'issued';
  return `<div class="dn-screen-status-row inv-status-row"><span class="inv-status-chip ${cls}"><i></i>${invEsc(status || 'Issued')}</span></div>`;
}
function invCustomerVat(custName, custId){
  const c = (typeof customers !== 'undefined' ? customers : []).find(x => (custId && x.id === custId) || (x.company || '').trim() === (custName || '').trim());
  return c ? { vat: c.vat || '', nameAr: c.companyAr || '' } : { vat: '', nameAr: '' };
}
/** A4 document for an invoice (kind 'invoice') or a credit note (kind 'credit'). */
function invoiceDocumentHtml(doc, kind, screenMode){
  const cn = kind === 'credit';
  const so = salesOrders.find(x => x.id === doc.salesOrderId) || { id: doc.salesOrderId, soNo: doc.soNo, customer: doc.customer, customerId: doc.custId, poNo: doc.poNo, items: [] };
  const cp = dnCompanyProfile(), cust = dnCustomerProfile(so), cv = invCustomerVat(doc.customer, doc.custId);
  const inv = cn ? (invoicesCache.find(i => i.id === doc.invoiceId) || {}) : doc;
  const q = quotations.find(x => x.id === (inv.quotationId || so.quotationId));
  const n2 = v => formatNumber(invNum(v), 2);
  const logo = cp.logo ? `<img src="${cp.logo}" alt="${invEsc(cp.name)}" style="max-width:260px;max-height:78px;width:auto;height:auto;object-fit:contain">`
    : `<div style="font-size:23px;font-weight:900;color:#174b7a">${invEsc(cp.name)}</div>${cp.nameAr ? `<div dir="rtl" style="font-size:15px;font-weight:700;color:#174b7a;margin-top:3px">${invEsc(cp.nameAr)}</div>` : ''}`;
  const contactParts = [cp.pobox ? `P.O. Box ${invEsc(cp.pobox)}` : '', cp.address ? invEsc(cp.address) : '', cp.phone ? `Tel: ${invEsc(cp.phone)}` : '', cp.email ? invEsc(cp.email) : '', cp.website ? invEsc(cp.website) : ''].filter(Boolean);
  const contact = contactParts.join('<br>') + (cp.vat ? `<br><b>VAT No.:</b> ${invEsc(cp.vat)}` : '') + (cp.cr ? `<br><b>CR No.:</b> ${invEsc(cp.cr)}` : '');
  const no = cn ? doc.cnNo : doc.invNo;
  const title = cn ? 'CREDIT NOTE<span>إشعار دائن</span>' : 'TAX INVOICE<span>فاتورة ضريبية</span>';
  const subtitle = cn ? `AGAINST INVOICE ${invEsc(doc.invNo)}` : { advance: 'ADVANCE INVOICE', order: 'ORDER INVOICE — BILLED AHEAD OF DELIVERY', delivery: 'DELIVERY INVOICE — ACCEPTED GOODS' }[doc.type] || 'INVOICE';
  const refs = cn
    ? [['Credit Note Date', fmtDate(doc.date)], ['Original Invoice', invEsc(doc.invNo)], ['Invoice Date', fmtDate(doc.invoiceDate)], ['Sales Order No.', invEsc(doc.soNo || '—')]]
    : [['Sales Order No.', invEsc(doc.soNo || '—')], ['Customer PO No.', invEsc(doc.poNo || so.poNo || '—')], ['Payment Due', fmtDate(doc.dueDate) || '—'], [doc.zohoNo ? 'Zoho Invoice No.' : 'Quotation', invEsc(doc.zohoNo || (q && q.qno) || '—')]];
  // Lines
  let head, rows;
  if (!cn && doc.type === 'advance') {
    const a = doc.advance || {};
    const basis = a.method === 'full' ? 'full order value' : `${formatNumber(a.percent, 2)}% of ${a.method === 'percentLines' ? 'selected lines' : 'order value'} (${n2(a.base)})`;
    head = '<th>#</th><th>Description</th><th class="num">VAT %</th><th class="num">Amount (SAR)</th>';
    rows = `<tr><td class="c">1</td><td class="desc">Advance payment against Sales Order ${invEsc(doc.soNo)} — ${invEsc(basis)}</td><td class="num">${Math.round(invNum(a.vatRate) * 100)}%</td><td class="num">${n2(doc.totals && doc.totals.subtotal)}</td></tr>`;
  } else if (cn && doc.kind === 'advance') {
    head = '<th>#</th><th>Description</th><th class="num">VAT %</th><th class="num">Amount (SAR)</th>';
    rows = `<tr><td class="c">1</td><td class="desc">Advance credited — invoice ${invEsc(doc.invNo)} dated ${fmtDate(doc.invoiceDate)}</td><td class="num">${Math.round(invNum(doc.vatRate || (inv.advance || {}).vatRate || 0.15) * 100)}%</td><td class="num">${n2(doc.advanceSubtotal)}</td></tr>`;
  } else {
    const credited = (!cn && doc.credited && doc.credited.lines) || {};
    head = '<th>#</th><th>Item Code</th><th>Description</th><th class="num">Qty</th><th>UOM</th><th class="num">Unit Price</th><th class="num">VAT %</th><th class="num">Amount (SAR)</th>';
    rows = (doc.lines || []).map((l, i) => `<tr><td class="c">${i + 1}</td><td>${invEsc(l.code || '—')}</td><td class="desc">${invEsc(l.desc || '—')}${credited[l.lineId] ? `<small>${formatQuantity(credited[l.lineId])} credited</small>` : ''}</td><td class="num">${formatQuantity(l.qty)}</td><td>${invEsc(l.uom || '—')}</td><td class="num">${n2(l.up)}</td><td class="num">${Math.round(invNum(l.vatRate) * 100)}%</td><td class="num">${n2(l.subtotal)}</td></tr>`).join('');
  }
  // Totals
  const tr = (k, v, cls = '') => `<div${cls ? ` class="${cls}"` : ''}><span>${k}</span><strong>${v}</strong></div>`;
  let totals = '';
  if (cn) {
    const goods = doc.kind === 'advance' ? invNum(doc.advanceSubtotal) : invNum(doc.goodsSubtotal);
    totals += tr(doc.kind === 'advance' ? 'Advance credited (ex-VAT)' : 'Goods credited (ex-VAT)', n2(goods));
    (doc.deductionReversal || []).forEach(d => { totals += tr(`Less: advance ${invEsc(d.advanceInvNo)} given back`, '− ' + n2(d.subtotal), 'ded'); });
    totals += tr('Subtotal (ex-VAT)', n2(doc.subtotal), 'sub') + tr('VAT', n2(doc.vat)) + tr('Total credited (SAR)', n2(doc.total), 'grand');
  } else {
    const t = doc.totals || {};
    if (doc.type !== 'advance') {
      totals += tr('Goods (ex-VAT)', n2(t.goodsSubtotal));
      (doc.deductions || []).forEach(d => { totals += tr(`Less: advance ${invEsc(d.advanceInvNo)} dated ${fmtDate(d.advanceDate)}`, '− ' + n2(d.subtotal), 'ded'); });
    }
    totals += tr('Subtotal (ex-VAT)', n2(t.subtotal), 'sub') + tr('VAT', n2(t.vat)) + tr('Total (SAR)', n2(t.total), 'grand');
  }
  const creditedLine = !cn && (doc.creditNotes || []).length ? `<div class="inv-doc-credited">Credited by ${(doc.creditNotes || []).map(c => `${invEsc(c.cnNo)} (${n2(c.total)})`).join(', ')}</div>` : '';
  const notes = [cn ? `<p><b>Reason</b>${invEsc(doc.reason || '—')}</p>` : '', !cn && doc.reason ? `<p><b>${doc.type === 'order' ? 'Billed ahead because' : 'Description'}</b>${invEsc(doc.reason)}</p>` : '', !cn && doc.notes ? `<p><b>Notes</b>${invEsc(doc.notes)}</p>` : '',
    !cn && doc.type === 'advance' ? '<p><b>Advance</b>This advance will be deducted from the following invoices for this order.</p>' : ''].filter(Boolean).join('') || '<p><b>Notes</b>—</p>';
  const billTo = `<strong>${invEsc(doc.customer || cust.name)}</strong>${cv.nameAr ? `<div dir="rtl">${invEsc(cv.nameAr)}</div>` : ''}${cust.address ? invEsc(cust.address) : ''}${cust.contact ? `<br>Attn: ${invEsc(cust.contact)}` : ''}${cust.phone ? `<br>Tel: ${invEsc(cust.phone)}` : ''}`;
  return `<div class="dn-a4 inv-a4${cn ? ' inv-cn' : ''}${screenMode ? ' dn-a4-screen' : ''}"><style>${invDnBaseCss()}${INV_DOC_CSS}</style>
  <div class="dn-head"><div>${logo}</div><div class="dn-contact">${contact || '&nbsp;'}</div><div class="dn-title-stack">${screenMode ? invDocStatusChip(cn ? 'Issued' : doc.status) : ''}<div class="dn-titlebox"><h1>${title}</h1><div><small>${cn ? 'Credit Note No.' : 'Invoice No.'}</small><strong>${invEsc(no || '—')}</strong></div><div><small>Date</small><strong>${fmtDate(doc.date)}</strong></div></div></div></div>
  <div class="dn-subtitle">${subtitle}</div>
  <div class="dn-two"><div class="dn-box"><h3>Bill To</h3><div class="content">${billTo}</div></div><div class="dn-box"><h3>Customer VAT / Seller</h3><div class="content"><strong>Customer VAT No.: ${invEsc(cv.vat || '—')}</strong>${invEsc(cp.name)}${cp.vat ? `<br>Seller VAT No.: ${invEsc(cp.vat)}` : ''}${cp.cr ? `<br>CR No.: ${invEsc(cp.cr)}` : ''}</div></div></div>
  <div class="dn-ref">${refs.map(([k, v]) => `<div><small>${k}</small><strong>${v}</strong></div>`).join('')}</div>
  <table class="dn-items"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>
  <div class="inv-doc-sum"><div class="inv-doc-notes">${notes}</div><div><div class="inv-doc-totals">${totals}</div>${creditedLine}</div></div>
  <div class="dn-bottom"><div class="dn-sign"><h4>Prepared By</h4><div>Name: ${invEsc(doc.createdBy || '________________')}<br>Date: ${fmtDate(doc.date)}<br>Signature: <span class="dn-line"></span></div></div><div class="dn-sign"><h4>${cn ? 'Acknowledged By (Customer)' : 'Received By (Customer)'}</h4><div>Name: ________________<br>Date: ________________<br>Signature: <span class="dn-line"></span></div></div><div class="dn-doc-qr-slot"></div></div>
  <div class="dn-foot"><div>${contactParts.join(' &nbsp; | &nbsp; ')}</div></div></div>`;
}

function ensureInvoiceViewModal(){
  let m = document.getElementById('inv-view-modal');
  if (m) return m;
  m = document.createElement('div');
  m.className = 'modal-overlay'; m.id = 'inv-view-modal';
  m.innerHTML = `<div class="modal modal-normal">
    <div class="modal-header"><h2 id="inv-view-title">Invoice</h2><button class="close-btn" onclick="closeViewWithReturn('inv-view-modal')">✕</button></div>
    <div class="modal-body" id="inv-view-body" style="padding:0;overflow-y:auto"></div>
    <div class="dn-view-actionbar" id="inv-view-actions" role="toolbar" aria-label="Invoice actions"></div>
  </div>`;
  document.body.appendChild(m);
  return m;
}
function invViewGo(js){ return `closeModal('inv-view-modal');${js}`; }
/** Builds the right-hand panel and the action bar for an invoice or a credit note. */
function renderInvoiceView(doc, kind){
  const cn = kind === 'credit', m = ensureInvoiceViewModal();
  const so = salesOrders.find(x => x.id === doc.salesOrderId);
  const inv = cn ? invoicesCache.find(i => i.id === doc.invoiceId) : doc;
  const q = so && quotations.find(x => x.id === so.quotationId);
  const cns = cn ? [] : creditNotesCache.filter(c => c.invoiceId === doc.id);
  const n = v => invMoney(v), f = v => formatNumber(invNum(v), 2);
  const row = (k, v) => `<div class="qv-side-row"><span>${k}</span><strong>${v}</strong></div>`;
  const dueText = due => {
    if (!due) return '—';
    const m0 = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(due)); if (!m0) return fmtDate(due);
    const t = new Date(); const today = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    const days = Math.round((new Date(+m0[1], +m0[2] - 1, +m0[3]) - today) / 86400000);
    const when = days === 0 ? 'due today' : days > 0 ? `in ${days} day${days === 1 ? '' : 's'}` : `<span style="color:#b42318">${-days} day${days === -1 ? '' : 's'} overdue</span>`;
    return `${fmtDate(due)} · ${when}`;
  };
  // Summary card: 2 × 2 figures, then a few rows — only what the A4 page does not already show prominently
  let kpis, rows, note = '';
  if (cn) {
    const invCns = inv ? creditNotesCache.filter(c => c.invoiceId === inv.id) : [doc];
    const invCredited = invCns.reduce((s, c) => s + invNum(c.total), 0), invTotal = inv ? invNum((inv.totals || {}).total) : null;
    kpis = [{ label: 'Credit total', value: f(doc.total), tone: 'red' }, { label: 'VAT credited', value: f(doc.vat) },
      { label: 'Invoice total', value: invTotal === null ? '—' : f(invTotal) }, { label: 'Invoice net', value: invTotal === null ? '—' : f(invTotal - invCredited), tone: 'green' }];
    rows = row('Against invoice', invEsc(doc.invNo || '—')) + (invCns.length > 1 ? row('Credit notes on it', String(invCns.length)) : '') + row('Reason', invEsc(doc.reason || '—')) + row('Created by', invEsc(doc.createdBy || '—'));
  } else {
    const t = doc.totals || {}, credited = cns.reduce((s, c) => s + invNum(c.total), 0);
    kpis = [{ label: 'Invoice total', value: f(t.total) }, { label: 'Credited', value: f(credited), tone: credited ? 'red' : 'muted' }];
    if (doc.type === 'advance') {
      const usedBy = invoicesCache.filter(i => (i.deductions || []).some(d => d.advanceInvoiceId === doc.id));
      const deducted = usedBy.reduce((s, i) => s + (i.deductions || []).filter(d => d.advanceInvoiceId === doc.id).reduce((a, d) => a + invNum(d.subtotal), 0), 0);
      kpis.push({ label: 'Deducted so far', value: f(deducted) }, { label: 'Advance left', value: f(Math.max(0, invNum(t.subtotal) - deducted - cns.reduce((s, c) => s + invNum(c.advanceSubtotal), 0))), tone: 'green' });
    } else {
      kpis.push({ label: 'Net after credit', value: f(invNum(t.total) - credited), tone: 'green' }, { label: 'Advance deducted', value: f(t.deductionSubtotal), tone: invNum(t.deductionSubtotal) ? '' : 'muted' });
    }
    rows = row('Status', invStatusBadge(doc.status) || '<span style="background:#ECFDF5;color:#0F766E;border:1px solid #99F6E4;border-radius:10px;padding:1px 8px;font-size:10.5px;font-weight:700">Issued</span>')
      + row('Type', invTypeBadge(doc.type)) + row('Payment due', dueText(doc.dueDate)) + row('Zoho invoice', invEsc(doc.zohoNo || '—')) + row('Created by', invEsc(doc.createdBy || '—'))
      + (doc.editCount ? row('Revised', `${doc.editCount}× · ${invEsc(doc.revisedBy || '')}`) : '');
    note = '<div class="bc-kpi-note"><i class="ti ti-info-circle"></i> Payments are recorded on the Sales Order, not per invoice.</div>';
    // V266: Payment Receipts — Paid / Balance due on the invoice itself
    if (typeof receiptsActive === 'function' && receiptsActive()) {
      const paidAmt = invoicePaidOf(doc), bal = invoiceBalanceOf(doc), pst = invoicePayStatusOf(doc);
      kpis = [kpis[0], kpis[1], { label: 'Paid', value: f(paidAmt), tone: paidAmt > 0.005 ? 'green' : 'muted' }, { label: bal < -0.005 ? 'Overpaid' : 'Balance due', value: f(Math.abs(bal)), tone: bal > 0.005 ? 'red' : 'muted' }];
      rows = row('Payment', rctPayPill(pst)) + rows + (invNum(t.deductionSubtotal) && doc.type !== 'advance' ? row('Advance deducted', f(t.deductionSubtotal)) : '');
      note = bal < -0.005 ? '<div class="bc-kpi-note"><i class="ti ti-alert-triangle"></i> A credit note was issued after payment — the customer has paid more than the invoice now asks.</div>' : '';
    }
  }
  const summary = `${bcKpiGrid(kpis)}<div class="bc-kpi-rows">${rows}</div>${note}`;
  // Document flow (one line): Quotation › Sales Order › (advance) › this document › credit notes
  const flow = [];
  flow.push(q ? { label: 'Quotation', text: q.qno, onclick: invViewGo(`viewQuotation('${q.id}')`) } : { label: 'Quotation', state: 'muted' });
  flow.push(so ? { label: 'Sales order', text: so.soNo, onclick: invViewGo(`viewSO('${so.id}')`) } : (doc.soNo ? { label: 'Sales order', text: doc.soNo } : { label: 'Sales order', state: 'muted' }));
  if (!cn) (doc.deductions || []).forEach(d => flow.push({ label: `Advance deducted · ${n(d.subtotal)}`, tag: 'Adv.', text: d.advanceInvNo, onclick: `openInvoiceView('${d.advanceInvoiceId}')` }));
  if (cn && inv) flow.push({ label: inv.type === 'advance' ? 'Advance invoice' : 'Invoice', text: inv.invNo, onclick: `openInvoiceView('${inv.id}')` });
  flow.push({ label: cn ? 'Credit note' : (doc.type === 'advance' ? 'Advance invoice' : 'Invoice'), text: cn ? doc.cnNo : doc.invNo, state: 'current' });
  cns.forEach(c => flow.push({ label: `Credit note · − ${n(c.total)}`, text: c.cnNo, cls: 'cn', onclick: `openCreditNoteView('${c.id}')` }));
  if (!cn && typeof receiptsForInvoice === 'function') receiptsForInvoice(doc.id).filter(r => r.status !== 'Voided').forEach(r => { const a = (r.allocations || []).find(x => x.invoiceId === doc.id) || {}; flow.push({ label: `Receipt · ${n(a.amount)}`, tag: 'Rct.', text: r.rctNo, cls: 'rct', onclick: `openReceiptView('${r.id}')` }); });
  if (!cn && doc.type === 'advance') invoicesCache.filter(i => (i.deductions || []).some(d => d.advanceInvoiceId === doc.id))
    .forEach(i => flow.push({ label: 'Deducted on', tag: 'Ded.', text: i.invNo, onclick: `openInvoiceView('${i.id}')` }));
  // Activity
  const who = doc.createdBy ? ` by ${doc.createdBy}` : '';
  const act = [[(cn ? 'Credit note issued' : 'Invoice issued') + who, doc.created || doc.date]];
  cns.forEach(c => act.push([`Credited by ${c.cnNo}`, c.created || c.date]));
  if (!cn && typeof receiptsForInvoice === 'function') receiptsForInvoice(doc.id).forEach(r => { const a = (r.allocations || []).find(x => x.invoiceId === doc.id) || {}; act.push([`${r.rctNo}: ${formatNumber(invNum(a.amount), 2)} received${r.status === 'Voided' ? ' (voided)' : ''}`, r.created || r.date]); });
  if (!cn && doc.migratedFrom) act.push(['Migrated from the Sales Order', doc.created || doc.date]);
  if (!cn && doc.editCount) act.push([`Edited by ${doc.revisedBy || '—'} — ${doc.lastEditReason || ''}${doc.editCount > 1 ? ` (${doc.editCount} edits)` : ''}`, doc.revisedAt]);
  if (!cn && doc.reissueOf) act.push([`Re-issue of ${doc.reissueOf.invNo}`, doc.created || doc.date]);
  const panel = `<aside class="qv-erp-panel inv-view-panel" aria-label="${cn ? 'Credit note' : 'Invoice'} information">
    <section class="qv-side-card"><div class="qv-side-head"><span><i class="ti ${cn ? 'ti-receipt-refund' : 'ti-file-invoice'}"></i>${cn ? 'Credit status' : 'Billing status'}</span><span class="qv-screen-only">Staff only</span></div>${summary}</section>
    <section class="qv-side-card"><div class="qv-side-head"><span><i class="ti ti-route"></i>Document flow</span></div>${bcFlowChips(flow)}</section>
    <section class="qv-side-card"><div class="qv-side-head"><span><i class="ti ti-history"></i>Activity</span></div>${bcActivityList(act)}</section>
  </aside>`;
  m._kind = kind; m._docId = doc.id;
  m.querySelector('.modal').classList.toggle('inv-view-cn', cn);
  m.querySelector('.modal').classList.remove('inv-view-rct');
  document.getElementById('inv-view-title').textContent = cn ? `${doc.cnNo} — Credit Note` : `${doc.invNo} — ${invTypeLabel(doc.type)}`;
  document.getElementById('inv-view-body').innerHTML = `<div class="dn-view-workspace inv-view-workspace"><div class="dn-view-document">${invoiceDocumentHtml(doc, kind, true)}</div>${panel}</div>`;
  const canCredit = !cn && permState(window.BizCoreInv.settings.allowCreditNotes, (typeof window.bcRight === 'function' ? window.bcRight('creditNotes') : !!window.BizCoreInv.isAdministrator)).ok && doc.status !== 'Credited';
  const b = [];
  b.push('<div class="dn-view-actionbar-spacer"></div>');
  b.push(`<button class="btn btn-secondary" onclick="closeViewWithReturn('inv-view-modal')"><i class="ti ti-x"></i><span>Close</span></button>`);
  if (so) b.push(`<button class="btn btn-secondary" id="inv-view-so-btn" onclick="${invViewGo(`viewSO('${so.id}')`)}"><i class="ti ti-file-description"></i><span>Sales Order</span></button>`);
  if (cn && inv) b.push(`<button class="btn btn-secondary" onclick="openInvoiceView('${inv.id}')"><i class="ti ti-file-invoice"></i><span>${invEsc(inv.invNo)}</span></button>`);
  if (!cn && typeof receiptsActive === 'function' && receiptsActive() && invoiceBalanceOf(doc) > 0.005) b.push(`<button class="btn btn-success" id="inv-view-receipt-btn" onclick="${invViewGo(`openNewReceipt({invoiceId:'${doc.id}'})`)}"><i class="ti ti-cash"></i><span>New Receipt</span></button>`);
  if (!cn) {
    const er = invoiceEditRightsOf(doc);
    if (er.shown) b.push(`<button class="btn btn-secondary" id="inv-view-edit-btn" ${er.ok ? '' : `disabled title="${invEsc(er.why)}"`} onclick="${invViewGo(`openEditInvoice('${doc.salesOrderId}','${doc.id}')`)}"><i class="ti ti-pencil"></i><span>Edit</span></button>`);
    // V266.4: "full" invoice edit = Cancel and re-issue (also needs the credit-note permission)
    if (er.full && doc.status === 'Issued') b.push(`<button class="btn btn-secondary" id="inv-view-reissue-btn" ${canCredit ? '' : 'disabled title="Cancel and re-issue makes a credit note — only users allowed to issue credit notes can use it (Administration → Billing Settings)."'} onclick="${invViewGo(`openCancelReissue('${doc.salesOrderId}','${doc.id}')`)}"><i class="ti ti-refresh"></i><span>Cancel &amp; re-issue</span></button>`);
  }
  if (canCredit) b.push(`<button class="btn btn-danger" id="inv-view-credit-btn" onclick="${invViewGo(`openIssueCreditNote('${doc.salesOrderId}','${doc.id}')`)}"><i class="ti ti-receipt-refund"></i><span>Credit Note</span></button>`);
  b.push(`<button class="btn btn-primary" id="inv-view-print-btn" onclick="${cn ? `printCreditNote('${doc.id}')` : `printCustomerInvoice('${doc.id}')`}"><i class="ti ti-printer"></i><span>Print / PDF</span></button>`);
  document.getElementById('inv-view-actions').innerHTML = b.join('');
  if (!m.classList.contains('open')) openModalWithSize('inv-view-modal');
}
function openInvoiceView(invoiceId){
  const inv = invoicesCache.find(i => i.id === invoiceId);
  if (!inv) { showToast('This invoice is not loaded yet. Please try again in a moment.', 'warning'); return; }
  ['view-modal', 'so-view-modal', 'dn-print-modal'].forEach(id => { if (isModalOpen(id)) closeModal(id); });
  if (typeof closeDocumentSummary === 'function') closeDocumentSummary();
  renderInvoiceView(inv, 'invoice');
}
function openCreditNoteView(cnId){
  const c = creditNotesCache.find(x => x.id === cnId);
  if (!c) { showToast('This credit note is not loaded yet. Please try again in a moment.', 'warning'); return; }
  ['view-modal', 'so-view-modal', 'dn-print-modal'].forEach(id => { if (isModalOpen(id)) closeModal(id); });
  if (typeof closeDocumentSummary === 'function') closeDocumentSummary();
  renderInvoiceView(c, 'credit');
}
/** Kept names (called from the Sales Order, the register and app.js). */
function openIndependentInvoiceDocument(soId, invoiceId){ openInvoiceView(invoiceId); }
function openCreditNoteDocument(cnId){ openCreditNoteView(cnId); }

function invPrintDocument(html, fileTitle){
  const w = window.open('', '_blank');
  if (!w) { showToast('Allow pop-ups for BizCore to print.', 'warning'); return; }
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${invEsc(fileTitle)}</title><style>*{box-sizing:border-box}html,body{margin:0;background:#fff}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}</style></head><body>${html}<scr` + `ipt>(function(){var done=false;function back(){if(done)return;done=true;try{if(window.opener&&!window.opener.closed)window.opener.focus();}catch(e){}setTimeout(function(){try{window.close();}catch(e){}},80);}window.addEventListener('afterprint',back);window.onload=function(){requestAnimationFrame(function(){requestAnimationFrame(function(){setTimeout(function(){window.print();},180);});});};})();</scr` + `ipt></body></html>`);
  w.document.close();
}
function printCustomerInvoice(invoiceId){
  const inv = invoicesCache.find(i => i.id === invoiceId); if (!inv) return;
  invPrintDocument(invoiceDocumentHtml(inv, 'invoice', false), [inv.invNo, typeof dnSafeFilePart === 'function' ? dnSafeFilePart(inv.customer) : inv.customer].filter(Boolean).join(' - '));
}
function printCreditNote(cnId){
  const c = creditNotesCache.find(x => x.id === cnId); if (!c) return;
  invPrintDocument(invoiceDocumentHtml(c, 'credit', false), [c.cnNo, typeof dnSafeFilePart === 'function' ? dnSafeFilePart(c.customer) : c.customer].filter(Boolean).join(' - '));
}

/* ═══════════════════════════════════════════════════════════════════
   ADMINISTRATION → BILLING SETTINGS
═══════════════════════════════════════════════════════════════════ */
function renderBillingSettings(){
  const box = document.getElementById('billing-settings-body'); if (!box) return;
  const B = window.BizCoreInv;
  if (!B) { box.innerHTML = '<div style="color:var(--gray)">Not connected.</div>'; return; }
  const R = window.BizCoreRct && window.BizCoreRct.settings ? window.BizCoreRct : null;   // V266.4: invoice editing is stored with the receipt settings
  const s = B.settings, stored = B.storedSettings, isAdmin = !!B.isAdministrator, dis = isAdmin ? '' : 'disabled';
  const sel = (id, value, opts) => `<select id="${id}" ${dis}>${opts.map(([v, l]) => `<option value="${v}" ${v === value ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  // V270.4.3: who may = the Special Rights in Roles & Permissions; here only On / Off ("All users" stays only while it is stored)
  const legacyAll = [s.allowOrderInvoices, s.allowAdvanceInvoices, s.allowCreditNotes].includes('all') ? [['all', 'All users (old setting — choose On)']] : [];
  const who = [['admin', 'On — roles with the Special Right'], ['none', 'Off (switched off)'], ...legacyAll];
  box.innerHTML = `
    ${isAdmin ? '' : `<div style="background:#FFFBEA;border:1px solid #F0D77B;border-radius:8px;padding:10px 12px;font-size:12.5px;color:#7A5A00;margin-bottom:14px"><i class="ti ti-shield-lock" style="margin-right:6px"></i>Only an administrator can change these settings.</div>`}
    <div style="font-size:12px;color:var(--gray);margin-bottom:10px"><i class="ti ti-shield-lock" style="margin-right:4px"></i>Who may issue order / advance invoices and credit notes: <b>Administration → Roles &amp; Permissions → Special Rights</b>.</div>
    <div style="font-size:12px;color:var(--gray);margin-bottom:10px">Invoice storage: <strong>${invEsc(B.mode)}</strong>${B.mode !== 'independent' ? ' — these settings apply after the administrator completes the invoice migration.' : ''}</div>
    <div class="form-grid">
      <div class="form-group"><label for="bs-ded">Advance deduction on later invoices</label>${sel('bs-ded', s.deductionMethod, [['auto-editable', 'Automatic proposal — user may change it'], ['auto-fixed', 'Automatic — fixed'], ['manual', 'Entered by the user']])}
        <div style="font-size:11.5px;color:var(--gray);margin-top:4px">Automatic = the advance % of the order applied to each invoice (50% advance → 50% of each invoice's goods). Whatever the setting: the invoice that completes the order always deducts the whole remaining advance, and the customer is never billed more than the order value.</div></div>
      <div class="form-group"><label for="bs-order">Order invoices (bill ahead of delivery)</label>${sel('bs-order', s.allowOrderInvoices, who)}<div style="font-size:11.5px;color:var(--gray);margin-top:4px">Delivery invoices (accepted goods) are always allowed.</div></div>
      <div class="form-group"><label for="bs-adv">Advance invoices</label>${sel('bs-adv', s.allowAdvanceInvoices, who)}</div>
      <div class="form-group"><label for="bs-cn">Credit notes</label>${sel('bs-cn', s.allowCreditNotes, who.filter(w => w[0] !== 'none'))}<div style="font-size:11.5px;color:var(--gray);margin-top:4px">Corrections must stay possible, so credit notes cannot be switched off.</div></div>
      ${R ? `<div class="form-group"><label for="bs-edit-inv">Editing invoices</label>${sel('bs-edit-inv', R.settings.editInvoices, [['none', 'Nobody — corrections by credit note only'], ['limited', 'Limited edit for all users'], ['limited-admin-full', 'Limited for all users, full with the Full edit right'], ['full', 'Full edit for all users']])}
        <div style="font-size:11.5px;color:var(--gray);margin-top:4px">Limited: Zoho no., payment due date, customer PO no., description and notes. Full: also <strong>Cancel and re-issue</strong> (a full credit note and a corrected new invoice) — the figures of an issued invoice are never changed (ZATCA). Cancel and re-issue also needs the credit-note permission above. The edit time limit is set under Payment receipts.</div></div>` : ''}
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px;flex-wrap:wrap">
      <div style="font-size:12px;color:var(--gray)">${stored && stored.updatedByName ? 'Last changed by ' + invEsc(stored.updatedByName) + (stored.updatedAt ? ' · ' + new Date(window.BizCoreLocks.core.toMillis(stored.updatedAt)).toLocaleString() : '') : 'Using the default values (deduction: automatic proposal; order / advance invoices and credit notes: On, for roles with the Special Right).'}</div>
      ${isAdmin ? '<button class="btn btn-primary" id="bs-save" onclick="saveBillingSettings()"><i class="ti ti-device-floppy"></i>Save settings</button>' : ''}
    </div>
    <div style="margin-top:18px"><button class="btn btn-secondary" onclick="showBillingHistory()"><i class="ti ti-history"></i>Change history</button></div>
    <div id="billing-history" style="margin-top:10px"></div>`;
}
async function saveBillingSettings(){
  const v = id => document.getElementById(id).value;
  const btn = document.getElementById('bs-save'); if (btn) btn.disabled = true;
  // read everything first: saving re-renders this section
  const R = window.BizCoreRct, ei = document.getElementById('bs-edit-inv'), editInvoices = ei ? ei.value : null;
  const billing = { deductionMethod: v('bs-ded'), allowOrderInvoices: v('bs-order'), allowAdvanceInvoices: v('bs-adv'), allowCreditNotes: v('bs-cn') };
  try {
    await window.BizCoreInv.saveSettings(billing);
    // V266.4: "Editing invoices" lives in settings/receipts (with the edit time limit); saved only when changed
    if (R && R.settings && editInvoices && editInvoices !== R.settings.editInvoices) await R.saveSettings({ ...R.settings, editInvoices });
    showToast('Billing settings saved.', 'success', 'Settings Saved');
  }
  catch (e) { showToast(e.code === 'permission-denied' ? 'Only an administrator can change these settings.' : e.message, 'error', 'Not Saved'); }
  finally { if (btn) btn.disabled = false; }
}
async function showBillingHistory(){
  const box = document.getElementById('billing-history'); if (!box) return;
  box.innerHTML = '<div style="color:var(--gray);font-size:12px">Loading…</div>';
  const lbl = { 'auto-editable': 'auto (editable)', 'auto-fixed': 'auto (fixed)', manual: 'manual', all: 'all', admin: 'on (right)', none: 'off' };
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
    const pay = typeof receiptsActive === 'function' && receiptsActive();
    invoicesCache.forEach(i => rows.push({ kind: 'invoice', id: i.id, soId: i.salesOrderId, no: i.invNo, type: i.type, date: i.date, customer: i.customer, soNo: i.soNo, status: i.status || 'Issued', total: invNum(i.totals?.total), ref: i.zohoNo ? 'Zoho ' + i.zohoNo : (i.reason || ''), updated: i.updatedAt || i.created || '',
      paid: pay ? invoicePaidOf(i) : null, balance: pay ? invoiceBalanceOf(i) : null, payStatus: pay ? invoicePayStatusOf(i) : '', dueDate: i.dueDate || '' }));
    creditNotesCache.forEach(c => rows.push({ kind: 'credit', id: c.id, soId: c.salesOrderId, no: c.cnNo, type: 'credit', date: c.date, customer: c.customer, soNo: c.soNo, status: 'Credit note', total: -invNum(c.total), ref: 'Against ' + c.invNo + (c.reason ? ' · ' + c.reason : ''), updated: c.created || '' }));
  } else {
    (salesOrders || []).forEach(so => (so.invoices || []).forEach((i, idx) => rows.push({ kind: 'legacy', idx, soId: so.id, no: i.invNo, type: 'delivery', date: i.date, customer: so.customer, soNo: so.soNo, status: 'Issued', total: invNum(i.total), ref: i.zohoNo ? 'Zoho ' + i.zohoNo : '' })));
  }
  return rows;
}
function filterInvoiceKPI(k){ _invRegKpi = k; renderInvoiceRegister(); }
function clearInvoiceRegisterFilters(){
  ['invreg-q'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
  set('invreg-status', ''); set('invreg-customer', ''); if (window.BCDateFilter) BCDateFilter.set('invreg', { preset: 'all' }); set('invreg-sort', 'date-desc'); _invRegKpi = 'all';
  renderInvoiceRegister();
}
function renderInvoiceRegister(){
  const body = document.getElementById('invreg-body'); if (!body) return;
  const val = id => (document.getElementById(id)?.value || '');
  const q = val('invreg-q').trim().toLowerCase(), st = val('invreg-status'), sort = val('invreg-sort') || 'date-desc';
  const ds = window.BCDateFilter ? BCDateFilter.get('invreg') : { preset: 'all', from: '', to: '' };   // V265 standard date filter
  const dp = ds.preset, from = ds.from || null, to = ds.to || null;
  const allRows = invoiceRegisterRows();
  const custSel = document.getElementById('invreg-customer');
  if (custSel) { const cur = custSel.value; const names = [...new Set(allRows.map(r => r.customer).filter(Boolean))].sort((a, b) => a.localeCompare(b)); custSel.innerHTML = '<option value="">All customers</option>' + names.map(n => `<option value="${invEsc(n)}">${invEsc(n)}</option>`).join(''); custSel.value = names.includes(cur) ? cur : ''; }
  const cust = custSel ? custSel.value : '';
  const scope = allRows.filter(r => (!cust || r.customer === cust) && (!st || r.status === st) && (!from || (r.date || '') >= from) && (!to || (r.date || '') <= to)
    && (!q || [r.no, r.customer, r.soNo, r.ref].some(v => String(v || '').toLowerCase().includes(q))));
  const count = t => scope.filter(r => r.type === t).length;
  const sum = f => Math.round(scope.filter(f).reduce((s, r) => s + r.total, 0) * 100) / 100;
  const setT = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  setT('invreg-k-total', scope.length); ['delivery', 'order', 'advance', 'credit'].forEach(t => setT('invreg-k-' + t, count(t)));
  setT('invreg-a-invoiced', formatNumber(sum(r => r.kind !== 'credit'), 2)); setT('invreg-a-credited', formatNumber(Math.abs(sum(r => r.kind === 'credit')), 2)); setT('invreg-a-net', formatNumber(sum(() => true), 2));
  document.querySelectorAll('#page-customerinvoices [data-inv-kpi]').forEach(e => { const on = e.dataset.invKpi === _invRegKpi; e.classList.toggle('active', on); e.setAttribute('aria-pressed', on ? 'true' : 'false'); });
  // V266: payment rows (Unpaid / Partially paid / Overdue / Paid) and "due in 7 days"
  const payOn = typeof receiptsActive === 'function' && receiptsActive();
  const today = new Date(), iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const in7 = iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7)), tIso = iso(today);
  const payMatch = (r, k) => r.kind === 'invoice' && (k === 'pay-unpaid' ? r.payStatus === 'Unpaid' : k === 'pay-partial' ? r.payStatus === 'Partially paid' : k === 'pay-overdue' ? r.payStatus === 'Overdue'
    : k === 'pay-paid' ? r.payStatus === 'Paid' : k === 'pay-duesoon' ? (r.balance > 0.005 && r.dueDate && r.dueDate >= tIso && r.dueDate <= in7) : false);
  const payBox = document.getElementById('invreg-pay-section'); if (payBox) payBox.hidden = !payOn;
  ['pay-unpaid', 'pay-partial', 'pay-overdue', 'pay-paid', 'pay-duesoon'].forEach(k => setT('invreg-k-' + k, scope.filter(r => payMatch(r, k)).length));
  setT('invreg-a-received', formatNumber(scope.reduce((s, r) => s + (r.kind === 'invoice' ? invNum(r.paid) : 0), 0), 2));
  setT('invreg-a-balance', formatNumber(scope.reduce((s, r) => s + (r.kind === 'invoice' ? Math.max(0, invNum(r.balance)) : 0), 0), 2));
  document.querySelectorAll('#invreg-table .inv-pay-col').forEach(e => { e.hidden = !payOn; });
  let rows = scope.filter(r => _invRegKpi === 'all' || (String(_invRegKpi).startsWith('pay-') ? payMatch(r, _invRegKpi) : r.type === _invRegKpi));
  if (sort === 'date-asc') rows.sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.no || '').localeCompare(b.no || '', undefined, { numeric: true }));
  else if (sort === 'no-asc') rows.sort((a, b) => (a.no || '').localeCompare(b.no || '', undefined, { numeric: true }));
  else if (sort === 'customer-asc') rows.sort((a, b) => (a.customer || '').localeCompare(b.customer || ''));
  else if (sort === 'total-desc') rows.sort((a, b) => b.total - a.total);
  else rows.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.no || '').localeCompare(a.no || '', undefined, { numeric: true }));
  if (typeof sortRegisterRows === 'function') rows = sortRegisterRows(rows, 'inv', { no: r => r.no, type: r => r.type, date: r => r.date, customer: r => r.customer, so: r => r.soNo, total: r => r.total, status: r => r.status });
  setT('invreg-count', `${rows.length} document${rows.length === 1 ? '' : 's'}`);
  const clear = document.getElementById('invreg-clear');
  if (clear) { const active = !!(q || cust || st || dp !== 'all' || sort !== 'date-desc' || _invRegKpi !== 'all'); clear.disabled = !active; clear.classList.toggle('active', active); }
  const statusBadge = r => r.kind === 'credit' ? '<span class="badge inv-badge-credit">Credit note</span>'
    : r.status === 'Credited' ? '<span class="badge inv-badge-credited">Credited</span>' : r.status === 'Partially credited' ? '<span class="badge inv-badge-partcredit">Partly credited</span>' : '<span class="badge inv-badge-issued">Issued</span>';
  const typeBadge = r => r.kind === 'credit' ? '<span class="inv-type-pill credit">Credit note</span>' : `<span class="inv-type-pill ${r.type}">${invTypeShort(r.type)}</span>`;
  const open = r => r.kind === 'credit' ? `openCreditNoteDocument('${r.id}')` : r.kind === 'invoice' ? `openIndependentInvoiceDocument('${r.soId}','${r.id}')` : `openInvoiceDocument('${r.soId}',${r.idx})`;
  body.innerHTML = rows.length ? rows.map(r => `<tr class="quotation-clickable-row" tabindex="0" role="button" onclick="${open(r)}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${open(r)}}"><td>${invEsc(r.no || '—')}</td><td>${typeBadge(r)}</td><td>${fmtDate(r.date)}</td><td>${invEsc(r.customer || '—')}</td><td>${invEsc(r.soNo || '—')}</td><td class="inv-reg-ref">${invEsc(r.ref || '—')}</td><td class="num${r.total < 0 ? ' neg' : ''}">${formatNumber(r.total, 2)}</td>${payOn ? `<td class="num inv-pay-col">${r.kind === 'invoice' ? formatNumber(r.paid, 2) : '—'}</td><td class="num inv-pay-col${r.payStatus === 'Overdue' ? ' neg' : ''}">${r.kind === 'invoice' ? formatNumber(r.balance, 2) : '—'}</td>` : ''}<td>${statusBadge(r)}${payOn && r.kind === 'invoice' ? ' ' + rctPayPill(r.payStatus) : ''}</td></tr>`).join('')
    : `<tr><td colspan="${payOn ? 10 : 8}"><div class="empty-state"><i class="ti ti-file-invoice"></i><strong>No invoices found</strong><p>Invoices are created from the Sales Order (Create invoice). Adjust the filters to see other documents.</p></div></td></tr>`;
}


/* ═══════════════════════════════════════════════════════════════════
   V266.3 — INVOICE LIMITED EDIT + CANCEL AND RE-ISSUE
   A tax invoice's figures are never edited (ZATCA): only due date, customer PO no., description, notes and the
   Zoho no. Everything else is corrected with "Cancel and re-issue" = full credit note + a new invoice prefilled
   from the old one. Both run under the Sales Order lock, like credit notes.
═══════════════════════════════════════════════════════════════════ */
function invoiceEditRightsOf(inv){
  const R = window.BizCoreRct; if (!R) return { shown: false, ok: false, why: '' };
  const t = new Date(), today = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  const r = R.core.invoiceEditRights(inv, R.settings, typeof window.bcRight === 'function' ? { full: window.bcRight('fullEdit'), afterLimit: window.bcRight('editAfterLimit') } : !!R.isAdministrator, today);   // V270.4.3
  return { shown: R.settings.editInvoices !== 'none', ok: r.limited, full: r.full, why: r.why, fullWhy: r.fullWhy };
}
function ensureInvoiceEditModal(){
  let m = document.getElementById('inv-edit-modal'); if (m) return m;
  m = document.createElement('div'); m.className = 'modal-overlay'; m.id = 'inv-edit-modal';
  // V266.4: the same entry screen as Create Invoice — locked fields greyed out, only the limited fields open
  const lock = '<i class="ti ti-lock ie-lock" title="Cannot be changed on an issued tax invoice — use Cancel &amp; re-issue"></i>';
  m.innerHTML = `<div class="modal modal-normal so-create-workspace inv-workspace inv-edit-workspace">
    <div class="modal-header"><div><h2 id="ie-title">Edit invoice</h2><div class="so-create-subtitle" id="ie-subtitle"></div></div><button class="close-btn" onclick="closeModal('inv-edit-modal')">✕</button></div>
    <div class="modal-body">
      <div class="ie-mode"><i class="ti ti-pencil"></i><div><b>Limited edit</b><span>Zoho no., payment due date, customer PO no., description and notes can be changed. Quantities, prices, VAT, date and customer of a tax invoice stay as issued — use <b>Cancel &amp; re-issue</b> for those.</span></div></div>
      <div class="so-header-grid">
        <section class="so-entry-card"><div class="so-entry-card-title"><i class="ti ti-file-invoice"></i>Invoice Details</div><div class="so-entry-fields two">
          <div class="form-group"><label for="ie-no">Invoice Number ${lock}</label><input id="ie-no" disabled class="so-readonly strong"/></div>
          <div class="form-group"><label for="ie-date">Invoice Date ${lock}</label><input id="ie-date" type="date" disabled/></div>
          <div class="form-group"><label for="ie-due">Payment Due Date</label><input id="ie-due" type="date" onchange="recalcEditInvoice()"/></div>
          <div class="form-group"><label for="ie-zoho">Zoho Invoice No. *</label><input id="ie-zoho" maxlength="100" autocomplete="off" oninput="recalcEditInvoice()"/><div class="inv-field-msg" id="ie-zoho-msg" hidden></div></div>
          <div class="form-group"><label for="ie-po">Customer PO No.</label><input id="ie-po" maxlength="200" autocomplete="off" oninput="recalcEditInvoice()"/></div>
          <div class="form-group"><label for="ie-type">Invoice Type ${lock}</label><input id="ie-type" disabled/></div>
          <div class="form-group inv-span-2"><label for="ie-reason" id="ie-reason-label">Description</label><input id="ie-reason" maxlength="300" oninput="recalcEditInvoice()"/></div>
        </div></section>
        <section class="so-entry-card"><div class="so-entry-card-title"><i class="ti ti-shopping-cart"></i>Order &amp; Billing</div><div class="inv-facts" id="ie-facts"></div></section>
      </div>
      <section class="so-entry-card so-items-card ie-locked-card">
        <div class="so-entry-card-title so-items-title"><span><i class="ti ti-list-check"></i><span id="ie-items-title">Invoiced Items</span></span><span class="ie-locked-tag"><i class="ti ti-lock"></i>As issued — cannot be changed</span></div>
        <div class="inv-grid-scroll" id="ie-grid"><div class="inv-line-head" id="ie-items-head"></div><div id="ie-items"></div></div>
      </section>
      <div class="so-bottom-grid">
        <section class="so-entry-card"><div class="so-entry-card-title"><i class="ti ti-message"></i>Invoice Notes</div><div class="form-group"><label for="ie-notes">Notes <span class="inv-optional">Optional</span></label><textarea id="ie-notes" class="inv-notes" oninput="recalcEditInvoice()"></textarea></div>
          <div class="form-group inv-edit-why"><label for="ie-why">Reason for the change *</label><input id="ie-why" maxlength="300" placeholder="e.g. customer asked for 30 days, Zoho number typed wrong…" oninput="recalcEditInvoice()"/></div></section>
        <section class="so-entry-card so-summary-card ie-locked-card"><div class="so-entry-card-title"><i class="ti ti-calculator"></i>Invoice Summary <span class="ie-locked-tag"><i class="ti ti-lock"></i>Fixed</span></div><div id="ie-summary"></div></section>
      </div>
    </div>
    <div class="modal-footer"><div class="inv-ready" id="ie-ready" aria-live="polite"></div><button class="btn btn-secondary" onclick="closeModal('inv-edit-modal')">Cancel</button><button class="btn btn-primary" id="ie-save" onclick="saveEditInvoice()" disabled><i class="ti ti-device-floppy"></i><span id="ie-save-text">Save Changes</span></button></div>
  </div>`;
  document.body.appendChild(m); return m;
}
/** Read-only lines and totals of the issued invoice, laid out like the Create Invoice screen. */
function renderEditInvoiceLines(inv){
  const n2 = v => formatNumber(invNum(v), 2), t = inv.totals || {};
  const grid = document.getElementById('ie-grid');
  if (inv.type === 'advance') {
    const a = inv.advance || {};
    const basis = a.method === 'full' ? 'full order value' : `${formatNumber(a.percent, 2)}% of ${a.method === 'percentLines' ? 'selected lines' : 'order value'} (${n2(a.base)})`;
    grid.className = 'inv-grid-scroll ie-grid-advance';
    document.getElementById('ie-items-title').textContent = 'Advance';
    document.getElementById('ie-items-head').innerHTML = '<span>#</span><span>Description</span><span class="num">VAT %</span><span class="num">Amount</span>';
    document.getElementById('ie-items').innerHTML = `<div class="inv-line-row"><span class="muted">1</span><span class="desc">Advance payment against ${invEsc(inv.soNo || 'the order')} — ${invEsc(basis)}</span><span class="num">${Math.round(invNum(a.vatRate) * 100)}%</span><span class="num strong">${n2(t.subtotal)}</span></div>`;
  } else {
    grid.className = 'inv-grid-scroll ie-grid-goods';
    document.getElementById('ie-items-title').textContent = 'Invoiced Items';
    document.getElementById('ie-items-head').innerHTML = '<span>#</span><span>Item / Description</span><span class="num">Qty</span><span>UOM</span><span class="num">Unit Price</span><span class="num">VAT %</span><span class="num">Amount</span>';
    document.getElementById('ie-items').innerHTML = (inv.lines || []).map((l, i) => `<div class="inv-line-row"><span class="muted">${i + 1}</span><span class="desc">${invEsc(l.desc || '—')}${l.code ? `<small class="muted"> · ${invEsc(l.code)}</small>` : ''}</span><span class="num">${formatQuantity(l.qty)}</span><span class="muted">${invEsc(l.uom || '—')}</span><span class="num">${documentMoney('customerInvoice', 'unitPrice', l.up)}</span><span class="num">${Math.round(invNum(l.vatRate != null ? l.vatRate : 0.15) * 100)}%</span><span class="num strong">${documentMoney('customerInvoice', 'lineAmount', l.subtotal != null ? invNum(l.subtotal) : invNum(l.qty) * invNum(l.up))}</span></div>`).join('')
      || '<div class="inv-empty-row"><i class="ti ti-info-circle"></i><span>No lines.</span></div>';
  }
  const row = (k, v, cls = 'so-summary-row') => `<div class="${cls}"><span>${k}</span><span>${v}</span></div>`;
  let h = '';
  if (inv.type !== 'advance') {
    h += row('Goods (ex-VAT)', invMoney(t.goodsSubtotal), 'so-summary-row muted');
    (inv.deductions || []).forEach(d => { h += row(`Less: advance ${invEsc(d.advanceInvNo)}`, '− ' + invMoney(d.subtotal), 'so-summary-row muted'); });
  }
  h += '<div class="so-summary-divider"></div>' + row('Subtotal', invMoney(t.subtotal)) + row('VAT', invMoney(t.vat))
    + `<div class="so-summary-total"><span>TOTAL</span><span>${documentMoney('customerInvoice', 'grandTotal', invNum(t.total))}</span></div>`;
  if ((inv.creditNotes || []).length) h += `<div class="ie-credited"><i class="ti ti-receipt-refund"></i> Credited by ${(inv.creditNotes || []).map(c => `${invEsc(c.cnNo)} (${n2(c.total)})`).join(', ')}</div>`;
  document.getElementById('ie-summary').innerHTML = h;
}
async function openEditInvoice(soId, invoiceId){
  const inv = invoicesCache.find(i => i.id === invoiceId); if (!inv) { showToast('Invoice not found', 'error'); return false; }
  const er = invoiceEditRightsOf(inv);
  if (!er.ok) { showToast(er.why || 'This invoice cannot be edited.', 'warning', 'Not Allowed'); return false; }
  if (!navigator.onLine) { showToast('Invoices are saved directly to the cloud database. Please reconnect and try again.', 'error', 'Offline'); return false; }
  const m = ensureInvoiceEditModal();
  Object.assign(m, { _soId: soId, _invoice: inv, _opId: newDeliveryOperationId('invedit', soId) });
  ['view-modal', 'inv-view-modal'].forEach(mid => { if (typeof isModalOpen === 'function' && isModalOpen(mid)) closeModal(mid); });
  document.getElementById('ie-title').textContent = 'Edit ' + inv.invNo;
  document.getElementById('ie-subtitle').textContent = [inv.customer, inv.soNo, 'revision ' + (inv.revision || 1) + (inv.editCount ? ' · edited ' + inv.editCount + '×' : '')].filter(Boolean).join(' · ');
  const f = (k, v) => `<div><span>${k}</span><strong>${v}</strong></div>`;
  const pay = typeof receiptsActive === 'function' && receiptsActive();
  document.getElementById('ie-facts').innerHTML = f('Sales Order', invEsc(inv.soNo || '—')) + f('Customer', invEsc(inv.customer || '—')) + f('Status', invEsc(inv.status || 'Issued'))
    + f('Total incl. VAT', invMoney((inv.totals || {}).total)) + (pay ? f('Paid', invMoney(invoicePaidOf(inv))) + f('Balance due', invMoney(invoiceBalanceOf(inv))) : '');
  document.getElementById('ie-no').value = inv.invNo || '';
  document.getElementById('ie-date').value = inv.date || '';
  document.getElementById('ie-type').value = invTypeLabel(inv.type);
  renderEditInvoiceLines(inv);
  document.getElementById('ie-zoho').value = inv.zohoNo || '';
  document.getElementById('ie-due').value = inv.dueDate || '';
  document.getElementById('ie-po').value = inv.poNo || '';
  document.getElementById('ie-reason').value = inv.reason || '';
  document.getElementById('ie-reason-label').innerHTML = inv.type === 'order' ? 'Reason for billing ahead *' : 'Description <span class="inv-optional">Optional</span>';
  document.getElementById('ie-notes').value = inv.notes || '';
  document.getElementById('ie-why').value = '';
  openModalWithSize('inv-edit-modal');
  recalcEditInvoice();
  setTimeout(() => { const e = document.getElementById('ie-why'); if (e && window.innerWidth > 760) e.focus(); }, 60);
  return true;
}
function readEditInvoice(){
  const m = document.getElementById('inv-edit-modal'), inv = m._invoice, C = invLib();
  const v = { zohoNo: document.getElementById('ie-zoho').value.trim(), dueDate: document.getElementById('ie-due').value, poNo: document.getElementById('ie-po').value.trim(),
    reason: document.getElementById('ie-reason').value.trim(), notes: document.getElementById('ie-notes').value.trim() };
  const labels = { zohoNo: 'Zoho invoice no.', dueDate: 'Payment due date', poNo: 'Customer PO no.', reason: inv.type === 'order' ? 'Reason for billing ahead' : 'Description', notes: 'Notes' };
  const changes = Object.keys(v).filter(k => v[k] !== String(inv[k] || '')).map(k => ({ field: k, label: labels[k], before: k === 'dueDate' ? fmtDate(inv[k]) : (inv[k] || '—'), after: k === 'dueDate' ? (v[k] ? fmtDate(v[k]) : '—') : (v[k] || '—') }));
  const key = C.normalizeZohoNo(v.zohoNo);
  const dup = key && key !== C.normalizeZohoNo(inv.zohoNo) ? invoicesCache.find(i => i.id !== inv.id && i.zohoNo && C.normalizeZohoNo(i.zohoNo) === key) : null;
  const why = document.getElementById('ie-why').value.trim();
  const checks = [{ ok: changes.length > 0, text: 'Change something' }, { ok: !!v.zohoNo && !dup, text: dup ? `Zoho no. (already used on ${dup.invNo})` : 'Zoho invoice no.' },
    ...(inv.type === 'order' ? [{ ok: v.reason.length >= 3, text: 'Reason for billing ahead' }] : []), { ok: why.length >= 5, text: 'Reason for the change' }];
  return { v, changes, dup, why, checks, errors: checks.filter(c => !c.ok).map(c => c.text) };
}
function recalcEditInvoice(){
  const m = document.getElementById('inv-edit-modal'); if (!m || !m._invoice) return;
  const r = readEditInvoice();
  const msg = document.getElementById('ie-zoho-msg'); msg.hidden = !r.dup; msg.innerHTML = r.dup ? '<i class="ti ti-alert-circle"></i> Already used on ' + invEsc(r.dup.invNo) : '';
  document.getElementById('ie-save').disabled = r.errors.length > 0; document.getElementById('ie-save').title = r.errors[0] || '';
  document.getElementById('ie-ready').innerHTML = invReadyHtml(r.checks, 'Ready — check the changes, then save');
}
async function saveEditInvoice(){
  const m = document.getElementById('inv-edit-modal'); if (!m || !m._invoice) return null;
  const r = readEditInvoice(), inv = m._invoice;
  if (r.errors.length) { showToast(r.errors[0], 'error', 'Check the Changes'); return null; }
  const details = {};
  r.changes.forEach(c => { details[invEsc(c.label)] = `<span class="rct-before">${invEsc(c.before)}</span> → <b>${invEsc(c.after)}</b>`; });
  details['Reason'] = invEsc(r.why);
  const ok = await invConfirm({ icon: '✏️', title: `Save changes to ${inv.invNo}?`, message: 'The invoice figures stay the same; the change and its reason are recorded in the history. Remember to make the same change in Zoho Books.', details, confirmText: 'Yes, save changes' });
  if (!ok) return null;
  return runProtectedDocumentSave({ key: 'invoice-edit:' + m._opId, message: 'Saving changes…', buttonId: 'ie-save', buttonTextId: 'ie-save-text', busyText: 'Saving…',
    action: async () => {
      const x = readEditInvoice(), changes = {};
      x.changes.forEach(c => { changes[c.field] = x.v[c.field]; });
      try {
        const res = await window.BizCoreInv.service.editInvoice({ operationId: m._opId, salesOrderId: m._soId, invoiceId: inv.id, expectedRevision: inv.revision, reason: x.why, changes });
        upsertInvoiceCache(res.invoice); refreshAfterInvoiceChange();
        closeModal('inv-edit-modal');
        showToast(`${res.invoice.invNo} updated`, 'success');
        openInvoiceView(res.invoice.id);
        return res.invoice;
      } catch (e) { console.error('[BizCore invoice edit]', e); showValidationDialog('Changes Not Saved', invoiceErrorMessage(e), '', ''); return null; }
    }, ready: v => !v || !isModalOpen('inv-edit-modal') });
}
/** Cancel and re-issue: full credit note first (its screen, prefilled), then the new invoice prefilled from the old one. */
async function openCancelReissue(soId, invoiceId){
  const inv = invoicesCache.find(i => i.id === invoiceId); if (!inv) return false;
  const er = invoiceEditRightsOf(inv);
  if (!er.full) { showToast(er.fullWhy || 'You may not cancel and re-issue this invoice.', 'warning', 'Not Allowed'); return false; }
  if (inv.status !== 'Issued') { showToast(`${inv.invNo} already has a credit note. Use Credit Note for further corrections.`, 'warning', 'Not Possible'); return false; }
  const paid = typeof invoicePaidOf === 'function' ? invoicePaidOf(inv) : 0;
  if (paid > 0.005) {
    const rcts = typeof receiptsForInvoice === 'function' ? receiptsForInvoice(inv.id).filter(r => r.status !== 'Voided').map(r => r.rctNo).join(', ') : '';
    showValidationDialog('Remove the payments first', `${inv.invNo} has payments (${formatNumber(paid, 2)}${rcts ? ' — ' + rcts : ''}). Edit those receipts to take this invoice off (the money stays on account), then cancel and re-issue it and apply the money to the new invoice.`, '', '');
    return false;
  }
  if (inv.type === 'advance' && invoicesCache.some(i => (i.deductions || []).some(d => d.advanceInvoiceId === inv.id))) {
    showValidationDialog('Advance already deducted', `${inv.invNo} has been deducted on later invoices, so it cannot be cancelled as a whole. Use a credit note for the part that is not deducted.`, '', '');
    return false;
  }
  const ok = await invConfirm({ icon: '🔁', title: `Cancel and re-issue ${inv.invNo}?`, message: 'Step 1: a credit note for the whole invoice (you confirm it on the next screen). Step 2: a new invoice opens prefilled from this one — correct it, enter the new Zoho no. and save. Do the same in Zoho Books.',
    details: { Invoice: invEsc(inv.invNo) + ' · ' + fmtDate(inv.date), Customer: invEsc(inv.customer || '—'), Total: invMoney((inv.totals || {}).total) }, confirmText: 'Continue', confirmClass: 'btn-primary' });
  if (!ok) return false;
  const opened = await openIssueCreditNote(soId, invoiceId);
  const m = document.getElementById('cn-issue-modal');
  if (!opened || !m || !m.classList.contains('open')) return false;
  m._reissue = inv;
  if (inv.type !== 'advance') creditNoteFill(true);
  document.getElementById('cn-reason').value = 'Cancelled — re-issued as a new invoice';
  document.getElementById('cn-title').textContent = 'Cancel ' + inv.invNo + ' — step 1 of 2: credit note';
  recalcCreditNote();
  return true;
}
