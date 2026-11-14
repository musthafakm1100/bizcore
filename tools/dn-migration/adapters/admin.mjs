/**
 * Firestore Admin SDK adapter (production or Firebase Emulator).
 * Emulator: set FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 before running; no credentials needed.
 * Production: pass a service-account JSON file (never commit it; keep it outside the app folder).
 */
import { readFileSync } from 'node:fs';

export async function createAdminStore({ projectId, credentialsFile }) {
  const { initializeApp, cert, getApps } = await import('firebase-admin/app');
  const { getFirestore } = await import('firebase-admin/firestore');
  if (!projectId) throw new Error('--project is required');
  const usingEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;
  if (!usingEmulator && !credentialsFile) throw new Error('--credentials <service-account.json> is required for a live project');
  const app = getApps().find(a => a.name === projectId) || initializeApp(
    usingEmulator ? { projectId } : { projectId, credential: cert(JSON.parse(readFileSync(credentialsFile, 'utf8'))) }, projectId);
  const db = getFirestore(app);
  const plain = v => JSON.parse(JSON.stringify(v, (k, x) => (x && typeof x.toDate === 'function' ? x.toDate().toISOString() : x)));

  // One query per collection for the data; listDocuments() also finds "missing" parent documents that only
  // hold subcollections. Subcollection discovery runs in parallel (25 at a time) and progress is printed.
  async function walk(colRef, out, progress) {
    const [snap, refs] = await Promise.all([colRef.get(), colRef.listDocuments()]);
    for (const d of snap.docs) out[d.ref.path] = plain(d.data());
    progress(colRef.path, snap.size);
    for (let i = 0; i < refs.length; i += 25) {
      await Promise.all(refs.slice(i, i + 25).map(async ref => {
        for (const sub of await ref.listCollections()) await walk(sub, out, progress);
      }));
    }
  }
  return {
    projectId, usingEmulator,
    async list(collectionPath) {
      const snap = await db.collection(collectionPath).get();
      return snap.docs.map(d => ({ id: d.id, path: d.ref.path, data: plain(d.data()) }));
    },
    async get(path) { const s = await db.doc(path).get(); return s.exists ? plain(s.data()) : null; },
    async exportAll({ onProgress } = {}) {
      const out = {}; let total = 0;
      const progress = (path, n) => { total += n; if (onProgress && !path.includes('/')) onProgress(`  ${path}: ${n} document(s) — ${total} so far`); };
      for (const col of await db.listCollections()) await walk(col, out, progress);
      return out;
    },
    async transaction(fn) {
      return db.runTransaction(async t => {
        const tx = {
          async get(path) { const s = await t.get(db.doc(path)); return s.exists ? plain(s.data()) : null; },
          set(path, data) { t.set(db.doc(path), data); },
          create(path, data) { t.create(db.doc(path), data); },
          delete(path) { t.delete(db.doc(path)); },
        };
        return fn(tx);
      });
    },
    async batch(ops) {
      const b = db.batch();
      for (const o of ops) {
        if (o.op === 'set') b.set(db.doc(o.path), o.data);
        else if (o.op === 'create') b.create(db.doc(o.path), o.data);
        else if (o.op === 'delete') b.delete(db.doc(o.path));
        else throw new Error('Unknown op ' + o.op);
      }
      await b.commit();
    },
    async close() { const { deleteApp } = await import('firebase-admin/app'); await deleteApp(app); },
  };
}
