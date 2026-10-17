/* ═══════════════════════════════════════════════════════════════════
   BizCore V267.2 — Finance → Cash & Bank (office staff) and cash custodian logins.
   Approved mockups 15 Oct 2026 (CASH_staff, CASH_login).
   • Accounts with balances and ⏳ / ⚠ counts; the ledger of the chosen account with each line's
     custodian confirmation; New handover; edit / cancel a handover; printable statement.
   • Staff confirm only lines of accounts they hold themselves; an administrator confirms for a
     custodian without a login. Queried lines raise a notification.
   • Administration → Users → Cash custodian logins (also from Payment Accounts).
   Data: js/ledger-service.mjs via window.BizCoreCash; accounts via window.BizCoreAcc.
═══════════════════════════════════════════════════════════════════ */
'use strict';
let cbAccountId = null, cbFilter = 'all';
const cbLib = () => window.BizCoreCash;
const cbAcc = () => (window.BizCoreAcc ? window.BizCoreAcc.accounts : []);
const cbUI = () => window.BizCashUI;
const cbEsc = v => cbUI().esc(v);
const cbToday = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const cbToast = (m, t) => { if (typeof showToast === 'function') showToast(m, t || 'success'); };
const cbWho = () => ({ uid: cbLib() && cbLib().uid, isAdmin: !!(cbLib() && cbLib().isAdministrator) });
const cbCanConfirm = r => !!(cbLib() && cbLib().core.confirmRight(r, cbWho()));
const CB_ICON = { cash: 'ti-cash', card: 'ti-credit-card', bank: 'ti-building-bank' };

function cbLedgerOf(a) { return cbLib().core.buildLedger(a, cbLib().lines.filter(l => l.accountId === a.id)); }

function renderCashBank() {
  const lib = cbLib(), root = document.getElementById('cashbank-root');
  if (!lib || !root || !cbUI()) return;
  lib.start();
  const accounts = cbAcc().filter(a => a.active !== false || lib.lines.some(l => l.accountId === a.id));
  if (!accounts.length) {
    root.innerHTML = `<div class="cl-card"><div class="cb-placeholder"><i class="ti ti-wallet"></i><b>No payment accounts yet</b><p>An administrator adds the cash, card and bank accounts in Administration → Finance → Payment Accounts.</p></div></div>`;
    return;
  }
  if (!accounts.find(a => a.id === cbAccountId)) cbAccountId = (accounts.find(a => a.type === 'cash') || accounts[0]).id;
  const ledgers = new Map(accounts.map(a => [a.id, cbLedgerOf(a)]));
  const total = accounts.reduce((s, a) => s + (a.active !== false ? ledgers.get(a.id).balance : 0), 0);
  const list = accounts.map(a => {
    const g = ledgers.get(a.id);
    const bank = a.type === 'card' ? accounts.find(x => x.id === a.linkedBankAccountId) : null;   // V268.2
    const cust = a.type === 'cash' ? (a.custodianName ? 'Custodian: ' + cbEsc(a.custodianName) + (a.custodianUid ? '' : ' · no login') : 'no custodian')
      : a.type === 'card' ? (bank ? 'from ' + cbEsc(bank.code) + ' · ' + cbEsc(bank.name) : 'no linked bank account') : 'bank account';
    return `<button type="button" class="cb-acc${a.id === cbAccountId ? ' on' : ''}${a.active === false ? ' off' : ''}" data-act="pick" data-id="${cbEsc(a.id)}" aria-pressed="${a.id === cbAccountId}">
      <span class="cb-ty ${cbEsc(a.type)}"><i class="ti ${CB_ICON[a.type] || 'ti-cash'}"></i></span>
      <span><span class="nm">${cbEsc(a.name)}</span><span class="cl-sub">${cust}${a.active === false ? ' · inactive' : ''}</span></span>
      <span class="bal">${cbUI().money(g.balance)}${g.waiting ? `<span style="display:block"><span class="cb-badge">⏳ ${g.waiting}</span></span>` : ''}${g.queried ? `<span style="display:block"><span class="cb-badge q">⚠ ${g.queried}</span></span>` : ''}</span></button>`;
  }).join('');
  const a = accounts.find(x => x.id === cbAccountId), g = ledgers.get(a.id);
  const opts = { mode: 'staff', filter: cbFilter, canConfirm: cbCanConfirm, custodianName: a.custodianName, canEdit: true, confirmable: cbLib().core.confirmableLines(g.rows, cbWho()).length };
  const isCash = a.type === 'cash';
  const head = `<div class="cl-ch"><h3><i class="ti ti-list-details"></i>${cbEsc(a.name)}</h3><span class="cb-headsub">Balance ${cbUI().money(g.balance)} · confirmed ${cbUI().money(g.confirmedBalance)}</span>
    <div class="cl-r">${cbUI().toolbarHtml(g, opts)}<button type="button" class="cl-btn" data-act="statement"><i class="ti ti-printer"></i>Statement</button>${isCash ? '<button type="button" class="cl-btn cl-p" data-act="handover"><i class="ti ti-arrows-exchange"></i>New handover</button>' : ''}</div></div>`;
  const note = isCash
    ? 'Staff see every account and each line\'s confirmation. Only the custodian (or an administrator for a custodian without a login) can confirm. Click a TRF voucher to correct or cancel a handover.'
    : a.type === 'card' ? 'Card payments come out of the linked bank account at once — they are listed here for reference (amounts in brackets) and counted in the bank account.'
    : 'Supplier payments by bank transfer or card (with bank charges) are listed here. Customer receipts will follow in a later step.';
  root.innerHTML = `<div class="cb-split">
    <div class="cl-card"><div class="cl-ch"><h3><i class="ti ti-wallet"></i>Accounts</h3></div>${list}
      <div class="cl-note"><i class="ti ti-sum"></i><span>Total cash &amp; bank: <b>${cbUI().money(total)}</b></span></div></div>
    <div class="cl-card">${head}${cbUI().tableHtml(g, opts)}<div class="cl-note"><i class="ti ti-info-circle"></i><span>${note}</span></div></div></div>`;
}

