/**
 * Browser integration harness: runs the REAL index.html + js/app.js in Chromium.
 * Firebase SDK URLs (gstatic) are answered with local test doubles that forward every
 * Firestore operation to ONE shared in-memory simulator in this Node process, so several
 * pages behave like several users on the same database. CDN libraries are stubbed.
 * This is NOT the Firebase Emulator and NOT live Firebase.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createFakeFirestore } from '../support/fake-firestore.mjs';
import * as RoleCore from '../../js/role-core.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const QR_STUB = `window.QRCode=function(el,o){el.setAttribute('data-qr',o.text);el.textContent='[QR]';};window.QRCode.CorrectLevel={L:1,M:0,Q:3,H:2};`;

export async function startHarness({ appDir, playwright, executablePath, latencyMs = 0, requireLinks = false, costChecks = false, requireCats = false } = {}) {
  // latencyMs: simulated network round trip per Firebase call (sign-in timing, V270.4.4); 0 = none (all other tests)
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      const file = join(appDir, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
      if (!file.startsWith(appDir)) { res.writeHead(403).end(); return; }
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }).end(body);
    } catch { res.writeHead(404).end('not found'); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const fs = createFakeFirestore();
  const browser = await playwright.chromium.launch({ executablePath });
  const pages = [];
  const held = new Map(); // path -> pending subscriptions (simulates "server not reachable" for that document)
  function hold(path) { held.set(path, []); }
  function release(path) {
    const pending = held.get(path) || []; held.delete(path);
    for (const { page, id, spec, subs } of pending) {
      const unsub = fs.raw.subscribe(spec, payload => { page.evaluate(([i, p]) => window.__fsDeliver && window.__fsDeliver(i, p), [id, payload]).catch(() => {}); });
      subs.set(id, unsub);
    }
  }

  /** V270.4.2: like firestore.rules for reads — a collection the role can't view, or an own-only collection read
   *  without the owner (query without ownerUid == uid, or someone else's record). Owner / Administrator: everything. */
  function readDenied(uid, method, args) {
    if (!['read', 'list', 'subscribe'].includes(method)) return null;
    const u = fs.raw.read('users/' + uid);
    const ac = fs.raw.read('system/accessControl');
    if ((ac.exists && (ac.data.adminUids || []).includes(uid)) || !u.exists) return null;
    const rid = u.data.companyRoles && u.data.companyRoles.default;
    const r = fs.raw.read('roles/' + rid);
    if (!r.exists || (r.data.viewMods || []).length >= RoleCore.MODULE_IDS.length && !(r.data.ownMods || []).length) return null;
    const spec = method === 'read' ? { path: args[0], constraints: [] } : method === 'list' ? args[0] : args[1];
    const segs = String(spec.path).split('/');
    if (segs.length > 2) return null;
    const col = segs[0], mods = RoleCore.READ_MODULES[col];
    if (!mods) return null;
    if (!mods.some(m => (r.data.viewMods || []).includes(m))) return `${method} ${spec.path}: role ${rid} can't view`;
    const ownMod = RoleCore.OWN_COLLECTIONS[col];
    if (ownMod && (r.data.ownMods || []).includes(ownMod)) {
      if (segs.length === 2) { const d = fs.raw.read(spec.path); if (d.exists && d.data.ownerUid !== uid) return `read ${spec.path}: not own`; }
      else if (!(spec.constraints || []).some(c => c && c.field === 'ownerUid' && c.op === '==' && c.value === uid)) return `${method} ${col}: query without ownerUid`;
    }
    return null;
  }
  async function newUser({ uid, email, name, device, access = 'staff', role = 'r-test-staff' }) {
    // V270.4.2: roles — the built-in ones and a test role with every module (like office staff before roles existed)
    if (!fs.raw.read('roles/sales').exists) {
      const rec = (r, extra = {}) => ({ id: r.id, label: r.label, builtIn: true, locked: !!r.locked, perms: RoleCore.normalizePerms(r.perms), ...RoleCore.derivedLists(r.perms), revision: 1, updatedAt: '2026-10-01T00:00:00.000Z', updatedByUid: 'test', updatedByName: 'Test', schemaVersion: 1, ...extra });
      const load = {};
      for (const r of RoleCore.BUILT_IN_ROLES) load['roles/' + r.id] = rec(r);
      const all = Object.fromEntries(RoleCore.MODULES.map(m => [m.id, { v: true, c: true, e: true, x: true, own: false }]));
      load['roles/r-test-staff'] = rec({ id: 'r-test-staff', label: 'Test Staff', perms: all }, { builtIn: false });
      fs.load(load);
    }
    // V270.4.1: a login is office staff only with an active users/{uid} record. Test logins get one unless
    // access: 'none' (a login nobody gave access to) or the uid is the owner (system/accessControl) / a custodian.
    if (access === 'staff' && !fs.raw.read('users/' + uid).exists) {
      const ac = fs.raw.read('system/accessControl'), cc = fs.raw.read('cashCustodians/' + uid);
      const owner = ac.exists && (ac.data.adminUids || []).includes(uid);
      if (!owner && !cc.exists) fs.load({ ['users/' + uid]: { uid, name: name || uid, email: email || '', employeeId: '', employeeName: '', active: true, mustChangePassword: false,
        companyRoles: { default: role }, defaultCompany: 'default', perm: RoleCore.userPermFrom(fs.raw.read('roles/' + role).data || RoleCore.builtInRole(role)), revision: 1, createdAt: '2026-10-01T00:00:00.000Z', createdByUid: 'test', createdByName: 'Test',
        updatedAt: '2026-10-01T00:00:00.000Z', updatedByUid: 'test', updatedByName: 'Test', schemaVersion: 1 } });
    }
    // device: optional extra context options (e.g. a real phone: isMobile, hasTouch, deviceScaleFactor)
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 1000 }, ...(device || {}) });
    const subs = new Map();
    const page = await context.newPage();
    page.on('pageerror', e => page.__errors.push(String(e && e.stack || e)));
    page.on('console', m => { if (m.type() === 'error') page.__consoleErrors.push(m.text()); });
    page.__errors = []; page.__consoleErrors = []; page.__denied = [];
    page.on('framenavigated', f => { if (f === page.mainFrame()) { for (const u of subs.values()) u(); subs.clear(); } });
    page.__calls = [];
    await context.exposeBinding('__fs', async (_src, method, args) => {
      try {
        const p = method === 'read' ? args[0] : method === 'list' ? args[0] && args[0].path : method === 'subscribe' ? args[1] && args[1].path : method === 'commit' ? 'commit' : '';
        page.__calls.push({ t: Date.now(), method, path: String(p || '') });
        if (latencyMs && method !== 'unsubscribe') await wait(latencyMs);
        // V270.4.2: the security rules' READ checks for the role (what the real database would refuse)
        const why = readDenied(uid, method, args);
        if (why) { page.__denied.push(why); return { __error: true, code: 'permission-denied', message: 'Missing or insufficient permissions. (' + why + ')' }; }
        if (method === 'read') return fs.raw.read(args[0]);
        if (method === 'list') return fs.raw.list(args[0]);
        if (method === 'commit') { fs.raw.commit(args[0], args[1]); return { ok: true }; }
        if (method === 'subscribe') {
          const [id, spec] = args;
          if (held.has(spec.path)) { held.get(spec.path).push({ page, id, spec, subs }); return { ok: true }; }
          const unsub = fs.raw.subscribe(spec, payload => { page.evaluate(([i, p]) => window.__fsDeliver && window.__fsDeliver(i, p), [id, payload]).catch(() => {}); });
          subs.set(id, unsub); return { ok: true };
        }
        if (method === 'unsubscribe') { subs.get(args[0])?.(); subs.delete(args[0]); return { ok: true }; }
        throw new Error('unknown method ' + method);
      } catch (e) { return { __error: true, code: e.code || 'internal', message: e.message }; }
    });
    await context.route('https://www.gstatic.com/firebasejs/**', async route => {
      const name = new URL(route.request().url()).pathname.split('/').pop();
      route.fulfill({ status: 200, contentType: 'text/javascript', body: await readFile(join(here, 'fake-sdk', name)) });
    });
    await context.route(/^https:\/\/(cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com|unpkg\.com|cdnjs\.cloudflare\.com)\//, route => {
      const u = route.request().url();
      if (u.includes('qrcode')) return route.fulfill({ status: 200, contentType: 'text/javascript', body: QR_STUB });
      route.fulfill({ status: 200, contentType: u.endsWith('.css') ? 'text/css' : 'text/javascript', body: '' });
    });
    if (!requireLinks) await context.addInitScript(() => { window.__bcTestNoLinks = true; });   // V270.4.11: older tests predate item linking
    if (!costChecks) await context.addInitScript(() => { window.__bcTestNoCostChecks = true; });   // V270.4.14: older tests predate the Cost column checks at Mark as Sent
    if (!requireCats) await context.addInitScript(() => { window.__bcTestNoCats = true; });   // V271.6: older tests predate required work categories
    await context.addInitScript(([u]) => {
      localStorage.setItem('fakeUser', JSON.stringify(u));
      try { sessionStorage.setItem('bc_ds_later', '1'); } catch (e) {}   // V268.5: no automatic "Move settings" window in tests (data-safety.e2e opens it)
      window.__toasts = [];
      window.__popups = [];
      window.open = function (url) { // capture print windows instead of opening real popups
        const doc = { html: '', open() {}, write(h) { this.html += h; }, close() {} };
        const w = { document: doc, print() {}, focus() {}, close() {}, closed: false, location: { href: url || '' }, addEventListener() {} };
        window.__popups.push(w); return w;
      };
    }, [{ uid, email, displayName: name }]);
    pages.push(page);
    return page;
  }
  async function open(page, path = 'index.html', { allowUnknown = false } = {}) {
    await page.goto(base + path);
    await page.waitForFunction(a => typeof window.renderSOPage === 'function' && window.BizCoreDN && (a || window.BizCoreDN.mode !== 'unknown') && document.querySelector('#page-dashboard'), allowUnknown, { timeout: 30000 });
    await page.evaluate(() => {
      if (window.__toastWrapped) return;
      const orig = window.showToast;
      window.showToast = function (msg, type, title) { window.__toasts.push({ msg: String(msg), type: type || '', title: title || '' }); return orig.apply(this, arguments); };
      window.__toastWrapped = true;
    });
    await page.waitForTimeout(400);
  }
  async function close() { await browser.close(); server.close(); }
  return { fs, base, newUser, open, close, pages, hold, release };
}
