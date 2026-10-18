/**
 * FIREBASE EMULATOR tests — V268.1 Purchase Invoices: the real purchase service against the real security rules.
 * Run on your PC from the BizCore folder:  RUN_EMULATOR_TESTS.bat
 */
import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { createPurchaseService } from '../../js/purchase-service.mjs';

const PROJECT = 'demo-bizcore';
let env;
before(async () => {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
  env = await initializeTestEnvironment({ projectId: PROJECT, firestore: { host, port: Number(port), rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') } });
});
after(async () => { await env?.cleanup(); });
const SO4 = { id: 'so4', soNo: 'SO-2610-0004', customer: 'SNC Lavalin Arabia', items: [
  { lineId: 'L1', desc: 'LED Panel 60x60', uom: 'Pcs', qty: 10, up: 160, prodId: 'p-led' },
  { lineId: 'L2', desc: 'Cable 4 mm', uom: 'Roll', qty: 3, up: 70, code: 'CB4' },
] };
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'system/accessControl'), { adminUids: ['boss'] });
    await setDoc(doc(db, 'salesOrders/so4'), SO4);
    await setDoc(doc(db, 'cashCustodians/shabeeb'), { uid: 'shabeeb', name: 'Shabeeb', email: '', accountIds: [], active: true, mustChangePassword: false });
    // V268.2 payment accounts
    const acc = (id, code, name, type, extra = {}) => ({ id, code, codeKey: code.toLowerCase(), name, nameKey: name.toLowerCase(), type, active: true, openingBalance: 0, openingDate: '2026-10-01',
      custodianName: type === 'cash' ? 'Shabeeb' : '', custodianUid: '', linkedBankAccountId: '', revision: 1, hasEntries: false, createdByUid: 'boss', ...extra });
    await setDoc(doc(db, 'paymentAccounts/cash1'), acc('cash1', '1111', 'Cash Shabeeb', 'cash', { custodianUid: 'shabeeb' }));
    await setDoc(doc(db, 'paymentAccounts/bank1'), acc('bank1', '1201', 'Al Rajhi', 'bank'));
    await setDoc(doc(db, 'paymentAccounts/card1'), acc('card1', '1121', 'POS Card 1234', 'card', { linkedBankAccountId: 'bank1' }));
  });
});
const user = uid => env.authenticatedContext(uid, { email: uid + '@dt.com' }).firestore();
const svc = uid => createPurchaseService({ db: user(uid), doc, runTransaction, serverTimestamp }, { actor: () => ({ uid, name: uid }) });
let n = 0;
const N = { counterKey: 'doc_purchaseInvoice_2610', displayPrefix: 'PI-2610-' };
const base = extra => ({ operationId: 'op-emu-pi-' + String(++n).padStart(6, '0'), numbering: N, supplierId: 'sup1', supplierName: 'ABC Trading Est', supplierInvoiceNo: 'INV-' + n,
  date: '2026-10-15', dueDate: '2026-11-14', lines: [{ kind: 'order', soId: 'so4', soLineId: 'L2', qty: 5, unitCost: 52, reference: { unit: 50 }, extra: { to: 'stock' } }],
  supplierTotal: 299, ...extra });

test('[emulator] V268.1 purchase invoices: record and cancel pass the rules', async () => {
  const r = await assertSucceeds(svc('aisha').createPurchaseInvoice(base()));
  const db = user('aisha');
  assert.equal((await getDoc(doc(db, 'salesOrderPurchasing/so4'))).data().lines.L2.purchased, 3);
  assert.equal((await getDoc(doc(db, 'stockItems/d_cb4__roll'))).data().qty, 2);
  await assertSucceeds(svc('aisha').voidPurchaseInvoice({ operationId: 'op-emu-void-000001', invoiceId: r.invoice.id, reason: 'wrong supplier', expectedRevision: 1 }));
  assert.equal((await getDoc(doc(db, 'purchaseInvoices/' + r.invoice.id))).data().status, 'Voided');
  assert.equal((await getDoc(doc(db, 'salesOrderPurchasing/so4'))).data().lines.L2.purchased, 0);
  // the same supplier invoice no. can be recorded again after cancelling
  await assertSucceeds(svc('aisha').createPurchaseInvoice(base({ supplierInvoiceNo: r.invoice.supplierInvoiceNo })));
});

