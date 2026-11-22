// The "service worker": a helper that sits between the app and the internet.
//
// Its two jobs:
//   1. When online, always fetch the newest version of the app (so the Home Screen
//      app updates itself and never gets stuck on an old copy).
//   2. Keep a saved copy of everything, and use it when there's no internet.

const SAVED_COPIES = 'drop-and-finds-saved';
const MAP_SERVICE = 'https://fortnite-api.com';

// Start working straight away instead of waiting for the app to be reopened.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const ours = request.url.startsWith(self.location.origin);
  const mapService = request.url.startsWith(MAP_SERVICE);
  if (!ours && !mapService) return; // anything else: leave it alone

  event.respondWith(newestFirst(request.url, ours));
});

// Try the internet first. If that fails, fall back to the saved copy.
async function newestFirst(url, ours) {
  const saved = await caches.open(SAVED_COPIES);
  try {
    // 'no-cache' means: don't trust the browser's old copy, check for a new one.
    const options = ours
      ? { cache: 'no-cache' }
      : { cache: 'no-cache', mode: 'cors', credentials: 'omit' };
    const fresh = await fetch(url, options);
    if (fresh.ok) saved.put(url, fresh.clone());
    return fresh;
  } catch (error) {
    const copy = await saved.match(url);
    if (copy) return copy;
    throw error;
  }
}
