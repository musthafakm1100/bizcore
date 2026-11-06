/* BizCore V271.5.30 | Master Data secondary navigation; presentation only. */
(function(){
  'use strict';
  function init(){
    const shell=document.querySelector('#page-masters .masters-shell');
    const toggle=document.getElementById('masters-nav-toggle');
    if(!shell||!toggle)return;
    const tabs=shell.querySelectorAll('.masters-tab');
    tabs.forEach(tab=>{
      const name=tab.querySelector('.tab-title')?.textContent?.trim();
      if(name)tab.setAttribute('title',name);
    });
    toggle.addEventListener('click',()=>{
      const collapsed=shell.classList.toggle('masters-nav-collapsed');
      toggle.setAttribute('aria-expanded',String(!collapsed));
      const action=collapsed?'Expand':'Collapse';
      toggle.setAttribute('aria-label',action+' Master Data navigation');
      toggle.setAttribute('title',action+' Master Data navigation');
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
