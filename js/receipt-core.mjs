/**
 * BizCore V266 — Customer payment receipts: domain core (pure functions, no I/O).
 *
 * Shared by the browser, the receipt transaction service and the tests.
 *
 * Data (all written by js/receipt-service.mjs in ONE transaction per operation):
 *   customerReceipts/{rctId}                       the receipt: customer, money, allocations, status
 *   customerReceipts/{rctId}/receiptEvents/{id}    immutable history (posted / applied / voided)
 *   invoicePayments/{invoiceId}                    what has been paid on an invoice: { paid, receipts{} }
 *   receiptZohoNumbers/{key}                       claims a Zoho payment no. (no duplicates)
 * Invoices themselves are never written: their figures stay immutable, and receipts need no
 * Sales Order lock (one receipt may settle invoices of several orders).
 *
 * Balance due of an invoice = invoice total − credit notes − payments received.
 * Hard rules:
 *   1. A receipt never applies more to an invoice than its balance due.
 *   2. The amounts applied never exceed the amount received (the rest stays "unapplied").
 *   3. All invoices on a receipt belong to the receipt's customer.
 *   4. A voided receipt keeps its number; its applied amounts go back to the invoices.
 */
import { DeliveryError, isSafeId, operationKey } from './delivery-core.mjs?v=266.0';
import { ERR as INV_ERR, r2, zohoNoKey, permitted, PERMISSION_LEVELS } from './invoice-core.mjs?v=266.0';

export { r2, zohoNoKey, permitted, PERMISSION_LEVELS };
export const RECEIPT_COLLECTIONS = Object.freeze({
  receipts: 'customerReceipts',
  receiptEvents: 'receiptEvents',        // customerReceipts/{id}/receiptEvents/{eventId}
  invoicePayments: 'invoicePayments',    // invoicePayments/{invoiceId}
  zohoNumbers: 'receiptZohoNumbers',     // one document per Zoho payment number
});
export const RECEIPT_SCHEMA_VERSION = 1;
export const RECEIPT_SETTINGS_PATH = ['settings', 'receipts'];
export const RECEIPT_STATUS = Object.freeze({ posted: 'Posted', voided: 'Voided' });
export const PAYMENT_METHODS = Object.freeze(['Bank transfer', 'Cheque', 'Cash', 'POS / card', 'Other']);
export const RECEIPT_DEFAULTS = Object.freeze({
  zohoPaymentNo: 'mandatory',   // 'mandatory' | 'optional'
  allowRecord: 'all',           // who may record receipts and apply unapplied money: 'all' | 'admin'
  allowVoid: 'admin',           // who may void receipts: 'all' | 'admin'
  accounts: [],                 // "Deposited to" accounts; when empty the field is optional free text
});
export const ERR = Object.freeze({
  ...INV_ERR,
  OVER_APPLY: 'over-apply',
  OVER_RECEIPT: 'over-receipt',
  WRONG_CUSTOMER: 'wrong-customer',
  DUPLICATE_ZOHO_PAYMENT: 'duplicate-zoho-payment',
});
export const MONEY_EPSILON = 0.005;
export const MAX_ALLOCATIONS = 100;

const fail = (code, message, details) => { throw new DeliveryError(code, message, details); };
const ensure = (ok, code, message, details) => { if (!ok) fail(code, message, details); };
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

export const receiptIdForOperation = operationId => 'RCT-' + operationKey(operationId);

/* ───────────────────────── settings ───────────────────────── */
const cleanAccount = v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, 60);
export function effectiveReceiptSettings(stored) {
  const out = { ...RECEIPT_DEFAULTS, accounts: [] };
  if (stored && ['mandatory', 'optional'].includes(stored.zohoPaymentNo)) out.zohoPaymentNo = stored.zohoPaymentNo;
  for (const k of ['allowRecord', 'allowVoid']) if (stored && ['all', 'admin'].includes(stored[k])) out[k] = stored[k];
  if (stored && Array.isArray(stored.accounts)) out.accounts = [...new Set(stored.accounts.map(cleanAccount).filter(Boolean))].slice(0, 20);
  return out;
}
export function validateReceiptSettings(input) {
  const errors = [], value = { ...RECEIPT_DEFAULTS, accounts: [] };
  if (!['mandatory', 'optional'].includes(input?.zohoPaymentNo)) errors.push({ field: 'zohoPaymentNo', message: 'Choose whether the Zoho payment no. is mandatory.' });
  else value.zohoPaymentNo = input.zohoPaymentNo;
  for (const k of ['allowRecord', 'allowVoid']) {
    if (!['all', 'admin'].includes(input?.[k])) errors.push({ field: k, message: 'Choose who may do this (all users or administrators).' });
    else value[k] = input[k];
  }
  const acc = Array.isArray(input?.accounts) ? input.accounts.map(cleanAccount).filter(Boolean) : [];
  if (acc.length > 20) errors.push({ field: 'accounts', message: 'At most 20 accounts.' });
  value.accounts = [...new Set(acc)].slice(0, 20);
  return { ok: errors.length === 0, errors, value };
}

