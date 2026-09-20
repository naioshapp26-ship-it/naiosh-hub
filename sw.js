/**
 * NAIOSH HUB Service Worker
 *
 * Same strategy as NAIS: network-first, shell precache, skipWaiting, clients.claim.
 * Cache name is Hub-specific (never nais-shell-*).
 */

const CACHE_NAME = 'hub-shell-v3';

const SHELL_URLS = [
  '/',
  '/index.html',
  '/hub-icon-192.png',
  '/hub-icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(
        SHELL_URLS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[HUB SW] Pre-cache failed for', url, err);
          })
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Never cache manifest/SW — keep installability + updates fresh (same idea as always-fresh NAIS network-first)
  if (
    url.pathname === '/manifest.json' ||
    url.pathname === '/sw.js' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/dashboard') ||
    url.pathname.startsWith('/login') ||
    url.pathname.startsWith('/register')
  ) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseToCache).catch((err) => {
            console.warn('[HUB SW] Cache put failed (quota or storage error):', err);
          });
        });
        return response;
      })
      .catch(() => caches.match(request))
  );
});
