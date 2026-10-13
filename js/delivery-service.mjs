/**
 * BizCore V260 — Delivery Note transaction service.
 *
 * Every business operation is ONE Firestore transaction that:
 *   1. reads the authoritative SO, ledger and DN (never trusts browser-calculated balances),
 *   2. applies a whitelisted change (the browser sends intent, not a whole record),
 *   3. writes the DN, the bounded SO ledger and one immutable audit event atomically.
 *
 * The Sales Order document itself is never written by Delivery Note operations, so
 * DN activity can neither grow the SO document nor race with ordinary SO edits.
 *
 * Idempotency: document IDs are derived from the client operation ID, so a retry of a
 * committed operation (e.g. after a network timeout) is detected and not applied twice.
 * Concurrency: Firestore transactions are serialisable; a concurrent change makes the
 * losing transaction re-run against fresh data (and fail validation if it no longer fits).
 * Optimistic locking: changes carry `expectedRevision`; a stale screen is rejected.
 */
import {
  COLLECTIONS, SCHEMA_VERSION, LIMITS, ERR, DeliveryError,
  isSafeId, dnIdForOperation, eventIdForOperation, soLineIndex, emptyLedger, applyLedgerDeltas,
  ledgerDeltasBetween, buildDNItem, validateDispatchLines, validateAcceptanceLines, requireReason,
  requireDate, cleanText, cleanDeliveredBy, assertSize, dnStatus, dispatchSnapshot, acceptanceSnapshot, roundQty,
  invoicedQtyByLine,
} from './delivery-core.mjs?v=266.0';
import { LOCK_COLLECTION, LOCK_TYPES, lockId, lockHeldBy } from './lock-service.mjs?v=266.0';

const fail = (code, message, details) => { throw new DeliveryError(code, message, details); };
const ensure = (ok, code, message, details) => { if (!ok) fail(code, message, details); };

