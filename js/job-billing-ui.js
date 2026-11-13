/* ═══════════════════════════════════════════════════════════════
   BizCore V271.13 — Work Completion Certificates and job invoicing (screens)
   Approved mockups WCC_1 – WCC_4 (certificates) and JI_1 – JI_3 (job invoices), 13 Nov 2026.

   Job view → "Completion & Billing" tab:
     · Work done (site) · Certified (accepted WCCs) · Invoiced · Received
     · the certificates, with what each one certifies and the invoice that billed it
     · the job invoices (advance / progress / full & final) with their payment state
   New WCC (WCC_2) · the certificate shown exactly as it prints (WCC_3) · Record Acceptance (WCC_4)
   New Job Invoice (JI_1 / JI_2) · the invoice prints with the usual Tax Invoice template (JI_3).

   Everything is read when the tab opens (certificates + the job billing ledger) and kept until Refresh —
   no listener, so a job costs two reads (Firebase free tier).
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.BCJobBilling) return;

  const $ = id => document.getElementById(id);
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = v => { const n = Number(String(v == null ? '' : v).replace(/,/g, '')); return Number.isFinite(n) ? n : 0; };
  const r2 = n => Math.round((Number(n) || 0) * 100 + 1e-7) / 100;
  const fmt = n => (typeof formatNumber === 'function' ? formatNumber(Number(n) || 0, 2) : (Number(n) || 0).toFixed(2));
  const dmy = iso => (window.BCDate ? BCDate.format(String(iso || '').slice(0, 10)) : String(iso || '')) || '—';
  const pct1 = v => (v == null ? '—' : (Math.round((Number(v) || 0) * 10) / 10) + ' %');
  const toast = (m, t, h) => { if (typeof showToast === 'function') showToast(m, t || 'info', h); };
  const who = () => { try { const u = window.currentUser || {}; return u.displayName || u.name || u.email || ''; } catch (e) { return ''; } };
  const todayISO = () => (typeof bcLocalISO === 'function' ? bcLocalISO() : new Date().toISOString().slice(0, 10));
  const SVC = () => window.BizCoreWcc;                 // { core, jobCore, service, invoiceService }
  const C = () => SVC() && SVC().core;                 // wcc-core
  const JB = () => SVC() && SVC().jobCore;             // job-billing-core
  const newOpId = (kind, ref) => {
    const rnd = (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID().replace(/-/g, '').slice(0, 12) : Math.random().toString(36).slice(2, 14);
    return kind + ':' + ref + ':' + Date.now().toString(36) + ':' + rnd;
  };
  const canBill = () => typeof window.bcCan !== 'function' || window.bcCan('invoice', 'c');
  /** Billing Settings + Special Rights, exactly as for a Sales Order ('advance' | 'credit'). → { ok, why } */
  const billingPerm = kind => {
    const inv = window.BizCoreInv || {}, st = inv.settings || {};
    if (typeof window.permState !== 'function') return { ok: true, why: '' };
    const level = kind === 'advance' ? st.allowAdvanceInvoices : st.allowCreditNotes;
    const right = typeof window.bcRight === 'function' ? window.bcRight(kind === 'advance' ? 'advanceInvoices' : 'creditNotes') : !!inv.isAdministrator;
    return window.permState(level, right);
  };
  const canCertify = () => typeof window.bcCan !== 'function' || window.bcCan('salesOrder', 'c') || window.bcCan('salesOrder', 'e');
  const canCancel = () => typeof window.bcCan !== 'function' || window.bcCan('invoice', 'x') || window.bcCan('salesOrder', 'x');
  const errMsg = e => {
    if (!e) return 'Something went wrong.';
    if (e.name === 'WccError' || e.name === 'JobBillingError') return e.message;
    if (e.code === 'permission-denied') return 'The database refused this change. Your role may not allow it — nothing was saved.';
    if (e.code === 'unavailable' || e.code === 'deadline-exceeded' || navigator.onLine === false)
      return 'The database could not be reached. Nothing was saved — check the job and try again.';
    return e.message || 'Something went wrong.';
  };

  /* ── what is loaded for the open job ── */
  let B = null;        // { jobId, wccs, ledger, loading, error, denied }
  const cache = new Map();   // jobId → { at, wccs, ledger }

  async function loadFor(job, fresh) {
    const id = String(job.id);
    if (!fresh && cache.has(id)) { B = { jobId: id, ...cache.get(id), loading: false, error: '' }; return B; }
    B = { jobId: id, wccs: [], ledger: null, loading: true, error: '' };
    try {
      const api = window.BizCoreWcc && window.BizCoreWcc.api;
      const got = SVC() ? await SVC().service.wccsOfJob(id, api) : { list: [], ledger: null };
      const data = { at: Date.now(), wccs: got.list || [], ledger: got.ledger || null, denied: !!got.denied };
      cache.set(id, data);
      B = { jobId: id, ...data, loading: false, error: '' };
    } catch (e) {
      B = { jobId: id, wccs: [], ledger: null, loading: false, error: errMsg(e) };
    }
    return B;
  }
  const forget = jobId => { cache.delete(String(jobId)); };
  const invoicesOfJob = jobId => (typeof invoicesCache !== 'undefined' ? invoicesCache : []).filter(i => i && String(i.jobId || '') === String(jobId));
  const paidOf = inv => (typeof invoicePaidOf === 'function' ? num(invoicePaidOf(inv)) : 0);
  const stateOf = job => {
    if (!JB()) return null;
    return JB().jobBillingState(job, B && B.ledger ? B.ledger : JB().emptyJobBilling(job.id), (B && B.wccs) || []);
  };
  const financeOf = job => {
    const s = stateOf(job);
    return s && JB() ? JB().jobFinanceSummary(s, invoicesOfJob(job.id), paidOf) : null;
  };

  /* ═══════════════════ the Job view tab (WCC_1) ═══════════════════ */

  function barHtml(value, cls) {
    const w = Math.max(0, Math.min(100, Number(value) || 0));
    return `<span class="wb-bar"><i class="wb-${cls}" style="width:${w}%"></i></span>`;
  }
  function cardsHtml(job, f) {
    const wd = job.workDonePct != null && job.workDonePct !== '' ? num(job.workDonePct) : null;
    return `<div class="wb-cards">
<div class="wb-card"><span>Work done (site)</span><b>${wd == null ? '—' : pct1(wd)}</b>${barHtml(wd, 'work')}<small>${job.workDoneAt ? 'Set ' + dmy(String(job.workDoneAt).slice(0, 10)) : 'Set on the Estimate vs Actual tab'}</small></div>
<div class="wb-card"><span>Certified (accepted)</span><b class="teal">${pct1(f.certifiedPct)}</b>${barHtml(f.certifiedPct, 'cert')}<small>${f.certifiedWcc ? esc(f.certifiedWcc.wccNo) : 'No certificate accepted yet'}</small></div>
<div class="wb-card"><span>Invoiced</span><b>${pct1(f.invoicedPct)}</b>${barHtml(f.invoicedPct, 'inv')}<small>${fmt(f.goodsValue)} of ${fmt(f.contract)}</small></div>
<div class="wb-card"><span>Received</span><b class="${f.receivedTotal > 0.005 ? 'green' : ''}">${fmt(f.receivedTotal)}</b>${barHtml(f.receivedPct, 'recv')}<small>Balance ${fmt(f.balanceTotal)} of ${fmt(f.invoicedTotal)} incl. VAT</small></div></div>`;
  }
  function wccListHtml(job, f) {
    const rows = C() ? C().wccRows(B.wccs, invoicesOfJob(job.id)) : [];
    const pillOf = w => {
      const cls = w.status === C().WCC_STATUS.accepted ? 'green' : w.status === C().WCC_STATUS.acceptedRemarks ? 'teal'
        : w.status === C().WCC_STATUS.pending ? 'amber' : w.status === C().WCC_STATUS.cancelled ? 'grey' : 'red';
      return `<span class="wb-pill ${cls}">${esc(w.status)}</span>`;
    };
    const body = rows.length ? rows.map(w => `<tr${w.status === C().WCC_STATUS.cancelled ? ' class="wb-void"' : ''}>
<td class="nw"><button type="button" class="jv-link" data-wcc="open" data-id="${esc(w.id)}"><i class="ti ti-clipboard-check"></i>${esc(w.wccNo)}</button></td>
<td class="nw">${dmy(w.date)}</td>
<td>${w.type === 'final' ? 'Final' : 'Partial'}${w.stage ? ' · ' + esc(w.stage) : ''}</td>
<td class="r">${pct1(w.overallPct)}</td>
<td>${w.acceptance && w.acceptance.by ? esc(w.acceptance.by) + (w.acceptance.date ? ' · ' + dmy(w.acceptance.date) : '') : '<span class="wb-dim">—</span>'}</td>
<td>${pillOf(w)}</td>
<td class="nw">${w.billedOn ? `<button type="button" class="jv-link" data-wcc="inv" data-id="${esc(w.billedOn.id)}">${esc(w.billedOn.invNo)}</button>` : '<span class="wb-dim">—</span>'}</td>
<td class="nw wb-act">${w.open && canCertify() ? `<button type="button" class="btn btn-sm btn-primary" data-wcc="accept" data-id="${esc(w.id)}">Record acceptance</button>` : ''}</td></tr>`).join('')
      : `<tr><td colspan="8" class="jv-none">No certificate yet. A Work Completion Certificate records what the customer accepts — it carries no prices and the accepted work can then be invoiced.</td></tr>`;
    const openOne = rows.find(w => w.open);
    return `<div class="wb-box">
<div class="wb-box-hd"><div><h4>Work Completion Certificates</h4><p>No prices — the customer signs to accept the work. Accepted certificates can be billed.</p></div>
${canCertify() ? (openOne ? `<span class="wb-dim">${esc(openOne.wccNo)} is waiting for the customer</span>`
      : f.certifiedPct >= 100 ? '<span class="wb-dim">The work is fully certified</span>'
      : `<button type="button" class="btn btn-primary btn-sm" data-wcc="new" data-id="${esc(job.id)}"><i class="ti ti-plus"></i>New WCC</button>`) : ''}</div>
<div class="jv-scroll"><table class="jb-tbl wb-tbl"><thead><tr><th>WCC No.</th><th>Date</th><th>Type</th><th class="r">Completion</th><th>Accepted by</th><th>Status</th><th>Billed on</th><th></th></tr></thead><tbody>${body}</tbody></table></div></div>`;
  }
  function invListHtml(job, f) {
    const list = invoicesOfJob(job.id).slice().sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.invNo || '').localeCompare(String(b.invNo || '')));
    const payPill = inv => {
      if (typeof invoicePayStatusOf !== 'function') return '';
      const st = invoicePayStatusOf(inv);
      const cls = /^paid$/i.test(st) ? 'green' : /part/i.test(st) ? 'amber' : /overdue/i.test(st) ? 'red' : 'grey';
      return `<span class="wb-pill ${cls}">${esc(st)}</span>`;
    };
    const body = list.length ? list.map(inv => `<tr${/credited/i.test(inv.status || '') ? ' class="wb-part"' : ''}>
<td class="nw"><button type="button" class="jv-link" data-wcc="inv" data-id="${esc(inv.id)}"><i class="ti ti-file-invoice"></i>${esc(inv.invNo)}</button></td>
<td class="nw">${dmy(inv.date)}</td>
<td>${esc(JB() ? JB().jobInvoiceTypeLabel(inv.type) : '')}${inv.wccNo ? ' · ' + esc(inv.wccNo) : ''}</td>
<td class="r">${inv.contractPct ? pct1(inv.contractPct) : '—'}</td>
<td class="r">${fmt((inv.totals || {}).total)}</td>
<td class="r">${fmt(paidOf(inv))}</td>
<td>${payPill(inv)}</td></tr>`).join('')
      : `<tr><td colspan="7" class="jv-none">No invoice yet. A job is invoiced lump sum: an advance, progress payments, then the final payment.</td></tr>`;
    const left = f.roomTotal;
    const ready = f.readyToInvoice;
    return `<div class="wb-box">
<div class="wb-box-hd"><div><h4>Job invoices</h4><p>Ordinary tax invoices on this job — they appear in the invoice register and in Payment Receipts.</p></div>
${canBill() ? `<div class="wb-split"><button type="button" class="btn btn-primary btn-sm" data-wcc="bill" data-id="${esc(job.id)}" data-type="auto"><i class="ti ti-plus"></i>New Job Invoice</button><button type="button" class="btn btn-primary btn-sm wb-split-x" data-wcc="billmenu" data-id="${esc(job.id)}" aria-label="More invoice types">▾</button></div>` : ''}</div>
<div class="jv-scroll"><table class="jb-tbl wb-tbl"><thead><tr><th>Invoice</th><th>Date</th><th>Type</th><th class="r">Of contract</th><th class="r">Total</th><th class="r">Received</th><th>Payment</th></tr></thead><tbody>${body}</tbody></table></div>
<div class="wb-foot"><span>Contract <b>${fmt(f.contract)}</b></span><span>Invoiced (work) <b>${fmt(f.goodsValue)}</b></span><span>Advance left to deduct <b>${fmt(f.advances.remaining)}</b></span><span>Still to bill <b>${fmt(left)}</b></span>${ready > 0.005 ? `<span class="wb-ready">Certified and not yet invoiced <b>${fmt(ready)}</b></span>` : ''}</div></div>`;
  }
  /** The tab, rendered by js/jobs.js. */
  function tabHtml(job) {
    if (!SVC()) return '<div class="jb-empty">Job invoicing is not available in this build.</div>';
    if (!B || B.jobId !== String(job.id)) return '<div class="jb-empty">Loading…</div>';
    if (B.loading) return '<div class="jb-empty">Loading the certificates…</div>';
    const f = financeOf(job);
    if (!f) return `<div class="jb-empty">${esc(B.error || 'No billing information.')}</div>`;
    const warn = B.error ? `<div class="jv-warn"><i class="ti ti-alert-triangle"></i>${esc(B.error)}</div>` : '';
    const denied = B.denied ? '<div class="jv-warn"><i class="ti ti-lock"></i>Your role cannot see the work completion certificates of this job.</div>' : '';
    const open = C() ? (B.wccs || []).find(w => C().isOpenStatus(w.status)) : null;
    const attention = [];
    if (open) attention.push(`${esc(open.wccNo)} (${open.type === 'final' ? 'Final' : 'Partial'}) is waiting for the customer's signature since ${dmy(open.date)}.`);
    if (f.readyToInvoice > 0.005) attention.push(`${fmt(f.readyToInvoice)} of certified work is not invoiced yet.`);
    if (f.fullyInvoiced && f.balanceTotal > 0.005) attention.push(`The contract is fully invoiced; ${fmt(f.balanceTotal)} is still to be received.`);
    if (f.fullyInvoiced && f.balanceTotal <= 0.005 && !/^(closed|cancelled)$/i.test(String(job.status || ''))) attention.push('Everything is invoiced and paid — the job can be closed (Edit Details → Status).');
    return `${warn}${denied}${cardsHtml(job, f)}
<div class="wb-two">${wccListHtml(job, f)}${attention.length ? `<div class="wb-box wb-note"><h4>Needs attention</h4><ul>${attention.map(a => `<li>${a}</li>`).join('')}</ul></div>` : ''}</div>
${invListHtml(job, f)}
<div class="wb-hint"><button type="button" class="btn btn-secondary btn-sm" data-wcc="refresh" data-id="${esc(job.id)}"><i class="ti ti-refresh"></i>Refresh</button><span>Certificates and billing are read when the tab opens. Payments are recorded in Finance → Payment Receipts, the same as for a Sales Order.</span></div>`;
  }
  /** Clicks inside the tab (js/jobs.js passes them here). */
  function onTabClick(e, job, repaint) {
    const b = e.target.closest('[data-wcc]'); if (!b) return false;
    const kind = b.dataset.wcc, id = b.dataset.id;
    if (kind === 'open') openWccView(id);
    else if (kind === 'accept') openAcceptance(id);
    else if (kind === 'new') openNewWcc(id);
    else if (kind === 'inv' && typeof openInvoiceView === 'function') { if (typeof closeModal === 'function') closeModal('job-view-modal'); openInvoiceView(id); }
    else if (kind === 'bill') openNewJobInvoice(id, {});
    else if (kind === 'billmenu') openNewJobInvoice(id, { pick: true });
    else if (kind === 'refresh') { forget(job.id); loadFor(job, true).then(repaint); }
    return true;
  }

  /* ═══════════════════ New WCC (WCC_2) ═══════════════════ */

  let W = null;   // { job, type, rows, prior }
  function ensureWccModal() {
    if ($('wcc-new-modal')) return;
    const m = document.createElement('div');
    m.className = 'modal-overlay'; m.id = 'wcc-new-modal';
    m.innerHTML = `<div class="modal modal-normal wcc-win" role="dialog" aria-modal="true" aria-labelledby="wn-title">
<div class="modal-header wcc-hd"><div><h2 id="wn-title">New Work Completion Certificate</h2><div class="jb-sub" id="wn-sub"></div></div><span class="wcc-chip" id="wn-no">WCC No. on save</span><button type="button" class="close-btn" onclick="closeModal('wcc-new-modal')" aria-label="Close">✕</button></div>
<div class="modal-body" id="wn-body"></div>
<div class="modal-footer wcc-ft"><span id="wn-chk" class="wcc-chk"></span><span class="jb-sp"></span><button type="button" class="btn btn-secondary" onclick="closeModal('wcc-new-modal')">Cancel</button><button type="button" class="btn btn-primary" id="wn-save"><i class="ti ti-device-floppy"></i>Save WCC</button></div></div>`;
    document.body.appendChild(m);
    $('wn-body').addEventListener('input', e => { if (e.target.matches('[data-wl]')) { readRows(); paintWccTotals(); } });
    $('wn-body').addEventListener('click', e => {
      const t = e.target.closest('[data-wtype]');
      if (t) {
        if (t.dataset.wtype === W.type) return;
        readRows();
        // Final sets every line to 100 %; going back to Partial brings back what was typed before.
        if (t.dataset.wtype === 'final') { W.partial = W.rows.map(r => r.pct); W.rows.forEach(r => { r.pct = 100; }); }
        else if (W.partial) { W.rows.forEach((r, i) => { r.pct = W.partial[i] != null ? W.partial[i] : r.prevPct; }); W.partial = null; }
        W.type = t.dataset.wtype;
        paintWcc(); return;
      }
      const s = e.target.closest('[data-wspin]');
      if (s) { const i = Number(s.dataset.i), d = Number(s.dataset.wspin); const inp = $('wl-' + i); if (!inp) return; inp.value = String(Math.max(0, Math.min(100, Math.round((num(inp.value) + d * 5) * 10) / 10))); readRows(); paintWccTotals(); return; }
      const a = e.target.closest('[data-wall]');
      if (a) { W.rows.forEach(r => { r.pct = 100; }); paintWcc(); }
    });
    $('wn-save').onclick = saveWcc;
  }
  async function openNewWcc(jobId) {
    const job = (window.BCJobs && typeof BCJobs.list === 'function' ? BCJobs.list() : []).find(j => String(j.id) === String(jobId) || j.jobNo === jobId);
    if (!job) { toast('Job ' + jobId + ' was not found.', 'error'); return; }
    if (!window.BCScope) { toast('The scope of work module is not loaded.', 'error'); return; }
    const scope = await BCScope.loadJobScope(job);
    if (!scope) { toast(`${job.jobNo} has no scope of work saved, so nothing can be certified.`, 'warning', 'No scope'); return; }
    if (!B || B.jobId !== String(job.id)) await loadFor(job);
    const prior = C().priorFromList(B.wccs || []);
    if (prior.openWcc) { toast(`${prior.openWcc.wccNo} is still waiting for the customer's acceptance.`, 'warning'); return; }
    if (prior.finalWcc) { toast(`The work is already certified as finished on ${prior.finalWcc.wccNo}.`, 'warning'); return; }
    const draft = C().wccDraftState(scope, prior, []);
    W = {
      job, scope, prior, type: 'partial',
      rows: draft.rows.map(r => ({ ...r })),
      date: todayISO(), periodFrom: '', periodTo: '', stage: '',
      remarks: '', repName: '', repTitle: '', saving: false,
    };
    const cust = (typeof customers !== 'undefined' ? customers : []).find(c => c.id === job.custId);
    const contact = cust && Array.isArray(cust.contacts) ? (cust.contacts.find(x => x && x.isDefault) || cust.contacts[0]) : null;
    if (contact) { W.repName = contact.name || ''; W.repTitle = contact.title || contact.designation || ''; }
    ensureWccModal();
    paintWcc();
    if (!$('wcc-new-modal').classList.contains('open')) openModalWithSize('wcc-new-modal');
  }
  function paintWcc() {
    const j = W.job;
    $('wn-sub').textContent = [j.jobNo, j.company, j.poNo ? 'PO ' + j.poNo : '', j.project].filter(Boolean).join(' · ');
    const seg = (k, label) => `<button type="button" class="wcc-seg${W.type === k ? ' on' : ''}" data-wtype="${k}">${label}</button>`;
    const rows = W.rows.map((r, i) => `<tr${r.pct >= 100 ? ' class="wcc-done"' : ''}>
<td class="c">${r.n}</td>
<td><b>${esc(r.title || '—')}</b>${r.workCat ? `<span class="wcc-cat">${esc(r.workCat)}</span>` : ''}${r.qty ? `<small>${esc(String(r.qty))} ${esc(r.uom || '')}</small>` : ''}</td>
<td class="r wcc-prev">${pct1(r.prevPct)}</td>
<td class="wcc-in"><span class="wcc-spin"><input id="wl-${i}" data-wl="${i}" inputmode="decimal" maxlength="5" value="${esc(String(r.pct))}" aria-label="Completed to date, line ${r.n}"${W.type === 'final' ? ' disabled' : ''}><span class="wcc-arrows"><button type="button" data-wspin="1" data-i="${i}" tabindex="-1" aria-label="More">▲</button><button type="button" data-wspin="-1" data-i="${i}" tabindex="-1" aria-label="Less">▼</button></span></span><i>%</i></td>
<td class="wcc-st">${r.pct >= 100 ? '<span class="wcc-ok">Completed</span>' : r.pct > r.prevPct ? `<span class="wcc-up">+${Math.round((r.pct - r.prevPct) * 10) / 10} %</span>` : '<span class="wb-dim">—</span>'}</td></tr>`).join('');
    $('wn-body').innerHTML = `
<div class="wcc-top">
<div class="wcc-f"><label>Certificate type</label><div class="wcc-segs">${seg('partial', 'Partial')}${seg('final', 'Final')}</div></div>
<div class="wcc-f"><label for="wn-date">WCC date *</label><input id="wn-date" type="date" value="${esc(W.date)}"></div>
<div class="wcc-f wcc-f2"><label>Work period</label><div class="wcc-range"><input id="wn-from" type="date" value="${esc(W.periodFrom)}" aria-label="Work period from"><span>→</span><input id="wn-to" type="date" value="${esc(W.periodTo)}" aria-label="Work period to"></div></div>
<div class="wcc-f"><label for="wn-stage">Stage / reference</label><input id="wn-stage" maxlength="80" value="${esc(W.stage)}" placeholder="${W.type === 'final' ? 'Final handover' : 'e.g. Stage 1'}"></div>
</div>
<div class="wcc-sum" id="wn-sum"></div>
<div class="wb-box">
<div class="wb-box-hd"><div><h4>Scope of work completed</h4><p>The lines come from the job's accepted scope (frozen). Enter how much of each is complete to date.</p></div>
${W.type === 'final' ? '<span class="wb-dim">A final certificate sets every line to 100 %</span>' : '<button type="button" class="btn btn-secondary btn-sm" data-wall="1">Set all to 100 %</button>'}</div>
<div class="jv-scroll"><table class="jb-tbl wcc-tbl"><thead><tr><th class="c">#</th><th>Scope / section</th><th class="r">Previous</th><th>Completed to date</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div></div>
<div class="wcc-two">
<div class="wcc-f"><label for="wn-remarks">Remarks / pending items (printed)</label><textarea id="wn-remarks" rows="3" maxlength="2000">${esc(W.remarks)}</textarea></div>
<div><div class="wcc-f"><label for="wn-rep">Customer representative (Attn)</label><input id="wn-rep" maxlength="200" value="${esc(W.repName)}"></div>
<div class="wcc-f"><label for="wn-reptitle">Designation</label><input id="wn-reptitle" maxlength="200" value="${esc(W.repTitle)}"></div></div></div>`;
    if (window.BCDate) {
      BCDate.attach($('wn-date'), { allowEmpty: false, max: () => BCDate.today(), onCommit: () => { readRows(); paintWccTotals(); } });
      BCDate.attach($('wn-from'), { allowEmpty: true, max: () => BCDate.today(), onCommit: () => { readRows(); paintWccTotals(); } });
      BCDate.attach($('wn-to'), { allowEmpty: true, max: () => BCDate.today(), onCommit: () => { readRows(); paintWccTotals(); } });
    }
    readRows(); paintWccTotals();
  }
  function readRows() {
    if (!W) return;
    W.rows.forEach((r, i) => { const el = $('wl-' + i); if (el && !el.disabled) r.pct = Math.max(0, Math.min(100, num(el.value))); });
    const g = id => { const el = $(id); return el ? (window.BCDate ? BCDate.getISO(el) || '' : el.value) : ''; };
    W.date = g('wn-date') || W.date;
    W.periodFrom = g('wn-from'); W.periodTo = g('wn-to');
    W.stage = ($('wn-stage') || {}).value || '';
    W.remarks = ($('wn-remarks') || {}).value || '';
    W.repName = ($('wn-rep') || {}).value || '';
    W.repTitle = ($('wn-reptitle') || {}).value || '';
  }
  function wccInput() {
    return {
      type: W.type, date: W.date, periodFrom: W.periodFrom, periodTo: W.periodTo, stage: W.stage,
      lines: W.rows.map(r => ({ idx: r.idx, pct: r.pct })), remarks: W.remarks, repName: W.repName, repTitle: W.repTitle,
    };
  }
  function paintWccTotals() {
    const d = C().wccDraftState(W.scope, W.prior, W.rows.map(r => ({ idx: r.idx, pct: r.pct })));
    const prev = W.prior.certifiedWcc;
    $('wn-sum').innerHTML = `<div class="wcc-sum-in"><span>Overall completion <b>${pct1(d.toDatePct)}</b> (cumulative)</span>
<span>Previously certified <b>${pct1(d.certifiedPct)}</b>${prev ? ' on ' + esc(prev.wccNo) : ''}</span>
<span>New on this certificate <b class="teal">${pct1(d.newPct)}</b></span>
${W.job.workDonePct != null && W.job.workDonePct !== '' ? `<span class="wb-dim">Site work done ${pct1(num(W.job.workDonePct))}</span>` : ''}</div>`;
    let why = '';
    try { C().buildWccBody(W.job, W.scope, W.prior, wccInput(), { today: todayISO() }); }
    catch (e) { why = e.message; }
    const chk = $('wn-chk');
    chk.className = 'wcc-chk ' + (why ? 'bad' : 'ok');
    chk.textContent = why ? 'To continue: ' + why : `✓ Ready · ${W.rows.length} line${W.rows.length === 1 ? '' : 's'} · ${W.type === 'final' ? 'Final 100 %' : 'Partial ' + pct1(d.toDatePct)}`;
    $('wn-save').disabled = !!why || W.saving;
  }
  async function saveWcc() {
    if (!W || W.saving) return;
    readRows();
    let body;
    try { body = C().buildWccBody(W.job, W.scope, W.prior, wccInput(), { today: todayISO() }); }
    catch (e) { toast(e.message, 'warning'); paintWccTotals(); return; }
    if (navigator.onLine === false) { toast('You are offline. A certificate gets its number when you are online — connect and try again.', 'error'); return; }
    const parts = (typeof docNumberParts === 'function' ? docNumberParts('workCompletion') : null);
    if (!parts) { toast('The WCC numbering is not set up (Administration → Numbering).', 'error'); return; }
    const ok = await new Promise(res => showConfirm({
      icon: '📋', title: body.type === 'final' ? 'Save the final certificate?' : 'Save the certificate?',
      message: 'It is printed for the customer to sign. Record the acceptance here once it is signed.',
      details: {
        'Job': W.job.jobNo, 'Customer': W.job.company || '—',
        'Completion to date': pct1(body.overallPct) + (body.previousPct ? ` (was ${pct1(body.previousPct)})` : ''),
        'Type': body.type === 'final' ? 'Final' : 'Partial', 'Date': dmy(body.date),
      },
      confirmText: 'Save WCC', cancelText: 'Go back', confirmClass: 'btn-primary', onConfirm: () => res(true), onCancel: () => res(false),
    }));
    if (!ok) return;
    W.saving = true; $('wn-save').disabled = true;
    if (typeof showBusyOverlay === 'function') showBusyOverlay('wcc-new-modal', 'Saving…');
    try {
      const res = await SVC().service.createWcc({
        operationId: newOpId('wcc', W.job.id), jobId: String(W.job.id), numbering: parts.numbering, ...wccInput(),
      });
      forget(W.job.id);
      closeModal('wcc-new-modal');
      toast(`${res.wcc.wccNo} saved · ${pct1(res.wcc.overallPct)} completed`, 'success', 'Certificate saved');
      await reopenJob(W.job, 'wb');
      openWccView(res.wcc.id, res.wcc);
    } catch (e) {
      toast(errMsg(e), 'error', 'Not saved');
    } finally {
      W.saving = false;
      if (typeof hideBusyOverlay === 'function') hideBusyOverlay('wcc-new-modal');
      if ($('wn-save')) paintWccTotals();
    }
  }
  async function reopenJob(job, tab) {
    try {
      if (window.BCJobs && typeof BCJobs.view === 'function') { await loadFor(job, true); await BCJobs.view(job.id, { tab }); }
    } catch (e) { /* the job view is optional */ }
  }

  /* ═══════════════════ the certificate, as it prints (WCC_3) ═══════════════════ */

  const WCC_DOC_CSS = `
.wcc-a4{--wa:#0f766e;--wa-soft:#9fd6cd;--wa-tint:#effaf7}
.wcc-a4 .dn-head{border-bottom-color:var(--wa)}
.wcc-a4 .dn-titlebox{border-color:var(--wa-soft)}
.wcc-a4 .dn-titlebox h1{background:var(--wa);color:#fff;font-size:15px;font-weight:700;line-height:1.25;text-align:center}
.wcc-a4 .dn-titlebox div{border-top-color:var(--wa-soft)}
.wcc-a4 .dn-box{border-color:var(--wa-soft)}
.wcc-a4 .dn-box h3{color:var(--wa);background:var(--wa-tint);border-bottom-color:var(--wa-soft)}
.wcc-a4 .dn-ref>div{background:var(--wa-tint);border-color:var(--wa-soft)}
.wcc-a4 .dn-items th{background:var(--wa);border-color:var(--wa)}
.wcc-a4 .dn-items th{font-size:8.5px!important;font-weight:700!important;text-transform:uppercase!important;letter-spacing:.04em!important;padding:7px 6px!important}
.wcc-a4 .dn-items td{font-size:9.5px!important;line-height:1.4!important;padding:7px 6px!important;vertical-align:top}
.wcc-a4 .dn-items td.c{text-align:center}.wcc-a4 .dn-items td.r,.wcc-a4 .dn-items th.r{text-align:right}
.wcc-a4 .dn-items td b{font-weight:700}
.wcc-a4 .dn-items td span.cat{display:inline-block;margin-left:6px;font-size:8px;color:#50657a;border:1px solid #dfe7ef;border-radius:3px;padding:0 4px}
.wcc-a4 .dn-foot{border-top-color:var(--wa)}
.wcc-a4 .dn-subtitle{color:#134e48;font-weight:700}
.wcc-cert{margin-top:12px;border:1px solid var(--wa-soft);background:var(--wa-tint);padding:9px 11px;font-size:10px;line-height:1.6}
.wcc-rem{margin-top:9px;font-size:10px;line-height:1.5}
.wcc-rem b{display:block;font-size:8px;text-transform:uppercase;color:var(--wa);margin-bottom:2px}
.wcc-a4 .dn-sign h4{color:var(--wa)}
@media print{.wcc-status-row{display:none!important}}
`;
  function wccDocumentHtml(w, screenMode) {
    const cp = typeof dnCompanyProfile === 'function' ? dnCompanyProfile() : { name: 'Downtown Trading Est.' };
    const cust = (typeof customers !== 'undefined' ? customers : []).find(c => c.id === w.custId) || {};
    const base = typeof invDnBaseCss === 'function' ? invDnBaseCss() : '';
    const logo = cp.logo ? `<img src="${cp.logo}" alt="${esc(cp.name)}" style="max-width:260px;max-height:78px;width:auto;height:auto;object-fit:contain">`
      : `<div style="font-size:23px;font-weight:900;color:#174b7a">${esc(cp.name)}</div>${cp.nameAr ? `<div dir="rtl" style="font-size:15px;font-weight:700;color:#174b7a;margin-top:3px">${esc(cp.nameAr)}</div>` : ''}`;
    const contactParts = [cp.pobox ? `P.O. Box ${esc(cp.pobox)}` : '', cp.address ? esc(cp.address) : '', cp.phone ? `Tel: ${esc(cp.phone)}` : '', cp.email ? esc(cp.email) : '', cp.website ? esc(cp.website) : ''].filter(Boolean);
    const isFinal = w.type === 'final';
    const subtitle = isFinal ? `FINAL COMPLETION — ${pct1(w.overallPct)}` : `PARTIAL COMPLETION — ${pct1(w.overallPct)}${w.stage ? ' · ' + esc(w.stage).toUpperCase() : ''}`;
    const period = w.periodFrom || w.periodTo ? `${w.periodFrom ? dmy(w.periodFrom) : '—'} → ${w.periodTo ? dmy(w.periodTo) : '—'}` : '—';
    const rows = (w.lines || []).map(l => `<tr><td class="c">${l.n}</td><td><b>${esc(l.title || '—')}</b>${l.workCat ? `<span class="cat">${esc(l.workCat)}</span>` : ''}</td><td class="r">${pct1(l.pct)}</td><td class="c">${l.pct >= 100 ? 'Completed' : l.pct > 0 ? 'In progress' : 'Not started'}</td></tr>`).join('');
    const accepted = C() && C().isAcceptedStatus(w.status);
    const statusChip = screenMode ? `<div class="dn-screen-status-row wcc-status-row"><span class="dn-screen-status ${accepted ? 'dn-screen-status--delivered' : w.status === 'Cancelled' ? 'dn-screen-status--rejected' : w.status === 'Not accepted' ? 'dn-screen-status--rejected' : 'dn-screen-status--confirmation'}"><span class="dn-screen-status-dot"></span>${esc(w.status || '')}</span></div>` : '';
    const acc = w.acceptance || {};
    return `<div class="dn-a4 wcc-a4${screenMode ? ' dn-a4-screen' : ''}"><style>${base}${WCC_DOC_CSS}</style>
<div class="dn-head"><div>${logo}</div><div class="dn-contact">${contactParts.join('<br>') || '&nbsp;'}</div>
<div class="dn-title-stack">${statusChip}<div class="dn-titlebox"><h1>WORK COMPLETION<br>CERTIFICATE</h1><div><small>WCC No.</small><strong>${esc(w.wccNo || '—')}</strong></div><div><small>Date</small><strong>${dmy(w.date)}</strong></div></div></div></div>
<div class="dn-subtitle">${subtitle}</div>
<div class="dn-two"><div class="dn-box"><h3>Customer</h3><div class="content"><strong>${esc(w.company || cust.company || '—')}</strong>${cust.address ? esc(cust.address) : ''}${w.repName ? `<br>Attn: ${esc(w.repName)}${w.repTitle ? ', ' + esc(w.repTitle) : ''}` : ''}</div></div>
<div class="dn-box"><h3>Project / Site</h3><div class="content"><strong>${esc(w.project || '—')}</strong></div></div></div>
<div class="dn-ref"><div><small>Customer PO No.</small><strong>${esc(w.poNo || '—')}</strong></div><div><small>PO Date</small><strong>${w.poDate ? dmy(w.poDate) : '—'}</strong></div><div><small>Our Job / Quotation</small><strong>${esc(w.jobNo || '—')}${w.qno ? ' · ' + esc(w.qno) : ''}</strong></div><div><small>Work Period</small><strong>${period}</strong></div></div>
<table class="dn-items"><thead><tr><th class="c">#</th><th>Scope of Work</th><th class="r">Completed</th><th class="c">Status</th></tr></thead><tbody>${rows}</tbody></table>
<div class="wcc-cert">This is to certify that the works described above, carried out under Purchase Order No. <b>${esc(w.poNo || '—')}</b>, have been completed ${isFinal ? 'in full' : `to ${pct1(w.overallPct)}`} in accordance with the agreed scope of work, and are accepted by the customer as ${isFinal ? 'complete' : 'completed to the extent certified'}.</div>
${w.remarks ? `<div class="wcc-rem"><b>Remarks / pending items</b>${esc(w.remarks)}</div>` : ''}
<div class="dn-bottom"><div class="dn-sign"><h4>For ${esc(cp.name || 'the company')}</h4><div>Name: ${esc(w.createdBy || '________________')}<br>Designation: ________________<br>Date: ${dmy(w.date)}<br>Signature: <span class="dn-line"></span></div></div>
<div class="dn-sign"><h4>Accepted By (Customer)</h4><div>Name: ${esc(acc.by || w.repName || '________________')}<br>Designation: ${esc(acc.title || w.repTitle || '________________')}<br>Date: ${acc.date ? dmy(acc.date) : '________________'}<br>Signature: <span class="dn-line"></span></div></div>
<div class="dn-doc-qr-slot"></div></div>
<div class="dn-foot dn-foot-j">${typeof docFooterPartsHtml === 'function' ? docFooterPartsHtml(contactParts) : contactParts.join(' &nbsp; | &nbsp; ')}</div></div>`;
  }

  function ensureWccView() {
    if ($('wcc-view-modal')) return;
    const m = document.createElement('div');
    m.className = 'modal-overlay'; m.id = 'wcc-view-modal';
    m.innerHTML = `<div class="modal modal-normal" role="dialog" aria-modal="true" aria-labelledby="wv-title">
<div class="modal-header wcc-hd wcc-hd-slim"><h2 id="wv-title">Work Completion Certificate</h2><span class="wcc-chip" id="wv-type"></span><button type="button" class="close-btn" onclick="closeModal('wcc-view-modal')" aria-label="Close">✕</button></div>
<div class="modal-body" id="wv-body" style="padding:0;overflow-y:auto"></div>
<div class="dn-view-actionbar" id="wv-actions" role="toolbar" aria-label="Certificate actions"></div></div>`;
    document.body.appendChild(m);
    $('wv-body').addEventListener('click', e => {
      const b = e.target.closest('[data-wv]'); if (!b) return;
      const k = b.dataset.wv, id = b.dataset.id;
      if (k === 'job' && window.BCJobs) { closeModal('wcc-view-modal'); BCJobs.view(id, { tab: 'wb' }); }
      else if (k === 'inv' && typeof openInvoiceView === 'function') { closeModal('wcc-view-modal'); openInvoiceView(id); }
    });
  }
  function wccOf(id) { return (B && (B.wccs || []).find(w => String(w.id) === String(id) || w.wccNo === id)) || null; }
  async function openWccView(wccId, preloaded) {
    const w = preloaded || wccOf(wccId);
    if (!w) { toast('This certificate is not loaded yet. Please try again in a moment.', 'warning'); return; }
    ensureWccView();
    const job = (window.BCJobs && typeof BCJobs.list === 'function' ? BCJobs.list() : []).find(j => String(j.id) === String(w.jobId)) || { id: w.jobId, jobNo: w.jobNo };
    const inv = invoicesOfJob(w.jobId).find(i => String(i.wccId || '') === String(w.id));
    const f = financeOf(job);
    $('wv-title').textContent = `${w.wccNo} — ${w.type === 'final' ? 'Final' : 'Partial'} ${pct1(w.overallPct)}`;
    $('wv-type').textContent = w.type === 'final' ? 'Final' : 'Partial';
    const accepted = C().isAcceptedStatus(w.status);
    const stCls = accepted ? 'green' : w.status === C().WCC_STATUS.pending ? 'amber' : w.status === C().WCC_STATUS.cancelled ? 'grey' : 'red';
    const row = (k, v) => `<div class="qv-side-row"><span>${k}</span><strong>${v}</strong></div>`;
    const panel = `<aside class="qv-erp-panel wcc-panel" aria-label="Certificate information">
<section class="qv-side-card"><div class="qv-side-head"><span><i class="ti ti-clipboard-check"></i>Status</span><span class="qv-screen-only">Staff only</span></div>
<div class="wcc-stat"><span class="wb-pill ${stCls}">${esc(w.status || '')}</span></div>
${w.acceptance && w.acceptance.by ? `<div class="bc-kpi-rows">${row('Accepted by', esc(w.acceptance.by))}${row('Designation', esc(w.acceptance.title || '—'))}${row('Date', dmy(w.acceptance.date))}${w.acceptance.remarks ? row('Customer remarks', esc(w.acceptance.remarks)) : ''}</div>`
      : w.status === C().WCC_STATUS.pending && canCertify() ? `<button type="button" class="btn btn-primary wcc-accept-btn" onclick="BCJobBilling.openAcceptance('${esc(w.id)}')"><i class="ti ti-writing-sign"></i>Record Acceptance</button>` : ''}
${w.status === C().WCC_STATUS.cancelled ? `<div class="wcc-note">Cancelled${w.cancelledBy ? ' by ' + esc(w.cancelledBy) : ''}${w.cancelReason ? ' — ' + esc(w.cancelReason) : ''}</div>` : ''}</section>
<section class="qv-side-card"><div class="qv-side-head"><span><i class="ti ti-briefcase"></i>Job</span></div><div class="bc-kpi-rows">
${row('Job', `<button type="button" class="jv-link" data-wv="job" data-id="${esc(w.jobId)}">${esc(w.jobNo || '—')}</button>`)}
${row('Customer PO', esc(w.poNo || '—'))}
${row('Completion', `${pct1(w.overallPct)}${w.previousPct ? ` (was ${pct1(w.previousPct)})` : ''}`)}
${row('Work period', w.periodFrom || w.periodTo ? `${w.periodFrom ? dmy(w.periodFrom) : '—'} → ${w.periodTo ? dmy(w.periodTo) : '—'}` : '—')}
${f ? row('Billing 🔒', `${pct1(f.invoicedPct)} invoiced`) : ''}
${inv ? row('Billed on', `<button type="button" class="jv-link" data-wv="inv" data-id="${esc(inv.id)}">${esc(inv.invNo)}</button>`) : ''}</div>
${accepted && !inv && f && f.readyToInvoice > 0.005 ? `<div class="wcc-note teal">${fmt(f.readyToInvoice)} of certified work can be invoiced.</div>` : ''}</section>
<section class="qv-side-card"><div class="qv-side-head"><span><i class="ti ti-route"></i>Document flow</span></div>${typeof bcFlowChips === 'function' ? bcFlowChips([
      w.qno ? { label: 'Quotation', text: w.qno } : { label: 'Quotation', state: 'muted' },
      { label: 'Job', text: w.jobNo || '—', onclick: `closeModal('wcc-view-modal');BCJobs.view('${esc(w.jobId)}',{tab:'wb'})` },
      { label: 'Certificate', text: w.wccNo, state: 'current' },
      inv ? { label: 'Invoice', text: inv.invNo, onclick: `closeModal('wcc-view-modal');openInvoiceView('${esc(inv.id)}')` } : { label: 'Invoice', state: 'muted' },
    ]) : ''}</section>
<section class="qv-side-card"><div class="qv-side-head"><span><i class="ti ti-history"></i>Activity</span></div>${typeof bcActivityList === 'function' ? bcActivityList([
      [`Created${w.createdBy ? ' by ' + w.createdBy : ''}`, w.created || w.date],
      w.decidedAt ? [`${w.status}${w.decidedBy ? ' — recorded by ' + w.decidedBy : ''}`, w.decidedAt] : null,
      w.cancelledAt ? [`Cancelled${w.cancelledBy ? ' by ' + w.cancelledBy : ''}`, w.cancelledAt] : null,
    ].filter(Boolean)) : ''}</section></aside>`;
    $('wv-body').innerHTML = `<div class="dn-view-workspace wcc-view-workspace"><div class="dn-view-document">${wccDocumentHtml(w, true)}</div>${panel}</div>`;
    const b = ['<div class="dn-view-actionbar-spacer"></div>',
      `<button class="btn btn-secondary" onclick="closeModal('wcc-view-modal')"><i class="ti ti-x"></i><span>Close</span></button>`];
    if (w.status === C().WCC_STATUS.pending && canCertify()) b.push(`<button class="btn btn-success" onclick="BCJobBilling.openAcceptance('${esc(w.id)}')"><i class="ti ti-writing-sign"></i><span>Record Acceptance</span></button>`);
    if (C().isAcceptedStatus(w.status) && !inv && canBill()) b.push(`<button class="btn btn-secondary" onclick="closeModal('wcc-view-modal');BCJobBilling.openNewJobInvoice('${esc(w.jobId)}',{wccId:'${esc(w.id)}'})"><i class="ti ti-file-invoice"></i><span>Invoice this work</span></button>`);
    if (w.status !== C().WCC_STATUS.cancelled && canCancel()) b.push(`<button class="btn btn-danger" onclick="BCJobBilling.openCancelWcc('${esc(w.id)}')"><i class="ti ti-ban"></i><span>Cancel WCC…</span></button>`);
    b.push(`<button class="btn btn-primary" onclick="BCJobBilling.printWcc('${esc(w.id)}')"><i class="ti ti-printer"></i><span>Print / PDF</span></button>`);
    $('wv-actions').innerHTML = b.join('');
    if (!$('wcc-view-modal').classList.contains('open')) openModalWithSize('wcc-view-modal');
  }
  function printWcc(wccId) {
    const w = wccOf(wccId); if (!w) return;
    const name = [w.wccNo, typeof dnSafeFilePart === 'function' ? dnSafeFilePart(w.company) : w.company,
      typeof docPoFilePart === 'function' ? docPoFilePart(w.poNo) : (w.poNo || '')].filter(Boolean).join(' - ');
    if (typeof invPrintDocument === 'function') invPrintDocument(wccDocumentHtml(w, false), name);
    else toast('Printing is not available in this build.', 'warning');
  }

  /* ═══════════════════ Record Acceptance (WCC_4) ═══════════════════ */

  function openAcceptance(wccId) {
    const w = wccOf(wccId);
    if (!w) { toast('This certificate is not loaded yet.', 'warning'); return; }
    if (!C().isOpenStatus(w.status)) { toast(`${w.wccNo} is already ${w.status}.`, 'warning'); return; }
    let m = $('wcc-acc-modal');
    if (!m) { m = document.createElement('div'); m.className = 'modal-overlay'; m.id = 'wcc-acc-modal'; document.body.appendChild(m); }
    const opt = (v, title, note, on) => `<label class="wcc-opt${on ? ' on' : ''}"><input type="radio" name="wa-r" value="${v}"${on ? ' checked' : ''}><span><b>${title}</b><small>${note}</small></span></label>`;
    m.innerHTML = `<div class="modal wcc-acc-win" role="dialog" aria-modal="true" aria-labelledby="wa-title">
<div class="modal-header wcc-hd"><div><h2 id="wa-title">Record Customer Acceptance</h2><div class="jb-sub">${esc(w.wccNo)} · ${w.type === 'final' ? 'Final' : 'Partial'} ${pct1(w.overallPct)} · ${esc(w.company || '')}</div></div><button type="button" class="close-btn" onclick="closeModal('wcc-acc-modal')" aria-label="Close">✕</button></div>
<div class="modal-body">
<div class="wcc-f"><label>Result *</label><div class="wcc-opts">
${opt('accepted', 'Accepted', 'The customer signed the certificate. The work can be invoiced.', true)}
${opt('acceptedRemarks', 'Accepted with remarks', 'Signed, with snag or pending items written on it. Can be invoiced; the remarks stay on the job.', false)}
${opt('notAccepted', 'Not accepted', 'The customer refused to sign. A reason is required; make a new certificate after the work is corrected.', false)}
</div></div>
<div class="wcc-three">
<div class="wcc-f"><label for="wa-by">Accepted by *</label><input id="wa-by" maxlength="200" value="${esc(w.repName || '')}"></div>
<div class="wcc-f"><label for="wa-title2">Designation</label><input id="wa-title2" maxlength="200" value="${esc(w.repTitle || '')}"></div>
<div class="wcc-f"><label for="wa-date">Acceptance date *</label><input id="wa-date" type="date" value="${esc(todayISO())}"></div></div>
<div class="wcc-f"><label for="wa-rem">Customer remarks</label><textarea id="wa-rem" rows="2" maxlength="2000"></textarea></div>
<div class="wcc-info"><i class="ti ti-info-circle"></i><span>Keep the signed paper copy with the job file — no file is uploaded. After saving, the certificate is locked: it can only be cancelled with a reason, and only while nothing has been invoiced against it.</span></div>
<div class="inv-error" id="wa-err" hidden></div></div>
<div class="modal-footer"><button type="button" class="btn btn-secondary" onclick="closeModal('wcc-acc-modal')">Cancel</button><button type="button" class="btn btn-primary" id="wa-save"><i class="ti ti-device-floppy"></i>Save Acceptance</button></div></div>`;
    if (window.BCDate) BCDate.attach($('wa-date'), { allowEmpty: false, max: () => BCDate.today(), min: () => String(w.date || '').slice(0, 10) });
    const sync = () => {
      const v = (m.querySelector('input[name="wa-r"]:checked') || {}).value;
      m.querySelectorAll('.wcc-opt').forEach(l => l.classList.toggle('on', l.querySelector('input').checked));
      const refused = v === 'notAccepted';
      $('wa-by').closest('.wcc-f').style.opacity = refused ? '.5' : '1';
      $('wa-by').disabled = refused;
      $('wa-rem').setAttribute('placeholder', refused ? 'Why the customer did not accept the work (required)' : v === 'acceptedRemarks' ? 'The remarks the customer made (required)' : '');
    };
    m.querySelectorAll('input[name="wa-r"]').forEach(r => r.addEventListener('change', sync));
    sync();
    $('wa-save').onclick = async () => {
      const result = (m.querySelector('input[name="wa-r"]:checked') || {}).value;
      const input = {
        result, by: $('wa-by').value.trim(), title: $('wa-title2').value.trim(),
        date: window.BCDate ? (BCDate.getISO($('wa-date')) || '') : $('wa-date').value, remarks: $('wa-rem').value.trim(),
      };
      try { C().buildAcceptance(w, input, { today: todayISO() }); }
      catch (e) { $('wa-err').hidden = false; $('wa-err').textContent = e.message; return; }
      $('wa-err').hidden = true; $('wa-save').disabled = true;
      if (typeof showBusyOverlay === 'function') showBusyOverlay('wcc-acc-modal', 'Saving…');
      try {
        const res = await SVC().service.recordAcceptance({
          operationId: newOpId('wccacc', w.id), jobId: String(w.jobId), wccId: String(w.id), expectedRevision: w.revision, ...input,
        });
        forget(w.jobId);
        closeModal('wcc-acc-modal');
        toast(`${w.wccNo}: ${res.wcc.status}`, 'success', 'Saved');
        const job = (window.BCJobs && typeof BCJobs.list === 'function' ? BCJobs.list() : []).find(j => String(j.id) === String(w.jobId));
        if (job) await loadFor(job, true);
        if (isModalOpen('wcc-view-modal')) openWccView(w.id);
        else if (job) await reopenJob(job, 'wb');
      } catch (e) {
        $('wa-err').hidden = false; $('wa-err').textContent = errMsg(e); $('wa-save').disabled = false;
      } finally { if (typeof hideBusyOverlay === 'function') hideBusyOverlay('wcc-acc-modal'); }
    };
    openModalWithSize('wcc-acc-modal');
    setTimeout(() => { const el = $('wa-by'); if (el && !el.disabled) el.focus(); }, 60);
  }

  function openCancelWcc(wccId) {
    const w = wccOf(wccId); if (!w) return;
    const inv = invoicesOfJob(w.jobId).find(i => String(i.wccId || '') === String(w.id));
    if (inv) { toast(`${w.wccNo} has already been invoiced on ${inv.invNo}. Credit that invoice first.`, 'warning', 'Cannot cancel'); return; }
    let m = $('wcc-cancel-modal');
    if (!m) { m = document.createElement('div'); m.className = 'modal-overlay'; m.id = 'wcc-cancel-modal'; document.body.appendChild(m); }
    m.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="wx-title">
<div class="modal-header"><div class="modal-header-title-wrap"><h2 id="wx-title">Cancel ${esc(w.wccNo)}</h2></div><button type="button" class="close-btn" onclick="closeModal('wcc-cancel-modal')" aria-label="Close">✕</button></div>
<div class="modal-body"><p class="jv-pnote">The certificate stays in the job's history, marked Cancelled. ${C().isAcceptedStatus(w.status) ? 'The work it certified goes back to what was certified before it.' : ''}</p>
<div class="wcc-f"><label for="wx-why">Why is it cancelled? *</label><textarea id="wx-why" rows="3" maxlength="600" placeholder="e.g. Signed by the wrong person"></textarea></div>
<div class="inv-error" id="wx-err" hidden></div></div>
<div class="modal-footer"><button type="button" class="btn btn-secondary" onclick="closeModal('wcc-cancel-modal')">Go back</button><button type="button" class="btn btn-danger" id="wx-save"><i class="ti ti-ban"></i>Cancel the certificate</button></div></div>`;
    $('wx-save').onclick = async () => {
      const reason = $('wx-why').value.trim();
      if (reason.length < 3) { $('wx-err').hidden = false; $('wx-err').textContent = 'Write why the certificate is cancelled.'; return; }
      $('wx-err').hidden = true; $('wx-save').disabled = true;
      try {
        await SVC().service.cancelWcc({ operationId: newOpId('wccx', w.id), jobId: String(w.jobId), wccId: String(w.id), reason });
        forget(w.jobId);
        closeModal('wcc-cancel-modal');
        toast(`${w.wccNo} cancelled`, 'success');
        const job = (window.BCJobs && typeof BCJobs.list === 'function' ? BCJobs.list() : []).find(j => String(j.id) === String(w.jobId));
        if (job) await loadFor(job, true);
        if (isModalOpen('wcc-view-modal')) closeModal('wcc-view-modal');
        if (job) await reopenJob(job, 'wb');
      } catch (e) { $('wx-err').hidden = false; $('wx-err').textContent = errMsg(e); $('wx-save').disabled = false; }
    };
    openModalWithSize('wcc-cancel-modal');
  }

  /* ═══════════════════ New Job Invoice (JI_1 / JI_2) ═══════════════════ */

  let I = null;   // { job, type, basis, wccId, percent, amount, date, dueDate, lineText, zohoNo, deduction, touched, saving }
  function ensureInvModal() {
    if ($('job-inv-modal')) return;
    const m = document.createElement('div');
    m.className = 'modal-overlay'; m.id = 'job-inv-modal';
    m.innerHTML = `<div class="modal modal-normal wcc-win" role="dialog" aria-modal="true" aria-labelledby="ji-title">
<div class="modal-header jb-hd"><div><h2 id="ji-title">New Job Invoice</h2><div class="jb-sub" id="ji-sub"></div></div><span class="wcc-chip" id="ji-no">INV No. on save</span><button type="button" class="close-btn" onclick="closeModal('job-inv-modal')" aria-label="Close">✕</button></div>
<div class="modal-body" id="ji-body"></div>
<div class="modal-footer wcc-ft"><span id="ji-chk" class="wcc-chk"></span><span class="jb-sp"></span><button type="button" class="btn btn-secondary" onclick="closeModal('job-inv-modal')">Cancel</button><button type="button" class="btn btn-primary" id="ji-save"><i class="ti ti-device-floppy"></i>Save Invoice</button></div></div>`;
    document.body.appendChild(m);
    $('ji-body').addEventListener('click', e => {
      const t = e.target.closest('[data-jitype]');
      if (t) { I.type = t.dataset.jitype; I.touched = false; fixBasis(); paintInv(); return; }
      const bs = e.target.closest('[data-jibasis]');
      if (bs) { I.basis = bs.dataset.jibasis; I.wccId = bs.dataset.id || I.wccId; I.touched = false; paintInv(); return; }
    });
    $('ji-body').addEventListener('input', e => {
      if (e.target.id === 'ji-ded') I.dedTouched = true;
      readInv(); paintInvTotals();
    });
    $('ji-save').onclick = saveInvoice;
  }
  function fixBasis() {
    const JBc = JB();
    if (I.type === JBc.JOB_INVOICE_TYPES.advance) I.basis = 'percent';
    else if (I.type === JBc.JOB_INVOICE_TYPES.final) I.basis = 'amount';
    else if (!I.basis || I.basis === 'amount') I.basis = acceptedWccs().length ? 'wcc' : 'percent';
  }
  const acceptedWccs = () => {
    if (!C() || !B) return [];
    const billed = new Set(invoicesOfJob(B.jobId).map(i => String(i.wccId || '')).filter(Boolean));
    return (B.wccs || []).filter(w => C().isAcceptedStatus(w.status) && !billed.has(String(w.id)));
  };
  async function openNewJobInvoice(jobId, opts = {}) {
    const job = (window.BCJobs && typeof BCJobs.list === 'function' ? BCJobs.list() : []).find(j => String(j.id) === String(jobId) || j.jobNo === jobId);
    if (!job) { toast('Job ' + jobId + ' was not found.', 'error'); return; }
    if (!canBill()) { toast('Your role cannot issue invoices.', 'warning'); return; }
    if (!B || B.jobId !== String(job.id)) await loadFor(job);
    const f = financeOf(job);
    if (!f) { toast('The billing information of this job could not be read.', 'error'); return; }
    if (f.roomTotal <= 0.005) { toast(`${job.jobNo} is fully invoiced (${fmt(f.contract)}).`, 'info', 'Nothing left to bill'); return; }
    const JBc = JB();
    const open = acceptedWccs();
    const type = opts.type || (opts.wccId ? JBc.JOB_INVOICE_TYPES.progress
      : f.goodsValue <= 0.005 && f.advances.invoiced <= 0.005 ? JBc.JOB_INVOICE_TYPES.advance
      : f.certifiedPct >= 100 ? JBc.JOB_INVOICE_TYPES.final : JBc.JOB_INVOICE_TYPES.progress);
    I = {
      job, type, basis: opts.wccId ? 'wcc' : '', wccId: opts.wccId || (open[0] ? open[0].id : ''),
      percent: '', amount: '', date: todayISO(), dueDate: '', lineText: '', zohoNo: '', notes: '',
      deduction: '', dedTouched: false, saving: false,
    };
    if (I.type === JBc.JOB_INVOICE_TYPES.advance && !billingPerm('advance').ok) I.type = JBc.JOB_INVOICE_TYPES.progress;
    fixBasis();
    ensureInvModal();
    paintInv();
    if (!$('job-inv-modal').classList.contains('open')) openModalWithSize('job-inv-modal');
  }
  function paintInv() {
    const JBc = JB(), j = I.job, f = financeOf(j);
    const T = JBc.JOB_INVOICE_TYPES;
    $('ji-sub').textContent = [j.jobNo, j.company, j.poNo ? 'PO ' + j.poNo : '', `Contract ${fmt(f.contract)} excl. VAT`].filter(Boolean).join(' · ');
    const advPerm = billingPerm('advance');
    const seg = (k, label) => {
      const off = k === T.advance && !advPerm.ok;
      return `<button type="button" class="wcc-seg${I.type === k ? ' on' : ''}" data-jitype="${k}"${off ? ` disabled title="${esc(advPerm.why || 'Not allowed for your role')}"` : ''}>${label}</button>`;
    };
    const open = acceptedWccs();
    const basisCard = (v, title, note, on, extra) => `<button type="button" class="ji-basis${on ? ' on' : ''}" data-jibasis="${v}"${extra || ''}><b>${title}</b><small>${note}</small></button>`;
    const advance = I.type === T.advance, final = I.type === T.final;
    const body = [];
    body.push(`<div class="ji-top">
<div class="wcc-f"><label>Invoice type</label><div class="wcc-segs">${seg(T.advance, 'Advance')}${seg(T.progress, 'Progress')}${seg(T.final, 'Full &amp; Final')}</div></div>
<div class="wcc-f"><label for="ji-date">Invoice date *</label><input id="ji-date" type="date" value="${esc(I.date)}"></div>
<div class="wcc-f"><label for="ji-due">Due date</label><input id="ji-due" type="date" value="${esc(I.dueDate)}"></div></div>`);

    if (final) {
      const needs = window.BizCoreWcc && window.BizCoreWcc.settings && window.BizCoreWcc.settings.finalNeedsWcc;
      const okFinal = !!f.finalWcc;
      body.push(`<div class="ji-note ${okFinal ? 'good' : needs ? 'bad' : 'warn'}"><i class="ti ${okFinal ? 'ti-circle-check' : 'ti-alert-triangle'}"></i><span>${okFinal
        ? `<b>Final certificate accepted</b> — ${esc(f.finalWcc.wccNo)}, 100 %, accepted by ${esc((f.finalWcc.acceptance || {}).by || '—')}${(f.finalWcc.acceptance || {}).date ? ' on ' + dmy(f.finalWcc.acceptance.date) : ''}.<br>This invoice bills everything still open and deducts the whole remaining advance.`
        : needs ? '<b>A final Work Completion Certificate accepted by the customer is required</b> before the final invoice (Administration → Billing Settings).'
          : '<b>The final certificate is not accepted yet.</b> You can still invoice — make the final WCC and have it signed as soon as you can.'}</span></div>`);
    } else if (!advance) {
      body.push(`<div class="wb-box ji-for"><div class="wb-box-hd"><div><h4>Bill for</h4><p>What this progress invoice charges. It can never bring the total past the contract value.</p></div></div>
<div class="ji-basis-row">
${open.length ? open.slice(0, 2).map(w => basisCard('wcc', 'Accepted WCC', `${esc(w.wccNo)} · ${w.stage ? esc(w.stage) + ' · ' : ''}${pct1(w.overallPct)} certified<br>Not yet billed: ${fmt(Math.max(0, r2(f.contract * num(w.overallPct) / 100 - f.goodsValue)))}`, I.basis === 'wcc' && String(I.wccId) === String(w.id), ` data-id="${esc(w.id)}"`)).join('')
        : basisCard('wcc', 'Accepted WCC', 'No accepted certificate is waiting to be billed.', false, ' disabled')}
${basisCard('percent', '% of contract', `Type a percentage, e.g. 30 % of ${fmt(f.contract)}`, I.basis === 'percent')}
${basisCard('amount', 'Amount', `Any amount up to the ${fmt(f.workLeft)} still to invoice`, I.basis === 'amount')}
</div></div>`);
    } else {
      body.push(`<div class="wb-box ji-for"><div class="wb-box-hd"><div><h4>Advance</h4><p>A down payment before or during the work. It is deducted from the later invoices.</p></div></div>
<div class="ji-basis-row">${basisCard('percent', '% of contract', `e.g. 20 % of ${fmt(f.contract)}`, I.basis === 'percent')}${basisCard('amount', 'Amount', `Any amount up to ${fmt(f.roomTotal)}`, I.basis === 'amount')}</div></div>`);
    }

    if (!final) {
      const showPct = I.basis === 'percent', showAmt = I.basis === 'amount';
      body.push(`<div class="ji-inputs${showPct || showAmt ? '' : ' only-help'}">
${showPct ? `<div class="wcc-f"><label for="ji-pct">This invoice % *</label><input id="ji-pct" inputmode="decimal" maxlength="6" class="r" value="${esc(I.percent)}" placeholder="0.00"></div>` : ''}
${showAmt ? `<div class="wcc-f"><label for="ji-amt">Amount (excl. VAT) *</label><input id="ji-amt" inputmode="decimal" maxlength="14" class="r" value="${esc(I.amount)}" placeholder="0.00"></div>` : ''}
<div class="ji-help" id="ji-help"></div></div>`);
    }
    body.push(`<div class="wcc-f"><label for="ji-line">Invoice line (printed)</label><textarea id="ji-line" rows="2" maxlength="1200" placeholder="Left empty, BizCore writes it from the type, the percentage and the certificate.">${esc(I.lineText)}</textarea></div>`);
    if (!advance) body.push(`<div class="wb-box ji-ded"><div class="wb-box-hd"><div><h4>Advance deduction</h4><p id="ji-ded-note"></p></div></div><div class="ji-ded-row"><div class="wcc-f"><label for="ji-ded">Deduct now</label><input id="ji-ded" inputmode="decimal" maxlength="14" class="r" value="${esc(I.deduction)}"></div><div class="ji-help" id="ji-ded-help"></div></div></div>`);
    body.push(`<div class="ji-two"><div class="wcc-f"><label for="ji-zoho">Zoho Books invoice no.</label><input id="ji-zoho" maxlength="100" value="${esc(I.zohoNo)}" placeholder="Optional now, needed before sending"></div>
<div class="wcc-f"><label for="ji-notes">Notes (printed)</label><input id="ji-notes" maxlength="2000" value="${esc(I.notes)}"></div></div>`);
    body.push('<div class="ji-sum" id="ji-sum"></div>');
    $('ji-body').innerHTML = body.join('');
    if (window.BCDate) {
      BCDate.attach($('ji-date'), { allowEmpty: false, max: () => BCDate.today(), onCommit: () => { readInv(); paintInvTotals(); } });
      BCDate.attach($('ji-due'), { allowEmpty: true, min: () => I.date || '', onCommit: () => { readInv(); paintInvTotals(); } });
    }
    readInv(); paintInvTotals();
  }
  function readInv() {
    if (!I) return;
    const v = id => { const el = $(id); return el ? el.value : ''; };
    const d = id => { const el = $(id); return el ? (window.BCDate ? BCDate.getISO(el) || '' : el.value) : ''; };
    I.date = d('ji-date') || I.date;
    I.dueDate = d('ji-due');
    I.percent = v('ji-pct'); I.amount = v('ji-amt');
    I.lineText = v('ji-line'); I.zohoNo = v('ji-zoho'); I.notes = v('ji-notes');
    if ($('ji-ded')) I.deduction = v('ji-ded');
  }
  /** → { priced, limits, totals, why } for the current form. */
  function priceInv() {
    const JBc = JB(), T = JBc.JOB_INVOICE_TYPES;
    const f = financeOf(I.job);
    try {
      if (I.type === T.advance) {
        const priced = JBc.priceJobAdvance(f, { method: I.basis === 'amount' ? 'amount' : 'percent', percent: I.percent, amount: I.amount });
        return { f, priced, limits: null, totals: { work: priced.amount, ded: 0, subtotal: priced.amount, vat: priced.vat, total: r2(priced.amount + priced.vat) }, why: '' };
      }
      const wcc = (B.wccs || []).find(w => String(w.id) === String(I.wccId));
      const priced = JBc.priceJobWork(f, I.type, { basis: I.basis, wccId: I.wccId, percent: I.percent, amount: I.amount }, wcc ? [wcc] : []);
      const limits = JBc.jobDeductionLimits(f, priced.subtotal);
      const chosen = I.dedTouched && String(I.deduction || '').trim() !== '' ? num(I.deduction) : limits.proposal;
      let ded = chosen, why = '';
      try { ded = JBc.checkJobDeduction(limits, chosen); }
      catch (e) { why = e.message; ded = limits.proposal; }
      const vatWork = priced.vat, vatDed = r2(ded * (f.vatRate || 0));
      return {
        f, priced, limits, wcc,
        totals: { work: priced.subtotal, ded, subtotal: r2(priced.subtotal - ded), vat: r2(vatWork - vatDed), total: r2(priced.subtotal - ded + vatWork - vatDed) },
        why,
      };
    } catch (e) { return { f, why: e.message }; }
  }
  function paintInvTotals() {
    const JBc = JB(), T = JBc.JOB_INVOICE_TYPES;
    const p = priceInv(), f = p.f;
    if ($('ji-help')) {
      $('ji-help').innerHTML = p.why ? '' : I.type === T.advance
        ? `At most <b>${fmt(f.roomTotal)}</b> can still be billed on this job.`
        : `Certified ${pct1(f.certifiedPct)} − already invoiced ${pct1(f.invoicedPct)} = <b>${fmt(f.workCertifiedLeft)}</b> certified and not billed. ${fmt(f.workLeft)} of the contract is still to invoice.`;
    }
    if ($('ji-ded-note') && p.limits) {
      $('ji-ded-note').innerHTML = f.advances.remaining > 0.005
        ? `Advance remaining <b>${fmt(f.advances.remaining)}</b>. ${p.limits.isFinal ? 'This invoice completes the contract, so all of it must be deducted.' : `Suggested in proportion: <b>${fmt(p.limits.proposal)}</b>${p.limits.min > 0.005 ? ` · at least ${fmt(p.limits.min)}` : ''} · at most ${fmt(p.limits.max)}.`}`
        : 'No advance is open on this job.';
      if (!I.dedTouched && $('ji-ded') && document.activeElement !== $('ji-ded')) $('ji-ded').value = p.limits ? fmt(p.limits.proposal) : '';
      if ($('ji-ded')) $('ji-ded').disabled = f.advances.remaining <= 0.005 || p.limits.isFinal;
      if ($('ji-ded-help')) $('ji-ded-help').innerHTML = p.why ? `<span class="bad">${esc(p.why)}</span>` : '';
    }
    const t = p.totals;
    const after = p.priced ? {
      goods: r2(f.goodsValue + (I.type === T.advance ? 0 : t.work)),
      advLeft: r2(Math.max(0, f.advances.remaining - (t ? t.ded : 0) + (I.type === T.advance ? t.work : 0))),
    } : null;
    const row = (k, v, cls) => `<div class="${cls || ''}"><span>${k}</span><b>${v}</b></div>`;
    $('ji-sum').innerHTML = !t ? `<div class="ji-sum-bad">${esc(p.why || 'Enter the amount to invoice.')}</div>` : `<div class="ji-sum-grid">
<div class="ji-sum-card"><h4>This invoice</h4>
${row(I.type === T.advance ? 'Advance' : `Work billed${p.priced.percent ? ' (' + pct1(p.priced.percent) + ')' : ''}`, fmt(t.work))}
${t.ded > 0.005 ? row('Less advance deducted', '− ' + fmt(t.ded), 'ded') : ''}
${row('Subtotal (excl. VAT)', fmt(t.subtotal), 'sub')}
${row(`VAT ${Math.round((f.vatRate || 0) * 100)} %`, fmt(t.vat))}
${row('Total (SAR)', fmt(t.total), 'grand')}</div>
<div class="ji-sum-card dim"><h4>Job after saving</h4>
${row('Contract', fmt(f.contract))}
${row('Invoiced (work)', `${fmt(after.goods)} · ${pct1(f.contract > 0 ? after.goods / f.contract * 100 : 0)}`)}
${row('Advance left to deduct', fmt(after.advLeft))}
${row('Still to invoice', fmt(Math.max(0, r2(f.contract - after.goods))))}
<p class="ji-cap">Work + advances − deductions can never pass the contract value — the same rules as the Sales Order invoices.</p></div></div>`;
    const chk = $('ji-chk');
    const why = p.why || (!t ? 'enter the amount' : '');
    chk.className = 'wcc-chk ' + (why ? 'bad' : 'ok');
    chk.textContent = why ? 'To continue: ' + why : `✓ Ready · ${JBc.jobInvoiceTypeLabel(I.type)}${p.priced.percent ? ' ' + pct1(p.priced.percent) : ''} · total ${fmt(t.total)}`;
    $('ji-save').disabled = !!why || I.saving;
  }
  async function saveInvoice() {
    if (!I || I.saving) return;
    readInv();
    const JBc = JB(), T = JBc.JOB_INVOICE_TYPES;
    const p = priceInv();
    if (p.why || !p.totals) { toast(p.why || 'Enter the amount to invoice.', 'warning'); paintInvTotals(); return; }
    if (navigator.onLine === false) { toast('You are offline. An invoice gets its number when you are online — connect and try again.', 'error'); return; }
    const parts = (typeof docNumberParts === 'function' ? docNumberParts('customerInvoice') : null);
    if (!parts) { toast('The invoice numbering is not set up (Administration → Numbering).', 'error'); return; }
    const t = p.totals;
    const ok = await new Promise(res => showConfirm({
      icon: '🧾', title: 'Issue this invoice?', message: 'A tax invoice cannot be changed afterwards — it is corrected with a credit note.',
      details: {
        'Job': I.job.jobNo, 'Customer': I.job.company || '—', 'Type': JBc.jobInvoiceTypeLabel(I.type),
        [I.type === T.advance ? 'Advance' : 'Work billed']: fmt(t.work),
        ...(t.ded > 0.005 ? { 'Advance deducted': '− ' + fmt(t.ded) } : {}),
        'Total incl. VAT': fmt(t.total), 'Date': dmy(I.date),
      },
      confirmText: 'Save Invoice', cancelText: 'Go back', confirmClass: 'btn-primary', onConfirm: () => res(true), onCancel: () => res(false),
    }));
    if (!ok) return;
    I.saving = true; $('ji-save').disabled = true;
    if (typeof showBusyOverlay === 'function') showBusyOverlay('job-inv-modal', 'Saving…');
    try {
      const input = {
        operationId: newOpId('jobinv', I.job.id), jobId: String(I.job.id), type: I.type, numbering: parts.numbering,
        date: I.date, dueDate: I.dueDate, lineText: I.lineText, zohoNo: I.zohoNo, notes: I.notes,
      };
      if (I.type === T.advance) input.advance = { method: I.basis === 'amount' ? 'amount' : 'percent', percent: I.percent, amount: I.amount };
      else {
        input.work = { basis: I.basis, wccId: I.wccId, percent: I.percent, amount: I.amount };
        if (I.basis === 'wcc') input.wccId = I.wccId;
        input.deduction = t.ded;
      }
      const res = await SVC().service.invoiceService.issueJobInvoice(input);
      forget(I.job.id);
      if (typeof upsertInvoiceCache === 'function') upsertInvoiceCache(res.invoice);
      if (typeof refreshAfterInvoiceChange === 'function') refreshAfterInvoiceChange();
      closeModal('job-inv-modal');
      toast(`${res.invoice.invNo} issued · ${fmt((res.invoice.totals || {}).total)}`, 'success', 'Invoice issued');
      const job = I.job;
      await loadFor(job, true);
      if (typeof openInvoiceView === 'function') openInvoiceView(res.invoice.id);
      else await reopenJob(job, 'wb');
    } catch (e) {
      toast(errMsg(e), 'error', 'Not issued');
    } finally {
      I.saving = false;
      if (typeof hideBusyOverlay === 'function') hideBusyOverlay('job-inv-modal');
      if ($('ji-save')) paintInvTotals();
    }
  }

  /** Credit note on a job invoice (from the invoice view). */
  function openJobCreditNote(invoiceId) {
    const inv = (typeof invoicesCache !== 'undefined' ? invoicesCache : []).find(i => i.id === invoiceId);
    if (!inv || !inv.jobId) { toast('This invoice is not loaded yet.', 'warning'); return; }
    const cp = billingPerm('credit');
    if (!cp.ok) { toast(cp.why || 'Your role cannot issue credit notes.', 'warning'); return; }
    const left = JB().jobCreditableOf(inv);
    let m = $('job-cn-modal');
    if (!m) { m = document.createElement('div'); m.className = 'modal-overlay'; m.id = 'job-cn-modal'; document.body.appendChild(m); }
    m.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="jc-title">
<div class="modal-header"><div class="modal-header-title-wrap"><h2 id="jc-title">Credit note on ${esc(inv.invNo)}</h2><div class="jb-sub">${esc(inv.jobNo || '')} · ${esc(inv.customer || '')}</div></div><button type="button" class="close-btn" onclick="closeModal('job-cn-modal')" aria-label="Close">✕</button></div>
<div class="modal-body"><p class="jv-pnote">${left.kind === 'advance' ? 'Credits the part of the advance that has not been deducted yet.' : 'Credits work billed on this invoice. Its advance deduction is reversed in proportion, so the job stays right.'}</p>
<div class="ji-two"><div class="wcc-f"><label for="jc-amt">Amount to credit (excl. VAT) *</label><input id="jc-amt" inputmode="decimal" maxlength="14" class="r" value="${fmt(left.left)}"></div>
<div class="wcc-f"><label for="jc-date">Credit note date *</label><input id="jc-date" type="date" value="${esc(todayISO())}"></div></div>
<p class="ji-help">At most <b>${fmt(left.left)}</b> can still be credited on this invoice.</p>
<div class="wcc-f"><label for="jc-why">Reason *</label><textarea id="jc-why" rows="2" maxlength="600"></textarea></div>
<div class="inv-error" id="jc-err" hidden></div></div>
<div class="modal-footer"><button type="button" class="btn btn-secondary" onclick="closeModal('job-cn-modal')">Cancel</button><button type="button" class="btn btn-danger" id="jc-save"><i class="ti ti-receipt-refund"></i>Issue Credit Note</button></div></div>`;
    if (window.BCDate) BCDate.attach($('jc-date'), { allowEmpty: false, max: () => BCDate.today() });
    $('jc-save').onclick = async () => {
      const amount = num($('jc-amt').value), reason = $('jc-why').value.trim();
      const date = window.BCDate ? (BCDate.getISO($('jc-date')) || '') : $('jc-date').value;
      const bad = amount <= 0 ? 'Enter the amount to credit.' : amount > left.left + 0.005 ? `At most ${fmt(left.left)} can be credited.` : reason.length < 3 ? 'Write why the invoice is credited.' : '';
      if (bad) { $('jc-err').hidden = false; $('jc-err').textContent = bad; return; }
      const parts = (typeof docNumberParts === 'function' ? docNumberParts('creditNote') : null);
      if (!parts) { $('jc-err').hidden = false; $('jc-err').textContent = 'The credit note numbering is not set up.'; return; }
      $('jc-err').hidden = true; $('jc-save').disabled = true;
      try {
        const res = await SVC().service.invoiceService.issueJobCreditNote({
          operationId: newOpId('jobcn', inv.id), jobId: String(inv.jobId), invoiceId: String(inv.id),
          numbering: parts.numbering, date, amount, reason, expectedRevision: inv.revision,
        });
        forget(inv.jobId);
        if (typeof upsertCreditNoteCache === 'function') upsertCreditNoteCache(res.creditNote);
        if (typeof upsertInvoiceCache === 'function') upsertInvoiceCache(res.invoice);
        if (typeof refreshAfterInvoiceChange === 'function') refreshAfterInvoiceChange();
        closeModal('job-cn-modal');
        toast(`${res.creditNote.cnNo} issued · ${fmt(res.creditNote.total)}`, 'success', 'Credit note issued');
        if (typeof openCreditNoteView === 'function') openCreditNoteView(res.creditNote.id);
      } catch (e) { $('jc-err').hidden = false; $('jc-err').textContent = errMsg(e); $('jc-save').disabled = false; }
    };
    openModalWithSize('job-cn-modal');
  }

  /* ── the Jobs register monitor: how many jobs are waiting to be invoiced ── */
  function toInvoiceCount(list) {
    // Without the ledger of every job this is what is certainly billable: a job whose invoices come to
    // less than its contract value and which is not closed or cancelled.
    const open = (list || []).filter(j => j && !/^(closed|cancelled)$/i.test(String(j.status || '')));
    return open.filter(j => {
      const invs = invoicesOfJob(j.id).filter(i => !/^credited$/i.test(i.status || ''));
      const billed = invs.reduce((s, i) => s + num((i.totals || {}).goodsSubtotal), 0);
      return num(j.contractValue) > 0 && billed < num(j.contractValue) - 0.005;
    }).length;
  }

  window.BCJobBilling = {
    loadFor, forget, tabHtml, onTabClick,
    openNewWcc, openWccView, openAcceptance, openCancelWcc, printWcc, wccDocumentHtml,
    openNewJobInvoice, openJobCreditNote, toInvoiceCount,
    stateOf, financeOf, invoicesOfJob,
    get data() { return B; },
  };
})();
