/**
 * BizCore V260 — Delivery Note domain core (pure functions, no I/O).
 *
 * Shared by the browser application, the transaction service, the migration
 * tool (Node) and the automated tests, so there is ONE definition of:
 *   - record identity rules (DN IDs, event IDs, SO line IDs)
 *   - quantity validation and rounding
 *   - the bounded Sales Order fulfillment ledger
 *   - audit snapshots
 *   - the read model that presents independent DNs to the existing UI
 *   - reconciliation between DNs and the ledger
 *
 * Firestore layout (schemaVersion 3):
 *   salesOrders/{soId}                         header + items[] (each with immutable lineId); NO deliveries
 *   salesOrderFulfillment/{soId}               bounded ledger: one entry per SO line
 *   deliveryNotes/{dnId}                       one physical Delivery Note (current state)
 *   deliveryNotes/{dnId}/dispatchEvents/{id}   immutable dispatch / correction / void events
 *   deliveryNotes/{dnId}/acceptanceEvents/{id} immutable acceptance / correction / revision events
 *   system/deliveryNoteStorage                 database-wide storage mode (legacy | independent)
 */

export const SCHEMA_VERSION = 3;
export const COLLECTIONS = Object.freeze({
  salesOrders: 'salesOrders',
  fulfillment: 'salesOrderFulfillment',
  deliveryNotes: 'deliveryNotes',
  dispatchEvents: 'dispatchEvents',
  acceptanceEvents: 'acceptanceEvents',
  counters: 'counters',
  system: 'system',
});
export const STORAGE_MODE_DOC_ID = 'deliveryNoteStorage';
export const STORAGE_MODES = Object.freeze({ legacy: 'legacy', migrating: 'migrating', independent: 'independent' });

/** Conservative limits, well below Firestore's 1 MiB document limit.
 *  JSON byte counts approximate (and slightly overestimate) Firestore's own sizing. */
export const LIMITS = Object.freeze({
  dnBytes: 512 * 1024,
  eventBytes: 256 * 1024,
  ledgerBytes: 256 * 1024,
  linesPerDN: 400,
  reasonMin: 5,
  textMax: 2000,
});
export const QTY_EPSILON = 1e-6;

export class DeliveryError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'DeliveryError';
    this.code = code;
    if (details !== undefined) this.details = details;
  }
}
export const ERR = Object.freeze({
  INVALID_INPUT: 'invalid-input',
  NOT_FOUND: 'not-found',
  STALE_REVISION: 'stale-revision',
  OVER_DISPATCH: 'over-dispatch',
  INVALID_STATE: 'invalid-state',
  ID_COLLISION: 'id-collision',
  LEGACY_DATA: 'legacy-data',
  SIZE_LIMIT: 'size-limit',
  INCONSISTENT: 'inconsistent-data',
  LOCK_REQUIRED: 'lock-required',
  BELOW_INVOICED: 'below-invoiced',
  INVOICED: 'invoiced',                 // V270.4.6: an invoiced Delivery Note can no longer be corrected / revised
});
const fail = (code, message, details) => { throw new DeliveryError(code, message, details); };
const ensure = (ok, code, message, details) => { if (!ok) fail(code, message, details); };

/* ───────────────────────── identity ───────────────────────── */

/** A Firestore-safe document ID: non-empty, no '/', not '.' or '..', not __reserved__. */
export function isSafeId(v) {
  return typeof v === 'string' && v.length > 0 && v.length <= 700 && !v.includes('/') &&
    v !== '.' && v !== '..' && !/^__.*__$/.test(v);
}
/** Normalises a client operation ID into a deterministic key used for document IDs. */
export function operationKey(operationId) {
  ensure(typeof operationId === 'string', ERR.INVALID_INPUT, 'Operation ID required');
  const key = operationId.replace(/[^A-Za-z0-9_-]/g, '-');
  ensure(key.length >= 8 && key.length <= 200, ERR.INVALID_INPUT, 'Operation ID must be 8–200 characters');
  return key;
}
/** DN document ID derived from the creating operation: a retried dispatch maps to the same document. */
export const dnIdForOperation = operationId => 'DN-' + operationKey(operationId);
/** Event document ID derived from the operation: a retried change maps to the same event. */
export const eventIdForOperation = (prefix, operationId) => prefix + '-' + operationKey(operationId);

