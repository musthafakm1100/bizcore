/* ═══════════════════════════════════════════════════════════════
   V271.1 — Contracting Estimation (approved mockups CE_1, CE_2 · docs/V271_1_ESTIMATION.md)
   A Contracting RFQ (requestType 'contracting') is priced here instead of in Pricing:
     sections → items; each item's cost is built up from 4 cost types —
       Material (Item Master / free text, supplier optional) · Manpower (hired: trade × men × days × day rate, agency from
       the Supplier Master) · Subcontract (subcontractor from the Supplier Master) · Equipment / Other;
     Overheads % + Contingency % on the direct cost, Markup % on top, the lump sum rounded by hand.
   Storage (like the pricing versions, V269):
     rfqs/{id}                    estimateIndex[] (a summary of every version) + currentEstimateVersion
     rfqs/{id}/estimates/v{N}     the full version; written in the SAME batch as the RFQ (fbSaveRecordWith).
                                  'Saved' may change; a Superseded / Converted version never changes again (only its status).
   Administration → Contracting Settings (shared settings doc 'contracting'): default %, rounding step, budget warnings
   (V271.3), Labour Rates, Expense Categories (V271.3).
   API: window.bcOpenEstimate(rfqId, { version, fromRfqView }) · window.BCEst (calc, settings — used by tests and V271.2+)
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.BCEst) return;

  /* ── helpers ── */
  const $ = id => document.getElementById(id);
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = v => { if (v === '' || v == null) return 0; const n = Number(String(v).replace(/,/g, '').trim()); return Number.isFinite(n) ? n : 0; };
  const r2 = n => { const x = Number(n) || 0; return Math.sign(x) * Math.round(Math.abs(x) * 100 + 1e-7) / 100; };
  const fmt = n => (typeof formatNumber === 'function' ? formatNumber(Number(n) || 0, 2) : (Number(n) || 0).toFixed(2));
  const fq = n => { const x = Number(n) || 0; return Number.isInteger(x) ? String(x) : String(r2(x)); };
  const today = () => (window.BCDate ? BCDate.today() : new Date().toISOString().slice(0, 10));
  const dmy = iso => (window.BCDate ? BCDate.format(String(iso || '').slice(0, 10)) : String(iso || '')) || '—';
  const newId = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const clone = o => JSON.parse(JSON.stringify(o == null ? null : o));
  const who = () => { try { const u = window.currentUser || {}; return u.displayName || u.name || u.email || ''; } catch (e) { return ''; } };
  const RFQS = () => { try { return typeof rfqs !== 'undefined' && Array.isArray(rfqs) ? rfqs : []; } catch (e) { return []; } };
  const PRODUCTS = () => { try { return typeof products !== 'undefined' && Array.isArray(products) ? products : []; } catch (e) { return []; } };
  const SUPPLIERS = () => { try { return typeof suppliers !== 'undefined' && Array.isArray(suppliers) ? suppliers : []; } catch (e) { return []; } };
  const toast = (m, t, h) => { if (typeof showToast === 'function') showToast(m, t || 'info', h); };
  const low = v => String(v || '').trim().toLowerCase();
  const canEdit = () => (typeof window.bcCan === 'function' ? (window.bcCan('pricing', 'c') || window.bcCan('pricing', 'e')) : true);

  const KINDS = [
    { k: 'material', label: 'Material', color: '#2e75b6' },
    { k: 'manpower', label: 'Manpower', color: '#ea6a10' },
    { k: 'subcontract', label: 'Subcontract', color: '#0f766e' },
    { k: 'other', label: 'Equipment / Other', color: '#94a3b8' },
  ];
  const KIND = Object.fromEntries(KINDS.map(x => [x.k, x]));
  const UNITS = ['LS', 'Lot', 'm²', 'm', 'm³', 'Nos', 'Pcs', 'Set', 'Kg', 'Ltr', 'Roll', 'Box', 'Day', 'Hour', 'Week', 'Month', 'Trip', 'Visit'];
  const STYLES = { lumpsum: 'Lump Sum Only', sections: 'With Section Totals' };

  /* ══ Contracting Settings (Administration) ══ */
  const SKEY = 'bizcoreContractingSettings';
  const DEF_TRADES = ['Helper', 'Carpenter', 'Gypsum Carpenter', 'Painter', 'Electrician', 'Plumber', 'Mason', 'Tile Fixer', 'Steel Fixer', 'Welder', 'Foreman'];
  const DEFAULTS = () => ({
    overheadPct: 5, contingencyPct: 3, markupPct: 15, roundStep: 100, warnAmberPct: 90, warnRedPct: 100,
    labourRates: DEF_TRADES.map((t, i) => ({ id: 'lr' + (i + 1), trade: t, rate: 0, unit: 'Day' })),
    expenseCategories: [
      { id: 'ec1', name: 'Local Labour', costType: 'manpower' }, { id: 'ec2', name: 'Food / Meals', costType: 'manpower' },
      { id: 'ec3', name: 'Consumables', costType: 'material' }, { id: 'ec4', name: 'Transport / Fuel', costType: 'other' },
      { id: 'ec5', name: 'Equipment Rental', costType: 'other' },
    ],
  });
  /* V271.1.1: two shared records — the defaults (administrators) and the Labour Rates & Expense Categories
     (administrators + the Special Right "Manage Labour Rates & Expense Categories"). */
  const RKEY = 'bizcoreContractingRates';
  const readJSON = k => { try { const p = JSON.parse(localStorage.getItem(k) || 'null'); return p && typeof p === 'object' ? p : null; } catch (e) { return null; } };
  function settings() {
    const d = DEFAULTS(), p = readJSON(SKEY) || {}, r = readJSON(RKEY) || {};
    const o = { ...d, ...p };
    // the lists: their own record first, then the V271.1 place (inside the defaults), then the starting lists
    o.labourRates = Array.isArray(r.labourRates) ? r.labourRates : Array.isArray(p.labourRates) ? p.labourRates : d.labourRates;
    o.expenseCategories = Array.isArray(r.expenseCategories) ? r.expenseCategories : Array.isArray(p.expenseCategories) ? p.expenseCategories : d.expenseCategories;
    return o;
  }
  function labourRate(trade) { const t = low(trade); const x = settings().labourRates.find(l => low(l.trade) === t); return x ? num(x.rate) : 0; }

  /* ══ calculation (pure) ══ */
  function lineAmt(kind, l) { if (!l) return 0; return kind === 'manpower' ? r2(num(l.men) * num(l.days) * num(l.rate)) : r2(num(l.qty) * num(l.rate)); }
  function itemCost(it) {
    const t = { material: 0, manpower: 0, subcontract: 0, other: 0 }, b = (it && it.build) || {};
    KINDS.forEach(({ k }) => (b[k] || []).forEach(l => { t[k] = r2(t[k] + lineAmt(k, l)); }));
    t.total = r2(t.material + t.manpower + t.subcontract + t.other);
    return t;
  }
  const secCode = i => { let s = '', n = i; do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0); return s; };
  /** Splits `total` over the weights in cents, so the parts add up exactly (the rest goes to the largest part). */
  function distribute(total, weights) {
    const W = weights.reduce((s, w) => s + Math.max(0, w), 0), T = r2(total);
    if (!(W > 0)) return weights.map(() => 0);
    const parts = weights.map(w => r2(T * Math.max(0, w) / W));
    const diff = r2(T - parts.reduce((s, x) => r2(s + x), 0));
    if (diff) { let big = 0; weights.forEach((w, i) => { if (w > weights[big]) big = i; }); parts[big] = r2(parts[big] + diff); }
    return parts;
  }
  /** Everything the screen shows, from one estimate. */
  function calc(est) {
    const by = { material: 0, manpower: 0, subcontract: 0, other: 0 };
    const oh = num(est.overheadPct) / 100, ct = num(est.contingencyPct) / 100, mk = num(est.markupPct) / 100;
    const flat = [];
    const secs = (est.sections || []).map((s, si) => {
      const code = secCode(si), st = { material: 0, manpower: 0, subcontract: 0, other: 0, total: 0 };
      const items = (s.items || []).map((it, ii) => {
        const c = itemCost(it);
        KINDS.forEach(({ k }) => { st[k] = r2(st[k] + c[k]); by[k] = r2(by[k] + c[k]); });
        st.total = r2(st.total + c.total);
        const row = { id: it.id, code: code + (ii + 1), cost: c, qty: num(it.qty) };
        flat.push(row); return row;
      });
      return { id: s.id, code, title: s.title || '', totals: st, items };
    });
    const direct = r2(by.material + by.manpower + by.subcontract + by.other);
    const overhead = r2(direct * oh), contingency = r2(direct * ct), totalCost = r2(direct + overhead + contingency);
    const markup = r2(totalCost * mk), sell = r2(totalCost + markup);
    const offer = num(est.roundTo) > 0 ? r2(num(est.roundTo)) : sell;
    const profit = r2(offer - totalCost);
    // each item's selling amount: its share of the selling price (adds up exactly)
    const sells = distribute(sell, flat.map(x => x.cost.total));
    flat.forEach((x, i) => { x.sell = sells[i]; x.sellRate = x.qty > 0 ? r2(x.sell / x.qty) : 0; x.costRate = x.qty > 0 ? r2(x.cost.total / x.qty) : 0; });
    secs.forEach(s => { s.sell = r2(s.items.reduce((a, x) => a + x.sell, 0)); });
    // the section amounts the quotation prints (V271.2): shares of the offered lump sum
    const offerParts = distribute(offer, secs.map(s => s.totals.total));
    secs.forEach((s, i) => { s.offer = offerParts[i]; });
    const marginPct = offer > 0 ? profit / offer * 100 : 0, markupPct = totalCost > 0 ? profit / totalCost * 100 : 0;
    return { secs, flat, by, direct, overhead, contingency, totalCost, markup, sell, offer, profit, marginPct, markupPct,
      itemCount: flat.length, uncosted: flat.filter(x => !(x.cost.total > 0)).length };
  }
  function summaryOf(c) {
    return { itemCount: c.itemCount, directCost: c.direct, byType: { ...c.by }, overhead: c.overhead, contingency: c.contingency, totalCost: c.totalCost,
      markup: c.markup, sellTotal: c.sell, offerPrice: c.offer, profit: c.profit, marginPct: r2(c.marginPct), markupPct: r2(c.markupPct) };
  }
  /** Margin status against Pricing Settings (minimum / target), the same method Pricing uses. Information only. */
  function marginState(c) {
    if (!(c.offer > 0) || !(c.totalCost > 0)) return { state: 'none', text: 'Enter costs to see the profit.' };
    let ps = {}; try { ps = typeof activePricingSettings === 'function' ? activePricingSettings() : {}; } catch (e) {}
    const byMargin = ps.marginMethod === 'gross_margin', pct = byMargin ? c.marginPct : c.markupPct, name = byMargin ? 'margin' : 'markup';
    const min = num(ps.minMargin), tgt = num(ps.targetMargin);
    if (c.profit < 0) return { state: 'loss', text: 'Below cost — a loss of ' + fmt(-c.profit) + '.' };
    if (min > 0 && pct < min) return { state: 'low', text: 'Below the minimum ' + name + ' (' + fq(min) + ' %) — information only.' };
    return { state: 'ok', text: tgt > 0 && pct >= tgt ? 'At or above the target ' + name + ' (' + fq(tgt) + ' %).' : 'Above the minimum ' + name + (min ? ' (' + fq(min) + ' %)' : '') + '.' };
  }

  /* ══ state ══ */
  const cache = new Map();   // 'rfqId#N' → estimate document (as read from / written to the server)
  let E = null;              // { rfqId, version, status, isNew, ro, est, base, tab, sel, bu }
  const rfqOf = () => RFQS().find(x => String(x.id) === String(E && E.rfqId));
  const idxOf = r => (r && Array.isArray(r.estimateIndex) ? r.estimateIndex : []);
  const maxVersion = r => idxOf(r).reduce((m, e) => Math.max(m, Number(e.version) || 0), 0);
  const dirty = () => !!E && !E.ro && (E.isNew || JSON.stringify(E.est) !== E.base);
  const findItem = id => { for (const s of E.est.sections) { const it = (s.items || []).find(x => x.id === id); if (it) return { s, it }; } return null; };
  const allItems = () => E.est.sections.flatMap(s => s.items || []);
  const blankBuild = () => ({ material: [], manpower: [], subcontract: [], other: [] });
  const blankItem = (o = {}) => ({ id: newId('ei'), desc: '', unit: 'LS', qty: 1, build: blankBuild(), ...o });
  const blankLine = k => ({ id: newId('el'), ...(k === 'manpower' ? { trade: '', supplierId: '', supplierName: '', men: 1, days: 1, rate: '' } : k === 'material' ? { productId: '', desc: '', supplierId: '', supplierName: '', qty: 1, unit: 'Nos', rate: '' } : k === 'subcontract' ? { desc: '', supplierId: '', supplierName: '', qty: 1, unit: 'LS', rate: '' } : { desc: '', qty: 1, unit: 'Day', rate: '' }) });

  function fromRfq(r) {
    const cs = settings();
    const lines = (Array.isArray(r.rfqLines) ? r.rfqLines : []).filter(l => l && String(l.desc || '').trim()).sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0));
    const items = lines.length ? lines.map(l => blankItem({ desc: String(l.desc || '').trim() + (l.remarks ? '\n' + String(l.remarks).trim() : ''), unit: l.uom || 'LS', qty: num(l.qty) || 1, rfqLineId: l.lineId || '' })) : [blankItem({ desc: '' })];
    return {
      site: r.site || '', duration: r.duration || '', estimateDate: today(), quoteStyle: 'lumpsum',
      overheadPct: num(cs.overheadPct), contingencyPct: num(cs.contingencyPct), markupPct: num(cs.markupPct), roundTo: '',
      sections: [{ id: newId('es'), title: 'Scope of work', items }], internalNotes: '',
    };
  }
  function normalize(d) {
    const est = clone(d) || {};
    est.sections = (Array.isArray(est.sections) ? est.sections : []).map(s => ({ id: s.id || newId('es'), title: s.title || '', items: (Array.isArray(s.items) ? s.items : []).map(it => ({ ...it, id: it.id || newId('ei'), build: { ...blankBuild(), ...(it.build || {}) } })) }));
    if (!est.sections.length) est.sections = [{ id: newId('es'), title: 'Scope of work', items: [blankItem()] }];
    ['site', 'duration', 'estimateDate', 'quoteStyle', 'internalNotes'].forEach(k => { if (est[k] == null) est[k] = k === 'quoteStyle' ? 'lumpsum' : ''; });
    return est;
  }
  async function loadVersion(r, n) {
    const k = r.id + '#' + n; if (cache.has(k)) return cache.get(k);
    if (!window.FB || !window.FB.fbReadDoc) return null;
    const t = setTimeout(() => toast('Loading estimation V' + n + '…', 'info'), 300);
    try {
      const d = await window.FB.fbReadDoc('rfqs', r.id, 'estimates', 'v' + n);
      if (d) cache.set(k, d); else toast('Estimation V' + n + ' of ' + (r.rfqNo || 'this RFQ') + ' was not found.', 'error');
      return d;
    } catch (e) { toast(navigator.onLine === false ? 'You are offline. Connect to open estimation V' + n + '.' : 'Estimation V' + n + ' could not be loaded. Check the connection and try again.', 'error'); return null; }
    finally { clearTimeout(t); }
  }

  /* ══ the window ══ */
  const BACK_SVG = '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M12.5 4.5 7 10l5.5 5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function ensureModal() {
    if ($('estimate-modal')) return;
    const m = document.createElement('div');
    m.className = 'modal-overlay'; m.id = 'estimate-modal';
    m.innerHTML = `<div class="modal modal-normal es-win" role="dialog" aria-modal="true" aria-labelledby="es-title">
<div class="modal-header es-hd">
<button type="button" class="es-back" id="es-back" title="Back to RFQ (Alt+←)" aria-label="Back to RFQ">${BACK_SVG}</button>
<div class="es-tt"><h2 id="es-title">Estimation</h2><div class="es-sub" id="es-sub"></div></div>
<span class="pr-pill es-pill-type">Contracting</span>
<button type="button" class="pr-pill es-pill-st" id="es-st" title="Versions">Draft</button>
<span class="pr-pill es-pill-view" id="es-view" hidden title="This version is shown read only">🔒 View Only</span>
<button type="button" class="pr-pill es-pill-note" id="es-note-pill" hidden title="This estimate has an internal note"><i></i><span class="es-x2">Internal Note</span></button>
<div class="es-sp"></div>
<button type="button" class="close-btn" id="es-close" aria-label="Close estimation">✕</button>
</div>
<div class="modal-body es-body">
<div class="es-bar">
<div class="es-f"><label for="es-site">Project / Site</label><input id="es-site" maxlength="200" placeholder="Project name, building, floor…"></div>
<div class="es-f"><label for="es-duration">Est. Duration</label><input id="es-duration" maxlength="40" placeholder="e.g. 21 days"></div>
<div class="es-f"><label for="es-date">Estimate Date</label><input id="es-date" autocomplete="off"></div>
<div class="es-f"><label for="es-style">Quotation Style</label><select id="es-style"><option value="lumpsum">Lump Sum Only</option><option value="sections">With Section Totals</option></select></div>
</div>
<div class="es-work">
<div class="es-main">
<div class="es-tabs" role="tablist" id="es-tabs"></div>
<section class="es-panel on" data-panel="items"><div class="es-gt" id="es-grid"></div><div class="es-hint">Click a cost (or press F2 on a line) to open its Cost Build-up · Sell Amount = cost + overheads + contingency + markup, shared over the items</div></section>
<section class="es-panel" data-panel="manpower"><div class="es-list" id="es-manpower"></div><div class="es-hint">All hired manpower in this estimate. Click a line to open its item.</div></section>
<section class="es-panel" data-panel="subcontract"><div class="es-list" id="es-subcontract"></div><div class="es-hint">All subcontract work in this estimate. Click a line to open its item.</div></section>
<section class="es-panel" data-panel="notes"><div class="es-notehead"><span>Internal notes — never printed on the quotation</span><span id="es-note-count">0 / 2000</span></div><textarea class="es-ta" id="es-notes" maxlength="2000" placeholder="Assumptions, exclusions, site visit notes, supplier remarks…"></textarea></section>
</div>
<aside class="es-side" id="es-side" aria-label="Estimate summary"></aside>
</div>
</div>
<div class="modal-footer es-ft">
<span class="es-chk" id="es-chk"></span>
<div class="es-sp"></div>
<button type="button" class="btn btn-secondary es-cl" id="es-more" title="Versions">Versions ▾</button>
<button type="button" class="btn btn-secondary es-cl" id="es-close2">Close</button>
<button type="button" class="btn btn-primary" id="es-save">Save Estimate</button>
<button type="button" class="btn btn-success" id="es-quote" hidden>Save &amp; Create Quotation</button>
<button type="button" class="btn btn-primary" id="es-revise" hidden>Revise — New Version</button>
</div>
<div class="es-bu" id="es-bu" hidden></div>
</div>`;
    document.body.appendChild(m);
    $('es-back').addEventListener('click', () => requestClose(true));
    $('es-close').addEventListener('click', () => requestClose(false));
    $('es-close2').addEventListener('click', () => requestClose(false));
    $('es-save').addEventListener('click', () => save());
    $('es-revise').addEventListener('click', () => newVersion());
    $('es-quote').addEventListener('click', () => toQuotation());
    $('es-st').addEventListener('click', e => versionsMenu(e.currentTarget));
    $('es-more').addEventListener('click', e => versionsMenu(e.currentTarget));
    $('es-note-pill').addEventListener('click', () => showTab('notes'));
    $('es-tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) showTab(b.dataset.tab); });
    // header fields
    const bind = (id, key, ev = 'input') => $(id).addEventListener(ev, e => { if (!E || E.ro) return; E.est[key] = e.target.value; changed(); });
    bind('es-site', 'site'); bind('es-duration', 'duration'); bind('es-style', 'quoteStyle', 'change');
    if (window.BCDate) BCDate.attach($('es-date'), { allowEmpty: false, max: () => BCDate.today(), onCommit: iso => { if (E && !E.ro && iso) { E.est.estimateDate = iso; changed(); } } });
    $('es-notes').addEventListener('input', e => { if (!E || E.ro) return; E.est.internalNotes = e.target.value; $('es-note-count').textContent = e.target.value.length + ' / 2000'; changed(); noteMarks(); });
    // grid + side + lists
    const grid = $('es-grid');
    grid.addEventListener('input', onGridInput);
    grid.addEventListener('click', onGridClick);
    grid.addEventListener('keydown', onGridKey);
    grid.addEventListener('focusin', e => {
      if (dd && e.target !== dd.input) closeDD();
      const tr = e.target.closest('tr[data-iid]'); if (!tr) return; select(tr.dataset.iid);
      if (e.target.dataset.dd === 'unit' && E && !E.ro) { const it = findItem(tr.dataset.iid)?.it; if (it) unitDD(e.target, false, u => { it.unit = u; e.target.value = u; changed(); }); }
    });
    $('es-side').addEventListener('input', onSideInput);
    $('es-side').addEventListener('click', e => { const b = e.target.closest('[data-act="use-round"]'); if (b && !E.ro) { E.est.roundTo = b.dataset.v; renderSide(); changed(); } });
    ['es-manpower', 'es-subcontract'].forEach(id => $(id).addEventListener('click', e => { const tr = e.target.closest('tr[data-iid]'); if (tr) openBuild(tr.dataset.iid); }));
    const bu = $('es-bu');
    bu.addEventListener('input', onBuInput);
    bu.addEventListener('change', onBuChange);
    bu.addEventListener('click', onBuClick);
    bu.addEventListener('keydown', onBuKey);
    bu.addEventListener('focusout', onBuBlur);
    bu.addEventListener('focusin', e => {   // the Item Master / Supplier Master / Copy From list opens on entering the field
      if (dd && e.target !== dd.input) closeDD();   // V271.2: a list never stays open when the cursor moves on (Tab or click)
      const el = e.target; if (!E || E.ro || !el.dataset || !el.dataset.dd) return;
      if (el.id === 'es-copy') { copySearch(el); return; }
      const tr = el.closest('tr[data-lid]'), k = el.closest('.es-grpbox')?.dataset.k; if (!tr || !k) return;
      const l = findItem(E.bu)?.it.build[k].find(y => y.id === tr.dataset.lid); if (l) openDDFor(el, k, l);
    });
  }

  /* ── open / close ── */
  async function open(rfqId, opts = {}) {
    const r = RFQS().find(x => String(x.id) === String(rfqId)); if (!r) return false;
    if (r.requestType !== 'contracting') { toast('Only Contracting RFQs are estimated here.', 'error'); return false; }
    const idx = idxOf(r);
    let est, n, status, isNew = false;
    if (!idx.length) {
      if (!canEdit()) { toast('This RFQ has no estimate yet, and your role cannot create one.', 'info'); return false; }
      est = fromRfq(r); n = 1; status = 'New'; isNew = true;
    } else {
      n = Number(opts.version) || Number(r.currentEstimateVersion) || maxVersion(r);
      const d = await loadVersion(r, n); if (!d) return false;
      est = normalize(d); status = d.status || (idx.find(e => Number(e.version) === n) || {}).status || 'Saved';
    }
    ensureModal();
    if (opts.fromRfqView && typeof closeModal === 'function') closeModal('rfq-view-modal');
    E = { rfqId: r.id, version: n, status, isNew, ro: status !== 'Saved' && status !== 'New' || !canEdit(), est, base: JSON.stringify(est), tab: 'items', sel: null, bu: null };
    if (!E.isNew) E.base = JSON.stringify(est);
    renderAll();
    if (typeof openModalWithSize === 'function') openModalWithSize('estimate-modal'); else $('estimate-modal').classList.add('open');
    requestAnimationFrame(() => $('es-grid').querySelectorAll('textarea.es-in').forEach(grow));
    if (isNew && (r.rfqLines || []).some(l => l && String(l.desc || '').trim())) toast(`${allItems().length} item${allItems().length === 1 ? '' : 's'} taken from the RFQ — build up their costs and save the estimate`, 'success', 'Estimation started');
    setTimeout(() => { const f = $('es-grid').querySelector('textarea:not(:disabled),input:not(:disabled)'); if (f && isNew) f.focus({ preventScroll: true }); }, 60);
    return true;
  }
  function closeWin() { closeDD(); closeMenu(); if (typeof closeModal === 'function') closeModal('estimate-modal'); else $('estimate-modal').classList.remove('open'); }
  function leave(back) { const id = E && E.rfqId; closeWin(); E = null; if (back && id && typeof viewRFQ === 'function') viewRFQ(id); }
  function requestClose(back) {
    if (!E) return;
    if (E.bu) { closeBuild(); }
    if (!dirty()) { leave(back); return; }
    const where = back ? 'Going back to the RFQ' : 'Closing';
    const dlg = window.bizcoreShowSafeDialog;
    if (typeof dlg !== 'function') { if (confirm('Discard the unsaved changes?')) leave(back); return; }
    dlg({ icon: 'ti-alert-triangle', title: 'Leave Without Saving?', message: 'This estimate has unsaved changes.', secondary: where + ' now would lose them.',
      buttons: [{ text: 'Stay', cls: 'secondary' }, { text: back ? 'Discard & Go Back' : 'Discard & Close', cls: 'danger-outline', action: () => leave(back) },
        { text: back ? 'Save & Go Back' : 'Save & Close', cls: 'primary', action: async () => { if (await save()) leave(back); } }] });
  }

  /* ── rendering ── */
  function renderAll() { renderHeader(); renderBar(); renderTabs(); renderGrid(); renderSide(); renderLists(); renderNotes(); renderFooter(); showTab(E.tab); }
  function renderHeader() {
    const r = rfqOf(); if (!r) return;
    let ps = {}; try { ps = typeof activePricingSettings === 'function' ? activePricingSettings() : {}; } catch (e) {}
    $('es-title').textContent = `Estimation V${E.version} — ${r.rfqNo || ''}`;
    const due = r.due ? dmy(String(r.due).slice(0, 10)) : '';
    $('es-sub').textContent = [r.company || '', r.ref ? 'Ref ' + r.ref : '', due ? 'Due ' + due : '', `Target ${ps.marginMethod === 'gross_margin' ? 'Margin' : 'Markup'} ${num(ps.minMargin)}–${num(ps.targetMargin)} %`].filter(Boolean).join(' · ');
    const st = $('es-st'); const label = E.isNew ? (E.version > 1 ? 'New Version' : 'Draft') : E.status;
    st.textContent = label + (idxOf(r).length > 1 ? ' ▾' : ''); st.classList.toggle('is-saved', E.status === 'Saved' && !E.isNew);
    $('es-view').hidden = !E.ro;
    $('estimate-modal').classList.toggle('es-ro', E.ro);
    noteMarks();
  }
  function noteMarks() { const has = !!String(E.est.internalNotes || '').trim(); $('es-note-pill').hidden = !has; const d = document.querySelector('#es-tabs [data-tab="notes"] .es-dot'); if (d) d.hidden = !has; }
  function renderBar() {
    $('es-site').value = E.est.site || ''; $('es-duration').value = E.est.duration || ''; $('es-style').value = E.est.quoteStyle || 'lumpsum';
    if (window.BCDate) BCDate.setISO($('es-date'), E.est.estimateDate || today()); else $('es-date').value = E.est.estimateDate || '';
    ['es-site', 'es-duration', 'es-style', 'es-date', 'es-notes'].forEach(id => { $(id).disabled = E.ro; });
  }
  function renderTabs() {
    const items = allItems().length, mp = allItems().reduce((n, it) => n + (it.build.manpower || []).length, 0), sc = allItems().reduce((n, it) => n + (it.build.subcontract || []).length, 0);
    $('es-tabs').innerHTML = [['items', 'Sections & Items', items], ['manpower', 'Manpower', mp], ['subcontract', 'Subcontracts', sc]]
      .map(([k, t, n]) => `<button type="button" class="es-tb${E.tab === k ? ' on' : ''}" role="tab" data-tab="${k}">${t} <span class="es-n">${n}</span></button>`).join('')
      + `<button type="button" class="es-tb${E.tab === 'notes' ? ' on' : ''}" role="tab" data-tab="notes">Internal Notes <span class="es-dot" hidden></span></button>`;
    noteMarks();
  }
  function showTab(t) {
    E.tab = t;
    document.querySelectorAll('#es-tabs .es-tb').forEach(b => { const on = b.dataset.tab === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
    document.querySelectorAll('#estimate-modal .es-panel').forEach(p => p.classList.toggle('on', p.dataset.panel === t));
    if (t === 'manpower' || t === 'subcontract') renderLists();
    if (t === 'notes') setTimeout(() => $('es-notes').focus({ preventScroll: true }), 30);
  }
  const ro = () => (E.ro ? ' disabled' : '');
  function renderGrid() {
    const c = calc(E.est), byId = new Map(c.flat.map(x => [x.id, x]));
    const cells = (t, cls = '') => KINDS.map(({ k }) => `<td class="es-r es-val ${cls}${t[k] ? '' : ' es-m'}"${cls ? ` data-k="${k}"` : ''}>${t[k] ? fmt(t[k]) : '—'}</td>`).join('');
    let body = '';
    E.est.sections.forEach((s, si) => {
      const sc = c.secs[si];
      body += `<tr class="es-sec" data-sid="${s.id}"><td class="es-no">${sc.code}</td><td colspan="9"><input class="es-in" data-f="title" value="${esc(s.title)}" placeholder="Section title" maxlength="160" aria-label="Section ${sc.code} title"${ro()}></td>
<td>${E.ro ? '' : `<button type="button" class="es-kbtn" data-act="sec-menu" title="Section actions" aria-label="Section ${sc.code} actions">⋮</button>`}</td></tr>`;
      (s.items || []).forEach((it, ii) => {
        const x = byId.get(it.id), onlySub = x.cost.subcontract > 0 && x.cost.subcontract === x.cost.total;
        body += `<tr class="es-it${E.sel === it.id ? ' is-sel' : ''}${x.cost.total > 0 ? '' : ' no-cost'}" data-iid="${it.id}" data-sid="${s.id}">
<td class="es-no">${x.code}</td>
<td><textarea class="es-in" data-f="desc" rows="1" maxlength="2000" placeholder="Item description" aria-label="Item ${x.code} description"${ro()}>${esc(it.desc)}</textarea>${onlySub ? '<span class="es-tag t-sub">Subcontract</span>' : ''}</td>
<td><input class="es-in" data-f="unit" data-dd="unit" value="${esc(it.unit)}" maxlength="12" autocomplete="off" aria-label="Unit"${ro()}></td>
<td><input class="es-in es-num" data-f="qty" value="${esc(fq(it.qty))}" inputmode="decimal" aria-label="Quantity"${ro()}></td>
${KINDS.map(({ k }) => `<td class="es-r es-val es-cost${x.cost[k] ? '' : ' es-m'}" data-act="build" title="Open the Cost Build-up">${x.cost[k] ? fmt(x.cost[k]) : '—'}</td>`).join('')}
<td class="es-r es-val es-tot es-cost" data-act="build" title="${x.cost.total > 0 ? 'Cost per ' + esc(it.unit || 'unit') + ': ' + fmt(x.costRate) : 'No cost yet — open the Cost Build-up'}">${x.cost.total > 0 ? fmt(x.cost.total) : 'No cost'}</td>
<td class="es-r es-val" title="${x.qty > 0 ? 'Sell rate per ' + esc(it.unit || 'unit') + ': ' + fmt(x.sellRate) : ''}">${fmt(x.sell)}</td>
<td><button type="button" class="es-kbtn" data-act="item-menu" title="Line actions" aria-label="Item ${x.code} actions">⋮</button></td></tr>`;
      });
      if ((s.items || []).length) body += `<tr class="es-sub"><td></td><td colspan="3">Section ${sc.code} subtotal</td>${cells(sc.totals)}<td class="es-r">${fmt(sc.totals.total)}</td><td class="es-r">${fmt(sc.sell)}</td><td></td></tr>`;
      else body += `<tr class="es-sub"><td></td><td colspan="10" class="es-m">No items in this section${E.ro ? '' : ` — <button type="button" class="es-lnk" data-act="add-item" data-sid="${s.id}">+ Add Item</button>`}</td></tr>`;
    });
    if (!E.ro) body += `<tr class="es-add"><td></td><td colspan="10"><button type="button" class="es-lnk" data-act="add-item">+ Add Item</button> &nbsp;·&nbsp; <button type="button" class="es-lnk" data-act="add-section">+ Add Section</button></td></tr>`;
    $('es-grid').innerHTML = `<table class="es-tbl"><colgroup><col class="c-no"><col><col class="c-unit"><col class="c-qty"><col class="c-amt"><col class="c-amt"><col class="c-amt"><col class="c-amt"><col class="c-tot"><col class="c-sell"><col class="c-menu"></colgroup>
<thead><tr><th>#</th><th>Description</th><th>Unit</th><th class="es-r">Qty</th><th class="es-r">Material</th><th class="es-r">Manpower</th><th class="es-r">Subcontract</th><th class="es-r">Equip. / Other</th><th class="es-r">Total Cost</th><th class="es-r">Sell Amount</th><th></th></tr></thead>
<tbody>${body}</tbody>
<tfoot><tr><td></td><td colspan="3">Direct Cost · ${c.itemCount} Item${c.itemCount === 1 ? '' : 's'}</td>${KINDS.map(({ k }) => `<td class="es-r">${fmt(c.by[k])}</td>`).join('')}<td class="es-r">${fmt(c.direct)}</td><td class="es-r">${fmt(c.sell)}</td><td></td></tr></tfoot></table>
<datalist id="es-units">${UNITS.map(u => `<option value="${esc(u)}"></option>`).join('')}</datalist>`;
    $('es-grid').querySelectorAll('textarea.es-in').forEach(grow);
  }
  function grow(t) { t.style.height = 'auto'; t.style.height = Math.max(30, t.scrollHeight + 2) + 'px'; }
  function refreshNumbers() {   // after a change that does not change the rows: figures only (keeps the caret where it is)
    const c = calc(E.est), byId = new Map(c.flat.map(x => [x.id, x]));
    $('es-grid').querySelectorAll('tr.es-it').forEach(tr => {
      const x = byId.get(tr.dataset.iid); if (!x) return;
      const tds = tr.querySelectorAll('td.es-val'); const last = tds.length - 1;
      tds[last].textContent = fmt(x.sell);
    });
    const ft = $('es-grid').querySelector('tfoot td:nth-last-child(2)'); if (ft) ft.textContent = fmt(c.sell);
    renderSide(c);
  }
  function renderSide(c) {
    c = c || calc(E.est);
    const cs = settings(), ms = marginState(c), D = c.direct || 1;
    const step = num(cs.roundStep), down = step > 0 ? Math.floor(c.sell / step) * step : 0;
    const pctIn = (k, label) => `<div class="es-kv"><span class="es-pct">${label} <input data-f="${k}" value="${esc(fq(E.est[k]))}" inputmode="decimal" aria-label="${label} %"${ro()}><small>%</small></span><b>${fmt(k === 'overheadPct' ? c.overhead : k === 'contingencyPct' ? c.contingency : c.markup)}</b></div>`;
    $('es-side').innerHTML = `
<div class="es-grp"><h4>Direct Cost By Type</h4>
<div class="es-bar2">${KINDS.map(({ k, color }) => `<i style="width:${c.direct > 0 ? (c.by[k] / D * 100).toFixed(2) : 0}%;background:${color}"></i>`).join('')}</div>
${KINDS.map(({ k, label, color }) => `<div class="es-kv"><span><i class="es-d" style="background:${color}"></i>${label}${k === 'manpower' ? ' (Hired)' : ''}</span><b>${fmt(c.by[k])}</b></div>`).join('')}
<div class="es-kv es-sum"><span>Direct Cost</span><b>${fmt(c.direct)}</b></div></div>
<div class="es-grp"><h4>Overheads &amp; Profit <small>% of direct cost</small></h4>
${pctIn('overheadPct', 'Overheads')}${pctIn('contingencyPct', 'Contingency')}
<div class="es-kv es-sum"><span>Total Cost</span><b>${fmt(c.totalCost)}</b></div>
${pctIn('markupPct', 'Markup')}
<div class="es-sell"><span>Selling Price</span><span id="es-sellv">${fmt(c.sell)}</span></div>
<div class="es-round"><span>Round to (lump sum)</span><input data-f="roundTo" value="${num(E.est.roundTo) > 0 ? esc(fq(E.est.roundTo)) : ''}" placeholder="${esc(fmt(c.sell))}" inputmode="decimal" aria-label="Lump sum price"${ro()}></div>
${!E.ro && down > 0 && down !== num(E.est.roundTo) && down !== c.sell ? `<div style="text-align:right;margin:-2px 0 4px"><button type="button" class="es-chip" data-act="use-round" data-v="${down}">Use ${fmt(down)}</button></div>` : ''}
<div class="es-res" data-state="${ms.state}">
<div class="es-kv"><span>Quoted Price</span><b>${fmt(c.offer)}</b></div>
<div class="es-kv"><span>Profit</span><b>${fmt(c.profit)}</b></div>
<div class="es-kv"><span>Margin · Markup</span><b>${c.offer > 0 ? fq(r2(c.marginPct)) + ' % · ' + fq(r2(c.markupPct)) + ' %' : '—'}</b></div>
<div class="es-st">${esc(ms.text)}</div></div>
<div class="es-note2">Defaults for Overheads, Contingency and Markup come from Administration → Contracting Settings; changed here for this estimate only. Quoted Price = the rounded lump sum (or the selling price when not rounded), excl. VAT.</div></div>`;
  }
  function renderLists() {
    const c = calc(E.est), code = new Map(c.flat.map(x => [x.id, x.code]));
    const rows = k => E.est.sections.flatMap(s => (s.items || []).flatMap(it => (it.build[k] || []).map(l => ({ it, l }))));
    const mp = rows('manpower'), sc = rows('subcontract');
    const tot = a => a.reduce((s, x) => s + lineAmt(x.k, x.l), 0);
    mp.forEach(x => { x.k = 'manpower'; }); sc.forEach(x => { x.k = 'subcontract'; });
    $('es-manpower').innerHTML = mp.length ? `<table><thead><tr><th>Item</th><th>Trade</th><th>Manpower Supplier</th><th class="es-r">Men</th><th class="es-r">Days</th><th class="es-r">Man-days</th><th class="es-r">Day Rate</th><th class="es-r">Amount</th></tr></thead><tbody>${mp.map(({ it, l }) => `<tr class="es-click" data-iid="${it.id}"><td>${code.get(it.id)}</td><td>${esc(l.trade || '—')}</td><td>${esc(l.supplierName || '—')}</td><td class="es-r">${fq(num(l.men))}</td><td class="es-r">${fq(num(l.days))}</td><td class="es-r">${fq(r2(num(l.men) * num(l.days)))}</td><td class="es-r">${fmt(num(l.rate))}</td><td class="es-r">${fmt(lineAmt('manpower', l))}</td></tr>`).join('')}</tbody><tfoot><tr><td colspan="5">Total Manpower</td><td class="es-r">${fq(r2(mp.reduce((s, x) => s + num(x.l.men) * num(x.l.days), 0)))}</td><td></td><td class="es-r">${fmt(tot(mp))}</td></tr></tfoot></table>`
      : '<div class="es-empty" style="margin:12px">No manpower in this estimate yet. Open an item\'s Cost Build-up to add hired manpower.</div>';
    $('es-subcontract').innerHTML = sc.length ? `<table><thead><tr><th>Item</th><th>Description</th><th>Subcontractor</th><th class="es-r">Qty</th><th>Unit</th><th class="es-r">Rate</th><th class="es-r">Amount</th></tr></thead><tbody>${sc.map(({ it, l }) => `<tr class="es-click" data-iid="${it.id}"><td>${code.get(it.id)}</td><td>${esc(l.desc || '—')}</td><td>${esc(l.supplierName || '—')}</td><td class="es-r">${fq(num(l.qty))}</td><td>${esc(l.unit || '')}</td><td class="es-r">${fmt(num(l.rate))}</td><td class="es-r">${fmt(lineAmt('subcontract', l))}</td></tr>`).join('')}</tbody><tfoot><tr><td colspan="6">Total Subcontract</td><td class="es-r">${fmt(tot(sc))}</td></tr></tfoot></table>`
      : '<div class="es-empty" style="margin:12px">No subcontract work in this estimate yet.</div>';
  }
  function renderNotes() { $('es-notes').value = E.est.internalNotes || ''; $('es-note-count').textContent = String(E.est.internalNotes || '').length + ' / 2000'; }
  /** The problems that stop a save (blocking) and the ones that are only noted. */
  function problems() {
    const out = [], c = calc(E.est), code = new Map(c.flat.map(x => [x.id, x.code]));
    if (!c.itemCount) out.push({ block: true, text: 'Add at least one item' });
    allItems().forEach(it => {
      if (!String(it.desc || '').trim()) out.push({ block: true, text: `Item ${code.get(it.id)} has no description`, iid: it.id, f: 'desc' });
      else if (!(num(it.qty) > 0)) out.push({ block: true, text: `Item ${code.get(it.id)} has no quantity`, iid: it.id, f: 'qty' });
      KINDS.forEach(({ k }) => (it.build[k] || []).forEach(l => {
        if ((k === 'manpower' || k === 'subcontract' || k === 'material') && String(l.supplierName || '').trim() && !supplierById(l.supplierId))
          out.push({ block: true, text: `Item ${code.get(it.id)}: "${String(l.supplierName).trim()}" is not in the Supplier Master`, iid: it.id });
        if (lineAmt(k, l) < 0) out.push({ block: true, text: `Item ${code.get(it.id)} has a negative cost line`, iid: it.id });
      }));
    });
    ['overheadPct', 'contingencyPct', 'markupPct'].forEach(k => { if (num(E.est[k]) < 0) out.push({ block: true, text: 'Percentages cannot be negative' }); });
    if (num(E.est.roundTo) < 0) out.push({ block: true, text: 'The lump sum cannot be negative' });
    if (c.uncosted) out.push({ block: false, text: `${c.uncosted} item${c.uncosted === 1 ? '' : 's'} without cost` });
    return out;
  }
  function renderFooter() {
    const r = rfqOf(), latest = r && Number(E.version) === maxVersion(r);
    $('es-save').hidden = E.ro; $('es-revise').hidden = !(E.ro && canEdit() && latest && !E.isNew);
    // V271.2: Save & Create Quotation (or open the quotation made from this version)
    const qb = $('es-quote'), entry = r && idxOf(r).find(e => Number(e.version) === Number(E.version));
    const canQ = typeof window.bcCan !== 'function' || window.bcCan('quotation', 'c');
    if (E.status === 'Converted' && entry && entry.quotationId) { qb.hidden = false; qb.disabled = false; qb.textContent = 'Open Quotation'; qb.dataset.qid = entry.quotationId; }
    else if (!E.ro && canQ) { qb.hidden = false; delete qb.dataset.qid; qb.textContent = dirty() ? 'Save & Create Quotation' : 'Create Quotation'; }
    else qb.hidden = true;
    $('es-more').hidden = !(r && idxOf(r).length);
    const chk = $('es-chk');
    if (E.ro) { chk.className = 'es-chk'; chk.textContent = E.status === 'Superseded' ? 'Replaced by a newer version — shown read only.' : E.status === 'Converted' ? 'Quoted — shown read only. Revise to change the estimate.' : 'Shown read only.'; return; }
    const p = problems(), blocks = p.filter(x => x.block), notes = p.filter(x => !x.block);
    chk.className = 'es-chk' + (blocks.length ? ' is-todo' : '');
    chk.textContent = blocks.length ? 'To continue: ' + blocks.slice(0, 3).map((x, i) => '①②③'[i] + ' ' + x.text).join('  ') : '✓ Ready to save' + (notes.length ? ' · ' + notes.map(x => x.text).join(' · ') : ' · all items costed');
    $('es-save').disabled = !!blocks.length; $('es-save').title = blocks.length ? blocks[0].text : 'Save this estimate (Ctrl+S)';
    const qb2 = $('es-quote'); if (!qb2.dataset.qid) { qb2.disabled = !!blocks.length || calc(E.est).uncosted > 0; qb2.title = blocks.length ? blocks[0].text : calc(E.est).uncosted ? 'Every item needs a cost before the quotation' : 'The quotation takes the items, the section amounts and the lump sum from this estimate'; }
  }
  function changed() { if (!E) return; renderFooter(); }

  /* ── grid events ── */
  function onGridInput(e) {
    if (!E || E.ro) return;
    const el = e.target, f = el.dataset.f; if (!f) return;
    if (f === 'title') { const s = E.est.sections.find(x => x.id === el.closest('tr').dataset.sid); if (s) s.title = el.value; changed(); return; }
    const hit = findItem(el.closest('tr')?.dataset.iid); if (!hit) return;
    if (f === 'desc') { hit.it.desc = el.value; grow(el); }
    else if (f === 'unit') { hit.it.unit = el.value; unitDD(el, true, u => { hit.it.unit = u; el.value = u; changed(); }); }
    else if (f === 'qty') { hit.it.qty = el.value; el.classList.toggle('is-bad', el.value !== '' && !(num(el.value) > 0)); refreshNumbers(); }
    changed();
  }
  function onGridClick(e) {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const tr = b.closest('tr'), act = b.dataset.act;
    if (act === 'build') { openBuild(tr.dataset.iid); return; }
    if (act === 'item-menu') { itemMenu(b, tr.dataset.iid); return; }
    if (act === 'sec-menu') { secMenu(b, tr.dataset.sid); return; }
    if (E.ro) return;
    if (act === 'add-item') { addItem(b.dataset.sid || (E.sel && findItem(E.sel)?.s.id) || E.est.sections[E.est.sections.length - 1].id); return; }
    if (act === 'add-section') { addSection(); }
  }
  function onGridKey(e) {
    if (dd && e.target === dd.input && ['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) { ddKey(e); return; }
    const tr = e.target.closest('tr[data-iid]');
    if (e.key === 'F2' && tr) { e.preventDefault(); openBuild(tr.dataset.iid); return; }
    if (e.key === 'Enter' && e.target.dataset.f === 'qty' && tr && !E.ro) {   // Enter on Qty: next item, or a new one at the end of the section
      e.preventDefault();
      const hit = findItem(tr.dataset.iid), i = hit.s.items.indexOf(hit.it);
      if (i === hit.s.items.length - 1) addItem(hit.s.id); else focusItem(hit.s.items[i + 1].id, 'desc');
    }
  }
  function select(iid) { if (!E || E.sel === iid) return; E.sel = iid; $('es-grid').querySelectorAll('tr.es-it').forEach(tr => tr.classList.toggle('is-sel', tr.dataset.iid === iid)); }
  function focusItem(iid, f = 'desc') { const el = $('es-grid').querySelector(`tr[data-iid="${iid}"] [data-f="${f}"]`); if (el) { el.focus(); el.scrollIntoView({ block: 'nearest' }); } }
  function after(fn) { fn(); renderGrid(); renderTabs(); renderSide(); renderLists(); changed(); }
  function addItem(sid, at) {
    const s = E.est.sections.find(x => x.id === sid) || E.est.sections[E.est.sections.length - 1]; const it = blankItem({ unit: 'LS', qty: 1 });
    after(() => { if (at == null) s.items.push(it); else s.items.splice(at, 0, it); E.sel = it.id; });
    focusItem(it.id);
  }
  function addSection() {
    const s = { id: newId('es'), title: '', items: [] }; const it = blankItem(); s.items.push(it);
    after(() => { E.est.sections.push(s); E.sel = it.id; });
    const el = $('es-grid').querySelector(`tr[data-sid="${s.id}"].es-sec input`); if (el) { el.focus(); el.scrollIntoView({ block: 'nearest' }); }
  }

  /* ── menus (item ⋮, section ⋮, versions) ── */
  let menu = null;
  function closeMenu() { if (menu) { menu.remove(); menu = null; } }
  function openMenu(anchor, items, onPick) {
    closeMenu(); closeDD();
    const m = document.createElement('div'); m.className = 'es-menu';
    m.innerHTML = items.map(x => x === '-' ? '<hr>' : `<button type="button" data-v="${esc(x.v)}"${x.disabled ? ' disabled' : ''} class="${x.cls || ''}"><span>${x.label}</span>${x.key ? `<small>${esc(x.key)}</small>` : ''}</button>`).join('');
    document.body.appendChild(m);
    const b = anchor.getBoundingClientRect(), w = m.offsetWidth, h = m.offsetHeight;
    m.style.left = Math.max(8, Math.min(b.right - w, window.innerWidth - w - 8)) + 'px';
    m.style.top = Math.max(8, b.bottom + h + 8 < window.innerHeight ? b.bottom + 4 : b.top - h - 4) + 'px';
    m.addEventListener('mousedown', e => e.stopPropagation());
    m.addEventListener('click', e => { const x = e.target.closest('button[data-v]'); if (!x || x.disabled) return; closeMenu(); onPick(x.dataset.v); });
    menu = m;
    setTimeout(() => m.querySelector('button:not([disabled])')?.focus(), 0);
  }
  document.addEventListener('mousedown', e => { if (menu && !menu.contains(e.target)) closeMenu(); if (dd && !dd.el.contains(e.target) && e.target !== dd.input) closeDD(); });
  function itemMenu(anchor, iid) {
    const hit = findItem(iid); if (!hit) return; const i = hit.s.items.indexOf(hit.it), si = E.est.sections.indexOf(hit.s);
    const items = [{ v: 'build', label: E.ro ? 'View Cost Build-up' : 'Cost Build-up…', key: 'F2' }];
    if (!E.ro) items.push('-', { v: 'ins', label: 'Insert Item Below' }, { v: 'dup', label: 'Duplicate Item' }, { v: 'up', label: 'Move Up', disabled: i === 0 && si === 0 }, { v: 'down', label: 'Move Down', disabled: i === hit.s.items.length - 1 && si === E.est.sections.length - 1 },
      { v: 'tosec', label: 'Move To Section…', disabled: E.est.sections.length < 2 }, '-', { v: 'del', label: 'Delete Item', cls: 'es-danger' });
    openMenu(anchor, items, v => {
      if (v === 'build') return openBuild(iid);
      if (v === 'ins') return addItem(hit.s.id, i + 1);
      if (v === 'dup') { const cp = clone(hit.it); cp.id = newId('ei'); KINDS.forEach(({ k }) => (cp.build[k] || []).forEach(l => { l.id = newId('el'); })); delete cp.rfqLineId; after(() => { hit.s.items.splice(i + 1, 0, cp); E.sel = cp.id; }); return; }
      if (v === 'up' || v === 'down') return moveItem(hit, v === 'up' ? -1 : 1);
      if (v === 'tosec') return openMenu(anchor, E.est.sections.map((s, n) => ({ v: s.id, label: secCode(n) + ' · ' + esc(s.title || 'Untitled section'), disabled: s === hit.s })), sid => after(() => { hit.s.items.splice(hit.s.items.indexOf(hit.it), 1); E.est.sections.find(s => s.id === sid).items.push(hit.it); }));
      if (v === 'del') return askDelete(`Delete item ${calc(E.est).flat.find(x => x.id === iid)?.code || ''}?`, hit.it.desc || 'This item', () => after(() => { hit.s.items.splice(hit.s.items.indexOf(hit.it), 1); if (E.sel === iid) E.sel = null; }));
    });
  }
  function moveItem(hit, d) {
    const secs = E.est.sections, si = secs.indexOf(hit.s), i = hit.s.items.indexOf(hit.it);
    after(() => {
      hit.s.items.splice(i, 1);
      if (d < 0) { if (i > 0) hit.s.items.splice(i - 1, 0, hit.it); else secs[si - 1].items.push(hit.it); }
      else { if (i < hit.s.items.length) hit.s.items.splice(i + 1, 0, hit.it); else secs[si + 1].items.unshift(hit.it); }
    });
    focusItem(hit.it.id);
  }
  function secMenu(anchor, sid) {
    const secs = E.est.sections, si = secs.findIndex(s => s.id === sid), s = secs[si];
    openMenu(anchor, [{ v: 'add', label: 'Add Item To This Section' }, { v: 'up', label: 'Move Section Up', disabled: si === 0 }, { v: 'down', label: 'Move Section Down', disabled: si === secs.length - 1 }, '-', { v: 'del', label: 'Delete Section', cls: 'es-danger', disabled: secs.length < 2 }], v => {
      if (v === 'add') return addItem(sid);
      if (v === 'up' || v === 'down') return after(() => { secs.splice(si, 1); secs.splice(si + (v === 'up' ? -1 : 1), 0, s); });
      if (v === 'del') return askDelete(`Delete section ${secCode(si)}?`, (s.items.length ? `${s.items.length} item${s.items.length === 1 ? '' : 's'} and their cost build-up will be deleted too.` : 'The section is empty.'), () => after(() => { secs.splice(si, 1); }));
    });
  }
  function askDelete(title, message, ok) {
    const dlg = window.bizcoreShowSafeDialog;
    if (typeof dlg !== 'function') { if (confirm(title)) ok(); return; }
    dlg({ icon: 'ti-trash', title, message: esc(message).slice(0, 300), buttons: [{ text: 'Keep', cls: 'secondary' }, { text: 'Delete', cls: 'danger-outline', action: ok }] });
  }
  function versionsMenu(anchor) {
    const r = rfqOf(); if (!r) return;
    const idx = idxOf(r).slice().sort((a, b) => Number(b.version) - Number(a.version));
    const items = idx.map(e => ({ v: 'v' + e.version, label: `V${e.version} · ${esc(e.status || 'Saved')} · ${fmt(e.offerPrice != null ? e.offerPrice : e.sellTotal)}${Number(e.version) === Number(E.version) ? ' ✓' : ''}`, key: e.updated ? dmy(String(e.updated).slice(0, 10)) : '' }));
    const cur = idx.find(e => e.status === 'Saved');
    if (canEdit() && !E.isNew && idx.length) items.push('-', { v: 'new', label: 'Save As New Version…', disabled: E.ro && Number(E.version) !== maxVersion(r) });
    openMenu(anchor, items, async v => {
      if (v === 'new') return newVersion();
      const n = Number(v.slice(1)); if (n === Number(E.version) && !E.isNew) return;
      const go = async () => { const ok = await open(E.rfqId, { version: n }); if (!ok) toast('Could not open V' + n, 'error'); };
      if (dirty()) { const dlg = window.bizcoreShowSafeDialog; if (typeof dlg === 'function') return dlg({ icon: 'ti-alert-triangle', title: 'Open V' + n + ' Without Saving?', message: 'This estimate has unsaved changes.', buttons: [{ text: 'Stay', cls: 'secondary' }, { text: 'Discard & Open', cls: 'danger-outline', action: go }] }); }
      void cur; go();
    });
  }
  /** The estimate on screen becomes a new version (V max+1). Saving it replaces the current Saved version (Superseded). */
  function newVersion() {
    const r = rfqOf(); if (!r || !canEdit()) return;
    const go = () => {
      const est = clone(E.est); delete est.created; delete est.updated; delete est.savedBy; delete est.summary; delete est.quotationId;
      est.previousVersion = Number(E.version); est.estimateDate = today();
      E = { ...E, version: maxVersion(r) + 1, status: 'New', isNew: true, ro: false, est, base: JSON.stringify(est), bu: null };
      renderAll(); toast(`Version V${E.version} started from V${est.previousVersion} — change it and save. V${est.previousVersion} stays as it was.`, 'info');
    };
    if (dirty() && !E.isNew) { const dlg = window.bizcoreShowSafeDialog; if (typeof dlg === 'function') return dlg({ icon: 'ti-git-branch', title: 'Start A New Version?', message: 'Your unsaved changes go into the new version; V' + E.version + ' stays as last saved.', buttons: [{ text: 'Cancel', cls: 'secondary' }, { text: 'New Version', cls: 'primary', action: go }] }); }
    go();
  }

  /* ── side panel events ── */
  function onSideInput(e) {
    if (!E || E.ro) return; const f = e.target.dataset.f; if (!f) return;
    E.est[f] = e.target.value;
    const pos = e.target.selectionStart;
    renderSide(); renderGrid();   // the inputs of the side panel are rebuilt: the caret goes back where it was
    const el = $('es-side').querySelector(`[data-f="${f}"]`); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (_) {} }
    changed();
  }

  /* ══ Cost Build-up (CE_2) ══ */
  function openBuild(iid) {
    if (!E || !findItem(iid)) return;
    closeMenu(); select(iid); E.bu = iid;
    renderBuild(); const bu = $('es-bu'); bu.style.top = ($('estimate-modal').querySelector('.es-hd')?.offsetHeight || 56) + 'px'; bu.hidden = false;
    setTimeout(() => { const f = $('es-bu').querySelector('.es-bu-main input:not(:disabled)'); (f || $('es-bu-done'))?.focus({ preventScroll: true }); }, 30);
  }
  function closeBuild() { closeDD(); if (!E) return; E.bu = null; $('es-bu').hidden = true; renderGrid(); renderTabs(); renderSide(); renderLists(); changed(); const tr = $('es-grid').querySelector(`tr[data-iid="${E.sel}"]`); tr?.scrollIntoView({ block: 'nearest' }); }
  const COLS = {
    material: [['desc', 'Item (Item Master or free text)', ''], ['supplierName', 'Supplier', '20%'], ['qty', 'Qty', '70px'], ['unit', 'Unit', '70px'], ['rate', 'Unit Cost', '96px'], ['amt', 'Amount', '104px'], ['x', '', '32px']],
    manpower: [['trade', 'Trade', ''], ['supplierName', 'Manpower Supplier', '26%'], ['men', 'Men', '64px'], ['days', 'Days', '64px'], ['rate', 'Day Rate', '96px'], ['amt', 'Amount', '104px'], ['x', '', '32px']],
    subcontract: [['desc', 'Description', ''], ['supplierName', 'Subcontractor', '26%'], ['qty', 'Qty', '70px'], ['unit', 'Unit', '70px'], ['rate', 'Rate', '96px'], ['amt', 'Amount', '104px'], ['x', '', '32px']],
    other: [['desc', 'Description', ''], ['qty', 'Qty', '70px'], ['unit', 'Unit', '70px'], ['rate', 'Rate', '96px'], ['amt', 'Amount', '104px'], ['x', '', '32px']],
  };
  const NUMF = new Set(['qty', 'men', 'days', 'rate']);
  function buLineRow(k, l) {
    const cell = ([f]) => {
      if (f === 'amt') return `<td class="es-r es-val" data-amt>${fmt(lineAmt(k, l))}</td>`;
      if (f === 'x') return `<td>${E.ro ? '' : `<button type="button" class="es-x" data-act="del-line" title="Delete line" aria-label="Delete line">✕</button>`}</td>`;
      const v = l[f] == null ? '' : l[f];
      if (f === 'desc' && k === 'material') {
        const ref = l.productId ? lastPaid(l.productId) : null;
        return `<td><div class="es-wrap"><span class="es-src${l.productId ? ' m' : ''}" title="${l.productId ? 'From the Item Master' : 'Free text — not in the Item Master'}"></span><input class="es-in" data-f="desc" data-dd="product" value="${esc(v)}" maxlength="300" autocomplete="off" placeholder="Search the Item Master or type…" aria-label="Material"${ro()}></div>${ref ? `<div class="es-ref">Last paid ${fmt(ref.price)}${ref.no ? ' · ' + esc(ref.no) : ''}${E.ro ? '' : ` · <button type="button" data-act="use-paid" data-v="${ref.price}">use</button>`}</div>` : ''}</td>`;
      }
      if (f === 'trade') { const lr = labourRate(v); return `<td><input class="es-in" data-f="trade" value="${esc(v)}" list="es-trades" maxlength="60" placeholder="Trade" aria-label="Trade"${ro()}>${lr > 0 ? `<div class="es-ref">Labour Rates: ${fmt(lr)} / day</div>` : ''}</td>`; }
      if (f === 'supplierName') { const bad = String(v).trim() && !supplierById(l.supplierId); return `<td><input class="es-in${bad ? ' is-bad' : ''}" data-f="supplierName" data-dd="supplier" value="${esc(v)}" maxlength="160" autocomplete="off" placeholder="${k === 'material' ? 'Optional' : 'Supplier Master'}" aria-label="Supplier"${ro()}>${bad ? '<div class="es-ref" style="color:#b42318">Not in the Supplier Master</div>' : ''}</td>`; }
      if (f === 'unit') return `<td><input class="es-in" data-f="unit" data-dd="unit" value="${esc(v)}" maxlength="12" autocomplete="off" aria-label="Unit"${ro()}></td>`;
      return `<td><input class="es-in${NUMF.has(f) ? ' es-num' : ''}" data-f="${f}" value="${esc(NUMF.has(f) && v !== '' ? fq(v) : v)}"${NUMF.has(f) ? ' inputmode="decimal"' : ' maxlength="300"'} aria-label="${f}"${ro()}></td>`;
    };
    return `<tr data-lid="${l.id}">${COLS[k].map(cell).join('')}</tr>`;
  }
  function renderBuild() {
    const hit = findItem(E.bu); if (!hit) return;
    const c = calc(E.est), x = c.flat.find(y => y.id === hit.it.id), si = E.est.sections.indexOf(hit.s);
    const order = c.flat.map(y => y.id), pos = order.indexOf(hit.it.id);
    const group = ({ k, label, color }) => {
      const lines = hit.it.build[k] || [];
      return `<div class="es-grpbox" data-k="${k}"><div class="es-gh"><span><i class="es-d" style="background:${color}"></i>${label}${k === 'manpower' ? ' (Hired)' : ''}</span><b data-gt>${x.cost[k] ? fmt(x.cost[k]) : '—'}</b></div>
<table class="es-bt"><colgroup>${COLS[k].map(([, , w]) => `<col${w ? ` style="width:${w}"` : ''}>`).join('')}</colgroup>
<thead><tr>${COLS[k].map(([f, h]) => `<th${['qty', 'men', 'days', 'rate', 'amt'].includes(f) ? ' class="es-r"' : ''}>${h}</th>`).join('')}</tr></thead>
<tbody>${lines.map(l => buLineRow(k, l)).join('')}${E.ro ? (lines.length ? '' : `<tr><td colspan="${COLS[k].length}" class="es-m" style="padding:10px">None</td></tr>`) : `<tr class="es-add"><td colspan="${COLS[k].length}"><button type="button" class="es-lnk" data-act="add-line" data-k="${k}">+ Add ${k === 'other' ? 'Equipment / Other' : k === 'subcontract' ? 'Subcontract' : label}</button></td></tr>`}</tbody></table></div>`;
    };
    $('es-bu').innerHTML = `<div class="es-bu-hd"><button type="button" class="es-back" data-act="bu-done" title="Back to the items (Esc)" aria-label="Back to the items">${BACK_SVG}</button>
<div class="es-bu-tt"><h3>${x.code} · ${esc(String(hit.it.desc || 'Untitled item').split('\n')[0])}</h3><div>${fq(num(hit.it.qty))} ${esc(hit.it.unit || '')} · Section ${secCode(si)} — ${esc(hit.s.title || 'Untitled section')}${E.ro ? ' · read only' : ''}</div></div><div class="es-sp" style="flex:1"></div>
<button type="button" class="pr-btn" data-act="bu-prev"${pos <= 0 ? ' disabled' : ''}>‹ Previous</button><button type="button" class="pr-btn" data-act="bu-next"${pos >= order.length - 1 ? ' disabled' : ''}>Next ›</button></div>
<div class="es-bu-body"><div class="es-bu-main">${KINDS.map(group).join('')}</div>
<aside class="es-bu-side" id="es-bu-side"></aside></div>
<div class="es-bu-ft"><span class="es-chk" style="color:#64748b">Amounts are for the whole item (${fq(num(hit.it.qty))} ${esc(hit.it.unit || '')}). Material, manpower and subcontractor names come from the masters.</span><div class="es-sp" style="flex:1"></div><button type="button" class="btn btn-primary" id="es-bu-done" data-act="bu-done">Done</button></div>
<datalist id="es-trades">${settings().labourRates.filter(l => String(l.trade || '').trim()).map(l => `<option value="${esc(l.trade)}">${num(l.rate) > 0 ? fmt(l.rate) + ' / day' : ''}</option>`).join('')}</datalist>`;
    renderBuSide();
  }
  function renderBuSide() {
    const hit = findItem(E.bu); if (!hit) return;
    const c = calc(E.est), x = c.flat.find(y => y.id === hit.it.id), u = esc(hit.it.unit || 'unit');
    $('es-bu-side').innerHTML = `<div class="es-card"><h4>This Item</h4>
${KINDS.map(({ k, label, color }) => `<div class="es-kv"><span><i class="es-d" style="background:${color}"></i>${label}</span><b>${x.cost[k] ? fmt(x.cost[k]) : '—'}</b></div>`).join('')}
<div class="es-kv es-sum"><span>Total Cost</span><b>${fmt(x.cost.total)}</b></div>
<div class="es-kv"><span>Cost per ${u}</span><b>${x.qty > 0 ? fmt(x.costRate) : '—'}</b></div>
<div class="es-kv"><span>Sell Amount</span><b>${fmt(x.sell)}</b></div>
<div class="es-kv"><span>Sell Rate per ${u}</span><b>${x.qty > 0 ? fmt(x.sellRate) : '—'}</b></div></div>
${E.ro ? '' : `<div class="es-card"><h4>Copy From</h4><div class="es-note2" style="margin:0">Reuse the build-up of a similar item from this or an earlier estimate. Quantities and days follow this item's quantity.</div><input class="es-copy-in" id="es-copy" data-dd="copy" autocomplete="off" placeholder="Search earlier estimates…" aria-label="Copy the build-up from"></div>`}`;
  }
  function refreshBu(tr, k) {   // one line changed: its amount, the group total, the side card, the window's figures
    const hit = findItem(E.bu); if (!hit) return;
    const l = (hit.it.build[k] || []).find(y => y.id === tr?.dataset.lid);
    if (l && tr) { const a = tr.querySelector('[data-amt]'); if (a) a.textContent = fmt(lineAmt(k, l)); }
    const g = $('es-bu').querySelector(`.es-grpbox[data-k="${k}"] [data-gt]`); const ct = itemCost(hit.it); if (g) g.textContent = ct[k] ? fmt(ct[k]) : '—';
    renderBuSide(); changed();
  }
  function onBuInput(e) {
    if (!E || E.ro || !E.bu) return;
    const el = e.target, f = el.dataset.f, tr = el.closest('tr[data-lid]'); if (!f || !tr) { if (el.id === 'es-copy') copySearch(el); return; }
    const k = el.closest('.es-grpbox').dataset.k, hit = findItem(E.bu), l = hit.it.build[k].find(y => y.id === tr.dataset.lid); if (!l) return;
    l[f] = el.value;
    if (f === 'desc' && k === 'material' && l.productId) { l.productId = ''; const s = tr.querySelector('.es-src'); if (s) { s.classList.remove('m'); s.title = 'Free text — not in the Item Master'; } }
    if (f === 'supplierName') { l.supplierId = ''; }
    if (NUMF.has(f)) el.classList.toggle('is-bad', el.value !== '' && !(num(el.value) >= 0 && Number.isFinite(Number(String(el.value).replace(/,/g, '')))));
    if (el.dataset.dd) openDDFor(el, k, l, true);
    refreshBu(tr, k);
  }
  function onBuChange(e) {
    if (!E || E.ro || !E.bu) return;
    const el = e.target, tr = el.closest('tr[data-lid]'); if (!tr || el.dataset.f !== 'trade') return;
    const k = 'manpower', l = findItem(E.bu).it.build[k].find(y => y.id === tr.dataset.lid); if (!l) return;
    const lr = labourRate(el.value);
    if (lr > 0 && !(num(l.rate) > 0)) { l.rate = lr; const ri = tr.querySelector('[data-f="rate"]'); if (ri) ri.value = fq(lr); }
    const ref = el.parentElement.querySelector('.es-ref'); if (ref) ref.remove();
    if (lr > 0) el.insertAdjacentHTML('afterend', `<div class="es-ref">Labour Rates: ${fmt(lr)} / day</div>`);
    refreshBu(tr, k);
  }
  function onBuBlur(e) {   // a typed supplier name that matches the master exactly (any case) is linked to it
    const el = e.target; if (!E || E.ro || el.dataset.f !== 'supplierName') return;
    const tr = el.closest('tr[data-lid]'), k = el.closest('.es-grpbox')?.dataset.k; if (!tr || !k) return;
    const l = findItem(E.bu)?.it.build[k].find(y => y.id === tr.dataset.lid); if (!l) return;
    setTimeout(() => {
      if (dd && dd.input === el) return;
      const name = low(l.supplierName); if (!name || supplierById(l.supplierId)) return markSup(el, l);
      const hits = SUPPLIERS().filter(s => low(s.company) === name && !s._deletedAt);
      if (hits.length === 1) { l.supplierId = hits[0].id; l.supplierName = hits[0].company; el.value = hits[0].company; }
      markSup(el, l); changed();
    }, 160);
  }
  function markSup(el, l) {
    const bad = !!String(l.supplierName || '').trim() && !supplierById(l.supplierId);
    el.classList.toggle('is-bad', bad);
    const n = el.parentElement.querySelector('.es-ref'); if (n) n.remove();
    if (bad) el.insertAdjacentHTML('afterend', '<div class="es-ref" style="color:#b42318">Not in the Supplier Master</div>');
  }
  function onBuClick(e) {
    const b = e.target.closest('[data-act]'); if (!b || !E) return;
    const act = b.dataset.act;
    if (act === 'bu-done') return closeBuild();
    if (act === 'bu-prev' || act === 'bu-next') { const order = calc(E.est).flat.map(y => y.id), i = order.indexOf(E.bu) + (act === 'bu-next' ? 1 : -1); if (order[i]) openBuild(order[i]); return; }
    if (E.ro) return;
    const hit = findItem(E.bu); if (!hit) return;
    if (act === 'add-line') { const k = b.dataset.k, l = blankLine(k); hit.it.build[k].push(l); renderBuild(); changed(); const f = $('es-bu').querySelector(`tr[data-lid="${l.id}"] input`); f?.focus(); return; }
    const tr = b.closest('tr[data-lid]'), k = b.closest('.es-grpbox')?.dataset.k;
    if (act === 'del-line' && tr && k) { hit.it.build[k] = hit.it.build[k].filter(l => l.id !== tr.dataset.lid); renderBuild(); changed(); return; }
    if (act === 'use-paid' && tr) { const l = hit.it.build.material.find(y => y.id === tr.dataset.lid); if (l) { l.rate = num(b.dataset.v); const ri = tr.querySelector('[data-f="rate"]'); if (ri) ri.value = fq(l.rate); refreshBu(tr, 'material'); } }
  }
  function onBuKey(e) {
    if (dd && e.target === dd.input && ['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(e.key)) { ddKey(e); return; }
    if (e.key === 'Enter' && !E.ro && e.target.dataset.f === 'rate') {   // Enter on the rate: a new line of the same kind
      e.preventDefault(); const k = e.target.closest('.es-grpbox').dataset.k; $('es-bu').querySelector(`.es-grpbox[data-k="${k}"] [data-act="add-line"]`)?.click();
    }
  }

  /* ── dropdowns: Item Master, Supplier Master, Copy From ── */
  let dd = null;
  function closeDD() { if (dd) { dd.el.remove(); dd = null; } }
  function supplierById(id) { return id ? SUPPLIERS().find(s => String(s.id) === String(id) && !s._deletedAt) : null; }
  function lastPaid(productId) {
    const lib = window.BizCorePI; if (!lib || !lib.core || !lib.lastPrices) return null;
    const p = PRODUCTS().find(x => String(x.id) === String(productId)); if (!p) return null;
    let key; try { key = lib.core.itemKeyOf({ productId: p.id, code: p.code || '', desc: p.name || '', uom: p.uom || '' }); } catch (_) { return null; }
    const rec = lib.lastPrices.get ? lib.lastPrices.get(key) : null;
    return rec && !rec.stale && Number(rec.unitCost) > 0 ? { price: Number(rec.unitCost), no: rec.piNo || '', date: rec.date || '' } : null;
  }
  /** V271.2: the unit list always shows every unit on entering the field (typing narrows it; the current one is marked). */
  function unitDD(input, typed, onPick) {
    const q = typed ? low(input.value) : '', cur = low(input.value);
    const list = UNITS.filter(u => !q || low(u).includes(q) || UNITS.every(x => !low(x).includes(q)));
    showDD(input, list.map(u => ({ label: esc(u) + (low(u) === cur ? ' ✓' : ''), v: u })), onPick);
    dd.el.style.minWidth = '0'; dd.el.style.width = Math.max(input.getBoundingClientRect().width, 120) + 'px';
  }
  function openDDFor(input, k, l, typed) {
    if (input.dataset.dd === 'unit') return unitDD(input, typed, u => { l.unit = u; input.value = u; changed(); });
    const q = low(input.value);
    if (input.dataset.dd === 'product') {
      const hits = PRODUCTS().filter(p => !p._deletedAt && (!q || low(p.name).includes(q) || low(p.code).includes(q))).slice(0, 30);
      return showDD(input, hits.length ? hits.map(p => ({ label: esc(p.name || ''), sub: esc([p.code, p.uom].filter(Boolean).join(' · ')), v: p.id })) : [{ empty: q ? 'Not in the Item Master — kept as free text on this estimate.' : 'Type to search the Item Master.' }], v => {
        const p = PRODUCTS().find(x => String(x.id) === String(v)); if (!p) return;
        l.productId = p.id; l.desc = p.name || ''; if (p.uom) l.unit = p.uom;
        const lp = lastPaid(p.id); if (lp && !(num(l.rate) > 0)) l.rate = lp.price;
        renderBuild(); changed(); $('es-bu').querySelector(`tr[data-lid="${l.id}"] [data-f="qty"]`)?.focus();
      });
    }
    if (input.dataset.dd === 'supplier') {
      const flag = k === 'manpower' ? 'manpower' : k === 'subcontract' ? 'subcontractor' : '';
      const all = SUPPLIERS().filter(s => !s._deletedAt && (!q || low(s.company).includes(q) || low(s.code).includes(q)));
      const first = flag ? all.filter(s => (s.supplierKinds || []).includes(flag)) : [], rest = all.filter(s => !first.includes(s));
      const row = s => ({ label: esc(s.company || ''), sub: esc([s.code, s.cat].filter(Boolean).join(' · ')), v: s.id });
      const items = [];
      if (first.length) items.push({ h: flag === 'manpower' ? 'Manpower agencies' : 'Subcontractors' }, ...first.slice(0, 20).map(row));
      if (rest.length) { if (first.length) items.push({ h: 'Other suppliers' }); items.push(...rest.slice(0, 25).map(row)); }
      if (!items.length) items.push({ empty: 'Not in the Supplier Master. Add it in Master Data → Suppliers' + (flag ? ' (tick "' + (flag === 'manpower' ? 'Manpower agency' : 'Subcontractor') + '")' : '') + '.' });
      return showDD(input, items, v => {
        const s = supplierById(v); if (!s) return;
        l.supplierId = s.id; l.supplierName = s.company || ''; input.value = l.supplierName; markSup(input, l); changed();
        const next = input.closest('tr').querySelector(k === 'manpower' ? '[data-f="men"]' : '[data-f="qty"]'); next?.focus();
      });
    }
  }
  function showDD(input, items, onPick) {
    closeDD();
    const el = document.createElement('div'); el.className = 'es-dd';
    el.innerHTML = items.map((x, i) => x.h ? `<div class="es-dd-h">${esc(x.h)}</div>` : x.empty ? `<div class="es-dd-e">${esc(x.empty)}</div>` : `<button type="button" data-i="${i}"><span>${x.label}</span>${x.sub ? `<small>${x.sub}</small>` : ''}</button>`).join('');
    document.body.appendChild(el);
    const b = input.getBoundingClientRect(), w = Math.max(b.width, 300), h = Math.min(el.offsetHeight, 300);
    el.style.width = w + 'px'; el.style.left = Math.max(8, Math.min(b.left, window.innerWidth - w - 8)) + 'px';
    el.style.top = (b.bottom + h + 8 < window.innerHeight ? b.bottom + 3 : Math.max(8, b.top - h - 3)) + 'px';
    el.addEventListener('mousedown', e => e.preventDefault());
    el.addEventListener('click', e => { const x = e.target.closest('button[data-i]'); if (!x) return; const it = items[Number(x.dataset.i)]; closeDD(); onPick(it.v); });
    dd = { el, input, items, onPick, at: -1 };
  }
  function ddKey(e) {
    const btns = [...dd.el.querySelectorAll('button[data-i]')];
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeDD(); return; }
    if (e.key === 'Enter') { if (dd.at >= 0 && btns[dd.at]) { e.preventDefault(); btns[dd.at].click(); } else closeDD(); return; }
    e.preventDefault(); if (!btns.length) return;
    dd.at = (dd.at + (e.key === 'ArrowDown' ? 1 : -1) + btns.length) % btns.length;
    btns.forEach((b, i) => b.classList.toggle('on', i === dd.at)); btns[dd.at].scrollIntoView({ block: 'nearest' });
  }
  /* Copy From: items of this estimate and of the current version of other Contracting RFQs (read when first searched). */
  let others = null;
  async function loadOthers() {
    if (others) return others;
    others = [];
    const list = RFQS().filter(r => r.requestType === 'contracting' && idxOf(r).length && String(r.id) !== String(E.rfqId))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 40);
    await Promise.all(list.map(async r => {
      const n = Number(r.currentEstimateVersion) || maxVersion(r);
      try { const d = cache.get(r.id + '#' + n) || (window.FB && window.FB.fbReadDoc ? await window.FB.fbReadDoc('rfqs', r.id, 'estimates', 'v' + n) : null); if (d) { cache.set(r.id + '#' + n, d); others.push({ r, n, d }); } } catch (_) {}
    }));
    return others;
  }
  async function copySearch(input) {
    const q = low(input.value); const target = findItem(E.bu); if (!target) return;
    const src = [];
    const add = (label, est, it) => { const c = itemCost(it); if (c.total > 0) src.push({ label, it, cost: c.total }); };
    E.est.sections.forEach((s, si) => (s.items || []).forEach((it, ii) => { if (it.id !== target.it.id) add('This estimate · ' + secCode(si) + (ii + 1), E.est, it); }));
    if (q.length >= 2) (await loadOthers()).forEach(o => (o.d.sections || []).forEach((s, si) => (s.items || []).forEach((it, ii) => add(`${o.r.rfqNo || ''} V${o.n} · ${secCode(si)}${ii + 1}`, o.d, it))));
    if (!E || !E.bu || document.activeElement !== input) return;
    const hits = src.filter(x => !q || low(x.it.desc).includes(q)).slice(0, 30);
    showDD(input, hits.length ? hits.map((x, i) => ({ label: esc(String(x.it.desc || '').split('\n')[0]), sub: esc(x.label + ' · ' + fq(num(x.it.qty)) + ' ' + (x.it.unit || '') + ' · ' + fmt(x.cost)), v: i })) : [{ empty: q.length < 2 ? 'Type at least 2 letters to search earlier estimates too.' : 'No costed item matches.' }], i => applyCopy(hits[i].it));
  }
  function applyCopy(src) {
    const hit = findItem(E.bu); if (!hit) return;
    const f = num(src.qty) > 0 && num(hit.it.qty) > 0 ? num(hit.it.qty) / num(src.qty) : 1;
    const go = () => {
      const b = clone(src.build || {});
      KINDS.forEach(({ k }) => { b[k] = (b[k] || []).map(l => { const n = { ...l, id: newId('el') }; if (f !== 1) { if (k === 'manpower') n.days = r2(num(l.days) * f); else n.qty = r2(num(l.qty) * f); } return n; }); });
      hit.it.build = { ...blankBuild(), ...b };
      renderBuild(); changed(); toast('Build-up copied' + (f !== 1 ? ' and scaled ×' + fq(r2(f)) + ' to this item\'s quantity' : '') + ' — check the figures.', 'success');
    };
    const has = KINDS.some(({ k }) => (hit.it.build[k] || []).length);
    const dlg = window.bizcoreShowSafeDialog;
    if (has && typeof dlg === 'function') return dlg({ icon: 'ti-copy', title: 'Replace This Build-up?', message: 'The cost lines of this item will be replaced by the copied ones.', buttons: [{ text: 'Cancel', cls: 'secondary' }, { text: 'Replace', cls: 'primary', action: go }] });
    go();
  }

  /* ══ save ══ */
  async function save() {
    if (!E || E.ro) return false;
    if (E.bu) closeBuild();
    const p = problems(), block = p.find(x => x.block);
    if (block) {
      if (typeof showConfirm === 'function') showConfirm({ icon: '⚠️', title: 'Not ready to save', message: block.text + '.', confirmText: 'Go to it', cancelText: 'Close', confirmClass: 'btn-primary', onConfirm: () => { if (block.iid) { showTab('items'); if (block.f) focusItem(block.iid, block.f); else openBuild(block.iid); } } });
      return false;
    }
    const c = calc(E.est), r = rfqOf(); if (!r) return false;
    const ok = await new Promise(res => {
      if (typeof showConfirm !== 'function') return res(true);
      showConfirm({ icon: '💾', title: `Save estimation V${E.version}?`, message: 'Please confirm the cost build-up, overheads and the price have been reviewed.' + (c.uncosted ? ` ${c.uncosted} item${c.uncosted === 1 ? ' has' : 's have'} no cost yet.` : ''),
        details: { 'Items': c.itemCount, 'Direct cost': fmt(c.direct), 'Total cost (with overheads)': fmt(c.totalCost), 'Quoted price (excl. VAT)': fmt(c.offer), 'Profit · Margin': fmt(c.profit) + ' · ' + fq(r2(c.marginPct)) + ' %' },
        confirmText: 'Save Estimate', cancelText: 'Continue editing', confirmClass: 'btn-primary', onConfirm: () => res(true), onCancel: () => res(false) });
    });
    if (!ok) return false;
    const now = new Date().toISOString(), n = Number(E.version);
    const doc = clone(E.est);
    // the RFQ's lines that became items are remembered; nothing else is taken from the RFQ
    Object.assign(doc, { rfqId: String(r.id), version: n, status: 'Saved', created: E.est.created || now, updated: now, savedBy: who(), summary: summaryOf(c) });
    doc.roundTo = num(doc.roundTo) > 0 ? r2(num(doc.roundTo)) : 0;
    ['overheadPct', 'contingencyPct', 'markupPct'].forEach(k => { doc[k] = r2(num(doc[k])); });
    doc.sections.forEach(s => s.items.forEach(it => { it.qty = num(it.qty); KINDS.forEach(({ k }) => { it.build[k] = (it.build[k] || []).filter(l => lineAmt(k, l) !== 0 || String(l.desc || l.trade || '').trim()).map(l => { const o = { ...l }; ['qty', 'men', 'days', 'rate'].forEach(f => { if (f in o) o[f] = num(o[f]); }); return o; }); }); }));
    const before = { estimateIndex: clone(r.estimateIndex), currentEstimateVersion: r.currentEstimateVersion, status: r.status };
    const entry = { version: n, status: 'Saved', created: doc.created, updated: now, savedBy: doc.savedBy, previousVersion: doc.previousVersion || null,
      itemCount: c.itemCount, directCost: c.direct, totalCost: c.totalCost, sellTotal: c.sell, offerPrice: c.offer, marginPct: r2(c.marginPct) };
    const extras = [{ path: ['rfqs', r.id, 'estimates', 'v' + n], data: doc }];
    let idx = idxOf(r).map(e => ({ ...e }));
    idx.forEach(e => { if (Number(e.version) !== n && e.status === 'Saved') { e.status = 'Superseded'; e.updated = now; extras.push({ path: ['rfqs', r.id, 'estimates', 'v' + e.version], merge: true, data: { rfqId: String(r.id), version: Number(e.version), status: 'Superseded', updated: now } }); } });
    idx = idx.filter(e => Number(e.version) !== n).concat([entry]).sort((a, b) => Number(a.version) - Number(b.version));
    r.estimateIndex = idx; r.currentEstimateVersion = n; if (!r.status || r.status === 'New') r.status = 'Pricing';
    if (typeof showBusyOverlay === 'function') showBusyOverlay('estimate-modal', 'Saving estimate…');
    let saved = false;
    try { saved = window.FB && window.FB.fbSaveRecordWith ? await window.FB.fbSaveRecordWith('rfqs', r, extras) : true; }
    finally { if (typeof hideBusyOverlay === 'function') hideBusyOverlay('estimate-modal'); }
    if (!saved) {
      Object.assign(r, before); if (before.estimateIndex == null) delete r.estimateIndex; if (before.currentEstimateVersion == null) delete r.currentEstimateVersion;
      toast(typeof rfqSaveFailedMessage === 'function' ? rfqSaveFailedMessage() : 'The estimate was not saved — please try again.', 'error', 'Estimate not saved');
      return false;
    }
    cache.set(r.id + '#' + n, doc);
    idx.forEach(e => { const k = r.id + '#' + e.version; if (e.status === 'Superseded' && cache.has(k)) cache.get(k).status = 'Superseded'; });
    E.est = normalize(doc); E.base = JSON.stringify(E.est); E.status = 'Saved'; E.isNew = false;
    renderAll();
    try { if (typeof renderRFQ === 'function') renderRFQ(); } catch (_) {}
    try { if (typeof renderDashboard === 'function') renderDashboard(); } catch (_) {}
    setTimeout(() => toast(`Estimation V${n} saved.`, 'success', 'Saved'), 60);
    return true;
  }

  /* ══ V271.2 — the quotation from the estimate (CQ_1, CQ_2) ══
     The quotation is made in the normal Quotation Entry (Service template): sections → heading lines, items → scope
     lines with the estimate's quantity and unit. The price comes only from the estimate: each line's amount is its share
     of the lump sum (exact to the halala — a rate rounded up and a few halalas of line discount), qty / rate / line
     discount are locked; only the quotation discount can be given. Print Style: Lump Sum Only / With Section Totals. */
  const ceil2 = x => Math.ceil(Number(x) * 100 - 1e-6) / 100;
  async function toQuotation() {
    if (!E) return;
    const qb = $('es-quote');
    if (qb.dataset.qid) { const id = qb.dataset.qid; closeWin(); E = null; if (typeof viewQuotation === 'function') viewQuotation(id); return; }
    if (typeof window.bcCan === 'function' && !window.bcCan('quotation', 'c')) { toast('Your role cannot create quotations.', 'error'); return; }
    if (dirty()) { if (!(await save())) return; }
    if (E.status !== 'Saved') { toast('Only a saved estimate can be quoted.', 'error'); return; }
    const c = calc(E.est);
    if (c.uncosted) { toast(`${c.uncosted} item${c.uncosted === 1 ? ' has' : 's have'} no cost — every item needs a cost before the quotation.`, 'error'); return; }
    if (!(c.offer > 0)) { toast('The quoted price is 0.', 'error'); return; }
    const r = rfqOf(); if (!r) return;
    const est = E.est, n = Number(E.version);
    const shares = distribute(c.offer, c.flat.map(x => x.cost.total));
    const f = 1 + num(est.overheadPct) / 100 + num(est.contingencyPct) / 100;
    const lines = [];
    let k = 0;
    est.sections.forEach((s, si) => {
      lines.push({ lineType: 'heading', text: (s.title || 'Section ' + c.secs[si].code) });
      (s.items || []).forEach(it => {
        const share = shares[k], x = c.flat[k]; k++;
        const qty = num(it.qty) || 1, up = ceil2(share / qty), resid = r2(qty * up - share);
        const line = { rowKind: 'scope', freeScope: true, desc: String(it.desc || '').trim(), qty, uom: it.unit || 'LS', up, pricingSell: up, pricingBuy: r2(x.cost.total * f / qty), estItemId: it.id };
        if (resid > 0) { line.discBy = 'amt'; line.discAmt = resid; }
        lines.push(line);
      });
    });
    const ctx = { rfqId: String(r.id), rfqNo: r.rfqNo || '', version: n, ref: 'EST-' + String(r.rfqNo || '').replace(/^RFQ-?/i, '') + '-V' + n,
      style: est.quoteStyle === 'sections' ? 'sections' : 'lumpsum', showQty: true, offer: c.offer, itemCount: c.itemCount,
      budget: { material: c.by.material, manpower: c.by.manpower, subcontract: c.by.subcontract, other: c.by.other, overhead: c.overhead, contingency: c.contingency, totalCost: c.totalCost },
      plannedProfit: c.profit, site: est.site || '', duration: est.duration || '',
      sections: c.secs.map(s => ({ code: s.code, title: s.title || '', amount: s.offer })) };
    closeWin(); E = null;
    fillQuotation(r, ctx, lines, est);
  }
  function fillQuotation(r, ctx, lines, est) {
    const set = (id, v) => { const el = $(id); if (el) el.value = v; };
    try { editingId = null; } catch (_) {}
    $('modal-title').textContent = `New quotation — from Estimation V${ctx.version} · ${r.rfqNo || ''}`;
    const cust = (typeof customers !== 'undefined' ? customers : []).find(x => x.id === r.custId) || (typeof customers !== 'undefined' ? customers : []).find(x => x.company === r.company);
    if (cust) { try { selectedCustId = cust.id; } catch (_) {} set('f-cust-search', cust.company); $('f-cust-search')?.classList.add('cust-locked'); set('f-company', cust.company); set('f-city', cust.city || ''); }
    set('f-contact', r.contact || ''); set('f-ref', r.ref || ''); set('f-project', est.site || r.site || '');
    set('f-qno', 'Auto on Save'); if ($('f-qno')) { $('f-qno').dataset.reservedQno = ''; $('f-qno').dataset.isProvisional = '0'; }
    if (typeof todayQuoteDateDisplay === 'function') set('f-date', todayQuoteDateDisplay());
    set('f-status', 'Draft');
    let ps = {}; try { ps = activePricingSettings(); } catch (_) {}
    set('f-validity', Math.max(1, Number(ps.validity) || 7)); set('f-notes', ''); set('f-discount', ''); set('f-internal-notes', ''); set('f-additional-conditions', '');
    if (typeof populateTermsSelect === 'function') { populateTermsSelect('delivery'); populateTermsSelect('payment'); }
    try { currentQuoteVatRate = Number(activeTaxSettings().rate) || 0; currentQuoteNoteStyle = ''; currentQuoteType = 'contracting'; } catch (_) {}
    setQuoteType('contracting', { locked: true });
    $('items-tbody').innerHTML = '';
    lines.forEach(l => addItemRow(l));
    setQuotationPricingContext({ rfqNo: r.rfqNo, pricingRef: ctx.ref, cost: ctx.budget.totalCost, sell: ctx.offer, version: ctx.version });
    calcTotals();
    document._pendingRFQId = r.id; document._pendingPricingVersion = null;
    document._pendingQuotationRevision = null;
    if (r.quotationId && typeof nextQuotationRevisionNo === 'function') { const info = nextQuotationRevisionNo(r); if (info) document._pendingQuotationRevision = { ...info, rfqId: r.id, sourceQuotationId: r.quotationId || info.revisionOf || null }; }
    window._pendingEstimate = ctx;
    estQuoteSetup();
    if (typeof qtOnOpen === 'function') qtOnOpen();
    openModalWithSize('quote-modal');
    if (typeof qtAfterOpen === 'function') qtAfterOpen();
    toast(`Quotation prepared from Estimation V${ctx.version} — check the wording and save it`, 'success', 'From the estimate');
  }
  /** The Contracting card on the quotation's summary panel + the locked figures of the estimate lines. */
  let estObserver = null;
  function lockEstLines() {
    const on = !!window._pendingEstimate;
    document.querySelectorAll('#items-tbody tr[data-line-type="item"]').forEach(tr => {
      const lock = on && !!tr.dataset.estItem;
      tr.classList.toggle('qt-est-line', lock);
      tr.querySelectorAll('[data-quote-qty],[data-quote-price],[data-quote-dpct],[data-quote-damt]').forEach(i => {
        if (lock) { i.readOnly = true; i.tabIndex = -1; i.title = 'From the estimate — change the price with a new estimate version'; }
        else if (i.title.startsWith('From the estimate')) { i.readOnly = false; i.removeAttribute('tabindex'); i.title = ''; }
      });
    });
  }
  function estQuoteSetup() {
    const side = $('qt-side'); if (!side) return;
    let card = $('qt-est-card');
    const ctx = window._pendingEstimate;
    if (!estObserver && $('items-tbody')) { estObserver = new MutationObserver(() => lockEstLines()); estObserver.observe($('items-tbody'), { childList: true }); }
    if (!ctx) { if (card) card.hidden = true; lockEstLines(); return; }
    if (!card) { card = document.createElement('div'); card.id = 'qt-est-card'; card.className = 'qt-est-card'; const hd = side.querySelector('.qt-side-hd'); hd ? hd.after(card) : side.prepend(card); }
    card.hidden = false;
    card.innerHTML = `<div class="qt-est-h">Contracting · <b>Estimation V${esc(ctx.version)}</b>${ctx.rfqNo ? ' · ' + esc(ctx.rfqNo) : ''}</div>
<div class="qt-est-l">Print Style</div>
<label class="qt-est-o"><input type="radio" name="qt-est-style" value="lumpsum"${ctx.style !== 'sections' ? ' checked' : ''}><span><b>Lump Sum Only</b><small>Sections with their scope · one total</small></span></label>
<label class="qt-est-o"><input type="radio" name="qt-est-style" value="sections"${ctx.style === 'sections' ? ' checked' : ''}><span><b>With Section Totals</b><small>Each section shows its amount · total</small></span></label>
<label class="qt-est-c"><input type="checkbox" id="qt-est-qty"${ctx.showQty !== false ? ' checked' : ''}> Show Qty / Unit on print</label>
<div class="qt-est-n">Lump sum ${fmt(ctx.offer)} from the estimate. Qty, rates and line discounts are locked — only the quotation discount can be given. To change the price, make a new estimate version.<br>Rates are rounded up to the halala; the few halalas shown as line discounts keep every line exactly at its share of the lump sum (they are not printed).</div>`;
    card.onchange = e => {
      if (e.target.name === 'qt-est-style') ctx.style = e.target.value === 'sections' ? 'sections' : 'lumpsum';
      if (e.target.id === 'qt-est-qty') ctx.showQty = e.target.checked;
      if (typeof markDirty === 'function') markDirty('quote-modal');
    };
    lockEstLines();
  }
  function estQuoteBlock() { const c = window._pendingEstimate; return c ? clone(c) : null; }
  /** Before saving: the estimate lines must still be all there with their amounts (they make the lump sum). */
  function estQuoteValidate() {
    const ctx = window._pendingEstimate; if (!ctx) return true;
    const rows = [...document.querySelectorAll('#items-tbody tr[data-line-type="item"][data-est-item]')];
    let total = 0;
    rows.forEach(tr => {
      const q = typeof parseBizNumber === 'function' ? parseBizNumber(tr.querySelector('[data-quote-qty]')?.value) : num(tr.querySelector('[data-quote-qty]')?.value);
      const p = typeof parseBizNumber === 'function' ? parseBizNumber(tr.querySelector('[data-quote-price]')?.value) : num(tr.querySelector('[data-quote-price]')?.value);
      const d = typeof parseBizNumber === 'function' ? parseBizNumber(tr.querySelector('[data-quote-damt]')?.value) : num(tr.querySelector('[data-quote-damt]')?.value);
      total += r2(q * p - d);
    });
    total = r2(total);
    if (rows.length === ctx.itemCount && Math.abs(total - ctx.offer) < 0.01) return true;
    const msg = rows.length !== ctx.itemCount ? `The estimate has ${ctx.itemCount} item${ctx.itemCount === 1 ? '' : 's'}; this quotation has ${rows.length} of them.` : `The estimate lines add up to ${fmt(total)}; the estimate's lump sum is ${fmt(ctx.offer)}.`;
    if (typeof showConfirm === 'function') showConfirm({ icon: '⚠️', title: 'Lines changed from the estimate', message: msg + ' The price of a Contracting quotation comes only from its estimate — make a new estimate version to change it (lines can be reworded, not removed). Give a reduction as the quotation discount.', confirmText: 'OK', cancelText: 'Close', confirmClass: 'btn-primary' });
    return false;
  }
  /** At the save of a new quotation from the estimate: the version becomes Converted (locked) and points to it. */
  function estMarkConverted(rfq, q) {
    const ctx = window._pendingEstimate; if (!ctx || !rfq) return;
    const now = new Date().toISOString(), n = Number(ctx.version);
    const e = (rfq.estimateIndex || []).find(x => Number(x.version) === n); if (!e) return;
    const wasSaved = e.status === 'Saved';
    e.status = 'Converted'; e.quotationId = q.id; e.updated = now;
    const ck = rfq.id + '#' + n; if (cache.has(ck)) { cache.get(ck).status = 'Converted'; cache.get(ck).quotationId = q.id; }
    if (wasSaved && window.FB && window.FB.fbMergeFields) window.FB.fbMergeFields('rfqs/' + rfq.id + '/estimates', 'v' + n, { status: 'Converted', updated: now, quotationId: q.id });
  }
  window.bcEstQuoteSetup = estQuoteSetup;
  window.bcEstQuoteBlock = estQuoteBlock;
  window.bcEstQuoteValidate = estQuoteValidate;
  window.bcEstMarkConverted = estMarkConverted;

  /* ── keyboard ── */
  document.addEventListener('keydown', e => {
    const m = $('estimate-modal'); if (!m || !m.classList.contains('open') || !E) return;
    if (document.querySelector('.safe-exit-dialog,#app-confirm-overlay,.confirm-overlay')) return;
    if (e.key === 'Escape') {
      if (dd) { e.preventDefault(); e.stopImmediatePropagation(); closeDD(); return; }
      if (menu) { e.preventDefault(); e.stopImmediatePropagation(); closeMenu(); return; }
      e.preventDefault(); e.stopImmediatePropagation();
      if (E.bu) closeBuild(); else requestClose(false);
      return;
    }
    if (e.altKey && e.key === 'ArrowLeft' && !E.bu) { e.preventDefault(); requestClose(true); return; }
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) { e.preventDefault(); if (!E.ro && !$('es-save').disabled) save(); }
  }, true);

  /* ══ Administration → Contracting Settings ══ */
  let CS = null, CSbase = '';
  const isAdmin = () => !!(window.BizCorePI && window.BizCorePI.isAdministrator) || !!(window.BizCoreShared && window.BizCoreShared.isAdministrator);
  const canRates = () => isAdmin() || (typeof window.bcRight === 'function' && window.bcRight('contractingRates'));
  const DEF_KEYS = ['overheadPct', 'contingencyPct', 'markupPct', 'roundStep', 'warnAmberPct', 'warnRedPct'];
  function renderSettings(force) {
    const host = $('bc-contracting-settings'); if (!host) return;
    if (!CS || force) { CS = settings(); CSbase = JSON.stringify(CS); }
    const dis = isAdmin() ? '' : ' disabled', rdis = canRates() ? '' : ' disabled';
    const pct = (k, label, hint) => `<div class="cs-row"><span>${label}${hint ? `<br><small style="color:#94a3b8">${hint}</small>` : ''}</span><input data-k="${k}" value="${esc(fq(CS[k]))}" inputmode="decimal"${dis}></div>`;
    const types = KINDS.map(({ k, label }) => `<option value="${k}">${label}</option>`).join('');
    host.innerHTML = `<div class="setup-page-head admin-master-width"><div><h2><i class="ti ti-building-cog" style="margin-right:7px"></i>Contracting Settings</h2><p>Defaults for Contracting estimates, hired labour rates and the expense categories of job costs.</p></div></div>
<div class="admin-master-width">${isAdmin() ? '' : `<div class="cs-ro">${canRates() ? 'You can change the Labour Rates and the Expense Categories. The estimate defaults and the budget warnings are changed by an administrator.' : 'Only an administrator can change these settings.'}</div>`}
<div class="cs-grid">
<section class="cs-card"><h3>Estimate Defaults</h3><p>Used when a new estimate is started; each estimate can change them for itself.</p>
${pct('overheadPct', 'Overheads %', 'of the direct cost')}${pct('contingencyPct', 'Contingency %', 'of the direct cost')}${pct('markupPct', 'Markup %', 'on the total cost')}${pct('roundStep', 'Lump sum rounding step', 'offered as "Use …" (rounded down), e.g. 100')}</section>
<section class="cs-card"><h3>Job Budget Warnings</h3><p>Used by the Job view (estimate vs actual) in a later update.</p>
${pct('warnAmberPct', 'Amber at % of budget', '')}${pct('warnRedPct', 'Red over % of budget', '')}</section>
<section class="cs-card"><h3>Labour Rates (Hired Manpower)</h3><p>The usual day rate per trade; picked up in the Cost Build-up when the rate is empty.</p>
<table><thead><tr><th>Trade</th><th style="width:130px;text-align:right">Rate / Day</th><th style="width:34px"></th></tr></thead><tbody>
${CS.labourRates.map((l, i) => `<tr><td><input data-lr="${i}" data-f="trade" value="${esc(l.trade)}" maxlength="60"${rdis}></td><td><input class="r" data-lr="${i}" data-f="rate" value="${num(l.rate) ? esc(fq(l.rate)) : ''}" placeholder="0.00" inputmode="decimal"${rdis}></td><td>${rdis ? '' : `<button type="button" class="cs-x" data-del-lr="${i}" title="Remove">✕</button>`}</td></tr>`).join('')}
</tbody></table>${rdis ? '' : '<button type="button" class="cs-add" data-add="lr">+ Add Trade</button>'}</section>
<section class="cs-card"><h3>Expense Categories</h3><p>For job expenses (petty cash, site costs) in a later update — each one counts as a cost type.</p>
<table><thead><tr><th>Category</th><th style="width:170px">Cost Type</th><th style="width:34px"></th></tr></thead><tbody>
${CS.expenseCategories.map((x, i) => `<tr><td><input data-ec="${i}" data-f="name" value="${esc(x.name)}" maxlength="60"${rdis}></td><td><select data-ec="${i}" data-f="costType"${rdis}>${types.replace(`value="${x.costType}"`, `value="${x.costType}" selected`)}</select></td><td>${rdis ? '' : `<button type="button" class="cs-x" data-del-ec="${i}" title="Remove">✕</button>`}</td></tr>`).join('')}
</tbody></table>${rdis ? '' : '<button type="button" class="cs-add" data-add="ec">+ Add Category</button>'}</section>
</div>
<div class="cs-bar"><span id="cs-status" style="font-size:12px;color:#64748b">No pending changes</span><span style="display:flex;gap:8px"><button type="button" class="btn btn-secondary" id="cs-cancel" disabled>Cancel Changes</button><button type="button" class="btn btn-primary" id="cs-save" disabled>Save Settings</button></span></div></div>`;
    host.oninput = host.onchange = e => {
      const t = e.target;
      if (t.dataset.k) CS[t.dataset.k] = t.value;
      else if (t.dataset.lr != null) CS.labourRates[Number(t.dataset.lr)][t.dataset.f] = t.value;
      else if (t.dataset.ec != null) CS.expenseCategories[Number(t.dataset.ec)][t.dataset.f] = t.value;
      csState();
    };
    host.onclick = e => {
      const t = e.target; if (!canRates()) return;
      if (t.dataset.add === 'lr') { CS.labourRates.push({ id: newId('lr'), trade: '', rate: 0, unit: 'Day' }); renderSettings(); csState(); host.querySelector(`[data-lr="${CS.labourRates.length - 1}"][data-f="trade"]`)?.focus(); }
      else if (t.dataset.add === 'ec') { CS.expenseCategories.push({ id: newId('ec'), name: '', costType: 'other' }); renderSettings(); csState(); host.querySelector(`[data-ec="${CS.expenseCategories.length - 1}"][data-f="name"]`)?.focus(); }
      else if (t.dataset.delLr != null) { CS.labourRates.splice(Number(t.dataset.delLr), 1); renderSettings(); csState(); }
      else if (t.dataset.delEc != null) { CS.expenseCategories.splice(Number(t.dataset.delEc), 1); renderSettings(); csState(); }
      else if (t.id === 'cs-cancel') { renderSettings(true); }
      else if (t.id === 'cs-save') saveSettings();
    };
    csState();
  }
  function csClean() {
    const o = clone(CS);
    ['overheadPct', 'contingencyPct', 'markupPct', 'roundStep', 'warnAmberPct', 'warnRedPct'].forEach(k => { o[k] = r2(num(o[k])); });
    o.labourRates = o.labourRates.map(l => ({ id: l.id || newId('lr'), trade: String(l.trade || '').trim(), rate: r2(num(l.rate)), unit: 'Day' })).filter(l => l.trade);
    o.expenseCategories = o.expenseCategories.map(x => ({ id: x.id || newId('ec'), name: String(x.name || '').trim(), costType: KIND[x.costType] ? x.costType : 'other' })).filter(x => x.name);
    return o;
  }
  function csState() {
    const d = JSON.stringify(CS) !== CSbase, st = $('cs-status'); if (!st) return;
    st.textContent = d ? 'Unsaved changes pending' : 'No pending changes'; st.style.color = d ? '#b45309' : '#64748b';
    $('cs-save').disabled = !d || !canRates(); $('cs-cancel').disabled = !d;
  }
  function saveSettings() {
    const o = csClean();
    const bad = ['overheadPct', 'contingencyPct', 'markupPct', 'roundStep', 'warnAmberPct', 'warnRedPct'].find(k => o[k] < 0);
    if (bad) { toast('Percentages and the rounding step cannot be negative.', 'error'); return; }
    if (o.warnRedPct && o.warnAmberPct > o.warnRedPct) { toast('The amber warning must come before (or at) the red one.', 'error'); return; }
    const dupe = (a, f) => { const s = new Set(); return a.find(x => { const k = low(x[f]); if (s.has(k)) return true; s.add(k); return false; }); };
    const d1 = dupe(o.labourRates, 'trade'), d2 = dupe(o.expenseCategories, 'name');
    if (d1 || d2) { toast(`"${(d1 || {}).trade || (d2 || {}).name}" is in the list twice.`, 'error'); return; }
    const base = JSON.parse(CSbase), pick = (x, ks) => Object.fromEntries(ks.map(k => [k, x[k]]));
    const defsChanged = DEF_KEYS.some(k => r2(num(base[k])) !== o[k]);
    const ratesChanged = JSON.stringify(pick(base, ['labourRates', 'expenseCategories'])) !== JSON.stringify(pick(o, ['labourRates', 'expenseCategories']));
    const go = async () => {
      // two records: the defaults (administrators) and the lists (administrators + the Special Right)
      if (defsChanged && isAdmin()) { try { localStorage.setItem(SKEY, JSON.stringify(pick(o, DEF_KEYS))); } catch (e) {} if (typeof bcSharedSave === 'function') await bcSharedSave(SKEY); }
      if (ratesChanged || (isAdmin() && !readJSON(RKEY))) { try { localStorage.setItem(RKEY, JSON.stringify(pick(o, ['labourRates', 'expenseCategories']))); } catch (e) {} if (typeof bcSharedSave === 'function') await bcSharedSave(RKEY); }
      CS = settings(); CSbase = JSON.stringify(CS); renderSettings(); toast('Contracting settings saved', 'success');
    };
    if (typeof showConfirm === 'function') showConfirm({ icon: '✅', title: 'Save contracting settings?', message: 'New estimates will use these defaults. Saved estimates keep their own figures.', confirmText: 'Save Settings', confirmClass: 'btn-primary', onConfirm: go });
    else go();
  }
  window.bcRenderContractingSettings = () => renderSettings(true);
  window.bcContractingSettingsReload = () => { const host = $('bc-contracting-settings'); if (host && host.offsetParent && JSON.stringify(CS) === CSbase) renderSettings(true); };

  /* ══ public ══ */
  window.bcOpenEstimate = (rfqId, opts) => open(rfqId, opts || {});
  window.BCEst = { calc, itemCost, lineAmt, distribute, settings, summaryOf, marginState, open, save: () => save(), state: () => E, cache, DEFAULTS };
})();
