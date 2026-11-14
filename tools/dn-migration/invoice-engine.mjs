/**
 * BizCore V264 — invoice migration engine (administrator tool; same storage adapter as engine.mjs).
 *
 * Invoice storage modes (system/invoiceStorage.mode):
 *   legacy       invoices embedded in Sales Orders (default when the document is absent)
 *   migrating    write freeze for invoices: the app refuses to issue invoices; rules refuse SO invoice changes
 *   independent  invoices are customerInvoices/{id} documents; Sales Orders can no longer embed invoices
 *
 * Steps:  invoice-preflight → invoice-migrate (backup required; leaves mode=migrating) → test →
 *         invoice-cutover (backup required; verifies, removes embedded invoices, mode=independent)
 *         invoice-unfreeze abandons a migration before cutover (removes what invoice-migrate wrote).
 */
import { createHash } from 'node:crypto';
import { COLLECTIONS, STORAGE_MODES } from '../../js/delivery-core.mjs';
import {
  planInvoiceMigration, verifyInvoiceMigration, canonical, INVOICE_MIGRATION_VERSION,
  INVOICE_STORAGE_PATH, INVOICE_STORAGE_MODES as MODES, MIGRATED_EVENT_ID,
} from '../../js/invoice-migration.mjs';
import { MODE_PATH, MigrationError } from './engine.mjs';

const sha = s => createHash('sha256').update(s).digest('hex');

export async function getInvoiceMode(store) { return (await store.get(INVOICE_STORAGE_PATH))?.mode || MODES.legacy; }
async function setInvoiceMode(store, mode, note, extra = {}) {
  const now = new Date().toISOString();
  await store.transaction(async tx => {
    const cur = await tx.get(INVOICE_STORAGE_PATH);
    const previousMode = cur?.mode || MODES.legacy;
    tx.set(INVOICE_STORAGE_PATH, { ...(cur || {}), ...extra, mode, previousMode, minClientVersion: 264, updatedAt: now, updatedBy: 'tools/dn-migration', note });
    tx.set(`${INVOICE_STORAGE_PATH}/changes/${now.replace(/[^0-9]/g, '')}-${mode}`, { from: previousMode, to: mode, at: now, note, ...extra });
  });
}
async function load(store) {
  const sos = (await store.list(COLLECTIONS.salesOrders)).map(d => d.data);
  const ledgers = new Map((await store.list(COLLECTIONS.fulfillment)).map(d => [d.id, d.data]));
  return { sos, ledgers };
}
async function requireDNIndependent(store) {
  const m = (await store.get(MODE_PATH))?.mode || STORAGE_MODES.legacy;
  if (m !== STORAGE_MODES.independent) throw new MigrationError(`The Delivery Note migration must be completed first (Delivery Note mode is "${m}").`);
}

export async function invoiceStatus(store) {
  const { sos, ledgers } = await load(store);
  const embedded = sos.reduce((n, s) => n + (Array.isArray(s.invoices) ? s.invoices.length : 0), 0);
  const independent = (await store.list('customerInvoices')).length;
  return { projectId: store.projectId, mode: await getInvoiceMode(store), modeDoc: await store.get(INVOICE_STORAGE_PATH),
    salesOrders: sos.length, embeddedInvoices: embedded, independentInvoices: independent,
    ledgersWithBilling: [...ledgers.values()].filter(l => l.billing).length };
}

