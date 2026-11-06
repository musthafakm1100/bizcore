/* BizCore V271.5.32: UI-only directory toolbar normalization; existing handlers retained. */
(function () {
  'use strict';
  const types = ['suppliers','products','employees','units','categories'];
  function init() {
    for (const type of types) {
      const tab = document.getElementById('masters-tab-' + type);
      if (!tab || tab.dataset.bcRegisterStandard === '1') continue;
      const card = tab.querySelector(':scope > .card');
      const header = card && card.querySelector(':scope > .card-header');
      const toolbar = card && card.querySelector(':scope > .card-body');
      if (!card || !header || !toolbar) continue;
      const table = card.querySelector('.list-table-scroll, .employee-table-wrap, .uom-table') ;
      if (!table) continue;
      tab.classList.add('bc-master-register-standard');
      header.classList.add('bc-master-directory-heading');
      toolbar.classList.add('bc-master-register-toolbar');
      if (type === 'suppliers' || type === 'products') {
        const filterbar = toolbar.querySelector('.filter-bar');
        if (filterbar) {
          // Move existing controls, preserving nodes/listeners and IDs.
          while (filterbar.firstChild) toolbar.insertBefore(filterbar.firstChild, filterbar);
          filterbar.remove();
        }
      }
      let tableScroll = table;
      if (table.tagName === 'TABLE') tableScroll = table.parentElement;
      tableScroll.classList.add('bc-master-register-table-scroll');
      // Move only the existing action elements; never reconstruct buttons or onclick handlers.
      const actionButtons = Array.from(header.querySelectorAll('button'));
      if (actionButtons.length) {
        const actions = document.createElement('div');
        actions.className = 'bc-master-toolbar-actions';
        actionButtons.forEach(btn => {
          if (btn.classList.contains('page-primary-command')) {
            btn.classList.add('bc-master-create');
            btn.type = btn.type || 'button';
          } else if (type !== 'units' || !btn.getAttribute('onclick')?.includes('addSuggested')) {
            const label = btn.textContent.trim().replace(/\s+/g,' ');
            btn.title = btn.title || label;
            btn.setAttribute('aria-label',btn.getAttribute('aria-label') || label);
            btn.classList.add('bc-master-icon-action');
            const icon = btn.querySelector('i');
            Array.from(btn.childNodes).forEach(node => {if (node !== icon && !(node.nodeType===1 && node.id && node.id.endsWith('selected-count'))) {
              if (node.nodeType===3) node.textContent='';
            }});
          }
          actions.appendChild(btn);
        });
        toolbar.appendChild(actions);
      }
      const filterInputs = toolbar.querySelectorAll('input[type="text"], input[type="search"],select');
      filterInputs.forEach(el=>{if (el.hasAttribute('style') && /width\s*:/.test(el.getAttribute('style'))) el.style.removeProperty('width');});
      tab.dataset.bcRegisterStandard='1';
    }
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
