/* ═══════════════════════════════════════════════════════════════════
   BizCore V268.4 — Purchasing → Stock (approved mockups ST_1 – ST_4, words "Allocate" and "Open Demand", 18 Oct 2026)
   • Register (same register standard as Receipts): what was bought for stock (or the extra placed in stock) and is
     not allocated to an order yet — quantity, average landed cost, value, last bought, open demand.
   • Item: movements (bought, invoice changed / cancelled, allocated, allocation cancelled) and the open demand.
   • Allocate to Order: stock goes to an open sales order line of the same item at the average cost; the order counts
     it as bought (from stock). No money moves. An allocation can be cancelled (with a reason).
   Builds on js/purchases.js (pi* helpers) and window.BizCorePI (purchase-service.mjs).
═══════════════════════════════════════════════════════════════════ */
'use strict';
const stItems = () => [...((piLib() && piLib().stock) || new Map()).values()];
const stItemOf = key => ((piLib() && piLib().stock) || new Map()).get(key) || null;
const stAllocs = () => (piLib() && piLib().allocations) || [];
const stNewOp = k => k + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
const stQty = (q, uom) => `${piQ(q)}${uom ? ' ' + piEsc(uom) : ''}`;

/** The last purchase invoice that put this item in stock. */
function stLastBought(key){
  let best = null;
  piInvoices().forEach(pi => { if (pi.status === 'Voided') return; (pi.lines || []).forEach(l => { if (l.itemKey === key && piN(l.stockQty) > 0 && (!best || String(pi.date) > String(best.date))) best = { invoiceId: pi.id, piNo: pi.piNo, date: pi.date, supplierName: pi.supplierName }; }); });
  return best;
}
function stDemandOf(item){ return piCore() ? piCore().openDemandOf(item, piSOs(), (piLib() && piLib().ledgers) || new Map()) : []; }
function stAgeDays(lb){ const d = lb && piCore() ? piCore().daysUntil(lb.date, piToday()) : null; return d === null ? null : -d; }
function stRowOf(item){
  const lb = stLastBought(item.itemKey), demand = piN(item.qty) > 0 ? stDemandOf(item) : [];
  const age = piN(item.qty) > 0 ? stAgeDays(lb) : null;
  return { item, lb, demand, age, avg: piCore().avgCostOf(item), canGo: Math.min(piN(item.qty), demand.reduce((s, d) => s + d.left, 0)) };
}