/* ───────────────────────── invoice balances ───────────────────────── */
/** Invoice total after credit notes (incl. VAT). */
export function invoiceNet(invoice) {
  const total = num(invoice?.totals?.total);
  const credited = (invoice?.creditNotes || []).reduce((s, c) => s + num(c.total), 0);
  return r2(total - credited);
}
/** Paid on the invoice (from invoicePayments/{invoiceId}). */
export const invoicePaid = payment => r2(num(payment?.paid));
/** Balance due; negative = overpaid (a credit note issued after payment). */
export const invoiceBalance = (invoice, payment) => r2(invoiceNet(invoice) - invoicePaid(payment));
const isoToday = () => new Date().toISOString().slice(0, 10);
/** 'Paid' | 'Partially paid' | 'Unpaid' | 'Overdue' | 'Overpaid' | 'Credited' */
export function invoicePaymentStatus(invoice, payment, today = isoToday()) {
  const net = invoiceNet(invoice), paid = invoicePaid(payment), bal = r2(net - paid);
  if (net <= MONEY_EPSILON && paid <= MONEY_EPSILON) return 'Credited';
  if (bal < -MONEY_EPSILON) return 'Overpaid';
  if (bal <= MONEY_EPSILON) return 'Paid';
  if (invoice?.dueDate && invoice.dueDate < today) return 'Overdue';
  return paid > MONEY_EPSILON ? 'Partially paid' : 'Unpaid';
}
/** Open invoices of a customer, oldest first: [{ invoice, payment, balance }]. */
export function openInvoicesFor(custKey, invoices, payments) {
  const pay = payments instanceof Map ? payments : new Map(Object.entries(payments || {}));
  return (invoices || []).filter(i => customerKeyOf(i) === custKey)
    .map(invoice => { const payment = pay.get(invoice.id) || null; return { invoice, payment, balance: invoiceBalance(invoice, payment) }; })
    .filter(x => x.balance > MONEY_EPSILON)
    .sort((a, b) => String(a.invoice.date || '').localeCompare(String(b.invoice.date || '')) || String(a.invoice.invNo || '').localeCompare(String(b.invoice.invNo || ''), undefined, { numeric: true }));
}
/** A customer is identified by its master ID, or by its name when the document has no ID. */
export function customerKeyOf(doc) {
  const id = String(doc?.custId || '').trim();
  if (id) return 'id:' + id;
  return 'name:' + String(doc?.customer || '').trim().toLowerCase();
}
/** Oldest first: fills each open invoice until the amount is used up. */
export function autoApply(amount, open) {
  let left = r2(amount); const out = [];
  for (const x of open) {
    if (left <= MONEY_EPSILON) break;
    const a = r2(Math.min(left, x.balance));
    if (a > MONEY_EPSILON) { out.push({ invoiceId: x.invoice.id, amount: a }); left = r2(left - a); }
  }
  return out;
}

