/**
 * BizCore V264 — invoice migration planner (pure, deterministic, read-only).
 *
 * Converts invoices embedded in Sales Orders (so.invoices, V259–V263) into independent documents:
 *   customerInvoices/{id}                  one per embedded invoice, keeping its ORIGINAL number,
 *                                          date and amounts (nothing is re-priced)
 *   customerInvoices/{id}/invoiceEvents/migrated   immutable "migrated" event
 *   salesOrderFulfillment/{soId}           billing quantities merged into the existing ledger
 *                                          (lines.*.invoicedDelivery / invoicedAhead, billing.goodsValue)
 *
 * Classification of each embedded invoice:
 *   delivery  every line's quantity was covered by accepted deliveries not yet invoiced
 *   order     otherwise (goods were billed ahead of acceptance) — reason "Migrated: billed before acceptance"
 * Embedded invoices never contained advances, deductions or credit notes, so none are created.
 *
 * Fail-closed: anything ambiguous is a BLOCKER (unlinked line, over-invoiced line, duplicate number…).
 * Same input → byte-identical output (no clocks, no random IDs), so a run can be repeated and verified.
 */
import { createHash } from 'node:crypto';
import { roundQty, soLineIndex, QTY_EPSILON } from './delivery-core.mjs';
import { INVOICE_COLLECTIONS, INVOICE_SCHEMA_VERSION, INVOICE_TYPES, r2, MONEY_EPSILON } from './invoice-core.mjs';

export const INVOICE_MIGRATION_VERSION = 'v264-inv-1';
export const INVOICE_STORAGE_PATH = 'system/invoiceStorage';
export const INVOICE_STORAGE_MODES = Object.freeze({ legacy: 'legacy', migrating: 'migrating', independent: 'independent' });
export const MIGRATED_EVENT_ID = 'migrated';

const sha = s => createHash('sha256').update(s).digest('hex');
export function canonical(x) {
  if (Array.isArray(x)) return '[' + x.map(canonical).join(',') + ']';
  if (x && typeof x === 'object') return '{' + Object.keys(x).sort().filter(k => x[k] !== undefined).map(k => JSON.stringify(k) + ':' + canonical(x[k])).join(',') + '}';
  return JSON.stringify(x === undefined ? null : x);
}
/** Deterministic invoice document ID for an embedded invoice. */
export const migratedInvoiceId = (soId, index, invNo) => 'INV-M-' + sha(`${soId}|${index}|${invNo || ''}`).slice(0, 20);

/** SO row an embedded invoice item refers to: stable line ID, then SO row, then origIdx (pre-V260 invoices). */
function soRowOf(so, it) {
  const items = so.items || [];
  if (it && it.soLineId) { const r = items.findIndex(x => x.lineId === it.soLineId); if (r >= 0) return r; }
  if (it && it.soIdx !== undefined && it.soIdx !== null && items[Number(it.soIdx)]) return Number(it.soIdx);
  if (it && it.origIdx !== undefined && it.origIdx !== null && items[Number(it.origIdx)]) return Number(it.origIdx);
  return null;
}
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

/**
 * @param salesOrders  SO documents (after the Delivery Note migration: lines have lineId)
 * @param ledgers      Map soId → ledger document (or null)
 * @param verifying    re-plan after the migration (the ledgers then already hold the billing figures)
 * → { ready, issues, stats, plan: { invoices:[{path,data}], events:[{path,data}], ledgers:[{path, soId, baseRevision, data}] } }
 */