/* ═══════════════════════════════ REGISTER ═══════════════════════════════ */
let _stKpi = 'all';
function filterStockKPI(k){ _stKpi = k || 'all'; const st = document.getElementById('streg-status'); if (st) st.value = _stKpi === 'all' ? '' : _stKpi; renderStockRegister(); }
function clearStockFilters(){
  ['streg-q', 'streg-status'].forEach(id => { const e = document.getElementById(id); if (e) e.value = ''; });
  const s = document.getElementById('streg-sort'); if (s) s.value = 'date-desc';
  if (window.BCDateFilter) BCDateFilter.set('streg', { preset: 'all' });
  _stKpi = 'all'; renderStockRegister();
}
function stDemandChips(r, max){
  if (!r.demand.length) return '<span class="pi-muted">—</span>';
  const ch = r.demand.slice(0, max).map((d, i) => `<span class="st-chip need">${piEsc(d.soNo)} · ${piQ(d.left)}${i === 0 ? ' to buy' : ''}</span>`).join('');
  return ch + (r.demand.length > max ? `<span class="st-chip">+${r.demand.length - max}</span>` : '');
}
function renderStockRegister(){
  const lib = piLib(), body = document.getElementById('streg-body'); if (!lib || !body || !piCore()) return;
  lib.start();
  const val = id => (document.getElementById(id)?.value || '');
  const q = val('streg-q').trim().toLowerCase(), sort = val('streg-sort') || 'date-desc';
  const ds = window.BCDateFilter ? BCDateFilter.get('streg') : { preset: 'all', from: '', to: '' };
  const all = stItems().map(stRowOf);
  const scope = all.filter(r => (!ds.from || (r.lb && r.lb.date >= ds.from)) && (!ds.to || (r.lb && r.lb.date <= ds.to))
    && (!q || [r.item.desc, r.item.code, r.lb && r.lb.piNo, r.lb && r.lb.supplierName, ...r.demand.map(d => d.soNo)].some(v => String(v || '').toLowerCase().includes(q))));
  const isIn = r => piN(r.item.qty) > 1e-9, isDemand = r => isIn(r) && r.demand.length > 0, isOld = r => isIn(r) && r.age !== null && r.age > 90;
  const setT = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  setT('streg-k-total', scope.length); setT('streg-k-in', scope.filter(isIn).length); setT('streg-k-zero', scope.filter(r => !isIn(r)).length);
  setT('streg-k-demand', scope.filter(isDemand).length); setT('streg-k-old', scope.filter(isOld).length);
  setT('streg-a-value', piF(scope.reduce((s, r) => s + piN(r.item.value), 0)));
  setT('streg-a-demand', piF(scope.filter(isDemand).reduce((s, r) => s + r.canGo * r.avg, 0)));
  document.querySelectorAll('#page-stock [data-st-kpi]').forEach(e => { const on = e.dataset.stKpi === _stKpi; e.classList.toggle('active', on); e.setAttribute('aria-pressed', on ? 'true' : 'false'); });
  const st = document.getElementById('streg-status'); if (st) st.value = _stKpi === 'all' ? '' : _stKpi;
  let rows = scope.filter(r => _stKpi === 'all' || (_stKpi === 'in' ? isIn(r) : _stKpi === 'zero' ? !isIn(r) : _stKpi === 'demand' ? isDemand(r) : _stKpi === 'old' ? isOld(r) : true));
  const dateOf = r => (r.lb && r.lb.date) || '';
  if (sort === 'date-asc') rows.sort((a, b) => dateOf(a).localeCompare(dateOf(b)));
  else if (sort === 'item-asc') rows.sort((a, b) => String(a.item.desc).localeCompare(String(b.item.desc)));
  else if (sort === 'value-desc') rows.sort((a, b) => piN(b.item.value) - piN(a.item.value));
  else if (sort === 'qty-desc') rows.sort((a, b) => piN(b.item.qty) - piN(a.item.qty));
  else rows.sort((a, b) => dateOf(b).localeCompare(dateOf(a)) || (isIn(b) - isIn(a)));
  if (typeof sortRegisterRows === 'function') rows = sortRegisterRows(rows, 'st', { item: r => r.item.desc, qty: r => piN(r.item.qty), value: r => piN(r.item.value), date: dateOf });
  setT('streg-count', `${rows.length} item${rows.length === 1 ? '' : 's'}`);
  const clear = document.getElementById('streg-clear');
  if (clear) { const active = !!(q || ds.preset !== 'all' || sort !== 'date-desc' || _stKpi !== 'all'); clear.disabled = !active; clear.classList.toggle('active', active); }
  const openFn = r => `openStockItem('${piEsc(r.item.itemKey)}')`;
  const allocBtn = r => isDemand(r) ? `<button type="button" class="st-alloc-btn" onclick="event.stopPropagation();openAllocateStock('${piEsc(r.item.itemKey)}')"><i class="ti ti-shopping-cart-plus"></i>Allocate</button>` : '';
  const last = r => r.lb ? `${piEsc(r.lb.piNo)} · ${piEsc(String(r.lb.date).slice(8, 10) + '-' + String(r.lb.date).slice(5, 7))} · ${piEsc(r.lb.supplierName || '')}${isOld(r) ? ` <span class="st-age">${r.age} days</span>` : ''}` : '—';
  body.innerHTML = rows.length ? rows.map(r => `<tr class="quotation-clickable-row${isIn(r) ? '' : ' st-row-zero'}" tabindex="0" role="button" data-st="${piEsc(r.item.itemKey)}" onclick="${openFn(r)}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${openFn(r)}}">
      <td><div class="st-desc">${piEsc(r.item.desc)}</div>${r.item.code ? `<div class="pi-sub">${piEsc(r.item.code)}</div>` : ''}</td><td>${piEsc(r.item.uom || '')}</td>
      <td class="num"><b>${piQ(r.item.qty)}</b></td><td class="num">${isIn(r) ? piF(r.avg) : '—'}</td><td class="num">${piF(r.item.value)}</td>
      <td class="pi-sub st-last">${last(r)}</td><td>${stDemandChips(r, 2)}</td><td class="st-act">${allocBtn(r)}</td></tr>`).join('')
    : `<tr><td colspan="8"><div class="empty-state"><i class="ti ti-box"></i><strong>No stock items found</strong><p>${all.length ? 'Adjust the filters to see other items.' : 'Items bought for stock (or extra quantities placed in stock) on purchase invoices appear here.'}</p></div></td></tr>`;
  const cards = document.getElementById('streg-cards');
  if (cards) cards.innerHTML = rows.length ? rows.map(r => `<article class="pi-card st-card${isIn(r) ? '' : ' voided'}" role="button" tabindex="0" onclick="${openFn(r)}"><div class="r1"><b>${piEsc(r.item.desc)}</b><span class="st-q">${stQty(r.item.qty, r.item.uom)}</span></div>
      <div class="r2 pi-sub">${r.item.code ? piEsc(r.item.code) + ' · ' : ''}${r.lb ? `Last bought ${piEsc(r.lb.piNo)} · ${piEsc(String(r.lb.date).slice(8, 10) + '-' + String(r.lb.date).slice(5, 7))}` : '—'}${isOld(r) ? ` · <b class="pi-red">${r.age} days</b>` : ''}</div>
      <div class="r3"><span>${isIn(r) ? `Avg. ${piF(r.avg)} · value ${piF(r.item.value)}` : 'Used up'}</span>${isDemand(r) ? `<button type="button" class="st-alloc-btn" onclick="event.stopPropagation();openAllocateStock('${piEsc(r.item.itemKey)}')"><i class="ti ti-shopping-cart-plus"></i>Allocate</button>` : ''}</div>
      ${r.demand.length ? `<div class="r4">${stDemandChips(r, 3)}</div>` : ''}</article>`).join('') : '<div class="pi-empty">No stock items found</div>';
}

/* ═══════════════════════════════ ITEM VIEW (mockup ST_2) ═══════════════════════════════ */
const ST_MOVE = { purchase: ['Bought', 'in'], 'purchase-cancelled': ['Invoice cancelled', 'can'], 'purchase-edited': ['Invoice changed', 'ed'], allocated: ['Allocated to order', 'out'], 'allocation-cancelled': ['Allocation cancelled', 'can'],
  'changed-to': ['Changed to →', 'out'], 'changed-from': ['Changed from ←', 'in'], 'change-cancelled': ['Change cancelled', 'can'] };   // V268.5
