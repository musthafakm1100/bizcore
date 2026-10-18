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
export const EDIT_MODES = Object.freeze(['off', 'limited', 'limited-admin', 'full']);
export const NEW_PRODUCT_RIGHTS = Object.freeze(['everyone', 'admins']);
export const DEFAULT_PURCHASE_SETTINGS = Object.freeze({
  costLimitPct: 5, costLimitAction: 'reason', discountMode: 'invoice', roundingLimit: 1, vatRate: 15, profitVisibility: 'admins',
  editMode: 'limited-admin', editDays: 7,   // V268.3
  newProductRight: 'everyone',               // V268.5: who may add a product with + New Product
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
    editMode: EDIT_MODES.includes(s.editMode) ? s.editMode : 'limited-admin',
    editDays: Number.isInteger(Number(s.editDays)) && Number(s.editDays) >= 0 && Number(s.editDays) <= 365 ? Number(s.editDays) : 7,
    newProductRight: NEW_PRODUCT_RIGHTS.includes(s.newProductRight) ? s.newProductRight : 'everyone',
  };
}
export function validatePurchaseSettings(input = {}) {
  const errors = [];
  const n = v => num(v);
  const v = {
    costLimitPct: n(input.costLimitPct), costLimitAction: String(input.costLimitAction || ''),
    discountMode: String(input.discountMode || ''), roundingLimit: n(input.roundingLimit),
    vatRate: n(input.vatRate), profitVisibility: String(input.profitVisibility || ''),
    editMode: String(input.editMode || 'limited-admin'), editDays: n(input.editDays == null || input.editDays === '' ? 7 : input.editDays),
    newProductRight: String(input.newProductRight || 'everyone'),
  };
  if (!Number.isFinite(v.costLimitPct) || v.costLimitPct < 0 || v.costLimitPct > 1000) errors.push({ field: 'costLimitPct', message: 'Cost limit: 0 to 1000 %.' });
  if (!COST_ACTIONS.includes(v.costLimitAction)) errors.push({ field: 'costLimitAction', message: 'Choose what happens above the limit.' });
  if (!DISCOUNT_MODES.includes(v.discountMode)) errors.push({ field: 'discountMode', message: 'Choose the discount type.' });
  if (!Number.isFinite(v.roundingLimit) || v.roundingLimit < 0 || v.roundingLimit > 100) errors.push({ field: 'roundingLimit', message: 'Rounding limit: 0 to 100 SAR.' });
  if (!Number.isFinite(v.vatRate) || v.vatRate < 0 || v.vatRate > 100) errors.push({ field: 'vatRate', message: 'VAT rate: 0 to 100 %.' });
  if (!PROFIT_VISIBILITY.includes(v.profitVisibility)) errors.push({ field: 'profitVisibility', message: 'Choose who sees the profit.' });
  if (!EDIT_MODES.includes(v.editMode)) errors.push({ field: 'editMode', message: 'Choose who may edit.' });
  if (!Number.isInteger(v.editDays) || v.editDays < 0 || v.editDays > 365) errors.push({ field: 'editDays', message: 'Edit time limit: 0 to 365 whole days.' });
  if (!NEW_PRODUCT_RIGHTS.includes(v.newProductRight)) errors.push({ field: 'newProductRight', message: 'Choose who may add a new product.' });
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
      // V268.5: an item for stock must be a product from Master Data (or added with + New Product)
      else if (!line.productId) err('product', `Line ${n}: choose a product from the list, or add it with + New Product.`, i);
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
export const PAYMENT_KINDS = Object.freeze({ payment: 'payment', cashback: 'cashback', advance: 'advance' });
export const PAYMENT_LIMITS = Object.freeze({ lines: 10, reference: 60, note: 200, amount: 1e9 });
export const LEDGER_KIND_OF = Object.freeze({ payment: 'supplier-payment', cashback: 'supplier-cashback', advance: 'supplier-advance' });
export const ADVANCE_LINES_MAX = 3;

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

/** What is left of an advance (paid before the invoice; used by invoice payments). */
export function advanceLeftOf(adv) {
  if (!adv || adv.kind !== PAYMENT_KINDS.advance || adv.status !== PURCHASE_STATUS.posted) return 0;
  return r2((Number(adv.amount) || 0) - (Number(adv.advanceUsed) || 0));
}
/** Open advances of a supplier (oldest first). */
export function openAdvancesOf(payments, supplierKey) {
  return (payments || []).filter(p => p && p.kind === PAYMENT_KINDS.advance && p.status === PURCHASE_STATUS.posted && p.supplierKey === supplierKey && advanceLeftOf(p) > EPS)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.spNo).localeCompare(String(b.spNo), undefined, { numeric: true }));
}

