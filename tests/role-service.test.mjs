/** V270.4.2 Roles & Permissions — core rules and the service, against the in-memory Firestore SIMULATOR. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFakeFirestore } from './support/fake-firestore.mjs';
import { createRoleService } from '../js/role-service.mjs';
import * as R from '../js/role-core.mjs';

const rejectsCode = (p, code) => assert.rejects(p, e => { assert.equal(e.code, code, e.message); return true; });
function env() {
  const fs = createFakeFirestore();
  fs.load({ 'system/accessControl': { adminUids: ['boss'] }, 'users/ann': { uid: 'ann', active: true, companyRoles: { default: 'administrator' } }, 'users/sam': { uid: 'sam', active: true, companyRoles: { default: 'sales' } } });
  const mk = uid => createRoleService(fs, { actor: () => ({ uid, name: uid }) });
  return { fs, boss: mk('boss'), ann: mk('ann'), sam: mk('sam') };
}

test('core: normalize, lists, built-in roles, change text, permissions object', () => {
  const p = R.normalizePerms({ rfq: { c: true, own: true }, quotation: { v: true, x: true, own: true }, reports: { v: true, c: true }, nope: { v: true } });
  assert.deepEqual(p.rfq, { v: false, c: false, e: false, x: false, own: false }, 'nothing without View');
  assert.deepEqual(p.quotation, { v: true, c: false, e: false, x: true, own: true });
  assert.deepEqual(p.reports, { v: true, c: false, e: false, x: false, own: false }, 'Reports: View only');
  assert.equal(p.nope, undefined);
  assert.equal(R.normalizePerms({ deliveryNote: { v: true, own: true } }).deliveryNote.own, false, 'Own only on RFQ / Pricing / Quotation / SO');
  const L = R.derivedLists({ quotation: { v: true, x: true }, stock: { v: true, e: true } });
  assert.deepEqual(L, { viewMods: ['quotation', 'stock'], createMods: [], editMods: ['stock'], cancelMods: ['quotation'], writeMods: ['quotation', 'stock'], ownMods: [], rightMods: ['printDocs'] });
  const sales = R.builtInRole('sales').perms;
  assert.equal(sales.rfq.x, true); assert.equal(sales.salesOrder.x, false); assert.equal(sales.purchaseInvoice.v, false); assert.equal(sales.invoice.v, true);
  assert.equal(R.builtInRole('manager').perms.administration.v, false);
  assert.equal(R.builtInRole('store').perms.deliveryNote.c, true);
  assert.equal(R.describePermChange(sales, { ...sales, quotation: { ...sales.quotation, x: false }, rfq: { ...sales.rfq, own: true } }), 'RFQs: Records All → Own · Quotations: − Cancel');
  const perm = R.permissionsFor({ id: 'sales', label: 'Sales', perms: { ...sales, rfq: { ...sales.rfq, own: true } } });
  assert.deepEqual([perm.can('rfq'), perm.can('purchaseInvoice'), perm.ownOnly('rfq'), perm.canAny(['cash', 'invoice'])], [true, false, true, true]);
  assert.equal(R.permissionsFor(null, { admin: true }).can('administration', 'e'), true);
  assert.equal(R.permissionsFor(null).known, false);
  const v = R.validateRoleInput({ label: 'Site  Engineer' }, { creating: true, existingIds: [] });
  assert.equal(v.value.id, 'r-site-engineer');
  assert.equal(R.validateRoleInput({ label: 'Site Engineer' }, { creating: true, existingIds: ['r-site-engineer'] }).ok, false);
  assert.equal(R.validateRoleInput({ label: '' }).ok, false);
});

test('service: built-in roles once; administrators save; staff refused; Administrator locked; changes kept', async () => {
  const { fs, boss, ann, sam } = env();
  assert.equal((await boss.ensureBuiltInRoles()).length, R.BUILT_IN_ROLES.length);
  assert.deepEqual(await boss.ensureBuiltInRoles(), [], 'only once');
  const sales = fs.dump('roles/')['roles/sales'];
  assert.deepEqual([sales.builtIn, sales.locked, sales.revision], [true, false, 1]);
  assert.ok(sales.viewMods.includes('quotation'));
  await rejectsCode(sam.saveRole({ id: 'sales', label: 'Sales', perms: {} }), 'not-admin');
  await rejectsCode(sam.ensureBuiltInRoles(), 'not-admin');
  const next = await ann.saveRole({ id: 'sales', label: 'Renamed?', perms: { ...sales.perms, quotation: { ...sales.perms.quotation, x: false } } }, { expectedRevision: 1 });
  assert.deepEqual([next.label, next.revision, next.cancelMods.includes('quotation')], ['Sales', 2, false], 'built-in names stay');
  await rejectsCode(ann.saveRole({ id: 'sales', label: 'Sales', perms: {} }, { expectedRevision: 1 }), 'conflict');
  await rejectsCode(boss.saveRole({ id: 'administrator', label: 'Administrator', perms: {} }), 'role-locked');
  const se = await boss.saveRole({ label: 'Site Engineer', perms: R.builtInRole('store').perms }, { creating: true, existingIds: [], copyOf: 'Store / Delivery' });
  assert.deepEqual([se.id, se.builtIn, se.perms.deliveryNote.c], ['r-site-engineer', false, true]);
  await rejectsCode(boss.saveRole({ label: 'Site Engineer', perms: {} }, { creating: true, existingIds: [] }), 'invalid-input');
  const ch = await boss.loadChanges('sales');
  assert.equal(ch.length, 2); assert.match(ch.map(c => c.note).join('|'), /Quotations: − Cancel/);
  assert.match((await boss.loadChanges('r-site-engineer'))[0].note, /copy of Store/);
});

test('V270.4.2 users carry their role\'s lists (perm): role save updates them, sync repairs, owner untouched', async () => {
  const { fs, boss, ann } = env();
  await boss.ensureBuiltInRoles();
  fs.load({
    'users/sam': { uid: 'sam', active: true, companyRoles: { default: 'sales' }, revision: 1, perm: { roleId: 'sales', viewMods: ['old'] } },
    'users/stan': { uid: 'stan', active: true, companyRoles: { default: 'store' }, revision: 1 },
    'users/boss': { uid: 'boss', active: true, companyRoles: { default: 'sales' }, revision: 1 },
  });
  const fixed = await ann.syncUserPerms();
  assert.deepEqual(fixed.sort(), ['ann', 'sam', 'stan'], 'the owner\'s record is changed only by the owner');
  const u = id => fs.dump('users/')['users/' + id];
  assert.ok(u('stan').perm.viewMods.includes('deliveryNote')); assert.equal(u('stan').revision, 2);
  assert.deepEqual(await ann.syncUserPerms(), [], 'nothing left to repair');
  const sales = fs.dump('roles/')['roles/sales'];
  await ann.saveRole({ id: 'sales', label: 'Sales', perms: { ...sales.perms, quotation: { v: false } } }, { expectedRevision: 1 });
  assert.ok(!u('sam').perm.viewMods.includes('quotation'), 'saving the role updates its users');
  assert.equal(u('boss').perm, undefined, 'owner left alone');
  assert.ok(R.samePerm(u('sam').perm, R.userPermFrom(fs.dump('roles/')['roles/sales'])));
});

test('V270.4.3 Special Rights: migration gives the same effect as the old settings; rights saved, described, copied to users', async () => {
  const { fs, boss } = env();
  // roles as they were saved in V270.4.2 (no rights)
  const old = id => { const b = R.builtInRole(id); return { id, label: b.label, builtIn: true, locked: !!b.locked, perms: R.normalizePerms(b.perms), revision: 1 }; };
  fs.load({ 'roles/sales': old('sales'), 'roles/accounts': old('accounts'), 'roles/manager': old('manager'),
    'users/sam': { uid: 'sam', active: true, companyRoles: { default: 'accounts' }, revision: 1 } });
  const done = await boss.migrateRights({ billing: { allowOrderInvoices: 'all', allowAdvanceInvoices: 'admin', allowCreditNotes: 'admin' }, receipts: { allowRecord: 'all', allowVoid: 'admin' }, purchasing: { profitVisibility: 'admins' } });
  assert.deepEqual(done.sort(), ['accounts', 'manager', 'sales']);
  const role = id => fs.dump('roles/')['roles/' + id];
  assert.equal(role('accounts').rights.orderInvoices, true, '"all" → roles that create invoices');
  assert.equal(role('sales').rights.orderInvoices, false, 'sales does not create invoices');
  assert.equal(role('accounts').rights.advanceInvoices, false, '"admin" → administrators only');
  assert.equal(role('accounts').perms.receipt.c, true); assert.equal(role('accounts').perms.receipt.x, false, 'void was administrators only');
  assert.equal(role('manager').rights.seeCost, false); assert.equal(role('manager').rights.printDocs, true);
  assert.ok(role('accounts').rightMods.includes('orderInvoices'));
  assert.ok(fs.dump('users/')['users/sam'].perm.rightMods.includes('orderInvoices'), 'copied to the role\'s users');
  assert.deepEqual(await boss.migrateRights({}), [], 'only once');
  const ch = await boss.loadChanges('accounts');
  assert.match(ch[0].note, /Special Rights added/);
  // a later save changes a right and says so
  await boss.saveRole({ id: 'accounts', label: 'Accounts', perms: role('accounts').perms, rights: { ...role('accounts').rights, creditNotes: true } }, { expectedRevision: 2 });
  assert.match((await boss.loadChanges('accounts'))[0].note, /Issue credit notes, cancel & re-issue invoices: On/);
  // a save without rights keeps them
  await boss.saveRole({ id: 'accounts', label: 'Accounts', perms: role('accounts').perms }, { expectedRevision: 3 });
  assert.equal(role('accounts').rights.creditNotes, true);
  assert.equal(R.permissionsFor(role('accounts')).right('creditNotes'), true);
  assert.equal(R.permissionsFor(null, { admin: true }).right('forceRelease'), true);
});
