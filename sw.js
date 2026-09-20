/**
 * NAIOSH HUB Service Worker
 *
 * Mirrors the NAIS PWA strategy:
 * network-first for all requests so the app always shows fresh content.
 * The SW is registered solely to satisfy the PWA installability criteria and enable
 * the browser "Add to Home Screen" / native install prompt.
 *
 * A small set of shell assets are pre-cached on install so the app loads instantly
 * when offline or on slow connections.
 *
 * Cache name is Hub-specific so it never collides with NAIS (nais-shell-v1).
 */

const CACHE_NAME = 'hub-shell-v1';

/** Assets pre-cached on SW install to enable fast offline startup. */
const SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/logo-hub.jpeg',
  '/assets/hub-icon-192.png',
  '/assets/hub-icon-512.png',
];

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  // Best-effort pre-cache: use Promise.allSettled so individual asset failures
  // don't prevent the SW from installing and activating.
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
  // Activate immediately without waiting for existing tabs to close
  self.skipWaiting();
});

// ── Activate ─────────────────────────────────────────────────────────────────
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
  // Take control of all open clients immediately
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Always go to network for API, auth, and dashboard routes to prevent stale data
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/dashboard') ||
    url.pathname.startsWith('/login') ||
    url.pathname.startsWith('/register')
  ) {
    return;
  }

  // Network-first for everything else; fall back to cache if offline
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Clone the response before consuming it
        const responseToCache = response.clone();
        // Non-blocking background cache write — intentionally not awaited.
        // Errors (quota exceeded, storage unavailable) are logged but don't fail the response.
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
