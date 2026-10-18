/**
 * FIREBASE EMULATOR tests — V268.5 Data safety: shared settings (were browser-only) and administrator approvals.
 * Run on your PC from the BizCore folder:  RUN_EMULATOR_TESTS.bat
 */
import test, { before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

let env;
before(async () => {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
  env = await initializeTestEnvironment({ projectId: 'demo-bizcore', firestore: { host, port: Number(port), rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') } });
});
after(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'system/accessControl'), { adminUids: ['boss'] });
    await setDoc(doc(db, 'cashCustodians/shabeeb'), { uid: 'shabeeb', name: 'Shabeeb', email: '', accountIds: [], active: true, mustChangePassword: false });
  });
});
const user = uid => env.authenticatedContext(uid, { email: uid + '@dt.com' }).firestore();
const setting = (id, uid, revision, extra = {}) => ({ id, key: 'bizcore_x', json: '[]', revision, updatedAt: serverTimestamp(), updatedBy: uid, updatedByUid: uid, ...extra });

test('[emulator] V268.5 shared settings: units by staff, the others by administrators; revision counts; never deleted', async () => {
  await assertSucceeds(setDoc(doc(user('aisha'), 'sharedSettings/units'), setting('units', 'aisha', 1)));
  await assertSucceeds(setDoc(doc(user('boss'), 'sharedSettings/units'), setting('units', 'boss', 2)));
  await assertFails(setDoc(doc(user('aisha'), 'sharedSettings/units'), setting('units', 'aisha', 2)));            // revision must go up by one
  await assertFails(setDoc(doc(user('aisha'), 'sharedSettings/taxMaster'), setting('taxMaster', 'aisha', 1)));    // administrators only
  await assertSucceeds(setDoc(doc(user('boss'), 'sharedSettings/taxMaster'), setting('taxMaster', 'boss', 1)));
  await assertSucceeds(setDoc(doc(user('boss'), 'sharedSettings/pricing'), setting('pricing', 'boss', 1)));
  await assertFails(setDoc(doc(user('boss'), 'sharedSettings/other'), setting('other', 'boss', 1)));             // unknown setting
  await assertFails(setDoc(doc(user('boss'), 'sharedSettings/units'), setting('units', 'aisha', 3)));            // must be the writer
  await assertFails(setDoc(doc(user('boss'), 'sharedSettings/units'), setting('units', 'boss', 3, { extra: 1 })));
  await assertFails(deleteDoc(doc(user('boss'), 'sharedSettings/units')));
  await assertSucceeds(getDoc(doc(user('aisha'), 'sharedSettings/taxMaster')));
  await assertFails(getDoc(doc(user('shabeeb'), 'sharedSettings/taxMaster')));                                    // cash custodian login
});

test('[emulator] V268.5 approvals: asked by staff, decided only by an administrator, once; never deleted', async () => {
  const ask = (uid, id, extra = {}) => ({ id, kind: 'pricing', rfqId: 'rfq1', rfqNo: 'RFQ-2610-0007', ref: 'PR-2610-0007-V2', version: 2, customer: 'MOHG', marginPct: 8.4, minMargin: 12,
    totalSell: 1000, totalCost: 916, note: '', approverUid: 'boss', approverName: 'Musthafa', status: 'Pending', requestedBy: uid, requestedByUid: uid, requestedAt: serverTimestamp(),
    decidedBy: '', decidedByUid: '', decidedAt: null, decisionNote: '', ...extra });
  await assertSucceeds(setDoc(doc(user('aisha'), 'approvals/apr-1'), ask('aisha', 'apr-1')));
  await assertFails(setDoc(doc(user('aisha'), 'approvals/apr-2'), ask('aisha', 'apr-2', { status: 'Approved' })));   // can't approve your own
  await assertFails(setDoc(doc(user('aisha'), 'approvals/apr-3'), ask('boss', 'apr-3')));                           // in someone else's name
  const decide = (uid, status) => ({ status, decisionNote: 'OK for this customer', decidedBy: uid, decidedByUid: uid, decidedAt: serverTimestamp() });
  await assertFails(updateDoc(doc(user('aisha'), 'approvals/apr-1'), decide('aisha', 'Approved')));
  await assertFails(updateDoc(doc(user('boss'), 'approvals/apr-1'), { ...decide('boss', 'Approved'), marginPct: 1 }));  // figures fixed
  await assertSucceeds(updateDoc(doc(user('boss'), 'approvals/apr-1'), decide('boss', 'Approved')));
  await assertFails(updateDoc(doc(user('boss'), 'approvals/apr-1'), decide('boss', 'Declined')));                    // decided once
  await assertFails(deleteDoc(doc(user('boss'), 'approvals/apr-1')));
});
