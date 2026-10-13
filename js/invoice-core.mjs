/**
 * BizCore — Customer invoicing domain core (pure functions, no I/O).
 *
 * Shared by the browser, the invoice transaction service, the migration tool and the tests.
 *
 * Invoice types
 *   delivery  invoices accepted goods            limit per line: accepted − invoiced (both kinds)
 *   order     bills goods ahead of delivery      limit per line: ordered − invoiced            (reason required)
 *   advance   a down payment (amount, no qty)    % of order | % of selected lines | full order value
 *
 * Billing state lives in the Sales Order fulfillment ledger (salesOrderFulfillment/{soId}), next to the
 * delivery quantities, so every rule is checked inside ONE transaction against ONE document:
 *   lines.{lineId}.invoicedDelivery   qty invoiced by delivery invoices (net of credit notes)
 *   lines.{lineId}.invoicedAhead      qty invoiced by order invoices    (net of credit notes)
 *   billing.goodsValue                value of goods invoiced (net of credit notes)
 *   billing.advances.{invoiceId}      { invNo, date, subtotal, vatRate, deducted, credited }
 *
 * Hard rules (whatever the Administration settings):
 *   1. Never bill more than the order: goods + advances − deductions ≤ order value (before VAT).
 *   2. A deduction never exceeds the advance remaining nor the goods value of its invoice.
 *   3. The invoice that makes the order fully invoiced must deduct all remaining advance.
 *   4. An advance that was deducted cannot be credited (only its undeducted part).
 *   5. Accepted quantity may never fall below the quantity invoiced by delivery invoices
 *      (enforced by the Delivery Note service).
 */
import { ERR as DN_ERR, DeliveryError, roundQty, soLineIndex, isSafeId, operationKey } from './delivery-core.mjs?v=266.0';

export const INVOICE_COLLECTIONS = Object.freeze({
  invoices: 'customerInvoices',
  creditNotes: 'creditNotes',
  invoiceEvents: 'invoiceEvents',      // customerInvoices/{id}/invoiceEvents/{eventId}
  creditNoteEvents: 'creditNoteEvents', // creditNotes/{id}/creditNoteEvents/{eventId}
  zohoNumbers: 'invoiceZohoNumbers',    // V264.7: one document per Zoho invoice number → no duplicates
});
export const INVOICE_SCHEMA_VERSION = 1;
export const INVOICE_TYPES = Object.freeze({ delivery: 'delivery', order: 'order', advance: 'advance' });
export const ADVANCE_METHODS = Object.freeze({ percentOrder: 'percentOrder', percentLines: 'percentLines', full: 'full' });
export const DEDUCTION_METHODS = Object.freeze({ auto: 'auto-editable', fixed: 'auto-fixed', manual: 'manual' });
export const PERMISSION_LEVELS = Object.freeze({ all: 'all', admin: 'admin', none: 'none' });
export const BILLING_SETTINGS_PATH = ['settings', 'billing'];
export const BILLING_DEFAULTS = Object.freeze({
  deductionMethod: DEDUCTION_METHODS.auto,
  allowOrderInvoices: PERMISSION_LEVELS.admin,
  allowAdvanceInvoices: PERMISSION_LEVELS.admin,
  allowCreditNotes: PERMISSION_LEVELS.admin,
});
export const ERR = Object.freeze({
  ...DN_ERR,
  OVER_INVOICE: 'over-invoice',
  OVER_BILLING: 'over-billing',
  DEDUCTION: 'invalid-deduction',
  PERMISSION: 'not-permitted',
  OVER_CREDIT: 'over-credit',
  DUPLICATE_ZOHO: 'duplicate-zoho-number',
});
/** V264.7: Zoho invoice number as compared for duplicates (case, spaces ignored). */
export function normalizeZohoNo(v){ return String(v == null ? '' : v).normalize('NFKC').toUpperCase().replace(/\s+/g, ''); }
/** Firestore document ID for a Zoho number: letters, digits and '-' kept, anything else as _xxxx (hex). */
export function zohoNoKey(v){
  const n = normalizeZohoNo(v);
  if (!n) return '';
  return 'z_' + Array.from(n).map(ch => /[A-Z0-9-]/.test(ch) ? ch : '_' + ch.codePointAt(0).toString(16).padStart(4, '0')).join('');
}
export const MONEY_EPSILON = 0.005;
export const QTY_EPSILON = 1e-6;

