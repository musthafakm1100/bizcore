/* ═══════════════════════════════════════════════════════════════════
   BizCore V267.2 — cash ledger rendering shared by My Cash (mycash.html) and
   Finance → Cash & Bank (index.html). Plain HTML builders, no Firebase here.
   Approved mockups 15 Oct 2026 (CASH_custodian / CASH_staff / CASH_phone).
═══════════════════════════════════════════════════════════════════ */
'use strict';
(function () {
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dShort = d => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || '')); return m ? `${m[3]}-${m[2]}` : esc(d); };
  const dFull = d => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || '')); return m ? `${m[3]}-${m[2]}-${m[1]}` : esc(d); };
  const toDate = v => v && typeof v.toDate === 'function' ? v.toDate() : v && typeof v === 'object' && 'seconds' in v ? new Date(v.seconds * 1000) : v ? new Date(v) : null;
  const when = v => { const d = toDate(v); if (!d || isNaN(d)) return ''; const p = n => String(n).padStart(2, '0'); return `${p(d.getDate())}-${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`; };
  const first = s => String(s || '').split(/\s+/)[0] || '';

  /** Wording of one ledger row. */
  function describe(r) {
    if (r.kind === 'handover') {
      const title = r.amountIn > 0 ? `Received from ${r.counterpartName}` : `Handed to ${r.counterpartName}`;
      const sub = [r.description, 'by ' + (r.recordedByName || '—')].filter(Boolean).join(' · ');
      return { title, sub };
    }
    return { title: r.description || r.kind, sub: 'by ' + (r.recordedByName || '—') };
  }

  /** The giver's line of a handover: what the receiver answered. */
  function counterpartTail(r) {
    const cp = r.counterpartStatus, who = esc(r.counterpartStatusByName || 'Receiver');
    return cp === 'confirmed' ? `${who} confirmed receipt ${when(r.counterpartStatusAt)}`
      : cp === 'queried' ? `⚠ ${who} queried: “${esc(r.counterpartStatusNote || '')}”` : 'not confirmed yet';
  }

  /**
   * Status cell. opts: { canConfirm(row) → bool, custodianName, compact }
   */
  function statusHtml(r, opts = {}) {
    if (r.void) return `<span class="cl-st cl-void"><i class="ti ti-ban"></i>Cancelled</span>${r.voidReason ? `<span class="cl-sub">${esc(r.voidReason)}</span>` : ''}`;
    if (r.status === 'none') return `<span class="cl-st cl-none"><i class="ti ti-arrow-right"></i>Receiver confirms</span><span class="cl-sub">${counterpartTail(r)}</span>`;
    const mine = opts.canConfirm && opts.canConfirm(r);
    if (r.status === 'pending') {
      if (mine) return `<div class="cl-acts"><button type="button" class="cl-btn cl-ok" data-act="confirm" data-id="${esc(r.id)}"><i class="ti ti-check"></i>Confirm</button><button type="button" class="cl-btn cl-q" data-act="query" data-id="${esc(r.id)}"><i class="ti ti-message-question"></i>Query</button></div>`
        + (r.statusNote ? `<span class="cl-sub">Changed after: “${esc(r.statusNote)}”</span>` : '');
      return `<span class="cl-st cl-w">⏳ Awaiting ${esc(first(opts.custodianName) || 'custodian')}</span>`;
    }
    if (r.status === 'confirmed') {
      return `<span class="cl-st cl-c"><i class="ti ti-check"></i>Confirmed</span><span class="cl-sub">${r.onBehalf ? 'by ' + esc(r.statusByName) + ' (for custodian) · ' : ''}${when(r.statusAt)}</span>`;
    }
    if (r.status === 'queried') {
      return `<span class="cl-st cl-qq"><i class="ti ti-alert-triangle"></i>Queried</span><span class="cl-sub cl-quote">“${esc(r.statusNote)}”</span>`
        + (mine ? `<div class="cl-acts cl-acts-sm"><button type="button" class="cl-btn cl-ok" data-act="confirm" data-id="${esc(r.id)}"><i class="ti ti-check"></i>Confirm now</button></div>` : '');
    }
    return '';
  }

  /** Desktop / tablet ledger table, newest first. opts: { mode:'custodian'|'staff', filter, canConfirm, custodianName, onRowAttrs } */
  function tableHtml(ledger, opts = {}) {
    const f = opts.filter || 'all';
    const rows = ledger.rows.slice().reverse().filter(r => f === 'all' || (f === 'waiting' ? r.status === 'pending' && !r.void : f === 'queried' ? r.status === 'queried' && !r.void : true));
    const stRight = opts.mode === 'custodian';
    const body = rows.map(r => {
      const d = describe(r);
      const wait = r.status === 'pending' && !r.void;
      const staffEdit = opts.mode === 'staff' && r.kind === 'handover' && !r.void && opts.canEdit;
      return `<tr class="${wait ? 'cl-wait' : ''}${r.void ? ' cl-voided' : ''}" data-line="${esc(r.id)}">
        <td class="cl-date">${dShort(r.date)}</td>
        <td class="cl-v">${staffEdit ? `<button type="button" class="cl-link" data-act="edit" data-entry="${esc(r.entryId)}">${esc(r.voucherNo)}</button>` : esc(r.voucherNo)}</td>
        <td class="cl-det">${esc(d.title)}<span class="cl-sub">${esc(d.sub)}</span></td>
        <td class="n cl-in">${r.amountIn ? money(r.amountIn) : ''}</td>
        <td class="n cl-out">${r.amountOut ? money(r.amountOut) : ''}</td>
        <td class="n cl-bal">${r.balance == null ? '—' : money(r.balance)}</td>
        <td class="cl-stc${stRight ? ' r' : ''}">${statusHtml(r, opts)}</td></tr>`;
    }).join('');
    const showOpening = f === 'all';
    const open = showOpening ? `<tr><td class="cl-date">${dShort(ledger.opening.date)}</td><td class="cl-v">OPEN</td><td class="cl-det">Opening balance<span class="cl-sub">${ledger.opening.setBy ? 'set by ' + esc(ledger.opening.setBy) : 'set by the office'}</span></td>
      <td class="n cl-in">${ledger.opening.amount >= 0 ? money(ledger.opening.amount) : ''}</td><td class="n cl-out">${ledger.opening.amount < 0 ? money(-ledger.opening.amount) : ''}</td><td class="n cl-bal">${money(ledger.opening.amount)}</td>
      <td class="cl-stc${stRight ? ' r' : ''}"><span class="cl-st cl-c"><i class="ti ti-check"></i>Opening</span><span class="cl-sub">as of ${dFull(ledger.opening.date)}</span></td></tr>` : '';
    const empty = !rows.length && !showOpening ? `<tr><td colspan="7" class="cl-empty">Nothing here.</td></tr>` : '';
    return `<div class="cl-table-wrap"><table class="cl-table"><thead><tr><th>Date</th><th>Voucher</th><th>Details</th><th class="n">In</th><th class="n">Out</th><th class="n">Balance</th><th class="${stRight ? 'r' : ''}">${opts.mode === 'custodian' ? 'Status' : 'Custodian status'}</th></tr></thead><tbody>${body}${open}${empty}</tbody></table></div>`;
  }

  /** Phone cards (≤760px), newest first. */
  function cardsHtml(ledger, opts = {}) {
    const f = opts.filter || 'all';
    const rows = ledger.rows.slice().reverse().filter(r => f === 'all' || (f === 'waiting' ? r.status === 'pending' && !r.void : f === 'queried' ? r.status === 'queried' && !r.void : true));
    const pill = r => r.void ? '<span class="cl-st cl-void">Cancelled</span>' : r.status === 'pending' ? '<span class="cl-st cl-w">⏳ Waiting</span>' : r.status === 'none' ? '<span class="cl-st cl-none">Receiver confirms</span>' : r.status === 'confirmed' ? '<span class="cl-st cl-c">Confirmed</span>' : '<span class="cl-st cl-qq">⚠ Queried</span>';
    const out = rows.map(r => {
      const d = describe(r), mine = !r.void && opts.canConfirm && opts.canConfirm(r);
      const amt = r.amountIn ? `<span class="cl-amt cl-in">+${money(r.amountIn)}</span>` : `<span class="cl-amt cl-out">−${money(r.amountOut)}</span>`;
      const extra = r.status === 'queried' && !r.void ? `<div class="cl-sub cl-quote">“${esc(r.statusNote)}”</div>` : r.status === 'none' && !r.void ? `<div class="cl-sub">${counterpartTail(r)}</div>` : '';
      const acts = mine && (r.status === 'pending' || r.status === 'queried') ? `<div class="cl-pc-acts"><button type="button" class="cl-btn cl-ok" data-act="confirm" data-id="${esc(r.id)}"><i class="ti ti-check"></i>Confirm</button>${r.status === 'pending' ? `<button type="button" class="cl-btn cl-q" data-act="query" data-id="${esc(r.id)}"><i class="ti ti-message-question"></i>Query</button>` : ''}</div>` : '';
      return `<div class="cl-pc${r.void ? ' cl-voided' : ''}" data-line="${esc(r.id)}"><div class="cl-r1"><span class="cl-v">${esc(r.voucherNo)}</span>${pill(r)}</div>
        <div class="cl-pc-t">${esc(d.title)}</div><div class="cl-r1"><span class="cl-sub">${dShort(r.date)} · ${esc(d.sub)}</span>${amt}</div>${extra}${acts}</div>`;
    }).join('');
    const open = f === 'all' ? `<div class="cl-pc"><div class="cl-r1"><span class="cl-v">OPEN</span><span class="cl-st cl-c">Opening</span></div><div class="cl-pc-t">Opening balance</div><div class="cl-r1"><span class="cl-sub">${dShort(ledger.opening.date)} · ${ledger.opening.setBy ? 'set by ' + esc(ledger.opening.setBy) : ''}</span><span class="cl-amt">${money(ledger.opening.amount)}</span></div></div>` : '';
    return `<div class="cl-cards">${out}${open}${!out && !open ? '<div class="cl-empty">Nothing here.</div>' : ''}</div>`;
  }

  /** Filter chips + confirm-all. */
  function toolbarHtml(ledger, opts = {}) {
    const f = opts.filter || 'all';
    const chip = (k, l) => `<button type="button" class="cl-chip${f === k ? ' on' : ''}" data-act="filter" data-filter="${k}" aria-pressed="${f === k}">${l}</button>`;
    const n = opts.confirmable || 0;
    return `<div class="cl-chips" role="toolbar" aria-label="Show">${chip('all', 'All')}${chip('waiting', `Waiting ${ledger.waiting}`)}${chip('queried', `Queried ${ledger.queried}`)}</div>`
      + (n ? `<button type="button" class="cl-btn cl-ok cl-all" data-act="confirm-all"><i class="ti ti-checks"></i>Confirm all waiting (${n})</button>` : '');
  }

  /** Printable statement (staff). */
  function statementHtml(account, ledger, { from = '', to = '', company = 'Downtown Trading Est.', printedBy = '' } = {}) {
    let bal = ledger.opening.amount;
    const rows = ledger.rows.filter(r => !r.void);
    const before = rows.filter(r => from && r.date < from);
    before.forEach(r => { bal += (Number(r.amountIn) || 0) - (Number(r.amountOut) || 0); });
    const inRange = rows.filter(r => (!from || r.date >= from) && (!to || r.date <= to));
    let tin = 0, tout = 0;
    const body = inRange.map(r => {
      bal += (Number(r.amountIn) || 0) - (Number(r.amountOut) || 0); tin += Number(r.amountIn) || 0; tout += Number(r.amountOut) || 0;
      const d = describe(r);
      const st = r.status === 'pending' ? 'Waiting' : r.status === 'confirmed' ? 'Confirmed' : r.status === 'queried' ? 'Queried' : r.counterpartStatus === 'confirmed' ? 'Receiver confirmed' : 'Receiver to confirm';
      return `<tr><td>${dFull(r.date)}</td><td>${esc(r.voucherNo)}</td><td>${esc(d.title)}<br><small>${esc(d.sub)}</small></td><td class="n">${r.amountIn ? money(r.amountIn) : ''}</td><td class="n">${r.amountOut ? money(r.amountOut) : ''}</td><td class="n">${money(bal)}</td><td>${st}</td></tr>`;
    }).join('');
    const openBal = ledger.opening.amount + before.reduce((s, r) => s + (Number(r.amountIn) || 0) - (Number(r.amountOut) || 0), 0);
    return `<!doctype html><html><head><meta charset="utf-8"><title>Statement – ${esc(account.name)}</title><style>
      @page{size:A4;margin:14mm}body{font:12px Arial,sans-serif;color:#111}h1{font-size:18px;margin:0}h2{font-size:13px;margin:2px 0 12px;color:#444;font-weight:normal}
      table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #ddd;padding:6px 5px;text-align:left;vertical-align:top}th{background:#f1f4f8;font-size:11px;text-transform:uppercase}
      .n{text-align:right;white-space:nowrap}small{color:#666}tfoot td{font-weight:bold;border-top:2px solid #333}.meta{display:flex;justify-content:space-between;margin-bottom:10px;color:#444}</style></head><body>
      <h1>${esc(company)}</h1><h2>Cash statement — ${esc(account.code)} · ${esc(account.name)}${account.custodianName ? ' · Custodian: ' + esc(account.custodianName) : ''}</h2>
      <div class="meta"><span>Period: ${from ? dFull(from) : dFull(ledger.opening.date)} to ${to ? dFull(to) : 'today'}</span><span>Printed ${when(new Date())}${printedBy ? ' by ' + esc(printedBy) : ''}</span></div>
      <table><thead><tr><th>Date</th><th>Voucher</th><th>Details</th><th class="n">In</th><th class="n">Out</th><th class="n">Balance</th><th>Custodian</th></tr></thead>
      <tbody><tr><td>${from ? dFull(from) : dFull(ledger.opening.date)}</td><td>${from ? 'B/F' : 'OPEN'}</td><td>${from ? 'Balance brought forward' : 'Opening balance'}</td><td></td><td></td><td class="n">${money(openBal)}</td><td></td></tr>${body}</tbody>
      <tfoot><tr><td colspan="3">Totals</td><td class="n">${money(tin)}</td><td class="n">${money(tout)}</td><td class="n">${money(bal)}</td><td></td></tr></tfoot></table>
      <p style="margin-top:40px;display:flex;gap:80px"><span>Custodian signature: ______________________</span><span>Checked by: ______________________</span></p>
      <script>window.onload=()=>{window.print()}<\/script></body></html>`;
  }

  window.BizCashUI = { esc, money, dShort, dFull, when, describe, statusHtml, tableHtml, cardsHtml, toolbarHtml, statementHtml };
})();
