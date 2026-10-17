/**
 * BizCore V268.1 — Purchase Invoices, pure rules (approved mockup 4, 17 Oct 2026).
 *
 * A purchase invoice records one supplier bill:
 *   header   supplier, supplier invoice no. (required, unique per supplier), date, Zoho bill no. (optional),
 *            supplier's invoice total (required — catches wrong quantities), payment due date
 *   lines    from Sales Orders (qty filled in with what is still to buy) or items bought for stock;
 *            unit cost compared with the Pricing estimate, or the last price paid when there is none;
 *            a cost above the limit (Administration) needs a reason (or is refused);
 *            quantity above what the order still needs must be PLACED: unassigned stock or another open order
 *   extras   additional costs (+) and a discount (−: whole invoice and/or per line, per Administration),
 *            both shared over the lines by value → landed unit cost (profit per order stays right)
 *   totals   VAT on the net; rounding = supplier's total − BizCore's total, within ±limit (Administration)
 *   V268.1   no payments yet: every invoice is saved Unpaid (credit) — the whole total is payable.
 *
 * Firestore (written by js/purchase-service.mjs in ONE transaction):
 *   purchaseInvoices/{id} (+ /events/*), purchaseSupplierRefs/{supplierKey__invNoKey},
 *   salesOrderPurchasing/{soId} (purchased qty per SO line), stockItems/{itemKey}, stockMovements/{id},
 *   settings/purchasing (administrators).
 * Accounting-ready: each invoice carries its debit/credit summary (inventory/cost, input VAT, rounding,
 * supplier payable) for the future chart of accounts.
 */
export const PURCHASE_SCHEMA_VERSION = 1;
export const PURCHASE_COLLECTIONS = Object.freeze({
  invoices: 'purchaseInvoices', events: 'events', supplierRefs: 'purchaseSupplierRefs',
  soPurchasing: 'salesOrderPurchasing', stockItems: 'stockItems', stockMoves: 'stockMovements',
});
export const PURCHASE_SETTINGS_PATH = Object.freeze(['settings', 'purchasing']);
export const PURCHASE_STATUS = Object.freeze({ posted: 'Posted', voided: 'Voided' });
export const PAY_STATUS = Object.freeze({ unpaid: 'Unpaid', part: 'Part paid', paid: 'Paid' });
export const DISCOUNT_MODES = Object.freeze(['invoice', 'line', 'both']);
export const COST_ACTIONS = Object.freeze(['reason', 'block']);
export const PROFIT_VISIBILITY = Object.freeze(['admins', 'everyone']);
export const DEFAULT_PURCHASE_SETTINGS = Object.freeze({
  costLimitPct: 5, costLimitAction: 'reason', discountMode: 'invoice', roundingLimit: 1, vatRate: 15, profitVisibility: 'admins',
});
export const LIMITS = Object.freeze({ lines: 300, costs: 20, text: 300, reason: 300, invNo: 60 });

export const r2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
export const rq = n => Math.round((Number(n) + Number.EPSILON) * 1e6) / 1e6;
const r4 = n => Math.round((Number(n) + Number.EPSILON) * 1e4) / 1e4;
const EPS = 0.005;
const clean = (v, max = LIMITS.text) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const num = v => { if (typeof v === 'number') return v; const s = String(v == null ? '' : v).replace(/[,\s]/g, ''); return s === '' ? NaN : Number(s); };
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !Number.isNaN(Date.parse(s + 'T00:00:00Z'));
const isId = v => typeof v === 'string' && v.length > 0 && v.length <= 300 && !v.includes('/') && v !== '.' && v !== '..' && !/^__.*__$/.test(v);

