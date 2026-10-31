/* BizCore V270.4.9 — master record forms: code, duplicate notices, VAT block, rename (agreed 30–31 Oct, mockup IM_4).
 *
 *  - Code: shown read-only (CUS-00001 …); a new record shows "Given on save". Codes are made by js/master-service.mjs.
 *  - Same / similar name (capitals, spaces, dots and words like "Co." / "LLC" ignored): an amber notice under the name with
 *    "Open it" and "It's a different …". Saving with an unanswered notice asks once more. Names are never blocked.
 *  - VAT No. already used by another customer (supplier): red message, Save refused (also checked by the database).
 *  - Renaming a record already used in documents, or changing a used customer's VAT No.: a confirmation (issued documents
 *    keep the old name); the change is kept in the record's history.
 */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const core = () => (window.BizCoreMasters && window.BizCoreMasters.core) || null;
  const forms = {};   // col → config
  const ack = {};     // col → normalized name the user said is a different record

  function noteEl(input, cls) {
    const group = input.closest('.form-group') || input.parentElement;
    let n = group.querySelector(':scope > .' + cls);
    if (!n) { n = document.createElement('div'); n.className = cls; group.appendChild(n); }
    return n;
  }
  function codeChip(cfg) {
    const head = document.querySelector(cfg.titleSel);
    if (!head) return;
    // V270.4.10: the header may be re-wrapped after the first paint (title wrap) — look in the whole header, keep one chip
    const box = head.closest('.modal-header, .modal, header') || head.parentElement;
    const all = [...box.querySelectorAll('.bcm-code')]; all.slice(1).forEach(x => x.remove());
    let chip = all[0];
    if (!chip) { chip = document.createElement('span'); chip.className = 'bcm-code'; head.insertAdjacentElement('afterend', chip); }
    else if (chip.previousElementSibling !== head) head.insertAdjacentElement('afterend', chip);
    const r = cfg.current();
    chip.textContent = r && r.code ? r.code : 'Code given on save';
    chip.classList.toggle('bcm-code-new', !(r && r.code));
    chip.title = 'System code — given by BizCore, never changes';
  }
  function similarFor(cfg) {
    const C = core(), input = document.getElementById(cfg.nameId); if (!C || !input) return [];
    return C.findSimilar(cfg.list(), input.value, { nameField: cfg.nameField, id: cfg.getId(), products: cfg.col === 'products' });
  }
  function vatOwnerFor(cfg) {
    const C = core(), input = cfg.vatId && document.getElementById(cfg.vatId); if (!C || !input) return null;
    return C.findVatOwner(cfg.list(), input.value, cfg.getId());
  }
  function paintName(cfg) {
    const input = document.getElementById(cfg.nameId); if (!input) return;
    const n = noteEl(input, 'bcm-name-note'), C = core();
    const hits = similarFor(cfg), key = C ? C.normName(input.value) : '';
    if (!hits.length || ack[cfg.col] === key) { n.hidden = true; n.innerHTML = ''; return; }
    const h = hits[0].record, more = hits.length > 1 ? ` <span class="bcm-more">and ${hits.length - 1} more</span>` : '';
    const what = hits[0].kind === 'same' ? `A ${cfg.label} with this name already exists` : `A similar ${cfg.label} already exists`;
    const meta = cfg.meta ? cfg.meta(h) : '';
    n.hidden = false;
    n.innerHTML = `<i class="ti ti-alert-triangle" aria-hidden="true"></i><span>${what}: <b>${esc(h[cfg.nameField])}</b>${h.code ? ` <span class="bcm-c">${esc(h.code)}</span>` : ''}${meta ? ` (${esc(meta)})` : ''}${more}`
      + `<button type="button" class="bcm-link" data-act="open">Open it</button><button type="button" class="bcm-link" data-act="different">It's a different ${cfg.label}</button></span>`;
    n.querySelector('[data-act="open"]').onclick = () => { if (cfg.open) cfg.open(h.id); };
    n.querySelector('[data-act="different"]').onclick = () => { ack[cfg.col] = key; paintName(cfg); };
  }
  function paintVat(cfg) {
    if (!cfg.vatId) return;
    const input = document.getElementById(cfg.vatId); if (!input) return;
    const n = noteEl(input, 'bcm-vat-err'), o = vatOwnerFor(cfg);
    input.classList.toggle('bcm-invalid', !!o);
    n.hidden = !o;
    n.innerHTML = o ? `Already used by <b>${esc(o[cfg.nameField])}</b>${o.code ? ' (' + esc(o.code) + ')' : ''} — a VAT number can belong to one ${cfg.label} only.` : '';
  }
  function refresh(col) {
    const cfg = forms[col]; if (!cfg) return;
    ack[col] = null;
    codeChip(cfg); paintName(cfg); paintVat(cfg);
  }
  function bind(cfg) {
    forms[cfg.col] = cfg;
    const name = document.getElementById(cfg.nameId), vat = cfg.vatId && document.getElementById(cfg.vatId);
    let t = 0;
    if (name && !name._bcm) { name._bcm = 1; name.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => paintName(cfg), 200); }); name.addEventListener('blur', () => paintName(cfg)); }
    if (vat && !vat._bcm) { vat._bcm = 1; vat.addEventListener('input', () => paintVat(cfg)); }
    // repaint whenever the form opens (the open functions fill the fields first)
    const box = document.getElementById(cfg.boxId);
    if (box && !box._bcm) {
      box._bcm = 1;
      new MutationObserver(() => {
        const open = cfg.boxId === 'employee-form-panel' ? box.style.display !== 'none' : box.classList.contains('open');
        if (open && !box._bcmOpen) { box._bcmOpen = true; setTimeout(() => refresh(cfg.col), 0); }
        if (!open) box._bcmOpen = false;
      }).observe(box, { attributes: true, attributeFilter: ['class', 'style'] });
    }
  }
  const confirmP = opts => new Promise(res => (typeof showConfirm === 'function' ? showConfirm({ ...opts, onConfirm: () => res(true), onCancel: () => res(false) }) : res(window.confirm(opts.title))));

  /**
   * Checks before a save. prev = the record as it was (null when new), next = the record to save.
   * → { ok, log } — log: history entries to add to the record (rename / VAT change). ok false = don't save.
   */
  async function beforeSave(col, prev, next) {
    const cfg = forms[col], C = core(); if (!cfg || !C) return { ok: true, log: [] };
    const nameOf = r => String((r && r[cfg.nameField]) || '').trim();
    // 1. VAT No. of another record → refused
    if (cfg.vatId) {
      const o = C.findVatOwner(cfg.list(), next.vat, next.id);
      if (o) {
        if (typeof showValidationDialog === 'function') showValidationDialog('VAT No. already used', `VAT No. ${next.vat} already belongs to ${o[cfg.nameField]}${o.code ? ' (' + o.code + ')' : ''}. A VAT number can belong to one ${cfg.label} only.`, cfg.vatId, 'Already used');
        paintVat(cfg); return { ok: false, log: [] };
      }
    }
    // 2. same / similar name not answered yet → ask
    const nameChanged = !prev || C.normName(nameOf(prev)) !== C.normName(nameOf(next));
    if (nameChanged) {
      const hits = C.findSimilar(cfg.list(), nameOf(next), { nameField: cfg.nameField, id: next.id, products: col === 'products' });
      if (hits.length && ack[col] !== C.normName(nameOf(next))) {
        const h = hits[0].record;
        const ok = await confirmP({ icon: '⚠️', title: hits[0].kind === 'same' ? `A ${cfg.label} with this name already exists` : `A similar ${cfg.label} already exists`,
          message: `<b>${esc(h[cfg.nameField])}</b>${h.code ? ' (' + esc(h.code) + ')' : ''} is already in BizCore. Save <b>${esc(nameOf(next))}</b> as a separate ${cfg.label}?`,
          confirmText: `Save as a different ${cfg.label}`, cancelText: 'Go back' });
        if (!ok) { paintName(cfg); return { ok: false, log: [] }; }
        ack[col] = C.normName(nameOf(next));
      }
    }
    // 3. a used record renamed / its VAT No. changed → confirmation; V270.4.10: EVERY changed field goes in its history
    const who = (window.currentUser && window.currentUser.name) || '', at = new Date().toISOString();
    const log = prev ? diffLog(prev, next, at, who) : [];
    const vatChanged = cfg.vatId && prev && C.normVat(prev.vat) !== C.normVat(next.vat);
    const renamed = prev && nameOf(prev) && nameOf(prev) !== nameOf(next);
    if (prev && (renamed || vatChanged) && cfg.usage) {
      const n = cfg.usage(prev);
      if (n > 0) {
        const parts = [];
        if (renamed) parts.push(`renamed from <b>${esc(nameOf(prev))}</b> to <b>${esc(nameOf(next))}</b>`);
        if (vatChanged) parts.push(`VAT No. changed from <b>${esc(prev.vat || '—')}</b> to <b>${esc(next.vat || '—')}</b>`);
        const ok = await confirmP({ icon: '✏️', title: `Change a ${cfg.label} that is in use?`,
          message: `${esc(nameOf(prev))} is used in <b>${n}</b> document${n === 1 ? '' : 's'}. It will be ${parts.join(' and ')}.<br><br>Issued documents keep the ${vatChanged && parts.length === 1 ? 'old VAT No.' : 'old details'}; new documents use the new ones. The change is kept in the ${cfg.label}'s history.`,
          confirmText: 'Save the change', cancelText: 'Go back' });
        if (!ok) return { ok: false, log: [] };
      }
    }
    // 4. V270.4.10: a used product's unit — refused while it has stock, otherwise asked first
    if (prev && cfg.unitCheck && String(prev.uom || '') !== String(next.uom || '')) {
      const u = cfg.unitCheck(prev);
      if (u.stock > 0) { if (typeof showValidationDialog === 'function') showValidationDialog('Unit can\u2019t change', `${nameOf(prev)} has ${u.stock} ${prev.uom} in stock. Changing the unit would make the stock quantities wrong — keep ${prev.uom}, or add a new product with the other unit.`, 'pm-uom', 'In stock'); return { ok: false, log: [] }; }
      if (u.docs > 0) {
        const ok = await confirmP({ icon: '⚠️', title: 'Change the unit of a product in use?', message: `${esc(nameOf(prev))} is used in <b>${u.docs}</b> document${u.docs === 1 ? '' : 's'} with unit <b>${esc(prev.uom)}</b>. Issued documents keep ${esc(prev.uom)}; new documents use <b>${esc(next.uom)}</b>.`, confirmText: 'Change the unit', cancelText: 'Go back' });
        if (!ok) return { ok: false, log: [] };
      }
    }
    return { ok: true, log };
  }
  /** V270.4.10: what changed between two versions of a record → history entries (who, when, field, old → new). */
  const SKIP = new Set(['id', 'code', 'vatKey', 'tempCode', 'changeLog', 'createdAt', 'createdBy', 'createdByUid', 'updatedAt', 'updatedBy', 'updatedByUid', 'importedAt', 'imagePath', 'wordings', 'revision', '_deletedAt', '_deletedBy', '_rev', 'oldCode']);
  const COMPLEX = { image: 'image', specs: 'specifications', contacts: 'contacts' };
  const FORM_DEFAULTS = { country: 'Saudi Arabia', countryAr: 'المملكة العربية السعودية', type: 'goods', uom: 'Pcs' };
  const show = v => v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
  function diffLog(prev, next, at, by) {
    const out = [], keys = new Set([...Object.keys(prev || {}), ...Object.keys(next || {})]);
    keys.forEach(k => {
      if (SKIP.has(k) || k.startsWith('_')) return;
      const a = prev[k], b = next[k];
      const sa = show(a), sb = show(b);
      if (sa === sb || ((a == null || a === '') && (b == null || b === '' || (Array.isArray(b) && !b.length)))) return;
      if (a === undefined && FORM_DEFAULTS[k] === b) return;   // a field the form fills in by default, not a change
      if (COMPLEX[k] || typeof a === 'object' || typeof b === 'object') out.push({ at, by, field: k, from: '', to: '', note: (COMPLEX[k] || k) + ' changed' });
      else out.push({ at, by, field: k, from: sa.slice(0, 200), to: sb.slice(0, 200) });
    });
    return out;
  }
  /** Adds history entries (newest last, at most 50). */
  function addHistory(record, log) { if (log && log.length) record.changeLog = [...(record.changeLog || []), ...log].slice(-100); }
  /** V270.4.10: the History section of a view screen (newest first). labels: field → words. */
  const LABELS = { company: 'Company name', name: 'Name', vat: 'VAT No.', uom: 'Unit', category: 'Category', brand: 'Brand', model: 'Model number', price: 'Default price', notes: 'Notes', city: 'City', contact: 'Contact', phone: 'Phone', email: 'Email', mobile: 'Mobile', whatsapp: 'WhatsApp', cat: 'Category', type: 'Type', companyAr: 'Company name (Arabic)', shortAddress: 'Short address', buildingNo: 'Building no.', street: 'Street', district: 'District', postalCode: 'Postal code', secondaryNo: 'Secondary no.', country: 'Country' };
  const label = f => LABELS[f] || f.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());
  function historyHtml(record) {
    const log = [...((record && record.changeLog) || [])].reverse();
    const made = record && record.createdAt ? `<div class="bch-row bch-made"><span class="bch-when">${esc(fmt(record.createdAt))}</span><span class="bch-who">${esc(record.createdBy || '')}</span><span class="bch-what">Created${record.code ? ' · ' + esc(record.code) : ''}</span></div>` : '';
    if (!log.length) return `<div class="bch">${made}<div class="bch-empty">No changes recorded yet.</div></div>`;
    const row = l => `<div class="bch-row"><span class="bch-when">${esc(fmt(l.at))}</span><span class="bch-who">${esc(l.by || '—')}</span><span class="bch-what"><b>${esc(label(l.field))}</b>${l.note ? ': ' + esc(l.note.replace(/^\w+ /, '')) : `: ${esc(l.from || "—")} <span class="bch-arrow">→</span> ${esc(l.to || "—")}`}</span></div>`;
    return `<div class="bch">${log.map(row).join('')}${made}</div>`;
  }
  function fmt(iso) { const d = new Date(iso); if (isNaN(d)) return String(iso || ''); const p = n => String(n).padStart(2, '0'); return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`; }
  /** After a failed save: the reason in plain words (VAT already used, offline VAT …), or false when there was none. */
  function explainFailure(col) {
    const e = window.BizCoreMasters && window.BizCoreMasters.lastError && window.BizCoreMasters.lastError();
    const cfg = forms[col];
    if (!e || (e.collection && e.collection !== col)) return false;
    if (e.code === 'duplicate-vat' || e.code === 'offline-vat') {
      if (typeof showValidationDialog === 'function') showValidationDialog(e.code === 'duplicate-vat' ? 'VAT No. already used' : 'Connection needed', e.message, cfg && cfg.vatId, e.code === 'duplicate-vat' ? 'Already used' : 'Needs a connection');
      return true;
    }
    if (typeof showToast === 'function') showToast('Not saved: ' + (e.message || e.code || 'please try again'), 'error');
    return true;
  }
  window.BCMasterUI = { bind, refresh, beforeSave, addHistory, explainFailure, historyHtml, diffLog };
})();
