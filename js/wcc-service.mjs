/**
 * BizCore V271.13 — Work Completion Certificate transaction service.
 *
 * Every action is ONE Firestore transaction that reads the authoritative job, its frozen scope
 * (jobs/{id}/scope/main), its billing ledger (jobBilling/{jobId}) and the access control document,
 * validates with js/wcc-core.mjs and writes atomically:
 *   certificate + immutable event + ledger (+ the document counter).
 * The job document itself is never written by this service.
 *
 * Firestore client transactions cannot run queries, so the rules are checked against the ONE ledger
 * document, which keeps the certified position per scope line, the certificate waiting for the customer
 * and a small index of every certificate of the job.
 *
 * Idempotency: the certificate ID derives from the client operation ID — a retried save is detected.
 */
import { formatSequence, nextSequence } from './numbering.mjs?v=270.25';
import {
  WCC_COLLECTION, WCC_EVENTS, WCC_SCHEMA_VERSION, WCC_STATUS, WCC_LIMITS, WCC_ERR, WccError,
  wccIdForOperation, wccEventId, buildWccBody, buildAcceptance, cancelCheck, priorFromLedger,
  isSafeId, cleanText, isAcceptedStatus,
} from './wcc-core.mjs?v=271.13';
import {
  JOB_BILLING_COLLECTION, JOB_LIMITS, emptyJobBilling, jobContractValue,
  applyWccCreatedToLedger, applyWccDecisionToLedger, applyWccCancelToLedger,
} from './job-billing-core.mjs?v=271.13';

const fail = (code, message, details) => { throw new WccError(code, message, details); };
const ensure = (ok, code, message, details) => { if (!ok) fail(code, message, details); };
const byteSize = obj => { try { return new TextEncoder().encode(JSON.stringify(obj)).length; } catch (e) { return 0; } };
const assertSize = (obj, max, label) => ensure(byteSize(obj) <= max, WCC_ERR.INVALID_INPUT, `${label} is too large to save (${Math.round(byteSize(obj) / 1024)} KB).`);