/** Line ID for NEW Sales Order lines. Opaque, random, never derived from row position. */
export function newLineId(random = defaultRandom) {
  return 'L-' + random(12);
}
/** Deterministic line ID for EXISTING (pre-V260) Sales Order lines.
 *  V259 already linked DN items to SO lines through the quotation line index `origIdx`
 *  (falling back to the SO row index `soIdx`). Freezing that existing link into an
 *  immutable string makes migration repeatable (idempotent) and auditable. */
export function legacyLineId(line, index) {
  if (line && line.origIdx !== undefined && line.origIdx !== null && line.origIdx !== '') {
    const n = Number(line.origIdx);
    ensure(Number.isInteger(n) && n >= 0, ERR.LEGACY_DATA, `Invalid origIdx on SO line ${index + 1}`);
    return 'L-q' + n;
  }
  return 'L-r' + index;
}
/** The key V259 used to link a DN item to its SO line (kept for print/invoice compatibility). */
export function legacyLinkKey(item, fallbackIndex) {
  if (item?.origIdx !== undefined && item?.origIdx !== null) return Number(item.origIdx);
  if (item?.soIdx !== undefined && item?.soIdx !== null) return Number(item.soIdx);
  return fallbackIndex;
}
function defaultRandom(len) {
  const alphabet = 'abcdefghijkmnopqrstuvwxyz23456789';
  const bytes = new Uint8Array(len);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join('');
}

/** Index of an SO's lines by stable lineId. Throws if lines are missing or duplicated. */
export function soLineIndex(so) {
  ensure(so && Array.isArray(so.items), ERR.INVALID_INPUT, 'Sales Order lines missing');
  const map = new Map();
  so.items.forEach((line, index) => {
    ensure(isSafeId(line?.lineId), ERR.LEGACY_DATA,
      `Sales Order ${so.soNo || so.id} line ${index + 1} has no stable line ID. Run the V260 migration first.`);
    ensure(!map.has(line.lineId), ERR.LEGACY_DATA, `Duplicate line ID ${line.lineId} on Sales Order ${so.soNo || so.id}`);
    map.set(line.lineId, { line, index, ordered: parseQty(line.qty, `ordered quantity (line ${index + 1})`, { allowZero: true }) });
  });
  return map;
}

/* ───────────────────────── quantities ───────────────────────── */

export const roundQty = n => Math.round((Number(n) + Number.EPSILON) * 1e6) / 1e6;
export function parseQty(v, label, { allowZero = true } = {}) {
  const n = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
  ensure(Number.isFinite(n), ERR.INVALID_INPUT, `Invalid ${label}`);
  ensure(n >= 0 && (allowZero || n > 0), ERR.INVALID_INPUT, `Invalid ${label}`);
  ensure(n < 1e12, ERR.INVALID_INPUT, `${label} is too large`);
  return roundQty(n);
}
const cleanText = (v, max = LIMITS.textMax) => String(v ?? '').trim().slice(0, max);

/** V265.3 "Delivered by": { name, type: 'staff' | 'other', employeeId } → flat DN fields, or null when not given.
 *  The type is for staff screens only; documents for the customer print the name alone. */
export function cleanDeliveredBy(v) {
  if (v == null || typeof v !== 'object') return null;
  const name = cleanText(v.name, 120);
  if (!name) return null;
  const type = v.type === 'other' ? 'other' : 'staff';
  const employeeId = type === 'staff' && isSafeId(v.employeeId) ? String(v.employeeId).slice(0, 120) : '';
  return { deliveredBy: name, deliveredByType: type, deliveredByEmployeeId: employeeId };
}

/* ───────────────────────── ledger ───────────────────────── */

