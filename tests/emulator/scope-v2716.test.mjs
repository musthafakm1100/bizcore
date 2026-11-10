/**
 * FIREBASE EMULATOR tests — V271.6 scope of work: the quotation body record (quotations/{id}/bodies/main),
 * the Text Blocks library (textBlocks/{id}, svc_{item} = a service item's standard scope) and the frozen
 * accepted scope of a job (jobs/{id}/scope/main).
 * Run on your PC from the BizCore folder:  RUN_EMULATOR_TESTS.bat
 */
import test, { before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { seedStaff, staffRecord } from './staff-seed.mjs';
import { doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';

let env;
before(async () => {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
  env = await initializeTestEnvironment({ projectId: 'demo-bizcore', firestore: { host, port: Number(port), rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') } });
});
after(async () => { await env?.cleanup(); });
const P = (mods) => Object.fromEntries(Object.entries(mods).map(([m, s]) => [m, { v: s.includes('v'), c: s.includes('c'), e: s.includes('e'), x: s.includes('x'), own: s.includes('o') }]));
beforeEach(async () => {
  await env.clearFirestore(); await seedStaff(env);
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'system/accessControl'), { adminUids: ['boss'] });
    // bob: quotations (create / edit), no Text Blocks rights · carol: views quotations of her own only · dave: nothing of quotations
    await setDoc(doc(db, 'users/bob'), staffRecord('bob', 'r-bob', P({ quotation: 'vce' })));
    await setDoc(doc(db, 'users/carol'), staffRecord('carol', 'r-carol', P({ quotation: 'vceo' })));
    await setDoc(doc(db, 'users/dave'), staffRecord('dave', 'r-dave', P({ customers: 'v' })));
    await setDoc(doc(db, 'users/u1'), staffRecord('u1', 'r-u1', P({ products: 'vce' })));
    await setDoc(doc(db, 'quotations/q1'), { id: 'q1', qno: 'QT-2611-0042', company: 'Arnon', ownerUid: 'aisha', status: 'Draft', items: [] });
    await setDoc(doc(db, 'quotations/q1/bodies/main'), { qid: 'q1', qno: 'QT-2611-0042', scopes: { sk1: '<div>Supply and install…</div>' }, updated: '2026-11-10' });
  });
});
const user = uid => env.authenticatedContext(uid, { email: uid + '@dt.com' }).firestore();
const body = (qid, extra = {}) => ({ qid, qno: 'QT-2611-0050', scopes: { skA: '<div>Gypsum partitions</div>' }, updated: '2026-11-10', ...extra });

test('[emulator] V271.6 a new quotation and its scope body are written in one commit', async () => {
  const db = user('bob');
  const b = writeBatch(db);
  b.set(doc(db, 'quotations/q2'), { id: 'q2', qno: 'QT-2611-0050', company: 'Arnon', ownerUid: 'bob', status: 'Draft', items: [], scopeBody: true });
  b.set(doc(db, 'quotations/q2/bodies/main'), body('q2'));
  await assertSucceeds(b.commit());
  await assertSucceeds(getDoc(doc(db, 'quotations/q2/bodies/main')));
  await assertSucceeds(setDoc(doc(db, 'quotations/q2/bodies/main'), body('q2', { scopes: { skA: '<div>changed</div>' } })));
});

test('[emulator] V271.6 the body record: only "main", its own quotation id, the quotation must exist; never deleted by staff', async () => {
  const db = user('bob');
  await assertFails(setDoc(doc(db, 'quotations/q1/bodies/other'), body('q1')));        // only bodies/main
  await assertFails(setDoc(doc(db, 'quotations/q1/bodies/main'), body('q9')));         // another quotation's id
  await assertFails(setDoc(doc(db, 'quotations/q7/bodies/main'), body('q7')));         // no such quotation
  await assertFails(setDoc(doc(db, 'quotations/q1/bodies/main'), body('q1', { scopes: 'text' })));  // scopes must be a map
  await assertSucceeds(setDoc(doc(db, 'quotations/q1/bodies/main'), body('q1')));
  await assertFails(deleteDoc(doc(db, 'quotations/q1/bodies/main')));
  await assertSucceeds(deleteDoc(doc(user('boss'), 'quotations/q1/bodies/main')));
});

test('[emulator] V271.6 the body record follows the quotation rights (own records only; no quotation rights = no access)', async () => {
  await assertSucceeds(getDoc(doc(user('bob'), 'quotations/q1/bodies/main')));
  await assertFails(getDoc(doc(user('carol'), 'quotations/q1/bodies/main')));          // Aisha's quotation, carol sees only her own
  await assertFails(setDoc(doc(user('carol'), 'quotations/q1/bodies/main'), body('q1')));
  await assertFails(getDoc(doc(user('dave'), 'quotations/q1/bodies/main')));
  await assertFails(setDoc(doc(user('dave'), 'quotations/q1/bodies/main'), body('q1')));
});

const block = (id, extra = {}) => ({ id, title: 'Standard exclusions', section: 'Exclusions', appliesTo: ['contracting'], html: '<div>Painting excluded</div>', active: true, usedCount: 0, ...extra });

test('[emulator] V271.6 Text Blocks: the Text Blocks rights add / change / deactivate; Quotations users read and count a use', async () => {
  await assertSucceeds(setDoc(doc(user('aisha'), 'textBlocks/tb1'), block('tb1')));
  await assertFails(setDoc(doc(user('bob'), 'textBlocks/tb2'), block('tb2')));           // no Text Blocks → Create
  await assertFails(setDoc(doc(user('aisha'), 'textBlocks/tb3'), block('tb9')));          // id must match
  await assertSucceeds(getDoc(doc(user('bob'), 'textBlocks/tb1')));                        // reads it to insert
  await assertSucceeds(getDocs(collection(user('bob'), 'textBlocks')));
  await assertSucceeds(setDoc(doc(user('bob'), 'textBlocks/tb1'), { usedCount: 1, lastUsed: '2026-11-10' }, { merge: true }));
  await assertFails(updateDoc(doc(user('bob'), 'textBlocks/tb1'), { html: '<div>changed</div>' }));   // only the use count
  await assertFails(getDoc(doc(user('dave'), 'textBlocks/tb1')));
  await assertSucceeds(updateDoc(doc(user('aisha'), 'textBlocks/tb1'), { active: false }));
  await assertFails(deleteDoc(doc(user('aisha'), 'textBlocks/tb1')));
  await assertSucceeds(deleteDoc(doc(user('boss'), 'textBlocks/tb1')));
});

test('[emulator] V271.6 a service item\'s standard scope (textBlocks/svc_…) is saved with the Products rights', async () => {
  const std = block('svc_SRV-00001', { serviceId: 'SRV-00001', section: 'Scope', title: 'Standard scope — Partition works', appliesTo: ['service', 'contracting'] });
  await assertSucceeds(setDoc(doc(user('u1'), 'textBlocks/svc_SRV-00001'), std));
  await assertSucceeds(getDoc(doc(user('u1'), 'textBlocks/svc_SRV-00001')));
  await assertFails(setDoc(doc(user('u1'), 'textBlocks/tb5'), block('tb5')));            // Products rights don't add ordinary blocks
  await assertFails(setDoc(doc(user('bob'), 'textBlocks/svc_SRV-00002'), { ...std, id: 'svc_SRV-00002' }));   // Quotations only
});

const job = { id: 'JOB-2611-0007', jobNo: 'JOB-2611-0007', quotationId: 'q1', contractValue: 48500, status: 'Open' };
const jscope = (extra = {}) => ({ jobId: 'JOB-2611-0007', jobNo: 'JOB-2611-0007', quotationId: 'q1', qno: 'QT-2611-0042', revisionNo: 1, acceptedAt: '2026-11-12', lines: [{ k: 'line', n: 1, title: 'Gypsum partitions', html: '<div>…</div>', workCat: 'Partition & Ceiling Works', qty: 120, uom: 'm²', amount: 42300 }], ...extra });

test('[emulator] V271.6 the accepted scope is written with the new job in one commit, then frozen', async () => {
  const db = user('aisha');
  const b = writeBatch(db);
  b.set(doc(db, 'jobs/JOB-2611-0007'), job);
  b.set(doc(db, 'jobs/JOB-2611-0007/scope/main'), jscope());
  await assertSucceeds(b.commit());
  await assertSucceeds(getDoc(doc(db, 'jobs/JOB-2611-0007/scope/main')));
  await assertFails(setDoc(doc(db, 'jobs/JOB-2611-0007/scope/main'), jscope({ lines: [] })));      // frozen
  await assertFails(deleteDoc(doc(db, 'jobs/JOB-2611-0007/scope/main')));
  await assertSucceeds(deleteDoc(doc(user('boss'), 'jobs/JOB-2611-0007/scope/main')));
});

test('[emulator] V271.6 a job scope can\'t be added later, for another job, or without Sales Orders → Create', async () => {
  await env.withSecurityRulesDisabled(async ctx => setDoc(doc(ctx.firestore(), 'jobs/JOB-2611-0007'), job));
  await assertFails(setDoc(doc(user('aisha'), 'jobs/JOB-2611-0007/scope/main'), jscope()));       // the job already exists
  const db = user('aisha');
  const b = writeBatch(db);
  b.set(doc(db, 'jobs/JOB-2611-0008'), { ...job, id: 'JOB-2611-0008', jobNo: 'JOB-2611-0008' });
  b.set(doc(db, 'jobs/JOB-2611-0008/scope/main'), jscope());                                     // jobId of another job
  await assertFails(b.commit());
  const bob = user('bob');   // one Firestore instance for the whole batch
  const b2 = writeBatch(bob);
  b2.set(doc(bob, 'jobs/JOB-2611-0009'), { ...job, id: 'JOB-2611-0009', jobNo: 'JOB-2611-0009' });
  b2.set(doc(bob, 'jobs/JOB-2611-0009/scope/main'), jscope({ jobId: 'JOB-2611-0009' }));
  await assertFails(b2.commit());
  await assertFails(getDoc(doc(user('dave'), 'jobs/JOB-2611-0007/scope/main')));
});