/* ───────── settings ───────── */
export function effectivePurchaseSettings(stored) {
  const s = { ...DEFAULT_PURCHASE_SETTINGS, ...(stored || {}) };
  const n = (v, d, lo, hi) => (Number.isFinite(Number(v)) && Number(v) >= lo && Number(v) <= hi ? Number(v) : d);
  return {
    costLimitPct: n(s.costLimitPct, 5, 0, 1000),
    costLimitAction: COST_ACTIONS.includes(s.costLimitAction) ? s.costLimitAction : 'reason',
    discountMode: DISCOUNT_MODES.includes(s.discountMode) ? s.discountMode : 'invoice',
    roundingLimit: n(s.roundingLimit, 1, 0, 100),
    vatRate: n(s.vatRate, 15, 0, 100),
    profitVisibility: PROFIT_VISIBILITY.includes(s.profitVisibility) ? s.profitVisibility : 'admins',
  };
}
export function validatePurchaseSettings(input = {}) {
  const errors = [];
  const n = v => num(v);
  const v = {
    costLimitPct: n(input.costLimitPct), costLimitAction: String(input.costLimitAction || ''),
    discountMode: String(input.discountMode || ''), roundingLimit: n(input.roundingLimit),
    vatRate: n(input.vatRate), profitVisibility: String(input.profitVisibility || ''),
  };
  if (!Number.isFinite(v.costLimitPct) || v.costLimitPct < 0 || v.costLimitPct > 1000) errors.push({ field: 'costLimitPct', message: 'Cost limit: 0 to 1000 %.' });
  if (!COST_ACTIONS.includes(v.costLimitAction)) errors.push({ field: 'costLimitAction', message: 'Choose what happens above the limit.' });
  if (!DISCOUNT_MODES.includes(v.discountMode)) errors.push({ field: 'discountMode', message: 'Choose the discount type.' });
  if (!Number.isFinite(v.roundingLimit) || v.roundingLimit < 0 || v.roundingLimit > 100) errors.push({ field: 'roundingLimit', message: 'Rounding limit: 0 to 100 SAR.' });
  if (!Number.isFinite(v.vatRate) || v.vatRate < 0 || v.vatRate > 100) errors.push({ field: 'vatRate', message: 'VAT rate: 0 to 100 %.' });
  if (!PROFIT_VISIBILITY.includes(v.profitVisibility)) errors.push({ field: 'profitVisibility', message: 'Choose who sees the profit.' });
  v.costLimitPct = r2(v.costLimitPct); v.roundingLimit = r2(v.roundingLimit); v.vatRate = r2(v.vatRate);
  return { ok: errors.length === 0, value: v, errors };
}

/* ───────── keys ───────── */
const slug = s => clean(s, 200).toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120);
export function supplierKeyOf({ supplierId, supplierName } = {}) {
  const id = clean(supplierId, 120);
  return id ? 's_' + id.replace(/[^A-Za-z0-9_-]/g, '-') : 'n_' + (slug(supplierName) || 'unknown');
}
export const invoiceNoKeyOf = no => clean(no, LIMITS.invNo).toLowerCase().replace(/[^a-z0-9]+/g, '');
export const supplierRefIdOf = (supplierKey, invNo) => `${supplierKey}__${invoiceNoKeyOf(invNo)}`;
/** One stock pool per item: product id when known, otherwise code / description + unit. */
export function itemKeyOf({ productId, code, desc, uom } = {}) {
  const p = clean(productId, 120);
  if (p) return 'p_' + p.replace(/[^A-Za-z0-9_-]/g, '-');
  const base = slug(code) || slug(desc);
  return 'd_' + (base || 'item') + '__' + (slug(uom) || 'unit');
}
export const purchaseIdForOperation = op => {
  const k = String(op || '').replace(/[^A-Za-z0-9_-]/g, '-');
  if (k.length < 8 || k.length > 200) throw Object.assign(new Error('Operation ID must be 8–200 characters'), { code: 'invalid-input' });
  return 'PI-' + k;
};

/* ───────── what is still to buy ───────── */
export function stillToBuy(orderedQty, ledgerLine) {
  return rq(Math.max(0, (Number(orderedQty) || 0) - (Number(ledgerLine && ledgerLine.purchased) || 0)));
}

/* ───────── cost against the reference (estimate or last paid) ───────── */
/**
 * reference: { unit, source:'pricing'|'lastPaid'|'none' }
 * → { kind:'equal'|'below'|'within'|'above'|'none', pct, source }
 */
export function costCheck(unitCost, reference, settings) {
  const ref = reference && Number(reference.unit) > 0 ? Number(reference.unit) : 0;
  const source = ref ? (reference.source === 'lastPaid' ? 'lastPaid' : 'pricing') : 'none';
  if (!ref) return { kind: 'none', pct: null, source };
  const pct = r2(((Number(unitCost) - ref) / ref) * 100);
  if (Math.abs(Number(unitCost) - ref) < 0.00005) return { kind: 'equal', pct: 0, source };
  if (pct < 0) return { kind: 'below', pct, source };
  return { kind: pct > settings.costLimitPct + 1e-9 ? 'above' : 'within', pct, source };
}

