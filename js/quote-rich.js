/* BizCore V270.4.14 — formatted descriptions on quotation service (scope) lines and note lines.
 *
 * Agreed 31 Oct 2026 (mockups RT_1 – RT_3): one Format bar above the table header (active while typing in a scope / note
 * line, greyed elsewhere): bold, italic, underline · 4 sizes (Small / Normal / Large / Heading) · 5 colours (black, navy,
 * red, green, grey) · one highlight (light yellow) · bullets · numbering 1. / a. / A. / i. / I. · indent (Tab /
 * Shift+Tab) · clear formatting. Paste from Word keeps the allowed formatting; fonts, background colours, tables and
 * pictures are removed.
 *
 * Stored on the line: `desc` (or `text` for a note) = PLAIN TEXT that keeps the layout (line breaks, "•" bullets,
 * "1." / "a." numbers, indent) — used by search, the customer wording memory, the item link, the Sales Order, the
 * Delivery Note and the Invoice (agreed: they print plain text with the layout) — plus `descHtml` / `textHtml` = the
 * cleaned formatting, only when the line has any formatting beyond line breaks. Lines without formatting stay exactly as
 * before.
 *
 * The editor is a <div contenteditable> with a `value` property (plain text in / out), so the existing code that reads
 * `.value` of the description / note field keeps working unchanged.
 */
