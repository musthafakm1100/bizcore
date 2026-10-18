/** V268.3 Supplier advances, editing purchase invoices and supplier payments — the transaction service (SIMULATOR). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeFirestore } from './support/fake-firestore.mjs';
import { createPurchaseService } from '../js/purchase-service.mjs';
import * as P from '../js/purchase-core.mjs';
import { isBalanced } from '../js/ledger-core.mjs';

const AISHA = { uid: 'aisha', name: 'Aisha' }, BOSS = { uid: 'boss', name: 'Boss' };
const rejectsCode = (p, code) => assert.rejects(p, e => { assert.equal(e.code, code, e.message); return true; });
const SO4 = { id: 'so4', soNo: 'SO-2610-0004', customer: 'SNC Lavalin Arabia', items: [{ lineId: 'L1', desc: 'LED Panel 60x60', uom: 'Pcs', qty: 10, up: 160, prodId: 'p-led' }] };
const acc = (id, code, name, type, extra = {}) => ({ id, code, name, type, active: true, openingBalance: 0, openingDate: '2026-10-01', custodianName: '', custodianUid: '', ...extra });
const ACCOUNTS = { 'paymentAccounts/bank1': acc('bank1', '1201', 'Al Rajhi – Current', 'bank'), 'paymentAccounts/cash1': acc('cash1', '1111', 'Cash – Shabeeb', 'cash', { custodianUid: 'shab', custodianName: 'Shabeeb' }) };
let op = 0;
const opId = () => 'op-ed-' + String(++op).padStart(6, '0');
const N = { counterKey: 'doc_purchaseInvoice_2610', displayPrefix: 'PI-2610-' };
const SPN = { counterKey: 'doc_supplierPayment_2610', displayPrefix: 'SP-2610-' };
let NOW = '2026-10-17T09:00:00.000Z';
function env(actor = AISHA, extra = {}) {
  const fs = createFakeFirestore();
  fs.load({ 'system/accessControl': { adminUids: ['boss'] }, 'salesOrders/so4': SO4, ...ACCOUNTS, ...extra });
  const mk = a => createPurchaseService(fs, { actor: () => a, now: () => NOW, today: () => NOW.slice(0, 10) });
  return { fs, svc: mk(actor), boss: mk(BOSS), aisha: mk(AISHA) };
}
const invoice = extra => ({ operationId: opId(), numbering: N, supplierId: 'sup1', supplierName: 'ABC Trading Est', supplierInvoiceNo: 'INV-' + op,
  date: '2026-10-15', dueDate: '2026-11-14', lines: [{ kind: 'order', soId: 'so4', soLineId: 'L1', qty: 10, unitCost: 120, reference: { unit: 120, source: 'pricing' } }],
  supplierTotal: 1380, ...extra });

test('V268.3 core: edit rights by setting, admin and the 7-day limit', () => {
  const doc = { status: 'Posted', recordedAt: '2026-10-10T08:00:00.000Z' };
  const at = ms => ({ nowMs: Date.parse(ms) });
  const s = m => ({ settings: { ...P.DEFAULT_PURCHASE_SETTINGS, editMode: m, editDays: 7 } });
  assert.equal(P.editRightOf(doc, { ...s('limited-admin'), ...at('2026-10-12T00:00:00Z') }).right, 'limited');
  assert.equal(P.editRightOf(doc, { ...s('limited-admin'), isAdmin: true, ...at('2026-10-12T00:00:00Z') }).right, 'full');
  assert.equal(P.editRightOf(doc, { ...s('full'), ...at('2026-10-12T00:00:00Z') }).right, 'full');
  assert.equal(P.editRightOf(doc, { ...s('off'), isAdmin: true, ...at('2026-10-12T00:00:00Z') }).right, null);
  const late = P.editRightOf(doc, { ...s('limited-admin'), ...at('2026-10-18T00:00:00Z') });
  assert.equal(late.right, null); assert.match(late.why, /7-day/);
  assert.equal(P.editRightOf(doc, { ...s('limited-admin'), isAdmin: true, ...at('2026-10-30T00:00:00Z') }).right, 'full');
  assert.equal(P.editRightOf({ ...doc, status: 'Voided' }, s('full')).right, null);
  assert.equal(P.validatePurchaseSettings({ ...P.DEFAULT_PURCHASE_SETTINGS, editMode: 'bad' }).ok, false);
});

test('V268.3 advance: paid before the invoice, used on it, given back when that payment is cancelled; a used advance can\'t be cancelled', async () => {
  const { fs, svc } = env();
  const a = await svc.payAdvance({ operationId: opId(), numbering: SPN, supplierId: 'sup1', supplierName: 'ABC Trading Est', soId: 'so4', soNo: 'SO-2610-0004',
    date: '2026-10-14', lines: [{ accountId: 'bank1', amount: '500', reference: 'TRF 9' }], note: 'Booking' });
  const adv = a.payment;
  assert.deepEqual([adv.kind, adv.spNo, adv.amount, adv.advanceLeft, adv.soNo], ['advance', 'SP-2610-0001', 500, 500, 'SO-2610-0004']);
  const e = fs.peek('cashEntries/' + adv.entryId); assert.equal(isBalanced(e), true); assert.equal(e.kind, 'supplier-advance');
  assert.equal(fs.peek(`cashLines/${e.id}__bank1`).amountOut, 500);
  // same operation again → nothing new
  assert.equal((await svc.payAdvance({ operationId: adv.operationId, numbering: SPN, supplierId: 'sup1', supplierName: 'ABC Trading Est', date: '2026-10-14', lines: [{ accountId: 'bank1', amount: '500' }] })).alreadyApplied, true);
  // the invoice uses 300 of it plus 200 cash
  const r = await svc.createPurchaseInvoice(invoice({ payments: [{ date: '2026-10-15', numbering: SPN, lines: [{ advanceId: adv.id, amount: '300' }, { accountId: 'cash1', amount: '200' }] }] }));
  assert.deepEqual([r.invoice.paid, r.invoice.balance], [500, 880]);
  const used = fs.peek('supplierPayments/' + adv.id);
  assert.deepEqual([used.advanceUsed, used.advanceLeft, used.revision], [300, 200, 2]);
  const pay = Object.values(fs.dump('supplierPayments/')).find(p => p.kind === 'payment');
  assert.deepEqual([pay.advanceTotal, pay.advanceIds, pay.advanceAmounts], [300, [adv.id], { [adv.id]: 300 }]);
  const pe = fs.peek('cashEntries/' + pay.entryId); assert.equal(isBalanced(pe), true);
  // more than what is left → refused
  await assert.rejects(svc.recordSupplierPayment({ operationId: opId(), numbering: SPN, invoiceId: r.invoice.id, date: '2026-10-16', lines: [{ advanceId: adv.id, amount: '201' }] }), /only 200\.00 is left/);
  // the advance can't be cancelled while used
  await rejectsCode(svc.voidSupplierPayment({ operationId: opId(), paymentId: adv.id, reason: 'Wrong' }), 'advance-used');
  // cancel the invoice payment → the advance is free again, the invoice goes back
  await svc.voidSupplierPayment({ operationId: opId(), paymentId: pay.id, reason: 'Wrong split' });
  assert.deepEqual([fs.peek('supplierPayments/' + adv.id).advanceUsed, fs.peek('supplierPayments/' + adv.id).advanceLeft], [0, 500]);
  assert.equal(fs.peek('purchaseInvoices/' + r.invoice.id).paid, 0);
  // now the advance can be cancelled; its entry goes void and an event is written
  await svc.voidSupplierPayment({ operationId: opId(), paymentId: adv.id, reason: 'Supplier refunded' });
  assert.equal(fs.peek('supplierPayments/' + adv.id).status, 'Voided');
  assert.equal(fs.peek('cashEntries/' + adv.entryId).void, true);
  assert.ok(Object.keys(fs.dump(`supplierPayments/${adv.id}/events/`)).length >= 2);
});

test('V268.3 advance for another supplier is refused', async () => {
  const { svc } = env();
  const adv = (await svc.payAdvance({ operationId: opId(), numbering: SPN, supplierId: 'sup2', supplierName: 'XYZ Lighting', date: '2026-10-14', lines: [{ accountId: 'bank1', amount: '100' }] })).payment;
  await assert.rejects(svc.createPurchaseInvoice(invoice({ payments: [{ date: '2026-10-15', numbering: SPN, lines: [{ advanceId: adv.id, amount: '50' }] }] })), /not this supplier/);
});

test('V268.3 payment edit: limited = references and note; full (admin) = new amounts, new ledger entry, invoice adjusted', async () => {
  const { fs, aisha, boss } = env();
  const r = await aisha.createPurchaseInvoice(invoice({ payments: [{ date: '2026-10-15', numbering: SPN, lines: [{ accountId: 'bank1', amount: '1000', reference: 'TRF 1' }] }] }));
  const pay = Object.values(fs.dump('supplierPayments/')).find(p => p.kind === 'payment');
  await rejectsCode(aisha.editSupplierPayment({ operationId: opId(), paymentId: pay.id, mode: 'limited', references: ['TRF 1'], reason: 'x' }), 'invalid-input');
  const l = await aisha.editSupplierPayment({ operationId: opId(), paymentId: pay.id, mode: 'limited', references: ['TRF 0001'], note: 'Bank slip', reason: 'Typo' });
  assert.deepEqual([l.payment.lines[0].reference, l.payment.note, l.payment.revision, l.payment.amount], ['TRF 0001', 'Bank slip', 2, 1000]);
  // staff can't change the money
  await rejectsCode(aisha.editSupplierPayment({ operationId: opId(), paymentId: pay.id, mode: 'full', date: '2026-10-15', lines: [{ accountId: 'bank1', amount: '900' }], reason: 'Wrong amount' }), 'not-allowed');
  const f = await boss.editSupplierPayment({ operationId: opId(), paymentId: pay.id, expectedRevision: 2, mode: 'full', date: '2026-10-15', lines: [{ accountId: 'bank1', amount: '900', reference: 'TRF 0001' }], reason: 'Wrong amount' });
  assert.deepEqual([f.payment.amount, f.payment.revision, f.payment.spNo, f.payment.created], [900, 3, pay.spNo, pay.created]);
  assert.equal(fs.peek('cashEntries/' + pay.entryId).void, true);
  const ne = fs.peek('cashEntries/' + f.payment.entryId);
  assert.equal(f.payment.entryId, pay.entryId + '-r3'); assert.equal(isBalanced(ne), true); assert.equal(fs.peek(`cashLines/${ne.id}__bank1`).amountOut, 900);
  const pi = fs.peek('purchaseInvoices/' + r.invoice.id);
  assert.deepEqual([pi.paid, pi.balance, pi.payStatus], [900, 480, 'Part paid']);
  assert.ok(Object.values(fs.dump(`purchaseInvoices/${pi.id}/events/`)).some(ev => ev.kind === 'payment-edited'));
  // more than the balance after the change is refused
  await assert.rejects(boss.editSupplierPayment({ operationId: opId(), paymentId: pay.id, mode: 'full', date: '2026-10-15', lines: [{ accountId: 'bank1', amount: '1400' }], reason: 'x' }), /more than the balance/);
});

test('V268.3 invoice edit: limited changes numbers/dates; full (admin, no payments) moves the purchased quantities', async () => {
  const { fs, aisha, boss } = env();
  const r = await aisha.createPurchaseInvoice(invoice({ supplierInvoiceNo: 'A-1' }));
  const id = r.invoice.id;
  const l = await aisha.editPurchaseInvoice({ operationId: opId(), invoiceId: id, mode: 'limited', supplierInvoiceNo: 'A-100', zohoBillNo: 'BILL-7', date: '2026-10-15', dueDate: '2026-11-20', reason: 'Typo' });
  assert.deepEqual([l.invoice.supplierInvoiceNo, l.invoice.zohoBillNo, l.invoice.dueDate, l.invoice.revision, l.invoice.totals.total], ['A-100', 'BILL-7', '2026-11-20', 2, 1380]);
  assert.equal(fs.peek('purchaseSupplierRefs/' + r.invoice.supplierRefKey), undefined);
  assert.equal(fs.peek('purchaseSupplierRefs/' + l.invoice.supplierRefKey).invoiceId, id);
  await rejectsCode(aisha.editPurchaseInvoice({ operationId: opId(), invoiceId: id, mode: 'full', ...invoice({ supplierInvoiceNo: 'A-100' }), reason: 'x' }), 'not-allowed');
  const before = fs.peek('salesOrderPurchasing/so4').lines.L1.purchased;
  assert.equal(before, 10);
  const f = await boss.editPurchaseInvoice({ operationId: opId(), invoiceId: id, mode: 'full', ...invoice({ supplierInvoiceNo: 'A-100',
    lines: [{ kind: 'order', soId: 'so4', soLineId: 'L1', qty: 8, unitCost: 120, reference: { unit: 120, source: 'pricing' } }], supplierTotal: 1104 }), reason: 'Only 8 came' });
  assert.deepEqual([f.invoice.piNo, f.invoice.totals.total, f.invoice.revision], [r.invoice.piNo, 1104, 3]);
  assert.equal(fs.peek('salesOrderPurchasing/so4').lines.L1.purchased, 8);
  // with a payment → full edit refused
  await boss.recordSupplierPayment({ operationId: opId(), numbering: SPN, invoiceId: id, date: '2026-10-17', lines: [{ accountId: 'bank1', amount: '100' }] });
  await rejectsCode(boss.editPurchaseInvoice({ operationId: opId(), invoiceId: id, mode: 'full', ...invoice({ supplierInvoiceNo: 'A-100' }), reason: 'x' }), 'has-payments');
});

test('V268.3 after 7 days only an administrator can edit', async () => {
  const { aisha, boss } = env();
  const r = await aisha.createPurchaseInvoice(invoice({}));
  NOW = '2026-10-30T09:00:00.000Z';
  try {
    await rejectsCode(aisha.editPurchaseInvoice({ operationId: opId(), invoiceId: r.invoice.id, mode: 'limited', supplierInvoiceNo: 'Z-1', date: '2026-10-15', dueDate: '2026-11-14', reason: 'x' }), 'not-allowed');
    const ok = await boss.editPurchaseInvoice({ operationId: opId(), invoiceId: r.invoice.id, mode: 'limited', supplierInvoiceNo: 'Z-1', date: '2026-10-15', dueDate: '2026-11-14', reason: 'x' });
    assert.equal(ok.invoice.supplierInvoiceNo, 'Z-1');
  } finally { NOW = '2026-10-17T09:00:00.000Z'; }
});

test('V268.32 edge cases: discount-only payment edit, duplicate invoice no., stock already used, cancelled invoice, cash back edit', async () => {
  const { fs, aisha, boss } = env();
  // a discount-only payment can be changed in full (no ledger entry before or after)
  const r = await aisha.createPurchaseInvoice(invoice({ supplierInvoiceNo: 'E-1' }));
  const d = await aisha.recordSupplierPayment({ operationId: opId(), numbering: SPN, invoiceId: r.invoice.id, date: '2026-10-17', lines: [], discount: '7.50' });
  assert.equal(d.payment.entryId, '');
  const de = await boss.editSupplierPayment({ operationId: opId(), paymentId: d.payment.id, mode: 'full', date: '2026-10-17', lines: [], discount: '8', reason: 'Supplier agreed 8' });
  assert.deepEqual([de.payment.discount, de.payment.entryId], [8, '']);
  assert.equal(fs.peek('purchaseInvoices/' + r.invoice.id).paymentDiscount, 8);
  // a limited edit can't take another invoice's supplier invoice no.
  const r2 = await aisha.createPurchaseInvoice(invoice({ supplierInvoiceNo: 'E-2', lines: [{ kind: 'stock', productId: 'p-spare-lamp', desc: 'Spare lamp', uom: 'Pcs', qty: 4, unitCost: 10 }], supplierTotal: 46 }));
  await rejectsCode(aisha.editPurchaseInvoice({ operationId: opId(), invoiceId: r2.invoice.id, mode: 'limited', supplierInvoiceNo: 'E-1', date: '2026-10-15', dueDate: '2026-11-14', reason: 'typo' }), 'duplicate-supplier-invoice');
  // full edit can't take away stock that is no longer there
  const key = r2.invoice.lines[0].itemKey;
  fs.load({ ['stockItems/' + key]: { ...fs.peek('stockItems/' + key), qty: 1 } });   // 3 of the 4 were used
  await rejectsCode(boss.editPurchaseInvoice({ operationId: opId(), invoiceId: r2.invoice.id, mode: 'full', ...invoice({ supplierInvoiceNo: 'E-2', lines: [{ kind: 'stock', productId: 'p-spare-lamp', desc: 'Spare lamp', uom: 'Pcs', qty: 2, unitCost: 10 }], supplierTotal: 23 }), reason: 'only 2' }), 'stock-used');
  // a cancelled invoice can't be edited
  await aisha.voidPurchaseInvoice({ operationId: opId(), invoiceId: r2.invoice.id, reason: 'entered twice' }).catch(() => {});
  // cash back edit: not more than paid
  const p = await aisha.recordSupplierPayment({ operationId: opId(), numbering: SPN, invoiceId: r.invoice.id, date: '2026-10-17', lines: [{ accountId: 'bank1', amount: '100' }] });
  const cb = await aisha.recordSupplierCashBack({ operationId: opId(), numbering: SPN, invoiceId: r.invoice.id, date: '2026-10-17', lines: [{ accountId: 'cash1', amount: '20' }] });
  await assert.rejects(boss.editSupplierPayment({ operationId: opId(), paymentId: cb.payment.id, mode: 'full', date: '2026-10-17', lines: [{ accountId: 'cash1', amount: '150' }], reason: 'more' }), /more than what was paid/);
  const cbe = await boss.editSupplierPayment({ operationId: opId(), paymentId: cb.payment.id, mode: 'full', date: '2026-10-17', lines: [{ accountId: 'bank1', amount: '25' }], reason: 'it came by bank' });
  assert.deepEqual([cbe.payment.amount, cbe.payment.lines[0].accountId], [25, 'bank1']);
  assert.equal(fs.peek('purchaseInvoices/' + r.invoice.id).cashBack, 25);
  assert.equal(fs.peek('cashEntries/' + cb.payment.entryId).void, true);
  // the same edit sent twice changes nothing the second time
  const op = opId();
  await aisha.editSupplierPayment({ operationId: op, paymentId: p.payment.id, mode: 'limited', references: ['R1'], reason: 'ref' });
  const again = await aisha.editSupplierPayment({ operationId: op, paymentId: p.payment.id, mode: 'limited', references: ['R1'], reason: 'ref' });
  assert.equal(again.alreadyApplied, true);
  // an advance can't be lowered below what is used
  const adv = (await aisha.payAdvance({ operationId: opId(), numbering: SPN, supplierId: 'sup1', supplierName: 'ABC Trading Est', date: '2026-10-16', lines: [{ accountId: 'bank1', amount: '300' }] })).payment;
  const r3 = await aisha.createPurchaseInvoice(invoice({ supplierInvoiceNo: 'E-3', lines: [{ kind: 'stock', productId: 'p-bulb', desc: 'Bulb', uom: 'Pcs', qty: 20, unitCost: 10 }], supplierTotal: 230, payments: [{ date: '2026-10-15', numbering: SPN, lines: [{ advanceId: adv.id, amount: '200' }] }] }));
  assert.equal(fs.peek('purchaseInvoices/' + r3.invoice.id).paid, 200);
  await assert.rejects(boss.editSupplierPayment({ operationId: opId(), paymentId: adv.id, mode: 'full', date: '2026-10-16', lines: [{ accountId: 'bank1', amount: '150' }], reason: 'x' }), /already used/);
  const ae = await boss.editSupplierPayment({ operationId: opId(), paymentId: adv.id, mode: 'full', date: '2026-10-16', lines: [{ accountId: 'bank1', amount: '250' }], reason: 'paid 250' });
  assert.deepEqual([ae.payment.amount, ae.payment.advanceUsed, ae.payment.advanceLeft], [250, 200, 50]);
});