const stChanges = () => (piLib() && piLib().changes) || [];
function stModalEl(id){
  let m = document.getElementById(id);
  if (!m) { m = document.createElement('div'); m.className = 'modal-overlay'; m.id = id; document.body.appendChild(m); }
  else if (!m.classList.contains('open')) document.body.appendChild(m);   // in front
  return m;
}
function stMoveDoc(mv){
  if (mv.changeId) {   // V268.5 Change Item
    const other = mv.otherKey && stItemOf(mv.otherKey);
    return `${other ? `<button type="button" class="sp-link" onclick="openStockItem('${piEsc(mv.otherKey)}')">${piEsc(mv.otherDesc || other.desc)}</button>` : `<span>${piEsc(mv.otherDesc || '')}</span>`}<div class="pi-sub">${mv.note ? '“' + piEsc(mv.note) + '”' : ''}</div>`;
  }
  if (mv.allocationId) {
    const a = stAllocs().find(x => x.id === mv.allocationId);
    return `<span class="sp-link st-so">${piEsc(mv.soNo || (a && a.soNo) || '')}</span><div class="pi-sub">${piEsc((a && a.customer) || '')}${mv.note ? ' · “' + piEsc(mv.note) + '”' : ''}</div>`;
  }
  const pi = piInvoices().find(p => p.id === mv.invoiceId);
  const sub = mv.kind === 'purchase' ? `${piEsc((pi && pi.supplierName) || '')}` : mv.kind === 'purchase-edited' ? piEsc((pi && pi.lastEditReason) ? '“' + pi.lastEditReason + '”' : '') : piEsc((pi && pi.voidReason) ? '“' + pi.voidReason + '”' : '');
  return `<button type="button" class="sp-link" onclick="openPurchaseInvoiceView('${piEsc(mv.invoiceId)}')">${piEsc(mv.piNo || (pi && pi.piNo) || '')}</button><div class="pi-sub">${sub}</div>`;
}
function stMoveBy(mv){
  if (mv.actor) return mv.actor;
  const pi = piInvoices().find(p => p.id === mv.invoiceId);
  return pi ? (mv.kind === 'purchase' ? pi.createdBy : mv.kind === 'purchase-cancelled' ? pi.voidedBy : pi.updatedBy) || '' : '';
}
async function openStockItem(key){
  const item = stItemOf(key); if (!item) return;
  const m = stModalEl('st-view-modal'); m._key = key;
  stRenderItem(m, null);
  if (!m.classList.contains('open')) { if (typeof openModalWithSize === 'function') openModalWithSize('st-view-modal'); else m.classList.add('open'); }
  try { const moves = await piLib().movesOf(key); if (m._key === key) { m._moves = moves; stRenderItem(m, moves); } }
  catch (e) { const t = document.getElementById('stv-moves'); if (t) t.innerHTML = `<p class="pi-muted pi-pv-none">Movements could not be loaded (${piEsc(e.message || 'no connection')}).</p>`; }
}
function stRenderItem(m, moves){
  const item = stItemOf(m._key); if (!item) return;
  const r = stRowOf(item), uom = item.uom || '';
  const n = (piInvoices().filter(pi => pi.status !== 'Voided' && (pi.lines || []).some(l => l.itemKey === item.itemKey && piN(l.stockQty) > 0))).length;
  let movesHtml = '<p class="pi-muted pi-pv-none">Loading movements…</p>';
  if (moves) {
    const sorted = moves.slice().sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')) || String(a.id).localeCompare(String(b.id)));
    let bal = 0;
    const rows = sorted.map(mv => { bal = Math.round((bal + piN(mv.qty)) * 1e6) / 1e6; const k = ST_MOVE[mv.kind] || [mv.kind, 'can'];
      const a = mv.kind === 'allocated' ? stAllocs().find(x => x.id === mv.allocationId) : null;
      const c = (mv.kind === 'changed-to' || mv.kind === 'changed-from') ? stChanges().find(x => x.id === mv.changeId) : null;
      const cancel = a && a.status !== 'Voided' ? `<button type="button" class="pi-cancel-pay" onclick="stAskCancelAlloc('${piEsc(a.id)}')">Cancel</button>` : a && a.status === 'Voided' ? '<span class="pi-muted">Cancelled</span>'
        : c && c.status !== 'Voided' ? (piIsAdmin() ? `<button type="button" class="pi-cancel-pay" onclick="stAskCancelChange('${piEsc(c.id)}')">Cancel</button>` : '') : c && c.status === 'Voided' ? '<span class="pi-muted">Cancelled</span>' : '';
      return `<tr><td>${piDate(mv.date)}</td><td><span class="st-mv ${k[1]}">${k[0]}</span></td><td>${stMoveDoc(mv)}</td><td class="num ${piN(mv.qty) >= 0 ? 'st-pos' : 'st-neg'}">${piN(mv.qty) > 0 ? '+' : piN(mv.qty) < 0 ? '−' : ''}${piQ(Math.abs(piN(mv.qty)))}</td>
        <td class="num">${piN(mv.value) < 0 ? '−' : ''}${piF(Math.abs(piN(mv.value)))}</td><td class="num">${piQ(bal)}</td><td class="pi-sub">${piEsc(stMoveBy(mv))}</td><td>${cancel}</td></tr>`; }).reverse().join('');
    movesHtml = sorted.length ? `<div class="pi-lines-wrap"><table class="pi-lines pi-pv-table st-moves"><thead><tr><th>Date</th><th>What</th><th>Document</th><th class="num">Qty</th><th class="num">Value</th><th class="num">Balance</th><th>By</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="pi-note">Every change of the quantity is a movement: bought, invoice changed or cancelled, allocated to an order, changed to another item. The balance can't go below zero.</p>` : '<p class="pi-muted pi-pv-none">No movements.</p>';
  }
  const demand = r.demand.map(d => `<div class="st-dem"><i class="ti ti-shopping-cart"></i><div><b class="st-so">${piEsc(d.soNo)}</b><div class="pi-sub">${piEsc(d.customer)} · ordered ${piQ(d.ordered)} · ${piQ(d.left)} still to buy</div></div>
      ${piN(item.qty) > 0 ? `<button type="button" class="st-alloc-btn" onclick="openAllocateStock('${piEsc(item.itemKey)}','${piEsc(d.soId)}','${piEsc(d.soLineId)}')">Allocate ${piQ(Math.min(d.left, piN(item.qty)))}</button>` : ''}</div>`).join('');
  const inStock = piN(item.qty) > 1e-9;
  m.innerHTML = `<div class="modal pi-paym st-view" role="dialog" aria-modal="true" aria-labelledby="stv-title" style="--pi-w:1100px">
    <div class="modal-header"><div><h2 id="stv-title">${piEsc(item.desc)} <span class="st-badge ${inStock ? 'in' : 'zero'}">${inStock ? 'In stock' : 'Used up'}</span></h2><div class="so-create-subtitle">${piEsc(uom)}${item.code ? ' · ' + piEsc(item.code) : ''} · stock item · bought on ${n} purchase invoice${n === 1 ? '' : 's'}</div></div><button class="close-btn" type="button" onclick="closeModal('st-view-modal')" aria-label="Close">✕</button></div>
    <div class="modal-body">
      <div class="pi-bal3 st-tiles"><div><span>In stock</span><b>${stQty(item.qty, uom)}</b></div><div><span>Avg. cost</span><b>${inStock ? piF(r.avg) : '—'}</b></div><div><span>Value</span><b>${piF(item.value)}</b></div><div><span>Open demand</span><b class="${r.demand.length ? 'pi-amber' : ''}">${stQty(r.demand.reduce((s, d) => s + d.left, 0), uom)}</b></div></div>
      <div class="st-view-grid">
        <section class="pi-pv-pays"><h4><i class="ti ti-history"></i>Movements</h4><div id="stv-moves">${movesHtml}</div></section>
        <section class="pi-pv-pays st-dem-box"><h4><i class="ti ti-shopping-cart"></i>Open demand</h4>${demand || '<p class="pi-muted pi-pv-none">No open sales order line needs this item.</p>'}
          <p class="pi-note">Only open sales order lines for the <b>same item</b> (same product, or same code / description and unit) are listed.</p></section>
      </div>
    </div>
    <div class="modal-footer"><button class="btn btn-secondary" type="button" disabled title="A stock count / adjustment comes later"><i class="ti ti-adjustments"></i>Stock Count <small class="pi-muted">· later</small></button>${piIsAdmin() && inStock ? `<button class="btn btn-secondary" type="button" onclick="openChangeItem('${piEsc(item.itemKey)}')" title="The wrong item was chosen on a purchase invoice"><i class="ti ti-switch-horizontal"></i>Change Item</button>` : ''}<span style="flex:1"></span><button class="btn btn-secondary" type="button" onclick="closeModal('st-view-modal')">Close</button></div></div>`;
}

