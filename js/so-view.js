/* ═══════════════════════════════════════════════════════════════════
   BizCore V269.7 — Sales Order view (approved mockups SV_1 – SV_9, 22 Oct 2026)

   • Header: SO no. — customer, PO · SO date · quotation · salesperson; Edit (disabled with the reason when not
     allowed) and More (Customer PO, quotation, delete).
   • Four fixed-height cards: Delivery ring (blue, by value), Invoicing ring (orange, by value), Order Total,
     Outstanding (payment). The document counts ("3 DNs ▾", "2 Invoices ▾") open a floating list on a PC and a
     bottom sheet on a phone — collapsed by default, one at a time, closed by a click outside, Esc, a tab change
     or opening a document.
   • Tabs: Overview · Items · Purchasing · Finance · Profit 🔒 · Activity. Profit follows Administration →
     Purchase Settings → Profit visibility (administrators / everyone).
   • Footer: only the actions that are possible now. Phone: ⋯ More + the next step.

   Read-only: everything is worked out from records that are already loaded (the order, its delivery notes,
   invoices, credit notes, receipts, purchase invoices, stock allocations, the pricing version). Nothing is
   saved here. Older linked records are read only when the Purchasing or Profit tab needs them.
   Classic script, loaded after app.js (shares its global helpers).
═══════════════════════════════════════════════════════════════════ */
'use strict';

