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
 *   V268.2   supplier payments (at entry and later), discount at payment, cash back — see the end of this file.
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

/** The register's payment status: Paid when nothing is left (payments + discount at payment cover the total). */
export function payStatusOf(pi) {
  if (!pi || pi.status === PURCHASE_STATUS.voided) return '';
  const m = invoiceMoneyOf(pi);
  return payStatusFrom(m.total, m.paid, m.paymentDiscount);
}
export function payStatusFrom(total, paid, discount = 0) {
  const settled = r2((Number(paid) || 0) + (Number(discount) || 0));
  return r2((Number(total) || 0) - settled) <= EPS ? PAY_STATUS.paid : settled > EPS ? PAY_STATUS.part : PAY_STATUS.unpaid;
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

/* ═══════════════ V268.2 — supplier payments, discount at payment, cash back ═══════════════
 * supplierPayments/{SPAY-<op>}  one payment (or cash back) on ONE purchase invoice, number SP-YYMM-####.
 *   payment   lines [{ account, amount, reference, bankCharge }] + optional discount at payment
 *             → the invoice: paid += amount, paymentDiscount += discount, balance = total − paid − paymentDiscount
 *   cashback  money the supplier gives back after payment (no credit note): ONE line into a cash / bank account
 *             → the invoice: cashBack += amount (total, paid and balance unchanged)
 * Each posts ONE balanced cash-ledger entry (cashEntries/spe-…) and one posting per payment account
 * (cashLines/<entry>__<account>): cash lines wait for the custodian (⏳); bank lines need no confirmation and
 * carry the bank charge (→ bank expense); a card line takes the money from the card's LINKED bank account and is
 * shown on the card as a memo (no balance change).
 * Discount at payment and cash back lower the cost of the invoice's items (shared by value) → profit follows.
 * Nothing is deleted: a wrong payment is cancelled (void) with a reason and everything goes back.
 */
export const PAYMENT_COLLECTION = 'supplierPayments';
export const PAYMENT_KINDS = Object.freeze({ payment: 'payment', cashback: 'cashback' });
export const PAYMENT_LIMITS = Object.freeze({ lines: 10, reference: 60, note: 200, amount: 1e9 });
export const LEDGER_KIND_OF = Object.freeze({ payment: 'supplier-payment', cashback: 'supplier-cashback' });

export const paymentIdForOperation = (op, n = 0) => {
  const k = String(op || '').replace(/[^A-Za-z0-9_-]/g, '-');
  if (k.length < 8 || k.length > 200) throw Object.assign(new Error('Operation ID must be 8–200 characters'), { code: 'invalid-input' });
  return 'SPAY-' + k + (n ? '-' + n : '');
};
export const paymentEntryIdOf = paymentId => 'spe-' + String(paymentId).slice(5);
const ledgerLineIdOf = (entryId, accountId) => `${entryId}__${accountId}`;
const money = v => { const raw = String(v == null ? '' : v).replace(/[,\s]/g, ''); if (raw === '') return 0; return /^\d+(\.\d{1,2})?$/.test(raw) ? r2(Number(raw)) : NaN; };

/** The invoice's money after its payments (older invoices have no payment fields yet). */
export function invoiceMoneyOf(pi) {
  const total = r2(Number(pi && pi.totals && pi.totals.total) || 0);
  const paid = r2(Number(pi && pi.paid) || 0), paymentDiscount = r2(Number(pi && pi.paymentDiscount) || 0), cashBack = r2(Number(pi && pi.cashBack) || 0);
  return { total, paid, paymentDiscount, cashBack, balance: r2(total - paid - paymentDiscount) };
}
/** Discount at payment + cash back, as a share of the items' landed cost (0 … 1). */
export function costFactorOf(pi) {
  const m = invoiceMoneyOf(pi), d = r2(m.paymentDiscount + m.cashBack);
  const landed = (pi && pi.lines || []).reduce((s, l) => s + (Number(l.landedAmount) || 0), 0);
  return d > 0 && landed > 0 ? Math.min(1, d / landed) : 0;
}
/** Profit on the orders after discount at payment / cash back (they lower the cost of every item by value). */
export function profitAfterDiscounts(pi) {
  const p = (pi && pi.profit) || { sales: 0, cost: 0, profit: 0 }, f = costFactorOf(pi);
  if (!f) return { sales: r2(p.sales), cost: r2(p.cost), profit: r2(p.profit), reduced: 0 };
  const cost = r2(Number(p.cost) * (1 - f));
  return { sales: r2(p.sales), cost, profit: r2(Number(p.sales) - cost), reduced: r2(Number(p.cost) - cost) };
}
/** The invoice's figures after adding (sign +1) or removing (sign −1) a payment. */
export function applyPaymentToInvoice(pi, payment, sign = 1) {
  const m = invoiceMoneyOf(pi);
  const isCb = payment.kind === PAYMENT_KINDS.cashback;
  const paid = r2(m.paid + (isCb ? 0 : sign * (Number(payment.amount) || 0)));
  const paymentDiscount = r2(m.paymentDiscount + (isCb ? 0 : sign * (Number(payment.discount) || 0)));
  const cashBack = r2(m.cashBack + (isCb ? sign * (Number(payment.amount) || 0) : 0));
  const balance = r2(m.total - paid - paymentDiscount);
  return { paid, paymentDiscount, cashBack, balance, payStatus: payStatusFrom(m.total, paid, paymentDiscount) };
}

/**
 * Check a payment / cash back for ONE invoice.
 *   input   { kind, date, lines:[{accountId, amount, reference, bankCharge}], discount, note }
 *   ctx     { invoice (its current money), accounts: Map id → account (incl. the banks linked to cards), today }
 * → { ok, value, errors:[{field, message, line}] }
 */
export function validateSupplierPayment(input = {}, { invoice = null, accounts = new Map(), today = new Date().toISOString().slice(0, 10) } = {}) {
  const errors = [], err = (field, message, line) => errors.push({ field, message, ...(line != null ? { line } : {}) });
  const kind = input.kind === PAYMENT_KINDS.cashback ? PAYMENT_KINDS.cashback : PAYMENT_KINDS.payment;
  const date = String(input.date || '').slice(0, 10);
  const m = invoiceMoneyOf(invoice);
  if (!invoice || invoice.status !== PURCHASE_STATUS.posted) err('invoice', 'This purchase invoice is cancelled or missing.');
  if (!isDate(date)) err('date', 'Enter the payment date.');
  else if (date > today) err('date', 'The payment date can\'t be in the future.');
  const raw = Array.isArray(input.lines) ? input.lines.filter(l => l && (l.accountId || String(l.amount || '').trim() !== '')) : [];
  if (raw.length > PAYMENT_LIMITS.lines) err('lines', `At most ${PAYMENT_LIMITS.lines} accounts in one payment.`);
  const seen = new Set(), lines = [];
  raw.slice(0, PAYMENT_LIMITS.lines).forEach((l, i) => {
    const n = i + 1, a = isId(l.accountId) ? accounts.get(l.accountId) : null;
    const amount = money(l.amount), bankCharge = money(l.bankCharge);
    if (!a) { err('account', `Payment line ${n}: choose the account.`, i); return; }
    if (a.active === false) err('account', `Payment line ${n}: ${a.name} is inactive.`, i);
    if (!(Number.isFinite(amount) && amount > 0)) err('amount', `Payment line ${n}: enter an amount greater than zero (up to 2 decimals).`, i);
    else if (amount > PAYMENT_LIMITS.amount) err('amount', `Payment line ${n}: the amount is too large.`, i);
    let via = null;
    if (a.type === 'card') {
      via = isId(a.linkedBankAccountId) ? accounts.get(a.linkedBankAccountId) : null;
      if (kind === PAYMENT_KINDS.cashback) err('account', 'Cash back is received into a cash or bank account, not a card.', i);
      else if (!via || via.type !== 'bank') err('account', `${a.name} has no linked bank account — set it in Administration → Payment Accounts.`, i);
      else if (via.active === false) err('account', `${a.name}: its bank account ${via.name} is inactive.`, i);
    }
    if (!(Number.isFinite(bankCharge) && bankCharge >= 0)) err('bankCharge', `Payment line ${n}: bank charge must be a number (up to 2 decimals).`, i);
    else if (bankCharge > 0 && (a.type !== 'bank' || kind !== PAYMENT_KINDS.payment)) err('bankCharge', `Payment line ${n}: a bank charge is only for a bank transfer.`, i);
    const posting = via || a;
    if (seen.has(posting.id)) err('account', `${posting.name} is used twice — one line per account.`, i);
    seen.add(posting.id);
    if (isDate(date)) for (const x of [a, via]) if (x && x.openingDate && date < x.openingDate) err('date', `The date is before the opening balance of ${x.name} (${x.openingDate}).`, i);
    lines.push({
      accountId: a.id, accountCode: clean(a.code, 20), accountName: clean(a.name, 80), accountType: a.type,
      amount: Number.isFinite(amount) ? amount : 0, reference: clean(l.reference, PAYMENT_LIMITS.reference),
      bankCharge: Number.isFinite(bankCharge) ? bankCharge : 0,
      viaAccountId: via ? via.id : '', viaAccountCode: via ? clean(via.code, 20) : '', viaAccountName: via ? clean(via.name, 80) : '',
      postingAccountId: posting.id,
    });
  });
  const amount = r2(lines.reduce((s, l) => s + l.amount, 0));
  const bankCharges = r2(lines.reduce((s, l) => s + l.bankCharge, 0));
  const discount = kind === PAYMENT_KINDS.payment ? money(input.discount) : 0;
  const note = clean(input.note, PAYMENT_LIMITS.note);
  if (kind === PAYMENT_KINDS.payment) {
    if (!(Number.isFinite(discount) && discount >= 0)) err('discount', 'Discount at payment must be a number (up to 2 decimals).');
    const applied = r2(amount + (Number.isFinite(discount) ? discount : 0));
    if (!(applied > 0)) err('amount', 'Enter the amount paid (or a discount).');
    else if (invoice && applied > m.balance + EPS) err('amount', `This is ${r2(applied - m.balance).toFixed(2)} more than the balance ${m.balance.toFixed(2)}. Paying more than the balance is not allowed yet (advances come later).`);
  } else {
    if (lines.length !== 1) err('lines', 'Choose the one account the cash back was received into.');
    if (lines[0] && !['cash', 'bank'].includes(lines[0].accountType)) err('account', 'Cash back is received into a cash or bank account.');
    if (!(amount > 0)) err('amount', 'Enter the amount received.');
    else if (invoice && amount > r2(m.paid - m.cashBack) + EPS) err('amount', `The cash back can't be more than what was paid on this invoice (${r2(m.paid - m.cashBack).toFixed(2)}).`);
  }
  const d = Number.isFinite(discount) ? discount : 0;
  const value = {
    kind, date, lines, amount, bankCharges, discount: kind === PAYMENT_KINDS.payment ? d : 0, note,
    applied: kind === PAYMENT_KINDS.payment ? r2(amount + d) : 0, cashBack: kind === PAYMENT_KINDS.cashback ? amount : 0,
  };
  return { ok: errors.length === 0, value, errors };
}

/**
 * The records of one payment: the payment document, its balanced ledger entry and one posting per account.
 * accounts: Map id → account (custodian, name). No entry when only a discount is given (no money moves).
 */
export function buildSupplierPaymentRecords({ id, spNo, value, invoice, accounts, actor, at, stamp, operationId }) {
  const isCb = value.kind === PAYMENT_KINDS.cashback;
  const entryKind = LEDGER_KIND_OF[value.kind];
  const sup = clean(invoice.supplierName, 200);
  const description = clean(`${isCb ? 'Cash back from' : 'Payment to'} ${sup} · ${invoice.piNo}`, 200);
  const postings = {};   // accountId → { amountIn, amountOut, memoOut, charge, viaCard, reference }
  for (const l of value.lines) {
    const p = postings[l.postingAccountId] || (postings[l.postingAccountId] = { amountIn: 0, amountOut: 0, memoOut: 0, charge: 0, viaCard: '', reference: '' });
    if (isCb) p.amountIn = r2(p.amountIn + l.amount);
    else { p.amountOut = r2(p.amountOut + l.amount + l.bankCharge); p.charge = r2(p.charge + l.bankCharge); }
    if (l.reference) p.reference = l.reference;
    if (l.viaAccountId) {
      p.viaCard = l.accountName;
      const c = postings[l.accountId] || (postings[l.accountId] = { amountIn: 0, amountOut: 0, memoOut: 0, charge: 0, viaCard: '', reference: '' });
      c.memoOut = r2(c.memoOut + l.amount); c.viaBank = l.viaAccountName; if (l.reference) c.reference = l.reference;
    }
  }
  const accountIds = Object.keys(postings);
  const entryId = accountIds.length ? paymentEntryIdOf(id) : '';
  const moved = isCb ? value.amount : r2(value.amount + value.bankCharges);
  const journal = isCb
    ? [{ accountId: value.lines[0].postingAccountId, ledger: '', debit: value.amount, credit: 0 }, { accountId: '', ledger: 'purchase-discount', debit: 0, credit: value.amount }]
    : [{ accountId: '', ledger: 'supplier-payable', debit: value.applied, credit: 0 },
       ...(value.bankCharges > 0 ? [{ accountId: '', ledger: 'bank-charges', debit: value.bankCharges, credit: 0 }] : []),
       ...accountIds.filter(a => postings[a].amountOut > 0).map(a => ({ accountId: a, ledger: '', debit: 0, credit: postings[a].amountOut })),
       ...(value.discount > 0 ? [{ accountId: '', ledger: 'purchase-discount', debit: 0, credit: value.discount }] : [])];
  const payment = {
    id, schemaVersion: PURCHASE_SCHEMA_VERSION, kind: value.kind, spNo, operationId,
    invoiceId: invoice.id, piNo: invoice.piNo, supplierId: invoice.supplierId || '', supplierName: sup, supplierKey: invoice.supplierKey || '',
    date: value.date, lines: value.lines, amount: value.amount, bankCharges: value.bankCharges, discount: value.discount,
    applied: value.applied, cashBack: value.cashBack, note: value.note, entryId,
    status: PURCHASE_STATUS.posted, revision: 1,
    accounting: { lines: journal },
    created: at, createdBy: actor.name, createdByUid: actor.uid, updatedAt: at, updatedBy: actor.name, updatedByUid: actor.uid, recordedAt: stamp,
  };
  if (!entryId) return { payment, entry: null, lines: [] };
  const entry = {
    id: entryId, schemaVersion: 1, kind: entryKind, paymentId: id, invoiceId: invoice.id, piNo: invoice.piNo,
    voucherNo: spNo, date: value.date, amount: moved, description,
    lines: journal, accountIds,
    postings: Object.fromEntries(accountIds.map(a => [a, { amountIn: postings[a].amountIn, amountOut: postings[a].amountOut, memoOut: postings[a].memoOut }])),
    void: false, revision: 1,
    recordedByUid: actor.uid, recordedByName: actor.name, recordedAt: at,
    updatedByUid: actor.uid, updatedByName: actor.name, updatedAt: stamp,
  };
  const lines = accountIds.map(a => {
    const acc = accounts.get(a) || { id: a, name: a, type: 'bank' }, p = postings[a];
    const needsConfirm = acc.type === 'cash' && (p.amountIn > 0 || p.amountOut > 0);
    const extra = [p.reference, p.charge > 0 ? `incl. bank charge ${p.charge.toFixed(2)}` : '', p.viaCard ? `by ${p.viaCard}` : '', p.memoOut > 0 ? `paid by card — from ${p.viaBank || 'the linked bank'}` : ''].filter(Boolean).join(' · ');
    return {
      id: ledgerLineIdOf(entryId, a), entryId, voucherNo: spNo, kind: entryKind, date: value.date, description,
      details: clean(extra, 200), void: false, entryRevision: 1, schemaVersion: 1,
      recordedByUid: actor.uid, recordedByName: actor.name, recordedAt: at,
      accountId: a, accountName: clean(acc.name, 80), custodianUid: acc.custodianUid || '',
      counterpartAccountId: '', counterpartName: sup, counterpartLineId: '',
      amountIn: p.amountIn, amountOut: p.amountOut, memoOut: p.memoOut, charge: p.charge,
      needsConfirm, status: needsConfirm ? 'pending' : 'none',
      statusByUid: '', statusByName: '', statusAt: null, statusNote: '', onBehalf: false,
      paymentId: id, invoiceId: invoice.id, piNo: invoice.piNo,
    };
  });
  return { payment, entry, lines };
}