/* ═══════════════════════════════ ALLOCATE TO ORDER (mockup ST_3) ═══════════════════════════════ */
function openAllocateStock(key, soId, soLineId){
  const item = stItemOf(key); if (!item) return;
  const demand = stDemandOf(item);
  if (!demand.length) { if (typeof showToast === 'function') showToast('No open sales order line needs this item.', 'warning'); return; }
  const m = stModalEl('st-alloc-modal');
  const pick = demand.find(d => d.soId === soId && d.soLineId === soLineId) || demand[0];
  m._key = key; m._op = stNewOp('stal'); m._sel = pick.soId + '|' + pick.soLineId;
  m.innerHTML = `<div class="modal pi-paym" role="dialog" aria-modal="true" aria-labelledby="sta-title" style="--pi-w:720px">
    <div class="modal-header"><div><h2 id="sta-title">Allocate Stock to a Sales Order</h2><div class="so-create-subtitle">${piEsc(item.desc)} · ${stQty(item.qty, item.uom)} in stock · avg. cost ${piF(piCore().avgCostOf(item))}</div></div><button class="close-btn" type="button" onclick="closeModal('st-alloc-modal')" aria-label="Close">✕</button></div>
    <div class="modal-body">
      <label class="st-lbl">Sales order line *</label>
      <div id="sta-lines">${demand.map(d => `<button type="button" class="st-pick" data-k="${piEsc(d.soId + '|' + d.soLineId)}" onclick="stPickLine(this.dataset.k)"><span class="st-rad"></span><span class="st-pick-t"><b class="st-so">${piEsc(d.soNo)}</b> · ${piEsc(d.customer)}<span class="pi-sub">Line ${d.lineNo} · ${piEsc(d.desc)} · ordered ${piQ(d.ordered)} · <b>${piQ(d.left)} still to buy</b>${piCanSeeProfit() ? ` · selling ${piF(d.sellUnit)}` : ''}</span></span><span class="st-chip need">${piQ(d.left)} to buy</span></button>`).join('')}</div>
      <div class="st-alloc-grid">
        <div class="form-group"><label for="sta-qty">Quantity *</label><input id="sta-qty" class="pi-money" inputmode="decimal" oninput="stAllocRecalc()"><small id="sta-max"></small></div>
        <div class="form-group"><label for="sta-date">Date *</label><input id="sta-date" type="date" value="${piToday()}" max="${piToday()}" onchange="stAllocRecalc()"></div>
        <div class="form-group"><label for="sta-note">Note <em>Optional</em></label><input id="sta-note" maxlength="200" placeholder="e.g. taken from the shop"></div>
      </div>
      <div id="sta-result"></div>
      <div class="pi-match adv st-info"><i class="ti ti-info-circle"></i><span>No money moves and no supplier is involved — the stock was already paid on its purchase invoices. It shows on the order as bought (from stock) and in the item's movements.</span></div>
      <div class="inv-error" id="sta-err" hidden></div>
    </div>
    <div class="modal-footer"><button class="btn btn-secondary" type="button" onclick="closeModal('st-alloc-modal')">Cancel</button><button class="btn btn-primary" type="button" id="sta-save" onclick="stSaveAllocation()"><i class="ti ti-device-floppy"></i>Allocate to Order</button></div></div>`;
  stPickLine(m._sel, true);
  if (typeof openModalWithSize === 'function') openModalWithSize('st-alloc-modal'); else m.classList.add('open');
  setTimeout(() => document.getElementById('sta-qty').focus(), 60);
}
function stAllocCtx(){
  const m = stModalEl('st-alloc-modal'), item = stItemOf(m._key); if (!item) return null;
  const [soId, soLineId] = String(m._sel || '').split('|');
  const so = piSOs().find(s => s.id === soId) || null, ledger = piLedgerOf(soId);
  return { m, item, so, soId, soLineId, ledger };
}
function stPickLine(k, setQty){
  const m = stModalEl('st-alloc-modal'); m._sel = k;
  m.querySelectorAll('.st-pick').forEach(b => b.classList.toggle('on', b.dataset.k === k));
  const c = stAllocCtx(); if (!c) return;
  const line = c.so && (c.so.items || []).find(x => x.lineId === c.soLineId);
  const left = line ? piCore().stillToBuy(line.qty, (c.ledger.lines || {})[c.soLineId]) : 0;
  const max = Math.min(left, piN(c.item.qty));
  document.getElementById('sta-qty').value = piQ(max);
  document.getElementById('sta-max').textContent = `At most ${piQ(max)} (${piQ(left)} still to buy, ${piQ(c.item.qty)} in stock)`;
  stAllocRecalc();
}
function stAllocInput(){ const c = stAllocCtx(); return { itemKey: c.item.itemKey, soId: c.soId, soLineId: c.soLineId, qty: document.getElementById('sta-qty').value, date: document.getElementById('sta-date').value, note: document.getElementById('sta-note').value }; }
function stAllocRecalc(){
  const c = stAllocCtx(); if (!c) return;
  const v = piCore().validateAllocation(stAllocInput(), { item: c.item, so: c.so, ledger: c.ledger, today: piToday() });
  const line = c.so && (c.so.items || []).find(x => x.lineId === c.soLineId);
  const box = document.getElementById('sta-result');
  if (v.ok) {
    const bought = piN(((c.ledger.lines || {})[c.soLineId] || {}).purchased) + v.value.qty, ordered = piN(line && line.qty);
    const sell = v.value.sellUnit * v.value.qty, pl = sell - v.value.value;
    box.innerHTML = `<div class="pi-match ok st-res"><i class="ti ti-circle-check"></i><span>${piEsc(c.so.soNo)} line becomes <b>${bought >= ordered - 1e-9 ? 'Complete' : `${piQ(bought)} of ${piQ(ordered)} bought`}</b>. Stock goes ${piQ(c.item.qty)} → <b>${piQ(piN(c.item.qty) - v.value.qty)}</b>. Cost for the order: ${piQ(v.value.qty)} × ${piF(v.value.unitCost)} = <b>${piF(v.value.value)}</b>${piCanSeeProfit() ? ` · selling ${piF(sell)} · <b class="${pl >= 0 ? 'pi-green' : 'pi-red'}">P/L ${pl >= 0 ? '+' : '−'}${piF(Math.abs(pl))}</b>` : ''}.</span></div>`;
  } else box.innerHTML = `<div class="pi-match bad st-res"><i class="ti ti-alert-triangle"></i><span>${piEsc(v.errors.map(e => e.message).join(' '))}</span></div>`;
  document.getElementById('sta-save').disabled = !v.ok;
  c.m._v = v;
}
async function stSaveAllocation(){
  stAllocRecalc();
  const m = stModalEl('st-alloc-modal'), err = document.getElementById('sta-err'), v = m._v;
  if (!v || !v.ok) { err.hidden = false; err.textContent = (v ? v.errors : []).map(e => e.message).join(' ') || 'Check the allocation.'; return; }
  const btn = document.getElementById('sta-save'); btn.disabled = true; err.hidden = true;
  try {
    const r = await bcBusy('Allocating…', () => piLib().service.allocateStock({ ...stAllocInput(), operationId: m._op }));
    closeModal('st-alloc-modal');
    if (typeof showToast === 'function') showToast(`${piQ(r.allocation.qty)} ${r.allocation.uom || ''} ${r.allocation.desc} allocated to ${r.allocation.soNo}`, 'success');
    const vm = document.getElementById('st-view-modal'); if (vm && vm.classList.contains('open') && vm._key) openStockItem(vm._key);
  } catch (e) { err.hidden = false; err.textContent = e.code === 'permission-denied' ? 'The server refused the allocation. Please reload and try again.' : (e.message || 'Could not allocate.'); btn.disabled = false; }
}

