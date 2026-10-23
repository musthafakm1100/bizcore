/* ═══════════════════════════════════════════════════════════════
   V270.1 — BizCore date field (BCDate)
   One date field for the whole of BizCore. Shows and accepts DD-MM-YYYY (e.g. 22-10-2026); the value behind it is
   always ISO (YYYY-MM-DD), exactly as before, so nothing stored changes.

   Typing (on leaving the field or Enter):
     22-10-2026 · 22/10/2026 · 22.10.26 · 22 10 2026 · 22102026 · 221026   → 22-10-2026
     22/10 · 2210                                                           → this year
     t / today · y / yesterday                                              → today / yesterday
     2026-10-22 (ISO, e.g. pasted)                                          → 22-10-2026
   Calendar: the 📅 button, Alt+↓ or F4. ‹ › change month; today is outlined, the chosen date filled.
     Keys: arrows (day / week), PageUp / PageDown (month), Home / End (week), Enter or Space (choose), Esc (close).
     Buttons: Today · Yesterday · Clear (Clear only where the date may be empty).
   Limits: min / max (ISO or a function returning ISO). Days outside them can't be picked; a typed date outside them is
     kept but marked, and the screen's own check gives the message (e.g. Pricing's "no future dates").

   Use:  BCDate.attach(input, { min, max, allowEmpty, onCommit(iso, state) })
         BCDate.getISO(input) · BCDate.setISO(input, iso) · BCDate.parse(text) · BCDate.format(iso) · BCDate.today()
   parse() returns '' for an empty text and null for a date it can't read.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.BCDate) return;
  const pad = n => String(n).padStart(2, '0');
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const toISO = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
  const isValid = (y, m, d) => {
    if (!(y >= 1900 && y <= 2200 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return false;
    const dt = new Date(y, m - 1, d, 12);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
  };
  const dateOf = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '')); return m ? new Date(+m[1], +m[2] - 1, +m[3], 12) : null; };
  const isoOf = dt => toISO(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
  const addDays = (iso, n) => { const d = dateOf(iso); d.setDate(d.getDate() + n); return isoOf(d); };
  function today(offset = 0) { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + offset); return isoOf(d); }

  function parse(text) {
    const t = String(text == null ? '' : text).trim().toLowerCase();
    if (!t) return '';
    if (t === 't' || t === 'today') return today();
    if (t === 'y' || t === 'yesterday') return today(-1);
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
    if (m) return isValid(+m[1], +m[2], +m[3]) ? toISO(+m[1], +m[2], +m[3]) : null;
    let d, mo, y;
    m = /^(\d{1,2})[\/\-. ]+(\d{1,2})(?:[\/\-. ]+(\d{2}|\d{4}))?$/.exec(t);
    if (m) { d = +m[1]; mo = +m[2]; y = m[3]; }
    else if (/^\d{8}$/.test(t)) { d = +t.slice(0, 2); mo = +t.slice(2, 4); y = t.slice(4); }
    else if (/^\d{6}$/.test(t)) { d = +t.slice(0, 2); mo = +t.slice(2, 4); y = t.slice(4); }
    else if (/^\d{4}$/.test(t)) { d = +t.slice(0, 2); mo = +t.slice(2, 4); }
    else return null;
    if (y === undefined) y = new Date().getFullYear();
    else y = String(y).length === 2 ? 2000 + Number(y) : Number(y);
    return isValid(y, mo, d) ? toISO(y, mo, d) : null;
  }
  function format(iso) { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? `${m[3]}-${m[2]}-${m[1]}` : ''; }
  const bound = v => (typeof v === 'function' ? v() : v) || '';

  /* ── the field ── */
  function attach(input, opts = {}) {
    if (!input || input._bcdate) return input && input._bcdate;
    const o = { allowEmpty: true, ...opts };
    input.classList.add('bcd-input');
    input.setAttribute('placeholder', 'DD-MM-YYYY');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('spellcheck', 'false');
    input.removeAttribute('maxlength');
    input.setAttribute('aria-haspopup', 'dialog');
    let wrap = input.parentElement;
    if (!wrap || !wrap.classList.contains('bcd-wrap')) {
      wrap = document.createElement('span'); wrap.className = 'bcd-wrap';
      input.parentNode.insertBefore(wrap, input); wrap.appendChild(input);
    }
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'bcd-btn'; btn.tabIndex = -1;
    btn.title = 'Pick a date (Alt+↓)'; btn.setAttribute('aria-label', 'Pick a date');
    btn.innerHTML = '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><rect x="3" y="4.5" width="14" height="12.5" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3 8.5h14M7 2.8v3.4M13 2.8v3.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
    wrap.appendChild(btn);

    const api = {
      input, opts: o,
      getISO() { const v = parse(input.value); return v || ''; },
      setISO(iso) { input.value = format(iso); input.dataset.iso = input.value ? iso : ''; mark(); },
      commit, open: () => openCal(api), close: closeCal,
    };
    function mark() {
      const v = parse(input.value), min = bound(o.min), max = bound(o.max);
      const bad = v === null || (v === '' && !o.allowEmpty && input.dataset.bcdRequired === '1') || (v && ((min && v < min) || (max && v > max)));
      input.classList.toggle('bcd-invalid', !!bad);
      return { iso: v || '', invalid: v === null, outOfRange: !!(v && ((min && v < min) || (max && v > max))) };
    }
    function commit() {
      const v = parse(input.value);
      if (v) { const f = format(v); if (input.value !== f) input.value = f; input.dataset.iso = v; }
      else if (v === '') input.dataset.iso = '';
      const st = mark();
      if (typeof o.onCommit === 'function') o.onCommit(st.iso, st);
      return st;
    }
    input.addEventListener('blur', () => { if (!cal || cal.api !== api) commit(); });
    input.addEventListener('keydown', e => {
      if ((e.altKey && e.key === 'ArrowDown') || e.key === 'F4') { e.preventDefault(); openCal(api); }
      else if (e.key === 'Enter') commit();
      else if (e.key === 'Escape' && cal && cal.api === api) { e.preventDefault(); e.stopPropagation(); closeCal(); }
    });
    input.addEventListener('input', () => input.classList.remove('bcd-invalid'));
    btn.addEventListener('mousedown', e => e.preventDefault());
    btn.addEventListener('click', () => { if (cal && cal.api === api) closeCal(); else openCal(api); });
    input._bcdate = api;
    if (input.value) { const v = parse(input.value); if (v) { input.value = format(v); input.dataset.iso = v; } }
    return api;
  }

  /* ── the calendar (one at a time, on the page body so no screen clips it) ── */
  let cal = null;
  const isPhone = () => window.matchMedia && window.matchMedia('(max-width:760px)').matches;
  function openCal(api) {
    closeCal();
    const sel = parse(api.input.value) || '';
    const focus = sel || (bound(api.opts.max) && today() > bound(api.opts.max) ? bound(api.opts.max) : today());
    const root = document.createElement('div');
    root.className = 'bcd-pop' + (isPhone() ? ' bcd-sheet' : '');
    root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Choose a date');
    let dim = null;
    if (isPhone()) { dim = document.createElement('div'); dim.className = 'bcd-dim'; dim.addEventListener('click', closeCal); document.body.appendChild(dim); }
    document.body.appendChild(root);
    cal = { api, root, dim, sel, focus, view: focus.slice(0, 7) };
    render();
    place();
    api.input.setAttribute('aria-expanded', 'true');
    setTimeout(() => root.querySelector('.bcd-day[tabindex="0"]')?.focus({ preventScroll: true }), 0);
  }
  function closeCal(refocus) {
    if (!cal) return;
    const { root, dim, api } = cal; cal = null;
    root.remove(); dim && dim.remove();
    api.input.setAttribute('aria-expanded', 'false');
    if (refocus) api.input.focus({ preventScroll: true });
  }
  function choose(iso) {
    const api = cal.api;
    closeCal(true);
    api.input.value = format(iso);
    api.commit();
    api.input.dispatchEvent(new Event('input', { bubbles: true }));
    api.input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function render() {
    const { api, root, sel, focus, view } = cal;
    const min = bound(api.opts.min), max = bound(api.opts.max), now = today();
    const [vy, vm] = view.split('-').map(Number);
    const first = new Date(vy, vm - 1, 1, 12), start = new Date(first); start.setDate(1 - first.getDay());
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const iso = isoOf(d), off = (min && iso < min) || (max && iso > max), other = d.getMonth() !== vm - 1;
      const cls = ['bcd-day', other ? 'bcd-other' : '', iso === now ? 'bcd-today' : '', iso === sel ? 'bcd-sel' : '', off ? 'bcd-off' : ''].filter(Boolean).join(' ');
      cells.push(`<button type="button" class="${cls}" data-iso="${iso}" tabindex="${iso === focus ? 0 : -1}" aria-label="${format(iso)}${iso === now ? ', today' : ''}"${off ? ' aria-disabled="true"' : ''}${iso === sel ? ' aria-pressed="true"' : ''}>${d.getDate()}</button>`);
    }
    const prevOK = !min || toISO(vy, vm, 1) > min, nextOK = !max || isoOf(new Date(vy, vm, 0, 12)) < max;
    const yesterdayOK = (!min || today(-1) >= min) && (!max || today(-1) <= max), todayOK = (!min || now >= min) && (!max || now <= max);
    root.innerHTML = `${isPhone() ? '<div class="bcd-grab"></div>' : ''}
      <div class="bcd-head"><button type="button" class="bcd-nav" data-nav="-1" aria-label="Previous month"${prevOK ? '' : ' disabled'}>‹</button>
        <div class="bcd-title">${MONTHS[vm - 1]} ${vy}</div>
        <button type="button" class="bcd-nav" data-nav="1" aria-label="Next month"${nextOK ? '' : ' disabled'}>›</button></div>
      <div class="bcd-grid" role="grid">${DAYS.map(x => `<span class="bcd-dow">${x}</span>`).join('')}${cells.join('')}</div>
      <div class="bcd-foot"><button type="button" class="bcd-act" data-act="today"${todayOK ? '' : ' disabled'}>Today</button>
        <button type="button" class="bcd-act" data-act="yesterday"${yesterdayOK ? '' : ' disabled'}>Yesterday</button>
        ${api.opts.allowEmpty !== false ? '<button type="button" class="bcd-act bcd-clear" data-act="clear">Clear</button>' : ''}
        ${isPhone() ? '<button type="button" class="bcd-act bcd-done" data-act="close">Done</button>' : ''}</div>`;
  }
  function place() {
    if (!cal || cal.root.classList.contains('bcd-sheet')) return;
    const r = cal.api.input.closest('.bcd-wrap').getBoundingClientRect(), p = cal.root, h = p.offsetHeight, w = p.offsetWidth;
    const below = window.innerHeight - r.bottom;
    p.style.left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) + 'px';
    p.style.top = (below >= h + 8 || r.top < h + 8 ? r.bottom + 4 : r.top - h - 4) + 'px';
  }
  function moveFocus(iso) {
    const { api } = cal, min = bound(api.opts.min), max = bound(api.opts.max);
    if (min && iso < min) iso = min; if (max && iso > max) iso = max;
    cal.focus = iso; cal.view = iso.slice(0, 7); render(); place();
    cal.root.querySelector('.bcd-day[tabindex="0"]')?.focus({ preventScroll: true });
  }
  function shiftMonth(n) {
    const d = dateOf(cal.focus), day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n);
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
    moveFocus(isoOf(d));
  }
  document.addEventListener('mousedown', e => { if (cal && !cal.root.contains(e.target) && !cal.api.input.closest('.bcd-wrap').contains(e.target)) { const a = cal.api; closeCal(); a.commit(); } }, true);
  document.addEventListener('click', e => {
    if (!cal || !cal.root.contains(e.target)) return;
    const day = e.target.closest('.bcd-day'), nav = e.target.closest('.bcd-nav'), act = e.target.closest('.bcd-act');
    if (day && day.getAttribute('aria-disabled') !== 'true') choose(day.dataset.iso);
    else if (nav && !nav.disabled) { const [y, m] = cal.view.split('-').map(Number); const d = new Date(y, m - 1 + Number(nav.dataset.nav), 1, 12); cal.view = isoOf(d).slice(0, 7); render(); place(); }
    else if (act && !act.disabled) {
      if (act.dataset.act === 'today') choose(today());
      else if (act.dataset.act === 'yesterday') choose(today(-1));
      else if (act.dataset.act === 'close') closeCal(true);
      else { const api = cal.api; closeCal(true); api.input.value = ''; api.commit(); api.input.dispatchEvent(new Event('input', { bubbles: true })); api.input.dispatchEvent(new Event('change', { bubbles: true })); }
    }
  });
  document.addEventListener('keydown', e => {
    if (!cal) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); closeCal(true); return; }
    if (!cal.root.contains(e.target) || !e.target.classList.contains('bcd-day')) return;
    const k = e.key, f = cal.focus, wd = dateOf(f).getDay();
    const map = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -wd, End: 6 - wd };
    if (k in map) { e.preventDefault(); moveFocus(addDays(f, map[k])); }
    else if (k === 'PageUp' || k === 'PageDown') { e.preventDefault(); shiftMonth(k === 'PageUp' ? -1 : 1); }
    else if (k === 'Enter' || k === ' ') { e.preventDefault(); if (e.target.getAttribute('aria-disabled') !== 'true') choose(e.target.dataset.iso); }
    else if (k === 'Tab') { e.preventDefault(); closeCal(true); }
  }, true);
  window.addEventListener('resize', () => closeCal());
  window.addEventListener('scroll', e => { if (cal && !cal.root.contains(e.target)) place(); }, true);

  window.BCDate = {
    attach, parse, format, today,
    getISO: el => (el && el._bcdate ? el._bcdate.getISO() : parse(el && el.value) || ''),
    setISO: (el, iso) => { if (!el) return; if (el._bcdate) el._bcdate.setISO(iso); else el.value = format(iso); },
    isOpen: () => !!cal, close: () => closeCal(),
  };
})();
