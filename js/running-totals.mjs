/**
 * BizCore V269.3 — data plan step 2b: records kept up to date in the SAME commit as the documents they summarise,
 * so screens don't need to load every old document.
 *
 *   cashBalances/{accountId}   the running sums of an account's cash lines (movements; the opening balance stays on
 *                              the account): balance (every line that is not cancelled) and confirmedBalance (lines
 *                              that are confirmed or need no confirmation). The Cash & Bank screens start from it and
 *                              show the recent lines; older lines are read on request.
 *   itemLastPrices/{itemKey}   the last price paid for an item (newest posted purchase invoice), so "Last paid" never
 *                              depends on how many invoices are loaded.
 *
 * How: wrapTransaction(fs, options) returns a runTransaction(db, fn) with the same behaviour, handed to the ledger and
 * purchase services instead of the plain one. The function's writes are held back; when it finishes, the wrapper
 * reads what it needs (cash lines written without being read, the last-price records — all still reads before
 * writes), works out the changes, and sends the held writes followed by the record updates in the same commit.
 * The balance records are changed with increment() (never read), and are complete once rebuilt (rebuiltAt).
 * The services themselves are unchanged.
 */
export const BALANCE_COLLECTION = 'cashBalances';
export const LAST_PRICE_COLLECTION = 'itemLastPrices';
const LINES = 'cashLines', INVOICES = 'purchaseInvoices';
const r2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/** What one cash line adds to its account (a cancelled line adds nothing). */
export function lineEffect(l) {
  if (!l || l.void) return { net: 0, confirmed: 0 };
  const net = r2((Number(l.amountIn) || 0) - (Number(l.amountOut) || 0));
  return { net, confirmed: l.status === 'confirmed' || l.status === 'none' ? net : 0 };
}
/** Sums of a list of cash lines → { balance, confirmedBalance, lineCount }. */
export function sumLines(lines) {
  let balance = 0, confirmedBalance = 0;
  for (const l of lines || []) { const e = lineEffect(l); balance = r2(balance + e.net); confirmedBalance = r2(confirmedBalance + e.confirmed); }
  return { balance, confirmedBalance, lineCount: (lines || []).length };
}
/** The last-price candidate of an invoice for one item (null when it doesn't count). */
export function lastPriceOf(pi, itemKey) {
  if (!pi || pi.status === 'Voided') return null;
  const best = (pi.lines || []).find(l => l && l.itemKey === itemKey && Number(l.unitCost) > 0);   // the first such line, as lastPaidOf
  return best ? { itemKey, unitCost: Number(best.unitCost), piId: pi.id, piNo: pi.piNo || '', date: pi.date || '', supplierName: pi.supplierName || '', uom: best.uom || '' } : null;
}
const sortKey = r => String((r && r.date) || '') + '|' + String((r && r.piNo) || '');

const pathOf = ref => String((ref && ref.path) || '');
const colOf = ref => pathOf(ref).split('/')[0];
const isDoc = (ref, col) => { const p = pathOf(ref).split('/'); return p.length === 2 && p[0] === col; };
const merged = (before, op) => op.k === 'delete' ? null : op.k === 'update' ? { ...(before || {}), ...op.data } : (op.opts && op.opts.merge ? { ...(before || {}), ...op.data } : { ...op.data });