/* ───────── totals ───────── */
/**
 * lines: [{ qty, unitCost, discountPct }] ; costs: [{ amount }] ; discount: { mode:'amount'|'percent', value }
 * vat: optional override (must be within ±roundingLimit of the calculated VAT)
 */
export function computeTotals({ lines = [], costs = [], discount = null, vat = null, supplierTotal = null }, settings) {
  const lineAmounts = lines.map(l => {
    const gross = r2((Number(l.qty) || 0) * (Number(l.unitCost) || 0));
    const dPct = Number(l.discountPct) || 0;
    const disc = r2(gross * dPct / 100);
    return { gross, lineDiscount: disc, net: r2(gross - disc) };
  });
  const linesTotal = r2(lineAmounts.reduce((s, x) => s + x.net, 0));
  const costsTotal = r2(costs.reduce((s, c) => s + (Number(c.amount) || 0), 0));
  let discountAmount = 0;
  if (discount && Number(discount.value) > 0) discountAmount = discount.mode === 'percent' ? r2(linesTotal * Number(discount.value) / 100) : r2(discount.value);
  const subtotal = r2(linesTotal + costsTotal - discountAmount);
  const vatCalculated = r2(subtotal * settings.vatRate / 100);
  const vatAmount = vat == null || vat === '' || !Number.isFinite(num(vat)) ? vatCalculated : r2(num(vat));
  const calcTotal = r2(subtotal + vatAmount);
  const supplier = supplierTotal == null || supplierTotal === '' || !Number.isFinite(num(supplierTotal)) ? null : r2(num(supplierTotal));
  const rounding = supplier == null ? null : r2(supplier - calcTotal);
  // landed cost: additional costs and the invoice discount shared by value
  const spread = r2(costsTotal - discountAmount);
  let given = 0;
  const landed = lineAmounts.map((x, i) => {
    const last = i === lineAmounts.length - 1;
    const share = linesTotal > 0 ? (last ? r2(spread - given) : r2(spread * x.net / linesTotal)) : 0;
    given = r2(given + share);
    const qty = Number(lines[i].qty) || 0;
    return { share, landedAmount: r2(x.net + share), landedUnitCost: qty > 0 ? r4((x.net + share) / qty) : 0 };
  });
  return { lineAmounts, landed, linesTotal, costsTotal, discountAmount, subtotal, vatCalculated, vatAmount, calcTotal, supplierTotal: supplier, rounding };
}

/* ───────── validation of a whole invoice ───────── */
/**
 * input: {
 *   supplierId, supplierName, supplierVat, supplierInvoiceNo, date, dueDate, zohoBillNo, notes,
 *   supplierTotal, vat (optional override), costs:[{label, amount}], discount:{mode, value},
 *   lines:[{ kind:'order'|'stock', soId, soLineId, productId, code, desc, uom, qty, unitCost, discountPct,
 *            reference:{unit, source, refNo, refDate}, costReason, extra:{to:'stock'|'order', soId, soLineId} }]
 * }
 * ctx: { settings, orders: Map soId → { id, soNo, customer, items:[{lineId, desc, code, uom, qty, up, prodId}] },
 *        ledgers: Map soId → { lines:{ [lineId]: { purchased } } }, isAdmin }
 * → { ok, value, errors:[{field, line?, message}] , deltas: Map soId → Map lineId → qty, stock: Map itemKey → {...} }
 */
