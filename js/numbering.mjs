/**
 * BizCore V264 — final numbers for documents created offline (RFQ, quotation, Sales Order).
 *
 * finalizeProvisionalNumber runs ONE transaction that reads the document and the period counter:
 * only if the document still carries a provisional number ("…-OFF-…") is the counter advanced and the
 * document updated. Two devices doing this at the same moment therefore can never consume two numbers
 * or produce a duplicate — the second transaction sees the final number and changes nothing.
 */
export const isProvisionalNumber = no => String(no || '').includes('-OFF-');
/** V270.2.5: sequence digits chosen in Settings (3–6, default 4). */
export const sequenceDigits = d => ([3, 4, 5, 6].includes(Number(d)) ? Number(d) : 4);
export const formatSequence = (prefix, n, digits) => prefix + String(n).padStart(sequenceDigits(digits), '0');
/** V270.2.5: highest existing number with the same text in front of the sequence — the next number must be above it. */
export const numberingFloor = numbering => { const f = Number(numbering && numbering.floor); return Number.isInteger(f) && f > 0 ? f : 0; };
/** Next sequence: above the counter and above every existing number that could be repeated. */
export const nextSequence = (counterValue, numbering) => Math.max(Number(counterValue) || 0, numberingFloor(numbering)) + 1;
const defaultFormat = formatSequence;

export function createNumbering({ db, doc, runTransaction }, { format = defaultFormat, now = () => new Date().toISOString() } = {}) {
  async function finalizeProvisionalNumber({ col, id, field, counterKey, displayPrefix, digits, floor }) {
    const docRef = doc(db, col, String(id)), counterRef = doc(db, 'counters', counterKey);
    return runTransaction(db, async tx => {
      const d = await tx.get(docRef);
      const c = await tx.get(counterRef);
      if (!d.exists()) return { status: 'missing' };
      const cur = d.data()[field];
      if (!isProvisionalNumber(cur)) return { status: 'already', number: cur };
      const next = nextSequence(c.exists() ? c.data().value : 0, { floor });
      const number = format(displayPrefix, next, digits);
      tx.set(counterRef, { value: next, updatedAt: Date.now() });
      tx.update(docRef, { [field]: number, provisionalNumber: cur, numberFinalizedAt: now() });
      return { status: 'numbered', number, previous: cur };
    });
  }
  return { finalizeProvisionalNumber };
}