const sovEsc = v => (typeof escapeHtml === 'function' ? escapeHtml(v == null ? '' : String(v)) : String(v == null ? '' : v));
const sovN = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const sovR2 = n => Math.round((sovN(n) + Number.EPSILON) * 100) / 100;
const sovRQ = n => Math.round((sovN(n) + Number.EPSILON) * 1e6) / 1e6;
const SOV_EPS = 1e-6;
const sovMoney = n => formatNumber(sovN(n), 2);
const sovSAR = n => 'SAR ' + formatNumber(sovN(n), 2);
const sovQ = (n, uom) => (typeof formatQtyForUom === 'function' ? formatQtyForUom(sovN(n), uom) : formatQuantity(sovN(n)));
const sovQU = (n, uom) => sovQ(n, uom) + (uom ? ' ' + sovEsc(uom) : '');
const sovPct = n => (Number.isFinite(n) ? (Math.round(n * 10) / 10).toFixed(1) + '%' : '—');
const sovToday = () => { const t = new Date(), p = n => String(n).padStart(2, '0'); return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`; };
const sovDaysUntil = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); if (!m) return null; const t = new Date(); return Math.round((new Date(+m[1], +m[2] - 1, +m[3]) - new Date(t.getFullYear(), t.getMonth(), t.getDate())) / 86400000); };
const sovDayMonth = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); return m ? `${m[3]}-${m[2]}` : '—'; };
const sovPhone = () => window.innerWidth <= 760;
const sovPlural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;
/** A Firestore timestamp, a Date or an ISO string → ISO string ('' when unknown). */
function sovIso(x){
  if (!x) return '';
  if (typeof x === 'string') return x;
  try {
    if (typeof x.toDate === 'function') return x.toDate().toISOString();
    if (x instanceof Date) return x.toISOString();
    if (x.seconds != null) return new Date(Number(x.seconds) * 1000).toISOString();
  } catch (e) {}
  return '';
}
const SOV_TONES = { neutral: 1, blue: 1, amber: 1, green: 1, red: 1, purple: 1, teal: 1 };
const sovPill = (text, tone) => `<span class="sov-pill t-${SOV_TONES[tone] ? tone : 'neutral'}">${sovEsc(text)}</span>`;

/* ───────────────────────── permissions / settings ───────────────────────── */
function sovCanSeeProfit(){
  const lib = window.BizCorePI; if (!lib) return false;
  return !!lib.isAdministrator || (lib.settings && lib.settings.profitVisibility === 'everyone');
}
function sovPricingSettings(){
  try { return typeof activePricingSettings === 'function' ? activePricingSettings() : (typeof pricingSettings !== 'undefined' ? pricingSettings : {}); } catch (e) { return {}; }
}
function sovFlagPct(){ const s = window.BizCorePI && window.BizCorePI.settings; const v = Number(s && s.estimateFlagPct); return Number.isFinite(v) ? v : 5; }

/* ───────────────────────── documents of the order ───────────────────────── */
function sovQuotation(so){ return (typeof quotations !== 'undefined' ? quotations : []).find(x => x.id === so.quotationId || x.qno === so.quotationId) || null; }
function sovRfq(q){
  if (!q) return null;
  const rs = typeof rfqs !== 'undefined' ? rfqs : [];
  return rs.find(x => x.id === q.rfqId || x.rfqNo === q.rfqId) || rs.find(x => x.quotationId === q.id || x.quotationId === q.qno) || null;
}
function sovRawInvoice(id){ return (typeof invoicesCache !== 'undefined' ? invoicesCache : []).find(i => i.id === id) || null; }
function sovIndependent(){ return typeof invIndependentMode === 'function' && invIndependentMode(); }
function sovReceiptsOn(){ return typeof receiptsActive === 'function' && receiptsActive(); }

/** Delivery notes, newest first (voided last). */
function sovDNs(so){
  return (so.deliveries || []).map((d, idx) => ({ d, idx, status: typeof getDNStatus === 'function' ? getDNStatus(d) : (d.voided ? 'Voided' : d.customerConfirmed ? 'Delivered' : 'Out for Delivery') }))
    .sort((a, b) => (a.d.voided ? 1 : 0) - (b.d.voided ? 1 : 0) || String(b.d.date || '').localeCompare(String(a.d.date || '')) || String(b.d.dnNo || '').localeCompare(String(a.d.dnNo || '')));
}
const SOV_DN_TONE = { 'Out for Delivery': ['Out For Delivery', 'amber'], 'Delivered': ['Delivered', 'green'], 'Partially Accepted': ['Partly Accepted', 'purple'], 'Rejected': ['Rejected', 'red'], 'Voided': ['Voided', 'neutral'] };
const sovDnPill = st => { const t = SOV_DN_TONE[st] || [st, 'neutral']; return sovPill(t[0], t[1]); };

/** Payment facts of one invoice (independent mode: invoicePayments; legacy: none per invoice). */
function sovInvoicePay(inv){
  const raw = sovIndependent() ? sovRawInvoice(inv.id) : null;
  if (raw && typeof invoicePayStatusOf === 'function') {
    const net = invoiceNetOf(raw), paid = invoicePaidOf(raw), bal = invoiceBalanceOf(raw), st = invoicePayStatusOf(raw);
    return { net: sovR2(net), paid: sovR2(paid), balance: sovR2(bal), status: st, dueDate: raw.dueDate || inv.dueDate || '' };
  }
  const total = sovN(inv.total != null ? inv.total : inv.totals && inv.totals.total);
  return { net: sovR2(total), paid: 0, balance: sovR2(total), status: 'Unknown', dueDate: inv.dueDate || '' };
}
const SOV_PAY_TONE = { Paid: ['Paid', 'green'], 'Partially paid': ['Part Paid', 'amber'], Unpaid: ['Unpaid', 'neutral'], Overdue: ['Overdue', 'red'], Overpaid: ['Overpaid', 'purple'], Credited: ['Credited', 'red'], Unknown: ['Issued', 'blue'] };
const sovPayPill = st => { const t = SOV_PAY_TONE[st] || [st, 'neutral']; return sovPill(t[0], t[1]); };

/** Invoices, newest first, with their payment facts. */
function sovInvoices(so){
  return (so.invoices || []).map((inv, idx) => ({ inv, idx, pay: sovInvoicePay(inv) }))
    .sort((a, b) => String(b.inv.date || '').localeCompare(String(a.inv.date || '')) || String(b.inv.invNo || '').localeCompare(String(a.inv.invNo || '')));
}
function sovCreditNotes(so){ return (so.creditNotes || []).slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))); }
function sovReceipts(so){
  if (sovReceiptsOn() && typeof receiptsForSO === 'function') {
    return receiptsForSO(so).map(r => {
      const here = (r.allocations || []).filter(a => a.salesOrderId === so.id);
      return { id: r.id, no: r.rctNo, date: r.date, method: r.method || '', amount: sovR2(here.reduce((s, a) => s + sovN(a.amount), 0)), invNos: here.map(a => a.invNo).filter(Boolean), voided: r.status === 'Voided', reference: r.reference || '', r };
    }).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }
  return (so.payments || []).map((p, i) => ({ id: '', no: p.ref || ('Payment ' + (i + 1)), date: p.date, method: p.method || '', amount: sovR2(p.amount), invNos: [], voided: false, reference: p.remarks || '', legacy: true }))
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

/* ───────────────────────── purchasing (bought, from stock) ───────────────────────── */
function sovPurch(so){
  const lib = window.BizCorePI;
  const out = { ok: !!lib, ledger: null, piLines: [], allocs: [], byLine: {} };
  if (!lib) return out;
  out.ledger = (lib.ledgers && lib.ledgers.get(so.id)) || null;
  const C = lib.core;
  (lib.invoices || []).forEach(pi => {
    if (!pi || pi.status === 'Voided') return;
    const f = C && C.costFactorOf ? C.costFactorOf(pi) : 0;
    (pi.lines || []).forEach(l => (l.allocations || []).forEach(a => {
      if (!a || a.soId !== so.id) return;
      out.piLines.push({ pi, line: l, soLineId: a.soLineId, qty: sovN(a.qty), unit: sovN(l.landedUnitCost) * (1 - f), supplier: pi.supplierName || '' });
    }));
  });
  out.allocs = (lib.allocations || []).filter(a => a && a.soId === so.id && a.status !== 'Voided');
  (so.items || []).forEach(it => {
    const id = it.lineId, L = (out.ledger && out.ledger.lines && out.ledger.lines[id]) || {};
    const pis = out.piLines.filter(x => x.soLineId === id), sas = out.allocs.filter(a => a.soLineId === id);
    const piQty = sovRQ(pis.reduce((s, x) => s + x.qty, 0)), saQty = sovRQ(sas.reduce((s, a) => s + sovN(a.qty), 0));
    const purchased = out.ledger ? sovN(L.purchased) : sovRQ(piQty + saQty);
    const fromStock = out.ledger ? sovN(L.fromStock) : saQty;
    out.byLine[id] = { pis, sas, piQty, saQty, purchased, fromStock, missing: purchased - (piQty + saQty) > 1e-6 };
  });
  return out;
}

/* ───────────────────────── estimate (pricing version the quotation came from) ───────────────────────── */
function sovEstimate(so){
  const q = sovQuotation(so); if (!q) return { status: 'none' };
  const r = sovRfq(q); if (!r) return { status: 'none', q };
  const n = Number(q.pricingVersion || r.currentPricingVersion || 1);
  const v = typeof pvFull === 'function' ? pvFull(r, n) : null;
  if (!v && n !== Number(r.currentPricingVersion || 1)) return { status: 'loading', q, r, n };
  const items = (v && v.pricingItems) || r.pricingItems || [];
  const costs = ((v && v.internalCosts) || r.internalCosts || []).filter(c => c && typeof c === 'object');
  const material = items.reduce((s, i) => s + sovN(i.buy) * sovN(i.qty), 0);
  const extra = costs.reduce((s, c) => s + sovN(c.amount), 0);
  return { status: 'ok', q, r, n, items, extra, factor: material > 0 ? extra / material : 0, supplierName: (v && v.supplierName) || r.supplierName || '' };
}
function sovEstimateLine(est, so, it){
  if (!est || est.status !== 'ok') return null;
  const qi = (est.q.items || [])[Number(it.origIdx)] || {};
  const low = s => String(s || '').trim().toLowerCase();
  const prod = qi.prodId || it.prodId, code = low(qi.code || it.code), desc = low(qi.desc || it.desc);
  const hit = (prod && est.items.find(i => String(i.productId || '') === String(prod)))
    || (code && est.items.find(i => low(i.code) === code))
    || est.items.find(i => low(i.desc) === desc);
  const buy = hit ? sovN(hit.buy) : 0;
  if (!(buy > 0)) return null;
  return { buy, unit: buy * (1 + est.factor), supplier: (hit.supplierName || est.supplierName || '').trim() };
}
function sovLastPaid(it){
  const lib = window.BizCorePI; if (!lib || !lib.core || !lib.lastPrices) return null;
  try { const k = lib.core.itemKeyOf({ productId: it.prodId || it.productId, code: it.code, desc: it.desc, uom: it.uom }); const lp = lib.lastPrices.get(k); return lp && sovN(lp.unitCost) > 0 ? lp : null; } catch (e) { return null; }
}

/* ───────────────────────── the model ───────────────────────── */
function sovModel(so){
  const items = so.items || [];
  const acc = typeof invoiceAcceptedQtyMap === 'function' ? invoiceAcceptedQtyMap(so) : {};
  const inv = typeof invoicePreviouslyInvoicedQtyMap === 'function' ? invoicePreviouslyInvoicedQtyMap(so) : {};
  const transit = {};
  (so.deliveries || []).forEach(d => { if (d.voided || d.customerConfirmed) return; (d.items || []).forEach(it => { const i = soRowOfItem(so, it, 'dn'); if (i != null) transit[i] = sovRQ((transit[i] || 0) + sovN(it.qty)); }); });
  const purch = sovPurch(so);
  const lines = items.map((it, i) => {
    const qty = sovN(it.qty), uom = it.uom || '', up = sovN(it.up);
    const amount = sovN(it.amount) > 0 ? sovN(it.amount) : sovR2(qty * up);
    const accepted = Math.min(qty, sovN(acc[i]));
    const tr = Math.min(Math.max(0, qty - accepted), sovN(transit[i]));
    const invoiced = Math.min(qty, sovN(inv[i]));
    const P = purch.byLine[it.lineId] || { purchased: 0, fromStock: 0 };
    const bought = Math.min(qty, sovN(P.purchased)), fromStock = Math.min(bought, sovN(P.fromStock));
    const l = { i, no: i + 1, it, lineId: it.lineId, desc: it.desc || '—', code: it.code || '', uom, qty, up, amount,
      accepted: sovRQ(accepted), transit: sovRQ(tr), sent: sovRQ(accepted + tr), invoiced: sovRQ(invoiced),
      toDeliver: sovRQ(Math.max(0, qty - accepted)), toInvoice: sovRQ(Math.max(0, accepted - invoiced)),
      bought: sovRQ(bought), fromStock: sovRQ(fromStock), boughtPI: sovRQ(Math.max(0, bought - fromStock)), toBuy: sovRQ(Math.max(0, qty - bought)), P };
    l.state = l.accepted >= qty - SOV_EPS && l.invoiced >= qty - SOV_EPS ? ['Complete', 'green']
      : l.toBuy > SOV_EPS ? (l.bought > SOV_EPS ? [`${sovQ(l.toBuy, uom)} Still To Buy`, 'amber'] : ['To Buy', 'neutral'])
      : l.toDeliver > SOV_EPS ? (l.transit > SOV_EPS && l.transit >= l.toDeliver - SOV_EPS ? ['Out For Delivery', 'amber'] : ['To Deliver', 'blue'])
      : l.toInvoice > SOV_EPS ? ['To Invoice', 'amber'] : ['Delivered', 'teal'];
    return l;
  });
  const share = key => { const m = {}; lines.forEach(l => { m[l.i] = l[key]; }); return typeof soShareValue === 'function' ? soShareValue(so, m) : 0; };
  const total = sovN(so.total);
  const deliveredValue = share('accepted'), toDeliverValue = share('toDeliver'), toInvoiceValue = share('toInvoice');
  const billed = sovIndependent() && typeof soBilledTotal === 'function' ? soBilledTotal(so) : (so.invoices || []).reduce((s, x) => s + sovN(x.total), 0);
  const deliveredPct = total > 0 ? Math.min(100, Math.max(0, deliveredValue / total * 100)) : 0;
  const invoicedPct = total > 0 ? Math.min(100, Math.max(0, billed / total * 100)) : 0;
  const anyAccepted = lines.some(l => l.accepted > SOV_EPS), allAccepted = lines.length > 0 && lines.every(l => l.toDeliver <= SOV_EPS), anyTransit = lines.some(l => l.transit > SOV_EPS);
  const deliveryStage = allAccepted ? 'Delivered' : anyAccepted ? 'Partially Delivered' : anyTransit ? 'Out For Delivery' : 'Confirmed';
  const allInvoiced = lines.length > 0 && lines.every(l => l.invoiced >= l.qty - SOV_EPS);
  const invoiceStage = allInvoiced ? 'Invoiced' : (billed > 0.005 || (so.invoices || []).length) ? 'Part Invoiced' : 'Not Invoiced';
  const dns = sovDNs(so), invs = sovInvoices(so), cns = sovCreditNotes(so), rcts = sovReceipts(so);
  // payment
  let received = 0, outstanding = 0, nextDue = '', overdueDays = 0;
  const today = sovToday();
  if (sovReceiptsOn()) {
    invs.forEach(x => { received += x.pay.paid; if (x.pay.balance > 0.005) { outstanding += x.pay.balance; const d = x.pay.dueDate; if (d && (!nextDue || d < nextDue)) nextDue = d; if (d && d < today) overdueDays = Math.max(overdueDays, -sovDaysUntil(d)); } });
  } else {
    received = typeof soPaidTotal === 'function' ? soPaidTotal(so) : 0;
    outstanding = Math.max(0, billed - received);
    invs.forEach(x => { const d = x.inv.dueDate; if (outstanding > 0.005 && d && (!nextDue || d < nextDue)) nextDue = d; if (outstanding > 0.005 && d && d < today) overdueDays = Math.max(overdueDays, -sovDaysUntil(d)); });
  }
  received = sovR2(received); outstanding = sovR2(outstanding);
  const payStatus = !invs.length ? ['Not Invoiced', 'neutral'] : overdueDays > 0 ? ['Overdue', 'red'] : outstanding <= 0.005 ? ['Paid', 'green'] : received > 0.005 ? ['Part Paid', 'amber'] : ['Unpaid', 'neutral'];
  return { so, lines, total, subtotal: sovN(so.subtotal), vat: sovN(so.vat), vatRate: sovN(so.vatRate || 0.15), purch,
    deliveredValue, toDeliverValue, toInvoiceValue, billed: sovR2(billed), deliveredPct, invoicedPct, deliveryStage, invoiceStage,
    dns, invs, cns, rcts, received, outstanding, nextDue, overdueDays, payStatus,
    pendingDelivery: lines.filter(l => l.toDeliver > SOV_EPS), pendingInvoice: lines.filter(l => l.toInvoice > SOV_EPS), toBuyLines: lines.filter(l => l.toBuy > SOV_EPS) };
}

/* ───────────────────────── actions available now ───────────────────────── */
function sovActions(so, m){
  const acts = [];
  const hasUndelivered = m.lines.some(l => sovRQ(l.qty - l.accepted - l.transit) > SOV_EPS);
  const canInvoiceV264 = typeof soCanIssueInvoice === 'function' ? soCanIssueInvoice(so) : null;
  const canInvoice = canInvoiceV264 === null ? (typeof soHasInvoiceableQty === 'function' && soHasInvoiceableQty(so)) : canInvoiceV264;
  const rctOn = sovReceiptsOn();
  const canReceipt = rctOn ? (typeof soHasOpenInvoices === 'function' && soHasOpenInvoices(so)) : false;
  const canPayLegacy = !rctOn && (so.invoices || []).length > 0 && m.outstanding > 0.01;
  if (hasUndelivered) acts.push({ key: 'dn', label: '+ Delivery Note', icon: 'ti-truck', cls: 'btn-primary', id: 'so-new-dn-btn', run: () => openRecordDelivery(so.id) });
  if (canInvoice) acts.push({ key: 'inv', label: '+ Invoice', icon: 'ti-file-invoice', cls: 'btn-primary', id: 'so-new-inv-btn', run: () => openCreateInvoice(so.id) });
  if (canReceipt) acts.push({ key: 'rct', label: '+ New Receipt', icon: 'ti-cash', cls: 'btn-success', id: 'so-new-receipt-btn', run: () => openNewReceipt({ soId: so.id }) });
  if (canPayLegacy) acts.push({ key: 'pay', label: 'Record Payment', icon: 'ti-cash', cls: 'btn-success', id: 'so-record-payment-btn', run: () => openRecordPayment(so.id) });
  // the phone's main button = the next sensible step: collect money → invoice what was delivered → deliver → bill (ahead / advance)
  const find = k => acts.find(a => a.key === k);
  const next = find('rct') || find('pay') || (m.pendingInvoice.length ? find('inv') : null) || find('dn') || find('inv') || null;
  const editable = typeof soHasDownstreamActivity === 'function' ? !soHasDownstreamActivity(so) : true;
  return { list: acts, next, editable };
}
const SOV_EDIT_WHY = 'This order already has delivery notes, invoices or payments — it can no longer be edited.';

/* ═══════════════════════════════ RENDER ═══════════════════════════════ */
function sovRing(pct, color, track, size){
  const s = size || 88, sw = s >= 80 ? 10 : 9, r = (s - sw) / 2 - 1, c = 2 * Math.PI * r, off = c * (1 - Math.max(0, Math.min(100, pct)) / 100);
  return `<div class="sov-ring" style="width:${s}px;height:${s}px" role="img" aria-label="${Math.round(pct)}% by value"><svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}"><circle cx="${s / 2}" cy="${s / 2}" r="${r}" fill="none" stroke="${track}" stroke-width="${sw}"/><circle cx="${s / 2}" cy="${s / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}" transform="rotate(-90 ${s / 2} ${s / 2})"/></svg><div class="sov-ring-pct" style="color:${color}">${Math.round(pct)}%<small>By Value</small></div></div>`;
}
function sovCountLink(key, text, n){
  if (!n) return `<span class="sov-muted-strong">${sovEsc(text)}</span>`;
  return `<button type="button" class="sov-count" data-sov-pop="${key}" aria-haspopup="dialog" aria-expanded="false">${sovEsc(text)} <i class="ti ti-chevron-down" aria-hidden="true"></i></button>`;
}
function sovCards(m){
  const so = m.so;
  const liveDns = m.dns.filter(x => !x.d.voided), latestDn = liveDns[0], ofd = liveDns.filter(x => x.status === 'Out for Delivery').length;
  const stepNames = ['Confirmed', 'Out', 'Partial', 'Delivered'], cur = { Confirmed: 0, 'Out For Delivery': 1, 'Partially Delivered': 2, Delivered: 3 }[m.deliveryStage];
  const steps = stepNames.map((s, i) => i === cur ? `<b>${s}</b>` : s).join(' → ');
  const dTone = { Confirmed: 'blue', 'Out For Delivery': 'amber', 'Partially Delivered': 'amber', Delivered: 'teal' }[m.deliveryStage];
  const pd = m.pendingDelivery.length;
  const dBig = pd ? `<div class="sov-big sov-blue" title="${sovEsc(sovSAR(m.toDeliverValue))} incl. VAT still to deliver">${sovPlural(pd, 'Item')} Pending Delivery</div>` : `<div class="sov-big sov-done">All Items Delivered</div>`;
  const dNote = liveDns.length
    ? `${sovCountLink('dn', sovPlural(liveDns.length, 'DN'), liveDns.length)}<span> · Latest ${sovEsc(latestDn.d.dnNo)} (${sovDayMonth(latestDn.d.date)})${ofd ? ` · ${ofd} Out For Delivery` : ''}</span>`
    : '<span>No Delivery Notes Yet</span>';
  const liveInvs = m.invs, latestInv = liveInvs[0];
  const iTone = { 'Not Invoiced': 'neutral', 'Part Invoiced': 'amber', Invoiced: 'green' }[m.invoiceStage];
  const pi = m.pendingInvoice.length;
  const iBig = pi ? `<div class="sov-big sov-orange" title="${sovEsc(sovSAR(m.toInvoiceValue))} incl. VAT still to invoice">${sovPlural(pi, 'Item')} Delivered, Not Invoiced</div>`
    : `<div class="sov-big sov-done">${m.lines.some(l => l.accepted > SOV_EPS) ? 'All Delivered Is Invoiced' : 'Nothing Delivered Yet'}</div>`;
  const iNote = liveInvs.length
    ? `${sovCountLink('inv', sovPlural(liveInvs.length, 'Invoice'), liveInvs.length)}<span> · Latest ${sovEsc(latestInv.inv.invNo)} (${sovDayMonth(latestInv.inv.date)})${m.cns.length ? ` · ${sovPlural(m.cns.length, 'Credit Note')}` : ''}</span>`
    : '<span>No Invoices Yet</span>';
  let paySub;
  if (!m.invs.length) paySub = 'Nothing Invoiced Yet';
  else if (m.outstanding <= 0.005) paySub = `${sovMoney(m.received)} Received · Fully Paid`;
  else if (m.overdueDays > 0) paySub = `${sovMoney(m.received)} Received · Overdue ${sovPlural(m.overdueDays, 'Day')}`;
  else { const d = sovDaysUntil(m.nextDue); paySub = `${sovMoney(m.received)} Received` + (m.nextDue ? ` · Next Due ${fmtDate(m.nextDue)} · ${d === 0 ? 'Today' : 'In ' + sovPlural(d, 'Day')}` : ''); }
  const lineCount = (so.items || []).length;
  return `<div class="sov-cards">
    <section class="sov-card sov-ring-card" data-card="delivery">${sovRing(m.deliveredPct, '#1d63d8', '#e3edfc')}
      <div class="sov-card-main"><div class="sov-card-head"><span class="sov-label">Delivery</span>${sovPill(m.deliveryStage, dTone)}</div>
        <div class="sov-steps sov-ell">${steps}</div>${dBig}<div class="sov-note sov-ell" title="${sovEsc(dNote.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())}">${dNote}</div></div></section>
    <section class="sov-card sov-ring-card" data-card="invoicing">${sovRing(m.invoicedPct, '#ea6a10', '#fdebdc')}
      <div class="sov-card-main"><div class="sov-card-head"><span class="sov-label">Invoicing</span>${sovPill(m.invoiceStage, iTone)}</div>
        <div class="sov-steps sov-ell">Invoiced ${sovSAR(m.billed)} of ${sovMoney(m.total)}</div>${iBig}<div class="sov-note sov-ell" title="${sovEsc(iNote.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())}">${iNote}</div></div></section>
    <section class="sov-card sov-fig" data-card="total"><div class="sov-fig-t">Order Total (Incl. VAT)</div><div class="sov-fig-v">${sovSAR(m.total)}</div><div class="sov-fig-s sov-ell">${sovPlural(lineCount, 'Line')} · Sub-total ${sovMoney(m.subtotal)}</div></section>
    <section class="sov-card sov-fig" data-card="outstanding"><div class="sov-fig-t sov-fig-split"><span>Outstanding</span>${sovPill(m.payStatus[0], m.payStatus[1])}</div><div class="sov-fig-v ${m.outstanding > 0.005 ? 'sov-red' : ''}">${sovSAR(m.outstanding)}</div><div class="sov-fig-s sov-ell2" title="${sovEsc(paySub)}">${paySub}</div></section>
  </div>`;
}
/* phone: the rings side by side, then the two figures */
function sovPhoneCards(m){
  const liveDns = m.dns.filter(x => !x.d.voided);
  const pd = m.pendingDelivery.length, pi = m.pendingInvoice.length;
  return `<div class="sov-pcards">
    <section class="sov-card sov-pc">${sovRing(m.deliveredPct, '#1d63d8', '#e3edfc', 72)}<div class="sov-label">Delivery</div>
      <div class="sov-note"><b class="sov-blue">${pd ? sovPlural(pd, 'Item') + ' Pending' : 'All Delivered'}</b><br>${liveDns.length ? sovCountLink('dn', sovPlural(liveDns.length, 'DN'), liveDns.length) : 'No DNs Yet'}</div></section>
    <section class="sov-card sov-pc">${sovRing(m.invoicedPct, '#ea6a10', '#fdebdc', 72)}<div class="sov-label">Invoicing</div>
      <div class="sov-note"><b class="sov-orange">${pi ? sovPlural(pi, 'Item') + ' To Invoice' : m.invoiceStage}</b><br>${m.invs.length ? sovCountLink('inv', sovPlural(m.invs.length, 'Invoice'), m.invs.length) : 'No Invoices Yet'}</div></section>
    <section class="sov-card sov-fig"><div class="sov-fig-t">Order Total</div><div class="sov-fig-v">${sovSAR(m.total)}</div></section>
    <section class="sov-card sov-fig"><div class="sov-fig-t">Outstanding · <span class="sov-pay-word t-${m.payStatus[1]}">${m.payStatus[0]}</span></div><div class="sov-fig-v ${m.outstanding > 0.005 ? 'sov-red' : ''}">${sovSAR(m.outstanding)}</div><div class="sov-fig-s">${m.nextDue && m.outstanding > 0.005 ? `Due ${sovDayMonth(m.nextDue)}` + (m.overdueDays > 0 ? ` · Overdue ${sovPlural(m.overdueDays, 'Day')}` : ` · In ${sovPlural(sovDaysUntil(m.nextDue), 'Day')}`) : (m.invs.length ? `${sovMoney(m.received)} Received` : 'Nothing Invoiced')}</div></section>
  </div>`;
}