/** Ledger line: inTransit = dispatched but not yet accepted/rejected/voided,
 *  accepted = accepted by customer, rejected = rejected by customer (available for redelivery).
 *  Remaining to dispatch = ordered − inTransit − accepted. */
export function emptyLedger(salesOrderId) {
  return { salesOrderId, schemaVersion: SCHEMA_VERSION, revision: 0, lines: {} };
}
export function ledgerLine(ledger, lineId) {
  const l = ledger?.lines?.[lineId] || {};
  return { inTransit: roundQty(l.inTransit || 0), accepted: roundQty(l.accepted || 0), rejected: roundQty(l.rejected || 0) };
}
/**
 * Applies signed deltas to the ledger. Validates every resulting line:
 * no negative values, and when committed quantity grows it must not exceed ordered.
 * Pure: returns a new ledger; the caller writes it inside the same transaction.
 */
export function applyLedgerDeltas(ledger, lineIndex, deltas) {
  const lines = { ...(ledger?.lines || {}) };
  for (const d of deltas) {
    const ref = lineIndex.get(d.lineId);
    ensure(ref, ERR.INVALID_INPUT, `Unknown Sales Order line ${d.lineId}`);
    const old = ledgerLine({ lines }, d.lineId);
    const next = {
      inTransit: roundQty(old.inTransit + (d.inTransit || 0)),
      accepted: roundQty(old.accepted + (d.accepted || 0)),
      rejected: roundQty(old.rejected + (d.rejected || 0)),
    };
    for (const k of ['inTransit', 'accepted', 'rejected']) {
      ensure(next[k] > -QTY_EPSILON, ERR.INCONSISTENT,
        `Fulfillment ledger would become negative (${k}) for line ${lineLabel(ref)}. The ledger and Delivery Notes disagree; run reconciliation.`);
      next[k] = Math.max(0, next[k]);
    }
    const committedBefore = old.inTransit + old.accepted, committedAfter = next.inTransit + next.accepted;
    if (committedAfter > committedBefore + QTY_EPSILON) {
      ensure(committedAfter <= ref.ordered + QTY_EPSILON, ERR.OVER_DISPATCH,
        `Quantity for "${lineLabel(ref)}" exceeds the ordered quantity (ordered ${ref.ordered}, already committed ${roundQty(committedBefore)}, requested total ${roundQty(committedAfter)}).`,
        { lineId: d.lineId, ordered: ref.ordered, committedBefore: roundQty(committedBefore), committedAfter: roundQty(committedAfter) });
    }
    // Keep other per-line fields (e.g. invoiced quantities maintained by the invoice service).
    lines[d.lineId] = { ...(lines[d.lineId] || {}), ...next };
  }
  return { ...(ledger || {}), lines };
}
const lineLabel = ref => ref.line.desc || ref.line.code || ref.line.lineId;

/* ───────────────────────── DN state helpers ───────────────────────── */