const fail = (code, message, details) => { throw new DeliveryError(code, message, details); };
const ensure = (ok, code, message, details) => { if (!ok) fail(code, message, details); };

/** Money: always 2 decimals, half away from zero. */
export const r2 = n => { const v = Number(n) || 0; return Math.sign(v) * Math.round((Math.abs(v) + Number.EPSILON) * 100) / 100; };

export const invoiceIdForOperation = operationId => 'INV-' + operationKey(operationId);
export const creditNoteIdForOperation = operationId => 'CN-' + operationKey(operationId);

/* ───────────────────────── settings ───────────────────────── */

export function effectiveBillingSettings(stored) {
  const out = { ...BILLING_DEFAULTS };
  if (stored && Object.values(DEDUCTION_METHODS).includes(stored.deductionMethod)) out.deductionMethod = stored.deductionMethod;
  for (const k of ['allowOrderInvoices', 'allowAdvanceInvoices', 'allowCreditNotes']) {
    if (stored && Object.values(PERMISSION_LEVELS).includes(stored[k])) out[k] = stored[k];
  }
  if (out.allowCreditNotes === PERMISSION_LEVELS.none) out.allowCreditNotes = PERMISSION_LEVELS.admin; // corrections must stay possible
  return out;
}
export function validateBillingSettings(input) {
  const errors = [];
  const value = { ...BILLING_DEFAULTS };
  if (!Object.values(DEDUCTION_METHODS).includes(input?.deductionMethod)) errors.push({ field: 'deductionMethod', message: 'Choose how advances are deducted.' });
  else value.deductionMethod = input.deductionMethod;
  for (const k of ['allowOrderInvoices', 'allowAdvanceInvoices']) {
    if (!Object.values(PERMISSION_LEVELS).includes(input?.[k])) errors.push({ field: k, message: 'Choose who may issue this invoice type.' });
    else value[k] = input[k];
  }
  if (![PERMISSION_LEVELS.all, PERMISSION_LEVELS.admin].includes(input?.allowCreditNotes)) errors.push({ field: 'allowCreditNotes', message: 'Credit notes must be allowed for administrators at least.' });
  else value.allowCreditNotes = input.allowCreditNotes;
  return { ok: errors.length === 0, errors, value };
}
/** Is this type allowed for the user? level = 'all' | 'admin' | 'none'. */
export function permitted(level, isAdmin) {
  return level === PERMISSION_LEVELS.all || (level === PERMISSION_LEVELS.admin && !!isAdmin);
}
export function permissionFor(type, settings) {
  if (type === INVOICE_TYPES.order) return settings.allowOrderInvoices;
  if (type === INVOICE_TYPES.advance) return settings.allowAdvanceInvoices;
  if (type === 'credit') return settings.allowCreditNotes;
  return PERMISSION_LEVELS.all;
}

/* ───────────────────────── order & ledger state ───────────────────────── */

export const lineVatRate = (so, line) => { const r = Number(line?.vatRate); return Number.isFinite(r) && r >= 0 ? r : (Number.isFinite(Number(so?.vatRate)) ? Number(so.vatRate) : 0.15); };
export const linePrice = line => { const p = Number(line?.up); return Number.isFinite(p) && p >= 0 ? p : 0; };
/** Order value before VAT. */
export function orderValue(so) {
  return r2((so?.items || []).reduce((s, l) => s + (Number(l.qty) || 0) * linePrice(l), 0));
}
export function billingOf(ledger) {
  const b = ledger?.billing || {};
  return { goodsValue: r2(b.goodsValue || 0), advances: { ...(b.advances || {}) } };
}
export function advanceTotals(billing) {
  let invoiced = 0, deducted = 0, credited = 0;
  for (const a of Object.values(billing.advances || {})) { invoiced += Number(a.subtotal) || 0; deducted += Number(a.deducted) || 0; credited += Number(a.credited) || 0; }
  invoiced = r2(invoiced); deducted = r2(deducted); credited = r2(credited);
  return { invoiced, deducted, credited, net: r2(invoiced - credited), remaining: r2(invoiced - credited - deducted) };
}
/** What the customer has been billed so far (before VAT): goods + advances − deductions. */
export function netBilled(billing) {
  const a = advanceTotals(billing);
  return r2(billing.goodsValue + a.net - a.deducted);
}