/* ───────────────────────── list panels (floating list / bottom sheet) ───────────────────────── */
function sovLineSummary(m, key, label){
  const parts = m.lines.map(l => `Line ${l.no}: ${sovQ(l[key], l.uom)} / ${sovQU(l.qty, l.uom)}`);
  return `<b>${label}:</b> ${parts.join(' · ')}`;
}
function sovDnListHtml(m){
  const so = m.so;
  const rows = m.dns.map(x => {
    const d = x.d;
    const items = (d.items || []).map(it => {
      const q = sovN(it.qty), a = typeof deliveryAcceptedQty === 'function' ? deliveryAcceptedQty(d, it) : q, r = typeof deliveryRejectedQty === 'function' ? deliveryRejectedQty(d, it) : 0;
      let s = `${sovEsc(it.desc || '—')} <b>${sovQU(q, it.uom)}</b>`;
      if (d.customerConfirmed && !d.voided && r > SOV_EPS) s += ` → <b>${sovQ(a, it.uom)} Accepted</b> · <span class="sov-red">${sovQ(r, it.uom)} Rejected</span>`;
      return s;
    }).join(' · ');
    const tail = d.voided ? ' · Not Counted' : !d.customerConfirmed ? ' · Not Yet Accepted' : x.status === 'Delivered' ? ' · All Accepted' : '';
    const who = d.receivedBy && d.customerConfirmed && !d.voided ? ` · Received By ${sovEsc(d.receivedBy)}` : (d.deliveredBy && !d.customerConfirmed && !d.voided ? ` · Delivered By ${sovEsc(d.deliveredBy)}` : '');
    return `<div class="sov-lr${d.voided ? ' sov-voided' : ''}"><div class="sov-lr1"><button type="button" class="sov-ref" data-open="dn" data-idx="${x.idx}">${sovEsc(d.dnNo)}</button><span class="sov-dt">${fmtDate(d.date)}</span>${sovDnPill(x.status)}</div>
      <div class="sov-lr2">${items}${tail}${who}</div></div>`;
  }).join('');
  return `<div class="sov-poph"><span>Delivery Notes · ${sovEsc(so.soNo)}</span><small>Newest First</small></div><div class="sov-popl">${rows}</div>
    <div class="sov-popf">${sovLineSummary(m, 'accepted', 'Accepted')}<br>Rejected quantity goes back to To Deliver. Voided DNs are not counted.</div>`;
}
function sovInvListHtml(m){
  const so = m.so;
  const rows = m.invs.map(x => {
    const inv = x.inv, isAdv = inv.type === 'advance';
    const items = isAdv ? `Advance ${formatNumber(sovN(inv.advance && inv.advance.percent), 2)}%` : (inv.items || []).filter(it => sovN(it.qty) > SOV_EPS || sovN(it.invoicedQty) > SOV_EPS).map(it => `${sovEsc(it.desc || '—')} <b>${sovQU(it.qty, it.uom)}</b>${sovN(it.invoicedQty) - sovN(it.qty) > SOV_EPS ? ` <span class="sov-red">(${sovQ(sovN(it.invoicedQty) - sovN(it.qty), it.uom)} Credited)</span>` : ''}`).join(' · ');
    const credited = inv.status === 'Credited' ? sovPill('Credited', 'red') : inv.status === 'Partially credited' ? sovPill('Part Credited', 'amber') : '';
    const money = `<b>${sovSAR(x.pay.net)}</b>` + (x.pay.paid > 0.005 ? ` · Received ${sovMoney(x.pay.paid)}` : '') + (x.pay.dueDate ? ` · Due ${fmtDate(x.pay.dueDate)}` : '');
    return `<div class="sov-lr"><div class="sov-lr1"><button type="button" class="sov-ref" data-open="inv" data-idx="${x.idx}">${sovEsc(inv.invNo)}</button><span class="sov-dt">${fmtDate(inv.date)}</span>${credited}${sovPayPill(x.pay.status)}</div>
      <div class="sov-lr2">${items || '—'}<br>${money}</div></div>`;
  }).join('');
  const cnRows = m.cns.map(c => `<div class="sov-lr"><div class="sov-lr1"><button type="button" class="sov-ref" data-open="cn" data-id="${sovEsc(c.id)}">${sovEsc(c.cnNo)}</button><span class="sov-dt">${fmtDate(c.date)}</span>${sovPill('Credit Note', 'red')}</div><div class="sov-lr2">−${sovSAR(c.total)} · ${sovEsc(c.invNo || '')}${c.reason ? ' · ' + sovEsc(c.reason) : ''}</div></div>`).join('');
  const ti = m.pendingInvoice.length ? m.pendingInvoice.map(l => `Line ${l.no}: ${sovQU(l.toInvoice, l.uom)}`).join(' · ') + ` (${sovSAR(m.toInvoiceValue)})` : 'Nothing';
  return `<div class="sov-poph"><span>Invoices · ${sovEsc(so.soNo)}</span><small>Newest First</small></div><div class="sov-popl">${rows}${cnRows}</div>
    <div class="sov-popf">${sovLineSummary(m, 'invoiced', 'Invoiced')}<br><b>To Invoice:</b> ${ti}<br>Credit notes are deducted. Cancelled invoices are not counted.</div>`;
}
function sovPiListHtml(m){
  const byPi = new Map();
  m.purch.piLines.forEach(x => { const e = byPi.get(x.pi.id) || { pi: x.pi, rows: [] }; e.rows.push(x); byPi.set(x.pi.id, e); });
  const C = window.BizCorePI && window.BizCorePI.core;
  const rows = [...byPi.values()].sort((a, b) => String(b.pi.date || '').localeCompare(String(a.pi.date || ''))).map(e => {
    const st = C && C.payStatusOf ? C.payStatusOf(e.pi) : '';
    const tone = st === 'Paid' ? 'green' : st === 'Part paid' ? 'amber' : 'neutral';
    return `<div class="sov-lr"><div class="sov-lr1"><button type="button" class="sov-ref" data-open="pi" data-id="${sovEsc(e.pi.id)}">${sovEsc(e.pi.piNo)}</button><span class="sov-dt">${fmtDate(e.pi.date)}</span>${st ? sovPill(st === 'Part paid' ? 'Part Paid' : st, tone) : ''}</div>
      <div class="sov-lr2">${sovEsc(e.pi.supplierName || '')} · ${e.rows.map(x => `${sovEsc(x.line.desc || '—')} <b>${sovQU(x.qty, x.line.uom)}</b>`).join(' · ')}</div></div>`;
  }).join('');
  const sa = m.purch.allocs.map(a => { const l = m.lines.find(x => x.lineId === a.soLineId); return `<div class="sov-lr"><div class="sov-lr1"><span class="sov-ref-plain">From Stock</span><span class="sov-dt">${fmtDate(a.date)}</span>${sovPill('Allocated', 'blue')}</div><div class="sov-lr2">${sovEsc(l ? l.desc : '')} <b>${sovQU(a.qty, l ? l.uom : '')}</b></div></div>`; }).join('');
  return `<div class="sov-poph"><span>Purchases · ${sovEsc(m.so.soNo)}</span><small>Newest First</small></div><div class="sov-popl">${rows}${sa || ''}${!rows && !sa ? '<div class="sov-empty">Nothing bought for this order yet.</div>' : ''}</div>
    <div class="sov-popf">${sovLineSummary(m, 'bought', 'Bought')}</div>`;
}
function sovRctListHtml(m){
  const rows = m.rcts.map(r => `<div class="sov-lr${r.voided ? ' sov-voided' : ''}"><div class="sov-lr1">${r.id ? `<button type="button" class="sov-ref" data-open="rct" data-id="${sovEsc(r.id)}">${sovEsc(r.no)}</button>` : `<span class="sov-ref-plain">${sovEsc(r.no)}</span>`}<span class="sov-dt">${fmtDate(r.date)}</span>${r.voided ? sovPill('Voided', 'neutral') : sovPill('Received', 'green')}</div>
    <div class="sov-lr2"><b>${sovSAR(r.amount)}</b>${r.method ? ' · ' + sovEsc(r.method) : ''}${r.invNos.length ? ' · ' + sovEsc(r.invNos.join(', ')) : ''}</div></div>`).join('');
  return `<div class="sov-poph"><span>Receipts · ${sovEsc(m.so.soNo)}</span><small>Newest First</small></div><div class="sov-popl">${rows || '<div class="sov-empty">No receipts yet.</div>'}</div>
    <div class="sov-popf"><b>Received:</b> ${sovSAR(m.received)} · <b>Outstanding:</b> ${sovSAR(m.outstanding)}<br>Voided receipts are not counted.</div>`;
}

/* ───────────────────────── tabs ───────────────────────── */
function sovOverview(m){
  const so = m.so, q = sovQuotation(so), r = sovRfq(q);
  const row = (k, v) => `<div class="sov-kv"><span>${k}</span><b>${v}</b></div>`;
  const createdBy = so.createdBy || '';
  const att = so.poAttachment && so.poAttachment.url ? so.poAttachment : null;
  const poBox = att
    ? `<div class="sov-po-file"><i class="ti ti-paperclip" aria-hidden="true"></i><button type="button" class="sov-link" data-act="po-view">${sovEsc(att.name || 'Customer PO attachment')}</button><small>${sovEsc(typeof soAttachmentMeta === 'function' ? soAttachmentMeta(att) : '')}</small><div class="sov-po-btns"><button type="button" class="btn btn-secondary btn-sm" data-act="po-view"><i class="ti ti-eye"></i>View</button><button type="button" class="btn btn-secondary btn-sm" data-act="po-download"><i class="ti ti-download"></i>Download</button></div></div>`
    : `<div class="sov-po-file sov-po-empty"><i class="ti ti-paperclip-off" aria-hidden="true"></i><span>No Customer PO attachment added.</span></div>`;
  const liveDns = m.dns.filter(x => !x.d.voided);
  const piCount = new Set(m.purch.piLines.map(x => x.pi.id)).size + (m.purch.allocs.length ? 1 : 0);
  const rctCount = m.rcts.filter(x => !x.voided).length;
  const chip = (title, sub, attrs, cls) => `<button type="button" class="sov-chip ${cls || ''}" ${attrs || ''}><b>${title}</b><small>${sub}</small></button>`;
  const arrow = '<i class="ti ti-arrow-right sov-chip-arrow" aria-hidden="true"></i>';
  const chips = [];
  chips.push(r ? chip(sovEsc(r.rfqNo || 'RFQ'), `Pricing V${sovEsc(q && q.pricingVersion || r.currentPricingVersion || 1)}`, `data-open="rfq" data-id="${sovEsc(r.id)}"`) : chip('RFQ', 'Not Linked', 'disabled', 'sov-chip-missing'));
  chips.push(q ? chip(sovEsc(q.qno), `${sovEsc(q.status || 'Quotation')} ${q.date ? sovDayMonth(q.date) : ''}`, `data-open="quote" data-id="${sovEsc(q.id)}"`) : chip('Quotation', 'Not Linked', 'disabled', 'sov-chip-missing'));
  chips.push(chip(sovEsc(so.soNo), 'This Order', 'aria-current="true" disabled', 'sov-chip-current'));
  chips.push(piCount ? chip(piCount > 1 ? `Purchases ×${piCount}` : sovEsc((m.purch.piLines[0] && m.purch.piLines[0].pi.piNo) || 'From Stock'), m.toBuyLines.length ? `${sovPlural(m.toBuyLines.length, 'Line')} To Buy` : 'All Bought', 'data-sov-pop="pi" aria-haspopup="dialog"') : chip('Purchase', m.lines.length ? 'Not Yet' : '—', 'disabled', 'sov-chip-missing'));
  chips.push(liveDns.length ? chip(liveDns.length > 1 ? `DN ×${liveDns.length}` : sovEsc(liveDns[0].d.dnNo), liveDns.length > 1 ? `Latest ${sovDayMonth(liveDns[0].d.date)}` : `${SOV_DN_TONE[liveDns[0].status] ? SOV_DN_TONE[liveDns[0].status][0] : liveDns[0].status} ${sovDayMonth(liveDns[0].d.date)}`, 'data-sov-pop="dn" aria-haspopup="dialog"') : chip('Delivery Note', 'Not Yet', 'disabled', 'sov-chip-missing'));
  chips.push(m.invs.length ? chip(m.invs.length > 1 ? `INV ×${m.invs.length}` : sovEsc(m.invs[0].inv.invNo), m.invs.length > 1 ? `Latest ${sovDayMonth(m.invs[0].inv.date)}` : `Issued ${sovDayMonth(m.invs[0].inv.date)}`, 'data-sov-pop="inv" aria-haspopup="dialog"') : chip('Invoice', 'Not Yet', 'disabled', 'sov-chip-missing'));
  chips.push(rctCount ? chip(rctCount > 1 ? `Receipt ×${rctCount}` : sovEsc(m.rcts.find(x => !x.voided).no), `${sovMoney(m.received)} Received`, 'data-sov-pop="rct" aria-haspopup="dialog"') : chip('Receipt', 'Not Yet', 'disabled', 'sov-chip-missing'));
  const lastBy = so._savedBy || '', lastAt = so._savedAt || so.updated || '';
  return `<div class="sov-ov-grid">
    <section class="sov-box"><h3>Order</h3>
      ${row('Customer', sovEsc(so.customer || '—'))}
      ${row('Contact', sovEsc(so.contact || '—'))}
      ${row('Customer PO', att ? `<button type="button" class="sov-link" data-act="po-view">${sovEsc(so.poNo || '—')}</button>` : sovEsc(so.poNo || '—'))}
      ${row('PO Date', so.poDate ? fmtDate(so.poDate) : '—')}
      ${row('Project / Delivery To', sovEsc(so.project || '—'))}
      ${row('Expected Delivery', so.expectedDelivery ? fmtDate(so.expectedDelivery) : '—')}
    </section>
    <section class="sov-box"><h3>Terms</h3>
      ${row('Payment Terms', sovEsc(so.payment || '—'))}
      ${row('Delivery Terms', sovEsc(so.delivery || '—'))}
      ${row('VAT', Math.round(m.vatRate * 100) + '%')}
      ${row('Created', `${so.created ? fmtDate(so.created) : (so.date ? fmtDate(so.date) : '—')}${createdBy ? ' · ' + sovEsc(createdBy) : ''}`)}
      ${row('Last Change', lastAt ? `${fmtDate(lastAt)}${lastBy ? ' · ' + sovEsc(lastBy) : ''}` : '—')}
    </section>
    <section class="sov-box"><h3>Customer PO</h3>${poBox}
      ${so.notes ? `<div class="sov-notes"><b>Notes:</b> ${sovEsc(so.notes)}</div>` : ''}
      ${so.internalNote ? `<div class="sov-notes sov-internal"><b>Internal Note:</b> ${sovEsc(so.internalNote)}</div>` : ''}
    </section>
  </div>
  <section class="sov-box sov-flow-box"><h3>Document Flow</h3><div class="sov-flow">${chips.join(arrow)}</div></section>`;
}

