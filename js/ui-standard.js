/* ═══════════════════════════════════════════════════════════════════
   BizCore V265 — Standard UI components shared by every register screen.

   BCDateFilter — the standard date filter (design "A", approved 13 Oct 2026):
     • a button that looks like the other filter fields (calendar icon, label, chevron);
     • a popup: title, "All Dates", then the presets with their actual dates in grey and a tick on the chosen one;
     • a Custom range section (From → To, Clear, Apply) on a light grey background.
   Every register uses the same presets with the same meaning, and the week start comes from
   Administration → General Defaults ("Week starts on").

   Usage (future screens too):
     <div class="bc-date" data-bc-date="KEY" data-bc-date-title="Invoice date"></div>
     BCDateFilter.register('KEY', state => { …store state.from / state.to (YYYY-MM-DD or '')…; render(); });
     BCDateFilter.set('KEY', { preset: 'all' })   // e.g. from "Clear Filters" (does not call the handler)
     BCDateFilter.get('KEY')                       // → { preset, from, to }
═══════════════════════════════════════════════════════════════════ */
'use strict';
(function () {
  const PRESETS = [
    ['today', 'Today'], ['week', 'This Week'], ['month', 'This Month'], ['lastmonth', 'Last Month'],
    ['30days', 'Last 30 Days'], ['last3months', 'Last 3 Months'], ['year', 'This Year'],
  ];
  const LABELS = Object.fromEntries([['all', 'All Dates'], ...PRESETS]);
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const instances = {};
  const pad = n => String(n).padStart(2, '0');
  const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /** 0 = Sunday, 1 = Monday — Administration → General Defaults → "Week starts on". */
  function weekStartDay() {
    const s = (typeof settings === 'object' && settings) ? settings.weekStart : null;
    return s === 'monday' ? 1 : 0;
  }
  /** The one definition of every preset, used by all registers. Ranges end today (no future dates). */
  function range(preset, today = new Date()) {
    const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const y = t.getFullYear(), m = t.getMonth();
    let from = null, to = t;
    if (preset === 'today') from = t;
    else if (preset === 'week') { from = new Date(t); from.setDate(t.getDate() - ((t.getDay() - weekStartDay() + 7) % 7)); }
    else if (preset === 'month') from = new Date(y, m, 1);
    else if (preset === 'lastmonth') { from = new Date(y, m - 1, 1); to = new Date(y, m, 0); }
    else if (preset === '30days') { from = new Date(t); from.setDate(t.getDate() - 29); }
    else if (preset === 'last3months') { from = new Date(y, m - 3, Math.min(t.getDate(), new Date(y, m - 2, 0).getDate())); }
    else if (preset === 'year') from = new Date(y, 0, 1);
    else return { from: '', to: '' };
    return { from: iso(from), to: iso(to) };
  }
  /** Short grey hint: "13 Oct", "11 – 13 Oct", "Sep 2026", "14 Sep – 13 Oct", "2026". */
  function hint(preset) {
    const r = range(preset); const a = parse(r.from), b = parse(r.to); if (!a || !b) return '';
    if (preset === 'lastmonth') return `${MONTHS[a.getMonth()]} ${a.getFullYear()}`;
    if (preset === 'year') return String(a.getFullYear());
    return shortRange(a, b);
  }
  function shortRange(a, b) {
    if (!a && !b) return '';
    if (a && !b) return `From ${a.getDate()} ${MONTHS[a.getMonth()]} ${a.getFullYear()}`;
    if (!a && b) return `Until ${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;
    if (iso(a) === iso(b)) return `${a.getDate()} ${MONTHS[a.getMonth()]}`;
    const sameYear = a.getFullYear() === b.getFullYear(), now = new Date().getFullYear();
    if (sameYear && a.getMonth() === b.getMonth()) return `${a.getDate()} – ${b.getDate()} ${MONTHS[b.getMonth()]}${b.getFullYear() !== now ? ' ' + b.getFullYear() : ''}`;
    if (sameYear) return `${a.getDate()} ${MONTHS[a.getMonth()]} – ${b.getDate()} ${MONTHS[b.getMonth()]}${b.getFullYear() !== now ? ' ' + b.getFullYear() : ''}`;
    return `${a.getDate()} ${MONTHS[a.getMonth()]} ${a.getFullYear()} – ${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;
  }
  function buttonLabel(st) {
    if (st.preset === 'custom') return shortRange(parse(st.from), parse(st.to)) || 'All Dates';
    return LABELS[st.preset] || 'All Dates';
  }

  function mount(host) {
    const key = host.dataset.bcDate; if (!key || instances[key]) return;
    const title = host.dataset.bcDateTitle || 'Date';
    const inst = instances[key] = { key, host, state: { preset: 'all', from: '', to: '' }, handler: null };
    host.classList.add('bc-date');
    host.innerHTML = `
      <button type="button" class="bc-filter bc-filter-date bc-filter-datebtn bc-date-btn" id="${esc(key)}-date-filter-btn" aria-haspopup="true" aria-expanded="false" title="Filter by ${esc(title.toLowerCase())}">
        <i class="ti ti-calendar" aria-hidden="true"></i><span class="bc-date-label">All Dates</span><i class="ti ti-chevron-down bc-date-chev" aria-hidden="true"></i>
      </button>
      <div class="bc-date-pop" role="dialog" aria-label="${esc(title)}" hidden>
        <div class="bc-date-title">${esc(title)}</div>
        <div class="bc-date-list" role="listbox">
          <button type="button" class="bc-date-item" data-preset="all" role="option"><span class="bc-date-tick">✓</span><span>All Dates</span></button>
          <div class="bc-date-sep"></div>
          ${PRESETS.map(([p, l]) => `<button type="button" class="bc-date-item" data-preset="${p}" role="option"><span class="bc-date-tick">✓</span><span>${l}</span><small class="bc-date-hint" data-hint="${p}"></small></button>`).join('')}
        </div>
        <div class="bc-date-custom">
          <div class="bc-date-title">Custom range</div>
          <div class="bc-date-row"><input type="date" class="bc-date-from" aria-label="From date"><span class="bc-date-arrow">→</span><input type="date" class="bc-date-to" aria-label="To date"></div>
          <div class="bc-date-err" hidden></div>
          <div class="bc-date-actions"><button type="button" class="bc-date-clear">Clear</button><button type="button" class="bc-date-apply">Apply</button></div>
        </div>
      </div>`;
    const btn = host.querySelector('.bc-date-btn'), pop = host.querySelector('.bc-date-pop');
    btn.addEventListener('click', e => { e.stopPropagation(); pop.hidden ? open(key) : close(key); });
    pop.addEventListener('click', e => e.stopPropagation());
    host.querySelectorAll('.bc-date-item').forEach(b => b.addEventListener('click', () => choose(key, { preset: b.dataset.preset, ...range(b.dataset.preset) })));
    host.querySelector('.bc-date-apply').addEventListener('click', () => {
      const from = host.querySelector('.bc-date-from').value || '', to = host.querySelector('.bc-date-to').value || '';
      const err = host.querySelector('.bc-date-err');
      if (from && to && from > to) { err.hidden = false; err.textContent = 'The From date is after the To date.'; return; }
      err.hidden = true;
      choose(key, from || to ? { preset: 'custom', from, to } : { preset: 'all', from: '', to: '' });
    });
    host.querySelector('.bc-date-clear').addEventListener('click', () => choose(key, { preset: 'all', from: '', to: '' }));
    host.querySelectorAll('.bc-date-from,.bc-date-to').forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') host.querySelector('.bc-date-apply').click(); }));
    paint(key);
  }
  function paint(key) {
    const inst = instances[key]; if (!inst) return;
    const st = inst.state, h = inst.host;
    h.querySelector('.bc-date-label').textContent = buttonLabel(st);
    h.querySelector('.bc-date-btn').classList.toggle('active', st.preset !== 'all');
    h.querySelectorAll('.bc-date-item').forEach(b => { const on = b.dataset.preset === st.preset; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
    h.querySelectorAll('[data-hint]').forEach(s => { s.textContent = hint(s.dataset.hint); });
    h.querySelector('.bc-date-from').value = st.preset === 'custom' ? st.from : '';
    h.querySelector('.bc-date-to').value = st.preset === 'custom' ? st.to : '';
    h.querySelector('.bc-date-custom').classList.toggle('on', st.preset === 'custom');
  }
  function open(key) {
    Object.keys(instances).forEach(k => k !== key && close(k));
    const inst = instances[key]; if (!inst) return;
    paint(key);   // hints follow today's date
    inst.host.querySelector('.bc-date-pop').hidden = false;
    inst.host.querySelector('.bc-date-btn').setAttribute('aria-expanded', 'true');
    inst.host.classList.add('open');
  }
  function close(key) {
    const inst = instances[key]; if (!inst) return;
    inst.host.querySelector('.bc-date-pop').hidden = true;
    inst.host.querySelector('.bc-date-btn').setAttribute('aria-expanded', 'false');
    inst.host.classList.remove('open');
    const err = inst.host.querySelector('.bc-date-err'); if (err) err.hidden = true;
  }
  function choose(key, st) {
    const inst = instances[key]; if (!inst) return;
    inst.state = { preset: st.preset || 'all', from: st.from || '', to: st.to || '' };
    paint(key); close(key);
    if (typeof inst.handler === 'function') { try { inst.handler({ ...inst.state }); } catch (e) { console.error('[BizCore date filter]', key, e); } }
  }

  window.BCDateFilter = {
    range, hint, labels: LABELS, presets: PRESETS.map(p => p[0]),
    register(key, handler) { mountAll(); if (instances[key]) instances[key].handler = handler; },
    /** Change the shown state without calling the handler (used by "Clear Filters" and old entry points). */
    set(key, st) { mountAll(); const inst = instances[key]; if (!inst) return; const p = (st && (st.preset || st.mode)) || 'all'; inst.state = p === 'all' ? { preset: 'all', from: '', to: '' } : { preset: p, from: st.from || range(p).from, to: st.to || range(p).to }; paint(key); close(key); },
    /** Select a preset (or custom range) and run the handler, as if the user had clicked it. */
    choose(key, st) { mountAll(); const p = (st && (st.preset || st.mode)) || 'all'; choose(key, p === 'custom' ? { preset: p, from: st.from, to: st.to } : { preset: p, ...range(p) }); },
    get(key) { return instances[key] ? { ...instances[key].state } : { preset: 'all', from: '', to: '' }; },
    open, close,
  };
  /* ── V265.2 — Compact document view panel pieces (Quotation, DN, Invoice, Credit Note) ──
     bcKpiGrid([{ label, value, tone }])        → 2 × 2 figure tiles (tone: red | green | muted)
     bcFlowChips([{ label, text, onclick, state, tag, cls, attrs }])
                                                 → the document flow on one line; state: current | muted.
                                                   A muted node shows "Label —"; the label is the tooltip.
     bcActivityList([[title, when]])            → dot + text + date rows                                    */
  window.bcKpiGrid = function (list) {
    return `<div class="bc-kpi-grid">${list.filter(Boolean).map(k => `<div class="bc-kpi${k.tone ? ' ' + esc(k.tone) : ''}"><small>${esc(k.label)}</small><b>${k.value}</b></div>`).join('')}</div>`;
  };
  window.bcFlowChips = function (nodes) {
    const html = nodes.filter(Boolean).map(n => {
      const cls = `bc-flow-chip${n.state ? ' ' + n.state : ''}${n.cls ? ' ' + n.cls : ''}`;
      const tag = n.tag ? `<span class="bc-flow-tag">${esc(n.tag)}</span>` : '';
      if (n.state === 'muted') return `<span class="${cls}" title="${esc(n.label)}: not linked">${esc(n.label)} —</span>`;
      const body = `${tag}${esc(n.text)}`;
      if (n.onclick && n.state !== 'current') return `<button type="button" class="${cls}" title="${esc(n.label)}" ${n.attrs || ''} onclick="${n.onclick}">${body}</button>`;
      return `<span class="${cls}" title="${esc(n.label)}"${n.state === 'current' ? ' aria-current="true"' : ''}>${body}</span>`;
    });
    return `<div class="bc-flow">${html.join('<span class="bc-flow-arrow" aria-hidden="true">›</span>')}</div>`;
  };
  window.bcActivityList = function (rows) {
    const when = w => {
      if (!w) return '—';
      const d = parse(w) || new Date(w);
      if (isNaN(d)) return esc(w);
      const day = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
      return /T\d\d:/.test(String(w)) ? `${day}, ${pad(d.getHours())}:${pad(d.getMinutes())}` : day;
    };
    return `<div class="bc-activity">${rows.filter(Boolean).map(r => `<div class="bc-activity-row"><i aria-hidden="true"></i><div>${esc(r[0])}</div><span>${when(r[1])}</span></div>`).join('')}</div>`;
  };

  function mountAll() { document.querySelectorAll('[data-bc-date]').forEach(mount); }
  document.addEventListener('click', () => Object.keys(instances).forEach(close));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') Object.keys(instances).forEach(close); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountAll); else mountAll();
})();
