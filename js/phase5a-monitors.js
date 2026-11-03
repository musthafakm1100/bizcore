/* BizCore Phase 5A metrics step 1. UI and read-only calculations: no Firestore writes or status mutations.
   Existing monitor calculations and filtering stay authoritative. Unimplemented
   workflow measures are shown as unavailable, never as fictitious zeroes. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const pageConfigs=[
  {page:'rfq',host:'rfq-main-workspace',lead:['Open RFQs','rfq-k-open','7 active / total RFQs','Open'],cards:[
    ['Awaiting Pricing','rfq-k-pricing','Not yet priced','amber','New'],['In Pricing','rfq-k-inpricing','Pricing underway','blue','Pricing'],['Quoted / Sales Order','rfq-k-quoted','Progressed to quotation','green','Quoted'],['Overdue','rfq-k-overdue','Past response due date','red','Overdue']]},
  {page:'costing',host:'pricing-main-workspace',lead:['Active Pricing',null,'Saved pricing not converted','all'],cards:[
    ['In Progress','pricing-doc-k-saved','Still being priced','blue','Saved'],['Ready to Quote',null,'Needs completed-pricing flag','purple',null],['Quoted','pricing-doc-k-converted','Converted to quotation','green','Converted'],['Overdue',null,'Target date not yet tracked','red',null]]},
  {page:'quotations',host:'quotation-main-workspace',lead:['Active Quotes',null,'Draft + Sent quotations','all'],cards:[
    ['Draft','quote-kpi-draft','Not yet sent','slate','Draft'],['Sent','quote-kpi-sent','Awaiting customer response','blue','Sent'],['Won','quote-kpi-won','Customer accepted','green','Won'],['Follow-up Due',null,'Follow-up dates not yet tracked','amber',null]]},
  {page:'deliverynotes',host:'deliverynotes-main-workspace',lead:['Total DNs','dn-k-total','All delivery notes','all'],cards:[
    ['Draft',null,'Draft status not yet tracked','slate',null],['Out for Delivery','dn-k-out','Dispatched','blue','Out for Delivery'],['Delivered','dn-k-delivered','Physical delivery confirmed','green','Delivered'],['Pending Ack.',null,'Acknowledgement feature pending','amber',null]]},
  {page:'customerinvoices',host:'customerinvoices-main-workspace',lead:['Outstanding','invreg-a-balance','SAR · Customer receivables','all'],cards:[
    ['Unpaid','invreg-k-pay-unpaid','No payment received','slate','pay-unpaid'],['Partially Paid','invreg-k-pay-partial','Balance remaining','blue','pay-partial'],['Paid','invreg-k-pay-paid','Fully settled','green','pay-paid'],['Overdue','invreg-k-pay-overdue','Past payment due date','red','pay-overdue']]},
  {page:'receipts',host:'receipts-main-workspace',lead:['Total Received','rctreg-a-received','SAR · Recorded receipts','all'],cards:[
    ['Receipts','rctreg-k-posted','Posted receipt count','blue','Posted'],['Fully Allocated','rctreg-k-fully-allocated','Completely applied to invoices','green','fully-allocated'],['Partially Allocated','rctreg-k-partially-allocated','Partly applied to invoices','purple','partially-allocated'],['Unallocated','rctreg-k-unapplied','Remaining amount not applied to invoices','amber','unapplied']]},
  {page:'purchaseinvoices',host:'pi-main-workspace',lead:['Outstanding Payables','pireg-a-payable','SAR · Payable to suppliers','all'],cards:[
    ['Unpaid','pireg-k-pay-unpaid','No payment made','slate','pay-unpaid'],['Partially Paid','pireg-k-pay-partial','Balance remaining','blue','pay-partial'],['Paid','pireg-k-pay-paid','Fully settled','green','pay-paid'],['Overdue','pireg-k-overdue','Past supplier due date','red','overdue']]},
  {page:'supplierpayments',host:'sp-main-workspace',lead:['Total Paid','spreg-a-paid','SAR · Cash paid including advances','all'],cards:[
    ['Payments','spreg-k-payment','Invoice payments (including applied advances)','slate','payment'],['Fully Applied',null,'Application breakdown pending','green',null],['Partially Applied',null,'Application breakdown pending','blue',null],['Unapplied',null,'Application breakdown pending','amber',null],['Advances','spreg-a-open','SAR · Available supplier advances','purple','open']]}
];
// Read-only amount subtitles. Values are populated from each register's existing
// filtered scope; no financial data or posting logic is changed.
const financeAmounts={
 customerinvoices:{'Unpaid':'bc5-inv-unpaid','Partially Paid':'bc5-inv-partial','Paid':'bc5-inv-paid','Overdue':'bc5-inv-overdue'},
 receipts:{'Receipts':'bc5-rct-receipts','Fully Allocated':'bc5-rct-fully','Partially Allocated':'bc5-rct-partial','Unallocated':'bc5-rct-unallocated'},
 purchaseinvoices:{'Unpaid':'bc5-pi-unpaid','Partially Paid':'bc5-pi-partial','Paid':'bc5-pi-paid','Overdue':'bc5-pi-overdue'},
 supplierpayments:{'Payments':'bc5-sp-payments','Fully Applied':null,'Partially Applied':null,'Unapplied':null,'Advances':'spreg-a-open'}
};
const moneyText=id=>{const v=readText(id);return v==='—'?'—':`SAR ${v}`};
const filterFunctions={rfq:(key)=>window.applyRFQMonitorFilter?.(key),costing:(key)=>window.filterPricingDocuments?.(key,$('pricing-doc-f-'+(key==='Saved'?'saved':key==='Converted'?'converted':'all'))),quotations:(key)=>window.setQuotationMonitorFilter?.(key==='all'?'':key),deliverynotes:(key)=>window.filterDNKPI?.(key),customerinvoices:(key)=>window.filterInvoiceKPI?.(key),receipts:(key)=>window.filterReceiptKPI?.(key),purchaseinvoices:(key)=>window.filterPurchaseKPI?.(key),supplierpayments:(key)=>window.filterSupplierPaymentKPI?.(key)};
const leadValue=(cfg)=>{
 if(cfg.page==='costing'){
   const a=readNumber('pricing-doc-k-saved');return a===null?'—':String(a);
 }
 if(cfg.page==='quotations'){
   const a=readNumber('quote-kpi-draft'),b=readNumber('quote-kpi-sent');return a===null||b===null?'—':String(a+b);
 }
 return readText(cfg.lead[1]);
};
function readText(id){return $(id)?.textContent?.trim()||'—'}
function readNumber(id){let s=readText(id).replace(/,/g,'');return /^\d+(?:\.\d+)?$/.test(s)?Number(s):null}
function displayValue(id){return id?readText(id):'—'}
function createTile(cfg,entry,index){
 const [label,source,description,tone,key]=entry,enabled=key!=null;
 const el=document.createElement('button');el.type='button';el.className=index<0?'bc5-lead':'bc5-card';el.disabled=!enabled;
 if(tone)el.dataset.tone=tone;
 if(key!=null){el.dataset.filter=key;el.setAttribute('aria-pressed','false');el.addEventListener('click',()=>{
  const strip=el.closest('.bc5-strip');const active=el.getAttribute('aria-pressed')==='true';
  const target=active?'all':key;
  try{filterFunctions[cfg.page]?.(target)}catch(e){console.warn('[BizCore] Monitor filter unavailable:',e)}
  strip.querySelectorAll('[data-filter]').forEach(btn=>btn.setAttribute('aria-pressed',String(!active&&btn===el)));
 });}
 if(!enabled)el.title=description+' — not yet available in the current workflow';
 if(index<0)el.innerHTML='<span class="bc5-label"></span><b class="bc5-number">—</b><span class="bc5-description"></span>';
 else el.innerHTML='<span class="bc5-card-header"><span class="bc5-label"></span><b class="bc5-number">—</b></span><span class="bc5-description"></span><span class="bc5-bar" aria-hidden="true"><i></i></span>';
 el.querySelector('.bc5-label').textContent=label;el.querySelector('.bc5-description').textContent=description;
 el.dataset.metric=source||'';if(index>=0 && financeAmounts[cfg.page] && Object.hasOwn(financeAmounts[cfg.page],label)){el.dataset.amountMetric=financeAmounts[cfg.page][label]||'';el.classList.add('bc5-financial');}return el;
}
function install(){
 for(const cfg of pageConfigs){
  const root=$(cfg.host);if(!root||root.querySelector('.bc5-strip'))continue;
  const strip=document.createElement('div');strip.className='bc5-strip';strip.setAttribute('aria-label',cfg.page+' status summary');
  const lead=createTile(cfg,[cfg.lead[0],cfg.lead[1],cfg.lead[2],null,cfg.lead[3]],-1);
  const other=document.createElement('div');other.className='bc5-other';other.style.setProperty('--bc5-columns',String(cfg.cards.length));
  cfg.cards.forEach((entry,i)=>other.appendChild(createTile(cfg,entry,i)));
  strip.append(lead,other);
  // Hidden read-only KPI values are updated by existing register render functions.
  const amountIds=Object.values(financeAmounts[cfg.page]||{}).filter(x=>x&&x.startsWith('bc5-'));
  for(const id of amountIds){if(!$(id)){const span=document.createElement('span');span.id=id;span.hidden=true;span.setAttribute('aria-hidden','true');root.appendChild(span);}}
  const note=document.createElement('div');note.className='bc5-note';note.textContent='Select a tile to filter the register; select it again to show all. A dash indicates a measure requiring a future workflow update.';
  root.insertBefore(note,root.firstChild);root.insertBefore(strip,note);
  const refresh=()=>{
    for(const tile of strip.querySelectorAll('[data-metric]')){
      const id=tile.dataset.metric;
      tile.querySelector('.bc5-number').textContent=tile===lead?leadValue(cfg):displayValue(id);
      if(tile.classList.contains('bc5-financial')){const amount=tile.dataset.amountMetric;tile.querySelector('.bc5-description').textContent=amount?moneyText(amount)+(tile.dataset.metric==='spreg-a-open'?' available':''):'Amount breakdown pending';}
    }
    if(cfg.page==='rfq'){
      const total=readText('rfq-k-total'),avg=readText('rfq-k-avg');
      lead.querySelector('.bc5-description').textContent=`${leadValue(cfg)} open / ${total} RFQs · Avg age ${avg}`;
    }
    if(cfg.page==='costing')lead.querySelector('.bc5-description').textContent=`${readText('pricing-doc-k-total')} total pricing records`;
    if(cfg.page==='quotations')lead.querySelector('.bc5-description').textContent=`${readText('quote-kpi-all')} total quotations`;
  };
  const sources=[cfg.lead[1],...cfg.cards.map(c=>c[1])];
  if(cfg.page==='costing')sources.push('pricing-doc-k-total');
  if(cfg.page==='quotations')sources.push('quote-kpi-all','quote-kpi-draft','quote-kpi-sent');
  if(cfg.page==='rfq')sources.push('rfq-k-total','rfq-k-avg');
  sources.push(...Object.values(financeAmounts[cfg.page]||{}).filter(Boolean));
  let queued=false;
  const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;refresh()})};
  for(const id of new Set(sources.filter(Boolean))){const e=$(id);if(e)new MutationObserver(schedule).observe(e,{subtree:true,childList:true,characterData:true});}
  refresh();
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
