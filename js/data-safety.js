/* ═══════════════════════════════════════════════════════════════════════════
   BizCore V268.5 — Data safety
   1. Shared settings: settings that were kept only in one browser are now saved in Firebase
      (sharedSettings/{doc}) and read by every PC and phone. The browser keeps a copy (cache).
   2. "Move settings to Firebase" (administrators, once): shows what is only in this browser next to
      what is in Firebase, downloads a backup first, then moves; where both differ, you choose.
   3. Pricing approval by an administrator from their own login (no shared PIN). Recorded.
   4. Administration → Data Health.
   Loaded after app.js. Uses window.BizCoreShared (index.html).
═══════════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';

const LS = {
  get(k){ try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v){ try { localStorage.setItem(k, v); } catch (e) {} },
  del(k){ try { localStorage.removeItem(k); } catch (e) {} },
};
const esc = v => (typeof escapeHtml === 'function' ? escapeHtml(String(v == null ? '' : v)) : String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
const toast = (m, t) => { if (typeof showToast === 'function') showToast(m, t || 'info'); };
const parse = j => { try { return JSON.parse(j); } catch (e) { return null; } };
const same = (a, b) => { if (a == null || b == null) return a == b; const x = parse(a), y = parse(b); return JSON.stringify(x) === JSON.stringify(y); };
const shared = () => window.BizCoreShared || null;
const S0 = () => window.BizCoreShared || {};
const isAdmin = () => !!(window.BizCoreShared && window.BizCoreShared.isAdministrator);
const myUid = () => { try { return (window.currentUser && window.currentUser.uid) || ''; } catch (e) { return ''; } };
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');

/* ── 1. The shared settings ─────────────────────────────────────────────── */
const DS = {
  bizcore_uom_master: {
    doc: 'units', label: 'Units of Measure', adminOnly: false,
    summary(j){ const a = parse(j) || []; return Array.isArray(a) ? plural(a.length, 'unit') + (a.length ? ' (' + a.slice(0, 6).map(u => u.code).join(', ') + (a.length > 6 ? ', …' : '') + ')' : '') : '—'; },
    reload(){ if (typeof loadUomMaster === 'function') { loadUomMaster(); try { UOM_LIST = uomMaster.filter(u => u.active).map(u => u.code); } catch (e) {} }
      if (typeof renderUomMaster === 'function') try { renderUomMaster(); } catch (e) {}
      if (typeof refreshProductUomSelect === 'function') try { refreshProductUomSelect(); } catch (e) {} },
  },
  bizcore_categories: {   // V270.4.12: Master Data → Categories (goods / services)
    doc: 'categories', label: 'Categories', adminOnly: false,
    summary(j){ const a = parse(j) || []; return Array.isArray(a) ? plural(a.length, 'category').replace('categorys', 'categories') : '—'; },
    reload(){ if (typeof loadCategoryMaster === 'function') try { loadCategoryMaster(); if (typeof renderCategoryMaster === 'function') renderCategoryMaster(); if (typeof populateCategoryFilter === 'function') populateCategoryFilter(); } catch (e) {} },
  },
  bizcoreTaxMaster: {
    doc: 'taxMaster', label: 'Tax master', adminOnly: true,
    summary(j){ const a = parse(j) || []; return Array.isArray(a) && a.length ? a.map(t => (t.name || t.code) + ' ' + Number(t.rate || 0) + '%' + (t.isDefault ? ' (default)' : '')).join(', ') : '—'; },
    reload(){ if (typeof renderTaxMaster === 'function') try { renderTaxMaster(); } catch (e) {} },
  },
  bizcorePricingSettings: {
    doc: 'pricing', label: 'Pricing settings', adminOnly: true,
    summary(j){ const p = parse(j); if (!p) return '—'; return [p.decimals != null ? p.decimals + ' decimals' : '', p.minMargin != null ? 'min. margin ' + p.minMargin + '%' : '', p.managerApproval != null ? 'manager approval ' + (p.managerApproval ? 'on' : 'off') : ''].filter(Boolean).join(' · ') || 'Saved'; },
    reload(){ try { if (typeof pricingSettingsDirty !== 'undefined' && pricingSettingsDirty) return; if (typeof initPricingSettings === 'function') initPricingSettings(); if (typeof applyPricingSettingsToOpenScreens === 'function') applyPricingSettingsToOpenScreens(); } catch (e) {} },
  },
  bizcoreMarginStatuses: {
    doc: 'marginStatuses', label: 'Margin statuses', adminOnly: true,
    summary(j){ const a = parse(j) || []; return Array.isArray(a) ? plural(a.length, 'status') .replace('statuss', 'statuses') + (a.length ? ' (' + a.map(x => x.name).join(', ') + ')' : '') : '—'; },
    reload(){ try { if (typeof marginStatusesDirty !== 'undefined' && marginStatusesDirty) return; if (typeof initMarginStatuses === 'function') initMarginStatuses(); if (typeof updateMarginGaugeScale === 'function') updateMarginGaugeScale(); } catch (e) {} },
  },
  bizcore_cost_components: {
    doc: 'costComponents', label: 'Cost components', adminOnly: true,
    summary(j){ const a = parse(j) || []; return Array.isArray(a) && a.length ? a.filter(c => c.enabled !== false).map(c => c.name + (c.type === '%' && Number(c.value) ? ' ' + Number(c.value) + '%' : '')).join(', ') : '—'; },
    reload(){ try { if (typeof costComponentsDirty !== 'undefined' && costComponentsDirty) return; if (typeof initialiseCostComponents === 'function') initialiseCostComponents(true); if (typeof renderCostComponents === 'function') renderCostComponents(); } catch (e) {} },
  },
};
const KEYS = Object.keys(DS);
const OLD_KEYS = ['bizcore_users', 'bizcore_roles', 'dtq_admin_pin', 'bizcoreTaxSettings'];   // removed by the move (in the backup)
const flagKey = k => 'bc_shared_rev_' + k;        // this browser is in step with Firebase (revision)
const pendKey = k => 'bc_shared_pending_' + k;    // a change made here that did not reach Firebase yet
const saving = {};
let conflicts = {};                                // key → true (administrator must choose)

