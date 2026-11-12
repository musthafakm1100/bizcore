/* ═══════════════════════════════════════════════════════════════════════════════════════════════
   BizCore V271.8 — Dashboard (approved mockup "E · Final direction", 12 Nov 2026)
   Dark header with one line of filters · Needs attention (live work queues) · sales target ring and
   trend cards · Sales & gross profit (12 months) · Sales pipeline · Next 2 weeks · Receivables ·
   Top customers · Contracting jobs. Phone: one column, tiles 2 × 3, swipe cards, the 2 weeks as a list.

   Firebase reads: none of its own for the sales side — it uses what BizCore already loads at sign-in
   (RFQs, quotations, sales orders, delivery notes, invoices, receipts). Jobs are read once per session
   (as the Jobs screen does). Cash & Bank reads only the payment accounts and their running balances
   (a few small documents). Supplier bills come from Purchasing, which loads only when the user asks
   ("Show") or has already opened a purchasing screen in this session.
   Every card follows the role: a module without View is not shown; cost / profit only with the
   Special Right "See cost, margin and profit".
   Loaded after js/app.js and js/so-view.js; app.js renderDashboard() calls BCDash.render().
   ═══════════════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.BCDash) return;

  /* ───────────────────────── small helpers ───────────────────────── */
  const $ = id => document.getElementById(id);
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const r2 = n => Math.round((num(n) + Number.EPSILON) * 100) / 100;
  const pad = n => String(n).padStart(2, '0');
  const isoOf = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const today = () => isoOf(new Date());
  const dateOf = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  const addDays = (iso, n) => { const d = dateOf(iso); d.setDate(d.getDate() + n); return isoOf(d); };
  const diffDays = (a, b) => Math.round((dateOf(b) - dateOf(a)) / 86400000);
  const monthKey = iso => String(iso || '').slice(0, 7);
  const monthStart = key => key + '-01';
  const monthEnd = key => { const [y, m] = key.split('-').map(Number); return isoOf(new Date(y, m, 0)); };
  const addMonths = (key, n) => { const [y, m] = key.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1); };
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monLabel = key => MON[Number(key.slice(5, 7)) - 1];
  const dmy = iso => (typeof fmtDate === 'function' ? fmtDate(iso) : iso) || '—';
  const sd = iso => { const d = dateOf(iso); return d ? pad(d.getDate()) + '-' + pad(d.getMonth() + 1) : ''; };
  /** 61,234 → "61.2K", 1,250,000 → "1.25M", 950 → "950" */
  function short(n) {
    const a = Math.abs(num(n)), s = n < 0 ? '−' : '';
    if (a >= 1e6) return s + (a / 1e6).toFixed(a >= 1e7 ? 1 : 2).replace(/\.?0+$/, '') + 'M';
    if (a >= 1e3) return s + (a / 1e3).toFixed(a >= 1e5 ? 0 : 1).replace(/\.0$/, '') + 'K';
    return s + Math.round(a);
  }
  const sar = n => 'SAR ' + short(n);
  const money = n => (typeof formatNumber === 'function' ? formatNumber(num(n), 2) : num(n).toFixed(2));
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');

  /* ───────────────────────── who may see what ───────────────────────── */
  const can = mod => { try { return typeof window.bcCan === 'function' ? !!window.bcCan(mod, 'v') : true; } catch (e) { return true; } };
  const isAdmin = () => { try { return typeof bcIsAdmin === 'function' ? !!bcIsAdmin() : false; } catch (e) { return false; } };
  const seeCost = () => { try { if (typeof window.bcRight === 'function') return !!window.bcRight('seeCost'); } catch (e) {} return isAdmin(); };
  const canSetTarget = () => { try { return isAdmin() || (typeof window.bcCan === 'function' && !!window.bcCan('administration', 'e')); } catch (e) { return false; } };
  const canJobs = () => !!window.BCJobs && (can('salesOrder') || can('quotation'));
  const canCash = () => can('cash') && !!window.BizCoreAcc && !!window.BizCoreCash;
  const canPI = () => (can('purchaseInvoice') || can('supplierPayment')) && !!window.BizCorePI;

  /* ───────────────────────── the data BizCore already has ───────────────────────── */
  const G = name => { try { switch (name) {
    case 'rfqs': return typeof rfqs !== 'undefined' && Array.isArray(rfqs) ? rfqs : [];
    case 'quotes': return typeof quotations !== 'undefined' && Array.isArray(quotations) ? quotations : [];
    case 'sos': return typeof salesOrders !== 'undefined' && Array.isArray(salesOrders) ? salesOrders : [];
    case 'invs': return typeof invoicesCache !== 'undefined' && Array.isArray(invoicesCache) ? invoicesCache : [];
    case 'rcts': return typeof receiptsCache !== 'undefined' && Array.isArray(receiptsCache) ? receiptsCache : [];
    default: return [];
  } } catch (e) { return []; } };
  const live = r => r && !r._deletedAt;
  const invoicesOn = () => { try { return typeof invIndependentMode === 'function' && invIndependentMode(); } catch (e) { return false; } };

  /* jobs: read once per session (the Jobs screen keeps the same list) */
  let jobsAsked = false;
  function jobsList() {
    if (!canJobs()) return [];
    try { const l = window.BCJobs.list(); if (!jobsAsked) { jobsAsked = true; window.BCJobs.load().then(soon, () => {}); } return (l || []).filter(live); } catch (e) { return []; }
  }

  /* ───────────────────────── filters ───────────────────────── */
  const S = { period: { preset: 'month', from: '', to: '' }, activity: 'all', customer: '', owner: '', compare: 'prev' };
  const prefKey = () => 'bc_dash:' + ((window.currentUser && window.currentUser.uid) || 'me');
  function loadPrefs() { try { const p = JSON.parse(localStorage.getItem(prefKey()) || '{}'); if (['all', 'trading', 'contracting'].includes(p.activity)) S.activity = p.activity; if (['prev', 'year', 'none'].includes(p.compare)) S.compare = p.compare; } catch (e) {} }
  function savePrefs() { try { localStorage.setItem(prefKey(), JSON.stringify({ activity: S.activity, compare: S.compare })); } catch (e) {} }
  function monthRange(key) { return { from: monthStart(key), to: monthEnd(key) }; }
  S.period = { preset: 'month', ...monthRange(monthKey(today())) };

  function rfqOf(q) { const id = q && q.rfqId; return id ? G('rfqs').find(r => r.id === id || r.rfqNo === id) : null; }
  function quoteOf(id) { return id ? G('quotes').find(q => q.id === id || q.qno === id) : null; }
  function soOf(id) { return id ? G('sos').find(s => s.id === id) : null; }
  const isContractRfq = r => !!r && r.requestType === 'contracting';
  const isContractQuote = q => !!q && (!!q.estimate || isContractRfq(rfqOf(q)));
  function actOf(kind, x) {
    if (kind === 'rfq') return isContractRfq(x) ? 'contracting' : 'trading';
    if (kind === 'quote') return isContractQuote(x) ? 'contracting' : 'trading';
    if (kind === 'job') return 'contracting';
    return 'trading';   // sales orders, invoices, receipts (job invoicing comes with V271.4)
  }
  function custOf(kind, x) {
    if (kind === 'so' || kind === 'inv' || kind === 'rct') return x.customer || '';
    return x.company || x.customer || '';
  }
  function ownerOf(kind, x) {
    if (kind === 'rfq' || kind === 'quote' || kind === 'so') return x.ownerUid || '';
    if (kind === 'job') { const q = quoteOf(x.quotationId); return (q && q.ownerUid) || ''; }
    if (kind === 'inv') { const so = soOf(x.salesOrderId); return (so && so.ownerUid) || ''; }
    if (kind === 'rct') { const a = (x.allocations || [])[0]; const so = a && soOf(a.salesOrderId); return (so && so.ownerUid) || ''; }
    return '';
  }
  function pass(kind, x, opts) {
    if (!live(x)) return false;
    if (S.activity !== 'all' && actOf(kind, x) !== S.activity) return false;
    if (S.customer && custOf(kind, x) !== S.customer) return false;
    if (S.owner && ownerOf(kind, x) !== S.owner) return false;
    return true;
  }
  const inRange = (d, from, to) => { d = String(d || '').slice(0, 10); if (!d) return false; if (from && d < from) return false; if (to && d > to) return false; return true; };

  function userName(uid) {
    if (!uid) return '';
    try { const u = ((window.BizCoreUsers && window.BizCoreUsers.users) || []).find(x => x.uid === uid); if (u && u.name) return u.name; } catch (e) {}
    try { const p = ((window.BizCoreShared && window.BizCoreShared.profiles) || []).find(x => x.uid === uid); if (p) return p.name || p.displayName || p.email || ''; } catch (e) {}
    if (window.currentUser && window.currentUser.uid === uid) return window.currentUser.name || window.currentUser.email || 'Me';
    return '';
  }

  /** the period actually covered (an "All Dates" period starts at the first record) */
  function periodNow() {
    const st = S.period;
    if (st.preset === 'all') return { from: '', to: '', all: true };
    return { from: st.from || '', to: st.to || '' };
  }
  const isWholeMonths = (from, to) => from && to && from.slice(8) === '01' && to === monthEnd(monthKey(to));
  function periodLabel() {
    const p = periodNow(), t = today();
    if (p.all) return 'All dates';
    if (isWholeMonths(p.from, p.to) && monthKey(p.from) === monthKey(p.to)) { const k = monthKey(p.from); return MON[+k.slice(5) - 1] + ' ' + k.slice(0, 4) + (k === monthKey(t) ? ' (to date)' : ''); }
    return dmy(p.from) + ' → ' + dmy(p.to);
  }
  /** the comparison period: same length before (to the same day when the period runs to today), or the same dates a year earlier */
  function compareRange() {
    const p = periodNow(); if (p.all || !p.from || !p.to || S.compare === 'none') return null;
    const t = today(), curTo = p.to > t ? t : p.to;
    if (curTo < p.from) return null;
    if (S.compare === 'year') {
      const y = iso => (Number(iso.slice(0, 4)) - 1) + iso.slice(4);
      return { from: y(p.from), to: y(curTo), label: 'same period last year' };
    }
    if (isWholeMonths(p.from, p.to)) {
      const n = (Number(p.to.slice(0, 4)) - Number(p.from.slice(0, 4))) * 12 + Number(p.to.slice(5, 7)) - Number(p.from.slice(5, 7)) + 1;
      const fromK = addMonths(monthKey(p.from), -n);
      const from = monthStart(fromK), span = diffDays(p.from, curTo);
      let to = addDays(from, span); const lastPrev = monthEnd(addMonths(monthKey(p.from), -1)); if (to > lastPrev) to = lastPrev;
      return { from, to, label: n === 1 ? (curTo < p.to ? 'same days last month' : 'last month') : 'previous ' + n + ' months' };
    }
    const days = diffDays(p.from, curTo) + 1;
    return { from: addDays(p.from, -days), to: addDays(p.from, -1), label: 'previous ' + days + ' days' };
  }

  /* ───────────────────────── sales: orders + awarded jobs ───────────────────────── */
  function soNet(so) {
    const s = num(so.subtotal); if (s > 0) return s;
    const vr = num(so.vatRate); const rate = vr > 1 ? vr / 100 : (vr || 0.15);
    return r2(num(so.total) / (1 + rate));
  }
  function salesRecords() {
    const out = [];
    if (can('salesOrder')) G('sos').forEach(so => { if (pass('so', so)) out.push({ kind: 'so', id: so.id, no: so.soNo || '', date: String(so.date || '').slice(0, 10), cust: so.customer || '', value: soNet(so), so }); });
    jobsList().forEach(j => { if (j.status === 'Cancelled' || !pass('job', j)) return; out.push({ kind: 'job', id: j.id, no: j.jobNo || '', date: String(j.date || j.poDate || j.created || '').slice(0, 10), cust: j.company || j.customer || '', value: num(j.contractValue), job: j }); });
    return out;
  }
  const piStamp = () => { try { const L = window.BizCorePI; return L ? (L.invoices || []).length + ':' + (L.lastPrices ? L.lastPrices.size : 0) + ':' + (L.allocations || []).length : '0'; } catch (e) { return '0'; } };
  const profitMemo = new WeakMap();
  /** { profit, basis } — the Sales Order's Profit tab figures (actual purchases, else the pricing estimate / last paid); a job's planned profit */
  function profitOf(rec) {
    if (rec.kind === 'job') { const p = rec.job.plannedProfit; return p == null || p === '' ? null : { profit: num(p), basis: rec.value }; }
    const so = rec.so, k = piStamp(), m = profitMemo.get(so);
    if (m && m.k === k) return m.v;
    let v = null;
    try { if (typeof sovModel === 'function' && typeof sovProfitModel === 'function') { const P = sovProfitModel(sovModel(so)); if (P && P.t && P.t.counted > 0) v = { profit: num(P.t.profit), basis: num(P.t.selling) }; } } catch (e) { v = null; }
    profitMemo.set(so, { k, v });
    return v;
  }
  function sumSales(list, from, to) {
    let value = 0, profit = 0, basis = 0, n = 0;
    list.forEach(r => { if (!inRange(r.date, from, to)) return; value += r.value; n++; if (seeCost()) { const p = profitOf(r); if (p) { profit += p.profit; basis += p.basis; } } });
    return { value: r2(value), profit: r2(profit), basis: r2(basis), margin: basis > 0.005 ? profit / basis * 100 : NaN, n };
  }
  function receiptsIn(from, to) {
    if (!can('receipt')) return null;
    return r2(G('rcts').filter(r => r.status !== 'Voided' && pass('rct', r) && inRange(r.date, from, to)).reduce((s, r) => s + num(r.amount), 0));
  }

  /* ───────────────────────── target ───────────────────────── */
  function targets() { try { const t = (typeof settings !== 'undefined' && settings && settings.salesTargets) || {}; return { monthly: num(t.monthly), months: t.months || {} }; } catch (e) { return { monthly: 0, months: {} }; } }
  function targetFor(from, to) {
    if (!from || !to) return 0;
    const T = targets(); let k = monthKey(from), sum = 0, guard = 0;
    while (k <= monthKey(to) && guard++ < 60) {
      const full = T.months[k] != null && T.months[k] !== '' ? num(T.months[k]) : T.monthly;
      const s = monthStart(k) < from ? from : monthStart(k), e = monthEnd(k) > to ? to : monthEnd(k);
      const days = diffDays(monthStart(k), monthEnd(k)) + 1, part = diffDays(s, e) + 1;
      sum += full * part / days; k = addMonths(k, 1);
    }
    return r2(sum);
  }

  /* ───────────────────────── needs attention (live) ───────────────────────── */
  function quoteExpiry(q) { try { return typeof validUntil === 'function' ? validUntil(q) : ''; } catch (e) { return ''; } }
  function attention() {
    const t = today(), tiles = [];
    const RED = 'red', AMB = 'amber';
    if (can('rfq')) {
      const open = G('rfqs').filter(r => pass('rfq', r)).filter(r => { const st = typeof getRFQWorkflowStage === 'function' ? getRFQWorkflowStage(r) : 'New'; return st === 'New' || st === 'Pricing'; });
      const over = open.filter(r => { try { return rfqAge(r).overdue; } catch (e) { return false; } }).length;
      const inPricing = open.filter(r => getRFQWorkflowStage(r) === 'Pricing').length;
      const oldest = open.reduce((m, r) => Math.max(m, r.date ? diffDays(String(r.date).slice(0, 10), t) : 0), 0);
      tiles.push({ key: 'rfq', label: 'RFQs to price', dot: 'purple', count: String(open.length), sub: open.length ? (inPricing ? inPricing + ' in pricing' : 'Oldest ' + plural(oldest, 'day')) : 'All priced', flag: over ? over + ' overdue' : '', tone: RED });
    }
    if (can('quotation')) {
      const sent = G('quotes').filter(q => q.status === 'Sent' && pass('quote', q) && quoteExpiry(q) >= t);
      const soon = sent.filter(q => quoteExpiry(q) <= addDays(t, 3)).length;
      const val = sent.reduce((s, q) => s + (typeof calcQuote === 'function' ? num(calcQuote(q).bvat) : 0), 0);
      tiles.push({ key: 'quote', label: 'Quotes awaiting reply', dot: 'blue', count: String(sent.length), sub: sent.length ? sar(val) : 'None waiting', flag: soon ? soon + ' expiring' : '', tone: AMB });
    }
    if (can('salesOrder') && S.activity !== 'contracting') {
      const all = G('sos').filter(so => pass('so', so));
      const toDel = all.filter(so => { const st = typeof soOrderStatus === 'function' ? soOrderStatus(so) : 'Confirmed'; return st === 'Confirmed' || st === 'Partially Delivered'; });
      const late = toDel.filter(so => so.expectedDelivery && String(so.expectedDelivery).slice(0, 10) < t).length;
      const v = toDel.reduce((s, so) => s + (typeof soToDeliverValue === 'function' ? num(soToDeliverValue(so)) : 0), 0);
      tiles.push({ key: 'deliver', label: 'Orders to deliver', dot: 'orange', count: String(toDel.length), sub: toDel.length ? sar(v) : 'Nothing to deliver', flag: late ? late + ' late' : '', tone: RED });
      const toInv = all.filter(so => { try { return soHasInvoiceableQty(so); } catch (e) { return false; } });
      const iv = toInv.reduce((s, so) => s + (typeof soToInvoiceValue === 'function' ? num(soToInvoiceValue(so)) : 0), 0);
      tiles.push({ key: 'invoice', label: 'Ready to invoice', dot: 'teal', count: String(toInv.length), sub: toInv.length ? sar(iv) : 'Nothing to invoice', flag: '', tone: AMB });
    }
    if (canJobs() && S.activity === 'contracting') {
      const run = jobsList().filter(j => (j.status === 'Open' || j.status === 'In Progress' || !j.status) && pass('job', j));
      const late = run.filter(j => j.finishDate && String(j.finishDate).slice(0, 10) < t).length;
      tiles.push({ key: 'jobs', label: 'Jobs running', dot: 'orange', count: String(run.length), sub: run.length ? sar(run.reduce((s, j) => s + num(j.contractValue), 0)) : 'No open jobs', flag: late ? late + ' past finish' : '', tone: RED });
    }
    if (can('invoice') && invoicesOn() && S.activity !== 'contracting') {
      const od = G('invs').filter(i => pass('inv', i) && i.dueDate && String(i.dueDate).slice(0, 10) < t).map(i => ({ i, bal: typeof invoiceBalanceOf === 'function' ? num(invoiceBalanceOf(i)) : 0 })).filter(x => x.bal > 0.005);
      const over30 = od.filter(x => diffDays(String(x.i.dueDate).slice(0, 10), t) > 30).length;
      tiles.push({ key: 'overdue', label: 'Overdue receivables', dot: 'red', count: od.length ? sar(od.reduce((s, x) => s + x.bal, 0)) : '0', sub: od.length ? plural(od.length, 'invoice') : 'Nothing overdue', flag: over30 ? over30 + ' over 30 days' : '', tone: RED });
    }
    if (canPI()) {
      const L = window.BizCorePI, loaded = piLoaded();
      if (!loaded) tiles.push({ key: 'bills', label: 'Supplier bills due', dot: 'gray', count: '—', sub: 'Purchasing not loaded', flag: '', tone: AMB, load: true });
      else {
        const due = (L.invoices || []).filter(p => live(p) && p.status !== 'Voided' && num(p.balance) > 0.005 && p.dueDate && String(p.dueDate).slice(0, 10) <= addDays(t, 7));
        const over = due.filter(p => String(p.dueDate).slice(0, 10) < t).length;
        tiles.push({ key: 'bills', label: 'Supplier bills due', dot: 'gray', count: String(due.length), sub: due.length ? sar(due.reduce((s, p) => s + num(p.balance), 0)) + ' · 7 days' : 'Nothing due in 7 days', flag: over ? over + ' overdue' : '', tone: RED });
      }
    }
    return tiles;
  }
  let piRequested = false;
  function piLoaded() { const L = window.BizCorePI; if (!L) return false; try { return piRequested || (L.invoices || []).length > 0; } catch (e) { return false; } }
  function loadPurchasing() {
    if (!window.BizCorePI) return;
    piRequested = true;
    try { window.BizCorePI.start(); if (!loadPurchasing._hooked) { loadPurchasing._hooked = true; window.BizCorePI.onChange(soon); } } catch (e) {}
    soon();
  }

  /* ───────────────────────── cash & bank (accounts + running balances only) ───────────────────────── */
  let cashHooked = false;
  function cashFigures() {
    if (!canCash()) return null;
    try {
      if (window.BizCoreCash.startBalances) window.BizCoreCash.startBalances(); else window.BizCoreCash.start();
      if (!cashHooked) { cashHooked = true; window.BizCoreCash.onChange(soon); window.BizCoreAcc.onChange(soon); }
      const accs = (window.BizCoreAcc.accounts || []).filter(a => a && a.active !== false && !a._deletedAt);
      const bal = window.BizCoreCash.balances;
      const rows = accs.map(a => { const r = bal && bal.get ? bal.get(a.id) : null; return { a, known: !!r, amt: r2(num(a.openingBalance) + (r ? num(r.balance) : 0)) }; });
      return { rows, total: r2(rows.reduce((s, x) => s + x.amt, 0)), loaded: !!(bal && bal.size !== undefined) };
    } catch (e) { return null; }
  }

  /* ───────────────────────── pipeline (selected period) ───────────────────────── */
  function pipeline(from, to) {
    const rs = G('rfqs').filter(r => pass('rfq', r) && inRange(r.date, from, to));
    const qs = G('quotes'), sos = G('sos'), jobs = jobsList();
    let quoted = 0, quotedV = 0, won = 0, wonV = 0, deliv = 0, invd = 0, paid = 0, gap = 0, gapN = 0;
    rs.forEach(r => {
      const mine = qs.filter(q => (q.rfqId === r.id || q.rfqId === r.rfqNo) && (q.status || 'Draft') !== 'Draft' && q.status !== 'Cancelled');
      if (!mine.length) return;
      quoted++;
      const latest = mine.slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))[0];
      quotedV += typeof calcQuote === 'function' ? num(calcQuote(latest).bvat) : 0;
      const first = mine.map(q => String(q.date || '').slice(0, 10)).filter(Boolean).sort()[0];
      if (first && r.date) { gap += Math.max(0, diffDays(String(r.date).slice(0, 10), first)); gapN++; }
      const ids = new Set(mine.map(q => q.id));
      const os = sos.filter(so => live(so) && (typeof soQuoteIds === 'function' ? soQuoteIds(so) : [so.quotationId]).some(id => ids.has(id)));
      const js = jobs.filter(j => ids.has(j.quotationId) && j.status !== 'Cancelled');
      if (!os.length && !js.length) return;
      won++; wonV += os.reduce((s, so) => s + soNet(so), 0) + js.reduce((s, j) => s + num(j.contractValue), 0);
      const allDel = os.length ? os.every(so => { const st = soOrderStatus(so); return st === 'Delivered' || st === 'Invoiced'; }) : js.every(j => j.status === 'Completed' || j.status === 'Closed');
      if (allDel) deliv++;
      const allInv = os.length > 0 && os.every(so => { try { return soFullyInvoiced(so); } catch (e) { return false; } });
      if (allInv) { invd++; if (os.every(so => { try { return typeof getSOStatus === 'function' && getSOStatus(so) === 'Paid'; } catch (e) { return false; } })) paid++; }
    });
    const decided = qs.filter(q => pass('quote', q) && (q.status === 'Won' || q.status === 'Lost') && inRange(String(q.date || ''), from, to));
    const winRate = decided.length ? Math.round(decided.filter(q => q.status === 'Won').length / decided.length * 100) : null;
    return { rfqs: rs.length, quoted, quotedV, won, wonV, deliv, invd, paid, winRate, avgGap: gapN ? gap / gapN : null };
  }

  /* ───────────────────────── calendar (next 14 days, live) ───────────────────────── */
  function calendar() {
    const t = today(), end = addDays(t, 13), ev = [];
    const add = (date, type, text, open) => { const d = String(date || '').slice(0, 10); if (d >= t && d <= end) ev.push({ d, type, text, open }); };
    if (can('salesOrder') && S.activity !== 'contracting') G('sos').forEach(so => {
      if (!pass('so', so) || !so.expectedDelivery) return;
      const st = typeof soOrderStatus === 'function' ? soOrderStatus(so) : '';
      if (st === 'Delivered' || st === 'Invoiced') return;
      add(so.expectedDelivery, 'dlv', (so.soNo || 'Order') + ' · ' + (so.customer || ''), "BCDash.go('so','" + esc(so.id) + "')");
    });
    if (can('invoice') && invoicesOn() && S.activity !== 'contracting') G('invs').forEach(i => {
      if (!pass('inv', i) || !i.dueDate) return;
      const bal = typeof invoiceBalanceOf === 'function' ? num(invoiceBalanceOf(i)) : 0; if (bal <= 0.005) return;
      add(i.dueDate, 'pay', (i.invNo || 'Invoice') + ' · ' + short(bal), "BCDash.go('inv','" + esc(i.id) + "')");
    });
    if (canPI() && piLoaded()) (window.BizCorePI.invoices || []).forEach(p => {
      if (!live(p) || p.status === 'Voided' || num(p.balance) <= 0.005) return;
      add(p.dueDate, 'bill', (p.piNo || 'Bill') + ' · ' + short(p.balance), "BCDash.go('pi','" + esc(p.id) + "')");
    });
    if (can('quotation')) G('quotes').forEach(q => { if (q.status === 'Sent' && pass('quote', q)) add(quoteExpiry(q), 'qx', (q.qno || 'Quotation') + ' expires', "BCDash.go('q','" + esc(q.id) + "')"); });
    if (canJobs() && S.activity !== 'trading') jobsList().forEach(j => { if ((j.status === 'Open' || j.status === 'In Progress' || !j.status) && pass('job', j)) add(j.finishDate, 'job', (j.jobNo || 'Job') + ' planned finish', "BCDash.go('job','" + esc(j.id) + "')"); });
    const days = [];
    for (let i = 0; i < 14; i++) { const d = addDays(t, i); days.push({ d, i, ev: ev.filter(e => e.d === d) }); }
    return days;
  }

  /* ───────────────────────── receivables (live) ───────────────────────── */
  function receivables() {
    if (!can('invoice') || !invoicesOn() || S.activity === 'contracting') return null;
    const t = today();
    const open = G('invs').filter(i => pass('inv', i)).map(i => ({ i, bal: typeof invoiceBalanceOf === 'function' ? num(invoiceBalanceOf(i)) : 0, late: i.dueDate ? diffDays(String(i.dueDate).slice(0, 10), t) : 0 })).filter(x => x.bal > 0.005);
    const B = [['Not due', x => x.late <= 0, 'b1'], ['1–30 days', x => x.late >= 1 && x.late <= 30, 'b2'], ['31–60 days', x => x.late > 30 && x.late <= 60, 'b3'], ['61–90 days', x => x.late > 60 && x.late <= 90, 'b4'], ['90+ days', x => x.late > 90, 'b5']];
    const total = r2(open.reduce((s, x) => s + x.bal, 0));
    const buckets = B.map(([label, f, cls]) => { const amt = r2(open.filter(f).reduce((s, x) => s + x.bal, 0)); return { label, amt, cls, pct: total > 0 ? amt / total * 100 : 0 }; });
    const worst = open.filter(x => x.late > 0).sort((a, b) => b.late - a.late).slice(0, 3);
    return { total, buckets, worst, count: open.length };
  }

  /* ───────────────────────── rendering ───────────────────────── */
  const ICON = {
    filter: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4h18l-7 8v6l-4 2v-8z"/><path d="M17 15l4 4"/><path d="M21 15l-4 4"/></svg>',
    edit: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  };
  function greet() { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; }
  function firstName() { const u = window.currentUser || {}; const n = String(u.name || u.displayName || '').trim(); return n ? n.split(/\s+/)[0] : ''; }

  function shell(root) {
    root.innerHTML = `
<section class="bd-hero" aria-label="Dashboard header">
  <div class="bd-hero-in">
    <div class="bd-hello"><span class="bd-date" id="bd-date"></span><h2 id="bd-greet"></h2></div>
    <div class="bd-filters" role="group" aria-label="Dashboard filters">
      <label class="bd-f"><span>Activity</span><select id="bd-f-activity" aria-label="Activity"><option value="all">All</option><option value="trading">Trading</option><option value="contracting">Contracting</option></select></label>
      <i class="bd-sep" aria-hidden="true"></i>
      <button type="button" class="bd-step" id="bd-prev" aria-label="Previous month">‹</button>
      <div class="bd-f bd-f-period"><span>Period</span><div data-bc-date="dash" data-bc-date-title="Period"></div></div>
      <button type="button" class="bd-step" id="bd-next" aria-label="Next month">›</button>
      <i class="bd-sep" aria-hidden="true"></i>
      <label class="bd-f"><span>Customer</span><select id="bd-f-customer" aria-label="Customer"><option value="">All</option></select></label>
      <i class="bd-sep bd-owner-x" aria-hidden="true"></i>
      <label class="bd-f bd-owner-x"><span>Salesperson</span><select id="bd-f-owner" aria-label="Salesperson"><option value="">All</option></select></label>
      <i class="bd-sep" aria-hidden="true"></i>
      <label class="bd-f"><span>vs</span><select id="bd-f-compare" aria-label="Compare with"><option value="prev">Previous period</option><option value="year">Same period last year</option><option value="none">No comparison</option></select></label>
      <button type="button" class="bd-clear" id="bd-clear" title="Clear filters" aria-label="Clear filters">${ICON.filter}</button>
    </div>
  </div>
</section>
<div class="bd-body">
  <section class="bd-card bd-attn" id="bd-attn-card" aria-labelledby="bd-attn-h">
    <div class="bd-card-h"><h3 id="bd-attn-h">Needs attention</h3><span class="bd-note">Live · not affected by the period · click a tile to open the list</span></div>
    <div class="bd-tiles" id="bd-tiles"></div>
  </section>
  <section class="bd-row bd-kpis" id="bd-kpis" aria-label="Main figures"></section>
  <section class="bd-row bd-two" id="bd-sales-row">
    <div class="bd-card bd-chart" id="bd-chart-card"></div>
    <div class="bd-card bd-pipe" id="bd-pipe-card"></div>
  </section>
  <section class="bd-card bd-cal" id="bd-cal-card" aria-labelledby="bd-cal-h"></section>
  <section class="bd-row bd-three" id="bd-bottom-row">
    <div class="bd-card" id="bd-recv-card"></div>
    <div class="bd-card" id="bd-cust-card"></div>
    <div class="bd-card" id="bd-jobs-card"></div>
  </section>
</div>`;
    const sel = id => $(id);
    sel('bd-f-activity').value = S.activity; sel('bd-f-compare').value = S.compare;
    sel('bd-f-activity').addEventListener('change', e => { S.activity = e.target.value; savePrefs(); render(); });
    sel('bd-f-compare').addEventListener('change', e => { S.compare = e.target.value; savePrefs(); render(); });
    sel('bd-f-customer').addEventListener('change', e => { S.customer = e.target.value; render(); });
    sel('bd-f-owner').addEventListener('change', e => { S.owner = e.target.value; render(); });
    sel('bd-prev').addEventListener('click', () => stepMonth(-1));
    sel('bd-next').addEventListener('click', () => stepMonth(1));
    sel('bd-clear').addEventListener('click', clearFilters);
    const D = window.BCDateFilter;
    if (D) { D.register('dash', st => { S.period = st.preset === 'all' ? { preset: 'all', from: '', to: '' } : { preset: st.preset, from: st.from || '', to: st.to || '' }; olderThen(render); }); D.set('dash', S.period); relabelPeriod(); }
  }
  function relabelPeriod() {
    const host = document.querySelector('#page-dashboard [data-bc-date="dash"] .bc-date-label'); if (!host) return;
    const p = periodNow();
    if (!p.all && isWholeMonths(p.from, p.to) && monthKey(p.from) === monthKey(p.to)) { const k = monthKey(p.from); host.textContent = MON[+k.slice(5) - 1] + ' ' + k.slice(0, 4); }
  }
  function stepMonth(n) {
    const p = periodNow(), base = p.all ? monthKey(today()) : monthKey(p.from || today());
    const k = addMonths(base, n);
    S.period = { preset: k === monthKey(today()) ? 'month' : 'custom', ...monthRange(k) };
    if (window.BCDateFilter) window.BCDateFilter.set('dash', S.period);
    olderThen(render);
  }
  function clearFilters() {
    S.activity = 'all'; S.customer = ''; S.owner = ''; S.compare = 'prev'; savePrefs();
    S.period = { preset: 'month', ...monthRange(monthKey(today())) };
    if (window.BCDateFilter) window.BCDateFilter.set('dash', S.period);
    ['bd-f-activity', 'bd-f-customer', 'bd-f-owner', 'bd-f-compare'].forEach(id => { const e = $(id); if (e) e.value = id === 'bd-f-activity' ? 'all' : id === 'bd-f-compare' ? 'prev' : ''; });
    render();
  }
  /** a period before the loaded months reads the older sales records first (as the registers do) */
  function olderThen(fn) {
    const p = periodNow(), from = p.all ? '' : addMonths(monthKey(p.from), -11) + '-01';
    if (typeof bcEnsureOlder === 'function') { try { bcEnsureOlder(['quotations', 'rfqs', 'salesOrders'], from, fn); return; } catch (e) {} }
    fn();
  }

  function fillSelects() {
    const cs = new Set(), os = new Set();
    G('sos').forEach(x => { if (live(x)) { if (x.customer) cs.add(x.customer); if (x.ownerUid) os.add(x.ownerUid); } });
    G('quotes').forEach(x => { if (live(x)) { if (x.company) cs.add(x.company); if (x.ownerUid) os.add(x.ownerUid); } });
    G('rfqs').forEach(x => { if (live(x)) { if (x.company) cs.add(x.company); if (x.ownerUid) os.add(x.ownerUid); } });
    jobsList().forEach(j => { if (j.company) cs.add(j.company); });
    const cSel = $('bd-f-customer'), oSel = $('bd-f-owner');
    if (cSel) {
      const names = [...cs].sort((a, b) => a.localeCompare(b));
      const html = '<option value="">All</option>' + names.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
      if (cSel._html !== html) { cSel.innerHTML = html; cSel._html = html; }
      cSel.value = names.includes(S.customer) ? S.customer : ''; if (!cSel.value) S.customer = '';
    }
    if (oSel) {
      const owners = [...os].map(uid => ({ uid, name: userName(uid) || 'User ' + uid.slice(0, 5) })).sort((a, b) => a.name.localeCompare(b.name));
      const html = '<option value="">All</option>' + owners.map(o => `<option value="${esc(o.uid)}">${esc(o.name)}</option>`).join('');
      if (oSel._html !== html) { oSel.innerHTML = html; oSel._html = html; }
      oSel.value = owners.some(o => o.uid === S.owner) ? S.owner : ''; if (!oSel.value) S.owner = '';
      document.querySelectorAll('#page-dashboard .bd-owner-x').forEach(e => { e.hidden = owners.length < 2 && !S.owner; });
    }
  }

  function paintTiles() {
    const tiles = attention(), box = $('bd-tiles'); if (!box) return;
    $('bd-attn-card').hidden = !tiles.length;
    box.innerHTML = tiles.map(x => {
      const body = `<span class="bd-tile-top"><span class="bd-tile-l">${esc(x.label)}</span><i class="bd-dot bd-dot-${x.dot}" aria-hidden="true"></i></span>
<b class="bd-tile-n">${esc(x.count)}</b>
<span class="bd-tile-b"><span class="bd-tile-s">${esc(x.sub)}</span>${x.flag ? `<span class="bd-tile-f bd-${x.tone}">${esc(x.flag)}</span>` : ''}</span>`;
      if (x.load) return `<div class="bd-tile bd-tile-load">${body}<button type="button" class="bd-link" onclick="BCDash.loadPurchasing()">Show</button></div>`;
      return `<button type="button" class="bd-tile" data-tile="${x.key}" onclick="BCDash.open('${x.key}')">${body}</button>`;
    }).join('');
  }

  function spark(vals, w, h) {
    const max = Math.max(...vals), min = Math.min(...vals);
    if (!vals.length || max === min) return vals.map((v, i) => Math.round(i * w / Math.max(1, vals.length - 1)) + ',' + Math.round(h / 2)).join(' ');
    return vals.map((v, i) => Math.round(i * w / (vals.length - 1)) + ',' + Math.round(h - 2 - (v - min) / (max - min) * (h - 4))).join(' ');
  }
  function deltaPill(cur, prev, label, invert) {
    if (prev == null || !(prev > 0.005)) return '';
    const d = (cur - prev) / prev * 100; if (!Number.isFinite(d)) return '';
    const up = d >= 0, good = invert ? !up : up;
    return `<span class="bd-pill ${Math.abs(d) < 0.5 ? 'bd-pill-flat' : good ? 'bd-pill-up' : 'bd-pill-down'}" title="${esc('vs ' + label)}">${up ? '▲' : '▼'} ${Math.abs(d) < 10 ? Math.abs(d).toFixed(1) : Math.round(Math.abs(d))}%</span>`;
  }
  function last12(endKey) { const out = []; for (let i = 11; i >= 0; i--) out.push(addMonths(endKey, -i)); return out; }

  function paintKpis(list, P, C) {
    const box = $('bd-kpis'); if (!box) return;
    const cards = [], t = today();
    const cur = sumSales(list, P.from, P.to), prev = C ? sumSales(list, C.from, C.to) : null;
    const endKey = P.all ? monthKey(t) : monthKey(P.to > t ? t : P.to);
    const months = last12(endKey);
    const showSales = can('salesOrder') || canJobs();
    if (showSales) {
      const tgt = P.all ? 0 : targetFor(P.from, P.to);
      const pct = tgt > 0 ? cur.value / tgt * 100 : null;
      const running = !P.all && P.from <= t && P.to >= t;
      let status = '', tone = '';
      if (pct != null) {
        if (running) { const el = (diffDays(P.from, t) + 1) / (diffDays(P.from, P.to) + 1); const ok = cur.value >= tgt * el * 0.95; status = pct >= 100 ? 'Target reached' : ok ? 'On track' : 'Behind'; tone = pct >= 100 || ok ? 'bd-good' : 'bd-warn'; }
        else { status = pct >= 100 ? 'Target reached' : 'Below target'; tone = pct >= 100 ? 'bd-good' : 'bd-warn'; }
      }
      const C2 = 2 * Math.PI * 52, dash = pct == null ? 0 : Math.min(100, pct) / 100 * C2;
      const left = running ? diffDays(t, P.to) : null;
      cards.push(`<div class="bd-card bd-ring-card">
<svg class="bd-ring" viewBox="0 0 120 120" role="img" aria-label="${pct == null ? 'No sales target set' : Math.round(pct) + '% of the sales target'}">
<circle cx="60" cy="60" r="52" class="bd-ring-track"/>${pct == null ? '' : `<circle cx="60" cy="60" r="52" class="bd-ring-fill${pct >= 100 ? ' bd-ring-done' : ''}" stroke-dasharray="${dash.toFixed(1)} ${C2.toFixed(1)}" transform="rotate(-90 60 60)"/>`}
<text x="60" y="${pct == null ? 64 : 60}" text-anchor="middle" class="bd-ring-n">${pct == null ? '—' : Math.round(pct) + '%'}</text>${pct == null ? '' : '<text x="60" y="78" text-anchor="middle" class="bd-ring-s">of target</text>'}
</svg>
<div class="bd-ring-txt"><span class="bd-k-l">Sales${S.activity !== 'all' ? ' · ' + (S.activity === 'trading' ? 'Trading' : 'Contracting') : ''}</span>
<b class="bd-k-v">${sar(cur.value)}</b>
<span class="bd-k-s">${tgt > 0 ? 'of ' + sar(tgt) + (left != null ? ' · ' + plural(left, 'day') + ' left' : '') : P.all ? 'All dates · ' + plural(cur.n, 'order') : 'No target set for this period'}</span>
${status ? `<span class="bd-k-st ${tone}">${status}</span>` : ''}
${canSetTarget() ? `<button type="button" class="bd-link bd-target-btn" onclick="BCDash.editTarget()">${ICON.edit}${tgt > 0 ? 'Change target' : 'Set target'}</button>` : ''}
<span class="bd-k-s bd-k-hint">Sales Orders${canJobs() ? ' + awarded jobs' : ''}, before VAT</span></div></div>`);
    }
    if (showSales && seeCost()) {
      const series = months.map(k => sumSales(list, monthStart(k), monthEnd(k)).profit);
      cards.push(`<div class="bd-card bd-trend"><div class="bd-trend-h"><span class="bd-k-l">Gross profit</span>${C ? deltaPill(cur.profit, prev.profit, C.label) : ''}</div>
<b class="bd-k-v">${sar(cur.profit)}</b>
<svg class="bd-spark" viewBox="0 0 220 44" preserveAspectRatio="none" aria-hidden="true"><polyline points="${spark(series, 220, 44)}" class="bd-spark-blue"/></svg>
<span class="bd-k-s">${Number.isFinite(cur.margin) ? cur.margin.toFixed(1) + '% margin · ' : ''}12-month trend · estimate until bought</span></div>`);
    } else if (showSales) {
      const series = months.map(k => sumSales(list, monthStart(k), monthEnd(k)).n);
      cards.push(`<div class="bd-card bd-trend"><div class="bd-trend-h"><span class="bd-k-l">Orders won</span>${C ? deltaPill(cur.n, prev.n, C.label) : ''}</div>
<b class="bd-k-v">${cur.n}</b><svg class="bd-spark" viewBox="0 0 220 44" preserveAspectRatio="none" aria-hidden="true"><polyline points="${spark(series, 220, 44)}" class="bd-spark-blue"/></svg>
<span class="bd-k-s">Sales Orders${canJobs() ? ' and jobs' : ''} · 12-month trend</span></div>`);
    }
    if (can('receipt') && S.activity !== 'contracting') {
      const c = receiptsIn(P.from, P.to), p = C ? receiptsIn(C.from, C.to) : null;
      const series = months.map(k => receiptsIn(monthStart(k), monthEnd(k)) || 0);
      cards.push(`<div class="bd-card bd-trend"><div class="bd-trend-h"><span class="bd-k-l">Collected</span>${C ? deltaPill(c, p, C.label) : ''}</div>
<b class="bd-k-v">${sar(c)}</b>
<svg class="bd-spark" viewBox="0 0 220 44" preserveAspectRatio="none" aria-hidden="true"><polyline points="${spark(series, 220, 44)}" class="bd-spark-teal"/></svg>
<span class="bd-k-s">Payment receipts · 12-month trend</span></div>`);
    }
    const cash = cashFigures();
    if (cash) {
      const top = cash.rows.slice().sort((a, b) => b.amt - a.amt).slice(0, 3);
      cards.push(`<button type="button" class="bd-card bd-trend bd-cash" onclick="BCDash.go('page','cashbank')"><div class="bd-trend-h"><span class="bd-k-l">Cash &amp; Bank</span><span class="bd-pill bd-pill-flat">${plural(cash.rows.length, 'account')}</span></div>
<b class="bd-k-v">${sar(cash.total)}</b>
<span class="bd-cash-list">${top.map(x => `<span><span class="bd-cash-n">${esc(x.a.name || x.a.id)}</span><span>${x.known ? short(x.amt) : '—'}</span></span>`).join('') || '<span class="bd-k-s">No payment accounts yet</span>'}</span>
<span class="bd-k-s">Balance today · all accounts</span></button>`);
    }
    box.innerHTML = cards.join('');
    box.hidden = !cards.length;
    box.style.setProperty('--bd-n', String(Math.max(1, cards.length)));
    box.classList.toggle('bd-has-ring', showSales && cards.length > 1);
    box.style.setProperty('--bd-cols', 'minmax(330px,1.35fr)' + ' minmax(0,1fr)'.repeat(Math.max(0, cards.length - 1)));
  }

  function paintChart(list, P) {
    const card = $('bd-chart-card'); if (!card) return;
    if (!(can('salesOrder') || canJobs())) { card.hidden = true; return; }
    card.hidden = false;
    const t = today(), endKey = P.all ? monthKey(t) : monthKey(P.to > t ? t : P.to), months = last12(endKey), cost = seeCost();
    const data = months.map(k => ({ k, ...sumSales(list, monthStart(k), monthEnd(k)) }));
    const max = Math.max(1, ...data.map(d => d.value));
    const inP = k => P.all || (monthStart(k) <= P.to && monthEnd(k) >= P.from);
    const total = data.reduce((s, d) => s + d.value, 0), prof = data.reduce((s, d) => s + d.profit, 0), basis = data.reduce((s, d) => s + d.basis, 0);
    const best = data.slice().sort((a, b) => b.value - a.value)[0];
    card.innerHTML = `<div class="bd-card-h"><div><h3>Sales${cost ? ' &amp; gross profit' : ''}</h3><span class="bd-note">12 months to ${MON[+endKey.slice(5) - 1]} ${endKey.slice(0, 4)} · before VAT, SAR</span></div>
${cost ? '<span class="bd-legend"><span><i class="bd-sw bd-sw-cost"></i>Cost</span><span><i class="bd-sw bd-sw-gp"></i>Gross profit</span></span>' : ''}</div>
<div class="bd-bars" role="img" aria-label="Monthly sales for 12 months">${data.map(d => {
      const h = Math.round(d.value / max * 170), gp = cost && d.value > 0 ? Math.max(0, Math.min(h, Math.round(Math.max(0, d.profit) / d.value * h))) : 0;
      const mtd = d.k === monthKey(t);
      return `<div class="bd-bar${inP(d.k) ? ' bd-bar-in' : ''}${mtd ? ' bd-bar-mtd' : ''}" title="${esc(MON[+d.k.slice(5) - 1] + ' ' + d.k.slice(0, 4) + ': ' + money(d.value) + (cost ? ' · gross profit ' + money(d.profit) : '') + (mtd ? ' (month to date)' : ''))}">
<span class="bd-bar-v">${d.value > 0 ? short(d.value) : ''}</span><span class="bd-bar-col" style="height:${Math.max(d.value > 0 ? 3 : 0, h)}px">${cost ? `<span class="bd-bar-gp" style="height:${gp}px"></span>` : ''}</span><span class="bd-bar-m">${monLabel(d.k)}</span></div>`;
    }).join('')}</div>
<div class="bd-chart-f"><span>12-month sales <b>${sar(total)}</b></span>${cost && basis > 0 ? `<span>Avg margin <b>${(prof / basis * 100).toFixed(1)}%</b></span>` : ''}${best && best.value > 0 ? `<span>Best month <b>${monLabel(best.k)} · ${sar(best.value)}</b></span>` : ''}${months.includes(monthKey(t)) ? `<span>${monLabel(monthKey(t))} is month-to-date</span>` : ''}</div>`;
  }

  function paintPipe(P) {
    const card = $('bd-pipe-card'); if (!card) return;
    if (!can('rfq') && !can('quotation')) { card.hidden = true; return; }
    card.hidden = false;
    const p = pipeline(P.from, P.to), base = Math.max(1, p.rfqs);
    const rows = [['RFQs received', p.rfqs, '', 'purple'], ['Quoted', p.quoted, p.quoted ? sar(p.quotedV) : '', 'blue'], ['Won (order / job)', p.won, p.won ? sar(p.wonV) : '', 'blue'], ['Delivered', p.deliv, '', 'teal'], ['Invoiced', p.invd, '', 'teal'], ['Paid', p.paid, '', 'teal']];
    card.innerHTML = `<div class="bd-card-h"><div><h3>Sales pipeline</h3><span class="bd-note">RFQs received in ${esc(periodLabel())} and how far they got</span></div></div>
<div class="bd-funnel">${rows.map(([l, n, v, c]) => `<div class="bd-fun"><div class="bd-fun-t"><span>${l}</span><span><b>${n}</b>${v ? ' · ' + v : ''}</span></div><div class="bd-track"><i class="bd-fill bd-fill-${c}" style="width:${p.rfqs ? Math.round(n / base * 100) : 0}%"></i></div></div>`).join('')}</div>
<div class="bd-minis"><div><span>Quote win rate</span><b>${p.winRate == null ? '—' : p.winRate + '%'}</b></div><div><span>Avg RFQ → quote</span><b>${p.avgGap == null ? '—' : (p.avgGap < 1 ? '< 1 day' : p.avgGap.toFixed(1) + ' days')}</b></div></div>`;
  }

  function paintCalendar() {
    const card = $('bd-cal-card'); if (!card) return;
    const days = calendar(), any = days.some(d => d.ev.length);
    const T = { dlv: 'Delivery due', pay: 'Customer payment due', bill: 'Supplier bill due', qx: 'Quote expires', job: 'Job planned finish' };
    const used = new Set(); days.forEach(d => d.ev.forEach(e => used.add(e.type)));
    const legend = Object.keys(T).filter(k => used.has(k)).map(k => `<span><i class="bd-sw bd-ev-${k}"></i>${T[k]}</span>`).join('');
    const ev = e => `<button type="button" class="bd-ev bd-ev-${e.type}" onclick="${e.open}" title="${esc(T[e.type] + ': ' + e.text)}">${esc(e.text)}</button>`;
    card.innerHTML = `<div class="bd-card-h"><div><h3 id="bd-cal-h">Next 2 weeks</h3><span class="bd-note">${any ? 'Deliveries, payments and expiry dates · click one to open it' : 'Nothing falls due in the next 14 days'}</span></div><span class="bd-legend">${legend}</span></div>
<div class="bd-days">${days.map(d => { const dt = dateOf(d.d); return `<div class="bd-day${d.i === 0 ? ' bd-today' : ''}${dt.getDay() === 5 ? ' bd-fri' : ''}"><div class="bd-day-h"><span>${d.i === 0 ? 'Today' : DOW[dt.getDay()]}</span><b>${dt.getDate()}</b></div>${d.ev.map(ev).join('')}</div>`; }).join('')}</div>
<div class="bd-agenda">${any ? days.filter(d => d.ev.length).map(d => { const dt = dateOf(d.d); return d.ev.map(e => `<div class="bd-ag"><span class="bd-ag-d"><small>${d.i === 0 ? 'Today' : DOW[dt.getDay()]}</small><b>${dt.getDate()}</b></span>${ev(e)}</div>`).join(''); }).join('') : '<p class="bd-empty">Nothing falls due in the next 14 days.</p>'}</div>`;
    card.hidden = false;
  }

  function paintRecv() {
    const card = $('bd-recv-card'); if (!card) return;
    const R = receivables(); if (!R) { card.hidden = true; return; }
    card.hidden = false;
    card.innerHTML = `<div class="bd-card-h"><h3>Receivables</h3><button type="button" class="bd-link" onclick="BCDash.go('page','customerinvoices')">Invoices →</button></div>
<div><span class="bd-k-l">Outstanding · ${plural(R.count, 'invoice')}</span><b class="bd-k-v">SAR ${money(R.total)}</b></div>
<div class="bd-stack" role="img" aria-label="Receivables by age">${R.buckets.filter(b => b.pct > 0).map(b => `<i class="bd-${b.cls}" style="width:${b.pct.toFixed(2)}%"></i>`).join('') || '<i class="bd-b0" style="width:100%"></i>'}</div>
<div class="bd-rows">${R.buckets.map(b => `<div class="bd-r"><span><i class="bd-sw bd-${b.cls}"></i>${b.label}</span><span${b.cls === 'b4' || b.cls === 'b5' ? (b.amt > 0 ? ' class="bd-red"' : '') : ''}>SAR ${money(b.amt)}</span></div>`).join('')}</div>
${R.worst.length ? `<div class="bd-sub-h">Most overdue</div><div class="bd-rows">${R.worst.map(x => `<button type="button" class="bd-r bd-r-btn" onclick="BCDash.go('inv','${esc(x.i.id)}')"><span>${esc(x.i.invNo || '')} · ${esc(x.i.customer || '')}</span><span class="${x.late > 60 ? 'bd-red' : 'bd-amber'}">${plural(x.late, 'day')}</span></button>`).join('')}</div>` : ''}`;
  }

  function paintCustomers(list, P) {
    const card = $('bd-cust-card'); if (!card) return;
    if (!(can('salesOrder') || canJobs())) { card.hidden = true; return; }
    card.hidden = false;
    const by = new Map(), cost = seeCost();
    list.forEach(r => { if (!inRange(r.date, P.from, P.to) || !r.cust) return; const e = by.get(r.cust) || { name: r.cust, value: 0, profit: 0, basis: 0 }; e.value += r.value; if (cost) { const p = profitOf(r); if (p) { e.profit += p.profit; e.basis += p.basis; } } by.set(r.cust, e); });
    const top = [...by.values()].sort((a, b) => b.value - a.value).slice(0, 5), max = top.length ? top[0].value : 1;
    card.innerHTML = `<div class="bd-card-h"><h3>Top customers</h3><span class="bd-note">${esc(periodLabel())} · sales${cost ? ' &amp; margin' : ''}</span></div>
${top.length ? `<div class="bd-rows bd-custs">${top.map(c => `<button type="button" class="bd-cust" onclick="BCDash.customer(this.dataset.c)" data-c="${esc(c.name)}" title="Show only ${esc(c.name)}"><span class="bd-cust-t"><span>${esc(c.name)}</span><span><b>${sar(c.value)}</b>${cost && c.basis > 0 ? ` <small>· ${(c.profit / c.basis * 100).toFixed(0)}%</small>` : ''}</span></span><span class="bd-track"><i class="bd-fill bd-fill-blue" style="width:${max > 0 ? Math.max(2, Math.round(c.value / max * 100)) : 0}%"></i></span></button>`).join('')}</div>` : '<p class="bd-empty">No sales in this period.</p>'}`;
  }

  function paintJobs() {
    const card = $('bd-jobs-card'); if (!card) return;
    if (!canJobs() || S.activity === 'trading') { card.hidden = true; return; }
    const t = today();
    const open = jobsList().filter(j => pass('job', j) && (j.status === 'Open' || j.status === 'In Progress' || !j.status))
      .sort((a, b) => String(a.finishDate || '9999').localeCompare(String(b.finishDate || '9999'))).slice(0, 4);
    card.hidden = false;
    card.innerHTML = `<div class="bd-card-h"><h3>Contracting jobs</h3><button type="button" class="bd-link" onclick="BCDash.go('page','jobs')">Jobs →</button></div>
${open.length ? open.map(j => {
      const wd = j.workDonePct != null && j.workDonePct !== '' ? Math.max(0, Math.min(100, num(j.workDonePct))) : null;
      const late = j.finishDate && String(j.finishDate).slice(0, 10) < t && (wd == null || wd < 100);
      return `<button type="button" class="bd-job" onclick="BCDash.go('job','${esc(j.id)}')">
<span class="bd-job-t"><span><b>${esc(j.jobNo || 'Job')}</b> · ${esc(j.project || j.company || '')}</span><span class="bd-chip ${late ? 'bd-chip-red' : j.status === 'In Progress' ? 'bd-chip-amber' : 'bd-chip-blue'}">${late ? 'Past finish' : esc(j.status || 'Open')}</span></span>
<span class="bd-k-s">${esc(j.company || '')}${j.contractValue ? ' · ' + sar(j.contractValue) : ''}${j.finishDate ? ' · finish ' + esc(dmy(String(j.finishDate).slice(0, 10))) : ''}</span>
<span class="bd-job-p"><span class="bd-track"><i class="bd-fill ${late ? 'bd-fill-red' : 'bd-fill-teal'}" style="width:${wd == null ? 0 : wd}%"></i></span><small>${wd == null ? 'Work done not set' : wd + '% done'}</small></span></button>`;
    }).join('') : `<p class="bd-empty">${jobsList().length ? 'No open jobs.' : 'No jobs yet.'}</p>`}`;
  }

  /* ───────────────────────── render (debounced; only while the Dashboard is shown) ───────────────────────── */
  let built = false, timer = null, dirty = true;
  function active() { const p = $('page-dashboard'); return !!(p && p.classList.contains('active')); }
  function soon() { dirty = true; clearTimeout(timer); timer = setTimeout(() => { if (active()) render(); }, 150); }
  function render() {
    const root = $('bd-root'); if (!root) return;
    if (!active() && built) { dirty = true; return; }
    try {
      if (!built) { loadPrefs(); shell(root); built = true; }
      dirty = false;
      const now = new Date();
      $('bd-date').textContent = now.toLocaleDateString('en-GB', { weekday: 'long' }) + ', ' + dmy(today());
      const fn = firstName(); $('bd-greet').textContent = greet() + (fn ? ', ' + fn : '');
      fillSelects(); relabelPeriod();
      const P = periodNow(), C = compareRange(), list = salesRecords();
      paintTiles(); paintKpis(list, P, C); paintChart(list, P); paintPipe(P); paintCalendar(); paintRecv(); paintCustomers(list, P); paintJobs();
      const row = $('bd-sales-row'); if (row) row.hidden = $('bd-chart-card').hidden && $('bd-pipe-card').hidden;
      const bottom = $('bd-bottom-row'); if (bottom) { const shown = ['bd-recv-card', 'bd-cust-card', 'bd-jobs-card'].filter(id => !$(id).hidden).length; bottom.hidden = !shown; bottom.style.setProperty('--bd-n', String(Math.max(1, shown))); }
    } catch (e) { console.error('[BizCore] Dashboard:', e); }
  }

  /* ───────────────────────── actions ───────────────────────── */
  function nav(page) { if (typeof showPage === 'function') showPage(page, document.querySelector('[data-nav-page="' + page + '"]')); }
  function openTile(key) {
    if (key === 'rfq') { nav('rfq'); setTimeout(() => { const b = document.querySelector('#page-rfq [data-rfq-monitor-filter="New"]'); if (typeof applyRFQMonitorFilter === 'function' && b) applyRFQMonitorFilter('New', b); }, 80); return; }
    if (key === 'quote') { nav('quotations'); setTimeout(() => { const b = document.querySelector('#page-quotations [data-overview-key="Sent"]'); if (typeof setQuotationMonitorFilter === 'function' && b) setQuotationMonitorFilter('Sent', b); }, 80); return; }
    if (key === 'deliver') { nav('salesorders'); setTimeout(() => { if (typeof filterSOKPI === 'function') filterSOKPI('to-deliver'); }, 60); return; }
    if (key === 'invoice') { nav('salesorders'); setTimeout(() => { if (typeof filterSOKPI === 'function') filterSOKPI('pending-invoice'); }, 60); return; }
    if (key === 'overdue') { nav('customerinvoices'); setTimeout(() => { if (typeof filterInvoiceKPI === 'function') filterInvoiceKPI('pay-overdue'); }, 60); return; }
    if (key === 'bills') { nav('purchaseinvoices'); return; }
    if (key === 'jobs') { nav('jobs'); return; }
  }
  function go(kind, id) {
    try {
      if (kind === 'page') return nav(id);
      if (kind === 'so') { if (typeof openDashboardSalesOrder === 'function') return openDashboardSalesOrder(id); return typeof viewSO === 'function' && viewSO(id); }
      if (kind === 'inv') return typeof openInvoiceView === 'function' && openInvoiceView(id);
      if (kind === 'q') return typeof viewQuotation === 'function' && viewQuotation(id);
      if (kind === 'pi') { if (window.BizCorePI) window.BizCorePI.start(); return typeof openPurchaseInvoiceView === 'function' && openPurchaseInvoiceView(id); }
      if (kind === 'job') return window.BCJobs && window.BCJobs.view(id);
    } catch (e) { console.error('[BizCore] Dashboard open:', e); }
  }
  function pickCustomer(name) { S.customer = S.customer === name ? '' : name; const s = $('bd-f-customer'); if (s) s.value = S.customer; render(); }

  /* the monthly sales target — Administration rights (saved with the company settings, settings/main) */
  function editTarget() {
    if (!canSetTarget()) return;
    const P = periodNow(), key = monthKey(P.all ? today() : P.from), T = targets();
    const own = T.months[key] != null && T.months[key] !== '' ? num(T.months[key]) : '';
    let m = $('bd-target-modal');
    if (!m) {
      m = document.createElement('div'); m.className = 'modal-overlay'; m.id = 'bd-target-modal';
      m.innerHTML = `<div class="modal modal-normal bd-tgt" role="dialog" aria-modal="true" aria-labelledby="bd-tgt-h">
<div class="modal-header"><h2 id="bd-tgt-h">Sales target</h2><button type="button" class="close-btn" aria-label="Close" onclick="closeModal('bd-target-modal')">✕</button></div>
<div class="modal-body"><p class="bd-tgt-p">The Dashboard ring compares sales (Sales Orders and awarded jobs, before VAT) with this target.</p>
<div class="form-group"><label for="bd-tgt-monthly">Every month (SAR, before VAT)</label><input id="bd-tgt-monthly" inputmode="decimal" autocomplete="off" placeholder="0.00"></div>
<div class="form-group"><label for="bd-tgt-month" id="bd-tgt-month-l">Only this month</label><input id="bd-tgt-month" inputmode="decimal" autocomplete="off" placeholder="Same as every month"><small class="bd-tgt-p">Leave empty to use the monthly target.</small></div>
<div class="bd-tgt-err" id="bd-tgt-err" hidden></div></div>
<div class="modal-footer"><button type="button" class="btn btn-secondary" onclick="closeModal('bd-target-modal')">Cancel</button><button type="button" class="btn btn-primary" id="bd-tgt-save">Save</button></div></div>`;
      document.body.appendChild(m);
      $('bd-tgt-save').addEventListener('click', saveTarget);
    }
    m._key = key;
    $('bd-tgt-month-l').textContent = 'Only ' + MON[+key.slice(5) - 1] + ' ' + key.slice(0, 4);
    $('bd-tgt-monthly').value = T.monthly ? money(T.monthly) : '';
    $('bd-tgt-month').value = own === '' ? '' : money(own);
    $('bd-tgt-err').hidden = true;
    if (typeof openModalWithSize === 'function') openModalWithSize('bd-target-modal'); else m.classList.add('open');
    setTimeout(() => { try { $('bd-tgt-monthly').focus(); } catch (e) {} }, 50);
  }
  async function saveTarget() {
    const m = $('bd-target-modal'), err = $('bd-tgt-err');
    const parse = v => { const s = String(v || '').replace(/[,\s]/g, ''); if (s === '') return ''; const n = Number(s); return Number.isFinite(n) && n >= 0 && n < 1e12 ? r2(n) : NaN; };
    const monthly = parse($('bd-tgt-monthly').value), month = parse($('bd-tgt-month').value);
    if (Number.isNaN(monthly) || Number.isNaN(month)) { err.textContent = 'Enter an amount of 0 or more (numbers only).'; err.hidden = false; return; }
    const T = targets(), months = { ...T.months };
    if (month === '') delete months[m._key]; else months[m._key] = month;
    Object.keys(months).forEach(k => { if (k < addMonths(monthKey(today()), -36)) delete months[k]; });   // keep the last 3 years
    const btn = $('bd-tgt-save'); btn.disabled = true;
    try {
      settings.salesTargets = { monthly: monthly === '' ? 0 : monthly, months };
      if (typeof saveSettings === 'function') await saveSettings();
      if (typeof closeModal === 'function') closeModal('bd-target-modal');
      if (typeof showToast === 'function') showToast('Sales target saved.', 'success');
      render();
    } catch (e) {
      err.textContent = 'The target could not be saved (' + (e && (e.code || e.message) || 'error') + ').'; err.hidden = false;
    } finally { btn.disabled = false; }
  }

  window.BCDash = { render, soon, open: openTile, go, customer: pickCustomer, editTarget, loadPurchasing,
    _state: S, _calc: { salesRecords, sumSales, targetFor, compareRange, pipeline, receivables, attention, calendar } };
  if (active()) render();
})();