export function planInvoiceMigration(salesOrders, ledgers = new Map(), { verifying = false } = {}) {
  const issues = [], invoices = [], events = [], ledgerPlans = [];
  const stats = { salesOrders: salesOrders.length, salesOrdersWithInvoices: 0, embeddedInvoices: 0, delivery: 0, order: 0, fullOrderLegacy: 0 };
  const seenNumbers = new Map();
  const issue = (severity, code, message, extra = {}) => issues.push({ severity, code, message, ...extra });

  for (const so of [...salesOrders].sort((a, b) => String(a.id).localeCompare(String(b.id)))) {
    const list = Array.isArray(so.invoices) ? so.invoices : [];
    if (!list.length) continue;
    stats.salesOrdersWithInvoices++;
    let index;
    try { index = soLineIndex(so); } catch (e) { issue('blocker', 'SO_LINES', `${so.soNo || so.id}: ${e.message}`, { soId: so.id }); continue; }
    const items = so.items || [];
    if (items.some(it => !it.lineId)) { issue('blocker', 'SO_LINE_IDS', `${so.soNo || so.id}: lines have no stable IDs — run the Delivery Note migration first`, { soId: so.id }); continue; }
    const ledger = ledgers.get(so.id) || null;
    if (!verifying && ledger && (ledger.billing || Object.values(ledger.lines || {}).some(l => l.invoicedDelivery != null || l.invoicedAhead != null))) {
      issue('blocker', 'LEDGER_HAS_BILLING', `${so.soNo || so.id}: the ledger already holds billing figures (invoices recorded the new way). Restore the backup or investigate before migrating.`, { soId: so.id });
      continue;
    }
    const accepted = new Map(), invD = new Map(), invA = new Map();
    for (const it of items) { accepted.set(it.lineId, roundQty(num(ledger?.lines?.[it.lineId]?.accepted))); invD.set(it.lineId, 0); invA.set(it.lineId, 0); }
    let goodsValue = 0, soBlocked = false;
    const soInvoices = [];

    list.forEach((inv, i) => {
      stats.embeddedInvoices++;
      const label = `${so.soNo || so.id} invoice ${inv?.invNo || '#' + (i + 1)}`;
      if (!inv || typeof inv !== 'object') { issue('blocker', 'INVOICE_INVALID', `${label}: not an invoice record`, { soId: so.id, index: i }); soBlocked = true; return; }
      if (inv.invNo) {
        if (seenNumbers.has(inv.invNo)) issue('blocker', 'INVOICE_NUMBER_DUPLICATE', `${label}: number also used on ${seenNumbers.get(inv.invNo)}`, { soId: so.id, index: i });
        else seenNumbers.set(inv.invNo, so.soNo || so.id);
      } else issue('warning', 'INVOICE_NO_NUMBER', `${label}: has no invoice number`, { soId: so.id, index: i });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(inv.date || ''))) issue('blocker', 'INVOICE_DATE', `${label}: invalid date "${inv.date}"`, { soId: so.id, index: i });

      // Lines: explicit items, or (pre-partial-invoicing) the whole order
      const legacyFull = !(Array.isArray(inv.items) && inv.items.length);
      if (legacyFull) stats.fullOrderLegacy++;
      const raw = legacyFull
        ? items.map((it, r) => ({ soLineId: it.lineId, soIdx: r, desc: it.desc, code: it.code, uom: it.uom, qty: num(it.qty), up: num(it.up), vatRate: it.vatRate }))
        : inv.items;
      const byLine = new Map();
      for (const it of raw) {
        const r = soRowOf(so, it);
        if (r == null) { issue('blocker', 'INVOICE_LINE_LINK', `${label}: line "${it?.desc || '?'}" does not match any Sales Order line`, { soId: so.id, index: i }); soBlocked = true; continue; }
        const qty = roundQty(num(it.qty, NaN));
        if (!Number.isFinite(qty) || qty < 0) { issue('blocker', 'INVOICE_QTY', `${label}: invalid quantity on "${it.desc || '?'}"`, { soId: so.id, index: i }); soBlocked = true; continue; }
        if (qty <= 0) continue;
        const soLine = items[r];
        const up = num(it.up, num(soLine.up));
        const vatRate = Number.isFinite(Number(it.vatRate)) ? Number(it.vatRate) : (Number.isFinite(Number(so.vatRate)) ? Number(so.vatRate) : 0.15);
        const subtotal = it.subtotal != null && Number.isFinite(Number(it.subtotal)) ? r2(it.subtotal) : r2(qty * up);
        const vat = it.vat != null && Number.isFinite(Number(it.vat)) ? r2(it.vat) : r2(subtotal * vatRate);
        const prev = byLine.get(soLine.lineId);
        if (prev) { // the same SO line twice on one invoice: merge
          prev.qty = roundQty(prev.qty + qty); prev.subtotal = r2(prev.subtotal + subtotal); prev.vat = r2(prev.vat + vat); prev.total = r2(prev.subtotal + prev.vat);
          continue;
        }
        byLine.set(soLine.lineId, { lineId: soLine.lineId, soIdx: r, code: soLine.code || it.code || '', desc: it.desc || soLine.desc || '', uom: it.uom || soLine.uom || '', qty, up, vatRate, subtotal, vat, total: r2(subtotal + vat), basis: 'accepted' });
      }
      const lines = [...byLine.values()].sort((a, b) => a.soIdx - b.soIdx);
      if (!lines.length) { issue('blocker', 'INVOICE_EMPTY', `${label}: no invoiced quantity`, { soId: so.id, index: i }); soBlocked = true; return; }
      // Classification against accepted quantities not yet invoiced (in the order the invoices were issued)
      const isDelivery = lines.every(l => l.qty <= roundQty(accepted.get(l.lineId) - invD.get(l.lineId) - invA.get(l.lineId)) + QTY_EPSILON);
      const type = isDelivery ? INVOICE_TYPES.delivery : INVOICE_TYPES.order;
      for (const l of lines) {
        if (!isDelivery) l.basis = 'ahead';
        const m = isDelivery ? invD : invA;
        m.set(l.lineId, roundQty(m.get(l.lineId) + l.qty));
        const ordered = roundQty(num(items[l.soIdx].qty));
        if (invD.get(l.lineId) + invA.get(l.lineId) > ordered + QTY_EPSILON)
          { issue('blocker', 'OVER_INVOICED', `${label}: "${l.desc}" invoiced ${roundQty(invD.get(l.lineId) + invA.get(l.lineId))} of ${ordered} ordered`, { soId: so.id, index: i }); soBlocked = true; }
      }
      stats[type]++;
      const goodsSubtotal = r2(lines.reduce((s, l) => s + l.subtotal, 0)), goodsVat = r2(lines.reduce((s, l) => s + l.vat, 0));
      if (inv.subtotal != null && Math.abs(num(inv.subtotal) - goodsSubtotal) > MONEY_EPSILON)
        issue('warning', 'INVOICE_TOTAL_DIFFERS', `${label}: stored subtotal ${num(inv.subtotal).toFixed(2)} differs from its lines ${goodsSubtotal.toFixed(2)} — the stored figures are kept`, { soId: so.id, index: i });
      const subtotal = inv.subtotal != null && Number.isFinite(Number(inv.subtotal)) ? r2(inv.subtotal) : goodsSubtotal;
      const vat = inv.vat != null && Number.isFinite(Number(inv.vat)) ? r2(inv.vat) : goodsVat;
      const total = inv.total != null && Number.isFinite(Number(inv.total)) ? r2(inv.total) : r2(subtotal + vat);
      goodsValue = r2(goodsValue + subtotal);
      const id = migratedInvoiceId(so.id, i, inv.invNo);
      const created = typeof inv.created === 'string' ? inv.created : (inv.date ? inv.date + 'T00:00:00.000Z' : '');
      const data = {
        id, schemaVersion: INVOICE_SCHEMA_VERSION, invNo: inv.invNo || id, type, salesOrderId: so.id, soNo: so.soNo || '',
        customer: so.customer || '', custId: so.custId || '', poNo: so.poNo || '', quotationId: so.quotationId || '',
        date: inv.date || '', dueDate: inv.dueDate || '', zohoNo: inv.zohoNo || '', notes: inv.notes || '',
        reason: type === INVOICE_TYPES.order ? 'Migrated: billed before delivery acceptance was recorded' : '',
        lines, deductions: [], advance: null,
        totals: { goodsSubtotal: subtotal, goodsVat: vat, deductionSubtotal: 0, deductionVat: 0, subtotal, vat, total },
        credited: {}, creditNotes: [], status: 'Issued',
        revision: 1, lastEventId: MIGRATED_EVENT_ID, creationOperationId: 'migration-' + id,
        created, createdBy: inv.createdBy || 'Migrated', createdByUid: '', updatedAt: created, updatedBy: 'Migrated', updatedByUid: '',
        migratedFrom: { migration: INVOICE_MIGRATION_VERSION, salesOrderId: so.id, index: i, invNo: inv.invNo || '', legacyFullOrder: legacyFull, isPartial: !!inv.isPartial, sourceHash: sha(canonical(inv)) },
      };
      soInvoices.push({ path: `${INVOICE_COLLECTIONS.invoices}/${id}`, data });
      events.push({ path: `${INVOICE_COLLECTIONS.invoices}/${id}/${INVOICE_COLLECTIONS.invoiceEvents}/${MIGRATED_EVENT_ID}`, data: {
        id: MIGRATED_EVENT_ID, kind: 'migrated', invoiceId: id, invNo: data.invNo, salesOrderId: so.id, type, toRevision: 1, totals: data.totals,
        actor: 'Migration', actorUid: '', at: created, migrated: true, migration: INVOICE_MIGRATION_VERSION } });
    });
    if (soBlocked) continue;
    invoices.push(...soInvoices);
    // Ledger: keep delivery quantities, add billing quantities
    const lines = { ...(ledger?.lines || {}) };
    for (const it of items) {
      const cur = lines[it.lineId] || { inTransit: 0, accepted: 0, rejected: 0 };
      lines[it.lineId] = { ...cur, invoicedDelivery: invD.get(it.lineId), invoicedAhead: invA.get(it.lineId) };
    }
    ledgerPlans.push({
      path: `salesOrderFulfillment/${so.id}`, soId: so.id, baseRevision: ledger ? num(ledger.revision) : 0,
      data: { ...(ledger || { salesOrderId: so.id, schemaVersion: 3 }), lines, billing: { goodsValue, advances: {} },
        revision: (ledger ? num(ledger.revision) : 0) + 1, invoiceMigration: { migration: INVOICE_MIGRATION_VERSION, invoices: soInvoices.length } },
    });
  }
  return { ready: !issues.some(i => i.severity === 'blocker'), issues, stats, plan: { invoices, events, ledgers: ledgerPlans } };
}

