/* ═══════════════════════════════════════════════════════════════════
   BizCore V267.1 — Administration → Finance → Payment Accounts (approved mockups, 15 Oct 2026)
   V268.2: card accounts name their linked bank account (approved mockup PI_10)
   • List of cash, card and bank accounts: code, name, type, custodian (cash), Zoho account, opening balance
   • Add / Edit window; accounts are never deleted (made inactive); code and name unique
   • Administrators only (server-trusted list system/accessControl — also enforced by the security rules)
   Data: paymentAccounts, paymentAccountKeys (js/account-service.mjs, js/account-core.mjs).
═══════════════════════════════════════════════════════════════════ */
'use strict';
let paTypeFilter = '';
const paEsc = v => (typeof escapeHtml === 'function' ? escapeHtml(v == null ? '' : String(v)) : String(v == null ? '' : v));
const paLib = () => window.BizCoreAcc;
const paIsAdmin = () => !!(paLib() && paLib().isAdministrator);
const paMoney = n => (typeof formatNumber === 'function' ? formatNumber(Number(n) || 0, 2) : (Number(n) || 0).toFixed(2));
const paDate = iso => (typeof fmtDate === 'function' ? fmtDate(iso) : iso);
const PA_TYPE_META = { cash: { label: 'Cash', icon: 'ti-cash' }, card: { label: 'Card', icon: 'ti-credit-card' }, bank: { label: 'Bank', icon: 'ti-building-bank' } };

function paAccounts(){ return paLib() ? paLib().accounts : []; }
function paTypePill(type){ const m = PA_TYPE_META[type] || PA_TYPE_META.cash; return `<span class="pa-type pa-type-${paEsc(type)}"><i class="ti ${m.icon}" aria-hidden="true"></i>${m.label}</span>`; }

