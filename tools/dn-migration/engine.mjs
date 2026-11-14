/**
 * BizCore V260 Delivery Note migration engine.
 *
 * Works through a small storage adapter (see adapters/) so the exact same logic runs
 * against production Firestore (Admin SDK), the Firebase Emulator, or the in-memory
 * simulator used by the automated tests.
 *
 * Adapter contract:
 *   projectId                      string
 *   list(collectionPath)           -> [{ id, path, data }]
 *   get(path)                      -> data | null
 *   exportAll()                    -> { [path]: data }   (every document, recursively)
 *   transaction(async tx => ...)   tx.get(path) -> data|null ; tx.set(path, data) ; tx.create(path, data) ; tx.delete(path)
 *   batch(ops)                     ops: [{ op:'set'|'create'|'delete', path, data }] (atomic, ≤ 450 ops)
 *
 * Storage modes (system/deliveryNoteStorage.mode):
 *   legacy       V259 behaviour: DNs embedded in Sales Orders (default when the document is absent)
 *   migrating    write freeze: V260 clients refuse SO/DN writes; security rules deny SO writes
 *   independent  V260 behaviour: DNs, events and ledgers are separate documents
 */
import { createHash } from 'node:crypto';
import { planMigration, verifyMigration, canonical, MIGRATION_VERSION } from '../../js/delivery-migration.mjs';
import { COLLECTIONS, STORAGE_MODE_DOC_ID, STORAGE_MODES, reconcileSalesOrder } from '../../js/delivery-core.mjs';

export const MODE_PATH = `${COLLECTIONS.system}/${STORAGE_MODE_DOC_ID}`;
export const MIN_CLIENT_VERSION = 260;
const sha256 = s => createHash('sha256').update(s).digest('hex');

export class MigrationError extends Error { constructor(message, details) { super(message); this.details = details; } }

export async function getMode(store) {
  const d = await store.get(MODE_PATH);
  return d?.mode || STORAGE_MODES.legacy;
}
async function setMode(store, mode, note, extra = {}) {
  const now = new Date().toISOString();
  await store.transaction(async tx => {
    const cur = await tx.get(MODE_PATH);
    const previousMode = cur?.mode || STORAGE_MODES.legacy;
    tx.set(MODE_PATH, { ...(cur || {}), ...extra, mode, previousMode, minClientVersion: MIN_CLIENT_VERSION, updatedAt: now, updatedBy: 'tools/dn-migration', note });
    tx.set(`${MODE_PATH}/changes/${now.replace(/[^0-9]/g, '')}-${mode}`, { from: previousMode, to: mode, at: now, note, ...extra });
  });
}

async function loadSalesOrders(store) { return (await store.list(COLLECTIONS.salesOrders)).map(d => d.data); }
async function loadIndependent(store) {
  const docs = new Map();
  const dns = await store.list(COLLECTIONS.deliveryNotes);
  for (const d of dns) {
    docs.set(d.path, d.data);
    for (const col of [COLLECTIONS.dispatchEvents, COLLECTIONS.acceptanceEvents]) for (const e of await store.list(`${d.path}/${col}`)) docs.set(e.path, e.data);
  }
  for (const l of await store.list(COLLECTIONS.fulfillment)) docs.set(l.path, l.data);
  return { docs, deliveryNotes: dns.map(d => d.data) };
}

/** Writes an explicit `legacy` mode document if none exists. With an explicit document, browsers
 *  that start offline can trust their cached copy instead of opening read-only. No other change. */
export async function init(store) {
  const cur = await store.get(MODE_PATH);
  if (cur) return { ok: true, created: false, mode: cur.mode };
  await setMode(store, STORAGE_MODES.legacy, 'V260 deployed; explicit legacy mode');
  return { ok: true, created: true, mode: STORAGE_MODES.legacy };
}

/* ───────────── backup ───────────── */
export async function backup(store, { log } = {}) {
  const documents = await store.exportAll({ onProgress: log });
  const body = canonical(documents);
  const counts = {};
  for (const p of Object.keys(documents)) { const top = p.split('/')[0]; counts[top] = (counts[top] || 0) + 1; }
  return { meta: { app: 'BizCore', kind: 'firestore-backup', projectId: store.projectId, takenAt: new Date().toISOString(), counts, documentCount: Object.keys(documents).length, sha256: sha256(body), tool: MIGRATION_VERSION }, documents };
}
export function validateBackup(b, projectId) {
  if (!b?.meta || b.meta.kind !== 'firestore-backup' || !b.documents) throw new MigrationError('Not a BizCore Firestore backup file');
  if (b.meta.projectId !== projectId) throw new MigrationError(`Backup belongs to project ${b.meta.projectId}, not ${projectId}`);
  if (sha256(canonical(b.documents)) !== b.meta.sha256) throw new MigrationError('Backup checksum mismatch — the file is corrupted or was edited');
  return true;
}