/** Compares written documents with the plan (volatile fields excluded). → { ok, problems } */
export function verifyInvoiceMigration(plan, stored) {
  const problems = [];
  for (const x of [...plan.invoices, ...plan.events]) {
    const have = stored.get(x.path);
    if (!have) problems.push({ code: 'MISSING', path: x.path });
    else if (canonical(strip(have)) !== canonical(strip(x.data))) problems.push({ code: 'DIFFERS', path: x.path });
  }
  for (const l of plan.ledgers) {
    const have = stored.get(l.path);
    if (!have) { problems.push({ code: 'LEDGER_MISSING', path: l.path }); continue; }
    for (const [id, line] of Object.entries(l.data.lines)) {
      const h = have.lines?.[id] || {};
      if (Math.abs(num(h.invoicedDelivery) - line.invoicedDelivery) > QTY_EPSILON || Math.abs(num(h.invoicedAhead) - line.invoicedAhead) > QTY_EPSILON)
        problems.push({ code: 'LEDGER_QTY', path: l.path, lineId: id });
    }
    if (Math.abs(num(have.billing?.goodsValue) - l.data.billing.goodsValue) > MONEY_EPSILON) problems.push({ code: 'LEDGER_VALUE', path: l.path });
  }
  return { ok: problems.length === 0, problems };
}
const strip = x => { const { migratedAt, recordedAt, ...rest } = x || {}; return rest; };