test('[emulator] V268.1 purchase invoices: figures are fixed, nothing deleted, no direct writes, custodian logins closed', async () => {
  const r = await svc('aisha').createPurchaseInvoice(base());
  const db = user('aisha');
  await assertFails(updateDoc(doc(db, 'purchaseInvoices/' + r.invoice.id), { 'totals.total': 1 }));
  await assertFails(updateDoc(doc(db, 'purchaseInvoices/' + r.invoice.id), { status: 'Voided', voidReason: 'x', revision: 2, voidedByUid: 'aisha', updatedByUid: 'aisha' }), 'no void without an event');
  await assertFails(deleteDoc(doc(db, 'purchaseInvoices/' + r.invoice.id)));
  await assertFails(deleteDoc(doc(db, 'purchaseSupplierRefs/' + r.invoice.supplierRefKey)));
  await assertFails(setDoc(doc(db, 'salesOrderPurchasing/so4'), { salesOrderId: 'so4', lines: {}, revision: 2, updatedByUid: 'aisha', lastInvoiceId: r.invoice.id, lastEventId: r.invoice.lastEventId }));
  await assertFails(setDoc(doc(db, 'stockItems/d_cb4__roll'), { itemKey: 'd_cb4__roll', qty: 99, revision: 2, updatedByUid: 'aisha', lastInvoiceId: r.invoice.id, lastEventId: r.invoice.lastEventId }));
  await assertFails(getDoc(doc(user('shabeeb'), 'purchaseInvoices/' + r.invoice.id)));
});

test('[emulator] V268.1 purchase settings: administrators only, validated', async () => {
  const s = { costLimitPct: 8, costLimitAction: 'block', discountMode: 'both', roundingLimit: 0.5, vatRate: 15, profitVisibility: 'everyone' };
  await assert.rejects(svc('aisha').savePurchaseSettings(s), /administrators/);
  await assertSucceeds(svc('boss').savePurchaseSettings(s));
  await assertFails(setDoc(doc(user('boss'), 'settings/purchasing'), { ...s, discountMode: 'any', updatedByUid: 'boss' }));
  await assertFails(setDoc(doc(user('aisha'), 'settings/purchasing'), { ...s, updatedByUid: 'aisha' }));
});

const SPN = { counterKey: 'doc_supplierPayment_2610', displayPrefix: 'SP-2610-' };
const today = () => new Date().toISOString().slice(0, 10);

test('[emulator] V268.2 supplier payments: at entry, later, discount, cash back and cancel pass the rules', async () => {
  const s = svc('aisha');
  const r = await assertSucceeds(s.createPurchaseInvoice(base({ supplierInvoiceNo: 'PAY-1', payments: [{ date: today(), numbering: SPN, lines: [{ accountId: 'cash1', amount: '100' }, { accountId: 'card1', amount: '50', reference: 'slip 1' }] }] })));
  const db = user('aisha');
  let pi = (await getDoc(doc(db, 'purchaseInvoices/' + r.invoice.id))).data();
  assert.deepEqual([pi.paid, pi.payStatus], [150, 'Part paid']);
  const left = pi.balance;
  const pay = await assertSucceeds(s.recordSupplierPayment({ operationId: 'op-emu-pay-000001', invoiceId: pi.id, expectedRevision: 1, numbering: SPN, date: today(),
    lines: [{ accountId: 'bank1', amount: String(left - 10), bankCharge: '5' }], discount: '10' }));
  pi = (await getDoc(doc(db, 'purchaseInvoices/' + pi.id))).data();
  assert.deepEqual([pi.balance, pi.payStatus], [0, 'Paid']);
  const cb = await assertSucceeds(s.recordSupplierCashBack({ operationId: 'op-emu-cb-0000001', invoiceId: pi.id, numbering: SPN, date: today(), lines: [{ accountId: 'cash1', amount: '20' }] }));
  // the custodian sees and confirms the cash back line
  const shab = env.authenticatedContext('shabeeb', { email: 'shabeeb@dt.com' }).firestore();
  await assertSucceeds(updateDoc(doc(shab, `cashLines/${cb.payment.entryId}__cash1`), { status: 'confirmed', statusByUid: 'shabeeb', statusByName: 'Shabeeb', statusAt: serverTimestamp(), statusNote: '', onBehalf: false }));
  // the invoice can't be cancelled while it has payments
  await assert.rejects(s.voidPurchaseInvoice({ operationId: 'op-emu-void-000002', invoiceId: pi.id, reason: 'wrong supplier' }), /cancel them first/);
  await assertSucceeds(s.voidSupplierPayment({ operationId: 'op-emu-pvoid-00001', paymentId: cb.payment.id, reason: 'entered twice' }));
  await assertSucceeds(s.voidSupplierPayment({ operationId: 'op-emu-pvoid-00002', paymentId: pay.payment.id, reason: 'wrong amount' }));
  pi = (await getDoc(doc(db, 'purchaseInvoices/' + pi.id))).data();
  assert.deepEqual([pi.paid, pi.paymentDiscount, pi.cashBack, pi.payStatus], [150, 0, 0, 'Part paid']);
  assert.equal((await getDoc(doc(db, `cashLines/${pay.payment.entryId}__bank1`))).data().void, true);
});