export function acceptedQtyOf(dn, item) {
  if (dn.voided || !dn.customerConfirmed) return 0;
  const qty = Number(item.qty) || 0;
  if (item.acceptedQty != null && Number.isFinite(Number(item.acceptedQty))) return Math.max(0, Math.min(qty, Number(item.acceptedQty)));
  if (item.rejectedQty != null && Number.isFinite(Number(item.rejectedQty))) return Math.max(0, qty - Math.max(0, Number(item.rejectedQty)));
  return qty;
}
export const rejectedQtyOf = (dn, item) => (dn.customerConfirmed && !dn.voided ? (Number(item.rejectedQty) || 0) : 0);
/** Same status vocabulary as the V259 UI (getDNStatus). */
export function dnStatus(dn) {
  if (dn.voided) return 'Voided';
  if (!dn.customerConfirmed) return 'Out for Delivery';
  let a = 0, r = 0;
  for (const it of dn.items || []) { a += acceptedQtyOf(dn, it); r += rejectedQtyOf(dn, it); }
  if (r <= 0) return 'Delivered';
  if (a <= 0) return 'Rejected';
  return 'Partially Accepted';
}
export function dispatchSnapshot(dn) {
  return {
    date: dn.date || '', vehicle: dn.vehicle || '', remarks: dn.remarks || '',
    deliveredBy: dn.deliveredBy || '', deliveredByType: dn.deliveredByType || '',
    items: (dn.items || []).map(it => ({ soLineId: it.soLineId, code: it.code || '', desc: it.desc || '', uom: it.uom || '', qty: Number(it.qty) || 0 })),
  };
}
export function acceptanceSnapshot(dn) {
  return {
    status: dnStatus(dn), receivedBy: dn.receivedBy || '', customerRemarks: dn.customerRemarks || '',
    confirmedAt: dn.confirmedAt || '', confirmedBy: dn.confirmedBy || '',
    items: (dn.items || []).map(it => ({
      soLineId: it.soLineId, desc: it.desc || '', uom: it.uom || '', qty: Number(it.qty) || 0,
      acceptedQty: acceptedQtyOf(dn, it), rejectedQty: rejectedQtyOf(dn, it),
      rejectionReason: it.rejectionReason || '', rejectionDisposition: it.rejectionDisposition || '',
      acceptanceRemarks: it.acceptanceRemarks || '',
    })),
  };
}
/** Contribution of one DN to the ledger. */
export function dnLedgerContribution(dn) {
  const out = new Map();
  if (dn.voided) return out;
  for (const it of dn.items || []) {
    const cur = out.get(it.soLineId) || { inTransit: 0, accepted: 0, rejected: 0 };
    if (dn.customerConfirmed) {
      cur.accepted = roundQty(cur.accepted + acceptedQtyOf(dn, it));
      cur.rejected = roundQty(cur.rejected + rejectedQtyOf(dn, it));
    } else cur.inTransit = roundQty(cur.inTransit + (Number(it.qty) || 0));
    out.set(it.soLineId, cur);
  }
  return out;
}
/** Deltas that move the ledger from DN state `before` to DN state `after` (either may be null). */
export function ledgerDeltasBetween(before, after) {
  const a = before ? dnLedgerContribution(before) : new Map(), b = after ? dnLedgerContribution(after) : new Map();
  const ids = new Set([...a.keys(), ...b.keys()]), zero = { inTransit: 0, accepted: 0, rejected: 0 };
  const deltas = [];
  for (const lineId of ids) {
    const x = a.get(lineId) || zero, y = b.get(lineId) || zero;
    const d = { lineId, inTransit: roundQty(y.inTransit - x.inTransit), accepted: roundQty(y.accepted - x.accepted), rejected: roundQty(y.rejected - x.rejected) };
    if (d.inTransit || d.accepted || d.rejected) deltas.push(d);
  }
  return deltas;
}

/** V270.4.6 — which Delivery Notes are covered by delivery invoices.
 *  Invoices are issued per Sales Order line, not per DN, so the invoiced quantity of each line is matched
 *  to the confirmed DNs in the order they were confirmed (first confirmed = first invoiced).
 *  `dns`: the order's Delivery Notes (any state; voided / unconfirmed ones are skipped).
 *  `invoicedOf(lineId)`: quantity invoiced by delivery invoices for the line, net of credit notes.
 *  Returns Map(dnKey → [{ lineId, desc, qty }]) for every DN with an invoiced quantity (dnKey = id || dnNo). */
