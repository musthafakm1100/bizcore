/** V268.4 Stock — allocate stock to a sales order line, cancel the allocation (SIMULATOR). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeFirestore } from './support/fake-firestore.mjs';
import { createPurchaseService } from '../js/purchase-service.mjs';
import * as P from '../js/purchase-core.mjs';

const AISHA = { uid: 'aisha', name: 'Aisha' };
const rejectsCode = (p, code) => assert.rejects(p, e => { assert.equal(e.code, code, e.message); return true; });
const SO4 = { id: 'so4', soNo: 'SO-2610-0004', customer: 'SNC Lavalin Arabia', items: [{ lineId: 'L1', desc: 'LED Panel 60x60', uom: 'Pcs', qty: 10, up: 160, prodId: 'p-led' }] };
const SO9 = { id: 'so9', soNo: 'SO-2610-0009', customer: 'MOHG', items: [{ lineId: 'A', desc: 'LED Panel 60x60', uom: 'Pcs', qty: 3, up: 170, prodId: 'p-led' }, { lineId: 'B', desc: 'Cable 4 mm', uom: 'Roll', qty: 2, up: 70 }] };
let op = 0;
const opId = () => 'op-st-' + String(++op).padStart(6, '0');
const N = { counterKey: 'doc_purchaseInvoice_2610', displayPrefix: 'PI-2610-' };
function env() {
  const fs = createFakeFirestore();
  fs.load({ 'system/accessControl': { adminUids: ['boss'] }, 'salesOrders/so4': SO4, 'salesOrders/so9': SO9 });
  return { fs, svc: createPurchaseService(fs, { actor: () => AISHA, now: () => '2026-10-18T09:00:00.000Z', today: () => '2026-10-18' }) };
}
// 10 for SO-0004 + 4 extra to stock at 120 → stock 4 Pcs, value 480
const buy = () => ({ operationId: opId(), numbering: N, supplierId: 'sup1', supplierName: 'ABC Trading Est', supplierInvoiceNo: 'S-' + op, date: '2026-10-15', dueDate: '2026-11-14',
  lines: [{ kind: 'order', soId: 'so4', soLineId: 'L1', qty: 14, unitCost: 120, reference: { unit: 120, source: 'pricing' }, extra: { to: 'stock' } }], supplierTotal: 1932 });

test('V268.4 core: average cost, open demand, allocation checks', () => {
  assert.equal(P.avgCostOf({ qty: 3, value: 367.5 }), 122.5);
  assert.equal(P.avgCostOf({ qty: 0, value: 0 }), 0);
  const item = { itemKey: P.itemKeyOf({ productId: 'p-led' }), desc: 'LED Panel 60x60', uom: 'Pcs', qty: 4, value: 480 };
  const ledgers = new Map([['so9', { lines: { A: { purchased: 1 } } }]]);
  const d = P.openDemandOf(item, [SO4, SO9], ledgers);
  assert.deepEqual(d.map(x => [x.soNo, x.soLineId, x.left]), [['SO-2610-0004', 'L1', 10], ['SO-2610-0009', 'A', 2]]);
  const v = (input, so = SO9) => P.validateAllocation({ soLineId: 'A', qty: 2, date: '2026-10-18', ...input }, { item, so, ledger: ledgers.get(so.id), today: '2026-10-18' });
  assert.equal(v({}).ok, true); assert.deepEqual([v({}).value.unitCost, v({}).value.value], [120, 240]);
  assert.match(v({ qty: 3 }).errors[0].message, /needs only 2/);
  assert.match(v({ soLineId: 'B' }).errors[0].message, /not for LED Panel/);
  assert.match(v({ date: '2026-10-19' }).errors[0].message, /future/);
  assert.match(P.validateAllocation({ soLineId: 'L1', qty: 5, date: '2026-10-18' }, { item, so: SO4, ledger: null, today: '2026-10-18' }).errors[0].message, /Only 4 in stock/);
});

test('V268.4 allocate: stock out at average cost, the order counts it as bought (from stock); cancel puts it back', async () => {
  const { fs, svc } = env();
  const r = await svc.createPurchaseInvoice(buy());
  const key = r.invoice.lines[0].itemKey;
  assert.deepEqual([fs.peek('stockItems/' + key).qty, fs.peek('stockItems/' + key).value], [4, 480]);
  const a = await svc.allocateStock({ operationId: opId(), itemKey: key, soId: 'so9', soLineId: 'A', qty: '3', date: '2026-10-18', note: 'from the shop' });
  assert.deepEqual([a.allocation.qty, a.allocation.unitCost, a.allocation.value, a.allocation.sellUnit], [3, 120, 360, 170]);
  assert.deepEqual([fs.peek('stockItems/' + key).qty, fs.peek('stockItems/' + key).value], [1, 120]);
  assert.deepEqual(fs.peek('salesOrderPurchasing/so9').lines.A, { purchased: 3, fromStock: 3 });
  const mv = fs.peek(`stockMovements/${a.allocation.id}__out`); assert.deepEqual([mv.kind, mv.qty, mv.value, mv.soNo], ['allocated', -3, -360, 'SO-2610-0009']);
  // retried → nothing new
  assert.equal((await svc.allocateStock({ operationId: a.allocation.operationId, itemKey: key, soId: 'so9', soLineId: 'A', qty: '3', date: '2026-10-18' })).alreadyApplied, true);
  // the order line is complete now; more is refused; stock can't go below zero
  await rejectsCode(svc.allocateStock({ operationId: opId(), itemKey: key, soId: 'so9', soLineId: 'A', qty: '1', date: '2026-10-18' }), 'invalid-input');
  // an invoice later for SO-0009 keeps the "from stock" figure
  // the purchase invoice can't be cancelled now: its stock was used
  await rejectsCode(svc.voidPurchaseInvoice({ operationId: opId(), invoiceId: r.invoice.id, reason: 'entered twice' }), 'stock-used');
  // cancel the allocation: stock back at the same value, the order line open again
  const c = await svc.cancelStockAllocation({ operationId: opId(), allocationId: a.allocation.id, reason: 'wrong order' });
  assert.equal(c.allocation.status, 'Voided');
  assert.deepEqual([fs.peek('stockItems/' + key).qty, fs.peek('stockItems/' + key).value], [4, 480]);
  assert.deepEqual(fs.peek('salesOrderPurchasing/so9').lines.A, { purchased: 0, fromStock: 0 });
  assert.equal(fs.peek(`stockMovements/${a.allocation.id}__back`).kind, 'allocation-cancelled');
  await rejectsCode(svc.cancelStockAllocation({ operationId: opId(), allocationId: a.allocation.id, reason: 'again please' }), 'invalid-state');
});

test('V268.4 a purchase invoice keeps the "from stock" figure of an order line', async () => {
  const { fs, svc } = env();
  const r = await svc.createPurchaseInvoice(buy());
  const key = r.invoice.lines[0].itemKey;
  await svc.allocateStock({ operationId: opId(), itemKey: key, soId: 'so9', soLineId: 'A', qty: '1', date: '2026-10-18' });
  await svc.createPurchaseInvoice({ ...buy(), lines: [{ kind: 'order', soId: 'so9', soLineId: 'A', qty: 2, unitCost: 120, reference: { unit: 120, source: 'pricing' } }], supplierTotal: 276 });
  assert.deepEqual(fs.peek('salesOrderPurchasing/so9').lines.A, { purchased: 3, fromStock: 1 });
});

/* ───────── V268.5 Change Item ───────── */
const BOSS = { uid: 'boss', name: 'Musthafa' };
const typedWrong = () => ({ operationId: opId(), numbering: N, supplierId: 'sup1', supplierName: 'ABC Trading Est', supplierInvoiceNo: 'W-' + op, date: '2026-10-15', dueDate: '2026-11-14',
  lines: [{ kind: 'stock', productId: 'p-pel-typo', desc: 'Pelican 7600 flash light', uom: 'Pcs', qty: 3, unitCost: 620 }], supplierTotal: 2139 });