test('[emulator] V268.2 supplier payments: figures move only with a payment; no loose ledger entries; card needs a bank', async () => {
  const s = svc('aisha');
  const r = await s.createPurchaseInvoice(base({ supplierInvoiceNo: 'PAY-2' }));
  const db = user('aisha');
  // paying directly on the invoice, without a payment and event, is refused
  await assertFails(updateDoc(doc(db, 'purchaseInvoices/' + r.invoice.id), { paid: 100, balance: r.invoice.balance - 100, payStatus: 'Part paid', revision: 2, updatedByUid: 'aisha' }));
  // a payment document on its own is refused
  await assertFails(setDoc(doc(db, 'supplierPayments/SPAY-loose-00000001'), { id: 'SPAY-loose-00000001', kind: 'payment', status: 'Posted', revision: 1, invoiceId: r.invoice.id, piNo: r.invoice.piNo,
    amount: 10, discount: 0, bankCharges: 0, lines: [], spNo: 'SP-1', date: today(), entryId: '', createdByUid: 'aisha', updatedByUid: 'aisha' }));
  // a ledger entry claiming to be a supplier payment, without the payment, is refused
  await assertFails(setDoc(doc(db, 'cashEntries/spe-loose-00000001'), { id: 'spe-loose-00000001', kind: 'supplier-payment', paymentId: 'SPAY-x-00000001', schemaVersion: 1, revision: 1, void: false,
    recordedByUid: 'aisha', updatedByUid: 'aisha', updatedAt: serverTimestamp(), voucherNo: 'SP-1', date: today(), accountIds: ['bank1'], postings: { bank1: { amountIn: 0, amountOut: 10, memoOut: 0 } }, lines: [], amount: 10 }));
  // a paid line can't be changed afterwards
  const p = await s.recordSupplierPayment({ operationId: 'op-emu-pay-000003', invoiceId: r.invoice.id, numbering: SPN, date: today(), lines: [{ accountId: 'bank1', amount: '10' }] });
  await assertFails(updateDoc(doc(db, `cashLines/${p.payment.entryId}__bank1`), { amountOut: 1 }));
  await assertFails(deleteDoc(doc(db, 'supplierPayments/' + p.payment.id)));
  // a custodian login can't read supplier payments
  await assertFails(getDoc(doc(env.authenticatedContext('shabeeb').firestore(), 'supplierPayments/' + p.payment.id)));
  // card accounts: the linked account must be a bank account (administrators)
  const boss = user('boss');
  const upd = link => updateDoc(doc(boss, 'paymentAccounts/card1'), { linkedBankAccountId: link, revision: 2, updatedByUid: 'boss', updatedAt: serverTimestamp() });
  await env.withSecurityRulesDisabled(async ctx => {
    const d = ctx.firestore();
    await setDoc(doc(d, 'paymentAccountKeys/name_pos card 1234'), { id: 'name_pos card 1234', kind: 'name', accountId: 'card1' });
    await setDoc(doc(d, 'paymentAccountKeys/code_1121'), { id: 'code_1121', kind: 'code', accountId: 'card1' });
  });
  await assertFails(upd('cash1'));
  await assertFails(upd(''));
  await assertSucceeds(upd('bank1'));
});