function sovLineDocsHtml(m, l){
  const so = m.so, rows = [];
  l.P.pis && l.P.pis.forEach(x => rows.push(`<span class="sov-doc-tag t-blue">Purchase</span><button type="button" class="sov-ref" data-open="pi" data-id="${sovEsc(x.pi.id)}">${sovEsc(x.pi.piNo)}</button> ${fmtDate(x.pi.date)} · ${sovEsc(x.supplier)} · <b>${sovQU(x.qty, l.uom)}</b>`));
  l.P.sas && l.P.sas.forEach(a => rows.push(`<span class="sov-doc-tag t-blue">Stock</span>Allocated ${fmtDate(a.date)} · <b>${sovQU(a.qty, l.uom)}</b>`));
  [...m.dns].reverse().forEach(x => (x.d.items || []).forEach(it => { if (soRowOfItem(so, it, 'dn') !== l.i) return; const a = typeof deliveryAcceptedQty === 'function' ? deliveryAcceptedQty(x.d, it) : 0;
    rows.push(`<span class="sov-doc-tag t-teal">Delivery</span><button type="button" class="sov-ref" data-open="dn" data-idx="${x.idx}">${sovEsc(x.d.dnNo)}</button> ${fmtDate(x.d.date)} · <b>${sovQU(it.qty, l.uom)}</b>${x.d.customerConfirmed && !x.d.voided ? ` · ${sovQ(a, l.uom)} Accepted` : ''} ${sovDnPill(x.status)}`); }));
  [...m.invs].reverse().forEach(x => (x.inv.items || []).forEach(it => { if (soRowOfItem(so, it, 'invoice') !== l.i) return;
    rows.push(`<span class="sov-doc-tag t-amber">Invoice</span><button type="button" class="sov-ref" data-open="inv" data-idx="${x.idx}">${sovEsc(x.inv.invNo)}</button> ${fmtDate(x.inv.date)} · <b>${sovQU(it.qty, l.uom)}</b>`); }));
  return rows.length ? rows.map(r => `<div class="sov-line-doc">${r}</div>`).join('') : '<div class="sov-line-doc sov-muted">No documents for this line yet.</div>';
}
function sovItems(m, open){
  const q = (v, uom, cls) => v > SOV_EPS ? `<span class="${cls}">${sovQ(v, uom)}</span>` : `<span class="sov-zero">0</span>`;
  const rows = m.lines.map(l => `<tr class="sov-item-row${open.has(l.i) ? ' open' : ''}" data-line="${l.i}" tabindex="0" aria-expanded="${open.has(l.i)}">
      <td>${l.no}</td><td class="sov-item-name"><b>${sovEsc(l.desc)}</b><small>${sovEsc(l.uom || '—')} · ${sovSAR(l.up)}${l.code ? ' · ' + sovEsc(l.code) : ''}</small></td>
      <td>${sovQ(l.qty, l.uom)}</td><td>${sovQ(l.boughtPI, l.uom)}</td><td>${sovQ(l.fromStock, l.uom)}</td><td title="Accepted + on the way (rejected quantity not counted)">${sovQ(l.sent, l.uom)}</td><td>${sovQ(l.accepted, l.uom)}</td><td>${sovQ(l.invoiced, l.uom)}</td>
      <td>${q(l.toDeliver, l.uom, 'sov-qd')}${l.transit > SOV_EPS ? `<small class="sov-sub">${sovQ(l.transit, l.uom)} Out</small>` : ''}</td><td>${q(l.toInvoice, l.uom, 'sov-qi')}</td><td>${sovPill(l.state[0], l.state[1])}</td></tr>
    <tr class="sov-item-docs" data-docs="${l.i}"${open.has(l.i) ? '' : ' hidden'}><td></td><td colspan="10">${sovLineDocsHtml(m, l)}</td></tr>`).join('');
  const cards = m.lines.map(l => `<div class="sov-icard" data-line="${l.i}"><div class="sov-icard-h"><b>${sovEsc(l.desc)}</b>${sovPill(l.state[0], l.state[1])}</div><small>${sovQU(l.qty, l.uom)} · ${sovSAR(l.up)}</small>
      <div class="sov-g4"><div>${l.fromStock > SOV_EPS ? `${sovQ(l.boughtPI, l.uom)}+${sovQ(l.fromStock, l.uom)}` : sovQ(l.bought, l.uom)}<small>Bought</small></div><div>${sovQ(l.sent, l.uom)}<small>Delivered</small></div><div class="${l.toDeliver > SOV_EPS ? 'd' : ''}">${sovQ(l.toDeliver, l.uom)}<small>To Deliver</small></div><div class="${l.toInvoice > SOV_EPS ? 'i' : ''}">${sovQ(l.toInvoice, l.uom)}<small>To Invoice</small></div></div>
      <div class="sov-icard-docs"${open.has(l.i) ? '' : ' hidden'}>${sovLineDocsHtml(m, l)}</div></div>`).join('');
  const vatPct = Math.round(m.vatRate * 100);
  const lineList = (list, key, withValue, value) => list.length ? list.map(l => `Line ${l.no}: ${sovQU(l[key], l.uom)}`).join(' · ') + (withValue ? ` · ${sovSAR(value)}` : '') : 'Nothing';
  return `<div class="sov-tablewrap"><table class="sov-table sov-items-table"><thead><tr><th>#</th><th>Item</th><th>Ordered</th><th>Bought</th><th>From Stock</th><th>Delivered</th><th>Accepted</th><th>Invoiced</th><th class="sov-th-d">To Deliver</th><th class="sov-th-i">To Invoice</th><th>State</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="sov-icards">${cards}</div>
    <div class="sov-hint">Click a line for its documents (purchase invoice, delivery notes, invoice).</div>
    <div class="sov-two">
      <section class="sov-box"><h3>Amounts</h3><div class="sov-kv"><span>Sub-total</span><b>${sovSAR(m.subtotal)}</b></div><div class="sov-kv"><span>VAT ${vatPct}%</span><b>${sovSAR(m.vat)}</b></div><div class="sov-kv"><span>Order Total</span><b class="sov-accent">${sovSAR(m.total)}</b></div></section>
      <section class="sov-box"><h3>Still To Do</h3>
        <div class="sov-kv"><span>To Buy</span><b>${lineList(m.toBuyLines, 'toBuy')}</b></div>
        <div class="sov-kv"><span>To Deliver</span><b class="${m.pendingDelivery.length ? 'sov-blue' : ''}">${lineList(m.pendingDelivery, 'toDeliver', true, m.toDeliverValue)}</b></div>
        <div class="sov-kv"><span>To Invoice</span><b class="${m.pendingInvoice.length ? 'sov-orange' : ''}">${lineList(m.pendingInvoice, 'toInvoice', true, m.toInvoiceValue)}</b></div></section>
    </div>`;
}

function sovPurchasing(m){
  const lib = window.BizCorePI;
  if (!lib) return '<div class="sov-empty">Purchasing is not available.</div>';
  const est = sovEstimate(m.so);
  const C = lib.core;
  const piRows = m.purch.piLines.slice().sort((a, b) => String(b.pi.date || '').localeCompare(String(a.pi.date || ''))).map(x => {
    const st = C && C.payStatusOf ? C.payStatusOf(x.pi) : '';
    return `<tr><td data-label="Purchase Invoice"><button type="button" class="sov-ref" data-open="pi" data-id="${sovEsc(x.pi.id)}">${sovEsc(x.pi.piNo)}</button></td><td data-label="Date">${fmtDate(x.pi.date)}</td><td data-label="Supplier">${sovEsc(x.supplier)}</td><td data-label="Item">${sovEsc(x.line.desc || '—')}</td><td data-label="Qty">${sovQU(x.qty, x.line.uom)}</td><td data-label="Landed Unit Cost">${sovMoney(x.unit)}</td><td data-label="Amount">${sovMoney(x.unit * x.qty)}</td><td data-label="Payment">${st ? sovPill(st === 'Part paid' ? 'Part Paid' : st, st === 'Paid' ? 'green' : st === 'Part paid' ? 'amber' : 'neutral') : ''}</td></tr>`;
  }).join('');
  const saRows = m.purch.allocs.map(a => { const l = m.lines.find(x => x.lineId === a.soLineId) || { desc: '', uom: '' };
    return `<tr><td data-label="Date">${fmtDate(a.date)}</td><td data-label="Item">${sovEsc(l.desc)}</td><td data-label="Qty">${sovQU(a.qty, l.uom)}</td><td data-label="Average Cost">${sovMoney(a.unitCost)}</td><td data-label="Value">${sovMoney(sovN(a.unitCost) * sovN(a.qty))}</td><td data-label="Note">${sovEsc(a.note || '—')}</td></tr>`; }).join('');
  const lineRows = m.lines.map(l => { const e = sovEstimateLine(est, m.so, l.it);
    return `<tr><td data-label="#">${l.no}</td><td data-label="Item">${sovEsc(l.desc)}</td><td data-label="Ordered">${sovQU(l.qty, l.uom)}</td><td data-label="Bought">${sovQ(l.boughtPI, l.uom)}</td><td data-label="From Stock">${sovQ(l.fromStock, l.uom)}</td><td data-label="Still To Buy">${l.toBuy > SOV_EPS ? `<b class="sov-amber">${sovQ(l.toBuy, l.uom)}</b>` : '<span class="sov-zero">0</span>'}</td><td data-label="Estimate">${e ? `${sovEsc(e.supplier || '—')} · ${sovMoney(e.buy)}` : '<span class="sov-muted">No Estimate</span>'}</td></tr>`; }).join('');
  const missing = Object.values(m.purch.byLine).some(x => x.missing);
  return `<section class="sov-box"><h3>Still To Buy</h3><div class="sov-tablewrap"><table class="sov-table sov-cardable"><thead><tr><th>#</th><th>Item</th><th>Ordered</th><th>Bought</th><th>From Stock</th><th>Still To Buy</th><th>Estimate · Supplier / Unit</th></tr></thead><tbody>${lineRows}</tbody></table></div></section>
    <section class="sov-box"><h3>Purchase Invoices For This Order</h3>${piRows ? `<div class="sov-tablewrap"><table class="sov-table sov-cardable"><thead><tr><th>Purchase Invoice</th><th>Date</th><th>Supplier</th><th>Item</th><th>Qty</th><th>Landed Unit Cost</th><th>Amount</th><th>Payment</th></tr></thead><tbody>${piRows}</tbody></table></div>` : '<div class="sov-empty">Nothing bought for this order yet.</div>'}</section>
    <section class="sov-box"><h3>Allocated From Stock</h3>${saRows ? `<div class="sov-tablewrap"><table class="sov-table sov-cardable"><thead><tr><th>Date</th><th>Item</th><th>Qty</th><th>Average Cost</th><th>Value</th><th>Note</th></tr></thead><tbody>${saRows}</tbody></table></div>` : '<div class="sov-empty">No stock allocated to this order.</div>'}</section>
    ${missing ? '<div class="sov-hint"><i class="ti ti-loader-2"></i> Reading older purchase records for this order…</div>' : ''}`;
}