const PEL = { id: 'p-pel', name: 'Pelican 7600 flashlight', code: 'PEL7600', uom: 'Pcs' };

test('V268.5 core: Change Item checks — product, same unit, quantity, reason', () => {
  const item = { itemKey: P.itemKeyOf({ productId: 'p-pel-typo' }), desc: 'Pelican 7600 flash light', uom: 'Pcs', qty: 3, value: 1860 };
  const v = (input, product = PEL) => P.validateStockChange({ qty: 3, reason: 'typed wrong on the PI', ...input }, { item, product, today: '2026-10-18' });
  assert.equal(v({}).ok, true, JSON.stringify(v({}).errors));
  assert.deepEqual([v({}).value.toKey, v({}).value.qty, v({}).value.value, v({ qty: 1 }).value.value], ['p_p-pel', 3, 1860, 620]);
  assert.match(v({}, null).errors[0].message, /Choose the correct product/);
  assert.match(v({}, { ...PEL, uom: 'Box' }).errors[0].message, /units must be the same/);
  assert.match(v({}, { id: 'p-pel-typo', name: 'x', uom: 'Pcs' }).errors[0].message, /same item/);
  assert.match(v({ qty: 4 }).errors[0].message, /Only 3 in stock/);
  assert.match(v({ reason: 'x' }).errors[0].message, /reason/);
});

