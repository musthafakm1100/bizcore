/**
 * BizCore V270.4.9 — master records: codes, VAT numbers that can't repeat, duplicate checks (agreed 30–31 Oct 2026).
 *
 * Codes (CUS-00001, SUP-00001, ITM-000001, EMP-0001) are given by the system when a record is first saved. They come
 * from the same counters as document numbers ("counters/doc_<type>_all"), inside ONE transaction with the record, so
 * two users saving at the same moment never get the same code. A code is never changed or given out again.
 *
 * VAT numbers: a customer's (or supplier's) VAT number is claimed in partyVat/{list}_{VAT} in the same transaction.
 * A VAT number already claimed by another customer is refused ("duplicate-vat", with that customer's name).
 * Customers and suppliers are separate lists — a company can be both. The security rules check the same.
 *
 * Names are never blocked: a same / similar name only gives a notice (findSimilar).
 */

export const MASTER_TYPES = Object.freeze({
  customers: { numberingType: 'customer', nameField: 'company', vat: true },
  suppliers: { numberingType: 'supplier', nameField: 'company', vat: true },
  products: { numberingType: 'product', nameField: 'name', vat: false },
  employees: { numberingType: 'employee', nameField: 'name', vat: false },
});
export const VAT_COLLECTION = 'partyVat';
/** V270.4.10 (Package B1): products are goods (ITM-…) or services (SRV-…) — each type has its own code sequence. */
export const isService = rec => !!rec && rec.type === 'service';
export const numberingTypeOf = (col, rec) => (col === 'products' && isService(rec) ? 'service' : (MASTER_TYPES[col] || {}).numberingType);
export const ERR = Object.freeze({ DUPLICATE_VAT: 'duplicate-vat', INVALID: 'invalid-input', NOT_FOUND: 'not-found' });

/** VAT number as compared: letters and digits only, capitals ("300 437-135" = "300437135"). */
export const normVat = v => String(v == null ? '' : v).replace(/[^0-9A-Za-z]/g, '').toUpperCase();
/** Key of a VAT claim: one per list and VAT number. */
export const vatClaimId = (col, vatKey) => `${col}_${vatKey}`;

/** A code made by the system offline (until the connection is back): …-OFF-… like document numbers. */
export const isTempCode = c => String(c || '').includes('-OFF-');
export const needsCode = rec => !rec || !rec.code || isTempCode(rec.code);

const LEGAL = new Set(['co', 'company', 'est', 'establishment', 'llc', 'ltd', 'limited', 'inc', 'corp', 'corporation',
  'the', 'and', 'wll', 'w', 'l', 'plc', 'llp', 'group', 'trading', 'contracting', 'ksa', 'saudi', 'arabia']);
/** Name as compared for "same": capitals, spaces and punctuation ignored ("Bnoon." = "BNOON"). */
export const normName = s => String(s == null ? '' : s).toLowerCase().normalize('NFKC')
  .replace(/&/g, ' and ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
/** Name as compared for "similar": also without legal / generic words ("AK Investment Co." ~ "AK Investment Company"). */
export const coreName = s => {
  const words = normName(s).split(' ').filter(Boolean);
  const core = words.filter(w => !LEGAL.has(w));
  return (core.length ? core : words).join(' ');
};
/**
 * Records with the same or a similar name (never the record itself). → [{ record, kind: 'same' | 'similar' }], same first.
 * For products the comparison also ignores spaces ("3Pin plug" = "3 Pin plug").
 */
export function findSimilar(list, name, { nameField = 'company', id = null, products = false } = {}) {
  const n = normName(name); if (!n) return [];
  const c = coreName(name), nz = n.replace(/ /g, ''), cz = c.replace(/ /g, '');
  const out = [];
  for (const r of list || []) {
    if (!r || (id != null && String(r.id) === String(id))) continue;
    const rn = normName(r[nameField]); if (!rn) continue;
    if (rn === n || (products && rn.replace(/ /g, '') === nz)) out.push({ record: r, kind: 'same' });
    else {
      const rc = coreName(r[nameField]), rcz = rc.replace(/ /g, '');
      if (rc && (rc === c || rcz === cz || (cz.length >= 6 && (rcz.startsWith(cz) || cz.startsWith(rcz)) && Math.min(rcz.length, cz.length) / Math.max(rcz.length, cz.length) >= 0.8)))
        out.push({ record: r, kind: 'similar' });
    }
  }
  return out.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'same' ? -1 : 1));
}
/** Another record of the list already has this VAT number? → that record or null. */
export function findVatOwner(list, vat, id = null) {
  const k = normVat(vat); if (!k) return null;
  return (list || []).find(r => r && (id == null || String(r.id) !== String(id)) && normVat(r.vat) === k) || null;
}
/** A record id that can't collide: random (crypto) — the old ids were time + 3 random letters. */
export function newMasterId(prefix = '') {
  const c = globalThis.crypto;
  const rnd = c && typeof c.randomUUID === 'function' ? c.randomUUID().replace(/-/g, '') : (Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2));
  return prefix + rnd.slice(0, 20);
}