export const dnKeyOf = dn => String(dn?.id || dn?.dnNo || '');
export function dnConfirmOrderKey(dn) {
  return String(dn?.confirmedAt || dn?.customerConfirmedDate || dn?.date || '') + '|' + String(dn?.dnNo || '') + '|' + dnKeyOf(dn);
}
export function dnInvoiceCoverage(dns, invoicedOf) {
  const left = new Map(), out = new Map();
  const remaining = id => { if (!left.has(id)) left.set(id, Math.max(0, roundQty(Number(invoicedOf(id)) || 0))); return left.get(id); };
  const list = (Array.isArray(dns) ? dns : []).filter(d => d && !d.voided && d.customerConfirmed)
    .slice().sort((a, b) => dnConfirmOrderKey(a).localeCompare(dnConfirmOrderKey(b)));
  for (const dn of list) {
    const lines = [];
    for (const it of dn.items || []) {
      const id = it.soLineId; if (!id) continue;
      const acc = acceptedQtyOf(dn, it), rest = remaining(id);
      if (!(acc > QTY_EPSILON) || !(rest > QTY_EPSILON)) continue;
      const qty = roundQty(Math.min(acc, rest));
      left.set(id, roundQty(rest - qty));
      lines.push({ lineId: id, desc: it.desc || it.code || '', qty });
    }
    if (lines.length) out.set(dnKeyOf(dn), lines);
  }
  return out;
}
/** Plain-language reason shown when an invoiced DN is opened for correction / revision. */
export function dnInvoicedMessage(dn, lines, invoiceNos = []) {
  const what = (lines || []).slice(0, 2).map(l => `${roundQty(l.qty)} of "${l.desc || 'item'}"`).join(', ') + ((lines || []).length > 2 ? ` and ${lines.length - 2} more line(s)` : '');
  const inv = invoiceNos && invoiceNos.length ? ` in ${invoiceNos.join(', ')}` : '';
  return `${dn?.dnNo || 'This Delivery Note'} is already invoiced${inv} (${what}). An invoiced Delivery Note stays as the customer signed it and can no longer be corrected or revised. If goods come back, issue a credit note on the invoice.`;
}

/** Quantity already invoiced per SO line (lineId → qty) from the invoices stored on the Sales Order.
 *  Invoice items carry `soLineId` (V260+) or `soIdx` (SO row) — both resolve to the line's stable ID.
 *  Cancelled / credited-out invoices are ignored. */
export function invoicedQtyByLine(so) {
  const out = new Map();
  const items = Array.isArray(so?.items) ? so.items : [];
  for (const inv of (Array.isArray(so?.invoices) ? so.invoices : [])) {
    if (!inv || inv.cancelled || inv.status === 'Cancelled' || inv.voided) continue;
    for (const it of (Array.isArray(inv.items) ? inv.items : [])) {
      const lineId = it.soLineId || (Number.isInteger(it.soIdx) && items[it.soIdx] ? items[it.soIdx].lineId : null);
      const q = Number(it.qty);
      if (!lineId || !Number.isFinite(q) || q <= 0) continue;
      out.set(lineId, roundQty((out.get(lineId) || 0) + q));
    }
  }
  return out;
}

/** Builds a DN item from the authoritative SO line read inside the transaction. */
export function buildDNItem(soLine, soIdx, qty) {
  const { lineId, ...display } = soLine;
  delete display.remainingQty; delete display.acceptedQty; delete display.rejectedQty;
  // Bulky copied values (e.g. base64 product images, ~70 KB+) stay on the SO line; a DN only needs
  // code/description/UOM/quantities. Keeps every DN small however the SO lines were created.
  for (const [k, v] of Object.entries(display)) if (k !== 'desc' && typeof v === 'string' && v.length > 2000) delete display[k];
  return {
    ...display, soLineId: lineId, soIdx, origIdx: soLine.origIdx !== undefined ? soLine.origIdx : soIdx,
    qty, acceptedQty: null, rejectedQty: null,
  };
}

/* ───────────────────────── input validation ───────────────────────── */

