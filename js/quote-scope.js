/* ═══════════════════════════════════════════════════════════════
   BizCore V271.6 — scope of work on service / contracting quotations (agreed 9–10 Nov 2026, mockups 6–13)
   ─ A scope line = a short TITLE (printed on SO / DN / Invoice) + its SCOPE (formatted text, any length, printed only on
     the quotation). The scope is the line's own copy: copied from the RFQ, a text block, a service's standard scope or an
     earlier quotation — never linked, so issued quotations never change.
   ─ Storage (Firebase free tier): the long scope text is NOT in the quotation record (registers load those at start-up).
     It lives in one body record per quotation, quotations/{id}/bodies/main { qid, qno, scopes: { scopeKey: html } }, read
     only when the quotation is opened, printed, revised or duplicated. Stored once (HTML), at most 30,000 characters a line.
   ─ Work category: every priced line of a Services quotation carries one (Master Data → Categories, service type);
     a default for the quotation (from the RFQ's optional Work category) fills new lines.
   ─ Text Blocks (Master Data → Proposal Text): reusable paragraphs — Insert block (new heading + note, note under the
     selected line, or the Remarks tab), Save as block. Loaded only when the picker or the tab opens.
   ─ Print: a long scope prints in full under its line, or as "Annexure A — Scope of Work" after the quotation
     (Settings → Quotation Print: Automatic / Always inline / Always as annexure; changeable at each print).
   ─ Job: the accepted scope is copied to the Job when it is created (jobs/{id}/scope/main) — frozen.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const LINE_MAX = 30000;                      // characters of formatted text per scope (≈ 4–5 printed pages)
  const R = () => window.BCRich;
  const docId = id => String(id).replace(/\//g, '_');
  const newKey = () => 'sk' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const toastMsg = (m, t, title) => { if (typeof showToast === 'function') showToast(m, t || 'info', title || ''); };
  const dirty = () => { if (typeof markDirty === 'function') markDirty('quote-modal'); };
  const svcTemplate = () => typeof currentQuoteType !== 'undefined' && currentQuoteType === 'contracting';
  const can = (m, a) => typeof window.bcCan === 'function' ? window.bcCan(m, a) : true;
  const who = () => { try { const u = window.currentUser || {}; return String(u.displayName || u.name || u.email || ''); } catch (_) { return ''; } };

  /* ═════════ 1. body records (the scope text) ═════════ */
  const scopeCache = new Map();     // scopeKey → html (keys are unique across quotations: a copy always gets new keys)
  const bodyLoaded = new Set();     // quotation ids whose body record has been read
  const needsBody = q => !!(q && q.scopeBody && !bodyLoaded.has(q.id));
  async function loadBody(q) {
    if (!q || !q.scopeBody || bodyLoaded.has(q.id)) return true;
    if (!window.FB || !FB.fbReadDoc) return false;
    try {
      const d = await FB.fbReadDoc('quotations', docId(q.id), 'bodies', 'main');
      if (d && d.scopes && typeof d.scopes === 'object') Object.entries(d.scopes).forEach(([k, v]) => scopeCache.set(k, String(v || '')));
      bodyLoaded.add(q.id);
      return true;
    } catch (e) { console.warn('[BizCore] scope text not loaded', q.qno || q.id, e && e.message); return false; }
  }
  function loadFailed(q) { toastMsg('The scope text of ' + ((q && q.qno) || 'this quotation') + ' could not be loaded (no connection?). Try again when online.', 'error'); }
  const scopeOf = it => (it && it.scopeKey ? scopeCache.get(it.scopeKey) || '' : '');
  const plain = html => (html && R() ? R().toText(html) : String(html || '').replace(/<[^>]*>/g, ' ')).trim();
  const previewOf = html => plain(html).replace(/\s+/g, ' ').slice(0, 180);
  /** a line copied into another quotation (revision / duplicate): its scope travels as text, the key is dropped */
  function copyItem(it) {
    const c = JSON.parse(JSON.stringify(it || {}));
    if (c.scopeKey) { c.scopeHtml = scopeOf(it); delete c.scopeKey; }
    return c;
  }
  /** a whole quotation copied without opening it (Duplicate): new keys + the scope map for its own body record */
  function rekeyItems(items) {
    const scopes = {};
    (items || []).forEach(it => { if (!it || !it.scopeKey) return; const h = scopeCache.get(it.scopeKey) || ''; const k = newKey(); it.scopeKey = k; if (h) { scopes[k] = h; scopeCache.set(k, h); } });
    return scopes;
  }

  /* ═════════ 2. work categories ═════════ */
  function serviceCats() {
    if (typeof loadCategoryMaster === 'function' && (typeof categoryMaster === 'undefined' || !categoryMaster.length)) { try { loadCategoryMaster(); } catch (_) {} }
    return (typeof categoryMaster !== 'undefined' ? categoryMaster : []).filter(c => c.type === 'service' && c.active !== false).map(c => c.name).sort((a, b) => a.localeCompare(b));
  }
  const defaultCat = () => ($('f-wcat') && $('f-wcat').value) || '';
  const catsRequired = () => svcTemplate() && !window.__bcTestNoCats;
  function addCategory(name) {
    const n = String(name || '').trim(); if (!n) return '';
    if (typeof categoryMaster === 'undefined') return n;
    const hit = categoryMaster.find(c => c.name.toLowerCase() === n.toLowerCase());
    if (hit) { if (hit.type !== 'service') toastMsg('"' + hit.name + '" is a goods category — choose a service category.', 'warning'); else { hit.active = true; if (typeof persistCategoryMaster === 'function') persistCategoryMaster(); } return hit.type === 'service' ? hit.name : ''; }
    categoryMaster.push({ id: 'cat-' + Date.now().toString(36) + '-' + n.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30), name: n, type: 'service', active: true });
    if (typeof persistCategoryMaster === 'function') persistCategoryMaster();
    return n;
  }
  /* a small menu (category chips) */
  let menu = null;
  function closeMenu() { if (menu) { menu.remove(); menu = null; } }
  document.addEventListener('mousedown', e => { if (menu && !menu.contains(e.target) && !e.target.closest('.qt-wcat')) closeMenu(); }, true);
  window.addEventListener('scroll', e => { if (menu && !menu.contains(e.target)) closeMenu(); }, true);
  function openCatMenu(anchor, cur, onPick) {
    closeMenu();
    const cats = serviceCats();
    menu = document.createElement('div'); menu.className = 'pr-pop qs-catmenu'; menu.setAttribute('role', 'listbox');
    menu.innerHTML = `<div class="qs-cm-h">Work category</div><div class="qs-cm-sw"><input type="search" class="qs-cm-s" placeholder="Type to search…" aria-label="Search work categories" autocomplete="off"></div><div class="qs-cm-l">${cats.map(n => `<button type="button" class="pr-mi${n === cur ? ' qt-on' : ''}" data-cat="${esc(n)}"><span>${esc(n)}</span>${n === cur ? '<span class="pr-k">✓</span>' : ''}</button>`).join('') || '<div class="qs-cm-e">No service categories yet.</div>'}</div><div class="pr-sepm"></div><button type="button" class="pr-mi" data-cat="__new"><span>+ New category…</span></button>`;
    document.body.appendChild(menu);
    const b = anchor.getBoundingClientRect(), h = menu.offsetHeight, w = menu.offsetWidth;
    menu.style.left = Math.max(8, Math.min(b.left, window.innerWidth - w - 8)) + 'px';
    menu.style.top = (b.bottom + h + 6 < window.innerHeight ? b.bottom + 4 : Math.max(8, b.top - h - 4)) + 'px';
    menu.addEventListener('click', e => {
      const x = e.target.closest('[data-cat]'); if (!x) return;
      const v = x.dataset.cat, typed = (menu && menu.querySelector('.qs-cm-s')?.value || '').trim(); closeMenu();
      if (v === '__new') { askText({ title: 'New Work Category', label: 'Category name (service)', placeholder: 'e.g. Partition & Ceiling Works', ok: 'Add Category', value: typed }).then(n => { const got = n && addCategory(n); if (got) onPick(got); }); return; }
      onPick(v);
    });
    // V271.10: type to search — the list narrows as you type; Enter picks the first match (or offers a new category); ↓ / ↑ move
    const sInp = menu.querySelector('.qs-cm-s'), items = () => [...menu.querySelectorAll('.qs-cm-l [data-cat]')].filter(b => !b.hidden);
    sInp.addEventListener('input', () => {
      const t = sInp.value.trim().toLowerCase();
      menu.querySelectorAll('.qs-cm-l [data-cat]').forEach(b => { b.hidden = !!t && !b.dataset.cat.toLowerCase().includes(t); });
      let none = menu.querySelector('.qs-cm-none');
      if (!items().length && t) { if (!none) { none = document.createElement('div'); none.className = 'qs-cm-e qs-cm-none'; menu.querySelector('.qs-cm-l').appendChild(none); } none.textContent = 'No match — Enter adds "' + sInp.value.trim() + '" as a new category.'; }
      else if (none) none.remove();
    });
    menu.addEventListener('keydown', e => {
      const list = items(), i = list.indexOf(document.activeElement);
      if (e.key === 'Escape') { e.preventDefault(); closeMenu(); anchor.focus && anchor.focus(); return; }
      if (e.target === sInp && e.key === 'Enter') { e.preventDefault(); const first = list[0]; if (first) { const v = first.dataset.cat; closeMenu(); onPick(v); } else if (sInp.value.trim()) menu.querySelector('[data-cat="__new"]').click(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); (list[i + 1] || (i < 0 ? list[0] : list[list.length - 1]))?.focus({ preventScroll: false }); }
      if (e.key === 'ArrowUp') { e.preventDefault(); if (i <= 0) sInp.focus(); else list[i - 1].focus({ preventScroll: false }); }
      if (e.key.length === 1 && e.target !== sInp && !e.ctrlKey && !e.altKey && !e.metaKey) { sInp.focus(); }   // typing on a button goes to the search box
    });
    setTimeout(() => menu && sInp.focus({ preventScroll: true }), 0);
  }
  function paintCatChip(btn, val, { missing = false, other = false } = {}) {
    if (!btn) return;
    btn.classList.toggle('is-missing', !val && missing);
    btn.classList.toggle('is-other', !!val && other);
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10"/></svg><span>${val ? esc(val) : 'Work category…'}</span><i aria-hidden="true">▾</i>`;
    btn.title = val ? 'Work category — click to change' : 'Choose the work category of this line (required)';
  }
  function paintLineCat(tr) {
    const b = tr && tr.querySelector('.qt-lmeta .qt-wcat'); if (!b) return;
    const v = tr.dataset.wcat || '', d = defaultCat();
    // V271.7: a line that follows the quotation's default shows only a small grey "Category: default" (click to change)
    if (v && d && v === d && tr.dataset.catMissing !== '1') {
      b.classList.remove('is-missing', 'is-other'); b.classList.add('is-def');
      b.innerHTML = '<span>Category: default</span><i aria-hidden="true">▾</i>'; b.title = 'Follows the quotation\'s default (' + v + ') — click to give this line its own category';
      return;
    }
    b.classList.remove('is-def');
    paintCatChip(b, v, { missing: catsRequired() && tr.dataset.catMissing === '1', other: !!(v && d && v !== d) });
  }
  function setLineCat(tr, v, own) {
    tr.dataset.wcat = v || '';
    if (own) tr.dataset.wcatOwn = v && v !== defaultCat() ? '1' : '';
    if (v) delete tr.dataset.catMissing;
    paintLineCat(tr); paintCatTotals();
  }
  /* the quotation's default (Items toolbar of the Services template) */
  function ensureDefaultControl() {
    const host = $('service-add-btn'); if (!host || $('qs-wdef')) return;
    const wrap = document.createElement('span'); wrap.className = 'qs-wdef'; wrap.id = 'qs-wdef';
    wrap.innerHTML = `<span class="qs-wdef-l" title="Default work category — new lines take it; a line may have its own">Category <b class="qt-req">*</b></span><button type="button" class="qt-wcat qs-wdef-b" id="qs-wdef-b" aria-label="Default work category"></button><input type="hidden" id="f-wcat">`;
    host.appendChild(wrap);
    $('qs-wdef-b').addEventListener('click', e => { e.preventDefault(); openCatMenu(e.currentTarget, defaultCat(), v => setDefaultCat(v, true)); });
  }
  function setDefaultCat(v, byUser) {
    const inp = $('f-wcat'); if (!inp) return;
    const old = inp.value; inp.value = v || '';
    if (v) delete inp.dataset.missing;
    paintCatChip($('qs-wdef-b'), v, { missing: inp.dataset.missing === '1' });
    // lines that still follow the default (not chosen on their own) take the new one
    rows().forEach(tr => { if (!tr.dataset.wcatOwn && (!tr.dataset.wcat || tr.dataset.wcat === old)) setLineCat(tr, v, false); else paintLineCat(tr); });
    if (byUser) dirty();
  }

  /* ═════════ 3. the scope line on the Quotation Entry ═════════ */
  const rows = () => [...document.querySelectorAll('#items-tbody tr[data-line-type="item"][data-row-kind="scope"]')];
  const SRC = { rfq: 'Copied from RFQ', block: 'From block', svc: 'Service standard scope', prev: 'From', est: 'From the estimate' };
  function srcLabel(s) { if (!s) return ''; const [k, ref] = String(s).split(':'); return k === 'prev' ? 'From ' + (ref || 'earlier quotation') : (SRC[k] || '') + (k !== 'block' && ref ? ' · ' + ref : ''); }
  /** called by addItemRow for every scope row: title, category chip, tags, the scope editor */
  function rowInit(tr, item) {
    item = item || {};
    let title = String(item.desc || ''), html = '';
    if (item.scopeHtml != null) html = String(item.scopeHtml || '');
    else if (item.scopeKey) { html = scopeOf(item); tr.dataset.scopeKey = item.scopeKey; }
    else if (item.descHtml || /\n/.test(title)) {
      // a scope line saved before V271.6 (one formatted box): the first line becomes the title, all of it the scope
      html = item.descHtml && R() ? R().clean(item.descHtml) : (R() ? R().plainToHtml(title) : esc(title));
      title = plain(html).split('\n').map(s => s.replace(/^[•◦▪\d.)a-z\s-]+/i, '').trim()).find(Boolean) || '';
      title = title.length > 120 ? title.slice(0, 117) + '…' : title;
    } else if (item.specs) html = R() ? R().plainToHtml(String(item.specs)) : esc(String(item.specs));   // a product-shaped line on a Services quotation: its specifications become the scope
    const t = tr.querySelector('[data-f="desc"]'); if (t) t.value = title;
    if (item.scopeSrc) tr.dataset.scopeSrc = item.scopeSrc;
    if (item.scopeEdited) tr.dataset.scopeEdited = '1';
    const meta = tr.querySelector('.qt-lmeta');
    if (meta) meta.innerHTML = `<button type="button" class="qt-wcat" aria-label="Work category"></button><span class="qs-tags"></span><span class="qs-sp"></span><button type="button" class="qs-exp" title="Open the full editor for a long scope"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>Expand</button>`;
    const ed = tr.querySelector('[data-f="scope"]');
    if (ed && R()) R().make(ed, { html, placeholder: 'Scope of work — what is included, specifications, deliverables… (Format bar above)' });
    const v = item.workCat != null ? String(item.workCat || '') : (item.lineType === 'item' ? '' : defaultCat());
    tr.dataset.wcat = v; if (v && item.workCat && defaultCat() && v !== defaultCat()) tr.dataset.wcatOwn = '1';
    paintLineCat(tr); paintTags(tr);
    setTimeout(() => paintLong(tr), 0);
  }
  function paintTags(tr) {
    const host = tr.querySelector('.qs-tags'); if (!host) return;
    const s = tr.dataset.scopeSrc;
    host.innerHTML = (s ? `<span class="qs-tag">${esc(srcLabel(s))}</span>` : '') + (s && tr.dataset.scopeEdited === '1' ? '<span class="qs-tag qs-tag-ed">Edited</span>' : '');
  }
  function paintLong(tr) {
    const w = tr.querySelector('.qt-sbw'), ed = tr.querySelector('[data-f="scope"]'), more = tr.querySelector('.qt-smore'); if (!w || !ed || !more) return;
    const open = w.classList.contains('is-open');
    w.classList.remove('is-long');
    const long = ed.scrollHeight > 78 && plain(ed.innerHTML).length > 0;
    w.classList.toggle('is-long', long);
    more.hidden = !long || ed.contains(document.activeElement);
    const n = plain(ed.innerHTML).split('\n').filter(x => x.trim()).length;
    more.textContent = open ? 'Show less' : `Show all (${n} line${n === 1 ? '' : 's'})`;
  }
  // one listener for all rows
  document.addEventListener('click', e => {
    const c = e.target.closest && e.target.closest('#items-tbody .qt-lmeta .qt-wcat');
    if (c) { e.preventDefault(); const tr = c.closest('tr'); openCatMenu(c, tr.dataset.wcat || '', v => { setLineCat(tr, v, true); dirty(); }); return; }
    const x = e.target.closest && e.target.closest('#items-tbody .qs-exp');
    if (x) { e.preventDefault(); openEditor(x.closest('tr')); return; }
    const m = e.target.closest && e.target.closest('#items-tbody .qt-smore');
    if (m) { e.preventDefault(); const w = m.closest('.qt-sbw'); w.classList.toggle('is-open'); paintLong(m.closest('tr')); }
  });
  document.addEventListener('input', e => {
    const ed = e.target.closest && e.target.closest('#items-tbody [data-f="scope"]'); if (!ed) return;
    const tr = ed.closest('tr'); if (tr.dataset.scopeSrc && tr.dataset.scopeEdited !== '1') { tr.dataset.scopeEdited = '1'; paintTags(tr); }
  }, true);
  document.addEventListener('focusout', e => { const ed = e.target.closest && e.target.closest('#items-tbody [data-f="scope"]'); if (ed) setTimeout(() => paintLong(ed.closest('tr')), 0); }, true);
  document.addEventListener('focusin', e => {
    const tr = e.target.closest && e.target.closest('#items-tbody tr'); if (tr) lastRow = tr;
    const ed = e.target.closest && e.target.closest('#items-tbody [data-f="scope"]'); if (ed) { const m = ed.closest('tr').querySelector('.qt-smore'); if (m) m.hidden = true; }
  }, true);
  let lastRow = null;
  const selectedRow = () => (lastRow && lastRow.isConnected ? lastRow : null);

  /* the scope box spans the line's full width (under Qty … Line Total) — measured from the header */
  function measure() {
    const t = $('qt-items-table'); if (!t) return;
    const a = t.querySelector('thead .qt-th-scope'), b = t.querySelector('thead .qt-th-tot');
    if (!a || !b || !a.offsetParent) return;
    const w = Math.round(b.getBoundingClientRect().right - a.getBoundingClientRect().left - 14);
    if (w > 120) t.style.setProperty('--qt-sbw', w + 'px');
  }
  let ro = null;
  function watchWidth() {
    const t = $('qt-items-table'); if (!t || ro || typeof ResizeObserver === 'undefined') return;
    ro = new ResizeObserver(() => { measure(); });
    ro.observe(t);
    const hd = $('items-thead'); if (hd) new MutationObserver(() => setTimeout(measure, 0)).observe(hd, { childList: true });
  }

  /* ── reading a row for saving ── */
  function bodyHtml(ed) {
    if (!ed || !R()) return '';
    try { const c = ed.cloneNode(true); const h = R().clean(c.innerHTML); return plain(h) ? h : ''; } catch (_) { return ''; }
  }
  /** fills the saved line from its row; adds the scope to scopes */
  function lineFromRow(tr, line, scopes) {
    const html = bodyHtml(tr.querySelector('[data-f="scope"]'));
    let title = String(line.desc || '').trim();
    if (!title && html) title = (plain(html).split('\n').find(x => x.trim()) || '').trim().slice(0, 160);
    line.desc = title;
    delete line.descHtml;
    if (tr.dataset.wcat) line.workCat = tr.dataset.wcat;
    if (html) {
      const k = tr.dataset.scopeKey || newKey();
      tr.dataset.scopeKey = k;
      scopes[k] = html;
      line.scopeKey = k; line.scopePreview = previewOf(html);
    }
    if (tr.dataset.scopeSrc) line.scopeSrc = tr.dataset.scopeSrc;
    if (tr.dataset.scopeEdited === '1') line.scopeEdited = true;
  }
  /** first problem before saving → { msg, el } or null */
  function validate() {
    const all = rows();
    for (let i = 0; i < all.length; i++) {
      const tr = all[i], html = bodyHtml(tr.querySelector('[data-f="scope"]'));
      if (html.length > LINE_MAX) return { msg: `Line ${tr.querySelector('.qt-n')?.textContent || i + 1}: the scope of work is too long (${Math.round(html.length / 1000)} of ${LINE_MAX / 1000} thousand characters). Shorten it or split it over two lines.`, el: tr.querySelector('[data-f="scope"]'), tr };
    }
    // one body record per quotation — Firestore's limit is 1 MiB, keep well below it
    const total = all.reduce((s, tr) => s + bodyHtml(tr.querySelector('[data-f="scope"]')).length, 0);
    if (total > 700000) return { msg: `The scope text of this quotation is too large in total (${Math.round(total / 1000)} thousand characters; the limit is 700). Move standard text to Remarks or shorten some lines.`, el: null };
    if (!catsRequired()) return null;
    const inp = $('f-wcat');
    if (inp && !inp.value) { inp.dataset.missing = '1'; paintCatChip($('qs-wdef-b'), '', { missing: true }); return { msg: 'Choose the default work category (Items toolbar) — every priced line needs a work category.', el: $('qs-wdef-b') }; }
    for (const tr of all) {
      if (!tr.dataset.wcat) { tr.dataset.catMissing = '1'; paintLineCat(tr); return { msg: `Choose the work category of line ${tr.querySelector('.qt-n')?.textContent || ''}.`, el: tr.querySelector('.qt-lmeta .qt-wcat'), tr }; }
    }
    return null;
  }
  /** quotation-level fields */
  function quoteFields(scopes, prevQ) {
    const out = {};
    const wc = defaultCat(); if (svcTemplate() && wc) out.workCategory = wc;
    if (Object.keys(scopes || {}).length) out.scopeBody = true;
    if (window._qsRfqUsed) out.rfqScopeUsed = true;
    return out;
  }
  /** saves the quotation; with its body record in the same commit when it has (or had) scope text. → true / false */
  async function persist(q, scopes, prevQ) {
    const n = Object.keys(scopes || {}).length;
    if (n) q.scopeBody = true; else delete q.scopeBody;
    if (!n && !(prevQ && prevQ.scopeBody)) return saveQuotations();
    if (!window.FB || !FB.fbSaveRecordWith) return saveQuotations();
    const body = { qid: String(q.id), qno: q.qno || '', scopes: scopes || {}, updated: new Date().toISOString() };
    const ok = await FB.fbSaveRecordWith('quotations', q, [{ path: ['quotations', docId(q.id), 'bodies', 'main'], data: body }]);
    if (!ok) return false;
    Object.entries(scopes || {}).forEach(([k, v]) => scopeCache.set(k, v));
    bodyLoaded.add(q.id);
    const rest = await saveQuotations();   // other quotations changed with it (e.g. a revision supersedes the older one)
    return rest !== false;
  }

  /* ═════════ 4. RFQ requirements → starting scope (copied once) ═════════ */
  window._qsRfqUsed = false;
  function rfqOfOpen(q) {
    const id = (q && q.rfqId) || document._pendingRFQId || null;
    return id && typeof rfqs !== 'undefined' ? rfqs.find(r => String(r.id) === String(id)) || null : null;
  }
  let openQ = null;
  function paintBanner() {
    const panel = document.querySelector('#quote-modal .qt-panel[data-panel="items"]'); if (!panel) return;
    let bn = $('qs-banner');
    const r = rfqOfOpen(openQ), text = r && String(r.desc || '').trim();
    if (!svcTemplate() || !text) { if (bn) bn.hidden = true; return; }
    if (!bn) { bn = document.createElement('div'); bn.id = 'qs-banner'; bn.className = 'qs-banner'; panel.insertBefore(bn, panel.firstChild); }
    bn.hidden = false;
    const no = esc(r.rfqNo || 'the RFQ');
    bn.innerHTML = window._qsRfqUsed
      ? `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/></svg><span><b>Scope copied from ${no}</b> — rewrite it freely; the RFQ keeps the customer's original.</span><span class="qs-sp"></span><button type="button" class="qs-lnk" data-qs="orig">View customer's original</button>`
      : `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/></svg><span><b>${no}</b> has the customer's requirements.</span><span class="qs-sp"></span><button type="button" class="qs-lnk" data-qs="orig">View</button><button type="button" class="pr-btn pr-pri qs-use" data-qs="use">Use as starting scope</button>`;
  }
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('#qs-banner [data-qs], .qs-ed [data-qs="orig"]'); if (!b) return;
    e.preventDefault();
    if (b.dataset.qs === 'orig') showOriginal();
    else if (b.dataset.qs === 'use') useRfqScope();
  });
  function showOriginal() {
    const r = rfqOfOpen(openQ); if (!r) return;
    dialog({ title: "Customer's Requirements — " + esc(r.rfqNo || 'RFQ'), html: `<p class="qs-dlg-sub">As entered on the RFQ${r.date ? ' received ' + esc(typeof fmtDate === 'function' ? fmtDate(r.date) : r.date) : ''}. Kept unchanged — the record of what was asked.</p><div class="qs-orig">${esc(r.desc || '')}</div>`, buttons: [{ text: 'Close', default: true }] });
  }
  function useRfqScope() {
    const r = rfqOfOpen(openQ); if (!r || !R()) return;
    const sel = selectedRow();
    let tr = sel && sel.dataset.rowKind === 'scope' && !plain(sel.querySelector('[data-f="scope"]')?.innerHTML) ? sel : rows().find(x => !plain(x.querySelector('[data-f="scope"]')?.innerHTML));
    if (!tr) { tr = typeof addServiceRow === 'function' ? addServiceRow() : null; if (typeof qtAfterRowsChange === 'function') qtAfterRowsChange(); }
    if (!tr) return;
    const ed = tr.querySelector('[data-f="scope"]');
    ed.innerHTML = R().plainToHtml(String(r.desc || '').trim());
    ed.dispatchEvent(new Event('input', { bubbles: true }));
    tr.dataset.scopeSrc = 'rfq:' + (r.rfqNo || ''); tr.dataset.scopeEdited = '';
    const t = tr.querySelector('[data-f="desc"]'); if (t && !t.value.trim()) t.value = String(r.ref || '').trim() || (String(r.desc).split('\n').find(x => x.trim()) || '').trim().slice(0, 100);
    paintTags(tr); paintLong(tr);
    window._qsRfqUsed = true; paintBanner(); dirty();
    tr.scrollIntoView({ block: 'nearest' }); setTimeout(() => ed.focus(), 30);
    toastMsg('The customer\'s requirements are now the scope of line ' + (tr.querySelector('.qt-n')?.textContent || '') + ' — rewrite them in your own words.', 'success', 'Scope copied');
  }

  /* ═════════ 5. dialogs ═════════ */
  let dlgEl = null;
  function closeDialog() { if (!dlgEl) return; dlgEl.dim.remove(); dlgEl.box.remove(); dlgEl = null; }
  function dialog({ title, html, buttons, wide }) {
    closeDialog();
    const dim = document.createElement('div'); dim.className = 'pr-dim qs-dim';
    const box = document.createElement('div'); box.className = 'pr-cf qt-cf qs-cf' + (wide ? ' qs-wide' : '');
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', String(title).replace(/<[^>]*>/g, ''));
    box.innerHTML = `<h3>${title}</h3>${html || ''}<div class="pr-cf-bt"></div>`;
    const bt = box.querySelector('.pr-cf-bt');
    (buttons || []).forEach(b => { const el = document.createElement('button'); el.type = 'button'; el.className = 'pr-btn ' + (b.cls || ''); el.textContent = b.text; el.addEventListener('click', () => { if (b.keep && b.action) { b.action(box); return; } closeDialog(); b.action && b.action(box); }); bt.appendChild(el); if (b.default) setTimeout(() => el.focus(), 0); });
    dim.addEventListener('mousedown', closeDialog);
    document.body.append(dim, box);
    dlgEl = { dim, box };
    return box;
  }
  function askText({ title, label, placeholder, ok, value }) {
    return new Promise(res => {
      const box = dialog({ title: esc(title), html: `<label class="qs-fl"><span>${esc(label)}</span><input type="text" class="qs-in" maxlength="80" value="${esc(value || '')}" placeholder="${esc(placeholder || '')}"></label>`, buttons: [{ text: 'Cancel', action: () => res('') }, { text: ok || 'OK', cls: 'pr-pri', action: b => res(b.querySelector('.qs-in').value.trim()) }] });
      const inp = box.querySelector('.qs-in'); setTimeout(() => inp.focus(), 30);
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); const v = inp.value.trim(); closeDialog(); res(v); } });
    });
  }
  // window capture: runs before the app's own Escape guard (document, capture), which would close the whole entry screen
  window.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (menu) { e.preventDefault(); e.stopImmediatePropagation(); closeMenu(); return; }
    if (dlgEl) { e.preventDefault(); e.stopImmediatePropagation(); closeDialog(); return; }
    if (picker) { e.preventDefault(); e.stopImmediatePropagation(); closePicker(); return; }
    if (edState) { e.preventDefault(); e.stopImmediatePropagation(); closeEditor(false); }
  }, true);

  /* ═════════ 6. the full editor (Expand) ═════════ */
  let edState = null;
  function closeEditor(apply) {
    if (!edState) return;
    const { tr, ov, ed, title } = edState;
    if (apply && tr.isConnected) {
      const t = tr.querySelector('[data-f="desc"]'); if (t) t.value = title.value;
      const le = tr.querySelector('[data-f="scope"]');
      if (le && le.innerHTML !== ed.innerHTML) { le.innerHTML = R() ? R().clean(ed.innerHTML) : ed.innerHTML; le.dispatchEvent(new Event('input', { bubbles: true })); }
      if (edState.cat !== tr.dataset.wcat) setLineCat(tr, edState.cat, true);
      paintTags(tr); setTimeout(() => paintLong(tr), 0); dirty();
      if (typeof calcTotals === 'function') calcTotals();
    }
    ov.remove(); edState = null;
  }
  function openEditor(tr) {
    if (!tr || !R()) return;
    closeEditor(false);
    const n = tr.querySelector('.qt-n')?.textContent || '', src = tr.dataset.scopeSrc || '';
    const qty = tr.querySelector('[data-quote-qty]')?.value || '', uom = tr.querySelector('select')?.value || '', rate = tr.querySelector('[data-quote-price]')?.value || '';
    const isRfq = src.startsWith('rfq');
    const ov = document.createElement('div'); ov.className = 'qs-ov';
    ov.innerHTML = `<div class="qs-ed" role="dialog" aria-modal="true" aria-label="Scope of work, line ${esc(n)}">
      <div class="qs-ed-hd"><div><b>Line ${esc(n)} · Scope of Work</b><small>${esc(($('f-company')?.value || '').trim() || 'Quotation draft')}</small></div><button type="button" class="qs-x" data-ed="cancel" aria-label="Close">✕</button></div>
      <div class="qs-ed-bar"></div>
      <div class="qs-ed-main">
        <div class="qs-ed-page"><div class="qs-ed-sheet"><input type="text" class="qs-ed-title" maxlength="200" aria-label="Line title" placeholder="Line title — short; it is what the Sales Order, Delivery Note and Invoice show"><div class="qs-ed-doc"></div></div></div>
        <aside class="qs-ed-side">
          <div class="qs-fl"><span>Work category${catsRequired() ? ' <b class="qt-req">*</b>' : ''}</span><button type="button" class="qt-wcat qs-ed-cat"></button></div>
          <div class="qs-ed-fig"><div><span>Qty</span><b>${esc(qty || '—')} ${esc(uom)}</b></div><div><span>Rate</span><b>${esc(rate || '—')}</b></div></div>
          <p class="qs-ed-note">Qty and rate are changed on the line itself.</p>
          <div class="qs-ed-src">${src ? 'Source: <b>' + esc(srcLabel(src)) + '</b>' + (tr.dataset.scopeEdited === '1' ? ', edited.' : '.') : 'Written for this quotation.'}</div>
          ${rfqOfOpen(openQ) && String(rfqOfOpen(openQ).desc || '').trim() ? '<button type="button" class="qs-lnk" data-qs="orig">View customer\'s original</button>' : ''}
          <button type="button" class="qs-lnk" data-ed="block">Insert block here…</button>
          <button type="button" class="qs-lnk" data-ed="prev">Insert from a previous quotation…</button>
          <button type="button" class="qs-lnk" data-ed="save">Save selected text as block…</button>
          <div class="qs-ed-count"></div>
        </aside>
      </div>
      <div class="qs-ed-ft">${isRfq ? '<button type="button" class="qs-lnk" data-ed="restore">Restore RFQ text</button>' : ''}<span class="qs-sp"></span><button type="button" class="pr-btn" data-ed="cancel">Cancel</button><button type="button" class="pr-btn pr-pri" data-ed="done">Done</button></div>
    </div>`;
    document.body.appendChild(ov);
    const ed = ov.querySelector('.qs-ed-doc'), title = ov.querySelector('.qs-ed-title');
    R().make(ed, { html: tr.querySelector('[data-f="scope"]')?.innerHTML || '', placeholder: 'Scope of work — headings, numbered steps, lists…' });
    R().wireBar(ov.querySelector('.qs-ed-bar'));
    title.value = tr.querySelector('[data-f="desc"]')?.value || '';
    edState = { tr, ov, ed, title, cat: tr.dataset.wcat || '' };
    const catBtn = ov.querySelector('.qs-ed-cat');
    const paintC = () => paintCatChip(catBtn, edState.cat, { missing: catsRequired() && !edState.cat });
    paintC();
    const count = () => { const h = R().clean(ed.innerHTML); ov.querySelector('.qs-ed-count').textContent = `${plain(h).split(/\s+/).filter(Boolean).length} words · ${Math.round(h.length / 100) / 10} of ${LINE_MAX / 1000} thousand characters`; ov.querySelector('.qs-ed-count').classList.toggle('is-over', h.length > LINE_MAX); };
    count(); ed.addEventListener('input', count);
    ov.addEventListener('click', e => {
      const c = e.target.closest('.qs-ed-cat'); if (c) { openCatMenu(c, edState.cat, v => { edState.cat = v; paintC(); }); return; }
      const b = e.target.closest('[data-ed]'); if (!b) return;
      const a = b.dataset.ed;
      if (a === 'cancel') closeEditor(false);
      else if (a === 'done') closeEditor(true);
      else if (a === 'restore') { const r = rfqOfOpen(openQ); if (r) { ed.innerHTML = R().plainToHtml(String(r.desc || '').trim()); count(); } }
      else if (a === 'block') { const range = saveRange(ed); openPicker({ target: 'cursor', onCursor: html => insertAtRange(ed, range, html, count) }); }
      else if (a === 'prev') { const range = saveRange(ed); openPicker({ tab: 'prev', target: 'cursor', onCursor: html => insertAtRange(ed, range, html, count) }); }
      else if (a === 'save') { const h = selectedHtml(ed) || R().clean(ed.innerHTML); if (!plain(h)) { toastMsg('Type or select the text to save first.', 'warning'); return; } saveAsBlock(h, { title: title.value.trim() }); }
    });
    setTimeout(() => { (title.value ? ed : title).focus(); }, 40);
  }
  function saveRange(ed) { const s = window.getSelection(); return s && s.rangeCount && ed.contains(s.getRangeAt(0).commonAncestorContainer) ? s.getRangeAt(0).cloneRange() : null; }
  function insertAtRange(ed, range, html, after) {
    ed.focus();
    const s = window.getSelection();
    if (range) { s.removeAllRanges(); s.addRange(range); } else { const r = document.createRange(); r.selectNodeContents(ed); r.collapse(false); s.removeAllRanges(); s.addRange(r); }
    try {
      // inserted text starts on its own line when the cursor is inside a line of text
      const r0 = s.getRangeAt(0), probe = document.createRange();
      let blk = r0.startContainer.nodeType === 1 ? r0.startContainer : r0.startContainer.parentNode;
      while (blk && blk !== ed && !/^(DIV|LI|P)$/.test(blk.nodeName)) blk = blk.parentNode;
      probe.selectNodeContents(blk || ed); probe.setEnd(r0.startContainer, r0.startOffset);
      if (probe.toString().trim()) document.execCommand('insertParagraph');
      document.execCommand('insertHTML', false, (R() ? R().clean(html) : html) + '<div><br></div>');
    } catch (_) { ed.insertAdjacentHTML('beforeend', html); }
    ed.dispatchEvent(new Event('input', { bubbles: true }));
    after && after();
  }
  function selectedHtml(ed) {
    const s = window.getSelection(); if (!s || !s.rangeCount || s.isCollapsed) return '';
    const r = s.getRangeAt(0); if (!ed.contains(r.commonAncestorContainer)) return '';
    const d = document.createElement('div'); d.appendChild(r.cloneContents()); return R() ? R().clean(d.innerHTML) : d.innerHTML;
  }

  /* ═════════ 7. Text Blocks ═════════ */
  const SECTIONS = ['Scope', 'Technical spec', 'Deliverables', 'Inclusions', 'Exclusions', 'Assumptions', 'Warranty', 'Terms'];
  const HEADS = { Scope: 'Scope of Work', 'Technical spec': 'Technical Specification', Deliverables: 'Deliverables', Inclusions: 'Inclusions', Exclusions: 'Exclusions & Assumptions', Assumptions: 'Exclusions & Assumptions', Warranty: 'Warranty', Terms: 'Terms & Conditions' };
  const APPLIES = [['product', 'Product'], ['service', 'Service'], ['contracting', 'Contracting']];
  let blocks = null, blocksAt = 0;
  async function loadBlocks(force) {
    if (blocks && !force && Date.now() - blocksAt < 120000) return blocks;
    if (!window.FB || !FB.fbReadAll) { blocks = blocks || []; return blocks; }
    try { const all = await FB.fbReadAll('textBlocks'); blocks = (all || []).filter(b => b && !b._deletedAt); blocksAt = Date.now(); }
    catch (e) { console.warn('[BizCore] text blocks not loaded', e && e.message); blocks = blocks || []; toastMsg('The text blocks could not be loaded (no connection?).', 'error'); }
    return blocks;
  }
  async function saveBlock(b) {
    b.updated = new Date().toISOString(); b.updatedBy = who();
    const ok = window.FB && FB.fbSaveRecordWith ? await FB.fbSaveRecordWith('textBlocks', b) : true;
    if (ok && blocks) { const i = blocks.findIndex(x => x.id === b.id); if (i > -1) blocks[i] = b; else blocks.unshift(b); }
    return ok;
  }
  function bumpUse(b) {
    if (!b || String(b.id).startsWith('svc_')) return;
    b.usedCount = (Number(b.usedCount) || 0) + 1; b.lastUsed = new Date().toISOString();
    if (window.FB && FB.fbMergeFields) FB.fbMergeFields('textBlocks', b.id, { usedCount: b.usedCount, lastUsed: b.lastUsed });
  }
  /** Save as block (from the full editor or a note line) */
  function saveAsBlock(html, { title = '', section = '' } = {}) {
    if (!can('textBlocks', 'c')) { toastMsg('Your role cannot add text blocks (Roles & Permissions → Text Blocks → Create).', 'error'); return; }
    const svc = svcTemplate();
    const box = dialog({ title: 'Save as Text Block', wide: false, html: `<p class="qs-dlg-sub">A copy goes to Master Data → Text Blocks. Quotations that use it later get their own copy.</p>
      <label class="qs-fl"><span>Title</span><input type="text" class="qs-in" data-b="title" maxlength="120" value="${esc(title)}" placeholder="e.g. Standard exclusions — interior works"></label>
      <label class="qs-fl"><span>Section</span><select class="qs-in" data-b="section">${SECTIONS.map(s => `<option${s === section ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
      <div class="qs-fl"><span>Applies to</span><div class="qs-chk">${APPLIES.map(([k, l]) => `<label><input type="checkbox" data-a="${k}"${(svc ? k !== 'product' : k === 'product') ? ' checked' : ''}> ${l}</label>`).join('')}</div></div>
      <div class="qs-prev">${R() ? R().show(html, '') : esc(html)}</div>`,
      buttons: [{ text: 'Cancel' }, { text: 'Save Block', cls: 'pr-pri', keep: true, action: async bx => {
        const t = bx.querySelector('[data-b="title"]').value.trim(); if (!t) { bx.querySelector('[data-b="title"]').focus(); return; }
        const b = { id: 'tb' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), title: t, section: bx.querySelector('[data-b="section"]').value, appliesTo: [...bx.querySelectorAll('[data-a]:checked')].map(x => x.dataset.a), html: R() ? R().clean(html) : html, active: true, usedCount: 0, created: new Date().toISOString(), createdBy: who() };
        if (!b.appliesTo.length) b.appliesTo = ['product', 'service', 'contracting'];
        closeDialog();
        if (await saveBlock(b)) toastMsg('Saved as text block "' + t + '"', 'success'); else toastMsg('The block was not saved — please try again.', 'error');
      } }] });
    setTimeout(() => box.querySelector('[data-b="title"]').focus(), 30);
  }

  /* ── Insert picker (Text blocks · Previous quotations) ── */
  let picker = null;
  function closePicker() { if (!picker) return; picker.ov.remove(); picker = null; }
  async function openPicker(opts = {}) {
    closePicker();
    const ov = document.createElement('div'); ov.className = 'qs-ov qs-pick-ov';
    ov.innerHTML = `<div class="qs-pick" role="dialog" aria-modal="true" aria-label="Insert text">
      <div class="qs-ed-hd"><div><b>Insert Text</b><small>Adds an editable copy to this quotation — the source is not changed.</small></div><button type="button" class="qs-x" data-p="x" aria-label="Close">✕</button></div>
      <div class="qs-pk-tabs" role="tablist"><button type="button" role="tab" data-p="tab-blocks">Text Blocks</button><button type="button" role="tab" data-p="tab-prev">Previous Quotations</button></div>
      <div class="qs-pk-body"></div>
      <div class="qs-pk-ft"></div></div>`;
    document.body.appendChild(ov);
    picker = { ov, opts, tab: opts.tab === 'prev' ? 'prev' : 'blocks', sec: '', search: '', sel: null, q: null, picked: new Set() };
    ov.addEventListener('click', onPickClick);
    ov.addEventListener('input', e => { if (e.target.matches('.qs-pk-search')) { picker.search = e.target.value; paintPick(true); } });
    ov.addEventListener('mousedown', e => { if (e.target === ov) closePicker(); });
    paintPick();
    if (picker.tab === 'blocks') { await loadBlocks(); if (picker) paintPick(); }
  }
  const quoteKind = () => (window._pendingEstimate ? 'contracting' : svcTemplate() ? 'service' : 'product');
  function paintPick(keepFocus) {
    if (!picker) return;
    const { ov, tab } = picker;
    ov.querySelectorAll('.qs-pk-tabs [data-p]').forEach(b => { const on = b.dataset.p === 'tab-' + tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    const body = ov.querySelector('.qs-pk-body'), ft = ov.querySelector('.qs-pk-ft');
    const focus = keepFocus && document.activeElement && document.activeElement.classList.contains('qs-pk-search');
    if (tab === 'blocks') {
      const kind = quoteKind();
      const list = (blocks || []).filter(b => b.active !== false && !String(b.id).startsWith('svc_'))
        .filter(b => !picker.sec || b.section === picker.sec)
        .filter(b => !picker.search || (b.title + ' ' + plain(b.html)).toLowerCase().includes(picker.search.toLowerCase()))
        .sort((a, b) => (((b.appliesTo || []).includes(kind)) - ((a.appliesTo || []).includes(kind))) || (Number(b.usedCount) || 0) - (Number(a.usedCount) || 0) || String(a.title).localeCompare(b.title));
      if (!picker.sel || !list.some(b => b.id === picker.sel)) picker.sel = list[0] ? list[0].id : null;
      const cur = list.find(b => b.id === picker.sel);
      body.innerHTML = `<div class="qs-pk-top"><label class="qs-pk-s"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input class="qs-pk-search" placeholder="Search blocks…" value="${esc(picker.search)}" aria-label="Search blocks"></label>
        <div class="qs-pk-chips"><button type="button" class="qs-fc${picker.sec ? '' : ' on'}" data-p="sec:">All</button>${SECTIONS.map(s => `<button type="button" class="qs-fc${picker.sec === s ? ' on' : ''}" data-p="sec:${esc(s)}">${esc(s)}</button>`).join('')}</div></div>
        <div class="qs-pk-cols"><div class="qs-pk-list">${list.length ? list.map(b => `<button type="button" class="qs-pk-it${b.id === picker.sel ? ' on' : ''}" data-p="b:${esc(b.id)}"><b>${esc(b.title)}</b><span><i class="qs-sec">${esc(b.section || '')}</i>${esc((b.appliesTo || []).map(a => (APPLIES.find(x => x[0] === a) || [, a])[1]).join(', '))}${Number(b.usedCount) ? ' · used ' + Number(b.usedCount) + '×' : ''}</span></button>`).join('') : `<div class="qs-pk-empty">${blocks ? 'No blocks' + (picker.sec || picker.search ? ' match.' : ' yet — add them in Master Data → Text Blocks, or save a paragraph as a block from a quotation.') : 'Loading…'}</div>`}</div>
        <div class="qs-pk-pv">${cur ? `<div class="qs-pk-pvh">Preview</div><div class="qs-pk-pvt">${esc(cur.title)}</div><div class="qs-pk-pvb">${R() ? R().show(cur.html, '') : ''}</div>` : ''}</div></div>`;
      ft.innerHTML = targetsHtml(cur ? cur.section : '') + `<span class="qs-sp"></span><button type="button" class="pr-btn" data-p="x">Cancel</button><button type="button" class="pr-btn pr-pri" data-p="insert"${cur ? '' : ' disabled'}>Insert</button>`;
    } else {
      const cur = typeof editingId !== 'undefined' ? editingId : null;
      const cust = typeof selectedCustId !== 'undefined' ? String(selectedCustId || '') : '';
      const s = picker.search.toLowerCase();
      const list = (typeof quotations !== 'undefined' ? quotations : []).filter(q => q && q.id !== cur && (q.items || []).some(it => it && (it.scopeKey || it.lineType === 'note' || it.rowKind === 'scope')))
        .filter(q => !s || [q.qno, q.company, q.ref, q.project, ...(q.items || []).map(it => (it.desc || it.text || '') + ' ' + (it.scopePreview || ''))].join(' ').toLowerCase().includes(s))
        .sort((a, b) => ((String(b.custId) === cust) - (String(a.custId) === cust)) || String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 60);
      const q = picker.q;
      body.innerHTML = `<div class="qs-pk-top"><label class="qs-pk-s"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input class="qs-pk-search" placeholder="Search by customer, number or words in the scope…" value="${esc(picker.search)}" aria-label="Search quotations"></label><div class="qs-pk-hint">This customer's quotations first · open and recent quotations (older ones: open them once from the register).</div></div>
        <div class="qs-pk-cols"><div class="qs-pk-list">${list.length ? list.map(x => `<button type="button" class="qs-pk-it${q && q.id === x.id ? ' on' : ''}" data-p="q:${esc(x.id)}"><b>${esc(x.qno || '')} · ${esc(x.company || '')}</b><span>${esc(typeof fmtDate === 'function' ? fmtDate(x.date) : x.date || '')} · ${esc(x.status || 'Draft')}${x.ref ? ' · ' + esc(x.ref) : ''}</span></button>`).join('') : '<div class="qs-pk-empty">No quotation with scope lines or notes found.</div>'}</div>
        <div class="qs-pk-pv">${q ? prevLinesHtml(q) : '<div class="qs-pk-empty">Choose a quotation to see its lines.</div>'}</div></div>`;
      const n = picker.picked.size;
      ft.innerHTML = prevTargetsHtml() + `<span class="qs-sp"></span><button type="button" class="pr-btn" data-p="x">Cancel</button><button type="button" class="pr-btn pr-pri" data-p="insert-prev"${n ? '' : ' disabled'}>Insert${n ? ' ' + n : ''}</button>`;
    }
    if (focus) { const i = ov.querySelector('.qs-pk-search'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }
  }
  function targetsHtml(section) {
    const o = picker.opts;
    if (o.target === 'cursor') return '<span class="qs-pk-note">Inserted where the cursor is in the scope.</span>';
    const t = picker.target || 'heading';
    const sel = selectedRow();
    const r = (k, l, dis) => `<label class="qs-rad${dis ? ' is-dis' : ''}"><input type="radio" name="qs-tgt" value="${k}"${t === k && !dis ? ' checked' : ''}${dis ? ' disabled' : ''}> ${l}</label>`;
    const selHead = !!(sel && sel.dataset.lineType === 'heading' && sel.querySelector('.qt-hscope'));   // V271.7.3
    return `<fieldset class="qs-tgts"><legend>Insert as</legend>${r('heading', 'New heading — text as its scope' + (section && HEADS[section] ? ' ("' + esc(HEADS[section]) + '")' : ''))}${r('hscope', 'Scope of the selected heading', !selHead)}${r('under', 'Note under the selected line', !sel)}${r('remarks', 'Add to the Remarks tab')}</fieldset>`;
  }
  function prevTargetsHtml() {
    if (picker.opts.target === 'cursor') return '<span class="qs-pk-note">The chosen lines\' text is inserted where the cursor is.</span>';
    const est = !!window._pendingEstimate, svc = svcTemplate();
    const t = picker.ptarget || (svc && !est ? 'lines' : 'scope');
    const sel = selectedRow(), selScope = sel && sel.dataset.rowKind === 'scope';
    const r = (k, l, dis) => `<label class="qs-rad${dis ? ' is-dis' : ''}"><input type="radio" name="qs-ptgt" value="${k}"${t === k && !dis ? ' checked' : ''}${dis ? ' disabled' : ''}> ${l}</label>`;
    return `<fieldset class="qs-tgts"><legend>Insert as</legend>${r('lines', 'New lines (title, scope, qty, unit — no rate)', !svc || est)}${r('scope', 'Into the scope of the selected line', !selScope)}</fieldset>`;
  }
  const isSpecial = it => !!it && (it.lineType === 'heading' || it.lineType === 'note');
  function prevLinesHtml(q) {
    if (needsBody(q)) return '<div class="qs-pk-empty">Loading its scope…</div>';
    const items = q.items || [];
    return `<div class="qs-pk-pvh">${esc(q.qno || '')} — tick the lines to copy</div>` + items.map((it, i) => {
      if (!it) return '';
      const kind = it.lineType === 'heading' ? 'Heading' : it.lineType === 'note' ? 'Note' : 'Line';
      const txt = isSpecial(it) ? (it.text || it.desc || '') : (it.desc || '');
      const sc = isSpecial(it) ? '' : (scopeOf(it) ? plain(scopeOf(it)) : (it.descHtml ? plain(it.descHtml) : ''));
      return `<label class="qs-pl"><input type="checkbox" data-p="pl:${i}"${picker.picked.has(i) ? ' checked' : ''}><span><i class="qs-sec">${kind}</i><b>${esc(txt).slice(0, 160)}</b>${sc ? `<small>${esc(sc.slice(0, 220))}${sc.length > 220 ? '…' : ''}</small>` : ''}</span></label>`;
    }).join('');
  }
  async function onPickClick(e) {
    if (!picker) return;
    const r = e.target.closest('input[name="qs-tgt"]'); if (r) { picker.target = r.value; return; }
    const pr = e.target.closest('input[name="qs-ptgt"]'); if (pr) { picker.ptarget = pr.value; return; }
    const cb = e.target.closest('input[data-p^="pl:"]'); if (cb) { const i = Number(cb.dataset.p.slice(3)); cb.checked ? picker.picked.add(i) : picker.picked.delete(i); paintPick(); return; }
    const b = e.target.closest('button[data-p]'); if (!b) return;
    const p = b.dataset.p;
    if (p === 'x') { closePicker(); return; }
    if (p === 'tab-blocks' || p === 'tab-prev') { picker.tab = p.slice(4); picker.search = ''; paintPick(); if (picker.tab === 'blocks') { await loadBlocks(); paintPick(); } return; }
    if (p.startsWith('sec:')) { picker.sec = p.slice(4); paintPick(); return; }
    if (p.startsWith('b:')) { picker.sel = p.slice(2); paintPick(); return; }
    if (p.startsWith('q:')) {
      const q = (typeof quotations !== 'undefined' ? quotations : []).find(x => String(x.id) === p.slice(2)); if (!q) return;
      picker.q = q; picker.picked = new Set(); paintPick();
      if (needsBody(q)) { const ok = await loadBody(q); if (!ok) loadFailed(q); if (picker && picker.q === q) paintPick(); }
      return;
    }
    if (p === 'insert') { const bl = (blocks || []).find(x => x.id === picker.sel); if (bl) insertBlock(bl); return; }
    if (p === 'insert-prev') insertPrev();
  }
  function afterInsert() { if (typeof qtAfterRowsChange === 'function') qtAfterRowsChange(); dirty(); }
  function insertBlock(bl) {
    const o = picker.opts, html = R() ? R().clean(bl.html || '') : bl.html || '';
    if (o.target === 'cursor' && o.onCursor) { closePicker(); o.onCursor(html); bumpUse(bl); return; }
    const tgt = (picker.ov.querySelector('input[name="qs-tgt"]:checked') || {}).value || 'heading';
    const tb = $('items-tbody');
    closePicker();
    if (tgt === 'remarks') {
      const ta = $('f-additional-conditions'); if (!ta) return;
      const add = plain(html);
      ta.value = (ta.value.trim() ? ta.value.replace(/\s+$/, '') + '\n' : '') + add;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      if (typeof qtShowTab === 'function') qtShowTab('remarks');
      toastMsg('"' + bl.title + '" added to Remarks & Conditions', 'success', 'Text inserted');
    } else {
      const sel = selectedRow();
      const anchor = tgt === 'under' && sel ? sel : null;
      let after = anchor;
      // V271.7.3: a new heading takes the text as its own scope; or the text goes into the selected heading's scope
      if (tgt === 'heading' || tgt === 'hscope') {
        let h = tgt === 'hscope' && sel && sel.dataset.lineType === 'heading' ? sel : null;
        if (h) {
          const ed = h.querySelector('.qt-hscope');
          if (ed) { ed.innerHTML = (plain(ed.innerHTML) ? ed.innerHTML + '<div><br></div>' : '') + html; ed.classList.remove('bc-rt-empty'); ed.dispatchEvent(new Event('input', { bubbles: true })); }
        } else {
          h = addSpecialQuoteRow('heading', HEADS[bl.section] || bl.title, { focus: false, hScope: html });
          if (h && sel && sel.parentNode === tb) { tb.insertBefore(h, sel.nextSibling); }
        }
        if (h) { h.dataset.blockId = bl.id; h.scrollIntoView({ block: 'nearest' }); }
        toastMsg('"' + bl.title + '" inserted — edit it freely', 'success', 'Text inserted');
        bumpUse(bl); afterInsert(); return;
      }
      const n = addSpecialQuoteRow('note', '', { focus: false, html, noteStyle: 'text' });
      if (n && after && after.parentNode === tb) tb.insertBefore(n, after.nextSibling);
      if (n) { n.dataset.blockId = bl.id; n.scrollIntoView({ block: 'nearest' }); }
      toastMsg('"' + bl.title + '" inserted — edit it freely', 'success', 'Text inserted');
    }
    bumpUse(bl); afterInsert();
  }
  function insertPrev() {
    const q = picker.q; if (!q) return;
    const o = picker.opts, idx = [...picker.picked].sort((a, b) => a - b), items = q.items || [];
    const pieces = idx.map(i => items[i]).filter(Boolean);
    if (o.target === 'cursor' && o.onCursor) {
      const html = pieces.map(it => isSpecial(it) ? `<div><b>${esc(it.text || it.desc || '')}</b></div>` + (it.hScope && R() ? R().clean(it.hScope) : '') : `<div><b>${esc(it.desc || '')}</b></div>` + (scopeOf(it) || (it.descHtml && R() ? R().clean(it.descHtml) : ''))).join('');
      closePicker(); o.onCursor(html); return;
    }
    const tgt = (picker.ov.querySelector('input[name="qs-ptgt"]:checked') || {}).value || 'scope';
    const tb = $('items-tbody'), sel = selectedRow();
    closePicker();
    if (tgt === 'scope') {
      if (!sel || sel.dataset.rowKind !== 'scope') { toastMsg('Click in a scope line first, then insert.', 'warning'); return; }
      const ed = sel.querySelector('[data-f="scope"]');
      const html = pieces.map(it => isSpecial(it) ? (it.textHtml && R() ? R().clean(it.textHtml) : (R() ? R().plainToHtml(it.text || '') : '')) + (it.hScope && R() ? R().clean(it.hScope) : '') : (scopeOf(it) || (it.descHtml && R() ? R().clean(it.descHtml) : '') || (R() ? R().plainToHtml(it.desc || '') : ''))).join('<div><br></div>');
      ed.innerHTML = (plain(ed.innerHTML) ? ed.innerHTML + '<div><br></div>' : '') + html;
      ed.dispatchEvent(new Event('input', { bubbles: true }));
      if (!sel.dataset.scopeSrc) { sel.dataset.scopeSrc = 'prev:' + (q.qno || ''); paintTags(sel); }
      setTimeout(() => paintLong(sel), 0);
    } else {
      pieces.forEach(it => {
        let tr;
        if (it.lineType === 'heading' || it.lineType === 'note') tr = addSpecialQuoteRow(it.lineType, it.text || it.desc || '', { focus: false, html: it.textHtml || '', noteStyle: it.noteStyle || '', hScope: it.hScope || '', group: it.grouped ? { qty: it.gQty, unit: it.gUnit, rates: it.gRates !== false } : null });
        else {
          const c = copyItem(it); delete c.up; delete c.discAmt; delete c.discPct; delete c.discBy; delete c.pricingSell; delete c.pricingBuy; delete c.estCost; delete c.estItemId; delete c.prodId;
          c.rowKind = 'scope'; c.freeScope = true; c.scopeSrc = 'prev:' + (q.qno || ''); c.scopeEdited = false;
          tr = addItemRow(c);
        }
        if (tr && sel && sel.parentNode === tb) { tb.insertBefore(tr, (sel.nextSibling)); }
      });
      if (typeof qtRefreshLinkMarks === 'function') qtRefreshLinkMarks();
    }
    toastMsg(pieces.length + ' line' + (pieces.length === 1 ? '' : 's') + ' copied from ' + (q.qno || 'the quotation'), 'success', 'Lines copied');
    afterInsert();
  }
  /** the toolbar button (both templates) */
  function ensureInsertButtons() {
    [['service-add-btn', 'qs-ins-s'], ['product-search-bar', 'qs-ins-p']].forEach(([host, id]) => {
      const h = $(host); if (!h || $(id)) return;
      const b = document.createElement('button'); b.type = 'button'; b.id = id; b.className = 'pr-btn qs-ins-btn';
      b.innerHTML = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>Insert Text…';
      b.title = 'Insert a text block or lines from a previous quotation';
      b.addEventListener('mousedown', e => e.preventDefault());   // keeps the selected line
      b.addEventListener('click', () => openPicker({}));
      const note = [...h.querySelectorAll('button')].find(x => /qtAddLine\('note'\)/.test(x.getAttribute('onclick') || ''));
      if (note) note.after(b); else h.appendChild(b);
    });
  }

  /* ── Master Data → Text Blocks ── */
  let tb = { sel: null, search: '', sec: '', draft: null };
  async function renderBlocksTab() {
    const host = $('tb-host'); if (!host) return;
    if (!blocks) host.innerHTML = '<div class="tb-loading">Loading text blocks…</div>';
    await loadBlocks(true);
    paintBlocksTab();
  }
  function paintBlocksTab() {
    const host = $('tb-host'); if (!host) return;
    const canC = can('textBlocks', 'c'), canE = can('textBlocks', 'e'), canX = can('textBlocks', 'x');
    const list = (blocks || []).filter(b => !String(b.id).startsWith('svc_'))
      .filter(b => !tb.sec || b.section === tb.sec)
      .filter(b => !tb.search || (b.title + ' ' + plain(b.html)).toLowerCase().includes(tb.search.toLowerCase()))
      .sort((a, b) => ((b.active !== false) - (a.active !== false)) || String(a.section).localeCompare(String(b.section)) || String(a.title).localeCompare(String(b.title)));
    const cur = tb.draft || (blocks || []).find(b => b.id === tb.sel) || null;
    const ro = cur && !tb.draft && !canE;
    host.innerHTML = `<div class="card tb-card"><div class="card-header page-command-header bc-master-directory-heading"><h3><i class="ti ti-file-text" style="margin-right:6px"></i>Text Blocks</h3></div>
      <div class="card-body bc-master-register-toolbar tb-toolbar"><input id="tb-search" type="text" placeholder="Search blocks…" value="${esc(tb.search)}"><select id="tb-sec" aria-label="Section"><option value="">All sections</option>${SECTIONS.map(s => `<option${tb.sec === s ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select>
      <div class="bc-master-toolbar-actions"><button class="btn btn-primary btn-sm page-primary-command bc-master-create" id="tb-new"${canC ? '' : ' disabled title="Your role cannot add text blocks"'}><i class="ti ti-plus"></i>New block</button></div></div>
      <div class="tb-grid"><div class="tb-list list-table-scroll"><table><thead><tr><th>Title</th><th>Section</th><th>Applies to</th><th class="right">Used</th></tr></thead><tbody>${list.length ? list.map(b => `<tr class="master-clickable-row${b.id === (cur && cur.id) ? ' master-row-selected' : ''}${b.active === false ? ' tb-off' : ''}" data-tb="${esc(b.id)}" tabindex="0"><td>${esc(b.title)}${b.active === false ? ' <span class="tb-offtag">Off</span>' : ''}</td><td><span class="qs-sec">${esc(b.section || '')}</span></td><td>${esc((b.appliesTo || []).map(a => (APPLIES.find(x => x[0] === a) || [, a])[1]).join(', '))}</td><td class="right">${Number(b.usedCount) || 0}</td></tr>`).join('') : `<tr><td colspan="4"><div class="empty-state"><i class="ti ti-file-text"></i><strong>No text blocks${tb.search || tb.sec ? ' match' : ' yet'}</strong><p>Standard exclusions, assumptions, warranty and terms — written once, inserted into quotations and edited there.</p></div></td></tr>`}</tbody></table></div>
      <div class="tb-edit">${cur ? `<div class="tb-edit-h">${tb.draft ? 'New block' : ro ? 'Block' : 'Edit block'}</div>
        <label class="qs-fl"><span>Title</span><input id="tb-title" class="qs-in" maxlength="120" value="${esc(cur.title || '')}"${ro ? ' disabled' : ''}></label>
        <div class="tb-row"><label class="qs-fl"><span>Section</span><select id="tb-section" class="qs-in"${ro ? ' disabled' : ''}>${SECTIONS.map(s => `<option${s === cur.section ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
        <div class="qs-fl"><span>Applies to</span><div class="qs-chk">${APPLIES.map(([k, l]) => `<label><input type="checkbox" data-tba="${k}"${(cur.appliesTo || []).includes(k) ? ' checked' : ''}${ro ? ' disabled' : ''}> ${l}</label>`).join('')}</div></div></div>
        <div class="qs-fl tb-txt"><span>Text</span><div class="tb-bar"></div><div id="tb-html" class="tb-doc"></div></div>
        <p class="tb-hint">Changing a block changes only later inserts — quotations that used it keep their own copy.</p>
        <div class="tb-acts">${!tb.draft && canX ? `<button class="btn btn-secondary btn-sm" id="tb-onoff">${cur.active === false ? 'Activate' : 'Deactivate'}</button>` : ''}<span class="qs-sp"></span>${tb.draft ? '<button class="btn btn-secondary btn-sm" id="tb-cancel">Cancel</button>' : ''}${ro ? '' : '<button class="btn btn-primary btn-sm" id="tb-save"><i class="ti ti-device-floppy"></i>Save block</button>'}</div>`
        : '<div class="tb-pick">Choose a block to see or edit it' + (canC ? ', or add a new one.' : '.') + '</div>'}</div></div></div>`;
    const ed = $('tb-html');
    if (ed && R()) { R().make(ed, { html: cur.html || '', placeholder: 'Write the text — bold, lists, numbering…' }); if (ro) ed.setAttribute('contenteditable', 'false'); else R().wireBar(host.querySelector('.tb-bar')); }
    $('tb-search')?.addEventListener('input', e => { tb.search = e.target.value; paintBlocksTab(); const i = $('tb-search'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); });
    $('tb-sec')?.addEventListener('change', e => { tb.sec = e.target.value; paintBlocksTab(); });
    $('tb-new')?.addEventListener('click', () => { tb.draft = { id: '', title: '', section: tb.sec || 'Exclusions', appliesTo: ['service', 'contracting'], html: '', active: true }; paintBlocksTab(); setTimeout(() => $('tb-title')?.focus(), 30); });
    $('tb-cancel')?.addEventListener('click', () => { tb.draft = null; paintBlocksTab(); });
    host.querySelectorAll('tr[data-tb]').forEach(r => { const go = () => { tb.draft = null; tb.sel = r.dataset.tb; paintBlocksTab(); }; r.addEventListener('click', go); r.addEventListener('keydown', e => { if (e.key === 'Enter') go(); }); });
    $('tb-onoff')?.addEventListener('click', async () => { const b = { ...cur, active: cur.active === false }; if (await saveBlock(b)) { toastMsg(b.title + (b.active ? ' activated' : ' deactivated'), 'success'); paintBlocksTab(); } else toastMsg('Not saved — please try again.', 'error'); });
    $('tb-save')?.addEventListener('click', async () => {
      const title = $('tb-title').value.trim(); if (!title) { toastMsg('Enter a title for the block.', 'error'); $('tb-title').focus(); return; }
      const html = R() ? R().clean($('tb-html').innerHTML) : $('tb-html').innerHTML;
      if (!plain(html)) { toastMsg('Write the text of the block.', 'error'); $('tb-html').focus(); return; }
      if (html.length > LINE_MAX) { toastMsg('The block is too long — keep it under ' + LINE_MAX / 1000 + ' thousand characters.', 'error'); return; }
      const appliesTo = [...host.querySelectorAll('[data-tba]:checked')].map(x => x.dataset.tba);
      const b = { ...(tb.draft || cur), title, section: $('tb-section').value, appliesTo: appliesTo.length ? appliesTo : ['product', 'service', 'contracting'], html };
      if (!b.id) { b.id = 'tb' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); b.created = new Date().toISOString(); b.createdBy = who(); b.usedCount = 0; b.active = true; }
      if (await saveBlock(b)) { tb.draft = null; tb.sel = b.id; toastMsg('Block "' + title + '" saved', 'success'); paintBlocksTab(); } else toastMsg('The block was not saved — please try again.', 'error');
    });
  }

  /* ═════════ 8. service standard scope (a text block per service item: textBlocks/svc_{productId}) ═════════ */
  async function stdScopeOf(p) {
    if (!p || !p.stdScope || !window.FB || !FB.fbReadDoc) return '';
    try { const d = await FB.fbReadDoc('textBlocks', 'svc_' + docId(p.id)); return d && d.active !== false ? String(d.html || '') : ''; } catch (_) { return ''; }
  }
  async function saveStdScope(p, html) {
    if (!p || !window.FB || !FB.fbSaveRecordWith) return true;
    const b = { id: 'svc_' + docId(p.id), serviceId: String(p.id), title: 'Standard scope — ' + (p.name || ''), section: 'Scope', appliesTo: ['service', 'contracting'], html: html || '', active: !!html, updated: new Date().toISOString(), updatedBy: who() };
    return FB.fbSaveRecordWith('textBlocks', b);
  }
  /** after a line is linked to a service item: its category, and its standard scope when the line has no scope yet */
  async function afterLink(tr, p) {
    if (!tr || !p || tr.dataset.rowKind !== 'scope') return;
    if (!tr.dataset.wcat && p.category && serviceCats().includes(p.category)) setLineCat(tr, p.category, true);
    if (!p.stdScope) return;
    const ed = tr.querySelector('[data-f="scope"]'); if (!ed || plain(ed.innerHTML)) return;
    const html = await stdScopeOf(p); if (!html || plain(ed.innerHTML)) return;
    ed.innerHTML = R() ? R().clean(html) : html; ed.dispatchEvent(new Event('input', { bubbles: true }));
    tr.dataset.scopeSrc = 'svc:' + (p.code || ''); tr.dataset.scopeEdited = ''; paintTags(tr); setTimeout(() => paintLong(tr), 0); dirty();
    toastMsg('The standard scope of ' + (p.code || p.name) + ' was copied into line ' + (tr.querySelector('.qt-n')?.textContent || '') + ' — edit it for this job.', 'success', 'Standard scope copied');
  }

  /* ═════════ 9. view & print ═════════ */
  let pctx = null;   // { mode: 'auto'|'inline'|'annex', annex: [] } while a quotation is being printed
  function printMode() { const m = (typeof settings !== 'undefined' && settings.quotationPrint && settings.quotationPrint.scopePrint) || 'auto'; return ['auto', 'inline', 'annex'].includes(m) ? m : 'auto'; }
  function printBegin(q, mode) { pctx = { q, mode: ['auto', 'inline', 'annex'].includes(mode) ? mode : printMode(), annex: [] }; }
  function printEnd() { pctx = null; }
  const isLong = html => { const t = plain(html); return t.split('\n').filter(x => x.trim()).length > 10 || t.length > 900; };
  /** what the quotation view / print shows for a scope line: the title, then its scope (or a reference to Annexure A) */
  function lineHtml(it, empty) {
    const title = String(it.desc || '').trim(), html = scopeOf(it);
    const head = title ? `<div class="bc-sct">${esc(title)}</div>` : '';
    if (!html) return head + (it.scopePreview ? `<div class="bc-scp">${esc(it.scopePreview)}…</div>` : '') || (empty == null ? '—' : empty);
    if (pctx && (pctx.mode === 'annex' || (pctx.mode === 'auto' && isLong(html)))) {
      // a template may build its rows more than once (layout passes) — one annexure item per line
      const k = it.scopeKey || title + '|' + html.length;
      let a = pctx.annex.find(x => x.k === k);
      if (!a) { a = { k, n: pctx.annex.length + 1, title, html }; pctx.annex.push(a); }
      const n = a.n;
      return head + `<div class="bc-annref">Detailed scope: Annexure A, item ${n}</div>`;
    }
    return head + `<div class="bc-rtx bc-scb">${R() ? R().clean(html) : html}</div>`;
  }
  const ANNEX_CSS = '.bc-sct,td .bc-sct,.items td .bc-sct{font-weight:700!important}.bc-scb{font-weight:400!important;margin-top:2px}td .bc-scb{font-size:.96em}.bc-scp{color:#64748b;font-size:.92em}.bc-annref,td .bc-annref{font-size:.9em;font-style:italic!important;margin-top:2px}.bc-annref{color:#1d5f9f}'
    + '.bc-annex-h{border-bottom:2px solid #1F4E79;padding:0 0 8px;margin:0 0 12px}.bc-annex-t{font-size:17px;font-weight:700;color:#1F4E79}.bc-annex-s{font-size:10.5px;color:#475569;margin-top:3px}'
    + '.bc-annex-tbl{width:100%;border-collapse:collapse;margin:0 0 12px;table-layout:fixed}.bc-annex-tbl th{text-align:left;font-size:12px;color:#1F4E79;border-bottom:1px solid #cdd8e4;padding:6px 2px;font-weight:700;background:none!important}.bc-annex-tbl td{font-size:11px;padding:6px 2px;vertical-align:top;color:#1f2937;border:0!important}'
    + '.bc-annex-in{padding:8mm 12mm 0}.bc-annex-page{page-break-before:always;break-before:page;padding:12mm}.bc-annex-pw{page-break-before:always;break-before:page}';
  /** the print window HTML + Annexure A pages (the template's own footer on them) */
  function injectAnnex(html) {
    html = String(html || '');
    if (html.indexOf('.bc-sct{') < 0) html = html.replace(/<\/head>/i, '<style>' + ANNEX_CSS + '</style></head>');
    const a = pctx && pctx.annex; if (!a || !a.length) return html;
    const q = pctx.q || {};
    const bodyAt = html.search(/<body[\s>]/i);
    const bi = /dir="rtl"|class="ar[" ]/.test(bodyAt > -1 ? html.slice(bodyAt) : html);   // a bilingual template (not just its CSS)
    const head = `<div class="bc-annex-h"><div class="bc-annex-t">Annexure A — Scope of Work${bi ? ' <span class="ar" dir="rtl">الملحق أ — نطاق العمل</span>' : ''}</div><div class="bc-annex-s">Forms part of Quotation ${esc(q.qno || '')}${q.company ? ' · ' + esc(q.company) : ''}</div></div>`;
    const items = a.map(x => `<table class="bc-annex-tbl"><thead><tr><th>Item ${x.n}${x.title ? ' — ' + esc(x.title) : ''}</th></tr></thead><tbody><tr><td><div class="bc-rtx bc-scb">${R() ? R().clean(x.html) : x.html}</div></td></tr></tbody></table>`).join('');
    if (/<article class="sheet/.test(html)) {
      const foot = (html.match(/<footer class="page-footer"[\s\S]*?<\/footer>/) || [''])[0];
      const at = html.lastIndexOf('</article>');
      if (at > -1) return html.slice(0, at + 10) + `<article class="sheet bc-annex-sheet">${head}${items}${foot}</article>` + html.slice(at + 10);
    }
    if (/<table class="pw[" ]/.test(html)) {
      const tf = (html.match(/<tfoot>[\s\S]*?<\/tfoot>/) || [''])[0];
      return html.replace(/<\/body>/i, `<table class="pw bc-annex-pw">${tf}<tbody><tr><td style="padding:0"><div class="bc-annex-in">${head}${items}</div></td></tr></tbody></table></body>`);
    }
    return html.replace(/<\/body>/i, `<div class="bc-annex-page">${head}${items}</div></body>`);
  }
  /** the print option in the "Print / PDF" window (Settings → Quotation Print is the default) */
  function ensurePrintOption() {
    const m = $('quotation-output-modal'); if (!m || $('qs-printopt')) return;
    const body = m.querySelector('.modal-body') || m.querySelector('.modal'); if (!body) return;
    const box = document.createElement('div'); box.id = 'qs-printopt'; box.className = 'qs-printopt';
    box.innerHTML = `<div class="qs-po-h">Long scope of work</div><label><input type="radio" name="qs-po" value="auto"> <span><b>Automatic</b> — inline when short; as Annexure A when a line's scope is longer than about 10 lines</span></label><label><input type="radio" name="qs-po" value="inline"> <span><b>Always inline</b> — the full scope under each line</span></label><label><input type="radio" name="qs-po" value="annex"> <span><b>Always as annexure</b> — the price table stays short; the scope follows it</span></label>`;
    body.appendChild(box);
  }
  function paintPrintOption(q) {
    ensurePrintOption();
    const box = $('qs-printopt'); if (!box) return;
    const has = !!(q && (q.items || []).some(it => it && it.scopeKey));
    box.hidden = !has;
    const v = printMode(); box.querySelectorAll('input[name="qs-po"]').forEach(r => { r.checked = r.value === v; });
  }
  const chosenPrintMode = () => (document.querySelector('#qs-printopt:not([hidden]) input[name="qs-po"]:checked') || {}).value || printMode();

  /* ═════════ 10. the Job keeps the accepted scope ═════════ */
  /** the frozen copy of the accepted quotation's scope, written with the Job (jobs/{id}/scope/main) */
  function jobScopeDoc(q, job) {
    const lines = [];
    let n = 0;
    (q.items || []).forEach(it => {
      if (!it) return;
      if (it.lineType === 'heading') lines.push({ k: 'heading', text: String(it.text || it.desc || '') });
      else if (it.lineType === 'note') lines.push({ k: 'note', text: String(it.text || ''), html: it.textHtml || '' });
      else {
        n++;
        const qty = Number(it.qty) || 0, up = Number(it.up) || 0, d = Number(it.discAmt) || 0;
        lines.push({ k: 'line', n, title: String(it.desc || ''), html: scopeOf(it) || (it.descHtml || ''), workCat: it.workCat || '', qty, uom: it.uom || '', amount: Math.round((qty * up - d) * 100) / 100 });
      }
    });
    return { jobId: String(job.id), jobNo: job.jobNo || '', quotationId: String(q.id), qno: q.qno || '', revisionNo: Number(q.revisionNo) || 0, company: q.company || '', project: q.project || '', acceptedAt: new Date().toISOString(), lines };
  }
  const jobScopeCache = new Map();
  async function loadJobScope(job) {
    if (jobScopeCache.has(job.id)) return jobScopeCache.get(job.id);
    if (!window.FB || !FB.fbReadDoc) return null;
    try { const d = await FB.fbReadDoc('jobs', docId(job.id), 'scope', 'main'); jobScopeCache.set(job.id, d || null); return d || null; } catch (e) { return undefined; }
  }
  function jobScopeHtml(d, { prices = true } = {}) {
    if (!d || !Array.isArray(d.lines)) return '';
    const fmt2 = v => (Number(v) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return d.lines.map(l => {
      if (l.k === 'heading') return `<div class="js-h">${esc(l.text)}</div>`;
      if (l.k === 'note') return `<div class="js-it"><div class="js-doc">${l.html && R() ? R().show(l.html, l.text) : esc(l.text)}</div></div>`;
      return `<div class="js-it"><div class="js-ih"><b>${l.n} · ${esc(l.title)}</b>${l.workCat ? `<span class="qt-wcat js-cat">${esc(l.workCat)}</span>` : ''}${prices ? `<span class="js-amt">${fmt2(l.amount)}</span>` : `<span class="js-qty">${esc(String(l.qty || ''))} ${esc(l.uom || '')}</span>`}</div>${l.html ? `<div class="js-doc bc-rtx">${R() ? R().clean(l.html) : l.html}</div>` : ''}</div>`;
    }).join('');
  }
  async function renderJobScope(host, job) {
    if (!host || !job) return;
    host.innerHTML = '<div class="jb-empty">Loading the accepted scope…</div>';
    const d = await loadJobScope(job);
    if (d === undefined) { host.innerHTML = '<div class="jb-empty">The scope could not be loaded (no connection?).</div>'; return; }
    if (!d) { host.innerHTML = '<div class="jb-empty">No scope was kept for this job (it was created before V271.6). The accepted quotation has it: open ' + esc(job.qno || 'the quotation') + '.</div>'; return; }
    const by = {}; d.lines.filter(l => l.k === 'line').forEach(l => { const k = l.workCat || 'No category'; by[k] = (by[k] || 0) + (Number(l.amount) || 0); });
    const fmt2 = v => (Number(v) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const showP = typeof window.bcRight === 'function' ? window.bcRight('seeCost') || window.bcCan?.('salesOrder', 'v') : true;
    host.innerHTML = `<div class="js-wrap"><div class="js-main"><div class="js-banner"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg><span><b>Accepted scope — frozen.</b> Copied from ${esc(d.qno)}${d.revisionNo ? ' (rev ' + esc(d.revisionNo) + ')' : ''} when the job was created${d.acceptedAt ? ' on ' + esc(typeof fmtDate === 'function' ? fmtDate(String(d.acceptedAt).slice(0, 10)) : String(d.acceptedAt).slice(0, 10)) : ''}. Later changes to the quotation don't change it.</span></div>${jobScopeHtml(d, { prices: showP })}</div>
      <aside class="js-side">${showP ? `<div class="js-box"><div class="js-bh">Scope by work category</div>${Object.entries(by).map(([k, v]) => `<div class="js-kv"><span>${esc(k)}</span><span>${fmt2(v)}</span></div>`).join('')}</div>` : ''}<div class="js-box js-why"><div class="js-bh">Why it is kept</div>This is what the customer accepted. When they ask for extra work, check it against this scope before agreeing a price.</div><button type="button" class="btn btn-secondary btn-sm" id="js-print"><i class="ti ti-printer"></i>Print scope for site team</button><small class="js-note">Prints the scope without prices.</small></aside></div>`;
    $('js-print')?.addEventListener('click', () => printJobScope(job, d));
  }
  function printJobScope(job, d) {
    const co = (typeof settings !== 'undefined' && settings.coname) || 'Downtown Trading Est.';
    const foot = typeof companyDocumentFooterHtml === 'function' ? companyDocumentFooterHtml('quotation') : esc(co);
    const css = 'body{font-family:Arial,sans-serif;color:#1f2937;margin:0}.dn-a4{width:210mm;min-height:296mm;box-sizing:border-box;padding:12mm;margin:0 auto;background:#fff}.dn-foot{border-top:1.5px solid #174b7a;color:#52687b;font-size:8px;padding-top:5px}'
      + '.ph{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #1F4E79;padding-bottom:8px;margin-bottom:12px}.ph h1{margin:0;font-size:18px;color:#1F4E79}.ph small{font-size:10.5px;color:#475569}.js-h{font-weight:700;color:#1F4E79;font-size:13px;margin:12px 0 6px;border-bottom:1px solid #dfe5ec;padding-bottom:3px}.js-it{margin:0 0 10px}.js-ih{display:flex;gap:10px;font-size:12px}.js-ih b{flex:1}.js-cat{font-size:10px;color:#475569}.js-doc{font-size:11px;line-height:1.5;margin-top:3px}.js-amt{display:none}'
      + (R() ? R().PRINT_CSS : '');
    const body = `<div class="dn-a4"><div class="ph"><div><h1>Scope of Work — ${esc(job.jobNo || '')}</h1><small>${esc(job.company || '')}${job.project ? ' · ' + esc(job.project) : ''} · accepted ${esc(d.qno || '')}</small></div><small>${esc(co)}<br>For the site team — no prices</small></div>${jobScopeHtml(d, { prices: false })}<div class="dn-foot">${foot}</div></div>`;
    let html = `<!doctype html><html><head><meta charset="utf-8"><title>Scope ${esc(job.jobNo || '')}</title><style>${css}</style></head><body>${body}<scr` + `ipt>window.onload=function(){setTimeout(function(){window.print()},250)}</scr` + 'ipt></body></html>';
    if (window.BCPages) html = BCPages.apply(html, BCPages.DN);
    const w = window.open('', '_blank', 'width=880,height=1020'); if (!w) return;
    w.document.open(); w.document.write(html); w.document.close();
  }

  /* ═════════ 11. after the Quotation Entry opens ═════════ */
  function afterOpen(q) {
    openQ = q || null;
    ensureInsertButtons(); ensureDefaultControl(); watchWidth();
    window._qsRfqUsed = !!(q && q.rfqScopeUsed) || !!(!q && window._pendingEstimate && window._pendingEstimate.rfqScopeUsed);   // V271.7: the estimate already used the requirements
    const inp = $('f-wcat');
    if (inp) {
      delete inp.dataset.missing;
      const r = rfqOfOpen(q);
      inp.value = (q && q.workCategory) || (window._pendingEstimate && window._pendingEstimate.workCategory) || (r && r.workCategory) || '';   // V271.7: from the estimate
      paintCatChip($('qs-wdef-b'), inp.value, {});
      // lines with no category of their own (new lines, lines from the estimate, older quotations) follow the default
      rows().forEach(tr => { if (!tr.dataset.wcat && inp.value) setLineCat(tr, inp.value, false); else paintLineCat(tr); });
    }
    const wd = $('qs-wdef'); if (wd) wd.hidden = !svcTemplate();
    paintBanner(); paintCatTotals();
    setTimeout(() => { measure(); rows().forEach(paintLong); }, 60);
  }
  /* "By work category" on the summary panel (internal) */
  function paintCatTotals() {
    const side = $('qt-side'); if (!side) return;
    let box = $('qs-catbox');
    if (!svcTemplate()) { if (box) box.hidden = true; return; }
    const by = {};
    rows().forEach(tr => { const k = tr.dataset.wcat || 'No category'; const v = typeof parseBizNumber === 'function' ? parseBizNumber(tr.querySelector('.total-cell')?.textContent) : Number(String(tr.querySelector('.total-cell')?.textContent || '0').replace(/,/g, '')); by[k] = (by[k] || 0) + (Number(v) || 0); });
    const keys = Object.keys(by);
    if (!box) { box = document.createElement('div'); box.id = 'qs-catbox'; box.className = 'qs-catbox'; side.appendChild(box); }
    box.hidden = !keys.length;
    const m2 = n => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    box.innerHTML = `<div class="qs-cb-h">By work category <span>internal</span></div>` + keys.sort().map(k => `<div class="qs-cb-r${k === 'No category' ? ' is-missing' : ''}"><span>${esc(k)}</span><b>${m2(by[k])}</b></div>`).join('');
  }
  function wrapHooks() {
    if (typeof window.qtAfterOpen === 'function' && !window.qtAfterOpen.__qs) {
      const o = window.qtAfterOpen; const g = function (q) { const r = o.apply(this, arguments); try { afterOpen(q); } catch (e) { console.warn('[BizCore] scope setup', e); } return r; };
      g.__qs = true; window.qtAfterOpen = g;
    }
    if (typeof window.qtAfterCalc === 'function' && !window.qtAfterCalc.__qs) {
      const o = window.qtAfterCalc; const g = function () { const r = o.apply(this, arguments); try { paintCatTotals(); } catch (_) {} return r; };
      g.__qs = true; window.qtAfterCalc = g;
    }
    if (typeof window.setQuoteType === 'function' && !window.setQuoteType.__qs) {
      const o = window.setQuoteType; const g = function () { const r = o.apply(this, arguments); try { const wd = $('qs-wdef'); if (wd) wd.hidden = !svcTemplate(); paintBanner(); paintCatTotals(); setTimeout(measure, 0); } catch (_) {} return r; };
      g.__qs = true; window.setQuoteType = g;
    }
    if (window.BCQuoteCost && BCQuoteCost.apply && !BCQuoteCost.apply.__qs) {
      const o = BCQuoteCost.apply; const g = function () { const r = o.apply(this, arguments); setTimeout(measure, 0); return r; };
      g.__qs = true; BCQuoteCost.apply = g;
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wrapHooks); else wrapHooks();
  setTimeout(wrapHooks, 800);

  window.BCScope = {
    LINE_MAX, needsBody, loadBody, loadFailed, scopeOf, copyItem, rekeyItems,
    rowInit, lineFromRow, validate, quoteFields, persist, afterOpen, afterLink, paintLong, measure,
    lineHtml, printBegin, printEnd, injectAnnex, paintPrintOption, chosenPrintMode, printMode,
    openPicker, saveAsBlock, loadBlocks, renderBlocksTab, saveStdScope, stdScopeOf,
    jobScopeDoc, renderJobScope, loadJobScope, openEditor, serviceCats,
    _cache: scopeCache, _loaded: bodyLoaded,
  };
})();