test('V268.5 Change Item: administrators only; stock moves at the same cost with movements on both; cancel puts it back', async () => {
  const fs = createFakeFirestore();
  fs.load({ 'system/accessControl': { adminUids: ['boss'] }, 'salesOrders/so4': SO4 });
  const staff = createPurchaseService(fs, { actor: () => AISHA, now: () => '2026-10-18T09:00:00.000Z', today: () => '2026-10-18' });
  const boss = createPurchaseService(fs, { actor: () => BOSS, now: () => '2026-10-18T10:00:00.000Z', today: () => '2026-10-18' });
  const r = await staff.createPurchaseInvoice(typedWrong());
  const from = r.invoice.lines[0].itemKey;
  const input = () => ({ operationId: opId(), itemKey: from, product: PEL, qty: '2', reason: 'Typed wrong on the PI' });
  await rejectsCode(staff.changeStockItem(input()), 'not-admin');
  const req = input();
  const c = await boss.changeStockItem(req);
  assert.deepEqual([c.change.qty, c.change.unitCost, c.change.value, c.change.toKey], [2, 620, 1240, 'p_p-pel']);
  assert.deepEqual([fs.peek('stockItems/' + from).qty, fs.peek('stockItems/' + from).value], [1, 620]);
  const to = fs.peek('stockItems/p_p-pel');
  assert.deepEqual([to.qty, to.value, to.desc, to.productId, to.uom], [2, 1240, 'Pelican 7600 flashlight', 'p-pel', 'Pcs']);
  assert.deepEqual([fs.peek(`stockMovements/${c.change.id}__out`).kind, fs.peek(`stockMovements/${c.change.id}__in`).kind], ['changed-to', 'changed-from']);
  assert.equal(fs.peek(`stockMovements/${c.change.id}__in`).otherDesc, 'Pelican 7600 flash light');
  assert.equal((await boss.changeStockItem(req)).alreadyApplied, true);
  // the invoice can't be cancelled now (its stock moved) — the change must be cancelled first
  await rejectsCode(staff.voidPurchaseInvoice({ operationId: opId(), invoiceId: r.invoice.id, reason: 'entered twice' }), 'stock-used');
  await rejectsCode(staff.cancelStockChange({ operationId: opId(), changeId: c.change.id, reason: 'chosen by mistake' }), 'not-admin');
  const x = await boss.cancelStockChange({ operationId: opId(), changeId: c.change.id, reason: 'chosen by mistake' });
  assert.equal(x.change.status, 'Voided');
  assert.deepEqual([fs.peek('stockItems/' + from).qty, fs.peek('stockItems/' + from).value, fs.peek('stockItems/p_p-pel').qty, fs.peek('stockItems/p_p-pel').value], [3, 1860, 0, 0]);
  assert.equal(fs.peek(`stockMovements/${c.change.id}__back-in`).kind, 'change-cancelled');
  await rejectsCode(boss.cancelStockChange({ operationId: opId(), changeId: c.change.id, reason: 'again please' }), 'invalid-state');
  // all of it: the value moves exactly
  const all = await boss.changeStockItem({ ...input(), qty: '3' });
  assert.deepEqual([all.change.value, fs.peek('stockItems/' + from).qty, fs.peek('stockItems/p_p-pel').value], [1860, 0, 1860]);
});