export function validatePurchaseInvoice(input = {}, ctx = {}) {
  const settings = ctx.settings || effectivePurchaseSettings(null);
  const orders = ctx.orders || new Map(), ledgers = ctx.ledgers || new Map();
  const errors = [], err = (field, message, line) => errors.push(line == null ? { field, message } : { field, message, line });
  const supplierName = clean(input.supplierName, 200), supplierId = clean(input.supplierId, 120);
  const supplierInvoiceNo = clean(input.supplierInvoiceNo, LIMITS.invNo);
  const date = String(input.date || '').slice(0, 10), dueDate = String(input.dueDate || '').slice(0, 10);
  if (!supplierName) err('supplier', 'Choose the supplier.');
  if (!supplierInvoiceNo || !invoiceNoKeyOf(supplierInvoiceNo)) err('supplierInvoiceNo', 'Enter the supplier invoice no.');
  if (!isDate(date)) err('date', 'Enter the invoice date.');
  if (!isDate(dueDate)) err('dueDate', 'Enter the payment due date (the invoice is unpaid).');
  else if (isDate(date) && dueDate < date) err('dueDate', 'The payment due date can\'t be before the invoice date.');
  const lineMode = settings.discountMode === 'line' || settings.discountMode === 'both';
  const invMode = settings.discountMode === 'invoice' || settings.discountMode === 'both';

  const rawLines = Array.isArray(input.lines) ? input.lines.slice(0, LIMITS.lines + 1) : [];
  if (!rawLines.length) err('lines', 'Add at least one line.');
  if (rawLines.length > LIMITS.lines) err('lines', `At most ${LIMITS.lines} lines.`);
  const deltas = new Map(); // soId → Map lineId → qty (this invoice)
  const addDelta = (soId, lineId, q) => { if (!deltas.has(soId)) deltas.set(soId, new Map()); const m = deltas.get(soId); m.set(lineId, rq((m.get(lineId) || 0) + q)); };
  const used = (soId, lineId) => (deltas.get(soId) && deltas.get(soId).get(lineId)) || 0;
  const lines = [];
  rawLines.forEach((l, i) => {
    const n = i + 1;
    const kind = l.kind === 'stock' ? 'stock' : 'order';
    const qty = rq(num(l.qty)), unitCost = r4(num(l.unitCost));
    const discountPct = lineMode ? (Number.isFinite(num(l.discountPct)) ? r2(num(l.discountPct)) : 0) : 0;
    if (!(qty > 0)) err('qty', `Line ${n}: enter the quantity bought.`, i);
    if (!Number.isFinite(unitCost) || unitCost < 0) err('unitCost', `Line ${n}: enter the unit cost.`, i);
    if (discountPct < 0 || discountPct > 100) err('discountPct', `Line ${n}: discount 0–100 %.`, i);
    const line = { lineNo: n, kind, qty, unitCost, discountPct, allocations: [], stockQty: 0, costReason: clean(l.costReason, LIMITS.reason) };
    if (kind === 'order') {
      const so = orders.get(l.soId);
      const soLine = so && (so.items || []).find(x => x.lineId === l.soLineId);
      if (!so || !soLine) { err('soLine', `Line ${n}: the sales order line no longer exists.`, i); lines.push(line); return; }
      const ordered = Number(soLine.qty) || 0;
      const left = rq(stillToBuy(ordered, ((ledgers.get(so.id) || {}).lines || {})[soLine.lineId]) - used(so.id, soLine.lineId));
      if (left <= 0 && qty > 0) err('qty', `Line ${n}: nothing is left to buy on ${so.soNo} for ${soLine.desc}.`, i);
      const forOrder = rq(Math.min(qty, Math.max(0, left)));
      Object.assign(line, {
        soId: so.id, soNo: so.soNo || '', customer: clean(so.customer, 200), soLineId: soLine.lineId,
        productId: clean(soLine.prodId || soLine.productId, 120), code: clean(soLine.code, 100), desc: clean(soLine.desc, 500), uom: clean(soLine.uom, 30),
        orderedQty: ordered, sellUnit: r4(Number(soLine.up) || 0),
      });
      if (forOrder > 0) { line.allocations.push({ soId: so.id, soNo: so.soNo || '', soLineId: soLine.lineId, qty: forOrder }); addDelta(so.id, soLine.lineId, forOrder); }
      const extra = rq(qty - forOrder);
      if (extra > 0 && left > 0) {
        const to = l.extra && l.extra.to;
        if (to === 'stock') line.stockQty = extra;
        else if (to === 'order') {
          const so2 = orders.get(l.extra.soId);
          const l2 = so2 && (so2.items || []).find(x => x.lineId === l.extra.soLineId);
          if (!so2 || !l2) err('extra', `Line ${n}: the other sales order line no longer exists.`, i);
          else if (itemKeyOf({ productId: l2.prodId || l2.productId, code: l2.code, desc: l2.desc, uom: l2.uom }) !== itemKeyOf(line) || (so2.id === so.id && l2.lineId === soLine.lineId)) err('extra', `Line ${n}: ${so2.soNo} is not for the same item.`, i);
          else {
            const left2 = rq(stillToBuy(l2.qty, ((ledgers.get(so2.id) || {}).lines || {})[l2.lineId]) - used(so2.id, l2.lineId));
            if (left2 + 1e-9 < extra) err('extra', `Line ${n}: ${so2.soNo} needs only ${left2}.`, i);
            else { line.allocations.push({ soId: so2.id, soNo: so2.soNo || '', soLineId: l2.lineId, qty: extra, sellUnit: r4(Number(l2.up) || 0) }); addDelta(so2.id, l2.lineId, extra); }
          }
        } else err('extra', `Line ${n}: ${extra} more than ${so.soNo} needs — choose where they go.`, i);
      }
    } else {
      Object.assign(line, { productId: clean(l.productId, 120), code: clean(l.code, 100), desc: clean(l.desc, 500), uom: clean(l.uom, 30) || 'Pcs', stockQty: qty });
      if (!line.desc) err('desc', `Line ${n}: enter the item.`, i);
    }
    line.itemKey = itemKeyOf(line);
    // cost against the estimate / last paid price
    const ref = l.reference && Number(l.reference.unit) > 0 ? { unit: r4(l.reference.unit), source: l.reference.source === 'lastPaid' ? 'lastPaid' : 'pricing', refNo: clean(l.reference.refNo, 60), refDate: clean(l.reference.refDate, 10) } : { unit: 0, source: 'none', refNo: '', refDate: '' };
    const chk = Number.isFinite(unitCost) ? costCheck(unitCost, ref, settings) : { kind: 'none', pct: null };
    line.reference = ref; line.costCheck = chk.kind; line.costPct = chk.pct;
    if (chk.kind === 'above') {
      if (settings.costLimitAction === 'block') err('unitCost', `Line ${n}: the cost is ${chk.pct}% above the ${ref.source === 'lastPaid' ? 'last price paid' : 'estimate'} — above the ${settings.costLimitPct}% limit.`, i);
      else if (!line.costReason) err('costReason', `Line ${n}: give the reason for the higher cost.`, i);
    } else line.costReason = '';
    lines.push(line);
  });

  // additional costs and discount
  const costs = (Array.isArray(input.costs) ? input.costs : []).slice(0, LIMITS.costs).map(c => ({ label: clean(c.label, 100), amount: r2(num(c.amount)) }))
    .filter(c => c.label || c.amount);
  costs.forEach((c, i) => { if (!c.label) err('costs', `Additional cost ${i + 1}: enter what it is.`); if (!Number.isFinite(c.amount) || c.amount <= 0) err('costs', `Additional cost ${i + 1}: enter the amount.`); });
  let discount = null;
  if (input.discount && Number(num(input.discount.value)) > 0) {
    if (!invMode) err('discount', 'A whole-invoice discount is switched off in Administration.');
    discount = { mode: input.discount.mode === 'percent' ? 'percent' : 'amount', value: r2(num(input.discount.value)) };
    if (discount.mode === 'percent' && discount.value > 100) err('discount', 'Discount: at most 100 %.');
  }
  const t = computeTotals({ lines, costs, discount, vat: input.vat, supplierTotal: input.supplierTotal }, settings);
  if (discount && t.discountAmount > t.linesTotal + t.costsTotal + EPS) err('discount', 'The discount is bigger than the invoice.');
  if (Math.abs(t.vatAmount - t.vatCalculated) > settings.roundingLimit + 1e-9) err('vat', `VAT differs from ${t.vatCalculated.toFixed(2)} by more than ${settings.roundingLimit.toFixed(2)}.`);
  if (t.supplierTotal == null || !(t.supplierTotal > 0)) err('supplierTotal', 'Enter the supplier\'s invoice total.');
  else if (Math.abs(t.rounding) > settings.roundingLimit + 1e-9)
    err('supplierTotal', `The supplier's total differs from BizCore's total ${t.calcTotal.toFixed(2)} by ${t.rounding.toFixed(2)} — more than the ±${settings.roundingLimit.toFixed(2)} rounding limit. Check quantities and prices.`);

  lines.forEach((l, i) => {
    const a = t.lineAmounts[i], L = t.landed[i];
    Object.assign(l, { grossAmount: a.gross, lineDiscount: a.lineDiscount, amount: a.net, costShare: L.share, landedAmount: L.landedAmount, landedUnitCost: L.landedUnitCost });
  });
  // profit on the orders (selling price of the allocated qty − landed cost of it)
  let sales = 0, cost = 0;
  lines.forEach(l => l.allocations.forEach(a => { sales += (a.sellUnit != null ? a.sellUnit : l.sellUnit || 0) * a.qty; cost += l.landedUnitCost * a.qty; }));
  lines.forEach(l => l.allocations.forEach(a => { if (a.sellUnit == null) a.sellUnit = l.sellUnit || 0; }));
  const stock = new Map();
  lines.forEach(l => { if (l.stockQty > 0) { const s = stock.get(l.itemKey) || { itemKey: l.itemKey, productId: l.productId, code: l.code, desc: l.desc, uom: l.uom, qty: 0, value: 0 }; s.qty = rq(s.qty + l.stockQty); s.value = r2(s.value + l.landedUnitCost * l.stockQty); stock.set(l.itemKey, s); } });

  const total = t.supplierTotal != null ? t.supplierTotal : t.calcTotal;
  const value = {
    supplierId, supplierName, supplierVat: clean(input.supplierVat, 30), supplierKey: supplierKeyOf({ supplierId, supplierName }),
    supplierInvoiceNo, supplierInvoiceKey: invoiceNoKeyOf(supplierInvoiceNo), date, dueDate,
    zohoBillNo: clean(input.zohoBillNo, 60), notes: clean(input.notes, 1000),
    lines, costs, discount: discount ? { ...discount, amount: t.discountAmount } : null, discountMode: settings.discountMode,
    totals: {
      linesTotal: t.linesTotal, costsTotal: t.costsTotal, discount: t.discountAmount, subtotal: t.subtotal,
      vatRate: settings.vatRate, vatCalculated: t.vatCalculated, vat: t.vatAmount, calcTotal: t.calcTotal,
      supplierTotal: t.supplierTotal, rounding: t.rounding == null ? 0 : t.rounding, total,
    },
    paid: 0, balance: total, payStatus: PAY_STATUS.unpaid,
    profit: { sales: r2(sales), cost: r2(cost), profit: r2(sales - cost) },
    soIds: [...deltas.keys()], itemKeys: [...new Set(lines.map(l => l.itemKey))],
    // for the future chart of accounts: Dr inventory/cost + input VAT (+ rounding) ; Cr supplier payable
    accounting: {
      debit: [{ side: 'purchases', amount: t.subtotal }, { side: 'input-vat', amount: t.vatAmount }, ...(t.rounding && t.rounding > 0 ? [{ side: 'rounding', amount: t.rounding }] : [])],
      credit: [{ side: 'supplier-payable', amount: total }, ...(t.rounding && t.rounding < 0 ? [{ side: 'rounding', amount: -t.rounding }] : [])],
    },
  };
  return { ok: errors.length === 0, value, errors, deltas, stock, totals: t };
}

