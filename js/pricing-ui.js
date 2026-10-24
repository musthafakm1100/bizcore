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
  const netUp = it => (typeof quoteLineNetUnit === 'function' ? quoteLineNetUnit(it) : Number(it.up));   // V270.2: quoted price after a line discount

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
    if ((typeof pricingViewMode !== 'undefined' && pricingViewMode)) return;
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
  /* V270.1.3: the line's supplier quote ref. is edited in place — click "Ref 123" (or "+ Ref"); Enter / leaving keeps it,
     Esc cancels. Line Details (⋮) still edits it together with qty, supplier and note. */
  function prShowLineRef(tr) {
    const el = tr?.querySelector('.pr-lref'); if (!el) return;
    const ref = val(tr, 'supref'), note = tr.dataset.supNote || '', view = (typeof pricingViewMode !== 'undefined' && pricingViewMode);
    const refHtml = ref ? `<button type="button" class="pr-lref-ref" title="${esc('Ref ' + ref + (view ? '' : ' — click to edit'))}"${view ? ' disabled' : ''}>Ref ${esc(ref)}</button>`
      : (view ? '' : '<button type="button" class="pr-lref-ref pr-lref-add" title="Add the supplier quote ref. of this line">+ Ref</button>');
    el.innerHTML = [refHtml, note ? `<span class="pr-notei" title="${esc('Note: ' + note)}">✎ Note</span>` : ''].filter(Boolean).join('<span class="pr-sep"> · </span>');
    el.hidden = !refHtml && !note;
  }
  function editLineRef(tr) {
    if ((typeof pricingViewMode !== 'undefined' && pricingViewMode)) return;
    const el = tr.querySelector('.pr-lref'), hidden = tr.querySelector('[data-role="supref"]'); if (!el || !hidden) return;
    if (isPhone()) {
      dialog({ title: `Line ${rowsAll().indexOf(tr) + 1} · Supplier Quote Ref.`, html: `<div class="pr-form"><label class="pr-wide">Supplier Quote Ref.<input id="prd-ref1" class="pr-fi" value="${esc(hidden.value)}" placeholder="Quote no. for this line"></label></div>`,
        buttons: [{ text: 'Cancel' }, { text: 'Apply', cls: 'pr-pri', action: v => { setLineRef(tr, v['prd-ref1']); } }] });
      return;
    }
    const old = hidden.value;
    el.innerHTML = `<input class="pr-lref-in" value="${esc(old)}" placeholder="Quote ref." aria-label="Supplier quote ref. of this line" maxlength="60">`;
    const inp = el.querySelector('input'); inp.focus(); inp.select();
    let done = false;
    const finish = keep => { if (done) return; done = true; if (keep) setLineRef(tr, inp.value); else prShowLineRef(tr); };
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); finish(true); tr.querySelector('[data-role="buy"]')?.focus(); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(false); } });
    inp.addEventListener('blur', () => finish(inp.dataset.cancel !== '1'));
  }
  function setLineRef(tr, v) {
    const hidden = tr.querySelector('[data-role="supref"]'); if (!hidden) return;
    const nv = String(v || '').trim();
    if (nv !== hidden.value) { hidden.value = nv; markPricingDirty(); }
    prShowLineRef(tr); syncCards();
  }
  document.addEventListener('click', e => {
    const b = e.target.closest?.('#pricing-tbody .pr-lref-ref'); if (b && !b.disabled) { e.preventDefault(); editLineRef(b.closest('tr')); return; }
    const c = e.target.closest?.('#pr-cards [data-c="ref"]'); if (c) { const card = c.closest('[data-line]'); const tr = card && rowById(card.dataset.line); if (tr) editLineRef(tr); }
  });

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
        const up = netUp(it); if (!(up > 0)) return;   // V270.2: after the line discount
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
    const foot = `<div class="pr-rf-f">${kind === 'buy' ? 'From posted purchase invoices, newest first.' : 'This customer first, then others · Draft, revised and cancelled quotations are not counted.'}</div>`
      + `<div class="pr-rf-more"><button type="button" class="pr-lnk" data-act="hist">View Price History ›</button></div>`;
    if ((typeof pricingViewMode !== 'undefined' && pricingViewMode)) html = html.replace(/<button type="button" class="pr-btn pr-use"[^>]*>Use<\/button>/g, '');
    openPop(btn, head + html + foot, {
      width: 320, title: kind === 'buy' ? 'Last Paid' : 'Last Quoted',
      onClick: (act, b) => {
        if (act === 'hist') { closePop(); prOpenHistory(tr, kind); return; }
        if (act !== 'use') return;
        const x = list[Number(b.dataset.i)]; if (!x) return;
        closePop();
        const inp = tr.querySelector(`[data-role="${kind}"]`); if (!inp) return;
        inp.value = formatNumber(x.price, dec());
        if (kind === 'buy') calcFromBuy(inp); else calcFromSell(inp);
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
    if ((typeof pricingViewMode !== 'undefined' && pricingViewMode)) box.querySelectorAll('[data-proxy]').forEach(i => { i.readOnly = true; i.tabIndex = -1; });
    syncCards();
  }
  function syncCards() {
    const box = $('pr-cards'); if (!box || !isPhone() || !box.childElementCount) return;
    const byId = new Map((pricingLastLines || []).map(l => [l.tr.dataset.lineId, l]));
    box.querySelectorAll('.pr-pc[data-line]').forEach(card => {
      const tr = rowById(card.dataset.line); if (!tr) return;
      card.querySelectorAll('[data-proxy]').forEach(inp => { if (document.activeElement !== inp) inp.value = val(tr, inp.dataset.proxy); });
      const sup = val(tr, 'supplier'), code = val(tr, 'code');
      const ref = val(tr, 'supref'), view = (typeof pricingViewMode !== 'undefined' && pricingViewMode);
      card.querySelector('[data-c="sub"]').innerHTML = esc([`${val(tr, 'qty')} ${val(tr, 'uom')}`, sup || 'No supplier', code].filter(Boolean).join(' · '))
        + (ref ? ` · <span data-c="ref" class="pr-cref">Ref ${esc(ref)}</span>` : (view ? '' : ' · <span data-c="ref" class="pr-cref pr-lref-add">+ Ref</span>'));
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
    if (role === 'buy') calcFromBuy(t); else if (role === 'markup') calcFromMarkup(t); else calcFromSell(t);
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
    // V270.2.3 wording: "+ Add Cost…", the Cost Master items in their own group, "Custom Cost (this pricing only)"
    const html = '<option value="">+ Add Cost…</option><optgroup label="From Cost Master">' + comps.map(c => `<option value="${esc(c.id)}">${esc(c.name)}${c.type === '%' ? ` — ${Number(c.value) || 0}% of ${esc(c.base || '')}` : ` — ${fmt(c.value)}`}</option>`).join('')
      + (comps.length ? '' : '<option value="" disabled>All active Cost Master items are already added</option>')   // V270.2.2
      + '</optgroup><option value="__custom">Custom Cost (this pricing only)</option>';
    document.querySelectorAll('#pr-cost-pick, .pr-cpick-m').forEach(s => { s.innerHTML = html; s.value = ''; });
    /* V270.2.2: Add All Default Costs only when one is missing; Remove Unlocked Costs only when there is one */
    const missing = getEnabledMasterPricingCosts().filter(c => !present.has(c.masterId)).length, unlocked = costRows().filter(r => r.dataset.locked !== 'true').length;
    document.querySelectorAll('.pr-cdef').forEach(b => { b.disabled = !missing; b.title = missing ? `Add the ${missing} missing default cost${missing === 1 ? '' : 's'}` : 'All default costs are already on this pricing'; });
    document.querySelectorAll('.pr-crem').forEach(b => { b.disabled = !unlocked; b.title = unlocked ? 'Remove every unlocked cost (locked costs stay)' : 'No unlocked costs to remove'; });
  }
  /* V270.2.2: remove every unlocked cost (Custom and unlocked Cost Master); locked ones stay */
  function prRemoveUnlockedCosts() {
    const rows = costRows().filter(r => r.dataset.locked !== 'true'); if (!rows.length) return;
    const n = rows.length, word = n === 1 ? 'Cost' : 'Costs';
    dialog({ title: `Remove ${n} Unlocked ${word}?`, html: '<p>Locked costs stay. Totals, line shares, Profit, Markup % and Margin % are worked out again. Nothing is saved until you press Save.</p>',
      buttons: [{ text: 'Cancel' }, { text: `Remove ${word}`, cls: 'pr-danger', default: true, action: () => { rows.forEach(r => r.remove()); markPricingDirty(); calcPricingSummary(); fillCostPick(); renderCostCards(); toast(`${n} unlocked ${word.toLowerCase()} removed`); } }] });
  }
  /* V270.2.2: an active Cost Master item chosen in a Custom row turns the row into that Cost Master cost */
  function onCostName(tr) {
    if (!tr || tr.dataset.masterId) return;
    const sel = tr.querySelector('[data-cost-role="name"]'); if (!sel) return;
    const name = sel.value, prev = tr.dataset.cname || 'Other';
    const c = readStoredCostComponents().find(x => x.enabled !== false && x.name === name);
    if (!c) { tr.dataset.cname = name; return; }
    if (costRows().some(r => r.dataset.masterId === c.id)) { sel.value = prev; toast(`${c.name} is already on this pricing.`); syncCostCards(); return; }
    addAdditionalCostRow(costComponentToPricingCost(c), true);
    const nr = costRows().pop(); tr.before(nr); tr.remove();
    markPricingDirty(); calcPricingSummary(); fillCostPick(); renderCostCards();
    toast(`${c.name} taken from the Cost Master`);
    setTimeout(() => nr.querySelector('[data-cost-role="value"]:not([disabled])')?.focus(), 30);
  }
  document.addEventListener('change', e => { if (e.target.matches?.('#internal-costs-tbody select[data-cost-role="name"]')) onCostName(e.target.closest('tr')); });
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
      + `<div class="pr-pc pr-cadd-m"><select class="pr-fi pr-cpick-m" onchange="prAddCostFromPick(this)" aria-label="Add cost"></select><button type="button" class="pr-btn pr-cdef" onclick="prAddDefaultCosts()">+ Add All Default Costs</button><button type="button" class="pr-btn pr-crem" onclick="prRemoveUnlockedCosts()">Remove Unlocked Costs</button></div>
         <div class="pr-pc pr-ctotal"><div class="pr-pc-t"><div class="pr-pc-d pr-b">Total Additional Costs<small id="pr-ctot-sub"></small></div><b id="pr-ctot-amt"></b></div></div>`;
    fillCostPick(); syncCostCards();
    if ((typeof pricingViewMode !== 'undefined' && pricingViewMode)) box.querySelectorAll('[data-cproxy]').forEach(i => { i.disabled = true; });
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
    if (el.dataset.cproxy === 'name' && e.type === 'change') onCostName(tr);
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
    openPop(btn, `<a class="pr-mi" href="${esc(href)}" target="_blank" rel="noopener">View</a><a class="pr-mi" href="${esc(href)}" download="${esc(q.name || 'attachment')}">Download</a>` + ((typeof pricingViewMode !== 'undefined' && pricingViewMode) ? '' : '<div class="pr-sepm"></div>' + mi('del', '🗑 Remove', { cls: 'pr-mi-del' })), {
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
      if (e.target && e.target.classList && e.target.classList.contains('pr-lref-in')) { e.preventDefault(); e.stopImmediatePropagation(); e.target.dataset.cancel = '1'; e.target.blur(); return; }
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
      if ((typeof pricingViewMode !== 'undefined' && pricingViewMode)) return;
      const tr = el?.closest?.('#pricing-tbody tr:not(.pricing-quick-add-row)'); if (tr) { e.preventDefault(); e.stopImmediatePropagation(); confirmDelete(tr); }
      return;
    }
    if (e.altKey && !e.ctrlKey && !e.shiftKey && e.key === 'ArrowLeft') { e.preventDefault(); e.stopImmediatePropagation(); prRequestBack(); }
  }, true);
  const mq = window.matchMedia('(max-width:760px)');
  const onMq = () => { if (modalOpen()) { closePop(); renderCards(); renderCostCards(); } };
  if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq);

  /* ═════ V270.1.3 — View mode: the same window, read only ═════ */
  const VSTATUS = { 'Revision Draft': 'Revision Draft', Saved: 'Saved', Converted: 'Converted', Superseded: 'Superseded', Cancelled: 'Cancelled' };
  function prApplyMode(view, r, version) {
    const m = $('pricing-modal'); if (!m) return;
    m.classList.toggle('pr-view', view);
    m.querySelectorAll('.pr-win input, .pr-win textarea').forEach(el => {
      if (el.type === 'file' || el.type === 'hidden') return;
      if (view) { if (!el.readOnly) { el.readOnly = true; el.dataset.prro = '1'; } }
      else if (el.dataset.prro) { el.readOnly = false; delete el.dataset.prro; }
    });
    m.querySelectorAll('.pr-win select').forEach(el => {
      if (view) { if (!el.disabled) { el.disabled = true; el.dataset.prro = '1'; } }
      else if (el.dataset.prro) { el.disabled = false; delete el.dataset.prro; }
    });
    const vp = $('pr-view-pill'); if (vp) vp.hidden = !view;
    const ft = m.querySelector('.pr-ft'); ft.querySelectorAll('.pr-va').forEach(b => b.remove());
    ['pricing-save-btn', 'pricing-convert-btn'].forEach(id => { const b = $(id); if (b) b.hidden = view; });
    const sp = $('pr-status-pill');
    if (!view) { if (sp) sp.classList.remove('pr-pill-conv'); return; }
    const st = version?.status || (r.quotationId ? 'Converted' : 'Saved');
    if (sp) { sp.textContent = VSTATUS[st] || st; sp.classList.toggle('pr-pill-conv', st === 'Converted'); }
    const qid = version?.quotationId || (st === 'Converted' ? r.quotationId : null), q = qid ? quotations.find(x => x.id === qid) : null;
    const when = dmy(String(version?.convertedDate || version?.updated || '').slice(0, 10));
    const note = $('pricing-save-note');
    if (note) { note.className = 'pricing-save-note pr-h'; note.innerHTML = st === 'Converted' ? `Converted to ${q ? `<button type="button" class="pr-lnk pr-va-q">${esc(q.qno)}</button>` : 'a quotation'}${when !== '—' ? ' · ' + esc(when) : ''}` : `${esc(VSTATUS[st] || st)}${when !== '—' ? ' · ' + esc(when) : ''}`; note.querySelector('.pr-va-q')?.addEventListener('click', () => viewQuote(qid)); }
    const older = typeof pvViewing !== 'undefined' && pvViewing && pvViewing.rfqId === String(r.id);
    const locked = older || ['Converted', 'Superseded'].includes(st) || (typeof isPricingVersionLocked === 'function' && isPricingVersionLocked(r));
    const close = ft.querySelector('.pr-cl');
    const add = (html, before) => { const t = document.createElement('template'); t.innerHTML = html.trim(); const b = t.content.firstChild; ft.insertBefore(b, before); return b; };
    add('<button type="button" class="btn btn-secondary btn-sm pr-va pr-cl">View RFQ</button>', close).addEventListener('click', viewRfq);
    if (qid) add('<button type="button" class="btn btn-secondary btn-sm pr-va pr-cl">View Quotation</button>', close).addEventListener('click', () => viewQuote(qid));
    add('<button type="button" class="btn btn-secondary btn-sm pr-va pr-more-m" aria-label="More actions">⋯</button>', close).addEventListener('click', e => moreMenu(e.currentTarget, qid));
    const ed = add(`<button type="button" class="btn btn-primary btn-sm pr-va pr-va-edit" id="pr-edit-btn">${locked ? 'Revise Pricing' : '✎ Edit'}</button>`, null);
    ed.title = locked ? 'Start a new pricing version from this one (the converted version stays as it is)' : 'Edit this pricing';
    ed.addEventListener('click', prEditFromView);
  }
  function leaveTo(fn) { if (typeof window.bizcorePerformClose === 'function') window.bizcorePerformClose('pricing-modal', true); else closeModal('pricing-modal'); fn(); }
  function viewRfq() { const rid = pricingRFQId; leaveTo(() => rid && viewRFQ(rid)); }
  function viewQuote(qid) { leaveTo(() => viewQuotation(qid)); }
  function moreMenu(btn, qid) {
    openPop(btn, mi('rfq', 'View RFQ') + (qid ? mi('q', 'View Quotation') : '') + mi('close', 'Close'), { width: 200, title: 'Pricing', onClick: act => { closePop(); if (act === 'rfq') viewRfq(); else if (act === 'q') viewQuote(qid); else requestClosePricingEntry('close'); } });
  }
  function prEditFromView() {
    const rid = pricingRFQId, r = rfqs.find(x => x.id === rid); if (!r) return;
    const older = typeof pvViewing !== 'undefined' && pvViewing && pvViewing.rfqId === String(rid) && pvViewing.version !== Number(r.currentPricingVersion);
    if (older || isPricingVersionLocked(r)) { revisePricingFromRO({ getAttribute: () => rid }); return; }
    openPricingSheet(rid, { closeSource: false });
  }

  /* ═════ V270.1.3 — Price History: 5 at a time, on demand, from Firebase (indexed queries, firestore.indexes.json) ═════
     Buying: purchase invoices whose itemKeys contain the item (voided ones skipped). Selling: quotations Sent / Won /
     Lost / Expired. Pages are kept for the session (same item + filters → no second read); a document opened from the
     list joins the loaded records, so opening it reads nothing more. Nothing is written. */
  const histCache = new Map(), PAGE = 5, HIST_TTL = 5 * 60 * 1000;
  const QSTAT = ['Sent', 'Won', 'Lost', 'Expired'];
  function itemKeyOfRow(tr) { const lib = window.BizCorePI; try { return lib && lib.core ? lib.core.itemKeyOf({ productId: tr.dataset.productId, code: val(tr, 'code'), desc: val(tr, 'desc'), uom: val(tr, 'uom') }) : ''; } catch (_) { return ''; } }
  function periodFrom(p) { if (p === 'all') return ''; const d = new Date(); d.setHours(12, 0, 0, 0); d.setMonth(d.getMonth() - Number(p)); return d.toISOString().slice(0, 10); }
  function histQuery(st) {
    const from = periodFrom(st.period), f = [['itemKeys', 'array-contains', st.key]];
    if (st.kind === 'buy') { if (st.supplierId) f.push(['supplierId', '==', st.supplierId]); }
    else { if (st.cust === 'this' && st.custId) f.push(['custId', '==', st.custId]); f.push(['status', 'in', st.status === 'all' ? QSTAT : [st.status]]); }
    if (from) f.push(['date', '>=', from]);
    return { col: st.kind === 'buy' ? 'purchaseInvoices' : 'quotations', filters: f };
  }
  function rowsOf(st, docs) {
    const out = [];
    docs.forEach(d => {
      if (st.kind === 'buy') {
        if (d.status === 'Voided') return;
        (d.lines || []).forEach(l => { if (l.itemKey === st.key && Number(l.unitCost) > 0) out.push({ id: d.id, date: d.date, no: d.piNo || d.id, party: d.supplierName || '', qty: l.qty, uom: l.uom || '', price: Number(l.unitCost), status: d.payStatus || 'Posted' }); });
      } else {
        (d.items || []).forEach(it => {
          if (it.lineType && it.lineType !== 'item') return;
          if (sellHit(st, it) && netUp(it) > 0) out.push({ id: d.id, date: d.date, no: d.qno || d.id, party: d.company || '', qty: it.qty, uom: it.uom || '', price: netUp(it), status: d.status, same: st.custId && d.custId === st.custId });
        });
      }
    });
    return out;
  }
  /* V270.2.3: a quotation line is the item when its key matches, or — as Last Quoted does — when one side has no product id
     and the code or description is the same (lines typed without the Item Master) */
  function sellHit(st, it) {
    let k = ''; try { k = window.BizCorePI.core.itemKeyOf({ productId: it.prodId, code: it.code, desc: it.desc, uom: it.uom }); } catch (_) {}
    if (k && k === st.key) return true;
    if (String(st.key).startsWith('p_') && it.prodId) return false;
    const code = low(st.code), desc = low(st.descRaw);
    return !!((code && low(it.code) === code) || (desc && low(it.desc) === desc));
  }
  /* V270.2.2 → V270.2.3: History also lists the matching documents already loaded on screen (Buying and Selling) — new
     ones at once, older quotations the Firebase search cannot find (no itemKeys), and all of them when the search fails
     (indexes not set up). So History always agrees with Last Paid / Last Quoted. No reads. */
  function localDocs(st, c) {
    // only inside the range the loaded pages cover (all of it once the list is complete or the search failed), so
    // "Load 5 More" still pages through the older ones
    const docs = c.docs || [], have = new Set(docs.map(d => d.id)), from = periodFrom(st.period);
    const floor = c.error || c.done ? '' : docs.length ? docs.reduce((m, d) => (String(d.date || '') < m ? String(d.date || '') : m), '\uffff') : null;
    if (floor === null) return { rows: [], n: 0 };
    const inPeriod = d => (!from || String(d.date || '') >= from) && (!floor || String(d.date || '') >= floor);
    let list = [];
    if (st.kind === 'buy') list = (window.BizCorePI?.invoices || []).filter(d => d && d.id && !have.has(d.id) && d.status !== 'Voided' && (!st.supplierId || d.supplierId === st.supplierId) && inPeriod(d));
    else if (typeof quotations !== 'undefined' && Array.isArray(quotations)) {
      const stats = st.status === 'all' ? QSTAT : [st.status];
      list = quotations.filter(q => q && q.id && !have.has(q.id) && stats.includes(q.status) && (st.cust !== 'this' || q.custId === st.custId) && inPeriod(q));
    }
    const rows = rowsOf(st, list);
    return { rows, n: new Set(rows.map(r => r.id)).size };
  }
  async function loadPage(st) {
    const q = histQuery(st), ck = st.kind + '|' + JSON.stringify(q);
    let c = histCache.get(ck);
    if (c && !st.more && Date.now() - (c.at || 0) > HIST_TTL) c = null;   // V270.2.3: a remembered answer expires after 5 minutes
    if (!c) { c = { docs: [], cursor: null, done: false, at: Date.now() }; histCache.set(ck, c); }
    st.cache = c;
    if (c.done || (c.docs.length && !st.more)) return;
    if (!window.BCWin || typeof window.BCWin.page !== 'function') { c.error = 'Price history is not available in this version of the page — reload it.'; return; }
    st.busy = true; paintHist(st);
    try { const res = await window.BCWin.page(q.col, q.filters, 'date', PAGE, c.cursor); c.docs.push(...res.rows); c.cursor = res.cursor; c.done = res.done; c.error = ''; }
    catch (e) { c.error = /index/i.test(String(e && e.message)) || e?.code === 'failed-precondition' ? 'Price history needs the Firebase indexes to be set up (docs/FIRESTORE_INDEXES.md). Until then only the quick “last 3” list is available.' : 'Could not load the price history — check the connection and try again.'; console.warn('[BizCore] price history', e); }
    finally { st.busy = false; st.more = false; }
  }
  function histHtml(st) {
    const r = { company: st.company || (rfqs.find(x => x.id === pricingRFQId) || {}).company || '' };
    const sups = bcSortBy(suppliers.filter(x => x && x.id), x => x.company).map(x => `<option value="${esc(x.id)}"${st.supplierId === x.id ? ' selected' : ''}>${esc(x.company)}</option>`).join('');
    const per = [['3', 'Last 3 Months'], ['6', 'Last 6 Months'], ['12', 'Last 12 Months'], ['all', 'All Time']].map(([v, t]) => `<option value="${v}"${st.period === v ? ' selected' : ''}>${t}</option>`).join('');
    const filt = st.kind === 'buy'
      ? `<select class="pr-hf" data-h="supplierId" aria-label="Supplier"><option value="">All Suppliers</option>${sups}</select>`
      : `<select class="pr-hf" data-h="cust" aria-label="Customer"><option value="all">All Customers</option>${st.custId ? `<option value="this"${st.cust === 'this' ? ' selected' : ''}>This Customer — ${esc(r.company || '')}</option>` : ''}</select>
         <select class="pr-hf" data-h="status" aria-label="Status"><option value="all">All Statuses</option>${QSTAT.map(x => `<option${st.status === x ? ' selected' : ''}>${x}</option>`).join('')}</select>`;
    return `<h3>${st.kind === 'buy' ? 'Buying' : 'Selling'} Price History — ${esc(st.desc.length > 60 ? st.desc.slice(0, 60) + '…' : st.desc)}${st.code ? ` <span class="pr-muted">(${esc(st.code)})</span>` : ''}</h3>
      <div class="pr-hbar"><div class="pr-htabs"><button type="button" class="pr-btn${st.kind === 'buy' ? ' pr-pri' : ''}" data-hk="buy">Buying</button><button type="button" class="pr-btn${st.kind === 'sell' ? ' pr-pri' : ''}" data-hk="sell">Selling</button></div><span class="pr-sp2"></span>${filt}<select class="pr-hf" data-h="period" aria-label="Period">${per}</select></div>
      <div class="pr-hwrap" id="pr-hbody"></div>
      <div class="pr-hfoot"><span class="pr-muted pr-small" id="pr-hinfo"></span><button type="button" class="pr-btn" id="pr-hmore">Load 5 More</button></div>
      <div class="pr-cf-bt"><button type="button" class="pr-btn" id="pr-hclose">Close</button></div>`;
  }
  function paintHist(st) {
    const body = $('pr-hbody'); if (!body) return;
    const c = st.cache || { docs: [] }, local = localDocs(st, c), rows = [...rowsOf(st, c.docs), ...local.rows].sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))), docT = st.kind === 'buy' ? 'Purchase Invoice' : 'Quotation', party = st.kind === 'buy' ? 'Supplier' : 'Customer';
    const pill = s => `<span class="pr-st pr-st-${esc(low(s).replace(/\s+/g, '-'))}">${esc(s)}</span>`;
    body.innerHTML = c.error && !rows.length ? `<div class="pr-rf-empty">${esc(c.error)}</div>`
      : rows.length ? (c.error ? `<div class="pr-rf-empty pr-small">${esc(c.error)} Showing the quotations already loaded on this screen.</div>` : '') + `<div class="pr-hgrid"><div class="pr-hrow pr-hh"><div>Date</div><div>${docT}</div><div>${party}</div><div class="pr-r">Qty</div><div class="pr-r">Unit Price</div><div>Status</div></div>${rows.map(x => `<div class="pr-hrow"><div class="pr-hd-date">${esc(dmy(x.date))}</div><div class="pr-hd-no"><button type="button" class="pr-lnk pr-hdoc" data-id="${esc(x.id)}">${esc(x.no)}</button></div><div class="pr-hd-party">${esc(x.party)}${st.kind === 'sell' && st.cust !== 'this' && x.same ? ' <span class="pr-muted pr-small">(This Customer)</span>' : ''}</div><div class="pr-r pr-hd-qty">${esc(formatQuantity(Number(x.qty) || 0))} ${esc(x.uom)}</div><div class="pr-r pr-num pr-hd-price">${esc(fmt(x.price))}</div><div class="pr-hd-st">${pill(x.status)}</div></div>`).join('')}</div>`
      : `<div class="pr-rf-empty">${st.busy ? 'Loading…' : c.done ? 'No ' + (st.kind === 'buy' ? 'purchases' : 'quotations') + ' of this item for these filters.' : 'Loading…'}</div>`;
    const more = $('pr-hmore'); if (more) { more.hidden = !!(c.done || c.error); more.disabled = !!st.busy; more.textContent = st.busy ? 'Loading…' : 'Load 5 More'; }
    const info = $('pr-hinfo'); const nd = c.docs.length + local.n; if (info) info.textContent = c.error ? '' : `${nd} ${nd === 1 ? 'document' : 'documents'} · newest first${c.done ? ' · that is all' : ''} · click a number to open it`;
  }
  /* V270.2: also opened from a quotation line — opts = { key, desc, code, custId, company } instead of a Pricing row */
  async function prOpenHistory(tr, kind, opts) {
    const r = opts ? { custId: opts.custId || '', company: opts.company || '' } : (rfqs.find(x => x.id === pricingRFQId) || {});
    const st = opts ? { kind, key: opts.key || '', desc: opts.desc || 'Item', descRaw: opts.desc || '', code: opts.code || '', supplierId: '', cust: 'all', custId: r.custId || '', company: r.company || '', status: 'all', period: '12' }
      : { kind, key: itemKeyOfRow(tr), desc: val(tr, 'desc') || 'Item', descRaw: val(tr, 'desc'), code: val(tr, 'code'), supplierId: '', cust: 'all', custId: r.custId || '', company: r.company || '', status: 'all', period: '12' };
    if (!st.key) { toast('Price history needs the item (choose it from the Item Master).'); return; }
    closeDialog(); closePop();
    const dim = document.createElement('div'); dim.className = 'pr-dim';
    const box = document.createElement('div'); box.className = 'pr-cf pr-cf-xl'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Price History');
    document.body.append(dim, box);
    dlg = { dim, box, returnFocus: document.activeElement, cancel: () => closeDialog() };
    dim.addEventListener('mousedown', () => closeDialog());
    const render = async () => { box.innerHTML = histHtml(st); paintHist(st); await loadPage(st); paintHist(st); };
    box.addEventListener('click', async e => {
      const k = e.target.closest('[data-hk]'); if (k && k.dataset.hk !== st.kind) { st.kind = k.dataset.hk; await render(); return; }
      if (e.target.closest('#pr-hclose')) { closeDialog(); return; }
      if (e.target.closest('#pr-hmore')) { st.more = true; await loadPage(st); paintHist(st); return; }
      const d = e.target.closest('.pr-hdoc'); if (d) openHistDoc(st, d.dataset.id);
    });
    box.addEventListener('change', async e => { const f = e.target.closest('[data-h]'); if (!f) return; st[f.dataset.h] = f.value; box.querySelector('#pr-hbody').innerHTML = ''; await loadPage(st); paintHist(st); });
    await render();
    setTimeout(() => box.querySelector('[data-hk].pr-pri')?.focus(), 0);
  }
  function openHistDoc(st, id) {
    const col = st.kind === 'buy' ? 'purchaseInvoices' : 'quotations', doc = (st.cache?.docs || []).find(d => d.id === id);
    const listed = st.kind === 'buy' ? (window.BizCorePI?.invoices || []).some(p => p.id === id) : quotations.some(q => q.id === id);
    if (!listed && doc && window.BCWin?.addDocs) window.BCWin.addDocs(col, [doc]);   // already read: no second read to open it
    closeDialog();
    const lift = mid => setTimeout(() => { const el = $(mid); if (el && el.classList.contains('open')) el.style.zIndex = '10030'; }, 60);
    if (st.kind === 'buy') { if (typeof openPurchaseInvoiceView === 'function') { openPurchaseInvoiceView(id); lift('pi-view-modal'); } }
    else { setTimeout(() => { viewQuotation(id); lift('view-modal'); }, quotations.some(q => q.id === id) ? 0 : 120); }
  }

  Object.assign(window, {
    prShowTab, prUpdateNoteMarks, prConfirmLeave, prRequestBack, prRowMenu, prOpenRef, prRefreshRefs, prShowLineRef, prAfterCalc,
    prAfterRowsChange, prAfterCostsChange, prAddCostFromPick, prAddDefaultCosts, prRemoveUnlockedCosts, prFillCostPick: fillCostPick, prCostMenu, prRemoveVendorQuote, prVendorQuoteMenu,
    prCheckPrimarySupplier, prRefreshSupplierOptions, prApplyMenu, prOnOpen, prAfterOpen, prApplyMode, prEditFromView, prOpenHistory,
    prHistCache: histCache,
    prDebug: { paidHistory, quoteHistory, rowItem, confirmDelete, deleteLine, insertAbove, duplicate, move, saveNow, closePop, closeDialog, isOpen: () => ({ pop: !!pop, dlg: !!dlg }) },
  });
})();