/** Per-line state for the invoice screens and for validation. */
export function invoiceLineStates(so, ledger) {
  const index = soLineIndex(so);
  const out = [];
  for (const [lineId, ref] of index) {
    const l = ledger?.lines?.[lineId] || {};
    const ordered = ref.ordered;
    const accepted = roundQty(Math.min(ordered, Number(l.accepted) || 0));
    const invD = roundQty(Number(l.invoicedDelivery) || 0), invA = roundQty(Number(l.invoicedAhead) || 0);
    const invoiced = roundQty(invD + invA);
    out.push({
      lineId, index: ref.index, line: ref.line, ordered, accepted, invoicedDelivery: invD, invoicedAhead: invA, invoiced,
      availableDelivery: roundQty(Math.max(0, accepted - invoiced)),
      availableOrder: roundQty(Math.max(0, ordered - invoiced)),
      deliveryPending: roundQty(Math.max(0, invoiced - accepted)),
      up: linePrice(ref.line), vatRate: lineVatRate(so, ref.line),
    });
  }
  return out;
}
/** True when, after adding `addQty` (lineId → qty), every line is fully invoiced. */
export function fullyInvoicedAfter(states, addQty = new Map()) {
  return states.every(s => s.invoiced + (addQty.get(s.lineId) || 0) >= s.ordered - QTY_EPSILON);
}

/* ───────────────────────── goods invoices ───────────────────────── */

/**
 * Validates goods lines for a delivery/order invoice and prices them from the authoritative SO.
 * → { lines, goodsSubtotal, goodsVat, addQty }
 */
export function priceGoodsLines(so, ledger, type, inputLines) {
  ensure(type === INVOICE_TYPES.delivery || type === INVOICE_TYPES.order, ERR.INVALID_INPUT, 'Unknown invoice type');
  ensure(Array.isArray(inputLines) && inputLines.length > 0, ERR.INVALID_INPUT, 'Enter at least one invoice quantity');
  const states = new Map(invoiceLineStates(so, ledger).map(s => [s.lineId, s]));
  const seen = new Set(), lines = [], addQty = new Map();
  let goodsSubtotal = 0, goodsVat = 0;
  for (const l of inputLines) {
    ensure(l && isSafeId(l.lineId) && states.has(l.lineId), ERR.INVALID_INPUT, 'Unknown Sales Order line');
    ensure(!seen.has(l.lineId), ERR.INVALID_INPUT, 'A line appears twice');
    seen.add(l.lineId);
    const qty = roundQty(Number(l.qty));
    ensure(Number.isFinite(qty) && qty > 0, ERR.INVALID_INPUT, 'Invoice quantities must be greater than zero');
    const s = states.get(l.lineId);
    const limit = type === INVOICE_TYPES.delivery ? s.availableDelivery : s.availableOrder;
    ensure(qty <= limit + QTY_EPSILON, ERR.OVER_INVOICE,
      `"${s.line.desc || s.line.code || 'Line'}": only ${limit} can be invoiced ${type === INVOICE_TYPES.delivery ? 'from accepted deliveries' : 'against the order'} (ordered ${s.ordered}, accepted ${s.accepted}, already invoiced ${s.invoiced}).`,
      { lineId: l.lineId, limit, requested: qty });
    const subtotal = r2(qty * s.up), vat = r2(subtotal * s.vatRate);
    goodsSubtotal += subtotal; goodsVat += vat;
    addQty.set(l.lineId, qty);
    lines.push({
      lineId: s.lineId, soIdx: s.index, code: s.line.code || '', desc: s.line.desc || '', uom: s.line.uom || '',
      qty, up: s.up, vatRate: s.vatRate, subtotal, vat, total: r2(subtotal + vat),
      basis: type === INVOICE_TYPES.delivery ? 'accepted' : 'ahead',
    });
  }
  return { lines, goodsSubtotal: r2(goodsSubtotal), goodsVat: r2(goodsVat), addQty, states: [...states.values()] };
}