/* ── clicks inside the page ── */
document.addEventListener('click', async e => {
  const b = e.target.closest('#cashbank-root [data-act]'); if (!b) return;
  const act = b.dataset.act, lib = cbLib();
  if (act === 'pick') { cbAccountId = b.dataset.id; cbFilter = 'all'; renderCashBank(); }
  else if (act === 'filter') { cbFilter = b.dataset.filter; renderCashBank(); }
  else if (act === 'confirm') { b.disabled = true; try { await lib.service.confirmLine(b.dataset.id); cbToast('Line confirmed'); } catch (err) { cbToast(err.message, 'error'); b.disabled = false; } }
  else if (act === 'query') cbOpenQuery(b.dataset.id);
  else if (act === 'confirm-all') {
    const ids = lib.core.confirmableLines(lib.lines.filter(l => l.accountId === cbAccountId && !l.void), cbWho()).map(l => l.id);
    if (!ids.length) return;
    const ok = typeof showConfirmAsync === 'function' ? await showConfirmAsync({ icon: '✓', title: 'Confirm all waiting?', message: `Confirm ${ids.length} waiting line${ids.length === 1 ? '' : 's'} of this account?`, confirmText: 'Confirm all', cancelText: 'Cancel' }) : true;
    if (!ok) return;
    const r = await lib.service.confirmLines(ids);
    cbToast(r.failed.length ? `${r.done.length} confirmed, ${r.failed.length} not: ${r.failed[0].message}` : `${r.done.length} line${r.done.length === 1 ? '' : 's'} confirmed`, r.failed.length ? 'error' : 'success');
  }
  else if (act === 'handover') cbOpenHandover(null);
  else if (act === 'edit') cbOpenHandover(b.dataset.entry);
  else if (act === 'open-pi') { if (typeof openPurchaseInvoiceView === 'function') { if (window.BizCorePI) window.BizCorePI.start(); openPurchaseInvoiceView(b.dataset.pi); } }   // V268.2
  else if (act === 'statement') cbOpenStatement();
});