const sovTypeLabel = t => (t === 'advance' ? 'Advance' : t === 'order' ? 'Billed Ahead' : 'Delivery');
/** Billing before VAT (as the old order view): goods, advances, deductions, net billed, still to bill. */
function sovBillingBox(m){
  if (!sovIndependent() || typeof invoicesForSO !== 'function') return '';
  const so = m.so, invs = invoicesForSO(so.id), cns = typeof creditNotesForSO === 'function' ? creditNotesForSO(so.id) : [];
  let goods = 0, advances = 0, deducted = 0;
  invs.forEach(i => { const t = i.totals || {}; if (i.type === 'advance') advances += sovN(t.subtotal); else { goods += sovN(t.goodsSubtotal); deducted += sovN(t.deductionSubtotal); } });
  cns.forEach(c => { goods -= sovN(c.goodsSubtotal); advances -= sovN(c.advanceSubtotal); deducted -= (c.deductionReversal || []).reduce((x, d) => x + sovN(d.subtotal), 0); });
  const orderValue = sovR2(m.lines.reduce((x, l) => x + l.qty * l.up, 0)), net = sovR2(goods + advances - deducted);
  if (!invs.length) return '';
  const kv = (k, v, strong) => `<div class="sov-kv"><span>${k}</span><b${strong ? ' class="sov-accent"' : ''}>${sovSAR(v)}</b></div>`;
  return `<section class="sov-box"><h3>Billing (Ex-VAT)</h3>${kv('Order Value (Ex-VAT)', orderValue)}${kv('Goods Invoiced', goods)}${advances > 0.005 || deducted > 0.005 ? kv('Advances', advances) + kv('Advance Deducted', deducted) + kv('Advance Remaining', advances - deducted) : ''}${kv('Net Billed (Ex-VAT)', net, true)}${kv('Still To Bill', orderValue - net)}</section>`;
}
function sovFinance(m){
  const invRows = m.invs.map(x => { const inv = x.inv, credited = sovR2(sovN(inv.total) - x.pay.net);
    return `<tr><td data-label="Invoice"><button type="button" class="sov-ref" data-open="inv" data-idx="${x.idx}">${sovEsc(inv.invNo)}</button></td><td data-label="Date">${fmtDate(inv.date)}</td><td data-label="Type">${sovTypeLabel(inv.type)}</td><td data-label="Amount">${sovMoney(inv.total)}</td><td data-label="Credited">${credited > 0.005 ? '−' + sovMoney(credited) : '—'}</td><td data-label="Received">${sovMoney(x.pay.paid)}</td><td data-label="Balance">${x.pay.balance > 0.005 ? `<b class="sov-red">${sovMoney(x.pay.balance)}</b>` : sovMoney(Math.max(0, x.pay.balance))}</td><td data-label="Due">${x.pay.dueDate ? fmtDate(x.pay.dueDate) : '—'}</td><td data-label="Status">${sovPayPill(x.pay.status)}</td></tr>`; }).join('');
  const cnRows = m.cns.map(c => `<tr><td data-label="Credit Note"><button type="button" class="sov-ref" data-open="cn" data-id="${sovEsc(c.id)}">${sovEsc(c.cnNo)}</button></td><td data-label="Date">${fmtDate(c.date)}</td><td data-label="Invoice">${sovEsc(c.invNo || '—')}</td><td data-label="Amount">−${sovMoney(c.total)}</td><td data-label="Reason">${sovEsc(c.reason || '—')}</td></tr>`).join('');
  const rRows = m.rcts.map(r => `<tr class="${r.voided ? 'sov-voided' : ''}"><td data-label="Receipt">${r.id ? `<button type="button" class="sov-ref" data-open="rct" data-id="${sovEsc(r.id)}">${sovEsc(r.no)}</button>` : sovEsc(r.no)}</td><td data-label="Date">${fmtDate(r.date)}</td><td data-label="Method">${sovEsc(r.method || '—')}</td><td data-label="Amount">${sovMoney(r.amount)}</td><td data-label="Invoices">${sovEsc(r.invNos.join(', ') || '—')}</td><td data-label="Status">${r.voided ? sovPill('Voided', 'neutral') : sovPill('Received', 'green')}</td></tr>`).join('');
  const notInvoiced = Math.max(0, sovR2(m.total - m.billed));
  const fig = (t, v, cls, s) => `<div class="sov-mini"><span>${t}</span><b class="${cls || ''}">${v}</b>${s ? `<small>${s}</small>` : ''}</div>`;
  return `<div class="sov-minis">${fig('Order Total', sovSAR(m.total))}${fig('Invoiced (Net)', sovSAR(m.billed), '', `${Math.round(m.invoicedPct)}% Of The Order`)}${fig('Received', sovSAR(m.received), m.received > 0.005 ? 'sov-done' : '')}${fig('Outstanding', sovSAR(m.outstanding), m.outstanding > 0.005 ? 'sov-red' : '', m.overdueDays > 0 ? `Overdue ${sovPlural(m.overdueDays, 'Day')}` : (m.nextDue && m.outstanding > 0.005 ? `Next Due ${fmtDate(m.nextDue)}` : ''))}${fig('Not Yet Invoiced', sovSAR(notInvoiced), notInvoiced > 0.005 ? 'sov-orange' : '')}</div>
    <section class="sov-box"><h3>Invoices</h3>${invRows ? `<div class="sov-tablewrap"><table class="sov-table sov-cardable"><thead><tr><th>Invoice</th><th>Date</th><th>Type</th><th>Amount</th><th>Credited</th><th>Received</th><th>Balance</th><th>Due</th><th>Status</th></tr></thead><tbody>${invRows}</tbody></table></div>` : '<div class="sov-empty">No invoice created yet.</div>'}</section>
    ${sovBillingBox(m)}
    ${cnRows ? `<section class="sov-box"><h3>Credit Notes</h3><div class="sov-tablewrap"><table class="sov-table sov-cardable"><thead><tr><th>Credit Note</th><th>Date</th><th>Invoice</th><th>Amount</th><th>Reason</th></tr></thead><tbody>${cnRows}</tbody></table></div></section>` : ''}
    <section class="sov-box"><h3>Receipts</h3>${rRows ? `<div class="sov-tablewrap"><table class="sov-table sov-cardable"><thead><tr><th>Receipt</th><th>Date</th><th>Method</th><th>Amount</th><th>Invoices</th><th>Status</th></tr></thead><tbody>${rRows}</tbody></table></div>` : `<div class="sov-empty">${sovReceiptsOn() ? 'No receipts yet. Use + New Receipt to record money received against this order\'s invoices.' : 'No payments recorded yet.'}</div>`}</section>`;
}

/* ───────────────────────── profit ───────────────────────── */
function sovProfitModel(m){
  const est = sovEstimate(m.so);
  const rows = m.lines.map(l => {
    const e = sovEstimateLine(est, m.so, l.it), lp = e ? null : sovLastPaid(l.it);
    const estUnit = e ? e.unit : (lp ? sovN(lp.unitCost) : 0);
    const P = l.P || { pis: [], sas: [] };
    const piCost = (P.pis || []).reduce((s, x) => s + x.unit * x.qty, 0), piQty = (P.pis || []).reduce((s, x) => s + x.qty, 0);
    const saCost = (P.sas || []).reduce((s, a) => s + sovN(a.unitCost) * sovN(a.qty), 0), saQty = (P.sas || []).reduce((s, a) => s + sovN(a.qty), 0);
    const knownQty = Math.min(l.qty, piQty + saQty), restQty = Math.max(0, l.qty - knownQty);
    const finalCost = piCost + saCost, restCost = restQty * estUnit;
    const cost = sovR2(finalCost + restCost), estCost = sovR2((e ? e.unit : estUnit) * l.qty);
    const selling = sovR2(l.amount), profit = sovR2(selling - cost);
    // V269.7.1: part of the line has no cost at all (not bought, no estimate, no last price) → no profit is shown for it
    const incomplete = restQty > SOV_EPS && !(estUnit > 0);
    const source = incomplete ? [knownQty > SOV_EPS ? 'Part Cost' : 'No Cost', 'neutral'] : restQty <= SOV_EPS ? ['Final', 'green'] : knownQty > SOV_EPS ? ['Part Est.', 'amber'] : [e ? 'Estimate' : 'Last Paid', 'neutral'];
    const suppliers = [...new Set((P.pis || []).map(x => x.supplier).filter(Boolean))];
    const parts = [];
    if (P.pis && P.pis.length) {
      const byPi = new Map(); P.pis.forEach(x => byPi.set(x.pi.piNo, (byPi.get(x.pi.piNo) || 0) + x.qty));
      if (byPi.size === 1 && piQty >= l.qty - SOV_EPS) parts.push(`${sovEsc([...byPi.keys()][0])} · ${sovEsc(suppliers[0] || '')} (Landed)`);
      else parts.push([...byPi].map(([no, qq]) => `${sovQ(qq, l.uom)} × ${sovEsc(no)}`).join(' · '));
    }
    if (saQty > SOV_EPS) parts.push(`${sovQ(saQty, l.uom)} × Stock (Avg ${sovMoney(saCost / saQty)})`);
    if (restQty > SOV_EPS) parts.push(knownQty > SOV_EPS ? `${sovQ(restQty, l.uom)} Still To Buy (Est. ${sovMoney(estUnit)})` : (e ? `Not Bought Yet — Pricing Estimate${e.supplier ? ` (${sovEsc(e.supplier)} ${sovMoney(e.buy)})` : ''}` : lp ? `Not Bought Yet — Last Paid ${sovMoney(lp.unitCost)}` : 'Not Bought Yet — No Estimate'));
    const actualUnit = knownQty > SOV_EPS ? finalCost / knownQty : null;
    const supplierChanged = e && e.supplier && suppliers.length && !suppliers.some(s => s.trim().toLowerCase() === e.supplier.trim().toLowerCase());
    return { l, e, lp, estUnit, estCost, cost, incomplete, finalCost: sovR2(finalCost), restCost: sovR2(restCost), knownQty, restQty, piQty, saQty, saCost, selling, profit, source, src: parts.join(' · '), actualUnit, suppliers, supplierChanged };
  });
  // totals only over lines with a cost; lines without one are left out (and counted)
  const counted = rows.filter(r => !r.incomplete);
  const sum = k => sovR2(counted.reduce((s, r) => s + r[k], 0));
  const t = { selling: sum('selling'), cost: sum('cost'), estCost: sum('estCost'), finalCost: sum('finalCost'), restCost: sum('restCost') };
  t.profit = sovR2(t.selling - t.cost); t.estProfit = sovR2(t.selling - t.estCost);
  t.revenueAll = sovR2(rows.reduce((s, r) => s + r.selling, 0)); t.excluded = rows.length - counted.length; t.counted = counted.length;
  return { est, rows, t, hasEstimate: rows.some(r => r.e) };
}
const sovMarkup = (p, c) => (c > 0.005 ? p / c * 100 : NaN);
const sovMargin = (p, s) => (s > 0.005 ? p / s * 100 : NaN);
function sovProfit(m, view){
  const ps = sovPricingSettings(), method = ps.marginMethod === 'margin' ? 'margin' : 'markup';
  const P = sovProfitModel(m), t = P.t;
  const main = (p, c, s) => method === 'markup' ? sovMarkup(p, c) : sovMargin(p, s);
  const other = (p, c, s) => method === 'markup' ? sovMargin(p, s) : sovMarkup(p, c);
  const mainName = method === 'markup' ? 'Markup' : 'Margin', otherName = method === 'markup' ? 'Margin' : 'Markup';
  const target = sovN(ps.targetMargin), min = sovN(ps.minMargin);
  const mainPct = main(t.profit, t.cost, t.selling);
  const targetPill = !Number.isFinite(mainPct) ? '' : mainPct >= target - 1e-9 ? sovPill('On Target', 'green') : (ps.warnLow !== false && mainPct < min) ? sovPill('Below Minimum', 'red') : sovPill('Below Target', 'amber');
  const pctCell = (p, c, s) => `<b class="${p < 0 ? 'sov-red' : 'sov-done'}">${sovPct(main(p, c, s))}</b><small>${otherName} ${sovPct(other(p, c, s))}</small>`;
  const est = P.est;
  const switcher = `<div class="sov-seg" role="tablist"><button type="button" role="tab" data-pview="summary" aria-selected="${view !== 'eva'}" class="${view !== 'eva' ? 'on' : ''}">Summary</button><button type="button" role="tab" data-pview="eva" aria-selected="${view === 'eva'}" class="${view === 'eva' ? 'on' : ''}">Estimate vs Actual</button></div>`;
  const estText = est.status === 'ok' ? `Estimate = Pricing <b>${sovEsc(est.r.rfqNo || '')} V${est.n}</b> (converted to ${sovEsc(est.q.qno)}${est.q.date ? ' on ' + sovDayMonth(est.q.date) : ''} — fixed)` : est.status === 'loading' ? 'Reading the pricing version…' : 'No pricing estimate is linked to this order (direct order or older data) — the last price paid is used where known.';
  if (view !== 'eva') {
    const rows = P.rows.map(r => `<tr><td data-label="#">${r.l.no}</td><td data-label="Item" class="sov-item-name"><b>${sovEsc(r.l.desc)}</b><small>${r.src || '—'}</small></td><td data-label="Qty">${sovQ(r.l.qty, r.l.uom)}</td><td data-label="Selling">${sovMoney(r.selling)}</td><td data-label="Cost">${r.incomplete ? '—' : sovMoney(r.cost)}</td><td data-label="Profit">${r.incomplete ? '—' : `<b class="${r.profit < 0 ? 'sov-red' : 'sov-done'}">${sovMoney(r.profit)}</b>`}</td><td data-label="${mainName} %" class="sov-pct">${r.incomplete ? '—' : pctCell(r.profit, r.cost, r.selling)}</td><td data-label="Cost">${sovPill(r.source[0], r.source[1])}</td></tr>`).join('');
    const none = t.counted === 0, exNote = t.excluded ? `${sovPlural(t.excluded, 'Line')} Without A Cost Left Out` : '';
    const atPricing = P.hasEstimate ? `At Pricing: ${sovSAR(t.estProfit)} (${t.profit - t.estProfit >= 0 ? '+' : '−'}${sovMoney(Math.abs(t.profit - t.estProfit))})` : 'No Pricing Estimate';
    return `<div class="sov-ptop">${switcher}<span class="sov-ptext">% Method Follows Administration → Pricing Settings: <b>${mainName}</b></span></div>
      <div class="sov-minis sov-minis4">
        <div class="sov-mini"><span>Revenue (Ex-VAT)</span><b>${sovSAR(t.revenueAll)}</b><small>${sovPlural(m.lines.length, 'Order Line')}${t.excluded && !none ? ` · Profit On ${sovSAR(t.selling)}` : ''}</small></div>
        <div class="sov-mini"><span>Cost</span>${none ? '<b class="sov-na">—</b><small>No Line Has A Cost Yet</small>' : `<b>${sovSAR(t.cost)}</b><small>${sovMoney(t.finalCost)} Final · ${sovMoney(t.restCost)} Still Estimated${exNote ? ' · ' + exNote : ''}</small>`}</div>
        <div class="sov-mini"><span>Gross Profit</span>${none ? '<b class="sov-na">Not Available Yet</b><small>Buy the items or price them to see the profit</small>' : `<b class="${t.profit < 0 ? 'sov-red' : 'sov-done'}">${sovSAR(t.profit)}</b><small>${atPricing}</small>`}</div>
        <div class="sov-mini"><span>${mainName}</span>${none ? `<b class="sov-na">—</b><small>Target ${formatNumber(target, 0)}%</small>` : `<b class="${t.profit < 0 ? 'sov-red' : 'sov-done'}">${sovPct(mainPct)}</b><small>${otherName} ${sovPct(other(t.profit, t.cost, t.selling))} · Target ${formatNumber(target, 0)}% ${targetPill}</small>`}</div>
      </div>
      <div class="sov-tablewrap"><table class="sov-table sov-cardable sov-profit-table"><thead><tr><th>#</th><th>Item · Cost Source</th><th>Qty</th><th>Selling</th><th>Cost</th><th>Profit</th><th>${mainName} %</th><th></th></tr></thead><tbody>${rows}
        <tr class="sov-total-row"><td></td><td><b>Total</b>${exNote ? `<small>Excl. ${exNote.replace(' Left Out', '')}</small>` : ''}</td><td></td><td>${none ? '—' : sovMoney(t.selling)}</td><td>${none ? '—' : sovMoney(t.cost)}</td><td>${none ? '—' : `<b class="${t.profit < 0 ? 'sov-red' : 'sov-done'}">${sovMoney(t.profit)}</b>`}</td><td class="sov-pct">${none ? '—' : pctCell(t.profit, t.cost, t.selling)}</td><td></td></tr></tbody></table></div>
      <div class="sov-two">
        <section class="sov-box"><h3>Markup Or Margin?</h3><div class="sov-kv"><span>Markup = Profit ÷ Cost</span><b>${sovMoney(t.profit)} ÷ ${sovMoney(t.cost)} = ${sovPct(sovMarkup(t.profit, t.cost))}</b></div><div class="sov-kv"><span>Margin = Profit ÷ Selling</span><b>${sovMoney(t.profit)} ÷ ${sovMoney(t.selling)} = ${sovPct(sovMargin(t.profit, t.selling))}</b></div><div class="sov-small">The main % follows the Pricing Settings method; the other is shown small — like the Pricing screen.</div></section>
        <section class="sov-box"><h3>Who Sees This Tab</h3><div class="sov-kv"><span>Setting</span><b>Purchase Settings → Profit Visibility</b></div><div class="sov-kv"><span>Now</span><b>${window.BizCorePI && window.BizCorePI.settings.profitVisibility === 'everyone' ? 'Everyone' : 'Administrators'}</b></div><div class="sov-small">Later: role permission "Can see cost &amp; profit" (Users &amp; Roles).</div></section>
      </div>`;
  }
  const flag = sovFlagPct();
  const estPct = main(t.estProfit, t.estCost, t.selling), estOther = other(t.estProfit, t.estCost, t.selling);
  const actPct = main(t.profit, t.cost, t.selling), actOther = other(t.profit, t.cost, t.selling);
  const dCost = sovR2(t.cost - t.estCost), dProfit = sovR2(t.profit - t.estProfit);
  const sign = v => (v > 0.005 ? '+' : v < -0.005 ? '−' : '±');
  const rows = P.rows.map(r => {
    const l = r.l, e = r.e;
    const variance = e ? sovR2(r.cost - r.estCost) : null, varPct = e && r.estCost > 0.005 ? variance / r.estCost * 100 : null;
    const open = r.knownQty <= SOV_EPS;
    let note;
    if (!e) note = sovPill('No Estimate', 'neutral');
    else if (open) note = sovPill('Open', 'neutral');
    else if (varPct > flag + 1e-9) note = sovPill('⚠ Over ' + formatNumber(flag, 0) + '%', 'red');
    else if (variance > 0.005) note = sovPill('Higher', 'amber');
    else if (variance < -0.005) note = sovPill('Better', 'green');
    else note = sovPill('As Estimated', 'neutral');
    if (r.supplierChanged) note += ' ' + sovPill('Supplier Changed', 'purple');
    // the purchase-invoice part first (supplier · landed unit × qty), then stock and what is still to buy — never blended
    const piCost = r.finalCost - r.saCost, piUnit = r.piQty > SOV_EPS ? piCost / r.piQty : 0;
    const mainTxt = r.piQty > SOV_EPS ? `${sovEsc(r.suppliers.join(', '))} · ${sovMoney(piUnit)}${r.piQty < l.qty - SOV_EPS ? ` × ${sovQ(r.piQty, l.uom)}` : ''}` : `Stock · ${sovMoney(r.saCost / r.saQty)} × ${sovQ(r.saQty, l.uom)}`;
    const subTxt = [r.piQty > SOV_EPS ? 'Landed' + (r.l.P.pis.some(x => sovN(x.line.costShare) > 0.005) ? ' (Delivery Charge Shared)' : '') : '', r.piQty > SOV_EPS && r.saQty > SOV_EPS ? `Stock ${sovMoney(r.saCost / r.saQty)} × ${sovQ(r.saQty, l.uom)}` : '', r.restQty > SOV_EPS ? `${sovQ(r.restQty, l.uom)} To Buy (Est. ${sovMoney(r.estUnit)})` : ''].filter(Boolean).join(' · ');
    const actualTxt = open ? '<span class="sov-muted">Not Bought Yet</span>' : `<b>${mainTxt}</b><small>${subTxt}</small>`;
    const vCls = variance > 0.005 ? 'sov-red' : variance < -0.005 ? 'sov-done' : '';
    return `<tr${varPct > flag + 1e-9 && !open ? ' class="sov-flagged"' : ''}><td data-label="#">${l.no}</td><td data-label="Item" class="sov-item-name"><span class="sov-item-text">${sovEsc(l.desc)}</span></td><td data-label="Qty">${sovQ(l.qty, l.uom)}</td>
      <td data-label="Estimate · Supplier / Unit" class="sov-left">${e ? `<b>${sovEsc(e.supplier || '—')} · ${sovMoney(e.unit)}</b>${est.factor > 0.00005 ? `<small>Buy ${sovMoney(e.buy)} + Costs Share</small>` : ''}` : '<span class="sov-muted">—</span>'}</td>
      <td data-label="Actual · Supplier / Unit" class="sov-left">${actualTxt}</td>
      <td data-label="Est. Cost">${e ? sovMoney(r.estCost) : '—'}</td><td data-label="Actual Cost">${r.incomplete ? '—' : sovMoney(r.cost)}</td>
      <td data-label="Variance" class="${vCls}">${e && !open ? sign(variance) + sovMoney(Math.abs(variance)) : '—'}</td><td data-label="Var %" class="${vCls}">${e && !open && varPct != null ? sign(variance) + sovPct(Math.abs(varPct)) : '—'}</td><td data-label="Note">${note}</td></tr>`;
  }).join('');
  const dPctAll = t.estCost > 0.005 ? dCost / t.estCost * 100 : 0;
  return `<div class="sov-ptop">${switcher}<span class="sov-ptext">${estText}</span></div>
    <div class="sov-minis sov-minis3">
      <div class="sov-mini"><span>Cost</span><b>${sovSAR(t.estCost)} → ${sovMoney(t.cost)}</b><small class="${dCost > 0.005 ? 'sov-red' : 'sov-done'}">${sign(dCost)}${sovMoney(Math.abs(dCost))} (${sign(dCost)}${sovPct(Math.abs(dPctAll))}) · ${dCost > 0.005 ? 'Higher Than Estimated' : dCost < -0.005 ? 'Lower Than Estimated' : 'As Estimated'}</small></div>
      <div class="sov-mini"><span>Gross Profit</span><b>${sovSAR(t.estProfit)} → <span class="${t.profit < 0 ? 'sov-red' : 'sov-done'}">${sovMoney(t.profit)}</span></b><small class="${dProfit < -0.005 ? 'sov-red' : 'sov-done'}">${sign(dProfit)}${sovMoney(Math.abs(dProfit))} ${dProfit >= -0.005 ? 'Better' : 'Worse'} Than Estimated</small></div>
      <div class="sov-mini"><span>${mainName} (${otherName})</span><b>${sovPct(estPct)} (${sovPct(estOther)}) → <span class="sov-done">${sovPct(actPct)} (${sovPct(actOther)})</span></b><small>${sovMoney(t.restCost)} Of The Cost Is Still An Estimate${t.excluded ? ` · ${sovPlural(t.excluded, 'Line')} Without A Cost Left Out` : ''}</small></div>
    </div>
    <div class="sov-tablewrap"><table class="sov-table sov-cardable sov-eva-table"><thead><tr><th>#</th><th>Item</th><th>Qty</th><th class="sov-left">Estimate · Supplier / Unit</th><th class="sov-left">Actual · Supplier / Unit</th><th>Est. Cost</th><th>Actual Cost</th><th>Variance</th><th>Var %</th><th>Note</th></tr></thead><tbody>${rows}
      <tr class="sov-total-row"><td></td><td><b>Total</b></td><td></td><td></td><td></td><td>${sovMoney(t.estCost)}</td><td>${sovMoney(t.cost)}</td><td class="${dCost > 0.005 ? 'sov-red' : 'sov-done'}">${sign(dCost)}${sovMoney(Math.abs(dCost))}</td><td class="${dCost > 0.005 ? 'sov-red' : 'sov-done'}">${sign(dCost)}${sovPct(Math.abs(dPctAll))}</td><td></td></tr></tbody></table></div>
    <div class="sov-two">
      <section class="sov-box"><h3>How It Is Worked Out</h3><div class="sov-kv"><span>Estimate</span><b>The pricing version the quotation came from${est.status === 'ok' && est.factor > 0.00005 ? ' (buy price + its share of the additional costs)' : ''}</b></div><div class="sov-kv"><span>Actual</span><b>Purchase invoices (landed) + stock average cost</b></div><div class="sov-kv"><span>Not Bought Yet</span><b>Counted at the estimate until bought</b></div></section>
      <section class="sov-box"><h3>Flags</h3><div class="sov-kv"><span>Higher Than Estimate By More Than</span><b>${formatNumber(flag, 0)}% ${sovPill('Administration', 'neutral')}</b></div><div class="sov-kv"><span>Supplier Changed</span><b>Shown in the note</b></div><div class="sov-small">Later: a report of all orders — "cost over the estimate", by supplier / salesperson.</div></section>
    </div>`;
}

