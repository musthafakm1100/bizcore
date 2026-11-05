/* V271.5.23 — Stock desktop monitor visual adapter.
   The existing hidden Stock Monitor owns calculations and click-filter logic.
   This adapter observes its already-rendered fields; no new Firestore reads. */
(function(){'use strict';
const metrics=[
 {label:'In Stock',id:'streg-k-in',key:'in',tone:'blue',desc:'Available stock items'},
 {label:'Used Up',id:'streg-k-zero',key:'zero',tone:'slate',desc:'No remaining quantity'},
 {label:'Open Demand',id:'streg-k-demand',key:'demand',tone:'amber',desc:'Pending allocation'},
 {label:'Over 90 Days',id:'streg-k-old',key:'old',tone:'red',desc:'Aged stock items'}
];
function el(id){return document.getElementById(id)}
function init(){
 const root=el('st-main-workspace');if(!root||el('st-visual-strip'))return;
 const area=root.querySelector('.module-register-area');if(!area)return;
 const strip=document.createElement('div');strip.className='bc5-strip st-visual-monitor';strip.id='st-visual-strip';
 strip.setAttribute('aria-label','Stock status summary');
 const lead=document.createElement('button');lead.type='button';lead.className='bc5-lead';lead.dataset.stockFilter='all';
 lead.innerHTML='<span class="bc5-label">Stock Items</span><b class="bc5-number" data-stock-display="streg-k-total">—</b><span class="bc5-description">Stock value · SAR —</span>';
 const other=document.createElement('div');other.className='bc5-other';other.style.setProperty('--bc5-columns','4');
 for(const m of metrics){const btn=document.createElement('button');btn.type='button';btn.className='bc5-card';btn.dataset.tone=m.tone;btn.dataset.stockFilter=m.key;
  btn.innerHTML='<span class="bc5-card-header"><span class="bc5-label"></span><b class="bc5-number">—</b></span><span class="bc5-description"></span><span class="bc5-bar" aria-hidden="true"><i></i></span>';
  btn.querySelector('.bc5-label').textContent=m.label;btn.querySelector('.bc5-description').textContent=m.desc;
  btn.querySelector('.bc5-number').dataset.stockDisplay=m.id;other.appendChild(btn);}
 strip.append(lead,other);
 const note=document.createElement('div');note.className='bc5-note st-visual-note';note.textContent='Select a tile to filter stock; select it again to show all.';
 area.insertBefore(note,area.firstChild);area.insertBefore(strip,note);
 strip.addEventListener('click',ev=>{const btn=ev.target.closest('[data-stock-filter]');if(!btn)return;
  const key=btn.dataset.stockFilter;const curr=strip.dataset.selected||'all';
  const next=curr===key?'all':key;
  if(typeof window.filterStockKPI==='function')window.filterStockKPI(next);
  strip.dataset.selected=next;update();});
 function read(id){return el(id)?.textContent?.trim()||'—'}
 function update(){
  strip.querySelectorAll('[data-stock-display]').forEach(node=>node.textContent=read(node.dataset.stockDisplay));
  lead.querySelector('.bc5-description').textContent='Stock value · SAR '+read('streg-a-value');
  const demand=other.querySelector('[data-stock-filter="demand"] .bc5-description');if(demand)demand.textContent='Can go to orders · SAR '+read('streg-a-demand');
  strip.querySelectorAll('[data-stock-filter]').forEach(b=>b.setAttribute('aria-pressed',String((strip.dataset.selected||'all')===b.dataset.stockFilter)));
 }
 let queued=false;const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;update()})};
 for(const id of ['streg-k-total','streg-k-in','streg-k-zero','streg-k-demand','streg-k-old','streg-a-value','streg-a-demand']){
  if(el(id))new MutationObserver(schedule).observe(el(id),{childList:true,characterData:true,subtree:true});}
 const stat=el('streg-status');if(stat)stat.addEventListener('change',()=>{strip.dataset.selected=stat.value||'all';schedule()});
 const clear=el('streg-clear');if(clear)clear.addEventListener('click',()=>{strip.dataset.selected='all';schedule()});
 update();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
