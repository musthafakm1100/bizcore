/* BizCore V266.7 — phone & tablet screens (approved 14 Oct 2026).
 *
 * Works on top of the existing pages without changing how they filter, sort or save:
 *  - Status chips (phone + tablet portrait): a copy of the monitor rows; a tap clicks the real monitor row.
 *    The last chip, "Summary", opens the full monitor as a panel that slides up.
 *  - Filter icon (phone): opens a slide-up panel with Customer, Status, Date and Sort. Every control in the
 *    panel drives the real toolbar control, so the register filters exactly as before. A badge shows how
 *    many filters are on.
 *  - Cards (phone): every register row is shown as a card (number + status, customer, date + amount).
 *    A tap on a card clicks the real row. Cards are rebuilt whenever the table changes.
 *  - View / entry screens (phone): at most two buttons stay in the action bar, the rest go under "⋯";
 *    the order progress becomes "Step x of n"; A4 documents are scaled to the screen width.
 *  - Tablet landscape / small laptop (901–1279 px): sidebar starts as an icon rail and monitors start folded
 *    — only until the user chooses otherwise (their choice is remembered as before).
 */
(function () {
  'use strict';
  const PHONE = '(max-width: 760px)', NARROW = '(max-width: 900px)';
  const isPhone = () => window.matchMedia(PHONE).matches;
  const isNarrow = () => window.matchMedia(NARROW).matches;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* Per register: which columns make the card. Column names are matched against the table headings. */
  const REG = {
    rfq:              { noun: 'RFQs' },
    costing:          { noun: 'pricing documents', date: 'updated', amount: 'selling', sub: ['margin %'], tabletHide: ['version', 'cost', 'profit'] },
    quotations:       { noun: 'quotations', amount: 'net amount', sub: ['items'], chip: 'sales orders', tabletHide: ['reference', 'items', 'valid until'] },
    salesorders:      { noun: 'sales orders', amount: 'net amount', sub: ['customer po'], tabletHide: ['customer po', 'items'] },
    deliverynotes:    { noun: 'delivery notes', amount: null, sub: ['sales order'], chip: 'acceptance', tabletHide: ['customer po', 'items'] },
    customerinvoices: { noun: 'documents', amount: 'total (sar)', sub: ['sales order'], pill: 'type', extra: 'balance', tabletHide: ['reference', 'paid', 'sales order', 'type'] },
    receipts:         { noun: 'receipts', ownCards: true, tabletHide: ['method', 'reference'] },
  };
  const pageOf = id => document.getElementById('page-' + id);

  /* ───────────── helpers ───────────── */
  function fire(el, type) { el.dispatchEvent(new Event(type, { bubbles: true })); }
  function setSelect(sel, value) { if (!sel) return; sel.value = value; fire(sel, 'input'); fire(sel, 'change'); }
  function sheet(id) {
    let s = document.getElementById(id);
    if (!s) {
      s = document.createElement('div'); s.id = id; s.className = 'bc-sheet'; s.hidden = true;
      s.innerHTML = '<div class="bc-sheet-dim"></div><div class="bc-sheet-panel" role="dialog" aria-modal="true"><div class="bc-sheet-handle"></div><div class="bc-sheet-body"></div></div>';
      s.querySelector('.bc-sheet-dim').addEventListener('click', () => closeSheet(s));
      document.body.appendChild(s);
    }
    return s;
  }
  function openSheet(s) { s.hidden = false; requestAnimationFrame(() => s.classList.add('open')); document.body.classList.add('bc-sheet-lock'); }
  function closeSheet(s) {
    if (!s || s.hidden) return;
    s.classList.remove('open'); document.body.classList.remove('bc-sheet-lock');
    setTimeout(() => { s.hidden = true; if (s._onClose) s._onClose(); }, 180);
  }
  window.bcCloseSheets = () => document.querySelectorAll('.bc-sheet:not([hidden])').forEach(closeSheet);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') window.bcCloseSheets(); });

  /* ───────────── registers ───────────── */
  function parts(key) {
    const P = pageOf(key); if (!P) return null;
    const bar = P.querySelector('.bc-filterbar'); if (!bar) return null;
    return {
      P, bar,
      monitor: P.querySelector('aside.bc-monitor, aside.module-monitor'),
      customer: bar.querySelector('select.bc-filter-customer'),
      status: bar.querySelector('select.bc-filter-status'),
      sort: bar.querySelector('select.bc-filter-sort'),
      date: bar.querySelector('.bc-date'),
      search: bar.querySelector('.bc-filter-search'),
      clear: bar.querySelector('.register-clear-filters'),
      count: bar.querySelector('.bc-filter-count'),
      area: bar.parentElement,
    };
  }
  function activeFilters(x) {
    let n = 0;
    if (x.customer && x.customer.value) n++;
    if (x.status && x.status.value) n++;
    const db = x.date && x.date.querySelector('.bc-date-btn');
    if (db && db.classList.contains('active')) n++;
    return n;
  }

  // Status chips (copy of the monitor rows)
  function buildChips(key, x) {
    if (!x.monitor) return;
    let row = x.P.querySelector('.bc-chiprow');
    if (!row) {
      row = document.createElement('div'); row.className = 'bc-chiprow'; row.setAttribute('role', 'toolbar'); row.setAttribute('aria-label', 'Status');
      const host = x.bar.closest('.module-register-area, .rfq-register-area, .dn-register-area') || x.area;
      host.insertBefore(row, host.firstChild);
      row.addEventListener('click', e => {
        const c = e.target.closest('.bc-chip'); if (!c) return;
        if (c.dataset.summary) return openSummary(key, x);
        const src = x.monitor.querySelectorAll('.dn-overview-total, .dn-overview-row')[+c.dataset.i];
        if (src) { src.click(); setTimeout(() => refreshChips(key, x), 0); }
      });
    }
    refreshChips(key, x);
    if (!x.monitor._bcObs) {
      x.monitor._bcObs = new MutationObserver(() => { clearTimeout(x.monitor._bcT); x.monitor._bcT = setTimeout(() => refreshChips(key, x), 60); });
      x.monitor._bcObs.observe(x.monitor, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'aria-pressed'] });
    }
  }
  function refreshChips(key, x) {
    const row = x.P.querySelector('.bc-chiprow'); if (!row || !x.monitor) return;
    const items = [...x.monitor.querySelectorAll('.dn-overview-total, .dn-overview-row')];
    const html = items.map((b, i) => {
      const label = (b.querySelector('span')?.textContent || '').trim();
      const count = (b.querySelector('strong')?.textContent || '').trim();
      const dot = b.querySelector('.dn-dot');
      const on = b.classList.contains('active') || b.getAttribute('aria-pressed') === 'true';
      const name = i === 0 && b.classList.contains('dn-overview-total') ? 'All' : label;
      const bg = dot ? getComputedStyle(dot).backgroundColor : '';
      return `<button type="button" class="bc-chip${on ? ' on' : ''}" data-i="${i}" aria-pressed="${on}">${dot ? `<i class="bc-chip-dot" style="background:${esc(bg)}"></i>` : ''}<span>${esc(name)}</span><b>${esc(count)}</b></button>`;
    }).join('') + '<button type="button" class="bc-chip bc-chip-summary" data-summary="1"><i class="ti ti-chart-donut-3" aria-hidden="true"></i><span>Summary</span></button>';
    if (row._html !== html) { row._html = html; row.innerHTML = html; const on = row.querySelector('.bc-chip.on'); if (on && on.dataset.i !== '0' && row.scrollLeft === 0) on.scrollIntoView({ block: 'nearest', inline: 'center' }); }
  }
  // Summary: the real monitor, shown as a slide-up panel
  function openSummary(key, x) {
    const s = sheet('bc-summary-sheet'), body = s.querySelector('.bc-sheet-body');
    const mon = x.monitor; if (!mon) return;
    s._home = { parent: mon.parentElement, next: mon.nextSibling, mon };
    body.innerHTML = '';
    body.appendChild(mon); mon.classList.add('bc-in-sheet');
    s.querySelector('.bc-sheet-panel').setAttribute('aria-label', (mon.getAttribute('aria-label') || 'Summary'));
    const onPick = e => { if (e.target.closest('.dn-overview-total, .dn-overview-row')) setTimeout(() => closeSheet(s), 120); if (e.target.closest('.module-monitor-collapse')) { e.stopPropagation(); e.preventDefault(); closeSheet(s); } };
    mon.addEventListener('click', onPick, true);
    s._onClose = () => { mon.removeEventListener('click', onPick, true); mon.classList.remove('bc-in-sheet'); const h = s._home; if (h && h.parent) h.parent.insertBefore(h.mon, h.next); s._onClose = null; refreshChips(key, x); };
    openSheet(s);
  }

  // Filter icon + filter panel (phone)
  function buildFilterButton(key, x) {
    if (x.bar.querySelector('.bc-mfilter')) return paintFilterBadge(x);
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'btn btn-secondary bc-mfilter'; btn.title = 'Filters'; btn.setAttribute('aria-label', 'Filters');
    btn.innerHTML = '<i class="ti ti-adjustments-horizontal" aria-hidden="true"></i><span class="bc-mfilter-n" hidden></span>';
    btn.addEventListener('click', () => openFilters(key, x));
    const right = x.search ? x.search.parentElement : x.bar;
    right.insertBefore(btn, x.search ? x.search.nextSibling : null);
    [x.customer, x.status].forEach(s => s && s.addEventListener('change', () => paintFilterBadge(x)));
    if (x.date) new MutationObserver(() => paintFilterBadge(x)).observe(x.date, { subtree: true, attributes: true, attributeFilter: ['class'] });
    if (x.clear) x.clear.addEventListener('click', () => setTimeout(() => paintFilterBadge(x), 0));
    paintFilterBadge(x);
  }
  function paintFilterBadge(x) {
    const b = x.bar.querySelector('.bc-mfilter-n'); if (!b) return;
    const n = activeFilters(x); b.hidden = !n; b.textContent = n || '';
    x.bar.querySelector('.bc-mfilter').classList.toggle('on', !!n);
  }
  function opts(sel) { return sel ? [...sel.options].map(o => ({ v: o.value, t: o.textContent.trim(), on: o.value === sel.value })) : []; }
  function openFilters(key, x) {
    const s = sheet('bc-filter-sheet'), body = s.querySelector('.bc-sheet-body');
    s.querySelector('.bc-sheet-panel').setAttribute('aria-label', 'Filters');
    const render = () => {
      const dateItems = x.date ? [...x.date.querySelectorAll('.bc-date-item')] : [];
      const custom = x.date && x.date.querySelector('.bc-date-custom.on');
      const resultText = (x.count && x.count.textContent.trim()) || '';
      body.innerHTML = `
        <div class="bc-sheet-head"><h3>Filters</h3><button type="button" class="bc-sheet-link" data-act="clear">Clear all</button></div>
        ${x.customer ? `<div class="bc-sheet-label">Customer</div><select class="bc-sheet-select" data-ctl="customer">${opts(x.customer).map(o => `<option value="${esc(o.v)}"${o.on ? ' selected' : ''}>${esc(o.t)}</option>`).join('')}</select>` : ''}
        ${x.status ? `<div class="bc-sheet-label">Status</div><div class="bc-sheet-chips">${opts(x.status).map(o => `<button type="button" class="bc-chip${o.on ? ' on' : ''}" data-status="${esc(o.v)}">${esc(o.v ? o.t : 'All')}</button>`).join('')}</div>` : ''}
        ${dateItems.length ? `<div class="bc-sheet-label">Date</div><div class="bc-sheet-chips">${dateItems.map((d, i) => `<button type="button" class="bc-chip${d.classList.contains('on') ? ' on' : ''}" data-date="${i}">${esc(d.querySelector('span:not(.bc-date-tick)')?.textContent.trim() || '')}</button>`).join('')}<button type="button" class="bc-chip${custom ? ' on' : ''}" data-date="custom"><i class="ti ti-calendar" aria-hidden="true"></i>Custom…</button></div>
          <div class="bc-sheet-custom"${custom ? '' : ' hidden'}><input type="date" data-from value="${esc(x.date.querySelector('.bc-date-from').value)}" aria-label="From date"><span>→</span><input type="date" data-to value="${esc(x.date.querySelector('.bc-date-to').value)}" aria-label="To date"><button type="button" class="btn btn-primary btn-sm" data-act="apply-date">Apply</button></div>` : ''}
        ${x.sort ? `<div class="bc-sheet-label">Sort</div><select class="bc-sheet-select" data-ctl="sort">${opts(x.sort).map(o => `<option value="${esc(o.v)}"${o.on ? ' selected' : ''}>${esc(o.t)}</option>`).join('')}</select>` : ''}
        <div class="bc-sheet-actions"><button type="button" class="btn btn-secondary" data-act="close">Close</button><button type="button" class="btn btn-primary" data-act="close">${esc(resultText ? 'Show ' + resultText : 'Show results')}</button></div>`;
    };
    const after = () => setTimeout(() => { render(); paintFilterBadge(x); }, 30);
    body.onclick = e => {
      const t = e.target.closest('button'); if (!t) return;
      if (t.dataset.status !== undefined) { setSelect(x.status, t.dataset.status); return after(); }
      if (t.dataset.date !== undefined) {
        if (t.dataset.date === 'custom') { body.querySelector('.bc-sheet-custom').hidden = false; body.querySelectorAll('[data-date]').forEach(c => c.classList.toggle('on', c === t)); return; }
        const item = x.date.querySelectorAll('.bc-date-item')[+t.dataset.date]; if (item) item.click(); return after();
      }
      const act = t.dataset.act;
      if (act === 'close') return closeSheet(s);
      if (act === 'clear') { if (x.clear) x.clear.click(); else { setSelect(x.customer, ''); setSelect(x.status, ''); } return after(); }
      if (act === 'apply-date') {
        x.date.querySelector('.bc-date-from').value = body.querySelector('[data-from]').value;
        x.date.querySelector('.bc-date-to').value = body.querySelector('[data-to]').value;
        x.date.querySelector('.bc-date-apply').click(); return after();
      }
    };
    body.onchange = e => {
      const c = e.target.dataset.ctl; if (!c) return;
      setSelect(c === 'customer' ? x.customer : x.sort, e.target.value); after();
    };
    s._onClose = () => paintFilterBadge(x);
    render(); openSheet(s);
  }

  // Cards (phone)
  function headIndex(table) {
    return [...table.querySelectorAll('thead th')].map(th => th.textContent.replace(/\s+/g, ' ').trim().toLowerCase());
  }
  function col(heads, name) { if (!name) return -1; return heads.findIndex(h => h === name); }
  function buildCards(key, x) {
    const cfg = REG[key]; if (!cfg) return;
    const table = x.P.querySelector('.dn-register-card table, .card table, table'); if (!table || !table.tBodies[0]) return;
    const wrap = table.parentElement;
    if (cfg.ownCards) { wrap.classList.add('bc-table-wrap'); return; }
    wrap.classList.add('bc-cards-wrap', 'bc-table-wrap');
    let cards = wrap.parentElement.querySelector(':scope > .bc-cards');
    if (!cards) {
      cards = document.createElement('div'); cards.className = 'bc-cards'; cards.setAttribute('role', 'list');
      wrap.after(cards);
      cards.addEventListener('click', e => {
        const c = e.target.closest('.bc-card'); if (!c) return;
        const tr = table.tBodies[0].rows[+c.dataset.r]; if (tr) tr.click();
      });
      cards.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('bc-card')) { e.preventDefault(); e.target.click(); } });
      new MutationObserver(() => { clearTimeout(cards._t); cards._t = setTimeout(() => renderCards(key, table, cards), 40); })
        .observe(table.tBodies[0], { childList: true, subtree: true, characterData: true });
    }
    renderCards(key, table, cards);
  }
  function renderCards(key, table, cards) {
    if (!isPhone()) { if (cards._html) { cards.innerHTML = ''; cards._html = ''; } return; }
    const cfg = REG[key], heads = headIndex(table);
    const iNo = 0, iStatus = heads.lastIndexOf('status'), iCust = col(heads, 'customer'), iDate = col(heads, cfg.date || 'date');
    const iAmt = cfg.amount === null ? -1 : col(heads, cfg.amount || 'net amount');
    const iSub = (cfg.sub || []).map(n => col(heads, n)).filter(i => i >= 0);
    const iChip = col(heads, cfg.chip), iPill = col(heads, cfg.pill), iExtra = col(heads, cfg.extra);
    const rows = [...table.tBodies[0].rows];
    const cell = (tr, i) => (i >= 0 && tr.cells[i]) ? tr.cells[i] : null;
    const txt = (tr, i) => { const c = cell(tr, i); return c ? c.textContent.replace(/\s+/g, ' ').trim() : ''; };
    const htm = (tr, i) => { const c = cell(tr, i); return c ? c.innerHTML : ''; };
    let html;
    if (rows.length === 1 && rows[0].cells.length === 1) html = `<div class="bc-cards-empty">${rows[0].cells[0].innerHTML}</div>`;
    else html = rows.map((tr, r) => {
      if (tr.cells.length <= 1) return '';
      const subs = iSub.map(i => txt(tr, i)).filter(v => v && v !== '—');
      const chip = iChip >= 0 && txt(tr, iChip) && txt(tr, iChip) !== '—' ? `<div class="bc-card-chip">${htm(tr, iChip)}</div>` : '';
      const extra = iExtra >= 0 ? `<small class="bc-card-extra">${esc(heads[iExtra].replace(/\b\w/g, c => c.toUpperCase()))} ${esc(txt(tr, iExtra))}</small>` : '';
      return `<div class="bc-card" role="listitem" tabindex="0" data-r="${r}">
        <div class="bc-card-r1"><b class="bc-card-no">${esc(txt(tr, iNo))}</b><span class="bc-card-status">${iPill >= 0 ? htm(tr, iPill) : ''}${htm(tr, iStatus)}</span></div>
        ${iCust >= 0 ? `<div class="bc-card-cust">${esc(txt(tr, iCust))}</div>` : ''}
        <div class="bc-card-r3"><div class="bc-card-meta">${esc([txt(tr, iDate), ...subs.map((v, k) => (/^\d+$/.test(v) && heads[iSub[k]] === 'items') ? v + ' items' : v)].filter(Boolean).join(' · '))}${chip}</div>${iAmt >= 0 ? `<div class="bc-card-amt">${esc(txt(tr, iAmt))}${extra}</div>` : ''}</div>
      </div>`;
    }).join('');
    if (cards._html !== html) { cards._html = html; cards.innerHTML = html; }
  }

  // Tablet portrait (761–900 px): leave out the less important columns (the table still scrolls if needed)
  function tabletColumns(key, x) {
    const cfg = REG[key]; if (!cfg || !cfg.tabletHide) return;
    const table = x.P.querySelector('.dn-register-card table, .card table, table'); if (!table) return;
    const heads = headIndex(table);
    const idx = cfg.tabletHide.map(n => heads.indexOf(n)).filter(i => i >= 0);
    if (!idx.length) return;
    let st = document.getElementById('bc-tab-cols-' + key);
    if (!st) { st = document.createElement('style'); st.id = 'bc-tab-cols-' + key; document.head.appendChild(st); }
    const sel = idx.map(i => `html body #page-${key} .bc-table-wrap table tr>:nth-child(${i + 1})`).join(',\n');
    st.textContent = `@media (min-width:761px) and (max-width:900px){${sel}{display:none!important} html body #page-${key} .bc-table-wrap table{min-width:0!important}}`;
  }
  function enhanceRegister(key) {
    const x = parts(key); if (!x) return;
    x.P.classList.add('bc-resp-register');
    buildChips(key, x);
    buildFilterButton(key, x);
    buildCards(key, x);
    tabletColumns(key, x);
  }
  function enhanceAllRegisters() { Object.keys(REG).forEach(enhanceRegister); }

  /* ───────────── view / entry screens (phone) ───────────── */
  const FOOT = ':is(.modal-footer, .dn-view-actionbar)';
  function enhanceFooter(f) {
    if (!f || f._bcBusy) return;
    if (f.querySelector('.dn-m-more')) return;   // the Delivery Note view has its own phone action bar (V265.5)
    f._bcBusy = true;
    try {
      let more = f.querySelector(':scope > .bc-more-wrap');
      const btns = [...f.querySelectorAll(':scope button, :scope > * > button')].filter(b => !b.closest('.bc-more-wrap') && !b.closest('.bc-more-menu'));
      btns.forEach(b => b.classList.remove('bc-more-hidden'));
      const visible = btns.filter(b => !b.hidden && b.style.display !== 'none' && getComputedStyle(b).display !== 'none');
      if (!isPhone() || visible.length <= 3) { if (more) more.remove(); f.classList.remove('bc-has-more'); return; }
      f.classList.add('bc-has-more');
      const lastOf = re => [...visible].reverse().find(b => re.test(b.className));
      const keep = [];
      const prim = lastOf(/\bbtn-primary\b/), succ = lastOf(/\bbtn-success\b/);
      if (succ) keep.push(succ); if (prim && prim !== succ) keep.push(prim);
      for (const b of [...visible].reverse()) { if (keep.length >= 2) break; if (!keep.includes(b) && !/btn-danger/.test(b.className) && !/^(close|cancel)$/i.test(b.textContent.trim())) keep.push(b); }
      visible.forEach(b => { if (!keep.includes(b)) b.classList.add('bc-more-hidden'); });
      if (!more) {
        more = document.createElement('div'); more.className = 'bc-more-wrap';
        more.innerHTML = '<button type="button" class="btn btn-secondary bc-more-btn" aria-haspopup="true" aria-expanded="false" title="More actions" aria-label="More actions"><i class="ti ti-dots" aria-hidden="true"></i></button><div class="bc-more-menu" role="menu" hidden></div>';
        f.appendChild(more);
        const menu = more.querySelector('.bc-more-menu'), mb = more.querySelector('.bc-more-btn');
        mb.addEventListener('click', e => {
          e.stopPropagation();
          if (!menu.hidden) { menu.hidden = true; mb.setAttribute('aria-expanded', 'false'); return; }
          const hid = [...f.querySelectorAll('.bc-more-hidden')].filter(b => !b.hidden && b.style.display !== 'none');
          menu.innerHTML = hid.map((b, i) => `<button type="button" role="menuitem" class="bc-more-item${/btn-danger/.test(b.className) ? ' danger' : ''}" data-i="${i}"${b.disabled ? ' disabled' : ''}>${b.innerHTML}</button>`).join('');
          menu.querySelectorAll('.bc-more-item').forEach(it => it.addEventListener('click', ev => { ev.stopPropagation(); menu.hidden = true; mb.setAttribute('aria-expanded', 'false'); hid[+it.dataset.i].click(); }));
          menu.hidden = false; mb.setAttribute('aria-expanded', 'true');
        });
        document.addEventListener('click', () => { menu.hidden = true; mb.setAttribute('aria-expanded', 'false'); });
      } else f.appendChild(more);
    } finally { setTimeout(() => { f._bcBusy = false; }, 0); }
  }
  function enhanceProgress(m) {
    const track = m.querySelector('.pipeline-track'); if (!track) return;
    const steps = [...track.querySelectorAll('.pt-step')]; if (!steps.length) return;
    let idx = steps.findIndex(s => s.querySelector('.pt-dot.active, .pt-label.active'));
    if (idx < 0) idx = Math.max(0, steps.map(s => !!s.querySelector('.done')).lastIndexOf(true));
    const label = steps[idx].querySelector('.pt-label')?.textContent.trim() || '';
    const nextL = steps[idx + 1]?.querySelector('.pt-label')?.textContent.trim() || '';
    let line = track.parentElement.querySelector(':scope > .bc-step-line');
    if (!line) { line = document.createElement('div'); line.className = 'bc-step-line'; track.before(line); }
    const html = `<div class="bc-step-text"><span>Step ${idx + 1} of ${steps.length} · <b>${esc(label)}</b></span>${nextL ? `<span class="bc-step-next">Next: ${esc(nextL.toLowerCase())}</span>` : ''}</div><div class="bc-step-bar"><i style="width:${Math.round((idx + 1) / steps.length * 100)}%"></i></div>`;
    if (line.innerHTML !== html) line.innerHTML = html;
  }
  function fitDocuments(m) {
    m.querySelectorAll('.qdoc-sheet, .dn-a4').forEach(doc => {
      const host = doc.parentElement; if (!host) return;
      if (!isPhone()) { doc.style.zoom = ''; host.style.overflowX = ''; return; }
      doc.style.zoom = '';
      const avail = host.clientWidth - 4, w = doc.offsetWidth;
      if (w > avail && avail > 100) { doc.style.zoom = (avail / w).toFixed(3); host.style.overflowX = 'hidden'; }
    });
  }
  function enhanceModal(m) {
    if (!m || !m.classList.contains('open')) return;
    m.querySelectorAll(FOOT).forEach(enhanceFooter);
    enhanceProgress(m);
    fitDocuments(m);
    setTimeout(() => fitDocuments(m), 350);
  }
  function enhanceOpenModals() { document.querySelectorAll('.modal-overlay.open').forEach(enhanceModal); }

  /* ───────────── tablet landscape defaults ───────────── */
  function landscapeDefaults() {
    // Sidebar and monitors follow the screen size until the user picks a state (their choice is remembered)
    const w = window.innerWidth; if (w <= 900) return;
    let saved = null; try { saved = localStorage.getItem('bc_sidebar_collapsed'); } catch (e) {}
    const sb = document.querySelector('.sidebar');
    if (saved === null && sb && typeof window.toggleSidebarCollapse === 'function') {
      const want = w < 1280;
      if (sb.classList.contains('collapsed') !== want) window.toggleSidebarCollapse(want);
    }
    if (typeof window.restoreModuleMonitors === 'function') { try { window.restoreModuleMonitors(); } catch (e) {} }
  }

  /* ───────────── wiring ───────────── */
  let started = false;
  function start() {
    if (started) return; started = true;
    document.documentElement.classList.add('bc-resp');
    enhanceAllRegisters();
    landscapeDefaults();
    // modals: open / close / footer changes
    new MutationObserver(muts => {
      const touched = new Set();
      for (const mu of muts) {
        const t = mu.target;
        if (mu.type === 'attributes' && t.classList && t.classList.contains('modal-overlay')) { if (t.classList.contains('open')) touched.add(t); }
        else if (mu.type === 'childList') { const m = t.closest && t.closest('.modal-overlay.open'); if (m) touched.add(m); }
      }
      touched.forEach(m => { clearTimeout(m._bcT); m._bcT = setTimeout(() => enhanceModal(m), 40); });
    }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
    let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { enhanceAllRegisters(); enhanceOpenModals(); landscapeDefaults(); if (!isNarrow()) window.bcCloseSheets(); }, 120); });
  }
  window.BizCoreResponsive = { start, enhanceAllRegisters, enhanceOpenModals, isPhone };
  // app.js is loaded after sign-in; the registers exist in the HTML from the start, their rows come later
  const boot = () => { if (document.getElementById('page-quotations')) start(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.addEventListener('load', () => { enhanceAllRegisters(); enhanceOpenModals(); });
})();