/* ───────────── preflight (read-only) ───────────── */
export async function preflight(store) {
  const mode = await getMode(store);
  const sos = await loadSalesOrders(store);
  const result = planMigration(sos);
  const { docs } = await loadIndependent(store);
  // Idempotency check against anything already written by an earlier (partial) run.
  // Every planned path is read directly: events may exist under a DN that was not yet written.
  const planned = [...result.plan.deliveryNotes, ...result.plan.events, ...result.plan.ledgers];
  const present = await readPaths(store, planned.map(x => x.path));
  const conflicts = [], alreadyPresent = { deliveryNotes: 0, events: 0, ledgers: 0 };
  const check = (kind, item) => {
    const have = present.get(item.path);
    if (!have) return;
    alreadyPresent[kind]++;
    if (canonical(item.data) !== canonical(stripVolatile(have))) conflicts.push({ kind, path: item.path });
  };
  result.plan.deliveryNotes.forEach(x => check('deliveryNotes', x));
  result.plan.events.forEach(x => check('events', x));
  result.plan.ledgers.forEach(x => check('ledgers', x));
  const foreign = [...docs.keys()].filter(p => p.split('/').length === 2 && p.startsWith(COLLECTIONS.deliveryNotes + '/') && !docs.get(p).migratedFrom);
  if (mode === STORAGE_MODES.independent) conflicts.push({ kind: 'mode', path: MODE_PATH, message: 'Database is already in independent mode' });
  for (const c of conflicts) result.issues.push({ severity: 'blocker', code: 'EXISTING_DOCUMENT_DIFFERS', message: c.message || `${c.path} already exists with different content`, ...c });
  if (foreign.length && mode !== STORAGE_MODES.independent) result.issues.push({ severity: 'warning', code: 'NON_MIGRATED_DN_PRESENT', message: `${foreign.length} independent DN(s) exist that were not created by this migration`, paths: foreign.slice(0, 20) });
  result.ready = !result.issues.some(i => i.severity === 'blocker');
  result.mode = mode;
  result.alreadyPresent = alreadyPresent;
  return result;
}
const stripVolatile = x => { const { migratedAt, recordedAt, ...rest } = x || {}; return rest; };
async function readPaths(store, paths) {
  const out = new Map();
  for (let i = 0; i < paths.length; i += 50) {
    const part = paths.slice(i, i + 50);
    const vals = await Promise.all(part.map(p => store.get(p)));
    part.forEach((p, j) => { if (vals[j] != null) out.set(p, vals[j]); });
  }
  return out;
}

