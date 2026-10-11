/**
 * BizCore V260 — Delivery Note migration planner (pure, deterministic, read-only).
 *
 * Converts V259 Sales Orders with embedded `deliveries` into the V260 model:
 *   - immutable SO line IDs (existing valid IDs are kept; otherwise frozen from the V259 link key)
 *   - one deliveryNotes/{id} document per embedded DN, keeping the ORIGINAL DN ID and number
 *   - one immutable event document per legacy history entry (plus the implicit initial
 *     dispatch / confirmation that V259 did not record separately), marked `migrated: true`
 *   - one bounded salesOrderFulfillment/{soId} ledger recomputed from the DNs
 *
 * Determinism: the same input always produces byte-identical documents (no clocks, no random
 * IDs), so the migration can be re-run safely and verified by comparison.
 * Fail-closed: anything ambiguous is reported as a BLOCKER; nothing is guessed silently.
 */
import {
  SCHEMA_VERSION, COLLECTIONS, isSafeId, legacyLineId, legacyLinkKey, roundQty, QTY_EPSILON,
  dnStatus, dispatchSnapshot, acceptanceSnapshot, dnLedgerContribution, acceptedQtyOf, rejectedQtyOf, byteSize, LIMITS,
} from './delivery-core.mjs';

export const MIGRATION_VERSION = 'v260-dn-1';
/** Migrated history documents may use most of Firestore's 1 MiB (they are written once and never grow). */
export const MIGRATED_EVENT_MAX_BYTES = 900 * 1024;
/** Business fields kept when a legacy snapshot is too large to store in full (bulky copies such as
 *  embedded images or long specifications are left out; the full original remains in the backup). */
const SNAPSHOT_KEEP = ['date', 'vehicle', 'remarks', 'voided', 'status', 'receivedBy', 'customerRemarks', 'confirmedAt', 'confirmedBy'];
const ITEM_KEEP = ['soLineId', 'origIdx', 'soIdx', 'code', 'desc', 'uom', 'qty', 'acceptedQty', 'rejectedQty', 'rejectionReason', 'rejectionDisposition', 'acceptanceRemarks'];
function compactSnapshot(snap, dropped) {
  if (!snap || typeof snap !== 'object') return snap ?? null;
  const out = {};
  for (const [k, v] of Object.entries(snap)) { if (SNAPSHOT_KEEP.includes(k)) out[k] = v; else if (k !== 'items') dropped.add(k); }
  if (Array.isArray(snap.items)) out.items = snap.items.map(it => {
    const o = {};
    for (const [k, v] of Object.entries(it || {})) { if (ITEM_KEEP.includes(k)) o[k] = typeof v === 'string' && v.length > 2000 ? v.slice(0, 2000) + '…' : v; else dropped.add('items.' + k); }
    return o;
  });
  return out;
}
/** The legacy entry is kept for traceability, minus the snapshots already stored as before/after. */
const legacyEntryOf = h => { if (!h || typeof h !== 'object') return h ?? null; const { before, snapshot, ...rest } = h; return rest; };
const clone = x => JSON.parse(JSON.stringify(x));