/* ── a small modal in the app's style ── */
function cbModal(id, title, bodyHtml, footHtml, width = 560) {
  let m = document.getElementById(id);
  if (!m) { m = document.createElement('div'); m.className = 'modal-overlay'; m.id = id; document.body.appendChild(m); }
  m.innerHTML = `<div class="modal cb-modal" role="dialog" aria-modal="true" aria-labelledby="${id}-title" style="width:min(${width}px,96vw);max-width:${width}px;height:auto;max-height:92vh">
    <div class="modal-header"><div class="modal-header-title-wrap"><h2 id="${id}-title">${cbEsc(title)}</h2></div><button class="close-btn" type="button" onclick="closeModal('${id}')" aria-label="Close">✕</button></div>
    <div class="modal-body"><div class="cl-form">${bodyHtml}<div class="cl-err" id="${id}-err" hidden></div></div></div>
    <div class="modal-footer">${footHtml}</div></div>`;
  if (typeof openModalWithSize === 'function') openModalWithSize(id); else m.classList.add('open');
  setTimeout(() => { const f = m.querySelector('.modal-body input:not([disabled]),.modal-body select:not([disabled]),.modal-body textarea'); if (f) f.focus(); }, 60);
  return m;
}
function cbErr(id, msg) { const e = document.getElementById(id + '-err'); if (e) { e.hidden = !msg; e.textContent = msg || ''; } }

/* ── query ── */
function cbOpenQuery(lineId) {
  const l = cbLib().lines.find(x => x.id === lineId); if (!l) return;
  const d = cbUI().describe(l);
  cbModal('cb-query', 'Query this line', `<div class="full cl-info"><b>${cbEsc(l.voucherNo)}</b> · ${cbEsc(d.title)} · ${l.amountIn ? '+' + cbUI().money(l.amountIn) : '−' + cbUI().money(l.amountOut)}</div>
    <div class="full"><label for="cb-q-note">What is wrong? *</label><textarea id="cb-q-note" maxlength="200" placeholder="e.g. Not received"></textarea></div>`,
    `<button class="btn btn-secondary" type="button" onclick="closeModal('cb-query')">Cancel</button><button class="btn btn-primary" type="button" id="cb-q-save" onclick="cbSaveQuery('${cbEsc(lineId)}')"><i class="ti ti-message-question"></i>Send query</button>`, 480);
}
async function cbSaveQuery(lineId) {
  const note = document.getElementById('cb-q-note').value, btn = document.getElementById('cb-q-save');
  if (!cbLib().core.validateQueryNote(note).ok) { cbErr('cb-query', 'Say what is wrong (for example: not received).'); return; }
  btn.disabled = true;
  try { await cbLib().service.queryLine(lineId, note); closeModal('cb-query'); cbToast('Query recorded'); }
  catch (e) { cbErr('cb-query', e.message); } finally { btn.disabled = false; }
}