/**
 * Check a payment / cash back for ONE invoice, or an ADVANCE (no invoice yet).
 *   input   { kind, date, lines:[{accountId | advanceId, amount, reference, bankCharge}], discount, note,
 *             advance only: supplierId, supplierName, soId, soNo }
 *   ctx     { invoice (its current money), accounts: Map id → account (incl. the banks linked to cards),
 *             advances: Map id → advance payment (for advance lines), today }
 * → { ok, value, errors:[{field, message, line}] }
 */
export function validateSupplierPayment(input = {}, { invoice = null, accounts = new Map(), advances = new Map(), today = new Date().toISOString().slice(0, 10) } = {}) {
  const errors = [], err = (field, message, line) => errors.push({ field, message, ...(line != null ? { line } : {}) });
  const kind = [PAYMENT_KINDS.cashback, PAYMENT_KINDS.advance].includes(input.kind) ? input.kind : PAYMENT_KINDS.payment;
  const isAdv = kind === PAYMENT_KINDS.advance;
  const date = String(input.date || '').slice(0, 10);
  const m = invoiceMoneyOf(invoice);
  let supplier = null;
  if (isAdv) {
    const supplierName = clean(input.supplierName, 200), supplierId = clean(input.supplierId, 120);
    if (!supplierName) err('supplier', 'Choose the supplier.');
    supplier = { supplierId, supplierName, supplierKey: supplierKeyOf({ supplierId, supplierName }) };
  } else if (!invoice || invoice.status !== PURCHASE_STATUS.posted) err('invoice', 'This purchase invoice is cancelled or missing.');
  if (!isDate(date)) err('date', 'Enter the payment date.');
  else if (date > today) err('date', 'The payment date can\'t be in the future.');
  const raw = Array.isArray(input.lines) ? input.lines.filter(l => l && (l.accountId || l.advanceId || String(l.amount || '').trim() !== '')) : [];
  if (raw.length > PAYMENT_LIMITS.lines) err('lines', `At most ${PAYMENT_LIMITS.lines} accounts in one payment.`);
  const seen = new Set(), lines = [];
  raw.slice(0, PAYMENT_LIMITS.lines).forEach((l, i) => {
    const n = i + 1, amount = money(l.amount), bankCharge = money(l.bankCharge);
    if (!(Number.isFinite(amount) && amount > 0)) err('amount', `Payment line ${n}: enter an amount greater than zero (up to 2 decimals).`, i);
    else if (amount > PAYMENT_LIMITS.amount) err('amount', `Payment line ${n}: the amount is too large.`, i);
    // V268.3: an advance paid earlier, used on this invoice (no new money moves)
    if (l.advanceId) {
      const adv = isId(l.advanceId) ? advances.get(l.advanceId) : null;
      if (kind !== PAYMENT_KINDS.payment) { err('account', 'An advance can only be used on an invoice payment.', i); return; }
      if (!adv || adv.kind !== PAYMENT_KINDS.advance) { err('account', `Payment line ${n}: that advance no longer exists.`, i); return; }
      if (adv.status !== PURCHASE_STATUS.posted) err('account', `Payment line ${n}: advance ${adv.spNo} is cancelled.`, i);
      if (invoice && adv.supplierKey !== invoice.supplierKey) err('account', `Payment line ${n}: advance ${adv.spNo} is for ${adv.supplierName}, not this supplier.`, i);
      const left = advanceLeftOf(adv);
      if (Number.isFinite(amount) && amount > left + EPS) err('amount', `Payment line ${n}: only ${left.toFixed(2)} is left of advance ${adv.spNo}.`, i);
      if (bankCharge > 0) err('bankCharge', `Payment line ${n}: no bank charge on an advance.`, i);
      if (seen.has('adv:' + adv.id)) err('account', `Advance ${adv.spNo} is used twice — one line per advance.`, i);
      seen.add('adv:' + adv.id);
      lines.push({ advanceId: adv.id, advanceNo: clean(adv.spNo, 30), accountId: '', accountCode: '', accountName: clean(`Advance ${adv.spNo}`, 80), accountType: 'advance',
        amount: Number.isFinite(amount) ? amount : 0, reference: clean(l.reference || (adv.lines && adv.lines[0] && adv.lines[0].reference) || '', PAYMENT_LIMITS.reference),
        bankCharge: 0, viaAccountId: '', viaAccountCode: '', viaAccountName: '', postingAccountId: '' });
      return;
    }
    const a = isId(l.accountId) ? accounts.get(l.accountId) : null;
    if (!a) { err('account', `Payment line ${n}: choose the account.`, i); return; }
    if (a.active === false) err('account', `Payment line ${n}: ${a.name} is inactive.`, i);
    let via = null;
    if (a.type === 'card') {
      via = isId(a.linkedBankAccountId) ? accounts.get(a.linkedBankAccountId) : null;
      if (kind === PAYMENT_KINDS.cashback) err('account', 'Cash back is received into a cash or bank account, not a card.', i);
      else if (!via || via.type !== 'bank') err('account', `${a.name} has no linked bank account — set it in Administration → Payment Accounts.`, i);
      else if (via.active === false) err('account', `${a.name}: its bank account ${via.name} is inactive.`, i);
    }
    if (!(Number.isFinite(bankCharge) && bankCharge >= 0)) err('bankCharge', `Payment line ${n}: bank charge must be a number (up to 2 decimals).`, i);
    else if (bankCharge > 0 && (a.type !== 'bank' || kind === PAYMENT_KINDS.cashback)) err('bankCharge', `Payment line ${n}: a bank charge is only for a bank transfer.`, i);
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
  const advLines = lines.filter(l => l.advanceId);
  if (advLines.length > ADVANCE_LINES_MAX) err('lines', `At most ${ADVANCE_LINES_MAX} advances in one payment.`);
  const amount = r2(lines.reduce((s, l) => s + l.amount, 0));
  const advanceTotal = r2(advLines.reduce((s, l) => s + l.amount, 0));
  const bankCharges = r2(lines.reduce((s, l) => s + l.bankCharge, 0));
  const discount = kind === PAYMENT_KINDS.payment ? money(input.discount) : 0;
  const note = clean(input.note, PAYMENT_LIMITS.note);
  if (kind === PAYMENT_KINDS.payment) {
    if (!(Number.isFinite(discount) && discount >= 0)) err('discount', 'Discount at payment must be a number (up to 2 decimals).');
    const applied = r2(amount + (Number.isFinite(discount) ? discount : 0));
    if (!(applied > 0)) err('amount', 'Enter the amount paid (or a discount).');
    else if (invoice && applied > m.balance + EPS) err('amount', `This is ${r2(applied - m.balance).toFixed(2)} more than the balance ${m.balance.toFixed(2)}. Paying more than the balance is not allowed — pay the extra as an advance.`);
  } else if (kind === PAYMENT_KINDS.cashback) {
    if (lines.length !== 1) err('lines', 'Choose the one account the cash back was received into.');
    if (lines[0] && !['cash', 'bank'].includes(lines[0].accountType)) err('account', 'Cash back is received into a cash or bank account.');
    if (!(amount > 0)) err('amount', 'Enter the amount received.');
    else if (invoice && amount > r2(m.paid - m.cashBack) + EPS) err('amount', `The cash back can't be more than what was paid on this invoice (${r2(m.paid - m.cashBack).toFixed(2)}).`);
  } else if (!(amount > 0)) err('amount', 'Enter the amount paid as advance.');
  const d = kind === PAYMENT_KINDS.payment && Number.isFinite(discount) ? discount : 0;
  const value = {
    kind, date, lines, amount, bankCharges, discount: d, note, advanceTotal,
    advanceIds: advLines.map(l => l.advanceId), advanceAmounts: Object.fromEntries(advLines.map(l => [l.advanceId, l.amount])),
    applied: kind === PAYMENT_KINDS.payment ? r2(amount + d) : 0, cashBack: kind === PAYMENT_KINDS.cashback ? amount : 0,
    ...(isAdv ? { supplier, soId: clean(input.soId, 120), soNo: clean(input.soNo, 40) } : {}),
  };
  return { ok: errors.length === 0, value, errors };
}

/**
 * The records of one payment: the payment document, its balanced ledger entry and one posting per account.
 * accounts: Map id → account (custodian, name). No entry when no money moves (only a discount / advances used).
 * entryId: the ledger entry id (default spe-<payment>); a full edit posts a NEW entry (…-r<revision>).
 */
export function buildSupplierPaymentRecords({ id, spNo, value, invoice, accounts, actor, at, stamp, operationId, entryId: entryIdIn = null, revision = 1 }) {
  const isCb = value.kind === PAYMENT_KINDS.cashback, isAdv = value.kind === PAYMENT_KINDS.advance;
  const entryKind = LEDGER_KIND_OF[value.kind];
  const sup = clean(isAdv ? value.supplier.supplierName : invoice.supplierName, 200);
  const description = clean(isAdv ? `Advance to ${sup}${value.soNo ? ' · ' + value.soNo : ''}` : `${isCb ? 'Cash back from' : 'Payment to'} ${sup} · ${invoice.piNo}`, 200);
  const postings = {};   // accountId → { amountIn, amountOut, memoOut, charge, viaCard, reference }
  const money_ = value.lines.filter(l => !l.advanceId);
  for (const l of money_) {
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
  const entryId = accountIds.length ? (entryIdIn || paymentEntryIdOf(id)) : '';
  const cash = r2(value.amount - (value.advanceTotal || 0));
  const moved = isCb ? value.amount : r2(cash + value.bankCharges);
  const outs = accountIds.filter(a => postings[a].amountOut > 0).map(a => ({ accountId: a, ledger: '', debit: 0, credit: postings[a].amountOut }));
  const journal = isCb
    ? [{ accountId: value.lines[0].postingAccountId, ledger: '', debit: value.amount, credit: 0 }, { accountId: '', ledger: 'purchase-discount', debit: 0, credit: value.amount }]
    : isAdv
      ? [{ accountId: '', ledger: 'supplier-advances', debit: value.amount, credit: 0 },
         ...(value.bankCharges > 0 ? [{ accountId: '', ledger: 'bank-charges', debit: value.bankCharges, credit: 0 }] : []), ...outs]
      : [{ accountId: '', ledger: 'supplier-payable', debit: value.applied, credit: 0 },
         ...(value.bankCharges > 0 ? [{ accountId: '', ledger: 'bank-charges', debit: value.bankCharges, credit: 0 }] : []), ...outs,
         ...(value.advanceTotal > 0 ? [{ accountId: '', ledger: 'supplier-advances', debit: 0, credit: value.advanceTotal }] : []),
         ...(value.discount > 0 ? [{ accountId: '', ledger: 'purchase-discount', debit: 0, credit: value.discount }] : [])];
  const payment = {
    id, schemaVersion: PURCHASE_SCHEMA_VERSION, kind: value.kind, spNo, operationId,
    invoiceId: isAdv ? '' : invoice.id, piNo: isAdv ? '' : invoice.piNo,
    supplierId: isAdv ? value.supplier.supplierId : (invoice.supplierId || ''), supplierName: sup, supplierKey: isAdv ? value.supplier.supplierKey : (invoice.supplierKey || ''),
    date: value.date, lines: value.lines, amount: value.amount, bankCharges: value.bankCharges, discount: value.discount,
    applied: value.applied, cashBack: value.cashBack, note: value.note, entryId,
    advanceTotal: value.advanceTotal || 0, advanceIds: value.advanceIds || [], advanceAmounts: value.advanceAmounts || {},
    ...(isAdv ? { soId: value.soId || '', soNo: value.soNo || '', advanceUsed: 0, advanceLeft: value.amount } : {}),
    status: PURCHASE_STATUS.posted, revision,
    accounting: { lines: journal },
    created: at, createdBy: actor.name, createdByUid: actor.uid, updatedAt: at, updatedBy: actor.name, updatedByUid: actor.uid, recordedAt: stamp,
  };
  if (!entryId) return { payment, entry: null, lines: [] };
  const entry = {
    id: entryId, schemaVersion: 1, kind: entryKind, paymentId: id, invoiceId: payment.invoiceId, piNo: payment.piNo,
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
      paymentId: id, invoiceId: payment.invoiceId, piNo: payment.piNo,
    };
  });
  return { payment, entry, lines };
}
/** An advance after a payment uses (+1) or gives back (−1) part of it. */
export function applyAdvanceUse(adv, amount, sign = 1) {
  const advanceUsed = r2((Number(adv.advanceUsed) || 0) + sign * (Number(amount) || 0));
  return { advanceUsed, advanceLeft: r2((Number(adv.amount) || 0) - advanceUsed) };
}

/* ═══════════════ V268.3 — edit permission, limited edits ═══════════════ */
const toMs = v => (v && typeof v === 'object' && typeof v.toMillis === 'function') ? v.toMillis()
  : (v && typeof v === 'object' && 'seconds' in v) ? v.seconds * 1000 : (Date.parse(v) || 0);
/**
 * Who may edit this document now: 'full' | 'limited' | null, and why not.
 *   doc: invoice or payment (recordedAt / created) ; settings: effective purchase settings
 */
export function editRightOf(doc, { settings = DEFAULT_PURCHASE_SETTINGS, isAdmin = false, nowMs = Date.now() } = {}) {
  if (!doc || doc.status !== PURCHASE_STATUS.posted) return { right: null, why: 'It is cancelled.' };
  const mode = settings.editMode || 'limited-admin';
  if (mode === 'off') return { right: null, why: 'Editing is switched off in Administration → Purchase Settings.' };
  const since = toMs(doc.recordedAt) || toMs(doc.created);
  const days = Number(settings.editDays);
  const expired = since && Number.isFinite(days) && nowMs - since > days * 86400000;
  if (expired && !isAdmin) return { right: null, why: `The ${days}-day edit time is over — only administrators can edit it now; or cancel it and enter it again.` };
  const full = mode === 'full' || (mode === 'limited-admin' && isAdmin);
  return { right: full ? 'full' : 'limited', why: '', until: since && Number.isFinite(days) ? new Date(since + days * 86400000).toISOString().slice(0, 10) : '' };
}
/** Limited edit of an invoice: numbers, dates and the reasons for a higher cost — the figures don't change. */
export function validateInvoiceLimitedEdit(pi, input = {}) {
  const errors = [], err = (field, message) => errors.push({ field, message });
  const supplierInvoiceNo = clean(input.supplierInvoiceNo, LIMITS.invNo);
  const zohoBillNo = clean(input.zohoBillNo, 60), date = String(input.date || '').slice(0, 10), dueDate = String(input.dueDate || '').slice(0, 10);
  const reason = clean(input.reason, LIMITS.reason);
  if (!supplierInvoiceNo) err('supplierInvoiceNo', 'Enter the supplier invoice no.');
  if (!isDate(date)) err('date', 'Enter the invoice date.');
  if (!isDate(dueDate)) err('dueDate', 'Enter the payment due date.');
  else if (isDate(date) && dueDate < date) err('dueDate', 'The due date can\'t be before the invoice date.');
  if (!reason) err('reason', 'Enter the reason for the change.');
  const reasons = input.costReasons || {};
  const lines = (pi.lines || []).map(l => {
    if (!(String(l.lineNo) in reasons)) return l;
    const r = clean(reasons[l.lineNo], LIMITS.reason);
    if (l.costCheck === 'above' && !r) err('costReason', `Line ${l.lineNo}: the reason for the higher cost is required.`);
    return l.costCheck === 'above' ? { ...l, costReason: r } : l;
  });
  const changes = [];
  const ch = (field, from, to) => { if (String(from || '') !== String(to || '')) changes.push({ field, from: from || '', to: to || '' }); };
  ch('supplierInvoiceNo', pi.supplierInvoiceNo, supplierInvoiceNo); ch('zohoBillNo', pi.zohoBillNo, zohoBillNo); ch('date', pi.date, date); ch('dueDate', pi.dueDate, dueDate);
  lines.forEach((l, i) => ch(`line ${l.lineNo} reason`, (pi.lines[i] || {}).costReason, l.costReason));
  if (!changes.length) err('changes', 'Nothing was changed.');
  return { ok: errors.length === 0, value: { supplierInvoiceNo, supplierInvoiceKey: invoiceNoKeyOf(supplierInvoiceNo), zohoBillNo, date, dueDate, lines, reason }, changes, errors };
}
/** Limited edit of a payment: the references and the note — the money doesn't change. */
export function validatePaymentLimitedEdit(pay, input = {}) {
  const errors = [];
  const refs = Array.isArray(input.references) ? input.references : [];
  const lines = (pay.lines || []).map((l, i) => ({ ...l, reference: clean(refs[i] != null ? refs[i] : l.reference, PAYMENT_LIMITS.reference) }));
  const note = clean(input.note != null ? input.note : pay.note, PAYMENT_LIMITS.note);
  const reason = clean(input.reason, LIMITS.reason);
  if (!reason) errors.push({ field: 'reason', message: 'Enter the reason for the change.' });
  const changes = [];
  lines.forEach((l, i) => { if ((pay.lines[i].reference || '') !== l.reference) changes.push({ field: `line ${i + 1} reference`, from: pay.lines[i].reference || '', to: l.reference }); });
  if ((pay.note || '') !== note) changes.push({ field: 'note', from: pay.note || '', to: note });
  if (!changes.length) errors.push({ field: 'changes', message: 'Nothing was changed.' });
  return { ok: errors.length === 0, value: { lines, note, reason }, changes, errors };
}

/* ═══════════════════════ V268.4 STOCK — allocate stock to a sales order line ═══════════════════════
 * stockAllocations/{SA-…}: { itemKey, soId, soNo, soLineId, qty, unitCost (average landed cost at that moment),
 *   value, sellUnit, date, note, status Posted|Voided, revision, lastEventId }.
 * Allocating counts the quantity as bought for the order line (salesOrderPurchasing.lines[line].purchased and
 * .fromStock) and takes it out of stock at the average cost; no money moves. Cancelling puts it back. */
export const STOCK_ALLOC_COLLECTION = 'stockAllocations';
export const allocationIdForOperation = op => { const k = String(op || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 200); return k.length >= 8 ? 'SA-' + k : ''; };
/** Average landed cost of what is in stock now. */
export function avgCostOf(item) {
  const q = Number(item && item.qty) || 0, v = Number(item && item.value) || 0;
  return q > 1e-9 ? Math.round((v / q) * 10000) / 10000 : 0;
}
/** The sales order lines (open, something still to buy) for the same item as a stock item. */
export function openDemandOf(item, orders, ledgers) {
  const out = [];
  (orders || []).forEach(so => {
    if (!so || /cancel|void|closed/i.test(String(so.status || ''))) return;
    (so.items || []).forEach(it => {
      if (!it || !it.lineId) return;
      if (itemKeyOf({ productId: it.prodId || it.productId, code: it.code, desc: it.desc, uom: it.uom }) !== item.itemKey) return;
      const left = stillToBuy(it.qty, ((ledgers.get(so.id) || {}).lines || {})[it.lineId]);
      if (left > 1e-9) out.push({ soId: so.id, soNo: so.soNo || '', customer: so.customer || '', soLineId: it.lineId, lineNo: (so.items || []).indexOf(it) + 1, desc: it.desc || '', ordered: Number(it.qty) || 0, left, sellUnit: Number(it.up) || 0 });
    });
  });
  return out.sort((a, b) => String(a.soNo).localeCompare(String(b.soNo), undefined, { numeric: true }));
}
/**
 * input: { itemKey, soId, soLineId, qty, date, note }
 * ctx:   { item (stockItems doc), so (salesOrders doc), ledger (salesOrderPurchasing doc or null), today }
 */
export function validateAllocation(input = {}, { item = null, so = null, ledger = null, today = new Date().toISOString().slice(0, 10) } = {}) {
  const errors = [], err = (field, message) => errors.push({ field, message });
  const qty = rq(num(input.qty)), date = String(input.date || '').slice(0, 10), note = clean(input.note, 200);
  if (!item) err('item', 'This stock item no longer exists.');
  const line = so && (so.items || []).find(x => x && x.lineId === input.soLineId);
  if (!so || !line) err('soLine', 'Choose the sales order line.');
  if (!isDate(date)) err('date', 'Enter the date.'); else if (date > today) err('date', 'The date can\'t be in the future.');
  if (!(qty > 0)) err('qty', 'Enter the quantity.');
  let left = 0;
  if (item && line) {
    if (/cancel|void|closed/i.test(String(so.status || ''))) err('soLine', `${so.soNo} is ${String(so.status).toLowerCase()}.`);
    if (itemKeyOf({ productId: line.prodId || line.productId, code: line.code, desc: line.desc, uom: line.uom }) !== item.itemKey) err('soLine', `${so.soNo} line is not for ${item.desc}.`);
    left = stillToBuy(line.qty, ((ledger || {}).lines || {})[line.lineId]);
    if (qty > left + 1e-9) err('qty', `${so.soNo} needs only ${left} more.`);
    if (qty > (Number(item.qty) || 0) + 1e-9) err('qty', `Only ${Number(item.qty) || 0} in stock.`);
  }
  const unitCost = avgCostOf(item);
  const value = r2(unitCost * (Number.isFinite(qty) ? qty : 0));
  return { ok: errors.length === 0, errors, value: { itemKey: item ? item.itemKey : '', desc: item ? clean(item.desc, 500) : '', uom: item ? clean(item.uom, 30) : '',
    soId: so ? so.id : '', soNo: so ? clean(so.soNo, 40) : '', customer: so ? clean(so.customer, 200) : '', soLineId: line ? line.lineId : '',
    qty, unitCost, value, sellUnit: line ? r4(Number(line.up) || 0) : 0, date, note, left } };
}

/* ───────── V268.5: Change Item (the wrong item was chosen on a purchase invoice) ─────────
   stockChanges/{SC-op}: part or all of one stock item moves to the correct product at the same average cost.
   Same unit only; reason required; administrators; can be cancelled (with a reason) while the stock is still there. */
export const STOCK_CHANGE_COLLECTION = 'stockChanges';
export const stockChangeIdForOperation = op => { const k = String(op || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 200); return k.length >= 8 ? 'SC-' + k : ''; };
export function validateStockChange(input = {}, { item = null, product = null, today = new Date().toISOString().slice(0, 10) } = {}) {
  const errors = [], err = (field, message) => errors.push({ field, message });
  const qty = rq(num(input.qty)), reason = clean(input.reason, 300), date = String(input.date || today).slice(0, 10);
  if (!item) err('item', 'This stock item no longer exists.');
  if (!product || !clean(product.id, 120)) err('product', 'Choose the correct product from the list.');
  if (!(qty > 0)) err('qty', 'Enter the quantity.');
  else if (item && qty > (Number(item.qty) || 0) + 1e-9) err('qty', `Only ${Number(item.qty) || 0} in stock.`);
  if (reason.length < 5) err('reason', 'Give the reason (at least 5 characters).');
  if (!isDate(date)) err('date', 'Enter the date.'); else if (date > today) err('date', 'The date can\'t be in the future.');
  let toKey = '', toUom = '';
  if (item && product && product.id) {
    toUom = clean(product.uom, 30) || clean(item.uom, 30);
    toKey = itemKeyOf({ productId: product.id, code: product.code, desc: product.name, uom: toUom });
    if (toKey === item.itemKey) err('product', 'Choose a different product — this is the same item.');
    if (String(toUom).trim().toLowerCase() !== String(item.uom || '').trim().toLowerCase()) err('product', `The units must be the same (${item.uom || '—'} → ${toUom || '—'}).`);
  }
  const unitCost = avgCostOf(item);
  const all = item && Math.abs(qty - (Number(item.qty) || 0)) < 1e-9;
  const value = all ? r2(Number(item.value) || 0) : r2(unitCost * (Number.isFinite(qty) ? qty : 0));
  return { ok: errors.length === 0, errors, value: {
    fromKey: item ? item.itemKey : '', fromDesc: item ? clean(item.desc, 500) : '', fromCode: item ? clean(item.code, 100) : '', uom: item ? clean(item.uom, 30) : '',
    toKey, toProductId: product ? clean(product.id, 120) : '', toCode: product ? clean(product.code, 100) : '', toDesc: product ? clean(product.name, 500) : '',
    qty, unitCost, value, reason, date } };
}