test('[emulator] V268.3 advances: pay, use on an invoice, give back on cancel, cancel when free — rules pass', async () => {
  const s = svc('aisha'), db = user('aisha');
  const a = await assertSucceeds(s.payAdvance({ operationId: 'op-emu-adv-000001', numbering: SPN, supplierId: 'sup1', supplierName: 'ABC Trading Est', soId: 'so4', soNo: 'SO-2610-0004',
    date: today(), lines: [{ accountId: 'bank1', amount: '200', reference: 'TRF 9' }] }));
  const adv = a.payment;
  const r = await assertSucceeds(s.createPurchaseInvoice(base({ supplierInvoiceNo: 'ADV-1', payments: [{ date: today(), numbering: SPN, lines: [{ advanceId: adv.id, amount: '150' }] }] })));
  assert.equal((await getDoc(doc(db, 'supplierPayments/' + adv.id))).data().advanceLeft, 50);
  const later = await assertSucceeds(s.recordSupplierPayment({ operationId: 'op-emu-pay-adv-0001', invoiceId: r.invoice.id, numbering: SPN, date: today(), lines: [{ advanceId: adv.id, amount: '50' }, { accountId: 'cash1', amount: '10' }] }));
  assert.equal((await getDoc(doc(db, 'supplierPayments/' + adv.id))).data().advanceLeft, 0);
  await assert.rejects(s.voidSupplierPayment({ operationId: 'op-emu-advv-00001', paymentId: adv.id, reason: 'supplier refunded' }), /already used/);
  // the advance figures can't be changed directly
  await assertFails(updateDoc(doc(db, 'supplierPayments/' + adv.id), { advanceUsed: 0, advanceLeft: 200, revision: 4, updatedByUid: 'aisha', lastUseId: later.payment.id }));
  await assertSucceeds(s.voidSupplierPayment({ operationId: 'op-emu-pvoid-adv01', paymentId: later.payment.id, reason: 'wrong' }));
  const atEntry = (await getDoc(doc(db, 'purchaseInvoices/' + r.invoice.id))).data();
  assert.equal(atEntry.paid, 150);
});

test('[emulator] V268.3 edits: limited by staff, full by administrators; direct changes refused', async () => {
  const s = svc('aisha'), boss = svc('boss'), db = user('aisha');
  const r = await s.createPurchaseInvoice(base({ supplierInvoiceNo: 'ED-1' }));
  await assertSucceeds(s.editPurchaseInvoice({ operationId: 'op-emu-edit-000001', invoiceId: r.invoice.id, mode: 'limited', supplierInvoiceNo: 'ED-100', zohoBillNo: 'B-1', date: '2026-10-15', dueDate: '2026-11-20', reason: 'typo' }));
  await assert.rejects(s.editPurchaseInvoice({ operationId: 'op-emu-edit-000002', invoiceId: r.invoice.id, mode: 'full', ...base({ supplierInvoiceNo: 'ED-100' }), reason: 'x' }), /Only administrators/);
  // staff writing the figures directly is refused
  await assertFails(updateDoc(doc(db, 'purchaseInvoices/' + r.invoice.id), { 'totals.total': 1, revision: 3, updatedByUid: 'aisha' }));
  const f = await assertSucceeds(boss.editPurchaseInvoice({ operationId: 'op-emu-edit-000003', invoiceId: r.invoice.id, mode: 'full',
    ...base({ supplierInvoiceNo: 'ED-100', lines: [{ kind: 'order', soId: 'so4', soLineId: 'L2', qty: 4, unitCost: 52, reference: { unit: 50 }, extra: { to: 'stock' } }], supplierTotal: 239.2 }), reason: 'only 4 came' }));
  assert.equal(f.invoice.totals.total, 239.2);
  assert.equal((await getDoc(doc(db, 'stockItems/d_cb4__roll'))).data().qty, 1);
  // payments: limited by staff, full by the administrator
  const p = await s.recordSupplierPayment({ operationId: 'op-emu-pay-ed-0001', invoiceId: r.invoice.id, numbering: SPN, date: today(), lines: [{ accountId: 'bank1', amount: '100', reference: 'T1' }] });
  await assertSucceeds(s.editSupplierPayment({ operationId: 'op-emu-pedit-00001', paymentId: p.payment.id, mode: 'limited', references: ['T0001'], reason: 'typo' }));
  await assertFails(updateDoc(doc(db, 'supplierPayments/' + p.payment.id), { amount: 1, revision: 3, updatedByUid: 'aisha' }));
  await assertSucceeds(boss.editSupplierPayment({ operationId: 'op-emu-pedit-00002', paymentId: p.payment.id, mode: 'full', date: today(), lines: [{ accountId: 'bank1', amount: '90', reference: 'T0001' }], reason: 'wrong amount' }));
  const pi = (await getDoc(doc(db, 'purchaseInvoices/' + r.invoice.id))).data();
  assert.equal(pi.paid, 90);
  assert.equal((await getDoc(doc(db, `cashLines/${p.payment.entryId}__bank1`))).data().void, true);
  // full invoice edit is refused once paid
  await assert.rejects(boss.editPurchaseInvoice({ operationId: 'op-emu-edit-000004', invoiceId: r.invoice.id, mode: 'full', ...base({ supplierInvoiceNo: 'ED-100' }), reason: 'x' }), /has payments/);
});