/**
 * Deduction limits for a goods invoice.
 * → { remaining, min, max, forced (final invoice), proposal (by method), isFinal }
 */
export function deductionLimits(so, ledger, goodsSubtotal, addQty, method) {
  const billing = billingOf(ledger);
  const adv = advanceTotals(billing);
  const value = orderValue(so);
  const states = invoiceLineStates(so, ledger);
  const isFinal = fullyInvoicedAfter(states, addQty);
  const remaining = Math.max(0, adv.remaining);
  const max = r2(Math.min(remaining, goodsSubtotal));
  // Rule 1: what must be deducted so that goods + advances − deductions stays ≤ order value
  const min = r2(Math.max(0, netBilled(billing) + goodsSubtotal - value));
  let proposal;
  if (isFinal) proposal = r2(remaining);
  else if (method === DEDUCTION_METHODS.manual) proposal = min;
  else proposal = r2(Math.min(max, Math.max(min, value > 0 ? goodsSubtotal * (adv.net / value) : 0)));
  const forced = isFinal || method === DEDUCTION_METHODS.fixed;
  return { remaining: r2(remaining), min, max, proposal: r2(Math.min(max, Math.max(min, proposal))), forced, isFinal, finalAmount: isFinal ? r2(remaining) : null };
}

/** Validates the deduction chosen for a goods invoice. */
export function checkDeduction(limits, amount, method) {
  const a = r2(amount);
  ensure(Number.isFinite(a) && a >= 0, ERR.DEDUCTION, 'Enter a valid advance deduction');
  if (limits.isFinal) {
    ensure(Math.abs(a - limits.finalAmount) <= MONEY_EPSILON, ERR.DEDUCTION,
      `This invoice completes the order, so it must deduct the whole remaining advance (${limits.finalAmount.toFixed(2)}).`, { required: limits.finalAmount });
    ensure(limits.finalAmount <= limits.max + MONEY_EPSILON, ERR.OVER_BILLING,
      'The remaining advance is larger than this final invoice. Issue a credit note for the unused advance first.', { remaining: limits.remaining, max: limits.max });
    return a;
  }
  if (method === DEDUCTION_METHODS.fixed) ensure(Math.abs(a - limits.proposal) <= MONEY_EPSILON, ERR.DEDUCTION, `The advance deduction is fixed at ${limits.proposal.toFixed(2)} (Billing Settings).`);
  ensure(a <= limits.max + MONEY_EPSILON, ERR.DEDUCTION, `The deduction cannot be more than ${limits.max.toFixed(2)} (remaining advance or invoice value).`, { max: limits.max });
  ensure(a >= limits.min - MONEY_EPSILON, ERR.OVER_BILLING,
    `At least ${limits.min.toFixed(2)} of the advance must be deducted, otherwise the customer would be billed more than the order value.`, { min: limits.min });
  return a;
}

/** Splits a deduction over the open advances, oldest first. → [{ advanceInvoiceId, advanceInvNo, advanceDate, subtotal, vatRate, vat }] */
export function allocateDeduction(billing, amount) {
  let left = r2(amount);
  const out = [];
  const open = Object.entries(billing.advances || {})
    .map(([id, a]) => ({ id, ...a, open: r2((Number(a.subtotal) || 0) - (Number(a.credited) || 0) - (Number(a.deducted) || 0)) }))
    .filter(a => a.open > MONEY_EPSILON)
    .sort((x, y) => String(x.date || '').localeCompare(String(y.date || '')) || String(x.invNo || '').localeCompare(String(y.invNo || '')));
  for (const a of open) {
    if (left <= MONEY_EPSILON) break;
    const take = r2(Math.min(left, a.open));
    const vatRate = Number(a.vatRate) || 0;
    out.push({ advanceInvoiceId: a.id, advanceInvNo: a.invNo || '', advanceDate: a.date || '', subtotal: take, vatRate, vat: r2(take * vatRate) });
    left = r2(left - take);
  }
  ensure(left <= MONEY_EPSILON, ERR.DEDUCTION, 'The deduction is larger than the advance remaining.');
  return out;
}