/** Read-only plan + checks against anything already written by an earlier (partial) run. */
export async function invoicePreflight(store) {
  const mode = await getInvoiceMode(store);
  const { sos, ledgers } = await load(store);
  const pf = planInvoiceMigration(sos, ledgers, { verifying: mode === MODES.migrating });
  if (mode === MODES.independent) pf.issues.push({ severity: 'blocker', code: 'ALREADY_INDEPENDENT', message: 'Invoices are already independent documents' });
  const dnMode = (await store.get(MODE_PATH))?.mode || STORAGE_MODES.legacy;
  if (dnMode !== STORAGE_MODES.independent) pf.issues.push({ severity: 'blocker', code: 'DN_NOT_MIGRATED', message: `Delivery Note mode is "${dnMode}" — complete the Delivery Note migration first` });
  const existing = (await store.list('customerInvoices')).filter(d => !d.data.migratedFrom);
  if (existing.length) pf.issues.push({ severity: 'blocker', code: 'NEW_INVOICES_PRESENT', message: `${existing.length} invoice document(s) exist that were not created by this migration`, paths: existing.slice(0, 20).map(d => d.path) });
  for (const x of pf.plan.invoices) {
    const have = await store.get(x.path);
    if (have && canonical(have) !== canonical(x.data)) pf.issues.push({ severity: 'blocker', code: 'EXISTING_DOCUMENT_DIFFERS', message: `${x.path} already exists with different content`, path: x.path });
  }
  pf.ready = !pf.issues.some(i => i.severity === 'blocker');
  pf.mode = mode;
  return pf;
}

/** Idempotent, resumable. Freezes invoice writes, writes events → invoices → ledgers, verifies. */
export async function invoiceMigrate(store, { backupMeta, runId = 'inv-run-' + Date.now(), log = () => {} } = {}) {
  if (!backupMeta || backupMeta.projectId !== store.projectId) throw new MigrationError('A verified backup of this project is required before migrating');
  await requireDNIndependent(store);
  const mode = await getInvoiceMode(store);
  if (mode === MODES.independent) throw new MigrationError('Invoices are already independent documents');
  if (mode !== MODES.migrating) await setInvoiceMode(store, MODES.migrating, 'Invoice migration started', { runId, backupSha256: backupMeta.sha256 });
  log('Invoice write freeze active (invoice mode = migrating).');
  const pf = await invoicePreflight(store);
  if (!pf.ready) { log('Blockers found; invoices stay frozen. Fix the data or run "invoice-unfreeze".'); return { ok: false, preflight: pf }; }
  const written = { events: 0, invoices: 0, ledgers: 0 }; let skipped = 0;
  const writeAll = async (items, kind) => {
    const pending = [];
    for (const x of items) { if (await store.get(x.path)) skipped++; else pending.push(x); }
    for (let i = 0; i < pending.length; i += 400) {
      await store.batch(pending.slice(i, i + 400).map(x => ({ op: 'create', path: x.path, data: x.data })));
      written[kind] += Math.min(400, pending.length - i);
    }
  };
  await writeAll(pf.plan.events, 'events'); log(`Invoice events written: ${written.events}`);
  await writeAll(pf.plan.invoices, 'invoices'); log(`Invoices written: ${written.invoices}`);
  for (const l of pf.plan.ledgers) {
    await store.transaction(async tx => {
      const cur = await tx.get(l.path);
      if (cur?.invoiceMigration) { skipped++; return; } // already applied by an earlier run
      if ((cur ? Number(cur.revision) || 0 : 0) !== l.baseRevision) throw new MigrationError(`Ledger ${l.path} changed during the migration; re-run`);
      tx.set(l.path, l.data);
      written.ledgers++;
    });
  }
  log(`Ledgers updated: ${written.ledgers}`);
  await store.batch([{ op: 'set', path: `migrationRuns/${runId}`, data: { runId, migration: INVOICE_MIGRATION_VERSION, finishedAt: new Date().toISOString(), written, skipped, stats: pf.stats, backupSha256: backupMeta.sha256 } }]);
  const v = await invoiceVerify(store);
  log(v.ok ? 'Verification passed. Invoices stay frozen until "invoice-cutover".' : 'Verification FAILED — see report. Invoices stay frozen.');
  return { ok: v.ok, runId, written, skipped, verification: v, preflight: pf };
}