/* ───────────────────────── activity ───────────────────────── */
function sovActivity(m){
  const so = m.so, ev = [];
  const add = (at, text, by, tone) => { const iso = sovIso(at); if (iso) ev.push({ at: iso, text, by: by || '', tone: tone || 'blue' }); };
  add(so.created || so.date, `Order ${sovEsc(so.soNo)} created${so.poNo ? ' for PO ' + sovEsc(so.poNo) : ''}`, so.createdBy, 'blue');
  if (so._savedAt && so.created && Math.abs(new Date(so._savedAt) - new Date(so.created)) > 120000) add(so._savedAt, 'Order saved (last change)', so._savedBy, 'neutral');
  const piSeen = new Set();
  m.purch.piLines.forEach(x => { if (piSeen.has(x.pi.id)) return; piSeen.add(x.pi.id); const rows = m.purch.piLines.filter(y => y.pi.id === x.pi.id);
    add(sovIso(x.pi.created) || x.pi.date, `Bought ${rows.map(y => `${sovEsc(y.line.desc)} ${sovQU(y.qty, y.line.uom)}`).join(', ')} · ${sovEsc(x.pi.piNo)} · ${sovEsc(x.supplier)}`, x.pi.createdBy || x.pi.updatedBy, 'purple'); });
  m.purch.allocs.forEach(a => { const l = m.lines.find(x => x.lineId === a.soLineId) || { desc: '', uom: '' }; add(sovIso(a.created) || a.date, `Allocated from stock: ${sovEsc(l.desc)} ${sovQU(a.qty, l.uom)}`, a.createdBy, 'purple'); });
  m.dns.forEach(x => { const d = x.d;
    add(sovIso(d.created) || d.date, `${sovEsc(d.dnNo)} dispatched${d.deliveredBy ? ' · Delivered By ' + sovEsc(d.deliveredBy) : ''}`, d.createdBy, 'amber');
    if (d.customerConfirmed && !d.voided) add(sovIso(d.customerConfirmedAt) || d.customerConfirmedDate, `${sovEsc(d.dnNo)} ${x.status === 'Delivered' ? 'accepted' : x.status === 'Rejected' ? 'rejected' : 'partly accepted'}${d.receivedBy ? ' · Received By ' + sovEsc(d.receivedBy) : ''}`, d.confirmedBy, x.status === 'Delivered' ? 'green' : 'purple');
    if (d.voided) add(sovIso(d.voidedAt) || d.date, `${sovEsc(d.dnNo)} voided${d.voidReason ? ' · ' + sovEsc(d.voidReason) : ''}`, d.voidedBy, 'neutral'); });
  m.invs.forEach(x => add(sovIso(x.inv.created) || x.inv.date, `${sovEsc(x.inv.invNo)} issued · ${sovSAR(x.inv.total)}`, x.inv.createdBy, 'amber'));
  m.cns.forEach(c => add(sovIso(c.created) || c.date, `${sovEsc(c.cnNo)} credit note · −${sovSAR(c.total)}${c.reason ? ' · ' + sovEsc(c.reason) : ''}`, c.createdBy, 'red'));
  m.rcts.forEach(r => add(sovIso(r.r && r.r.created) || r.date, `${sovEsc(r.no)} ${r.voided ? 'voided' : 'received'} · ${sovSAR(r.amount)}${r.method ? ' · ' + sovEsc(r.method) : ''}`, r.r && r.r.createdBy, r.voided ? 'neutral' : 'green'));
  ev.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  if (!ev.length) return '<div class="sov-empty">No activity yet.</div>';
  return `<section class="sov-box"><h3>Activity</h3><div class="sov-acts">${ev.map(e => `<div class="sov-act"><i class="sov-dot t-${e.tone}"></i><div><div>${e.text}</div><small>${fmtDate(e.at)}${e.by ? ' · ' + sovEsc(e.by) : ''}</small></div></div>`).join('')}</div><div class="sov-small">Built from the order and its linked documents.</div></section>`;
}

/* ═══════════════════════════════ MAIN ═══════════════════════════════ */
const SOV_TABS = [['overview', 'Overview'], ['items', 'Items'], ['purchasing', 'Purchasing'], ['finance', 'Finance'], ['profit', 'Profit'], ['activity', 'Activity']];
function sovModal(){ return document.getElementById('so-view-modal'); }

