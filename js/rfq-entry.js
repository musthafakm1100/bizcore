/* ═══════════════════════════════════════════════════════════════
   V270.2.6 — RFQ entry screen (approved mockup RFQ_2, Layout C)
   Header strip (customer, contact, channel, assignee, reference, request type, dates) + tabs:
     Product → Items · Requirements · Attachments
     Service → Services · Scope of work · Attachments
     Mixed   → Items · Services · Scope & requirements · Attachments
   Lines (optional): rfqLines [{ lineId, kind:'product'|'service', sortOrder, productId, code, desc, qty, uom, remarks }]
     · lineId never changes, sortOrder is the display order (independent of the id)
     · an item not in the Item Master is kept on this RFQ only (productId '') — nothing is added to the master
   Once the RFQ has pricing (or a quotation) its lines are shown read only — Pricing is where they change.
   API used by js/app.js:  BCRfq.load(rfq|null) · BCRfq.collect() · BCRfq.validate() · BCRfq.dates()
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.BCRfq) return;
  const KIND = {
    product: { tab: 'Items', add: 'Add Line', col: 'Item / Product', desc: 'Item / Description', uom: 'UOM', rem: 'Remarks / Specs', ph: 'Search code / name or type…', descPh: 'Search the Item Master or type a description…', uomDefault: 'Pcs' },
    service: { tab: 'Services', add: 'Add Service', col: 'Service', desc: 'Service / scope', uom: 'Unit', rem: 'Remarks', ph: 'Search service or type…', descPh: 'Search a service or type what is required…', uomDefault: 'Lot' },
  };
  const PRODUCT_UOMS = ['Pcs', 'Nos', 'Set', 'Box', 'Pkt', 'Pair', 'Roll', 'Mtr', 'Kg', 'Ltr', 'EA'];
  const SERVICE_UOMS = ['Lot', 'Job', 'Visit', 'Hour', 'Day', 'Week', 'Month', 'Year', 'LS'];
  const TYPES = ['product', 'service', 'mixed'];
  const $ = id => document.getElementById(id);
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const newId = () => 'rl' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const S = { type: 'product', lines: [], locked: false, tab: 'product', datesReady: false };
  const kinds = () => (S.type === 'mixed' ? ['product', 'service'] : [S.type]);
  const ofKind = k => S.lines.filter(l => l.kind === k);
  const filled = l => !!(String(l.desc || '').trim() || l.productId);
  const blank = kind => ({ lineId: newId(), kind, productId: '', code: '', desc: '', qty: '', uom: KIND[kind].uomDefault, remarks: '' });
  const dirty = () => { try { if (typeof markDirty === 'function') markDirty('rfq-modal'); } catch (e) {} };
  const masterProducts = () => { try { return Array.isArray(products) ? products : []; } catch (e) { return []; } };

  /* ── dates (the standard BizCore date field) ── */
  function setupDates() {
    if (S.datesReady || !window.BCDate) return;
    // V270.2.8: Date received — never in the future, at most N days back (Administration → Document Defaults);
    // an RFQ being edited keeps its own older date. Response due — not before Date received.
    BCDate.attach($('rfq-date'), { allowEmpty: false, min: receivedMin, max: () => BCDate.today(), onCommit: iso => { if (iso) recalcDue(); } });
    BCDate.attach($('rfq-due'), { allowEmpty: false, min: () => getDate('rfq-date') || '' });
    BCDate.attach($('rfq-reqdate'), { allowEmpty: true });
    // the due date follows the received date at once (typed, picked or Today / Yesterday)
    $('rfq-date').addEventListener('input', () => { const iso = window.BCDate.parse($('rfq-date').value); if (iso && inReceivedRange(iso)) recalcDue(); });
    S.datesReady = true;
  }
  const backDays = () => (typeof window.rfqBackdateDays === 'function' ? window.rfqBackdateDays() : 30);
  const respHours = () => (typeof window.rfqResponseHours === 'function' ? window.rfqResponseHours() : 48);
  function addDaysISO(iso, n) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); if (!m) return ''; const d = new Date(+m[1], +m[2] - 1, +m[3] + n, 12); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
  function receivedMin() { const lim = addDaysISO(BCDate.today(), -backDays()); return S.origReceived && S.origReceived < lim ? S.origReceived : lim; }
  function inReceivedRange(iso) { return !!iso && iso >= receivedMin() && iso <= BCDate.today(); }
  /** Response due = Date received + the response period (hours, rounded up to whole days). */
  function recalcDue() {
    const rec = getDate('rfq-date'); if (!rec) return;
    const due = addDaysISO(rec, Math.max(1, Math.ceil(respHours() / 24)));
    if (due && due !== getDate('rfq-due')) { setDate('rfq-due', due); dirty(); }
  }
  function setDate(id, iso) { const el = $(id); if (!el) return; if (window.BCDate) BCDate.setISO(el, iso || ''); else el.value = iso || ''; }
  function getDate(id) { const el = $(id); if (!el) return ''; return window.BCDate ? (BCDate.getISO(el) || '') : String(el.value || ''); }

  /* ── load / collect ── */
  function hasPricing(r) {
    if (!r) return false;
    if (Array.isArray(r.pricingItems) && r.pricingItems.length) return true;
    try { if (typeof ensurePricingVersions === 'function' && ensurePricingVersions(r).length) return true; } catch (e) {}
    return !!(r.quotationId || (r.quotationIds || []).length);
  }
  function load(r) {
    setupDates();
    S.type = TYPES.includes(r && r.requestType) ? r.requestType : 'product';
    S.lines = (r && Array.isArray(r.rfqLines) ? r.rfqLines : [])
      .map((l, i) => ({ lineId: l.lineId || newId(), kind: l.kind === 'service' ? 'service' : 'product', sortOrder: Number.isFinite(Number(l.sortOrder)) ? Number(l.sortOrder) : i + 1,
        productId: l.productId || '', code: l.code || '', desc: l.desc || '', qty: l.qty == null ? '' : l.qty, uom: l.uom || '', remarks: l.remarks || '' }))
      .sort((a, b) => a.sortOrder - b.sortOrder);
    S.locked = hasPricing(r);
    if (!S.locked) kinds().forEach(k => { if (!ofKind(k).length) S.lines.push(blank(k)); });
    const site = $('rfq-site'), dur = $('rfq-duration');
    if (site) site.value = (r && r.site) || '';
    if (dur) dur.value = (r && r.duration) || '';
    setDate('rfq-reqdate', (r && r.requiredDate) || '');
    S.origReceived = (r && r.date) || '';
    const hint = $('rfq-due-hint'); if (hint) hint.textContent = `· +${respHours()} h`;
    const rd = $('rfq-date'); if (rd) rd.title = `Today or up to ${backDays()} days back`;
    const note = $('rfq-num-note'); if (note) note.hidden = !!r;
    const sn = $('rfq-save-new-btn'); if (sn) sn.hidden = !!r;
    S.tab = kinds()[0];
    syncType(); render();
  }
  /** The lines to save: filled lines of the chosen type(s), numbered in display order. */
  function collect() {
    const keep = kinds();
    let order = 0;
    const rfqLines = [];
    keep.forEach(k => ofKind(k).filter(filled).forEach(l => {
      const q = Number(String(l.qty).replace(/,/g, ''));
      rfqLines.push({ lineId: l.lineId, kind: k, sortOrder: ++order, productId: l.productId || '', code: String(l.code || '').trim(), desc: String(l.desc || '').trim(),
        qty: Number.isFinite(q) ? q : 0, uom: String(l.uom || '').trim() || KIND[k].uomDefault, remarks: String(l.remarks || '').trim() });
    }));
    return { requestType: S.type, rfqLines, site: String($('rfq-site')?.value || '').trim(), requiredDate: getDate('rfq-reqdate'), duration: S.type === 'product' ? '' : String($('rfq-duration')?.value || '').trim() };
  }
  /** First problem as { title, message, focus } or null. */
  function validate() {
    const rec = getDate('rfq-date'), today = window.BCDate ? BCDate.today() : '';
    if (rec && today && rec > today) return { title: 'Date received is in the future', message: 'The RFQ cannot be received after today. Enter today’s date or an earlier one.', focus: $('rfq-date') };
    if (rec && rec < receivedMin()) return { title: 'Date received is too far back', message: `RFQs can be entered up to ${backDays()} days back (from ${window.BCDate.format(receivedMin())}). The allowance is set in Administration → Numbering & Defaults → Document Defaults.`, focus: $('rfq-date') };
    if (S.locked) return null;
    for (const k of kinds()) {
      const rows = ofKind(k);
      for (let i = 0; i < rows.length; i++) {
        const l = rows[i]; if (!filled(l)) continue;
        if (!String(l.desc || '').trim()) return bad(k, l, 'desc', `${KIND[k].tab} line ${i + 1} has no description`, 'Enter a description, or delete the line.');
        const q = Number(String(l.qty).replace(/,/g, ''));
        if (!(q > 0)) return bad(k, l, 'qty', `${KIND[k].tab} line ${i + 1} has no quantity`, 'Enter the quantity the customer asked for (more than 0).');
      }
    }
    const rd = $('rfq-reqdate');
    if (rd && window.BCDate && String(rd.value || '').trim() && BCDate.parse(rd.value) === null) return bad(null, null, null, 'Invalid date', 'Enter the required date as DD-MM-YYYY, or leave it empty.');
    return null;
  }
  function bad(kind, line, field, title, message) {
    if (kind) showTab(kind); else showTab('reqs');
    const focus = line ? document.querySelector(`#rfq-pane tr[data-line="${line.lineId}"] [data-f="${field}"]`) : $('rfq-reqdate');
    return { title, message, focus };
  }
  function dates() { return { received: getDate('rfq-date'), due: getDate('rfq-due') }; }
  function setDates(received, due) { setupDates(); setDate('rfq-date', received); setDate('rfq-due', due); }

  /* ── request type ── */
  function syncType() {
    document.querySelectorAll('#rfq-type-seg label').forEach(lb => { const on = lb.dataset.type === S.type; lb.classList.toggle('on', on); const i = lb.querySelector('input'); if (i) { i.checked = on; i.disabled = S.locked; } });
    $('rfq-type-seg')?.classList.toggle('is-locked', S.locked);
    const t = S.type;
    const set = (id, txt) => { const el = $(id); if (el) el.textContent = txt; };
    set('rfq-site-lbl', t === 'service' ? 'Site / location' : t === 'mixed' ? 'Delivery / site location' : 'Delivery location');
    set('rfq-reqdate-lbl', t === 'service' ? 'Required start' : t === 'mixed' ? 'Required by' : 'Required delivery');
    set('rfq-desc-lbl', t === 'service' ? 'Scope of work' : t === 'mixed' ? 'Scope of work / general requirements' : 'General requirements');
    const dw = $('rfq-duration-wrap'); if (dw) dw.hidden = t === 'product';
    const d = $('rfq-desc'); if (d) d.placeholder = t === 'product' ? 'General instructions, approved brands, standards, delivery conditions…' : 'Describe the work, site conditions, working hours, safety / permit needs…';
  }
  function setType(v) {
    if (!TYPES.includes(v) || v === S.type || S.locked) return;
    const goneKinds = (v === 'mixed' ? [] : ['product', 'service'].filter(k => k !== v));
    const losing = goneKinds.reduce((n, k) => n + ofKind(k).filter(filled).length, 0);
    const apply = () => {
      S.type = v; kinds().forEach(k => { if (!ofKind(k).length) S.lines.push(blank(k)); });
      S.tab = kinds()[0]; syncType(); render(); dirty();
    };
    if (losing && typeof window.bizcoreShowSafeDialog === 'function') {
      const what = goneKinds[0] === 'service' ? 'service' : 'item';
      window.bizcoreShowSafeDialog({ icon: 'ti-alert-triangle', title: `Change request type to ${v[0].toUpperCase() + v.slice(1)}?`,
        message: `This RFQ has ${losing} ${what} line${losing > 1 ? 's' : ''}.`,
        secondary: `They stay on screen if you switch back to ${S.type === 'mixed' ? 'Mixed' : S.type[0].toUpperCase() + S.type.slice(1)} or choose Mixed, but are not saved with a ${v} RFQ.`,
        buttons: [{ text: 'Keep current type', cls: 'secondary', action: () => syncType() }, { text: 'Change type', cls: 'primary', action: apply }] });
      return;
    }
    apply();
  }

  /* ── tabs ── */
  function tabs() {
    const t = kinds().map(k => [k, KIND[k].tab, ofKind(k).filter(filled).length]);
    const reqDone = !!(String($('rfq-desc')?.value || '').trim() || String($('rfq-site')?.value || '').trim() || getDate('rfq-reqdate'));
    t.push(['reqs', S.type === 'service' ? 'Scope of work' : S.type === 'mixed' ? 'Scope & requirements' : 'Requirements', reqDone ? '✓' : '']);
    let att = 0; try { att = (typeof rfqAttachment !== 'undefined' && rfqAttachment) ? 1 : 0; } catch (e) {}
    t.push(['att', 'Attachments', att || '']);
    return t;
  }
  function refreshTabs() {
    const host = $('rfq-tabs'); if (!host) return;
    const T = tabs(); if (!T.some(x => x[0] === S.tab)) S.tab = T[0][0];
    host.innerHTML = T.map(([k, t, n], i) => `<button type="button" class="rq-tb${S.tab === k ? ' on' : ''}" role="tab" aria-selected="${S.tab === k}" data-tab="${k}" title="${esc(t)} (Alt+${i + 1})">${esc(t)}${n !== '' ? `<span class="rq-n">${n}</span>` : ''}</button>`).join('');
    ['product', 'service', 'reqs', 'att'].forEach(k => { const p = $('rfq-panel-' + k); if (p) p.hidden = k !== S.tab; });
    const note = $('rfq-tab-note');
    if (note) note.textContent = S.locked ? 'Pricing has started — the lines are changed in Pricing.' : S.type === 'product' ? 'Lines are optional — an RFQ can be saved with requirements only.' : S.type === 'service' ? 'Service lines are optional — the scope of work can be enough.' : 'Products and services are kept as separate lists.';
  }
  function showTab(k) { S.tab = k; refreshTabs(); }

  /* ── lines ── */
  function lineRow(l, i, kind) {
    const K = KIND[kind], ro = S.locked ? ' readonly tabindex="-1"' : '';
    const src = l.productId ? 'm' : (filled(l) ? 'f' : '');
    return `<tr data-line="${l.lineId}" class="rq-lr"${S.locked ? '' : ' draggable="false"'}>
<td class="rq-h">${S.locked ? '' : '<span class="rq-drag" draggable="true" title="Drag to reorder (or Alt+↑ / Alt+↓)" aria-hidden="true">⋮⋮</span>'}</td>
<td class="rq-sl">${i + 1}</td>
<td class="rq-ds"><span class="rq-src ${src}" title="${src === 'm' ? 'From Item Master' + (l.code ? ' · ' + esc(l.code) : '') : src === 'f' ? 'Not in Item Master — kept on this RFQ only' : ''}"></span><input data-f="desc" value="${esc(l.desc)}" placeholder="${S.locked ? '' : esc(K.descPh)}" maxlength="500" autocomplete="off" aria-label="${esc(K.desc)}"${ro}></td>
<td class="rq-q"><input data-f="qty" type="text" inputmode="decimal" value="${esc(l.qty)}" aria-label="Quantity"${ro}></td>
<td class="rq-u"><input data-f="uom" value="${esc(l.uom)}" list="rfq-uoms-${kind}" maxlength="12" aria-label="${esc(K.uom)}"${ro}></td>
<td class="rq-r"><input data-f="remarks" value="${esc(l.remarks)}" placeholder="${S.locked ? '' : 'Optional'}" maxlength="300" aria-label="${esc(K.rem)}"${ro}></td>
<td class="rq-x">${S.locked ? '' : `<button type="button" class="rq-mv" data-act="up" title="Move up" aria-label="Move up">↑</button><button type="button" class="rq-mv" data-act="down" title="Move down" aria-label="Move down">↓</button><button type="button" class="rq-del" data-act="del" title="Delete line" aria-label="Delete line">✕</button>`}</td></tr>`;
  }
  function renderLines(kind) {
    const host = $('rfq-panel-' + kind); if (!host) return;
    const K = KIND[kind], rows = ofKind(kind), uoms = kind === 'service' ? SERVICE_UOMS : PRODUCT_UOMS;
    const foot = S.locked ? `<div class="rq-foot"><span class="rq-legend">${rows.length ? '' : 'No lines were entered on this RFQ.'}</span></div>`
      : `<div class="rq-foot"><button type="button" class="btn btn-secondary btn-sm" data-act="add">+ ${esc(K.add)}</button>${kind === 'product' ? '<button type="button" class="btn btn-sm rq-link" data-act="paste" title="Copy rows from Excel (description · qty · UOM) and paste">Paste from Excel</button>' : ''}<span class="rq-legend"><span><i class="rq-src m"></i>Item Master</span><span><i class="rq-src f"></i>Not in master (this RFQ only)</span><span>Enter on Qty adds the next line</span></span></div>`;
    host.innerHTML = `<table class="rq-lines" data-kind="${kind}"><thead><tr><th></th><th class="rq-sl">SL</th><th>${esc(K.desc)}</th><th class="rq-q">Qty</th><th>${esc(K.uom)}</th><th>${esc(K.rem)}</th><th></th></tr></thead>
<tbody>${rows.map((l, i) => lineRow(l, i, kind)).join('')}</tbody></table>${foot}<datalist id="rfq-uoms-${kind}">${uoms.map(u => `<option value="${u}"></option>`).join('')}</datalist>`;
    host.classList.toggle('is-locked', S.locked);
  }
  function render() { renderLines('product'); renderLines('service'); refreshTabs(); }
  function lineOf(el) { const tr = el.closest('tr[data-line]'); return tr ? S.lines.find(l => l.lineId === tr.dataset.line) : null; }
  function addLine(kind, focus = true) {
    if (S.locked) return;
    S.lines.push(blank(kind)); S.tab = kind; render(); dirty();
    if (focus) { const rows = document.querySelectorAll(`#rfq-panel-${kind} tr[data-line]`); const last = rows[rows.length - 1]; last?.querySelector('[data-f="desc"]')?.focus(); last?.scrollIntoView({ block: 'nearest' }); }
  }
  function deleteLine(l) {
    if (S.locked || !l) return;
    const k = l.kind;
    S.lines = S.lines.filter(x => x !== l);
    if (!ofKind(k).length) S.lines.push(blank(k));
    render(); dirty();
  }
  function move(l, dir, focusField) {
    if (S.locked || !l) return;
    const same = ofKind(l.kind), i = same.indexOf(l), j = i + dir;
    if (j < 0 || j >= same.length) return;
    const a = S.lines.indexOf(l), b = S.lines.indexOf(same[j]);
    [S.lines[a], S.lines[b]] = [S.lines[b], S.lines[a]];
    renderLines(l.kind); refreshTabs(); dirty();
    if (focusField) document.querySelector(`#rfq-pane tr[data-line="${l.lineId}"] [data-f="${focusField}"]`)?.focus();
  }
  function moveTo(l, target) {
    if (S.locked || !l || !target || l === target || l.kind !== target.kind) return;
    S.lines.splice(S.lines.indexOf(l), 1);
    S.lines.splice(S.lines.indexOf(target), 0, l);
    renderLines(l.kind); dirty();
  }
  function pasteRows(text, kind) {
    const rows = String(text || '').split(/\r?\n/).map(r => r.split('\t')).filter(c => c.some(x => String(x).trim()));
    if (!rows.length) return 0;
    // drop the empty line(s) at the end before adding
    S.lines = S.lines.filter(l => l.kind !== kind || filled(l));
    rows.forEach(c => {
      const [d, q, u, rem] = c.map(x => String(x || '').trim());
      const qn = Number(String(q || '').replace(/,/g, ''));
      S.lines.push({ ...blank(kind), desc: d, qty: Number.isFinite(qn) && q ? qn : '', uom: u || KIND[kind].uomDefault, remarks: rem || '' });
    });
    render(); dirty();
    return rows.length;
  }

  /* ── product / service search ── */
  let dd = null, ddLine = null, ddList = [], ddIdx = 0, ddInput = null;
  function closeDD() { dd?.remove(); dd = null; ddLine = null; ddInput = null; }
  function openDD(input) {
    const l = lineOf(input); if (!l || S.locked) return;
    const q = input.value.trim().toLowerCase();
    if (!q) { closeDD(); return; }
    const words = q.split(/\s+/).filter(Boolean);
    ddList = masterProducts().filter(p => p && !p.deleted && words.every(w => `${p.code || ''} ${p.name || ''} ${p.brand || ''} ${p.model || ''}`.toLowerCase().includes(w))).slice(0, 8);
    ddIdx = -1; ddLine = l; ddInput = input;
    if (!dd) { dd = document.createElement('div'); dd.className = 'rq-dd'; dd.setAttribute('role', 'listbox'); document.body.appendChild(dd); dd.addEventListener('mousedown', e => { e.preventDefault(); const it = e.target.closest('[data-i]'); if (it) choose(Number(it.dataset.i)); }); }
    // V270.2.8: the first choice keeps the typed text (Enter); ↓ moves to the Item Master matches
    dd.innerHTML = `<div class="rq-ddi rq-ddfree on" data-i="-1" role="option">Keep “${esc(input.value.trim())}” as typed <small>· not in Item Master</small></div>`
      + (ddList.length ? '<div class="rq-ddh">Item Master</div>' : '')
      + ddList.map((p, i) => `<div class="rq-ddi" data-i="${i}" role="option"><span class="rq-ddn">${esc(p.name || '')}${p.brand ? ` <small>· ${esc(p.brand)}</small>` : ''}</span><small>${esc(p.uom || '')}</small></div>`).join('');
    const r = input.getBoundingClientRect();
    dd.style.left = Math.max(8, Math.min(r.left, window.innerWidth - 400)) + 'px';
    const below = window.innerHeight - r.bottom > 260;
    dd.style.top = below ? (r.bottom + 2) + 'px' : ''; dd.style.bottom = below ? '' : (window.innerHeight - r.top + 2) + 'px';
  }
  function highlight() { if (!dd) return; [...dd.querySelectorAll('[data-i]')].forEach(el => { const on = Number(el.dataset.i) === ddIdx; el.classList.toggle('on', on); if (on) el.scrollIntoView({ block: 'nearest' }); }); }
  function choose(i) {
    const l = ddLine, input = ddInput; if (!l) return;
    if (i >= 0 && ddList[i]) {
      const p = ddList[i];
      Object.assign(l, { productId: String(p.id || ''), code: p.code || '', desc: p.name || '', uom: p.uom || l.uom || KIND[l.kind].uomDefault });
    } else {
      Object.assign(l, { productId: '', code: '', desc: String(input?.value || '').trim() });
    }
    closeDD(); renderLines(l.kind); refreshTabs(); dirty();
    const q = document.querySelector(`#rfq-pane tr[data-line="${l.lineId}"] [data-f="qty"]`); q?.focus(); q?.select?.();
  }

  /* ── events (delegated, once) ── */
  function bind() {
    const pane = $('rfq-pane'); if (!pane || pane.dataset.rqBound) return; pane.dataset.rqBound = '1';
    pane.addEventListener('input', e => {
      const f = e.target.dataset && e.target.dataset.f; if (!f) { if (e.target.closest('#rfq-panel-reqs')) refreshTabs(); return; }
      const l = lineOf(e.target); if (!l || S.locked) return;
      l[f] = e.target.value;
      if (f === 'desc') {
        // V270.2.8: the description is also the Item Master search. A line taken from the master keeps its link while
        // its description is edited; clearing the description removes the link (then typing searches again).
        if (!String(l.desc).trim()) { l.productId = ''; l.code = ''; closeDD(); }
        else if (!l.productId) { if (String(l.desc).trim().length >= 2) openDD(e.target); else closeDD(); }
      }
      if (f === 'desc') { const src = e.target.closest('tr').querySelector('.rq-src'); if (src) { src.className = 'rq-src ' + (l.productId ? 'm' : (filled(l) ? 'f' : '')); } refreshTabs(); }
    });
    pane.addEventListener('focusout', e => {
      if (e.target.dataset && e.target.dataset.f === 'desc') { const el = e.target; setTimeout(() => { if (ddInput === el && document.activeElement !== el) closeDD(); }, 120); }
    });
    pane.addEventListener('keydown', e => {
      const t = e.target, f = t.dataset && t.dataset.f, l = f ? lineOf(t) : null;
      if (f === 'desc' && dd) {
        const n = ddList.length;
        if (e.key === 'ArrowDown') { e.preventDefault(); ddIdx = Math.min(n - 1, ddIdx + 1); highlight(); return; }
        if (e.key === 'ArrowUp') { e.preventDefault(); ddIdx = Math.max(-1, ddIdx - 1); highlight(); return; }
        if (e.key === 'Enter') { e.preventDefault(); choose(ddIdx); return; }
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeDD(); return; }
      }
      if (!l || S.locked) return;
      if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); move(l, e.key === 'ArrowUp' ? -1 : 1, f); return; }
      if (f === 'qty' && e.key === 'Enter') {
        e.preventDefault();
        const same = ofKind(l.kind), i = same.indexOf(l);
        if (i === same.length - 1) addLine(l.kind); else document.querySelector(`#rfq-pane tr[data-line="${same[i + 1].lineId}"] [data-f="desc"]`)?.focus();
      }
    });
    pane.addEventListener('click', e => {
      const b = e.target.closest('[data-act]'); if (!b || S.locked) return;
      const panel = b.closest('[id^="rfq-panel-"]'), kind = panel ? panel.id.replace('rfq-panel-', '') : 'product';
      const act = b.dataset.act, l = lineOf(b);
      if (act === 'add') addLine(kind);
      else if (act === 'del') deleteLine(l);
      else if (act === 'up') move(l, -1);
      else if (act === 'down') move(l, 1);
      else if (act === 'paste') pasteFromClipboard(kind);
    });
    pane.addEventListener('paste', e => {
      const t = e.target; if (!t.dataset || !['desc', 'remarks'].includes(t.dataset.f) || S.locked) return;
      const text = e.clipboardData && e.clipboardData.getData('text/plain');
      if (text && (text.includes('\t') || text.trim().includes('\n'))) { e.preventDefault(); const n = pasteRows(text, lineOf(t)?.kind || 'product'); if (n && typeof showToast === 'function') showToast(`${n} line${n > 1 ? 's' : ''} pasted`, 'success'); }
    });
    // drag to reorder (by the ⋮⋮ handle)
    let dragLine = null;
    pane.addEventListener('dragstart', e => { const h = e.target.closest && e.target.closest('.rq-drag'); if (!h) return; dragLine = lineOf(h); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', dragLine?.lineId || ''); } catch (x) {} h.closest('tr').classList.add('is-drag'); });
    pane.addEventListener('dragover', e => { if (!dragLine) return; const tr = e.target.closest && e.target.closest('tr[data-line]'); if (tr) e.preventDefault(); });
    pane.addEventListener('drop', e => { if (!dragLine) return; e.preventDefault(); const tr = e.target.closest && e.target.closest('tr[data-line]'); const target = tr && S.lines.find(x => x.lineId === tr.dataset.line); moveTo(dragLine, target); dragLine = null; });
    pane.addEventListener('dragend', () => { dragLine = null; pane.querySelectorAll('.is-drag').forEach(x => x.classList.remove('is-drag')); });
    $('rfq-tabs')?.addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) showTab(b.dataset.tab); });
    // keyboard: Alt+N add line, Alt+1…4 tabs (only while the RFQ form is open)
    document.addEventListener('keydown', e => {
      const m = $('rfq-modal'); if (!m || !m.classList.contains('open') || !e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); const k = (S.tab === 'product' || S.tab === 'service') ? S.tab : kinds()[0]; addLine(k); return; }
      const n = Number(e.key); if (n >= 1 && n <= 4) { const T = tabs(); if (T[n - 1]) { e.preventDefault(); showTab(T[n - 1][0]); } }
    });
    window.addEventListener('resize', closeDD);
    $('rfq-pane')?.addEventListener('scroll', e => { if (e.target === $('rfq-pane')) closeDD(); });   // not when text scrolls inside an input
  }
  async function pasteFromClipboard(kind) {
    let text = '';
    try { text = await navigator.clipboard.readText(); } catch (e) {}
    if (!text) { if (typeof showToast === 'function') showToast('Copy rows in Excel (description · qty · UOM), then press Ctrl+V in a Description cell', 'success'); return; }
    const n = pasteRows(text, kind);
    if (typeof showToast === 'function') showToast(n ? `${n} line${n > 1 ? 's' : ''} pasted` : 'Nothing to paste', n ? 'success' : 'error');
  }

  window.BCRfq = { load, collect, validate, dates, setDates, setType, showTab, refreshTabs, hasPricing, _state: S, _pasteRows: pasteRows };
  window.rfqSetType = setType;
  window.rfqRefreshTabs = refreshTabs;
  bind();
  if (!document.getElementById('rfq-pane')) document.addEventListener('DOMContentLoaded', bind);
})();