/* ───────────── migrate (idempotent, resumable) ───────────── */
export async function migrate(store, { backupMeta, runId = 'run-' + Date.now(), log = () => {} } = {}) {
  if (!backupMeta || backupMeta.projectId !== store.projectId) throw new MigrationError('A verified backup of this project is required before migrating');
  const mode = await getMode(store);
  if (mode === STORAGE_MODES.independent) throw new MigrationError('Database is already in independent mode');
  // 1. Freeze writes, THEN plan from the frozen state (nothing can change underneath).
  if (mode !== STORAGE_MODES.migrating) await setMode(store, STORAGE_MODES.migrating, 'Delivery Note migration started', { runId, backupSha256: backupMeta.sha256 });
  log('Write freeze active (mode=migrating).');
  const pf = await preflight(store);
  if (!pf.ready) { log('Preflight blockers found; database left in migrating (read-only) mode. Fix data or run "unfreeze".'); return { ok: false, preflight: pf }; }
  const { soUpdates, deliveryNotes, events, ledgers } = pf.plan;
  let written = { soLineIds: 0, deliveryNotes: 0, events: 0, ledgers: 0 }, skipped = 0;
  // 2. SO line IDs — only the `items` field changes; the SO must still match the planned source.
  for (const u of soUpdates.filter(u => u.changed)) {
    await store.transaction(async tx => {
      const cur = await tx.get(`${COLLECTIONS.salesOrders}/${u.soId}`);
      if (!cur) throw new MigrationError(`Sales Order ${u.soId} disappeared during migration`);
      if (canonical(cur.items) !== u.sourceHash) throw new MigrationError(`Sales Order ${u.soId} changed during migration; re-run preflight`);
      tx.set(`${COLLECTIONS.salesOrders}/${u.soId}`, { ...cur, items: u.items });
    });
    written.soLineIds++;
  }
  log(`Line IDs assigned on ${written.soLineIds} Sales Order(s).`);
  // 3. Events first, then the DN that references them, then ledgers — so a DN never exists without its audit trail.
  const existing = await readPaths(store, [...events, ...deliveryNotes, ...ledgers].map(x => x.path));
  const writeAll = async (items, kind) => {
    const pending = items.filter(i => { if (existing.has(i.path)) { skipped++; return false; } return true; });
    for (let i = 0; i < pending.length; i += 400) {
      await store.batch(pending.slice(i, i + 400).map(x => ({ op: 'create', path: x.path, data: x.data })));
      written[kind] += Math.min(400, pending.length - i);
    }
  };
  await writeAll(events, 'events'); log(`Events written: ${written.events}`);
  await writeAll(deliveryNotes, 'deliveryNotes'); log(`Delivery Notes written: ${written.deliveryNotes}`);
  await writeAll(ledgers, 'ledgers'); log(`Ledgers written: ${written.ledgers}`);
  await store.batch([{ op: 'set', path: `migrationRuns/${runId}`, data: { runId, migration: MIGRATION_VERSION, finishedAt: new Date().toISOString(), written, skipped, stats: pf.stats, backupSha256: backupMeta.sha256 } }]);
  const v = await verify(store);
  log(v.ok ? 'Verification passed.' : 'Verification FAILED — see report. Database remains frozen (migrating).');
  return { ok: v.ok, runId, written, skipped, verification: v, preflight: pf };
}

/* ───────────── verify / reconcile (read-only) ───────────── */
export async function verify(store, { sourceSalesOrders } = {}) {
  const current = await loadSalesOrders(store);
  const source = sourceSalesOrders || current;
  const ind = await loadIndependent(store);
  const stored = { salesOrders: new Map(current.map(s => [s.id, s])), docs: ind.docs };
  const v = verifyMigration(source, stored);
  const r = await reconcile(store, { salesOrders: current, independent: ind });
  return { ok: v.ok && r.ok, migration: v, reconciliation: r };
}
export async function reconcile(store, preloaded = {}) {
  const sos = preloaded.salesOrders || await loadSalesOrders(store);
  const ind = preloaded.independent || await loadIndependent(store);
  const problems = [];
  const soById = new Map(sos.map(s => [s.id, s]));
  for (const dn of ind.deliveryNotes) {
    if (!soById.has(dn.salesOrderId)) problems.push({ code: 'ORPHAN_DN', dnId: dn.id });
    // Audit chain: one event per revision, and the DN points at an existing last event.
    const evs = [...ind.docs.entries()].filter(([p]) => p.startsWith(`${COLLECTIONS.deliveryNotes}/${dn.id}/`)).map(([, e]) => e).sort((a, b) => a.toRevision - b.toRevision);
    const revs = evs.map(e => e.toRevision);
    const expected = Array.from({ length: dn.revision || 0 }, (_, i) => i + 1);
    if (canonical(revs) !== canonical(expected)) problems.push({ code: 'AUDIT_CHAIN', dnId: dn.id, revisions: revs, expected: dn.revision });
    if (!ind.docs.has(`${COLLECTIONS.deliveryNotes}/${dn.id}/${dn.lastEventCollection}/${dn.lastEventId}`)) problems.push({ code: 'LAST_EVENT_MISSING', dnId: dn.id });
  }
  const dnsBySO = new Map();
  for (const dn of ind.deliveryNotes) { const l = dnsBySO.get(dn.salesOrderId) || []; l.push(dn); dnsBySO.set(dn.salesOrderId, l); }
  for (const so of sos) {
    const dns = dnsBySO.get(so.id) || [];
    const ledger = ind.docs.get(`${COLLECTIONS.fulfillment}/${so.id}`) || null;
    if (!dns.length && !ledger) continue;
    const r = reconcileSalesOrder(so, dns, ledger || { lines: {} });
    if (!r.ok) problems.push({ code: 'SALES_ORDER', soId: so.id, soNo: so.soNo, problems: r.problems });
  }
  return { ok: problems.length === 0, problems, counts: { salesOrders: sos.length, deliveryNotes: ind.deliveryNotes.length } };
}