function applyFromFirebase(key, d){
  const def = DS[key]; if (!def || !d) return;
  const local = LS.get(key);
  if (local != null && !same(local, d.json) && !LS.get(flagKey(key))) LS.set('bc_shared_old_' + key, local);   // keep the old copy
  LS.set(key, d.json); LS.set(flagKey(key), String(d.revision || 1)); LS.del(pendKey(key));
  if (!same(local, d.json)) def.reload();
}

/** Called by app.js after a shared setting is saved in this browser. */
async function bcSharedSave(key){
  const def = DS[key], S = shared(); if (!def || !S) return false;
  const json = LS.get(key); if (json == null) return false;
  if (def.adminOnly && S.accessKnown && !isAdmin()) {   // the rules refuse it anyway; say so at once and put it back
    toast(def.label + ' can be changed by an administrator only. Your change was not saved.', 'error');
    const d = S.docs && S.docs[def.doc]; if (d) applyFromFirebase(key, d);
    return false;
  }
  saving[key] = (saving[key] || 0) + 1;
  try {
    const rev = await S.save(def.doc, key, json);
    LS.set(flagKey(key), String(rev)); LS.del(pendKey(key)); delete conflicts[key];
    return true;
  } catch (e) {
    const denied = /permission|insufficient/i.test(String(e && (e.code || e.message)));
    if (denied) {
      toast(def.label + ' can be changed by an administrator only. Your change was not saved.', 'error');
      const d = S.docs && S.docs[def.doc];
      if (d) applyFromFirebase(key, d);
    } else {
      LS.set(pendKey(key), '1');
      toast(def.label + ' was saved on this PC but could not reach Firebase yet. It will be sent when you are back online.', 'warning');
    }
    return false;
  } finally { saving[key]--; }
}
window.bcSharedSave = bcSharedSave;

/** Firebase → this browser. */
function sync(docs){
  if (!docs) return;
  KEYS.forEach(key => {
    if (saving[key]) return;
    const def = DS[key], d = docs[def.doc], local = LS.get(key);
    if (!d) {   // not in Firebase yet → an administrator moves it (Move settings to Firebase)
      if (LS.get(pendKey(key))) bcSharedSave(key);
      return;
    }
    if (same(local, d.json)) { LS.set(flagKey(key), String(d.revision || 1)); delete conflicts[key]; return; }
    if (LS.get(pendKey(key))) { bcSharedSave(key); return; }   // our offline change goes up
    if (LS.get(flagKey(key)) || local == null) { applyFromFirebase(key, d); return; }
    if (!S0().accessKnown) return;                  // wait until we know whether this login is an administrator
    // This browser never synced and holds something different.
    if (isAdmin()) conflicts[key] = true;          // the administrator chooses (Move settings)
    else applyFromFirebase(key, d);                 // Firebase is the shared copy (old copy kept)
  });
  queueCheck();
}

/* ── 2. Move settings to Firebase ──────────────────────────────────────── */
function moveItems(){
  const S = shared(), docs = (S && S.docs) || null; if (!docs) return [];
  const out = [];
  KEYS.forEach(key => {
    const def = DS[key], d = docs[def.doc], local = LS.get(key);
    if (!d && local != null) out.push({ key, def, local, fb: null, kind: 'move' });
    else if (d && conflicts[key] && !same(local, d.json)) out.push({ key, def, local, fb: d, kind: 'choose' });
  });
  return out;
}
function oldLeft(){ return OLD_KEYS.filter(k => LS.get(k) != null && k !== 'bizcoreTaxSettings'); }

let checkTimer = null, shownThisSession = false;
function queueCheck(){
  clearTimeout(checkTimer);
  checkTimer = setTimeout(() => {
    if (document.getElementById('page-setup')?.classList.contains('active') && document.getElementById('setup-tab-data-health')?.style.display === 'block') bcRenderDataHealth();
    if (!isAdmin() || shownThisSession) return;
    let seen = null; try { seen = sessionStorage.getItem('bc_ds_later'); } catch (e) {}
    if (seen) return;
    if (moveItems().length) { shownThisSession = true; bcOpenMoveSettings(); }
  }, 1500);
}

function backupNow(){
  const data = { _app: 'BizCore settings backup', _version: '268.5', _at: new Date().toISOString(), _user: (window.currentUser && window.currentUser.name) || '', browser: {} };
  KEYS.concat(OLD_KEYS, ['dtq_delivery_terms', 'dtq_payment_terms']).forEach(k => { const v = LS.get(k); if (v != null) data.browser[k] = k === 'bizcore_users' ? '(removed: passwords are not kept)' : v; });
  const S = shared(); if (S && S.docs) { data.firebase = {}; Object.keys(S.docs).forEach(id => { data.firebase[id] = { json: S.docs[id].json, revision: S.docs[id].revision, updatedBy: S.docs[id].updatedBy || '' }; }); }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'BizCore_settings_backup_' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  dsBackupDone = true;
}
let dsBackupDone = false;

