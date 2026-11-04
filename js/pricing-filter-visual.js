/* BizCore V271.5.17 — visual enable/disable state for Pricing Clear Filters.
   Reads existing UI states only; never changes filtering/data behavior. */
(() => {
  'use strict';
  const page = () => document.getElementById('page-costing');
  const button = () => document.getElementById('pricing-clear-filters-btn');
  function hasFilters() {
    const p = page();
    if (!p) return false;
    const value = id => (document.getElementById(id)?.value || '').trim();
    const dateState = window.BCDateFilter?.get?.('pricing');
    const dateApplied = dateState ? dateState.preset !== 'all' :
      p.querySelector('.bc-date-btn.active') !== null;
    const selectedMonitor = !!p.querySelector('[data-pricing-filter]:not([data-pricing-filter="all"])[aria-pressed="true"]');
    return Boolean(value('pricing-customer-filter') || value('pricing-status-filter') ||
      value('pricing-doc-search') || dateApplied || selectedMonitor);
  }
  function refresh() {
    const btn = button();
    if (!btn) return;
    const active = hasFilters();
    btn.disabled = !active;
    btn.classList.toggle('bc-clear-active', active);
    btn.classList.toggle('bc-clear-inactive', !active);
    btn.setAttribute('aria-label', active ? 'Clear Pricing filters' : 'No Pricing filters to clear');
    btn.title = active ? 'Clear Pricing filters' : 'No filters applied';
  }
  function schedule() { requestAnimationFrame(refresh); }
  function setup() {
    const p = page();
    if (!p) return;
    p.addEventListener('input', schedule, true);
    p.addEventListener('change', schedule, true);
    p.addEventListener('click', schedule, true);
    /* Monitor status selection, date component paint, and row re-renders are
       asynchronous UI events. Observe only relevant status attributes. */
    const observer = new MutationObserver(schedule);
    p.querySelectorAll('[data-pricing-filter]').forEach(el =>
      observer.observe(el, {attributes:true,attributeFilter:['aria-pressed']}));
    const date = p.querySelector('[data-bc-date="pricing"]');
    if (date) observer.observe(date,{attributes:true,subtree:true,attributeFilter:['class']});
    refresh();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup, {once:true});
  else setup();
})();
