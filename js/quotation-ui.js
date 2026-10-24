/* ═══════════════════════════════════════════════════════════════
   V270.2 — Quotation Entry screen (approved mockups QT_1 – QT_12, docs/V270_2_QUOTATION.md)
   The pieces around the lines that js/app.js keeps (rows, totals, save):
     header (← Back, status pill, Internal Note pill, document flow) · the details band (fold / unfold, phone sheet) ·
     tabs (Items, Remarks & Conditions, Internal Notes) with dots · "How It Prints" preview · line ⋮ menu (insert,
     duplicate, move, price history, clear discount, delete + Undo) · keyboard (Alt+← / ↑ / ↓, Ctrl+Del, Ctrl+Enter,
     F2, F3) · drag to reorder · note styles (quotation and line) · totals bar and summary sheet (narrow screens) ·
     phone cards and the line sheet · "Leave Without Saving?".
   Loaded after js/app.js. Nothing here writes to the database: Save stays in app.js (saveQuotation).
   The dialogs, menus and sheets reuse the Pricing classes (.pr-pop, .pr-sheet, .pr-cf, .pr-btn, .pr-mi) from css/pricing.css.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = v => (typeof escapeHtml === 'function' ? escapeHtml(String(v ?? '')) : String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const isPhone = () => window.matchMedia('(max-width:760px)').matches;
  const isNarrow = () => window.matchMedia('(max-width:1199px)').matches;
  const modalOpen = () => !!$('quote-modal')?.classList.contains('open');
  const win = () => document.querySelector('#quote-modal .qt-win');
  const rowsAll = () => [...document.querySelectorAll('#items-tbody tr')];
  const rowByKey = k => rowsAll().find(r => r.dataset.lineKey === k);
  const m2 = n => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const STYLES = [['highlight', 'Soft Highlight'], ['blueAccent', 'Blue Accent'], ['minimal', 'Minimal'], ['badge', 'Note Badge']];
  const styleName = k => (typeof QUOTATION_LINE_NOTE_STYLES !== 'undefined' && QUOTATION_LINE_NOTE_STYLES[k]) || 'Soft Highlight';
  const adminStyle = () => (typeof quotationLineNoteStyle === 'function' ? quotationLineNoteStyle() : 'highlight');
  const docStyle = () => (typeof currentQuoteNoteStyle !== 'undefined' && currentQuoteNoteStyle) || adminStyle();
  const lockSvg = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
  let changed = false, openDoc = null, painting = false;

  /* ── changes since the screen opened (only what the person does — not the figures worked out) ── */
  const onEdit = e => { if (!modalOpen() || painting || !e.isTrusted) return; const t = e.target; if (!t || !t.closest || !t.closest('#quote-modal, .qt-sheet')) return; if (t.closest('.qt-hidden-select')) return; changed = true; };
  document.addEventListener('input', onEdit, true);
  document.addEventListener('change', onEdit, true);
  const markChanged = () => { changed = true; if (typeof markDirty === 'function') markDirty('quote-modal'); };

  /* ── dialogs (on the page body, above the Quotation window) ── */
  let dlg = null;
  function closeDialog() { if (!dlg) return; dlg.dim.remove(); dlg.box.remove(); const f = dlg.returnFocus; dlg = null; try { f && f.focus && f.focus({ preventScroll: true }); } catch (_) {} }
  function dialog({ title, html, buttons }) {
    closeDialog(); closePop();
    const dim = document.createElement('div'); dim.className = 'pr-dim qt-dlg-dim';
    const box = document.createElement('div'); box.className = 'pr-cf qt-cf';
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', title);
    box.innerHTML = `<h3>${title}</h3>${html || ''}<div class="pr-cf-bt"></div>`;
    const bt = box.querySelector('.pr-cf-bt');
    dlg = { dim, box, returnFocus: document.activeElement, cancel: () => { closeDialog(); buttons[0]?.action?.(); } };
    buttons.forEach(b => {
      const el = document.createElement('button'); el.type = 'button'; el.className = 'pr-btn ' + (b.cls || ''); el.textContent = b.text;
      el.addEventListener('click', () => { closeDialog(); b.action?.(); });
      bt.appendChild(el); if (b.default) setTimeout(() => el.focus(), 0);
    });
    dim.addEventListener('mousedown', () => dlg && dlg.cancel());
    document.body.append(dim, box);
    return box;
  }
  function toast(msg, undo) {
    document.querySelectorAll('.qt-toast').forEach(t => t.remove());
    const t = document.createElement('div'); t.className = 'pr-toast qt-toast'; t.setAttribute('role', 'status');
    t.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button type="button" class="pr-btn">Undo</button>' : ''}`;
    if (undo) t.querySelector('button').addEventListener('click', () => { t.remove(); undo(); });
    document.body.appendChild(t); setTimeout(() => t.remove(), 7000);
  }

  /* ── popover (PC / tablet) or bottom sheet (phone) ── */
  let pop = null;
  function closePop() { if (!pop) return; pop.el.remove(); pop.dim && pop.dim.remove(); pop.anchor?.classList.remove('is-open'); pop = null; }
  function openPop(anchor, html, { title, width = 260, onClick } = {}) {
    closePop();
    const phone = isPhone(), el = document.createElement('div');
    el.className = (phone ? 'pr-sheet' : 'pr-pop') + ' qt-pop';
    el.innerHTML = phone ? `<div class="pr-grab"></div>${title ? `<div class="pr-sheet-t">${title}</div>` : ''}${html}<div class="pr-sheet-close"><button type="button" class="pr-btn" data-act="__close">Close</button></div>` : html;
    let dim = null;
    if (phone) { dim = document.createElement('div'); dim.className = 'pr-dim pr-dim-pop'; dim.addEventListener('mousedown', closePop); document.body.appendChild(dim); }
    document.body.appendChild(el);
    if (!phone) {
      el.style.width = width + 'px';
      const b = anchor.getBoundingClientRect(), h = el.offsetHeight, w = el.offsetWidth;
      el.style.left = Math.max(8, Math.min(b.right - w, window.innerWidth - w - 8)) + 'px';
      const top = b.bottom + h + 8 < window.innerHeight ? b.bottom + 4 : b.top - h - 4;
      el.style.top = Math.max(8, Math.min(top, window.innerHeight - h - 8)) + 'px';
    }
    anchor.classList.add('is-open');
    pop = { el, dim, anchor, t: Date.now() };
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
      if (b.dataset.act === '__close') { closePop(); return; }
      onClick && onClick(b.dataset.act, b);
    });
    el.addEventListener('keydown', e => {
      const items = [...el.querySelectorAll('button:not([disabled])')]; const i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length]?.focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus(); }
      else if (e.key === 'Tab') { e.preventDefault(); closePop(); anchor.focus?.(); }
    });
    setTimeout(() => (el.querySelector('.qt-on') || el.querySelector('button:not([disabled])'))?.focus({ preventScroll: true }), 0);
    return el;
  }
  const mi = (act, label, { key = '', cls = '', disabled = false, sub = '' } = {}) => `<button type="button" class="pr-mi ${cls}" data-act="${act}"${disabled ? ' disabled' : ''}><span>${label}${sub ? `<span class="pr-msub">${sub}</span>` : ''}</span>${key ? `<span class="pr-k">${key}</span>` : ''}</button>`;
  const sep = '<div class="pr-sepm"></div>';
  document.addEventListener('mousedown', e => { if (pop && !pop.el.contains(e.target) && !pop.anchor.contains(e.target)) closePop(); }, true);
  // a scroll closes a menu — but not one still settling from the action just before (e.g. a line brought into view)
  window.addEventListener('scroll', e => { if (pop && !pop.el.contains(e.target) && !pop.dim && Date.now() - pop.t > 400) closePop(); }, true);

  /* ── open / after open ── */
  function qtOnOpen(q) {
    openDoc = q || null; changed = false;
    closePop(); closeDialog(); closeSheet();
    const w = win(); if (w) w.classList.remove('qt-det-open', 'qt-side-open');
    qtShowTab('items', true);
    const d = $('f-date');
    if (d && window.BCDate && !d._bcdate) BCDate.attach(d, { allowEmpty: false, onCommit: () => { if (typeof updateValidUntil === 'function') updateValidUntil(); paintFold(); renderPreview(); } });
    if (d && d._bcdate) { const iso = BCDate.parse(d.value); if (iso) d._bcdate.setISO(iso); }
    let pref = null; try { pref = localStorage.getItem('bc_qt_fold'); } catch (_) {}
    applyFold(pref === null ? window.innerHeight < 820 : pref === '1');
  }
  function qtAfterOpen() {
    painting = true;
    try {
      if (typeof updateValidUntil === 'function') updateValidUntil();
      qtPaintHeader(); qtPaintNotes(); paintDots(); renderPreview(); renderCards();
      if (typeof calcTotals === 'function') calcTotals();
      rowsAll().forEach(tr => tr.querySelectorAll('textarea').forEach(t => typeof qtAutoGrow === 'function' && qtAutoGrow(t)));
    } finally { painting = false; }
    changed = false;
    setTimeout(() => { rowsAll().forEach(tr => tr.querySelectorAll('textarea').forEach(t => typeof qtAutoGrow === 'function' && qtAutoGrow(t))); }, 60);
  }

  /* ── header: subtitle, status pill, note pill, document flow, back title ── */
  const STATUS_TONE = { Draft: 'neutral', Sent: 'blue', Won: 'green', Lost: 'red', Expired: 'amber', Revised: 'purple', Cancelled: 'red' };
  function flowInfo() {
    const q = openDoc && typeof editingId !== 'undefined' && editingId ? quotations.find(x => x.id === editingId) || openDoc : null;
    const rfqId = q?.rfqId || document._pendingRFQId || openDoc?.rfqId || null;
    const r = rfqId ? rfqs.find(x => String(x.id) === String(rfqId)) : null;
    const ctx = window._pendingQuotationPricingContext;
    const pv = Number(q?.pricingVersion || document._pendingPricingVersion || ctx?.version || 0);
    const so = q && typeof getSalesOrderForQuotation === 'function' ? getSalesOrderForQuotation(q.id) : null;
    return { q, r, pv, so, ctx };
  }
  function qtPaintHeader() {
    if (!$('quote-modal')) return;
    const f = flowInfo(), company = $('f-company')?.value || $('f-cust-search')?.value || '', ref = $('f-ref')?.value.trim() || '';
    const sub = [company || 'Select a customer', ref ? 'Ref ' + ref : '', f.ctx?.pricingRef ? 'From Pricing ' + f.ctx.pricingRef : '', typeof quotationTypeLabel === 'function' ? quotationTypeLabel(currentQuoteType).replace(' Quotation', 's') : ''].filter(Boolean);
    if ($('quote-header-sub')) $('quote-header-sub').textContent = sub.join(' · ');
    const st = $('f-status')?.value || 'Draft';
    if ($('qt-status-text')) $('qt-status-text').textContent = st;
    const pill = $('qt-status-pill'); if (pill) pill.dataset.tone = STATUS_TONE[st] || 'neutral';
    const ok = $('qt-cust-ok'); if (ok) ok.hidden = !(typeof selectedCustId !== 'undefined' && selectedCustId && selectedCustId !== '__legacy__');
    // customer: address · VAT · CR (from the Customer Master)
    const c = typeof selectedCustId !== 'undefined' && selectedCustId ? customers.find(x => String(x.id) === String(selectedCustId)) : null;
    const info = $('quote-customer-info');
    if (info) {
      if (c) { const addr = [[c.district, c.city].filter(Boolean).join(', '), c.vat ? 'VAT ' + c.vat : '', c.crNo || c.cr ? 'CR ' + (c.crNo || c.cr) : ''].filter(Boolean).join(' · '); info.textContent = addr || 'Address not recorded'; info.classList.remove('qt-info-hint'); }
      else { info.textContent = company ? 'Not in the Customer Master' : 'Select a customer to show the address and VAT number.'; info.classList.add('qt-info-hint'); }
    }
    const ci = $('qt-contact-info');
    if (ci) { const name = $('f-contact')?.value.trim().toLowerCase(); const ct = c && name ? (c.contacts || []).find(x => String(x.name || '').toLowerCase() === name) : null; ci.textContent = ct?.phone || ''; }
    // document flow
    const chip = (label, state, act, title) => state === 'cur' ? `<span class="qt-fc qt-fc-cur">${esc(label)}</span>` : state === 'off' ? `<span class="qt-fc qt-fc-off" title="${esc(title || '')}">${esc(label)}</span>` : `<button type="button" class="qt-fc" data-flow="${act}" title="${esc(title || '')}">${state === 'done' ? '<i class="qt-tick" aria-hidden="true">✓</i>' : ''}${esc(label)}</button>`;
    const s = '<span class="qt-fsep" aria-hidden="true">›</span>';
    const html = (f.r ? chip(f.r.rfqNo || 'RFQ', 'done', 'rfq', 'Open the RFQ') : chip('RFQ —', 'off', '', 'No RFQ')) + s
      + (f.r && f.pv ? chip('Pricing V' + f.pv, 'done', 'pricing', 'Open the Pricing') : chip('Pricing —', 'off', '', 'No Pricing')) + s
      + chip(f.q?.qno || 'Quotation', 'cur') + s
      + (f.so ? chip(f.so.soNo || 'Sales Order', 'done', 'so', 'Open the Sales Order') : chip('Sales Order', 'off', '', 'Not ordered yet'));
    if ($('qt-flow')) $('qt-flow').innerHTML = html;
    if ($('qt-band-flow')) $('qt-band-flow').innerHTML = html;
    const back = $('qt-back-btn');
    if (back) {
      const hist = typeof modalNavHistory !== 'undefined' ? modalNavHistory : [];
      const entry = [...hist].reverse().find(x => x.to === 'quote-modal');
      const lbl = entry && typeof modalFriendlyName === 'function' ? 'Back to ' + modalFriendlyName(entry.from) : 'Close';
      back.title = lbl + ' (Alt+←)'; back.setAttribute('aria-label', lbl);
    }
    paintFold(); paintDetCard();
  }
  document.addEventListener('click', e => { const b = e.target.closest('#quote-modal [data-flow]'); if (b) qtOpenFlow(b.dataset.flow); });
  function qtOpenFlow(kind) {
    const f = flowInfo();
    const go = () => {
      if (kind === 'rfq' && f.r) { leaveScreen(() => typeof viewRFQ === 'function' && viewRFQ(f.r.id)); }
      else if (kind === 'pricing' && f.r) { leaveScreen(() => typeof openPricingDocument === 'function' ? openPricingDocument(f.r.id) : (typeof viewPricingReadOnly === 'function' && viewPricingReadOnly(f.r.id))); }
      else if (kind === 'so' && f.so) { leaveScreen(() => typeof openSalesOrderDocument === 'function' && openSalesOrderDocument(f.so.id)); }
    };
    if (!changed) { go(); return; }
    confirmLeave({ where: 'Leaving now', after: go });
  }

  /* ── status pill (the same statuses as before; Save Draft / Save & Mark Sent still set Draft / Sent) ── */
  function qtStatusMenu(btn) {
    if (pop && pop.anchor === btn) { closePop(); return; }
    const cur = $('f-status')?.value || 'Draft';
    const html = ['Draft', 'Sent', 'Won', 'Lost', 'Expired', 'Revised'].map(s => mi(s, `<i class="qt-sdot" data-tone="${STATUS_TONE[s]}"></i>${s}`, { cls: s === cur ? 'qt-on' : '' })).join('');
    openPop(btn, html, { width: 190, title: 'Status', onClick: act => { closePop(); const sel = $('f-status'); if (sel && sel.value !== act) { sel.value = act; markChanged(); qtPaintHeader(); } } });
  }

  /* ── the details band: fold (one line of chips) / unfold; on a phone a card that opens the details sheet ── */
  function applyFold(on) { const w = win(); if (w) w.classList.toggle('qt-folded', !!on); paintFold(); }
  function qtFold(on) { applyFold(on); try { localStorage.setItem('bc_qt_fold', on ? '1' : '0'); } catch (_) {} if (!on) setTimeout(() => $('f-cust-search')?.focus({ preventScroll: true }), 30); }
  const selText = id => { const s = $(id); return s && s.value && s.value !== '__add__' ? (s.options[s.selectedIndex]?.text || s.value).replace(/\s*★$/, '') : ''; };
  function paintFold() {
    const host = $('qt-band-fold'); if (!host) return;
    const ch = (lbl, val, cls = '') => val ? `<span class="qt-chip ${cls}">${lbl ? `<span>${lbl}</span>` : ''}${esc(val)}</span>` : '';
    const days = $('f-validity')?.value || '', vt = $('quote-validity-inline')?.textContent || '';
    host.innerHTML = ch('', $('f-company')?.value || $('f-cust-search')?.value || 'No customer yet', 'qt-chip-c')
      + ch('Contact', $('f-contact')?.value.trim()) + ch('Ref', $('f-ref')?.value.trim()) + ch('Date', $('f-date')?.value.trim())
      + ch('Valid', days ? days + ' ' + vt : '') + ch('Delivery', selText('f-delivery')) + ch('Payment', selText('f-payment'))
      + '<span class="qt-sp"></span><button type="button" class="qt-unfold" onclick="qtFold(false)"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>Edit Details</button>';
  }
  function paintDetCard() {
    const b = $('qt-detcard'); if (!b) return;
    const cust = $('f-company')?.value || $('f-cust-search')?.value || '';
    const l2 = [$('f-contact')?.value.trim(), $('f-ref')?.value.trim() ? 'Ref ' + $('f-ref').value.trim() : ''].filter(Boolean).join(' · ');
    const l3 = [$('f-date')?.value.trim(), $('f-validity')?.value ? 'Valid ' + $('f-validity').value + ' days' : '', selText('f-delivery'), selText('f-payment')].filter(Boolean).join(' · ');
    b.innerHTML = `<span class="qt-dc-t"><b>${esc(cust || 'Choose a customer')}</b>${l2 ? `<span>${esc(l2)}</span>` : ''}${l3 ? `<span>${esc(l3)}</span>` : ''}</span><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>`;
    b.classList.toggle('qt-dc-empty', !cust);
  }
  function qtDetails(on) { const w = win(); if (!w) return; w.classList.toggle('qt-det-open', !!on); if (!on) { qtPaintHeader(); renderPreview(); } else setTimeout(() => $('f-cust-search')?.focus({ preventScroll: true }), 60); }
  ['f-contact', 'f-ref', 'f-validity', 'f-delivery', 'f-payment', 'f-project'].forEach(id => document.addEventListener('change', e => { if (e.target && e.target.id === id) { paintFold(); paintDetCard(); renderPreview(); qtPaintHeader(); } }, true));

  /* ── tabs, dots, counters, "How It Prints" ── */
  function qtShowTab(name, quiet) {
    document.querySelectorAll('#qt-tabs .qt-tb').forEach(b => { const on = b.dataset.tab === name; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
    document.querySelectorAll('#quote-modal .qt-panel').forEach(p => p.classList.toggle('on', p.dataset.panel === name));
    closePop();
    if (name === 'items') { renderCards(); setTimeout(growAll, 0); }
    if (name === 'remarks') { renderPreview(); if (!quiet) setTimeout(() => $('f-notes')?.focus({ preventScroll: true }), 30); }
    if (name === 'internal' && !quiet) setTimeout(() => $('f-internal-notes')?.focus({ preventScroll: true }), 30);
  }
  function paintDots() {
    const notes = $('f-notes')?.value.trim() || '', cond = ($('f-additional-conditions')?.value || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean), intl = $('f-internal-notes')?.value.trim() || '';
    if ($('qt-remarks-dot')) $('qt-remarks-dot').hidden = !(notes || cond.length);
    if ($('qt-internal-dot')) $('qt-internal-dot').hidden = !intl;
    if ($('qt-note-pill')) $('qt-note-pill').hidden = !intl;
    if ($('qt-notes-cnt')) $('qt-notes-cnt').textContent = notes ? notes.length.toLocaleString('en-US') + ' characters' : '';
    if ($('qt-cond-cnt')) $('qt-cond-cnt').textContent = cond.length ? cond.length + (cond.length === 1 ? ' condition' : ' conditions') : '';
    if ($('qt-int-cnt')) $('qt-int-cnt').textContent = intl ? intl.length.toLocaleString('en-US') + ' characters' : '';
  }
  function renderPreview() {
    const host = $('qt-print-prev'); if (!host) return;
    const notes = $('f-notes')?.value.trim() || '', cond = ($('f-additional-conditions')?.value || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    const days = parseInt($('f-validity')?.value, 10) || 0, vt = ($('quote-validity-inline')?.textContent || '').split('·')[1]?.trim() || '';
    const del = selText('f-delivery'), pay = selText('f-payment');
    const li = [days ? `<li>This quotation is valid for ${days} day${days === 1 ? '' : 's'} from the date of issue${vt ? ' (until ' + esc(vt) + ')' : ''}.</li>` : '', del ? `<li>Delivery terms: ${esc(del)}</li>` : '', pay ? `<li>Payment terms: ${esc(pay)}</li>` : '', ...cond.map(c => `<li class="qt-new">${esc(c)}</li>`)].join('');
    host.innerHTML = `<h5>Terms &amp; Conditions</h5><ol>${li || '<li>Terms are as stated in this quotation.</li>'}</ol>` + (notes ? `<h5>Notes</h5><p>${esc(notes)}</p>` : '') + (cond.length ? '<div class="qt-prev-k">Additional conditions are highlighted here only.</div>' : '');
  }
  document.addEventListener('input', e => { if (!e.target) return; if (['f-notes', 'f-additional-conditions', 'f-internal-notes'].includes(e.target.id)) { paintDots(); renderPreview(); } if (['f-ref', 'f-contact', 'f-validity'].includes(e.target.id)) { paintFold(); paintDetCard(); if (e.target.id !== 'f-contact') qtPaintHeader(); } }, true);

  /* ── note styles: this quotation (Items toolbar) and each note line (chip) ── */
  function qtPaintNotes() {
    const ds = docStyle(), own = typeof currentQuoteNoteStyle !== 'undefined' && !!currentQuoteNoteStyle;
    if ($('qt-notestyle-name')) $('qt-notestyle-name').textContent = styleName(ds);
    const nb = $('qt-notestyle-btn'); if (nb) { nb.classList.toggle('qt-ns-own', own); nb.title = own ? 'Note style for this quotation only (the Administration default is ' + styleName(adminStyle()) + ')' : 'Note style: the Administration default (' + styleName(adminStyle()) + '). Choose another for this quotation only.'; }
    const rows = rowsAll();
    rows.forEach((tr, i) => {
      if (tr.dataset.lineType !== 'note') return;
      const key = tr.dataset.noteStyle || '', eff = key || ds, prev = rows[i - 1];
      const box = tr.querySelector('.qt-note'); if (box) box.className = 'qt-note qt-ns-' + eff;
      const chip = tr.querySelector('.qt-schip');
      if (chip) { chip.innerHTML = (key ? '<i aria-hidden="true"></i>' : '') + esc(styleName(eff)) + ' <span aria-hidden="true">▾</span>'; chip.classList.toggle('qt-own', !!key); chip.title = key ? 'Style changed on this note only' : 'Follows the quotation note style'; }
      tr.classList.toggle('qt-att', !!prev && prev.dataset.lineType === 'item');
    });
    renderCards();
  }
  function styleMenuHtml(cur, first) {
    const sample = k => k === 'badge' ? '<span class="qt-ns qt-ns-badge"><b class="qt-note-b">NOTE</b>Alternative to the 59A.</span>' : `<span class="qt-ns qt-ns-${k}"><b class="qt-note-l">Note:</b> Alternative to the 59A.</span>`;
    return first + sep + STYLES.map(([k, n]) => `<button type="button" class="pr-mi qt-smi${cur === k ? ' qt-on' : ''}" data-act="s:${k}" role="menuitemradio" aria-checked="${cur === k}"><span class="qt-rad" aria-hidden="true"></span><span class="qt-smi-b"><span>${n}</span>${sample(k)}</span></button>`).join('');
  }
  function qtDocNoteStyleMenu(btn) {
    if (pop && pop.anchor === btn) { closePop(); return; }
    const cur = (typeof currentQuoteNoteStyle !== 'undefined' && currentQuoteNoteStyle) || '';
    const lines = rowsAll().filter(r => r.dataset.lineType === 'note' && r.dataset.noteStyle).length;
    const first = `<div class="qt-pt">Note style for this quotation</div><button type="button" class="pr-mi qt-smi${cur ? '' : ' qt-on'}" data-act="s:" role="menuitemradio" aria-checked="${!cur}"><span class="qt-rad" aria-hidden="true"></span><span class="qt-smi-b"><span>Administration Default <em>· ${esc(styleName(adminStyle()))}</em></span></span></button>`;
    const html = styleMenuHtml(cur, first) + (lines ? sep + mi('reset', `Reset line styles (${lines}) to this style`) : '') + `<div class="qt-pfoot">This quotation only. The Administration default stays ${esc(styleName(adminStyle()))}.</div>`;
    openPop(btn, html, {
      width: 300, title: 'Note Style',
      onClick: act => {
        closePop();
        if (act === 'reset') { rowsAll().forEach(r => { if (r.dataset.lineType === 'note') r.dataset.noteStyle = ''; }); }
        else if (act.startsWith('s:')) { currentQuoteNoteStyle = act.slice(2); }
        markChanged(); qtPaintNotes();
      },
    });
  }
  function qtNoteStyleMenu(chip, trArg) {
    const tr = trArg || chip.closest('tr'); if (!tr) return;
    if (pop && pop.anchor === chip) { closePop(); return; }
    const own = tr.dataset.noteStyle || '', eff = own || docStyle();
    const first = `<div class="qt-pt">Style for this note</div><button type="button" class="pr-mi qt-smi${own ? '' : ' qt-on'}" data-act="s:" role="menuitemradio" aria-checked="${!own}"><span class="qt-rad" aria-hidden="true"></span><span class="qt-smi-b"><span>Quotation Style <em>· ${esc(styleName(docStyle()))}</em></span></span></button>`;
    const html = styleMenuHtml(own, first) + sep + mi('all', `Use ${esc(styleName(eff))} for all notes in this quotation`);
    openPop(chip, html, {
      width: 300, title: 'Note Style',
      onClick: act => {
        closePop();
        if (act === 'all') { currentQuoteNoteStyle = eff === adminStyle() ? '' : eff; rowsAll().forEach(r => { if (r.dataset.lineType === 'note') r.dataset.noteStyle = ''; }); }
        else if (act.startsWith('s:')) tr.dataset.noteStyle = act.slice(2);
        markChanged(); qtPaintNotes();
      },
    });
  }

  /* ── adding lines ── */
  function qtAddLine(kind) {
    closePop();
    let tr;
    if (kind === 'heading' || kind === 'note') tr = addSpecialQuoteRow(kind, '', { focus: !isPhone() });
    else tr = kind === 'scope' || currentQuoteType === 'contracting' ? addServiceRow() : addItemRow();
    afterRows(); markChanged();
    if (!tr) return;
    if (isPhone()) { const card = document.querySelector(`#qt-cards [data-k="${tr.dataset.lineKey}"]`); card?.scrollIntoView({ block: 'nearest' }); if (tr.dataset.lineType === 'item') qtEditLine(tr); else card?.querySelector('input')?.focus(); return; }
    (tr.querySelector('textarea[data-f="desc"]') || tr.querySelector('.quote-special-text'))?.focus();   // at once (V270.2.1)
    tr.scrollIntoView({ block: 'nearest' });
  }
  function qtMoreMenu(btn) {
    if (pop && pop.anchor === btn) { closePop(); return; }
    const prod = currentQuoteType !== 'contracting';
    const html = mi('heading', 'Add Heading') + mi('note', 'Add Note') + (prod ? mi('product', 'New Product…', { sub: 'Adds it to the Product Master and to this quotation' }) : '') + sep + mi('clear', 'Clear All Lines…', { cls: 'pr-mi-del' });
    openPop(btn, html, { width: 260, title: 'Lines', onClick: act => { closePop(); if (act === 'heading' || act === 'note') qtAddLine(act); else if (act === 'product') quickAddProductFromQuote(); else if (act === 'clear') Promise.resolve(clearAllItems()).then(() => { afterRows(); }); } });
  }

  /* ── line ⋮ menu ── */
  function lineLabel(tr) {
    if (tr.dataset.lineType !== 'item') return (tr.dataset.lineType === 'heading' ? 'Heading' : 'Note') + ': ' + (tr.querySelector('.quote-special-text')?.value.trim() || '—');
    const d = qtFieldVal(tr, 'desc') || 'New line', n = tr.querySelector('.qt-n')?.textContent || '';
    return 'Line ' + n + ' · ' + (d.length > 40 ? d.slice(0, 40) + '…' : d);
  }
  function qtRowMenu(btn, trArg) {
    const tr = trArg || btn.closest('tr') || rowByKey(btn.closest('[data-k]')?.dataset.k); if (!tr) return;
    if (pop && pop.anchor === btn) { closePop(); return; }
    const rows = rowsAll(), i = rows.indexOf(tr), item = tr.dataset.lineType === 'item', prod = tr.dataset.rowKind === 'product';
    const hasDisc = item && !!(tr.dataset.discBy && (tr.querySelector('[data-quote-dpct]')?.value || tr.querySelector('[data-quote-damt]')?.value));
    const html = (isPhone() && item ? mi('edit', 'Edit Line…') : '')
      + mi('above', 'Insert Line Above') + (item ? mi('dup', 'Duplicate Line') : '')
      + mi('up', 'Move Up', { key: 'Alt+↑', disabled: i <= 0 }) + mi('down', 'Move Down', { key: 'Alt+↓', disabled: i >= rows.length - 1 })
      + (item && prod ? sep + mi('hist', 'Price History…', { key: 'F2', sub: 'Selling and buying prices of this item' }) : '')
      + (hasDisc ? mi('nodisc', 'Clear Line Discount') : '')
      + sep + mi('del', 'Delete Line', { key: 'Ctrl+Del', cls: 'pr-mi-del' });
    openPop(btn, html, {
      width: 272, title: esc(lineLabel(tr)),
      onClick: act => { closePop(); ({ edit: () => qtEditLine(tr), above: () => insertAbove(tr), dup: () => duplicate(tr), up: () => move(tr, -1), down: () => move(tr, 1), hist: () => priceHistory(tr), nodisc: () => clearDisc(tr), del: () => confirmDelete(tr) })[act]?.(); },
    });
  }
  function rowItem(tr) {
    const it = { rowKind: tr.dataset.rowKind, prodId: tr.dataset.prodId || '', image: tr.dataset.image || '', code: qtFieldVal(tr, 'code'), brand: qtFieldVal(tr, 'brand'), model: qtFieldVal(tr, 'model'), desc: qtFieldVal(tr, 'desc'), specs: qtFieldVal(tr, 'specs'),
      qty: parseBizNumber(tr.querySelector('[data-quote-qty]')?.value), uom: tr.querySelector('select')?.value || '', up: parseBizNumber(tr.querySelector('[data-quote-price]')?.value) };
    if (tr.dataset.pricingSell) it.pricingSell = Number(tr.dataset.pricingSell); if (tr.dataset.pricingBuy) it.pricingBuy = Number(tr.dataset.pricingBuy);
    const g = (Number(it.qty) || 0) * (Number(it.up) || 0), d = typeof qtLineDiscount === 'function' ? qtLineDiscount(tr, g) : { amt: 0 };
    if (d.amt > 0) { it.discAmt = d.amt; it.discPct = d.pct; it.discBy = tr.dataset.discBy; }
    return it;
  }
  function afterRows() { if (typeof renumberQuoteItemRows === 'function') renumberQuoteItemRows(); qtPaintNotes(); if (typeof calcTotals === 'function') calcTotals(); renderCards(); }
  function focusRow(tr, sel) { setTimeout(() => { if (isPhone()) { document.querySelector(`#qt-cards [data-k="${tr.dataset.lineKey}"]`)?.scrollIntoView({ block: 'nearest' }); return; } const f = tr.querySelector(sel || 'textarea, input'); f?.focus(); tr.scrollIntoView({ block: 'nearest' }); }, 30); }
  function insertAbove(tr) {
    const nr = tr.dataset.lineType === 'item' ? (tr.dataset.rowKind === 'scope' ? addServiceRow() : addItemRow()) : (currentQuoteType === 'contracting' ? addServiceRow() : addItemRow());
    tr.parentNode.insertBefore(nr, tr); afterRows(); markChanged(); focusRow(nr, 'textarea[data-f="desc"]');
  }
  function duplicate(tr) {
    const nr = addItemRow(rowItem(tr)); tr.parentNode.insertBefore(nr, tr.nextSibling); afterRows(); markChanged();
    toast(lineLabel(tr).split(' · ')[0] + ' duplicated'); focusRow(nr, '[data-quote-qty]');
  }
  function move(tr, d) {
    const sib = d < 0 ? tr.previousElementSibling : tr.nextElementSibling; if (!sib) return;
    const f = document.activeElement && tr.contains(document.activeElement) ? document.activeElement : null;   // moving the row drops the focus — put it back
    if (d < 0) tr.parentNode.insertBefore(tr, sib); else tr.parentNode.insertBefore(sib, tr);
    afterRows(); markChanged();
    if (f) f.focus({ preventScroll: true }); else focusRow(tr);
    tr.scrollIntoView({ block: 'nearest' });
  }
  function clearDisc(tr) {
    tr.dataset.discBy = ''; tr.dataset.discPct = '';
    ['[data-quote-dpct]', '[data-quote-damt]'].forEach(s => { const el = tr.querySelector(s); if (el) el.value = ''; });
    afterRows(); markChanged();
  }
  function priceHistory(tr) {
    if (typeof prOpenHistory !== 'function') { toast('Price History is not available — reload the page.'); return; }
    let key = ''; try { key = window.BizCorePI?.core?.itemKeyOf({ productId: tr.dataset.prodId, code: qtFieldVal(tr, 'code'), desc: qtFieldVal(tr, 'desc'), uom: tr.querySelector('select')?.value || '' }) || ''; } catch (_) {}
    if (!key) { toast('Price history needs the item (choose it from the Product Master).'); return; }
    prOpenHistory(null, 'sell', { key, desc: qtFieldVal(tr, 'desc'), code: qtFieldVal(tr, 'code'), custId: typeof selectedCustId !== 'undefined' && selectedCustId !== '__legacy__' ? selectedCustId || '' : '', company: $('f-company')?.value || '' });
  }
  function confirmDelete(tr) {
    const item = tr.dataset.lineType === 'item';
    let det = '';
    if (item) { const q = tr.querySelector('[data-quote-qty]')?.value || '', u = tr.querySelector('select')?.value || '', tot = tr.querySelector('.total-cell')?.textContent || ''; det = `<p class="qt-cf-it"><b>${esc(qtFieldVal(tr, 'desc') || 'New line')}</b><br><span>${esc(q)} ${esc(u)} · Line total ${esc(tot)}</span></p>`; }
    dialog({ title: 'Delete This Line?', html: `<p>${esc(lineLabel(tr))} will be removed. Nothing is saved until you save the quotation.</p>${det}`, buttons: [{ text: 'Cancel' }, { text: 'Delete Line', cls: 'pr-danger', default: true, action: () => deleteLine(tr) }] });
  }
  function deleteLine(tr) {
    const parent = tr.parentNode, next = tr.nextSibling, label = lineLabel(tr).split(' · ')[0];
    tr.remove(); afterRows(); markChanged();
    toast(label + ' deleted', () => { parent.insertBefore(tr, next && next.parentNode === parent ? next : null); afterRows(); });
  }

  /* ── keyboard ── */
  const curRow = () => document.activeElement?.closest?.('#items-tbody tr') || null;
  window.addEventListener('keydown', e => {
    if (!modalOpen()) return;
    // Esc closes a menu, dialog, sheet, list or calendar first — not the whole screen
    if (e.key === 'Escape') {
      const dd = $('prod-search-dd'), bcd = document.querySelector('.bcd-pop');
      if (dlg) { e.preventDefault(); e.stopImmediatePropagation(); dlg.cancel(); return; }
      if (sheet) { e.preventDefault(); e.stopImmediatePropagation(); closeSheet(); return; }
      if (pop) { e.preventDefault(); e.stopImmediatePropagation(); const a = pop.anchor; closePop(); a?.focus?.(); return; }
      if (bcd) { e.preventDefault(); e.stopImmediatePropagation(); $('f-date')?._bcdate?.close?.(); return; }
      if (!e.target?.closest?.('#quote-modal') && e.target !== document.body) return;
      if (dd && dd.style.display === 'block') { e.preventDefault(); e.stopImmediatePropagation(); closeProdSearch(); return; }
      if ($('cust-dd')?.classList.contains('open') || $('contact-dd')?.classList.contains('open')) { e.preventDefault(); e.stopImmediatePropagation(); closeCustDropdown(); $('contact-dd')?.classList.remove('open'); return; }
      const w = win();
      if (w?.classList.contains('qt-det-open')) { e.preventDefault(); e.stopImmediatePropagation(); qtDetails(false); return; }
      if (w?.classList.contains('qt-side-open')) { e.preventDefault(); e.stopImmediatePropagation(); qtSide(false); return; }
      return;   // the screen's own Esc (Leave Without Saving?) in app.js
    }
    // the other keys only while working in the Quotation window (not in a screen opened on top of it, e.g. New Customer)
    if (dlg || sheet || !e.target?.closest || !(e.target.closest('#quote-modal') || e.target === document.body)) return;
    if (e.altKey && e.key === 'ArrowLeft') { e.preventDefault(); qtRequestBack(); return; }
    if (e.key === 'F3') { e.preventDefault(); qtShowTab('items'); $(currentQuoteType === 'contracting' ? 'qt-items-table' : 'prod-search-inp')?.focus(); return; }
    const tr = curRow();
    if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); qtAddLine(currentQuoteType === 'contracting' ? 'scope' : 'item'); return; }
    if (!tr) return;
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); move(tr, e.key === 'ArrowUp' ? -1 : 1); return; }
    if (e.ctrlKey && (e.key === 'Delete' || e.key === 'Del')) { e.preventDefault(); confirmDelete(tr); return; }
    if (e.key === 'F2' && tr.dataset.rowKind === 'product') { e.preventDefault(); priceHistory(tr); return; }
    // Enter: next field in the line, then the next line (the description and scope boxes handle their own Enter)
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey && e.target.matches('#items-tbody input:not(.quote-special-text)')) {
      e.preventDefault();
      const all = [...document.querySelectorAll('#items-tbody input:not([disabled]), #items-tbody textarea')].filter(x => x.offsetParent);
      const i = all.indexOf(e.target); if (i >= 0 && all[i + 1]) { e.target.dispatchEvent(new Event('blur')); all[i + 1].focus(); all[i + 1].select?.(); }
    }
  }, true);

  /* ── drag ⋮⋮ to reorder (PC / tablet) ── */
  let dragRow = null;
  document.addEventListener('mousedown', e => { const g = e.target.closest?.('#items-tbody .qt-grip'); if (!g) return; const tr = g.closest('tr'); tr.draggable = true; dragRow = tr; }, true);
  document.addEventListener('dragstart', e => { if (!dragRow || !e.target.closest?.('#items-tbody')) return; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', 'qt-line'); } catch (_) {} dragRow.classList.add('qt-dragging'); });
  document.addEventListener('dragover', e => { if (!dragRow) return; const tr = e.target.closest?.('#items-tbody tr'); if (!tr || tr === dragRow) return; e.preventDefault(); rowsAll().forEach(r => r.classList.remove('qt-drop-a', 'qt-drop-b')); const r = tr.getBoundingClientRect(); tr.classList.add(e.clientY < r.top + r.height / 2 ? 'qt-drop-a' : 'qt-drop-b'); });
  document.addEventListener('drop', e => { if (!dragRow) return; const tr = e.target.closest?.('#items-tbody tr'); e.preventDefault(); if (tr && tr !== dragRow) { const r = tr.getBoundingClientRect(); tr.parentNode.insertBefore(dragRow, e.clientY < r.top + r.height / 2 ? tr : tr.nextSibling); afterRows(); markChanged(); } });
  document.addEventListener('dragend', () => { if (!dragRow) return; dragRow.classList.remove('qt-dragging'); dragRow.draggable = false; rowsAll().forEach(r => r.classList.remove('qt-drop-a', 'qt-drop-b')); dragRow = null; });
  document.addEventListener('mouseup', () => { if (dragRow && !dragRow.classList.contains('qt-dragging')) { dragRow.draggable = false; dragRow = null; } }, true);

  /* ── after every calculation: tab count, totals bar, phone cards, the "To continue" line ── */
  function qtAfterCalc(t) {
    if (!t) return;
    if ($('qt-n-items')) $('qt-n-items').textContent = t.items;
    const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
    set('qtb-sub', m2(t.gross)); set('qtb-disc', (t.lineDisc + t.disc) ? '−' + m2(t.lineDisc + t.disc) : '0.00'); set('qtb-vat', m2(t.vat)); set('qtb-net', m2(t.net));
    set('qtb-vat-l', 'VAT ' + Number(t.rate).toFixed(2).replace(/\.00$/, '') + '%');
    const sum = $('quote-commercial-summary'), ib = $('qtb-int');
    if (ib) { const show = sum && !sum.hidden; ib.hidden = !show; if (show) { ib.dataset.state = sum.dataset.state || 'good'; set('qtb-int-t', 'Margin ' + ($('qcs-margin')?.textContent || '')); } }
    paintCardTotals(); paintReady(t);
  }
  function paintReady(t) {
    const el = $('qt-ready'); if (!el) return;
    const miss = [];
    if (!(typeof selectedCustId !== 'undefined' && selectedCustId)) miss.push('Customer');
    if (!$('f-contact')?.value.trim()) miss.push('Contact');
    if (t && t.badLines) miss.push(t.badLines === 1 ? 'A line discount' : t.badLines + ' line discounts');
    if (t && t.discBad) miss.push('Quotation discount');
    const nums = ['①', '②', '③', '④'];
    el.className = 'qt-ready' + (miss.length ? '' : ' ok');
    el.textContent = miss.length ? 'To continue: ' + miss.map((m, i) => nums[i] + ' ' + m).join(' · ') : '✓ Ready to save';
  }
  ['f-contact', 'f-cust-search'].forEach(id => document.addEventListener('input', e => { if (e.target?.id === id) paintReady(window._qtTotals); }, true));

  /* ── tablet / phone: the summary panel opens over the window from the totals bar ── */
  function qtSide(on) { const w = win(); if (w) w.classList.toggle('qt-side-open', !!on); if (on) setTimeout(() => document.querySelector('#qt-side .qt-side-hd .pr-btn')?.focus(), 30); }
  function qtFormatQuoteDisc(el) { const t = (el.value || '').replace(/[,\s]/g, ''); if (t && /^\d*\.?\d*$/.test(t) && t !== '.') el.value = Number(t) ? m2(Number(t)) : ''; calcTotals(); }
  function qtFooterMore(btn) {
    if (pop && pop.anchor === btn) { closePop(); return; }
    openPop(btn, mi('draft', 'Save Draft') + mi('sent', 'Save & Mark Sent') + sep + mi('close', 'Close'), { width: 220, title: 'Quotation', onClick: act => { closePop(); if (act === 'draft') saveQuotation('draft'); else if (act === 'sent') saveQuotation('sent'); else qtRequestClose(); } });
  }

  /* ── phone: one card per line, built from plain blocks (never restyled table rows — the V269.7.2 Safari lesson).
        The card's fields edit the line itself; the table stays the record. ── */
  let cardsTimer = null;
  function renderCards() {
    const host = $('qt-cards'); if (!host) return;
    if (!isPhone() || !modalOpen()) { if (host.childElementCount) host.innerHTML = ''; return; }
    const rows = rowsAll(), ds = docStyle();
    host.innerHTML = rows.map((tr, i) => {
      const k = esc(tr.dataset.lineKey), menu = `<button type="button" class="pr-menu-btn qt-cmenu" data-act="menu" aria-label="Line menu">⋮</button>`;
      if (tr.dataset.lineType === 'heading') return `<div class="qt-card qt-card-h" data-k="${k}"><span class="qt-badge">Heading</span><input data-p="text" value="${esc(tr.querySelector('.quote-special-text')?.value)}" placeholder="Heading text" aria-label="Heading text">${menu}</div>`;
      if (tr.dataset.lineType === 'note') { const st = tr.dataset.noteStyle || ds; return `<div class="qt-card qt-card-n${rows[i - 1]?.dataset.lineType === 'item' ? ' qt-att' : ''}" data-k="${k}"><div class="qt-note qt-ns-${st}"><b class="qt-note-b">NOTE</b><b class="qt-note-l">Note:</b><input data-p="text" value="${esc(tr.querySelector('.quote-special-text')?.value)}" placeholder="Note text" aria-label="Note text"></div><div class="qt-card-nf"><button type="button" class="qt-schip${tr.dataset.noteStyle ? ' qt-own' : ''}" data-act="style">${tr.dataset.noteStyle ? '<i aria-hidden="true"></i>' : ''}${esc(styleName(st))} ▾</button>${menu}</div></div>`; }
      const prod = tr.dataset.rowKind === 'product', n = tr.querySelector('.qt-n')?.textContent || '';
      const meta = prod ? [qtFieldVal(tr, 'code'), [qtFieldVal(tr, 'brand'), qtFieldVal(tr, 'model')].filter(Boolean).join(' ')].filter(Boolean).join(' · ') : '';
      const v = s => esc(tr.querySelector(s)?.value || '');
      return `<div class="qt-card" data-k="${k}"><div class="qt-ch"><button type="button" class="qt-ct" data-act="edit"><i>${n}</i>${esc(qtFieldVal(tr, 'desc') || (prod ? 'New item — tap to fill in' : 'New scope line — tap to fill in'))}</button>${menu}</div>`
        + (meta ? `<div class="qt-cmeta">${esc(meta)}</div>` : '') + (prod && qtFieldVal(tr, 'specs') ? `<div class="qt-cmeta">${esc(qtFieldVal(tr, 'specs'))}</div>` : '')
        + `<div class="qt-cf"><label><span>Qty</span><span class="qt-cq"><input data-p="qty" inputmode="decimal" value="${v('[data-quote-qty]')}" aria-label="Quantity"><em>${esc(tr.querySelector('select')?.value || '')}</em></span></label>`
        + `<label><span>${prod ? 'Unit Price' : 'Rate'}</span><input data-p="price" inputmode="decimal" value="${v('[data-quote-price]')}" aria-label="${prod ? 'Unit price' : 'Rate'}"></label>`
        + `<label><span>Disc %</span><input data-p="dpct" inputmode="decimal" value="${v('[data-quote-dpct]')}" placeholder="—" aria-label="Discount %"></label></div>`
        + `<div class="qt-cfoot"><small data-o="disc"></small><b data-o="net"></b></div></div>`;
    }).join('') + `<button type="button" class="qt-card-add" onclick="qtAddLine('${currentQuoteType === 'contracting' ? 'scope' : 'item'}')">+ ${currentQuoteType === 'contracting' ? 'Add Scope Line' : 'Add Item'}</button>`;
    paintCardTotals();
  }
  const renderCardsSoon = () => { clearTimeout(cardsTimer); cardsTimer = setTimeout(renderCards, 80); };
  function paintCardTotals() {
    if (!isPhone()) return;
    document.querySelectorAll('#qt-cards .qt-card[data-k]').forEach(c => {
      const tr = rowByKey(c.dataset.k); if (!tr || tr.dataset.lineType !== 'item') return;
      const net = c.querySelector('[data-o="net"]'), d = c.querySelector('[data-o="disc"]');
      if (net) net.textContent = tr.querySelector('.total-cell')?.textContent || '0.00';
      if (d) { const da = tr.querySelector('[data-quote-damt]')?.value, g = tr.querySelector('.qt-gross')?.textContent || ''; d.textContent = da && !tr.dataset.discErr ? 'Disc −' + da + ' · ' + g : tr.dataset.discErr ? tr.dataset.discErr : 'Line Total'; d.classList.toggle('qt-err', !!tr.dataset.discErr); }
      const p = c.querySelector('[data-p="dpct"]'), src = tr.querySelector('[data-quote-dpct]'); if (p && src && document.activeElement !== p) p.value = src.value;
    });
  }
  const PROXY = { qty: '[data-quote-qty]', price: '[data-quote-price]', dpct: '[data-quote-dpct]', damt: '[data-quote-damt]', text: '.quote-special-text', desc: '[data-f="desc"]', specs: '[data-f="specs"]', code: '[data-f="code"]', brand: '[data-f="brand"]', model: '[data-f="model"]' };
  function proxyTarget(el) { const card = el.closest('[data-k]'); const tr = card ? rowByKey(card.dataset.k) : (sheet && sheet.tr); return tr ? tr.querySelector(PROXY[el.dataset.p]) : null; }
  document.addEventListener('input', e => { const el = e.target; if (!el?.dataset?.p || !el.closest('#qt-cards, .qt-sheet')) return; const t = proxyTarget(el); if (!t) return; t.value = el.value; t.dispatchEvent(new Event('input', { bubbles: true })); if (sheet) paintSheet(); });
  document.addEventListener('focusin', e => { const el = e.target; if (!el?.dataset?.p || !el.closest('#qt-cards, .qt-sheet')) return; const t = proxyTarget(el); if (t && /qty|price|dpct|damt/.test(el.dataset.p)) { t.dispatchEvent(new Event('focus')); el.value = t.value; } });
  document.addEventListener('focusout', e => { const el = e.target; if (!el?.dataset?.p || !el.closest('#qt-cards, .qt-sheet')) return; const t = proxyTarget(el); if (!t) return; t.dispatchEvent(new Event('blur')); el.value = t.value; if (sheet) paintSheet(); else if (el.dataset.p !== 'text') renderCardsSoon(); });
  document.addEventListener('click', e => {
    const b = e.target.closest('#qt-cards [data-act]'); if (!b) return;
    const tr = rowByKey(b.closest('[data-k]')?.dataset.k); if (!tr) return;
    if (b.dataset.act === 'menu') qtRowMenu(b, tr); else if (b.dataset.act === 'edit') qtEditLine(tr); else if (b.dataset.act === 'style') qtNoteStyleMenu(b, tr);
  });
  const growAll = () => rowsAll().forEach(tr => tr.querySelectorAll('textarea').forEach(t => typeof qtAutoGrow === 'function' && qtAutoGrow(t)));
  window.addEventListener('resize', () => { closePop(); renderCardsSoon(); if (modalOpen()) setTimeout(growAll, 90); });

  /* ── phone: the line sheet (QT_9) — every field of the line, live ── */
  let sheet = null;
  function closeSheet() { if (!sheet) return; sheet.el.remove(); sheet.dim.remove(); sheet = null; renderCards(); }
  function qtEditLine(tr) {
    closePop(); closeSheet();
    const prod = tr.dataset.rowKind === 'product', v = s => esc(tr.querySelector(s)?.value || ''), u = esc(tr.querySelector('select')?.value || '');
    const dim = document.createElement('div'); dim.className = 'pr-dim pr-dim-pop'; dim.addEventListener('mousedown', closeSheet);
    const el = document.createElement('div'); el.className = 'pr-sheet qt-sheet'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Edit line');
    el.innerHTML = `<div class="pr-grab"></div><div class="qt-sh-hd"><b>Line ${esc(tr.querySelector('.qt-n')?.textContent || '')}<small>${prod ? (tr.dataset.prodId ? 'From the Product Master' : 'Typed item') : 'Scope of work'}</small></b><button type="button" class="qt-sh-x" data-sh="done" aria-label="Close">✕</button></div>
      <div class="qt-sh-bd">
        <label class="qt-shf"><span>${prod ? 'Description' : 'Scope of work'}</span><textarea data-p="desc" rows="${prod ? 2 : 4}">${esc(qtFieldVal(tr, 'desc'))}</textarea></label>
        ${prod ? `<label class="qt-shf"><span>Specifications</span><input data-p="specs" value="${v('[data-f="specs"]')}"></label>
        <div class="qt-sh3"><label class="qt-shf"><span>Item Code</span><input data-p="code" value="${v('[data-f="code"]')}"></label><label class="qt-shf"><span>Brand</span><input data-p="brand" value="${v('[data-f="brand"]')}"></label><label class="qt-shf"><span>Model</span><input data-p="model" value="${v('[data-f="model"]')}"></label></div>` : ''}
        <div class="qt-sh2"><label class="qt-shf"><span>Qty</span><span class="qt-cq"><input data-p="qty" inputmode="decimal" value="${v('[data-quote-qty]')}"><em>${u}</em></span></label><label class="qt-shf"><span>${prod ? 'Unit Price' : 'Rate'}</span><input data-p="price" inputmode="decimal" value="${v('[data-quote-price]')}"></label></div>
        <div class="qt-shdisc"><div class="qt-h4">Line Discount</div><div class="qt-sh2"><label class="qt-shf"><span>Disc %</span><input data-p="dpct" inputmode="decimal" value="${v('[data-quote-dpct]')}" placeholder="—"></label><label class="qt-shf"><span>Disc SAR</span><input data-p="damt" inputmode="decimal" value="${v('[data-quote-damt]')}" placeholder="—"></label></div><div class="qt-help" data-o="hint"></div></div>
        <div class="qt-shlt"><span>Line Total (before VAT)</span><b data-o="net"></b></div>
      </div>
      <div class="qt-sh-ft"><button type="button" class="pr-btn pr-danger-o" data-sh="del">Delete Line</button><button type="button" class="pr-btn pr-pri" data-sh="done">Done</button></div>`;
    document.body.append(dim, el);
    sheet = { el, dim, tr };
    el.querySelectorAll('textarea').forEach(t => t.addEventListener('input', () => { t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight + 2, 200) + 'px'; }));
    el.addEventListener('click', e => { const b = e.target.closest('[data-sh]'); if (!b) return; if (b.dataset.sh === 'del') { closeSheet(); confirmDelete(tr); } else closeSheet(); });
    paintSheet();
    setTimeout(() => el.querySelector(qtFieldVal(tr, 'desc') ? '[data-p="qty"]' : '[data-p="desc"]')?.focus(), 60);
  }
  function paintSheet() {
    if (!sheet) return; const tr = sheet.tr, el = sheet.el;
    ['dpct', 'damt'].forEach(p => { const f = el.querySelector(`[data-p="${p}"]`), src = tr.querySelector(PROXY[p]); if (f && src && document.activeElement !== f) f.value = src.value; if (f && src) { f.classList.toggle('qt-bad', src.classList.contains('qt-bad')); f.classList.toggle('qt-der', src.classList.contains('qt-der')); } });
    const g = (parseBizNumber(tr.querySelector('[data-quote-qty]')?.value) || 0) * (parseBizNumber(tr.querySelector('[data-quote-price]')?.value) || 0);
    const h = el.querySelector('[data-o="hint"]'); if (h) h.textContent = tr.dataset.discErr || `Type either one — the other is worked out from the gross ${m2(g)}. The one you typed is kept when the qty or price changes.`;
    if (h) h.classList.toggle('qt-err', !!tr.dataset.discErr);
    const n = el.querySelector('[data-o="net"]'); if (n) n.textContent = tr.querySelector('.total-cell')?.textContent || '0.00';
  }

  /* ── leaving: Back (← / Alt+←), Close, ✕, Esc — asks only when something was changed (as Pricing) ── */
  function leaveScreen(after) {
    if (typeof window.bizcorePerformClose === 'function') window.bizcorePerformClose('quote-modal', true); else closeModal('quote-modal');
    if (typeof setQuotationPricingContext === 'function') setQuotationPricingContext(null);
    if (after) setTimeout(after, 0);
  }
  function leave() {
    closePop(); closeSheet();
    if (typeof window.closeEntryWithTransition === 'function') window.closeEntryWithTransition('quote-modal', 'quotation'); else leaveScreen();
    if (typeof setQuotationPricingContext === 'function') setQuotationPricingContext(null);
  }
  function confirmLeave({ where, after } = {}) {
    const hist = typeof modalNavHistory !== 'undefined' ? modalNavHistory : [];
    const entry = [...hist].reverse().find(x => x.to === 'quote-modal');
    const back = !after && !!entry;
    const target = back && typeof modalFriendlyName === 'function' ? modalFriendlyName(entry.from) : '';
    dialog({
      title: 'Leave Without Saving?',
      html: `<p>This quotation has unsaved changes. ${esc(where || (back ? 'Going back to ' + target + ' now' : 'Closing now'))} would lose them.</p>`,
      buttons: [
        { text: 'Stay' },
        { text: after ? 'Discard & Leave' : back ? 'Discard & Go Back' : 'Discard & Close', cls: 'pr-danger-o', action: () => { if (after) leaveScreen(after); else leave(); } },
        { text: 'Save Draft & Close', cls: 'pr-pri', default: true, action: async () => { const q = await saveQuotation('draft', { skipConfirm: true }); if (q && after) setTimeout(after, 50); } },
      ],
    });
  }
  function qtRequestClose() { if (!modalOpen() || dlg) return; if (!changed) { leave(); return; } confirmLeave(); }
  const qtRequestBack = qtRequestClose;   // Back returns to the screen the quotation was opened from (or closes) — same rules
  window.confirmCancelQuotationEntry = qtRequestClose;   // the app's ✕ / Close / Cancel / Esc guard calls this

  /* ── keep the header in step with the app's own updates ── */
  if (typeof window.updateQuoteHeaderSummary === 'function' && !window.updateQuoteHeaderSummary.__qt) {
    const orig = window.updateQuoteHeaderSummary;
    window.updateQuoteHeaderSummary = function () { const r = orig.apply(this, arguments); try { qtPaintHeader(); } catch (_) {} return r; };
    window.updateQuoteHeaderSummary.__qt = true;
  }
  if (typeof window.selectContact === 'function' && !window.selectContact.__qt) {
    const origC = window.selectContact;
    window.selectContact = function () { const r = origC.apply(this, arguments); try { qtPaintHeader(); paintReady(window._qtTotals); } catch (_) {} return r; };
    window.selectContact.__qt = true;
  }
  if (typeof window.closeModal === 'function' && !window.closeModal.__qt) {
    const origM = window.closeModal;
    window.closeModal = function (id) { if (id === 'quote-modal') { closePop(); closeDialog(); closeSheet(); } return origM.apply(this, arguments); };
    window.closeModal.__qt = true;
  }

  function qtAfterRowsChange() { afterRows(); }
  function qtAfterTypeChange() { renderCardsSoon(); }

  Object.assign(window, {
    qtOnOpen, qtAfterOpen, qtPaintHeader, qtOpenFlow, qtStatusMenu, qtFold, qtDetails, qtShowTab, qtPaintNotes, qtDocNoteStyleMenu, qtNoteStyleMenu,
    qtAddLine, qtMoreMenu, qtRowMenu, qtAfterCalc, qtAfterRowsChange, qtAfterTypeChange, qtSide, qtFormatQuoteDisc, qtFooterMore, qtEditLine,
    qtRequestClose, qtRequestBack,
    qtRevealRow: tr => { qtShowTab('items'); if (isPhone()) qtEditLine(tr); else tr.scrollIntoView({ block: 'nearest' }); },
    qtDebug: { rowItem, insertAbove, duplicate, move, confirmDelete, deleteLine, clearDisc, renderCards, isChanged: () => changed, setChanged: v => { changed = !!v; }, closePop, closeDialog, closeSheet, state: () => ({ pop: !!pop, dlg: !!dlg, sheet: !!sheet }) },
  });
})();