export function createDeliveryService(fs, options = {}) {
  const { db, doc, runTransaction } = fs || {};
  ensure(db && typeof doc === 'function' && typeof runTransaction === 'function', ERR.INVALID_INPUT, 'Firestore transaction API required');
  const serverTimestamp = typeof fs.serverTimestamp === 'function' ? fs.serverTimestamp : null;
  const now = options.now || (() => new Date().toISOString());
  const actorOf = () => {
    const a = (options.actor && options.actor()) || {};
    ensure(isSafeId(a.uid), ERR.INVALID_STATE, 'You must be signed in to change Delivery Notes');
    return { name: cleanText(a.name || a.email || a.uid, 200), uid: a.uid };
  };
  const formatNumber = options.formatNumber || ((prefix, n) => prefix + String(n).padStart(4, '0'));
  // Order lock (ERP-style exclusive editing). When required, every operation verifies inside its
  // transaction that this user/session holds the Sales Order lock; the security rules enforce the
  // same (with server time for expiry), so a stale window or an expired lock cannot write.
  const orderLock = options.orderLock || null; // { required(): boolean, sessionId(): string }
  const lockRequired = () => !!(orderLock && orderLock.required && orderLock.required());
  const assertOrderLock = (lockSnap, actor, so) => {
    if (!lockRequired()) return;
    const held = lockHeldBy(lockSnap && lockSnap.exists() ? lockSnap.data() : null, actor.uid, orderLock.sessionId && orderLock.sessionId());
    ensure(held, ERR.LOCK_REQUIRED,
      `You no longer have ${so && so.soNo ? so.soNo : 'this Sales Order'} open for editing (the lock expired or was released). Nothing was saved — please open it again.`);
  };

  const refs = {
    so: id => doc(db, COLLECTIONS.salesOrders, id),
    ledger: id => doc(db, COLLECTIONS.fulfillment, id),
    dn: id => doc(db, COLLECTIONS.deliveryNotes, id),
    event: (dnId, col, id) => doc(db, COLLECTIONS.deliveryNotes, dnId, col, id),
    counter: key => doc(db, COLLECTIONS.counters, key),
    lock: soId => doc(db, LOCK_COLLECTION, lockId(LOCK_TYPES.salesOrder, soId)),
  };
  const stamp = () => (serverTimestamp ? { recordedAt: serverTimestamp() } : {});

  /* A transaction attempt may observe documents read at slightly different moments
   * (e.g. the DN before and the ledger after another user's commit). Such an attempt can
   * never commit — Firestore rejects it — but its business validation may fail first with
   * a misleading message. Validation failures that can stem from such a torn read are
   * therefore re-checked once in a completely fresh transaction before being reported.
   * Safe because every operation is idempotent (deterministic document/event IDs). */
  const RECHECK_CODES = new Set([ERR.INCONSISTENT, ERR.OVER_DISPATCH, ERR.INVALID_STATE]);
  // Contention outcomes: when several users commit against the same documents at once, the losing
  // commit can come back as aborted / failed-precondition — and, observed on the Firebase Emulator,
  // as permission-denied (rules evaluated against a state that changed underneath). Every operation
  // is idempotent, so these are retried in a fresh transaction after a short random pause. A genuine
  // permission denial simply fails again and is then reported.
  const CONTENTION_CODES = new Set(['aborted', 'failed-precondition', 'permission-denied']);
  const pause = attempt => new Promise(r => setTimeout(r, 60 * attempt + Math.floor(Math.random() * 120)));
  async function transact(fn) {
    for (let attempt = 1; ; attempt++) {
      try { return await runTransaction(db, fn); }
      catch (e) {
        if (attempt < 3 && RECHECK_CODES.has(e?.code)) continue;
        if (attempt < 4 && CONTENTION_CODES.has(e?.code)) { await pause(attempt); continue; }
        throw e;
      }
    }
  }

  /** A Sales Order that still embeds legacy DNs may only be used once the migration has created
   *  its ledger (the embedded copies are then inert and are removed later by `strip`). */
  function readSalesOrder(snap, soId, ledgerSnap) {
    ensure(snap.exists(), ERR.NOT_FOUND, `Sales Order ${soId} not found`);
    const so = snap.data();
    ensure(!(Array.isArray(so.deliveries) && so.deliveries.length && !ledgerSnap.exists()), ERR.LEGACY_DATA,
      'This Sales Order still contains legacy embedded Delivery Notes that were not migrated. Complete the V260 migration before using independent Delivery Notes.');
    return so;
  }
  function readLedger(snap, soId) {
    if (!snap.exists()) return emptyLedger(soId);
    const l = snap.data();
    ensure(l.salesOrderId === soId, ERR.INCONSISTENT, 'Fulfillment ledger does not belong to this Sales Order');
    return l;
  }
  function ledgerRecord(ledger, soId, eventMeta) {
    const rec = {
      ...ledger, salesOrderId: soId, schemaVersion: SCHEMA_VERSION, revision: (Number(ledger.revision) || 0) + 1,
      lastDeliveryNoteId: eventMeta.dnId, lastEventId: eventMeta.eventId, lastEventCollection: eventMeta.collection,
      updatedAt: eventMeta.at, updatedBy: eventMeta.actor.name, updatedByUid: eventMeta.actor.uid,
    };
    assertSize(rec, LIMITS.ledgerBytes, 'Fulfillment ledger');
    return rec;
  }

  /* ───────── create (dispatch) ───────── */
  async function dispatch(input) {
    const { operationId, salesOrderId, numbering } = input || {};
    ensure(isSafeId(salesOrderId), ERR.INVALID_INPUT, 'Sales Order ID required');
    ensure(numbering && isSafeId(numbering.counterKey) && typeof numbering.displayPrefix === 'string', ERR.INVALID_INPUT, 'Document numbering is required');
    const dnId = dnIdForOperation(operationId);
    const eventId = eventIdForOperation('dispatch', operationId);
    const date = requireDate(input.date);
    const vehicle = cleanText(input.vehicle, 200), remarks = cleanText(input.remarks, 1000);
    const deliveredBy = cleanDeliveredBy(input.deliveredBy);
    const accessToken = input.accessToken == null ? null : String(input.accessToken);
    ensure(accessToken === null || /^[a-f0-9]{48}$/.test(accessToken), ERR.INVALID_INPUT, 'Invalid delivery access token');
    const actor = actorOf(), at = now();

    return transact(async tx => {
      // Reads first (Firestore requirement).
      const [soSnap, ledgerSnap, dnSnap, counterSnap, lockSnap] = await Promise.all([
        tx.get(refs.so(salesOrderId)), tx.get(refs.ledger(salesOrderId)), tx.get(refs.dn(dnId)), tx.get(refs.counter(numbering.counterKey)),
        lockRequired() ? tx.get(refs.lock(salesOrderId)) : Promise.resolve(null),
      ]);
      if (dnSnap.exists()) {
        const existing = dnSnap.data();
        ensure(existing.creationOperationId === operationId && existing.salesOrderId === salesOrderId, ERR.ID_COLLISION, 'Delivery Note ID already used by another operation');
        return { alreadyApplied: true, dn: existing };
      }
      const so = readSalesOrder(soSnap, salesOrderId, ledgerSnap);
      assertOrderLock(lockSnap, actor, so);
      const lineIndex = soLineIndex(so);
      const lines = validateDispatchLines(input.lines, lineIndex);
      const ledger = readLedger(ledgerSnap, salesOrderId);

      const sequence = (Number(counterSnap.exists() ? counterSnap.data().value : 0) || 0) + 1;
      const dnNo = formatNumber(numbering.displayPrefix, sequence);
      const items = lines.map(l => { const ref = lineIndex.get(l.lineId); return buildDNItem(ref.line, ref.index, l.qty); });
      const dn = {
        id: dnId, schemaVersion: SCHEMA_VERSION, dnNo, salesOrderId, soNo: so.soNo || '', customer: so.customer || '', custId: so.custId || '',
        poNo: so.poNo || '', date, vehicle, remarks, status: 'Out for Delivery', items,
        ...(deliveredBy || {}),
        voided: false, customerConfirmed: false,
        deliveryAccessToken: accessToken, deliveryAccessCreatedAt: accessToken ? at : null,
        creationOperationId: operationId, created: at, createdBy: actor.name, createdByUid: actor.uid,
        dispatchedAt: at, dispatchedBy: actor.name,
        revision: 1, lastEventId: eventId, lastEventCollection: COLLECTIONS.dispatchEvents,
        updatedAt: at, updatedBy: actor.name, updatedByUid: actor.uid,
      };
      assertSize(dn, LIMITS.dnBytes, 'Delivery Note');
      const deltas = ledgerDeltasBetween(null, dn);
      const nextLedger = applyLedgerDeltas(ledger, lineIndex, deltas);
      const event = {
        id: eventId, kind: 'dispatch', type: 'dispatch', label: 'Dispatched', operationId,
        deliveryNoteId: dnId, salesOrderId, dnNo, fromRevision: 0, toRevision: 1,
        reason: 'Initial dispatch', actor: actor.name, actorUid: actor.uid, at,
        before: null, after: dispatchSnapshot(dn), ledgerDeltas: deltas, ...stamp(),
      };
      assertSize(event, LIMITS.eventBytes, 'Audit event');

      tx.set(refs.counter(numbering.counterKey), { value: sequence, updatedAt: Date.now() });
      tx.set(refs.ledger(salesOrderId), ledgerRecord(nextLedger, salesOrderId, { dnId, eventId, collection: COLLECTIONS.dispatchEvents, at, actor }));
      tx.set(refs.dn(dnId), dn);
      tx.set(refs.event(dnId, COLLECTIONS.dispatchEvents, eventId), event);
      return { alreadyApplied: false, dn };
    });
  }

  /* ───────── change (shared transactional skeleton) ───────── */
  async function change({ operationId, dnId, salesOrderId, expectedRevision, collection, eventPrefix, apply }) {
    ensure(isSafeId(dnId), ERR.INVALID_INPUT, 'Delivery Note ID required');
    ensure(isSafeId(salesOrderId), ERR.INVALID_INPUT, 'Sales Order ID required');
    ensure(Number.isInteger(expectedRevision) && expectedRevision > 0, ERR.INVALID_INPUT, 'Expected revision required');
    const eventId = eventIdForOperation(eventPrefix, operationId);
    const actor = actorOf(), at = now();
    const soId = salesOrderId;
    return transact(async tx => {
      // Read order matters: the ledger (aggregate) is read BEFORE the DN. If the reads straddle
      // another user's commit, the DN is then the newer read, so the revision check reports an
      // accurate "changed by another user" instead of deltas being computed from a stale DN.
      const [soSnap, ledgerSnap, lockSnap] = await Promise.all([tx.get(refs.so(soId)), tx.get(refs.ledger(soId)),
        lockRequired() ? tx.get(refs.lock(soId)) : Promise.resolve(null)]);
      const [dnSnap, eventSnap] = await Promise.all([tx.get(refs.dn(dnId)), tx.get(refs.event(dnId, collection, eventId))]);
      ensure(dnSnap.exists(), ERR.NOT_FOUND, 'Delivery Note not found');
      const old = dnSnap.data();
      ensure(old.salesOrderId === soId, ERR.INVALID_INPUT, 'Delivery Note does not belong to this Sales Order');
      if (eventSnap.exists()) {
        const prev = eventSnap.data();
        ensure(prev.operationId === operationId && prev.deliveryNoteId === dnId, ERR.ID_COLLISION, 'Audit event ID collision');
        return { alreadyApplied: true, dn: old };
      }
      ensure(old.revision === expectedRevision, ERR.STALE_REVISION,
        `${old.dnNo || 'This Delivery Note'} was changed by another user or session. The latest version has been loaded — please review and try again.`,
        { currentRevision: old.revision, expectedRevision });
      const so = readSalesOrder(soSnap, soId, ledgerSnap);
      assertOrderLock(lockSnap, actor, so);
      const lineIndex = soLineIndex(so);
      const ledger = readLedger(ledgerSnap, soId);

      const { next, label, kind, type, reason, before, after } = apply(old, { lineIndex, so, at, actor });
      const revision = old.revision + 1;
      const record = {
        ...next, id: old.id, schemaVersion: SCHEMA_VERSION, salesOrderId: soId, dnNo: old.dnNo,
        creationOperationId: old.creationOperationId, created: old.created, createdBy: old.createdBy, createdByUid: old.createdByUid,
        revision, lastEventId: eventId, lastEventCollection: collection, updatedAt: at, updatedBy: actor.name, updatedByUid: actor.uid,
      };
      record.status = dnStatus(record);
      assertSize(record, LIMITS.dnBytes, 'Delivery Note');
      const deltas = ledgerDeltasBetween(old, record);
      const nextLedger = applyLedgerDeltas(ledger, lineIndex, deltas);
      // Accepted quantity can never fall below what has already been invoiced for that line:
      // the invoice must be cancelled (or a credit note issued) first.
      // Invoiced-by-delivery quantity: from the ledger once invoices are independent documents,
      // otherwise from the invoices still embedded in the Sales Order.
      const invoicedEmbedded = invoicedQtyByLine(so);
      const invoicedOf = id => (ledger.lines?.[id] && ledger.lines[id].invoicedDelivery != null)
        ? Number(ledger.lines[id].invoicedDelivery) || 0 : (invoicedEmbedded.get(id) || 0);
      for (const d of deltas) {
        if (!(d.accepted < 0)) continue;
        const inv = invoicedOf(d.lineId);
        const acc = Number(nextLedger.lines?.[d.lineId]?.accepted) || 0;
        const ref = lineIndex.get(d.lineId);
        ensure(acc + 1e-6 >= inv, ERR.BELOW_INVOICED,
          `"${ref?.line?.desc || ref?.line?.code || 'Line'}": ${roundQty(inv)} already invoiced, so the accepted quantity cannot be reduced to ${roundQty(acc)}. Cancel the invoice or issue a credit note first.`,
          { lineId: d.lineId, invoiced: roundQty(inv), acceptedAfter: roundQty(acc) });
      }
      const event = {
        id: eventId, kind, type, label, operationId, deliveryNoteId: dnId, salesOrderId: soId, dnNo: old.dnNo,
        fromRevision: old.revision, toRevision: revision, reason, actor: actor.name, actorUid: actor.uid, at,
        before, after: after(record), ledgerDeltas: deltas, ...stamp(),
      };
      assertSize(event, LIMITS.eventBytes, 'Audit event');
      tx.set(refs.ledger(soId), ledgerRecord(nextLedger, soId, { dnId, eventId, collection, at, actor }));
      tx.set(refs.dn(dnId), record);
      tx.set(refs.event(dnId, collection, eventId), event);
      return { alreadyApplied: false, dn: record };
    });
  }

  const assertDispatchEditable = old => {
    ensure(!old.voided, ERR.INVALID_STATE, `${old.dnNo} is voided and cannot be changed`);
    ensure(!old.customerConfirmed, ERR.INVALID_STATE, `${old.dnNo} has been accepted by the customer; dispatch can no longer be changed`);
  };

  async function correctDispatch(input) {
    const reason = requireReason(input?.reason);
    const date = requireDate(input?.date);
    return change({
      ...input, collection: COLLECTIONS.dispatchEvents, eventPrefix: 'correct',
      apply(old, { lineIndex, at, actor }) {
        assertDispatchEditable(old);
        const lines = validateDispatchLines(input.lines, lineIndex);
        const existing = new Map((old.items || []).map(it => [it.soLineId, it]));
        const items = lines.map(l => {
          const keep = existing.get(l.lineId);
          if (keep) return { ...keep, qty: l.qty, acceptedQty: null, rejectedQty: null };
          const ref = lineIndex.get(l.lineId); return buildDNItem(ref.line, ref.index, l.qty);
        }).sort((a, b) => a.soIdx - b.soIdx);
        return {
          next: { ...old, date, vehicle: cleanText(input.vehicle, 200), remarks: cleanText(input.remarks, 1000), ...(cleanDeliveredBy(input.deliveredBy) || {}), items, lastDispatchCorrectionAt: at, lastDispatchCorrectionBy: actor.name },
          kind: 'correct', type: 'correct', label: 'Dispatch corrected', reason, before: dispatchSnapshot(old), after: dispatchSnapshot,
        };
      },
    });
  }

  async function voidDispatch(input) {
    const reason = requireReason(input?.reason);
    return change({
      ...input, collection: COLLECTIONS.dispatchEvents, eventPrefix: 'void',
      apply(old, { at, actor }) {
        assertDispatchEditable(old);
        return {
          next: { ...old, voided: true, voidedAt: at, voidedBy: actor.name, voidReason: reason, deliveryAccessToken: null },
          kind: 'void', type: 'void', label: 'Dispatch voided', reason, before: dispatchSnapshot(old), after: dispatchSnapshot,
        };
      },
    });
  }

  /** mode: 'confirm' (first acceptance) | 'correction' (fix an entry mistake) | 'revision' (customer changed acceptance). */
  async function recordAcceptance(input) {
    const mode = input?.mode;
    ensure(['confirm', 'correction', 'revision'].includes(mode), ERR.INVALID_INPUT, 'Unknown acceptance operation');
    const reason = mode === 'confirm' ? 'Initial customer delivery confirmation' : requireReason(input.reason);
    const receivedBy = cleanText(input.receivedBy, 200);
    ensure(receivedBy, ERR.INVALID_INPUT, 'Received By is required');
    return change({
      ...input, collection: COLLECTIONS.acceptanceEvents, eventPrefix: mode,
      apply(old, { at, actor }) {
        ensure(!old.voided, ERR.INVALID_STATE, `${old.dnNo} is voided`);
        if (mode === 'confirm') ensure(!old.customerConfirmed, ERR.INVALID_STATE, `${old.dnNo} is already confirmed`);
        else ensure(old.customerConfirmed, ERR.INVALID_STATE, `${old.dnNo} must be confirmed before it can be ${mode === 'correction' ? 'corrected' : 'revised'}`);
        const items = validateAcceptanceLines(old, input.lines);
        const next = {
          ...old, items, customerConfirmed: true, receivedBy, customerRemarks: cleanText(input.customerRemarks, 1000),
          customerConfirmedDate: mode === 'confirm' ? at.slice(0, 10) : old.customerConfirmedDate,
          confirmedAt: mode === 'confirm' ? at : old.confirmedAt, confirmedBy: mode === 'confirm' ? actor.name : old.confirmedBy,
          confirmationOperationId: mode === 'confirm' ? input.operationId : old.confirmationOperationId,
          ...(mode === 'confirm' ? {} : { lastAcceptanceChangeAt: at, lastAcceptanceChangeBy: actor.name }),
        };
        return {
          next, kind: mode === 'confirm' ? 'accept' : mode, type: mode === 'confirm' ? 'confirmation' : mode,
          label: mode === 'confirm' ? 'Original confirmation' : mode === 'correction' ? 'Confirmation corrected' : 'Customer acceptance revised',
          reason, before: mode === 'confirm' ? null : acceptanceSnapshot(old), after: acceptanceSnapshot,
        };
      },
    });
  }

  /** Persists a QR access token for a DN that has none (pre-QR records). Touches only the token fields. */
  async function ensureAccessToken({ dnId, token }) {
    ensure(isSafeId(dnId) && /^[a-f0-9]{48}$/.test(String(token || '')), ERR.INVALID_INPUT, 'Invalid token request');
    actorOf();
    return runTransaction(db, async tx => {
      const snap = await tx.get(refs.dn(dnId));
      ensure(snap.exists(), ERR.NOT_FOUND, 'Delivery Note not found');
      const dn = snap.data();
      ensure(!dn.voided, ERR.INVALID_STATE, 'Voided Delivery Notes have no access link');
      if (dn.deliveryAccessToken) return { token: dn.deliveryAccessToken, alreadyApplied: true };
      tx.set(refs.dn(dnId), { ...dn, deliveryAccessToken: token, deliveryAccessCreatedAt: now() });
      return { token, alreadyApplied: false };
    });
  }

  return Object.freeze({ dispatch, correctDispatch, voidDispatch, recordAcceptance, ensureAccessToken });
}

/** Reads a DN's audit trail (both event streams), ordered by revision. */
export async function loadDeliveryEvents({ db, collection, getDocs }, dnId) {
  ensure(isSafeId(dnId), ERR.INVALID_INPUT, 'Invalid Delivery Note ID');
  const [d, a] = await Promise.all([
    getDocs(collection(db, COLLECTIONS.deliveryNotes, dnId, COLLECTIONS.dispatchEvents)),
    getDocs(collection(db, COLLECTIONS.deliveryNotes, dnId, COLLECTIONS.acceptanceEvents)),
  ]);
  const order = (x, y) => (Number(x.toRevision ?? x.sequence ?? 0) - Number(y.toRevision ?? y.sequence ?? 0)) || String(x.at || '').localeCompare(String(y.at || ''));
  return { dispatch: d.docs.map(s => s.data()).sort(order), acceptance: a.docs.map(s => s.data()).sort(order) };
}
export { roundQty };