/** The register's payment status (V268.1: always Unpaid unless voided). */
export function payStatusOf(pi) {
  if (!pi || pi.status === PURCHASE_STATUS.voided) return '';
  const bal = r2((Number(pi.totals && pi.totals.total) || 0) - (Number(pi.paid) || 0));
  return bal <= EPS ? PAY_STATUS.paid : (Number(pi.paid) || 0) > EPS ? PAY_STATUS.part : PAY_STATUS.unpaid;
}
export function daysUntil(dateIso, today) {
  if (!isDate(dateIso) || !isDate(today)) return null;
  return Math.round((Date.parse(dateIso + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86400000);
}

/** The last price paid for an item (newest posted invoice, any supplier) — the reference when there is no estimate. */
export function lastPaidOf(invoices, itemKey, { excludeId = null } = {}) {
  let best = null;
  for (const pi of invoices || []) {
    if (!pi || pi.status === PURCHASE_STATUS.voided || pi.id === excludeId) continue;
    for (const l of pi.lines || []) {
      if (l.itemKey !== itemKey || !(Number(l.unitCost) > 0)) continue;
      const key = String(pi.date || '') + '|' + String(pi.piNo || '');
      if (!best || key > best.key) best = { key, unit: Number(l.unitCost), refNo: pi.piNo || '', refDate: pi.date || '', supplier: pi.supplierName || '' };
    }
  }
  return best ? { unit: best.unit, source: 'lastPaid', refNo: best.refNo, refDate: best.refDate, supplier: best.supplier } : null;
}
export { isId as isSafePurchaseId };