/* Cancel an allocation (with a reason) */
function stAskCancelAlloc(id){
  const a = stAllocs().find(x => x.id === id); if (!a) return;
  const m = stModalEl('st-cancel-modal'); m._id = id; m._op = stNewOp('stav');
  m.innerHTML = `<div class="modal pi-paym" role="dialog" aria-modal="true" aria-labelledby="stc-title" style="--pi-w:480px">
    <div class="modal-header"><div class="modal-header-title-wrap"><h2 id="stc-title">Cancel allocation</h2></div><button class="close-btn" type="button" onclick="closeModal('st-cancel-modal')" aria-label="Close">✕</button></div>
    <div class="modal-body"><p class="pi-note" style="margin-top:0">${piQ(a.qty)} ${piEsc(a.uom || '')} ${piEsc(a.desc)} go back to stock (${piF(a.value)}), and ${piEsc(a.soNo)} needs them again. The allocation stays in the movements, marked Cancelled.</p>
      <div class="form-group"><label for="stc-why">Reason *</label><input id="stc-why" maxlength="300" placeholder="e.g. wrong order"></div><div class="inv-error" id="stc-err" hidden></div></div>
    <div class="modal-footer"><button class="btn btn-secondary" type="button" onclick="closeModal('st-cancel-modal')">Go back</button><button class="btn btn-danger" type="button" id="stc-save" onclick="stDoCancelAlloc()"><i class="ti ti-ban"></i>Cancel allocation</button></div></div>`;
  if (typeof openModalWithSize === 'function') openModalWithSize('st-cancel-modal'); else m.classList.add('open');
  setTimeout(() => document.getElementById('stc-why').focus(), 60);
}
async function stDoCancelAlloc(){
  const m = stModalEl('st-cancel-modal'), why = document.getElementById('stc-why').value.trim(), err = document.getElementById('stc-err');
  if (why.length < 5) { err.hidden = false; err.textContent = 'Enter the reason for cancelling (at least 5 characters).'; return; }
  const btn = document.getElementById('stc-save'); btn.disabled = true;
  try {
    await bcBusy('Cancelling allocation…', () => piLib().service.cancelStockAllocation({ operationId: m._op, allocationId: m._id, reason: why }));
    closeModal('st-cancel-modal');
    if (typeof showToast === 'function') showToast('Allocation cancelled — back in stock', 'success');
    const vm = document.getElementById('st-view-modal'); if (vm && vm.classList.contains('open') && vm._key) openStockItem(vm._key);
  } catch (e) { err.hidden = false; err.textContent = e.message || 'Could not cancel.'; btn.disabled = false; }
}