class MasterError extends Error { constructor(code, message, details) { super(message); this.code = code; this.details = details; } }
const fail = (code, message, details) => { throw new MasterError(code, message, details); };

/**
 * fs = { db, doc, runTransaction, serverTimestamp? }. options.numberingFor(type) → { counterKey, displayPrefix, digits, floor }.
 * options.format(displayPrefix, n, digits) → code. options.actor() → { uid, name }. options.docIdFor(col, record) → document id.
 */
export function createMasterService(fs, options = {}) {
  const { db, doc, runTransaction } = fs || {};
  if (!db || typeof doc !== 'function' || typeof runTransaction !== 'function') throw new Error('Firestore transaction API required');
  const docIdFor = options.docIdFor || ((col, r) => String(r.id));
  const format = options.format || ((p, n, d) => p + String(n).padStart(d || 4, '0'));
  const actorOf = () => (options.actor && options.actor()) || {};
  const now = options.now || (() => new Date().toISOString());

  /**
   * Saves one master record (new or changed) with its code and VAT claim. → { record, code, assigned }.
   * record must carry its id. The saved record (with code / vatKey) is returned; the caller keeps it in its list.
   */
  async function save(col, record) {
    const t = MASTER_TYPES[col]; if (!t) fail(ERR.INVALID, 'Unknown master list ' + col);
    if (!record || record.id == null) fail(ERR.INVALID, 'Record id required');
    const actor = actorOf();
    const ref = doc(db, col, docIdFor(col, record));
    const vatKey = t.vat ? normVat(record.vat) : '';
    const numbering = needsCode(record) && options.numberingFor ? options.numberingFor(numberingTypeOf(col, record)) : null;
    return runTransaction(db, async tx => {
      const reads = [tx.get(ref)];
      const claimRef = vatKey ? doc(db, VAT_COLLECTION, vatClaimId(col, vatKey)) : null;
      if (claimRef) reads.push(tx.get(claimRef));
      const counterRef = numbering ? doc(db, 'counters', numbering.counterKey) : null;
      if (counterRef) reads.push(tx.get(counterRef));
      const snaps = await Promise.all(reads);
      const cur = snaps[0].exists() ? snaps[0].data() : null;
      const claim = claimRef ? snaps[1] : null;
      const counter = counterRef ? snaps[claimRef ? 2 : 1] : null;
      let takeOver = false;
      if (claim && claim.exists() && String(claim.data().partyId) !== String(record.id)) {
        // the claim still counts only while its record exists, is not in the Recycle Bin and still has this VAT number
        const other = claim.data();
        const ownerSnap = await tx.get(doc(db, col, String(other.partyDoc || other.partyId)));
        const o = ownerSnap.exists() ? ownerSnap.data() : null;
        const holds = o && !o._deletedAt && (o.vatKey || normVat(o.vat)) === vatKey;
        if (holds) fail(ERR.DUPLICATE_VAT, `VAT No. ${record.vat} is already used by ${o[t.nameField] || other.partyName || 'another ' + (col === 'customers' ? 'customer' : 'supplier')}.`, { owner: o[t.nameField] || other.partyName || '', ownerId: other.partyId });
        takeOver = true;
      }
      // an old claim of this record (VAT changed or removed) is released
      const oldKey = cur && t.vat ? (cur.vatKey || normVat(cur.vat)) : '';
      let oldClaimRef = null, oldClaim = null;
      if (oldKey && oldKey !== vatKey) { oldClaimRef = doc(db, VAT_COLLECTION, vatClaimId(col, oldKey)); oldClaim = await tx.get(oldClaimRef); }
      const next = { ...record };
      // a code, once given, is kept (also when the screen sent an older copy without it)
      if (cur && cur.code && !isTempCode(cur.code)) next.code = cur.code;
      let assigned = false;
      if (needsCode(next) && numbering) {
        const seq = Math.max(Number(counter && counter.exists() ? counter.data().value : 0) || 0, Number(numbering.floor) || 0) + 1;
        if (isTempCode(next.code)) next.tempCode = next.code;
        next.code = format(numbering.displayPrefix, seq, numbering.digits);
        tx.set(counterRef, { value: seq, updatedAt: Date.now() });
        assigned = true;
      }
      if (t.vat) next.vatKey = vatKey;
      if (!cur) { next.createdAt = next.createdAt || now(); next.createdBy = next.createdBy || actor.name || ''; next.createdByUid = next.createdByUid || actor.uid || ''; }
      tx.set(ref, JSON.parse(JSON.stringify(next)));
      if (claimRef && (!(claim && claim.exists()) || takeOver)) {
        tx.set(claimRef, { id: vatClaimId(col, vatKey), col, vatKey, partyId: String(record.id), partyDoc: docIdFor(col, record), partyName: String(record[t.nameField] || '').slice(0, 200), createdByUid: actor.uid || '', createdAt: now() });
      } else if (claimRef && claim.exists() && claim.data().partyName !== String(record[t.nameField] || '').slice(0, 200)) {
        tx.update(claimRef, { partyName: String(record[t.nameField] || '').slice(0, 200) });
      }
      if (oldClaimRef && oldClaim && oldClaim.exists() && String(oldClaim.data().partyId) === String(record.id)) tx.delete(oldClaimRef);
      return { record: next, code: next.code, assigned };
    });
  }

  /**
   * Codes for many new records at once (import): ONE transaction reserves the block, in file order. → [codes].
   */
  async function reserveCodes(col, count, kind = null) {
    const t = MASTER_TYPES[col]; if (!t) fail(ERR.INVALID, 'Unknown master list ' + col);
    if (!(count > 0)) return [];
    const numbering = options.numberingFor(numberingTypeOf(col, kind ? { type: kind } : null));
    const counterRef = doc(db, 'counters', numbering.counterKey);
    return runTransaction(db, async tx => {
      const c = await tx.get(counterRef);
      const start = Math.max(Number(c.exists() ? c.data().value : 0) || 0, Number(numbering.floor) || 0);
      tx.set(counterRef, { value: start + count, updatedAt: Date.now() });
      return Array.from({ length: count }, (_, i) => format(numbering.displayPrefix, start + i + 1, numbering.digits));
    });
  }

  /** Releases a deleted record's VAT claim (the record itself is deleted / moved to the Recycle Bin by the caller). */
  async function releaseVat(col, record) {
    const t = MASTER_TYPES[col]; if (!t || !t.vat) return false;
    const key = record && (record.vatKey || normVat(record.vat)); if (!key) return false;
    const ref = doc(db, VAT_COLLECTION, vatClaimId(col, key));
    return runTransaction(db, async tx => {
      const s = await tx.get(ref);
      if (s.exists() && String(s.data().partyId) === String(record.id)) { tx.delete(ref); return true; }
      return false;
    });
  }
  return Object.freeze({ save, reserveCodes, releaseVat });
}
