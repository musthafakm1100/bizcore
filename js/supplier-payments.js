/* ═══════════════════════════════════════════════════════════════════
   BizCore V268.3 — Purchasing → Supplier Payments (approved mockups PI_11 – PI_14, 17 Oct 2026)
   • Register (same register standard as Receipts: monitor, one-line filter bar, date filter, table / phone cards):
     every SP — invoice payments, discounts at payment, advances, cash back — with what is left of each advance.
   • Pay advance: money paid to a supplier before the invoice (optionally for a sales order). It stays open until it
     is used on an invoice payment (Paid from → Advances), all or part of it.
   • Payment view: lines, custodian confirmation, where an advance was used; Edit (limited / full) and Cancel.
   Builds on js/purchases.js (shared helpers pi*) and window.BizCorePI (purchase-service.mjs).
═══════════════════════════════════════════════════════════════════ */
'use strict';
const spPays = () => (piLib() ? piLib().payments || [] : []);
const spOf = id => spPays().find(p => p.id === id) || null;
const spNewOp = k => k + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
const spFirst = s => String(s || '').split(/\s+/)[0] || '';

/* ───────── type, status, wording ───────── */
function spTypeOf(p){
  if (p.status === 'Voided') return 'voided';
  if (p.kind === 'advance') return 'advance';
  if (p.kind === 'cashback') return 'cashback';
  return piN(p.amount) > 0.005 ? 'payment' : 'discount';
}
const SP_TYPE = { payment: ['Payment', 'pay'], discount: ['Discount', 'disc'], advance: ['Advance', 'adv'], cashback: ['Cash back', 'cb'], voided: ['Cancelled', 'void'] };
function spTypePill(p){ const t = SP_TYPE[spTypeOf(p)]; return `<span class="sp-type ${t[1]}">${t[0]}</span>`; }
/** The money of the row: what was paid (a discount-only payment shows the discount). */
function spAmountOf(p){ return p.kind === 'payment' && !(piN(p.amount) > 0.005) ? piN(p.discount) : piN(p.amount); }
/** First name of the custodian who still has to confirm a cash line of this payment (null when none). */
function spWaitingFor(p){
  if (p.status === 'Voided' || !p.entryId) return null;
  const lines = (window.BizCoreCash && window.BizCoreCash.lines) || [];
  for (const l of p.lines || []) {
    if (l.accountType !== 'cash') continue;
    const x = lines.find(y => y.id === `${p.entryId}__${l.viaAccountId || l.accountId}`);
    if (x && x.status === 'pending' && !x.void) return spFirst((piAccOf(l.accountId) || {}).custodianName || 'Custodian');
  }
  return null;
}
/** The payments that used this advance (not cancelled). */
function spUsesOf(adv){ return spPays().filter(x => x.status !== 'Voided' && (x.advanceIds || []).includes(adv.id)); }
function spPaidFromHtml(p){
  const ls = p.lines || [];
  if (!ls.length) return `<span class="pi-muted">${p.discount ? 'No money moved' : '—'}</span>`;
  const l = ls.find(x => !x.advanceId) || ls[0], label = l.advanceId ? l.accountName : `${l.accountCode} · ${l.accountName}`;   // the money first
  return `<span class="sp-from">${piAccIcon(l.accountType)}<span>${piEsc(label)}${ls.length > 1 ? ` <span class="pi-muted">+${ls.length - 1}</span>` : ''}</span></span>`;
}
function spForHtml(p, link){
  if (p.kind === 'advance') return p.soNo ? `<span class="sp-for">${piEsc(p.soNo)}</span>` : '<span class="pi-muted">—</span>';
  if (!p.piNo) return '<span class="pi-muted">—</span>';
  return link ? `<button type="button" class="sp-link" onclick="event.stopPropagation();spOpenInvoice('${piEsc(p.invoiceId)}')">${piEsc(p.piNo)}</button>` : piEsc(p.piNo);
}
function spStatusHtml(p){
  if (p.status === 'Voided') return `<span class="pi-muted">${piEsc(p.voidReason || 'Cancelled')}</span>`;
  if (p.kind === 'advance') {
    const left = piCore().advanceLeftOf(p), used = piN(p.advanceUsed), uses = spUsesOf(p);
    return `<b class="sp-left${left > 0.005 ? '' : ' none'}">${left > 0.005 ? piF(left) + ' left' : 'Fully used'}</b>${used > 0.005 ? `<div class="pi-sub">${piF(used)} used · ${uses.map(x => piEsc(x.piNo)).join(', ')}</div>` : ''}`;
  }
  const w = spWaitingFor(p);
  if (w) return `<span class="pi-wait">⏳ ${piEsc(w)}</span>`;
  if (piN(p.advanceTotal) > 0.005) return `<span class="pi-sub">Incl. advance ${piF(p.advanceTotal)}</span>`;
  return '<span class="pi-muted">—</span>';
}
function spOpenInvoice(id){ if (typeof openPurchaseInvoiceView === 'function') openPurchaseInvoiceView(id); }