test('[emulator] V268.32 full edit of a discount-only payment and of a cash back pass the rules', async () => {
  const s = svc('aisha'), boss = svc('boss'), db = user('aisha');
  const r = await s.createPurchaseInvoice(base({ supplierInvoiceNo: 'ED-2' }));
  const d = await assertSucceeds(s.recordSupplierPayment({ operationId: 'op-emu-disc-000001', invoiceId: r.invoice.id, numbering: SPN, date: today(), lines: [], discount: '5' }));
  await assertSucceeds(boss.editSupplierPayment({ operationId: 'op-emu-dedit-00001', paymentId: d.payment.id, mode: 'full', date: today(), lines: [], discount: '6', reason: 'supplier agreed 6' }));
  assert.equal((await getDoc(doc(db, 'purchaseInvoices/' + r.invoice.id))).data().paymentDiscount, 6);
  await s.recordSupplierPayment({ operationId: 'op-emu-pay-ed-0002', invoiceId: r.invoice.id, numbering: SPN, date: today(), lines: [{ accountId: 'bank1', amount: '100' }] });
  const cb = await s.recordSupplierCashBack({ operationId: 'op-emu-cb-ed-00001', invoiceId: r.invoice.id, numbering: SPN, date: today(), lines: [{ accountId: 'cash1', amount: '20' }] });
  await assertSucceeds(boss.editSupplierPayment({ operationId: 'op-emu-cbedit-0001', paymentId: cb.payment.id, mode: 'full', date: today(), lines: [{ accountId: 'bank1', amount: '25' }], reason: 'it came by bank' }));
  assert.equal((await getDoc(doc(db, 'purchaseInvoices/' + r.invoice.id))).data().cashBack, 25);
});

test('[emulator] V268.4 stock: allocate to an order and cancel pass the rules; direct changes refused', async () => {
  const s = svc('aisha'), db = user('aisha');
  await env.withSecurityRulesDisabled(async ctx => { await setDoc(doc(ctx.firestore(), 'salesOrders/so9'), { id: 'so9', soNo: 'SO-2610-0009', customer: 'MOHG', items: [{ lineId: 'A', desc: 'Cable 4 mm', uom: 'Roll', qty: 3, up: 70, code: 'CB4' }] }); });
  await s.createPurchaseInvoice(base({ supplierInvoiceNo: 'ST-1' }));   // 5 rolls: 3 for SO-0004, 2 to stock
  assert.equal((await getDoc(doc(db, 'stockItems/d_cb4__roll'))).data().qty, 2);
  const a = await assertSucceeds(s.allocateStock({ operationId: 'op-emu-alloc-00001', itemKey: 'd_cb4__roll', soId: 'so9', soLineId: 'A', qty: '2', date: today() }));
  assert.equal((await getDoc(doc(db, 'stockItems/d_cb4__roll'))).data().qty, 0);
  assert.deepEqual((await getDoc(doc(db, 'salesOrderPurchasing/so9'))).data().lines.A, { purchased: 2, fromStock: 2 });
  // a stock change or an allocation on its own is refused
  await assertFails(updateDoc(doc(db, 'stockItems/d_cb4__roll'), { qty: 5, revision: 4, updatedByUid: 'aisha' }));
  await assertFails(setDoc(doc(db, 'stockAllocations/SA-loose-0000001'), { id: 'SA-loose-0000001', status: 'Posted', revision: 1, createdByUid: 'aisha', updatedByUid: 'aisha', qty: 1, unitCost: 1, value: 1, date: today(), itemKey: 'd_cb4__roll', soId: 'so9', soLineId: 'A', lastEventId: 'x' }));
  await assertSucceeds(s.cancelStockAllocation({ operationId: 'op-emu-allocv-0001', allocationId: a.allocation.id, reason: 'wrong order' }));
  assert.equal((await getDoc(doc(db, 'stockItems/d_cb4__roll'))).data().qty, 2);
  assert.equal((await getDoc(doc(db, 'stockAllocations/' + a.allocation.id))).data().status, 'Voided');
});

