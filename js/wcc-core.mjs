/**
 * BizCore V271.13 — Work Completion Certificate (WCC) domain core (pure functions, no I/O).
 *
 * A WCC is the customer's acceptance of contracting work done on a Job. It carries NO prices:
 * the scope lines of the job (the frozen copy in jobs/{id}/scope/main) with a completion % each.
 *
 *   type 'partial'  a stage / part of the work           lines: % completed to date (≥ what was certified)
 *   type 'final'    the whole work is finished           every line must reach 100 %
 *
 * State machine (status):
 *   Pending Acceptance → Accepted | Accepted with remarks | Not accepted
 *                      → Cancelled (only while nothing has been invoiced against it)
 * Only an ACCEPTED certificate (with or without remarks) certifies work and may be billed.
 *
 * The certified position of a job is kept in the billing ledger (jobBilling/{jobId}.certified), written in the
 * same transaction as the certificate — so "how much is certified" is one number read from one document.
 */
export const WCC_COLLECTION = 'workCompletionCertificates';
export const WCC_EVENTS = 'wccEvents';          // workCompletionCertificates/{id}/wccEvents/{eventId}
export const WCC_SCHEMA_VERSION = 1;
export const WCC_TYPES = Object.freeze({ partial: 'partial', final: 'final' });
export const WCC_STATUS = Object.freeze({
  pending: 'Pending Acceptance',
  accepted: 'Accepted',
  acceptedRemarks: 'Accepted with remarks',
  notAccepted: 'Not accepted',
  cancelled: 'Cancelled',
});
export const WCC_RESULTS = Object.freeze({ accepted: 'accepted', acceptedRemarks: 'acceptedRemarks', notAccepted: 'notAccepted' });
export const WCC_ERR = Object.freeze({
  INVALID_INPUT: 'invalid-input',
  NOT_FOUND: 'not-found',
  INVALID_STATE: 'invalid-state',
  ID_COLLISION: 'id-collision',
  STALE_REVISION: 'stale-revision',
  PERMISSION: 'not-permitted',
  BELOW_CERTIFIED: 'below-certified',
  BILLED: 'already-billed',
});
export const WCC_LIMITS = Object.freeze({ lines: 600, text: 2000, name: 200, bytes: 512 * 1024 });

export class WccError extends Error {
  constructor(code, message, details = {}) { super(message); this.name = 'WccError'; this.code = code; Object.assign(this, details); }
}
const fail = (code, message, details) => { throw new WccError(code, message, details); };
const ensure = (ok, code, message, details) => { if (!ok) fail(code, message, details); };

export const isSafeId = v => typeof v === 'string' && v.length > 0 && v.length <= 240 && !v.includes('/') && v !== '.' && v !== '..' && !/^__.*__$/.test(v);
export const r2 = n => { const v = Number(n) || 0; return Math.sign(v) * Math.round((Math.abs(v) + Number.EPSILON) * 100) / 100; };
/** Completion percentages carry one decimal (85.5 %), like the job's Work done. */
export const rPct = n => Math.round((Number(n) || 0) * 10 + Number.EPSILON) / 10;
export const PCT_EPSILON = 0.05;
export const cleanText = (v, max = WCC_LIMITS.text) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);
/** Normalises a client operation ID into a deterministic key used for document IDs (as the other services do). */
export function operationKey(operationId) {
  ensure(typeof operationId === 'string', WCC_ERR.INVALID_INPUT, 'Operation ID required');
  const key = operationId.replace(/[^A-Za-z0-9_-]/g, '-');
  ensure(key.length >= 8 && key.length <= 200, WCC_ERR.INVALID_INPUT, 'Operation ID must be 8–200 characters');
  return key;
}
export const wccIdForOperation = operationId => 'WCC-' + operationKey(operationId);
export const wccEventId = (prefix, operationId) => prefix + '-' + operationKey(operationId);

