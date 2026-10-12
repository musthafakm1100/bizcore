/**
 * BizCore V264 — final numbers for documents created offline (RFQ, quotation, Sales Order).
 *
 * finalizeProvisionalNumber runs ONE transaction that reads the document and the period counter:
 * only if the document still carries a provisional number ("…-OFF-…") is the counter advanced and the
 * document updated. Two devices doing this at the same moment therefore can never consume two numbers
 * or produce a duplicate — the second transaction sees the final number and changes nothing.
 */
export const isProvisionalNumber = no => String(no || '').includes('-OFF-');
const defaultFormat = (prefix, n) => prefix + String(n).padStart(4, '0');

export function createNumbering({ db, doc, runTransaction }, { format = defaultFormat, now = () => new Date().toISOString() } = {}) {
  async function finalizeProvisionalNumber({ col, id, field, counterKey, displayPrefix }) {
    const docRef = doc(db, col, String(id)), counterRef = doc(db, 'counters', counterKey);
    return runTransaction(db, async tx => {
      const d = await tx.get(docRef);
      const c = await tx.get(counterRef);
      if (!d.exists()) return { status: 'missing' };
      const cur = d.data()[field];
      if (!isProvisionalNumber(cur)) return { status: 'already', number: cur };
      const next = (c.exists() ? Number(c.data().value || 0) : 0) + 1;
      const number = format(displayPrefix, next);
      tx.set(counterRef, { value: next, updatedAt: Date.now() });
      tx.update(docRef, { [field]: number, provisionalNumber: cur, numberFinalizedAt: now() });
      return { status: 'numbered', number, previous: cur };
    });
  }
  return { finalizeProvisionalNumber };
}