/* ═══════════════════════════════ REGISTER ═══════════════════════════════ */
let _spKpi = 'all';
function filterSupplierPaymentKPI(k){ _spKpi = k || 'all'; const st = document.getElementById('spreg-status'); if (st) st.value = _spKpi === 'all' ? '' : _spKpi; renderSupplierPayments(); }
function clearSupplierPaymentFilters(){
  ['spreg-q', 'spreg-status', 'spreg-supplier'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
  const s = document.getElementById('spreg-sort'); if (s) s.value = 'date-desc';
  if (window.BCDateFilter) BCDateFilter.set('spreg', { preset: 'all' });
  _spKpi = 'all'; renderSupplierPayments();
}
function renderSupplierPayments(){
  const lib = piLib(), body = document.getElementById('spreg-body'); if (!lib || !body || !piCore()) return;
  lib.start(); piStartAccounts();
  const C = piCore();
  const val = id => (document.getElementById(id)?.value || '');
  const q = val('spreg-q').trim().toLowerCase(), sort = val('spreg-sort') || 'date-desc';
  const ds = window.BCDateFilter ? BCDateFilter.get('spreg') : { preset: 'all', from: '', to: '' };
  const all = spPays();
  const supSel = document.getElementById('spreg-supplier');
  if (supSel) { const cur = supSel.value; const names = [...new Set(all.map(p => p.supplierName).filter(Boolean))].sort((a, b) => a.localeCompare(b)); supSel.innerHTML = '<option value="">All suppliers</option>' + names.map(n => `<option value="${piEsc(n)}">${piEsc(n)}</option>`).join(''); supSel.value = names.includes(cur) ? cur : '';
    // V268.5: type-and-search (approved mockup V5_1)
    bcPickEnhance('spreg-supplier', { compact: true, placeholder: 'All suppliers', clearLabel: 'All suppliers', empty: 'No supplier matches.',
      items: () => names.map(n => { const c = all.filter(p => p.supplierName === n).length; return { key: n, title: n, right: String(c), text: n }; }) }); }
  const sup = supSel ? supSel.value : '';
  const scope = all.filter(p => (!sup || p.supplierName === sup) && (!ds.from || (p.date || '') >= ds.from) && (!ds.to || (p.date || '') <= ds.to)
    && (!q || [p.spNo, p.supplierName, p.piNo, p.soNo, p.note, ...(p.lines || []).map(l => l.reference), ...(p.lines || []).map(l => l.accountName)].some(v => String(v || '').toLowerCase().includes(q))));
  const live = scope.filter(p => p.status !== 'Voided');
  const is = k => p => k === 'payment' ? ['payment', 'discount'].includes(spTypeOf(p)) : spTypeOf(p) === k;
  const openAdv = live.filter(p => p.kind === 'advance' && C.advanceLeftOf(p) > 0.005);
  const waiting = live.filter(p => spWaitingFor(p));
  const setT = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  setT('spreg-k-total', scope.length); setT('spreg-k-payment', live.filter(is('payment')).length); setT('spreg-k-advance', live.filter(is('advance')).length);
  setT('spreg-k-cashback', live.filter(is('cashback')).length); setT('spreg-k-voided', scope.length - live.length);
  setT('spreg-k-open', openAdv.length); setT('spreg-k-waiting', waiting.length);
  document.querySelectorAll('#page-supplierpayments [data-sp-kpi]').forEach(e => { const on = e.dataset.spKpi === _spKpi; e.classList.toggle('active', on); e.setAttribute('aria-pressed', on ? 'true' : 'false'); });
  const st = document.getElementById('spreg-status'); if (st) st.value = _spKpi === 'all' ? '' : _spKpi;
  let rows = scope.filter(p => _spKpi === 'all' || (_spKpi === 'Voided' ? p.status === 'Voided' : _spKpi === 'open' ? openAdv.includes(p) : _spKpi === 'waiting' ? waiting.includes(p)
    : p.status !== 'Voided' && is(_spKpi)(p)));
  // figures of the rows shown: money that left (an advance used on an invoice is not counted twice)
  setT('spreg-a-paid', piF(rows.filter(p => p.status !== 'Voided' && p.kind !== 'cashback').reduce((x, p) => x + piN(p.amount) - piN(p.advanceTotal), 0)));
  setT('spreg-a-open', piF(openAdv.reduce((x, p) => x + C.advanceLeftOf(p), 0)));
  const byNo = (a, b) => String(a.spNo || '').localeCompare(String(b.spNo || ''), undefined, { numeric: true });
  if (sort === 'date-asc') rows.sort((a, b) => String(a.date).localeCompare(String(b.date)) || byNo(a, b));
  else if (sort === 'no-asc') rows.sort(byNo);
  else if (sort === 'supplier-asc') rows.sort((a, b) => String(a.supplierName).localeCompare(String(b.supplierName)));
  else if (sort === 'amount-desc') rows.sort((a, b) => spAmountOf(b) - spAmountOf(a));
  else rows.sort((a, b) => String(b.date).localeCompare(String(a.date)) || byNo(b, a));
  if (typeof sortRegisterRows === 'function') rows = sortRegisterRows(rows, 'sp', { no: p => p.spNo, date: p => p.date, supplier: p => p.supplierName, type: p => SP_TYPE[spTypeOf(p)][0], amount: p => spAmountOf(p) });
  setT('spreg-count', `${rows.length} payment${rows.length === 1 ? '' : 's'}`);
  const clear = document.getElementById('spreg-clear');
  if (clear) { const active = !!(q || sup || ds.preset !== 'all' || sort !== 'date-desc' || _spKpi !== 'all'); clear.disabled = !active; clear.classList.toggle('active', active); }
  const openFn = p => `openSupplierPaymentView('${piEsc(p.id)}')`;
  const amt = p => p.status === 'Voided' ? `<s>${piF(spAmountOf(p))}</s>` : piF(spAmountOf(p));
  body.innerHTML = rows.length ? rows.map(p => `<tr class="quotation-clickable-row${p.status === 'Voided' ? ' sp-row-voided' : ''}" tabindex="0" role="button" data-sp="${piEsc(p.id)}" onclick="${openFn(p)}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${openFn(p)}}">
      <td class="sp-no">${piEsc(p.spNo)}</td><td>${piDate(p.date)}</td><td>${piEsc(p.supplierName)}</td><td>${spTypePill(p)}</td><td>${spForHtml(p, true)}</td>
      <td>${spPaidFromHtml(p)}</td><td class="num">${amt(p)}</td><td>${spStatusHtml(p)}</td></tr>`).join('')
    : `<tr><td colspan="8"><div class="empty-state"><i class="ti ti-cash-banknote"></i><strong>No supplier payments found</strong><p>${all.length ? 'Adjust the filters to see other payments.' : 'Payments are recorded on purchase invoices; money paid before the invoice with Pay Advance.'}</p></div></td></tr>`;
  const cards = document.getElementById('spreg-cards');
  if (cards) cards.innerHTML = rows.length ? rows.map(p => `<article class="pi-card sp-card${p.status === 'Voided' ? ' voided' : ''}" role="button" tabindex="0" onclick="${openFn(p)}"><div class="r1"><b>${piEsc(p.spNo)}</b>${spTypePill(p)}</div><div class="r2">${piEsc(p.supplierName)}</div>
      <div class="r3"><span>${piDate(p.date)} · ${spForHtml(p, false)}</span><span class="amt">${amt(p)}</span></div><div class="r4">${spStatusHtml(p)}</div></article>`).join('') : '<div class="pi-empty">No supplier payments found</div>';
  // (no nav badge — as in mockup PI_11; cash waiting is shown in the monitor and in Cash & Bank)
}

/* ═══════════════════════════════ PAYMENT VIEW ═══════════════════════════════ */
function openSupplierPaymentView(id){
  const p = spOf(id); if (!p) return;
  piStartAccounts();
  let m = document.getElementById('sp-view-modal');
  if (!m) { m = document.createElement('div'); m.className = 'modal-overlay'; m.id = 'sp-view-modal'; document.body.appendChild(m); }
  else if (!m.classList.contains('open')) document.body.appendChild(m);   // V268.3: in front
  m._id = id;
  const off = p.status === 'Voided', adv = p.kind === 'advance', ls = p.lines || [];
  const right = off ? { right: null } : piEditRight(p);
  const rows = ls.map(l => `<tr><td><div class="pi-pv-acc"><span class="acc">${piAccIcon(l.accountType)}${l.advanceId ? piEsc(l.accountName) : `${piEsc(l.accountCode)} · ${piEsc(l.accountName)}`}</span>${l.viaAccountId ? `<div class="pi-sub pi-pv-via">From ${piEsc(l.viaAccountCode)} · ${piEsc(l.viaAccountName)}</div>` : ''}</div></td>
      <td class="num">${piF(l.amount)}${l.bankCharge ? `<div class="pi-sub">+ Bank charge ${piF(l.bankCharge)}</div>` : ''}</td><td class="pi-sub">${l.reference ? piEsc(l.reference) : '—'}</td><td>${piConfirmHtml(p, l)}</td></tr>`).join('');
  const uses = adv ? spUsesOf(p) : [];
  const forTxt = adv ? (p.soNo ? 'For ' + p.soNo : 'No sales order') : p.piNo;
  m.innerHTML = `<div class="modal pi-paym sp-view" role="dialog" aria-modal="true" aria-labelledby="spv-title" style="--pi-w:900px">
    <div class="modal-header"><div><h2 id="spv-title">${piEsc(p.spNo)} ${spTypePill(p)}</h2><div class="so-create-subtitle">${piEsc(p.supplierName)} · ${piEsc(forTxt || '')} · ${piDate(p.date)}</div></div><button class="close-btn" type="button" onclick="closeModal('sp-view-modal')" aria-label="Close">✕</button></div>
    <div class="modal-body">
      ${off ? `<div class="pi-void-note"><i class="ti ti-ban"></i>Cancelled by ${piEsc(p.voidedBy || '')} on ${piDate(String(p.voidedAt || '').slice(0, 10))} — ${piEsc(p.voidReason || '')}</div>` : ''}
      ${!off && p.lastEditReason ? `<div class="pi-edit-note"><i class="ti ti-pencil"></i>Changed by ${piEsc(p.updatedBy || '')} on ${piDate(String(p.updatedAt || '').slice(0, 10))} — ${piEsc(p.lastEditReason)}</div>` : ''}
      <div class="pi-view-head">
        <div><label>Supplier</label><b>${piEsc(p.supplierName)}</b></div>
        <div><label>Date</label><b>${piDate(p.date)}</b></div>
        <div><label>${adv ? 'For sales order' : 'Purchase invoice'}</label><b>${adv ? piEsc(p.soNo || '—') : p.invoiceId ? `<button type="button" class="sp-link" onclick="spOpenInvoice('${piEsc(p.invoiceId)}')">${piEsc(p.piNo)}</button>` : '—'}</b></div>
        <div><label>${adv ? 'Advance' : p.kind === 'cashback' ? 'Received' : 'Paid'}</label><b>${piF(p.amount)}</b>${p.discount ? `<small>+ discount ${piF(p.discount)}</small>` : ''}</div>
        ${adv ? `<div><label>Left to use</label><b class="sp-left">${piF(piCore().advanceLeftOf(p))}</b></div>` : ''}
        <div><label>Recorded by</label><b>${piEsc(p.createdBy || '')}</b><small>${piDate(String(p.created || '').slice(0, 10))}</small></div>
      </div>
      ${ls.length ? `<div class="pi-lines-wrap"><table class="pi-lines pi-pv-table"><thead><tr><th>${p.kind === 'cashback' ? 'Received into' : 'Paid from'}</th><th class="num">Amount</th><th>Reference</th><th>Confirmation</th></tr></thead><tbody>${rows}</tbody></table></div>`
        : `<p class="pi-muted pi-pv-none">Discount only — no money moved.</p>`}
      ${p.note ? `<p class="pi-note"><b>Note:</b> ${piEsc(p.note)}</p>` : ''}
      ${adv ? `<section class="pi-pv-pays"><h4><i class="ti ti-wallet"></i>Used on invoices</h4>${uses.length ? `<div class="pi-lines-wrap"><table class="pi-lines pi-pv-table"><thead><tr><th>Payment</th><th>Invoice</th><th>Date</th><th class="num">Used</th></tr></thead><tbody>${uses.map(u => `<tr><td><button type="button" class="sp-link" onclick="openSupplierPaymentView('${piEsc(u.id)}')">${piEsc(u.spNo)}</button></td><td><button type="button" class="sp-link" onclick="spOpenInvoice('${piEsc(u.invoiceId)}')">${piEsc(u.piNo)}</button></td><td>${piDate(u.date)}</td><td class="num">${piF((u.advanceAmounts || {})[p.id])}</td></tr>`).join('')}</tbody></table></div>` : `<p class="pi-muted pi-pv-none">Not used yet — choose it under <b>Paid from → Advances</b> when you pay the invoice.</p>`}</section>` : ''}
      <div class="inv-error" id="spv-error" hidden></div>
    </div>
    <div class="modal-footer">${off ? '' : `<button class="btn btn-danger" type="button" style="margin-right:auto" onclick="piAskCancelPay('${piEsc(p.id)}')"><i class="ti ti-ban"></i>Cancel ${adv ? 'advance' : p.kind === 'cashback' ? 'cash back' : 'payment'}</button>`}
      <button class="btn btn-secondary" type="button" onclick="closeModal('sp-view-modal')">Close</button>
      ${p.invoiceId ? `<button class="btn btn-secondary" type="button" onclick="spOpenInvoice('${piEsc(p.invoiceId)}')"><i class="ti ti-file-invoice"></i>Open ${piEsc(p.piNo)}</button>` : ''}
      ${right.right ? `<button class="btn btn-primary" type="button" id="spv-edit" onclick="spEditPaymentClick('${piEsc(p.id)}')"><i class="ti ti-pencil"></i>Edit</button>` : ''}</div></div>`;
  if (m.classList.contains('open')) return;   // live refresh
  if (typeof openModalWithSize === 'function') openModalWithSize('sp-view-modal'); else m.classList.add('open');
}

/* ═══════════════════════════════ PAY ADVANCE (approved mockup PI_12) ═══════════════════════════════ */
function spAdvEl(){
  let m = document.getElementById('sp-adv-modal');
  if (!m) { m = document.createElement('div'); m.className = 'modal-overlay'; m.id = 'sp-adv-modal'; document.body.appendChild(m); }
  else if (!m.classList.contains('open')) document.body.appendChild(m);   // V268.3: in front
  return m;
}
function openPayAdvance(){
  const lib = piLib(); if (!lib) return;
  lib.start(); piStartAccounts();
  const m = spAdvEl(), today = piToday();
  m._op = spNewOp('sadv');
  m._st = { lines: [{ accountId: '', amount: '', reference: '', bankCharge: '' }] };
  const sups = (typeof suppliers !== 'undefined' ? suppliers : []).slice().sort((a, b) => String(a.company || '').localeCompare(String(b.company || '')));
  const sos = piSOs().filter(so => so && so.id && !/cancel|void/i.test(String(so.status || ''))).slice().sort((a, b) => String(b.soNo || '').localeCompare(String(a.soNo || ''), undefined, { numeric: true }));
  const x = typeof docNumberParts === 'function' ? docNumberParts('supplierPayment') : { displayPrefix: 'SP-' };
  m.innerHTML = `<div class="modal pi-paym" role="dialog" aria-modal="true" aria-labelledby="spa-title" style="--pi-w:820px">
    <div class="modal-header"><div><h2 id="spa-title">Pay advance</h2><div class="so-create-subtitle">Money paid to a supplier before the invoice — number ${piEsc(x.displayPrefix)}…</div></div><button class="close-btn" type="button" onclick="closeModal('sp-adv-modal')" aria-label="Close">✕</button></div>
    <div class="modal-body">
      <div class="sp-adv-grid">
        <div class="form-group"><label for="spa-sup">Supplier *</label><select id="spa-sup" onchange="spAdvRecalc()"><option value="">Choose the supplier…</option>${sups.map(s => `<option value="${piEsc(s.id)}">${piEsc(s.company || s.name || s.id)}</option>`).join('')}</select></div>
        <div class="form-group"><label for="spa-date">Date *</label><input id="spa-date" type="date" value="${today}" max="${today}" onchange="spAdvRecalc()"></div>
        <div class="form-group"><label for="spa-so">For sales order <em>Optional</em></label><select id="spa-so" onchange="spAdvRecalc()"><option value="">No sales order</option>${sos.map(so => `<option value="${piEsc(so.id)}">${piEsc(so.soNo)} · ${piEsc(so.customer || '')}</option>`).join('')}</select></div>
      </div>
      <div class="pi-lines-wrap"><table class="pi-lines pi-pay-table"><thead><tr><th>Paid from (payment account)</th><th class="num" style="width:140px">Amount</th><th style="width:160px">Reference</th><th style="width:230px"></th><th style="width:34px"></th></tr></thead><tbody id="spa-lines"></tbody></table></div>
      <div class="pi-pm-add"><button type="button" class="btn btn-secondary btn-sm" onclick="spAdvEl()._st.lines.push({accountId:'',amount:'',reference:'',bankCharge:''});spAdvRender()"><i class="ti ti-plus"></i>Add account</button><span class="pi-sub">Split over cash, card and bank</span></div>
      <div class="form-group"><label for="spa-note">Note <em>Optional</em></label><input id="spa-note" maxlength="300" placeholder="e.g. 50% advance for the Pelican flashlights" oninput="spAdvRecalc()"></div>
      <div class="pi-match adv sp-adv-info" id="spa-info"></div>
      <div class="inv-error" id="spa-error" hidden></div>
    </div>
    <div class="modal-footer"><button class="btn btn-secondary" type="button" onclick="closeModal('sp-adv-modal')">Cancel</button><button class="btn btn-primary" type="button" id="spa-save" onclick="spSaveAdvance()" disabled><i class="ti ti-device-floppy"></i>Save advance</button></div></div>`;
  spAdvRender();
  // V268.5: type-and-search pickers (approved mockup V5_1)
  bcPickEnhance('spa-sup', { items: bcSupplierPickItems, placeholder: 'Search supplier…', empty: 'No supplier matches. Check the spelling, or add the supplier in Master Data.' });
  bcPickEnhance('spa-so', { items: () => sos.map(so => { const its = (so.items || []).filter(it => it && (it.desc || it.description)); const d = so.date ? (typeof fmtDate === 'function' ? fmtDate(so.date) : so.date) : '';
      return { key: so.id, title: `${so.customer || ''} · ${so.soNo || ''}`, right: d, sub: `${its.length} line${its.length === 1 ? '' : 's'}${its.length ? ' · ' + its.slice(0, 2).map(it => it.desc || it.description).join(', ') + (its.length > 2 ? ' …' : '') : ''}`,
        text: [so.soNo, so.customer, so.ref || '', ...its.map(it => it.desc || it.description)].join(' ') }; }),
    placeholder: 'Search by SO no., customer or item…', clearLabel: 'No sales order', empty: 'No open sales order matches.',
    hint: '↑ ↓ to move · Enter to choose · cancelled orders hidden' });
  if (typeof openModalWithSize === 'function') openModalWithSize('sp-adv-modal'); else m.classList.add('open');
  setTimeout(() => bcPickFocus('spa-sup'), 60);
}
function spAdvSet(i, field, value, rerender){
  const m = spAdvEl(), l = m._st.lines[i]; if (!l) return;
  l[field] = value;
  if (field === 'accountId') { const a = piAccOf(value); if (!a || a.type !== 'bank') l.bankCharge = ''; }
  if (rerender) spAdvRender(); else spAdvRecalc();
}
function spAdvRender(){
  const m = spAdvEl();
  document.getElementById('spa-lines').innerHTML = m._st.lines.map((l, i) => {
    const a = piAccOf(l.accountId);
    return `<tr class="pi-pay-line"><td><span class="pi-pay-sel">${a ? piAccIcon(a.type) : ''}<select class="pi-pay-acc" aria-label="Paid from" onchange="spAdvSet(${i},'accountId',this.value,true)">${piAccOptions(l.accountId)}</select></span></td>
      <td class="num"><input class="pi-cell pi-money pi-pay-amt" inputmode="decimal" placeholder="0.00" value="${piEsc(l.amount)}" aria-label="Amount" oninput="spAdvSet(${i},'amount',this.value)" onblur="piMoneyBlur(this)"></td>
      <td><input class="pi-cell pi-pay-ref" maxlength="60" placeholder="Optional" value="${piEsc(l.reference)}" aria-label="Reference" oninput="spAdvSet(${i},'reference',this.value)"></td>
      <td class="pi-pay-info">${piPayInfo(l, `spAdvSet(${i},'bankCharge',this.value)`)}</td>
      <td><button type="button" class="pi-x" title="Remove this account" aria-label="Remove account" onclick="spAdvEl()._st.lines.splice(${i},1);spAdvRender()"><i class="ti ti-x"></i></button></td></tr>`;
  }).join('') || '<tr><td colspan="5" class="pi-empty-lines pi-nopay"><i class="ti ti-cash-off"></i>Use <b>Add account</b> to say where the money came from.</td></tr>';
  spAdvRecalc();
}
function spAdvInput(){
  const m = spAdvEl(), sel = document.getElementById('spa-sup'), soSel = document.getElementById('spa-so');
  const sup = (typeof suppliers !== 'undefined' ? suppliers : []).find(x => x.id === sel.value);
  const so = piSOs().find(x => x.id === soSel.value);
  return { kind: 'advance', supplierId: sup ? sup.id : '', supplierName: sup ? (sup.company || sup.name || '') : '', soId: so ? so.id : '', soNo: so ? so.soNo || '' : '',
    date: document.getElementById('spa-date').value, lines: m._st.lines, note: document.getElementById('spa-note').value };
}
function spAdvRecalc(){
  const m = spAdvEl(); if (!piCore()) return;
  const input = spAdvInput();
  const v = piCore().validateSupplierPayment(input, { accounts: piAccMap(), today: piToday() });
  const name = input.supplierName || 'the supplier';
  document.getElementById('spa-info').innerHTML = `<i class="ti ti-info-circle"></i><span>The advance stays <b>open</b> for ${piEsc(name)}${v.value.amount > 0 ? ` (${piF(v.value.amount)})` : ''}. When the invoice comes, choose it in the invoice's <b>Payments</b> like an account — all or part of it; the rest stays open. Cash lines wait for the custodian as usual.</span>`;
  document.getElementById('spa-save').disabled = !v.ok;
  m._v = v;
}
async function spSaveAdvance(){
  const m = spAdvEl(), lib = piLib(); spAdvRecalc();
  const err = document.getElementById('spa-error'), v = m._v;
  if (!v || !v.ok) { err.hidden = false; err.textContent = (v ? v.errors : []).map(e => e.message).join(' ') || 'Check the advance.'; return; }
  const btn = document.getElementById('spa-save'); btn.disabled = true; err.hidden = true;
  const input = spAdvInput();
  try {
    const r = await bcBusy('Saving advance…', () => lib.service.payAdvance({ ...input, operationId: m._op, numbering: piPayNumbering(input.date) }));
    closeModal('sp-adv-modal');
    if (typeof showToast === 'function') showToast(`${r.payment.spNo} — advance ${piF(r.payment.amount)} to ${r.payment.supplierName} saved`, 'success');
  } catch (e) { err.hidden = false; err.textContent = e.code === 'permission-denied' ? 'The server refused the advance. Please reload and try again.' : (e.message || 'Could not save the advance.'); btn.disabled = false; }
}

/* ═══════════════════════════════ EDIT A PAYMENT (approved mockup PI_14) ═══════════════════════════════
   Limited: the references and the note. Full (administrators): date, accounts, amounts, bank charge and discount —
   a new Cash & Bank entry replaces the old one (cash lines are confirmed again). Not for a payment that uses an advance. */
function spEditPaymentClick(id){
  const p = spOf(id); if (!p) return;
  const r = piEditRight(p);
  if (!r.right) { if (typeof showToast === 'function') showToast(r.why || 'This payment can\'t be edited.', 'warning'); return; }
  const full = r.right === 'full' && !(p.advanceIds || []).length;
  return piWithLock('supplierPayment', id, p.spNo, 'Editing ' + p.spNo, () => spOpenEdit(id, full));
}
function spEditEl(){
  let m = document.getElementById('sp-edit-modal');
  if (!m) { m = document.createElement('div'); m.className = 'modal-overlay'; m.id = 'sp-edit-modal'; document.body.appendChild(m); }
  else if (!m.classList.contains('open')) document.body.appendChild(m);   // V268.3: in front
  return m;
}
function spOpenEdit(id, full){
  const p = spOf(id); if (!p) return false;
  piStartAccounts();
  const m = spEditEl(), r = piEditRight(p), set = piSettings();
  m._id = id; m._rev = p.revision; m._full = full; m._op = spNewOp('spe');
  m._st = { lines: (p.lines || []).map(l => ({ accountId: l.accountId, amount: piF(l.amount), reference: l.reference || '', bankCharge: l.bankCharge ? piF(l.bankCharge) : '' })) };
  const what = p.kind === 'advance' ? 'Advance' : p.kind === 'cashback' ? 'Cash back' : 'Payment';
  const sub = `${what} · ${p.kind === 'advance' ? (p.soNo || 'No sales order') : p.piNo} · ${p.supplierName}`;
  const limitedWhy = (p.advanceIds || []).length ? 'it uses an advance — to change the amounts, cancel it and enter it again' : 'your role allows limited edits — to change the amounts an administrator edits it';
  m.innerHTML = `<div class="modal pi-paym" role="dialog" aria-modal="true" aria-labelledby="spe-title" style="--pi-w:${full ? 820 : 620}px">
    <div class="modal-header"><div><h2 id="spe-title">Edit ${piEsc(p.spNo)}</h2><div class="so-create-subtitle">${piEsc(sub)}</div></div><button class="close-btn" type="button" onclick="closeModal('sp-edit-modal')" aria-label="Close">✕</button></div>
    <div class="modal-body">
      ${full ? `<div class="pi-edit-mode full"><i class="ti ti-user-shield"></i><span><b>Full edit (administrator)</b> — date, accounts, amounts${p.kind === 'payment' ? ', bank charge and discount' : ''}.</span></div>
        <div class="form-group pi-pm-date"><label for="spe-date">${p.kind === 'cashback' ? 'Date' : 'Payment date'} *</label><input id="spe-date" type="date" value="${piEsc(p.date)}" max="${piToday()}" onchange="spEditRecalc()"></div>
        <div class="pi-lines-wrap"><table class="pi-lines pi-pay-table"><thead><tr><th>${p.kind === 'cashback' ? 'Received into' : 'Paid from'}</th><th class="num" style="width:140px">Amount</th><th style="width:160px">Reference</th><th style="width:230px"></th><th style="width:34px"></th></tr></thead><tbody id="spe-lines"></tbody></table></div>
        ${p.kind === 'cashback' ? '' : `<div class="pi-pm-add"><button type="button" class="btn btn-secondary btn-sm" onclick="spEditEl()._st.lines.push({accountId:'',amount:'',reference:'',bankCharge:''});spEditRender()"><i class="ti ti-plus"></i>Add account</button></div>`}
        ${p.kind === 'payment' ? `<div class="pi-pm-disc"><i class="ti ti-discount"></i><b>Discount at payment</b><span class="pi-sub">Optional</span><input id="spe-disc" class="pi-cell pi-money" inputmode="decimal" placeholder="0.00" value="${p.discount ? piF(p.discount) : ''}" aria-label="Discount at payment" oninput="spEditRecalc()" onblur="piMoneyBlur(this)"></div>` : ''}
        <div class="pi-pm-after" id="spe-after"></div>`
      : `<div class="pi-edit-mode lim"><i class="ti ti-lock"></i><span><b>Limited edit</b> — ${limitedWhy}. You can change the references and the note.</span></div>
        <div class="pi-lines-wrap"><table class="pi-lines pi-pay-table"><thead><tr><th>${p.kind === 'cashback' ? 'Received into' : 'Paid from'}</th><th class="num">Amount</th><th style="width:200px">Reference</th></tr></thead><tbody>${(p.lines || []).map((l, i) => `<tr><td>${piAccIcon(l.accountType)}${l.advanceId ? piEsc(l.accountName) : `${piEsc(l.accountCode)} · ${piEsc(l.accountName)}`}</td><td class="num">${piF(l.amount)}</td><td><input class="pi-cell spe-ref" data-i="${i}" maxlength="60" value="${piEsc(l.reference || '')}"${l.advanceId ? ' disabled' : ''} aria-label="Reference"></td></tr>`).join('') || '<tr><td colspan="3" class="pi-muted">Discount only — no money moved.</td></tr>'}</tbody></table></div>`}
      <div class="form-group"><label for="spe-note">Note <em>Optional</em></label><input id="spe-note" maxlength="300" value="${piEsc(p.note || '')}"></div>
      <div class="form-group"><label for="spe-why">Reason for the change *</label><input id="spe-why" maxlength="300" placeholder="e.g. cash count was 880"></div>
      <p class="pi-note">${r.until ? `Editable until ${piDate(r.until)} (${set.editDays} days) · administrators any time · ` : ''}the payment is locked while you edit · every change is kept in its history.</p>
      <div class="inv-error" id="spe-err" hidden></div>
    </div>
    <div class="modal-footer"><button class="btn btn-secondary" type="button" onclick="closeModal('sp-edit-modal')">Cancel</button><button class="btn btn-primary" type="button" id="spe-save" onclick="spSaveEdit()"><i class="ti ti-device-floppy"></i>Save changes</button></div></div>`;
  if (full) spEditRender();
  if (typeof openModalWithSize === 'function') openModalWithSize('sp-edit-modal'); else m.classList.add('open');
  setTimeout(() => { const e = m.querySelector(full ? '.pi-pay-amt' : '.spe-ref:not([disabled])') || document.getElementById('spe-note'); if (e) e.focus(); }, 60);
  return true;
}
function spEditSet(i, field, value, rerender){
  const m = spEditEl(), l = m._st.lines[i]; if (!l) return;
  l[field] = value;
  if (field === 'accountId') { const a = piAccOf(value); if (!a || a.type !== 'bank') l.bankCharge = ''; }
  if (rerender) spEditRender(); else spEditRecalc();
}
function spEditRender(){
  const m = spEditEl(), p = spOf(m._id); if (!p) return;
  const types = p.kind === 'cashback' ? ['cash', 'bank'] : null;
  document.getElementById('spe-lines').innerHTML = m._st.lines.map((l, i) => {
    const a = piAccOf(l.accountId);
    return `<tr class="pi-pay-line"><td><span class="pi-pay-sel">${a ? piAccIcon(a.type) : ''}<select class="pi-pay-acc" aria-label="Account" onchange="spEditSet(${i},'accountId',this.value,true)">${piAccOptions(l.accountId, types)}</select></span></td>
      <td class="num"><input class="pi-cell pi-money pi-pay-amt" inputmode="decimal" placeholder="0.00" value="${piEsc(l.amount)}" aria-label="Amount" oninput="spEditSet(${i},'amount',this.value)" onblur="piMoneyBlur(this)"></td>
      <td><input class="pi-cell pi-pay-ref" maxlength="60" placeholder="Optional" value="${piEsc(l.reference)}" aria-label="Reference" oninput="spEditSet(${i},'reference',this.value)"></td>
      <td class="pi-pay-info">${p.kind === 'cashback' ? '' : piPayInfo(l, `spEditSet(${i},'bankCharge',this.value)`)}</td>
      <td>${p.kind === 'cashback' ? '' : `<button type="button" class="pi-x" title="Remove this account" aria-label="Remove account" onclick="spEditEl()._st.lines.splice(${i},1);spEditRender()"><i class="ti ti-x"></i></button>`}</td></tr>`;
  }).join('') || '<tr><td colspan="5" class="pi-empty-lines pi-nopay"><i class="ti ti-cash-off"></i>No money paid — enter the discount at payment, or use <b>Add account</b>.</td></tr>';
  spEditRecalc();
}
/** Full edit: the invoice without this payment, and the new figures checked against it. */
function spEditFull(){
  const m = spEditEl(), p = spOf(m._id), C = piCore(); if (!p || !C) return null;
  const input = { kind: p.kind, date: document.getElementById('spe-date').value, lines: m._st.lines, note: document.getElementById('spe-note').value,
    discount: (document.getElementById('spe-disc') || {}).value || '', ...(p.kind === 'advance' ? { supplierId: p.supplierId, supplierName: p.supplierName, soId: p.soId, soNo: p.soNo } : {}) };
  let base = null;
  if (p.kind !== 'advance') { const pi = piInvoices().find(x => x.id === p.invoiceId); if (pi) base = { ...pi, ...C.applyPaymentToInvoice(pi, p, -1) }; }
  const v = C.validateSupplierPayment(input, { invoice: base, accounts: piAccMap(), today: piToday() });
  if (p.kind === 'advance' && v.value.amount + 0.005 < piN(p.advanceUsed)) { v.ok = false; v.errors.push({ field: 'amount', message: `${piF(p.advanceUsed)} of this advance is already used — the amount can't be less.` }); }
  return { input, base, v, p };
}
function spEditRecalc(){
  const m = spEditEl(); if (!m._full) return;
  const r = spEditFull(); if (!r) return;
  const { base, v, p } = r, C = piCore(), box = document.getElementById('spe-after');
  const cashChanged = (p.lines || []).some(l => l.accountType === 'cash') || m._st.lines.some(l => (piAccOf(l.accountId) || {}).type === 'cash');
  let html = '';
  if (base && p.kind === 'payment') {
    const money = C.invoiceMoneyOf(base), left = Math.round((money.balance - v.value.amount - v.value.discount) * 100) / 100;
    const st = C.payStatusFrom(money.total, money.paid + v.value.amount, money.paymentDiscount + v.value.discount);
    html = `<div class="pi-pm-after-box ${left > 0.005 ? 'part' : left < -0.005 ? 'bad' : 'ok'}"><span>${piF(p.amount)} → <b>${piF(v.value.amount)}</b>${v.value.discount || p.discount ? ` · discount ${piF(p.discount)} → ${piF(v.value.discount)}` : ''} · the invoice balance becomes <b>${piF(left)}</b></span><b>${left < -0.005 ? 'More than the balance' : st}</b></div>`;
  } else if (p.kind === 'advance') html = `<div class="pi-pm-after-box ${v.ok ? 'ok' : 'bad'}"><span>${piF(p.amount)} → <b>${piF(v.value.amount)}</b> · used ${piF(p.advanceUsed)} · left after: <b>${piF(v.value.amount - piN(p.advanceUsed))}</b></span></div>`;
  else html = `<div class="pi-pm-after-box ok"><span>${piF(p.amount)} → <b>${piF(v.value.amount)}</b></span></div>`;
  if (cashChanged) html += `<div class="pi-edit-mode lim sp-cash-note"><i class="ti ti-hourglass"></i><span>Cash lines go to the custodian again to confirm (the old lines are cancelled in Cash &amp; Bank).</span></div>`;
  box.innerHTML = html;
  document.getElementById('spe-save').disabled = !v.ok;
  m._v = v;
}
async function spSaveEdit(){
  const m = spEditEl(), p = spOf(m._id), err = document.getElementById('spe-err'), lib = piLib(); if (!p) return;
  const reason = document.getElementById('spe-why').value.trim();
  if (!reason) { err.hidden = false; err.textContent = 'Enter the reason for the change.'; document.getElementById('spe-why').focus(); return; }
  let req;
  if (m._full) {
    const r = spEditFull();
    if (!r.v.ok) { err.hidden = false; err.textContent = r.v.errors.map(e => e.message).join(' '); return; }
    req = { ...r.input, mode: 'full' };
  } else {
    const refs = [...m.querySelectorAll('.spe-ref')].map(e => e.value);
    req = { mode: 'limited', references: refs, note: document.getElementById('spe-note').value };
    const v = piCore().validatePaymentLimitedEdit(p, { ...req, reason });
    if (!v.ok) { err.hidden = false; err.textContent = v.errors.map(e => e.message).join(' '); return; }
  }
  const btn = document.getElementById('spe-save'); btn.disabled = true; err.hidden = true;
  try {
    await bcBusy('Saving changes…', () => lib.service.editSupplierPayment({ ...req, operationId: m._op, paymentId: p.id, expectedRevision: m._rev, reason }));
    closeModal('sp-edit-modal');
    if (typeof showToast === 'function') showToast(`${p.spNo} changed`, 'success');
  } catch (e) { err.hidden = false; err.textContent = e.code === 'permission-denied' ? 'The server refused the change. Please reload and try again.' : (e.message || 'Could not save.'); btn.disabled = false; }
}

(function spWire(){
  const go = () => {
    const lib = piLib(); if (!lib) return setTimeout(go, 300);
    lib.onChange(() => {
      try { renderSupplierPayments(); } catch (e) {}
      const vm = document.getElementById('sp-view-modal'); if (vm && vm.classList.contains('open') && vm._id) openSupplierPaymentView(vm._id);
    });
    if (window.BCDateFilter) BCDateFilter.register('spreg', () => renderSupplierPayments());
  };
  go();
})();
console.log('Supplier Payments V268.3 ✅ (register · advances · edit)');