function sovRender(soId, opts = {}){
  const so = (typeof salesOrders !== 'undefined' ? salesOrders : []).find(x => x.id === soId); if (!so) return;
  const modal = sovModal(); if (!modal) return;
  if (typeof currentSOId !== 'undefined') currentSOId = soId;
  const same = modal._soId === soId;
  modal._soId = soId;
  if (!opts.refreshOnly && !same) { modal._sovTab = 'overview'; modal._sovPView = 'summary'; modal._sovOpenLines = new Set(); }
  if (!opts.refreshOnly && same && !modal.classList.contains('open')) { modal._sovTab = 'overview'; modal._sovOpenLines = new Set(); }
  if (!modal._sovOpenLines) modal._sovOpenLines = new Set();
  const canProfit = sovCanSeeProfit();
  if (modal._sovTab === 'profit' && !canProfit) modal._sovTab = 'overview';
  const tab = modal._sovTab || 'overview';
  if (window.BizCorePI && !modal._sovPiHooked) { modal._sovPiHooked = true; try { window.BizCorePI.start(); window.BizCorePI.onChange(() => { const mm = sovModal(); if (mm && mm.classList.contains('open') && typeof refreshOpenSalesOrderView === 'function') refreshOpenSalesOrderView(); }); } catch (e) {} }
  modal.classList.add('sov-on');

  const m = sovModel(so);
  modal._sovModel = m;
  const q = sovQuotation(so), acts = sovActions(so, m);

  // header
  const title = document.getElementById('so-view-title');
  const sub = [so.poNo ? 'PO ' + sovEsc(so.poNo) : '', so.date ? 'SO Date ' + fmtDate(so.date) : '', q ? sovEsc(q.qno) : '', 'Salesperson: ' + sovEsc(so.createdBy || '—')].filter(Boolean).join(' · ');
  if (title) title.innerHTML = `<span class="sov-title-main">${sovEsc(so.soNo)}<span class="sov-desk"> — ${sovEsc(so.customer || '')}</span></span><span class="sov-title-sub sov-desk">${sub}</span><span class="sov-title-sub sov-mob">${sovEsc(so.customer || '')}${so.poNo ? ' · PO ' + sovEsc(so.poNo) : ''}</span>`;
  sovEnsureHeadActions(modal, acts);

  // the old pipeline bar is not used by this view
  const bar = document.getElementById('so-pipeline-bar'); if (bar) { bar.innerHTML = ''; bar.hidden = true; }

  const tabs = SOV_TABS.filter(([k]) => k !== 'profit' || canProfit).map(([k, label]) => `<button type="button" role="tab" class="sov-tab${k === tab ? ' on' : ''}" data-tab="${k}" aria-selected="${k === tab}">${label}${k === 'profit' ? ' <span aria-label="restricted">🔒</span>' : ''}</button>`).join('');
  const panel = (k, html) => `<div class="sov-panel" role="tabpanel" data-panel="${k}"${k === tab ? '' : ' hidden'}>${html}</div>`;
  const body = document.getElementById('so-view-body');
  const safe = (fn, label) => { try { return fn(); } catch (e) { console.error('[BizCore] Sales Order view — ' + label, e); return `<div class="sov-empty">This part could not be shown (${sovEsc(e && e.message || 'error')}).</div>`; } };
  body.innerHTML = `<div class="sov-top">${sovCards(m)}${sovPhoneCards(m)}<div class="sov-tabs" role="tablist" aria-label="Sales Order sections">${tabs}</div></div>
    <div class="sov-panels">
      ${panel('overview', safe(() => sovOverview(m), 'overview'))}
      ${panel('items', safe(() => sovItems(m, modal._sovOpenLines), 'items'))}
      ${panel('purchasing', safe(() => sovPurchasing(m), 'purchasing'))}
      ${panel('finance', safe(() => sovFinance(m), 'finance'))}
      ${canProfit ? panel('profit', safe(() => sovProfit(m, modal._sovPView), 'profit')) : ''}
      ${panel('activity', safe(() => sovActivity(m), 'activity'))}
    </div>`;
  sovBuildRowCards(body);
  sovWireBody(body, so);

  // footer
  const f = document.getElementById('so-view-footer');
  const btn = a => `<button type="button" class="btn ${a.cls}${acts.next === a ? ' sov-next' : ''}" id="${a.id}" data-act="${a.key}"><i class="ti ${a.icon}"></i>${a.label}</button>`;
  f.classList.add('sov-footer');
  f.innerHTML = `<button type="button" class="btn btn-secondary sov-more-btn" data-act="m-more" aria-haspopup="dialog"><i class="ti ti-dots"></i>More</button>
    <button type="button" class="btn btn-secondary sov-print-btn" data-act="print"><i class="ti ti-printer"></i>Print</button>
    <button type="button" class="btn btn-secondary sov-close-btn" data-act="close">Close</button>${acts.list.map(btn).join('')}`;
  if (!acts.next) f.classList.add('sov-no-next'); else f.classList.remove('sov-no-next');
  f.onclick = e => {
    const b = e.target.closest('button[data-act]'); if (!b || b.disabled) return;
    const k = b.dataset.act;
    if (k === 'close') return closeViewWithReturn('so-view-modal');
    if (k === 'print') return sovPrint(so.id);
    if (k === 'm-more') return sovPopToggle(b, 'menu-mobile');
    const a = acts.list.find(x => x.key === k); if (a) { sovPopClose(); a.run(); }
  };

  // keep an open list in place after a refresh (data changed underneath)
  const st = modal._sovPop;
  if (st && st.key) {
    const anchor = modal.querySelector(`[data-sov-pop="${st.key}"]`) || (st.key.startsWith('menu') ? modal.querySelector(st.key === 'menu' ? '.sov-head-more' : '.sov-more-btn') : null);
    if (anchor && anchor.offsetParent !== null) sovPopShow(anchor, st.key, true); else sovPopClose();
  }
  // older purchase records for this order (only when a tab that needs them is shown)
  if (tab === 'purchasing' || tab === 'profit') sovLoadMissing(so, m);
  if (tab === 'profit') sovLoadEstimate(so);
  if (opts.refreshOnly) return;
  sovPopClose();
  openModalWithSize('so-view-modal');
  const sc = body; if (sc && !same) sc.scrollTop = 0;
}

/** V269.7.2: on a phone the tables are shown as cards built from plain blocks (Safari doesn't reliably turn table rows
 *  into cards: cells kept their table height and long names were cut off). Same content, from the same cells. */
const SOV_WIDE_LABELS = new Set(['Item', 'Supplier', 'Note', 'Invoices', 'Reason', 'Estimate · Supplier / Unit', 'Actual · Supplier / Unit']);
function sovBuildRowCards(root){
  root.querySelectorAll('table.sov-cardable').forEach(tbl => {
    const wrap = document.createElement('div'); wrap.className = 'sov-rcards';
    tbl.querySelectorAll('tbody > tr').forEach(tr => {
      const card = document.createElement('div');
      card.className = 'sov-rcard' + (tr.classList.contains('sov-total-row') ? ' sov-rcard-total' : '') + (tr.classList.contains('sov-voided') ? ' sov-voided' : '') + (tr.classList.contains('sov-flagged') ? ' sov-flagged' : '');
      let lineNo = '';
      card.innerHTML = [...tr.children].map(td => {
        const label = td.getAttribute('data-label') || '';
        let html = td.innerHTML.trim();
        if (label === '#') { lineNo = td.textContent.trim(); return ''; }   // shown before the item name
        if (label === 'Item' && lineNo) html = `<span class="sov-muted">${sovEsc(lineNo)} · </span>` + html;
        if (!html) return '';
        if (!label) return `<div class="sov-rc sov-rc-wide ${td.className || ''}">${html}</div>`;
        return `<div class="sov-rc${SOV_WIDE_LABELS.has(label) ? ' sov-rc-wide' : ''} ${td.className || ''}"><span class="sov-rc-l">${sovEsc(label)}</span><div class="sov-rc-v">${html}</div></div>`;
      }).join('');
      wrap.appendChild(card);
    });
    const host = tbl.closest('.sov-tablewrap') || tbl;
    host.after(wrap);
  });
}

/** Edit + More in the window header (PC / tablet). */
function sovEnsureHeadActions(modal, acts){
  const head = modal.querySelector('.modal-header'); if (!head) return;
  const close = head.querySelector('.close-btn'); if (!close) return;
  let box = head.querySelector('.sov-head-actions');
  if (!box) { box = document.createElement('div'); box.className = 'sov-head-actions'; close.parentNode.insertBefore(box, close); }
  box.innerHTML = `<button type="button" class="sov-head-btn sov-head-edit" ${acts.editable ? '' : 'aria-disabled="true"'} title="${acts.editable ? 'Edit this order' : sovEsc(SOV_EDIT_WHY)}"><i class="ti ti-pencil"></i>Edit</button>
    <button type="button" class="sov-head-btn sov-head-more" aria-haspopup="menu" aria-expanded="false"><i class="ti ti-dots"></i>More</button>`;
  box.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    const so = salesOrders.find(x => x.id === modal._soId); if (!so) return;
    if (b.classList.contains('sov-head-edit')) { if (b.getAttribute('aria-disabled') === 'true') { showToast(SOV_EDIT_WHY, 'info', 'Edit'); return; } sovPopClose(); openEditSO(so.id); return; }
    if (b.classList.contains('sov-head-more')) sovPopToggle(b, 'menu');
  };
}

/* ───────────────────────── interactions ───────────────────────── */
function sovSetTab(k){
  const modal = sovModal(); if (!modal) return;
  sovPopClose();
  modal._sovTab = k;
  modal.querySelectorAll('.sov-tab').forEach(t => { const on = t.dataset.tab === k; t.classList.toggle('on', on); t.setAttribute('aria-selected', String(on)); });
  modal.querySelectorAll('.sov-panel').forEach(p => { p.hidden = p.dataset.panel !== k; });
  const so = salesOrders.find(x => x.id === modal._soId);
  if (so && (k === 'purchasing' || k === 'profit')) sovLoadMissing(so, modal._sovModel || sovModel(so));
  if (so && k === 'profit') sovLoadEstimate(so);
  const tabEl = modal.querySelector(`.sov-tab[data-tab="${k}"]`); if (tabEl && tabEl.scrollIntoView) try { tabEl.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) {}
}
function sovOpenDoc(kind, el){
  const modal = sovModal(); const so = modal && salesOrders.find(x => x.id === modal._soId); if (!so) return;
  sovPopClose();
  const idx = Number(el.dataset.idx), id = el.dataset.id;
  if (kind === 'dn') return viewDeliveryNote(so.id, idx);
  if (kind === 'inv') return openInvoiceDocument(so.id, idx);
  if (kind === 'cn') return typeof openCreditNoteView === 'function' ? openCreditNoteView(id) : null;
  if (kind === 'rct') return typeof openReceiptView === 'function' ? openReceiptView(id) : null;
  if (kind === 'pi') { if (window.BizCorePI) window.BizCorePI.start(); return typeof openPurchaseInvoiceView === 'function' ? openPurchaseInvoiceView(id) : null; }
  if (kind === 'quote') return openQuotationDocument(id);
  if (kind === 'rfq') { const q = sovQuotation(so); const r = sovRfq(q); if (r && typeof openPricingDocument === 'function') { closeModal('so-view-modal'); return openPricingDocument(r.id, Number(q && q.pricingVersion || r.currentPricingVersion || 1)); } }
}
function sovWireBody(body, so){
  body.onclick = e => {
    const t = e.target;
    const tab = t.closest('.sov-tab'); if (tab) return sovSetTab(tab.dataset.tab);
    const pv = t.closest('[data-pview]'); if (pv) { const modal = sovModal(); modal._sovPView = pv.dataset.pview; return sovRender(modal._soId, { refreshOnly: true }); }
    const pop = t.closest('[data-sov-pop]'); if (pop) return sovPopToggle(pop, pop.dataset.sovPop);
    const open = t.closest('[data-open]'); if (open && !open.disabled) return sovOpenDoc(open.dataset.open, open);
    const act = t.closest('[data-act]');
    if (act) { if (act.dataset.act === 'po-view') return soViewPOAttachment(so.id); if (act.dataset.act === 'po-download') return soDownloadPOAttachment(so.id); }
    const row = t.closest('.sov-item-row, .sov-icard'); if (row) return sovToggleLine(Number(row.dataset.line));
  };
  body.onkeydown = e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('sov-item-row')) { e.preventDefault(); sovToggleLine(Number(e.target.dataset.line)); } };
  if (!body._sovScroll) { body._sovScroll = true; body.addEventListener('scroll', () => sovPopReposition(), { passive: true }); }
}
function sovToggleLine(i){
  const modal = sovModal(); if (!modal || !Number.isInteger(i)) return;
  const set = modal._sovOpenLines || (modal._sovOpenLines = new Set());
  if (set.has(i)) set.delete(i); else set.add(i);
  const on = set.has(i);
  modal.querySelectorAll(`.sov-item-row[data-line="${i}"]`).forEach(r => { r.classList.toggle('open', on); r.setAttribute('aria-expanded', String(on)); });
  modal.querySelectorAll(`.sov-item-docs[data-docs="${i}"]`).forEach(r => { r.hidden = !on; });
  modal.querySelectorAll(`.sov-icard[data-line="${i}"] .sov-icard-docs`).forEach(r => { r.hidden = !on; });
}