/* ───────────────────────── advance invoices ───────────────────────── */

/** → { base, percent, amount, vatRate, vat, lineIds } */
export function priceAdvance(so, ledger, { method, percent, lineIds }) {
  ensure(Object.values(ADVANCE_METHODS).includes(method), ERR.INVALID_INPUT, 'Choose how the advance is calculated');
  const value = orderValue(so);
  let base = value, pct = Number(percent), ids = [];
  if (method === ADVANCE_METHODS.full) pct = 100;
  if (method === ADVANCE_METHODS.percentLines) {
    const index = soLineIndex(so);
    ensure(Array.isArray(lineIds) && lineIds.length > 0, ERR.INVALID_INPUT, 'Select the lines the advance is for');
    ids = [...new Set(lineIds)];
    ids.forEach(id => ensure(index.has(id), ERR.INVALID_INPUT, 'Unknown Sales Order line'));
    base = r2(ids.reduce((s, id) => { const l = index.get(id).line; return s + (Number(l.qty) || 0) * linePrice(l); }, 0));
  }
  ensure(Number.isFinite(pct) && pct > 0 && pct <= 100, ERR.INVALID_INPUT, 'The advance percentage must be more than 0 and at most 100');
  const amount = r2(base * pct / 100);
  ensure(amount > 0, ERR.INVALID_INPUT, 'The advance amount must be greater than zero');
  const billing = billingOf(ledger);
  const room = r2(value - netBilled(billing));
  ensure(amount <= room + MONEY_EPSILON, ERR.OVER_BILLING,
    `This advance (${amount.toFixed(2)}) would bill more than the order value. At most ${Math.max(0, room).toFixed(2)} can still be billed on this order.`, { room, amount });
  const vatRate = Number.isFinite(Number(so.vatRate)) ? Number(so.vatRate) : 0.15;
  return { base, percent: r2(pct), amount, vatRate, vat: r2(amount * vatRate), lineIds: ids, method };
}

/* ───────────────────────── ledger updates ───────────────────────── */

/** Applies an issued invoice to the ledger (pure). */
export function applyInvoiceToLedger(ledger, invoice) {
  const lines = { ...(ledger?.lines || {}) };
  const billing = billingOf(ledger);
  const advances = { ...billing.advances };
  if (invoice.type === INVOICE_TYPES.advance) {
    advances[invoice.id] = { invNo: invoice.invNo, date: invoice.date, subtotal: invoice.totals.subtotal, vatRate: invoice.advance.vatRate, deducted: 0, credited: 0 };
  } else {
    const key = invoice.type === INVOICE_TYPES.delivery ? 'invoicedDelivery' : 'invoicedAhead';
    for (const l of invoice.lines) {
      const cur = lines[l.lineId] || {};
      lines[l.lineId] = { ...cur, [key]: roundQty((Number(cur[key]) || 0) + l.qty) };
    }
    billing.goodsValue = r2(billing.goodsValue + invoice.totals.goodsSubtotal);
    for (const d of invoice.deductions || []) {
      const a = advances[d.advanceInvoiceId];
      ensure(a, ERR.INCONSISTENT, 'Advance invoice not found in the ledger');
      advances[d.advanceInvoiceId] = { ...a, deducted: r2((Number(a.deducted) || 0) + d.subtotal) };
    }
  }
  return { ...(ledger || {}), lines, billing: { goodsValue: billing.goodsValue, advances } };
}

/* ───────────────────────── credit notes ───────────────────────── */

/** Remaining (not yet credited) quantities / amounts on an invoice. */
export function creditableOf(invoice) {
  const credited = invoice.credited || {};
  if (invoice.type === INVOICE_TYPES.advance) {
    return { advance: r2(invoice.totals.subtotal - (Number(credited.advanceSubtotal) || 0)) };
  }
  const lines = (invoice.lines || []).map(l => ({ ...l, creditable: roundQty(l.qty - (Number(credited.lines?.[l.lineId]) || 0)) }));
  const deductionLeft = r2((invoice.totals.deductionSubtotal || 0) - (Number(credited.deductionSubtotal) || 0));
  const goodsLeft = r2(invoice.totals.goodsSubtotal - (Number(credited.goodsSubtotal) || 0));
  return { lines, deductionLeft, goodsLeft };
}