/** YYYY-MM-DD, not in the future (the user's own day is passed in as `today`). */
export function requireWccDate(v, label, today) {
  const s = String(v == null ? '' : v).slice(0, 10);
  ensure(/^\d{4}-\d{2}-\d{2}$/.test(s), WCC_ERR.INVALID_INPUT, `${label || 'Date'} is required (DD-MM-YYYY)`);
  const d = new Date(s + 'T00:00:00Z');
  ensure(!Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s, WCC_ERR.INVALID_INPUT, `${label || 'Date'} is not a real date`);
  if (today) ensure(s <= String(today).slice(0, 10), WCC_ERR.INVALID_INPUT, `${label || 'Date'} cannot be in the future`);
  return s;
}
export const isAcceptedStatus = status => status === WCC_STATUS.accepted || status === WCC_STATUS.acceptedRemarks;
export const isOpenStatus = status => status === WCC_STATUS.pending;

/* ───────────────────────── the job's scope as certifiable lines ───────────────────────── */

/**
 * The priced scope lines of the frozen job scope (jobs/{id}/scope/main), in order.
 * Headings and note lines are not certified — they only print above the lines they belong to.
 * → [{ idx, n, title, workCat, qty, uom }]
 */
export function certifiableLines(scopeDoc) {
  const out = [];
  (scopeDoc && Array.isArray(scopeDoc.lines) ? scopeDoc.lines : []).forEach((l, i) => {
    if (!l || l.k !== 'line') return;
    out.push({ idx: i, n: Number(l.n) || out.length + 1, title: String(l.title || ''), workCat: String(l.workCat || ''), qty: Number(l.qty) || 0, uom: String(l.uom || '') });
  });
  return out;
}