/* ───────────────────────── floating list / bottom sheet ───────────────────────── */
function sovPopEl(){
  const modal = sovModal(); if (!modal) return null;
  let p = modal.querySelector(':scope > .sov-pop');
  if (!p) {
    p = document.createElement('div'); p.className = 'sov-pop'; p.hidden = true; p.setAttribute('role', 'dialog');
    modal.appendChild(p);
    p.addEventListener('click', e => {
      const t = e.target;
      if (t.closest('.sov-sheet-dim') || t.closest('.sov-pop-close')) return sovPopClose();
      const open = t.closest('[data-open]'); if (open) return sovOpenDoc(open.dataset.open, open);
      const mi = t.closest('[data-menu]'); if (mi && !mi.disabled) return sovMenuRun(mi.dataset.menu);
    });
  }
  return p;
}
function sovMenuHtml(key){
  const modal = sovModal(); const so = modal && salesOrders.find(x => x.id === modal._soId); if (!so) return '';
  const m = modal._sovModel || sovModel(so), acts = sovActions(so, m), q = sovQuotation(so), att = so.poAttachment && so.poAttachment.url;
  const it = (k, icon, label, extra) => `<button type="button" class="sov-menu-item${extra && extra.danger ? ' danger' : ''}" data-menu="${k}"${extra && extra.disabled ? ' disabled' : ''}${extra && extra.title ? ` title="${sovEsc(extra.title)}"` : ''}><i class="ti ${icon}"></i><span>${label}${extra && extra.sub ? `<small>${extra.sub}</small>` : ''}</span></button>`;
  const items = [];
  if (key === 'menu-mobile') {
    acts.list.filter(a => a !== acts.next).forEach(a => items.push(it('act:' + a.key, a.icon, a.label)));
    items.push(it('edit', 'ti-pencil', 'Edit Order', acts.editable ? null : { disabled: true, sub: 'Not possible — it has deliveries, invoices or payments' }));
    items.push(it('print', 'ti-printer', 'Print'));
  }
  if (att) items.push(it('po', 'ti-paperclip', 'Customer PO', { sub: sovEsc(so.poAttachment.name || '') }));
  if (q) items.push(it('quote', 'ti-file-description', 'Open Quotation', { sub: sovEsc(q.qno) }));
  items.push(it('delete', 'ti-trash', 'Delete Order', acts.editable ? { danger: true } : { danger: true, disabled: true, sub: 'Not possible — it has deliveries, invoices or payments' }));
  if (key === 'menu-mobile') items.push(it('close', 'ti-x', 'Close'));
  return `<div class="sov-menu" role="menu">${items.join('')}</div>`;
}
function sovMenuRun(k){
  const modal = sovModal(); const so = modal && salesOrders.find(x => x.id === modal._soId); if (!so) return;
  sovPopClose();
  if (k.startsWith('act:')) { const m = modal._sovModel || sovModel(so); const a = sovActions(so, m).list.find(x => x.key === k.slice(4)); if (a) a.run(); return; }
  if (k === 'edit') return openEditSO(so.id);
  if (k === 'print') return sovPrint(so.id);
  if (k === 'po') return soViewPOAttachment(so.id);
  if (k === 'quote') { const q = sovQuotation(so); if (q) openQuotationDocument(q.id); return; }
  if (k === 'delete') return deleteSalesOrder(so.id);
  if (k === 'close') return closeViewWithReturn('so-view-modal');
}
function sovPopContent(key){
  const modal = sovModal(); const so = modal && salesOrders.find(x => x.id === modal._soId); if (!so) return '';
  const m = modal._sovModel || sovModel(so);
  if (key === 'dn') return sovDnListHtml(m);
  if (key === 'inv') return sovInvListHtml(m);
  if (key === 'pi') return sovPiListHtml(m);
  if (key === 'rct') return sovRctListHtml(m);
  if (key === 'menu' || key === 'menu-mobile') return sovMenuHtml(key);
  return '';
}
function sovPopToggle(anchor, key){
  const modal = sovModal(); const st = modal && modal._sovPop;
  if (st && st.key === key && st.anchor === anchor) return sovPopClose();
  sovPopShow(anchor, key, false);
}
function sovPopShow(anchor, key, keep){
  const modal = sovModal(), p = sovPopEl(); if (!modal || !p) return;
  if (modal._sovPop && modal._sovPop.anchor && modal._sovPop.anchor !== anchor && modal._sovPop.anchor.isConnected) modal._sovPop.anchor.setAttribute('aria-expanded', 'false');
  const html = sovPopContent(key); if (!html) return;
  const sheet = sovPhone();
  const isMenu = key.startsWith('menu');
  p.className = 'sov-pop' + (sheet ? ' sov-pop-sheet' : ' sov-pop-float') + (isMenu ? ' sov-pop-menu' : '');
  p.innerHTML = sheet
    ? `<div class="sov-sheet-dim"></div><div class="sov-sheet-panel" role="document"><div class="sov-grab"></div>${html}<button type="button" class="btn btn-secondary sov-pop-close">Close</button></div>`
    : `<div class="sov-float-panel"><i class="sov-arrow" aria-hidden="true"></i>${html}</div>`;
  p.setAttribute('aria-label', key === 'dn' ? 'Delivery notes' : key === 'inv' ? 'Invoices' : key === 'pi' ? 'Purchases' : key === 'rct' ? 'Receipts' : 'More actions');
  p.hidden = false;
  modal._sovPop = { key, anchor };
  anchor.setAttribute('aria-expanded', 'true');
  anchor.classList.add('sov-pop-open');
  if (sheet) { requestAnimationFrame(() => p.classList.add('open')); }
  else sovPopPlace();
  if (!keep) { const f = p.querySelector('.sov-ref, .sov-menu-item:not([disabled])'); if (f && !sheet) try { f.focus({ preventScroll: true }); } catch (e) {} }
}
function sovPopPlace(){
  const modal = sovModal(), p = modal && modal.querySelector(':scope > .sov-pop'); const st = modal && modal._sovPop;
  if (!p || p.hidden || !st || !p.classList.contains('sov-pop-float')) return;
  const a = st.anchor; if (!a || !a.isConnected) return sovPopClose();
  const panel = p.querySelector('.sov-float-panel'), arrow = p.querySelector('.sov-arrow');
  const r = a.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight;
  const isMenu = st.key.startsWith('menu');
  const w = Math.min(isMenu ? 280 : 560, vw - 24);
  panel.style.width = w + 'px';
  let left = isMenu ? r.right - w : r.left - 28;
  left = Math.max(12, Math.min(left, vw - w - 12));
  panel.style.maxHeight = ''; panel.style.left = left + 'px';
  const below = vh - r.bottom - 16, above = r.top - 16;
  const natural = Math.min(panel.scrollHeight, 560);
  const up = natural > below && above > below;
  const room = Math.max(160, (up ? above : below) - 8);
  panel.style.maxHeight = Math.min(room, 560) + 'px';
  const h = Math.min(natural, room);
  panel.style.top = (up ? r.top - 10 - h : r.bottom + 10) + 'px';
  panel.classList.toggle('up', up);
  if (arrow) arrow.style.left = Math.max(16, Math.min(w - 24, r.left + r.width / 2 - left - 7)) + 'px';
}
function sovPopReposition(){
  const modal = sovModal(); const st = modal && modal._sovPop; if (!st) return;
  const p = modal.querySelector(':scope > .sov-pop'); if (!p || !p.classList.contains('sov-pop-float')) return;
  const body = document.getElementById('so-view-body'), a = st.anchor;
  if (!a || !a.isConnected) return sovPopClose();
  if (body && body.contains(a)) { const br = body.getBoundingClientRect(), ar = a.getBoundingClientRect(); if (ar.bottom < br.top || ar.top > br.bottom) return sovPopClose(); }
  sovPopPlace();
}
function sovPopClose(){
  const modal = sovModal(); if (!modal) return;
  const p = modal.querySelector(':scope > .sov-pop');
  const st = modal._sovPop; modal._sovPop = null;
  if (st && st.anchor && st.anchor.isConnected) { st.anchor.setAttribute('aria-expanded', 'false'); st.anchor.classList.remove('sov-pop-open'); }
  modal.querySelectorAll('.sov-pop-open').forEach(x => x.classList.remove('sov-pop-open'));
  if (!p || p.hidden) return;
  if (p.classList.contains('sov-pop-sheet')) { p.classList.remove('open'); setTimeout(() => { if (!modal._sovPop) { p.hidden = true; p.innerHTML = ''; } }, 180); }
  else { p.hidden = true; p.innerHTML = ''; }
}
(function sovGlobalWiring(){
  document.addEventListener('mousedown', e => {
    const modal = sovModal(); const st = modal && modal._sovPop; if (!st) return;
    const p = modal.querySelector(':scope > .sov-pop');
    if (p && p.contains(e.target)) return;
    if (st.anchor && st.anchor.contains(e.target)) return;
    sovPopClose();
  }, true);
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const modal = sovModal(); if (!modal || !modal._sovPop) return;
    e.stopImmediatePropagation(); e.preventDefault();
    const a = modal._sovPop.anchor; sovPopClose(); if (a && a.isConnected) try { a.focus(); } catch (er) {}
  }, true);
  window.addEventListener('resize', () => { const modal = sovModal(); if (modal && modal._sovPop) { const st = modal._sovPop; const p = modal.querySelector(':scope > .sov-pop'); if ((p && p.classList.contains('sov-pop-sheet')) !== sovPhone()) sovPopClose(); else sovPopPlace(); void st; } });
  // another screen opened on top, or the view closed → the list closes
  new MutationObserver(() => { const modal = sovModal(); if (modal && modal._sovPop && (!modal.classList.contains('open') || [...document.querySelectorAll('.modal-overlay.open')].some(o => o !== modal && (parseInt(getComputedStyle(o).zIndex) || 0) >= (parseInt(getComputedStyle(modal).zIndex) || 0)))) sovPopClose(); })
    .observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
})();

/* ───────────────────────── reads only when needed ───────────────────────── */
const _sovMissingAsked = new Set(), _sovEstAsked = new Set();
function sovLoadMissing(so, m){
  if (!window.BCWin || _sovMissingAsked.has(so.id)) return;
  const miss = Object.values((m && m.purch && m.purch.byLine) || {}).some(x => x.missing);
  if (!miss) return;
  _sovMissingAsked.add(so.id);
  Promise.all([
    window.BCWin.loadContains ? window.BCWin.loadContains('purchaseInvoices', 'soIds', so.id).catch(() => 0) : 0,
    window.BCWin.loadWhere ? window.BCWin.loadWhere('stockAllocations', 'soId', so.id).catch(() => 0) : 0,
  ]).then(() => { if (typeof refreshOpenSalesOrderView === 'function') refreshOpenSalesOrderView(); });
}
function sovLoadEstimate(so){
  const est = sovEstimate(so);
  if (est.status !== 'loading' || typeof pvLoad !== 'function') return;
  const k = est.r.id + '#' + est.n; if (_sovEstAsked.has(k)) return; _sovEstAsked.add(k);
  pvLoad(est.r, est.n).then(() => { if (typeof refreshOpenSalesOrderView === 'function') refreshOpenSalesOrderView(); }).catch(() => {});
}

/* ───────────────────────── print (order status sheet, no costs) ───────────────────────── */
function sovPrint(soId){
  const so = salesOrders.find(x => x.id === soId); if (!so) return;
  const m = sovModel(so);
  const e = sovEsc;
  const co = (typeof settings !== 'undefined' && settings && (settings.companyName || settings.company)) || 'Downtown Trading Est.';
  let rows = '';
  m.lines.forEach(l => {
    rows += '<tr><td>' + l.no + '</td><td>' + e(l.desc) + '</td><td>' + e(l.uom) + '</td><td class="n">' + sovQ(l.qty, l.uom) + '</td><td class="n">' + sovQ(l.sent, l.uom) + '</td><td class="n">' + sovQ(l.accepted, l.uom)
      + '</td><td class="n">' + sovQ(l.invoiced, l.uom) + '</td><td class="n b">' + sovQ(l.toDeliver, l.uom) + '</td><td class="n o">' + sovQ(l.toInvoice, l.uom) + '</td><td class="n">' + sovMoney(l.amount) + '</td></tr>';
  });
  let dnRows = '';
  m.dns.forEach(x => { dnRows += '<tr><td>' + e(x.d.dnNo) + '</td><td>' + fmtDate(x.d.date) + '</td><td>' + e((SOV_DN_TONE[x.status] || [x.status])[0]) + '</td><td>' + (x.d.items || []).map(it => e(it.desc) + ' ' + sovQ(it.qty, it.uom) + ' ' + e(it.uom || '')).join(', ') + '</td></tr>'; });
  let invRows = '';
  m.invs.forEach(x => { invRows += '<tr><td>' + e(x.inv.invNo) + '</td><td>' + fmtDate(x.inv.date) + '</td><td class="n">' + sovMoney(x.pay.net) + '</td><td class="n">' + sovMoney(x.pay.paid) + '</td><td>' + e((SOV_PAY_TONE[x.pay.status] || [x.pay.status])[0]) + '</td></tr>'; });
  const css = '*{box-sizing:border-box}body{font-family:Inter,"Segoe UI Variable","Segoe UI",Arial,sans-serif;color:#1f2937;margin:24px;font-size:12px}h1{font-size:18px;margin:0}h2{font-size:13px;margin:18px 0 6px;color:#173a5e;text-transform:uppercase;letter-spacing:.05em}'
    + '.sub{color:#64748b;margin-top:4px}.figs{display:flex;gap:10px;margin-top:14px}.fig{flex:1;border:1px solid #d5dde7;border-radius:8px;padding:8px 10px}.fig span{display:block;color:#64748b;font-size:11px}.fig b{font-size:14px}'
    + 'table{width:100%;border-collapse:collapse}th{text-align:left;font-size:10.5px;text-transform:uppercase;color:#475569;border-bottom:1.5px solid #cbd5e1;padding:6px}td{padding:6px;border-bottom:1px solid #e8edf2}.n{text-align:right}.b{color:#1d63d8;font-weight:700}.o{color:#c2570a;font-weight:700}'
    + '.foot{margin-top:18px;color:#94a3b8;font-size:10.5px}@page{size:A4;margin:12mm}';
  const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + e(so.soNo) + ' — Order Status</title><style>' + css + '</style></head><body>'
    + '<div class="sub">' + e(co) + ' · Order Status (Internal)</div><h1>' + e(so.soNo) + ' — ' + e(so.customer || '') + '</h1>'
    + '<div class="sub">' + [so.poNo ? 'PO ' + e(so.poNo) : '', so.date ? 'SO Date ' + fmtDate(so.date) : '', 'Printed ' + fmtDate(sovToday())].filter(Boolean).join(' · ') + '</div>'
    + '<div class="figs"><div class="fig"><span>Order Total (Incl. VAT)</span><b>' + sovSAR(m.total) + '</b></div><div class="fig"><span>Delivered (By Value)</span><b>' + Math.round(m.deliveredPct) + '% · ' + e(m.deliveryStage) + '</b></div>'
    + '<div class="fig"><span>Invoiced</span><b>' + sovSAR(m.billed) + ' · ' + Math.round(m.invoicedPct) + '%</b></div><div class="fig"><span>Outstanding</span><b>' + sovSAR(m.outstanding) + ' · ' + e(m.payStatus[0]) + '</b></div></div>'
    + '<h2>Items</h2><table><thead><tr><th>#</th><th>Item</th><th>UOM</th><th class="n">Ordered</th><th class="n">Delivered</th><th class="n">Accepted</th><th class="n">Invoiced</th><th class="n">To Deliver</th><th class="n">To Invoice</th><th class="n">Amount</th></tr></thead><tbody>' + rows + '</tbody></table>'
    + '<h2>Delivery Notes</h2>' + (dnRows ? '<table><thead><tr><th>DN</th><th>Date</th><th>Status</th><th>Items</th></tr></thead><tbody>' + dnRows + '</tbody></table>' : '<div class="sub">None yet.</div>')
    + '<h2>Invoices</h2>' + (invRows ? '<table><thead><tr><th>Invoice</th><th>Date</th><th class="n">Net Amount</th><th class="n">Received</th><th>Status</th></tr></thead><tbody>' + invRows + '</tbody></table>' : '<div class="sub">None yet.</div>')
    + '<div class="foot">Internal document — not for the customer.</div></body></html>';
  const w = window.open('', '_blank');
  if (!w) { showToast('Allow pop-ups for BizCore to print.', 'warning'); return; }
  w.document.open(); w.document.write(html); w.document.close();
  try { w.focus(); setTimeout(() => { try { w.print(); } catch (er) {} }, 300); } catch (er) {}
}

console.log('Sales Order view V269.7 ✅ (rings · lists · tabs · profit)');
