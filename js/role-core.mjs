/**
 * BizCore V270.4.2 — Roles & Permissions (approved mockup UR_3). Pure rules, no Firebase.
 *
 * roles/{roleId} {
 *   id, label, builtIn, locked,                          // Administrator: every right (locked); custom roles: builtIn false
 *   perms: { <module>: { v, c, e, x, own } },            // View / Create / Edit / Cancel, Own records only
 *   viewMods, createMods, editMods, cancelMods, writeMods, ownMods,   // the same as lists — what the security rules read
 *   revision, updatedAt, updatedByUid, updatedByName, schemaVersion }
 * roles/{roleId}/changes/{id} { id, before, after, note, byUid, byName, at }   — never changed
 *
 * A user has one role per company (users/{uid}.companyRoles). Cash Custodian is not a role record (cashCustodians/{uid}).
 */
export const ROLE_COLLECTION = 'roles';
export const ROLE_CHANGES = 'changes';
export const ROLE_SCHEMA_VERSION = 1;

/** Modules in the grid (UR_3). acts: the columns that apply; own: the Records All / Own choice applies. */
export const MODULES = Object.freeze([
  { id: 'rfq', label: 'RFQs', group: 'Sales', acts: 'vcex', own: true },
  { id: 'pricing', label: 'Pricing', group: 'Sales', acts: 'vce', own: true },
  { id: 'quotation', label: 'Quotations', group: 'Sales', acts: 'vcex', own: true },
  { id: 'salesOrder', label: 'Sales Orders', group: 'Sales', acts: 'vcex', own: true },
  { id: 'deliveryNote', label: 'Delivery Notes', group: 'Sales', acts: 'vcex' },
  { id: 'invoice', label: 'Customer Invoices', group: 'Sales', acts: 'vcex', hint: 'Includes credit notes' },
  { id: 'receipt', label: 'Payment Receipts', group: 'Sales', acts: 'vcex' },
  { id: 'purchaseInvoice', label: 'Purchase Invoices', group: 'Purchasing & Stock', acts: 'vcex' },
  { id: 'supplierPayment', label: 'Supplier Payments', group: 'Purchasing & Stock', acts: 'vcex' },
  { id: 'stock', label: 'Stock', group: 'Purchasing & Stock', acts: 've', hint: 'Edit = allocate, change item' },
  { id: 'cash', label: 'Cash & Bank', group: 'Money', acts: 'vcex' },
  { id: 'customers', label: 'Customers', group: 'Master Data', acts: 'vcex', hint: 'Cancel = delete' },
  { id: 'suppliers', label: 'Suppliers', group: 'Master Data', acts: 'vcex', hint: 'Cancel = delete' },
  { id: 'products', label: 'Products', group: 'Master Data', acts: 'vcex', hint: 'Cancel = delete' },
  { id: 'employees', label: 'Employees', group: 'Master Data', acts: 'vcex', hint: 'Cancel = delete' },
  { id: 'reports', label: 'Reports', group: 'Reports & Administration', acts: 'v' },
  { id: 'administration', label: 'Administration', group: 'Reports & Administration', acts: 've', hint: 'General settings; security settings stay with administrators' },
]);
export const MODULE_IDS = MODULES.map(m => m.id);
export const ACTS = Object.freeze([['v', 'View'], ['c', 'Create'], ['e', 'Edit'], ['x', 'Cancel']]);

/** V270.4.3 Special Rights (approved mockup UR_4). was: where the choice lived before; dflt: the starting value of a role.
 *  The Administrator role always has every right. Record / void payment receipts are the Payment Receipts module's
 *  Create / Cancel boxes (they moved there from Billing Settings). */