/** A, B, … AA — the same section letters the quotation prints (js/app.js). */
export function sectionLetter(i) {
  let t = '', n = i;
  do { t = String.fromCharCode(65 + n % 26) + t; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return t;
}

/**
 * V271.13.3 — the certificate's own printable copy of the scope, in the quotation's shape:
 * sections A, B… with their sub-text, lines numbered A1, A2, B1…, the rich description kept as it was
 * accepted, Qty and UOM. It is stored ON the certificate so the document always prints exactly as it
 * was certified, even if the job's scope is re-frozen later.
 *   → [{ k:'heading', sl, text }
 *      { k:'note', text, html }
 *      { k:'line', sl, idx, n, title, html, workCat, qty, uom, prevPct, pct }]
 */
export function printRows(scopeDoc, lines) {
  const by = new Map((lines || []).map(l => [String(l && l.idx), l]));
  const src = scopeDoc && Array.isArray(scopeDoc.lines) ? scopeDoc.lines : [];
  const out = [];
  let sec = -1, n = 0;
  src.forEach((l, i) => {
    if (!l) return;
    if (l.k === 'heading') {
      sec++; n = 0;
      out.push({ k: 'heading', sl: sectionLetter(sec), text: cleanText(l.text, 600) });
      return;
    }
    if (l.k === 'note') {
      out.push({ k: 'note', text: cleanText(l.text, WCC_LIMITS.text), html: cleanText(l.html, WCC_LIMITS.text) });
      return;
    }
    if (l.k !== 'line') return;
    const got = by.get(String(i));
    if (!got) return;
    if (sec < 0) sec = 0;
    n++;
    out.push({
      k: 'line', sl: sectionLetter(sec) + n, idx: i, n: got.n,
      title: cleanText(l.title, 600), html: cleanText(l.html, WCC_LIMITS.text),
      workCat: cleanText(l.workCat, 120), qty: Number(l.qty) || 0, uom: cleanText(l.uom, 40),
      prevPct: got.prevPct, pct: got.pct,
    });
  });
  return out;
}

/** Highest % certified per scope line by the accepted certificates (cancelled / refused ones never count). */
export function certifiedByLine(wccList) {
  const map = new Map();
  (wccList || []).filter(w => w && isAcceptedStatus(w.status)).forEach(w => {
    (w.lines || []).forEach(l => {
      if (!l) return;
      const key = String(l.idx);
      const pct = rPct(l.pct);
      if (!map.has(key) || pct > map.get(key)) map.set(key, pct);
    });
  });
  return map;
}

/* ───────────────────────── the prior position ─────────────────────────
   What has already been certified, and whether a certificate is open. The screens work it out from the
   certificates they have loaded; a transaction works it out from the ONE job billing ledger it read
   (jobBilling/{jobId}), so the rules are checked against one authoritative document. Both shapes are
   normalised here, so buildWccBody() behaves identically in the browser and in the transaction. */

/** → { byLine: Map, certifiedPct, openWcc, finalWcc } */
export function priorFromList(wccList) {
  const byLine = certifiedByLine(wccList);
  const accepted = (wccList || []).filter(w => w && isAcceptedStatus(w.status));
  let best = null;
  accepted.forEach(w => { if (!best || rPct(w.overallPct) >= rPct(best.overallPct)) best = w; });
  const openWcc = (wccList || []).find(w => w && isOpenStatus(w.status)) || null;
  const finalWcc = accepted.find(w => w.type === WCC_TYPES.final) || null;
  return {
    byLine, certifiedPct: rPct(best ? best.overallPct : 0),
    certifiedWcc: best, openWcc: openWcc ? { id: openWcc.id, wccNo: openWcc.wccNo } : null,
    finalWcc: finalWcc ? { id: finalWcc.id, wccNo: finalWcc.wccNo } : null,
  };
}
/** The same, from the job billing ledger (jobBilling/{jobId}). */
export function priorFromLedger(ledger) {
  const c = (ledger && ledger.certified) || {};
  const byLine = new Map(Object.entries(c.byLine || {}).map(([k, v]) => [String(k), rPct(v)]));
  const open = (ledger && ledger.open) || null;
  const wccs = (ledger && ledger.wccs) || {};
  const finalId = String((ledger && ledger.finalWccId) || '');
  return {
    byLine, certifiedPct: rPct(c.pct),
    certifiedWcc: c.wccId ? { id: c.wccId, wccNo: c.wccNo || '' } : null,
    openWcc: open && open.wccId ? { id: open.wccId, wccNo: open.wccNo || '' } : null,
    finalWcc: finalId ? { id: finalId, wccNo: (wccs[finalId] && wccs[finalId].wccNo) || '' } : null,
  };
}
/** Accepts a certificate list, a ledger, or an already-normalised prior. */
export function asPrior(prior) {
  if (Array.isArray(prior)) return priorFromList(prior);
  if (prior && prior.byLine instanceof Map) return prior;
  if (prior && (prior.certified || prior.billing || prior.wccs)) return priorFromLedger(prior);
  return priorFromList([]);
}
/** The line map as it is stored in the ledger (plain object, Firestore-safe keys). */
export function byLineRecord(lines) {
  const out = {};
  (lines || []).forEach(l => { if (l && l.idx != null) out[String(l.idx)] = rPct(l.pct); });
  return out;
}

/**
 * The completion the job has reached: the value-free average over the scope lines (every line counts the same,
 * because contracting work is sold lump sum and the lines carry no price on a certificate).
 */
export function overallPct(lines, pctOf) {
  const list = (lines || []);
  if (!list.length) return 0;
  const total = list.reduce((s, l) => s + Math.max(0, Math.min(100, rPct(pctOf(l)))), 0);
  return rPct(total / list.length);
}

/** What the screens show: per line previous / entered, the overall figures and what the certificate may be. */
export function wccDraftState(scopeDoc, prior, draftLines) {
  const lines = certifiableLines(scopeDoc);
  const prev = asPrior(prior).byLine;
  const entered = new Map((draftLines || []).map(l => [String(l && l.idx), rPct(l && l.pct)]));
  const rows = lines.map(l => {
    const prevPct = rPct(prev.get(String(l.idx)) || 0);
    const has = entered.has(String(l.idx));
    const pct = has ? rPct(entered.get(String(l.idx))) : prevPct;
    return { ...l, prevPct, pct, done: pct >= 100 - PCT_EPSILON, raised: pct > prevPct + PCT_EPSILON };
  });
  const certifiedPct = overallPct(rows, r => r.prevPct);
  const toDatePct = overallPct(rows, r => r.pct);
  return {
    rows, certifiedPct, toDatePct,
    newPct: rPct(Math.max(0, toDatePct - certifiedPct)),
    allComplete: rows.length > 0 && rows.every(r => r.pct >= 100 - PCT_EPSILON),
    anyRaised: rows.some(r => r.raised),
  };
}

/* ───────────────────────── creating a certificate ───────────────────────── */

/**
 * Validates and builds the certificate body (no identity, no number — the service adds those).
 * `prior` is the certificates loaded in the browser, or the job billing ledger inside a transaction.
 * input: { type, date, periodFrom, periodTo, stage, lines:[{idx, pct}], remarks, repName, repTitle }
 * → { type, date, periodFrom, periodTo, stage, lines, overallPct, previousPct, newPct, remarks, repName, repTitle }
 */
export function buildWccBody(job, scopeDoc, prior, input, { today } = {}) {
  ensure(job && isSafeId(String(job.id || '')), WCC_ERR.INVALID_INPUT, 'The job is required');
  const type = String(input && input.type || '');
  ensure(Object.values(WCC_TYPES).includes(type), WCC_ERR.INVALID_INPUT, 'Choose Partial or Final');
  const scopeLines = certifiableLines(scopeDoc);
  ensure(scopeLines.length > 0, WCC_ERR.INVALID_STATE,
    'This job has no scope lines to certify. The scope is copied from the quotation when the job is created.');
  ensure(scopeLines.length <= WCC_LIMITS.lines, WCC_ERR.INVALID_INPUT, 'This scope has too many lines for one certificate');

  const p = asPrior(prior);
  ensure(!p.openWcc, WCC_ERR.INVALID_STATE,
    `${p.openWcc && p.openWcc.wccNo ? p.openWcc.wccNo : 'A certificate'} is still waiting for the customer's acceptance. Record its acceptance (or cancel it) before making another one.`);
  ensure(!p.finalWcc, WCC_ERR.INVALID_STATE, `The work is already certified as finished on ${p.finalWcc && p.finalWcc.wccNo ? p.finalWcc.wccNo : 'the final certificate'}.`);

  const date = requireWccDate(input && input.date, 'The certificate date', today);
  const periodFrom = input && input.periodFrom ? requireWccDate(input.periodFrom, 'Work period from', today) : '';
  const periodTo = input && input.periodTo ? requireWccDate(input.periodTo, 'Work period to', today) : '';
  if (periodFrom && periodTo) ensure(periodFrom <= periodTo, WCC_ERR.INVALID_INPUT, 'The work period "from" date must be before the "to" date');
  if (periodTo) ensure(periodTo <= date, WCC_ERR.INVALID_INPUT, 'The work period cannot end after the certificate date');

  const prev = p.byLine;
  const given = new Map();
  (input && Array.isArray(input.lines) ? input.lines : []).forEach(l => { if (l && l.idx != null) given.set(String(l.idx), l.pct); });
  const lines = scopeLines.map(l => {
    const key = String(l.idx);
    const prevPct = rPct(prev.get(key) || 0);
    const raw = given.has(key) ? given.get(key) : prevPct;
    const pct = rPct(Number(String(raw == null ? '' : raw).replace(/,/g, '')));
    ensure(Number.isFinite(pct) && pct >= 0 && pct <= 100, WCC_ERR.INVALID_INPUT,
      `"${l.title || 'Line ' + l.n}": the completion must be a number from 0 to 100`, { idx: l.idx });
    ensure(pct >= prevPct - PCT_EPSILON, WCC_ERR.BELOW_CERTIFIED,
      `"${l.title || 'Line ' + l.n}": ${prevPct} % is already certified, so it cannot go back to ${pct} %. Work already accepted by the customer is corrected with a credit note, not by lowering a certificate.`,
      { idx: l.idx, prevPct, pct });
    return { idx: l.idx, n: l.n, title: cleanText(l.title, 600), workCat: cleanText(l.workCat, 120), qty: l.qty, uom: cleanText(l.uom, 40), prevPct, pct };
  });
  const previousPct = overallPct(lines, l => l.prevPct);
  const overall = overallPct(lines, l => l.pct);
  if (type === WCC_TYPES.final) {
    const left = lines.filter(l => l.pct < 100 - PCT_EPSILON);
    ensure(left.length === 0, WCC_ERR.INVALID_INPUT,
      `A final certificate needs every line at 100 %. Still open: ${left.slice(0, 3).map(l => `"${l.title || 'line ' + l.n}" (${l.pct} %)`).join(', ')}${left.length > 3 ? ` and ${left.length - 3} more` : ''}.`,
      { open: left.map(l => l.idx) });
  } else {
    ensure(overall > previousPct + PCT_EPSILON, WCC_ERR.INVALID_INPUT,
      previousPct > 0 ? `Nothing new to certify — ${previousPct} % is already accepted by the customer. Raise at least one line.`
        : 'Enter how much of the work is completed on at least one line.');
  }
  return {
    type, date, periodFrom, periodTo, stage: cleanText(input && input.stage, WCC_LIMITS.name),
    lines, rows: printRows(scopeDoc, lines), overallPct: overall, previousPct, newPct: rPct(overall - previousPct),
    remarks: cleanText(input && input.remarks, WCC_LIMITS.text),
    repName: cleanText(input && input.repName, WCC_LIMITS.name), repTitle: cleanText(input && input.repTitle, WCC_LIMITS.name),
  };
}

/* ───────────────────────── acceptance / refusal ───────────────────────── */

/** input: { result, by, title, date, remarks }  → the fields to merge into the certificate. */
export function buildAcceptance(wcc, input, { today } = {}) {
  ensure(wcc && isOpenStatus(wcc.status), WCC_ERR.INVALID_STATE,
    wcc && wcc.status === WCC_STATUS.cancelled ? `${wcc.wccNo || 'This certificate'} was cancelled.`
      : `${(wcc && wcc.wccNo) || 'This certificate'} is already ${(wcc && wcc.status) || 'closed'} — its acceptance cannot be recorded twice.`);
  const result = String(input && input.result || '');
  ensure(Object.values(WCC_RESULTS).includes(result), WCC_ERR.INVALID_INPUT, 'Choose whether the customer accepted the work');
  const date = requireWccDate(input && input.date, 'The acceptance date', today);
  ensure(date >= String(wcc.date || '').slice(0, 10), WCC_ERR.INVALID_INPUT, 'The acceptance cannot be dated before the certificate');
  const remarks = cleanText(input && input.remarks, WCC_LIMITS.text);
  const by = cleanText(input && input.by, WCC_LIMITS.name);
  const status = result === WCC_RESULTS.accepted ? WCC_STATUS.accepted
    : result === WCC_RESULTS.acceptedRemarks ? WCC_STATUS.acceptedRemarks : WCC_STATUS.notAccepted;
  if (status === WCC_STATUS.notAccepted) ensure(remarks.length >= 3, WCC_ERR.INVALID_INPUT, 'Write why the customer did not accept the work');
  else ensure(by.length >= 2, WCC_ERR.INVALID_INPUT, "Enter the name of the customer's representative who accepted the work");
  if (status === WCC_STATUS.acceptedRemarks) ensure(remarks.length >= 3, WCC_ERR.INVALID_INPUT, 'Write the remarks the customer made');
  return {
    status, result,
    acceptance: { by, title: cleanText(input && input.title, WCC_LIMITS.name), date, remarks },
    certifies: isAcceptedStatus(status) ? rPct(wcc.overallPct) : null,
  };
}

/** A certificate may be cancelled while it is not accepted-and-billed. */
export function cancelCheck(wcc, { billedWccIds = [] } = {}) {
  ensure(wcc, WCC_ERR.NOT_FOUND, 'Certificate not found');
  ensure(wcc.status !== WCC_STATUS.cancelled, WCC_ERR.INVALID_STATE, `${wcc.wccNo || 'This certificate'} is already cancelled.`);
  ensure(!billedWccIds.map(String).includes(String(wcc.id)), WCC_ERR.BILLED,
    `${wcc.wccNo || 'This certificate'} has already been invoiced. Credit the invoice first, then cancel the certificate.`);
  return true;
}

/* ───────────────────────── read model for the screens ───────────────────────── */

/** One row per certificate for the Job view list. */
export function wccRows(wccList, invoices = []) {
  const billed = new Map();
  (invoices || []).forEach(i => { if (i && i.wccId) billed.set(String(i.wccId), { invNo: i.invNo || '', id: i.id, type: i.jobInvoiceType || '' }); });
  return (wccList || []).slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.wccNo || '').localeCompare(String(a.wccNo || '')))
    .map(w => ({
      ...w,
      accepted: isAcceptedStatus(w.status),
      open: isOpenStatus(w.status),
      billedOn: billed.get(String(w.id)) || null,
    }));
}
