/* ═══════════════════════════════════════════════════════════════════
   BizCore V265.5 — "Deliveries" screen (approved mockup, 13 Oct 2026)
   A simple screen for delivery staff: only Delivery Notes that are Out for Delivery, oldest first, as cards.
   • Mine / All (Mine = "Delivered by" is the signed-in user, matched by employee record or name)
   • Search by DN, customer or SO · Scan the QR code printed on the Delivery Note
   • View → the Delivery Note (phone/tablet layout) · Confirm delivery → compact Confirm Delivery, then back here
   • Direct link: …/index.html#deliveries
   Uses only existing data and the existing confirmation service — no new Firestore data or rules.
═══════════════════════════════════════════════════════════════════ */
'use strict';
(function () {
  const LS_SCOPE = 'bc_deliveries_scope';
  let scope = null;        // 'mine' | 'all'
  let query = '';
  const esc = v => (typeof escapeHtml === 'function' ? escapeHtml(v) : String(v == null ? '' : v));
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } };
  const pad = n => String(n).padStart(2, '0');
  const todayIso = () => { const t = new Date(); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`; };
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const shortDate = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? `${+m[3]} ${MONTHS[+m[2] - 1]}` : '—'; };
  const daysSince = iso => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); if (!m) return 0;
    const t = new Date(); const a = new Date(+m[1], +m[2] - 1, +m[3]), b = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    return Math.max(0, Math.round((b - a) / 86400000));
  };

  /** Delivery Notes out for delivery: [{ so, d, i }] oldest first. */
  function outForDelivery() {
    if (typeof allDeliveryNotes !== 'function') return [];
    return allDeliveryNotes().filter(x => x.status === 'Out for Delivery' && !x.d.voided)
      .sort((a, b) => String(a.d.date || '').localeCompare(String(b.d.date || '')) || String(a.d.dispatchedAt || a.d.created || '').localeCompare(String(b.d.dispatchedAt || b.d.created || '')));
  }
  function isMine(d) {
    const self = typeof dnSelfEmployee === 'function' ? dnSelfEmployee() : null;
    if (self && d.deliveredByEmployeeId && d.deliveredByEmployeeId === self.id) return true;
    const me = String(typeof deliveryActor === 'function' ? deliveryActor() : '').trim().toLowerCase();
    const by = String(d.deliveredBy || '').trim().toLowerCase();
    return !!by && d.deliveredByType !== 'other' && (by === me || (self && by === String(self.name || '').trim().toLowerCase()));
  }
  function matches(x, q) {
    if (!q) return true;
    return `${x.d.dnNo || ''} ${x.so.customer || ''} ${x.so.soNo || ''} ${x.so.poNo || ''}`.toLowerCase().includes(q);
  }

  /** Sidebar count: everything out for delivery. */
  function updateBadge(list) {
    const b = document.getElementById('deliveries-badge'); if (!b) return;
    const n = (list || outForDelivery()).length;
    b.textContent = n; b.style.display = n ? '' : 'none';
  }

  function card(x) {
    const { so, d, i } = x;
    const age = daysSince(d.date), ageCls = age >= 2 ? 'r' : age === 1 ? 'a' : 'g';
    const ageTxt = age === 0 ? 'Today' : age === 1 ? '1 day' : `${age} days`;
    const c = typeof dnCustomerOf === 'function' ? dnCustomerOf(so) : null;
    const addr = typeof dnCustomerAddress === 'function' ? dnCustomerAddress(c, false) : '';
    const n = (d.items || []).length;
    const who = d.deliveredBy ? (isMine(d) ? 'You' : d.deliveredBy) : '';
    return `<article class="dl-card" data-dn="${esc(d.id)}">
      <div class="dl-top"><button type="button" class="dl-dn" onclick="bcDeliveriesView('${esc(so.id)}','${esc(d.id)}')" title="View ${esc(d.dnNo)}">${esc(d.dnNo || '—')}</button><span class="dl-age ${ageCls}">${ageTxt}</span></div>
      <div class="dl-cu">${esc(so.customer || '—')}</div>
      ${addr ? `<div class="dl-ad"><i class="ti ti-map-pin"></i> ${esc(addr)}</div>` : ''}
      <div class="dl-meta"><span><b>${n}</b> item${n === 1 ? '' : 's'}</span><span>${esc(so.soNo || '')}</span><span>Out ${shortDate(d.date)}</span>${who ? `<span class="dl-who"><i class="ti ti-truck"></i> ${esc(who)}</span>` : ''}</div>
      <div class="dl-acts"><button type="button" class="dl-view" onclick="bcDeliveriesView('${esc(so.id)}','${esc(d.id)}')"><i class="ti ti-eye"></i> View</button><button type="button" class="dl-go" onclick="bcDeliveriesConfirm('${esc(so.id)}','${esc(d.id)}')"><i class="ti ti-circle-check"></i> Confirm delivery</button></div>
    </article>`;
  }

  function render() {
    const page = document.getElementById('page-deliveries'); if (!page) return;
    const all = outForDelivery(); updateBadge(all);
    const mine = all.filter(x => isMine(x.d));
    if (!scope) scope = lsGet(LS_SCOPE) || (mine.length ? 'mine' : 'all');
    const q = query.trim().toLowerCase();
    const list = (scope === 'mine' ? mine : all).filter(x => matches(x, q));
    page.querySelectorAll('[data-dl-scope]').forEach(b => { const on = b.dataset.dlScope === scope; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    const cm = document.getElementById('dl-count-mine'), ca = document.getElementById('dl-count-all');
    if (cm) cm.textContent = mine.length; if (ca) ca.textContent = all.length;
    const box = document.getElementById('dl-list'); if (!box) return;
    if (!list.length) {
      const msg = q ? 'No delivery matches your search.' : scope === 'mine' && all.length ? 'Nothing out for delivery in your name.' : 'Nothing is out for delivery.';
      box.innerHTML = `<div class="dl-empty"><i class="ti ti-truck-off"></i><p>${msg}</p>${scope === 'mine' && all.length && !q ? `<button type="button" class="dl-view" onclick="bcDeliveriesScope('all')">Show all (${all.length})</button>` : ''}</div>`;
      return;
    }
    const t = todayIso(), earlier = list.filter(x => String(x.d.date || '') < t), today = list.filter(x => String(x.d.date || '') >= t);
    // V265.6 (Design 1): each group in its own box — coloured top line, count, same cards as the phone
    const group = (cls, title, hint, rows) => `<section class="dl-panel ${cls}" aria-label="${title}"><div class="dl-panel-head"><span class="dl-dot" aria-hidden="true"></span><span class="dl-panel-title">${title}</span><span class="dl-cnt">${rows.length}</span>${hint ? `<span class="dl-panel-hint">${hint}</span>` : ''}</div><div class="dl-grid">${rows.map(card).join('')}</div></section>`;
    box.innerHTML = (earlier.length ? group('late', 'Earlier', 'out more than a day', earlier) : '')
      + (today.length ? group('today', 'Today', '', today) : '');
  }

  function find(soId, dnId) {
    const so = (salesOrders || []).find(s => s.id === soId); if (!so) return null;
    const i = (so.deliveries || []).findIndex(d => d.id === dnId);
    return i >= 0 ? { so, d: so.deliveries[i], i } : null;
  }

  window.renderDeliveriesPage = render;
  /** V265.6 — called by the real-time listeners: a DN confirmed on another device disappears here at once. */
  window.bcDeliveriesRefresh = () => {
    try { if (document.getElementById('page-deliveries')?.classList.contains('active')) render(); else updateBadge(); }
    catch (e) { console.error('[BizCore Deliveries]', e); }
  };
  window.bcDeliveriesScope = s => { scope = s === 'mine' ? 'mine' : 'all'; lsSet(LS_SCOPE, scope); render(); };
  window.bcDeliveriesSearch = v => { query = String(v || ''); render(); };
  window.bcDeliveriesView = (soId, dnId) => { const h = find(soId, dnId); if (!h) { showToast('This Delivery Note is no longer available.', 'warning'); render(); return; } viewDeliveryNote(h.so.id, h.i); };
  window.bcDeliveriesConfirm = async (soId, dnId) => {
    const h = find(soId, dnId); if (!h) { showToast('This Delivery Note is no longer available.', 'warning'); render(); return; }
    if (h.d.customerConfirmed) { showToast(`${h.d.dnNo} is already confirmed.`, 'info'); render(); return; }
    await openDeliveryAcceptance(h.so.id, h.i, { returnTo: 'deliveries' });
  };
  /** Called by the confirmation save when it was started here: stay on (or come back to) this list. */
  window.bcDeliveriesAfterConfirm = () => {
    if (isModalOpen('dn-print-modal')) closeModal('dn-print-modal');
    if (!document.getElementById('page-deliveries')?.classList.contains('active')) showPage('deliveries'); else render();
  };

  /* ── QR scan: the QR printed on a DN is …/delivery.html?t=<token> (also accepted: ?delivery=<token>, older ?dn=<id>).
        A typed DN number works too. ── */
  window.bcDeliveriesOpenFromCode = function (text) {
    const raw = String(text || '').trim(); if (!raw) return false;
    let token = null, legacyId = null;
    try { const u = new URL(raw); token = u.searchParams.get('t') || u.searchParams.get('delivery'); legacyId = u.searchParams.get('dn'); } catch (e) { /* not a URL */ }
    const rows = typeof allDeliveryNotes === 'function' ? allDeliveryNotes() : [];
    const hit = rows.find(x => (token && x.d.deliveryAccessToken === token) || (legacyId && x.d.id === legacyId) || (!token && !legacyId && String(x.d.dnNo || '').toLowerCase() === raw.toLowerCase()));
    if (!hit) { showToast('No Delivery Note found for this code.', 'warning', 'Not found'); return false; }
    if (hit.d.voided) { showToast(`${hit.d.dnNo} is voided.`, 'warning'); return false; }
    if (hit.d.customerConfirmed) { showToast(`${hit.d.dnNo} is already confirmed.`, 'info'); viewDeliveryNote(hit.so.id, hit.i); return true; }
    openDeliveryAcceptance(hit.so.id, hit.i, { returnTo: 'deliveries' });
    return true;
  };
  let scanStream = null, scanTimer = null;
  function stopScan() {
    if (scanTimer) { cancelAnimationFrame(scanTimer); scanTimer = null; }
    if (scanStream) { scanStream.getTracks().forEach(t => t.stop()); scanStream = null; }
    document.getElementById('dl-scan')?.remove();
  }
  function loadJsQR() {
    if (window.jsQR) return Promise.resolve(window.jsQR);
    return new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
      s.onload = () => window.jsQR ? res(window.jsQR) : rej(new Error('QR reader unavailable')); s.onerror = () => rej(new Error('QR reader could not be loaded'));
      document.head.appendChild(s);
    });
  }
  window.bcDeliveriesScan = async function () {
    stopScan();
    const el = document.createElement('div'); el.id = 'dl-scan'; el.className = 'dl-scan-overlay';
    el.innerHTML = `<div class="dl-scan-box"><div class="dl-scan-head"><strong>Scan Delivery Note QR</strong><button type="button" class="dl-scan-x" aria-label="Close">✕</button></div>
      <div class="dl-scan-video"><video playsinline muted></video><div class="dl-scan-frame"></div></div>
      <div class="dl-scan-msg">Point the camera at the QR code on the Delivery Note.</div>
      <form class="dl-scan-type"><input type="text" placeholder="…or type the DN number" aria-label="DN number"><button type="submit">Open</button></form></div>`;
    document.body.appendChild(el);
    el.querySelector('.dl-scan-x').addEventListener('click', stopScan);
    el.addEventListener('click', e => { if (e.target === el) stopScan(); });
    el.querySelector('.dl-scan-type').addEventListener('submit', e => { e.preventDefault(); const v = el.querySelector('.dl-scan-type input').value; if (bcDeliveriesOpenFromCode(v)) stopScan(); });
    const msg = t => { const m = el.querySelector('.dl-scan-msg'); if (m) m.textContent = t; };
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { msg('The camera is not available in this browser. Type the DN number instead.'); return; }
    try {
      scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    } catch (e) { msg('Camera access was not allowed. Allow the camera for this site, or type the DN number.'); return; }
    if (!document.getElementById('dl-scan')) { stopScan(); return; }
    const video = el.querySelector('video'); video.srcObject = scanStream; await video.play().catch(() => {});
    let detect;
    if ('BarcodeDetector' in window) {
      try { const bd = new window.BarcodeDetector({ formats: ['qr_code'] }); detect = async () => { const r = await bd.detect(video); return r && r[0] ? r[0].rawValue : null; }; } catch (e) { detect = null; }
    }
    if (!detect) {
      try {
        const jsQR = await loadJsQR(); const c = document.createElement('canvas'), ctx = c.getContext('2d', { willReadFrequently: true });
        detect = async () => { const w = video.videoWidth, h = video.videoHeight; if (!w || !h) return null; c.width = w; c.height = h; ctx.drawImage(video, 0, 0, w, h); const r = jsQR(ctx.getImageData(0, 0, w, h).data, w, h); return r ? r.data : null; };
      } catch (e) { msg('The QR reader could not be loaded. Type the DN number instead.'); return; }
    }
    let busy = false;
    const loop = async () => {
      if (!scanStream) return;
      if (!busy) { busy = true; try { const v = await detect(); if (v) { stopScan(); bcDeliveriesOpenFromCode(v); return; } } catch (e) { /* keep trying */ } busy = false; }
      scanTimer = requestAnimationFrame(loop);
    };
    loop();
  };

  /* ── wiring: page title, sidebar count, live refresh, #deliveries link ── */
  const origShowPage = window.showPage;
  if (typeof origShowPage === 'function') {
    window.showPage = function (page, el) {
      const r = origShowPage.apply(this, arguments);
      if (page === 'deliveries') { const t = document.getElementById('page-title'); if (t) t.textContent = 'Deliveries'; syncStartBox(); render(); }
      return r;
    };
  }
  const origRenderDN = window.renderDNPage;
  if (typeof origRenderDN === 'function') {
    window.renderDNPage = function () {
      const r = origRenderDN.apply(this, arguments);
      try { if (document.getElementById('page-deliveries')?.classList.contains('active')) render(); else updateBadge(); } catch (e) { console.error('[BizCore Deliveries]', e); }
      return r;
    };
  }
  /* V265.6 — "Open Deliveries when BizCore starts on this device" (per device, stored in the browser). */
  const LS_START = 'bc_start_page';
  window.bcDeliveriesSetStart = on => { lsSet(LS_START, on ? 'deliveries' : ''); showToast(on ? 'This device will open on Deliveries.' : 'This device will open on the Dashboard.', 'success'); };
  function syncStartBox() { const b = document.getElementById('dl-start-here'); if (b) b.checked = lsGet(LS_START) === 'deliveries'; }
  function openFromHash() {
    if (location.hash !== '#deliveries' && lsGet(LS_START) !== 'deliveries') return;
    if (window.__bcStartHandled) return; window.__bcStartHandled = true;
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      if (window.currentUser && typeof salesOrders !== 'undefined' && Array.isArray(salesOrders) && typeof showPage === 'function') { clearInterval(t); showPage('deliveries'); }
      else if (tries > 60) clearInterval(t);
    }, 250);
  }
  window.addEventListener('hashchange', () => { if (location.hash === '#deliveries') { window.__bcStartHandled = false; openFromHash(); } });
  openFromHash();
  setTimeout(() => { try { updateBadge(); } catch (e) { /* data not loaded yet */ } }, 0);
})();