/* ───────────────────────── validation ───────────────────────── */
/** Cleans and checks allocations against the current invoices and payments. Throws DeliveryError. */
export function checkAllocations({ custKey, available, allocations, invoices, payments }) {
  ensure(Array.isArray(allocations), ERR.INVALID_INPUT, 'Allocations must be a list');
  ensure(allocations.length <= MAX_ALLOCATIONS, ERR.INVALID_INPUT, `At most ${MAX_ALLOCATIONS} invoices per receipt`);
  const seen = new Set(), out = [];
  let total = 0;
  for (const a of allocations) {
    const amount = r2(a?.amount);
    if (amount <= MONEY_EPSILON) continue;
    ensure(isSafeId(a.invoiceId), ERR.INVALID_INPUT, 'Invoice reference required');
    ensure(!seen.has(a.invoiceId), ERR.INVALID_INPUT, 'The same invoice appears twice on the receipt');
    seen.add(a.invoiceId);
    const invoice = invoices.get(a.invoiceId);
    ensure(invoice, ERR.NOT_FOUND, 'An invoice on this receipt no longer exists');
    ensure(customerKeyOf(invoice) === custKey, ERR.WRONG_CUSTOMER, `${invoice.invNo} belongs to another customer (${invoice.customer || '—'})`);
    const balance = invoiceBalance(invoice, payments.get(a.invoiceId));
    ensure(amount <= balance + MONEY_EPSILON, ERR.OVER_APPLY,
      `${invoice.invNo}: ${amount.toFixed(2)} is more than its balance due (${Math.max(0, balance).toFixed(2)}). The latest balances have been loaded — please check and try again.`,
      { invoiceId: a.invoiceId, balance });
    total = r2(total + amount);
    out.push({ invoiceId: invoice.id, invNo: invoice.invNo || '', invDate: invoice.date || '', invTotal: invoiceNet(invoice),
      salesOrderId: invoice.salesOrderId || '', soNo: invoice.soNo || '', amount, balanceBefore: balance });
  }
  ensure(total <= r2(available) + MONEY_EPSILON, ERR.OVER_RECEIPT,
    `The amounts applied (${total.toFixed(2)}) are more than the money available on the receipt (${r2(available).toFixed(2)}).`);
  return { allocations: out, total };
}
/** Header fields of a new receipt. Throws DeliveryError on invalid input. */
export function checkReceiptHeader(input, settings) {
  const amount = r2(input?.amount);
  ensure(Number.isFinite(Number(input?.amount)) && amount > MONEY_EPSILON, ERR.INVALID_INPUT, 'Enter the amount received');
  ensure(amount < 1e11, ERR.INVALID_INPUT, 'The amount is too large');
  ensure(PAYMENT_METHODS.includes(input?.method), ERR.INVALID_INPUT, 'Choose the payment method');
  const account = cleanAccount(input?.account);
  if (settings.accounts.length) ensure(settings.accounts.includes(account), ERR.INVALID_INPUT, 'Choose the account the money was deposited to');
  const zohoPaymentNo = String(input?.zohoPaymentNo == null ? '' : input.zohoPaymentNo).trim().slice(0, 100);
  const key = zohoPaymentNo ? zohoNoKey(zohoPaymentNo) : '';
  if (settings.zohoPaymentNo === 'mandatory') ensure(!!key, ERR.INVALID_INPUT, 'Enter the Zoho payment no. (record the payment in Zoho Books first).');
  ensure(!key || key.length <= 600, ERR.INVALID_INPUT, 'The Zoho payment no. is too long');
  return { amount, method: input.method, account, zohoPaymentNo, zohoPaymentNoKey: key };
}

/* ───────────────────────── invoicePayments records ───────────────────────── */
/** Adds (sign +1) or removes (sign −1) a receipt's amount on an invoice payment record. */
export function applyToPayment(payment, invoice, { rctId, rctNo, date, amount }, sign, at) {
  const receipts = { ...((payment && payment.receipts) || {}) };
  const prev = num(receipts[rctId]?.amount);
  const nextAmt = r2(prev + sign * amount);
  if (nextAmt > MONEY_EPSILON) receipts[rctId] = { rctNo, date, amount: nextAmt };
  else delete receipts[rctId];
  const paid = r2(Object.values(receipts).reduce((s, r) => s + num(r.amount), 0));
  return {
    id: invoice.id, invoiceId: invoice.id, invNo: invoice.invNo || '', salesOrderId: invoice.salesOrderId || '',
    custId: invoice.custId || '', customer: invoice.customer || '', paid, receipts,
    revision: (Number(payment?.revision) || 0) + 1, lastReceiptId: rctId, updatedAt: at,
  };
}
/** Receipt figures after its allocations changed. */
export function receiptTotals(amount, allocations) {
  const applied = r2((allocations || []).reduce((s, a) => s + num(a.amount), 0));
  return { applied, unapplied: r2(r2(amount) - applied) };
}
/** Merges extra allocations into the existing ones (same invoice → amounts added). */
export function mergeAllocations(existing, extra) {
  const map = new Map((existing || []).map(a => [a.invoiceId, { ...a }]));
  for (const a of extra) {
    const cur = map.get(a.invoiceId);
    if (cur) map.set(a.invoiceId, { ...cur, amount: r2(num(cur.amount) + a.amount) });
    else map.set(a.invoiceId, { ...a });
  }
  return [...map.values()];
}

/* ───────────────────────── words ───────────────────────── */
const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
function below1000(n) {
  const h = Math.floor(n / 100), r = n % 100;
  const rest = r < 20 ? ONES[r] : TENS[Math.floor(r / 10)] + (r % 10 ? '-' + ONES[r % 10] : '');
  return [h ? ONES[h] + ' hundred' : '', rest].filter(Boolean).join(' and ');
}
function intWords(n) {
  if (n === 0) return 'zero';
  const parts = []; const units = [[1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']];
  for (const [v, w] of units) { if (n >= v) { parts.push(below1000(Math.floor(n / v)) + ' ' + w); n %= v; } }
  if (n) parts.push(below1000(n));
  return parts.join(' ');
}
/** "Forty-five thousand Saudi Riyals and 50 halalas only" */
export function amountInWords(amount) {
  const v = r2(Math.abs(num(amount)));
  const riyals = Math.floor(v), halalas = Math.round((v - riyals) * 100);
  let s = intWords(riyals) + ' Saudi Riyal' + (riyals === 1 ? '' : 's');
  if (halalas) s += ' and ' + intWords(halalas) + ' halala' + (halalas === 1 ? '' : 's');
  s += ' only';
  return s.charAt(0).toUpperCase() + s.slice(1);
}
