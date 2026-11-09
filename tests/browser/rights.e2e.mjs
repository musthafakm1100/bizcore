/** BROWSER (simulator): V270.4.3 — Special Rights. At the administrator's sign-in the roles get the rights with the
 *  same effect as the old settings; the Special Rights tab shows them with "Was" and saves a change; with
 *  "Approve below minimum margin" a Manager decides. V271.5.40: "Export to Excel" was removed as a restrictable
 *  right — every role can export, so this test now checks the Excel button and function are never gated. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { startHarness } from './harness.mjs';

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const playwright = createRequire(process.env.PLAYWRIGHT_FROM || import.meta.url)('playwright');
const sleep = ms => new Promise(r => setTimeout(r, ms));

test('V270.4.3 Special Rights: migration at sign-in, Special Rights tab, rights used by the screens', { timeout: 240000 }, async () => {
  const h = await startHarness({ appDir, playwright, executablePath: process.env.CHROMIUM_PATH });
  try {
    h.fs.load({
      'system/deliveryNoteStorage': { mode: 'independent', minClientVersion: 260 }, 'system/invoiceStorage': { mode: 'independent' }, 'system/accessControl': { adminUids: ['u-boss'] },
      'settings/billing': { allowOrderInvoices: 'all', allowAdvanceInvoices: 'admin', allowCreditNotes: 'admin' },
      'settings/receipts': { allowRecord: 'all', allowVoid: 'admin' },
    });
    const role = id => h.fs.dump('roles/')['roles/' + id];
    const boss = await h.newUser({ uid: 'u-boss', email: 'boss@dt.com', name: 'Musthafa' });
    await h.open(boss); await sleep(1200);

    // ── migration: same effect as the old settings ──
    const acc = role('accounts');
    assert.ok(acc.rights, 'rights added');
    assert.deepEqual([acc.rights.orderInvoices, acc.rights.advanceInvoices, acc.rights.creditNotes, acc.rights.seeCost], [true, false, false, false]);
    assert.equal(acc.perms.receipt.x, false, 'void was administrators only');
    assert.equal(role('sales').rights.orderInvoices, false, 'Sales does not create invoices');
    assert.equal(role('administrator').rights === undefined || Object.values(role('administrator').rights).every(Boolean), true);
    assert.match(Object.values(h.fs.dump('roles/accounts/changes/')).map(c => c.note).join('|'), /Special Rights added/);

    // ── the tab: Manager → Approve below minimum margin On, Backdate Off; "Export to Excel" is no longer a right ──
    await boss.evaluate(() => { showPage('setup'); switchSetupTab('roles'); }); await sleep(500);
    await boss.click('[data-ur="role-pick"][data-role="manager"]'); await sleep(200);
    await boss.click('[data-ur="role-tab"][data-tab="rights"]'); await sleep(200);
    const tab = await boss.textContent('#ur-roles-host');
    assert.match(tab, /See cost[\s\S]*Approve pricing below the minimum margin[\s\S]*order invoices[\s\S]*Force-release/);
    assert.match(tab, /Was:/);
    assert.doesNotMatch(tab, /Export to Excel/, 'Excel export is no longer a restrictable right');
    await boss.click('[data-ur="right"][data-right="approveMargin"]'); await sleep(100);
    await boss.click('[data-ur="right"][data-right="backdate"]'); await sleep(100);
    await boss.click('[data-ur="role-save"]'); await boss.waitForSelector('#confirm-ok');
    assert.match(await boss.textContent('.confirm-box'), /Approve pricing below the minimum margin:? ?On[\s\S]*Backdate beyond the backdate limit:? ?On/);
    await boss.click('#confirm-ok'); await sleep(700);
    const mgr = role('manager');
    assert.deepEqual([mgr.rights.approveMargin, mgr.rights.backdate], [true, true]);
    assert.ok(mgr.rightMods.includes('approveMargin')); assert.ok(mgr.rightMods.includes('backdate'));
    // the Administrator role's rights are locked
    await boss.click('[data-ur="role-pick"][data-role="administrator"]'); await sleep(200);
    await boss.click('[data-ur="role-tab"][data-tab="rights"]'); await sleep(200);
    assert.equal(await boss.isDisabled('[data-ur="right"][data-right="forceRelease"]'), true);

    // ── a Manager user: rights used by the screens ──
    const mo = await h.newUser({ uid: 'u-mona', email: 'mona@dt.com', name: 'Mona', role: 'manager' });
    assert.ok(h.fs.dump('users/')['users/u-mona'].perm.rightMods.includes('approveMargin'), 'user copy carries the rights');
    await h.open(mo); await sleep(800);
    assert.deepEqual(await mo.evaluate(() => [bcRight('approveMargin'), bcRight('forceRelease'), bcRight('printDocs')]), [true, false, true]);
    // Excel export is open for every role regardless of rights: the function runs with no "not allowed" toast,
    // and the register's Excel button stays visible.
    await mo.evaluate(() => { window.__toasts = []; exportQuotationRegisterExcel(); }); await sleep(100);
    assert.doesNotMatch(await mo.evaluate(() => window.__toasts.map(t => t.msg).join('|')), /doesn.t have the Special Right/);
    await mo.evaluate(() => showPage('quotations')); await sleep(300);
    assert.equal(await mo.evaluate(() => { const b = document.getElementById('quotation-export-excel-btn'); return !b || b.offsetParent === null || b.hidden || getComputedStyle(b).display === 'none'; }), false, 'Excel button stays visible for every role');
    // the owner is an administrator: every right
    assert.deepEqual(await boss.evaluate(() => [bcRight('forceRelease'), bcRight('seeCost')]), [true, true]);

    for (const p of h.pages) assert.deepEqual(p.__errors, [], 'no page errors');
  } finally { await h.close(); }
});

test('V270.4.4 sign-in: role upkeep only when needed, never holding up the sign-in; access checks unchanged', { timeout: 240000 }, async () => {
  const h = await startHarness({ appDir, playwright, executablePath: process.env.CHROMIUM_PATH });
  try {
    h.fs.load({ 'system/deliveryNoteStorage': { mode: 'independent', minClientVersion: 260 }, 'system/invoiceStorage': { mode: 'independent' }, 'system/accessControl': { adminUids: ['u-boss'] } });
    const roles = () => h.fs.dump('roles/');
    const boss = await h.newUser({ uid: 'u-boss', email: 'boss@dt.com', name: 'Musthafa' });
    // first sign-in: roles from before V270.4.3 (no rights) → completed in the background
    await h.open(boss); await sleep(4500);   // incl. the user permission check (2.5 s after the upkeep)
    assert.ok(roles()['roles/accounts'].rights, 'Special Rights added');
    const revs = JSON.stringify(Object.fromEntries(Object.entries(roles()).filter(([k]) => k.split('/').length === 2).map(([k, r]) => [k, r.revision])));
    // next sign-in: nothing missing → one roles read, no transaction, no settings reads, no role changed
    boss.__calls.length = 0;
    await h.open(boss); await sleep(3500);
    const c = boss.__calls.map(x => x.method + ':' + x.path);
    assert.equal(c.filter(x => x === 'list:roles').length, 1, 'roles read once');
    assert.equal(c.filter(x => /^read:roles\//.test(x)).length, 0, 'no built-in roles transaction');
    assert.equal(c.filter(x => /^read:settings\/(billing|receipts)$/.test(x)).length, 0, 'no Special Rights step');
    assert.equal(c.filter(x => x === 'list:users').length, 0, 'user permission check not repeated the same day');
    assert.equal(JSON.stringify(Object.fromEntries(Object.entries(roles()).filter(([k]) => k.split('/').length === 2).map(([k, r]) => [k, r.revision]))), revs, 'no role changed');
    // a built-in role that is missing is created again at the next sign-in
    h.fs.raw.commit([{ op: 'delete', path: 'roles/store' }]);
    await h.open(boss); await sleep(1500);
    assert.ok(roles()['roles/store'], 'missing built-in role created');
    assert.ok(roles()['roles/store'].rights, 'with its rights');

    // a normal user is still checked before anything opens: role read at sign-in, deactivated user refused
    const sam = await h.newUser({ uid: 'u-sam', email: 'sam@dt.com', name: 'Sam', role: 'sales' });
    await h.open(sam); await sleep(500);
    assert.ok(sam.__calls.some(x => x.method === 'read' && x.path === 'roles/sales'), 'role read at sign-in');
    assert.equal(await sam.evaluate(() => window.BCPerm.admin), false);
    assert.equal(await sam.evaluate(() => window.BCPerm.can('purchaseInvoice')), false, 'role limits applied');
    const u = h.fs.raw.read('users/u-sam').data; h.fs.load({ 'users/u-sam': { ...u, active: false } });
    await sam.goto(h.base + 'index.html'); await sleep(1500);
    assert.match(await sam.textContent('body'), /switched off|No access/i, 'deactivated user refused');
    for (const p of [boss]) assert.deepEqual(p.__errors, [], 'no page errors');
  } finally { await h.close(); }
});