/* ───────────── cutover / unfreeze / rollback ───────────── */
export async function cutover(store, { log = () => {} } = {}) {
  const mode = await getMode(store);
  if (mode !== STORAGE_MODES.migrating) throw new MigrationError(`Cutover requires mode "migrating" (current: ${mode}). Run migrate first.`);
  const v = await verify(store);
  if (!v.ok) throw new MigrationError('Verification failed; cutover refused', v);
  await setMode(store, STORAGE_MODES.independent, 'Cutover to independent Delivery Notes', { cutoverAt: new Date().toISOString() });
  log('Mode is now independent. V260 clients reload automatically; V259 clients are refused by security rules.');
  return { ok: true, verification: v };
}
export async function unfreeze(store) {
  const mode = await getMode(store);
  if (mode !== STORAGE_MODES.migrating) throw new MigrationError(`Not frozen (mode: ${mode})`);
  await setMode(store, STORAGE_MODES.legacy, 'Migration abandoned; returned to legacy mode');
  return { ok: true };
}
/** Returns to legacy mode. Only possible while no business activity has happened in independent
 *  mode and the legacy embedded data is still intact (i.e. before `strip`). */
export async function rollback(store) {
  const mode = await getMode(store);
  if (mode === STORAGE_MODES.legacy) throw new MigrationError('Already in legacy mode');
  const ind = await loadIndependent(store);
  const newDNs = ind.deliveryNotes.filter(d => !d.migratedFrom);
  const newEvents = [...ind.docs.entries()].filter(([p, e]) => p.split('/').length === 4 && !e.migrated);
  if (newDNs.length || newEvents.length) throw new MigrationError(`Rollback refused: ${newDNs.length} new DN(s) and ${newEvents.length} new event(s) were recorded after cutover and would be lost. Restore from backup and re-enter those transactions, or keep independent mode.`, { newDNs: newDNs.map(d => d.dnNo || d.id) });
  const sos = await loadSalesOrders(store);
  const migratedBySO = new Map();
  for (const d of ind.deliveryNotes) migratedBySO.set(d.salesOrderId, (migratedBySO.get(d.salesOrderId) || 0) + 1);
  const stripped = sos.filter(s => (migratedBySO.get(s.id) || 0) > 0 && !(Array.isArray(s.deliveries) && s.deliveries.length));
  if (stripped.length) throw new MigrationError(`Rollback refused: ${stripped.length} Sales Order(s) were already stripped of embedded deliveries. Use "restore" from the pre-migration backup.`);
  await setMode(store, STORAGE_MODES.legacy, 'Rolled back to legacy embedded Delivery Notes');
  return { ok: true };
}

/* ───────────── strip (after cutover) ───────────── */
/** Removes the now-redundant embedded `deliveries` from Sales Orders. Requires a backup and a passing verification. */
export async function strip(store, { backupMeta, log = () => {} } = {}) {
  if (!backupMeta || backupMeta.projectId !== store.projectId) throw new MigrationError('A verified backup of this project is required before stripping');
  const mode = await getMode(store);
  if (mode !== STORAGE_MODES.independent) throw new MigrationError('Strip is only allowed after cutover (independent mode)');
  // Verify migrated DNs against the CURRENT embedded copies (ignoring later business activity on new DNs).
  const sos = await loadSalesOrders(store);
  const ind = await loadIndependent(store);
  const plan = planMigration(sos);
  const problems = [];
  for (const d of plan.plan.deliveryNotes) {
    const have = ind.docs.get(d.path);
    if (!have) problems.push({ code: 'MISSING', path: d.path });
    else if (!have.migratedFrom) problems.push({ code: 'NOT_MIGRATED_COPY', path: d.path });
  }
  if (problems.length) throw new MigrationError('Some embedded Delivery Notes have no migrated copy; strip refused', problems);
  let count = 0;
  for (const so of sos.filter(s => Array.isArray(s.deliveries) && s.deliveries.length)) {
    await store.transaction(async tx => {
      const cur = await tx.get(`${COLLECTIONS.salesOrders}/${so.id}`);
      if (!cur) return;
      if (canonical(cur.deliveries) !== canonical(so.deliveries)) throw new MigrationError(`Sales Order ${so.id} changed during strip`);
      const { deliveries, ...rest } = cur;
      tx.set(`${COLLECTIONS.salesOrders}/${so.id}`, { ...rest, legacyDeliveriesStripped: { migration: MIGRATION_VERSION, count: deliveries.length, backupSha256: backupMeta.sha256 } });
    });
    count++;
  }
  log(`Embedded deliveries removed from ${count} Sales Order(s).`);
  return { ok: true, stripped: count };
}