/* All movements (toolbar button) — the latest first */
async function openStockMovements(){
  const m = stModalEl('st-moves-modal');
  const paint = (rows) => {
    m.innerHTML = `<div class="modal pi-paym" role="dialog" aria-modal="true" aria-labelledby="stm-title" style="--pi-w:1000px">
      <div class="modal-header"><div><h2 id="stm-title">Stock Movements</h2><div class="so-create-subtitle">Every change of stock — the latest first</div></div><button class="close-btn" type="button" onclick="closeModal('st-moves-modal')" aria-label="Close">✕</button></div>
      <div class="modal-body">${rows === null ? '<p class="pi-muted pi-pv-none">Loading movements…</p>' : rows.length ? `<div class="pi-lines-wrap"><table class="pi-lines pi-pv-table st-moves"><thead><tr><th>Date</th><th>Item</th><th>What</th><th>Document</th><th class="num">Qty</th><th class="num">Value</th><th>By</th></tr></thead><tbody>${rows.map(mv => { const k = ST_MOVE[mv.kind] || [mv.kind, 'can'], it = stItemOf(mv.itemKey);
        return `<tr><td>${piDate(mv.date)}</td><td><button type="button" class="sp-link" onclick="openStockItem('${piEsc(mv.itemKey)}')">${piEsc((it && it.desc) || mv.itemKey)}</button></td><td><span class="st-mv ${k[1]}">${k[0]}</span></td><td>${stMoveDoc(mv)}</td>
          <td class="num ${piN(mv.qty) >= 0 ? 'st-pos' : 'st-neg'}">${piN(mv.qty) > 0 ? '+' : piN(mv.qty) < 0 ? '−' : ''}${piQ(Math.abs(piN(mv.qty)))} ${piEsc((it && it.uom) || '')}</td><td class="num">${piN(mv.value) < 0 ? '−' : ''}${piF(Math.abs(piN(mv.value)))}</td><td class="pi-sub">${piEsc(stMoveBy(mv))}</td></tr>`; }).join('')}</tbody></table></div>` : '<p class="pi-muted pi-pv-none">No stock movements yet.</p>'}</div>
      <div class="modal-footer"><button class="btn btn-secondary" type="button" onclick="closeModal('st-moves-modal')">Close</button></div></div>`;
  };
  paint(null);
  if (typeof openModalWithSize === 'function') openModalWithSize('st-moves-modal'); else m.classList.add('open');
  try {
    const all = (await Promise.all(stItems().map(i => piLib().movesOf(i.itemKey)))).flat();
    paint(all.sort((a, b) => String(b.at || '').localeCompare(String(a.at || ''))).slice(0, 300));
  } catch (e) { m.querySelector('.modal-body').innerHTML = `<p class="pi-muted pi-pv-none">Movements could not be loaded (${piEsc(e.message || 'no connection')}).</p>`; }
}

