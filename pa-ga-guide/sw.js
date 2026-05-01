/* PA GA Guide — service worker
   Scope: /pa-ga-guide/  (does not interfere with the briefing app's root SW;
   sub-scope wins over root for pa-ga-guide URLs).
   Strategy: precache the small shell synchronously. Cache-first thereafter for
   everything (vendored Babel, Google Fonts, etc.) so the prototype works fully
   offline once it has been opened with a connection at least once.
*/

const CACHE = 'pa-ga-guide-v11';

const FED_IDS = [
  'us-fetterman','us-mccormick','us-fitzpatrick','us-boyle','us-evans','us-dean',
  'us-scanlon','us-houlahan','us-mackenzie','us-bresnahan','us-meuser','us-perry',
  'us-smucker','us-lee','us-joyce','us-reschenthaler','us-thompson','us-kelly',
  'us-deluzio',
];

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
  './app/screens-3.jsx',
  './data/legislators.json',
  './data/bills.json',
  './data/rea-overlay.json',
  './data/federal-delegation.json',
  './data/images/prea-coop-map.jpg',
  ...FED_IDS.map(id => `./data/photos/fed/${id}.jpg`),
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

// Strategy:
// - /data/*.json → network-first, fall back to cache (weekly refreshes flow through;
//   offline still works from the last good copy).
// - Everything else within scope → cache-first, populate on miss. Includes the
//   vendored React/Babel and cross-origin Google Fonts.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const isData = url.pathname.includes('/pa-ga-guide/data/') && url.pathname.endsWith('.json');

  if (isData) {
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response && response.status === 200 && (response.type === 'basic' || response.type === 'cors')) {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