/** Read-only: re-plans from the Sales Orders and compares with what is stored. */
export async function invoiceVerify(store) {
  const { sos, ledgers } = await load(store);
  const pf = planInvoiceMigration(sos, ledgers, { verifying: true });
  const stored = new Map();
  for (const x of [...pf.plan.invoices, ...pf.plan.events, ...pf.plan.ledgers]) { const d = await store.get(x.path); if (d) stored.set(x.path, d); }
  const v = verifyInvoiceMigration(pf.plan, stored);
  const blockers = pf.issues.filter(i => i.severity === 'blocker');
  return { ok: v.ok && !blockers.length, problems: v.problems, blockers, stats: pf.stats };
}

/** Verifies, removes the embedded invoices (each SO checked unchanged), then switches to independent. */
export async function invoiceCutover(store, { backupMeta, log = () => {} } = {}) {
  if (!backupMeta || backupMeta.projectId !== store.projectId) throw new MigrationError('A verified backup of this project is required before the cutover');
  const mode = await getInvoiceMode(store);
  if (mode !== MODES.migrating) throw new MigrationError(`Cutover requires invoice mode "migrating" (current: ${mode}). Run invoice-migrate first.`);
  const v = await invoiceVerify(store);
  if (!v.ok) throw new MigrationError('Verification failed; cutover refused', v);
  const { sos } = await load(store);
  let stripped = 0;
  for (const so of sos.filter(s => Array.isArray(s.invoices) && s.invoices.length)) {
    await store.transaction(async tx => {
      const path = `${COLLECTIONS.salesOrders}/${so.id}`;
      const cur = await tx.get(path);
      if (!cur) return;
      if (canonical(cur.invoices) !== canonical(so.invoices)) throw new MigrationError(`Sales Order ${so.id} changed during the cutover`);
      const { invoices, ...rest } = cur;
      tx.set(path, { ...rest, legacyInvoicesStripped: { migration: INVOICE_MIGRATION_VERSION, count: invoices.length, backupSha256: backupMeta.sha256, sha256: sha(canonical(invoices)) } });
    });
    stripped++;
  }
  log(`Embedded invoices removed from ${stripped} Sales Order(s) (they remain in the backup).`);
  await setInvoiceMode(store, MODES.independent, 'Cutover to independent invoices', { cutoverAt: new Date().toISOString() });
  log('Invoice mode is now independent.');
  return { ok: true, stripped, verification: v };
}

/** Abandons a migration before cutover: removes the migrated invoices/events and the ledger billing figures. */
export async function invoiceUnfreeze(store, { log = () => {} } = {}) {
  const mode = await getInvoiceMode(store);
  if (mode !== MODES.migrating) throw new MigrationError(`Not frozen (invoice mode: ${mode})`);
  const invs = await store.list('customerInvoices');
  const foreign = invs.filter(d => !d.data.migratedFrom);
  if (foreign.length) throw new MigrationError(`${foreign.length} invoice(s) were not created by the migration; unfreeze refused`);
  const ops = [];
  for (const d of invs) { ops.push({ op: 'delete', path: `${d.path}/invoiceEvents/${MIGRATED_EVENT_ID}` }); ops.push({ op: 'delete', path: d.path }); }
  for (let i = 0; i < ops.length; i += 400) await store.batch(ops.slice(i, i + 400));
  let reverted = 0;
  for (const l of await store.list(COLLECTIONS.fulfillment)) {
    if (!l.data.invoiceMigration && !l.data.billing) continue;
    await store.transaction(async tx => {
      const cur = await tx.get(l.path);
      const { billing, invoiceMigration, lastInvoiceId, ...rest } = cur;
      const lines = {};
      for (const [id, line] of Object.entries(cur.lines || {})) { const { invoicedDelivery, invoicedAhead, ...q } = line; lines[id] = q; }
      tx.set(l.path, { ...rest, lines, revision: (Number(cur.revision) || 0) + 1 });
    });
    reverted++;
  }
  await setInvoiceMode(store, MODES.legacy, 'Invoice migration abandoned; returned to embedded invoices');
  log(`Removed ${invs.length} migrated invoice(s); reverted ${reverted} ledger(s).`);
  return { ok: true, removedInvoices: invs.length, revertedLedgers: reverted };
}