/**
 * Builds a credit note against an invoice. input: { lines:[{lineId, qty}] } for goods invoices, { amount } for advances.
 * → { creditNote fields (without identity), ledger }
 */
export function buildCreditNote(invoice, ledger, input) {
  ensure(invoice.status !== 'Credited', ERR.INVALID_STATE, `${invoice.invNo} is already fully credited`);
  const billing = billingOf(ledger);
  const advances = { ...billing.advances };
  const lines = { ...(ledger?.lines || {}) };
  if (invoice.type === INVOICE_TYPES.advance) {
    const amount = r2(input?.amount);
    ensure(amount > 0, ERR.INVALID_INPUT, 'Enter the amount to credit');
    const a = advances[invoice.id];
    ensure(a, ERR.INCONSISTENT, 'Advance invoice not found in the ledger');
    const undeducted = r2((Number(a.subtotal) || 0) - (Number(a.credited) || 0) - (Number(a.deducted) || 0));
    ensure(amount <= undeducted + MONEY_EPSILON, ERR.OVER_CREDIT,
      `Only ${Math.max(0, undeducted).toFixed(2)} of this advance can be credited — the rest has already been deducted on later invoices.`, { undeducted });
    advances[invoice.id] = { ...a, credited: r2((Number(a.credited) || 0) + amount) };
    const vat = r2(amount * (Number(a.vatRate) || 0));
    return {
      note: { kind: 'advance', lines: [], goodsSubtotal: 0, goodsVat: 0, deductionReversal: [], advanceSubtotal: amount, advanceVat: vat, subtotal: amount, vat, total: r2(amount + vat) },
      ledger: { ...(ledger || {}), lines, billing: { goodsValue: billing.goodsValue, advances } },
      invoiceCredited: { ...(invoice.credited || {}), advanceSubtotal: r2((Number(invoice.credited?.advanceSubtotal) || 0) + amount) },
      fully: r2(invoice.totals.subtotal - ((Number(invoice.credited?.advanceSubtotal) || 0) + amount)) <= MONEY_EPSILON,
    };
  }
  const left = creditableOf(invoice);
  ensure(Array.isArray(input?.lines) && input.lines.length > 0, ERR.INVALID_INPUT, 'Enter at least one quantity to credit');
  const byId = new Map(left.lines.map(l => [l.lineId, l]));
  const seen = new Set(), noteLines = [];
  let goodsSubtotal = 0, goodsVat = 0;
  const key = invoice.type === INVOICE_TYPES.delivery ? 'invoicedDelivery' : 'invoicedAhead';
  const creditedLines = { ...(invoice.credited?.lines || {}) };
  for (const l of input.lines) {
    const src = byId.get(l?.lineId);
    ensure(src, ERR.INVALID_INPUT, 'This line is not on the invoice');
    ensure(!seen.has(l.lineId), ERR.INVALID_INPUT, 'A line appears twice');
    seen.add(l.lineId);
    const qty = roundQty(Number(l.qty));
    ensure(Number.isFinite(qty) && qty > 0, ERR.INVALID_INPUT, 'Credit quantities must be greater than zero');
    ensure(qty <= src.creditable + QTY_EPSILON, ERR.OVER_CREDIT, `"${src.desc || 'Line'}": at most ${src.creditable} can still be credited on ${invoice.invNo}.`);
    const subtotal = r2(qty * src.up), vat = r2(subtotal * src.vatRate);
    goodsSubtotal += subtotal; goodsVat += vat;
    noteLines.push({ lineId: src.lineId, soIdx: src.soIdx, code: src.code || '', desc: src.desc || '', uom: src.uom || '', qty, up: src.up, vatRate: src.vatRate, subtotal, vat, total: r2(subtotal + vat) });
    const cur = lines[src.lineId] || {};
    lines[src.lineId] = { ...cur, [key]: roundQty(Math.max(0, (Number(cur[key]) || 0) - qty)) };
    creditedLines[src.lineId] = roundQty((Number(creditedLines[src.lineId]) || 0) + qty);
  }
  goodsSubtotal = r2(goodsSubtotal); goodsVat = r2(goodsVat);
  // Reverse the invoice's advance deduction in proportion to the goods credited (all of it on full credit).
  const fully = noteLines.length === left.lines.filter(l => l.creditable > QTY_EPSILON).length
    && noteLines.every(n => Math.abs(n.qty - byId.get(n.lineId).creditable) <= QTY_EPSILON);
  let reversal = 0;
  if (left.deductionLeft > MONEY_EPSILON) {
    reversal = fully ? left.deductionLeft : r2(Math.min(left.deductionLeft, left.goodsLeft > 0 ? left.deductionLeft * goodsSubtotal / left.goodsLeft : 0));
  }
  const deductionReversal = [];
  let toReverse = reversal;
  const already = { ...(invoice.credited?.deductionByAdvance || {}) };
  for (const d of [...(invoice.deductions || [])].reverse()) {
    if (toReverse <= MONEY_EPSILON) break;
    const open = r2(d.subtotal - (Number(already[d.advanceInvoiceId]) || 0));
    const take = r2(Math.min(open, toReverse));
    if (take <= MONEY_EPSILON) continue;
    const a = advances[d.advanceInvoiceId];
    ensure(a, ERR.INCONSISTENT, 'Advance invoice not found in the ledger');
    advances[d.advanceInvoiceId] = { ...a, deducted: r2(Math.max(0, (Number(a.deducted) || 0) - take)) };
    already[d.advanceInvoiceId] = r2((Number(already[d.advanceInvoiceId]) || 0) + take);
    deductionReversal.push({ advanceInvoiceId: d.advanceInvoiceId, advanceInvNo: d.advanceInvNo, advanceDate: d.advanceDate, subtotal: take, vatRate: d.vatRate, vat: r2(take * d.vatRate) });
    toReverse = r2(toReverse - take);
  }
  const revSub = r2(deductionReversal.reduce((s, d) => s + d.subtotal, 0));
  const revVat = r2(deductionReversal.reduce((s, d) => s + d.vat, 0));
  const subtotal = r2(goodsSubtotal - revSub), vat = r2(goodsVat - revVat);
  return {
    note: { kind: 'goods', lines: noteLines, goodsSubtotal, goodsVat, deductionReversal, advanceSubtotal: 0, advanceVat: 0, subtotal, vat, total: r2(subtotal + vat) },
    ledger: { ...(ledger || {}), lines, billing: { goodsValue: r2(billing.goodsValue - goodsSubtotal), advances } },
    invoiceCredited: {
      ...(invoice.credited || {}), lines: creditedLines,
      goodsSubtotal: r2((Number(invoice.credited?.goodsSubtotal) || 0) + goodsSubtotal),
      deductionSubtotal: r2((Number(invoice.credited?.deductionSubtotal) || 0) + revSub),
      deductionByAdvance: already,
    },
    fully,
  };
}