export function validateDispatchLines(lines, lineIndex, { allowEmpty = false } = {}) {
  ensure(Array.isArray(lines), ERR.INVALID_INPUT, 'Dispatch lines required');
  const seen = new Set(), out = [];
  for (const [i, l] of lines.entries()) {
    ensure(isSafeId(l?.lineId), ERR.INVALID_INPUT, `Dispatch line ${i + 1} has no Sales Order line ID`);
    ensure(!seen.has(l.lineId), ERR.INVALID_INPUT, `Sales Order line ${l.lineId} appears twice`);
    seen.add(l.lineId);
    ensure(lineIndex.has(l.lineId), ERR.INVALID_INPUT, `Dispatch line ${i + 1} does not belong to this Sales Order`);
    const qty = parseQty(l.qty, `dispatch quantity (line ${i + 1})`);
    if (qty > 0) out.push({ lineId: l.lineId, qty });
  }
  ensure(allowEmpty || out.length > 0, ERR.INVALID_INPUT, 'Enter at least one dispatch quantity');
  ensure(out.length <= LIMITS.linesPerDN, ERR.SIZE_LIMIT, `A Delivery Note cannot exceed ${LIMITS.linesPerDN} lines`);
  return out;
}
export function validateAcceptanceLines(dn, lines, { requireReason = true } = {}) {
  ensure(Array.isArray(lines) && lines.length === (dn.items || []).length, ERR.INVALID_INPUT,
    'Acceptance must include every Delivery Note line');
  const byLine = new Map();
  for (const l of lines) {
    ensure(isSafeId(l?.lineId) && !byLine.has(l.lineId), ERR.INVALID_INPUT, 'Invalid or duplicate acceptance line');
    byLine.set(l.lineId, l);
  }
  return dn.items.map((it, i) => {
    const l = byLine.get(it.soLineId);
    ensure(l, ERR.INVALID_INPUT, `Acceptance is missing line ${i + 1} (${it.desc || it.soLineId})`);
    const qty = Number(it.qty) || 0;
    const a = parseQty(l.acceptedQty, `accepted quantity (line ${i + 1})`), r = parseQty(l.rejectedQty, `rejected quantity (line ${i + 1})`);
    ensure(Math.abs(a + r - qty) <= 1e-3, ERR.INVALID_INPUT, `Line ${i + 1}: Accepted + Rejected must equal the delivered quantity (${qty})`);
    const reason = cleanText(l.rejectionReason, 200);
    ensure(!requireReason || r <= 0 || reason, ERR.INVALID_INPUT, `Line ${i + 1}: select a rejection reason`);
    return {
      ...it, acceptedQty: a, rejectedQty: r,
      rejectionReason: r > 0 ? reason : '', rejectionDisposition: r > 0 ? cleanText(l.rejectionDisposition, 200) : '',
      acceptanceRemarks: cleanText(l.acceptanceRemarks, 500),
    };
  });
}
export function requireReason(reason) {
  const r = cleanText(reason, 1000);
  ensure(r.length >= LIMITS.reasonMin, ERR.INVALID_INPUT, `A reason of at least ${LIMITS.reasonMin} characters is required`);
  return r;
}
export function requireDate(date) {
  ensure(typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date + 'T00:00:00Z')),
    ERR.INVALID_INPUT, 'Enter a valid date (YYYY-MM-DD)');
  return date;
}
export { cleanText };

/* ───────────────────────── size guard ───────────────────────── */

const encoder = new TextEncoder();
export const byteSize = x => encoder.encode(JSON.stringify(x)).length;
export function assertSize(record, max, label) {
  const size = byteSize(record);
  ensure(size < max, ERR.SIZE_LIMIT, `${label} is too large to store safely (${size} bytes; limit ${max}).`, { size, max });
  return size;
}

/* ───────────────────────── read model ───────────────────────── */

const dnSortKey = d => [String(d.created || d.dispatchedAt || ''), String(d.dnNo || ''), String(d.id || '')];
export function compareDNs(a, b) {
  const x = dnSortKey(a), y = dnSortKey(b);
  for (let i = 0; i < x.length; i++) { const c = x[i].localeCompare(y[i]); if (c) return c; }
  return 0;
}
/**
 * Presents independent DNs to the existing UI as `so.deliveries` (creation order — stable,
 * so a new DN is always appended and never shifts the position of an existing one).
 * Returns shallow SO copies; NEVER persist the projected `deliveries`.
 * Invalid DNs are excluded and reported instead of breaking the whole application.
 */