export function wrapTransaction(fs, options = {}) {
  const { db, doc, runTransaction } = fs;
  if (options.cash !== false && typeof fs.increment !== 'function') throw new Error('wrapTransaction needs fs.increment');
  const stamp = () => (typeof fs.serverTimestamp === 'function' ? fs.serverTimestamp() : new Date().toISOString());
  const uidOf = () => (options.uid && options.uid()) || '';
  const keep = { cash: options.cash !== false, prices: options.prices !== false };
  return function wrappedRunTransaction(database, fn, txOptions) {
    return runTransaction(database || db, async tx => {
      const reads = new Map(), ops = [];
      const proxy = {
        async get(ref) { const s = await tx.get(ref); reads.set(pathOf(ref), { ref, data: s.exists() ? s.data() : null }); return s; },
        set(ref, data, opts) { ops.push({ k: 'set', ref, data, opts }); return proxy; },
        update(ref, data) { ops.push({ k: 'update', ref, data }); return proxy; },
        delete(ref) { ops.push({ k: 'delete', ref }); return proxy; },
      };
      const result = await fn(proxy);
      const extra = [];
      /* ── cash lines → cashBalances ── */
      // only changes that can move a balance (a note on the other side of a handover can't — and a custodian may not read that line)
      const EFFECT = ['amountIn', 'amountOut', 'status', 'void', 'accountId'];
      const counts = o => isDoc(o.ref, LINES) && (o.k !== 'update' || Object.keys(o.data || {}).some(k => EFFECT.includes(k)));
      const linePaths = keep.cash ? [...new Set(ops.filter(counts).map(o => pathOf(o.ref)))] : [];
      if (linePaths.length) {
        const before = new Map();
        for (const p of linePaths) {
          if (reads.has(p)) { before.set(p, reads.get(p).data); continue; }
          const ref = ops.find(o => pathOf(o.ref) === p).ref;
          const s = await tx.get(ref); before.set(p, s.exists() ? s.data() : null);
        }
        const after = new Map(before);
        for (const o of ops) if (isDoc(o.ref, LINES) && after.has(pathOf(o.ref))) after.set(pathOf(o.ref), merged(after.get(pathOf(o.ref)), o));
        const byAcc = new Map();
        for (const p of linePaths) {
          const b = before.get(p), a = after.get(p);
          const eb = lineEffect(b), ea = lineEffect(a);
          const acc = String((a && a.accountId) || (b && b.accountId) || '');
          if (!acc) continue;
          const d = byAcc.get(acc) || { net: 0, confirmed: 0, created: 0, lastLineId: '' };
          d.net = r2(d.net + ea.net - eb.net); d.confirmed = r2(d.confirmed + ea.confirmed - eb.confirmed);
          if (!b && a) d.created++;
          d.lastLineId = p.split('/')[1];
          byAcc.set(acc, d);
        }
        // added with increment(): the record is never read here, so a custodian handing cash to another account
        // doesn't need to see that account's balance. A record that is new or was never rebuilt gets its older
        // lines from rebuildBalance (BizCore does that when it opens — see index.html).
        const inc = fs.increment;
        for (const [acc, d] of byAcc) {
          if (!d.net && !d.confirmed && !d.created) continue;   // nothing moves (e.g. only the description changed)
          extra.push([doc(db, BALANCE_COLLECTION, acc), {
            accountId: acc, balance: inc(d.net), confirmedBalance: inc(d.confirmed), lineCount: inc(d.created), revision: inc(1),
            lastLineId: d.lastLineId, updatedAt: stamp(), updatedByUid: uidOf(),
          }, { merge: true }]);
        }
      }
      /* ── purchase invoices → itemLastPrices ── */
      const piOps = keep.prices ? ops.filter(o => isDoc(o.ref, INVOICES)) : [];
      if (piOps.length) {
        const paths = [...new Set(piOps.map(o => pathOf(o.ref)))];
        for (const p of paths) {
          let pi = reads.has(p) ? reads.get(p).data : null;
          const before = pi;
          for (const o of piOps) if (pathOf(o.ref) === p) pi = merged(pi, o);
          if (!pi) continue;
          // only invoice changes that can move a price: new, lines changed, cancelled
          const linesChanged = !before || JSON.stringify(before.lines || []) !== JSON.stringify(pi.lines || []) || before.status !== pi.status || before.date !== pi.date;
          if (!linesChanged) continue;
          const keys = [...new Set([...(pi.lines || []), ...((before && before.lines) || [])].map(l => l && l.itemKey).filter(Boolean))];
          for (const key of keys) {
            const lref = doc(db, LAST_PRICE_COLLECTION, key);
            const ls = await tx.get(lref);
            const cur = ls.exists() ? ls.data() : null;
            const cand = lastPriceOf(pi, key);
            let next = null;
            if (cand && (!cur || cur.piId === pi.id || sortKey(cand) >= sortKey(cur))) next = { ...cand, stale: false };
            else if (!cand && cur && cur.piId === pi.id) next = { ...cur, stale: true };   // that invoice no longer has this price: look it up again when needed
            if (next) extra.push([lref, { ...next, lastEventId: String(pi.lastEventId || ''), revision: (cur ? Number(cur.revision) || 0 : 0) + 1, updatedAt: stamp(), updatedByUid: uidOf() }]);
          }
        }
      }
      for (const o of ops) {
        if (o.k === 'set') o.opts ? tx.set(o.ref, o.data, o.opts) : tx.set(o.ref, o.data);
        else if (o.k === 'update') tx.update(o.ref, o.data);
        else tx.delete(o.ref);
      }
      for (const [ref, data, opts] of extra) opts ? tx.set(ref, data, opts) : tx.set(ref, data);
      return result;
    }, txOptions);
  };
}

/**
 * Rebuild one account's balance from all its lines (when the record is missing or was never rebuilt — rebuiltAt).
 * fs: { db, doc, getDocs, query, where, collection, runTransaction, serverTimestamp }
 */
export async function rebuildBalance(fs, accountId, uid) {
  const { db, doc, getDocs, query, where, collection, runTransaction } = fs;
  const ref = doc(db, BALANCE_COLLECTION, String(accountId));
  for (let attempt = 0; attempt < 4; attempt++) {
    // the revision before the lines are read: if a line is posted meanwhile, the record moved — read again
    const rev0 = await runTransaction(db, async tx => { const s = await tx.get(ref); return s.exists() ? Number(s.data().revision) || 0 : 0; });
    const snap = await getDocs(query(collection(db, LINES), where('accountId', '==', String(accountId))));
    const lines = []; snap.forEach(d => lines.push(d.data()));
    const sums = sumLines(lines);
    const rec = await runTransaction(db, async tx => {
      const s = await tx.get(ref);
      const prev = s.exists() ? s.data() : null;
      if ((prev ? Number(prev.revision) || 0 : 0) !== rev0) return null;
      const at = typeof fs.serverTimestamp === 'function' ? fs.serverTimestamp() : new Date().toISOString();
      const out = { accountId: String(accountId), ...sums, revision: rev0 + 1, lastLineId: '', updatedAt: at, rebuiltAt: at, updatedByUid: uid };
      tx.set(ref, out);
      return out;
    });
    if (rec) return rec;
  }
  throw new Error('The balance kept changing while it was rebuilt — try again.');
}
