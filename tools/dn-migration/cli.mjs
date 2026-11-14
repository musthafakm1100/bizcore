#!/usr/bin/env node
/**
 * BizCore V260 — Delivery Note migration CLI (administrator tool, runs on your PC).
 *
 *   node cli.mjs <command> --project <id> [--credentials sa.json] [options]
 *
 * Read-only:   status | backup --out <file> | preflight [--report <file>] | verify | reconcile
 * Writes:      init --confirm <project>              (explicit legacy mode after deploying V260)
 *              migrate --backup <file> --confirm <project>
 *              cutover --confirm <project>
 *              strip --backup <file> --confirm <project>
 *              unfreeze --confirm <project>      (abandon a migration before cutover)
 *              rollback --confirm <project>      (before strip, and only if nothing new was recorded)
 *              restore --backup <file> --confirm <project> [--all-collections]
 *              repair-ledgers --confirm <project>
 *
 * Invoices (V264, after the Delivery Note migration):
 * Read-only:   invoice-status | invoice-preflight [--report <file>] | invoice-verify
 * Writes:      invoice-migrate --backup <file> --confirm <project>   (freezes invoices, writes documents)
 *              invoice-cutover --backup <file> --confirm <project>   (verifies, removes embedded copies)
 *              invoice-unfreeze --confirm <project>                  (abandon before cutover)
 *
 * Emulator: set FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 (no credentials needed).
 * Without --confirm, write commands print what they would do and exit (dry run).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createAdminStore } from './adapters/admin.mjs';
import * as engine from './engine.mjs';
import * as inv from './invoice-engine.mjs';

const argv = process.argv.slice(2);
const cmd = argv[0];
const opt = name => { const i = argv.indexOf('--' + name); return i >= 0 ? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true) : undefined; };
// Options that need a value must have one (e.g. "--out" at the end of a line would otherwise become "true").
for (const name of ['project', 'credentials', 'out', 'backup', 'report', 'confirm']) {
  if (opt(name) === true) { console.error(`ERROR: --${name} needs a value (for example --${name} ${name === 'out' || name === 'backup' ? 'C:\\secure\\bizcore-backup.json' : '...'}).`); process.exit(1); }
}
const WRITES = new Set(['init', 'migrate', 'cutover', 'strip', 'unfreeze', 'rollback', 'restore', 'repair-ledgers', 'invoice-migrate', 'invoice-cutover', 'invoice-unfreeze']);
const log = m => console.log('  ' + m);
const out = (obj, file) => { const json = JSON.stringify(obj, null, 2); if (file) { writeFileSync(file, json); console.log('Written: ' + file); } else console.log(json); };

function summarisePlan(pf) {
  const b = pf.issues.filter(i => i.severity === 'blocker'), w = pf.issues.filter(i => i.severity === 'warning');
  console.log(`\nMode: ${pf.mode}\nSales Orders: ${pf.stats.salesOrders} (with deliveries: ${pf.stats.salesOrdersWithDeliveries})`);
  console.log(`Embedded DNs: ${pf.stats.embeddedDeliveryNotes} · legacy history entries: ${pf.stats.legacyHistoryEntries} · planned events: ${pf.stats.plannedEvents}`);
  console.log(`Largest SO: ${pf.stats.largestSalesOrderId} (${pf.stats.largestSalesOrderBytes} bytes est.) · lines needing IDs: ${pf.stats.linesAssignedIds}`);
  console.log(`Already present from earlier run: ${JSON.stringify(pf.alreadyPresent)}`);
  console.log(`Blockers: ${b.length} · Warnings: ${w.length}`);
  for (const i of [...b, ...w].slice(0, 40)) console.log(`  [${i.severity}] ${i.code} ${i.soId || ''} ${i.dnNo || i.dnId || ''} — ${i.message}`);
  console.log(pf.ready ? '\nREADY: no blockers.' : '\nNOT READY: resolve blockers before migrating.');
}

function summariseInvoicePlan(pf) {
  const b = pf.issues.filter(i => i.severity === 'blocker'), w = pf.issues.filter(i => i.severity === 'warning');
  console.log(`\nInvoice mode: ${pf.mode}\nSales Orders: ${pf.stats.salesOrders} (with invoices: ${pf.stats.salesOrdersWithInvoices})`);
  console.log(`Embedded invoices: ${pf.stats.embeddedInvoices} → delivery invoices: ${pf.stats.delivery} · billed ahead (order invoices): ${pf.stats.order} · old full-order invoices: ${pf.stats.fullOrderLegacy}`);
  console.log(`Blockers: ${b.length} · Warnings: ${w.length}`);
  for (const i of [...b, ...w].slice(0, 40)) console.log(`  [${i.severity}] ${i.code} — ${i.message}`);
  console.log(pf.ready ? '\nREADY: no blockers.' : '\nNOT READY: resolve blockers before migrating.');
}

async function main() {
  if (!cmd || cmd === 'help' || opt('help')) { console.log(readFileSync(new URL(import.meta.url)).toString().split('*/')[0]); return; }
  const projectId = opt('project');
  if (WRITES.has(cmd) && opt('confirm') !== projectId) {
    console.log(`DRY RUN: "${cmd}" changes the database. Re-run with --confirm ${projectId || '<project>'} after reading the runbook.`);
    if (cmd !== 'migrate' && cmd !== 'invoice-migrate') return;
  }
  const store = await createAdminStore({ projectId, credentialsFile: opt('credentials') });
  console.log(`Project: ${projectId}${store.usingEmulator ? ' (EMULATOR ' + process.env.FIRESTORE_EMULATOR_HOST + ')' : ' (LIVE)'}`);
  // Fail fast if the database cannot be reached (the SDK would otherwise keep retrying silently).
  const reach = setTimeout(() => { console.error('\nERROR: Firestore did not respond within 60 s. Check the project ID, credentials, network or emulator. Nothing was changed by this check.'); process.exit(3); }, 60000);
  try { await store.get('system/deliveryNoteStorage'); } finally { clearTimeout(reach); }
  const readBackup = () => {
    const f = opt('backup');
    if (!f || !existsSync(f)) throw new Error('--backup <file> is required (create it with the backup command)');
    const b = JSON.parse(readFileSync(f, 'utf8'));
    engine.validateBackup(b, projectId);
    const ageH = (Date.now() - Date.parse(b.meta.takenAt)) / 36e5;
    if (ageH > 2 && !opt('allow-old-backup')) throw new Error(`Backup is ${ageH.toFixed(1)} hours old; take a fresh backup (or pass --allow-old-backup)`);
    return b;
  };
  try {
    switch (cmd) {
      case 'status': out(await engine.status(store)); break;
      case 'init': out(await engine.init(store)); break;
      case 'backup': {
        const file = opt('out') || `bizcore-backup-${projectId}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        console.log('Reading every document (read-only) — this can take a few minutes…');
        const b = await engine.backup(store, { log });
        writeFileSync(file, JSON.stringify(b));
        console.log(`Backup: ${file}\n${JSON.stringify(b.meta, null, 2)}`);
        break;
      }
      case 'preflight': { const pf = await engine.preflight(store); summarisePlan(pf); if (opt('report')) out({ ...pf, plan: undefined }, opt('report')); process.exitCode = pf.ready ? 0 : 2; break; }
      case 'migrate': {
        if (opt('confirm') !== projectId) { const pf = await engine.preflight(store); summarisePlan(pf); break; }
        const b = readBackup();
        const r = await engine.migrate(store, { backupMeta: b.meta, log });
        if (!r.ok) { summarisePlan(r.preflight); if (r.verification) out(r.verification); process.exitCode = 2; }
        else console.log(`\nMigration complete (run ${r.runId}). Database is FROZEN (migrating). Next: test, then "cutover".`);
        break;
      }
      case 'verify': { const v = await engine.verify(store); out(v, opt('report')); process.exitCode = v.ok ? 0 : 2; break; }
      case 'reconcile': { const r = await engine.reconcile(store); out(r, opt('report')); process.exitCode = r.ok ? 0 : 2; break; }
      case 'cutover': await engine.cutover(store, { log }); console.log('Cutover complete.'); break;
      case 'strip': { const b = readBackup(); out(await engine.strip(store, { backupMeta: b.meta, log })); break; }
      case 'unfreeze': out(await engine.unfreeze(store)); break;
      case 'rollback': out(await engine.rollback(store)); break;
      case 'restore': {
        const f = opt('backup'); const b = JSON.parse(readFileSync(f, 'utf8'));
        const collections = opt('all-collections') ? [...new Set(Object.keys(b.documents).map(p => p.split('/')[0]))] : ['salesOrders'];
        out(await engine.restore(store, b, { collections, log })); break;
      }
      case 'repair-ledgers': out(await engine.repairLedgers(store, { log })); break;
      case 'invoice-status': out(await inv.invoiceStatus(store)); break;
      case 'invoice-preflight': { const pf = await inv.invoicePreflight(store); summariseInvoicePlan(pf); if (opt('report')) out({ ...pf, plan: undefined }, opt('report')); process.exitCode = pf.ready ? 0 : 2; break; }
      case 'invoice-migrate': {
        if (opt('confirm') !== projectId) { summariseInvoicePlan(await inv.invoicePreflight(store)); break; }
        const r = await inv.invoiceMigrate(store, { backupMeta: readBackup().meta, log });
        if (!r.ok) { summariseInvoicePlan(r.preflight); if (r.verification) out(r.verification); process.exitCode = 2; }
        else console.log(`\nInvoice migration complete (run ${r.runId}). Invoices are FROZEN (migrating). Next: check, then "invoice-cutover".`);
        break;
      }
      case 'invoice-verify': { const v = await inv.invoiceVerify(store); out(v, opt('report')); process.exitCode = v.ok ? 0 : 2; break; }
      case 'invoice-cutover': { const r = await inv.invoiceCutover(store, { backupMeta: readBackup().meta, log }); console.log(`Invoice cutover complete (${r.stripped} Sales Order(s) cleaned).`); break; }
      case 'invoice-unfreeze': out(await inv.invoiceUnfreeze(store, { log })); break;
      default: throw new Error('Unknown command ' + cmd);
    }
  } catch (e) {
    console.error('\nERROR: ' + e.message);
    if (e.details) console.error(JSON.stringify(e.details, null, 2).slice(0, 4000));
    process.exitCode = 1;
  } finally { await store.close?.(); }
}
main();
