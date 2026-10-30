/* BizCore V270.4.8 — document pages for Print / PDF (all devices, all customer documents).
 *
 * Agreed with Musthafa (30 Oct 2026): the company footer stays at the BOTTOM of every page — screen, PDF and print,
 * every document, every device — as low as is safe for printers, its text spread from the left margin to the right,
 * with a clear gap between the last table row and the footer.
 *
 * Browsers handle a footer pinned to the page bottom differently (Chrome repeats it but lets table rows run under it;
 * iPhone Safari drops it). So the print window lays the document out on real A4 pages itself, before printing:
 *   - each page is an A4 box (210 × 297 mm); the content starts 10 mm from the top, 11–12 mm from the sides;
 *   - the footer line sits 8 mm above the bottom edge (most printers can't print the last 4–5 mm);
 *   - at least 8 mm white space between the content and the footer line;
 *   - an item table that doesn't fit continues on the next page with its header repeated (any table footer —
 *     e.g. totals — only on its last part); other blocks move to the next page whole;
 *   - "Page X of Y" is added to the footer when there is more than one page.
 * PC, Android and iPhone get the same pages. iPhone / iPad also print a little smaller (zoom), as Safari prints about
 * 20% larger than other browsers and keeps its own margins (measured 29 Oct on DN-2610-0004).
 *
 * Use (print window HTML):  html = BCPages.apply(html, BCPages.DN)   // or .ERP_QUOTE / .SERVICE_QUOTE
 * The routine runs inside the print window (it is copied into it), on load, before the window's own print call.
 */