function renderPaymentAccounts(){
  const lib = paLib(); if (!lib) return;
  lib.start();
  const all = paAccounts();
  const counts = { '': all.length, cash: 0, card: 0, bank: 0 }; all.forEach(a => { counts[a.type] = (counts[a.type] || 0) + 1; });
  const chips = document.getElementById('pa-chips');
  if (chips) chips.innerHTML = [['', 'All'], ['cash', 'Cash'], ['card', 'Card'], ['bank', 'Bank']].map(([k, l]) =>
    `<button type="button" class="pa-chip${paTypeFilter === k ? ' on' : ''}" aria-pressed="${paTypeFilter === k}" onclick="setPaymentAccountFilter('${k}')">${l} <b>${counts[k] || 0}</b></button>`).join('');
  const add = document.getElementById('pa-add-btn');
  if (add) { add.disabled = !paIsAdmin(); add.title = paIsAdmin() ? 'Add a payment account' : 'Only administrators can add accounts'; }
  const body = document.getElementById('pa-tbody'); if (!body) return;
  const rows = all.filter(a => !paTypeFilter || a.type === paTypeFilter);
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="8" class="pa-empty"><i class="ti ti-wallet"></i><b>${all.length ? 'No accounts of this type' : 'No payment accounts yet'}</b><span>${paIsAdmin() ? 'Use <b>Add Account</b> to create your cash, card and bank accounts.' : 'An administrator adds the cash, card and bank accounts.'}</span></td></tr>`;
    return;
  }
  body.innerHTML = rows.map(a => {
    const off = a.active === false;
    const bank = a.type === 'card' ? all.find(x => x.id === a.linkedBankAccountId) : null;
    const cust = a.type === 'cash' && a.custodianName
      ? `<span class="pa-cust"><span class="pa-avatar">${paEsc(a.custodianName.split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase())}</span>${paEsc(a.custodianName)}</span>`
      : a.type === 'card' ? (bank ? `<span class="pa-muted"><i class="ti ti-building-bank"></i> ${paEsc(bank.code)} · ${paEsc(bank.name)}</span>` : '<span class="pa-warn"><i class="ti ti-alert-triangle"></i> No linked bank account</span>')
      : '<span class="pa-muted">—</span>';
    return `<tr class="${off ? 'pa-off' : ''}" data-id="${paEsc(a.id)}">
      <td class="pa-code">${paEsc(a.code)}</td>
      <td class="pa-name">${paEsc(a.name)}</td>
      <td>${paTypePill(a.type)}</td>
      <td>${cust}</td>
      <td class="pa-zoho">${a.zohoName ? paEsc(a.zohoName) : '<span class="pa-muted">—</span>'}</td>
      <td class="num">${paMoney(a.openingBalance)}<small>as of ${paEsc(paDate(a.openingDate))}</small></td>
      <td>${off ? '<span class="pa-status off">Inactive</span>' : '<span class="pa-status on">Active</span>'}</td>
      <td class="pa-act"><button type="button" class="btn btn-secondary btn-sm pa-edit" title="${paIsAdmin() ? 'Edit' : 'View'} ${paEsc(a.name)}" aria-label="${paIsAdmin() ? 'Edit' : 'View'} ${paEsc(a.name)}" onclick="openPaymentAccountForm('${paEsc(a.id)}')"><i class="ti ${paIsAdmin() ? 'ti-edit' : 'ti-eye'}"></i></button></td>
    </tr>`;
  }).join('');
}
function setPaymentAccountFilter(k){ paTypeFilter = k; renderPaymentAccounts(); }

/* ───────────── Add / Edit window ───────────── */
function paEnsureModal(){
  let m = document.getElementById('pa-modal'); if (m) return m;
  m = document.createElement('div');
  m.className = 'modal-overlay'; m.id = 'pa-modal';
  m.innerHTML = `<div class="modal pa-modal" role="dialog" aria-modal="true" aria-labelledby="pa-modal-title">
    <div class="modal-header"><div class="modal-header-title-wrap"><h2 id="pa-modal-title">Payment Account</h2></div><button class="close-btn" type="button" onclick="closeModal('pa-modal')" aria-label="Close">✕</button></div>
    <div class="modal-body pa-form">
      <div class="form-group pa-f-code"><label for="pa-code">Account code *</label><input id="pa-code" maxlength="20" autocomplete="off" placeholder="e.g. 1111"></div>
      <div class="form-group pa-f-name"><label for="pa-name">Account name *</label><input id="pa-name" maxlength="80" autocomplete="off" placeholder="e.g. Cash in Hand – Shabeeb"></div>
      <div class="form-group pa-f-type"><label>Type *</label><div class="pa-seg" role="radiogroup" aria-label="Account type" id="pa-type">
        <button type="button" role="radio" data-type="cash" onclick="paSetType('cash')"><i class="ti ti-cash"></i>Cash</button><button type="button" role="radio" data-type="card" onclick="paSetType('card')"><i class="ti ti-credit-card"></i>Card</button><button type="button" role="radio" data-type="bank" onclick="paSetType('bank')"><i class="ti ti-building-bank"></i>Bank</button></div></div>
      <div class="form-group pa-f-cust" id="pa-cust-wrap"><label for="pa-cust">Custodian *</label><input id="pa-cust" maxlength="80" autocomplete="off" placeholder="Person who holds this cash"><small>A name — the person doesn't need a BizCore login.</small></div>
      <div class="form-group pa-f-cust" id="pa-bank-wrap" hidden><label for="pa-bank">Linked bank account *</label><select id="pa-bank"></select><small>Card payments come out of this bank account at once. Only bank accounts can be chosen.</small></div>
      <div class="form-group pa-f-login" id="pa-login-wrap"><label for="pa-login">Custodian login <em>optional</em></label><select id="pa-login"></select><small>Link a BizCore login so the custodian confirms this cash ledger. Without a login an administrator confirms for them.</small></div>
      <div class="form-group pa-f-zoho"><label for="pa-zoho">Zoho account name <em>optional</em></label><input id="pa-zoho" maxlength="120" autocomplete="off" placeholder="Exactly as in Zoho Books"></div>
      <div class="form-group pa-f-bal"><label for="pa-bal">Opening balance (SAR)</label><input id="pa-bal" inputmode="decimal" autocomplete="off" placeholder="0.00"></div>
      <div class="form-group pa-f-date"><label for="pa-date">Balance as of *</label><input id="pa-date" type="date"></div>
      <label class="pa-f-active"><input type="checkbox" id="pa-active" checked> <span><b>Active</b> — can be chosen for new receipts and payments</span></label>
      <div class="pa-info" id="pa-info"></div>
      <div class="pa-error" id="pa-error" role="alert" hidden></div>
    </div>
    <div class="modal-footer"><span class="pa-meta" id="pa-meta"></span><button class="btn btn-secondary" type="button" onclick="closeModal('pa-modal')">Cancel</button><button class="btn btn-primary" type="button" id="pa-save" onclick="savePaymentAccount()"><i class="ti ti-device-floppy"></i>Save Account</button></div>
  </div>`;
  document.body.appendChild(m);
  return m;
}
function paSetType(t){
  const m = document.getElementById('pa-modal'); if (!m || m._locked) return;
  m._type = t;
  m.querySelectorAll('#pa-type [data-type]').forEach(b => { const on = b.dataset.type === t; b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); });
  document.getElementById('pa-cust-wrap').hidden = t !== 'cash';
  const bw = document.getElementById('pa-bank-wrap'); if (bw) bw.hidden = t !== 'card';
  const lw = document.getElementById('pa-login-wrap'); if (lw) lw.hidden = t !== 'cash';
}
function openPaymentAccountForm(id){
  const m = paEnsureModal();
  const a = id ? paAccounts().find(x => x.id === id) : null;
  const admin = paIsAdmin();
  m._id = a ? a.id : null; m._rev = a ? a.revision : null; m._locked = false;
  document.getElementById('pa-modal-title').textContent = a ? (admin ? 'Edit Payment Account' : 'Payment Account') : 'New Payment Account';
  const t = new Date(), p = n => String(n).padStart(2, '0');
  document.getElementById('pa-code').value = a ? a.code : '';
  document.getElementById('pa-name').value = a ? a.name : '';
  document.getElementById('pa-cust').value = a ? (a.custodianName || '') : '';
  document.getElementById('pa-zoho').value = a ? (a.zohoName || '') : '';
  document.getElementById('pa-bal').value = a ? paMoney(a.openingBalance) : '';
  document.getElementById('pa-date').value = a ? a.openingDate : `${t.getFullYear()}-${p(t.getMonth() + 1)}-01`;
  document.getElementById('pa-active').checked = a ? a.active !== false : true;
  paFillLogins(a ? (a.custodianUid || '') : '');
  paFillBanks(a ? (a.linkedBankAccountId || '') : '', a ? a.id : '');
  paSetType(a ? a.type : 'cash');
  const used = !!(a && a.hasEntries);
  m._locked = used;
  ['pa-bal', 'pa-date'].forEach(i => { document.getElementById(i).disabled = used || !admin; });
  m.querySelectorAll('#pa-type button').forEach(b => { b.disabled = used || !admin; });
  ['pa-code', 'pa-name', 'pa-cust', 'pa-login', 'pa-bank', 'pa-zoho', 'pa-active'].forEach(i => { document.getElementById(i).disabled = !admin; });
  document.getElementById('pa-save').style.display = admin ? '' : 'none';
  document.getElementById('pa-info').innerHTML = used
    ? '<i class="ti ti-lock"></i> This account already has entries: its type and opening balance can no longer change.'
    : '<i class="ti ti-info-circle"></i> Cash accounts have a custodian; card accounts have a linked bank account — a card payment is shown in the card\'s history and lowers that bank account\'s balance. The type and opening balance are fixed once the account has entries.';
  document.getElementById('pa-meta').textContent = a ? `Last changed by ${a.updatedByName || '—'}` : '';
  paShowError('');
  m.querySelectorAll('.pa-bad').forEach(e => e.classList.remove('pa-bad'));
  if (typeof openModalWithSize === 'function') openModalWithSize('pa-modal'); else m.classList.add('open');
  setTimeout(() => { const f = document.getElementById(a ? 'pa-name' : 'pa-code'); if (f && !f.disabled) f.focus(); }, 60);
}
/* V267.2: the logins a cash custodian can be linked to (office staff + cash custodian logins) */
function paFillLogins(current){
  const sel = document.getElementById('pa-login'); if (!sel) return;
  const cash = window.BizCoreCash; if (cash) cash.startDirectory();
  const seen = new Set(), opts = ['<option value="">— no login (an administrator confirms) —</option>'];
  const add = (uid, label) => { if (!uid || seen.has(uid)) return; seen.add(uid); opts.push(`<option value="${paEsc(uid)}">${paEsc(label)}</option>`); };
  (cash ? cash.custodians : []).filter(c => c.active !== false || c.uid === current).forEach(c => add(c.uid, `${c.name} · ${c.email} (cash login)`));
  (cash ? cash.directory : []).forEach(d => add(d.uid, `${d.name || d.email} · ${d.email} (office)`));
  if (current && !seen.has(current)) add(current, `Linked login (${current.slice(0, 8)}…)`);
  sel.innerHTML = opts.join(''); sel.value = current || '';
}
/* V268.2: the bank account a card is linked to */
function paFillBanks(current, selfId){
  const sel = document.getElementById('pa-bank'); if (!sel) return;
  const banks = paAccounts().filter(x => x.type === 'bank' && x.id !== selfId && (x.active !== false || x.id === current));
  sel.innerHTML = '<option value="">Choose the bank account…</option>' + banks.map(b => `<option value="${paEsc(b.id)}">${paEsc(b.code)} · ${paEsc(b.name)}</option>`).join('');
  sel.value = banks.some(b => b.id === current) ? current : '';
}
function paShowError(msg, fields){
  const e = document.getElementById('pa-error'); if (!e) return;
  e.hidden = !msg; e.textContent = msg || '';
  const map = { code: 'pa-code', name: 'pa-name', custodianName: 'pa-cust', linkedBankAccountId: 'pa-bank', openingBalance: 'pa-bal', openingDate: 'pa-date', type: 'pa-type' };
  document.querySelectorAll('#pa-modal .pa-bad').forEach(x => x.classList.remove('pa-bad'));
  (fields || []).forEach(f => { const el = document.getElementById(map[f]); if (el) el.classList.add('pa-bad'); });
}
function existingUid(m){ const a = m && m._id ? paAccounts().find(x => x.id === m._id) : null; return a ? a.custodianUid : ''; }
async function savePaymentAccount(){
  const m = document.getElementById('pa-modal'), lib = paLib(); if (!m || !lib) return;
  if (!paIsAdmin()) { paShowError('Only administrators can change payment accounts.'); return; }
  const input = {
    code: document.getElementById('pa-code').value, name: document.getElementById('pa-name').value, type: m._type,
    linkedBankAccountId: document.getElementById('pa-bank') ? document.getElementById('pa-bank').value : '',
    custodianName: document.getElementById('pa-cust').value, custodianUid: document.getElementById('pa-login') ? document.getElementById('pa-login').value : (existingUid(m) || ''), zohoName: document.getElementById('pa-zoho').value,
    openingBalance: document.getElementById('pa-bal').value, openingDate: document.getElementById('pa-date').value,
    active: document.getElementById('pa-active').checked,
  };
  const existing = m._id ? paAccounts().find(x => x.id === m._id) : null;
  const v = lib.core.validateAccount(input, existing);
  if (!v.ok) { paShowError(v.errors.map(e => e.message).join(' '), v.errors.map(e => e.field)); return; }
  // friendly duplicate check before going to the server (the server checks again inside the transaction)
  const dupName = paAccounts().find(x => x.id !== m._id && x.nameKey === v.value.nameKey);
  const dupCode = paAccounts().find(x => x.id !== m._id && x.codeKey === v.value.codeKey);
  if (dupName || dupCode) { paShowError(dupCode ? `Account code ${v.value.code} is already used by "${dupCode.name}".` : `Another account is already called "${dupName.name}".`, [dupCode ? 'code' : 'name']); return; }
  const btn = document.getElementById('pa-save'); btn.disabled = true;
  try {
    const before = existing ? (existing.custodianUid || '') : '';
    const saved = await lib.service.saveAccount(input, m._id ? { id: m._id, expectedRevision: m._rev } : {});
    // V267.2: lines already in the ledger follow the newly linked login
    if (existing && (saved.custodianUid || '') !== before && window.BizCoreCash) { try { await window.BizCoreCash.service.relinkLines(saved.id); } catch (e) { console.warn('[BizCore] relink lines:', e.message); } }
    closeModal('pa-modal');
    if (typeof showToast === 'function') showToast(m._id ? 'Payment account saved' : 'Payment account added', 'success');
  } catch (e) {
    const field = e.details && e.details.field ? [e.details.field] : (e.details && e.details.errors ? e.details.errors.map(x => x.field) : []);
    paShowError(e.code === 'permission-denied' ? 'The server refused the change: only administrators can manage payment accounts.' : (e.message || 'Could not save the account.'), field);
  } finally { btn.disabled = false; }
}

/* live refresh while the screen is open */
(function paWire(){
  const go = () => {
    const lib = paLib(); if (!lib) return setTimeout(go, 300);
    lib.onChange(() => { const tab = document.getElementById('setup-tab-payment-accounts'); if (tab && tab.style.display !== 'none') renderPaymentAccounts(); });
  };
  go();
})();
console.log('Payment Accounts V268.2 ✅ (Administration → Finance)');
