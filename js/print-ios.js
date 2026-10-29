/* BizCore V270.4.7 — print / PDF on iPhone and iPad (Safari, also the installed app).
 *
 * iPhone Safari lays a printed page out about 20% narrower than A4 and prints it about 20% larger than Chrome
 * (measured on DN-2610-0004, 29 Oct 2026): the right side is cut off and the pinned footer (position:fixed) is lost.
 * On iPhone / iPad only, the print window gets:
 *   - zoom 0.8 while printing → the same layout as the PC (A4 content width ≈ 188 mm);
 *   - the page footer at the end of the document instead of pinned to the page bottom (Safari drops pinned footers).
 * PC and Android (Chrome) print exactly as before — nothing is added there.
 * Safari's own web-address / date line is added by the iPhone itself and cannot be switched off by a web page.
 */
(function () {
  function isIOS() {
    var ua = navigator.userAgent || '';
    return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  var CSS = '@media print{html{zoom:.8}'
    + '.dn-foot,.fixed-footer{position:static!important;left:auto!important;right:auto!important;bottom:auto!important;margin-top:8mm!important}}';
  window.BCPrintIOS = {
    active: isIOS,
    /** <style> to put in the print window's <head> ('' on other devices). */
    head: function () { return isIOS() ? '<style id="bc-print-ios">' + CSS + '</style>' : ''; },
    /** Adds the iPhone print style to a complete HTML document (unchanged on other devices). */
    apply: function (html) {
      var tag = this.head(); html = String(html || '');
      if (!tag) return html;
      return /<\/head>/i.test(html) ? html.replace(/<\/head>/i, tag + '</head>') : tag + html;
    },
  };
})();