(function () {
  'use strict';

  /* Runs inside the print window. Self-contained: it is copied into the window as text. */
  function bcPagesRun(win, cfg) {
    var doc = win.document, done = false;
    function run() {
      if (done) return; done = true;
      try { layout(); } catch (e) { try { console.error('[BizCore] page layout failed', e); } catch (x) {} }
    }
    win.addEventListener('load', run);   // registered before the window's own onload → runs first
    var origPrint = win.print;
    try { win.print = function () { run(); return origPrint.apply(win, arguments); }; } catch (e) {}

    function imp(el, styles) { for (var k in styles) el.style.setProperty(k, styles[k], 'important'); }

    function layout() {
      var MM = 96 / 25.4;
      var PH = 296.5, PW = 210;                      // 296.5: a hair under A4 so no browser spills a page
      var TOP = cfg.top || 10, SIDE = cfg.side || 11, FOOT_BOTTOM = 8, GAP = 8;
      // 1. lay out with the PRINT rules (what is measured = what is printed)
      Array.prototype.forEach.call(doc.querySelectorAll('style'), function (s) {
        var t = s.textContent;
        if (/@media\s+(print|screen)/.test(t)) s.textContent = t.replace(/@media\s+print/g, '@media all').replace(/@media\s+screen/g, '@media not all');
      });
      var css = doc.createElement('style');
      css.id = 'bc-pages-css';
      css.textContent = '@page{size:A4 portrait;margin:0}'
        + 'html,body{margin:0!important;padding:0!important;background:#fff!important}'
        + (cfg.hide || []).map(function (s) { return s + '{display:none!important}'; }).join('')
        + '.bcp-foot{position:absolute!important;left:' + SIDE + 'mm;right:' + SIDE + 'mm;bottom:' + FOOT_BOTTOM + 'mm;margin:0;padding:5px 0 0;'
        + 'display:flex;justify-content:space-between;align-items:baseline;gap:6px;white-space:nowrap;font-family:Arial,sans-serif;line-height:1.35;background:transparent}'
        + '.bcp-foot>span{flex:0 1 auto;overflow:hidden;text-overflow:ellipsis}'
        + '@media screen{html,body{background:#d6dbe1!important}.bcp-page{margin:12px auto!important;box-shadow:0 4px 18px rgba(0,0,0,.18)}}'
        + '@media print{.bcp-page{box-shadow:none!important}' + (cfg.ios ? 'html{zoom:' + cfg.ios + '}' : '') + '}';
      doc.head.appendChild(css);

      var roots = Array.prototype.slice.call(doc.querySelectorAll(cfg.root));
      var all = [];
      var fallbackFoot = cfg.footerFallback ? doc.querySelector(cfg.footerFallback) : null;
      roots.forEach(function (root) { all = all.concat(paginate(root)); });
      // page numbers (only when the document has more than one page)
      all.forEach(function (p, i) {
        var n = p.querySelector('.bcp-page-no');
        if (n) { if (all.length > 1) n.textContent = 'Page ' + (i + 1) + ' of ' + all.length; else n.remove(); }
        if (i === all.length - 1) imp(p, { 'break-after': 'auto', 'page-break-after': 'auto' });
      });

      function footerParts(src) {
        if (!src) return [];
        var ps = src.querySelectorAll ? src.querySelectorAll('.dfp') : [];
        if (ps.length) return Array.prototype.map.call(ps, function (x) { return x.textContent.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim(); }).filter(Boolean);
        var t = (src.innerText || src.textContent || '').replace(/ /g, ' ');
        return t.split(/\s*\|\s*|\n+/).map(function (x) { return x.replace(/\s+/g, ' ').trim(); }).filter(Boolean);
      }
      function makeFooter(src, style) {
        var f = doc.createElement('div');
        f.className = 'bcp-foot';
        footerParts(src).forEach(function (p) { var s = doc.createElement('span'); s.textContent = p; f.appendChild(s); });
        var n = doc.createElement('span'); n.className = 'bcp-page-no'; n.textContent = 'Page 99 of 99'; f.appendChild(n);
        if (style) f.style.cssText += ';border-top:' + style.bw + ' solid ' + style.bc + ';color:' + style.color + ';font-size:' + style.fs;
        return f;
      }
      function footStyle(src) {
        var cs = src ? win.getComputedStyle(src) : null;
        var bw = cs && parseFloat(cs.borderTopWidth) > 0 ? Math.min(2, parseFloat(cs.borderTopWidth)) + 'px' : '1.5px';
        return { bw: bw, bc: (cs && parseFloat(cs.borderTopWidth) > 0 && cs.borderTopColor) || '#174b7a', color: (cs && cs.color) || '#52687b', fs: (cs && cs.fontSize) || '8px' };
      }
      function splitTable(item) {
        var el = item, guard = 0;
        while (el && guard++ < 4) {
          if (el.tagName === 'TABLE') return el.tBodies[0] && el.tBodies[0].rows.length ? el : null;
          var kids = Array.prototype.filter.call(el.children, function (c) { return c.tagName !== 'STYLE' && c.tagName !== 'SCRIPT'; });
          if (kids.length !== 1) return null;
          el = kids[0];
        }
        return null;
      }
      function paginate(root) {
        var container = cfg.container ? (root.closest(cfg.container) || root) : root;
        var footSrc = (cfg.footer && (root.querySelector(cfg.footer) || doc.querySelector(cfg.footer))) || fallbackFoot;
        var fStyle = footStyle(footSrc);
        var parts = footSrc;   // read before it is removed / hidden
        var footClone = footSrc ? footSrc.cloneNode(true) : null;
        if (footSrc && root.contains(footSrc)) footSrc.remove();
        // the page's own styles go to <head>; everything else flows into the pages
        var items = [];
        Array.prototype.slice.call(root.childNodes).forEach(function (n) {
          if (n.nodeType === 1 && n.tagName === 'STYLE') { doc.head.insertBefore(n, css); return; }
          if (n.nodeType === 1 && n.tagName === 'SCRIPT') return;
          if (n.nodeType === 3 && !n.textContent.trim()) return;
          items.push(n);
        });
        var pages = [], page = null, limit = 0;
        function newPage() {
          var p = root.tagName === 'TD' || root.tagName === 'TR' ? doc.createElement('div') : root.cloneNode(false);
          p.removeAttribute('id');
          p.classList.add('bcp-page');
          imp(p, { width: PW + 'mm', height: PH + 'mm', 'min-height': '0', 'max-height': PH + 'mm', padding: TOP + 'mm ' + SIDE + 'mm 0', margin: '0',
            'box-sizing': 'border-box', position: 'relative', overflow: 'hidden', display: 'block', 'break-after': 'page', 'page-break-after': 'always',
            'break-before': 'auto', 'page-break-before': 'auto', background: '#fff', border: '0', 'border-radius': '0', 'box-shadow': 'none', transform: 'none', zoom: '1' });
          container.parentNode.insertBefore(p, container);
          var f = makeFooter(footClone || parts, fStyle);
          p.appendChild(f);
          limit = PH * MM - FOOT_BOTTOM * MM - f.offsetHeight - GAP * MM;
          pages.push(p);
          return p;
        }
        function bottom(el) {
          var r = el.getBoundingClientRect(), pr = page.getBoundingClientRect();
          var mb = el.nodeType === 1 ? parseFloat(win.getComputedStyle(el).marginBottom) || 0 : 0;
          return r.bottom - pr.top + Math.max(0, mb);
        }
        function contentCount() { return page.children.length - 1; }   // minus the footer
        function put(n) { page.insertBefore(n, page.querySelector('.bcp-foot')); }
        page = newPage();
        var queue = items.slice();
        while (queue.length) {
          var item = queue.shift();
          put(item);
          if (item.nodeType !== 1 || bottom(item) <= limit) continue;
          var t = splitTable(item);
          if (t) {
            var body = t.tBodies[0], carry = [];
            while (body.rows.length && bottom(item) > limit) { carry.unshift(body.rows[body.rows.length - 1]); body.removeChild(body.rows[body.rows.length - 1]); }
            if (body.rows.length && carry.length) {
              // the rest of the table continues on the next page (header repeated, table footer only on the last part)
              var rest = item.cloneNode(true), rt = splitTable(rest) || (rest.tagName === 'TABLE' ? rest : rest.querySelector('table'));
              if (!rt) { carry.forEach(function (r) { body.appendChild(r); }); }
              else {
                var rb = rt.tBodies[0]; while (rb.rows.length) rb.removeChild(rb.rows[0]);
                carry.forEach(function (r) { rb.appendChild(r); });
                if (t.tFoot) t.tFoot.remove();
                page = newPage();
                queue.unshift(rest);
                continue;
              }
            } else {
              carry.forEach(function (r) { body.appendChild(r); });   // not even one row fits here → whole table to the next page
            }
          }
          if (contentCount() > 1) { item.remove(); page = newPage(); put(item); }
          // a single block taller than a page stays (rare: e.g. very long notes)
        }
        container.remove();
        return pages;
      }
    }
  }

  function isIOS() {
    var ua = navigator.userAgent || '';
    return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  var IOS_ZOOM = 0.71;   // iPhone / iPad print scale (tune after a test print if needed)

  window.BCPages = {
    /** Delivery Note, Invoice, Credit Note, Payment Receipt (.dn-a4 pages with .dn-foot). */
    DN: { root: '.dn-a4', footer: '.dn-foot', top: 10, side: 11 },
    /** Quotation — ERP box / image / bilingual templates (article.sheet + attachment sheets, footer.page-footer). */
    ERP_QUOTE: { root: 'article.sheet, article.attachment-sheet', footer: '.page-footer', footerFallback: '.fixed-footer', hide: ['.fixed-footer'], top: 10, side: 11 },
    /** Quotation — service / contracting template (content in table.pw, footer in its tfoot). */
    SERVICE_QUOTE: { root: 'table.pw > tbody > tr > td', container: 'table.pw', footer: 'table.pw > tfoot .footer', footerFallback: '.fixed-footer', hide: ['.fixed-footer'], top: 10, side: 12 },
    isIOS: isIOS,
    /** The <script> that lays the print window out on A4 pages (put it in the window's <head>). */
    head: function (cfg) {
      var c = Object.assign({}, cfg || this.DN, { ios: isIOS() ? IOS_ZOOM : 0 });
      return '<scr' + 'ipt>(' + bcPagesRun.toString() + ')(window,' + JSON.stringify(c) + ');</scr' + 'ipt>';
    },
    /** Adds the page layout to a complete print-window HTML document. */
    apply: function (html, cfg) {
      var tag = this.head(cfg); html = String(html || '');
      return /<\/head>/i.test(html) ? html.replace(/<\/head>/i, tag + '</head>') : tag + html;
    },
    _run: bcPagesRun,
  };
})();