(function () {
  'use strict';
  const COLORS = [['k', '#0f172a', 'Black'], ['n', '#1F4E79', 'Navy'], ['b', '#1D4ED8', 'Blue'], ['t', '#0F766E', 'Teal'], ['g', '#15803d', 'Green'], ['o', '#C2410C', 'Orange'], ['r', '#b91c1c', 'Red'], ['m', '#9F1239', 'Maroon'], ['s', '#64748b', 'Grey']];   // V271.7.3: + Blue, Teal, Orange, Maroon
  // V271.7.3: highlight colours ('y' = the original yellow, stored as rt-hl; the others rt-hl-<key>)
  const HLS = [['y', '#fef08a', 'Yellow'], ['g', '#dcfce7', 'Light green'], ['b', '#dbeafe', 'Light blue'], ['o', '#ffedd5', 'Light orange'], ['s', '#e5e7eb', 'Light grey']];
  const hlCls = k => !k ? '' : (k === true || k === 'y') ? 'rt-hl' : 'rt-hl-' + k;
  const hlOfCls = c => c === 'rt-hl' ? 'y' : (/^rt-hl-([gbos])$/.exec(c) || [])[1] || '';
  const SIZES = [['sm', 'Small'], ['', 'Normal'], ['lg', 'Large'], ['h', 'Heading']];
  const HL = '#fef08a';
  const OL_TYPES = [['1', '1. 2. 3.'], ['a', 'a. b. c.'], ['A', 'A. B. C.'], ['i', 'i. ii. iii.'], ['I', 'I. II. III.']];
  const MAX_HTML = 90000;   // V271.6: long scope of work (30,000 characters of text per line, checked on save)
  const escT = s => String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  /* ───────── cleaning: any HTML (typed, pasted from Word, stored) → the allowed set ───────── */
  function rgbOf(v) {
    v = String(v || '').trim().toLowerCase(); if (!v) return null;
    let m = v.match(/^#([0-9a-f]{3})$/); if (m) return m[1].split('').map(c => parseInt(c + c, 16));
    m = v.match(/^#([0-9a-f]{6})$/); if (m) return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16));
    m = v.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/); if (m) { if (m[4] !== undefined && Number(m[4]) === 0) return null; return [Number(m[1]), Number(m[2]), Number(m[3])]; }
    const named = { black: [0, 0, 0], red: [255, 0, 0], green: [0, 128, 0], blue: [0, 0, 255], navy: [0, 0, 128], gray: [128, 128, 128], grey: [128, 128, 128], maroon: [128, 0, 0], darkred: [139, 0, 0], darkgreen: [0, 100, 0], darkblue: [0, 0, 139], white: [255, 255, 255], yellow: [255, 255, 0] };
    return named[v] || null;
  }
  /** nearest of the 5 colours ('' = black / no colour) */
  function colorKey(v) {
    const c = rgbOf(v); if (!c) return '';
    if (c[0] > 235 && c[1] > 235 && c[2] > 235) return '';   // white text (pasted from a dark theme) → normal
    let best = 'k', bd = Infinity;
    COLORS.forEach(([k, hex]) => { const p = rgbOf(hex), d = (p[0] - c[0]) ** 2 * 0.3 + (p[1] - c[1]) ** 2 * 0.59 + (p[2] - c[2]) ** 2 * 0.11; if (d < bd) { bd = d; best = k; } });
    return best === 'k' ? '' : best;
  }
  function isHighlight(v) { const c = rgbOf(v); if (!c) return false; if (c[0] > 245 && c[1] > 245 && c[2] > 245) return false; return true; }
  /** nearest of the highlight colours (pasted text) */
  function hlKey(v) { const c = rgbOf(v); if (!c) return 'y'; let best = 'y', bd = Infinity; HLS.forEach(([k, hex]) => { const p = rgbOf(hex), d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2; if (d < bd) { bd = d; best = k; } }); return best; }
  function sizeKeyPx(px) { if (!(px > 0)) return ''; return px < 12.5 ? 'sm' : px <= 15.5 ? '' : px <= 19.5 ? 'lg' : 'h'; }
  function sizeKeyCss(v) {
    v = String(v || '').trim().toLowerCase(); if (!v) return '';
    const n = parseFloat(v); if (!Number.isFinite(n)) return ({ 'x-small': 'sm', small: 'sm', smaller: 'sm', large: 'lg', larger: 'lg', 'x-large': 'h', 'xx-large': 'h' })[v] || '';
    if (/pt$/.test(v)) return sizeKeyPx(n * 4 / 3);
    if (/(r?em)$/.test(v)) return n < 0.92 ? 'sm' : n <= 1.08 ? '' : n <= 1.25 ? 'lg' : 'h';
    if (/%$/.test(v)) return n < 92 ? 'sm' : n <= 108 ? '' : n <= 125 ? 'lg' : 'h';
    return sizeKeyPx(n);
  }
  const BLOCK = new Set(['DIV', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TR', 'BLOCKQUOTE', 'PRE', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'TABLE', 'TBODY', 'THEAD', 'DL', 'DT', 'DD', 'ADDRESS', 'CENTER']);
  const DROP = new Set(['SCRIPT', 'STYLE', 'HEAD', 'META', 'TITLE', 'LINK', 'IMG', 'SVG', 'VIDEO', 'AUDIO', 'IFRAME', 'OBJECT', 'EMBED', 'CANVAS', 'INPUT', 'BUTTON', 'SELECT', 'TEXTAREA', 'XML', 'TEMPLATE', 'NOSCRIPT']);

  function fmtOf(el) {
    const t = el.tagName, st = el.style || {}, f = {};
    if (t === 'B' || t === 'STRONG' || /^H[1-6]$/.test(t)) f.b = true;
    if (t === 'I' || t === 'EM') f.i = true;
    if (t === 'U' || t === 'INS') f.u = true;
    const fw = st.fontWeight; if (fw) { if (fw === 'bold' || fw === 'bolder' || Number(fw) >= 600) f.b = true; else if (fw === 'normal' || Number(fw) <= 500) f.nb = true; }
    if (st.fontStyle === 'italic') f.i = true;
    if (/underline/.test(st.textDecoration || st.textDecorationLine || '')) f.u = true;
    const col = t === 'FONT' ? el.getAttribute('color') : st.color; if (col) { const k = colorKey(col); f.c = k || 'k'; }
    if (t === 'SPAN' || t === 'FONT' || t === 'MARK') {
      const bg = t === 'MARK' ? HL : (st.backgroundColor || st.background); if (bg && isHighlight(bg)) f.hl = hlKey(bg);
    }
    if (t === 'FONT' && el.getAttribute('size')) { const s = Number(el.getAttribute('size')); f.z = s <= 2 ? 'sm' : s === 3 ? '' : s === 4 ? 'lg' : 'h'; }
    else if (st.fontSize) f.z = sizeKeyCss(st.fontSize);
    if (/^H[1-3]$/.test(t)) f.z = 'h'; else if (/^H[4-6]$/.test(t)) f.z = 'lg';
    // our own classes (stored HTML)
    (el.classList ? [...el.classList] : []).forEach(c => { let m; if ((m = c.match(/^rt-c-([nrgskobmt])$/))) { f.c = m[1]; f.own = true; } else if ((m = c.match(/^rt-z-(sm|lg|h|n)$/))) f.z = m[1]; else if (hlOfCls(c)) f.hl = hlOfCls(c); else if (c === 'rt-nohl') f.nohl = true; });
    return f;
  }
  function clean(html) {
    if (!html) return '';
    let docu;
    try { docu = new DOMParser().parseFromString('<!doctype html><body>' + String(html), 'text/html'); } catch (_) { return escT(String(html)); }
    // Word puts list numbers as text in "MsoListParagraph" paragraphs (and <!--[if !supportLists]--> parts) — those stay text
    const out = [];
    function walk(node, depth) { for (let n = node.firstChild; n; n = n.nextSibling) one(n, depth); }
    function one(n, depth) {
        if (n.nodeType === 3) { const t = n.nodeValue.replace(/[\r\n]+/g, ' ').replace(/\u200B/g, ''); if (t) out.push(escT(t)); return; }
        if (n.nodeType !== 1) return;
        const t = n.tagName.toUpperCase();
        if (DROP.has(t) || /^O:|^W:|^V:/.test(t)) { if (t === 'O:P') walk(n, depth); return; }
        if (n.style && n.style.display === 'none') return;
        if (t === 'BR') { out.push('<br>'); return; }
        if (t === 'OL' || t === 'UL') {
          if (depth >= 3) { walk(n, depth); return; }   // deeper than 3 levels: kept as the 3rd level
          const ty = t === 'OL' ? (n.getAttribute('type') || '') : '';
          const st = t === 'OL' && Number(n.getAttribute('start')) > 1 ? ` start="${Math.min(999, Math.floor(Number(n.getAttribute('start'))))}"` : '';
          out.push(t === 'OL' ? `<ol${/^[1aAiI]$/.test(ty) ? ` type="${ty}"` : ''}${st}>` : '<ul>');
          for (let c = n.firstChild; c; c = c.nextSibling) {
            const ct = c.nodeType === 1 ? c.tagName.toUpperCase() : '';
            if (ct === 'LI') { out.push('<li>'); walk(c, depth + 1); out.push('</li>'); }
            else if (c.nodeType === 1 || (c.nodeType === 3 && c.nodeValue.trim())) { out.push('<li>'); one(c, depth + 1); out.push('</li>'); }
          }
          out.push(t === 'OL' ? '</ol>' : '</ul>');
          return;
        }
        if (t === 'LI') { out.push('<div>'); walk(n, depth); out.push('</div>'); return; }   // a stray list item
        const f = fmtOf(n);
        const open = [], close = [];
        if (f.b) { open.push('<b>'); close.unshift('</b>'); }
        if (f.i) { open.push('<i>'); close.unshift('</i>'); }
        if (f.u) { open.push('<u>'); close.unshift('</u>'); }
        const cls = [f.c && (f.c !== 'k' || f.own) ? 'rt-c-' + f.c : '', f.z ? 'rt-z-' + f.z : '', f.hl ? hlCls(f.hl) : f.nohl ? 'rt-nohl' : ''].filter(Boolean);   // k / n / nohl: our own "back to normal" inside another span
        if (cls.length) { open.push(`<span class="${cls.join(' ')}">`); close.unshift('</span>'); }
        if (t === 'TABLE' || t === 'TBODY' || t === 'THEAD' || t === 'TFOOT') { walk(n, depth); return; }
        if (BLOCK.has(t)) { const ind = String(n.getAttribute && n.getAttribute('class') || '').match(/rt-ind-([123])/); out.push((ind ? `<div class="rt-ind-${ind[1]}">` : '<div>') + open.join('')); walk(n, depth); out.push(close.join('') + '</div>'); }
        else if (t === 'TD' || t === 'TH') { walk(n, depth); out.push(' '); }
        else { out.push(open.join('')); walk(n, depth); out.push(close.join('')); }
    }
    walk(docu.body, 0);
    let s = out.join('');
    // tidy: empty format tags, a closing <br> inside a block, runs of empty blocks
    for (let i = 0; i < 4; i++) s = s.replace(/<(b|i|u)><\/\1>/g, '').replace(/<span class="[^"]*"><\/span>/g, '');
    s = s.replace(/<br><\/div>/g, '</div>').replace(/(<div><\/div>){3,}/g, '<div><br></div><div><br></div>').replace(/<div><\/div>/g, '<div><br></div>');
    s = s.replace(/^(\s|<br>|<div><br><\/div>)+/, '').replace(/(\s|<br>|<div><br><\/div>)+$/, '');
    return s.length > MAX_HTML ? s.slice(0, MAX_HTML) : s;
  }
  /** true when the (clean) HTML has anything beyond plain text and line breaks */
  function hasFormat(h) { return /<(b|i|u|ol|ul|span)\b|rt-ind-/i.test(String(h || '')); }

  /* ───────── HTML → plain text with the layout (Delivery Note, Invoice, search, wording memory) ───────── */
  function roman(n) { const m = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']]; let s = ''; for (const [v, r] of m) while (n >= v) { s += r; n -= v; } return s; }
  function letter(n) { let s = ''; while (n > 0) { n--; s = String.fromCharCode(97 + (n % 26)) + s; n = Math.floor(n / 26); } return s; }
  function marker(type, n) { return type === 'a' ? letter(n) + '.' : type === 'A' ? letter(n).toUpperCase() + '.' : type === 'i' ? roman(n) + '.' : type === 'I' ? roman(n).toUpperCase() + '.' : n + '.'; }
  const DEF_OL = ['1', 'a', 'i'], DEF_UL = ['•', '◦', '▪'];
  function toText(html) {
    if (!html) return '';
    let docu; try { docu = new DOMParser().parseFromString('<!doctype html><body>' + String(html), 'text/html'); } catch (_) { return String(html).replace(/<[^>]*>/g, ''); }
    const lines = []; let cur = '', pad = '';
    const brk = () => { lines.push(cur); cur = ''; };
    const soft = () => { if (cur.trim() !== '') brk(); };
    function walk(node, depth) {
      for (let n = node.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 3) { const t = n.nodeValue.replace(/\u200B/g, '').replace(/\s+/g, ' '); if (t && cur === '' && pad) cur = pad; cur += t; continue; }
        if (n.nodeType !== 1) continue;
        const t = n.tagName;
        if (t === 'BR') { brk(); continue; }
        if (t === 'OL' || t === 'UL') {
          soft();
          let k = t === 'OL' ? Math.max(1, Number(n.getAttribute('start')) || 1) : 0;
          const type = t === 'OL' ? (n.getAttribute('type') || DEF_OL[Math.min(depth, 2)]) : '';
          for (let c = n.firstChild; c; c = c.nextSibling) {
            if (c.nodeType !== 1 || c.tagName !== 'LI') continue;
            soft();
            cur = '   '.repeat(depth) + (t === 'OL' ? marker(type, k++) : DEF_UL[Math.min(depth, 2)]) + ' ';
            walk(c, depth + 1);
            soft();
          }
          continue;
        }
        if (t === 'DIV' || t === 'P' || t === 'LI') { soft(); const ind = t !== 'LI' && String(n.getAttribute('class') || '').match(/rt-ind-([123])/); const keep = pad; if (ind) pad = '   '.repeat(Number(ind[1])); walk(n, depth); soft(); pad = keep; continue; }
        walk(n, depth);
      }
    }
    walk(docu.body, 0);
    if (cur !== '') lines.push(cur);
    return lines.map(l => l.replace(/[ \t]+$/g, '').replace(/^(\s*)(.*)$/, (m, a, b) => a + b.replace(/ {2,}/g, ' '))).join('\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '');
  }
  function plainToHtml(t) { return escT(String(t == null ? '' : t)).replace(/\r?\n/g, '<br>'); }
  /** what a document shows for a line: the formatting when there is some, else the text with its line breaks */
  function show(html, text) { const h = html ? clean(html) : ''; return h ? `<div class="bc-rtx">${h}</div>` : `<span class="bc-rtp">${plainToHtml(text)}</span>`; }

  /* ───────── the editor ───────── */
  function make(el, { html, text, placeholder } = {}) {
    el.classList.add('bc-rt');
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('role', 'textbox'); el.setAttribute('aria-multiline', 'true');
    el.spellcheck = true;
    if (placeholder) el.dataset.placeholder = placeholder;
    if (!Object.getOwnPropertyDescriptor(el, 'value')) {
      Object.defineProperty(el, 'value', { configurable: true, get() { return toText(this.innerHTML); }, set(v) { this.innerHTML = plainToHtml(v); paintEmpty(this); } });
    }
    el.innerHTML = html ? clean(html) : plainToHtml(text);
    paintEmpty(el);
    return el;
  }
  function paintEmpty(el) { el.classList.toggle('bc-rt-empty', !el.textContent.replace(/\u200B/g, '').trim() && !el.querySelector('li')); }
  /** the line's formatting to store ('' when there is none) */
  function htmlOf(el) { if (!el || !el.isContentEditable) return ''; const c = el.cloneNode(true); flatten(c); const h = clean(c.innerHTML); return hasFormat(h) ? h : ''; }   // V270.4.14.2: tidied (one span per piece of text) before it is stored

  let cur = null;   // the editor the Format bar works on
  const bars = new Set();
  const editorOf = n => n && n.closest ? n.closest('.bc-rt[contenteditable="true"]') : null;
  document.addEventListener('focusin', e => { const ed = editorOf(e.target); if (ed) { cur = ed; paintBars(); } else if (!e.target.closest || !e.target.closest('.bc-rtbar, .bc-rtpop')) { cur = null; paintBars(); } }, true);
  document.addEventListener('focusout', e => { const ed = editorOf(e.target); if (ed && !(e.relatedTarget && ed.contains(e.relatedTarget))) { try { flatten(ed); } catch (_) {} } setTimeout(paintBars, 0); }, true);
  document.addEventListener('selectionchange', () => { if (cur && document.activeElement === cur) paintBars(); });
  document.addEventListener('input', e => { const ed = editorOf(e.target); if (ed) paintEmpty(ed); }, true);
  document.addEventListener('keydown', e => {
    const ed = editorOf(e.target); if (!ed) return;
    if (e.key === 'Tab' && !e.ctrlKey && !e.altKey && !e.metaKey) {
      // V270.4.14.2: Tab / Shift+Tab indent inside a list or at the start of a line (or over several lines);
      // elsewhere Tab moves on to the next field as before
      if (cur !== ed) cur = ed;
      if (e.shiftKey ? canOutdent() : canIndent()) { e.preventDefault(); e.stopPropagation(); indent(e.shiftKey ? -1 : 1); }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && /^[biu]$/i.test(e.key)) { e.preventDefault(); e.stopPropagation(); cmd({ b: 'bold', i: 'italic', u: 'underline' }[e.key.toLowerCase()]); }
  }, true);
  document.addEventListener('paste', e => {
    const ed = editorOf(e.target); if (!ed) return;
    const cd = e.clipboardData; if (!cd) return;
    e.preventDefault();
    const h = cd.getData('text/html'), t = cd.getData('text/plain');
    const ins = h ? clean(h) : plainToHtml(t);
    try { document.execCommand('insertHTML', false, ins || ''); } catch (_) {}
    flatten(ed);
    ed.dispatchEvent(new Event('input', { bubbles: true }));
  }, true);
  document.addEventListener('drop', e => { if (editorOf(e.target)) e.preventDefault(); }, true);   // no pictures / files dropped into a line

  /* ───────── V270.4.14.2: our own engine for colour, size, highlight and indent ─────────
     The browser's own colour / size commands nest <font> tags and can't undo a colour given by a class (red → black
     failed), and its indent adds an inline style that our cleaning removes. So: every piece of text gets exactly ONE
     <span> with its colour / size / highlight (the newest choice wins), bold / italic / underline stay <b> <i> <u>
     (browser commands), lists use nested <ol>/<ul>, a line's indent is a class on its line (rt-ind-1…3). */
  const ZW = '​';
  function sel() { const s = window.getSelection(); return s && s.rangeCount && cur && cur.contains(s.getRangeAt(0).commonAncestorContainer) ? s.getRangeAt(0) : null; }
  function textNodes(root) { const out = [], w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) out.push(n); return out; }
  /** the selection as character positions in the editor (survives moving nodes) */
  function saveSel(ed) {
    const r = sel(); if (!r) return null;
    const pos = (node, off) => { let n = 0; for (const t of textNodes(ed)) { if (t === node) return n + off; n += t.length; } // element boundary
      const pre = document.createRange(); pre.selectNodeContents(ed); try { pre.setEnd(node, off); } catch (_) { return n; } return pre.toString().length; };
    return { s: pos(r.startContainer, r.startOffset), e: pos(r.endContainer, r.endOffset) };
  }
  function restoreSel(ed, p) {
    if (!p) return;
    // a position between two text nodes: the start goes to the next node, the end stays in the previous one
    const at = (x, start) => { let n = 0; const ts = textNodes(ed); for (let i = 0; i < ts.length; i++) { const t = ts[i]; if (x < n + t.length || (x === n + t.length && !(start && ts[i + 1]))) return [t, x - n]; n += t.length; } const l = ts[ts.length - 1]; return l ? [l, l.length] : [ed, ed.childNodes.length]; };
    const r = document.createRange(); const [sn, so] = at(p.s, true), [en, eo] = p.e === p.s ? [sn, so] : at(p.e, false);
    try { r.setStart(sn, so); r.setEnd(en, eo); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); } catch (_) {}
  }
  const GROUP_RE = { c: /^rt-c-(\w+)$/, z: /^rt-z-(\w+)$/ };
  /** colour / size / highlight of a text node: the nearest span inside the editor decides */
  function effOf(node, ed) {
    const v = { c: '', z: '', hl: null };
    for (let n = node.parentNode; n && n !== ed; n = n.parentNode) {
      if (n.nodeType !== 1 || n.tagName !== 'SPAN') continue;
      [...n.classList].forEach(c => { let m; if (!v.c && (m = c.match(GROUP_RE.c))) v.c = m[1]; else if (!v.z && (m = c.match(GROUP_RE.z))) v.z = m[1]; else if (v.hl === null && (hlOfCls(c) || c === 'rt-nohl')) v.hl = hlOfCls(c) || false; });
    }
    return v;
  }
  // V271.7.3: an editor with its own default colour (a quotation heading: navy) keeps Black as a real choice ('d' = back to its default)
  const clsOf = (v, kk) => [v.c && v.c !== 'd' && (v.c !== 'k' || kk) ? 'rt-c-' + v.c : '', v.z && v.z !== 'n' ? 'rt-z-' + v.z : '', v.hl ? hlCls(v.hl) : ''].filter(Boolean).join(' ');
  const keepK = ed => !!(ed && ed.dataset && ed.dataset.rtKeepK === '1');
  /** one span per piece of text, no nesting; empty / default spans gone; neighbours with the same look merged */
  function flatten(ed) {
    const p = document.activeElement === ed ? saveSel(ed) : null;
    const kk = keepK(ed);
    ed.querySelectorAll('font').forEach(f => { const fm = fmtOf(f), sp = document.createElement('span'); sp.className = [fm.c && (fm.c !== 'k' || kk) ? 'rt-c-' + fm.c : '', fm.z ? 'rt-z-' + fm.z : ''].filter(Boolean).join(' '); while (f.firstChild) sp.appendChild(f.firstChild); f.replaceWith(sp); });
    ed.querySelectorAll('span[style]').forEach(sp => { const fm = fmtOf(sp); if (fm.hl) sp.classList.add(hlCls(fm.hl)); if (fm.c && (fm.c !== 'k' || kk)) sp.classList.add('rt-c-' + fm.c); if (fm.z) sp.classList.add('rt-z-' + fm.z); sp.removeAttribute('style'); });
    ed.querySelectorAll('[style]').forEach(x => x.removeAttribute('style'));
    const looks = textNodes(ed).map(t => [t, clsOf(effOf(t, ed), kk)]);
    [...ed.querySelectorAll('span')].forEach(sp => sp.replaceWith(...sp.childNodes));
    looks.forEach(([t, c]) => { if (!c || !ed.contains(t)) return; const sp = document.createElement('span'); sp.className = c; t.replaceWith(sp); sp.appendChild(t); });
    ed.querySelectorAll('span').forEach(sp => { let nx = sp.nextSibling; while (nx && nx.nodeType === 1 && nx.tagName === 'SPAN' && nx.className === sp.className) { while (nx.firstChild) sp.appendChild(nx.firstChild); const d = nx; nx = nx.nextSibling; d.remove(); } });
    ed.normalize();
    if (p) restoreSel(ed, p);
  }
  /** give the selected text a colour / size / highlight (v: 'k' black, 'n' normal size, false = no highlight) */
  function applyInline(group, v) {
    if (!cur) return;
    if (document.activeElement !== cur) cur.focus();
    const r = sel(); if (!r) return;
    const look = { c: group === 'c' ? v : '', z: group === 'z' ? v : '', hl: group === 'hl' ? (v || false) : null };
    const cls = [look.c ? 'rt-c-' + look.c : '', look.z ? 'rt-z-' + look.z : '', look.hl === null ? '' : look.hl ? hlCls(look.hl) : 'rt-nohl'].filter(Boolean).join(' ');
    if (r.collapsed) {   // no words selected: what is typed next gets the look
      const sp = document.createElement('span'); sp.className = cls; sp.textContent = ZW;
      r.insertNode(sp); const nr = document.createRange(); nr.setStart(sp.firstChild, 1); nr.collapse(true);
      const s = window.getSelection(); s.removeAllRanges(); s.addRange(nr);
      done(); return;
    }
    const p = saveSel(cur);
    let sc = r.startContainer, so = r.startOffset, ec = r.endContainer, eo = r.endOffset;
    if (ec.nodeType === 3 && eo > 0 && eo < ec.length) ec.splitText(eo);
    if (ec.nodeType === 3) eo = eo === 0 ? 0 : ec.length;
    if (sc.nodeType === 3 && so > 0 && so < sc.length) { const nn = sc.splitText(so); if (ec === sc) { ec = nn; eo = nn.length; } sc = nn; so = 0; }
    const range = document.createRange();
    try { range.setStart(sc, so); range.setEnd(ec, eo); } catch (_) { return; }
    textNodes(cur).filter(t => t.length && range.intersectsNode(t) && !(t === ec && eo === 0) && !(t === sc && so >= t.length))
      .forEach(t => { const sp = document.createElement('span'); sp.className = cls; t.replaceWith(sp); sp.appendChild(t); });
    flatten(cur); restoreSel(cur, p); done();
  }
  function done() { cur.dispatchEvent(new Event('input', { bubbles: true })); paintBars(); }

  /* indent: list items nest / come out; other lines get rt-ind-1…3 on their line */
  function liOf(n) { for (; n && n !== cur; n = n.parentNode) if (n.nodeType === 1 && n.tagName === 'LI') return n; return null; }
  function depth(li) { let d = 0; for (let n = li; n && n !== cur; n = n.parentNode) if (n.nodeType === 1 && (n.tagName === 'OL' || n.tagName === 'UL')) d++; return d; }
  function selectedLis(r) {
    if (r.collapsed) { const li = liOf(r.startContainer); return li ? [li] : []; }
    return [...cur.querySelectorAll('li')].filter(li => r.intersectsNode(li) && hasOwnSel(li, r));
  }
  function hasOwnSel(li, r) { return [...li.childNodes].some(c => !(c.nodeType === 1 && (c.tagName === 'OL' || c.tagName === 'UL')) && r.intersectsNode(c)); }
  /** the line (block) a node is on: its nearest <div>/<p> inside the editor (a loose line is wrapped in a <div> first) */
  function blockOf(node) { for (let n = node; n && n !== cur; n = n.parentNode) if (n.nodeType === 1 && /^(DIV|P)$/.test(n.tagName)) return n; return null; }
  function lineOf(node) {
    if (liOf(node)) return null;
    const bl = blockOf(node); if (bl) return bl;
    let n = node; while (n && n.parentNode !== cur) n = n.parentNode; if (!n) return null;
    const isStop = x => x.nodeType === 1 && /^(DIV|P|OL|UL)$/.test(x.tagName);
    const isBr = x => x && x.nodeType === 1 && x.tagName === 'BR';
    if (isBr(n) && n.previousSibling && !isStop(n.previousSibling)) n = n.previousSibling;
    let a = n; while (a.previousSibling && !isStop(a.previousSibling) && !isBr(a.previousSibling)) a = a.previousSibling;
    let z = n; while (!isBr(z) && z.nextSibling && !isStop(z.nextSibling)) z = z.nextSibling;
    const div = document.createElement('div'); cur.insertBefore(div, a);
    let x = a; while (x) { const nx = x.nextSibling, last = x === z; if (isBr(x) && last) { x.remove(); break; } div.appendChild(x); if (last) break; x = nx; }
    if (!div.childNodes.length) div.appendChild(document.createElement('br'));
    return div;
  }
  function selectedLines(r) {
    if (r.collapsed) { const l = lineOf(r.startContainer); return l ? [l] : []; }
    const leaf = [...cur.querySelectorAll('div, p')].filter(d => r.intersectsNode(d) && !d.querySelector('div, p, ol, ul'));
    const first = lineOf(r.startContainer); if (first && !leaf.includes(first)) leaf.unshift(first);
    return leaf;
  }
  const indOf = el => { const m = (el.className || '').match(/rt-ind-([123])/); return m ? Number(m[1]) : 0; };
  const setInd = (el, n) => { el.classList.remove('rt-ind-1', 'rt-ind-2', 'rt-ind-3'); if (n > 0) el.classList.add('rt-ind-' + Math.min(3, n)); if (!el.className) el.removeAttribute('class'); };
  function atLineStart(r) {
    if (!r.collapsed) return false;
    const block = liOf(r.startContainer) || blockOf(r.startContainer);
    const pre = document.createRange();
    if (block) pre.setStart(block, 0);
    else {   // loose line: from the previous <br> / block
      let n = r.startContainer; while (n && n.parentNode !== cur) n = n.parentNode; if (!n) return false;
      let a = n; while (a.previousSibling && !(a.previousSibling.nodeType === 1 && /^(BR|DIV|P|OL|UL)$/.test(a.previousSibling.tagName))) a = a.previousSibling;
      pre.setStartBefore(a);
    }
    pre.setEnd(r.startContainer, r.startOffset);
    // inside a <li>, the text of its sub-list is not "before" the caret's line
    return pre.toString().replace(new RegExp(ZW, 'g'), '').trim() === '';
  }
  function canIndent() { const r = sel(); if (!r) return false; return !!liOf(r.startContainer) || !r.collapsed && /\n/.test(r.toString()) || atLineStart(r); }
  function canOutdent() { const r = sel(); if (!r) return false; if (liOf(r.startContainer)) return true; return selectedLines(r).some(l => indOf(l) > 0); }
  function indent(dir) {
    if (!cur) return;
    if (document.activeElement !== cur) cur.focus();
    const r = sel(); if (!r) return;
    const keep = [r.startContainer, r.startOffset, r.endContainer, r.endOffset];
    const lis = selectedLis(r);
    if (lis.length) {
      if (dir > 0) lis.forEach(li => { const prev = li.previousElementSibling; if (!prev || depth(li) >= 3) return; const list = li.parentNode; let sub = prev.lastElementChild; if (!sub || !/^(OL|UL)$/.test(sub.tagName)) { sub = document.createElement(list.tagName); prev.appendChild(sub); } sub.appendChild(li); const kids = li.querySelector(':scope > ol, :scope > ul'); if (kids) { while (kids.firstChild) sub.appendChild(kids.firstChild); kids.remove(); } });
      else [...lis].reverse().forEach(li => {
        const list = li.parentNode, parentLi = list.parentNode && list.parentNode.nodeType === 1 && list.parentNode.tagName === 'LI' ? list.parentNode : null;
        const after = []; for (let n = li.nextElementSibling; n; n = n.nextElementSibling) after.push(n);
        if (parentLi) {
          parentLi.parentNode.insertBefore(li, parentLi.nextSibling);
          if (after.length) { const sub = document.createElement(list.tagName); if (list.getAttribute('type')) sub.setAttribute('type', list.getAttribute('type')); after.forEach(x => sub.appendChild(x)); li.appendChild(sub); }
        } else {   // top level: the line leaves the list
          const div = document.createElement('div'); [...li.childNodes].forEach(c => { if (c.nodeType === 1 && /^(OL|UL)$/.test(c.tagName)) after.unshift(...c.children); else div.appendChild(c); });
          if (!div.childNodes.length) div.appendChild(document.createElement('br'));
          list.parentNode.insertBefore(div, list.nextSibling);
          if (after.length) { const rest = list.cloneNode(false); if (list.tagName === 'OL') rest.setAttribute('start', String((Number(list.getAttribute('start')) || 1) + [...list.children].indexOf(li) + 1)); after.forEach(x => rest.appendChild(x)); div.parentNode.insertBefore(rest, div.nextSibling); }
          li.remove();
        }
        if (!list.children.length) list.remove();
      });
    } else selectedLines(r).forEach(l => setInd(l, indOf(l) + dir));
    try { const nr = document.createRange(); nr.setStart(keep[0], keep[1]); nr.setEnd(keep[2], keep[3]); const s = window.getSelection(); s.removeAllRanges(); s.addRange(nr); } catch (_) {}
    done();
  }

  function inList() { const s = window.getSelection(); let n = s && s.anchorNode; while (n && n !== cur) { if (n.nodeType === 1 && n.tagName === 'LI') return true; n = n.parentNode; } return false; }
  function curList() { const s = window.getSelection(); let n = s && s.anchorNode; while (n && n !== cur) { if (n.nodeType === 1 && (n.tagName === 'OL' || n.tagName === 'UL')) return n; n = n.parentNode; } return null; }
  function cmd(name, val) {
    if (!cur) return;
    if (document.activeElement !== cur) cur.focus();
    try { document.execCommand('styleWithCSS', false, false); } catch (_) {}
    try { document.execCommand(name, false, val); } catch (_) {}
    done();   // no tidying here: it would lose the browser's "typing in bold" state (tidied on leaving the line)
  }
  function setColor(k) { applyInline('c', k || 'k'); }
  function setSize(z) { applyInline('z', z || 'n'); }
  function setHighlight(k) { if (!cur) return; applyInline('hl', k || false); }
  function olType(ty) {
    if (!cur) return;
    cur.focus();
    let l = curList();
    if (!l || l.tagName !== 'OL') { cmd('insertOrderedList'); l = curList(); }
    if (l && l.tagName === 'OL') { if (ty === '1' && !l.parentNode.closest('ol,ul')) l.removeAttribute('type'); else l.setAttribute('type', ty); }
    done();
  }
  function clearFmt() {
    if (!cur) return;
    if (document.activeElement !== cur) cur.focus();
    const r = sel(); if (!r) return;
    const dk = keepK(cur) ? 'd' : 'k';   // V271.7.3: a heading goes back to its own default colour
    if (r.collapsed) { applyInline('c', dk); return; }
    try { document.execCommand('styleWithCSS', false, false); document.execCommand('removeFormat'); } catch (_) {}
    const p = saveSel(cur); restoreSel(cur, p);
    applyInline('c', dk); restoreSel(cur, p); applyInline('z', 'n'); restoreSel(cur, p); applyInline('hl', false);
  }
  function stateOf() {
    const st = { b: false, i: false, u: false, c: '', z: '', hl: false, ul: false, ol: false };
    if (!cur) return st;
    try { st.b = document.queryCommandState('bold'); st.i = document.queryCommandState('italic'); st.u = document.queryCommandState('underline'); } catch (_) {}
    const s = window.getSelection(); let a = s && s.anchorNode; if (!a || !cur.contains(a)) return st;
    const t = a.nodeType === 3 ? a : (a.childNodes[Math.max(0, (s.anchorOffset || 0) - 1)] || a);
    const v = effOf(t.nodeType === 3 ? t : (textNodes(t)[0] || t), cur); st.c = (v.c === 'k' && !keepK(cur)) || v.c === 'd' ? '' : v.c; st.z = v.z === 'n' ? '' : v.z; st.hl = v.hl || false;
    for (let n = a; n && n !== cur; n = n.parentNode) { if (n.nodeType === 1 && n.tagName === 'UL' && !st.ol) st.ul = true; if (n.nodeType === 1 && n.tagName === 'OL' && !st.ul) st.ol = true; }
    return st;
  }


  /* ───────── the Format bar (one per screen; buttons keep the caret in the line) ───────── */
  const svgA = c => `<span class="rtb-a" style="--rtc:${c}">A</span>`;
  function barHtml() {
    return `<span class="rtb-lbl">Format</span>
      <button type="button" class="rtb" data-rt="bold" title="Bold (Ctrl+B)" aria-label="Bold"><b>B</b></button><button type="button" class="rtb" data-rt="italic" title="Italic (Ctrl+I)" aria-label="Italic"><i>I</i></button><button type="button" class="rtb" data-rt="underline" title="Underline (Ctrl+U)" aria-label="Underline"><u>U</u></button><i class="rtb-sep"></i>
      <button type="button" class="rtb rtb-dd" data-rt="size" title="Text size" aria-label="Text size">Size ▾</button><button type="button" class="rtb rtb-dd" data-rt="color" title="Text colour" aria-label="Text colour">${svgA('#0f172a')} ▾</button><button type="button" class="rtb rtb-dd" data-rt="hl" title="Highlight" aria-label="Highlight"><span class="rtb-hl">ab</span> ▾</button><i class="rtb-sep"></i>
      <button type="button" class="rtb" data-rt="ul" title="Bullet list" aria-label="Bullet list">• List</button><button type="button" class="rtb rtb-dd" data-rt="ol" title="Numbered list" aria-label="Numbered list">1. List ▾</button><button type="button" class="rtb" data-rt="outdent" title="Outdent (Shift+Tab)" aria-label="Outdent">⇤</button><button type="button" class="rtb" data-rt="indent" title="Indent (Tab)" aria-label="Indent">⇥</button><i class="rtb-sep"></i>
      <button type="button" class="rtb" data-rt="clear" title="Clear formatting" aria-label="Clear formatting">T̸</button><span class="rtb-off">Click in a description or note to format</span>`;
  }
  let pop = null;
  function closePop() { if (pop) { pop.remove(); pop = null; } }
  function openPop(btn, html, onPick) {
    closePop();
    pop = document.createElement('div'); pop.className = 'bc-rtpop'; pop.innerHTML = html;
    document.body.appendChild(pop);
    const r = btn.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    pop.style.left = Math.max(6, Math.min(r.left, window.innerWidth - w - 6)) + 'px';
    pop.style.top = (r.bottom + h + 6 < window.innerHeight ? r.bottom + 3 : Math.max(6, r.top - h - 3)) + 'px';
    pop.addEventListener('mousedown', e => e.preventDefault());
    pop.addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; closePop(); onPick(b.dataset.v); });
  }
  document.addEventListener('mousedown', e => { if (pop && !pop.contains(e.target) && !e.target.closest('.rtb-dd')) closePop(); }, true);
  window.addEventListener('scroll', () => closePop(), true);
  function wireBar(bar) {
    bar.classList.add('bc-rtbar'); bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'Format');
    bar.innerHTML = barHtml();
    bar.addEventListener('mousedown', e => { if (e.target.closest('.rtb')) e.preventDefault(); });   // keep the caret in the line
    bar.addEventListener('click', e => {
      const b = e.target.closest('.rtb'); if (!b || !cur) return;
      const a = b.dataset.rt;
      if (a === 'bold' || a === 'italic' || a === 'underline') cmd(a);
      else if (a === 'indent' || a === 'outdent') indent(a === 'indent' ? 1 : -1);
      else if (a === 'ul') cmd('insertUnorderedList');
      else if (a === 'hl') { if (pop) { closePop(); return; } const s = stateOf(); openPop(b, `<div class="rtp-sw">${HLS.map(([k, hex, l]) => `<button type="button" data-v="${k}" title="${l}" aria-label="${l}" class="${s.hl === k ? 'on' : ''}" style="background:${hex}"></button>`).join('')}</div><button type="button" data-v="none" class="rtp-none">No highlight</button>`, v => setHighlight(v === 'none' ? false : v)); }
      else if (a === 'clear') clearFmt();
      else if (a === 'size') { if (pop) { closePop(); return; } const s = stateOf(); openPop(b, SIZES.map(([k, l]) => `<button type="button" data-v="${k || 'n'}" class="${s.z === k ? 'on' : ''}"><span class="rt-z-${k || 'n'}">${l}</span></button>`).join(''), v => setSize(v === 'n' ? '' : v)); }
      else if (a === 'color') { if (pop) { closePop(); return; } const kk = keepK(cur), s = stateOf(); openPop(b, `<div class="rtp-sw">${COLORS.map(([k, hex, l]) => `<button type="button" data-v="${k}" title="${l}${kk && k === 'n' ? ' (heading default)' : ''}" aria-label="${l}" class="${(s.c || (kk ? '' : 'k')) === k ? 'on' : ''}" style="background:${hex}"></button>`).join('')}</div>${kk ? '<button type="button" data-v="d" class="rtp-none">Default (navy)</button>' : ''}`, v => setColor(v === 'k' && !kk ? '' : v)); }
      else if (a === 'ol') { if (pop) { closePop(); return; } openPop(b, OL_TYPES.map(([k, l]) => `<button type="button" data-v="${k}">${l}</button>`).join(''), v => olType(v)); }
    });
    bars.add(bar); paintBar(bar);
    return bar;
  }
  function paintBar(bar) {
    const on = !!(cur && cur.isConnected && document.activeElement === cur);
    bar.classList.toggle('rtb-disabled', !on);
    bar.querySelectorAll('.rtb').forEach(b => { b.disabled = !on; });
    if (!on) { bar.querySelectorAll('.rtb.on').forEach(b => b.classList.remove('on')); return; }
    const s = stateOf();
    const set = (a, v) => { const b = bar.querySelector(`[data-rt="${a}"]`); if (b) b.classList.toggle('on', !!v); };
    set('bold', s.b); set('italic', s.i); set('underline', s.u); set('hl', s.hl); set('ul', s.ul); set('ol', s.ol);
    const a = bar.querySelector('[data-rt="color"] .rtb-a'); if (a) a.style.setProperty('--rtc', s.c && COLORS.find(c => c[0] === s.c) ? COLORS.find(c => c[0] === s.c)[1] : '#0f172a');
  }
  function paintBars() { bars.forEach(b => { if (!b.isConnected) { bars.delete(b); return; } paintBar(b); }); }

  /** Print windows: the classes the formatting uses (the quotation prints force black / normal weight on the lines). */
  const PRINT_CSS = '.bc-rtx{line-height:1.45}.bc-rtx div{min-height:1em}.bc-rtx ol,.bc-rtx ul{margin:2px 0 2px 0!important;padding-left:20px!important}.bc-rtx li{margin:1px 0}.bc-rtx ol ol{list-style-type:lower-alpha}.bc-rtx ol ol ol{list-style-type:lower-roman}.bc-rtx ul ul{list-style-type:circle}.bc-rtx ul ul ul{list-style-type:square}'
    + '.bc-rtx b,.bc-rtx strong,td .bc-rtx b{font-weight:700!important}.bc-rtx i{font-style:italic}.bc-rtx u{text-decoration:underline}'
    + COLORS.map(([k, hex]) => `.bc-rtx .rt-c-${k},td .bc-rtx .rt-c-${k},td .bc-rtx .rt-c-${k} *{color:${hex}!important}`).join('')
    + HLS.map(([k, hex]) => `.bc-rtx .${hlCls(k)}{background:${hex}!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}`).join('')
    + '.bc-rtx .rt-ind-1{margin-left:2em}.bc-rtx .rt-ind-2{margin-left:4em}.bc-rtx .rt-ind-3{margin-left:6em}.bc-rtx .rt-z-sm{font-size:.85em}.bc-rtx .rt-z-lg{font-size:1.18em}.bc-rtx .rt-z-h{font-size:1.38em}.bc-rtx .rt-hl{background:#fef08a!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.bc-rtp{white-space:pre-line}';

  // the quotation screen's Format bar (index.html #qt-rtbar)
  const wireMain = () => { const b = document.getElementById('qt-rtbar'); if (b && !b.classList.contains('bc-rtbar')) wireBar(b); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireMain); else wireMain();

  window.BCRich = { clean, toText, hasFormat, plainToHtml, show, make, htmlOf, wireBar, paintBars, PRINT_CSS, COLORS, SIZES, HLS };
})();