/* ───────────────────────── read model ───────────────────────── */

/** Invoice document → the shape the existing screens use in so.invoices (display only). */
export function invoiceForDisplay(inv) {
  const credited = inv.credited || {};
  const items = (inv.lines || []).map(l => ({
    soIdx: l.soIdx, origIdx: l.soIdx, soLineId: l.lineId, code: l.code, desc: l.desc, uom: l.uom,
    qty: roundQty(l.qty - (Number(credited.lines?.[l.lineId]) || 0)), invoicedQty: l.qty,
    up: l.up, vatRate: l.vatRate, subtotal: l.subtotal, vat: l.vat, total: l.total, basis: l.basis,
  }));
  return {
    id: inv.id, invNo: inv.invNo, type: inv.type, zohoNo: inv.zohoNo || '', date: inv.date, dueDate: inv.dueDate || '', notes: inv.notes || '',
    reason: inv.reason || '', items, advance: inv.advance || null, deductions: inv.deductions || [], totals: inv.totals,
    subtotal: inv.totals.subtotal, vat: inv.totals.vat, total: inv.totals.total, status: inv.status || 'Issued', credited,
    creditNotes: inv.creditNotes || [], revision: inv.revision, created: inv.created, createdBy: inv.createdBy, independent: true,
  };
}