export const RIGHTS = Object.freeze([
  { id: 'seeCost', label: 'See cost, margin and profit', hint: 'Profit tab on Sales Orders, Selling → P/L on purchase invoices', group: 'Pricing & profit', was: 'Purchase Settings' },
  { id: 'approveMargin', label: 'Approve pricing below the minimum margin', hint: 'Decides the approval requests (can be chosen as approver)', group: 'Pricing & profit', was: 'admin only' },
  { id: 'sellBelowMargin', label: 'Sell below the minimum margin without approval', group: 'Pricing & profit', was: 'admin only' },
  { id: 'orderInvoices', label: 'Issue order invoices (bill before delivery)', group: 'Billing', was: 'Billing Settings' },
  { id: 'advanceInvoices', label: 'Issue advance invoices', group: 'Billing', was: 'Billing Settings' },
  { id: 'creditNotes', label: 'Issue credit notes, cancel & re-issue invoices', group: 'Billing', was: 'Billing Settings' },
  { id: 'editAfterLimit', label: 'Edit after the edit time limit', hint: 'Receipts, invoices, purchase invoices, supplier payments', group: 'Editing & locks', was: 'admin only' },
  { id: 'fullEdit', label: 'Full edit (figures), not only limited edit', hint: 'Where the setting is “Limited for all, full with the right”', group: 'Editing & locks', was: 'admin only' },
  { id: 'forceRelease', label: "Force-release another user's lock", group: 'Editing & locks', was: 'admin only' },
  { id: 'backdate', label: 'Backdate beyond the backdate limit', hint: 'RFQ date received (Administration → Numbering & Defaults)', group: 'Editing & locks' },
  { id: 'exportExcel', label: 'Export to Excel', group: 'Data', dflt: true },
  { id: 'printDocs', label: 'Print / PDF customer documents', hint: 'Quotations, delivery notes, invoices, credit notes, receipts, statements', group: 'Data', dflt: true },
]);
export const RIGHT_IDS = RIGHTS.map(r => r.id);
export const defaultRights = () => Object.fromEntries(RIGHTS.map(r => [r.id, !!r.dflt]));
/** Only known rights, true / false; a missing one → its starting value. */
export function normalizeRights(input) {
  const d = defaultRights();
  if (!input || typeof input !== 'object') return d;
  return Object.fromEntries(RIGHTS.map(r => [r.id, typeof input[r.id] === 'boolean' ? input[r.id] : d[r.id]]));
}
const ALL_RIGHTS = () => Object.fromEntries(RIGHT_IDS.map(id => [id, true]));
const modOf = id => MODULES.find(m => m.id === id);

/** The built-in roles and their starting permissions (agreed 25 Oct 2026). */
const ALL = 'vcex', V = 'v', VCE = 'vce';
function build(spec) {
  const out = {};
  for (const m of MODULES) { const s = spec[m.id] || ''; out[m.id] = { v: s.includes('v'), c: s.includes('c'), e: s.includes('e'), x: s.includes('x'), own: false }; }
  return out;
}
export const BUILT_IN_ROLES = Object.freeze([
  { id: 'administrator', label: 'Administrator', locked: true, perms: build(Object.fromEntries(MODULES.map(m => [m.id, ALL]))), rights: ALL_RIGHTS() },
  { id: 'manager', label: 'Manager', perms: build(Object.fromEntries(MODULES.filter(m => m.id !== 'administration').map(m => [m.id, ALL]))) },
  { id: 'sales', label: 'Sales', perms: build({ rfq: ALL, pricing: VCE, quotation: ALL, salesOrder: VCE, deliveryNote: V, invoice: V,
    stock: V, customers: VCE, suppliers: V, products: VCE, employees: V, reports: V }) },
  { id: 'purchasing', label: 'Purchasing', perms: build({ salesOrder: V, purchaseInvoice: VCE, supplierPayment: VCE, stock: 've',
    customers: V, suppliers: VCE, products: VCE, employees: V, reports: V }) },
  { id: 'accounts', label: 'Accounts', perms: build({ rfq: V, pricing: V, quotation: V, salesOrder: V, deliveryNote: V, invoice: ALL, receipt: ALL,
    purchaseInvoice: V, supplierPayment: ALL, stock: V, cash: ALL, customers: V, suppliers: V, products: V, employees: V, reports: V }) },
  { id: 'store', label: 'Store / Delivery', perms: build({ salesOrder: V, deliveryNote: VCE, stock: 've', customers: V, products: V, employees: V }) },
]);
export const builtInRole = id => BUILT_IN_ROLES.find(r => r.id === id) || null;

