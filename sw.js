// The "service worker": a helper that sits between the app and the internet.
//
// Its two jobs:
//   1. When online, always fetch the newest version of the app (so the Home Screen
//      app updates itself and never gets stuck on an old copy).
//   2. Keep a saved copy of everything, and use it when there's no internet.

const SAVED_COPIES = 'drop-and-finds-saved';
const MAP_SERVICE = 'https://fortnite-api.com';
const SERVICE_PICTURES = MAP_SERVICE + '/images/';
const MAP_PICTURES = MAP_SERVICE + '/images/map';

// Start working straight away instead of waiting for the app to be reopened.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const ours = request.url.startsWith(self.location.origin);
  const mapService = request.url.startsWith(MAP_SERVICE);
  if (!ours && !mapService) return; // anything else: leave it alone

  // Player stats are sent with a private key, so the helper keeps its hands off:
  // it doesn't touch the request and never keeps a copy.
  if (request.url.includes('/v2/stats/')) return;

  // Item shop pictures: there are hundreds and they change daily, so we don't keep copies.
  if (request.url.startsWith(SERVICE_PICTURES) && !request.url.startsWith(MAP_PICTURES)) return;

  // Map pictures are big (up to 9 MB), so those use the saved copy when there is one.
  // The app puts the game version on the end of the picture's address, so a new
  // map has a new address and gets downloaded fresh.
  if (request.url.startsWith(MAP_PICTURES)) {
    event.respondWith(savedFirst(request.url));
  } else {
    event.respondWith(newestFirst(request.url, ours));
  }
});

// Use the saved copy if we have one. Otherwise download it, save it,
// and throw away older map pictures so they don't pile up.
async function savedFirst(url) {
  const saved = await caches.open(SAVED_COPIES);
  const copy = await saved.match(url);
  if (copy) return copy;

  const fresh = await fetch(url, { mode: 'cors', credentials: 'omit' });
  if (fresh.ok) {
    for (const old of await saved.keys()) {
      if (old.url.startsWith(MAP_PICTURES)) await saved.delete(old);
    }
    await saved.put(url, fresh.clone());
  }
  return fresh;
}

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
