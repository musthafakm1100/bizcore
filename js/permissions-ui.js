/* BizCore V270.4.2 — what the screens show for the signed-in user's role (window.BCPerm, index.html).
 * • A module the role can't View disappears from the sidebar (and its page can't be opened).
 * • An action the role may not do (Create / Edit / Cancel) stops with a clear message — the entry functions are guarded
 *   here, so every button and shortcut that leads to them is covered. Register "New" buttons are disabled with the reason.
 * The database rules enforce the same permissions; this only explains them. */
(function () {
  const P = () => window.BCPerm;
  const MOD_LABEL = id => { const m = P() && P().core.MODULES.find(x => x.id === id); return m ? m.label : id; };
  const ACT_WORD = { v: 'open', c: 'create', e: 'change', x: 'cancel or delete' };
  const roleName = () => (P() && P().roleLabel) || 'your role';
  function deny(mod, act) {
    const msg = `${roleName()} can't ${ACT_WORD[act] || act} ${MOD_LABEL(mod)}. Ask an administrator if you need this.`;
    if (typeof showToast === 'function') showToast(msg, 'error', 'Not allowed for your role'); else alert(msg);
    return false;
  }
  window.bcCan = (mod, act = 'v') => !P() || P().admin || P().can(mod, act);
  window.bcRequire = (mod, act = 'v') => window.bcCan(mod, act) || deny(mod, act);

  /* ── entry functions: [module, action] (action may depend on the arguments) ── */
  const MASTER_OF = t => ({ customers: 'customers', customer: 'customers', suppliers: 'suppliers', supplier: 'suppliers', products: 'products', product: 'products', employees: 'employees', employee: 'employees' })[String(t || '').toLowerCase()];
  const GUARDS = {
    // RFQs
    openNewRFQ: ['rfq', 'c'], openDashboardNewRFQ: ['rfq', 'c'], editRFQ: ['rfq', 'e'], editRFQFromView: ['rfq', 'e'],
    reopenRFQ: ['rfq', 'e'], reopenRFQFromBtn: ['rfq', 'e'], openNoBidDialog: ['rfq', 'e'], openNoBidDialogFromBtn: ['rfq', 'e'],
    deleteRFQFromBtn: ['rfq', 'x'], deleteRFQRecord: ['rfq', 'x'],
    // Pricing
    openPricingSourceRFQs: ['pricing', 'c'], openPricingFromBtn: ['pricing', 'c'], editPricingFromRO: ['pricing', 'e'], revisePricingFromRO: ['pricing', 'e'],
    // Quotations
    openNewQuotation: ['quotation', 'c'], convertToQuotation: ['quotation', 'c'], duplicateQuotation: ['quotation', 'c'], openQuotationWorkflowDialog: ['quotation', 'c'],
    editQuotation: ['quotation', 'e'], createQuotationRevision: ['quotation', 'e'], cancelQuotation: ['quotation', 'x'], deleteQuotation: ['quotation', 'x'],
    // Sales Orders
    openCreateSO: ['salesOrder', 'c'], openEditSO: ['salesOrder', 'e'], deleteSalesOrder: ['salesOrder', 'x'],
    // Delivery Notes
    openRecordDelivery: ['deliveryNote', 'c'], openDNDispatchAction: ['deliveryNote', 'e'], openDeliveryAcceptance: ['deliveryNote', 'e'],
    openDNAcceptanceChange: ['deliveryNote', 'e'], openDeliveryConfirmationFromDNView: ['deliveryNote', 'e'],
    // Customer invoices / credit notes
    openIssueInvoice: ['invoice', 'c'], openInvoiceFromDNView: ['invoice', 'c'], openIssueCreditNote: ['invoice', 'c'], openEditInvoice: ['invoice', 'e'], openCancelReissue: ['invoice', 'x'],
    // Payment receipts
    openNewReceipt: ['receipt', 'c'], openApplyReceipt: ['receipt', 'e'], openEditReceipt: ['receipt', 'e'], rctEditClick: ['receipt', 'e'], openVoidReceipt: ['receipt', 'x'], rctVoidClick: ['receipt', 'x'],
    // Purchase invoices / supplier payments
    openNewPurchaseInvoice: ['purchaseInvoice', 'c'], piEditInvoiceClick: ['purchaseInvoice', 'e'], piOpenLimitedEdit: ['purchaseInvoice', 'e'], piOpenFullEdit: ['purchaseInvoice', 'e'], piAskCancel: ['purchaseInvoice', 'x'],
    openPayAdvance: ['supplierPayment', 'c'], piOpenPayModal: ['supplierPayment', 'c'], piOpenCashBack: ['supplierPayment', 'c'],
    spEditPaymentClick: ['supplierPayment', 'e'], spOpenEdit: ['supplierPayment', 'e'], piAskCancelPay: ['supplierPayment', 'x'],
    // Stock
    openAllocateStock: ['stock', 'e'], openChangeItem: ['stock', 'e'], stAskCancelAlloc: ['stock', 'e'], stAskCancelChange: ['stock', 'e'],
    // Cash & Bank
    cbOpenHandover: args => ['cash', args[0] ? 'e' : 'c'], cbVoidHandover: ['cash', 'x'],
    // Master data
    openAddCustomer: ['customers', 'c'], openEditCustomer: ['customers', 'e'], deleteCustomer: ['customers', 'x'],
    openAddSupplier: ['suppliers', 'c'], openEditSupplier: ['suppliers', 'e'], deleteSupplier: ['suppliers', 'x'],
    openAddProduct: ['products', 'c'], openEditProduct: ['products', 'e'], deleteProduct: ['products', 'x'],
    openEmployeeForm: args => ['employees', args[0] ? 'e' : 'c'], editEmployeeFromView: ['employees', 'e'], deleteEmployee: ['employees', 'x'],
    openImportModal: args => { const m = MASTER_OF(args[0]); return m ? [m, 'c'] : null; },
    deleteSelectedMasterRecords: args => { const m = MASTER_OF(args[0]); return m ? [m, 'x'] : null; },
  };
  function wrapAll() {
    let n = 0;
    for (const [name, rule] of Object.entries(GUARDS)) {
      const fn = window[name];
      if (typeof fn !== 'function' || fn.__bcGuarded) continue;
      const g = function (...args) {
        const r = typeof rule === 'function' ? rule(args) : rule;
        if (r && !window.bcCan(r[0], r[1])) { deny(r[0], r[1]); return undefined; }
        return fn.apply(this, args);
      };
      g.__bcGuarded = true; g.__bcOriginal = fn;
      window[name] = g; n++;
    }
    return n;
  }

  /* ── sidebar, pages, master tabs, register "New" buttons ── */
  const pageMods = page => (P() && P().core.PAGE_MODULES[page]) || null;
  const pageAllowed = page => { const m = pageMods(page); return !m || !P() || P().admin || m.some(x => P().can(x, 'v')); };
  const NEW_BTN = { rfq: 'rfq', quotations: 'quotation', costing: 'pricing', receipts: 'receipt', purchaseinvoices: 'purchaseInvoice', supplierpayments: 'supplierPayment',
    salesorders: 'salesOrder', customerinvoices: 'invoice', deliverynotes: 'deliveryNote', cashbank: 'cash' };
  function applyNav() {
    if (!P()) return;
    document.querySelectorAll('[data-nav-page]').forEach(el => {
      const ok = pageAllowed(el.getAttribute('data-nav-page'));
      el.classList.toggle('bc-perm-hidden', !ok);
    });
    // a group whose items are all hidden disappears too
    document.querySelectorAll('.nav-group').forEach(g => {
      const items = g.querySelectorAll('[data-nav-page]');
      if (!items.length) return;
      g.classList.toggle('bc-perm-hidden', [...items].every(i => i.classList.contains('bc-perm-hidden')));
    });
    ['customers', 'suppliers', 'products', 'employees'].forEach(t => {
      const b = document.getElementById('mtab-' + t); if (b) b.classList.toggle('bc-perm-hidden', !window.bcCan(t, 'v'));
    });
    applyNewButtons();
  }
  function applyNewButtons(root) {
    for (const [page, mod] of Object.entries(NEW_BTN)) {
      const host = document.getElementById('page-' + page); if (!host || (root && root !== host)) continue;
      const ok = window.bcCan(mod, 'c');
      host.querySelectorAll('.bc-filter-new, .bc-split-main, .page-primary-command').forEach(b => {
        if (!ok) { b.disabled = true; b.title = `${roleName()} can't create ${MOD_LABEL(mod)}`; b.dataset.bcPermOff = '1'; }
        else if (b.dataset.bcPermOff) { b.disabled = false; b.title = ''; delete b.dataset.bcPermOff; }
      });
    }
  }
  function wrapShowPage() {
    const orig = window.showPage;
    if (typeof orig !== 'function' || orig.__bcGuarded) return;
    const g = function (page, el) {
      if (!pageAllowed(page)) {
        const m = pageMods(page) || [];
        deny(m[0], 'v');
        return undefined;
      }
      const r = orig.apply(this, arguments);
      try { applyNewButtons(document.getElementById('page-' + (['customers', 'suppliers', 'products', 'employees', 'units'].includes(page) ? 'masters' : page))); } catch (e) {}
      return r;
    };
    g.__bcGuarded = true; window.showPage = g;
  }
  function wrapMastersTab() {
    const orig = window.switchMastersTab;
    if (typeof orig !== 'function' || orig.__bcGuarded) return;
    const g = function (tab) {
      if (['customers', 'suppliers', 'products', 'employees'].includes(tab) && !window.bcCan(tab, 'v')) {
        const first = ['customers', 'suppliers', 'products', 'employees'].find(t => window.bcCan(t, 'v'));
        if (first && first !== tab) return orig.call(this, first);
        return deny(tab, 'v');
      }
      return orig.apply(this, arguments);
    };
    g.__bcGuarded = true; window.switchMastersTab = g;
  }

  /* screens are loaded one after another: guard whatever exists now and again shortly (scripts loaded later) */
  function apply() { wrapAll(); wrapShowPage(); wrapMastersTab(); applyNav(); }
  apply();
  let tries = 0;
  const t = setInterval(() => { apply(); if (++tries > 20) clearInterval(t); }, 500);
  if (P()) P().onChange(applyNav);
  // registers re-render their toolbars: keep the New buttons in step
  const mo = new MutationObserver(() => { clearTimeout(mo._t); mo._t = setTimeout(() => applyNewButtons(), 120); });
  try { mo.observe(document.querySelector('.content') || document.body, { childList: true, subtree: true }); } catch (e) {}
  window.bcApplyPermissions = apply;
  window.bcPermGuards = GUARDS;
  console.log('Permissions V270.4.2 ✅');
})();
