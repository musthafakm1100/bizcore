/*
  BizCore service worker.
  Purpose: (1) satisfy the browser requirement for showing an "Install app"
  prompt, and (2) let the app shell (HTML/CSS/JS/icons) load instantly and
  work briefly offline. It does NOT cache your data — quotations, customers,
  etc. all live in localStorage/Firebase and are untouched by this file.

  Bump CACHE_NAME whenever app files change materially so old caches are
  cleared and users get the latest version.
*/
const CACHE_NAME = 'bizcore-shell-v1';
const APP_SHELL = [
  './login.html',
  './index.html',
  './css/main.css',
  './css/bizcore-design.css',
  './css/typography.css',
  './css/masters.css',
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