/** Clean a perms object: only known modules / acts; anything without View is off; own only where it applies. */
export function normalizePerms(input = {}) {
  const out = {};
  for (const m of MODULES) {
    const p = input[m.id] || {};
    const has = a => m.acts.includes(a) && p[a] === true;
    const v = has('v');
    out[m.id] = { v, c: v && has('c'), e: v && has('e'), x: v && has('x'), own: !!(m.own && v && p.own === true) };
  }
  return out;
}
/** The lists the security rules read (one hasAny check instead of many). */
export function derivedLists(perms, rights) {
  const p = normalizePerms(perms), r = normalizeRights(rights);
  const pick = f => MODULE_IDS.filter(id => f(p[id]));
  return {
    viewMods: pick(x => x.v), createMods: pick(x => x.c), editMods: pick(x => x.e), cancelMods: pick(x => x.x),
    writeMods: pick(x => x.c || x.e || x.x), ownMods: pick(x => x.own),
    rightMods: RIGHT_IDS.filter(id => r[id]),   // V270.4.3
  };
}

/** V270.4.2: the copy of a role's lists kept on each user record (users/{uid}.perm) — what the security rules read. */
export function userPermFrom(role) {
  if (!role) return { roleId: '', viewMods: [], createMods: [], editMods: [], cancelMods: [], writeMods: [], ownMods: [], rightMods: [] };
  return { roleId: role.id || '', ...derivedLists(role.perms || {}, role.rights) };
}
export const samePerm = (a, b) => JSON.stringify(a || null) === JSON.stringify(b || null);

export function validateRoleInput(input = {}, { existingIds = [], creating = false } = {}) {
  const errors = [];
  const label = String(input.label == null ? '' : input.label).replace(/\s+/g, ' ').trim().slice(0, 60);
  if (!label) errors.push({ field: 'label', message: 'Enter the role name.' });
  let id = String(input.id || '').trim();
  if (creating) {
    if (!id) id = 'r-' + label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);
    if (!/^[a-zA-Z0-9_-]{2,40}$/.test(id) || id === 'cashCustodian') errors.push({ field: 'label', message: 'Use letters or numbers in the role name.' });
    else if (existingIds.includes(id)) errors.push({ field: 'label', message: 'A role with this name already exists.' });
  }
  return { ok: errors.length === 0, errors, value: { id, label, perms: normalizePerms(input.perms || {}), rights: input.rights === undefined ? undefined : normalizeRights(input.rights) } };
}

/** The record to write. */
export function buildRoleRecord(prev, value, { actor, stamp, builtIn = false, locked = false }) {
  const isLocked = prev ? !!prev.locked : !!locked;
  const perms = isLocked ? builtInRole('administrator').perms : normalizePerms(value.perms);
  const rights = isLocked ? builtInRole('administrator').rights : normalizeRights(value.rights !== undefined ? value.rights : prev && prev.rights);
  return {
    id: value.id, label: prev && (prev.builtIn || prev.locked) ? prev.label : value.label,
    builtIn: prev ? !!prev.builtIn : !!builtIn, locked: isLocked,
    perms, rights, ...derivedLists(perms, rights),
    revision: prev ? (Number(prev.revision) || 0) + 1 : 1,
    updatedAt: stamp, updatedByUid: actor.uid, updatedByName: actor.name, schemaVersion: ROLE_SCHEMA_VERSION,
  };
}