test('[emulator] V268.5 Change Item: administrators move stock to the correct product and cancel; staff and direct changes refused', async () => {
  const db = user('boss');
  const stockLine = { kind: 'stock', productId: 'p-pel-typo', desc: 'Pelican 7600 flash light', uom: 'Pcs', qty: 3, unitCost: 620 };
  await svc('aisha').createPurchaseInvoice(base({ supplierInvoiceNo: 'CH-1', lines: [stockLine], supplierTotal: 2139 }));
  const PEL = { id: 'p-pel', name: 'Pelican 7600 flashlight', code: 'PEL7600', uom: 'Pcs' };
  const input = op => ({ operationId: op, itemKey: 'p_p-pel-typo', product: PEL, qty: '2', reason: 'Typed wrong on the PI' });
  // staff: the service refuses first; a direct write is refused by the rules
  await assert.rejects(svc('aisha').changeStockItem(input('op-emu-chg-000001')), e => e.code === 'not-admin');
  await assertFails(setDoc(doc(user('aisha'), 'stockChanges/SC-op-emu-chg-000009'), { id: 'SC-op-emu-chg-000009', status: 'Posted', revision: 1, createdByUid: 'aisha', updatedByUid: 'aisha',
    fromKey: 'p_p-pel-typo', toKey: 'p_p-pel', qty: 1, value: 620, reason: 'Typed wrong on the PI', lastEventId: 'x' }));
  const c = await assertSucceeds(svc('boss').changeStockItem(input('op-emu-chg-000002')));
  assert.equal((await getDoc(doc(db, 'stockItems/p_p-pel-typo'))).data().qty, 1);
  assert.equal((await getDoc(doc(db, 'stockItems/p_p-pel'))).data().qty, 2);
  assert.equal((await getDoc(doc(db, `stockMovements/${c.change.id}__in`))).data().kind, 'changed-from');
  // direct changes refused (even for an administrator)
  await assertFails(updateDoc(doc(db, 'stockItems/p_p-pel'), { qty: 9, revision: 3, updatedByUid: 'boss', lastChangeId: c.change.id }));
  await assertFails(updateDoc(doc(db, 'stockChanges/' + c.change.id), { qty: 1 }));
  await assertFails(deleteDoc(doc(db, 'stockChanges/' + c.change.id)));
  await assert.rejects(svc('aisha').cancelStockChange({ operationId: 'op-emu-chgv-00001', changeId: c.change.id, reason: 'chosen by mistake' }), e => e.code === 'not-admin');
  await assertFails(updateDoc(doc(user('aisha'), 'stockChanges/' + c.change.id), { status: 'Voided', voidReason: 'chosen by mistake', revision: 2, updatedByUid: 'aisha', voidedByUid: 'aisha' }));
  await assertSucceeds(svc('boss').cancelStockChange({ operationId: 'op-emu-chgv-00002', changeId: c.change.id, reason: 'chosen by mistake' }));
  assert.equal((await getDoc(doc(db, 'stockItems/p_p-pel-typo'))).data().qty, 3);
  assert.equal((await getDoc(doc(db, 'stockItems/p_p-pel'))).data().qty, 0);
  assert.equal((await getDoc(doc(db, 'stockChanges/' + c.change.id))).data().status, 'Voided');
});

test('[emulator] V268.5 purchase settings: who may add a new product (everyone / administrators)', async () => {
  const ok = { costLimitPct: 5, costLimitAction: 'reason', discountMode: 'invoice', roundingLimit: 1, vatRate: 15, profitVisibility: 'admins', editMode: 'limited-admin', editDays: 7 };
  await assertSucceeds(svc('boss').savePurchaseSettings({ ...ok, newProductRight: 'admins' }));
  assert.equal((await getDoc(doc(user('aisha'), 'settings/purchasing'))).data().newProductRight, 'admins');
  await assertFails(setDoc(doc(user('boss'), 'settings/purchasing'), { ...ok, newProductRight: 'nobody', updatedByUid: 'boss' }));
});
