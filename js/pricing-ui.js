/* ═══════════════════════════════════════════════════════════════
   V270.1 — Pricing screen (docs/V270_1_PRICING.md)
   The pieces of the approved design (PR_29 – PR_44) that sit around the grid in js/app.js:
     tabs · Internal Note marks · ← Back (Alt+←) and the "Leave Without Saving?" dialog · line ⋮ menu (insert, duplicate,
     move, line details, lock sell, delete with confirmation + Undo, Ctrl+Del) · Last Paid / Last Quoted references
     (click or F2) · phone line cards and cost cards · Additional Costs picker and ⋮ menu · Vendor Quotes drop zone ·
     the primary supplier check (Supplier Master only).
   Loaded after js/app.js. Nothing here writes to the database: Save / Convert stay in app.js.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = v => (typeof escapeHtml === 'function' ? escapeHtml(String(v ?? '')) : String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const isPhone = () => window.matchMedia('(max-width:760px)').matches;
  const modalOpen = () => !!$('pricing-modal')?.classList.contains('open');
  const rowsAll = () => [...document.querySelectorAll('#pricing-tbody tr:not(.pricing-quick-add-row)')];
  const rowById = id => rowsAll().find(r => r.dataset.lineId === id);
  const costRows = () => [...document.querySelectorAll('#internal-costs-tbody tr')];
  const costByKey = k => costRows().find(r => r.dataset.costKey === k);
  const dec = () => (typeof pricingDecimals === 'function' ? pricingDecimals() : 2);
  const fmt = n => formatNumber(Number(n) || 0, dec());
  const dmy = iso => (window.BCDate ? BCDate.format(String(iso || '').slice(0, 10)) : String(iso || '')) || '—';
  const val = (tr, role) => tr?.querySelector(`[data-role="${role}"]`)?.value ?? '';
  const low = v => String(v || '').trim().toLowerCase();

  /* ── tabs, note marks ── */
  function prShowTab(name) {
    document.querySelectorAll('#pr-tabs .pr-tb').forEach(b => { const on = b.dataset.tab === name; b.classList.toggle('on', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
    document.querySelectorAll('#pricing-modal .pr-panel').forEach(p => p.classList.toggle('on', p.dataset.panel === name));
    closePop();
    if (name === 'costs') { fillCostPick(); renderCostCards(); }
    if (name === 'items') renderCards();
    if (name === 'notes') setTimeout(() => $('pricing-internal-notes')?.focus({ preventScroll: true }), 30);
  }
  function prUpdateNoteMarks() {
    const has = !!$('pricing-internal-notes')?.value.trim();
    if ($('pr-note-dot')) $('pr-note-dot').hidden = !has;
    if ($('pr-note-pill')) $('pr-note-pill').hidden = !has;
  }

  /* ── dialogs (on the page body, above the Pricing window) ── */
  let dlg = null;
  function closeDialog() { if (!dlg) return; dlg.dim.remove(); dlg.box.remove(); const f = dlg.returnFocus; dlg = null; try { f && f.focus && f.focus({ preventScroll: true }); } catch (_) {} }
  function dialog({ title, html, buttons, wide }) {
    closeDialog(); closePop();
    const dim = document.createElement('div'); dim.className = 'pr-dim';
    const box = document.createElement('div'); box.className = 'pr-cf' + (wide ? ' pr-cf-wide' : '');
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', title);
    box.innerHTML = `<h3>${title}</h3>${html || ''}<div class="pr-cf-bt"></div>`;
    const bt = box.querySelector('.pr-cf-bt');
    dlg = { dim, box, returnFocus: document.activeElement, cancel: () => { closeDialog(); buttons[0]?.action?.(); } };
    buttons.forEach((b, i) => {
      const el = document.createElement('button'); el.type = 'button'; el.className = 'pr-btn ' + (b.cls || ''); el.textContent = b.text;
      // the values typed in the dialog are read before it closes, and handed to the action
      el.addEventListener('click', () => { const v = {}; box.querySelectorAll('input[id],select[id],textarea[id]').forEach(f => { v[f.id] = f.value; }); closeDialog(); b.action?.(v); });
      bt.appendChild(el); if (b.default) setTimeout(() => el.focus(), 0);
    });
    dim.addEventListener('mousedown', () => dlg && dlg.cancel());
    document.body.append(dim, box);
    if (!buttons.some(b => b.default)) setTimeout(() => (box.querySelector('input,select,textarea') || bt.lastElementChild)?.focus(), 0);
    return box;
  }

  /* ── save without the extra "Save pricing?" question (the person already chose Save & …) ── */
  async function saveNow() {
    if (pricingSaveInProgress || pricingConvertInProgress) return false;
    if (!validatePricingHeaderFields()) return false;
    if (!validatePricingPrices()) return false;
    const rule = checkPricingBusinessRules(true); if (!rule.ok) return false;
    if (rule.needsApproval && !(await obtainPricingManagerApproval())) return false;
    pricingSaveInProgress = true; updatePricingActionButtons();
    try { return await savePricing(); } finally { pricingSaveInProgress = false; updatePricingActionButtons(); }
  }
  function prConfirmLeave({ goingBack, leave, onDone }) {
    const r = rfqs.find(x => x.id === pricingRFQId), target = backTarget();
    const where = goingBack ? `Going back to <b>${esc(target.kind === 'quote' ? target.label : (r?.rfqNo || 'the RFQ'))}</b> now` : 'Closing now';
    dialog({
      title: 'Leave Without Saving?',
      html: `<p>This pricing has unsaved changes. ${where} would lose them.</p>`,
      buttons: [
        { text: 'Stay', action: () => onDone && onDone() },
        { text: goingBack ? 'Discard & Go Back' : 'Discard & Close', cls: 'pr-danger-o', action: () => { onDone && onDone(); leave(); } },
        { text: goingBack ? 'Save & Go Back' : 'Save & Close', cls: 'pr-pri', default: true, action: async () => { onDone && onDone(); if (await saveNow()) leave(); } },
      ],
    });
  }
  function backTarget() {
    const hist = (typeof modalNavHistory !== 'undefined' ? modalNavHistory : []);
    const entry = [...hist].reverse().find(x => x.to === 'pricing-modal');
    if (navFromQuoteId && (!entry || entry.from !== 'rfq-view-modal')) { const q = quotations.find(x => x.id === navFromQuoteId); return { kind: 'quote', id: navFromQuoteId, label: q?.qno || 'the quotation' }; }
    return { kind: 'rfq', id: pricingRFQId };
  }
  function prRequestBack() {
    if (!modalOpen() || dlg) return;
    const t = backTarget();
    const go = () => {
      if (typeof window.bizcorePerformClose === 'function') window.bizcorePerformClose('pricing-modal', true); else closeModal('pricing-modal');
      if (t.kind === 'quote') viewQuotation(t.id); else if (t.id) viewRFQ(t.id);
    };
    if (!pricingChangedSinceOpen) { go(); return; }
    prConfirmLeave({ goingBack: true, leave: go });
  }

  /* ── popover (PC / tablet) or bottom sheet (phone) ── */
  let pop = null;
  function closePop() { if (!pop) return; pop.el.remove(); pop.dim && pop.dim.remove(); pop.anchor?.classList.remove('is-open'); pop = null; }
  function openPop(anchor, html, { title, width = 240, onClick } = {}) {
    closePop();
    const phone = isPhone(), el = document.createElement('div');
    el.className = phone ? 'pr-sheet' : 'pr-pop';
    el.innerHTML = phone ? `<div class="pr-grab"></div>${title ? `<div class="pr-sheet-t">${title}</div>` : ''}${html}<div class="pr-sheet-close"><button type="button" class="pr-btn" data-act="__close">Close</button></div>` : html;
    let dim = null;
    if (phone) { dim = document.createElement('div'); dim.className = 'pr-dim pr-dim-pop'; dim.addEventListener('mousedown', closePop); document.body.appendChild(dim); }
    document.body.appendChild(el);
    if (!phone) {
      el.style.width = width + 'px';
      const b = anchor.getBoundingClientRect(), h = el.offsetHeight, w = el.offsetWidth;
      el.style.left = Math.max(8, Math.min(b.right - w, window.innerWidth - w - 8)) + 'px';
      // below the button, or above it when there's no room; always inside the screen (8 px)
      let top = b.bottom + h + 8 < window.innerHeight ? b.bottom + 4 : b.top - h - 4;
      el.style.top = Math.max(8, Math.min(top, window.innerHeight - h - 8)) + 'px';
    }
    anchor.classList.add('is-open');
    pop = { el, dim, anchor };
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
    setTimeout(() => el.querySelector('button:not([disabled])')?.focus({ preventScroll: true }), 0);
    return el;
  }
  const mi = (act, label, { key = '', cls = '', disabled = false } = {}) => `<button type="button" class="pr-mi ${cls}" data-act="${act}"${disabled ? ' disabled' : ''}><span>${label}</span>${key ? `<span class="pr-k">${key}</span>` : ''}</button>`;
  document.addEventListener('mousedown', e => { if (pop && !pop.el.contains(e.target) && !pop.anchor.contains(e.target)) closePop(); }, true);
  window.addEventListener('resize', () => { closePop(); renderCardsSoon(); });
  window.addEventListener('scroll', e => { if (pop && !pop.el.contains(e.target) && !pop.dim) closePop(); }, true);

  /* ── line ⋮ menu ── */
  const hostRow = btn => btn.closest('tr') || rowById(btn.closest('[data-line]')?.dataset.line);
  function prRowMenu(btn) {
    const tr = hostRow(btn); if (!tr) return;
    if (pop && pop.anchor === btn) { closePop(); return; }
    const rows = rowsAll(), i = rows.indexOf(tr), locked = tr.querySelector('[data-role="sell-lock"]')?.classList.contains('is-locked');
    const html = mi('above', 'Insert Line Above') + mi('dup', 'Duplicate Line') + mi('up', 'Move Up', { key: 'Alt+↑', disabled: i <= 0 }) + mi('down', 'Move Down', { key: 'Alt+↓', disabled: i >= rows.length - 1 })
      + mi('details', 'Line Details<span class="pr-msub">Quote Ref. · Supplier Note</span>') + mi('lock', locked ? 'Unlock Sell Price' : 'Lock Sell Price')
      + '<div class="pr-sepm"></div>' + mi('del', '🗑 Delete Line', { key: 'Ctrl+Del', cls: 'pr-mi-del' });
    const desc = val(tr, 'desc') || 'New line';
    openPop(btn, html, {
      width: 272, title: `Line ${i + 1} · ${esc(desc.length > 38 ? desc.slice(0, 38) + '…' : desc)}`,
      onClick: act => { closePop(); ({ above: () => insertAbove(tr), dup: () => duplicate(tr), up: () => move(tr, -1), down: () => move(tr, 1), details: () => lineDetails(tr), lock: () => togglePricingSellLock(tr.querySelector('[data-role="sell-lock"]')), del: () => confirmDelete(tr) })[act]?.(); },
    });
  }
  function rowItem(tr) {
    return { productId: tr.dataset.productId || '', code: val(tr, 'code'), desc: val(tr, 'desc'), qty: parsePricingNumber(val(tr, 'qty')) || 1, uom: val(tr, 'uom') || 'Pcs',
      supplierName: val(tr, 'supplier'), supRef: val(tr, 'supref'), buy: val(tr, 'buy') === '' ? '' : parsePricingNumber(val(tr, 'buy')), markup: val(tr, 'markup'),
      sell: val(tr, 'sell') === '' ? '' : parsePricingNumber(val(tr, 'sell')), sellLocked: !!tr.querySelector('[data-role="sell-lock"]')?.classList.contains('is-locked'), supNote: tr.dataset.supNote || '' };
  }
  function focusLine(tr, role) { setTimeout(() => { if (isPhone()) { document.querySelector(`#pr-cards [data-line="${tr.dataset.lineId}"]`)?.scrollIntoView({ block: 'nearest' }); return; } const f = tr.querySelector(`[data-role="${role}"]`); f?.focus(); f?.select?.(); tr.scrollIntoView({ block: 'nearest' }); }, 40); }
  function insertAbove(tr) {
    const i = rowsAll().indexOf(tr); const nr = addPricingRow({});
    movePricingRowElement(nr, i); renumberPricingRows(); markPricingDirty(); calcPricingSummary(); focusLine(nr, 'desc');
  }
  function duplicate(tr) {
    const i = rowsAll().indexOf(tr); const nr = addPricingRow(rowItem(tr));
    movePricingRowElement(nr, i + 1); renumberPricingRows(); markPricingDirty(); calcPricingSummary();
    toast(`Line ${i + 1} duplicated as line ${i + 2}`); focusLine(nr, 'buy');
  }
  function move(tr, d) {
    const rows = rowsAll(), i = rows.indexOf(tr), t = i + d; if (i < 0 || t < 0 || t >= rows.length) return;
    const was = pricingDirty; if (movePricingRowElement(tr, t, null)) completePricingReorder(tr, null, was);
  }
  function confirmDelete(tr) {
    const rows = rowsAll(), i = rows.indexOf(tr); if (i < 0) return;
    const it = rowItem(tr), sell = (Number(it.sell) || 0) * (Number(it.qty) || 0);
    dialog({
      title: `Delete Line ${i + 1}?`,
      html: `<p>The line is removed from this pricing version. Line numbers, totals, additional cost shares, Profit, Markup % and Margin % are worked out again at once.</p>
        <div class="pr-cf-it">${esc(it.desc || 'No description')}<small>${esc([`${formatQuantity(it.qty)} ${it.uom}`, it.supplierName || 'No supplier', 'Sell ' + fmt(sell)].join(' · '))}</small></div>
        <p class="pr-cf-note">Nothing is saved until you press Save — Close without saving brings it back. Saved versions, quotations and purchase records are not changed.</p>`,
      buttons: [{ text: 'Cancel' }, { text: 'Delete Line', cls: 'pr-danger', default: true, action: () => deleteLine(tr) }],
    });
  }
  function deleteLine(tr) {
    const rows = rowsAll(), i = rows.indexOf(tr), next = rows[i + 1] || null;
    tr.remove(); ensurePricingQuickAddRow(); renumberPricingRows(); markPricingDirty(); calcPricingSummary();
    toast(`Line ${i + 1} deleted · totals updated`, 'Undo', () => {
      const tb = $('pricing-tbody'); if (!tb) return;
      const anchor = next && next.isConnected ? next : tb.querySelector('.pricing-quick-add-row');
      tb.insertBefore(tr, anchor || null); renumberPricingRows(); markPricingDirty(); calcPricingSummary();
    });
    const after = rowsAll()[Math.min(i, rowsAll().length - 1)];
    if (after && !isPhone()) after.querySelector('[data-role="desc"]')?.focus({ preventScroll: true });
  }
  function lineDetails(tr) {
    const it = rowItem(tr), opts = pricingSupplierOptionsHtml();
    const box = dialog({
      title: `Line ${rowsAll().indexOf(tr) + 1} · Details`, wide: true,
      html: `<div class="pr-cf-it">${esc(it.desc || 'No description')}</div>
        <div class="pr-form"><label>Quantity<input id="prd-qty" class="pr-fi" inputmode="decimal" value="${esc(formatQuantity(it.qty))}"></label>
        <label>Unit<input id="prd-uom" class="pr-fi" value="${esc(it.uom)}"></label>
        <label class="pr-wide">Supplier<select id="prd-sup" class="pr-fi">${opts}</select></label>
        <label class="pr-wide">Supplier Quote Ref.<input id="prd-ref" class="pr-fi" value="${esc(it.supRef)}" placeholder="Quote no. for this line"></label>
        <label class="pr-wide">Supplier Note <span class="pr-muted">(internal)</span><textarea id="prd-note" class="pr-fi" rows="3" maxlength="300" placeholder="e.g. price valid 7 days, delivery 2 weeks">${esc(it.supNote)}</textarea></label></div>`,
      buttons: [{ text: 'Cancel' }, {
        text: 'Apply', cls: 'pr-pri', action: v => {
          const q = tr.querySelector('[data-role="qty"]'), u = tr.querySelector('[data-role="uom"]'), s = tr.querySelector('[data-role="supplier"]'), r = tr.querySelector('[data-role="supref"]');
          const nq = parsePricingNumber(v['prd-qty']); if (q && nq > 0) q.value = formatQuantity(nq);
          if (u) u.value = String(v['prd-uom'] || '').trim() || 'Pcs';
          if (s) s.value = v['prd-sup'] || '';
          if (r) r.value = String(v['prd-ref'] || '').trim();
          tr.dataset.supNote = String(v['prd-note'] || '').trim();
          prShowLineRef(tr); markPricingDirty(); calcPricingRow(q || tr.querySelector('[data-role="buy"]')); renderCardsSoon();
        },
      }],
    });
    const sel = box.querySelector('#prd-sup');
    if (it.supplierName && ![...sel.options].some(o => o.value === it.supplierName)) sel.insertAdjacentHTML('beforeend', `<option value="${esc(it.supplierName)}">${esc(it.supplierName)} (not in Supplier Master)</option>`);
    sel.value = it.supplierName || '';
  }
  function prShowLineRef(tr) {
    const el = tr?.querySelector('.pr-lref'); if (!el) return;
    const ref = val(tr, 'supref'), note = tr.dataset.supNote || '';
    el.innerHTML = [ref ? 'Ref ' + esc(ref) : '', note ? '<span class="pr-notei" aria-label="Supplier note">✎ Note</span>' : ''].filter(Boolean).join(' · ');
    el.title = [ref && 'Supplier quote ref. ' + ref, note && 'Note: ' + note].filter(Boolean).join('\n');
    el.hidden = !ref && !note;
  }

  /* ── toast with Undo ── */
  let toastTimer = null;
  function toast(text, actionText, action) {
    document.querySelectorAll('.pr-toast').forEach(t => t.remove()); clearTimeout(toastTimer);
    const t = document.createElement('div'); t.className = 'pr-toast'; t.setAttribute('role', 'status');
    t.innerHTML = `<span>${esc(text)}</span>${actionText ? `<button type="button">${esc(actionText)}</button>` : ''}`;
    if (actionText) t.querySelector('button').addEventListener('click', () => { t.remove(); action && action(); });
    document.body.appendChild(t); toastTimer = setTimeout(() => t.remove(), actionText ? 7000 : 3500);
  }

  /* ── Last Paid / Last Quoted ── */
  const refCache = new Map();
  function paidHistory(tr) {
    const lib = window.BizCorePI; if (!lib || !lib.core) return [];
    let key; try { key = lib.core.itemKeyOf({ productId: tr.dataset.productId, code: val(tr, 'code'), desc: val(tr, 'desc'), uom: val(tr, 'uom') }); } catch (_) { return []; }
    const voided = lib.core.PURCHASE_STATUS?.voided || 'voided', out = [];
    (lib.invoices || []).forEach(pi => { if (!pi || pi.status === voided) return; (pi.lines || []).forEach(l => { if (l.itemKey === key && Number(l.unitCost) > 0) out.push({ price: Number(l.unitCost), no: pi.piNo || '', date: pi.date || '', supplier: pi.supplierName || '' }); }); });
    const rec = lib.lastPrices && lib.lastPrices.get ? lib.lastPrices.get(key) : null;
    if (rec && !rec.stale && Number(rec.unitCost) > 0 && !out.some(x => x.no && x.no === rec.piNo)) out.push({ price: Number(rec.unitCost), no: rec.piNo || '', date: rec.date || '', supplier: rec.supplierName || '' });
    out.sort((a, b) => (String(b.date) + '|' + b.no).localeCompare(String(a.date) + '|' + a.no));
    const seen = new Set(); return out.filter(x => { const k = x.no + '|' + x.price; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 3);
  }
  const QUOTED = new Set(['Sent', 'Won', 'Lost', 'Expired']);   // Draft, Revised (replaced) and cancelled quotations are not counted
  function quoteHistory(tr) {
    const r = rfqs.find(x => x.id === pricingRFQId), pid = tr.dataset.productId || '', code = low(val(tr, 'code')), desc = low(val(tr, 'desc'));
    if (!pid && !code && !desc) return [];
    const custId = r?.custId || '', company = low(r?.company), out = [];
    (typeof quotations !== 'undefined' ? quotations : []).forEach(q => {
      if (!q || !QUOTED.has(q.status)) return;
      (q.items || []).forEach(it => {
        if (it.lineType && it.lineType !== 'item') return;
        const up = Number(it.up); if (!(up > 0)) return;
        const hit = pid && it.prodId ? String(it.prodId) === pid : ((code && low(it.code) === code) || (desc && low(it.desc) === desc));
        if (!hit) return;
        const same = (custId && q.custId === custId) || (!!company && low(q.company) === company);
        out.push({ price: up, qno: q.qno || '', date: q.date || '', customer: q.company || '', status: q.status, same });
      });
    });
    out.sort((a, b) => (b.same - a.same) || String(b.date).localeCompare(String(a.date)) || String(b.qno).localeCompare(String(a.qno)));
    return out.slice(0, 3);
  }
  function refTexts(d) {
    const p = d.paid[0], q = d.quoted[0];
    return {
      buy: p ? `Last Paid <b>${esc(fmt(p.price))}</b>` : 'No Purchase Yet',
      buyShort: p ? `Last <b>${esc(fmt(p.price))}</b>` : '—',
      buyTitle: p ? `${p.no} · ${dmy(p.date)} · ${p.supplier} — click (or F2) for the last prices` : 'Not bought before',
      sell: q ? `${q.same ? 'Last Quoted' : 'Other Customer'} <b>${esc(fmt(q.price))}</b> (${esc(q.status)})` : 'Not Quoted Yet',
      sellShort: q ? `${q.same ? 'Last' : 'Other'} <b>${esc(fmt(q.price))}</b> (${esc(q.status)})` : '—',
      sellTitle: q ? `${q.qno} · ${dmy(q.date)} · ${q.customer} · ${q.status}${q.same ? '' : ' — another customer'} — click (or F2) for the last quotations` : 'Not quoted before',
    };
  }
  function paintRefs(tr, d) {
    const t = refTexts(d);
    const b = tr.querySelector('.pr-ref[data-ref="buy"]'), s = tr.querySelector('.pr-ref[data-ref="sell"]');
    if (b) { b.innerHTML = '<span>' + t.buy + '</span>'; b.title = t.buyTitle; b.classList.toggle('none', !d.paid.length); b.classList.toggle('other', false); }
    if (s) { s.innerHTML = '<span>' + t.sell + '</span>'; s.title = t.sellTitle; s.classList.toggle('none', !d.quoted.length); s.classList.toggle('other', !!d.quoted[0] && !d.quoted[0].same); }
  }
  function prRefreshRefs(tr) { if (!tr) return; const d = { paid: paidHistory(tr), quoted: quoteHistory(tr) }; refCache.set(tr.dataset.lineId, d); paintRefs(tr, d); return d; }
  let refTimer = null;
  function refreshAllRefsSoon() { clearTimeout(refTimer); refTimer = setTimeout(() => { if (!modalOpen()) return; rowsAll().forEach(prRefreshRefs); syncCards(); }, 250); }
  function prOpenRef(btn) {
    const tr = hostRow(btn); if (!tr) return;
    if (pop && pop.anchor === btn) { closePop(); return; }
    const kind = btn.dataset.ref, d = refCache.get(tr.dataset.lineId) || prRefreshRefs(tr), list = kind === 'buy' ? d.paid : d.quoted;
    const desc = val(tr, 'desc') || 'this item';
    let html;
    if (!list.length) html = `<div class="pr-rf-empty">${kind === 'buy' ? 'No posted purchase invoice for this item yet.' : 'Not quoted before (sent, won, lost or expired quotations).'}</div>`;
    else html = list.map((x, i) => kind === 'buy'
      ? `<div class="pr-rf"><div class="pr-rf-m"><b>${esc(fmt(x.price))}</b><span>${esc(x.no || 'Last price')} · ${esc(dmy(x.date))}</span><small>${esc(x.supplier || '')}</small></div><button type="button" class="pr-btn pr-use" data-act="use" data-i="${i}">Use</button></div>`
      : `<div class="pr-rf"><div class="pr-rf-m"><b>${esc(fmt(x.price))}</b><span>${esc(x.qno)} · ${esc(dmy(x.date))} <em class="pr-st pr-st-${esc(low(x.status))}">${esc(x.status)}</em></span><small>${esc(x.customer)}${x.same ? '' : ' <i class="pr-oc">Other Customer</i>'}</small></div><button type="button" class="pr-btn pr-use" data-act="use" data-i="${i}">Use</button></div>`).join('');
    const head = `<div class="pr-rf-h">${kind === 'buy' ? 'Last Paid' : 'Last Quoted'} — ${esc(desc.length > 34 ? desc.slice(0, 34) + '…' : desc)}</div>`;
    const foot = `<div class="pr-rf-f">${kind === 'buy' ? 'From posted purchase invoices, newest first.' : 'This customer first, then others · Draft, revised and cancelled quotations are not counted.'}</div>`;
    openPop(btn, head + html + foot, {
      width: 320, title: kind === 'buy' ? 'Last Paid' : 'Last Quoted',
      onClick: (act, b) => {
        if (act !== 'use') return;
        const x = list[Number(b.dataset.i)]; if (!x) return;
        closePop();
        const inp = tr.querySelector(`[data-role="${kind}"]`); if (!inp) return;
        inp.value = formatNumber(x.price, dec());
        if (kind === 'buy') calcPricingRow(inp); else calcFromSell(inp);
        markPricingDirty(); syncCards();
        if (!isPhone()) inp.focus({ preventScroll: true });
      },
    });
  }

  /* ── phone: line cards (each card edits its line in the grid, which stays the record) ── */
  let cardsQueued = false;
  function renderCardsSoon() { if (cardsQueued) return; cardsQueued = true; requestAnimationFrame(() => { cardsQueued = false; renderCards(); renderCostCards(); }); }
  function cardHtml(tr) {
    const id = esc(tr.dataset.lineId), n = tr.querySelector('.pricing-line-number')?.textContent || '', desc = val(tr, 'desc');
    return `<div class="pr-pc" data-line="${id}">
      <div class="pr-pc-t"><div class="pr-pc-d"><span class="pr-pc-n">${esc(n)}</span> · <span data-c="desc">${desc ? esc(desc) : '<i class="pr-muted">No description</i>'}</span><small data-c="sub"></small></div><button type="button" class="pr-pc-m" onclick="prRowMenu(this)" aria-label="Line actions">⋮</button></div>
      <div class="pr-g3"><div><label>Buy</label><input class="pr-inp" data-proxy="buy" inputmode="decimal" aria-label="Buy price"><button type="button" class="pr-ref" data-ref="buy" onclick="prOpenRef(this)"></button></div>
        <div><label>Markup On Buy %</label><input class="pr-inp" data-proxy="markup" inputmode="decimal" aria-label="Markup on buy %"></div>
        <div><label>Sell</label><input class="pr-inp" data-proxy="sell" inputmode="decimal" aria-label="Sell price"><button type="button" class="pr-ref" data-ref="sell" onclick="prOpenRef(this)"></button></div></div>
      <div class="pr-pc-f"><span data-c="total"></span><span data-c="profit"></span></div></div>`;
  }
  function renderCards() {
    const box = $('pr-cards'); if (!box) return;
    if (!isPhone()) { if (box.childElementCount) box.innerHTML = ''; return; }
    const rows = rowsAll();
    box.innerHTML = rows.length ? rows.map(cardHtml).join('') : '<div class="pr-empty">No lines yet — add an item below.</div>';
    syncCards();
  }
  function syncCards() {
    const box = $('pr-cards'); if (!box || !isPhone() || !box.childElementCount) return;
    const byId = new Map((pricingLastLines || []).map(l => [l.tr.dataset.lineId, l]));
    box.querySelectorAll('.pr-pc[data-line]').forEach(card => {
      const tr = rowById(card.dataset.line); if (!tr) return;
      card.querySelectorAll('[data-proxy]').forEach(inp => { if (document.activeElement !== inp) inp.value = val(tr, inp.dataset.proxy); });
      const sup = val(tr, 'supplier'), code = val(tr, 'code');
      card.querySelector('[data-c="sub"]').textContent = [`${val(tr, 'qty')} ${val(tr, 'uom')}`, sup || 'No supplier', code].filter(Boolean).join(' · ');
      const d = refCache.get(tr.dataset.lineId) || { paid: [], quoted: [] }, t = refTexts(d);
      const rb = card.querySelector('.pr-ref[data-ref="buy"]'), rs = card.querySelector('.pr-ref[data-ref="sell"]');
      if (rb) { rb.innerHTML = '<span>' + t.buyShort + '</span>'; rb.classList.toggle('none', !d.paid.length); }
      if (rs) { rs.innerHTML = '<span>' + t.sellShort + '</span>'; rs.classList.toggle('none', !d.quoted.length); rs.classList.toggle('other', !!d.quoted[0] && !d.quoted[0].same); }
      const l = byId.get(tr.dataset.lineId), ok = l && l.mat > 0 && l.sale > 0;
      card.querySelector('[data-c="total"]').textContent = 'Total ' + (l && l.sale ? fmt(l.sale) : '—');
      const pf = card.querySelector('[data-c="profit"]');
      pf.textContent = ok ? `Profit ${fmt(l.profit)} · ${l.markup.toFixed(1)}% / ${l.margin.toFixed(1)}%` : (l && l.sale && !l.mat ? 'No Buy Price' : 'Profit —');
      pf.className = ok && l.profit < 0 ? 'pr-neg' : '';
    });
  }
  function proxyTarget(inp) { const card = inp.closest('.pr-pc[data-line]'); const tr = card && rowById(card.dataset.line); return tr ? tr.querySelector(`[data-role="${inp.dataset.proxy}"]`) : null; }
  document.addEventListener('input', e => {
    const inp = e.target.closest?.('#pr-cards [data-proxy]'); if (!inp) return;
    const t = proxyTarget(inp); if (!t) return;
    t.value = inp.value;
    const role = inp.dataset.proxy;
    if (role === 'buy') calcPricingRow(t); else if (role === 'markup') calcFromMarkup(t); else calcFromSell(t);
  });
  document.addEventListener('focusin', e => { const inp = e.target.closest?.('#pr-cards [data-proxy]'); if (inp) { inp.value = String(inp.value || '').replace(/,/g, ''); try { inp.select(); } catch (_) {} } });
  document.addEventListener('focusout', e => {
    const inp = e.target.closest?.('#pr-cards [data-proxy]'); if (!inp) return;
    const t = proxyTarget(inp); if (!t) return;
    if (inp.dataset.proxy !== 'markup') { try { endPriceEdit(t); } catch (_) {} }
    setTimeout(syncCards, 0);
  });

  /* the description shows wrapped (up to 3 lines) and is edited in a one-line field on top of it */
  function syncDescView(tr) {
    const inp = tr?.querySelector('[data-role="desc"]'), v = tr?.querySelector('.pr-desc-view'); if (!inp || !v) return;
    const t = inp.value.trim(); v.textContent = t || inp.placeholder; v.classList.toggle('is-empty', !t); inp.title = t;
  }
  document.addEventListener('input', e => { if (e.target.matches?.('#pricing-tbody [data-role="desc"]')) syncDescView(e.target.closest('tr')); });
  document.addEventListener('focusout', e => { if (e.target.matches?.('#pricing-tbody [data-role="desc"]')) setTimeout(() => syncDescView(e.target.closest('tr')), 200); });

  /* ── Additional Costs: picker, defaults, ⋮ menu, phone cards ── */
  function fillCostPick() {
    const present = new Set(costRows().map(r => r.dataset.masterId).filter(Boolean));
    const comps = (typeof readStoredCostComponents === 'function' ? readStoredCostComponents() : []).filter(c => c.enabled !== false && !present.has(c.id));
    const html = '<option value="">🔍 Add cost from Cost Master…</option>' + comps.map(c => `<option value="${esc(c.id)}">${esc(c.name)}${c.type === '%' ? ` — ${Number(c.value) || 0}% of ${esc(c.base || '')}` : ` — ${fmt(c.value)}`}</option>`).join('') + '<option value="__custom">Other (Custom Cost)</option>';
    document.querySelectorAll('#pr-cost-pick, .pr-cpick-m').forEach(s => { s.innerHTML = html; s.value = ''; });
  }
  function prAddCostFromPick(sel) {
    const v = sel.value; sel.value = ''; if (!v) return;
    if (v === '__custom') addAdditionalCostRow({ name: 'Other', method: 'fixed', value: 0 }, true);
    else { const c = readStoredCostComponents().find(x => x.id === v); if (!c) return; addAdditionalCostRow(costComponentToPricingCost(c), true); }
    calcPricingSummary(); fillCostPick();
    const last = costRows().pop(); setTimeout(() => (last?.querySelector('[data-cost-role="value"]:not([disabled])') || last?.querySelector('select:not([disabled])'))?.focus(), 30);
  }
  function prAddDefaultCosts() {
    const present = new Set(costRows().map(r => r.dataset.masterId).filter(Boolean));
    const add = getEnabledMasterPricingCosts().filter(c => !present.has(c.masterId));
    if (!add.length) { toast('All default costs are already on this pricing.'); return; }
    add.forEach(c => addAdditionalCostRow(c, true)); calcPricingSummary(); fillCostPick();
    toast(add.length + ' default cost' + (add.length === 1 ? '' : 's') + ' added');
  }
  function prCostMenu(btn) {
    const tr = btn.closest('tr') || costByKey(btn.closest('[data-cost]')?.dataset.cost); if (!tr) return;
    if (pop && pop.anchor === btn) { closePop(); return; }
    const rows = costRows(), i = rows.indexOf(tr), name = tr.querySelector('[data-cost-role="name"]')?.value || 'Cost';
    openPop(btn, mi('up', 'Move Up', { disabled: i <= 0 }) + mi('down', 'Move Down', { disabled: i >= rows.length - 1 }) + '<div class="pr-sepm"></div>' + mi('del', '🗑 Delete Cost', { cls: 'pr-mi-del' }), {
      width: 200, title: esc(name),
      onClick: act => {
        closePop();
        if (act === 'del') {
          dialog({ title: `Delete ${esc(name)}?`, html: '<p>The cost is removed from this pricing. Totals, line shares, Profit, Markup % and Margin % are worked out again. Nothing is saved until you press Save.</p>',
            buttons: [{ text: 'Cancel' }, { text: 'Delete Cost', cls: 'pr-danger', default: true, action: () => { tr.remove(); markPricingDirty(); calcPricingSummary(); fillCostPick(); renderCostCards(); } }] });
          return;
        }
        const t = rows[i + (act === 'up' ? -1 : 1)]; if (!t) return;
        if (act === 'up') t.before(tr); else t.after(tr);
        markPricingDirty(); calcPricingSummary(); renderCostCards();
      },
    });
  }
  function costCardHtml(tr, i) {
    const k = esc(tr.dataset.costKey), locked = tr.dataset.locked === 'true', master = !!tr.dataset.masterId;
    const name = tr.querySelector('[data-cost-role="name"]')?.value || 'New Cost';
    const methodSel = tr.querySelector('[data-cost-role="method"]'), nameSel = tr.querySelector('[data-cost-role="name"]');
    return `<div class="pr-pc" data-cost="${k}"><div class="pr-pc-t"><div class="pr-pc-d">${i + 1} · ${esc(name)}${locked ? ' 🔒' : ''}<small>${master ? (locked ? 'Cost Master · Locked' : 'Cost Master') : 'Custom'}</small></div>${locked ? '' : '<button type="button" class="pr-pc-m" onclick="prCostMenu(this)" aria-label="Cost actions">⋮</button>'}</div>
      ${!locked && !master ? `<div class="pr-cname-m"><label>Cost Item</label><select class="pr-fi" data-cproxy="name">${nameSel ? nameSel.innerHTML : ''}</select></div>` : ''}
      <div class="pr-g3 pr-c3"><div><label>Method</label><select class="pr-fi" data-cproxy="method"${locked ? ' disabled' : ''}>${methodSel ? methodSel.innerHTML : ''}</select></div>
        <div><label>Value</label><input class="pr-inp" data-cproxy="value" inputmode="decimal"${locked ? ' disabled' : ''}></div>
        <div><label>Amount</label><div class="pr-inp pr-ro" data-c="amount"></div></div></div>
      <div class="pr-pc-f" data-c="howrow"><span data-c="how"></span></div></div>`;
  }
  function renderCostCards() {
    const box = $('pr-ccards'); if (!box) return;
    if (!isPhone()) { if (box.childElementCount) box.innerHTML = ''; return; }
    box.innerHTML = costRows().map(costCardHtml).join('')
      + `<div class="pr-pc pr-cadd-m"><select class="pr-fi pr-cpick-m" onchange="prAddCostFromPick(this)" aria-label="Add cost from Cost Master"></select><button type="button" class="pr-btn" onclick="prAddDefaultCosts()">+ Add All Default Costs</button></div>
         <div class="pr-pc pr-ctotal"><div class="pr-pc-t"><div class="pr-pc-d pr-b">Total Additional Costs<small id="pr-ctot-sub"></small></div><b id="pr-ctot-amt"></b></div></div>`;
    fillCostPick(); syncCostCards();
  }
  function syncCostCards() {
    const box = $('pr-ccards'); if (!box || !isPhone() || !box.childElementCount) return;
    box.querySelectorAll('.pr-pc[data-cost]').forEach(card => {
      const tr = costByKey(card.dataset.cost); if (!tr) return;
      card.querySelectorAll('[data-cproxy]').forEach(el => { if (document.activeElement !== el) el.value = tr.querySelector(`[data-cost-role="${el.dataset.cproxy}"]`)?.value ?? ''; });
      card.querySelector('[data-c="amount"]').textContent = tr.querySelector('[data-cost-role="amount"]')?.textContent || '';
      const how = tr.querySelector('[data-cost-role="how"]')?.textContent || '';
      card.querySelector('[data-c="how"]').textContent = how === '—' ? '' : how;
      card.querySelector('[data-c="howrow"]').hidden = !how || how === '—';
    });
    if ($('pr-ctot-amt')) $('pr-ctot-amt').textContent = $('internal-costs-total')?.textContent || '';
    if ($('pr-ctot-sub')) $('pr-ctot-sub').textContent = $('internal-costs-count')?.textContent || '';
  }
  const costProxy = e => {
    const el = e.target.closest?.('#pr-ccards [data-cproxy]'); if (!el) return;
    const card = el.closest('[data-cost]'), tr = card && costByKey(card.dataset.cost); if (!tr) return;
    const t = tr.querySelector(`[data-cost-role="${el.dataset.cproxy}"]`); if (!t) return;
    t.value = el.value; t.dispatchEvent(new Event('input', { bubbles: true }));
  };
  document.addEventListener('input', costProxy); document.addEventListener('change', e => { if (e.target.matches?.('#pr-ccards select[data-cproxy]')) costProxy(e); });

  /* ── after the figures are worked out (app.js calcPricingSummary) ── */
  function prAfterCalc(lines, t) {
    syncCards(); syncCostCards();
    const box = $('pr-cost-shares'); if (!box) return;
    const withShare = lines.filter(l => l.mat > 0);
    if (!t.addTotal || !withShare.length) { box.innerHTML = `<div class="pr-muted pr-small">${t.addTotal ? 'Add buy prices to share the costs over the lines.' : 'No additional costs on this pricing.'}</div>`; return; }
    const all = box.dataset.all === '1', show = all ? withShare : withShare.slice(0, 6);
    box.innerHTML = show.map(l => `<div class="pr-kv"><span class="pr-ell">${esc(l.tr.querySelector('.pricing-line-number')?.textContent || '')} · ${esc(val(l.tr, 'desc') || 'No description')}</span><b>${esc(fmt(l.share))}</b></div>`).join('')
      + (withShare.length > 6 ? `<button type="button" class="pr-lnk pr-small" onclick="this.parentNode.dataset.all='${all ? '' : '1'}';calcPricingSummary()">${all ? 'Show Fewer' : `+ ${withShare.length - 6} More Lines · Show All`}</button>` : '');
  }
  function prAfterRowsChange() { rowsAll().forEach(syncDescView); renderCardsSoon(); }
  function prAfterCostsChange() { if (isPhone()) renderCardsSoon(); }

  /* ── vendor quotes ── */
  function prRemoveVendorQuote(i) {
    const q = pricingVendorQuotes[i]; if (!q) return;
    dialog({ title: 'Remove Attachment?', html: `<p><b>${esc(q.name || 'Attachment')}</b> is removed from this pricing.</p>`, buttons: [{ text: 'Cancel' }, { text: 'Remove', cls: 'pr-danger', default: true, action: () => removePricingVendorQuote(i) }] });
  }
  function prVendorQuoteMenu(btn, i) {
    const q = pricingVendorQuotes[i]; if (!q) return; const href = q.url || q.data || '';
    openPop(btn, `<a class="pr-mi" href="${esc(href)}" target="_blank" rel="noopener">View</a><a class="pr-mi" href="${esc(href)}" download="${esc(q.name || 'attachment')}">Download</a><div class="pr-sepm"></div>` + mi('del', '🗑 Remove', { cls: 'pr-mi-del' }), {
      width: 190, title: esc(q.name || 'Attachment'), onClick: act => { closePop(); if (act === 'del') prRemoveVendorQuote(i); },
    });
  }
  function bindDrop() {
    const zone = $('pr-drop'), panel = document.querySelector('#pricing-modal .pr-panel[data-panel="quotes"]');
    if (!zone || zone.dataset.bound) return; zone.dataset.bound = '1';
    const input = $('pricing-attach-input'); if (input) input.multiple = true;
    [panel, zone].forEach(el => el && el.addEventListener('dragover', e => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); zone.classList.add('is-over'); } }));
    [panel, zone].forEach(el => el && el.addEventListener('dragleave', e => { if (!panel.contains(e.relatedTarget)) zone.classList.remove('is-over'); }));
    panel && panel.addEventListener('drop', e => { if (!e.dataTransfer?.files?.length) return; e.preventDefault(); zone.classList.remove('is-over'); handlePricingAttach({ target: { files: e.dataTransfer.files } }); });
    zone.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input?.click(); } });
  }

  /* ── primary supplier: Supplier Master only ── */
  function prCheckPrimarySupplier() {
    const el = $('pricing-sup-search'); if (!el) return;
    setTimeout(() => {
      if (document.activeElement === el) return;
      const text = el.value.trim(), s = text ? pricingResolvePrimarySupplier() : null;
      if (s) { el.value = s.company; el.dataset.supplierId = s.id; pricingSupplierName = s.company; }
      const bad = !!text && !s;
      el.classList.toggle('pricing-required-invalid', bad); el.setAttribute('aria-invalid', bad ? 'true' : 'false');
      el.title = bad ? 'Not in the Supplier Master — choose a supplier from the list, or add it with "Add new supplier"' : '';
    }, 220);
  }
  function prRefreshSupplierOptions() {
    const html = pricingSupplierOptionsHtml();
    rowsAll().forEach(tr => {
      const s = tr.querySelector('[data-role="supplier"]'); if (!s) return; const v = s.value;
      s.innerHTML = html;
      if (v && ![...s.options].some(o => o.value === v)) s.insertAdjacentHTML('beforeend', `<option value="${esc(v)}">${esc(v)} (not in Supplier Master)</option>`);
      s.value = v;
    });
  }
  function prApplyMenu(btn) {
    if (pop && pop.anchor === btn) { closePop(); return; }
    openPop(btn, mi('blank', 'Fill Blank Lines') + mi('all', 'Replace All Lines…'), {
      width: 210, title: 'Apply Supplier To Lines',
      onClick: act => {
        closePop();
        const run = mode => { prRefreshSupplierOptions(); applyPrimarySupplierToPricingLines(mode); rowsAll().forEach(prShowLineRef); syncCards(); };
        if (act === 'blank') run('blank');
        else dialog({ title: 'Replace On All Lines?', html: '<p>The primary supplier and supplier quote ref. replace the supplier and quote ref. on <b>every</b> line.</p>', buttons: [{ text: 'Cancel' }, { text: 'Replace All', cls: 'pr-pri', default: true, action: () => run('all') }] });
      },
    });
  }

  /* ── open ── */
  let piSub = false;
  function prOnOpen() {
    prShowTab('items'); prUpdateNoteMarks(); fillCostPick(); bindDrop();
    if (!piSub && window.BizCorePI && typeof window.BizCorePI.onChange === 'function') { piSub = true; window.BizCorePI.onChange(refreshAllRefsSoon); }
  }
  function prAfterOpen() {
    const t = backTarget(), b = $('pricing-back-btn');
    if (b) { const label = t.kind === 'quote' ? 'Back to Quotation' : 'Back to RFQ'; b.title = label + ' (Alt+←)'; b.setAttribute('aria-label', label); }
    rowsAll().forEach(prShowLineRef);
    renderCards(); renderCostCards();
  }

  /* ── keys: Esc (menus / dialogs first), F2, Ctrl+Del, Alt+← ── */
  window.addEventListener('keydown', e => {
    if (!modalOpen()) return;
    if (e.key === 'Escape') {
      if (dlg) { e.preventDefault(); e.stopImmediatePropagation(); dlg.cancel(); return; }
      if (pop) { e.preventDefault(); e.stopImmediatePropagation(); const a = pop.anchor; closePop(); a?.focus?.(); return; }
      return;
    }
    if (dlg) return;
    const el = document.activeElement;
    if (e.key === 'F2') {
      const role = el?.dataset?.role || el?.dataset?.proxy;
      if (role === 'buy' || role === 'sell') { e.preventDefault(); const host = el.closest('tr') || el.closest('.pr-pc'); const b = host?.querySelector(`.pr-ref[data-ref="${role}"]`); if (b) prOpenRef(b); }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Delete') {
      const tr = el?.closest?.('#pricing-tbody tr:not(.pricing-quick-add-row)'); if (tr) { e.preventDefault(); e.stopImmediatePropagation(); confirmDelete(tr); }
      return;
    }
    if (e.altKey && !e.ctrlKey && !e.shiftKey && e.key === 'ArrowLeft') { e.preventDefault(); e.stopImmediatePropagation(); prRequestBack(); }
  }, true);
  const mq = window.matchMedia('(max-width:760px)');
  const onMq = () => { if (modalOpen()) { closePop(); renderCards(); renderCostCards(); } };
  if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq);

  Object.assign(window, {
    prShowTab, prUpdateNoteMarks, prConfirmLeave, prRequestBack, prRowMenu, prOpenRef, prRefreshRefs, prShowLineRef, prAfterCalc,
    prAfterRowsChange, prAfterCostsChange, prAddCostFromPick, prAddDefaultCosts, prCostMenu, prRemoveVendorQuote, prVendorQuoteMenu,
    prCheckPrimarySupplier, prRefreshSupplierOptions, prApplyMenu, prOnOpen, prAfterOpen,
    prDebug: { paidHistory, quoteHistory, rowItem, confirmDelete, deleteLine, insertAbove, duplicate, move, saveNow, closePop, closeDialog, isOpen: () => ({ pop: !!pop, dlg: !!dlg }) },
  });
})();