/** "Quotations: + Cancel · Sales Orders: Records All → Own" */
export function describePermChange(before, after, rightsBefore, rightsAfter) {
  const a = normalizePerms(before || {}), b = normalizePerms(after || {});
  const names = { v: 'View', c: 'Create', e: 'Edit', x: 'Cancel' };
  const out = [];
  for (const m of MODULES) {
    const p = a[m.id], q = b[m.id], bits = [];
    for (const k of 'vcex') if (p[k] !== q[k]) bits.push((q[k] ? '+ ' : '− ') + names[k]);
    if (p.own !== q.own) bits.push(`Records ${p.own ? 'Own' : 'All'} → ${q.own ? 'Own' : 'All'}`);
    if (bits.length) out.push(`${m.label}: ${bits.join(', ')}`);
  }
  if (rightsAfter !== undefined) {   // V270.4.3
    const ra = normalizeRights(rightsBefore), rb = normalizeRights(rightsAfter);
    for (const r of RIGHTS) if (ra[r.id] !== rb[r.id]) out.push(`${r.label}: ${rb[r.id] ? 'On' : 'Off'}`);
  }
  return out.join(' · ');
}

/** Client-side permission object for one user. role = the role record (or null). admin = owner / Administrator. */
export function permissionsFor(role, { admin = false } = {}) {
  const p = admin ? builtInRole('administrator').perms : role ? normalizePerms(role.perms) : null;
  const can = (m, a = 'v') => !!(p && p[m] && p[m][a]);
  return {
    admin: !!admin, known: !!(admin || role), roleId: role ? role.id : admin ? 'administrator' : '', roleLabel: role ? role.label : admin ? 'Administrator' : '',
    can, ownOnly: m => !admin && !!(p && p[m] && p[m].own),
    canAny: (mods, a = 'v') => mods.some(m => can(m, a)),
    right: id => !!admin || !!(role && normalizeRights(role.rights)[id]),   // V270.4.3 Special Rights
  };
}

/** Which modules let a user read each collection (the rules use the same table). */
export const READ_MODULES = Object.freeze({
  rfqs: ['rfq', 'pricing', 'quotation'],
  quotations: ['quotation'],
  salesOrders: ['salesOrder'],
  deliveryNotes: ['deliveryNote', 'invoice'],
  customerInvoices: ['invoice', 'receipt'],
  creditNotes: ['invoice', 'receipt'],
  customerReceipts: ['receipt'],
  invoicePayments: ['invoice', 'receipt'],
  purchaseInvoices: ['purchaseInvoice', 'supplierPayment', 'cash'],
  supplierPayments: ['purchaseInvoice', 'supplierPayment', 'cash'],
  cashLines: ['cash', 'supplierPayment', 'receipt', 'purchaseInvoice'],
  cashEntries: ['cash', 'supplierPayment', 'receipt', 'purchaseInvoice'],
  customers: ['customers'],
  suppliers: ['suppliers'],
  products: ['products'],
  employees: ['employees'],
});
/** Collections whose records belong to someone (ownerUid) — "Own records only". */
export const OWN_COLLECTIONS = Object.freeze({ rfqs: 'rfq', quotations: 'quotation', salesOrders: 'salesOrder' });

/** Screens (data-nav-page) → the modules that open them. */
export const PAGE_MODULES = Object.freeze({
  rfq: ['rfq'], costing: ['pricing'], quotations: ['quotation'], salesorders: ['salesOrder'],
  deliverynotes: ['deliveryNote'], deliveries: ['deliveryNote'], customerinvoices: ['invoice'], receipts: ['receipt'],
  supplierrfqs: ['purchaseInvoice'], purchaseorders: ['purchaseInvoice'], purchaseinvoices: ['purchaseInvoice'],
  supplierpayments: ['supplierPayment'], stock: ['stock'], cashbank: ['cash'],
  masters: ['customers', 'suppliers', 'products', 'employees'],
  customers: ['customers'], suppliers: ['suppliers'], products: ['products'], employees: ['employees'],
  analytics: ['reports'], setup: ['administration'],
});