/* ───────────── restore ───────────── */
/** Restores Sales Orders (and optionally every collection) from a backup and returns to legacy mode. */
export async function restore(store, backupFile, { collections = [COLLECTIONS.salesOrders], log = () => {} } = {}) {
  validateBackup(backupFile, store.projectId);
  await setMode(store, STORAGE_MODES.migrating, 'Restore from backup in progress', { restoreFrom: backupFile.meta.sha256 });
  const wanted = Object.entries(backupFile.documents).filter(([p]) => collections.includes(p.split('/')[0]) && p.split('/').length === 2);
  const ops = wanted.map(([path, data]) => ({ op: 'set', path, data }));
  const keep = new Set(wanted.map(([p]) => p));
  for (const c of collections) for (const d of await store.list(c)) if (!keep.has(d.path)) ops.push({ op: 'delete', path: d.path });
  for (let i = 0; i < ops.length; i += 400) await store.batch(ops.slice(i, i + 400));
  const target = backupFile.documents[MODE_PATH]?.mode || STORAGE_MODES.legacy;
  await setMode(store, target === STORAGE_MODES.migrating ? STORAGE_MODES.legacy : target, 'Restored from backup ' + backupFile.meta.takenAt);
  log(`Restored ${wanted.length} document(s); mode=${target}.`);
  return { ok: true, restored: wanted.length };
}

/** Recomputes ledgers from DNs (for repair after reconciliation finds a mismatch). Runs under a write freeze. */
export async function repairLedgers(store, { log = () => {} } = {}) {
  const mode = await getMode(store);
  if (mode !== STORAGE_MODES.independent) throw new MigrationError('repair-ledgers applies to independent mode only');
  await setMode(store, STORAGE_MODES.migrating, 'Ledger repair');
  try {
    const sos = await loadSalesOrders(store);
    const ind = await loadIndependent(store);
    let fixed = 0;
    for (const so of sos) {
      const dns = ind.deliveryNotes.filter(d => d.salesOrderId === so.id);
      const path = `${COLLECTIONS.fulfillment}/${so.id}`;
      const ledger = ind.docs.get(path);
      if (!dns.length && !ledger) continue;
      const r = reconcileSalesOrder(so, dns, ledger || { lines: {} });
      if (r.ok) continue;
      if (!r.expected) throw new MigrationError(`Cannot repair ${so.id}: ${r.problems.map(p => p.message || p.code).join('; ')}`);
      // Recompute only the delivery quantities; keep other per-line fields (invoiced quantities).
      const lines = {};
      for (const id of new Set([...Object.keys(ledger?.lines || {}), ...Object.keys(r.expected)])) {
        lines[id] = { ...((ledger?.lines || {})[id] || {}), ...(r.expected[id] || { inTransit: 0, accepted: 0, rejected: 0 }) };
      }
      await store.batch([{ op: 'set', path, data: { ...(ledger || {}), salesOrderId: so.id, lines, revision: (Number(ledger?.revision) || 0) + 1, repairedAt: new Date().toISOString(), lastEventId: 'repair' } }]);
      fixed++;
    }
    log(`Repaired ${fixed} ledger(s).`);
    return { ok: true, fixed };
  } finally { await setMode(store, STORAGE_MODES.independent, 'Ledger repair finished'); }
}

export async function status(store) {
  const mode = await getMode(store);
  const modeDoc = await store.get(MODE_PATH);
  const sos = await loadSalesOrders(store);
  const embedded = sos.reduce((n, s) => n + (Array.isArray(s.deliveries) ? s.deliveries.length : 0), 0);
  const dns = await store.list(COLLECTIONS.deliveryNotes);
  return { projectId: store.projectId, mode, modeDoc, salesOrders: sos.length, embeddedDeliveryNotes: embedded, independentDeliveryNotes: dns.length };
}