/* ── new / edit handover ── */
function cbOpenHandover(entryId) {
  const lib = cbLib(), cash = cbAcc().filter(a => a.type === 'cash');
  const inL = entryId ? lib.lines.find(l => l.entryId === entryId && l.amountIn > 0) : null;
  const outL = entryId ? lib.lines.find(l => l.entryId === entryId && l.amountOut > 0) : null;
  if (entryId && (!inL || !outL)) { cbToast('This handover is not loaded yet.', 'error'); return; }
  const active = cash.filter(a => a.active !== false);
  const opt = (list, sel) => list.map(a => `<option value="${cbEsc(a.id)}"${a.id === sel ? ' selected' : ''}>${cbEsc(a.name)}${a.custodianName ? ' (' + cbEsc(a.custodianName) + ')' : ''}</option>`).join('');
  const fromSel = outL ? outL.accountId : (cbAcc().find(a => a.id === cbAccountId && a.type === 'cash') ? cbAccountId : '');
  const m = cbModal('cb-ho', entryId ? `Handover ${outL.voucherNo}` : 'New handover', `
    <div class="full"><label for="cb-ho-from">From (gives the cash) *</label><select id="cb-ho-from"${entryId ? ' disabled' : ''}><option value="">Choose…</option>${opt(entryId ? cash : active, fromSel)}</select></div>
    <div class="full"><label for="cb-ho-to">To (receives the cash) *</label><select id="cb-ho-to"${entryId ? ' disabled' : ''}><option value="">Choose…</option>${opt(entryId ? cash : active, inL ? inL.accountId : '')}</select></div>
    <div><label for="cb-ho-amt">Amount (SAR) *</label><input id="cb-ho-amt" inputmode="decimal" autocomplete="off" placeholder="0.00" value="${inL ? cbUI().money(inL.amountIn) : ''}"></div>
    <div><label for="cb-ho-date">Date *</label><input id="cb-ho-date" type="date" max="${cbToday()}" value="${inL ? cbEsc(inL.date) : cbToday()}"></div>
    <div class="full"><label for="cb-ho-note">Note</label><input id="cb-ho-note" maxlength="200" placeholder="optional" value="${inL ? cbEsc(inL.description || '') : ''}"></div>
    <div class="full cl-info">${entryId
      ? `Recorded by ${cbEsc(inL.recordedByName)}. To change who gave or received the cash, cancel this handover and record a new one. A new amount or date must be confirmed again by the receiver.`
      : 'The cash leaves the giver\'s balance and reaches the receiver\'s at once; the receiver then confirms it.'}</div>`,
    `${entryId ? '<button class="btn btn-danger" type="button" style="margin-right:auto" onclick="cbVoidHandover()"><i class="ti ti-ban"></i>Cancel handover</button>' : ''}<button class="btn btn-secondary" type="button" onclick="closeModal('cb-ho')">Close</button><button class="btn btn-primary" type="button" id="cb-ho-save" onclick="cbSaveHandover()"><i class="ti ti-device-floppy"></i>${entryId ? 'Save changes' : 'Record handover'}</button>`);
  m._entryId = entryId; m._rev = inL ? inL.entryRevision : null;
}
async function cbSaveHandover() {
  const m = document.getElementById('cb-ho'), lib = cbLib(), btn = document.getElementById('cb-ho-save');
  const input = { fromAccountId: document.getElementById('cb-ho-from').value, toAccountId: document.getElementById('cb-ho-to').value, amount: document.getElementById('cb-ho-amt').value, date: document.getElementById('cb-ho-date').value, description: document.getElementById('cb-ho-note').value };
  const from = cbAcc().find(a => a.id === input.fromAccountId), to = cbAcc().find(a => a.id === input.toAccountId);
  const v = lib.core.validateHandover(input, { from: m._entryId && from ? { ...from, active: true } : from, to: m._entryId && to ? { ...to, active: true } : to, today: cbToday() });
  if (!v.ok) { cbErr('cb-ho', v.errors.map(x => x.message).join(' ')); return; }
  btn.disabled = true;
  try {
    if (m._entryId) {
      const r = await lib.service.editHandover(m._entryId, input, { expectedRevision: m._rev });
      closeModal('cb-ho'); cbToast(r.reconfirm ? 'Saved — the receiver must confirm again' : 'Saved');
    } else {
      const r = await lib.service.recordHandover({ ...input, operationId: 'cb-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10) });
      closeModal('cb-ho'); cbToast(`${r.entry.voucherNo} recorded`);
    }
  } catch (e) { cbErr('cb-ho', e.code === 'permission-denied' ? 'The server refused this change.' : e.message); }
  finally { btn.disabled = false; }
}
function cbVoidHandover() {
  const m = document.getElementById('cb-ho'), entryId = m._entryId, rev = m._rev;
  closeModal('cb-ho');
  const v = cbModal('cb-void', 'Cancel handover', `<div class="full cl-info">The handover stays in the ledger, struck through, and no longer counts in either balance.</div>
    <div class="full"><label for="cb-void-why">Reason *</label><input id="cb-void-why" maxlength="200" placeholder="e.g. entered twice"></div>`,
    `<button class="btn btn-secondary" type="button" onclick="closeModal('cb-void')">Go back</button><button class="btn btn-danger" type="button" id="cb-void-save" onclick="cbSaveVoid()"><i class="ti ti-ban"></i>Cancel handover</button>`, 460);
  v._entryId = entryId; v._rev = rev;
}
async function cbSaveVoid() {
  const m = document.getElementById('cb-void'), why = document.getElementById('cb-void-why').value.trim(), btn = document.getElementById('cb-void-save');
  if (!why) { cbErr('cb-void', 'Enter the reason for cancelling.'); return; }
  btn.disabled = true;
  try { await cbLib().service.voidHandover(m._entryId, why, { expectedRevision: m._rev }); closeModal('cb-void'); cbToast('Handover cancelled — kept in the ledger, not counted'); }
  catch (e) { cbErr('cb-void', e.message); } finally { btn.disabled = false; }
}

/* ── statement ── */
function cbOpenStatement() {
  const a = cbAcc().find(x => x.id === cbAccountId); if (!a) return;
  cbModal('cb-st', 'Statement', `<div class="full cl-info">${cbEsc(a.code)} · ${cbEsc(a.name)}</div>
    <div><label for="cb-st-from">From</label><input id="cb-st-from" type="date" value="${cbEsc(a.openingDate)}"></div>
    <div><label for="cb-st-to">To</label><input id="cb-st-to" type="date" value="${cbToday()}"></div>`,
    `<button class="btn btn-secondary" type="button" onclick="closeModal('cb-st')">Close</button><button class="btn btn-primary" type="button" onclick="cbPrintStatement()"><i class="ti ti-printer"></i>Print</button>`, 460);
}
function cbPrintStatement() {
  const a = cbAcc().find(x => x.id === cbAccountId); if (!a) return;
  const html = cbUI().statementHtml(a, cbLedgerOf(a), { from: document.getElementById('cb-st-from').value, to: document.getElementById('cb-st-to').value, printedBy: (window.currentUser || {}).name || '' });
  const w = window.open('', '_blank');
  if (!w) { cbToast('Allow pop-ups to print the statement.', 'error'); return; }
  w.document.open(); w.document.write(html); w.document.close();
  closeModal('cb-st');
}

/* ═════════ Cash custodian logins (Administration → Users, and Payment Accounts) ═════════ */
function renderCustodianLogins() {
  const host = document.getElementById('cc-list'); if (!host || !cbLib()) return;
  cbLib().startDirectory();
  const admin = cbLib().isAdministrator, accs = cbAcc();
  const btn = document.getElementById('cc-new-btn'); if (btn) { btn.disabled = !admin; btn.title = admin ? '' : 'Only administrators can create custodian logins'; }
  const list = cbLib().custodians.slice().sort((x, y) => String(x.name).localeCompare(String(y.name)));
  if (!list.length) { host.innerHTML = '<p class="cl-sub" style="padding:6px 2px">No custodian logins yet. A custodian login sees only <b>My Cash</b>.</p>'; return; }
  host.innerHTML = `<table class="cc-list"><thead><tr><th>Name</th><th>Email (login)</th><th>Cash account(s)</th><th>Status</th><th></th></tr></thead><tbody>${list.map(c => {
    const names = accs.filter(a => a.custodianUid === c.uid).map(a => cbEsc(a.name)).join(', ') || '<span class="cl-sub">none linked</span>';
    const st = c.active === false ? '<span class="cl-st cl-void">Inactive</span>' : c.mustChangePassword ? '<span class="cl-st cl-w">Temporary password</span>' : '<span class="cl-st cl-c">Active</span>';
    return `<tr><td><b>${cbEsc(c.name)}</b></td><td>${cbEsc(c.email)}</td><td>${names}</td><td>${st}</td><td style="text-align:right">${admin ? `<button type="button" class="btn btn-secondary btn-sm" onclick="cbToggleCustodian('${cbEsc(c.uid)}',${c.active === false})">${c.active === false ? 'Activate' : 'Deactivate'}</button>` : ''}</td></tr>`;
  }).join('')}</tbody></table>`;
}
async function cbToggleCustodian(uid, active) {
  try { await cbLib().service.setCustodianActive(uid, active); cbToast(active ? 'Login activated' : 'Login deactivated — it can no longer see or confirm anything'); }
  catch (e) { cbToast(e.message, 'error'); }
}
function openCustodianLoginForm(accountId) {
  if (!cbLib() || !cbLib().isAdministrator) { cbToast('Only administrators can create custodian logins.', 'error'); return; }
  const cash = cbAcc().filter(a => a.type === 'cash' && a.active !== false);
  const pre = accountId ? cbAcc().find(a => a.id === accountId) : null;
  cbModal('cc-modal', 'New cash custodian login', `
    <div class="full"><label for="cc-name">Full name *</label><input id="cc-name" maxlength="120" autocomplete="off" value="${pre ? cbEsc(pre.custodianName || '') : ''}"></div>
    <div><label for="cc-email">Email (login) *</label><input id="cc-email" type="email" autocomplete="off" placeholder="name@downtowntradings.com"></div>
    <div><label for="cc-pw">Temporary password *</label><input id="cc-pw" type="text" autocomplete="off" minlength="8" placeholder="at least 8 characters"></div>
    <div class="full"><label>Cash account(s) *</label><div class="cl-accpick" id="cc-accs">${cash.length ? cash.map(a => `<label><input type="checkbox" value="${cbEsc(a.id)}"${pre && pre.id === a.id ? ' checked' : ''}> ${cbEsc(a.name)}<small>${a.custodianUid ? 'has a login' : cbEsc(a.custodianName || '')}</small></label>`).join('') : '<span class="cl-sub">Add a cash account first (Payment Accounts).</span>'}</div></div>
    <label class="full cl-check"><input type="checkbox" id="cc-must" checked> Ask to change the password at first login</label>
    <div class="full cl-info"><b>What this login can do:</b> open <b>My Cash</b> only — see the linked cash account(s), confirm or query lines, and hand over cash from them. It can't see quotations, orders, customers, prices or any other screen (enforced by the database, not just hidden).</div>`,
    `<button class="btn btn-secondary" type="button" onclick="closeModal('cc-modal')">Cancel</button><button class="btn btn-primary" type="button" id="cc-save" onclick="cbCreateCustodianLogin()"><i class="ti ti-user-plus"></i>Create login</button>`);
}
async function cbCreateCustodianLogin() {
  const input = { name: document.getElementById('cc-name').value, email: document.getElementById('cc-email').value, password: document.getElementById('cc-pw').value,
    accountIds: [...document.querySelectorAll('#cc-accs input:checked')].map(i => i.value), mustChangePassword: document.getElementById('cc-must').checked };
  const v = cbLib().core.validateCustodianLogin(input);
  if (!v.ok) { cbErr('cc-modal', v.errors.map(x => x.message).join(' ')); return; }
  const taken = cbAcc().filter(a => v.value.accountIds.includes(a.id) && a.custodianUid);
  if (taken.length) {
    const ok = typeof showConfirmAsync === 'function' ? await showConfirmAsync({ icon: '⚠️', title: 'Account already linked', message: `${taken.map(a => a.name).join(', ')} already has a login. Move it to this new login?`, confirmText: 'Move', cancelText: 'Go back' }) : true;
    if (!ok) return;
  }
  const btn = document.getElementById('cc-save'); btn.disabled = true; cbErr('cc-modal', '');
  try {
    const r = await cbLib().createCustodianLogin(input);
    closeModal('cc-modal');
    cbToast(r.failed.length ? `Login created, but not linked: ${r.failed.join('; ')}` : `Login created for ${v.value.name}. Give them the email and temporary password; they open My Cash.`, r.failed.length ? 'error' : 'success');
    renderCustodianLogins();
  } catch (e) { cbErr('cc-modal', e.message); }
  finally { btn.disabled = false; }
}

/* ── nav badge + notifications for queried lines ── */
function cbRefreshBadge() {
  const lib = cbLib(); if (!lib) return;
  const q = lib.lines.filter(l => l.status === 'queried' && !l.void).length;
  const b = document.getElementById('cashbank-badge');
  if (b) { b.style.display = q ? '' : 'none'; b.textContent = q; b.title = q ? `${q} line(s) queried by a custodian` : ''; }
  if (typeof addBizCoreNotification === 'function') {
    lib.lines.filter(l => l.status === 'queried' && !l.void).forEach(l => {
      const at = l.statusAt && (l.statusAt.seconds || (typeof l.statusAt.toMillis === 'function' ? l.statusAt.toMillis() : l.statusAt));
      addBizCoreNotification({ id: `cash-query:${l.id}:${at || ''}`, type: 'cash', title: `${l.statusByName || 'Custodian'} queried ${l.voucherNo}`, message: `${l.accountName} · “${l.statusNote}”`, severity: 'attention', accountId: l.accountId, actor: l.statusByName || '' });
    });
  }
}
function openCashBankAccount(accountId) { cbAccountId = accountId; cbFilter = 'all'; if (typeof showPage === 'function') showPage('cashbank'); }

(function cbWire() {
  const go = () => {
    const lib = cbLib(); if (!lib || !window.BizCoreAcc) return setTimeout(go, 300);
    lib.start();
    const refresh = () => {
      cbRefreshBadge();
      const p = document.getElementById('page-cashbank'); if (p && p.classList.contains('active')) renderCashBank();
      const u = document.getElementById('setup-tab-users'); if (u && u.style.display !== 'none') renderCustodianLogins();
    };
    lib.onChange(refresh); window.BizCoreAcc.onChange(refresh);
  };
  go();
})();
console.log('Cash & Bank V267.2 ✅');
