/* ═══════════════════════════════════════════════════════════════
   V271.2 — Contracting Jobs (approved mockup CJ_1 · docs/V271_2_QUOTE_JOB.md)
   A won Contracting quotation made from an estimate becomes a Job (not a Sales Order):
     Create Job — customer PO No. + PO Date (required), start / planned finish, site in-charge (Employee Master), notes
     (retention, payment terms …). The contract value is the quotation's total before VAT; the budget is the estimate's
     cost by type (material, manpower, subcontract, equipment / other) + overheads + contingency.
   jobs/{id}  { id, jobNo, status, date, quotationId, qno, rfqId, rfqNo, estimateVersion, custId, company, project,
                poNo, poDate, startDate, finishDate, siteInChargeId, siteInCharge, contractValue, vatRate, budget{…},
                plannedProfit, notes, created, createdBy, updated }
   Number on save (Administration → Numbering: Job, JOB-YYMM-NNNN) — online only. The quotation keeps jobId / jobNo.
   Jobs → register (open + last 12 months, like the other registers) and a Job summary view. Estimate vs actual,
   job expenses and job invoicing follow in V271.3 / V271.4.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.BCJobs) return;
  const $ = id => document.getElementById(id);
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = v => { const n = Number(String(v == null ? '' : v).replace(/,/g, '')); return Number.isFinite(n) ? n : 0; };
  const r2 = n => Math.round((Number(n) || 0) * 100 + 1e-7) / 100;
  const fmt = n => (typeof formatNumber === 'function' ? formatNumber(Number(n) || 0, 2) : (Number(n) || 0).toFixed(2));
  const dmy = iso => (window.BCDate ? BCDate.format(String(iso || '').slice(0, 10)) : String(iso || '')) || '—';
  const toast = (m, t, h) => { if (typeof showToast === 'function') showToast(m, t || 'info', h); };
  const low = v => String(v || '').trim().toLowerCase();
  const who = () => { try { const u = window.currentUser || {}; return u.displayName || u.name || u.email || ''; } catch (e) { return ''; } };
  const QUOTES = () => { try { return typeof quotations !== 'undefined' ? quotations : []; } catch (e) { return []; } };
  const EMPLOYEES = () => { try { return (typeof employees !== 'undefined' ? employees : []).filter(e => e && e.active !== false && !e._deletedAt); } catch (e) { return []; } };
  const STATUSES = ['Open', 'In Progress', 'Completed', 'Closed', 'Cancelled'];
  const ST_CLS = { Open: 'blue', 'In Progress': 'amber', Completed: 'green', Closed: 'gray', Cancelled: 'red' };
  const KINDS = [['material', 'Material', '#2e75b6'], ['manpower', 'Manpower (Hired)', '#ea6a10'], ['subcontract', 'Subcontract', '#0f766e'], ['other', 'Equipment / Other', '#94a3b8']];

  /* ── data (read when the Jobs screen or a job is first needed — nothing at sign-in) ── */
  let jobs = [], loaded = false, loading = null;
  function load() {
    if (loaded) return Promise.resolve(jobs);
    if (loading) return loading;
    loading = (async () => {
      if (!window.FB) { loaded = true; return jobs; }
      const got = await window.FB.fbLoad('jobs');
      if (Array.isArray(got)) jobs = got;
      loaded = true;   // read once — no live listener (Firebase free allowance); the register re-reads on Refresh
      return jobs;
    })().finally(() => { loading = null; });
    return loading;
  }

  /* ══ Create Job / Edit Details (CJ_1) ══ */
  function ensureDialog() {
    if ($('job-modal')) return;
    const m = document.createElement('div');
    m.className = 'modal-overlay'; m.id = 'job-modal';
    m.innerHTML = `<div class="modal modal-normal jb-win" role="dialog" aria-modal="true" aria-labelledby="jb-title">
<div class="modal-header jb-hd"><div><h2 id="jb-title">Create Job</h2><div class="jb-sub" id="jb-sub"></div></div><span class="pr-pill jb-pill" id="jb-no-pill">Job No. Auto on Save</span><button type="button" class="close-btn" id="jb-x" aria-label="Close">✕</button></div>
<div class="modal-body jb-body">
<div class="jb-grid">
<div class="jb-f"><label for="jb-po">Customer PO No. <b class="jb-req">*</b></label><input id="jb-po" maxlength="60" autocomplete="off"></div>
<div class="jb-f"><label for="jb-podate">PO Date <b class="jb-req">*</b></label><input id="jb-podate" autocomplete="off"></div>
<div class="jb-f"><label>Contract Value (excl. VAT)</label><input id="jb-value" disabled></div>
<div class="jb-f"><label for="jb-start">Start Date</label><input id="jb-start" autocomplete="off"></div>
<div class="jb-f"><label for="jb-finish">Planned Finish</label><input id="jb-finish" autocomplete="off"></div>
<div class="jb-f"><label for="jb-incharge">Site In-charge (Employee)</label><select id="jb-incharge"></select></div>
<div class="jb-f jb-st" id="jb-st-wrap" hidden><label for="jb-status">Status</label><select id="jb-status">${STATUSES.map(s => `<option>${s}</option>`).join('')}</select></div>
<div class="jb-f jb-wide"><label for="jb-notes">Notes (retention, payment terms, site rules …)</label><textarea id="jb-notes" rows="2" maxlength="1000"></textarea></div>
</div>
<div class="jb-budget" id="jb-budget"></div>
</div>
<div class="modal-footer jb-ft"><span class="jb-chk" id="jb-chk"></span><span class="jb-sp"></span><button type="button" class="btn btn-secondary" id="jb-cancel">Cancel</button><button type="button" class="btn btn-primary" id="jb-save">Create Job</button></div></div>`;
    document.body.appendChild(m);
    const close = () => closeModal('job-modal');
    $('jb-x').onclick = close; $('jb-cancel').onclick = close;
    $('jb-save').onclick = () => saveJob();
    if (window.BCDate) {
      BCDate.attach($('jb-podate'), { allowEmpty: true, max: () => BCDate.today(), onCommit: check });
      BCDate.attach($('jb-start'), { allowEmpty: true, onCommit: check });
      BCDate.attach($('jb-finish'), { allowEmpty: true, min: () => getD('jb-start') || '', onCommit: check });
    }
    m.addEventListener('input', check); m.addEventListener('change', check);
  }
  const getD = id => (window.BCDate ? BCDate.getISO($(id)) || '' : String($(id)?.value || ''));
  const setD = (id, iso) => { if (window.BCDate) BCDate.setISO($(id), iso || ''); else $(id).value = iso || ''; };
  let D = null;   // { mode:'create'|'edit', q, job }
  function budgetHtml(b, value) {
    if (!b) return '<div class="jb-empty">No budget — this quotation was not made from an estimate.</div>';
    const tot = num(b.totalCost) || 1, profit = r2(value - num(b.totalCost));
    const row = (label, v, dot) => `<tr><td>${dot ? `<i class="jb-d" style="background:${dot}"></i>` : ''}${label}</td><td class="r">${fmt(v)}</td><td class="r">${(num(v) / tot * 100).toFixed(1)} %</td></tr>`;
    return `<table class="jb-tbl"><thead><tr><th>Budget (from the estimate)</th><th class="r">Amount</th><th class="r">Share</th></tr></thead><tbody>
${KINDS.map(([k, l, c]) => row(l, b[k], c)).join('')}${row('Overheads', b.overhead)}${row('Contingency', b.contingency)}
<tr class="jb-tot"><td>Total Budget</td><td class="r">${fmt(b.totalCost)}</td><td></td></tr>
<tr class="jb-pf${profit < 0 ? ' neg' : ''}"><td>Planned Profit</td><td class="r">${fmt(profit)}</td><td class="r">${value > 0 ? (profit / value * 100).toFixed(2) : '0.00'} %</td></tr></tbody></table>`;
  }
  function fillInCharge(sel) {
    const list = EMPLOYEES().slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    $('jb-incharge').innerHTML = '<option value="">— Not chosen —</option>' + list.map(e => `<option value="${esc(e.id)}"${String(e.id) === String(sel || '') ? ' selected' : ''}>${esc(e.name || '')}${e.designation ? ' — ' + esc(e.designation) : ''}</option>`).join('');
  }
  function contractOf(q) { try { return r2(calcQuote(q).bvat); } catch (e) { return 0; } }
  async function openCreate(qid) {
    const q = QUOTES().find(x => x.id === qid); if (!q) return;
    if (!q.estimate) { toast('Only a Contracting quotation made from an estimate becomes a Job.', 'error'); return; }
    if (q.jobId) { view(q.jobId); return; }
    if (q.status !== 'Won') { toast('Mark the quotation as Won first.', 'info'); return; }
    if (typeof window.bcCan === 'function' && !window.bcCan('salesOrder', 'c')) { toast('Your role cannot create jobs (Sales Orders → Create).', 'error'); return; }
    ensureDialog();
    D = { mode: 'create', q };
    $('jb-title').textContent = 'Create Job — ' + (q.qno || '');
    $('jb-sub').textContent = [q.company, q.project || q.estimate.site].filter(Boolean).join(' · ');
    $('jb-no-pill').textContent = 'Job No. Auto on Save';
    $('jb-st-wrap').hidden = true;
    ['jb-po', 'jb-notes'].forEach(id => { $(id).value = ''; });
    setD('jb-podate', ''); setD('jb-start', ''); setD('jb-finish', '');
    fillInCharge('');
    const value = contractOf(q);
    $('jb-value').value = fmt(value);
    $('jb-budget').innerHTML = budgetHtml(q.estimate.budget, value);
    $('jb-save').textContent = 'Create Job';
    check();
    if (typeof closeModal === 'function') closeModal('view-modal');
    openModalWithSize('job-modal');
    setTimeout(() => $('jb-po').focus(), 60);
  }
  function openEdit(id) {
    const j = jobs.find(x => x.id === id); if (!j) return;
    if (typeof window.bcCan === 'function' && !(window.bcCan('salesOrder', 'e') || window.bcCan('salesOrder', 'c'))) { toast('Your role cannot change jobs.', 'error'); return; }
    ensureDialog();
    D = { mode: 'edit', job: j };
    $('jb-title').textContent = 'Edit Job — ' + j.jobNo;
    $('jb-sub').textContent = [j.company, j.project].filter(Boolean).join(' · ');
    $('jb-no-pill').textContent = j.jobNo;
    $('jb-st-wrap').hidden = false; $('jb-status').value = j.status || 'Open';
    $('jb-po').value = j.poNo || ''; $('jb-notes').value = j.notes || '';
    setD('jb-podate', j.poDate); setD('jb-start', j.startDate); setD('jb-finish', j.finishDate);
    fillInCharge(j.siteInChargeId);
    $('jb-value').value = fmt(j.contractValue);
    $('jb-budget').innerHTML = budgetHtml(j.budget, num(j.contractValue));
    $('jb-save').textContent = 'Save Changes';
    check();
    closeModal('job-view-modal');
    openModalWithSize('job-modal');
  }
  function problems() {
    const out = [];
    if (!String($('jb-po').value || '').trim()) out.push('Enter the customer PO No.');
    if (!getD('jb-podate')) out.push('Enter the PO date');
    const s = getD('jb-start'), f = getD('jb-finish');
    if (s && f && f < s) out.push('Planned finish is before the start');
    return out;
  }
  function check() {
    if (!$('jb-chk')) return;
    const p = problems();
    $('jb-chk').className = 'jb-chk' + (p.length ? ' is-todo' : '');
    $('jb-chk').textContent = p.length ? 'To continue: ' + p.map((x, i) => '①②③'[i] + ' ' + x).join('  ') : '✓ Ready · PO No. and PO Date entered';
    $('jb-save').disabled = !!p.length; $('jb-save').title = p[0] || '';
  }
  let saving = false;
  async function saveJob() {
    if (saving || problems().length) return;
    const emp = EMPLOYEES().find(e => String(e.id) === String($('jb-incharge').value));
    const fields = { poNo: $('jb-po').value.trim(), poDate: getD('jb-podate'), startDate: getD('jb-start'), finishDate: getD('jb-finish'),
      siteInChargeId: emp ? emp.id : '', siteInCharge: emp ? emp.name || '' : '', notes: $('jb-notes').value.trim() };
    if (D.mode === 'edit') {
      const j = D.job, next = { ...j, ...fields, status: $('jb-status').value || j.status, updated: new Date().toISOString(), updatedBy: who() };
      saving = true;
      try {
        const ok = window.FB ? await window.FB.fbSaveRecordWith('jobs', next) : true;
        if (!ok) { toast('The job was not saved — please try again.', 'error'); return; }
        Object.assign(j, next); closeModal('job-modal'); toast(j.jobNo + ' updated', 'success'); renderRegister(); view(j.id);
      } finally { saving = false; }
      return;
    }
    const q = D.q, value = contractOf(q);
    if (navigator.onLine === false) { toast('You are offline. A job gets its number when you are online — connect and try again.', 'error'); return; }
    const ok = await new Promise(res => showConfirm({ icon: '🏗️', title: 'Create the job?', message: 'The job starts with the estimate as its budget.',
      details: { 'Quotation': q.qno, 'Customer': q.company, 'Customer PO': fields.poNo + ' · ' + dmy(fields.poDate), 'Contract value (excl. VAT)': fmt(value), 'Budget': fmt(q.estimate.budget?.totalCost || 0) },
      confirmText: 'Create Job', cancelText: 'Go back', confirmClass: 'btn-primary', onConfirm: () => res(true), onCancel: () => res(false) }));
    if (!ok) return;
    saving = true;
    if (typeof showBusyOverlay === 'function') showBusyOverlay('job-modal', 'Creating the job…');
    try {
      await load();
      const jobNo = typeof allocateDocumentNumber === 'function' ? await allocateDocumentNumber('job') : 'JOB-' + Date.now();
      if (typeof isProvisionalNumber === 'function' && isProvisionalNumber(jobNo)) { toast('The job number could not be given (no connection). Nothing was saved — try again.', 'error'); return; }
      const now = new Date().toISOString(), b = q.estimate.budget || {};
      const job = { id: jobNo, jobNo, status: 'Open', date: (typeof bcLocalISO === 'function' ? bcLocalISO() : now.slice(0, 10)),
        quotationId: q.id, qno: q.qno || '', rfqId: q.rfqId || q.estimate.rfqId || '', rfqNo: q.estimate.rfqNo || '', estimateVersion: Number(q.estimate.version) || 1,
        custId: q.custId || '', company: q.company || '', project: q.project || q.estimate.site || '', ...fields,
        contractValue: value, vatRate: (typeof getQuoteVatPercent === 'function' ? getQuoteVatPercent(q) : 15),
        budget: { material: num(b.material), manpower: num(b.manpower), subcontract: num(b.subcontract), other: num(b.other), overhead: num(b.overhead), contingency: num(b.contingency), totalCost: num(b.totalCost) },
        plannedProfit: r2(value - num(b.totalCost)), created: now, createdBy: who(), updated: now };
      const saved = window.FB ? await window.FB.fbSaveRecordWith('jobs', job) : true;
      if (!saved) { toast(typeof rfqSaveFailedMessage === 'function' ? rfqSaveFailedMessage() : 'The job was not saved — please try again.', 'error', 'Job not saved'); return; }
      jobs.unshift(job);
      q.jobId = job.id; q.jobNo = jobNo; q.updated = now;
      if (typeof saveQuotations === 'function') await saveQuotations();
      closeModal('job-modal');
      toast(`Job ${jobNo} created`, 'success', 'Saved');
      try { if (typeof renderAll === 'function') renderAll(); } catch (_) {}
      view(job.id);
    } finally { saving = false; if (typeof hideBusyOverlay === 'function') hideBusyOverlay('job-modal'); }
  }

  /* ══ Job view (a summary for now — the full Estimate vs Actual view comes with V271.3) ══ */
  function ensureView() {
    if ($('job-view-modal')) return;
    const m = document.createElement('div');
    m.className = 'modal-overlay'; m.id = 'job-view-modal';
    m.innerHTML = `<div class="modal modal-normal jv-win" role="dialog" aria-modal="true" aria-labelledby="jv-title"><div class="modal-header jb-hd"><div><h2 id="jv-title">Job</h2><div class="jb-sub" id="jv-sub"></div></div><span class="pr-pill" id="jv-st"></span><button type="button" class="close-btn" onclick="closeModal('job-view-modal')" aria-label="Close">✕</button></div>
<div class="modal-body jv-body" id="jv-body"></div><div class="modal-footer jb-ft" id="jv-ft"></div></div>`;
    document.body.appendChild(m);
  }
  async function view(id) {
    await load();
    const j = jobs.find(x => x.id === id || x.jobNo === id);
    if (!j) { toast('Job ' + id + ' was not found.', 'error'); return; }
    ensureView();
    $('jv-title').textContent = j.jobNo + (j.project ? ' · ' + j.project : '');
    $('jv-sub').textContent = [j.company, j.poNo ? 'PO ' + j.poNo : '', j.qno, j.startDate ? 'Start ' + dmy(j.startDate) : '', j.finishDate ? 'Planned finish ' + dmy(j.finishDate) : '', j.siteInCharge ? 'In-charge ' + j.siteInCharge : ''].filter(Boolean).join(' · ');
    const st = $('jv-st'); st.textContent = j.status || 'Open'; st.className = 'pr-pill jv-st jv-' + (ST_CLS[j.status] || 'blue');
    const b = j.budget || {};
    $('jv-body').innerHTML = `<div class="jv-cards">
<div class="jv-card dk"><span>Contract Value</span><b>${fmt(j.contractValue)}</b><small>excl. VAT · lump sum</small></div>
<div class="jv-card"><span>Budget (Total Cost)</span><b>${fmt(b.totalCost)}</b><small>from estimate V${esc(j.estimateVersion || 1)}</small></div>
<div class="jv-card"><span>Planned Profit 🔒</span><b class="${num(j.plannedProfit) < 0 ? 'neg' : 'pos'}">${fmt(j.plannedProfit)}</b><small>${num(j.contractValue) > 0 ? (num(j.plannedProfit) / num(j.contractValue) * 100).toFixed(2) + ' % of the contract' : ''}</small></div>
<div class="jv-card"><span>Customer PO</span><b class="jv-po">${esc(j.poNo || '—')}</b><small>${j.poDate ? dmy(j.poDate) : ''}</small></div></div>
<div class="jv-two"><div>${budgetHtml(j.budget, num(j.contractValue))}</div>
<div class="jv-side"><div class="jv-box"><h4>Details</h4>
<div class="jv-kv"><span>Customer</span><b>${esc(j.company || '—')}</b></div><div class="jv-kv"><span>Project / Site</span><b>${esc(j.project || '—')}</b></div>
<div class="jv-kv"><span>Start · Planned finish</span><b>${j.startDate ? dmy(j.startDate) : '—'} · ${j.finishDate ? dmy(j.finishDate) : '—'}</b></div>
<div class="jv-kv"><span>Site in-charge</span><b>${esc(j.siteInCharge || '—')}</b></div>
<div class="jv-kv"><span>Created</span><b>${dmy(j.date)}${j.createdBy ? ' · ' + esc(j.createdBy) : ''}</b></div></div>
${j.notes ? `<div class="jv-box"><h4>Notes</h4><p class="jv-note">${esc(j.notes)}</p></div>` : ''}
<div class="jv-box jv-next"><h4>Coming next</h4><p>Actual costs against this budget (purchase invoices, job expenses), Estimate vs Actual, job invoices and the Work Completion Certificate are added in the next updates.</p></div></div></div>`;
    const canE = typeof window.bcCan !== 'function' || window.bcCan('salesOrder', 'e') || window.bcCan('salesOrder', 'c');
    $('jv-ft').innerHTML = `<button type="button" class="btn btn-secondary" onclick="closeModal('job-view-modal')">Close</button><span class="jb-sp"></span>`
      + (j.rfqId ? `<button type="button" class="btn btn-secondary" data-rid="${esc(j.rfqId)}" onclick="closeModal('job-view-modal');bcOpenEstimate(this.dataset.rid,{version:${Number(j.estimateVersion) || 1}})"><i class="ti ti-calculator"></i>Estimate</button>` : '')
      + `<button type="button" class="btn btn-secondary" data-qid="${esc(j.quotationId)}" onclick="closeModal('job-view-modal');viewQuotation(this.dataset.qid)"><i class="ti ti-file-text"></i>${esc(j.qno || 'Quotation')}</button>`
      + (canE ? `<button type="button" class="btn btn-primary" data-jid="${esc(j.id)}" onclick="BCJobs.openEdit(this.dataset.jid)"><i class="ti ti-edit"></i>Edit Details</button>` : '');
    openModalWithSize('job-view-modal');
  }

  /* ══ Jobs register (Sales → Jobs) ══ */
  const F = { customer: '', status: '', q: '' };
  let built = false;
  function buildPage() {
    const page = $('page-jobs'); if (!page || built) return;
    built = true;
    page.innerHTML = `<div class="dn-register-area module-register-area jb-reg">
<div class="dn-register-toolbar page-toolbar page-toolbar--sticky page-control-bar bc-filterbar" role="toolbar" aria-label="Job filters">
<div class="dn-toolbar-left bc-filterbar-left"><span class="bc-filter-count" id="jbreg-count">0 jobs</span></div>
<div class="dn-toolbar-right bc-filterbar-right">
<select id="jbreg-customer" class="bc-filter bc-filter-customer" aria-label="Filter jobs by customer"><option value="">All customers</option></select>
<select id="jbreg-status" class="bc-filter bc-filter-status" aria-label="Status"><option value="">All statuses</option>${STATUSES.map(s => `<option>${s}</option>`).join('')}</select>
<div class="bc-date" data-bc-date="jbreg" data-bc-date-title="Job date"></div>
<input id="jbreg-q" class="bc-filter bc-filter-search" type="text" placeholder="Search job, customer, project, PO…" aria-label="Search jobs">
<button class="btn btn-secondary btn-sm register-clear-filters bc-filter-btn" id="jbreg-clear" type="button" title="Clear all job filters"><i class="ti ti-filter-off"></i><span>Clear Filters</span></button>
</div></div>
<div class="card dn-register-card"><div class="dn-table-scroll"><table class="jb-reg-table"><thead><tr><th>Job No.</th><th>Date</th><th>Customer</th><th>Project / Site</th><th>Customer PO</th><th class="num">Contract (SAR)</th><th class="num">Budget</th><th>Start</th><th>Planned Finish</th><th>Status</th></tr></thead><tbody id="jbreg-body"></tbody></table></div></div>
<p class="jb-reg-hint">Jobs are created from a won Contracting quotation (Quotation → Create Job). Open and recent jobs are shown; older ones are loaded on request.</p></div>`;
    $('jbreg-customer').onchange = e => { F.customer = e.target.value; paint(); };
    $('jbreg-status').onchange = e => { F.status = e.target.value; paint(); };
    $('jbreg-q').oninput = e => { F.q = e.target.value; paint(); };
    $('jbreg-clear').onclick = () => { F.customer = F.status = F.q = ''; $('jbreg-customer').value = ''; $('jbreg-status').value = ''; $('jbreg-q').value = ''; if (window.BCDateFilter) BCDateFilter.set('jbreg', { preset: 'all' }); paint(); };
    if (window.BCDateFilter) BCDateFilter.register('jbreg', () => paint());
    $('jbreg-body').onclick = e => { const tr = e.target.closest('tr[data-jid]'); if (tr) view(tr.dataset.jid); };
  }
  function paint() {
    const body = $('jbreg-body'); if (!body) return;
    const ds = window.BCDateFilter ? BCDateFilter.get('jbreg') : { from: '', to: '' };
    const q = low(F.q);
    const list = jobs.filter(j => (!F.customer || j.company === F.customer) && (!F.status || j.status === F.status)
      && (!ds.from || String(j.date || '') >= ds.from) && (!ds.to || String(j.date || '') <= ds.to)
      && (!q || [j.jobNo, j.company, j.project, j.poNo, j.qno].some(x => low(x).includes(q))))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.jobNo || '').localeCompare(String(a.jobNo || '')));
    const sel = $('jbreg-customer'), cur = sel.value;
    sel.innerHTML = '<option value="">All customers</option>' + [...new Set(jobs.map(j => j.company).filter(Boolean))].sort().map(c => `<option${c === cur ? ' selected' : ''}>${esc(c)}</option>`).join('');
    $('jbreg-count').textContent = list.length + (list.length === 1 ? ' job' : ' jobs');
    body.innerHTML = list.length ? list.map(j => `<tr class="master-clickable-row" data-jid="${esc(j.id)}" tabindex="0"><td><b>${esc(j.jobNo)}</b></td><td>${dmy(j.date)}</td><td>${esc(j.company || '')}</td><td>${esc(j.project || '')}</td><td>${esc(j.poNo || '')}</td><td class="num">${fmt(j.contractValue)}</td><td class="num">${fmt(j.budget?.totalCost)}</td><td>${j.startDate ? dmy(j.startDate) : '—'}</td><td>${j.finishDate ? dmy(j.finishDate) : '—'}</td><td><span class="jv-st jv-${ST_CLS[j.status] || 'blue'}">${esc(j.status || 'Open')}</span></td></tr>`).join('')
      : `<tr><td colspan="10" class="jb-empty-row">${jobs.length ? 'No job matches the filters.' : 'No jobs yet. A job is created from a won Contracting quotation (Create Job).'}</td></tr>`;
  }
  async function renderRegister() {
    buildPage();
    if (!loaded) { const b = $('jbreg-body'); if (b) b.innerHTML = '<tr><td colspan="10" class="jb-empty-row">Loading jobs…</td></tr>'; }
    try { await load(); } catch (e) { const b = $('jbreg-body'); if (b) b.innerHTML = '<tr><td colspan="10" class="jb-empty-row">Jobs could not be loaded. Check the connection and try again.</td></tr>'; return; }
    paint();
  }

  window.BCJobs = { list: () => jobs.slice(), load, openCreate, openEdit, view, renderRegister };
})();
