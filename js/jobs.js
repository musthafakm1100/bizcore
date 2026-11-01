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
   Jobs → register (open + last 12 months, like the other registers) and a Job view.
   V271.3 (mockups CC_1 / CC_2 / CJ_2): the Job view shows Estimate vs Actual (purchase invoice lines charged to the job,
   Job Expenses, stock issued to the job), the costs, the activity and the manual Work done %; + Job Expense.
   Job invoicing and the Work Completion Certificate follow in V271.4.
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

  /* ══ Job view (CJ_2): Overview · Estimate vs Actual · Costs · Activity ══
     The costs of a job are read when its view opens (purchase invoices with job lines, job expenses, stock issued to
     the job) and kept until Refresh — reads = the cost documents of that job; no listener. */
  const costCache = new Map();   // jobId → { at, invoices, expenses, allocations, denied }
  const JC = () => window.BizCoreJobCost;
  const canSeeCost = () => (typeof window.bcRight === 'function' ? window.bcRight('seeCost') : true);
  const TYPE_LABEL = { material: 'Material', manpower: 'Manpower', subcontract: 'Subcontract', other: 'Equipment / Other' };
  const SRC = { pi: ['Purchase invoice', 'ti-shopping-bag'], je: ['Job expense', 'ti-receipt'], stock: ['From stock', 'ti-box'] };
  async function costsOf(jobId, fresh) {
    if (!fresh && costCache.has(jobId)) return costCache.get(jobId);
    if (!JC()) return { invoices: [], expenses: [], allocations: [], denied: {} };
    const got = await JC().costsOf(jobId);
    got.at = Date.now(); costCache.set(jobId, got);
    return got;
  }
  function expenseNos() { const out = []; costCache.forEach(c => (c.expenses || []).forEach(e => out.push(e.jeNo || ''))); return out; }
  function ensureView() {
    if ($('job-view-modal')) return;
    const m = document.createElement('div');
    m.className = 'modal-overlay'; m.id = 'job-view-modal';
    m.innerHTML = `<div class="modal modal-normal jv-win" role="dialog" aria-modal="true" aria-labelledby="jv-title"><div class="modal-header jb-hd"><div><h2 id="jv-title">Job</h2><div class="jb-sub" id="jv-sub"></div></div><span class="pr-pill" id="jv-st"></span><button type="button" class="close-btn" onclick="closeModal('job-view-modal')" aria-label="Close">✕</button></div>
<div class="jv-tabs" role="tablist" id="jv-tabs"></div>
<div class="modal-body jv-body" id="jv-body"></div><div class="modal-footer jb-ft" id="jv-ft"></div></div>`;
    document.body.appendChild(m);
    $('jv-tabs').onclick = e => { const b = e.target.closest('[data-tab]'); if (!b || !V) return; V.tab = b.dataset.tab; paintView(); };
    $('jv-body').onclick = e => {
      const a = e.target.closest('[data-open]'); if (!a) return;
      const [kind, id] = [a.dataset.open, a.dataset.id];
      if (kind === 'pi' && typeof openPurchaseInvoiceView === 'function') openPurchaseInvoiceView(id);
      else if (kind === 'je') viewExpense(id);
      else if (kind === 'stock' && typeof openStockItem === 'function') { const al = (V.costs.allocations || []).find(x => x.id === id); if (al) openStockItem(al.itemKey); }
      else if (kind === 'type') { V.tab = 'costs'; V.type = id; paintView(); }
      else if (kind === 'refresh') refreshCosts();
      else if (kind === 'progress') openProgress();
    };
  }
  let V = null;   // { job, tab, type, costs, rows, bva, loading, error }
  async function view(id, opts = {}) {
    await load();
    const j = jobs.find(x => x.id === id || x.jobNo === id);
    if (!j) { toast('Job ' + id + ' was not found.', 'error'); return; }
    ensureView();
    V = { job: j, tab: opts.tab || (V && V.job && V.job.id === j.id ? V.tab : 'eva'), type: '', costs: null, rows: [], bva: null, loading: true, error: '' };
    paintView();
    if (!$('job-view-modal').classList.contains('open')) openModalWithSize('job-view-modal');
    await loadCosts(!!opts.fresh);
  }
  async function loadCosts(fresh) {
    const j = V && V.job; if (!j) return;
    V.loading = true; paintView();
    try {
      const c = await costsOf(j.id, fresh);
      if (!V || V.job.id !== j.id) return;
      V.costs = c; V.error = '';
      V.rows = JC() ? JC().core.jobCostRows(j.id, c) : [];
      V.bva = JC() ? JC().core.jobBudgetVsActual(j, V.rows, window.BCEst ? BCEst.settings() : {}) : null;
    } catch (e) { if (V) V.error = 'The costs could not be loaded (' + (e && e.message || 'no connection') + ').'; }
    if (V) { V.loading = false; paintView(); }
  }
  function refreshCosts() { if (V) loadCosts(true); }
  const pct = v => v == null ? '—' : (Math.round(v * 10) / 10).toFixed(1) + ' %';
  function barHtml(t) {
    const w = t.usedPct == null ? 100 : Math.max(0, Math.min(100, t.usedPct));
    return `<span class="jv-bar"><i class="jv-bar-${esc(t.type)} ${t.state}" style="width:${w}%"></i></span><span class="jv-pct ${t.state}">${t.usedPct == null ? 'no budget' : pct(t.usedPct)}</span>`;
  }
  function evaHtml(j) {
    const x = V.bva;
    if (!x) return `<div class="jb-empty">${V.loading ? 'Loading the costs…' : esc(V.error || 'No cost information.')}</div>`;
    const counts = {}; V.rows.forEach(r => { counts[r.costType] = (counts[r.costType] || 0) + 1; });
    const row = t => `<tr class="jv-eva-r ${t.state}" data-open="type" data-id="${esc(t.type)}" tabindex="0" title="Show its cost lines"><td><span class="jv-ct ${esc(t.type)}">${esc(t.label)}</span>${counts[t.type] ? `<small class="jv-cnt">${counts[t.type]}</small>` : ''}</td><td class="r">${fmt(t.budget)}</td><td class="r">${fmt(t.actual)}</td><td class="jv-used">${barHtml(t)}</td><td class="r ${t.remaining < -0.005 ? 'neg' : ''}">${fmt(t.remaining)}</td></tr>`;
    const s = window.BCEst ? BCEst.settings() : { warnAmberPct: 90, warnRedPct: 100 };
    return `<table class="jb-tbl jv-eva"><thead><tr><th>Cost Type</th><th class="r">Budget</th><th class="r">Actual</th><th>Used</th><th class="r">Remaining</th></tr></thead><tbody>
${x.types.map(row).join('')}
<tr class="jb-tot jv-eva-d ${x.direct.state}"><td>Direct Cost</td><td class="r">${fmt(x.direct.budget)}</td><td class="r">${fmt(x.direct.actual)}</td><td class="jv-used">${barHtml({ ...x.direct, type: 'direct' })}</td><td class="r ${x.direct.remaining < -0.005 ? 'neg' : ''}">${fmt(x.direct.remaining)}</td></tr>
<tr class="jv-dim"><td>Overheads (budget only)</td><td class="r">${fmt(x.overhead)}</td><td class="r">—</td><td></td><td></td></tr>
<tr class="jv-dim"><td>Contingency (budget only)</td><td class="r">${fmt(x.contingency)}</td><td class="r">—</td><td></td><td></td></tr></tbody></table>
<p class="jv-hint">A cost type goes <b class="amber">amber at ${esc(num(s.warnAmberPct) || 90)} %</b> and <b class="red">red over ${esc(num(s.warnRedPct) || 100)} %</b> of its budget (Administration → Contracting Settings). Click a row to see its cost lines. Expected profit = contract value − (actual + the budget still to spend); a cost type over budget reduces it.</p>`;
  }
  function costsHtml() {
    if (!V.costs) return `<div class="jb-empty">${V.loading ? 'Loading the costs…' : esc(V.error || '')}</div>`;
    const rows = V.rows.filter(r => !V.type || r.costType === V.type);
    const den = V.costs.denied || {};
    const note = [den.invoices ? 'purchase invoices' : '', den.expenses ? 'job expenses' : '', den.allocations ? 'stock' : ''].filter(Boolean);
    const chips = ['', 'material', 'manpower', 'subcontract', 'other'].map(t => `<button type="button" class="jv-chip${V.type === t ? ' on' : ''}" data-open="type" data-id="${t}">${t ? TYPE_LABEL[t] : 'All'}</button>`).join('');
    const total = r2(rows.reduce((a, r) => a + r.amount, 0));
    return `<div class="jv-chips">${chips}<span class="jb-sp"></span><button type="button" class="btn btn-secondary btn-sm" data-open="refresh"><i class="ti ti-refresh"></i>Refresh</button></div>
${note.length ? `<div class="jv-warn"><i class="ti ti-lock"></i>Your role can't see the ${note.join(' and ')} — those costs are not in the figures.</div>` : ''}
<div class="jv-scroll"><table class="jb-tbl jv-costs"><thead><tr><th>Date</th><th>Document</th><th>Cost Type</th><th>Description</th><th>Supplier / Paid to</th><th class="r">Amount</th></tr></thead><tbody>
${rows.length ? rows.map(r => `<tr><td class="nw">${dmy(r.date)}</td><td class="nw"><button type="button" class="jv-link" data-open="${r.source}" data-id="${esc(r.docId)}"><i class="ti ${SRC[r.source][1]}"></i>${esc(r.docNo)}</button><small>${esc(SRC[r.source][0])}${r.ref ? ' · ' + esc(r.ref) : ''}</small></td><td><span class="jv-ct ${esc(r.costType)}">${esc(TYPE_LABEL[r.costType] || r.costType)}</span></td><td>${esc(r.desc)}${r.qty ? `<small>${esc(r.qty)} ${esc(r.uom)}</small>` : ''}</td><td>${esc(r.party)}</td><td class="r">${fmt(r.amount)}</td></tr>`).join('')
  : `<tr><td colspan="6" class="jv-none">No costs${V.type ? ' of this type' : ''} yet. Charge a purchase invoice line to this job, record a Job Expense, or issue stock to the job.</td></tr>`}
${rows.length ? `<tr class="jb-tot"><td colspan="5">Total${V.type ? ' — ' + esc(TYPE_LABEL[V.type]) : ''}</td><td class="r">${fmt(total)}</td></tr>` : ''}</tbody></table></div>
<p class="jv-hint">Purchase invoice lines count at their landed cost (with their share of the invoice's extra costs and discount), without VAT. Job expenses count without VAT. Stock counts at its average cost.</p>`;
  }
  function activityItems(j) {
    const items = [];
    const pis = new Map(); (V.rows || []).filter(r => r.source === 'pi').forEach(r => { const x = pis.get(r.docId) || { date: r.date, t: `Purchase invoice ${r.ref || r.docNo} · ${r.party}`, amt: 0, c: r.costType }; x.amt = r2(x.amt + r.amount); pis.set(r.docId, x); });
    pis.forEach(x => items.push({ date: x.date, text: `${x.t} · ${fmt(x.amt)}`, c: x.c }));
    const jes = new Map(); (V.rows || []).filter(r => r.source === 'je').forEach(r => { const x = jes.get(r.docId) || { date: r.date, no: r.docNo, amt: 0 }; x.amt = r2(x.amt + r.amount); jes.set(r.docId, x); });
    jes.forEach(x => items.push({ date: x.date, text: `Job expense ${x.no} · ${fmt(x.amt)}`, c: 'other' }));
    (V.rows || []).filter(r => r.source === 'stock').forEach(r => items.push({ date: r.date, text: `From stock · ${r.desc} · ${fmt(r.amount)}`, c: 'material' }));
    if (j.workDoneAt) items.push({ date: String(j.workDoneAt).slice(0, 10), at: String(j.workDoneAt), text: `Work done set to ${num(j.workDonePct)} %${j.workDoneBy ? ' by ' + j.workDoneBy : ''}`, c: 'direct' });
    items.push({ date: j.date, text: `Job created from ${j.qno || 'the quotation'}`, c: 'start' });
    return items.sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.at || '').localeCompare(String(a.at || '')));
  }
  function activityHtml(j, max) {
    const items = activityItems(j), list = max ? items.slice(0, max) : items;
    return `<ul class="jv-act">${list.map(x => `<li><i class="jv-dot ${esc(x.c)}"></i><span>${esc(x.text)}</span><small>${dmy(x.date)}</small></li>`).join('')}</ul>${max && items.length > max ? `<button type="button" class="jv-more" onclick="BCJobs._tab('activity')">All activity (${items.length})</button>` : ''}`;
  }
  function progressBox(j, x) {
    const used = x ? x.direct.usedPct : null, wd = j.workDonePct != null && j.workDonePct !== '' ? num(j.workDonePct) : null;
    const canE = canEditJob();
    const cmp = wd == null ? 'Not set yet — the in-charge enters how much of the work is done, to compare with the cost used.'
      : used == null ? '' : used > wd + 10 ? `<b class="red">Cost used ${pct(used)} is ahead of the work done</b> — check the remaining budget.` : `Compared with cost used (${pct(used)}).`;
    return `<div class="jv-box jv-prog"><h4>Progress (manual)${canE ? `<button type="button" class="jv-edit" data-open="progress" title="Set the work done"><i class="ti ti-pencil"></i>Set</button>` : ''}</h4>
<div class="jv-kv"><span>Work done</span><b class="jv-wd">${wd == null ? '—' : wd + ' %'}${j.workDoneAt ? ` · set ${dmy(String(j.workDoneAt).slice(0, 10))}` : ''}</b></div><p class="jv-pnote">${cmp}</p></div>`;
  }
  function paintView() {
    const j = V && V.job; if (!j) return;
    $('jv-title').textContent = j.jobNo + (j.project ? ' · ' + j.project : '');
    $('jv-sub').textContent = [j.company, j.poNo ? 'PO ' + j.poNo : '', j.qno, j.startDate ? 'Start ' + dmy(j.startDate) : '', j.finishDate ? 'Planned finish ' + dmy(j.finishDate) : '', j.siteInCharge ? 'In-charge ' + j.siteInCharge : ''].filter(Boolean).join(' · ');
    const st = $('jv-st'); st.textContent = j.status || 'Open'; st.className = 'pr-pill jv-st jv-' + (ST_CLS[j.status] || 'blue');
    const b = j.budget || {}, x = V.bva, see = canSeeCost();
    const nCosts = V.rows ? V.rows.length : 0;
    $('jv-tabs').innerHTML = [['overview', 'Overview'], ['eva', 'Estimate vs Actual'], ['costs', `Costs${V.costs ? ' (' + nCosts + ')' : ''}`], ['activity', 'Activity']]
      .map(([k, t]) => `<button type="button" role="tab" class="jv-tab${V.tab === k ? ' on' : ''}" aria-selected="${V.tab === k}" data-tab="${k}">${t}</button>`).join('');
    const actual = x ? x.actualTotal : null, direct = num(b.material) + num(b.manpower) + num(b.subcontract) + num(b.other);
    const cards = `<div class="jv-cards">
<div class="jv-card dk"><span>Contract Value</span><b>${fmt(j.contractValue)}</b><small>excl. VAT · lump sum</small></div>
<div class="jv-card"><span>Actual Cost To Date</span><b class="${x && x.direct.state !== 'ok' ? x.direct.state : ''}">${actual == null ? '…' : fmt(actual)}</b><small>${actual == null ? 'loading' : (direct > 0 ? pct(actual / direct * 100) + ' of direct budget ' + fmt(direct) : 'no direct budget')}</small></div>
<div class="jv-card"><span>Budget (Total Cost)</span><b>${fmt(b.totalCost)}</b><small>from estimate V${esc(j.estimateVersion || 1)} · incl. overheads &amp; contingency</small></div>
<div class="jv-card"><span>Expected Profit 🔒</span>${see ? `<b class="${(x ? x.expectedProfit : num(j.plannedProfit)) < 0 ? 'neg' : 'pos'}">${fmt(x ? x.expectedProfit : j.plannedProfit)}</b><small>${x ? `${x.expectedMarginPct.toFixed(2)} % · ${x.expectedProfit + 0.005 < num(j.plannedProfit) ? 'below plan ' + fmt(j.plannedProfit) : 'on plan'}` : 'planned'}</small>` : '<b>—</b><small>Special Right “See cost, margin and profit”</small>'}</div></div>`;
    let main = '';
    if (V.tab === 'overview') {
      main = `<div class="jv-two"><div>${budgetHtml(j.budget, num(j.contractValue))}</div>
<div class="jv-side"><div class="jv-box"><h4>Details</h4>
<div class="jv-kv"><span>Customer</span><b>${esc(j.company || '—')}</b></div><div class="jv-kv"><span>Project / Site</span><b>${esc(j.project || '—')}</b></div>
<div class="jv-kv"><span>Customer PO</span><b>${esc(j.poNo || '—')}${j.poDate ? ' · ' + dmy(j.poDate) : ''}</b></div>
<div class="jv-kv"><span>Start · Planned finish</span><b>${j.startDate ? dmy(j.startDate) : '—'} · ${j.finishDate ? dmy(j.finishDate) : '—'}</b></div>
<div class="jv-kv"><span>Site in-charge</span><b>${esc(j.siteInCharge || '—')}</b></div>
<div class="jv-kv"><span>Created</span><b>${dmy(j.date)}${j.createdBy ? ' · ' + esc(j.createdBy) : ''}</b></div></div>
${j.notes ? `<div class="jv-box"><h4>Notes</h4><p class="jv-note">${esc(j.notes)}</p></div>` : ''}
<div class="jv-box jv-next"><h4>Coming next</h4><p>Job invoices (advance, part, final) and the Work Completion Certificate come in the next update.</p></div></div></div>`;
    } else if (V.tab === 'eva') {
      main = `<div class="jv-two"><div>${evaHtml(j)}</div><div class="jv-side">${progressBox(j, x)}<div class="jv-box"><h4>Activity</h4>${V.costs ? activityHtml(j, 6) : '<p class="jv-pnote">Loading…</p>'}</div></div></div>`;
    } else if (V.tab === 'costs') main = costsHtml();
    else main = `<div class="jv-box">${V.costs ? activityHtml(j, 0) : '<p class="jv-pnote">Loading…</p>'}</div>`;
    $('jv-body').innerHTML = cards + main;
    const canE = canEditJob(), canJE = canExpense() && !/^(closed|cancelled)$/i.test(String(j.status || ''));
    $('jv-ft').innerHTML = `<button type="button" class="btn btn-secondary" onclick="closeModal('job-view-modal')">Close</button><span class="jb-sp"></span>`
      + (j.rfqId ? `<button type="button" class="btn btn-secondary" data-rid="${esc(j.rfqId)}" onclick="closeModal('job-view-modal');bcOpenEstimate(this.dataset.rid,{version:${Number(j.estimateVersion) || 1}})"><i class="ti ti-calculator"></i>Estimate</button>` : '')
      + `<button type="button" class="btn btn-secondary" data-qid="${esc(j.quotationId)}" onclick="closeModal('job-view-modal');viewQuotation(this.dataset.qid)"><i class="ti ti-file-text"></i>${esc(j.qno || 'Quotation')}</button>`
      + (canE ? `<button type="button" class="btn btn-secondary" data-jid="${esc(j.id)}" onclick="BCJobs.openEdit(this.dataset.jid)"><i class="ti ti-edit"></i>Edit Details</button>` : '')
      + (canJE ? `<button type="button" class="btn btn-primary" data-jid="${esc(j.id)}" onclick="BCJobs.openExpense(this.dataset.jid)"><i class="ti ti-receipt"></i>+ Job Expense</button>` : '');
  }
  const canEditJob = () => typeof window.bcCan !== 'function' || window.bcCan('salesOrder', 'e') || window.bcCan('salesOrder', 'c');
  const canExpense = () => typeof window.bcCan !== 'function' || window.bcCan('cash', 'c');

  /* ── Progress (manual Work done %) — one field merge on the job ── */
  function openProgress() {
    const j = V && V.job; if (!j) return;
    let m = $('job-prog-modal');
    if (!m) { m = document.createElement('div'); m.className = 'modal-overlay'; m.id = 'job-prog-modal'; document.body.appendChild(m); }
    m.innerHTML = `<div class="modal jp-win" role="dialog" aria-modal="true" aria-labelledby="jp-title"><div class="modal-header"><div class="modal-header-title-wrap"><h2 id="jp-title">Work done — ${esc(j.jobNo)}</h2></div><button type="button" class="close-btn" onclick="closeModal('job-prog-modal')" aria-label="Close">✕</button></div>
<div class="modal-body"><div class="form-group"><label for="jp-pct">How much of the work is done? (%) *</label><input id="jp-pct" inputmode="decimal" maxlength="5" value="${j.workDonePct != null ? esc(j.workDonePct) : ''}" placeholder="0 – 100"></div>
<p class="jv-pnote">Entered by the in-charge from the site; it is compared with the share of the direct budget already spent.</p><div class="inv-error" id="jp-err" hidden></div></div>
<div class="modal-footer"><button type="button" class="btn btn-secondary" onclick="closeModal('job-prog-modal')">Cancel</button><button type="button" class="btn btn-primary" id="jp-save"><i class="ti ti-device-floppy"></i>Save</button></div></div>`;
    $('jp-save').onclick = async () => {
      const raw = String($('jp-pct').value || '').trim(), v = Number(raw);
      if (raw === '' || !Number.isFinite(v) || v < 0 || v > 100) { $('jp-err').hidden = false; $('jp-err').textContent = 'Enter a number from 0 to 100.'; return; }
      const fields = { workDonePct: Math.round(v * 10) / 10, workDoneAt: new Date().toISOString(), workDoneBy: who(), updated: new Date().toISOString() };
      $('jp-save').disabled = true;
      try {
        const ok = window.FB && window.FB.fbMergeFields ? await window.FB.fbMergeFields('jobs', j.id, fields) : true;
        if (ok === false) throw new Error('not saved');
        Object.assign(j, fields); closeModal('job-prog-modal'); toast(`${j.jobNo}: work done ${fields.workDonePct} %`, 'success'); paintView();
      } catch (e) { $('jp-err').hidden = false; $('jp-err').textContent = 'The work done was not saved — please try again.'; $('jp-save').disabled = false; }
    };
    openModalWithSize('job-prog-modal');
    setTimeout(() => { $('jp-pct').focus(); $('jp-pct').select(); }, 60);
  }

  /* ══ Job Expense (CC_2) — paid from a payment account, posted to its cash / bank ledger ══ */
  const ACC = () => (window.BizCoreAcc ? window.BizCoreAcc.accounts : []).filter(a => a && a.active !== false);
  const TYPE_OPTS = [['material', 'Material'], ['manpower', 'Manpower'], ['subcontract', 'Subcontract'], ['other', 'Equipment / Other']];
  function catOptions(sel) {
    const cats = (window.BCEst ? BCEst.settings().expenseCategories : []) || [];
    return `<option value="">Choose…</option><optgroup label="Expense categories">${cats.map(c => `<option value="ec:${esc(c.id)}"${sel === 'ec:' + c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</optgroup>`
      + `<optgroup label="Other — by cost type">${TYPE_OPTS.map(([k, t]) => `<option value="ct:${k}"${sel === 'ct:' + k ? ' selected' : ''}>${t}</option>`).join('')}</optgroup>`;
  }
  function catOf(v) {
    if (String(v).startsWith('ec:')) { const c = ((window.BCEst ? BCEst.settings().expenseCategories : []) || []).find(x => x.id === v.slice(3)); return c ? { categoryId: c.id, category: c.name, costType: c.costType } : { categoryId: '', category: '', costType: '' }; }
    if (String(v).startsWith('ct:')) { const k = v.slice(3); return { categoryId: '', category: TYPE_LABEL[k] || '', costType: k }; }
    return { categoryId: '', category: '', costType: '' };
  }
  let X = null;   // the open expense: { jobId, lines:[{cat, desc, paidTo, amount, vat}], file, op }
  function ensureExpense() {
    if ($('je-modal')) return;
    const m = document.createElement('div');
    m.className = 'modal-overlay'; m.id = 'je-modal';
    m.innerHTML = `<div class="modal modal-normal je-win" role="dialog" aria-modal="true" aria-labelledby="je-title">
<div class="modal-header jb-hd"><div><h2 id="je-title">New Job Expense</h2><div class="jb-sub" id="je-sub">No. auto on save</div></div><button type="button" class="close-btn" onclick="closeModal('je-modal')" aria-label="Close">✕</button></div>
<div class="modal-body je-body">
<div class="je-grid">
<div class="jb-f je-job"><label for="je-job">Job <b class="jb-req">*</b></label><select id="je-job"></select></div>
<div class="jb-f"><label for="je-date">Date <b class="jb-req">*</b></label><input id="je-date" autocomplete="off"></div>
<div class="jb-f"><label for="je-acc">Paid From <b class="jb-req">*</b></label><select id="je-acc"></select></div>
<div class="jb-f"><label for="je-ref">Reference <em>Optional</em></label><input id="je-ref" maxlength="60" autocomplete="off" placeholder="Bill / receipt no."></div>
</div>
<div class="je-scroll"><table class="jb-tbl je-lines"><thead><tr><th style="width:190px">Category</th><th>Description</th><th style="width:170px">Paid To <em>optional</em></th><th class="r" style="width:120px">Amount</th><th class="r" style="width:100px">VAT <em>if any</em></th><th style="width:34px"></th></tr></thead><tbody id="je-body"></tbody>
<tfoot><tr><td colspan="6"><button type="button" class="jv-link je-add" id="je-add"><i class="ti ti-plus"></i>Add Line</button></td></tr></tfoot></table></div>
<div class="je-tot" id="je-tot"></div>
<div class="je-foot"><div class="jb-f je-note"><label for="je-note">Note <em>Optional</em></label><input id="je-note" maxlength="500" autocomplete="off"></div>
<div class="je-rcpt"><input type="file" id="je-file" accept="image/*,application/pdf" hidden><button type="button" class="btn btn-secondary btn-sm" id="je-file-btn"><i class="ti ti-paperclip"></i>Receipt</button><span id="je-file-name" class="je-fname">Photo or PDF — optional</span></div></div>
<p class="jv-hint">Enter the amount <b>without VAT</b> and the VAT separately when there is a VAT invoice — the job's cost is the amount; the account pays amount + VAT. Cash paid out waits for the custodian's confirmation in Cash &amp; Bank.</p>
<div class="inv-error" id="je-err" hidden></div></div>
<div class="modal-footer jb-ft"><span class="jb-chk" id="je-chk"></span><span class="jb-sp"></span><button type="button" class="btn btn-secondary" onclick="closeModal('je-modal')">Cancel</button><button type="button" class="btn btn-primary" id="je-save"><i class="ti ti-device-floppy"></i>Save Expense</button></div></div>`;
    document.body.appendChild(m);
    if (window.BCDate) BCDate.attach($('je-date'), { max: () => BCDate.today(), onCommit: jeCheck });
    $('je-add').onclick = () => { X.lines.push({ cat: '', desc: '', paidTo: '', amount: '', vat: '' }); jeLines(); const d = m.querySelectorAll('.je-cat'); if (d.length) d[d.length - 1].focus(); };
    $('je-body').addEventListener('input', e => { const t = e.target, i = Number(t.dataset.i); if (!X || !X.lines[i]) return; X.lines[i][t.dataset.f] = t.value; if (t.dataset.f === 'cat') jeLines(); else jeCheck(); });
    $('je-body').addEventListener('change', e => { const t = e.target, i = Number(t.dataset.i); if (t.dataset.f === 'cat' && X && X.lines[i]) { X.lines[i].cat = t.value; jeLines(); } });
    $('je-body').addEventListener('click', e => { const b = e.target.closest('[data-del]'); if (!b || !X) return; X.lines.splice(Number(b.dataset.del), 1); if (!X.lines.length) X.lines.push({ cat: '', desc: '', paidTo: '', amount: '', vat: '' }); jeLines(); });
    $('je-body').addEventListener('focusout', e => { const t = e.target; if (t.dataset && (t.dataset.f === 'amount' || t.dataset.f === 'vat') && String(t.value).trim() !== '' && Number.isFinite(num(t.value))) { t.value = fmt(num(t.value)); X.lines[Number(t.dataset.i)][t.dataset.f] = t.value; jeCheck(); } });
    ['je-job', 'je-acc', 'je-ref', 'je-note'].forEach(id => { $(id).addEventListener('input', jeCheck); $(id).addEventListener('change', jeCheck); });
    $('je-file-btn').onclick = () => $('je-file').click();
    $('je-file').onchange = e => { const f = e.target.files && e.target.files[0]; if (f && f.size > 8 * 1024 * 1024) { toast('The receipt must be under 8 MB.', 'error'); e.target.value = ''; return; } X.file = f || null; $('je-file-name').textContent = f ? f.name : 'Photo or PDF — optional'; };
    $('je-save').onclick = () => saveExpense();
  }
  function jeLines() {
    $('je-body').innerHTML = X.lines.map((l, i) => { const c = catOf(l.cat);
      return `<tr><td><select class="je-cat" data-i="${i}" data-f="cat" aria-label="Category">${catOptions(l.cat)}</select>${c.costType ? `<span class="jv-ct ${c.costType}">${esc(TYPE_LABEL[c.costType])}</span>` : ''}</td>
<td><input data-i="${i}" data-f="desc" maxlength="200" value="${esc(l.desc)}" placeholder="What it was for" aria-label="Description"></td>
<td><input data-i="${i}" data-f="paidTo" maxlength="100" value="${esc(l.paidTo)}" placeholder="—" aria-label="Paid to"></td>
<td><input class="r" data-i="${i}" data-f="amount" inputmode="decimal" value="${esc(l.amount)}" placeholder="0.00" aria-label="Amount"></td>
<td><input class="r" data-i="${i}" data-f="vat" inputmode="decimal" value="${esc(l.vat)}" placeholder="0.00" aria-label="VAT"></td>
<td><button type="button" class="cs-x" data-del="${i}" title="Remove line" aria-label="Remove line">✕</button></td></tr>`; }).join('');
    jeCheck();
  }
  function jeInput() {
    return { jobId: $('je-job').value, date: window.BCDate ? BCDate.getISO($('je-date')) || '' : $('je-date').value, accountId: $('je-acc').value, reference: $('je-ref').value, note: $('je-note').value,
      lines: X.lines.map(l => ({ ...catOf(l.cat), desc: l.desc, paidTo: l.paidTo, amount: String(l.amount).replace(/,/g, ''), vat: String(l.vat).replace(/,/g, '') })) };
  }
  function jeValidate() {
    const inp = jeInput(), job = jobs.find(j => j.id === inp.jobId) || null;
    const accs = new Map(ACC().map(a => [a.id, a])); (window.BizCoreAcc ? window.BizCoreAcc.accounts : []).forEach(a => { if (!accs.has(a.id)) accs.set(a.id, a); });
    const today = window.BCDate ? BCDate.today() : new Date().toISOString().slice(0, 10);
    return JC() ? JC().core.validateJobExpense(inp, { job, accounts: accs, today }) : { ok: false, errors: [{ message: 'Not available' }], value: { amount: 0, vat: 0, total: 0, lines: [] } };
  }
  function jeCheck() {
    if (!X || !$('je-chk')) return;
    const v = jeValidate(); X.v = v;
    $('je-tot').innerHTML = `<span>Cost to the job <b>${fmt(v.value.amount)}</b></span><span>VAT <b>${fmt(v.value.vat)}</b></span><span class="je-paid">Paid <b>${fmt(v.value.total)}</b></span>`;
    const todo = [];
    if (v.errors.some(e => e.field === 'job')) todo.push('Job');
    if (v.errors.some(e => e.field === 'date')) todo.push('Date');
    if (v.errors.some(e => e.field === 'account')) todo.push('Paid from');
    const nl = new Set(v.errors.filter(e => e.line != null).map(e => e.line)).size; if (nl) todo.push(nl + ' line' + (nl > 1 ? 's' : '') + ' to complete');
    if (v.errors.some(e => e.field === 'lines')) todo.push('Add a line');
    $('je-chk').className = 'jb-chk' + (todo.length ? ' is-todo' : '');
    $('je-chk').textContent = todo.length ? 'To continue: ' + todo.join(' · ') : '✓ Ready · job, date and account chosen';
    $('je-save').disabled = !v.ok;
  }
  async function openExpense(jobId) {
    if (!canExpense()) { toast('Your role cannot record job expenses (Cash & Bank → Create).', 'error'); return; }
    if (!JC()) { toast('Job expenses are not available — please reload.', 'error'); return; }
    await load();
    if (window.BizCoreAcc) window.BizCoreAcc.start();
    ensureExpense();
    const open = jobs.filter(j => !/^(closed|cancelled)$/i.test(String(j.status || '')));
    if (!open.length) { toast('There is no open job.', 'info'); return; }
    X = { lines: [{ cat: '', desc: '', paidTo: '', amount: '', vat: '' }], file: null, op: 'je-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10) };
    $('je-job').innerHTML = '<option value="">Choose the job…</option>' + open.map(j => `<option value="${esc(j.id)}">${esc(j.jobNo)}${j.company ? ' · ' + esc(j.company) : ''}${j.project ? ' · ' + esc(j.project) : ''}</option>`).join('');
    $('je-job').value = jobId && open.some(j => j.id === jobId) ? jobId : open.length === 1 ? open[0].id : '';
    const fillAcc = () => { const cur = $('je-acc').value; $('je-acc').innerHTML = '<option value="">Choose the account…</option>' + ACC().map(a => `<option value="${esc(a.id)}"${a.id === cur ? ' selected' : ''}>${esc(a.name)}${a.type === 'cash' ? ' (cash)' : a.type === 'card' ? ' (card)' : ' (bank)'}</option>`).join(''); };
    fillAcc();
    if (!ACC().length && window.BizCoreAcc) { const off = window.BizCoreAcc.onChange(() => { fillAcc(); jeCheck(); off(); }); }
    if (window.BCDate) BCDate.setISO($('je-date'), BCDate.today()); else $('je-date').value = new Date().toISOString().slice(0, 10);
    ['je-ref', 'je-note'].forEach(id => { $(id).value = ''; });
    $('je-file').value = ''; $('je-file-name').textContent = 'Photo or PDF — optional';
    $('je-err').hidden = true;
    const x = typeof docNumberParts === 'function' ? docNumberParts('jobExpense') : { displayPrefix: 'JE-' };
    $('je-sub').textContent = `No. auto on save · ${x.displayPrefix}…`;
    jeLines();
    openModalWithSize('je-modal');
    setTimeout(() => { const c = document.querySelector('#je-body .je-cat'); ($('je-job').value ? c : $('je-job'))?.focus(); }, 60);
  }
  let jeSaving = false;
  async function saveExpense() {
    if (jeSaving || !X) return;
    const v = jeValidate(); if (!v.ok) { jeCheck(); return; }
    if (navigator.onLine === false) { toast('You are offline. A job expense is saved online only — connect and try again.', 'error'); return; }
    jeSaving = true; $('je-save').disabled = true; $('je-err').hidden = true;
    try {
      let receipt = null;
      if (X.file && window.FB && window.FB.uploadFile) {
        const path = 'jobExpenses/' + X.op + '/' + Date.now() + '_' + String(X.file.name || 'receipt').replace(/[^\w.-]+/g, '_').slice(-80);
        const url = await (typeof bcBusy === 'function' ? bcBusy('Uploading the receipt…', () => window.FB.uploadFile(path, X.file)) : window.FB.uploadFile(path, X.file));
        if (!url) { $('je-err').hidden = false; $('je-err').textContent = 'The receipt could not be uploaded. Try again, or remove it and save without it.'; return; }
        receipt = { url, path, name: X.file.name || 'receipt' };
      }
      const x = docNumberParts('jobExpense');
      const run = () => JC().service.createJobExpense({ ...jeInput(), operationId: X.op, receipt, numbering: { counterKey: x.counterKey, displayPrefix: x.displayPrefix, digits: x.digits, floor: x.floor } });
      const r = await (typeof bcBusy === 'function' ? bcBusy('Saving the job expense…', run) : run());
      const e = r.expense;
      const c = costCache.get(e.jobId); if (c && !c.expenses.some(z => z.id === e.id)) c.expenses.push(e);
      closeModal('je-modal');
      toast(`${e.jeNo} saved · ${fmt(e.total)} paid from ${e.accountName}`, 'success', 'Job expense');
      if (V && V.job && V.job.id === e.jobId && $('job-view-modal')?.classList.contains('open')) { V.rows = JC().core.jobCostRows(e.jobId, costCache.get(e.jobId)); V.bva = JC().core.jobBudgetVsActual(V.job, V.rows, window.BCEst ? BCEst.settings() : {}); paintView(); }
      else view(e.jobId);
    } catch (e) {
      $('je-err').hidden = false; $('je-err').textContent = e && e.code === 'permission-denied' ? 'The server refused the expense (Cash & Bank → Create is needed). Please reload and try again.' : (e && e.message) || 'The job expense was not saved — please try again.';
    } finally { jeSaving = false; if (X) jeCheck(); }
  }
  /* one job expense: its lines, the account, the receipt; Cancel (Cash & Bank → Cancel) */
  function viewExpense(id) {
    const e = V && V.costs ? (V.costs.expenses || []).find(x => x.id === id) : null; if (!e) return;
    let m = $('je-view-modal');
    if (!m) { m = document.createElement('div'); m.className = 'modal-overlay'; m.id = 'je-view-modal'; document.body.appendChild(m); }
    const voided = e.status === 'Voided', canX = !voided && (typeof window.bcCan !== 'function' || window.bcCan('cash', 'x'));
    m.innerHTML = `<div class="modal je-vwin" role="dialog" aria-modal="true" aria-labelledby="jev-title"><div class="modal-header jb-hd"><div><h2 id="jev-title">${esc(e.jeNo)} · Job Expense</h2><div class="jb-sub">${esc(e.jobNo)}${e.project ? ' · ' + esc(e.project) : ''} · ${dmy(e.date)}</div></div>${voided ? '<span class="pr-pill jv-st jv-red">Cancelled</span>' : ''}<button type="button" class="close-btn" onclick="closeModal('je-view-modal')" aria-label="Close">✕</button></div>
<div class="modal-body je-body">${voided ? `<div class="jv-warn"><i class="ti ti-ban"></i>Cancelled by ${esc(e.voidedBy || '')} — ${esc(e.voidReason || '')}</div>` : ''}
<div class="jv-kv"><span>Paid from</span><b>${esc(e.accountName)}${e.viaAccountName ? ' · from ' + esc(e.viaAccountName) : ''}${e.reference ? ' · ' + esc(e.reference) : ''}</b></div>
<div class="jv-kv"><span>Recorded by</span><b>${esc(e.createdBy || '')} · ${dmy(String(e.created || '').slice(0, 10))}</b></div>
<table class="jb-tbl" style="margin-top:10px"><thead><tr><th>Category</th><th>Description</th><th>Paid To</th><th class="r">Amount</th><th class="r">VAT</th></tr></thead><tbody>
${(e.lines || []).map(l => `<tr><td><span class="jv-ct ${esc(l.costType)}">${esc(l.category || TYPE_LABEL[l.costType])}</span></td><td>${esc(l.desc)}</td><td>${esc(l.paidTo || '—')}</td><td class="r">${fmt(l.amount)}</td><td class="r">${l.vat ? fmt(l.vat) : '—'}</td></tr>`).join('')}
<tr class="jb-tot"><td colspan="3">Total · paid ${fmt(e.total)}</td><td class="r">${fmt(e.amount)}</td><td class="r">${fmt(e.vat)}</td></tr></tbody></table>
${e.note ? `<p class="jv-note" style="margin-top:10px">${esc(e.note)}</p>` : ''}
${e.receipt && e.receipt.url ? `<p style="margin-top:10px"><a class="jv-link" href="${esc(e.receipt.url)}" target="_blank" rel="noopener"><i class="ti ti-paperclip"></i>${esc(e.receipt.name || 'Receipt')}</a></p>` : ''}
<div class="je-cancel" id="jev-cancel" hidden><label for="jev-why">Reason for cancelling *</label><input id="jev-why" maxlength="200" placeholder="e.g. entered twice"><div class="inv-error" id="jev-err" hidden></div></div></div>
<div class="modal-footer jb-ft"><span class="jb-sp"></span>${canX ? '<button type="button" class="btn btn-danger" id="jev-x"><i class="ti ti-ban"></i>Cancel Expense</button>' : ''}<button type="button" class="btn btn-secondary" onclick="closeModal('je-view-modal')">Close</button></div></div>`;
    if (canX) $('jev-x').onclick = async () => {
      const box = $('jev-cancel');
      if (box.hidden) { box.hidden = false; $('jev-x').innerHTML = '<i class="ti ti-ban"></i>Confirm Cancel'; $('jev-why').focus(); return; }
      const why = $('jev-why').value.trim();
      if (why.length < 5) { $('jev-err').hidden = false; $('jev-err').textContent = 'Enter the reason (at least 5 characters).'; return; }
      $('jev-x').disabled = true;
      try {
        const run = () => JC().service.voidJobExpense({ expenseId: e.id, expectedRevision: e.revision, reason: why });
        const r = await (typeof bcBusy === 'function' ? bcBusy('Cancelling the expense…', run) : run());
        Object.assign(e, r.expense);
        closeModal('je-view-modal'); toast(`${e.jeNo} cancelled — its cash / bank line is cancelled too`, 'success');
        if (V && V.job) { V.rows = JC().core.jobCostRows(V.job.id, V.costs); V.bva = JC().core.jobBudgetVsActual(V.job, V.rows, window.BCEst ? BCEst.settings() : {}); paintView(); }
      } catch (err) { $('jev-err').hidden = false; $('jev-err').textContent = (err && err.message) || 'Could not cancel.'; $('jev-x').disabled = false; }
    };
    openModalWithSize('je-view-modal');
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
<button class="btn btn-primary btn-sm bc-filter-btn" id="jbreg-je" type="button" title="Record a cost paid for a job (cash, card or bank)"${canExpense() ? '' : ' hidden'}><i class="ti ti-receipt"></i><span>+ Job Expense</span></button>
</div></div>
<div class="card dn-register-card"><div class="dn-table-scroll"><table class="jb-reg-table"><thead><tr><th>Job No.</th><th>Date</th><th>Customer</th><th>Project / Site</th><th>Customer PO</th><th class="num">Contract (SAR)</th><th class="num">Budget</th><th>Start</th><th>Planned Finish</th><th>Status</th></tr></thead><tbody id="jbreg-body"></tbody></table></div></div>
<p class="jb-reg-hint">Jobs are created from a won Contracting quotation (Quotation → Create Job). Open and recent jobs are shown; older ones are loaded on request.</p></div>`;
    $('jbreg-customer').onchange = e => { F.customer = e.target.value; paint(); };
    $('jbreg-status').onchange = e => { F.status = e.target.value; paint(); };
    $('jbreg-q').oninput = e => { F.q = e.target.value; paint(); };
    $('jbreg-clear').onclick = () => { F.customer = F.status = F.q = ''; $('jbreg-customer').value = ''; $('jbreg-status').value = ''; $('jbreg-q').value = ''; if (window.BCDateFilter) BCDateFilter.set('jbreg', { preset: 'all' }); paint(); };
    if (window.BCDateFilter) BCDateFilter.register('jbreg', () => paint());
    $('jbreg-je').onclick = () => openExpense('');
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

  window.BCJobs = { list: () => jobs.slice(), load, openCreate, openEdit, view, renderRegister, openExpense, expenseNos, costsOf, _tab: t => { if (V) { V.tab = t; paintView(); } } };
})();
