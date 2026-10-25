/* BizCore V270.4.1 — Administration → Users (approved mockups UR_1 / UR_2) and the Roles & Permissions list.
 * Data: window.BizCoreUsers (index.html → users/{uid}), window.BizCoreCash (cash custodian logins, login directory).
 * Only administrators manage users; the security rules enforce it (firestore.rules → "V270.4.1 Users"). */
(function () {
  const U = () => window.BizCoreUsers;
  const C = () => window.BizCoreCash;
  const core = () => U().core;
  const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = (m, t = 'success') => (typeof showToast === 'function' ? showToast(m, t) : console.log(m));
  const busy = (m, fn) => (window.bcBusy ? window.bcBusy(m, fn) : fn());
  /** The app's standard confirmation (showConfirm: title, message, label/value rows, Go back). Text is escaped here. */
  const confirmAsync = o => new Promise(resolve => {
    if (typeof showConfirm !== 'function') return resolve(window.confirm(o.title));
    const details = o.details && o.details.length ? Object.fromEntries(o.details.map(([k, v]) => [esc(k), esc(v)])) : null;
    let done = false; const fin = v => { if (!done) { done = true; resolve(v); } };
    showConfirm({ icon: o.icon || '👤', title: esc(o.title), message: esc(o.message || ''), details, confirmText: esc(o.confirmText || 'Confirm'),
      cancelText: 'Go back', confirmClass: o.confirmClass || 'btn-primary', onConfirm: () => fin(true), onCancel: () => fin(false) });
  });
  const IGNORE_KEY = 'bc.users.ignoredLogins';
  const ignored = () => { try { return JSON.parse(localStorage.getItem(IGNORE_KEY) || '[]'); } catch (e) { return []; } };
  const setIgnored = list => { try { localStorage.setItem(IGNORE_KEY, JSON.stringify(list)); } catch (e) {} };
  let chip = 'all';

  const ms = t => (t && typeof t.toMillis === 'function' ? t.toMillis() : t && t.seconds ? t.seconds * 1000 : Date.parse(t) || 0);
  const pad = n => String(n).padStart(2, '0');
  function lastSeen(t) {
    const m = ms(t); if (!m) return '<span class="ur-muted">Never</span>';
    const d = new Date(m), now = new Date();
    const day = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const diff = Math.round((day(now) - day(d)) / 86400000);
    if (diff === 0) return 'Today ' + hm;
    if (diff === 1) return 'Yesterday ' + hm;
    return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
  }
  const initials = n => String(n || '?').replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase() || '?';
  const companyName = () => {
    const s = window.settings || (typeof settings !== 'undefined' ? settings : {}) || {};
    return s.coname || 'Current company';
  };
  const companyShort = () => companyName().replace(/[\s,]+(Est\.?|Establishment|LLC|L\.L\.C\.?|Co\.?|Company|Ltd\.?|W\.L\.L\.?)$/i, '').trim() || companyName();
  const companyCr = () => {
    const s = window.settings || (typeof settings !== 'undefined' ? settings : {}) || {};
    return s.crno || s.crNumber || s.cr || '';
  };
  const empList = () => (typeof employees !== 'undefined' && Array.isArray(employees) ? employees : []).filter(e => e && e.active !== false)
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));

  /** All rows: users records + cash custodian logins (they keep their own record). */
  function rows() {
    const dir = (C() && C().directory) || [];
    const seen = uid => (dir.find(d => d.uid === uid) || {}).lastSeenAt;
    const owners = U().ownerUids;
    const out = U().users.map(u => ({
      kind: 'user', uid: u.uid, name: u.name, email: u.email, employee: u.employeeName || '', role: core().roleOfUser(u),
      status: core().userStatus(u), owner: owners.includes(u.uid), lastSeen: seen(u.uid), rec: u,
    }));
    for (const c of ((C() && C().custodians) || [])) {
      if (out.some(r => r.uid === c.uid)) continue;
      out.push({ kind: 'custodian', uid: c.uid, name: c.name, email: c.email, employee: '', role: 'cashCustodian',
        status: c.active === false ? 'inactive' : c.mustChangePassword ? 'mustChange' : 'active', owner: false, lastSeen: seen(c.uid), rec: c });
    }
    const rank = r => (r.owner ? 0 : r.status === 'inactive' ? 2 : 1);
    return out.sort((a, b) => rank(a) - rank(b) || String(a.name).localeCompare(String(b.name)));
  }
  const STATUS = { active: ['green', 'Active'], inactive: ['neutral', 'Inactive'], mustChange: ['amber', 'Must Change Password'] };

  /* ═════════ UR_1 Users list ═════════ */
  function renderUsersScreen() {
    const host = document.getElementById('ur-users-host'); if (!host) return;
    if (!U()) { host.innerHTML = '<div class="ur-locked">Loading…</div>'; return; }
    U().start();
    const admin = U().isAdministrator;
    if (!admin) {
      host.innerHTML = `<div class="ur-locked"><span style="font-size:20px">🔒</span><div><b>Only administrators manage users.</b><br>To change your password, use your name (top right) → Change Password.</div></div>`;
      return;
    }
    if (U().roles) core().setRoleLabels(U().roles);   // V270.4.2: names of added roles
    const all = rows();
    const owners = U().ownerUids;
    const without = core().loginsWithoutAccess({ directory: (C() && C().directory) || [], users: U().users, custodians: (C() && C().custodians) || [], ownerUids: owners, ignored: ignored() });
    const today = new Date(); const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const cnt = {
      all: all.length, active: all.filter(r => r.status !== 'inactive').length, inactive: all.filter(r => r.status === 'inactive').length,
      cust: all.filter(r => r.kind === 'custodian').length,
      admins: all.filter(r => r.status !== 'inactive' && (r.owner || r.role === 'administrator')).length,
      mustChange: all.filter(r => r.status === 'mustChange').length,
      today: all.filter(r => ms(r.lastSeen) >= Date.now() - 86400000).length,
    };
    const ownerNames = all.filter(r => r.owner).map(r => r.name).join(', ') || '—';
    const list = all.filter(r => chip === 'all' || (chip === 'active' && r.status !== 'inactive') || (chip === 'inactive' && r.status === 'inactive') || (chip === 'cust' && r.kind === 'custodian'));
    host.innerHTML = `
      ${without.length ? `<div class="ur-alert" id="ur-without"><span class="ur-alert-ic">⚠️</span><div class="ur-alert-list">
        <div class="ur-alert-txt"><b>${without.length} login${without.length === 1 ? '' : 's'} without access</b> — signed in, but no BizCore user record, so the database refuses everything.</div>
        ${without.map(d => `<div class="ur-alert-row"><span><b>${esc(d.email || d.name || d.uid)}</b>${d.name && d.email ? ' · ' + esc(d.name) : ''} · last seen ${lastSeen(d.lastSeenAt)}</span>
          <button class="btn btn-secondary btn-sm" type="button" data-ur="give" data-uid="${esc(d.uid)}">Give Access</button>
          <button class="btn btn-secondary btn-sm" type="button" data-ur="ignore" data-uid="${esc(d.uid)}">Ignore</button></div>`).join('')}
      </div></div>` : ''}
      <div class="ur-tiles">
        <div class="ur-tile"><div class="l">Active users</div><div class="v">${cnt.active}</div><div class="s">of ${cnt.all} user${cnt.all === 1 ? '' : 's'}</div></div>
        <div class="ur-tile"><div class="l">Administrators</div><div class="v">${cnt.admins}</div><div class="s" title="${esc(ownerNames)}">Owner: ${esc(ownerNames)}</div></div>
        <div class="ur-tile${cnt.mustChange ? ' warn' : ''}"><div class="l">Password not changed</div><div class="v">${cnt.mustChange}</div><div class="s">Temporary password still in use</div></div>
        <div class="ur-tile"><div class="l">Signed in today</div><div class="v">${cnt.today}</div><div class="s">Last 24 hours</div></div>
      </div>
      <div class="card pa-card"><div class="pa-card-head"><div><h3><i class="ti ti-list-details"></i>Users</h3><p>Company access shows the role in each company. Logins are never deleted — deactivate instead.</p></div>
        <div class="pa-chips" role="toolbar" aria-label="Show">
          ${[['all', 'All', cnt.all], ['active', 'Active', cnt.active], ['inactive', 'Inactive', cnt.inactive], ['cust', 'Cash Custodians', cnt.cust]].map(([k, l, n]) => `<button type="button" class="pa-chip${chip === k ? ' on' : ''}" data-ur="chip" data-chip="${k}">${l} <b>${n}</b></button>`).join('')}
        </div></div>
        <div class="pa-table-wrap"><table class="pa-table" id="ur-table"><thead><tr><th>User</th><th>Employee</th><th>Company access</th><th>Status</th><th>Last sign-in</th><th></th></tr></thead><tbody>
        ${list.length ? list.map(r => `<tr data-uid="${esc(r.uid)}">
          <td><div class="ur-user"><span class="ur-av">${esc(initials(r.name))}</span><div><b>${esc(r.name)}${r.owner ? '<span class="ur-pill sm ur-st-purple">Owner</span>' : ''}</b><small>${esc(r.email)}</small></div></div></td>
          <td class="ur-nowrap">${r.employee ? esc(r.employee) : '<span class="ur-muted">— Not linked —</span>'}</td>
          <td class="ur-co"><span class="ur-co-n">${esc(companyShort())}:</span> <b>${esc(r.owner && r.role !== 'administrator' ? 'Administrator' : core().roleLabel(r.role))}</b></td>
          <td><span class="ur-pill ur-st-${STATUS[r.status][0]}">${STATUS[r.status][1]}</span></td>
          <td class="ur-nowrap">${lastSeen(r.lastSeen)}</td>
          <td style="text-align:right"><button type="button" class="ur-dots" data-ur="menu" data-uid="${esc(r.uid)}" aria-label="Actions for ${esc(r.name)}">⋮</button></td></tr>`).join('')
        : `<tr><td colspan="6" class="ur-muted" style="padding:18px">No users in this view.</td></tr>`}
        </tbody></table></div></div>
      <p class="pa-note ur-note"><i class="ti ti-info-circle"></i> ⋮ menu: Edit · Send password reset email · Deactivate / Reactivate · Activity. Cash custodian logins open only My Cash.</p>`;
  }

  /* ═════════ row menu ═════════ */
  function closeMenu() { const m = document.getElementById('ur-menu'); if (m) m.remove(); }
  function openMenu(btn, uid) {
    closeMenu();
    const r = rows().find(x => x.uid === uid); if (!r) return;
    const me = U().uid;
    const self = uid === me;
    const ownerLocked = r.owner && !self;
    const m = document.createElement('div'); m.id = 'ur-menu'; m.className = 'ur-menu'; m.setAttribute('role', 'menu');
    const item = (act, label, dis, cls = '', title = '') => `<button type="button" role="menuitem" data-ur="${act}" data-uid="${esc(uid)}"${dis ? ' disabled' : ''}${title ? ` title="${esc(title)}"` : ''} class="${cls}">${label}</button>`;
    const off = r.status === 'inactive';
    if (r.kind === 'custodian') {
      m.innerHTML = item('cust-accounts', 'Cash accounts (Payment Accounts)')
        + item('reset', 'Send password reset email', !r.email)
        + '<div class="sep"></div>'
        + item(off ? 'cust-on' : 'cust-off', off ? 'Reactivate' : 'Deactivate', false, off ? '' : 'danger');
    } else {
      m.innerHTML = item('edit', 'Edit', ownerLocked, '', ownerLocked ? "Only the owner can change the owner's record" : '')
        + item('reset', 'Send password reset email', !r.email)
        + item('activity', 'Activity')
        + '<div class="sep"></div>'
        + item(off ? 'on' : 'off', off ? 'Reactivate' : 'Deactivate', ownerLocked || (self && !U().isOwner), off ? '' : 'danger',
          ownerLocked ? "Only the owner can change the owner's record" : self && !U().isOwner ? "You can't switch off your own access" : '');
    }
    document.body.appendChild(m);
    const b = btn.getBoundingClientRect();
    const w = m.offsetWidth, h = m.offsetHeight;
    m.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, b.right - w)) + 'px';
    m.style.top = (b.bottom + 4 + h > window.innerHeight - 8 ? Math.max(8, b.top - h - 4) : b.bottom + 4) + 'px';
    setTimeout(() => { const f = m.querySelector('button:not([disabled])'); if (f) f.focus(); }, 0);
  }

  /* ═════════ UR_2 New / Edit / Give access ═════════ */
  /** V270.4.2: the built-in roles + the roles administrators added. */
  const roleChoices = () => { const added = (U().roles || []).filter(r => !core().ROLES.some(b => b.id === r.id)).sort((a, b) => String(a.label).localeCompare(String(b.label))); return [...core().ROLES, ...added.map(r => ({ id: r.id, label: r.label }))]; };
  const ROLE_OPTS = (sel, withCust) => roleChoices().map(r => `<option value="${esc(r.id)}"${r.id === sel ? ' selected' : ''}>${esc(r.label)}</option>`).join('')
    + (withCust ? `<option value="cashCustodian"${sel === 'cashCustodian' ? ' selected' : ''}>Cash Custodian (My Cash only)</option>` : '');

  function modal(id, title, sub, body, foot, width = 760) {
    let m = document.getElementById(id);
    if (!m) { m = document.createElement('div'); m.className = 'modal-overlay'; m.id = id; document.body.appendChild(m); }
    m.innerHTML = `<div class="modal ur-modal" role="dialog" aria-modal="true" aria-labelledby="${id}-title" style="width:min(${width}px,96vw);max-width:${width}px;height:auto;max-height:92vh">
      <div class="modal-header"><div class="modal-header-title-wrap ur-mtitle"><h2 id="${id}-title">${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}</div><button class="close-btn" type="button" onclick="closeModal('${id}')" aria-label="Close">✕</button></div>
      <div class="modal-body">${body}<div class="ur-err" id="${id}-err" hidden></div></div>
      <div class="modal-footer">${foot}</div></div>`;
    m.classList.add('open');   // sized by its content (not the workspace sizes of document screens)
    setTimeout(() => { const f = m.querySelector('.modal-body input:not([disabled]):not([readonly]),.modal-body select:not([disabled])'); if (f) f.focus(); }, 60);
    return m;
  }
  const err = (id, msg) => { const e = document.getElementById(id + '-err'); if (e) { e.hidden = !msg; e.textContent = msg || ''; } };
  const val = id => { const e = document.getElementById(id); return e ? (e.type === 'checkbox' ? e.checked : e.value) : ''; };

  /** mode: 'new' | 'edit' | 'give' */
  function openUserForm(mode = 'new', uid) {
    if (!['new', 'edit', 'give'].includes(mode)) mode = 'new';   // V270.4.2: the top bar's New User calls it without arguments
    if (!U().isAdministrator) { toast('Only administrators can manage users.', 'error'); return; }
    const rec = mode === 'edit' ? U().users.find(u => u.uid === uid) : null;
    const dir = mode === 'give' ? (((C() && C().directory) || []).find(d => d.uid === uid) || { uid }) : null;
    const role = rec ? core().roleOfUser(rec) : 'sales';
    const name = rec ? rec.name : dir ? (dir.name || '') : '';
    const email = rec ? rec.email : dir ? (dir.email || '') : '';
    const emps = empList();
    const empSel = rec ? rec.employeeId : (emps.find(e => email && String(e.email || '').toLowerCase() === email.toLowerCase()) || {}).id || '';
    const cash = mode === 'new' && C() ? ((window.BizCoreAcc && window.BizCoreAcc.accounts) || []).filter(a => a.type === 'cash' && a.active !== false) : [];
    const title = mode === 'new' ? 'New User' : mode === 'give' ? 'Give Access' : 'Edit User';
    const sub = mode === 'new' ? 'Creates the login and gives access. The user changes the temporary password at first sign-in.'
      : mode === 'give' ? 'This login already exists (it signed in). Choose the role to let it work in BizCore.' : 'Email can’t be changed here. Changes apply at the user’s next action.';
    const body = `
      <div class="ur-sec">Login</div>
      <div class="ur-grid">
        <div class="ur-f"><label for="ur-name">Full name *</label><input id="ur-name" maxlength="120" autocomplete="off" value="${esc(name)}"></div>
        <div class="ur-f"><label for="ur-email">Email (sign-in) *</label><input id="ur-email" type="email" maxlength="200" autocomplete="off" value="${esc(email)}"${mode === 'new' ? '' : ' readonly'} placeholder="name@company.com"></div>
        ${mode === 'new' ? `<div class="ur-f"><label for="ur-pw">Temporary password *</label><div class="ur-pwrow"><input id="ur-pw" type="text" autocomplete="off" minlength="8" value="${esc(core().generatePassword())}"><button type="button" class="ur-gen" data-ur="gen">↻ Generate</button></div>
          <label class="ur-check"><input type="checkbox" id="ur-must" checked> Change password at first sign-in</label></div>` : ''}
        <div class="ur-f"><label for="ur-emp">Employee (optional)</label><select id="ur-emp"><option value="">— Not linked —</option>${emps.map(e => `<option value="${esc(e.id)}"${e.id === empSel ? ' selected' : ''}>${esc(e.name)}${e.designation ? ' · ' + esc(e.designation) : ''}</option>`).join('')}</select>
          <small>Links name and records only — operational roles stay in Master Data and give no access.</small></div>
      </div>
      <div class="ur-sec">Company access</div>
      <table class="ur-ctable"><thead><tr><th>Company</th><th>Role</th><th>Activities <span class="ur-later">LATER</span></th></tr></thead><tbody>
        <tr><td><b style="font-weight:600">${esc(companyName())}</b>${companyCr() ? `<small>CR ${esc(companyCr())}</small>` : ''}</td>
          <td><select id="ur-role" aria-label="Role">${ROLE_OPTS(role, mode === 'new' && cash.length >= 0)}</select></td>
          <td><select disabled aria-label="Activities"><option>All activities</option></select></td></tr>
      </tbody></table>
      <div class="ur-hint">More companies appear here once the Company master is added (next step). What each role may do: Administration → Roles &amp; Permissions.</div>
      ${mode === 'new' ? `<div id="ur-cust" hidden>
        <div class="ur-info"><b>Cash Custodian:</b> this login opens only <b>My Cash</b> — the linked cash account(s), confirm or query lines, hand over cash. It can't see anything else (enforced by the database).</div>
        <div class="ur-sec">Cash account(s) *</div>
        <div class="ur-accs" id="ur-accs">${cash.length ? cash.map(a => `<label><input type="checkbox" value="${esc(a.id)}"> ${esc(a.name)}<small>${a.custodianUid ? 'Has a login' : esc(a.custodianName || '')}</small></label>`).join('') : '<span class="ur-muted">Add a cash account first (Payment Accounts).</span>'}</div></div>` : ''}
      ${mode === 'edit' ? `<div class="ur-sec">Status</div><label class="ur-check" style="margin-top:0"><input type="checkbox" id="ur-active"${rec.active !== false ? ' checked' : ''}${rec.uid === U().uid && !U().isOwner ? ' disabled' : ''}> Active — can sign in and work</label>` : ''}`;
    const foot = `<div class="ur-foot"><span class="ur-ready" id="ur-ready"></span><button class="btn btn-secondary" type="button" onclick="closeModal('ur-modal')">Cancel</button>
      <button class="btn btn-primary" type="button" id="ur-save" data-ur="save" data-mode="${mode}" data-uid="${esc(uid || '')}" data-rev="${rec ? esc(rec.revision) : ''}">${mode === 'new' ? 'Create User' : mode === 'give' ? 'Give Access' : 'Save Changes'}</button></div>`;
    modal('ur-modal', title, sub, body, foot);
    formState();
  }
  /** The ready line + the custodian section (UI standards: a disabled Save is always explained). */
  function formState() {
    const m = document.getElementById('ur-modal'); if (!m) return;
    const btn = document.getElementById('ur-save'); if (!btn) return;
    const mode = btn.dataset.mode;
    const cust = val('ur-role') === 'cashCustodian';
    const cs = document.getElementById('ur-cust'); if (cs) cs.hidden = !cust;
    const emp = document.getElementById('ur-emp'); if (emp) emp.closest('.ur-f').style.display = cust ? 'none' : '';
    const missing = [];
    if (!String(val('ur-name')).trim()) missing.push('full name');
    if (mode === 'new' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(val('ur-email')).trim())) missing.push('email');
    if (mode === 'new' && String(val('ur-pw')).length < 8) missing.push('temporary password (8+ characters)');
    if (cust && !m.querySelectorAll('#ur-accs input:checked').length) missing.push('cash account');
    const ready = document.getElementById('ur-ready');
    if (ready) { ready.classList.toggle('todo', !!missing.length); ready.textContent = missing.length ? 'To continue: ' + missing.map((x, i) => `${'①②③④'[i] || '•'} ${x}`).join(' ') : '✓ Ready'; }
    btn.disabled = !!missing.length; btn.title = missing.length ? 'Missing: ' + missing[0] : '';
  }

  async function saveForm(btn) {
    const mode = btn.dataset.mode, uid = btn.dataset.uid;
    const emps = empList();
    const emp = emps.find(e => e.id === val('ur-emp'));
    const input = { name: val('ur-name'), email: val('ur-email'), password: val('ur-pw'), role: val('ur-role'),
      employeeId: emp ? emp.id : '', employeeName: emp ? emp.name : '', mustChangePassword: mode === 'new' ? !!val('ur-must') : undefined,
      active: mode === 'edit' ? !!val('ur-active') : true };
    err('ur-modal', '');
    if (input.role === 'cashCustodian') return saveCustodian(input);
    const v = core().validateUserInput(input, { creating: mode === 'new' });
    if (!v.ok) { err('ur-modal', v.errors.map(e => e.message).join(' ')); return; }
    const rec = mode === 'edit' ? U().users.find(u => u.uid === uid) : null;
    const details = [['User', `${v.value.name} · ${mode === 'edit' ? rec.email : v.value.email}`], ['Company', companyName()], ['Role', core().roleLabel(v.value.role)]];
    if (v.value.employeeName) details.push(['Employee', v.value.employeeName]);
    if (rec) {
      const after = { ...rec, name: v.value.name, employeeId: v.value.employeeId, employeeName: v.value.employeeName, active: v.value.active, companyRoles: { ...rec.companyRoles, default: v.value.role } };
      const change = core().describeUserChange(rec, after);
      if (!change) { toast('No changes to save', 'info'); return; }
      details.push(['Changes', change]);
    }
    const ok = await confirmAsync({ icon: '👤', title: mode === 'new' ? 'Create this user?' : mode === 'give' ? 'Give this login access?' : 'Save the changes?',
      message: mode === 'new' ? 'The login is created now. Give the person the email and the temporary password.' : '', details, confirmText: mode === 'new' ? 'Create User' : mode === 'give' ? 'Give Access' : 'Save Changes', cancelText: 'Go back', confirmClass: 'btn-primary' });
    if (!ok) return;
    btn.disabled = true;
    try {
      if (mode === 'new') {
        await busy('Creating the user…', () => U().createUser(v.value));
        closeModal('ur-modal');
        toast(`${v.value.name} can now sign in with ${v.value.email} and the temporary password.`);
      } else if (mode === 'give') {
        await busy('Giving access…', () => U().giveAccess(uid, v.value));
        setIgnored(ignored().filter(x => x !== uid));
        closeModal('ur-modal'); toast(`${v.value.name} can now work in BizCore.`);
      } else {
        await busy('Saving…', () => U().saveUser(uid, v.value, Number(btn.dataset.rev)));
        closeModal('ur-modal'); toast('User updated');
      }
      renderUsersScreen();
    } catch (e) { err('ur-modal', e.message || String(e)); }
    finally { btn.disabled = false; formState(); }
  }
  async function saveCustodian(input) {
    if (!C() || typeof C().createCustodianLogin !== 'function') { err('ur-modal', 'Cash & Bank is still loading. Try again in a moment.'); return; }
    const accountIds = [...document.querySelectorAll('#ur-accs input:checked')].map(i => i.value);
    const full = { name: input.name, email: input.email, password: input.password, accountIds, mustChangePassword: input.mustChangePassword !== false };
    const v = C().core.validateCustodianLogin(full);
    if (!v.ok) { err('ur-modal', v.errors.map(x => x.message).join(' ')); return; }
    const accs = (window.BizCoreAcc && window.BizCoreAcc.accounts) || [];
    const taken = accs.filter(a => accountIds.includes(a.id) && a.custodianUid);
    const ok = await confirmAsync({ icon: '👛', title: 'Create this cash custodian login?', message: taken.length ? `${taken.map(a => a.name).join(', ')} already has a login — it moves to this new login.` : 'This login opens only My Cash.',
      details: [['User', `${v.value.name} · ${v.value.email}`], ['Role', 'Cash Custodian'], ['Cash account(s)', accs.filter(a => accountIds.includes(a.id)).map(a => a.name).join(', ')]], confirmText: 'Create Login', cancelText: 'Go back', confirmClass: 'btn-primary' });
    if (!ok) return;
    const btn = document.getElementById('ur-save'); if (btn) btn.disabled = true;
    try {
      const r = await busy('Creating the login…', () => C().createCustodianLogin(full));
      closeModal('ur-modal');
      toast(r.failed.length ? `Login created, but not linked: ${r.failed.join('; ')}` : `Login created for ${v.value.name}. They open My Cash.`, r.failed.length ? 'error' : 'success');
      renderUsersScreen();
    } catch (e) { err('ur-modal', e.message || String(e)); }
    finally { if (btn) btn.disabled = false; formState(); }
  }

  /* ═════════ actions ═════════ */
  async function setActive(uid, active) {
    const r = rows().find(x => x.uid === uid); if (!r) return;
    let reason = '';
    if (!active) {
      const ok = await confirmAsync({ icon: '⛔', title: `Deactivate ${r.name}?`, message: 'They can no longer open or change anything in BizCore — from their next action. Their records stay. You can reactivate them later.', confirmText: 'Deactivate', cancelText: 'Go back', confirmClass: 'btn-danger' });
      if (!ok) return;
      reason = 'Deactivated';
    } else {
      const ok = await confirmAsync({ icon: '✅', title: `Reactivate ${r.name}?`, message: `They can sign in and work again as ${core().roleLabel(r.role)}.`, confirmText: 'Reactivate', cancelText: 'Go back', confirmClass: 'btn-primary' });
      if (!ok) return;
    }
    try {
      if (r.kind === 'custodian') await busy('Saving…', () => C().service.setCustodianActive(uid, active));
      else await busy('Saving…', () => U().setActive(uid, active, reason));
      toast(active ? `${r.name} reactivated` : `${r.name} deactivated`); renderUsersScreen();
    } catch (e) { toast(e.message || String(e), 'error'); }
  }
  async function sendReset(uid) {
    const r = rows().find(x => x.uid === uid); if (!r || !r.email) return;
    const ok = await confirmAsync({ icon: '✉️', title: 'Send a password reset email?', message: `Firebase sends a link to ${r.email} to choose a new password. Their current password keeps working until they do.`, confirmText: 'Send Email', cancelText: 'Go back', confirmClass: 'btn-primary' });
    if (!ok) return;
    try { await busy('Sending…', () => U().sendReset(uid, r.email)); toast(`Reset email sent to ${r.email}`); }
    catch (e) { toast(e.code === 'auth/user-not-found' ? 'No Firebase login exists for this email.' : (e.message || String(e)), 'error'); }
  }
  async function showActivity(uid) {
    const r = rows().find(x => x.uid === uid); if (!r) return;
    modal('ur-act', `Activity · ${r.name}`, r.email, '<div class="ur-muted">Loading…</div>', `<button class="btn btn-secondary" type="button" onclick="closeModal('ur-act')">Close</button>`, 560);
    try {
      const ev = await U().loadEvents(uid);
      const when = t => { const m = ms(t); if (!m) return ''; const d = new Date(m); return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
      const label = { created: 'Created', edited: 'Edited', deactivated: 'Deactivated', reactivated: 'Reactivated', resetSent: 'Password reset email' };
      const body = document.querySelector('#ur-act .modal-body');
      if (body) body.innerHTML = ev.length ? ev.map(e => `<div class="ur-ev"><i class="dot"></i><div><b>${esc(label[e.type] || e.type)}</b> — ${esc(e.note)}<small>${esc(e.byName || '')} · ${when(e.at)}</small></div></div>`).join('')
        : '<div class="ur-muted">No changes recorded yet.</div>';
    } catch (e) { const body = document.querySelector('#ur-act .modal-body'); if (body) body.innerHTML = `<div class="ur-err">${esc(e.message)}</div>`; }
  }

  /* ═════════ Roles & Permissions (UR_3): role list + permission grid ═════════ */
  const RC = () => U().roleCore;
  let selRole = 'sales', draft = null, draftRights = null, draftOf = null, rTab = 'modules';
  /** Built-in roles first (fixed order), then the added ones by name. The stored record wins over the starting set. */
  function roleList() {
    const stored = new Map((U().roles || []).map(r => [r.id, r]));
    const out = RC().BUILT_IN_ROLES.map(b => ({ ...b, builtIn: true, ...(stored.get(b.id) || {}), stored: stored.has(b.id) }));
    const extra = (U().roles || []).filter(r => !RC().builtInRole(r.id)).sort((a, b) => String(a.label).localeCompare(String(b.label)));
    return [...out, ...extra.map(r => ({ ...r, stored: true }))];
  }
  function roleUsers(id) {
    return rows().filter(r => r.status !== 'inactive' && (id === 'cashCustodian' ? r.kind === 'custodian' : r.kind === 'user' && (r.owner && r.role !== 'administrator' ? 'administrator' : r.role) === id));
  }
  const dirty = () => { if (!draft || !draftOf) return false; const r = roleList().find(x => x.id === draftOf); return !!r && (JSON.stringify(RC().normalizePerms(draft)) !== JSON.stringify(RC().normalizePerms(r.perms || {})) || JSON.stringify(RC().normalizeRights(draftRights)) !== JSON.stringify(RC().normalizeRights(r.rights))); };
  function when(t) { const m = ms(t); if (!m) return ''; const d = new Date(m); return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`; }

  function renderRolesScreen() {
    const host = document.getElementById('ur-roles-host'); if (!host || !U()) return;
    U().start();
    if (!U().isAdministrator) { host.innerHTML = `<div class="ur-locked"><span style="font-size:20px">🔒</span><div><b>Only administrators manage roles.</b></div></div>`; return; }
    if (U().roles) core().setRoleLabels(U().roles);
    const list = roleList();
    if (selRole !== 'cashCustodian' && !list.some(r => r.id === selRole)) selRole = 'sales';
    const role = list.find(r => r.id === selRole);
    if (role && draftOf !== role.id) { draft = JSON.parse(JSON.stringify(RC().normalizePerms(role.perms || {}))); draftRights = RC().normalizeRights(role.rights); draftOf = role.id; }
    const cnt = id => roleUsers(id).length;
    const side = `<div class="ur-rlist"><div class="h">Roles<button type="button" class="btn btn-primary btn-sm" data-ur="role-new"><i class="ti ti-plus"></i>New</button></div>
      ${list.map(r => `<button type="button" class="ur-r${r.id === selRole ? ' on' : ''}" data-ur="role-pick" data-role="${esc(r.id)}">${r.locked ? '🔒 ' : ''}${esc(r.label)}<small>${cnt(r.id)} user${cnt(r.id) === 1 ? '' : 's'}</small></button>`).join('')}
      <button type="button" class="ur-r${selRole === 'cashCustodian' ? ' on' : ''}" data-ur="role-pick" data-role="cashCustodian">🔒 Cash Custodian<small>${cnt('cashCustodian')} user${cnt('cashCustodian') === 1 ? '' : 's'}</small></button>
      <div class="ur-rnote">🔒 Built-in: Administrator has every right; Cash Custodian opens only My Cash. Neither can be changed.</div></div>`;
    let card;
    if (selRole === 'cashCustodian') {
      card = `<div class="ur-rcard"><div class="ur-rhead"><div><h3>Cash Custodian</h3><p>Used by ${cnt('cashCustodian')} login${cnt('cashCustodian') === 1 ? '' : 's'}</p></div></div>
        <div class="ur-rbody">A cash custodian login opens only <b>My Cash</b>: the linked cash account(s), confirm or query lines, hand over cash. It can't see anything else — enforced by the database. Create one with Users → New User → role Cash Custodian.</div></div>`;
    } else if (!role) {
      card = `<div class="ur-rcard"><div class="ur-rbody ur-muted">Loading…</div></div>`;
    } else {
      const locked = !!role.locked;
      const changed = role.updatedAt ? ` · changed ${when(role.updatedAt)}${role.updatedByName ? ' by ' + esc(role.updatedByName) : ''}` : role.stored ? '' : ' · starting permissions (not saved yet)';
      const head = `<div class="ur-rhead"><div><h3>${esc(role.label)}</h3><p>Used by ${cnt(role.id)} user${cnt(role.id) === 1 ? '' : 's'}${changed}</p></div>
        <div class="ur-racts"><button type="button" class="btn btn-secondary btn-sm" data-ur="role-dup"><i class="ti ti-copy"></i>Duplicate</button>
        <button type="button" class="btn btn-secondary btn-sm" data-ur="role-changes"${role.stored ? '' : ' disabled title="No changes yet"'}><i class="ti ti-history"></i>Changes</button></div></div>`;
      const tabs = `<div class="ur-tabs" role="tablist"><button type="button" role="tab" class="ur-tab${rTab === 'modules' ? ' on' : ''}" data-ur="role-tab" data-tab="modules">Modules</button><button type="button" role="tab" class="ur-tab${rTab === 'rights' ? ' on' : ''}" data-ur="role-tab" data-tab="rights">Special Rights</button></div>`;
      let body;
      if (rTab === 'rights') {   // V270.4.3 Special Rights (UR_4)
        const R = locked ? RC().builtInRole('administrator').rights : RC().normalizeRights(draftRights);
        let lastG = '';
        body = `<div class="ur-rights">${RC().RIGHTS.map(r => {
          const g = r.group !== lastG ? (lastG = r.group, `<div class="ur-sec ur-rsec">${esc(r.group)}</div>`) : '';
          return g + `<label class="ur-right"><span><b>${esc(r.label)}${r.was ? `<span class="ur-was">Was: ${esc(r.was)}</span>` : ''}</b>${r.hint ? `<small>${esc(r.hint)}</small>` : ''}</span>
            <input type="checkbox" class="ur-sw" role="switch" data-ur="right" data-right="${r.id}"${R[r.id] ? ' checked' : ''}${locked ? ' disabled' : ''} aria-label="${esc(r.label)}"></label>`;
        }).join('')}
          <div class="ur-rnote2">Record / void payment receipts: the Payment Receipts module's <b>Create</b> and <b>Cancel</b> on the Modules tab.</div></div>`;
      } else {
        const P = locked ? RC().normalizePerms(RC().builtInRole('administrator').perms) : draft;
        let lastGroup = '';
        const rowsHtml = RC().MODULES.map(m => {
          const p = P[m.id];
          const grp = m.group !== lastGroup ? (lastGroup = m.group, `<tr class="ur-mx-g"><td colspan="6">${esc(m.group)}</td></tr>`) : '';
          const cell = a => {
            if (!m.acts.includes(a)) return '<td><span class="ur-na">—</span></td>';
            const dis = locked || (a !== 'v' && !p.v);
            return `<td><input type="checkbox" class="ur-cbx" aria-label="${esc(m.label)} · ${RC().ACTS.find(x => x[0] === a)[1]}" data-ur="perm" data-mod="${m.id}" data-act="${a}"${p[a] ? ' checked' : ''}${dis ? ' disabled' : ''}></td>`;
          };
          const own = m.own ? `<td><span class="ur-seg${locked || !p.v ? ' dis' : ''}" role="group" aria-label="${esc(m.label)} records">
              <button type="button" data-ur="own" data-mod="${m.id}" data-own="0" class="${p.own ? '' : 'on'}"${locked || !p.v ? ' disabled' : ''}>All</button><button type="button" data-ur="own" data-mod="${m.id}" data-own="1" class="${p.own ? 'on' : ''}"${locked || !p.v ? ' disabled' : ''}>Own</button></span></td>`
            : '<td><span class="ur-na">—</span></td>';
          return grp + `<tr><td class="ur-mx-n">${esc(m.label)}${m.hint ? `<small>${esc(m.hint)}</small>` : ''}</td>${cell('v')}${cell('c')}${cell('e')}${cell('x')}${own}</tr>`;
        }).join('');
        body = `<div class="ur-mx-wrap"><table class="ur-mx"><thead><tr><th>Module</th><th>View</th><th>Create</th><th>Edit</th><th>Cancel</th><th>Records</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
      }
      const isDirty = dirty();
      const foot = locked ? `<div class="ur-foot2"><span class="note">🔒 The Administrator role always has every right, including Administration and the security settings.</span></div>`
        : `<div class="ur-foot2"><span class="note">${rTab === 'rights' ? '“Was” = where this choice lived before. Those settings moved here; Billing Settings keep only On / Off.' : 'Records “Own” = only the RFQs, quotations and orders the user created or is assigned to. Unticking View hides the module.'}</span>
          <button type="button" class="btn btn-secondary" data-ur="role-discard"${isDirty ? '' : ' disabled'}>Discard</button>
          <button type="button" class="btn btn-primary" data-ur="role-save"${isDirty || !role.stored ? '' : ' disabled title="No changes to save"'}><i class="ti ti-device-floppy"></i>Save Role</button></div>`;
      card = `<div class="ur-rcard">${head}${tabs}${body}${foot}</div>`;
    }
    host.innerHTML = `<div class="ur-roles">${side}${card}</div>`;
  }
  function setPerm(mod, act, on) {
    if (!draft || !draft[mod]) return;
    draft[mod][act] = !!on;
    if (act === 'v' && !on) Object.assign(draft[mod], { c: false, e: false, x: false, own: false });
    if (act !== 'v' && on) draft[mod].v = true;
    renderRolesScreen();
  }
  async function pickRole(id) {
    if (id === selRole) return;
    if (dirty()) {
      const ok = await confirmAsync({ icon: '⚠️', title: 'Discard the unsaved changes?', message: `The changes to ${roleList().find(r => r.id === draftOf)?.label || 'this role'} are not saved.`, confirmText: 'Discard', confirmClass: 'btn-danger' });
      if (!ok) return;
    }
    selRole = id; draftOf = null; draft = null; rTab = 'modules'; renderRolesScreen();
  }
  async function saveRoleDraft() {
    const role = roleList().find(r => r.id === selRole); if (!role || role.locked) return;
    const users = roleUsers(role.id);
    const change = RC().describePermChange(role.perms || {}, draft, role.rights, draftRights) || (role.stored ? '' : 'Starting permissions');
    if (!change) { toast('No changes to save', 'info'); return; }
    const ok = await confirmAsync({ icon: '🛡️', title: `Save the ${role.label} role?`, message: users.length ? `${users.length} user${users.length === 1 ? ' gets' : 's get'} the new access at their next action (they are asked to reload).` : 'No user has this role yet.',
      details: change.split(' · ').slice(0, 12).map(x => { const i = x.indexOf(': '); return [x.slice(0, i), x.slice(i + 2)]; }).filter(x => x[0]), confirmText: 'Save Role' });
    if (!ok) return;
    try {
      await busy('Saving the role…', () => U().saveRole({ id: role.id, label: role.label, perms: draft, rights: draftRights }, { creating: !role.stored, expectedRevision: role.stored ? role.revision : null }));
      draftOf = null; toast(`${role.label} saved`); renderRolesScreen();
    } catch (e) { toast(e.message || String(e), 'error'); }
  }
  function openNewRole(copyOf) {
    const list = roleList();
    const src = copyOf ? list.find(r => r.id === copyOf) : null;
    modal('ur-rnew', copyOf ? 'Duplicate Role' : 'New Role', 'A role is a set of permissions. Give it a clear name, e.g. "Site Engineer".',
      `<div class="ur-grid" style="grid-template-columns:1fr"><div class="ur-f"><label for="ur-rname">Role name *</label><input id="ur-rname" maxlength="60" value="${src ? esc('Copy of ' + src.label) : ''}"></div>
        <div class="ur-f"><label for="ur-rfrom">Start from</label><select id="ur-rfrom"><option value="">No permissions (tick them after)</option>${list.filter(r => !r.locked).map(r => `<option value="${esc(r.id)}"${src && src.id === r.id ? ' selected' : ''}>${esc(r.label)}</option>`).join('')}</select></div></div>`,
      `<div class="ur-foot"><span class="ur-ready"></span><button class="btn btn-secondary" type="button" onclick="closeModal('ur-rnew')">Cancel</button><button class="btn btn-primary" type="button" data-ur="role-create">Create Role</button></div>`, 480);
  }
  async function createRole() {
    const label = val('ur-rname'), from = val('ur-rfrom');
    const src = from ? roleList().find(r => r.id === from) : null;
    const v = RC().validateRoleInput({ label, perms: src ? src.perms : {}, rights: src ? RC().normalizeRights(src.rights) : RC().defaultRights() }, { creating: true, existingIds: roleList().map(r => r.id) });
    if (!v.ok) { err('ur-rnew', v.errors.map(e => e.message).join(' ')); return; }
    try {
      const rec = await busy('Creating the role…', () => U().saveRole({ id: v.value.id, label: v.value.label, perms: v.value.perms, rights: v.value.rights }, { creating: true, existingIds: roleList().map(r => r.id), copyOf: src ? src.label : '' }));
      closeModal('ur-rnew'); selRole = rec.id; draftOf = null; rTab = 'modules'; toast(`${rec.label} created — tick its permissions and Save Role`); renderRolesScreen();
    } catch (e) { err('ur-rnew', e.message || String(e)); }
  }
  async function showRoleChanges() {
    const role = roleList().find(r => r.id === selRole); if (!role) return;
    modal('ur-rchg', `Changes · ${role.label}`, '', '<div class="ur-muted">Loading…</div>', `<button class="btn btn-secondary" type="button" onclick="closeModal('ur-rchg')">Close</button>`, 620);
    try {
      const ev = await U().loadRoleChanges(role.id);
      const body = document.querySelector('#ur-rchg .modal-body');
      const at = t => { const m = ms(t); if (!m) return ''; const d = new Date(m); return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
      if (body) body.innerHTML = ev.length ? ev.map(e => `<div class="ur-ev"><i class="dot"></i><div>${esc(e.note).replace(/ · /g, '<br>')}<small>${esc(e.byName || '')} · ${at(e.at)}</small></div></div>`).join('') : '<div class="ur-muted">No changes recorded yet.</div>';
    } catch (e) { const body = document.querySelector('#ur-rchg .modal-body'); if (body) body.innerHTML = `<div class="ur-err">${esc(e.message)}</div>`; }
  }

  /* ═════════ wiring ═════════ */
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-ur]');
    if (!b) { if (!e.target.closest('#ur-menu')) closeMenu(); return; }
    const act = b.dataset.ur, uid = b.dataset.uid;
    if (act !== 'menu') closeMenu();
    if (act === 'chip') { chip = b.dataset.chip; renderUsersScreen(); }
    else if (act === 'menu') { if (document.getElementById('ur-menu')) closeMenu(); else openMenu(b, uid); }
    else if (act === 'new') openUserForm('new');
    else if (act === 'roles') { if (typeof switchSetupTab === 'function') switchSetupTab('roles'); }
    else if (act === 'give') openUserForm('give', uid);
    else if (act === 'ignore') { setIgnored([...new Set([...ignored(), uid])]); renderUsersScreen(); }
    else if (act === 'edit') openUserForm('edit', uid);
    else if (act === 'reset') sendReset(uid);
    else if (act === 'activity') showActivity(uid);
    else if (act === 'off' || act === 'cust-off') setActive(uid, false);
    else if (act === 'on' || act === 'cust-on') setActive(uid, true);
    else if (act === 'cust-accounts') { if (typeof switchSetupTab === 'function') switchSetupTab('payment-accounts'); }
    else if (act === 'gen') { const i = document.getElementById('ur-pw'); if (i) { i.value = core().generatePassword(); formState(); } }
    else if (act === 'save') saveForm(b);
    else if (act === 'role-pick') pickRole(b.dataset.role);
    else if (act === 'role-tab') { rTab = b.dataset.tab; renderRolesScreen(); }
    else if (act === 'perm') setPerm(b.dataset.mod, b.dataset.act, b.checked);
    else if (act === 'right') { if (draftRights) { draftRights[b.dataset.right] = !!b.checked; renderRolesScreen(); } }
    else if (act === 'own') { if (draft && draft[b.dataset.mod]) { draft[b.dataset.mod].own = b.dataset.own === '1'; renderRolesScreen(); } }
    else if (act === 'role-discard') { draftOf = null; renderRolesScreen(); }
    else if (act === 'role-save') saveRoleDraft();
    else if (act === 'role-new') openNewRole('');
    else if (act === 'role-dup') openNewRole(selRole);
    else if (act === 'role-create') createRole();
    else if (act === 'role-changes') showRoleChanges();
  });
  document.addEventListener('input', e => { if (e.target.closest && e.target.closest('#ur-modal')) formState(); });
  document.addEventListener('change', e => { if (e.target.closest && e.target.closest('#ur-modal')) formState(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

  const isOpen = id => { const t = document.getElementById(id); return t && t.style.display !== 'none'; };
  (function wire() {
    if (!U()) return setTimeout(wire, 300);
    const refresh = () => {
      if (isOpen('setup-tab-users')) renderUsersScreen();
      if (isOpen('setup-tab-roles')) renderRolesScreen();
      const nb = document.getElementById('ur-new-btn');
      if (nb) { nb.disabled = !U().isAdministrator; nb.title = U().isAdministrator ? '' : 'Only administrators can create users'; }
    };
    U().onChange(refresh);
    if (window.BizCoreLocks) window.BizCoreLocks.onSettingsChange(refresh);   // fires when the administrator flag changes
    refresh();
  })();

  window.renderUsersScreen = renderUsersScreen;
  window.renderRolesScreen = renderRolesScreen;
  window.openUserForm = openUserForm;
  console.log('Users V270.4.3 ✅');
})();