export function createWccService(fs, options = {}) {
  const { db, doc, runTransaction } = fs || {};
  ensure(db && typeof doc === 'function' && typeof runTransaction === 'function', WCC_ERR.INVALID_INPUT, 'Firestore transaction API required');
  const serverTimestamp = typeof fs.serverTimestamp === 'function' ? fs.serverTimestamp : null;
  const now = options.now || (() => new Date().toISOString());
  const formatNumber = options.formatNumber || formatSequence;
  const today = options.today || (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
  const actorOf = () => {
    const a = (options.actor && options.actor()) || {};
    ensure(isSafeId(a.uid), WCC_ERR.INVALID_STATE, 'You must be signed in to work on certificates');
    return { uid: a.uid, name: cleanText(a.name || a.email || a.uid, WCC_LIMITS.name) };
  };
  const refs = {
    job: id => doc(db, 'jobs', id),
    scope: id => doc(db, 'jobs', id, 'scope', 'main'),
    ledger: id => doc(db, JOB_BILLING_COLLECTION, id),
    wcc: id => doc(db, WCC_COLLECTION, id),
    event: (wccId, id) => doc(db, WCC_COLLECTION, wccId, WCC_EVENTS, id),
    counter: key => doc(db, 'counters', key),
  };
  const stamp = () => (serverTimestamp ? { recordedAt: serverTimestamp() } : {});
  const CONTENTION = new Set(['aborted', 'failed-precondition']);
  async function transact(fn) {
    for (let attempt = 1; ; attempt++) {
      try { return await runTransaction(db, fn); }
      catch (e) {
        if (attempt < 4 && CONTENTION.has(e && e.code)) { await new Promise(r => setTimeout(r, 60 * attempt + Math.floor(Math.random() * 120))); continue; }
        throw e;
      }
    }
  }
  function nextNumber(counterSnap, numbering) {
    ensure(numbering && isSafeId(numbering.counterKey) && typeof numbering.displayPrefix === 'string', WCC_ERR.INVALID_INPUT, 'Document numbering is required');
    const sequence = nextSequence(counterSnap.exists() ? counterSnap.data().value : 0, numbering);
    return { sequence, number: formatNumber(numbering.displayPrefix, sequence, numbering.digits) };
  }
  /** The job, its frozen scope and its billing ledger — read in one go, writes come after. */
  async function readJob(tx, jobId, extra = []) {
    const snaps = await Promise.all([tx.get(refs.job(jobId)), tx.get(refs.scope(jobId)), tx.get(refs.ledger(jobId)), ...extra.map(r => tx.get(r))]);
    const [jobSnap, scopeSnap, ledgerSnap, ...rest] = snaps;
    ensure(jobSnap.exists(), WCC_ERR.NOT_FOUND, `Job ${jobId} was not found`);
    const job = { id: jobId, ...jobSnap.data() };
    ensure(!/^(cancelled)$/i.test(String(job.status || '')), WCC_ERR.INVALID_STATE, `${job.jobNo || jobId} is cancelled.`);
    const ledger = ledgerSnap.exists() ? ledgerSnap.data() : emptyJobBilling(jobId);
    ensure(String(ledger.jobId) === String(jobId), WCC_ERR.INVALID_STATE, 'The billing ledger does not belong to this job');
    return { job, scope: scopeSnap.exists() ? scopeSnap.data() : null, ledger, rest };
  }
  function ledgerRecord(ledger, job, { wccId, invoiceId, eventId, at, actor }) {
    const rec = {
      ...ledger, jobId: String(job.id), jobNo: job.jobNo || '', custId: job.custId || '', contractValue: jobContractValue(job),
      schemaVersion: ledger.schemaVersion || 1, revision: (Number(ledger.revision) || 0) + 1,
      ...(wccId ? { lastWccId: wccId } : {}), ...(invoiceId ? { lastInvoiceId: invoiceId } : {}),
      lastEventId: eventId || '', updatedAt: at, updatedBy: actor.name, updatedByUid: actor.uid,
    };
    assertSize(rec, JOB_LIMITS.bytes, 'The job billing record');
    return rec;
  }

  /* ───────── create a certificate (Pending Acceptance) ───────── */
  async function createWcc(input) {
    const { operationId, jobId, numbering } = input || {};
    ensure(isSafeId(jobId), WCC_ERR.INVALID_INPUT, 'Job reference required');
    const wccId = wccIdForOperation(operationId);
    const eventId = wccEventId('new', operationId);
    const actor = actorOf(), at = now(), day = today();

    return transact(async tx => {
      const ctx = await readJob(tx, jobId, [refs.wcc(wccId), refs.counter((numbering || {}).counterKey || 'x')]);
      const [wccSnap, counterSnap] = ctx.rest;
      if (wccSnap.exists()) {
        const existing = wccSnap.data();
        ensure(existing.creationOperationId === operationId && String(existing.jobId) === String(jobId), WCC_ERR.ID_COLLISION, 'Certificate ID already used by another operation');
        return { alreadyApplied: true, wcc: existing };
      }
      ensure(ctx.scope, WCC_ERR.INVALID_STATE,
        `${ctx.job.jobNo || jobId} has no scope of work saved, so nothing can be certified. The scope is copied from the quotation when the job is created.`);
      const body = buildWccBody(ctx.job, ctx.scope, priorFromLedger(ctx.ledger), input, { today: day });
      const { sequence, number } = nextNumber(counterSnap, numbering);
      const wcc = {
        id: wccId, schemaVersion: WCC_SCHEMA_VERSION, wccNo: number,
        jobId: String(jobId), jobNo: ctx.job.jobNo || '', quotationId: ctx.job.quotationId || '', qno: ctx.job.qno || '',
        custId: ctx.job.custId || '', company: ctx.job.company || '', project: ctx.job.project || '',
        poNo: ctx.job.poNo || '', poDate: ctx.job.poDate || '',
        ...body,
        status: WCC_STATUS.pending, acceptance: null, result: '',
        revision: 1, lastEventId: eventId, creationOperationId: operationId,
        created: at, createdBy: actor.name, createdByUid: actor.uid, updatedAt: at, updatedBy: actor.name, updatedByUid: actor.uid,
      };
      assertSize(wcc, WCC_LIMITS.bytes, 'The certificate');
      const event = {
        id: eventId, kind: 'created', wccId, wccNo: number, jobId: String(jobId), type: wcc.type, operationId, toRevision: 1,
        overallPct: wcc.overallPct, previousPct: wcc.previousPct, actor: actor.name, actorUid: actor.uid, at, ...stamp(),
      };
      const nextLedger = ledgerRecord(applyWccCreatedToLedger(ctx.ledger, wcc), ctx.job, { wccId, eventId, at, actor });
      tx.set(refs.counter(numbering.counterKey), { value: sequence, updatedAt: Date.now() });
      tx.set(refs.ledger(jobId), nextLedger);
      tx.set(refs.wcc(wccId), wcc);
      tx.set(refs.event(wccId, eventId), event);
      return { alreadyApplied: false, wcc };
    });
  }

  /* ───────── the customer's decision ───────── */
  async function recordAcceptance(input) {
    const { operationId, jobId, wccId } = input || {};
    ensure(isSafeId(jobId) && isSafeId(wccId), WCC_ERR.INVALID_INPUT, 'Certificate reference required');
    const eventId = wccEventId('acc', operationId);
    const actor = actorOf(), at = now(), day = today();

    return transact(async tx => {
      const ctx = await readJob(tx, jobId, [refs.wcc(wccId), refs.event(wccId, eventId)]);
      const [wccSnap, evSnap] = ctx.rest;
      ensure(wccSnap.exists(), WCC_ERR.NOT_FOUND, 'Certificate not found');
      const wcc = wccSnap.data();
      if (evSnap.exists()) return { alreadyApplied: true, wcc };
      ensure(String(wcc.jobId) === String(jobId), WCC_ERR.INVALID_INPUT, 'The certificate does not belong to this job');
      if (input.expectedRevision != null) ensure(wcc.revision === input.expectedRevision, WCC_ERR.STALE_REVISION,
        `${wcc.wccNo} was changed meanwhile. The latest version has been loaded — please review and try again.`);
      const decision = buildAcceptance(wcc, input, { today: day });
      const revision = (Number(wcc.revision) || 1) + 1;
      const next = {
        ...wcc, status: decision.status, result: decision.result, acceptance: decision.acceptance,
        certifiedPct: decision.certifies, revision, lastEventId: eventId,
        decidedAt: at, decidedBy: actor.name, decidedByUid: actor.uid,
        updatedAt: at, updatedBy: actor.name, updatedByUid: actor.uid,
      };
      assertSize(next, WCC_LIMITS.bytes, 'The certificate');
      const event = {
        id: eventId, kind: 'decided', wccId, wccNo: wcc.wccNo, jobId: String(jobId), operationId,
        fromRevision: wcc.revision, toRevision: revision, status: decision.status, result: decision.result,
        acceptedBy: decision.acceptance.by, acceptanceDate: decision.acceptance.date, remarks: decision.acceptance.remarks,
        certifies: decision.certifies, actor: actor.name, actorUid: actor.uid, at, ...stamp(),
      };
      const nextLedger = ledgerRecord(applyWccDecisionToLedger(ctx.ledger, next, decision), ctx.job, { wccId, eventId, at, actor });
      tx.set(refs.ledger(jobId), nextLedger);
      tx.set(refs.wcc(wccId), next);
      tx.set(refs.event(wccId, eventId), event);
      return { alreadyApplied: false, wcc: next, certifies: decision.certifies };
    });
  }

  /* ───────── cancel with a reason ───────── */
  async function cancelWcc(input) {
    const { operationId, jobId, wccId } = input || {};
    ensure(isSafeId(jobId) && isSafeId(wccId), WCC_ERR.INVALID_INPUT, 'Certificate reference required');
    const eventId = wccEventId('cancel', operationId);
    const reason = cleanText(input && input.reason, 600);
    ensure(reason.length >= 3, WCC_ERR.INVALID_INPUT, 'Write why the certificate is cancelled');
    const actor = actorOf(), at = now();

    return transact(async tx => {
      const ctx = await readJob(tx, jobId, [refs.wcc(wccId), refs.event(wccId, eventId)]);
      const [wccSnap, evSnap] = ctx.rest;
      ensure(wccSnap.exists(), WCC_ERR.NOT_FOUND, 'Certificate not found');
      const wcc = wccSnap.data();
      if (evSnap.exists()) return { alreadyApplied: true, wcc };
      ensure(String(wcc.jobId) === String(jobId), WCC_ERR.INVALID_INPUT, 'The certificate does not belong to this job');
      // Billed certificates are listed on the ledger's advances / invoices, so the check uses the ledger, not a query.
      const billed = Object.keys((ctx.ledger.billedWccIds || {})).filter(k => ctx.ledger.billedWccIds[k]);
      cancelCheck({ ...wcc, id: wccId }, { billedWccIds: billed });
      if (isAcceptedStatus(wcc.status)) {
        const cur = (ctx.ledger.certified || {});
        ensure(String(cur.wccId || '') === String(wccId), WCC_ERR.INVALID_STATE,
          `${wcc.wccNo} is accepted and a later certificate has been accepted after it. Cancel the later one first.`);
      }
      const revision = (Number(wcc.revision) || 1) + 1;
      const next = {
        ...wcc, status: WCC_STATUS.cancelled, cancelReason: reason, revision, lastEventId: eventId,
        cancelledAt: at, cancelledBy: actor.name, cancelledByUid: actor.uid, updatedAt: at, updatedBy: actor.name, updatedByUid: actor.uid,
      };
      assertSize(next, WCC_LIMITS.bytes, 'The certificate');
      const event = {
        id: eventId, kind: 'cancelled', wccId, wccNo: wcc.wccNo, jobId: String(jobId), operationId,
        fromRevision: wcc.revision, toRevision: revision, reason, previousStatus: wcc.status,
        actor: actor.name, actorUid: actor.uid, at, ...stamp(),
      };
      const nextLedger = ledgerRecord(applyWccCancelToLedger(ctx.ledger, { ...next, id: wccId }), ctx.job, { wccId, eventId, at, actor });
      tx.set(refs.ledger(jobId), nextLedger);
      tx.set(refs.wcc(wccId), next);
      tx.set(refs.event(wccId, eventId), event);
      return { alreadyApplied: false, wcc: next };
    });
  }

  /** Certificates and the billing ledger of one job (reads = the documents returned; no listener). */
  async function wccsOfJob(jobId, api) {
    const { getDocs, query, collection, where, getDoc } = api || {};
    if (typeof getDocs !== 'function') return { list: [], ledger: null, denied: false };
    try {
      const s = await getDocs(query(collection(db, WCC_COLLECTION), where('jobId', '==', String(jobId))));
      const list = []; s.forEach(d => list.push(d.data()));
      let ledger = null;
      if (typeof getDoc === 'function') { const l = await getDoc(refs.ledger(String(jobId))); if (l.exists()) ledger = l.data(); }
      list.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.wccNo || '').localeCompare(String(b.wccNo || '')));
      return { list, ledger, denied: false };
    } catch (e) {
      if (e && e.code === 'permission-denied') return { list: [], ledger: null, denied: true };
      throw e;
    }
  }

  return { createWcc, recordAcceptance, cancelWcc, wccsOfJob, _refs: refs };
}
