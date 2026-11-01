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
  /** V271.3.2: the user's own calendar day of a saved time (not the UTC day — after midnight Riyadh they differ). */
  const localDay = iso => { const d = new Date(iso || ''); return isNaN(d) ? String(iso || '').slice(0, 10) : (typeof bcLocalISO === 'function' ? bcLocalISO(d) : d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')); };
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
      const rbBtn = e.target.closest('[data-reimb]'); if (rbBtn) { openReimburse(rbBtn.dataset.reimb, rbBtn.dataset.name); return; }
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
    ((V.costs && V.costs.expenses) || []).filter(e => e.status !== 'Voided').forEach(e => items.push({ date: e.date, text: `Job expense ${e.jeNo}${e.submittedBy ? ' · ' + e.submittedBy : ''} · ${(e.lines || []).length} line${(e.lines || []).length === 1 ? '' : 's'} · ${fmt(e.amount)}`, c: 'other' }));
    (V.rows || []).filter(r => r.source === 'stock').forEach(r => items.push({ date: r.date, text: `From stock · ${r.desc} · ${fmt(r.amount)}`, c: 'material' }));
    if (j.workDoneAt) items.push({ date: localDay(j.workDoneAt), at: String(j.workDoneAt), text: `Work done set to ${num(j.workDonePct)} %${j.workDoneBy ? ' by ' + j.workDoneBy : ''}`, c: 'direct' });
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
<div class="jv-kv"><span>Work done</span><b class="jv-wd">${wd == null ? '—' : wd + ' %'}${j.workDoneAt ? ` · set ${dmy(localDay(j.workDoneAt))}` : ''}</b></div><p class="jv-pnote">${cmp}</p></div>`;
  }
  function paintView() {
    const j = V && V.job; if (!j) return;
    $('jv-title').textContent = j.jobNo + (j.project ? ' · ' + j.project : '');
    $('jv-sub').textContent = [j.company, j.poNo ? 'PO ' + j.poNo : '', j.qno, j.startDate ? 'Start ' + dmy(j.startDate) : '', j.finishDate ? 'Planned finish ' + dmy(j.finishDate) : '', j.siteInCharge ? 'In-charge ' + j.siteInCharge : ''].filter(Boolean).join(' · ');
    const st = $('jv-st'); st.textContent = j.status || 'Open'; st.className = 'pr-pill jv-st jv-' + (ST_CLS[j.status] || 'blue');
    const b = j.budget || {}, x = V.bva, see = canSeeCost();
    const nCosts = V.rows ? V.rows.length : 0;
    const nSubs = V.costs ? (V.costs.expenses || []).length : 0;
    $('jv-tabs').innerHTML = [['overview', 'Overview'], ['eva', 'Estimate vs Actual'], ['costs', `Costs${V.costs ? ' (' + nCosts + ')' : ''}`], ['subs', `Submissions${V.costs ? ' (' + nSubs + ')' : ''}`], ['activity', 'Activity']]
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
    else if (V.tab === 'subs') main = subsHtml();
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

  /* ══ Job Expense = one SUBMISSION from the site in-charge (V271.3.2, approved JE_3) ══
     One number for the bundle; each line keeps its own expense date, Paid From (an account, or the in-charge's own
     money — owed to him until paid back) and VAT invoice. Saved with one ledger entry per date + account. */
  const ACC = () => (window.BizCoreAcc ? window.BizCoreAcc.accounts : []).filter(a => a && a.active !== false);
  const TYPE_OPTS = [['material', 'Material'], ['manpower', 'Manpower'], ['subcontract', 'Subcontract'], ['other', 'Equipment / Other']];
  const OWN = '__own';
  const todayISO = () => (window.BCDate ? BCDate.today() : new Date().toISOString().slice(0, 10));
  const blankLine = (prev) => ({ date: prev ? prev.date : todayISO(), cat: '', desc: '', paidTo: '', pay: prev ? prev.pay : '', vatInvoiceNo: '', supplierVat: '', amount: '', vat: '' });
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
  /** The in-charge's own cash account (his site advance): a cash account whose custodian is him. */
  function advanceAccountOf(emp) {
    if (!emp) return null;
    const users = (window.BizCoreUsers && window.BizCoreUsers.users) || [];
    const uids = users.filter(u => u && String(u.employeeId || '') === String(emp.id)).map(u => u.uid);
    const nm = low(emp.name);
    return ACC().find(a => a.type === 'cash' && ((a.custodianUid && uids.includes(a.custodianUid)) || (nm && low(a.custodianName) === nm))) || null;
  }
  const balCache = new Map();   // accountId → { bal, at }
  async function balanceOf(acc) {
    if (!acc) return null;
    const c = balCache.get(acc.id); if (c && Date.now() - c.at < 60000) return c.bal;
    let rec = null;
    try { rec = window.FB && window.FB.fbReadDoc ? await window.FB.fbReadDoc('cashBalances', acc.id) : null; } catch (e) { rec = null; }
    const bal = rec && rec.rebuiltAt ? r2(num(acc.openingBalance) + num(rec.balance)) : null;   // only when the running record is complete
    balCache.set(acc.id, { bal, at: Date.now() });
    return bal;
  }
  let X = null;   // { lines:[], file, op, emp, adv, advBal }
  function ensureExpense() {
    if ($('je-modal')) return;
    const m = document.createElement('div');
    m.className = 'modal-overlay'; m.id = 'je-modal';
    m.innerHTML = `<div class="modal modal-normal je-win" role="dialog" aria-modal="true" aria-labelledby="je-title">
<div class="modal-header jb-hd"><div><h2 id="je-title">New Job Expense — Submission</h2><div class="jb-sub" id="je-sub">No. auto on save</div></div><button type="button" class="close-btn" onclick="closeModal('je-modal')" aria-label="Close">✕</button></div>
<div class="modal-body je-body">
<div class="je-grid">
<div class="jb-f je-job"><label for="je-job">Job <b class="jb-req">*</b></label><select id="je-job"></select></div>
<div class="jb-f"><label for="je-by">Submitted by (in-charge) <b class="jb-req">*</b></label><select id="je-by"></select></div>
<div class="jb-f"><label for="je-date">Date submitted <b class="jb-req">*</b></label><input id="je-date" autocomplete="off"></div>
<div class="jb-f"><label>Received by</label><input id="je-recv" disabled></div>
<div class="jb-f"><label for="je-ref">Reference <em>Optional</em></label><input id="je-ref" maxlength="60" autocomplete="off" placeholder="e.g. Week 45 bundle"></div>
</div>
<div class="je-bal" id="je-bal"></div>
<div class="je-scroll"><table class="jb-tbl je-lines"><thead><tr><th style="width:142px">Expense Date</th><th style="width:170px">Category</th><th>Description</th><th style="width:130px">Paid To</th><th style="width:210px">Paid From</th><th style="width:104px">VAT Inv. No. <em>if VAT</em></th><th style="width:128px">Supplier VAT No.</th><th class="r" style="width:100px">Amount</th><th class="r" style="width:84px">VAT</th><th style="width:30px"></th></tr></thead><tbody id="je-body"></tbody></table></div>
<div class="je-addrow"><button type="button" class="jv-link je-add" id="je-add"><i class="ti ti-plus"></i>Add Line</button><span class="jv-pnote">Enter on VAT adds the next line · the expense date and Paid From copy down</span></div>
<div class="je-tots" id="je-tot"></div>
<div class="je-foot"><div class="jb-f je-note"><label for="je-note">Note <em>Optional</em></label><input id="je-note" maxlength="500" autocomplete="off"></div>
<div class="je-rcpt"><input type="file" id="je-file" accept="image/*,application/pdf" hidden><button type="button" class="btn btn-secondary btn-sm" id="je-file-btn"><i class="ti ti-paperclip"></i>Receipts</button><span id="je-file-name" class="je-fname">One photo / PDF for the bundle — optional</span></div></div>
<p class="jv-hint">Amounts <b>without VAT</b>; VAT apart with the invoice no. (needed to claim it). <b>Own money — reimburse</b>: what the in-charge paid himself — owed to him until paid back (Reimburse). Cash paid out waits for the custodian's confirmation in Cash &amp; Bank.</p>
<div class="inv-error" id="je-err" hidden></div></div>
<div class="modal-footer jb-ft"><span class="jb-chk" id="je-chk"></span><span class="jb-sp"></span><button type="button" class="btn btn-secondary" onclick="closeModal('je-modal')">Cancel</button><button type="button" class="btn btn-primary" id="je-save"><i class="ti ti-device-floppy"></i>Save Submission</button></div></div>`;
    document.body.appendChild(m);
    if (window.BCDate) BCDate.attach($('je-date'), { max: () => BCDate.today(), onCommit: () => jeCheck() });
    $('je-add').onclick = () => addLine(true);
    const body = $('je-body');
    body.addEventListener('input', e => { const t = e.target, i = Number(t.dataset.i); if (!X || !X.lines[i] || !t.dataset.f) return; X.lines[i][t.dataset.f] = t.value; if (t.dataset.f === 'cat' || t.dataset.f === 'pay') jeLines(); else jeCheck(); });
    body.addEventListener('change', e => { const t = e.target, i = Number(t.dataset.i); if (!X || !X.lines[i] || !t.dataset.f) return; X.lines[i][t.dataset.f] = t.value; if (t.dataset.f === 'cat' || t.dataset.f === 'pay' || t.dataset.f === 'date') jeLines(); });
    body.addEventListener('click', e => { const b = e.target.closest('[data-del]'); if (!b || !X) return; X.lines.splice(Number(b.dataset.del), 1); if (!X.lines.length) X.lines.push(blankLine()); jeLines(); });
    body.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset && e.target.dataset.f === 'vat') { e.preventDefault(); addLine(true); } });
    body.addEventListener('focusout', e => { const t = e.target; if (t.dataset && (t.dataset.f === 'amount' || t.dataset.f === 'vat') && String(t.value).trim() !== '' && Number.isFinite(num(t.value))) { t.value = fmt(num(t.value)); X.lines[Number(t.dataset.i)][t.dataset.f] = t.value; jeCheck(); } });
    $('je-job').addEventListener('change', () => { const j = jobs.find(x => x.id === $('je-job').value); if (j && j.siteInChargeId && !$('je-by').value) { $('je-by').value = j.siteInChargeId; byChanged(); } jeCheck(); });
    $('je-by').addEventListener('change', byChanged);
    ['je-ref', 'je-note'].forEach(id => $(id).addEventListener('input', jeCheck));
    $('je-file-btn').onclick = () => $('je-file').click();
    $('je-file').onchange = e => { const f = e.target.files && e.target.files[0]; if (f && f.size > 8 * 1024 * 1024) { toast('The receipts file must be under 8 MB.', 'error'); e.target.value = ''; return; } X.file = f || null; $('je-file-name').textContent = f ? f.name : 'One photo / PDF for the bundle — optional'; };
    $('je-save').onclick = () => saveExpense();
  }
  function addLine(focus) {
    X.lines.push(blankLine(X.lines[X.lines.length - 1]));
    jeLines();
    if (focus) setTimeout(() => { const d = document.querySelectorAll('#je-body .je-cat'); if (d.length) d[d.length - 1].focus(); }, 20);
  }
  async function byChanged() {
    const emp = EMPLOYEES().find(e => String(e.id) === String($('je-by').value)) || null;
    X.emp = emp; X.adv = advanceAccountOf(emp); X.advBal = undefined;
    // lines still without Paid From start from his advance
    X.lines.forEach(l => { if (!l.pay && X.adv) l.pay = X.adv.id; });
    jeLines();
    if (X.adv) { const b = await balanceOf(X.adv); if (X && X.adv) { X.advBal = b; jeCheck(); } }
  }
  function payOptions(sel) {
    const accs = ACC(), adv = X && X.adv;
    const label = a => `${esc(a.name)}${a.type === 'cash' ? ' (cash)' : a.type === 'card' ? ' (card)' : ' (bank)'}`;
    return `<option value="">Choose…</option>${adv ? `<option value="${esc(adv.id)}"${sel === adv.id ? ' selected' : ''}>${esc(adv.name)} — advance</option>` : ''}`
      + `<option value="${OWN}"${sel === OWN ? ' selected' : ''}>Own money — reimburse</option>`
      + accs.filter(a => !adv || a.id !== adv.id).map(a => `<option value="${esc(a.id)}"${sel === a.id ? ' selected' : ''}>${label(a)}</option>`).join('');
  }
  function jeLines() {
    $('je-body').innerHTML = X.lines.map((l, i) => { const c = catOf(l.cat), own = l.pay === OWN;
      return `<tr class="${own ? 'je-own' : ''}"><td><input class="je-d" data-i="${i}" data-d="${i}" value="${esc(dmy(l.date) === '—' ? '' : dmy(l.date))}" autocomplete="off" aria-label="Expense date"></td>
<td><select class="je-cat" data-i="${i}" data-f="cat" aria-label="Category">${catOptions(l.cat)}</select>${c.costType ? `<span class="jv-ct ${c.costType}">${esc(TYPE_LABEL[c.costType])}</span>` : ''}</td>
<td><input data-i="${i}" data-f="desc" maxlength="200" value="${esc(l.desc)}" placeholder="What it was for" aria-label="Description"></td>
<td><input data-i="${i}" data-f="paidTo" maxlength="100" value="${esc(l.paidTo)}" placeholder="—" aria-label="Paid to"></td>
<td><select data-i="${i}" data-f="pay" class="je-pay${own ? ' own' : ''}" aria-label="Paid from">${payOptions(l.pay)}</select></td>
<td><input data-i="${i}" data-f="vatInvoiceNo" maxlength="40" value="${esc(l.vatInvoiceNo)}" aria-label="VAT invoice no."></td>
<td><input data-i="${i}" data-f="supplierVat" maxlength="20" value="${esc(l.supplierVat)}" inputmode="numeric" aria-label="Supplier VAT no."></td>
<td><input class="r" data-i="${i}" data-f="amount" inputmode="decimal" value="${esc(l.amount)}" placeholder="0.00" aria-label="Amount"></td>
<td><input class="r" data-i="${i}" data-f="vat" inputmode="decimal" value="${esc(l.vat)}" placeholder="0.00" aria-label="VAT"></td>
<td><button type="button" class="cs-x" data-del="${i}" title="Remove line" aria-label="Remove line">✕</button></td></tr>`; }).join('');
    // the standard date field (type DD-MM-YYYY or pick), not in the future
    if (window.BCDate) document.querySelectorAll('#je-body .je-d').forEach(el => { const i = Number(el.dataset.d); BCDate.attach(el, { max: () => BCDate.today(), onCommit: () => { if (X && X.lines[i]) { X.lines[i].date = BCDate.getISO(el) || ''; jeCheck(); } } }); BCDate.setISO(el, X.lines[i].date || ''); });
    jeCheck();
  }
  function jeInput() {
    const emp = X.emp;
    return { jobId: $('je-job').value, date: window.BCDate ? BCDate.getISO($('je-date')) || '' : $('je-date').value, submittedById: emp ? String(emp.id) : '', submittedBy: emp ? emp.name || '' : '',
      reference: $('je-ref').value, note: $('je-note').value,
      lines: X.lines.map(l => ({ ...catOf(l.cat), date: l.date, desc: l.desc, paidTo: l.paidTo, own: l.pay === OWN, accountId: l.pay === OWN ? '' : l.pay,
        vatInvoiceNo: l.vatInvoiceNo, supplierVat: l.supplierVat, amount: String(l.amount).replace(/,/g, ''), vat: String(l.vat).replace(/,/g, '') })) };
  }
  function jeValidate() {
    const inp = jeInput(), job = jobs.find(j => j.id === inp.jobId) || null;
    const accs = new Map((window.BizCoreAcc ? window.BizCoreAcc.accounts : []).map(a => [a.id, a]));
    return JC() ? JC().core.validateJobExpense(inp, { job, accounts: accs, today: todayISO() }) : { ok: false, errors: [{ message: 'Not available' }], value: { amount: 0, vat: 0, total: 0, ownMoney: 0, paidFromAccounts: 0, lines: [] } };
  }
  /** Earlier submissions of this job with the same VAT invoice (loaded costs only) — a warning, not a block. */
  function dupInvoices(v) {
    const c = costCache.get($('je-job').value); if (!c) return [];
    const seen = new Set();
    (c.expenses || []).filter(e => e.status !== 'Voided').forEach(e => (e.lines || []).forEach(l => { if (l.vatInvoiceNo) seen.add(low(l.vatInvoiceNo) + '|' + low(l.supplierVat || l.paidTo)); }));
    return [...new Set(v.value.lines.filter(l => l.vatInvoiceNo && seen.has(low(l.vatInvoiceNo) + '|' + low(l.supplierVat || l.paidTo))).map(l => l.vatInvoiceNo))];
  }
  function jeCheck() {
    if (!X || !$('je-chk')) return;
    const v = jeValidate(); X.v = v;
    const val = v.value;
    // totals (JE_3): by cost type, by who paid, VAT invoices
    const byType = {}; val.lines.forEach(l => { if (l.costType) byType[l.costType] = r2((byType[l.costType] || 0) + l.amount); });
    const byPay = new Map(); val.lines.forEach(l => { const k = l.payMode === 'own' ? OWN : l.accountId; if (!k) return; const x = byPay.get(k) || { name: l.payMode === 'own' ? `${X.emp ? X.emp.name + "'s" : 'His'} own money → reimburse` : l.accountName, amt: 0 }; x.amt = r2(x.amt + l.amount + l.vat); byPay.set(k, x); });
    const inv = new Set(val.lines.filter(l => l.vat > 0).map(l => low(l.vatInvoiceNo) + '|' + low(l.supplierVat || l.paidTo)));
    $('je-tot').innerHTML = `<div class="je-box"><h4>By cost type (job cost, without VAT)</h4>${TYPE_OPTS.filter(([k]) => byType[k]).map(([k, t]) => `<div class="je-kv"><span>${t}</span><b>${fmt(byType[k])}</b></div>`).join('') || '<div class="je-kv"><span class="m">—</span></div>'}<div class="je-kv big"><span>Cost to the job</span><b>${fmt(val.amount)}</b></div></div>
<div class="je-box"><h4>By who paid</h4>${[...byPay.values()].map(x => `<div class="je-kv"><span>${esc(x.name)}</span><b>${fmt(x.amt)}</b></div>`).join('') || '<div class="je-kv"><span class="m">—</span></div>'}<div class="je-kv big"><span>Total paid</span><b>${fmt(val.total)}</b></div></div>
<div class="je-box"><h4>VAT invoices</h4><div class="je-kv"><span>${inv.size} invoice${inv.size === 1 ? '' : 's'} · input VAT</span><b>${fmt(val.vat)}</b></div><div class="je-kv"><span class="m">Kept for the VAT return (supplier, VAT No., invoice no., date)</span></div></div>`;
    // the advance strip
    const advUse = X.adv ? r2(val.lines.filter(l => l.payMode === 'account' && l.accountId === X.adv.id).reduce((s2, l) => s2 + l.amount + l.vat, 0)) : 0;
    const advLeft = X.advBal == null ? null : r2(X.advBal - advUse);
    $('je-bal').innerHTML = X.emp ? `${X.adv ? `<div class="je-bc${advLeft != null && advLeft < -0.004 ? ' warn' : ''}"><span class="je-dot"></span>${esc(X.adv.name)} (site advance)${X.advBal == null ? `<span>this submission</span><b>−${fmt(advUse)}</b>` : `<span>before</span><b>${fmt(X.advBal)}</b><span>this submission</span><b>−${fmt(advUse)}</b><span>after</span><b>${fmt(advLeft)}</b>`}</div>` : `<div class="je-bc"><span class="je-dot"></span>${esc(X.emp.name)} has no cash account of his own in Cash &amp; Bank — choose the account per line.</div>`}
${val.ownMoney > 0 ? `<div class="je-bc own"><span class="je-dot own"></span>${esc(X.emp.name)}'s own money — <b>${fmt(val.ownMoney)}</b> to reimburse</div>` : ''}${advLeft != null && advLeft < -0.004 ? `<div class="je-bc warn">The advance is ${fmt(-advLeft)} short — set the rest as <b>Own money — reimburse</b>.</div>` : ''}` : '';
    const todo = [];
    if (v.errors.some(e => e.field === 'job')) todo.push('Job');
    if (v.errors.some(e => e.field === 'submittedBy')) todo.push('Submitted by');
    if (v.errors.some(e => e.field === 'date')) todo.push('Date submitted');
    const nl = new Set(v.errors.filter(e => e.line != null).map(e => e.line)).size; if (nl) todo.push(nl + ' line' + (nl > 1 ? 's' : '') + ' to complete');
    if (v.errors.some(e => e.field === 'lines')) todo.push(v.errors.find(e => e.field === 'lines').message);
    const dups = v.ok ? dupInvoices(v) : [];
    $('je-chk').className = 'jb-chk' + (todo.length || dups.length ? ' is-todo' : '');
    $('je-chk').textContent = todo.length ? 'To continue: ' + todo.join(' · ') : dups.length ? `⚠ VAT invoice ${dups.join(', ')} is already in an earlier submission of this job — check before saving` : `✓ Ready · ${val.lines.length} line${val.lines.length === 1 ? '' : 's'}`;
    $('je-chk').title = v.errors.map(e => e.message).join('\n');
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
    X = { lines: [blankLine()], file: null, op: 'je-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10), emp: null, adv: null, advBal: undefined };
    $('je-job').innerHTML = '<option value="">Choose the job…</option>' + open.map(j => `<option value="${esc(j.id)}">${esc(j.jobNo)}${j.company ? ' · ' + esc(j.company) : ''}${j.project ? ' · ' + esc(j.project) : ''}</option>`).join('');
    $('je-job').value = jobId && open.some(j => j.id === jobId) ? jobId : open.length === 1 ? open[0].id : '';
    const emps = EMPLOYEES().slice().sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    $('je-by').innerHTML = '<option value="">Choose…</option>' + emps.map(e => `<option value="${esc(e.id)}">${esc(e.name || '')}${e.designation ? ' — ' + esc(e.designation) : ''}</option>`).join('');
    const j0 = jobs.find(j => j.id === $('je-job').value);
    $('je-by').value = j0 && j0.siteInChargeId && emps.some(e => String(e.id) === String(j0.siteInChargeId)) ? j0.siteInChargeId : '';
    $('je-recv').value = who() || '—';
    if (window.BCDate) BCDate.setISO($('je-date'), todayISO()); else $('je-date').value = todayISO();
    ['je-ref', 'je-note'].forEach(id => { $(id).value = ''; });
    $('je-file').value = ''; $('je-file-name').textContent = 'One photo / PDF for the bundle — optional';
    $('je-err').hidden = true;
    const x = typeof docNumberParts === 'function' ? docNumberParts('jobExpense') : { displayPrefix: 'JE-' };
    $('je-sub').textContent = `No. auto on save · ${x.displayPrefix}…`;
    if (!ACC().length && window.BizCoreAcc) { const off = window.BizCoreAcc.onChange(() => { off(); if (X) { X.adv = advanceAccountOf(X.emp); jeLines(); } }); }
    openModalWithSize('je-modal');
    if ($('je-by').value) await byChanged(); else jeLines();
    if ($('je-job').value && !costCache.has($('je-job').value)) costsOf($('je-job').value).then(() => jeCheck()).catch(() => {});
    setTimeout(() => { const c = document.querySelector('#je-body .je-cat'); ($('je-job').value && $('je-by').value ? c : $('je-job').value ? $('je-by') : $('je-job'))?.focus(); }, 60);
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
        const path = 'jobExpenses/' + X.op + '/' + Date.now() + '_' + String(X.file.name || 'receipts').replace(/[^\w.-]+/g, '_').slice(-80);
        const url = await (typeof bcBusy === 'function' ? bcBusy('Uploading the receipts…', () => window.FB.uploadFile(path, X.file)) : window.FB.uploadFile(path, X.file));
        if (!url) { $('je-err').hidden = false; $('je-err').textContent = 'The receipts file could not be uploaded. Try again, or remove it and save without it.'; return; }
        receipt = { url, path, name: X.file.name || 'receipts' };
      }
      const x = docNumberParts('jobExpense');
      const run = () => JC().service.createJobExpense({ ...jeInput(), operationId: X.op, receipt, numbering: { counterKey: x.counterKey, displayPrefix: x.displayPrefix, digits: x.digits, floor: x.floor } });
      const r = await (typeof bcBusy === 'function' ? bcBusy('Saving the submission…', run) : run());
      const e = r.expense;
      upsertExpense(e);
      if (X.adv) balCache.delete(X.adv.id);
      closeModal('je-modal');
      toast(`${e.jeNo} saved · ${e.lines.length} line${e.lines.length === 1 ? '' : 's'} · ${fmt(e.total)}${e.ownMoney > 0 ? ` · ${fmt(e.ownMoney)} to reimburse ${e.submittedBy}` : ''}`, 'success', 'Job expense');
      if (V && V.job && V.job.id === e.jobId && $('job-view-modal')?.classList.contains('open')) { V.tab = 'subs'; refreshView(); } else view(e.jobId, { tab: 'subs' });
    } catch (e) {
      $('je-err').hidden = false; $('je-err').textContent = e && e.code === 'permission-denied' ? 'The server refused the submission (Cash & Bank → Create is needed). Please reload and try again.' : (e && e.message) || 'The submission was not saved — please try again.';
    } finally { jeSaving = false; if (X) jeCheck(); }
  }
  function upsertExpense(e) {
    const c = costCache.get(e.jobId); if (!c) return;
    const i = c.expenses.findIndex(z => z.id === e.id); if (i > -1) c.expenses[i] = e; else c.expenses.push(e);
  }
  function refreshView() {
    if (!V || !V.job || !V.costs) return;
    V.rows = JC().core.jobCostRows(V.job.id, V.costs); V.bva = JC().core.jobBudgetVsActual(V.job, V.rows, window.BCEst ? BCEst.settings() : {}); paintView();
  }

  /* ── Submissions tab + Owed to staff (JE_4) ── */
  function subsHtml() {
    if (!V.costs) return `<div class="jb-empty">${V.loading ? 'Loading…' : esc(V.error || '')}</div>`;
    const list = (V.costs.expenses || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.jeNo).localeCompare(String(a.jeNo), undefined, { numeric: true }));
    const owed = new Map();
    list.forEach(e => { const o = JC().core.owedOf(e); if (o > 0.004) { const k = e.submittedById || e.submittedBy; const x = owed.get(k) || { id: e.submittedById, name: e.submittedBy, amt: 0, nos: [] }; x.amt = r2(x.amt + o); x.nos.push(e.jeNo); owed.set(k, x); } });
    const st = e => e.status === 'Voided' ? '<span class="jv-st jv-red">Cancelled</span>' : e.reimburseStatus === 'open' ? `<span class="jv-st jv-amber">${fmt(JC().core.owedOf(e))} to reimburse</span>` : e.reimburseStatus === 'settled' ? '<span class="jv-st jv-green">Reimbursed</span>' : '<span class="jv-st jv-green">Settled</span>';
    const canR = canExpense();
    return `<div class="jv-two"><div><div class="jv-scroll"><table class="jb-tbl jv-subs"><thead><tr><th>Submission</th><th>Submitted</th><th>By</th><th class="r">Lines</th><th class="r">Job cost</th><th class="r">Paid</th><th>Status</th></tr></thead><tbody>
${list.length ? list.map(e => `<tr class="${e.status === 'Voided' ? 'jv-void' : ''}"><td><button type="button" class="jv-link" data-open="je" data-id="${esc(e.id)}"><i class="ti ti-receipt"></i>${esc(e.jeNo)}</button></td><td class="nw">${dmy(e.date)}</td><td>${esc(e.submittedBy || e.accountName || '—')}</td><td class="r">${(e.lines || []).length}</td><td class="r">${fmt(e.amount)}</td><td class="r">${fmt(e.total)}</td><td>${st(e)}</td></tr>`).join('')
  : '<tr><td colspan="7" class="jv-none">No submissions yet. Use <b>+ Job Expense</b> when the in-charge brings his receipts.</td></tr>'}</tbody></table></div>
<p class="jv-hint">Click a submission to see its lines, print the voucher or cancel it.</p></div>
<div class="jv-side"><div class="jv-box"><h4>Owed to staff (own money)</h4>${owed.size ? [...owed.values()].map(o => `<div class="jv-kv"><span>${esc(o.name)}<small class="jv-sm">${esc(o.nos.join(', '))}</small></span><b>${fmt(o.amt)}</b></div>${canR ? `<div class="jv-owe-acts"><button type="button" class="btn btn-primary btn-sm" data-reimb="${esc(o.id || '')}" data-name="${esc(o.name)}"><i class="ti ti-cash"></i>Reimburse…</button></div>` : ''}`).join('') : '<p class="jv-pnote">Nothing owed — every submission was paid from an account or is paid back.</p>'}
<p class="jv-pnote"><b>Reimburse</b>: paid from office cash / bank to the in-charge — clears what is owed (all his jobs). <b>Top up his advance</b>: a handover into his cash account in Cash &amp; Bank.</p></div></div></div>`;
  }

  /* ── one submission: lines, Print, Cancel ── */
  async function reimbursementsOf(je) {
    if (!window.FB || !window.FB.fbQueryWhere) return [];
    try { return await window.FB.fbQueryWhere(JC().core.RB_COLLECTION, 'jobExpenseIds', 'array-contains', je.id); } catch (e) { return []; }
  }
  async function viewExpense(id) {
    const e = V && V.costs ? (V.costs.expenses || []).find(x => x.id === id) : null; if (!e) return;
    let m = $('je-view-modal');
    if (!m) { m = document.createElement('div'); m.className = 'modal-overlay'; m.id = 'je-view-modal'; document.body.appendChild(m); }
    const voided = e.status === 'Voided', canX = !voided && !(num(e.reimbursed) > 0.004) && (typeof window.bcCan !== 'function' || window.bcCan('cash', 'x'));
    const lines = (e.lines || []).slice().sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
    m.innerHTML = `<div class="modal je-vwin" role="dialog" aria-modal="true" aria-labelledby="jev-title"><div class="modal-header jb-hd"><div><h2 id="jev-title">${esc(e.jeNo)} · Job Expense</h2><div class="jb-sub">${esc(e.jobNo)}${e.project ? ' · ' + esc(e.project) : ''} · submitted ${dmy(e.date)}${e.submittedBy ? ' by ' + esc(e.submittedBy) : ''}</div></div>${voided ? '<span class="pr-pill jv-st jv-red">Cancelled</span>' : e.reimburseStatus === 'open' ? `<span class="pr-pill jv-st jv-amber">${fmt(JC().core.owedOf(e))} to reimburse</span>` : ''}<button type="button" class="close-btn" onclick="closeModal('je-view-modal')" aria-label="Close">✕</button></div>
<div class="modal-body je-body">${voided ? `<div class="jv-warn"><i class="ti ti-ban"></i>Cancelled by ${esc(e.voidedBy || '')} — ${esc(e.voidReason || '')}</div>` : ''}
<div class="je-vgrid"><div class="jv-kv"><span>Received by</span><b>${esc(e.createdBy || '')} · ${dmy(localDay(e.created))}</b></div><div class="jv-kv"><span>Reference</span><b>${esc(e.reference || '—')}</b></div></div>
<div class="jv-scroll"><table class="jb-tbl" style="margin-top:10px"><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Paid To</th><th>VAT Inv. No.</th><th>Paid From</th><th class="r">Amount</th><th class="r">VAT</th></tr></thead><tbody>
${lines.map(l => `<tr class="${l.payMode === 'own' ? 'je-own' : ''}"><td class="nw">${dmy(l.date || e.date)}</td><td><span class="jv-ct ${esc(l.costType)}">${esc(l.category || TYPE_LABEL[l.costType])}</span></td><td>${esc(l.desc)}</td><td>${esc(l.paidTo || '—')}</td><td>${esc(l.vatInvoiceNo || '—')}</td><td>${l.payMode === 'own' ? 'Own money' : esc(l.accountName || e.accountName || '')}</td><td class="r">${fmt(l.amount)}</td><td class="r">${l.vat ? fmt(l.vat) : '—'}</td></tr>`).join('')}
<tr class="jb-tot"><td colspan="6">Total · paid ${fmt(e.total)}${num(e.ownMoney) > 0 ? ` · own money ${fmt(e.ownMoney)}` : ''}</td><td class="r">${fmt(e.amount)}</td><td class="r">${fmt(e.vat)}</td></tr></tbody></table></div>
${e.note ? `<p class="jv-note" style="margin-top:10px">${esc(e.note)}</p>` : ''}
${e.receipt && e.receipt.url ? `<p style="margin-top:10px"><a class="jv-link" href="${esc(e.receipt.url)}" target="_blank" rel="noopener"><i class="ti ti-paperclip"></i>${esc(e.receipt.name || 'Receipts')}</a></p>` : ''}
<div id="jev-rbs"></div>
${!voided && num(e.reimbursed) > 0.004 ? '<p class="jv-pnote">Part of it is paid back — cancel that reimbursement first to cancel this submission.</p>' : ''}
<div class="je-cancel" id="jev-cancel" hidden><label for="jev-why">Reason for cancelling *</label><input id="jev-why" maxlength="200" placeholder="e.g. entered twice"><div class="inv-error" id="jev-err" hidden></div></div></div>
<div class="modal-footer jb-ft">${canX ? '<button type="button" class="btn btn-danger" id="jev-x"><i class="ti ti-ban"></i>Cancel Submission</button>' : ''}<span class="jb-sp"></span><button type="button" class="btn btn-secondary" id="jev-print"><i class="ti ti-printer"></i>Print Voucher</button><button type="button" class="btn btn-secondary" onclick="closeModal('je-view-modal')">Close</button></div></div>`;
    $('jev-print').onclick = () => printExpense(e);
    if (canX) $('jev-x').onclick = async () => {
      const box = $('jev-cancel');
      if (box.hidden) { box.hidden = false; $('jev-x').innerHTML = '<i class="ti ti-ban"></i>Confirm Cancel'; $('jev-why').focus(); return; }
      const why = $('jev-why').value.trim();
      if (why.length < 5) { $('jev-err').hidden = false; $('jev-err').textContent = 'Enter the reason (at least 5 characters).'; return; }
      $('jev-x').disabled = true;
      try {
        const run = () => JC().service.voidJobExpense({ expenseId: e.id, expectedRevision: e.revision, reason: why });
        const r = await (typeof bcBusy === 'function' ? bcBusy('Cancelling the submission…', run) : run());
        upsertExpense(r.expense);
        closeModal('je-view-modal'); toast(`${e.jeNo} cancelled — its cash / bank lines are cancelled too`, 'success');
        refreshView();
      } catch (err) { $('jev-err').hidden = false; $('jev-err').textContent = (err && err.message) || 'Could not cancel.'; $('jev-x').disabled = false; }
    };
    openModalWithSize('je-view-modal');
    if (num(e.ownMoney) > 0) {
      const rbs = await reimbursementsOf(e);
      const box = $('jev-rbs'); if (!box) return;
      box.innerHTML = rbs.length ? `<div class="jv-box" style="margin-top:12px"><h4>Paid back</h4>${rbs.map(rb => `<div class="jv-kv"><span><button type="button" class="jv-link" data-rb="${esc(rb.id)}">${esc(rb.rbNo)}</button> · ${dmy(rb.date)} · ${esc(rb.accountName)}${rb.status === 'Voided' ? ' · <span class="jv-st jv-red">Cancelled</span>' : ''}</span><b>${fmt(((rb.items || []).find(i => i.jobExpenseId === e.id) || {}).amount)}</b></div>`).join('')}</div>` : '';
      box.onclick = ev => { const b = ev.target.closest('[data-rb]'); if (b) viewReimbursement(rbs.find(x => x.id === b.dataset.rb)); };
    }
  }

  /* ── Reimburse (JE_4) — what the in-charge paid himself, paid back from office cash / bank ── */
  let R = null;
  async function openReimburse(empId, empName) {
    if (!canExpense()) { toast('Your role cannot pay reimbursements (Cash & Bank → Create).', 'error'); return; }
    if (window.BizCoreAcc) window.BizCoreAcc.start();
    let open = [];
    try { open = window.FB && window.FB.fbQueryWhere ? await window.FB.fbQueryWhere(JC().core.JE_COLLECTION, 'submittedById', '==', String(empId), [['reimburseStatus', '==', 'open']]) : []; } catch (e) { open = []; }
    if (!open.length && V && V.costs) open = (V.costs.expenses || []).filter(e => (e.submittedById || e.submittedBy) === (empId || empName) && JC().core.owedOf(e) > 0.004);
    open = open.filter(e => JC().core.owedOf(e) > 0.004).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    if (!open.length) { toast('Nothing is owed to ' + empName + '.', 'info'); return; }
    R = { empId: String(empId || ''), empName, open, op: 'rb-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10), pick: new Map(open.map(e => [e.id, fmt(JC().core.owedOf(e))])) };
    let m = $('rb-modal');
    if (!m) { m = document.createElement('div'); m.className = 'modal-overlay'; m.id = 'rb-modal'; document.body.appendChild(m); }
    const accs = ACC().filter(a => !(advanceAccountOf(EMPLOYEES().find(x => String(x.id) === R.empId)) || {}).id || a.id !== advanceAccountOf(EMPLOYEES().find(x => String(x.id) === R.empId)).id);
    const x = typeof docNumberParts === 'function' ? docNumberParts('reimbursement') : { displayPrefix: 'RB-' };
    m.innerHTML = `<div class="modal je-vwin" role="dialog" aria-modal="true" aria-labelledby="rb-title"><div class="modal-header jb-hd"><div><h2 id="rb-title">Reimburse ${esc(empName)}</h2><div class="jb-sub">No. auto on save · ${esc(x.displayPrefix)}…</div></div><button type="button" class="close-btn" onclick="closeModal('rb-modal')" aria-label="Close">✕</button></div>
<div class="modal-body je-body"><div class="je-grid rb-grid"><div class="jb-f"><label for="rb-date">Date paid <b class="jb-req">*</b></label><input id="rb-date" autocomplete="off"></div>
<div class="jb-f"><label for="rb-acc">Paid from <b class="jb-req">*</b></label><select id="rb-acc"><option value="">Choose the account…</option>${accs.map(a => `<option value="${esc(a.id)}">${esc(a.name)}${a.type === 'cash' ? ' (cash)' : a.type === 'card' ? ' (card)' : ' (bank)'}</option>`).join('')}</select></div>
<div class="jb-f"><label for="rb-ref">Reference <em>Optional</em></label><input id="rb-ref" maxlength="60" autocomplete="off"></div></div>
<table class="jb-tbl" style="margin-top:10px"><thead><tr><th style="width:30px"></th><th>Submission</th><th>Submitted</th><th>Job</th><th class="r">Owed</th><th class="r" style="width:130px">Pay now</th></tr></thead><tbody id="rb-body">
${open.map(e => `<tr><td><input type="checkbox" data-pk="${esc(e.id)}" checked aria-label="Pay back ${esc(e.jeNo)}"></td><td>${esc(e.jeNo)}</td><td>${dmy(e.date)}</td><td>${esc(e.jobNo)}${e.project ? ' · ' + esc(e.project) : ''}</td><td class="r">${fmt(JC().core.owedOf(e))}</td><td><input class="r rb-amt" data-amt="${esc(e.id)}" inputmode="decimal" value="${fmt(JC().core.owedOf(e))}" aria-label="Amount"></td></tr>`).join('')}</tbody></table>
<div class="je-tots rb-tot" id="rb-tot"></div><div class="inv-error" id="rb-err" hidden></div></div>
<div class="modal-footer jb-ft"><span class="jb-chk" id="rb-chk"></span><span class="jb-sp"></span><button type="button" class="btn btn-secondary" onclick="closeModal('rb-modal')">Cancel</button><button type="button" class="btn btn-primary" id="rb-save"><i class="ti ti-cash"></i>Save Reimbursement</button></div></div>`;
    if (window.BCDate) { BCDate.attach($('rb-date'), { max: () => BCDate.today(), onCommit: rbCheck }); BCDate.setISO($('rb-date'), todayISO()); } else $('rb-date').value = todayISO();
    m.addEventListener('input', rbCheck); m.addEventListener('change', rbCheck);
    $('rb-save').onclick = saveReimbursement;
    rbCheck();
    openModalWithSize('rb-modal');
  }
  function rbInput() {
    const items = [...document.querySelectorAll('#rb-body [data-pk]')].filter(c => c.checked).map(c => ({ jobExpenseId: c.dataset.pk, amount: String(document.querySelector(`#rb-body [data-amt="${c.dataset.pk}"]`).value || '').replace(/,/g, '') }));
    return { employeeId: R.empId, employeeName: R.empName, date: window.BCDate ? BCDate.getISO($('rb-date')) || '' : $('rb-date').value, accountId: $('rb-acc').value, reference: $('rb-ref').value, items };
  }
  function rbCheck() {
    if (!R || !$('rb-chk')) return;
    const accs = new Map((window.BizCoreAcc ? window.BizCoreAcc.accounts : []).map(a => [a.id, a]));
    const v = JC().core.validateReimbursement(rbInput(), { expenses: new Map(R.open.map(e => [e.id, e])), accounts: accs, today: todayISO() });
    R.v = v;
    const owed = r2(R.open.reduce((s2, e) => s2 + JC().core.owedOf(e), 0));
    $('rb-tot').innerHTML = `<div class="je-box"><h4>Owed to ${esc(R.empName)}</h4><div class="je-kv"><span>Before this payment</span><b>${fmt(owed)}</b></div><div class="je-kv"><span>Paid now</span><b>${fmt(v.value.amount)}</b></div><div class="je-kv big"><span>Still owed</span><b>${fmt(r2(owed - v.value.amount))}</b></div></div>`;
    $('rb-chk').className = 'jb-chk' + (v.ok ? '' : ' is-todo');
    $('rb-chk').textContent = v.ok ? `✓ Ready · ${fmt(v.value.amount)} to ${R.empName}` : 'To continue: ' + v.errors.map(e => e.message).join(' ');
    $('rb-save').disabled = !v.ok;
  }
  let rbSaving = false;
  async function saveReimbursement() {
    if (rbSaving || !R || !R.v || !R.v.ok) return;
    if (navigator.onLine === false) { toast('You are offline. A reimbursement is saved online only — connect and try again.', 'error'); return; }
    rbSaving = true; $('rb-save').disabled = true; $('rb-err').hidden = true;
    try {
      const x = docNumberParts('reimbursement');
      const run = () => JC().service.createReimbursement({ ...rbInput(), operationId: R.op, numbering: { counterKey: x.counterKey, displayPrefix: x.displayPrefix, digits: x.digits, floor: x.floor } });
      const r = await (typeof bcBusy === 'function' ? bcBusy('Saving the reimbursement…', run) : run());
      (r.expenses || []).forEach(upsertExpense);
      closeModal('rb-modal');
      toast(`${r.reimbursement.rbNo} · ${fmt(r.reimbursement.amount)} paid back to ${r.reimbursement.employeeName}`, 'success', 'Reimbursement');
      refreshView();
      viewReimbursement(r.reimbursement);
    } catch (e) {
      $('rb-err').hidden = false; $('rb-err').textContent = e && e.code === 'permission-denied' ? 'The server refused it (Cash & Bank → Create is needed). Please reload and try again.' : (e && e.message) || 'Not saved — please try again.';
    } finally { rbSaving = false; if (R) rbCheck(); }
  }
  function viewReimbursement(rb) {
    if (!rb) return;
    let m = $('rb-view-modal');
    if (!m) { m = document.createElement('div'); m.className = 'modal-overlay'; m.id = 'rb-view-modal'; document.body.appendChild(m); }
    const voided = rb.status === 'Voided', canX = !voided && (typeof window.bcCan !== 'function' || window.bcCan('cash', 'x'));
    m.innerHTML = `<div class="modal je-vwin" role="dialog" aria-modal="true" aria-labelledby="rbv-title"><div class="modal-header jb-hd"><div><h2 id="rbv-title">${esc(rb.rbNo)} · Reimbursement</h2><div class="jb-sub">${esc(rb.employeeName)} · ${dmy(rb.date)} · from ${esc(rb.accountName)}</div></div>${voided ? '<span class="pr-pill jv-st jv-red">Cancelled</span>' : ''}<button type="button" class="close-btn" onclick="closeModal('rb-view-modal')" aria-label="Close">✕</button></div>
<div class="modal-body je-body">${voided ? `<div class="jv-warn"><i class="ti ti-ban"></i>Cancelled by ${esc(rb.voidedBy || '')} — ${esc(rb.voidReason || '')}</div>` : ''}
<table class="jb-tbl"><thead><tr><th>Submission</th><th>Submitted</th><th>Job</th><th class="r">Paid back</th></tr></thead><tbody>${(rb.items || []).map(i => `<tr><td>${esc(i.jeNo)}</td><td>${dmy(i.submitted)}</td><td>${esc(i.jobNo)}${i.project ? ' · ' + esc(i.project) : ''}</td><td class="r">${fmt(i.amount)}</td></tr>`).join('')}<tr class="jb-tot"><td colspan="3">Total</td><td class="r">${fmt(rb.amount)}</td></tr></tbody></table>
<div class="je-cancel" id="rbv-cancel" hidden><label for="rbv-why">Reason for cancelling *</label><input id="rbv-why" maxlength="200" placeholder="e.g. wrong account"><div class="inv-error" id="rbv-err" hidden></div></div></div>
<div class="modal-footer jb-ft">${canX ? '<button type="button" class="btn btn-danger" id="rbv-x"><i class="ti ti-ban"></i>Cancel Reimbursement</button>' : ''}<span class="jb-sp"></span><button type="button" class="btn btn-secondary" id="rbv-print"><i class="ti ti-printer"></i>Print Voucher</button><button type="button" class="btn btn-secondary" onclick="closeModal('rb-view-modal')">Close</button></div></div>`;
    $('rbv-print').onclick = () => printReimbursement(rb);
    if (canX) $('rbv-x').onclick = async () => {
      const box = $('rbv-cancel');
      if (box.hidden) { box.hidden = false; $('rbv-x').innerHTML = '<i class="ti ti-ban"></i>Confirm Cancel'; $('rbv-why').focus(); return; }
      const why = $('rbv-why').value.trim();
      if (why.length < 5) { $('rbv-err').hidden = false; $('rbv-err').textContent = 'Enter the reason (at least 5 characters).'; return; }
      $('rbv-x').disabled = true;
      try {
        const run = () => JC().service.voidReimbursement({ reimbursementId: rb.id, operationId: 'rbv-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8), reason: why });
        const r = await (typeof bcBusy === 'function' ? bcBusy('Cancelling the reimbursement…', run) : run());
        (r.expenses || []).forEach(upsertExpense);
        closeModal('rb-view-modal'); toast(`${rb.rbNo} cancelled — the amount is owed again`, 'success');
        refreshView();
      } catch (err) { $('rbv-err').hidden = false; $('rbv-err').textContent = (err && err.message) || 'Could not cancel.'; $('rbv-x').disabled = false; }
    };
    openModalWithSize('rb-view-modal');
  }

  /* ── prints (JE_5, JE_6): A4, internal, the company letterhead and the footer at the bottom like every document ── */
  const words = n => { try { return window.BizCoreRct && window.BizCoreRct.core && window.BizCoreRct.core.amountInWords ? window.BizCoreRct.core.amountInWords(n) : ''; } catch (e) { return ''; } };
  /* internal vouchers (agreed 2 Nov 2026): a small logo, no address block — more room for the lines */
  function letterhead(title, no, dateLabel, date) {
    const cp = typeof dnCompanyProfile === 'function' ? dnCompanyProfile() : { name: 'Company' };
    const logo = cp.logo ? `<img src="${cp.logo}" alt="${esc(cp.name)}" class="jx-logo">` : `<div class="jx-coname">${esc(cp.name)}</div>`;
    return { parts: [esc(cp.name || '')], head: `<div class="jx-head"><div>${logo}</div><div class="jx-tbox"><h1>${title}<span class="jx-int">INTERNAL</span></h1><div class="jx-tmeta"><div><small>No.</small><strong>${esc(no)}</strong></div><div><small>${dateLabel}</small><strong>${dmy(date)}</strong></div></div></div></div>` };
  }
  const JX_CSS = `.inv-a4.jx-a4{--ia:#173a5e;--ia-soft:#c7d7e8;--ia-tint:#f1f5f9;--ia-ink:#173a5e;position:relative}
.jx-a4 .jx-head{display:flex;justify-content:space-between;align-items:center;gap:16px;padding-bottom:8px;border-bottom:2px solid #173a5e}
.jx-a4 .jx-logo{max-width:150px;max-height:40px;width:auto;height:auto;object-fit:contain;display:block}
.jx-a4 .jx-coname{font-size:15px;font-weight:800;color:#173a5e}
.jx-a4 .jx-tbox{text-align:right}.jx-a4 .jx-tbox h1{margin:0;font-size:16px;letter-spacing:.3px;color:#173a5e;white-space:nowrap}
.jx-a4 .jx-tmeta{display:flex;gap:18px;justify-content:flex-end;margin-top:4px}.jx-a4 .jx-tmeta small{display:block;font-size:8px;color:#64748b;text-transform:uppercase;letter-spacing:.05em;text-align:right}.jx-a4 .jx-tmeta strong{font-size:11.5px}
.jx-a4 .dn-bottom{grid-template-columns:1fr 1fr 1fr}
.jx-a4 .dn-foot{white-space:normal}
.jx-a4 .jx-int{display:inline-block;margin-left:8px;font-size:9px;font-weight:700;letter-spacing:.06em;color:#92400e;background:#fef3c7;border-radius:3px;padding:1px 5px;vertical-align:middle}
.jx-a4 .jx-info{display:grid;grid-template-columns:1fr 1fr;gap:3px 22px;margin:10px 0;font-size:10px}.jx-a4 .jx-info div{display:flex;gap:8px}.jx-a4 .jx-info span{color:#64748b;min-width:90px}
.jx-a4 .dn-items td,.jx-a4 .dn-items th{white-space:nowrap;font-size:9.4px}.jx-a4 .dn-items td.jx-wrap{white-space:normal}.jx-a4 .dn-items td small{display:block;color:#64748b;font-size:8.4px}
.jx-a4 tr.jx-own td{background:#fff8f1}
.jx-a4 .jx-sum{display:grid;grid-template-columns:1fr 1fr 1fr;gap:9px;margin-top:10px}.jx-a4 .jx-sum.two{grid-template-columns:1fr 1fr}
.jx-a4 .jx-box{border:1px solid #dfe5ec;border-radius:5px;padding:7px 9px;font-size:9.6px}.jx-a4 .jx-box h4{margin:0 0 4px;font-size:8.2px;color:#64748b;text-transform:uppercase;letter-spacing:.05em}
.jx-a4 .jx-kv{display:flex;justify-content:space-between;gap:8px;padding:1.5px 0}.jx-a4 .jx-kv b{font-variant-numeric:tabular-nums}.jx-a4 .jx-kv.t{border-top:1px solid #dfe5ec;margin-top:3px;padding-top:3px;font-size:10.5px}
.jx-a4 .jx-adv{margin-top:8px;border:1px solid #dfe5ec;border-radius:5px;padding:6px 9px;font-size:9.6px;display:flex;flex-wrap:wrap;gap:6px 16px}
.jx-a4 .jx-words{margin-top:7px;font-size:9.6px}
.jx-a4 .jx-void{position:absolute;left:0;right:0;top:300px;text-align:center;font-size:100px;font-weight:900;letter-spacing:.12em;color:rgba(180,35,24,.13);transform:rotate(-22deg);pointer-events:none}`;
  const sig = names => `<div class="dn-bottom">${names.map(([h, n]) => `<div class="dn-sign"><h4>${h}</h4><div>Name: ${esc(n || '________________')}<br>Date: ________________<br>Signature: <span class="dn-line"></span></div></div>`).join('')}</div>`;
  function expenseVoucherHtml(e, adv) {
    const L = letterhead('JOB EXPENSE VOUCHER', e.jeNo, 'Submitted', e.date);
    const j = jobs.find(x => x.id === e.jobId) || {};
    const lines = (e.lines || []).slice().sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
    const byType = {}; lines.forEach(l => { byType[l.costType] = r2((byType[l.costType] || 0) + num(l.amount)); });
    const byPay = new Map(); lines.forEach(l => { const k = l.payMode === 'own' ? OWN : l.accountId || 'x'; const x = byPay.get(k) || { name: l.payMode === 'own' ? 'Own money — to reimburse' : l.accountName || e.accountName || '', amt: 0 }; x.amt = r2(x.amt + num(l.amount) + num(l.vat)); byPay.set(k, x); });
    const nInv = new Set(lines.filter(l => num(l.vat) > 0).map(l => low(l.vatInvoiceNo) + '|' + low(l.supplierVat || l.paidTo))).size;
    const rows = lines.map((l, i) => `<tr class="${l.payMode === 'own' ? 'jx-own' : ''}"><td class="c">${i + 1}</td><td>${dmy(l.date || e.date)}</td><td>${esc(l.category || TYPE_LABEL[l.costType])}<small>${esc(TYPE_LABEL[l.costType] || '')}</small></td><td class="jx-wrap">${esc(l.desc)}</td><td class="jx-wrap">${esc(l.paidTo || '—')}</td><td>${esc(l.vatInvoiceNo || '—')}</td><td>${l.payMode === 'own' ? 'Own money' : esc(l.accountName || e.accountName || '')}</td><td class="num">${fmt(l.amount)}</td><td class="num">${num(l.vat) ? fmt(l.vat) : '—'}</td><td class="num">${fmt(num(l.amount) + num(l.vat))}</td></tr>`).join('');
    const style = (typeof invDnBaseCss === 'function' ? invDnBaseCss() : '') + (typeof INV_DOC_CSS !== 'undefined' ? INV_DOC_CSS : '') + JX_CSS;
    return `<div class="dn-a4 inv-a4 jx-a4"><style>${style}</style>${e.status === 'Voided' ? '<div class="jx-void">CANCELLED</div>' : ''}
${L.head}
<div class="jx-info"><div><span>Job</span><b>${esc(e.jobNo)}${e.project ? ' · ' + esc(e.project) : ''}</b></div><div><span>Submitted by</span><b>${esc(e.submittedBy || '—')}</b></div>
<div><span>Customer</span><b>${esc(e.company || j.company || '—')}</b></div><div><span>Received by</span><b>${esc(e.createdBy || '')} · ${dmy(localDay(e.created))}</b></div>
<div><span>Customer PO</span><b>${esc(j.poNo || '—')}</b></div><div><span>Reference</span><b>${esc(e.reference || '—')}</b></div></div>
<table class="dn-items"><thead><tr><th>#</th><th>Date</th><th>Category</th><th>Description</th><th>Paid To</th><th>VAT Inv. No.</th><th>Paid From</th><th class="num">Amount</th><th class="num">VAT</th><th class="num">Total</th></tr></thead><tbody>${rows}</tbody></table>
<div class="jx-sum"><div class="jx-box"><h4>Job cost by type (without VAT)</h4>${TYPE_OPTS.filter(([k]) => byType[k]).map(([k, t]) => `<div class="jx-kv"><span>${t}</span><b>${fmt(byType[k])}</b></div>`).join('')}<div class="jx-kv t"><span>Cost to the job</span><b>${fmt(e.amount)}</b></div></div>
<div class="jx-box"><h4>Paid by</h4>${[...byPay.values()].map(x => `<div class="jx-kv"><span>${esc(x.name)}</span><b>${fmt(x.amt)}</b></div>`).join('')}<div class="jx-kv t"><span>Total</span><b>${fmt(e.total)}</b></div></div>
<div class="jx-box"><h4>Totals</h4><div class="jx-kv"><span>Amount</span><b>${fmt(e.amount)}</b></div><div class="jx-kv"><span>Input VAT (${nInv} invoice${nInv === 1 ? '' : 's'})</span><b>${fmt(e.vat)}</b></div><div class="jx-kv t"><span>Grand total (SAR)</span><b>${fmt(e.total)}</b></div></div></div>
${adv ? `<div class="jx-adv"><span>Site advance — ${esc(adv.name)}:</span>${adv.bal != null ? `<span>balance now <b>${fmt(adv.bal)}</b></span>` : ''}<span>this voucher <b>−${fmt(adv.used)}</b></span>${num(e.ownMoney) > 0 ? `<span>· to reimburse <b>${fmt(JC().core.owedOf(e))}</b></span>` : ''}</div>` : num(e.ownMoney) > 0 ? `<div class="jx-adv"><span>Own money — to reimburse <b>${fmt(JC().core.owedOf(e))}</b></span></div>` : ''}
<div class="jx-words"><b>Amount in words:</b> ${esc(words(e.total))}</div>
${sig([['Submitted by', e.submittedBy], ['Received by', e.createdBy], ['Approved by', '']])}
<div class="dn-foot dn-foot-j">${typeof docFooterPartsHtml === 'function' ? docFooterPartsHtml([...L.parts, 'Internal document — not a tax invoice', 'Original receipts attached']) : ''}</div></div>`;
  }
  async function printExpense(e) {
    if (typeof invPrintDocument !== 'function') { toast('Printing is not available — please reload.', 'error'); return; }
    let adv = null;
    const emp = EMPLOYEES().find(x => String(x.id) === String(e.submittedById));
    const acc = advanceAccountOf(emp);
    if (acc) { const used = r2((e.lines || []).filter(l => l.payMode === 'account' && l.accountId === acc.id).reduce((s2, l) => s2 + num(l.amount) + num(l.vat), 0)); if (used > 0) adv = { name: acc.name, used, bal: await balanceOf(acc) }; }
    invPrintDocument(expenseVoucherHtml(e, adv), [e.jeNo, e.submittedBy, e.jobNo].filter(Boolean).join(' - '));
  }
  function reimbursementVoucherHtml(rb) {
    const L = letterhead('REIMBURSEMENT VOUCHER', rb.rbNo, 'Paid', rb.date);
    const owedBefore = r2((rb.items || []).reduce((s2, i) => s2 + num(i.owedBefore), 0));
    const style = (typeof invDnBaseCss === 'function' ? invDnBaseCss() : '') + (typeof INV_DOC_CSS !== 'undefined' ? INV_DOC_CSS : '') + JX_CSS;
    return `<div class="dn-a4 inv-a4 jx-a4"><style>${style}</style>${rb.status === 'Voided' ? '<div class="jx-void">CANCELLED</div>' : ''}
${L.head}
<div class="jx-info"><div><span>Paid to</span><b>${esc(rb.employeeName)}</b></div><div><span>Paid from</span><b>${esc(rb.accountName)}${rb.viaAccountName ? ' · from ' + esc(rb.viaAccountName) : ''}</b></div>
<div><span>Reference</span><b>${esc(rb.reference || '—')}</b></div><div><span>Recorded by</span><b>${esc(rb.createdBy || '')} · ${dmy(localDay(rb.created))}</b></div></div>
<table class="dn-items"><thead><tr><th>#</th><th>Job Expense</th><th>Submitted</th><th>Job</th><th class="num">Owed</th><th class="num">Paid now</th></tr></thead><tbody>${(rb.items || []).map((i, k) => `<tr><td class="c">${k + 1}</td><td>${esc(i.jeNo)}</td><td>${dmy(i.submitted)}</td><td class="jx-wrap">${esc(i.jobNo)}${i.project ? ' · ' + esc(i.project) : ''}</td><td class="num">${fmt(i.owedBefore)}</td><td class="num">${fmt(i.amount)}</td></tr>`).join('')}</tbody></table>
<div class="jx-sum two"><div class="jx-box"><h4>Owed to ${esc(rb.employeeName)} (these submissions)</h4><div class="jx-kv"><span>Before this payment</span><b>${fmt(owedBefore)}</b></div><div class="jx-kv"><span>Paid now</span><b>${fmt(rb.amount)}</b></div><div class="jx-kv t"><span>Still owed</span><b>${fmt(r2(owedBefore - num(rb.amount)))}</b></div></div>
<div class="jx-box"><h4>Amount paid</h4><div class="jx-kv t" style="border:0;margin:0;padding:0;font-size:15px"><span>SAR</span><b>${fmt(rb.amount)}</b></div><div class="jx-words">${esc(words(rb.amount))}</div></div></div>
${sig([['Received by', rb.employeeName], ['Paid by', rb.createdBy], ['Approved by', '']])}
<div class="dn-foot dn-foot-j">${typeof docFooterPartsHtml === 'function' ? docFooterPartsHtml([...L.parts, 'Internal document']) : ''}</div></div>`;
  }
  function printReimbursement(rb) {
    if (typeof invPrintDocument !== 'function') { toast('Printing is not available — please reload.', 'error'); return; }
    invPrintDocument(reimbursementVoucherHtml(rb), [rb.rbNo, rb.employeeName].filter(Boolean).join(' - '));
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

  window.BCJobs = { list: () => jobs.slice(), load, openCreate, openEdit, view, renderRegister, openExpense, openReimburse, expenseNos, costsOf, _voucherHtml: expenseVoucherHtml, _rbVoucherHtml: reimbursementVoucherHtml, _tab: t => { if (V) { V.tab = t; paintView(); } } };
})();