(function stWire(){
  const go = () => {
    const lib = piLib(); if (!lib) return setTimeout(go, 300);
    lib.onChange(() => {
      try { renderStockRegister(); } catch (e) {}
      const am = document.getElementById('st-alloc-modal'); if (am && am.classList.contains('open') && !(document.activeElement && am.contains(document.activeElement))) stAllocRecalc();
    });
    if (window.BCDateFilter) BCDateFilter.register('streg', () => renderStockRegister());
  };
  go();
})();
console.log('Stock V268.4 ✅ (register · movements · allocate to order)');

/* ═══════════════════════════════ V268.5 CHANGE ITEM (approved mockup V5_4) ═══════════════════════════════
   Administrators: the wrong item was chosen on a purchase invoice. Part or all of the stock moves to the correct
   product (existing products only, same unit) at the same average cost; the purchase invoice stays as it is. */
function openChangeItem(key){
  const item = stItemOf(key); if (!item) return;
  if (!piIsAdmin()) { if (typeof showToast === 'function') showToast('Only an administrator can change the item.', 'warning'); return; }
  const uomL = String(item.uom || '').trim().toLowerCase();
  const prods = (typeof products !== 'undefined' ? products : []).filter(p => p && p.id && String(p.uom || '').trim().toLowerCase() === uomL && piCore().itemKeyOf({ productId: p.id }) !== item.itemKey)
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  const m = stModalEl('st-chg-modal'); m._key = key; m._op = stNewOp('stch');
  const avg = piCore().avgCostOf(item);
  m.innerHTML = `<div class="modal pi-paym" role="dialog" aria-modal="true" aria-labelledby="stg-title" style="--pi-w:620px">
    <div class="modal-header"><div><h2 id="stg-title">Change Item</h2><div class="so-create-subtitle">${piEsc(item.desc)} · ${stQty(item.qty, item.uom)} in stock · avg. cost ${piF(avg)} · administrators only</div></div><button class="close-btn" type="button" onclick="closeModal('st-chg-modal')" aria-label="Close">✕</button></div>
    <div class="modal-body">
      <div class="pi-match adv st-info" style="margin:0 0 12px"><i class="ti ti-info-circle"></i><span>Use this when the wrong item was chosen on a purchase invoice. The stock moves to the correct product at the same cost; the purchase invoice stays as it is.</span></div>
      <div class="form-group"><label for="stg-prod">Correct product *</label><select id="stg-prod" onchange="stChgRecalc()"><option value=""></option>${prods.map(p => `<option value="${piEsc(p.id)}">${piEsc(p.name)}</option>`).join('')}</select><small>Only products with the same unit (${piEsc(item.uom || '—')}) are listed.</small></div>
      <div class="st-alloc-grid" style="grid-template-columns:160px 1fr">
        <div class="form-group"><label for="stg-qty">Quantity *</label><input id="stg-qty" class="pi-money" inputmode="decimal" value="${piQ(item.qty)}" oninput="stChgRecalc()"><small>At most ${piQ(item.qty)} (all)</small></div>
        <div class="form-group"><label for="stg-why">Reason *</label><input id="stg-why" maxlength="300" placeholder="e.g. Typed wrong on PI-2607-0019 — same Pelican 7600" oninput="stChgRecalc()"></div>
      </div>
      <div id="stg-result"></div>
      <p class="pi-note">Both items get a movement (“Changed to → …” / “Changed from ← …”) with the reason, who and when. It can be cancelled with a reason, like an allocation.</p>
      <div class="inv-error" id="stg-err" hidden></div>
    </div>
    <div class="modal-footer"><button class="btn btn-secondary" type="button" onclick="closeModal('st-chg-modal')">Cancel</button><button class="btn btn-primary" type="button" id="stg-save" onclick="stSaveChange()" disabled><i class="ti ti-switch-horizontal"></i>Change Item</button></div></div>`;
  bcPickEnhance('stg-prod', { placeholder: 'Search product…', empty: prods.length ? 'No product matches.' : 'No other product has the unit ' + (item.uom || '—') + '. Add it in Master Data → Products first.',
    items: () => prods.map(p => ({ key: p.id, title: p.name, sub: [p.code, p.uom].filter(Boolean).join(' · '), text: [p.name, p.code, p.brand, p.model, p.category].join(' '), cells: [p.name, p.code || '', p.uom || '', p.brand || '', p.category || ''] })), });
  if (typeof openModalWithSize === 'function') openModalWithSize('st-chg-modal'); else m.classList.add('open');
  stChgRecalc();
  setTimeout(() => bcPickFocus('stg-prod'), 60);
}
function stChgInput(){
  const m = stModalEl('st-chg-modal'), item = stItemOf(m._key);
  const pid = document.getElementById('stg-prod').value, product = (typeof products !== 'undefined' ? products : []).find(p => p.id === pid) || null;
  const input = { operationId: m._op, itemKey: m._key, qty: document.getElementById('stg-qty').value, reason: document.getElementById('stg-why').value, date: piToday(),
    product: product ? { id: product.id, name: product.name || '', code: product.code || '', uom: product.uom || '' } : null };
  return { m, item, input, v: piCore().validateStockChange(input, { item, product: input.product, today: piToday() }) };
}
function stChgRecalc(){
  const c = stChgInput(), box = document.getElementById('stg-result'); if (!c.item || !box) return;
  const v = c.v, val = v.value, to = val.toKey && stItemOf(val.toKey), toQ = to ? piN(to.qty) : 0;
  box.innerHTML = val.toProductId && val.qty > 0 && !v.errors.some(e => e.field === 'product')
    ? `<div class="pi-match ok"><i class="ti ti-arrows-exchange"></i><span><b>${piEsc(val.fromDesc)}</b> ${piQ(c.item.qty)} → ${piQ(Math.max(0, piN(c.item.qty) - val.qty))} · <b>${piEsc(val.toDesc)}</b> ${piQ(toQ)} → ${piQ(toQ + val.qty)} (${piF(val.value)} at ${piF(val.unitCost)}). Then an order that needs ${piEsc(val.toDesc)} shows it under <b>Open demand</b> and you can <b>Allocate</b>.</span></div>`
    : (v.errors.find(e => e.field === 'product') && val.toProductId ? `<div class="pi-match bad"><i class="ti ti-alert-triangle"></i><span>${piEsc(v.errors.find(e => e.field === 'product').message)}</span></div>` : '');
  document.getElementById('stg-save').disabled = !v.ok;
}
async function stSaveChange(){
  const c = stChgInput(), err = document.getElementById('stg-err');
  if (!c.v.ok) { err.hidden = false; err.textContent = c.v.errors.map(e => e.message).join(' '); return; }
  const btn = document.getElementById('stg-save'); btn.disabled = true; err.hidden = true;
  try {
    const r = await bcBusy('Changing item…', () => piLib().service.changeStockItem(c.input));
    closeModal('st-chg-modal');
    if (typeof showToast === 'function') showToast(`${piQ(r.change.qty)} ${r.change.uom || ''} moved to ${r.change.toDesc}`, 'success');
    openStockItem(r.change.toKey);
  } catch (e) { err.hidden = false; err.textContent = e.code === 'permission-denied' ? 'The server refused the change. Only administrators can change an item.' : (e.message || 'Could not change the item.'); btn.disabled = false; }
}
function stAskCancelChange(id){
  const c = stChanges().find(x => x.id === id); if (!c) return;
  const m = stModalEl('st-cancel-modal'); m._id = id; m._op = stNewOp('stcv');
  m.innerHTML = `<div class="modal pi-paym" role="dialog" aria-modal="true" aria-labelledby="stc-title" style="--pi-w:480px">
    <div class="modal-header"><div class="modal-header-title-wrap"><h2 id="stc-title">Cancel change of item</h2></div><button class="close-btn" type="button" onclick="closeModal('st-cancel-modal')" aria-label="Close">✕</button></div>
    <div class="modal-body"><p class="pi-note" style="margin-top:0">${piQ(c.qty)} ${piEsc(c.uom || '')} go back from ${piEsc(c.toDesc)} to ${piEsc(c.fromDesc)}. The change stays in the movements, marked Cancelled.</p>
      <div class="form-group"><label for="stc-why">Reason *</label><input id="stc-why" maxlength="300" placeholder="e.g. Chosen by mistake"></div><div class="inv-error" id="stc-err" hidden></div></div>
    <div class="modal-footer"><button class="btn btn-secondary" type="button" onclick="closeModal('st-cancel-modal')">Go back</button><button class="btn btn-danger" type="button" id="stc-save" onclick="stDoCancelChange()"><i class="ti ti-ban"></i>Cancel change</button></div></div>`;
  if (typeof openModalWithSize === 'function') openModalWithSize('st-cancel-modal'); else m.classList.add('open');
  setTimeout(() => document.getElementById('stc-why').focus(), 60);
}
async function stDoCancelChange(){
  const m = stModalEl('st-cancel-modal'), why = document.getElementById('stc-why').value.trim(), err = document.getElementById('stc-err');
  if (why.length < 5) { err.hidden = false; err.textContent = 'Enter the reason for cancelling (at least 5 characters).'; return; }
  const btn = document.getElementById('stc-save'); btn.disabled = true;
  try {
    await bcBusy('Cancelling change…', () => piLib().service.cancelStockChange({ operationId: m._op, changeId: m._id, reason: why }));
    closeModal('st-cancel-modal');
    if (typeof showToast === 'function') showToast('Change cancelled — the stock is back on the first item', 'success');
    const vm = document.getElementById('st-view-modal'); if (vm && vm.classList.contains('open') && vm._key) openStockItem(vm._key);
  } catch (e) { err.hidden = false; err.textContent = e.message || 'Could not cancel.'; btn.disabled = false; }
}