function modalEl(id){
  let m = document.getElementById(id);
  if (!m) { m = document.createElement('div'); m.className = 'modal-overlay bc-ds-overlay'; m.id = id; document.body.appendChild(m); }
  else if (!m.classList.contains('open')) document.body.appendChild(m);   // in front
  return m;
}
function openM(id){ if (typeof openModalWithSize === 'function') openModalWithSize(id); else document.getElementById(id).classList.add('open'); }
function closeM(id){ if (typeof closeModal === 'function') closeModal(id); else document.getElementById(id)?.classList.remove('open'); }

function bcOpenMoveSettings(){
  if (!isAdmin()) { toast('Only an administrator can move settings to Firebase.', 'warning'); return; }
  const items = moveItems(), old = oldLeft();
  if (!items.length && !old.length) { toast('Nothing is saved only in this browser.', 'success'); return; }
  const m = modalEl('ds-move-modal');
  const fbName = d => d && d.updatedBy ? ' (saved by ' + esc(d.updatedBy) + ')' : '';
  m.innerHTML = `<div class="modal pi-paym" role="dialog" aria-modal="true" aria-labelledby="dsm-title" style="--pi-w:900px">
    <div class="modal-header"><div><h2 id="dsm-title">Move Settings to Firebase</h2><div class="so-create-subtitle">Found in this browser only · administrators · once per setting</div></div><button class="close-btn" type="button" onclick="bcMoveLater()" aria-label="Close">✕</button></div>
    <div class="modal-body">
      <div class="pi-match adv ds-info"><i class="ti ti-info-circle"></i><span>These settings were saved only in this browser. Moving them makes them <b>the same for everyone</b>. Do this on the PC where they were set up. A backup file is downloaded first.</span></div>
      ${items.length ? `<div class="ds-table-wrap"><table class="ds-table"><thead><tr><th style="width:34px"></th><th>Setting</th><th>In this browser</th><th>In Firebase now</th><th>After moving</th></tr></thead><tbody>
      ${items.map(it => `<tr data-key="${esc(it.key)}"><td><input type="checkbox" class="ds-chk" checked aria-label="Move ${esc(it.def.label)}"></td><td><b>${esc(it.def.label)}</b></td>
        <td>${esc(it.def.summary(it.local))}</td>
        <td>${it.fb ? esc(it.def.summary(it.fb.json)) + fbName(it.fb) : '<span class="ds-none">— none —</span>'}</td>
        <td>${it.kind === 'move' ? 'Same, shared' : `<div class="ds-choose"><label><input type="radio" name="ds-c-${esc(it.key)}" value="local"> Keep this browser's</label><label><input type="radio" name="ds-c-${esc(it.key)}" value="fb" checked> Keep Firebase's</label></div>`}</td></tr>`).join('')}
      </tbody></table></div>` : ''}
      ${old.length ? `<p class="ds-note"><b>Not moved (removed instead):</b> the old browser User Management list and the browser PIN — administrators now come from Firebase, and manager approval is given from an administrator's own login.</p>` : ''}
      <p class="ds-note">Delivery and payment terms are already saved in Firebase; terms added from a quotation now go to Firebase straight away.</p>
      <div class="inv-error" id="dsm-err" hidden></div>
    </div>
    <div class="modal-footer"><button class="btn btn-secondary" type="button" onclick="bcMoveBackup()"><i class="ti ti-download"></i>Download backup</button><span style="flex:1"></span><button class="btn btn-secondary" type="button" onclick="bcMoveLater()">Later</button><button class="btn btn-primary" type="button" id="dsm-go" onclick="bcMoveGo()"><i class="ti ti-cloud-upload"></i><span id="dsm-go-t"></span></button></div></div>`;
  const upd = () => { const n = m.querySelectorAll('.ds-chk:checked').length; document.getElementById('dsm-go-t').textContent = items.length ? (n ? 'Move ' + plural(n, 'setting') : 'Nothing selected') : 'Remove old browser data'; document.getElementById('dsm-go').disabled = items.length > 0 && !n && !old.length; };
  m.querySelectorAll('.ds-chk').forEach(c => c.addEventListener('change', upd)); upd();
  openM('ds-move-modal');
}
window.bcOpenMoveSettings = bcOpenMoveSettings;
window.bcMoveBackup = () => { backupNow(); toast('Backup downloaded.', 'success'); };
window.bcMoveLater = () => { try { sessionStorage.setItem('bc_ds_later', '1'); } catch (e) {} closeM('ds-move-modal'); toast('You can do this later from Administration → Data Health.', 'info'); };
window.bcMoveGo = async () => {
  const m = document.getElementById('ds-move-modal'); if (!m) return;
  const S = shared(), err = document.getElementById('dsm-err'); err.hidden = true;
  const rows = [...m.querySelectorAll('tr[data-key]')].filter(r => r.querySelector('.ds-chk')?.checked);
  if (!dsBackupDone) backupNow();
  const failed = [];
  await (window.bcBusy || ((t, f) => f()))('Moving settings to Firebase…', async () => {
    for (const r of rows) {
      const key = r.dataset.key, def = DS[key], choice = (r.querySelector('input[type=radio]:checked') || {}).value || 'local';
      const d = S.docs && S.docs[def.doc];
      if (d && choice === 'fb') { applyFromFirebase(key, d); delete conflicts[key]; continue; }
      LS.del(pendKey(key));
      const ok = await bcSharedSave(key); if (!ok) failed.push(def.label);
    }
    OLD_KEYS.forEach(k => LS.del(k));
  });
  if (failed.length) { err.textContent = 'Not moved: ' + failed.join(', ') + '. Check the internet connection and try again.'; err.hidden = false; return; }
  closeM('ds-move-modal');
  toast(rows.length ? 'Settings moved. Every PC and phone now uses the same settings.' : 'Old browser data removed.', 'success');
  bcRenderDataHealth();
};

/* ── 3. Data Health (Administration) ──────────────────────────────────── */
function fmtWhen(ts){
  try { const d = ts && ts.toDate ? ts.toDate() : ts ? new Date(ts) : null; if (!d || isNaN(d)) return ''; const p = n => String(n).padStart(2, '0'); return p(d.getDate()) + '-' + p(d.getMonth() + 1) + '-' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); } catch (e) { return ''; }
}
function bcRenderDataHealth(){
  const box = document.getElementById('dh-body'); if (!box) return;
  const S = shared(), docs = S && S.docs;
  if (!docs) { box.innerHTML = '<div class="setup-card"><p class="ds-note">Loading shared settings from Firebase…</p></div>'; return; }
  const items = moveItems(), old = oldLeft(), pend = KEYS.filter(k => LS.get(pendKey(k)));
  const only = items.length + old.length + pend.length;
  const head = only
    ? `<div class="pi-match bad ds-head"><i class="ti ti-alert-triangle"></i><span>${only === 1 ? 'One setting is' : only + ' settings are'} saved only in this browser.${isAdmin() ? '' : ' Ask an administrator to move them.'}</span>${isAdmin() ? '<button class="btn btn-primary btn-sm" type="button" onclick="bcOpenMoveSettings()"><i class="ti ti-cloud-upload"></i>Move settings to Firebase</button>' : ''}</div>`
    : `<div class="pi-match ok ds-head"><i class="ti ti-circle-check"></i><span>Nothing is saved only in this browser.</span></div>`;
  const rows = KEYS.map(k => { const def = DS[k], d = docs[def.doc];
    const local = LS.get(k);
    const state = LS.get(pendKey(k)) ? '<span class="ds-chip warn">Waiting to send</span>' : !d && local == null ? '<span class="ds-chip">Standard (never changed)</span>' : !d ? '<span class="ds-chip bad">Only in this browser</span>' : conflicts[k] ? '<span class="ds-chip warn">Different here — choose</span>' : '<span class="ds-chip ok">Shared</span>';
    return `<tr><td><b>${esc(def.label)}</b><div class="pi-sub">${d ? esc(def.summary(d.json)) : local != null ? esc(def.summary(local)) : 'The built-in values are used'}</div></td><td>${d ? esc(fmtWhen(d.updatedAt)) + (d.updatedBy ? ' · ' + esc(d.updatedBy) : '') : '—'}</td><td>${state}</td></tr>`; }).join('');
  box.innerHTML = head + `<div class="setup-card ds-card"><h4><i class="ti ti-cloud" style="margin-right:6px"></i>Shared settings</h4>
    <div class="ds-table-wrap"><table class="ds-table"><thead><tr><th>Shared setting</th><th>Last saved</th><th>State</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="ds-note">Also in Firebase (as before): company settings, numbering, purchase, billing and receipt settings, payment accounts, document locking, customers, suppliers, products, terms and all documents.</p>
    <p class="ds-note">Kept in the browser on purpose (per user / device): theme, font size, sidebar, rows per page, last page, drafts, notifications seen.</p></div>`
    + bcDataWindowCard() + bcBalancesCard() + bcSizesCard();
  if (window.BizCoreCash) { window.BizCoreCash.start(); if (!bcRenderDataHealth._hooked && window.BizCoreCash.onChange) { bcRenderDataHealth._hooked = true; window.BizCoreCash.onChange(() => { if (document.getElementById('dh-bal-stats')) bcFillBalanceStats(); }); } }
  if (window.BizCorePI) window.BizCorePI.start();
  bcFillDataWindowStats();
  bcFillSizes(false);
}
/* V269.1 — data plan step 2a: how much of the sales history is loaded when BizCore opens */
function bcDataWindowCard(){
  const m = Number(typeof settings !== 'undefined' && settings && settings.dataWindowMonths) || 12;
  const input = isAdmin()
    ? `<div style="display:flex;align-items:flex-end;gap:10px;margin:6px 0 10px"><div class="form-group" style="margin:0;max-width:200px"><label>Months loaded</label><input id="dh-window-months" type="number" min="1" max="120" step="1" value="${m}"/></div><button type="button" class="btn btn-secondary" onclick="bcSaveDataWindow()">Save</button></div>`
    : `<p><b>${m}</b> months <span class="pi-sub">(changed by an administrator)</span></p>`;
  return `<div class="setup-card ds-card"><h4><i class="ti ti-database" style="margin-right:6px"></i>Records loaded when BizCore opens</h4>
    <p class="ds-note">RFQs, quotations, sales orders, delivery notes, invoices, credit notes, receipts, purchase invoices, supplier payments, cash lines and stock movements: all open ones, and everything dated in the last N months:</p>
    ${input}
    <p class="ds-note">Older records are read only when asked: a date filter before that, "All Dates", a search for a number (press Enter), Dashboard "All time", Reports "Include older records" and Backup. A change takes effect the next time BizCore opens.</p>
    <div class="ds-table-wrap"><table class="ds-table"><thead><tr><th>Records</th><th>Loaded now</th><th>Of which older (read on request / linked)</th></tr></thead><tbody id="dh-window-stats"><tr><td colspan="3" class="pi-sub">…</td></tr></tbody></table></div></div>`;
}
async function bcFillDataWindowStats(){
  const tb = document.getElementById('dh-window-stats'); if (!tb || !window.BCWin) return;
  const names = { rfqs: 'RFQs', quotations: 'Quotations', salesOrders: 'Sales orders', deliveryNotes: 'Delivery notes', customerInvoices: 'Invoices', creditNotes: 'Credit notes', customerReceipts: 'Receipts', invoicePayments: 'Invoice payment records',
    purchaseInvoices: 'Purchase invoices', supplierPayments: 'Supplier payments', salesOrderPurchasing: 'Purchased quantities per order', cashLines: 'Cash & bank lines', stockAllocations: 'Stock allocations', stockChanges: 'Stock item changes' };   // V269.3
  const st = window.BCWin.stats(), c = await window.BCWin.config();
  tb.innerHTML = Object.keys(names).filter(k => st[k]).map(k => `<tr><td><b>${esc(names[k])}</b></td><td>${st[k].total}</td><td>${st[k].extra}${st[k].olderFrom === '' ? ' · all older read' : ''}</td></tr>`).join('')
    + `<tr><td colspan="3" class="pi-sub">Loaded period starts ${esc(c.cutoff.split('-').reverse().join('-'))} (${c.months} months).</td></tr>`
    + bcReadsRow();
  bcFillBalanceStats();
}
/* V269.6 — data plan step 5: records per collection (counted by Firebase) and the largest records */
const BC_COUNT_COLS = [['quotations', 'Quotations'], ['rfqs', 'RFQs'], ['salesOrders', 'Sales orders'], ['deliveryNotes', 'Delivery notes'], ['customerInvoices', 'Invoices'],
  ['creditNotes', 'Credit notes'], ['customerReceipts', 'Receipts'], ['purchaseInvoices', 'Purchase invoices'], ['supplierPayments', 'Supplier payments'], ['cashLines', 'Cash & bank lines'],
  ['stockItems', 'Stock items'], ['customers', 'Customers'], ['suppliers', 'Suppliers'], ['products', 'Products'], ['employees', 'Employees'], ['operationalEvents', 'Delivery notification log']];
let _bcCounts = null, _bcCountedAt = 0;
function bcSizesCard(){
  return `<div class="setup-card ds-card"><h4><i class="ti ti-chart-bar" style="margin-right:6px"></i>Records in Firebase and the largest records</h4>
    <p class="ds-note">Counted by Firebase when this page opens (about one read per 1,000 records). A record can be at most 1 MB; BizCore warns above 500 KB and refuses a save above 900 KB.</p>
    <div class="ds-table-wrap"><table class="ds-table"><thead><tr><th>Records</th><th>In Firebase</th></tr></thead><tbody id="dh-counts"><tr><td colspan="2" class="pi-sub">Counting…</td></tr></tbody></table></div>
    <div style="margin:8px 0 14px"><button type="button" class="btn btn-secondary btn-sm" onclick="bcFillSizes(true)"><i class="ti ti-refresh"></i>Count again</button> <span class="pi-sub" id="dh-counted-at"></span></div>
    <div class="ds-table-wrap"><table class="ds-table"><thead><tr><th>Largest records loaded now</th><th>Size</th><th></th></tr></thead><tbody id="dh-largest"><tr><td colspan="3" class="pi-sub">…</td></tr></tbody></table></div></div>`;
}
async function bcFillSizes(force){
  const tb = document.getElementById('dh-counts'); if (!tb || !window.FB || !window.FB.fbCount) return;
  const kb = n => Math.max(1, Math.round(n / 1024)).toLocaleString('en-US') + ' KB';
  const lg = document.getElementById('dh-largest');
  if (lg && window.FB.fbLargest) {
    const list = window.FB.fbLargest(10);
    lg.innerHTML = list.map(x => `<tr><td><b>${esc(x.label)}</b><div class="pi-sub">${esc(x.col)}${x.deleted ? ' · in the Recycle Bin' : ''}</div></td><td>${kb(x.bytes)}</td><td>${x.bytes > 900 * 1024 ? '<span class="ds-chip bad">Over the limit</span>' : x.bytes > 500 * 1024 ? '<span class="ds-chip warn">Large</span>' : '<span class="ds-chip ok">OK</span>'}</td></tr>`).join('') || '<tr><td colspan="3" class="pi-sub">Nothing loaded yet.</td></tr>';
  }
  if (!_bcCounts || force) {
    tb.innerHTML = '<tr><td colspan="2" class="pi-sub">Counting…</td></tr>';
    const out = {};
    await Promise.all(BC_COUNT_COLS.map(async ([c]) => { try { out[c] = await window.FB.fbCount(c); } catch (e) { out[c] = null; } }));
    _bcCounts = out; _bcCountedAt = Date.now();
  }
  const t = document.getElementById('dh-counts'); if (!t) return;
  const total = Object.values(_bcCounts).reduce((a, v) => a + (v || 0), 0);
  t.innerHTML = BC_COUNT_COLS.map(([c, label]) => `<tr><td>${esc(label)}</td><td>${_bcCounts[c] == null ? '<span class="pi-sub">not counted</span>' : Number(_bcCounts[c]).toLocaleString('en-US')}</td></tr>`).join('')
    + `<tr><td><b>Total</b></td><td><b>${total.toLocaleString('en-US')}</b></td></tr>`;
  const at = document.getElementById('dh-counted-at'); if (at) at.textContent = 'Counted ' + new Date(_bcCountedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
window.bcFillSizes = bcFillSizes;

/* V269.4 — data plan step 2c: how many records were read from Firebase (start-up = the first minute) */
function bcReadsRow(){
  const r = window.BCReads; if (!r) return '';
  const top = Object.entries(r.byCol).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => esc(k) + ' ' + v).join(' · ');
  return `<tr><td><b>Records read from Firebase</b><div class="pi-sub">Free allowance: 50,000 a day for everyone together</div></td><td>${r.startup} when BizCore opened</td><td>${r.total} since then${top ? '<div class="pi-sub">Most: ' + top + '</div>' : ''}</td></tr>`;
}
/* V269.3 — data plan step 2b: running balances of the cash & bank accounts, last price per item */
function bcBalancesCard(){
  return `<div class="setup-card ds-card"><h4><i class="ti ti-scale" style="margin-right:6px"></i>Running balances and last prices</h4>
    <p class="ds-note">Each cash / bank account keeps its balance up to date with every line (so Cash &amp; Bank needs only the recent lines), and each item keeps the last price paid. "Rebuild" adds up all the lines of every account again — only needed if a balance looks wrong.</p>
    <div class="ds-table-wrap"><table class="ds-table"><thead><tr><th>Account</th><th>Balance</th><th>Lines</th><th>State</th></tr></thead><tbody id="dh-bal-stats"><tr><td colspan="4" class="pi-sub">…</td></tr></tbody></table></div>
    <div style="display:flex;gap:10px;align-items:center;margin-top:8px"><button type="button" class="btn btn-secondary btn-sm" onclick="bcRebuildBalances()"><i class="ti ti-refresh"></i>Rebuild balances</button><span class="pi-sub" id="dh-lp-count"></span></div></div>`;
}
function bcFillBalanceStats(){
  const tb = document.getElementById('dh-bal-stats'), cash = window.BizCoreCash; if (!tb || !cash || !cash.balances) return;
  const accs = (window.BizCoreAcc && window.BizCoreAcc.accounts) || [];
  const money = n => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  tb.innerHTML = accs.map(a => { const r = cash.balances.get(a.id);
    const st = !r ? (a.hasEntries ? '<span class="ds-chip warn">To rebuild</span>' : '<span class="ds-chip">No lines yet</span>') : r.rebuiltAt ? '<span class="ds-chip ok">Up to date</span>' : '<span class="ds-chip warn">To rebuild</span>';
    return `<tr><td><b>${esc(a.name || a.id)}</b></td><td>${r ? money((Number(a.openingBalance) || 0) + (Number(r.balance) || 0)) : '—'}</td><td>${r ? Number(r.lineCount) || 0 : '—'}</td><td>${st}</td></tr>`; }).join('') || '<tr><td colspan="4" class="pi-sub">No payment accounts.</td></tr>';
  const lp = document.getElementById('dh-lp-count'); if (lp && window.BizCorePI && window.BizCorePI.lastPrices) { const k = window.BizCorePI.lastPrices.size; lp.textContent = k + (k === 1 ? ' item' : ' items') + ' with a last price'; }
}
async function bcRebuildBalances(){
  const cash = window.BizCoreCash; if (!cash || !cash.rebuildBalances) return;
  const run = () => cash.rebuildBalances({ all: true });
  const n = typeof bcBusy === 'function' ? await bcBusy('Rebuilding balances…', run) : await run();
  showToast(n ? `Rebuilt ${n} account balance${n === 1 ? '' : 's'}.` : 'Nothing rebuilt.', n ? 'success' : 'info');
  bcFillBalanceStats();
}
window.bcRebuildBalances = bcRebuildBalances;
async function bcSaveDataWindow(){
  const v = Math.round(Number(document.getElementById('dh-window-months')?.value));
  if (!(v >= 1 && v <= 120)) { showToast('Enter a number of months from 1 to 120.', 'error'); return; }
  settings.dataWindowMonths = v;
  await saveSettings();
  showToast('Saved. BizCore loads the last ' + v + ' months from the next time it opens.', 'success');
}
window.bcSaveDataWindow = bcSaveDataWindow;
window.bcRenderDataHealth = bcRenderDataHealth;

/* ── 4. Pricing approval by an administrator ──────────────────────────── */
function pricingCtx(){
  try {
    const r = rfqs.find(x => x.id === pricingRFQId); if (!r) return null;
    const v = typeof getCurrentPricingVersion === 'function' ? getCurrentPricingVersion(r) : null;
    const version = Number((v && v.version) || r.currentPricingVersion || 1);
    const m = getLivePricingMetrics(), ps = activePricingSettings();
    const ref = 'PR-' + String(r.rfqNo || r.id || '').replace(/^RFQ-?/i, '') + '-V' + version;
    return { r, version, ref, pct: Math.round(m.pct * 100) / 100, minMargin: Number(ps.minMargin || 0), totalSell: Math.round(m.totalSell * 100) / 100, totalCost: Math.round(m.totalCost * 100) / 100, customer: r.company || r.customer || '' };
  } catch (e) { return null; }
}
function approvalsFor(c){ const S = shared(); return ((S && S.approvals) || []).filter(a => a.kind === 'pricing' && a.rfqId === c.r.id && Number(a.version) === c.version).sort((a, b) => String(b.id).localeCompare(String(a.id))); }
/** V270.4.3: who may decide pricing approvals — the owner(s) and every active user whose role has the Special Right
 *  "Approve pricing below the minimum margin" (the Administrator role has every right). */
const canApprove = () => (typeof window.bcRight === 'function' ? window.bcRight('approveMargin') : isAdmin());
function adminList(){
  const S = shared(); if (!S) return [];
  const dir = S.profiles || [];
  const users = (window.BizCoreUsers && window.BizCoreUsers.users) || [];
  const out = S.adminUids.map(uid => { const p = dir.find(x => x.uid === uid) || users.find(x => x.uid === uid); return { uid, name: (p && (p.name || p.email)) || 'Administrator (' + uid.slice(0, 6) + '…)' }; });
  for (const u of users) {
    if (!u || u.active === false || out.some(o => o.uid === u.uid)) continue;
    const role = (u.companyRoles || {}).default, rights = (u.perm && u.perm.rightMods) || [];
    if (role === 'administrator' || rights.includes('approveMargin')) out.push({ uid: u.uid, name: u.name || u.email || u.uid });
  }
  return out;
}
const whenIso = ts => { try { return ts && ts.toDate ? ts.toDate().toISOString() : new Date().toISOString(); } catch (e) { return new Date().toISOString(); } };

/** Returns {by, at, id} when the save may go ahead, or null. */
async function bcPricingApproval(){
  const c = pricingCtx(); if (!c) { toast('Open the pricing first.', 'error'); return null; }
  const me = (window.currentUser && window.currentUser.name) || 'Administrator';
  if (isAdmin() || (typeof window.bcRight === 'function' && window.bcRight('sellBelowMargin'))) return { by: me, at: new Date().toISOString(), id: isAdmin() ? 'admin-self' : 'right-self' };   // V270.4.3
  const list = approvalsFor(c);
  const ok = list.find(a => a.status === 'Approved' && Number(a.marginPct) <= c.pct + 0.005);
  if (ok) return { by: ok.decidedBy || '', at: whenIso(ok.decidedAt), id: ok.id };
  const pend = list.find(a => a.status === 'Pending');
  if (pend) { toast('Waiting for ' + (pend.approverName || 'an administrator') + ' to approve ' + c.ref + '. You can save once it is approved.', 'warning'); return null; }
  return new Promise(resolve => openAsk(c, list.find(a => a.status === 'Declined') || null, resolve));
}
window.bcPricingApproval = bcPricingApproval;

function openAsk(c, declined, resolve){
  const admins = adminList();
  const m = modalEl('ds-ask-modal');
  m._resolve = resolve; m._c = c;
  m.innerHTML = `<div class="modal pi-paym" role="dialog" aria-modal="true" aria-labelledby="dsa-title" style="--pi-w:520px">
    <div class="modal-header"><div><h2 id="dsa-title">Manager Approval Needed</h2><div class="so-create-subtitle">Margin ${c.pct.toFixed(1)}% is below the minimum ${c.minMargin.toFixed(1)}% · ${esc(c.ref)}</div></div><button class="close-btn" type="button" onclick="bcAskClose()" aria-label="Close">✕</button></div>
    <div class="modal-body">
      ${declined ? `<div class="pi-match bad"><i class="ti ti-circle-x"></i><span>Declined by ${esc(declined.decidedBy || 'an administrator')}${declined.decisionNote ? ': “' + esc(declined.decisionNote) + '”' : ''}. You can change the prices or ask again.</span></div>` : ''}
      <div class="form-group"><label for="dsa-admin">Ask an approver *</label><select id="dsa-admin">${admins.length ? admins.map(a => `<option value="${esc(a.uid)}">${esc(a.name)}</option>`).join('') : '<option value="">No approver found</option>'}</select></div>
      <div class="form-group"><label for="dsa-note">Note <em>Optional</em></label><input id="dsa-note" maxlength="300" placeholder="e.g. Competitor price, long-term customer"></div>
      <div class="pi-match adv ds-info"><i class="ti ti-info-circle"></i><span>The administrator gets a notification and approves or declines from their own login (PC or phone). The pricing can be saved once approved — recorded with their name and time.</span></div>
      <div class="inv-error" id="dsa-err" hidden></div>
    </div>
    <div class="modal-footer"><button class="btn btn-secondary" type="button" onclick="bcAskClose()">Cancel</button><button class="btn btn-primary" type="button" id="dsa-go" onclick="bcAskGo()" ${admins.length ? '' : 'disabled'}><i class="ti ti-send"></i>Ask for approval</button></div></div>`;
  openM('ds-ask-modal');
}
window.bcAskClose = () => { const m = document.getElementById('ds-ask-modal'); if (m && m._resolve) { m._resolve(null); m._resolve = null; } closeM('ds-ask-modal'); };
window.bcAskGo = async () => {
  const m = document.getElementById('ds-ask-modal'); if (!m) return;
  const c = m._c, sel = document.getElementById('dsa-admin'), uid = sel.value, err = document.getElementById('dsa-err');
  if (!uid) { err.textContent = 'Choose an administrator.'; err.hidden = false; return; }
  const name = sel.options[sel.selectedIndex].text;
  try {
    await (window.bcBusy || ((t, f) => f()))('Sending the request…', () => shared().askApproval({
      kind: 'pricing', rfqId: c.r.id, rfqNo: String(c.r.rfqNo || ''), ref: c.ref, version: c.version, customer: String(c.customer || '').slice(0, 200),
      marginPct: c.pct, minMargin: c.minMargin, totalSell: c.totalSell, totalCost: c.totalCost,
      note: String(document.getElementById('dsa-note').value || '').trim().slice(0, 300), approverUid: uid, approverName: name.slice(0, 120),
    }));
  } catch (e) { err.textContent = 'The request could not be sent: ' + (e && e.message || e); err.hidden = false; return; }
  const r = m._resolve; m._resolve = null; closeM('ds-ask-modal'); if (r) r(null);
  toast('Asked ' + name + ' to approve ' + c.ref + '. You will get a notification; save again once it is approved.', 'success');
};

/* Notifications: administrators get the requests, the requester gets the decision. */
function onApprovals(list){
  if (typeof addBizCoreNotification !== 'function') return;
  const uid = myUid(), weekAgo = Date.now() - 7 * 864e5;
  (list || []).forEach(a => {
    if (a.kind !== 'pricing') return;
    if (a.status === 'Pending' && canApprove() && (!a.approverUid || a.approverUid === uid)) {
      addBizCoreNotification({ id: 'apr:' + a.id, type: 'approval', approvalId: a.id, title: 'Approval needed: ' + (a.ref || ''), message: (a.requestedBy || '') + ' · margin ' + Number(a.marginPct || 0).toFixed(1) + '% (min. ' + Number(a.minMargin || 0).toFixed(1) + '%)' + (a.customer ? ' · ' + a.customer : ''), severity: 'attention', actor: a.requestedBy || '' });
    }
    if ((a.status === 'Approved' || a.status === 'Declined') && a.requestedByUid === uid) {
      const at = a.decidedAt && a.decidedAt.toDate ? a.decidedAt.toDate().getTime() : Date.now();
      if (at < weekAgo) return;
      addBizCoreNotification({ id: 'apr-res:' + a.id + ':' + a.status, type: 'approval', approvalId: a.id, title: a.status + ': ' + (a.ref || ''), message: (a.decidedBy || '') + (a.decisionNote ? ' · “' + a.decisionNote + '”' : '') + (a.status === 'Approved' ? ' · You can save the pricing now.' : ''), severity: a.status === 'Approved' ? 'success' : 'critical', actor: a.decidedBy || '' });
    }
  });
}

function bcOpenApproval(id){
  const S = shared(), a = ((S && S.approvals) || []).find(x => x.id === id);
  if (!a) { toast('This request is no longer available.', 'info'); return; }
  const canDecide = canApprove() && a.status === 'Pending';
  const m = modalEl('ds-dec-modal'); m._id = id;
  const row = (k, v) => `<div class="ds-kv"><span>${k}</span><b>${v}</b></div>`;
  m.innerHTML = `<div class="modal pi-paym" role="dialog" aria-modal="true" aria-labelledby="dsd-title" style="--pi-w:520px">
    <div class="modal-header"><div><h2 id="dsd-title">Pricing Approval</h2><div class="so-create-subtitle">${esc(a.ref || '')} · ${esc(a.status)}</div></div><button class="close-btn" type="button" onclick="bcDecClose()" aria-label="Close">✕</button></div>
    <div class="modal-body">
      ${row('Customer', esc(a.customer || '—'))}${row('Asked by', esc(a.requestedBy || '') + ' · ' + esc(fmtWhen(a.requestedAt)))}${row('Margin', Number(a.marginPct || 0).toFixed(1) + '% (minimum ' + Number(a.minMargin || 0).toFixed(1) + '%)')}
      ${row('Selling total', typeof formatNumber === 'function' ? formatNumber(a.totalSell || 0, 2) : a.totalSell)}${row('Total cost', typeof formatNumber === 'function' ? formatNumber(a.totalCost || 0, 2) : a.totalCost)}
      ${a.note ? row('Note', '“' + esc(a.note) + '”') : ''}
      ${a.status !== 'Pending' ? row(a.status + ' by', esc(a.decidedBy || '') + ' · ' + esc(fmtWhen(a.decidedAt)) + (a.decisionNote ? ' · “' + esc(a.decisionNote) + '”' : '')) : ''}
      ${canDecide ? `<div class="form-group" style="margin-top:12px"><label for="dsd-note">Note <em>Optional</em></label><input id="dsd-note" maxlength="300" placeholder="e.g. OK for this customer only"></div>` : ''}
      ${a.status === 'Pending' && !canApprove() ? '<p class="ds-note">Waiting for the approver.</p>' : ''}
      <div class="inv-error" id="dsd-err" hidden></div>
    </div>
    <div class="modal-footer">${canDecide ? '<button class="btn btn-secondary" type="button" onclick="bcDecClose()">Later</button><span style="flex:1"></span><button class="btn btn-danger" type="button" onclick="bcDecide(\'Declined\')"><i class="ti ti-x"></i>Decline</button><button class="btn btn-primary" type="button" onclick="bcDecide(\'Approved\')"><i class="ti ti-check"></i>Approve</button>' : '<button class="btn btn-secondary" type="button" onclick="bcDecClose()">Close</button>'}</div></div>`;
  openM('ds-dec-modal');
}
window.bcOpenApproval = bcOpenApproval;
window.bcDecClose = () => closeM('ds-dec-modal');
window.bcDecide = async status => {
  const m = document.getElementById('ds-dec-modal'); if (!m) return;
  const err = document.getElementById('dsd-err'), note = document.getElementById('dsd-note')?.value || '';
  try { await (window.bcBusy || ((t, f) => f()))(status === 'Approved' ? 'Approving…' : 'Declining…', () => shared().decideApproval(m._id, status, note.trim())); }
  catch (e) { err.textContent = 'Could not save the decision: ' + (e && e.message || e); err.hidden = false; return; }
  closeM('ds-dec-modal'); toast(status === 'Approved' ? 'Approved. The requester can save the pricing now.' : 'Declined. The requester has been told.', 'success');
};

/* ── Start ─────────────────────────────────────────────────────────────── */
function boot(){
  const S = shared(); if (!S) { setTimeout(boot, 500); return; }
  try { S.start(); } catch (e) {}
  S.onChange(sync);
  S.onApprovals(onApprovals);
  if (S.approvals && S.approvals.length) onApprovals(S.approvals);
  // administrator status arrives on its own; check again when it does
  if (window.BizCoreLocks && window.BizCoreLocks.onSettingsChange) window.BizCoreLocks.onSettingsChange(() => { if (S.docs) sync(S.docs); onApprovals(S.approvals); });
}
boot();
})();
