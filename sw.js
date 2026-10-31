/*
  BizCore service worker.
  Purpose: (1) satisfy the browser requirement for showing an "Install app"
  prompt, and (2) let the app shell (HTML/CSS/JS/icons) load instantly and
  work briefly offline. It does NOT cache your data — quotations, customers,
  etc. all live in localStorage/Firebase and are untouched by this file.

  Bump CACHE_NAME whenever app files change materially so old caches are
  cleared and users get the latest version.
*/
const CACHE_NAME = 'bizcore-shell-v27057';
const APP_SHELL = [
  './login.html',
  './delivery.html',
  './index.html',
  './mycash.html',
  './css/main.css?v=270.57',
  './css/bizcore-design.css?v=266.5',
  './css/typography.css?v=215',
  './css/masters.css?v=266.5',
  './css/administration-typography.css?v=247',
  './css/numbering-controls.css?v=266.5',
  './css/invoicing.css?v=270.50',
  './css/register-standard.css?v=268.4',
  './css/doc-view.css?v=266.5',
  './css/delivery-compact.css?v=266.5',
  './css/receipts.css?v=266.5',
  './css/shell.css?v=269.1',
  './css/accounts.css?v=268.2',
  './css/cash.css?v=268.32',
  './css/purchases.css?v=268.7',
  './css/responsive.css?v=268.4',
  './css/theme.css?v=266.5',
  './css/so-register.css?v=269.2',
  './css/so-view.css?v=269.72',
  './css/bc-date.css?v=270.1',
  './css/pricing.css?v=270.22',
  './css/quotation.css?v=270.22',
  './css/safe-area.css?v=269.2',
  './css/users.css?v=270.43',
  './js/users.js?v=270.43',
  './js/permissions-ui.js?v=270.43',
  './js/user-core.mjs?v=270.43',
  './js/user-service.mjs?v=270.43',
  './js/role-core.mjs?v=270.43',
  './js/role-service.mjs?v=270.43',
  './css/mobile-zoom.css?v=270.49',
  './js/doc-zoom.js?v=270.48',
  './js/doc-pages.js?v=270.51',
  './js/master-ui.js?v=270.56',
  './js/item-link.js?v=270.56',
  './js/master-service.mjs?v=270.55',
  './js/ui-standard.js?v=269.1',
  './js/responsive.js?v=270.47',
  './js/app.js?v=270.57',
  './js/so-view.js?v=270.57',
  './js/pricing-ui.js?v=270.24',
  './js/quotation-ui.js?v=270.21',
  './js/bc-date.js?v=270.52',
  './js/deliveries.js?v=265.7',
  './js/delivery-core.mjs?v=266.0',
  './js/delivery-core.mjs?v=270.46',
  './js/delivery-service.mjs?v=270.46',
  './js/lock-service.mjs?v=266.0',
  './js/invoice-core.mjs?v=266.0',
  './js/invoice-service.mjs?v=270.43',
  './js/invoicing.js?v=270.53',
  './js/receipts.js?v=270.51',
  './js/receipt-core.mjs?v=270.43',
  './js/accounts.js?v=268.51',
  './js/cash-ui.js?v=269.3',
  './js/cashbank.js?v=269.3',
  './js/ledger-core.mjs?v=269.3',
  './js/ledger-service.mjs?v=269.3',
  './js/running-totals.mjs?v=269.3',
  './js/purchases.js?v=270.57',
  './js/supplier-payments.js?v=269.3',
  './js/stock.js?v=268.61',
  './js/data-safety.js?v=270.57',
  './js/purchase-core.mjs?v=270.43',
  './js/purchase-service.mjs?v=270.43',
  './js/account-core.mjs?v=268.2',
  './js/account-service.mjs?v=270.21',
  './js/receipt-service.mjs?v=270.43',
  './js/numbering.mjs?v=266.0',
  './manifest.json',
  './icons/bizcore-icon-192.png',
  './icons/bizcore-icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .catch(() => {}) // don't block install if a shell file is briefly unreachable
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first: always try to fetch the latest version; fall back to the
// cached copy only when offline. This avoids serving a stale app shell
// while you're actively developing/deploying updates.
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
