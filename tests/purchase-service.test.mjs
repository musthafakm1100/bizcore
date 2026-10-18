/** V268.1 Purchase Invoices — rules and the transaction service, against the in-memory Firestore SIMULATOR. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeFirestore } from './support/fake-firestore.mjs';
import { createPurchaseService } from '../js/purchase-service.mjs';
import * as P from '../js/purchase-core.mjs';

const BOSS = { uid: 'boss', name: 'Boss' }, AISHA = { uid: 'aisha', name: 'Aisha' };
const rejectsCode = (p, code) => assert.rejects(p, e => { assert.equal(e.code, code, e.message); return true; });
const SO4 = { id: 'so4', soNo: 'SO-2610-0004', customer: 'SNC Lavalin Arabia', items: [
  { lineId: 'L1', desc: 'LED Panel 60x60', uom: 'Pcs', qty: 10, up: 160, prodId: 'p-led' },
  { lineId: 'L2', desc: 'Cable 4 mm', uom: 'Roll', qty: 3, up: 70, code: 'CB4' },
] };
const SO11 = { id: 'so11', soNo: 'SO-2610-0011', customer: 'MOHG', items: [{ lineId: 'M1', desc: 'Cable 4 mm', uom: 'Roll', qty: 4, up: 72, code: 'CB4' }] };
let op = 0;
const opId = () => 'op-pi-' + String(++op).padStart(6, '0');
const N = { counterKey: 'doc_purchaseInvoice_2610', displayPrefix: 'PI-2610-' };
function env(extra = {}) {
  const fs = createFakeFirestore();
  fs.load({ 'system/accessControl': { adminUids: ['boss'] }, 'salesOrders/so4': SO4, 'salesOrders/so11': SO11, ...extra });
  const mk = a => createPurchaseService(fs, { actor: () => a });
  return { fs, boss: mk(BOSS), aisha: mk(AISHA) };
}
const base = extra => ({ operationId: opId(), numbering: N, supplierId: 'sup1', supplierName: 'ABC Trading Est', supplierInvoiceNo: 'INV-88213',
  date: '2026-10-15', dueDate: '2026-11-14', lines: [{ kind: 'order', soId: 'so4', soLineId: 'L1', qty: 10, unitCost: 120, reference: { unit: 120, source: 'pricing' } }],
  supplierTotal: 1380, ...extra });

test('core: settings, keys, cost check, totals with discount, costs, VAT and rounding', () => {
  const s = P.effectivePurchaseSettings(null);
  assert.deepEqual(s, { costLimitPct: 5, costLimitAction: 'reason', discountMode: 'invoice', roundingLimit: 1, vatRate: 15, profitVisibility: 'admins', editMode: 'limited-admin', editDays: 7, newProductRight: 'everyone' });
  assert.equal(P.validatePurchaseSettings({ costLimitPct: 'x' }).ok, false);
  assert.equal(P.invoiceNoKeyOf(' inv-88/213 '), 'inv88213');
  assert.equal(P.itemKeyOf({ desc: 'Cable 4 mm', uom: 'Roll' }), 'd_cable-4-mm__roll');
  assert.equal(P.itemKeyOf({ code: 'CB4', desc: 'Cable 4 mm', uom: 'Roll' }), 'd_cb4__roll');
  assert.equal(P.itemKeyOf({ productId: 'p-led' }), 'p_p-led');
  assert.deepEqual(P.costCheck(120, { unit: 120, source: 'pricing' }, s).kind, 'equal');
  assert.deepEqual(P.costCheck(52, { unit: 50 }, s), { kind: 'within', pct: 4, source: 'pricing' });
  assert.deepEqual(P.costCheck(224, { unit: 200 }, s), { kind: 'above', pct: 12, source: 'pricing' });
  assert.deepEqual(P.costCheck(32.9, { unit: 35 }, s), { kind: 'below', pct: -6, source: 'pricing' });
  assert.equal(P.costCheck(10, { unit: 9.5, source: 'lastPaid' }, s).source, 'lastPaid');
  assert.equal(P.costCheck(12, null, s).kind, 'none');
  // mockup 4 figures: lines 3,434 + delivery 50 − discount 100 = 3,384; VAT 507.60; BizCore 3,891.60; supplier 3,891.00
  const t = P.computeTotals({ lines: [{ qty: 1, unitCost: 3434 }], costs: [{ amount: 50 }], discount: { mode: 'amount', value: 100 }, supplierTotal: '3,891.00' }, s);
  assert.equal(t.subtotal, 3384); assert.equal(t.vatAmount, 507.6); assert.equal(t.calcTotal, 3891.6); assert.equal(t.rounding, -0.6);
  // costs and discount shared over the lines by value → landed cost
  const t2 = P.computeTotals({ lines: [{ qty: 10, unitCost: 100 }, { qty: 1, unitCost: 1000 }], costs: [{ amount: 100 }] }, s);
  assert.deepEqual(t2.landed.map(x => x.landedUnitCost), [105, 1050]);
  const t3 = P.computeTotals({ lines: [{ qty: 2, unitCost: 100, discountPct: 10 }] }, s);
  assert.equal(t3.linesTotal, 180);
  // last paid
  const lp = P.lastPaidOf([{ id: 'a', date: '2026-09-12', piNo: 'PI-1', lines: [{ itemKey: 'k', unitCost: 9.5 }] }, { id: 'b', date: '2026-08-01', piNo: 'PI-0', lines: [{ itemKey: 'k', unitCost: 8 }] }, { id: 'c', status: 'Voided', date: '2026-10-01', lines: [{ itemKey: 'k', unitCost: 1 }] }], 'k');
  assert.deepEqual([lp.unit, lp.refNo, lp.refDate], [9.5, 'PI-1', '2026-09-12']);
});

test('core: validation — required header, extra quantity must be placed, reason above the limit, supplier total', () => {
  const settings = P.effectivePurchaseSettings(null);
  const orders = new Map([['so4', SO4], ['so11', SO11]]), ledgers = new Map();
  const v = (input, more = {}) => P.validatePurchaseInvoice({ ...base(), ...input }, { settings, orders, ledgers, ...more });
  assert.equal(v({}).ok, true, JSON.stringify(v({}).errors));
  const bad = v({ supplierName: '', supplierInvoiceNo: '', dueDate: '', supplierTotal: '' });
  assert.deepEqual([...new Set(bad.errors.map(e => e.field))].sort(), ['dueDate', 'supplier', 'supplierInvoiceNo', 'supplierTotal']);
  // 5 rolls of cable on an order that needs 3: must choose where the 2 go
  const cable = { kind: 'order', soId: 'so4', soLineId: 'L2', qty: 5, unitCost: 52, reference: { unit: 50 } };
  const t = P.computeTotals({ lines: [{ qty: 5, unitCost: 52 }] }, settings);
  const e1 = v({ lines: [cable], supplierTotal: t.calcTotal });
  assert.equal(e1.ok, false); assert.match(e1.errors[0].message, /2 more than SO-2610-0004 needs/);
  const toStock = v({ lines: [{ ...cable, extra: { to: 'stock' } }], supplierTotal: t.calcTotal });
  assert.equal(toStock.ok, true, JSON.stringify(toStock.errors));
  assert.deepEqual(toStock.value.lines[0].allocations.map(a => a.qty), [3]); assert.equal(toStock.value.lines[0].stockQty, 2);
  assert.equal(toStock.stock.get('d_cb4__roll').qty, 2);
  const toOrder = v({ lines: [{ ...cable, extra: { to: 'order', soId: 'so11', soLineId: 'M1' } }], supplierTotal: t.calcTotal });
  assert.equal(toOrder.ok, true, JSON.stringify(toOrder.errors));
  assert.deepEqual(toOrder.value.lines[0].allocations.map(a => [a.soNo, a.qty]), [['SO-2610-0004', 3], ['SO-2610-0011', 2]]);
  const wrongItem = v({ lines: [{ ...cable, extra: { to: 'order', soId: 'so4', soLineId: 'L1' } }], supplierTotal: t.calcTotal });
  assert.match(wrongItem.errors[0].message, /not for the same item/);
  // 12% above the 5% limit: reason required (or refused with "block")
  const t2 = P.computeTotals({ lines: [{ qty: 10, unitCost: 134.4 }] }, settings);
  const hi = { ...base().lines[0], unitCost: 134.4 };
  assert.match(v({ lines: [hi], supplierTotal: t2.calcTotal }).errors[0].message, /reason for the higher cost/);
  assert.equal(v({ lines: [{ ...hi, costReason: 'supplier price increase' }], supplierTotal: t2.calcTotal }).ok, true);
  const blocked = P.validatePurchaseInvoice({ ...base(), lines: [{ ...hi, costReason: 'x' }], supplierTotal: t2.calcTotal }, { settings: { ...settings, costLimitAction: 'block' }, orders, ledgers });
  assert.equal(blocked.ok, false);
  // supplier total: within ±1.00 is rounding, beyond is an error
  assert.equal(v({ supplierTotal: 1380.9 }).ok, true);
  assert.equal(v({ supplierTotal: 1380.9 }).value.totals.rounding, 0.9);
  assert.match(v({ supplierTotal: 1392 }).errors[0].message, /more than the ±1.00 rounding limit/);
  // per-line discount only when Administration allows it
  const ld = v({ lines: [{ ...base().lines[0], discountPct: 10 }], supplierTotal: 1242 });
  assert.equal(ld.value.lines[0].discountPct, 0, 'invoice-only mode ignores line discounts');
  const ld2 = P.validatePurchaseInvoice({ ...base(), lines: [{ ...base().lines[0], discountPct: 10 }], supplierTotal: 1242 }, { settings: { ...settings, discountMode: 'both' }, orders, ledgers });
  assert.equal(ld2.ok, true, JSON.stringify(ld2.errors)); assert.equal(ld2.value.totals.linesTotal, 1080);
  // stock item without an order
  const st = v({ lines: [{ kind: 'stock', productId: 'p-cable-ties-300-mm', desc: 'Cable Ties 300 mm', uom: 'Pack', qty: 10, unitCost: 12 }], supplierTotal: 138 });
  assert.equal(st.ok, true, JSON.stringify(st.errors)); assert.equal(st.value.lines[0].costCheck, 'none');
  // V268.5: an item for stock must be a product (typed text alone is refused)
  const typed = v({ lines: [{ kind: 'stock', desc: 'Cable Ties 300 mm', uom: 'Pack', qty: 10, unitCost: 12 }], supplierTotal: 138 });
  assert.equal(typed.ok, false); assert.equal(typed.errors[0].field, 'product');
  // profit: selling 160 × 10 − landed 120 × 10
  assert.deepEqual(v({}).value.profit, { sales: 1600, cost: 1200, profit: 400 });
});

test('service: record — numbered, purchased qty and stock updated, supplier invoice no. unique, retry safe', async () => {
  const { fs, aisha } = env();
  const input = base({ lines: [{ kind: 'order', soId: 'so4', soLineId: 'L2', qty: 5, unitCost: 52, reference: { unit: 50 }, extra: { to: 'stock' } }], supplierTotal: 299 });
  const r = await aisha.createPurchaseInvoice(input);
  assert.equal(r.invoice.piNo, 'PI-2610-0001'); assert.equal(r.invoice.payStatus, 'Unpaid'); assert.equal(r.invoice.balance, 299);
  assert.equal(fs.peek('salesOrderPurchasing/so4').lines.L2.purchased, 3);
  assert.equal(fs.peek('stockItems/d_cb4__roll').qty, 2);
  assert.ok(fs.peek('purchaseSupplierRefs/s_sup1__inv88213'));
  assert.ok(Object.keys(fs.dump(`purchaseInvoices/${r.invoice.id}/events/`)).length === 1);
  // same operation again: nothing new
  const again = await aisha.createPurchaseInvoice(input);
  assert.equal(again.alreadyApplied, true);
  // the same supplier invoice no. again (any spacing / case) is refused
  await rejectsCode(aisha.createPurchaseInvoice(base({ supplierInvoiceNo: 'inv 88213', lines: [{ kind: 'stock', productId: 'p-x', desc: 'X', uom: 'Pcs', qty: 1, unitCost: 10 }], supplierTotal: 11.5 })), 'duplicate-supplier-invoice');
  // nothing left to buy on that line now
  await rejectsCode(aisha.createPurchaseInvoice(base({ supplierInvoiceNo: 'INV-2', lines: [{ kind: 'order', soId: 'so4', soLineId: 'L2', qty: 1, unitCost: 50 }], supplierTotal: 57.5 })), 'invalid-input');
});

test('service: cancel reverses purchased qty and stock; refused when the stock was used; frees the invoice no.', async () => {
  const { fs, aisha } = env();
  const r = await aisha.createPurchaseInvoice(base({ lines: [{ kind: 'order', soId: 'so4', soLineId: 'L2', qty: 5, unitCost: 52, reference: { unit: 50 }, extra: { to: 'stock' } }], supplierTotal: 299 }));
  await rejectsCode(aisha.voidPurchaseInvoice({ operationId: opId(), invoiceId: r.invoice.id, reason: '' }), 'invalid-input');
  // stock used elsewhere meanwhile → refused
  fs.load({ 'stockItems/d_cb4__roll': { ...fs.peek('stockItems/d_cb4__roll'), qty: 1 } });
  await rejectsCode(aisha.voidPurchaseInvoice({ operationId: opId(), invoiceId: r.invoice.id, reason: 'wrong supplier' }), 'stock-used');
  fs.load({ 'stockItems/d_cb4__roll': { ...fs.peek('stockItems/d_cb4__roll'), qty: 2 } });
  const v = await aisha.voidPurchaseInvoice({ operationId: opId(), invoiceId: r.invoice.id, reason: 'wrong supplier', expectedRevision: 1 });
  assert.equal(v.invoice.status, 'Voided');
  assert.equal(fs.peek('salesOrderPurchasing/so4').lines.L2.purchased, 0);
  assert.equal(fs.peek('stockItems/d_cb4__roll').qty, 0);
  assert.equal(fs.peek('purchaseSupplierRefs/s_sup1__inv88213'), undefined);
  // can be recorded again correctly
  const r2 = await aisha.createPurchaseInvoice(base({ lines: [{ kind: 'order', soId: 'so4', soLineId: 'L2', qty: 3, unitCost: 52, reference: { unit: 50 } }], supplierTotal: 179.4 }));
  assert.equal(r2.invoice.piNo, 'PI-2610-0002');
});

test('service: two users buying the last units of one order line at once — only one succeeds', async () => {
  const fs = createFakeFirestore({ latencyMs: 5 });
  fs.load({ 'system/accessControl': { adminUids: [] }, 'salesOrders/so4': SO4 });
  const a = createPurchaseService(fs, { actor: () => AISHA }), b = createPurchaseService(fs, { actor: () => BOSS });
  const res = await Promise.allSettled([a.createPurchaseInvoice(base({ supplierInvoiceNo: 'A1' })), b.createPurchaseInvoice(base({ supplierInvoiceNo: 'B1' }))]);
  assert.equal(res.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal(fs.peek('salesOrderPurchasing/so4').lines.L1.purchased, 10);
});

test('service: purchase settings are for administrators only', async () => {
  const { fs, boss, aisha } = env();
  const s = { costLimitPct: 8, costLimitAction: 'block', discountMode: 'both', roundingLimit: 0.5, vatRate: 15, profitVisibility: 'everyone' };
  await rejectsCode(aisha.savePurchaseSettings(s), 'not-admin');
  const saved = await boss.savePurchaseSettings(s);
  assert.equal(saved.revision, 1); assert.equal(fs.peek('settings/purchasing').discountMode, 'both');
  await rejectsCode(boss.savePurchaseSettings({ ...s, roundingLimit: -1 }), 'invalid-input');
});
