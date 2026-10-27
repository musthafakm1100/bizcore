/* BizCore V270.4.5 — mobile zoom.
   1. The app frame never zooms: the viewport tag stops Android pinch / focus zoom; iPhone Safari ignores the pinch
      limit, so its pinch gesture and two-finger moves are stopped here (css/mobile-zoom.css adds touch-action).
   2. Document pages (.qdoc-sheet, .dn-a4) zoom on their own: pinch, double-tap (Fit → 100% → 200% → Fit),
      Ctrl + wheel / trackpad pinch, and the bar "−  % +  Fit". One finger pans with normal scrolling.
   The fit code (js/responsive.js fitDocuments, js/app.js dnFitA4) calls BCDocZoom.fit(doc, base) with the
   fit-to-width scale; 100% = printed A4. Nothing is stored; nothing goes into Print / PDF. */
(function () {
  'use strict';
  /* ── 1. frame guard ── */
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(t =>
    document.addEventListener(t, e => e.preventDefault(), { passive: false }));
  document.addEventListener('touchmove', e => { if (e.touches && e.touches.length > 1 && e.cancelable) e.preventDefault(); }, { passive: false });

  /* ── 2. document zoom ── */
  const MAX = 4, STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4];
  const S = new WeakMap();
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  function vScroller(el) {
    for (let n = el; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
      const oy = getComputedStyle(n).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight + 1) return n;
    }
    return document.scrollingElement || document.documentElement;
  }
  /** Every document page is A4: 210 mm = 793.7 CSS px at 100%. The page is held at that width (lock) so a zoom
      enlarges it instead of squeezing its content into the same space (the desktop pages were fluid). */
  const A4 = 210 * 96 / 25.4;
  function lock(doc) {
    if (doc._bczLocked) return;
    [['width', '210mm'], ['min-width', '210mm'], ['max-width', 'none'], ['flex', '0 0 auto'], ['box-sizing', 'border-box']]
      .forEach(([k, v]) => doc.style.setProperty(k, v, 'important'));
    doc._bczLocked = true;
  }
  function natural(doc) { lock(doc); return A4; }
  /** Set the scale. anchor = {px, py, cx, cy}: the page point (px, py, unscaled) goes under the screen point (cx, cy). */
  function apply(st, scale, anchor) {
    const { doc, host } = st;
    st.scale = clamp(scale, st.min, MAX);
    lock(doc);
    doc.style.zoom = Math.abs(st.scale - 1) < 0.001 ? '' : String(+st.scale.toFixed(4));
    const wide = doc.getBoundingClientRect().width > host.clientWidth + 1;
    if (wide) { host.style.setProperty('overflow-x', 'auto', 'important'); host.style.setProperty('justify-content', 'flex-start', 'important'); }
    else { host.style.removeProperty('overflow-x'); host.style.removeProperty('justify-content'); }
    if (anchor) {
      const r = doc.getBoundingClientRect();
      host.scrollLeft += r.left + anchor.px * st.scale - anchor.cx;
      const vs = vScroller(host);
      vs.scrollTop += r.top + anchor.py * st.scale - anchor.cy;
    }
    bar(st);
  }
  function anchorAt(st, cx, cy) {
    const r = st.doc.getBoundingClientRect();
    return { px: (cx - r.left) / st.scale, py: (cy - r.top) / st.scale, cx, cy };
  }
  function visibleRect(st) {
    const h = st.host.getBoundingClientRect(), v = vScroller(st.host);
    const vr = (v === document.scrollingElement || v === document.documentElement) ? { left: 0, top: 0, right: innerWidth, bottom: innerHeight } : v.getBoundingClientRect();
    return { left: Math.max(h.left, vr.left), top: Math.max(h.top, vr.top), right: Math.min(h.right, vr.right), bottom: Math.min(h.bottom, vr.bottom) };
  }
  function centreAnchor(st) {
    const r = visibleRect(st);
    return anchorAt(st, (r.left + r.right) / 2, (r.top + r.bottom) / 2);
  }
  function step(st, dir) {
    const s = st.scale;
    let next = dir > 0 ? STEPS.find(x => x > s + 0.005) : [...STEPS].reverse().find(x => x < s - 0.005);
    if (next == null) next = dir > 0 ? MAX : st.min;
    if (dir < 0 && st.base < s - 0.005 && next < st.base) next = st.base;   // stop at Fit on the way down
    apply(st, next, centreAnchor(st));
  }
  function fitNow(st) { apply(st, st.base); const v = vScroller(st.host); st.host.scrollLeft = 0; void v; }
  function cycle(st, cx, cy) {
    const s = st.scale;
    const next = s >= 1.95 ? st.base : (s < 0.99 ? 1 : 2);
    if (Math.abs(next - st.base) < 0.005) { fitNow(st); return; }
    apply(st, next, anchorAt(st, cx, cy));
  }

  /* ── the bar ── */
  function bar(st) {
    const m = st.host.closest('.modal') || st.host.closest('.modal-overlay'); if (!m) return;
    let b = m._bczBar;
    if (!b || !b.isConnected) {
      b = document.createElement('div'); b.className = 'bcz-bar'; b.setAttribute('role', 'toolbar'); b.setAttribute('aria-label', 'Document zoom');
      b.innerHTML = '<button type="button" data-z="out" aria-label="Zoom out" title="Zoom out"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/></svg></button>'
        + '<span class="bcz-pct" aria-live="polite">100%</span>'
        + '<button type="button" data-z="in" aria-label="Zoom in" title="Zoom in"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>'
        + '<i class="bcz-sep" aria-hidden="true"></i>'
        + '<button type="button" data-z="fit" class="bcz-fit" title="Fit the page"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 4h4v4M14 10l6-6M8 20H4v-4M4 20l6-6"/></svg><span>Fit</span></button>';
      b.addEventListener('click', e => {
        const k = e.target.closest('[data-z]'); const cur = b._st; if (!k || !cur || !cur.doc.isConnected) return;
        e.stopPropagation();
        if (k.dataset.z === 'in') step(cur, 1); else if (k.dataset.z === 'out') step(cur, -1); else fitNow(cur);
      });
      if (getComputedStyle(m).position === 'static') m.style.position = 'relative';
      m.appendChild(b); m._bczBar = b;
      const upd = () => place(b);
      m.addEventListener('scroll', upd, true);
      window.addEventListener('resize', upd);
    }
    b._st = st;
    b.querySelector('.bcz-pct').textContent = Math.round(st.scale * 100) + '%';
    b.querySelector('[data-z="out"]').disabled = st.scale <= st.min + 0.005;
    b.querySelector('[data-z="in"]').disabled = st.scale >= MAX - 0.005;
    b.querySelector('[data-z="fit"]').classList.toggle('on', Math.abs(st.scale - st.base) < 0.005);
    place(b);
  }
  function place(b) {
    const st = b._st;
    if (!st || !st.doc.isConnected) { b.hidden = true; return; }
    const m = b.parentElement, hostShown = st.host.offsetParent !== null && st.host.clientWidth > 0;
    const r = visibleRect(st);
    if (!hostShown || r.bottom - r.top < 90 || r.right - r.left < 180) { b.hidden = true; return; }
    b.hidden = false;
    const mr = m.getBoundingClientRect();
    const bw = b.offsetWidth || 190, bh = b.offsetHeight || 40;
    b.style.left = Math.round(r.right - bw - 12 - mr.left - m.clientLeft) + 'px';
    b.style.top = Math.round(r.bottom - bh - 12 - mr.top - m.clientTop) + 'px';
  }

  /* ── gestures ── */
  function bind(st) {
    const host = st.host;
    if (host._bczBound) { host._bczSt = st; return; }
    host._bczBound = true; host._bczSt = st; host.classList.add('bcz-host');
    const cur = () => host._bczSt;
    const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const mid = t => ({ x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 });
    let pinch = null, raf = 0, tap = null, lastTap = null;
    host.addEventListener('touchstart', e => {
      const s = cur(); if (!s || !s.doc.isConnected) return;
      if (e.touches.length === 2) {
        const c = mid(e.touches); pinch = { d: dist(e.touches) || 1, s: s.scale, a: anchorAt(s, c.x, c.y) }; tap = null; lastTap = null;
      } else if (e.touches.length === 1) tap = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now(), moved: false };
      else tap = null;
    }, { passive: true });
    host.addEventListener('touchmove', e => {
      const s = cur(); if (!s) return;
      if (pinch && e.touches.length === 2) {
        if (e.cancelable) e.preventDefault();
        const c = mid(e.touches), target = pinch.s * dist(e.touches) / pinch.d;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => apply(s, target, { px: pinch.a.px, py: pinch.a.py, cx: c.x, cy: c.y }));
      } else if (tap && e.touches.length === 1) {
        if (Math.hypot(e.touches[0].clientX - tap.x, e.touches[0].clientY - tap.y) > 10) tap.moved = true;
      }
    }, { passive: false });
    host.addEventListener('touchend', e => {
      const s = cur(); if (!s) return;
      if (e.touches.length < 2) pinch = null;
      if (e.touches.length === 0 && tap && !tap.moved && Date.now() - tap.t < 300) {
        const now = Date.now();
        if (lastTap && now - lastTap.t < 320 && Math.hypot(tap.x - lastTap.x, tap.y - lastTap.y) < 30) {
          lastTap = null; if (e.cancelable) e.preventDefault(); cycle(s, tap.x, tap.y);
        } else lastTap = { x: tap.x, y: tap.y, t: now };
      }
      if (e.touches.length === 0) tap = null;
    }, { passive: false });
    host.addEventListener('touchcancel', () => { pinch = null; tap = null; }, { passive: true });
    host.addEventListener('wheel', e => {
      if (!e.ctrlKey) return;
      const s = cur(); if (!s || !s.doc.isConnected) return;
      e.preventDefault();
      apply(s, s.scale * Math.exp(-e.deltaY * 0.002), anchorAt(s, e.clientX, e.clientY));
    }, { passive: false });
    if (window.ResizeObserver) new ResizeObserver(() => { const s = cur(); if (s && s.host.closest('.modal')?._bczBar) place(s.host.closest('.modal')._bczBar); }).observe(host);
  }

  /** Called by the fit code: base = the fit-to-width scale (1 when the page already fits). */
  function fit(doc, base) {
    if (!doc || !doc.parentElement) return;
    base = clamp(base || 1, 0.1, 1);
    let st = S.get(doc);
    if (st && st.host === doc.parentElement && Math.abs(st.base - base) < 0.002) { bar(st); return; }  // same width (e.g. the iPhone address bar): keep the user's zoom
    st = { doc, host: doc.parentElement, base, scale: base };
    st.min = Math.min(base, 0.5);
    S.set(doc, st); bind(st);
    apply(st, base);
  }
  window.BCDocZoom = { fit, natural, _state: doc => S.get(doc), _apply: (doc, s, a) => { const st = S.get(doc); if (st) apply(st, s, a); }, _cycle: (doc, x, y) => { const st = S.get(doc); if (st) cycle(st, x, y); } };
})();
