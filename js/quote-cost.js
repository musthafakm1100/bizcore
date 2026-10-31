/* BizCore V270.4.14 — the quotation's internal Cost 🔒 column (approved mockup DQ_1, decisions 31 Oct 2026).
 *
 *  - Every quotation has a Cost column, never printed, only for roles with the Special Right "See cost, margin and
 *    profit" (seeCost). A "Show cost" switch hides it while a customer can see the screen; the choice is remembered per
 *    user (this browser).
 *  - Quotation from Pricing: the line shows Pricing's buy price, read-only ("From Pricing"). Direct quotation (or a line
 *    added by hand): the cost is typed; under the box "Last paid X · date" (else the last estimate) — click to use it.
 *  - Margin per line and in the internal box (only lines with a cost count: "2 of 3 priced lines costed").
 *  - Mark as Sent: a reminder when priced lines have no cost (Send anyway / Enter cost); below the minimum margin of the
 *    Pricing Settings → the same approval as Pricing (approvals kind 'quotation'); selling below cost follows "Allow
 *    selling below cost".
 *  - Saved on the line as estCost (unit cost, own lines only); at Sent it is the item's "Estimated" price (product
 *    view), and it goes with the line to the Sales Order (Profit · Estimate vs Actual, js/so-view.js).
 * Loaded after js/app.js.
 */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = v => (typeof escapeHtml === 'function' ? escapeHtml(String(v ?? '')) : String(v ?? ''));
  const num = v => (typeof parseBizNumber === 'function' ? parseBizNumber(v) : Number(String(v ?? '').replace(/,/g, '')) || 0);
  const m2 = n => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const r2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  const rows = () => [...document.querySelectorAll('#items-tbody tr')].filter(tr => tr.dataset.lineType === 'item');
  const table = () => $('qt-items-table');

  function canSee() {
    try { if (typeof window.bcRight === 'function') return !!window.bcRight('seeCost'); } catch (_) {}
    return typeof bcIsAdmin === 'function' ? bcIsAdmin() : false;
  }
  const prefKey = () => 'bc_qt_showcost:' + ((window.currentUser && window.currentUser.uid) || 'me');
  function showPref() { try { const v = localStorage.getItem(prefKey()); return v === null ? true : v === '1'; } catch (_) { return true; } }
  function setShowPref(on) { try { localStorage.setItem(prefKey(), on ? '1' : '0'); } catch (_) {} }
  const isOn = () => canSee() && showPref();

  /** the switch + the column's visibility (on opening the screen and after the switch) */
  function apply() {
    const sw = $('qt-costsw'), t = table(), see = canSee(), on = isOn();
    if (sw) { sw.hidden = !see; sw.setAttribute('aria-pressed', on ? 'true' : 'false'); sw.title = on ? 'Hide the internal cost column (e.g. while a customer sees the screen)' : 'Show the internal cost column'; }
    if (t) t.classList.toggle('qt-cost-on', on);
    paint();
  }
  function toggle() { if (!canSee()) return; setShowPref(!showPref()); apply(); if (typeof qtRenderCardsSoon === 'function') qtRenderCardsSoon(); }

  /* ── the cell (built by addItemRow) ── */
  function cellHtml(item) {
    const fromPricing = item && item.pricingBuy !== undefined && item.pricingBuy !== '' && Number(item.pricingBuy) > 0;
    const v = fromPricing ? Number(item.pricingBuy) : Number(item && item.estCost) || 0;
    const val = v ? m2(v) : '';
    return `<td class="qt-kc"><input class="qt-inp" data-quote-cost type="text" inputmode="decimal" value="${esc(val)}" placeholder="—"${fromPricing ? ' readonly tabindex="-1" title="From Pricing — change it in Pricing"' : ''} onfocus="if(!this.readOnly)beginNumberEdit(this)" oninput="BCQuoteCost.input(this)" onblur="BCQuoteCost.blur(this)" aria-label="Unit cost (internal)">`
      + (fromPricing ? '<span class="qt-kc-src">From Pricing</span>' : '<button type="button" class="qt-kc-hint" hidden tabindex="-1"></button>')
      + '<span class="qt-kc-m"></span></td>';
  }
  function input(el) { const tr = el.closest('tr'); if (!tr || el.readOnly) return; const v = num(el.value); tr.dataset.estCost = v > 0 ? String(r2(v)) : ''; if (typeof markDirty === 'function') markDirty('quote-modal'); if (typeof calcTotals === 'function') calcTotals(); }
  function blur(el) { if (el.readOnly) return; const v = num(el.value); el.value = v > 0 ? m2(v) : ''; input(el); }

  /** a line's unit cost: Pricing's buy, else the typed estimate */
  function unitCostOf(tr) { const pb = Number(tr.dataset.pricingBuy || 0); if (pb > 0) return { unit: pb, from: 'pricing' }; const e = Number(tr.dataset.estCost || 0); return e > 0 ? { unit: e, from: 'own' } : { unit: 0, from: '' }; }

  /** "Last paid" (newest purchase invoice), else the last estimate of the same item on a quotation / Pricing */
  function referenceOf(tr) {
    const pid = tr.dataset.prodId || ''; if (!pid) return null;
    try {
      const lib = window.BizCorePI;
      if (lib && lib.core && lib.lastPrices) {
        const k = lib.core.itemKeyOf({ productId: pid }), lp = lib.lastPrices.get(k);
        if (lp && Number(lp.unitCost) > 0) return { price: Number(lp.unitCost), label: 'Last paid', date: lp.date || lp.invoiceDate || '' };
      }
    } catch (_) {}
    let best = null;
    const consider = (price, date, label) => { if (price > 0 && (!best || String(date) > String(best.date))) best = { price, date, label }; };
    (typeof quotations !== 'undefined' ? quotations : []).forEach(q => (q.items || []).forEach(it => { if (it && String(it.prodId || '') === pid) consider(Number(it.estCost) || Number(it.pricingBuy) || 0, q.date || '', 'Last estimate'); }));
    (typeof rfqs !== 'undefined' ? rfqs : []).forEach(r => (r.pricingItems || []).forEach(it => { if (it && String(it.productId || it.prodId || '') === pid) consider(Number(it.buy) || 0, r.date || '', 'Last estimate'); }));
    return best;
  }
  const dmy = d => (d && typeof fmtDate === 'function' ? fmtDate(d) : d || '');

  /** after every calculation: hint, line margin, the internal box */
  function paint() {
    if (!table()) return;
    const ps = typeof activePricingSettings === 'function' ? activePricingSettings() : {};
    const byMargin = ps.marginMethod === 'gross_margin', min = Number(ps.minMargin || 0), lbl = byMargin ? 'Margin' : 'Markup';
    const on = isOn();
    rows().forEach(tr => {
      const cell = tr.querySelector('.qt-kc'); if (!cell) return;
      const inp = cell.querySelector('[data-quote-cost]'), hint = cell.querySelector('.qt-kc-hint'), mEl = cell.querySelector('.qt-kc-m');
      const { unit } = unitCostOf(tr);
      const qty = num(tr.querySelector('[data-quote-qty]')?.value), up = num(tr.querySelector('[data-quote-price]')?.value);
      const g = qty * up, d = typeof qtLineDiscount === 'function' ? qtLineDiscount(tr, g) : { amt: 0 };
      const netUnit = qty > 0 ? (g - (d.amt || 0)) / qty : up;
      if (hint) {
        const ref = on && !inp.readOnly ? referenceOf(tr) : null;
        if (ref && Math.abs(ref.price - unit) > 0.004) { hint.hidden = false; hint.textContent = `${ref.label} ${m2(ref.price)}${ref.date ? ' · ' + dmy(ref.date) : ''}${unit ? '' : ' · use'}`; hint.dataset.v = String(ref.price); hint.title = 'Use ' + m2(ref.price) + ' as the cost'; }
        else { hint.hidden = true; hint.textContent = ''; }
      }
      if (mEl) {
        if (unit > 0 && netUnit > 0) {
          const pct = typeof pricingPercent === 'function' ? pricingPercent(unit, netUnit) : (netUnit - unit) / unit * 100;
          const st = netUnit < unit - 0.004 ? 'loss' : pct < min ? 'low' : 'ok';
          mEl.className = 'qt-kc-m ' + st; mEl.textContent = st === 'loss' ? 'Loss ' + m2((unit - netUnit) * qty) : lbl + ' ' + pct.toFixed(1) + '%' + (st === 'low' ? ' · below ' + min.toFixed(0) + '%' : '');
        } else if (!unit && (up > 0 || qty > 0) && !inp.readOnly) { mEl.className = 'qt-kc-m'; mEl.innerHTML = '<span class="qt-kc-none">No cost entered</span>'; }
        else { mEl.className = 'qt-kc-m'; mEl.textContent = ''; }
      }
    });
    summary();
  }
  document.addEventListener('mousedown', e => { if (e.target.closest && e.target.closest('#items-tbody .qt-kc-hint')) e.preventDefault(); }, true);
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('#items-tbody .qt-kc-hint'); if (!b) return;
    const tr = b.closest('tr'), inp = tr && tr.querySelector('[data-quote-cost]'); if (!inp) return;
    inp.value = m2(Number(b.dataset.v)); input(inp);
  });

  /** the figures of the open quotation (screen) — only lines with a cost count */
  function metricsFromScreen() {
    const t = window._qtTotals || { bvat: 0, lineNet: 0 };
    const factor = t.lineNet > 0 ? t.bvat / t.lineNet : 1;   // the quotation discount, spread over the lines
    let cost = 0, sell = 0, priced = 0, costed = 0, pricingLines = 0;
    const missing = [];
    rows().forEach(tr => {
      const qty = num(tr.querySelector('[data-quote-qty]')?.value), up = num(tr.querySelector('[data-quote-price]')?.value);
      if (!(qty > 0) && !(up > 0)) return;
      priced++;
      const g = qty * up, d = typeof qtLineDiscount === 'function' ? qtLineDiscount(tr, g) : { amt: 0 };
      const c = unitCostOf(tr);
      if (c.from === 'pricing') pricingLines++;
      if (c.unit > 0) { costed++; cost += c.unit * qty; sell += (g - (d.amt || 0)) * factor; }
      else missing.push({ tr, label: 'Line ' + (tr.querySelector('.qt-n')?.textContent || ''), text: String(tr.querySelector('[data-f="desc"]')?.value || '').split('\n')[0] });
    });
    return metrics(cost, sell, { priced, costed, missing, pricingLines });
  }
  /** the same for a saved quotation (view → Mark as Sent) */
  function metricsFromDoc(q) {
    const items = (q.items || []).filter(it => it && (!it.lineType || it.lineType === 'item'));
    const lineNet = items.reduce((s, it) => s + (typeof quoteLineNet === 'function' ? quoteLineNet(it) : (Number(it.qty) || 0) * (Number(it.up) || 0)), 0);
    const bvat = typeof calcQuote === 'function' ? calcQuote(q).bvat : lineNet - (Number(q.discount) || 0);
    const factor = lineNet > 0 ? bvat / lineNet : 1;
    let cost = 0, sell = 0, priced = 0, costed = 0, pricingLines = 0; const missing = [];
    items.forEach((it, i) => {
      const qty = Number(it.qty) || 0; if (!(qty > 0)) return; priced++;
      const unit = Number(it.pricingBuy) > 0 ? Number(it.pricingBuy) : Number(it.estCost) || 0;
      if (Number(it.pricingBuy) > 0) pricingLines++;
      if (unit > 0) { costed++; cost += unit * qty; sell += (typeof quoteLineNet === 'function' ? quoteLineNet(it) : qty * (Number(it.up) || 0)) * factor; }
      else missing.push({ idx: i, label: 'Line ' + (i + 1), text: String(it.desc || '').split('\n')[0] });
    });
    return metrics(cost, sell, { priced, costed, missing, pricingLines });
  }
  function metrics(cost, sell, extra) {
    cost = r2(cost); sell = r2(sell);
    const profit = r2(sell - cost), pct = typeof pricingPercent === 'function' ? pricingPercent(cost, sell) : (cost ? profit / cost * 100 : 0);
    return { cost, sell, profit, pct: Math.round(pct * 100) / 100, markup: cost ? profit / cost * 100 : 0, margin: sell ? profit / sell * 100 : 0, ...extra };
  }

  /** the internal box for a quotation without Pricing (a quotation from Pricing keeps its own box, app.js) */
  function summary() {
    const box = $('quote-commercial-summary'), none = $('quote-commercial-none'); if (!box) return;
    if (window._pendingQuotationPricingContext) { const cov = box.querySelector('.qt-cov'); if (cov) cov.remove(); const rf = $('qcs-ref'); if (rf && rf.parentElement) rf.parentElement.hidden = false; return; }
    const m = metricsFromScreen();
    const has = canSee() && m.costed > 0;
    box.hidden = !has; if (none) none.hidden = has;
    if (none && !has) { const s = none.querySelector('.qt-small'); if (s) s.textContent = canSee() ? 'No cost entered yet. Type the cost in the Cost 🔒 column to see the profit — it is never printed.' : 'No Pricing is linked to this quotation, so cost and profit are not available.'; }
    const ref = $('qcs-ref'); if (ref && ref.parentElement) ref.parentElement.hidden = true;
    ['qcs-cmp', 'qcs-change'].forEach(id => { const el = $(id); if (el) el.hidden = true; });
    if (!has) return;
    const money = n => (typeof documentMoney === 'function' ? documentMoney('quotation', 'summary', n) : m2(n));
    const set = (id, v) => { const el = $(id); if (el) el.textContent = v; };
    set('qcs-cost', money(m.cost)); set('qcs-value', money(m.sell)); set('qcs-profit', m2(m.profit));
    set('qcs-markup', m.markup.toFixed(1) + '%'); set('qcs-margin', m.margin.toFixed(1) + '%');
    const ps = typeof activePricingSettings === 'function' ? activePricingSettings() : {}, min = Number(ps.minMargin || 0), lbl = ps.marginMethod === 'gross_margin' ? 'Margin' : 'Markup';
    const state = !m.sell ? 'none' : m.profit < 0 ? 'loss' : m.pct < min ? 'low' : 'good';
    box.dataset.state = state;
    set('qcs-status', state === 'none' ? 'No selling value yet' : state === 'loss' ? 'Loss · ' + money(-m.profit) + ' below cost' : state === 'low' ? 'Low · ' + lbl + ' below ' + min.toFixed(1) + '% minimum' + (ps.managerApproval ? ' — approval at Mark as Sent' : '') : 'Good · ' + lbl + ' ' + m.pct.toFixed(1) + '%');
    let cov = box.querySelector('.qt-cov');
    if (!cov) { cov = document.createElement('div'); cov.className = 'qt-small qt-cov'; box.appendChild(cov); }
    cov.textContent = m.costed === m.priced ? `All ${m.priced} priced line${m.priced === 1 ? '' : 's'} costed.` : `${m.costed} of ${m.priced} priced lines costed — ${m.missing.map(x => x.label.toLowerCase()).join(', ')} left out of the margin.`;
  }

  /* ── Mark as Sent ── */
  const confirmP = o => new Promise(res => { if (typeof showConfirm !== 'function') { res(true); return; } showConfirm({ ...o, onConfirm: () => res(true), onCancel: () => res(false) }); });
  /**
   * The checks before a quotation becomes Sent. m: metricsFromScreen() / metricsFromDoc(q); q: { id, qno, revisionNo,
   * company } (id empty for a quotation not saved yet). → { go: true, approval? } · { go: false } (stay / fix) ·
   * { go: false, draft: true, ctx } (save as Draft, then ask for approval with the saved id).
   */
  async function gate(m, q, { onEnterCost } = {}) {
    if (!canSee() || window.__bcTestNoCostChecks) return { go: true };
    if (m.missing.length && m.priced) {
      const ok = await confirmP({ icon: '🔒', title: 'Cost missing on ' + m.missing.length + ' line' + (m.missing.length === 1 ? '' : 's'),
        message: `${m.missing.length} of ${m.priced} priced line${m.priced === 1 ? '' : 's'} ${m.missing.length === 1 ? 'has' : 'have'} no cost, so ${m.missing.length === 1 ? 'it is' : 'they are'} left out of the margin:\n` + m.missing.slice(0, 6).map(x => '• ' + x.label + (x.text ? ' — ' + x.text.slice(0, 60) : '')).join('\n'),
        confirmText: 'Send anyway', cancelText: 'Enter cost', confirmClass: 'btn-primary' });
      if (!ok) { if (onEnterCost) onEnterCost(m.missing[0]); return { go: false }; }
    }
    if (!(m.costed > 0) || !(m.sell > 0) || m.pricingLines > 0) return { go: true };   // a quotation from Pricing was checked in Pricing (information only here, agreed 23 Oct)
    const ps = typeof activePricingSettings === 'function' ? activePricingSettings() : {};
    if (m.profit < 0 && !ps.allowBelowCost) {
      await confirmP({ icon: '⛔', title: 'Selling below cost', message: `The quotation sells ${m2(-m.profit)} below its cost. Pricing Settings do not allow selling below cost — change the prices or the cost.`, confirmText: 'OK', cancelText: 'Close', confirmClass: 'btn-primary' });
      return { go: false };
    }
    const min = Number(ps.minMargin || 0);
    if (!(m.pct < min) || !ps.managerApproval) return { go: true };
    const ctx = { kind: 'quotation', id: q.id || '', qno: q.qno || '', version: Number(q.revisionNo || 0), pct: m.pct, minMargin: min, totalSell: m.sell, totalCost: m.cost, customer: q.company || '' };
    if (typeof window.bcQuoteApproval !== 'function') { if (typeof showToast === 'function') showToast('Manager approval is not available. Please reload.', 'error'); return { go: false }; }
    const self = window.bcQuoteApproval(ctx, { checkOnly: true });
    if (self) return { go: true, approval: self };
    if (!ctx.id) return { go: false, draft: true, ctx };
    const r = await window.bcQuoteApproval(ctx);
    return r ? { go: true, approval: r } : { go: false };
  }
  /** after "save as Draft" of a new quotation that needs approval: ask with the saved id */
  async function askAfterDraft(q, ctx) {
    if (!q || typeof window.bcQuoteApproval !== 'function') return;
    await window.bcQuoteApproval({ ...ctx, id: q.id, qno: q.qno, version: Number(q.revisionNo || 0) });
  }
  /** "Enter cost": show the column and go to the first line without a cost */
  function focusMissing(x) {
    if (!showPref()) { setShowPref(true); apply(); }
    const tr = x && x.tr; if (!tr) return;
    if (typeof qtShowTab === 'function') qtShowTab('items');
    const inp = tr.querySelector('[data-quote-cost]'); tr.scrollIntoView({ block: 'nearest' }); setTimeout(() => inp && inp.focus(), 40);
  }

  window.BCQuoteCost = { canSee, isOn, apply, toggle, cellHtml, input, blur, paint, unitCostOf, metricsFromScreen, metricsFromDoc, gate, askAfterDraft, focusMissing, referenceOf };
})();