/** Stable JSON (sorted keys) for hashing/comparison. */
export function canonical(x) {
  if (Array.isArray(x)) return '[' + x.map(canonical).join(',') + ']';
  if (x && typeof x === 'object') return '{' + Object.keys(x).filter(k => x[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + canonical(x[k])).join(',') + '}';
  return JSON.stringify(x);
}

export function planMigration(salesOrders) {
  if (!Array.isArray(salesOrders)) throw new TypeError('salesOrders array required');
  const issues = [];
  const blocker = (code, message, ctx = {}) => issues.push({ severity: 'blocker', code, message, ...ctx });
  const warning = (code, message, ctx = {}) => issues.push({ severity: 'warning', code, message, ...ctx });
  const soUpdates = [], deliveryNotes = [], events = [], ledgers = [];
  const dnIds = new Map(), dnNos = new Map(), soIds = new Set();
  const stats = { salesOrders: salesOrders.length, salesOrdersWithDeliveries: 0, embeddedDeliveryNotes: 0, legacyHistoryEntries: 0, plannedEvents: 0, linesAssignedIds: 0, largestSalesOrderBytes: 0, largestSalesOrderId: null };

  for (const so of salesOrders) {
    const soId = so?.id;
    if (!isSafeId(soId) || soIds.has(soId)) { blocker('SO_ID', 'Missing, unsafe or duplicate Sales Order ID', { soId }); continue; }
    soIds.add(soId);
    const size = byteSize(so);
    if (size > stats.largestSalesOrderBytes) { stats.largestSalesOrderBytes = size; stats.largestSalesOrderId = soId; }
    if (!Array.isArray(so.items) || !so.items.length) { blocker('SO_ITEMS', 'Sales Order has no line items', { soId }); continue; }

    /* 1. Line IDs */
    const items = clone(so.items), seenIds = new Set(), byKey = new Map();
    let changed = false, lineProblem = false;
    items.forEach((line, i) => {
      const qty = Number(line.qty);
      if (!Number.isFinite(qty) || qty < 0) { blocker('SO_QTY', `Line ${i + 1} has an invalid ordered quantity`, { soId }); lineProblem = true; }
      let id = isSafeId(line.lineId) && !seenIds.has(line.lineId) ? line.lineId : null;
      if (!id) {
        try { id = legacyLineId(line, i); } catch (e) { blocker('SO_LINE_KEY', e.message, { soId }); lineProblem = true; return; }
        if (seenIds.has(id)) { blocker('SO_LINE_AMBIGUOUS', `Two lines share the link key ${id}; DN items cannot be linked unambiguously`, { soId }); lineProblem = true; return; }
        line.lineId = id; changed = true; stats.linesAssignedIds++;
      }
      seenIds.add(id);
      const key = line.origIdx !== undefined && line.origIdx !== null ? Number(line.origIdx) : i;
      if (byKey.has(key)) { blocker('SO_LINE_AMBIGUOUS', `Two lines share the V259 link key ${key}`, { soId }); lineProblem = true; }
      byKey.set(key, { line, index: i });
    });
    if (lineProblem) continue;
    soUpdates.push({ soId, items, changed, sourceHash: canonical(so.items) });

    /* 2. Delivery Notes */
    const embedded = Array.isArray(so.deliveries) ? so.deliveries : (so.deliveries == null ? [] : null);
    if (embedded === null) { blocker('DN_ARRAY', 'deliveries is not an array', { soId }); continue; }
    if (embedded.length) stats.salesOrdersWithDeliveries++;
    const ledgerLines = {};
    for (const [legacyIndex, d] of embedded.entries()) {
      stats.embeddedDeliveryNotes++;
      const ctx = { soId, dnId: d?.id, dnNo: d?.dnNo, legacyIndex };
      if (!isSafeId(d?.id)) { blocker('DN_ID', `Delivery ${legacyIndex + 1} has no usable ID`, ctx); continue; }
      if (dnIds.has(d.id)) { blocker('DN_ID_DUPLICATE', `DN ID ${d.id} also appears on ${dnIds.get(d.id)}`, ctx); continue; }
      dnIds.set(d.id, soId);
      if (d.dnNo) { if (dnNos.has(d.dnNo)) warning('DN_NO_DUPLICATE', `DN number ${d.dnNo} is also used by ${dnNos.get(d.dnNo)}`, ctx); else dnNos.set(d.dnNo, d.id); }
      else warning('DN_NO_MISSING', 'Delivery Note has no number', ctx);
      if (!Array.isArray(d.items) || !d.items.length) { blocker('DN_ITEMS', 'Delivery Note has no items', ctx); continue; }
      if (d.voided && d.customerConfirmed) { blocker('DN_VOID_CONFIRMED', 'Delivery Note is both voided and confirmed', ctx); continue; }
      let bad = false;
      const dnItems = d.items.map((it, j) => {
        const key = legacyLinkKey(it, null);
        const target = key === null ? null : byKey.get(key);
        if (!target) { blocker('DN_LINE_LINK', `Item ${j + 1} (${it.desc || ''}) cannot be linked to a Sales Order line`, ctx); bad = true; return null; }
        if (it.soIdx !== undefined && it.soIdx !== null && Number(it.soIdx) !== target.index) warning('DN_SOIDX_MISMATCH', `Item ${j + 1}: soIdx ${it.soIdx} differs from linked line ${target.index}; linked by origIdx`, ctx);
        const qty = Number(it.qty);
        if (!Number.isFinite(qty) || qty <= 0) { blocker('DN_QTY', `Item ${j + 1} has an invalid quantity`, ctx); bad = true; return null; }
        if (d.customerConfirmed && !d.voided) {
          const a = acceptedQtyOf(d, it), r = rejectedQtyOf(d, it);
          if (Math.abs(a + r - qty) > 1e-3) { blocker('DN_ACCEPTANCE_TOTAL', `Item ${j + 1}: accepted (${a}) + rejected (${r}) ≠ delivered (${qty})`, ctx); bad = true; }
        }
        return { ...clone(it), soLineId: target.line.lineId, soIdx: target.index, origIdx: target.line.origIdx !== undefined ? target.line.origIdx : target.index };
      });
      if (bad) continue;
      if (new Set(dnItems.map(i => i.soLineId)).size !== dnItems.length) { blocker('DN_DUP_LINE', 'The same Sales Order line appears twice in one Delivery Note', ctx); continue; }

      const { dispatchHistory, acceptanceHistory, ...base } = clone(d);
      if (dispatchHistory != null && !Array.isArray(dispatchHistory)) { blocker('DN_HISTORY', 'dispatchHistory is not an array', ctx); continue; }
      if (acceptanceHistory != null && !Array.isArray(acceptanceHistory)) { blocker('DN_HISTORY', 'acceptanceHistory is not an array', ctx); continue; }
      const dn = {
        ...base, id: d.id, schemaVersion: SCHEMA_VERSION, salesOrderId: soId, soNo: so.soNo || '', customer: so.customer || '', custId: so.custId || '', poNo: so.poNo || '',
        items: dnItems, voided: !!d.voided, customerConfirmed: !!d.customerConfirmed,
        created: d.created || d.dispatchedAt || '', createdBy: d.createdBy || d.dispatchedBy || '', createdByUid: d.createdByUid || null,
        migratedFrom: { migration: MIGRATION_VERSION, salesOrderId: soId, legacyIndex },
      };
      dn.status = dnStatus(dn);

      /* 3. Audit events: initial dispatch, dispatch history, acceptance history (in business order). */
      const dEvents = [], aEvents = [];
      const dh = dispatchHistory || [], ah = acceptanceHistory || [];
      stats.legacyHistoryEntries += dh.length + ah.length;
      const originalDispatch = dh.length && dh[0]?.before ? dh[0].before : dispatchSnapshot(dn);
      dEvents.push({ id: `legacy-dispatch-${legacyIndex}`, kind: 'dispatch', type: 'dispatch', label: 'Dispatched', reason: 'Initial dispatch', actor: d.dispatchedBy || '', at: d.dispatchedAt || d.created || '', before: null, after: originalDispatch, synthesized: true });
      dh.forEach((h, i) => {
        const after = i + 1 < dh.length ? (dh[i + 1]?.before || null) : (h?.type === 'void' ? { ...dispatchSnapshot(dn), voided: true } : dispatchSnapshot(dn));
        dEvents.push({ id: `legacy-dispatch-${legacyIndex}-${i}`, kind: h?.type === 'void' ? 'void' : 'correct', type: h?.type === 'void' ? 'void' : 'correct', label: h?.type === 'void' ? 'Dispatch voided' : 'Dispatch corrected', reason: h?.reason || '', actor: h?.actor || '', at: h?.at || '', before: h?.before ?? null, after, legacyEntry: legacyEntryOf(h) });
      });
      if (dn.customerConfirmed) {
        if (ah.length) {
          ah.forEach((h, i) => {
            const type = ['confirmation', 'correction', 'revision'].includes(h?.type) ? h.type : 'correction';
            aEvents.push({ id: `legacy-acceptance-${legacyIndex}-${i}`, kind: type === 'confirmation' ? 'accept' : type, type, label: h?.label || (type === 'confirmation' ? 'Original confirmation' : type === 'revision' ? 'Customer acceptance revised' : 'Confirmation corrected'), reason: h?.reason || '', actor: h?.actor || '', at: h?.at || '', before: h?.before ?? null, after: h?.snapshot ?? null, legacyEntry: legacyEntryOf(h) });
          });
        } else {
          aEvents.push({ id: `legacy-acceptance-${legacyIndex}`, kind: 'accept', type: 'confirmation', label: 'Original confirmation', reason: 'Initial customer delivery confirmation', actor: d.confirmedBy || '', at: d.confirmedAt || d.customerConfirmedDate || '', before: null, after: acceptanceSnapshot(dn), synthesized: true });
        }
      } else if (ah.length) warning('DN_ACCEPTANCE_HISTORY_UNCONFIRMED', 'Acceptance history exists on an unconfirmed DN; preserved as events', ctx);
      if (!dn.customerConfirmed && ah.length) ah.forEach((h, i) => aEvents.push({ id: `legacy-acceptance-${legacyIndex}-${i}`, kind: 'correction', type: h?.type || 'correction', label: h?.label || 'Acceptance history', reason: h?.reason || '', actor: h?.actor || '', at: h?.at || '', before: h?.before ?? null, after: h?.snapshot ?? null, legacyEntry: legacyEntryOf(h) }));
      let rev = 0;
      const all = [...dEvents.map(e => [COLLECTIONS.dispatchEvents, e]), ...aEvents.map(e => [COLLECTIONS.acceptanceEvents, e])];
      for (const [collection, e] of all) {
        rev++;
        let data = { ...e, operationId: 'migration:' + d.id + ':' + e.id, deliveryNoteId: d.id, salesOrderId: soId, dnNo: d.dnNo || '', fromRevision: rev - 1, toRevision: rev, actorUid: null, migrated: true, migration: MIGRATION_VERSION };
        const fullBytes = byteSize(data);
        if (fullBytes >= MIGRATED_EVENT_MAX_BYTES) {
          const dropped = new Set();
          data = { ...data, before: compactSnapshot(data.before, dropped), after: compactSnapshot(data.after, dropped) };
          data.compacted = { reason: 'size', originalBytes: fullBytes, droppedFields: [...dropped].sort(), fullCopy: 'pre-migration backup' };
          warning('EVENT_COMPACTED', `History entry ${e.id} (${Math.round(fullBytes / 1024)} KB) stored without bulky copied fields: ${[...dropped].sort().join(', ') || '—'}. Who/when/why and all item quantities are kept; the full original stays in the backup.`, ctx);
          if (byteSize(data) >= MIGRATED_EVENT_MAX_BYTES) { blocker('EVENT_SIZE', `History entry ${e.id} is too large even without copied fields`, ctx); bad = true; }
        }
        events.push({ path: `${COLLECTIONS.deliveryNotes}/${d.id}/${collection}/${e.id}`, data });
      }
      const [lastCollection, lastEvent] = all[all.length - 1];
      Object.assign(dn, { revision: rev, lastEventId: lastEvent.id, lastEventCollection: lastCollection });
      if (byteSize(dn) >= LIMITS.dnBytes) { blocker('DN_SIZE', 'Delivery Note is too large for a single document even without history', ctx); bad = true; }
      if (bad) continue;
      stats.plannedEvents += all.length;
      deliveryNotes.push({ path: `${COLLECTIONS.deliveryNotes}/${d.id}`, data: dn });
      for (const [lineId, c] of dnLedgerContribution(dn)) {
        const e = ledgerLines[lineId] || { inTransit: 0, accepted: 0, rejected: 0 };
        ledgerLines[lineId] = { inTransit: roundQty(e.inTransit + c.inTransit), accepted: roundQty(e.accepted + c.accepted), rejected: roundQty(e.rejected + c.rejected) };
      }
    }
    /* 4. Ledger */
    for (const { line } of byKey.values()) {
      const e = ledgerLines[line.lineId];
      if (e && e.inTransit + e.accepted > Number(line.qty) + QTY_EPSILON) blocker('OVER_FULFILLED', `Line "${line.desc || line.lineId}" has ${roundQty(e.inTransit + e.accepted)} dispatched/accepted against ${line.qty} ordered`, { soId, lineId: line.lineId });
    }
    if (embedded.length) ledgers.push({ path: `${COLLECTIONS.fulfillment}/${soId}`, data: { salesOrderId: soId, schemaVersion: SCHEMA_VERSION, revision: 1, lines: ledgerLines, lastEventId: 'migration', lastDeliveryNoteId: null, lastEventCollection: null, updatedBy: 'migration', updatedByUid: null, migration: MIGRATION_VERSION } });
  }
  const blockers = issues.filter(i => i.severity === 'blocker');
  return { version: MIGRATION_VERSION, ready: blockers.length === 0, issues, stats, plan: { soUpdates, deliveryNotes, events, ledgers } };
}

/**
 * Verifies that the stored V260 documents faithfully represent the V259 source.
 * `source` = SO documents as they were before migration (from the backup or current docs while
 * embedded deliveries still exist); `stored` = what is now in the database.
 */
export function verifyMigration(source, stored) {
  const problems = [];
  const expected = planMigration(source);
  if (!expected.ready) problems.push({ code: 'SOURCE_NOT_MIGRATABLE', count: expected.issues.filter(i => i.severity === 'blocker').length });
  const cmp = (kind, path, want, have) => {
    if (!have) problems.push({ code: 'MISSING', kind, path });
    else if (canonical(strip(want)) !== canonical(strip(have))) problems.push({ code: 'DIFFERENT', kind, path });
  };
  const strip = x => { const { migratedAt, recordedAt, ...rest } = x || {}; return rest; };
  for (const u of expected.plan.soUpdates) {
    const have = stored.salesOrders.get(u.soId);
    if (!have) { problems.push({ code: 'MISSING', kind: 'salesOrder', path: u.soId }); continue; }
    if (canonical((have.items || []).map(i => i.lineId)) !== canonical(u.items.map(i => i.lineId))) problems.push({ code: 'LINE_IDS', kind: 'salesOrder', path: u.soId });
  }
  for (const d of expected.plan.deliveryNotes) cmp('deliveryNote', d.path, d.data, stored.docs.get(d.path));
  for (const e of expected.plan.events) cmp('event', e.path, e.data, stored.docs.get(e.path));
  for (const l of expected.plan.ledgers) cmp('ledger', l.path, l.data, stored.docs.get(l.path));
  return { ok: problems.length === 0, problems, expected: expected.stats };
}