export function projectSalesOrders(rawSalesOrders, deliveryNotes) {
  const issues = [];
  const soIds = new Set((rawSalesOrders || []).map(s => s?.id));
  const bySO = new Map(), seen = new Set();
  for (const dn of deliveryNotes || []) {
    if (!dn || !isSafeId(dn.id) || !isSafeId(dn.salesOrderId) || !Array.isArray(dn.items)) { issues.push({ code: 'INVALID_DN', id: dn?.id }); continue; }
    if (seen.has(dn.id)) { issues.push({ code: 'DUPLICATE_DN', id: dn.id }); continue; }
    seen.add(dn.id);
    if (!soIds.has(dn.salesOrderId)) { issues.push({ code: 'ORPHAN_DN', id: dn.id, salesOrderId: dn.salesOrderId }); continue; }
    const list = bySO.get(dn.salesOrderId) || [];
    list.push(dn); bySO.set(dn.salesOrderId, list);
  }
  const salesOrders = (rawSalesOrders || []).map(so => {
    if (Array.isArray(so.deliveries) && so.deliveries.length) issues.push({ code: 'EMBEDDED_DELIVERIES_PRESENT', salesOrderId: so.id, count: so.deliveries.length });
    return { ...so, deliveries: (bySO.get(so.id) || []).slice().sort(compareDNs) };
  });
  return { salesOrders, issues };
}
/** Removes UI-only projections before an SO is persisted. */
export function stripProjection(so) {
  if (!so || typeof so !== 'object') return so;
  const { deliveries, ...rest } = so;
  if (rest._invoiceProjection) {
    // V264: invoices / credit notes shown inside the order come from their own documents (view only)
    const { invoices, creditNotes, billingSummary, _invoiceProjection, ...plain } = rest;
    return plain;
  }
  return rest;
}

/* ───────────────────────── reconciliation ───────────────────────── */

/** Recomputes the ledger from DNs and compares it with the stored ledger and the SO lines. */
export function reconcileSalesOrder(so, deliveryNotes, ledger) {
  const problems = [];
  let lineIndex;
  try { lineIndex = soLineIndex(so); } catch (e) { return { ok: false, problems: [{ code: e.code || 'LINE_IDS', message: e.message }], expected: null }; }
  const expected = {};
  for (const dn of deliveryNotes) {
    if (dn.salesOrderId !== so.id) continue;
    for (const it of dn.items || []) {
      if (!lineIndex.has(it.soLineId)) problems.push({ code: 'UNKNOWN_LINE', dnId: dn.id, lineId: it.soLineId });
    }
    for (const [lineId, c] of dnLedgerContribution(dn)) {
      const e = expected[lineId] || { inTransit: 0, accepted: 0, rejected: 0 };
      expected[lineId] = { inTransit: roundQty(e.inTransit + c.inTransit), accepted: roundQty(e.accepted + c.accepted), rejected: roundQty(e.rejected + c.rejected) };
    }
  }
  for (const [lineId, ref] of lineIndex) {
    const e = expected[lineId] || { inTransit: 0, accepted: 0, rejected: 0 };
    if (e.inTransit + e.accepted > ref.ordered + QTY_EPSILON) problems.push({ code: 'OVER_FULFILLED', lineId, ordered: ref.ordered, committed: roundQty(e.inTransit + e.accepted) });
    if (ledger) {
      const s = ledgerLine(ledger, lineId);
      for (const k of ['inTransit', 'accepted', 'rejected']) {
        if (Math.abs(s[k] - e[k]) > QTY_EPSILON) problems.push({ code: 'LEDGER_MISMATCH', lineId, field: k, ledger: s[k], expected: e[k] });
      }
    }
  }
  if (ledger) for (const lineId of Object.keys(ledger.lines || {})) if (!lineIndex.has(lineId)) problems.push({ code: 'LEDGER_UNKNOWN_LINE', lineId });
  return { ok: problems.length === 0, problems, expected };
}
