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
  const COLORS = [['k', '#0f172a', 'Black'], ['n', '#1F4E79', 'Navy'], ['r', '#b91c1c', 'Red'], ['g', '#15803d', 'Green'], ['s', '#64748b', 'Grey']];
  const SIZES = [['sm', 'Small'], ['', 'Normal'], ['lg', 'Large'], ['h', 'Heading']];
  const HL = '#fef08a';
  const OL_TYPES = [['1', '1. 2. 3.'], ['a', 'a. b. c.'], ['A', 'A. B. C.'], ['i', 'i. ii. iii.'], ['I', 'I. II. III.']];
  const MAX_HTML = 20000;
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
      const bg = t === 'MARK' ? HL : (st.backgroundColor || st.background); if (bg && isHighlight(bg)) f.hl = true;
    }
    if (t === 'FONT' && el.getAttribute('size')) { const s = Number(el.getAttribute('size')); f.z = s <= 2 ? 'sm' : s === 3 ? '' : s === 4 ? 'lg' : 'h'; }
    else if (st.fontSize) f.z = sizeKeyCss(st.fontSize);
    if (/^H[1-3]$/.test(t)) f.z = 'h'; else if (/^H[4-6]$/.test(t)) f.z = 'lg';
    // our own classes (stored HTML)
    (el.classList ? [...el.classList] : []).forEach(c => { let m; if ((m = c.match(/^rt-c-([nrgs])$/))) f.c = m[1]; else if ((m = c.match(/^rt-z-(sm|lg|h)$/))) f.z = m[1]; else if (c === 'rt-hl') f.hl = true; });
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
        if (n.nodeType === 3) { const t = n.nodeValue.replace(/[\r\n]+/g, ' '); if (t) out.push(escT(t)); return; }
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
        const cls = [f.c && f.c !== 'k' ? 'rt-c-' + f.c : '', f.z ? 'rt-z-' + f.z : '', f.hl ? 'rt-hl' : ''].filter(Boolean);
        if (cls.length) { open.push(`<span class="${cls.join(' ')}">`); close.unshift('</span>'); }
        if (t === 'TABLE' || t === 'TBODY' || t === 'THEAD' || t === 'TFOOT') { walk(n, depth); return; }
        if (BLOCK.has(t)) { out.push('<div>' + open.join('')); walk(n, depth); out.push(close.join('') + '</div>'); }
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
  function hasFormat(h) { return /<(b|i|u|ol|ul|span)\b/i.test(String(h || '')); }

  /* ───────── HTML → plain text with the layout (Delivery Note, Invoice, search, wording memory) ───────── */
  function roman(n) { const m = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']]; let s = ''; for (const [v, r] of m) while (n >= v) { s += r; n -= v; } return s; }
  function letter(n) { let s = ''; while (n > 0) { n--; s = String.fromCharCode(97 + (n % 26)) + s; n = Math.floor(n / 26); } return s; }
  function marker(type, n) { return type === 'a' ? letter(n) + '.' : type === 'A' ? letter(n).toUpperCase() + '.' : type === 'i' ? roman(n) + '.' : type === 'I' ? roman(n).toUpperCase() + '.' : n + '.'; }
  const DEF_OL = ['1', 'a', 'i'], DEF_UL = ['•', '◦', '▪'];
  function toText(html) {
    if (!html) return '';
    let docu; try { docu = new DOMParser().parseFromString('<!doctype html><body>' + String(html), 'text/html'); } catch (_) { return String(html).replace(/<[^>]*>/g, ''); }
    const lines = []; let cur = '';
    const brk = () => { lines.push(cur); cur = ''; };
    const soft = () => { if (cur.trim() !== '') brk(); };
    function walk(node, depth) {
      for (let n = node.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 3) { cur += n.nodeValue.replace(/\s+/g, ' '); continue; }
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
        if (t === 'DIV' || t === 'P' || t === 'LI') { soft(); walk(n, depth); soft(); continue; }
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
  function paintEmpty(el) { el.classList.toggle('bc-rt-empty', !el.textContent.trim() && !el.querySelector('li')); }
  /** the line's formatting to store ('' when there is none) */
  function htmlOf(el) { if (!el || !el.isContentEditable) return ''; const h = clean(el.innerHTML); return hasFormat(h) ? h : ''; }

  let cur = null;   // the editor the Format bar works on
  const bars = new Set();
  const editorOf = n => n && n.closest ? n.closest('.bc-rt[contenteditable="true"]') : null;
  document.addEventListener('focusin', e => { const ed = editorOf(e.target); if (ed) { cur = ed; paintBars(); } else if (!e.target.closest || !e.target.closest('.bc-rtbar, .bc-rtpop')) { cur = null; paintBars(); } }, true);
  document.addEventListener('focusout', () => setTimeout(paintBars, 0), true);
  document.addEventListener('selectionchange', () => { if (cur && document.activeElement === cur) paintBars(); });
  document.addEventListener('input', e => { const ed = editorOf(e.target); if (ed) paintEmpty(ed); }, true);
  document.addEventListener('keydown', e => {
    const ed = editorOf(e.target); if (!ed) return;
    if (e.key === 'Tab' && !e.ctrlKey && !e.altKey) {
      if (inList()) { e.preventDefault(); e.stopPropagation(); cmd(e.shiftKey ? 'outdent' : 'indent'); }
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
    ed.dispatchEvent(new Event('input', { bubbles: true }));
  }, true);
  document.addEventListener('drop', e => { if (editorOf(e.target)) e.preventDefault(); }, true);   // no pictures / files dropped into a line

  function inList() { const s = window.getSelection(); let n = s && s.anchorNode; while (n && n !== cur) { if (n.nodeType === 1 && n.tagName === 'LI') return true; n = n.parentNode; } return false; }
  function curList() { const s = window.getSelection(); let n = s && s.anchorNode; while (n && n !== cur) { if (n.nodeType === 1 && (n.tagName === 'OL' || n.tagName === 'UL')) return n; n = n.parentNode; } return null; }
  function cmd(name, val) {
    if (!cur) return;
    if (document.activeElement !== cur) cur.focus();
    try { document.execCommand('styleWithCSS', false, false); } catch (_) {}
    try { document.execCommand(name, false, val); } catch (_) {}
    normalize(cur);
    cur.dispatchEvent(new Event('input', { bubbles: true }));
    paintBars();
  }
  /** after a command: <font> / inline styles the browser made → our classes (keeps the caret) */
  function normalize(ed) {
    ed.querySelectorAll('font').forEach(f => {
      const sp = document.createElement('span'), fm = fmtOf(f), cls = [];
      if (fm.c && fm.c !== 'k') cls.push('rt-c-' + fm.c);
      if (fm.z) cls.push('rt-z-' + fm.z);
      if (cls.length) sp.className = cls.join(' ');
      while (f.firstChild) sp.appendChild(f.firstChild);
      f.replaceWith(sp);
    });
    ed.querySelectorAll('span[style]').forEach(sp => {
      const fm = fmtOf(sp);
      if (fm.hl) sp.classList.add('rt-hl');
      if (fm.c && fm.c !== 'k') sp.classList.add('rt-c-' + fm.c);
      if (fm.z) sp.classList.add('rt-z-' + fm.z);
      sp.removeAttribute('style');
    });
    ed.querySelectorAll('[style]').forEach(x => x.removeAttribute('style'));
    ed.querySelectorAll('span:not([class])').forEach(sp => { if (!sp.attributes.length) sp.replaceWith(...sp.childNodes); });
  }
  function setColor(k) {
    if (!cur) return;
    cur.focus();
    const hex = k ? COLORS.find(c => c[0] === k)[1] : '#0f172a';
    cmd('foreColor', hex);
    // black = no colour class at all
    if (!k) cur.querySelectorAll('.rt-c-k').forEach(x => x.classList.remove('rt-c-k'));
  }
  function setSize(z) {
    if (!cur) return;
    cur.focus();
    cmd('fontSize', z === 'sm' ? '2' : z === 'lg' ? '4' : z === 'h' ? '5' : '3');
    if (!z) cur.querySelectorAll('.rt-z-sm, .rt-z-lg, .rt-z-h').forEach(x => { if (selContains(x)) x.classList.remove('rt-z-sm', 'rt-z-lg', 'rt-z-h'); });
  }
  function selContains(n) { const s = window.getSelection(); try { return s && s.rangeCount && s.getRangeAt(0).intersectsNode(n); } catch (_) { return false; } }
  function toggleHighlight() {
    if (!cur) return;
    cur.focus();
    const on = stateOf().hl;
    if (on) { cur.querySelectorAll('.rt-hl').forEach(x => { if (selContains(x)) x.classList.remove('rt-hl'); }); cur.dispatchEvent(new Event('input', { bubbles: true })); paintBars(); return; }
    try { document.execCommand('styleWithCSS', false, true); document.execCommand('hiliteColor', false, HL); } catch (_) {}
    try { document.execCommand('styleWithCSS', false, false); } catch (_) {}
    normalize(cur); cur.dispatchEvent(new Event('input', { bubbles: true })); paintBars();
  }
  function olType(ty) {
    if (!cur) return;
    cur.focus();
    let l = curList();
    if (!l || l.tagName !== 'OL') { cmd('insertOrderedList'); l = curList(); }
    if (l && l.tagName === 'OL') { if (ty === '1' && !l.parentNode.closest('ol,ul')) l.removeAttribute('type'); else l.setAttribute('type', ty); }
    cur.dispatchEvent(new Event('input', { bubbles: true })); paintBars();
  }
  function clearFmt() {
    if (!cur) return;
    cmd('removeFormat');
    cur.querySelectorAll('span[class]').forEach(sp => { if (selContains(sp)) sp.replaceWith(...sp.childNodes); });
    cur.dispatchEvent(new Event('input', { bubbles: true })); paintBars();
  }
  function stateOf() {
    const st = { b: false, i: false, u: false, c: '', z: '', hl: false, ul: false, ol: false };
    if (!cur) return st;
    try { st.b = document.queryCommandState('bold'); st.i = document.queryCommandState('italic'); st.u = document.queryCommandState('underline'); } catch (_) {}
    const s = window.getSelection(); let n = s && s.anchorNode;
    while (n && n !== cur) { if (n.nodeType === 1) { const cl = n.classList; if (cl) { [...cl].forEach(c => { let m; if (!st.c && (m = c.match(/^rt-c-(\w)$/))) st.c = m[1]; if (!st.z && (m = c.match(/^rt-z-(\w+)$/))) st.z = m[1]; if (c === 'rt-hl') st.hl = true; }); } if (n.tagName === 'UL' && !st.ol) st.ul = true; if (n.tagName === 'OL' && !st.ul) st.ol = true; } n = n.parentNode; }
    return st;
  }

  /* ───────── the Format bar (one per screen; buttons keep the caret in the line) ───────── */
  const svgA = c => `<span class="rtb-a" style="--rtc:${c}">A</span>`;
  function barHtml() {
    return `<span class="rtb-lbl">Format</span>
      <button type="button" class="rtb" data-rt="bold" title="Bold (Ctrl+B)" aria-label="Bold"><b>B</b></button><button type="button" class="rtb" data-rt="italic" title="Italic (Ctrl+I)" aria-label="Italic"><i>I</i></button><button type="button" class="rtb" data-rt="underline" title="Underline (Ctrl+U)" aria-label="Underline"><u>U</u></button><i class="rtb-sep"></i>
      <button type="button" class="rtb rtb-dd" data-rt="size" title="Text size" aria-label="Text size">Size ▾</button><button type="button" class="rtb rtb-dd" data-rt="color" title="Text colour" aria-label="Text colour">${svgA('#0f172a')} ▾</button><button type="button" class="rtb" data-rt="hl" title="Highlight" aria-label="Highlight"><span class="rtb-hl">ab</span></button><i class="rtb-sep"></i>
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
      if (a === 'bold' || a === 'italic' || a === 'underline' || a === 'indent' || a === 'outdent') cmd(a);
      else if (a === 'ul') cmd('insertUnorderedList');
      else if (a === 'hl') toggleHighlight();
      else if (a === 'clear') clearFmt();
      else if (a === 'size') { if (pop) { closePop(); return; } const s = stateOf(); openPop(b, SIZES.map(([k, l]) => `<button type="button" data-v="${k || 'n'}" class="${s.z === k ? 'on' : ''}"><span class="rt-z-${k || 'n'}">${l}</span></button>`).join(''), v => setSize(v === 'n' ? '' : v)); }
      else if (a === 'color') { if (pop) { closePop(); return; } openPop(b, `<div class="rtp-sw">${COLORS.map(([k, hex, l]) => `<button type="button" data-v="${k}" title="${l}" aria-label="${l}" style="background:${hex}"></button>`).join('')}</div>`, v => setColor(v === 'k' ? '' : v)); }
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
    const a = bar.querySelector('[data-rt="color"] .rtb-a'); if (a) a.style.setProperty('--rtc', s.c ? COLORS.find(c => c[0] === s.c)[1] : '#0f172a');
  }
  function paintBars() { bars.forEach(b => { if (!b.isConnected) { bars.delete(b); return; } paintBar(b); }); }

  /** Print windows: the classes the formatting uses (the quotation prints force black / normal weight on the lines). */
  const PRINT_CSS = '.bc-rtx{line-height:1.45}.bc-rtx div{min-height:1em}.bc-rtx ol,.bc-rtx ul{margin:2px 0 2px 0!important;padding-left:20px!important}.bc-rtx li{margin:1px 0}.bc-rtx ol ol{list-style-type:lower-alpha}.bc-rtx ol ol ol{list-style-type:lower-roman}.bc-rtx ul ul{list-style-type:circle}.bc-rtx ul ul ul{list-style-type:square}'
    + '.bc-rtx b,.bc-rtx strong,td .bc-rtx b{font-weight:700!important}.bc-rtx i{font-style:italic}.bc-rtx u{text-decoration:underline}'
    + '.bc-rtx .rt-c-n,td .bc-rtx .rt-c-n,td .bc-rtx .rt-c-n *{color:#1F4E79!important}.bc-rtx .rt-c-r,td .bc-rtx .rt-c-r,td .bc-rtx .rt-c-r *{color:#b91c1c!important}.bc-rtx .rt-c-g,td .bc-rtx .rt-c-g,td .bc-rtx .rt-c-g *{color:#15803d!important}.bc-rtx .rt-c-s,td .bc-rtx .rt-c-s,td .bc-rtx .rt-c-s *{color:#64748b!important}'
    + '.bc-rtx .rt-z-sm{font-size:.85em}.bc-rtx .rt-z-lg{font-size:1.18em}.bc-rtx .rt-z-h{font-size:1.38em}.bc-rtx .rt-hl{background:#fef08a!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.bc-rtp{white-space:pre-line}';

  // the quotation screen's Format bar (index.html #qt-rtbar)
  const wireMain = () => { const b = document.getElementById('qt-rtbar'); if (b && !b.classList.contains('bc-rtbar')) wireBar(b); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireMain); else wireMain();

  window.BCRich = { clean, toText, hasFormat, plainToHtml, show, make, htmlOf, wireBar, paintBars, PRINT_CSS, COLORS, SIZES };
})();
