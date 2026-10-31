/* BizCore V270.4.11 (Package B, Step B2a) — linking quotation / sales order lines to the Item Master.
 *
 * Agreed 31 Oct (mockups PB_2, PB_3, PB_4):
 *  - a priced line is "linked" when it carries the product id (prodId). The line text keeps the customer's wording and
 *    is printed as written; the link works in the background (one price history per item, whatever the wording).
 *  - Mark as Sent = a reminder ("Link items before sending?" — or Send anyway). Create Sales Order = required for the
 *    lines going into the order. Contracting scope lines stay free text.
 *  - Customer wording memory: per customer, wording → item, suggested next time. Kept on the customer record
 *    (customers/{id}.wordings, one small entry per wording) — the customers are already loaded, so no extra reads.
 */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const prods = () => (typeof products !== 'undefined' && Array.isArray(products) ? products : []);
  const custs = () => (typeof customers !== 'undefined' && Array.isArray(customers) ? customers : []);

  /** Wording as compared: lower case, letters / digits only, numbers kept apart ("2inch" → "2 inch"). */
  function norm(t) {
    return String(t == null ? '' : t).toLowerCase().normalize('NFKC').replace(/["”″]/g, ' inch ').replace(/['’′]/g, ' ')
      .replace(/(\d)([a-z])/g, '$1 $2').replace(/([a-z])(\d)/g, '$1 $2').replace(/[^\p{L}\p{N}.]+/gu, ' ').replace(/\s+/g, ' ').trim();
  }
  const STOP = new Set(['the', 'and', 'of', 'for', 'with', 'per', 'a', 'an', 'to', 'in', 'x', 'pcs', 'pc', 'no', 'nos']);
  const toks = t => norm(t).split(' ').filter(w => w && !STOP.has(w));
  /** A short key for the memory map (Firestore map keys stay simple). */
  function keyOf(t) { const s = norm(t); let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return 'w' + h.toString(36) + s.length.toString(36); }

  /** The item this customer's wording was linked to before: the stored memory, else a loaded quotation / order. */
  function memoryOf(custId, text) {
    const n = norm(text); if (!n) return null;
    const c = custs().find(x => String(x.id) === String(custId || ''));
    const m = c && c.wordings && c.wordings[keyOf(text)];
    const live = id => prods().find(p => String(p.id) === String(id) && !p._deletedAt);
    if (m && live(m.p)) return { product: live(m.p), at: m.at || '', from: m.doc || '' };
    if (!custId) return null;
    const mineQ = (typeof quotations !== 'undefined' ? quotations : []).filter(q => String(q.custId || '') === String(custId));
    const mineS = (typeof salesOrders !== 'undefined' ? salesOrders : []).filter(o => String(o.custId || '') === String(custId));
    for (const d of [...mineS, ...mineQ].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))) {
      const it = (d.items || []).find(x => x && x.prodId && norm(x.desc) === n && live(x.prodId));
      if (it) return { product: live(it.prodId), at: d.date || '', from: d.soNo || d.qno || '' };
    }
    return null;
  }
  /** Closest items for a wording → [{ product, score, memory }] (memory first). */
  function matches(text, custId, limit = 5) {
    const out = [], mem = memoryOf(custId, text), t = toks(text);
    if (mem) out.push({ product: mem.product, score: 2, memory: mem });
    const words = t.filter(w => !/\d/.test(w) && w.length > 1), nums = t.filter(w => /\d/.test(w));
    if (words.length) {
      prods().filter(p => !p._deletedAt && (!mem || p.id !== mem.product.id)).forEach(p => {
        const pt = new Set(toks([p.name, p.brand, p.model, p.code].filter(Boolean).join(' ')));
        const has = w => pt.has(w) || [...pt].some(x => x.length > 3 && w.length > 3 && (x.startsWith(w) || w.startsWith(x)));
        const hit = words.filter(has).length; if (!hit) return;   // at least one real word in common — numbers alone never match
        let score = hit / words.length;
        if (nums.length) score *= nums.every(w => pt.has(w)) ? 1 : 0.7;   // other sizes / numbers rank lower
        if (score >= 0.34) out.push({ product: p, score });
      });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, limit);
  }
  /** Remember: this customer's wording → this item (one small write, merged into the customer record). */
  async function remember(custId, text, productId, docNo) {
    if (!custId || !productId || !norm(text)) return;
    const c = custs().find(x => String(x.id) === String(custId)); if (!c) return;
    const k = keyOf(text), cur = c.wordings && c.wordings[k];
    if (cur && cur.p === productId) return;
    const entry = { t: String(text).slice(0, 200), p: productId, at: new Date().toISOString(), doc: docNo || '' };
    c.wordings = { ...(c.wordings || {}), [k]: entry };
    try { if (window.FB && window.FB.fbMergeFields) await window.FB.fbMergeFields('customers', c.id, { wordings: c.wordings }); } catch (_) {}   // the whole (small) list: correct with any merge
  }

  /* ───────── the link window (PB_3 per line; also used from a quotation line and the Sales Order screen) ───────── */
  let overlay = null;
  function shell() {
    if (overlay) return overlay;
    overlay = document.createElement('div'); overlay.id = 'bc-link-overlay'; overlay.className = 'bcl-overlay'; overlay.hidden = true;
    overlay.innerHTML = '<div class="bcl-win" role="dialog" aria-modal="true" aria-labelledby="bcl-title"><div class="bcl-head"><h3 id="bcl-title"></h3><button type="button" class="bcl-x" aria-label="Close">✕</button></div><div class="bcl-body"></div><div class="bcl-foot"></div></div>';
    document.body.appendChild(overlay);
    return overlay;
  }
  function productLabel(p) { return `${p.code ? `<span class="bcm-code">${esc(p.code)}</span> ` : ''}${esc(p.name)}${p.type === 'service' ? ' <span class="bcm-type svc">Service</span>' : ''}`; }
  function lastSoldTo(custId, p) {
    const so = (typeof salesOrders !== 'undefined' ? salesOrders : []).filter(o => String(o.custId || '') === String(custId || '')).sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    for (const o of so) { const it = (o.items || []).find(x => x && String(x.prodId || '') === String(p.id)); if (it) return `Last sold to this customer ${typeof fmtDate === 'function' ? fmtDate(o.date) : o.date} · ${Number(it.up || 0).toFixed(2)} / ${esc(it.uom || p.uom || '')}`; }
    return '';
  }
  /** One line's choices: suggestions, search, + New Product, make it a note. → HTML; wire with wireLine(). */
  function lineBlock(L, i, custId) {
    const sug = matches(L.text, custId, 4);
    L._choice = L.prodId || (sug[0] && sug[0].score >= 0.6 ? sug[0].product.id : '');
    const opt = s => `<label class="bcl-opt${L._choice === s.product.id ? ' sel' : ''}"><input type="radio" name="bcl-${i}" value="${esc(s.product.id)}"${L._choice === s.product.id ? ' checked' : ''}><span class="bcl-n">${productLabel(s.product)}<small>${s.memory ? `Linked for this customer before${s.memory.from ? ' (' + esc(s.memory.from) + ')' : ''}` : esc(lastSoldTo(custId, s.product) || [s.product.brand, s.product.uom].filter(Boolean).join(' · '))}</small></span>${s.memory ? '<span class="bcl-tag">customer wording</span>' : s === sug[0] && s.score >= 0.6 ? '<span class="bcl-tag g">best match</span>' : ''}</label>`;
    return `<div class="bcl-line" data-i="${i}"><div class="bcl-lh"><span class="bcl-dot ${L.prodId ? 'g' : 'o'}"></span><b>${esc(L.label || 'Line ' + (i + 1))}</b> <span class="bcl-text">${esc(L.text)}</span><span style="flex:1"></span><span class="bcl-pill ${L.prodId ? 'g' : 'o'}">${L.prodId ? 'Linked' : 'Not linked'}</span></div>
      <div class="bcl-lb">${sug.length ? '<div class="bcl-sub">Closest matches</div>' + sug.map(opt).join('') : '<div class="bcl-sub">No close match in the Item Master.</div>'}
      <div class="bcl-search" hidden><input type="search" placeholder="Search items by name, brand, code…" aria-label="Search items"><div class="bcl-res"></div></div>
      <div class="bcl-acts"><button type="button" class="btn btn-secondary btn-sm" data-a="search"><i class="ti ti-search"></i>Search items…</button><button type="button" class="btn btn-secondary btn-sm" data-a="new"><i class="ti ti-plus"></i>New Product</button>${L.makeNote ? '<button type="button" class="btn btn-secondary btn-sm" data-a="note"><i class="ti ti-notes"></i>Make it a note line</button>' : ''}</div></div></div>`;
  }
  function wireLine(root, L, refresh) {
    const box = root.querySelector('.bcl-search'), inp = box.querySelector('input'), res = box.querySelector('.bcl-res');
    root.querySelectorAll('input[type=radio]').forEach(r => r.onchange = () => { L._choice = r.value; L._note = false; root.querySelectorAll('.bcl-opt').forEach(o => o.classList.toggle('sel', o.querySelector('input').checked)); });
    const search = () => {
      const q = toks(inp.value);
      const hits = q.length ? prods().filter(p => !p._deletedAt && q.every(w => norm([p.name, p.brand, p.model, p.code].join(' ')).includes(w))).slice(0, 8) : [];
      res.innerHTML = hits.length ? hits.map(p => `<button type="button" class="bcl-hit" data-id="${esc(p.id)}">${productLabel(p)}<small>${esc([p.brand, p.uom].filter(Boolean).join(' · '))}</small></button>`).join('') : (q.length ? '<div class="bcl-sub">Nothing found — use + New Product.</div>' : '');
      res.querySelectorAll('.bcl-hit').forEach(b => b.onclick = () => { L._choice = b.dataset.id; L._note = false; refresh(); });
    };
    inp.oninput = search;
    root.querySelector('[data-a=search]').onclick = () => { box.hidden = !box.hidden; if (!box.hidden) { inp.value = L.text; search(); inp.focus(); inp.select(); } };
    root.querySelector('[data-a=new]').onclick = () => newProduct(L, refresh);
    const nb = root.querySelector('[data-a=note]'); if (nb) nb.onclick = () => { L._note = !L._note; L._choice = ''; root.classList.toggle('as-note', L._note); nb.classList.toggle('on', L._note); root.querySelectorAll('input[type=radio]').forEach(r => { r.checked = false; }); root.querySelectorAll('.bcl-opt').forEach(o => o.classList.remove('sel')); };
  }
  /** + New Product from the link window: the product form opens with the line text; once saved it is chosen. */
  function newProduct(L, refresh) {
    const ov = shell(); ov.hidden = true;
    window._bcLinkNewProduct = p => { window._bcLinkNewProduct = null; L._choice = p.id; L._note = false; ov.hidden = false; refresh(); };
    if (typeof openAddProduct === 'function') openAddProduct();
    const n = document.getElementById('pm-name'); if (n) { n.value = L.text; n.dispatchEvent(new Event('input', { bubbles: true })); }
    const u = document.getElementById('pm-uom'); if (u && L.uom && [...u.options].some(o => o.value === L.uom)) u.value = L.uom;
    const pm = document.getElementById('prod-modal');
    const mo = new MutationObserver(() => { if (!pm.classList.contains('open')) { mo.disconnect(); setTimeout(() => { if (window._bcLinkNewProduct) { window._bcLinkNewProduct = null; ov.hidden = false; } }, 50); } });
    mo.observe(pm, { attributes: true, attributeFilter: ['class'] });
  }
  /**
   * The window. lines: [{ text, uom, prodId, label, makeNote?: bool }]. mode: 'sent' (reminder, Send anyway) or 'link'
   * (one line: Link / Cancel). → Promise<{ action: 'link'|'anyway'|null, lines }> — each line gets ._choice (id) / ._note.
   */
  function open({ title, intro, lines, custId, mode }) {
    return new Promise(resolve => {
      const ov = shell();
      ov.querySelector('#bcl-title').textContent = title;
      const body = ov.querySelector('.bcl-body'), foot = ov.querySelector('.bcl-foot');
      const render = () => {
        body.innerHTML = (intro ? `<div class="bcl-intro">${intro}</div>` : '') + lines.map((L, i) => lineBlock(L, i, custId)).join('');
        body.querySelectorAll('.bcl-line').forEach(el => wireLine(el, lines[+el.dataset.i], () => { const keep = lines.map(l => l._choice); render(); lines.forEach((l, j) => { if (keep[j]) { l._choice = keep[j]; const r = body.querySelector(`.bcl-line[data-i="${j}"] input[value="${CSS.escape(keep[j])}"]`); if (r) { r.checked = true; r.closest('.bcl-opt').classList.add('sel'); } else extraChoice(j, keep[j]); } }); }));
      };
      const extraChoice = (j, id) => {   // chosen from search / new product: shown as the selected option
        const p = prods().find(x => x.id === id); if (!p) return;
        const lb = body.querySelector(`.bcl-line[data-i="${j}"] .bcl-lb`);
        lb.insertAdjacentHTML('afterbegin', `<label class="bcl-opt sel"><input type="radio" name="bcl-${j}" value="${esc(id)}" checked><span class="bcl-n">${productLabel(p)}<small>Chosen</small></span></label>`);
        lb.querySelector('input').onchange = () => { lines[j]._choice = id; };
      };
      render();
      const done = action => { ov.hidden = true; document.removeEventListener('keydown', onKey, true); resolve({ action, lines }); };
      const onKey = e => { if (e.key === 'Escape' && !ov.hidden) { e.preventDefault(); e.stopPropagation(); done(null); } };
      document.addEventListener('keydown', onKey, true);
      ov.querySelector('.bcl-x').onclick = () => done(null);
      foot.innerHTML = mode === 'sent'
        ? '<button type="button" class="btn btn-secondary" data-f="back">Back</button><button type="button" class="btn bcl-anyway" data-f="anyway">Send anyway</button><button type="button" class="btn btn-success" data-f="link"><i class="ti ti-link"></i>Link &amp; mark as Sent</button>'
        : '<button type="button" class="btn btn-secondary" data-f="back">Cancel</button><button type="button" class="btn btn-primary" data-f="link"><i class="ti ti-link"></i>Link</button>';
      foot.querySelector('[data-f=back]').onclick = () => done(null);
      const any = foot.querySelector('[data-f=anyway]'); if (any) any.onclick = () => done('anyway');
      foot.querySelector('[data-f=link]').onclick = () => {
        if (mode !== 'sent' && !lines.some(l => l._choice || l._note)) { if (typeof showToast === 'function') showToast('Choose an item, or search for one', 'warning'); return; }
        done('link');
      };
      ov.hidden = false;
      setTimeout(() => ov.querySelector('.bcl-foot [data-f=link]')?.focus(), 30);
    });
  }
  window.BCItemLink = { norm, keyOf, matches, memoryOf, remember, open, productLabel };
})();
