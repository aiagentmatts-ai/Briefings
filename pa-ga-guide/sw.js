/* PA GA Guide — service worker
   Scope: /pa-ga-guide/  (does not interfere with the briefing app's root SW;
   sub-scope wins over root for pa-ga-guide URLs).
   Strategy: precache the small shell synchronously. Cache-first thereafter for
   everything (vendored Babel, Google Fonts, etc.) so the prototype works fully
   offline once it has been opened with a connection at least once.
*/

const CACHE = 'pa-ga-guide-v1';

const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './ios-frame.jsx',
  './app/style.css',
  './app/data.js',
  './app/Portrait.jsx',
  './app/atoms.jsx',
  './app/screens-1.jsx',
  './app/screens-2.jsx',
  './vendor/react.production.min.js',
  './vendor/react-dom.production.min.js',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// Cache-first for everything within scope; fall back to network and populate cache.
// Cross-origin GETs (Babel CDN if used, Google Fonts) get the same treatment.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Only cache successful, basic/cors responses (skip opaque to avoid bloat).
        if (response && response.status === 200 && (response.type === 'basic' || response.type === 'cors')) {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
