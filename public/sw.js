/*
 * Offline support for Family Travel Adventures.
 *
 * - Build files, fonts and icons: cache-first (their names change with every build).
 * - The dashboard and trip pages: network-first, falling back to the saved
 *   copy when offline (immediately) or when the network is very slow.
 * - Photos (sm/lg): never cached; offline they get a blank stand-in so saved
 *   pages don't show broken images.
 * - Other pages: network, with /offline as the fallback.
 * - Everything else (API calls, sign-in, writes, RSC data): untouched.
 *
 * Pages ask the worker to save a trip ({type: 'save'}) and to forget this
 * person's pages when they sign out ({type: 'clear'}); each reply
 * goes back on the MessageChannel port the page sends.
 * The rules live in sw-core.js (tested in tests/sw-core.test.mjs).
 */
importScripts('/sw-core.js');

const SW = self.TravelSW;
const ORIGIN = self.location.origin;
const OFFLINE_KEY = ORIGIN + SW.OFFLINE_URL;

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        await saveShell();
      } catch {
        // Best effort: the server may be unreachable while the worker installs.
      }
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(SW.staleCaches(names).map((name) => caches.delete(name)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const kind = SW.classify(event.request, ORIGIN);
  if (kind === 'static') event.respondWith(cacheFirst(event, SW.CACHES.static, 'static', SW.LIMITS.static));
  else if (kind === 'photo') event.respondWith(photoOrBlank(event.request));
  else if (kind === 'page') event.respondWith(savedPage(event));
  else if (kind === 'navigate') event.respondWith(networkOrOffline(event.request));
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  const port = event.ports && event.ports[0];
  const reply = (message) => port && port.postMessage(message);
  const fail = (err) => reply({ ok: false, error: String((err && err.message) || err) });
  if (data.type === 'save') event.waitUntil(save(SW.cleanSaveRequest(data)).then(reply, fail));
  else if (data.type === 'clear') event.waitUntil(clearPrivate().then(() => reply({ ok: true }), fail));
});

// Transparent, so the space keeps its background colour.
const BLANK_PHOTO = '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="3" viewBox="0 0 4 3"/>';

async function photoOrBlank(request) {
  try {
    return await fetch(request);
  } catch {
    return new Response(BLANK_PHOTO, { headers: { 'content-type': 'image/svg+xml', 'cache-control': 'no-store' } });
  }
}

async function cacheFirst(event, cacheName, kind, limit) {
  const cache = await caches.open(cacheName);
  const hit = (await cache.match(event.request)) || (cacheName === SW.CACHES.static && (await caches.match(event.request, { cacheName: SW.CACHES.shell })));
  if (hit) return hit;
  const response = await fetch(event.request);
  if (SW.isCacheable(response, kind)) {
    event.waitUntil(cache.put(event.request, response.clone()).then(() => trim(cache, limit)));
  }
  return response;
}

async function savedPage(event) {
  const { request } = event;
  const cache = await caches.open(SW.CACHES.pages);
  const key = SW.pageKey(request.url);
  const saved = cache.match(key);
  if (self.navigator.onLine === false) {
    const copy = await saved;
    if (copy) return copy;
  }

  const network = fetch(request).then(async (response) => {
    if (SW.isCacheable(response, 'page')) {
      await cache.put(key, response.clone());
      await trim(cache, SW.LIMITS.pages);
    }
    return response;
  });
  event.waitUntil(network.catch(() => undefined));

  try {
    const first = await Promise.race([network, delay(SW.NETWORK_TIMEOUT_MS)]);
    if (first) return first;
    return (await saved) || (await network);
  } catch {
    return (await saved) || (await offlinePage());
  }
}

async function networkOrOffline(request) {
  try {
    return await fetch(request);
  } catch {
    return offlinePage();
  }
}

async function offlinePage() {
  return (await caches.match(OFFLINE_KEY, { cacheName: SW.CACHES.shell })) || Response.error();
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** The offline page, fetched signed out so it holds nobody's data. */
async function saveShell() {
  const cache = await caches.open(SW.CACHES.shell);
  const response = await fetch(SW.OFFLINE_URL, { credentials: 'omit', cache: 'no-store' });
  if (!SW.isCacheable(response, 'page')) return;
  const html = await response.clone().text();
  await cache.put(OFFLINE_KEY, response);
  await saveAssets(cache, SW.assetsIn(html));
}

/** Saves pages (with the build files they use) for offline use. */
async function save({ pages }) {
  const failed = [];
  let savedPages = 0;
  const pageCache = await caches.open(SW.CACHES.pages);
  const staticCache = await caches.open(SW.CACHES.static);
  for (const page of pages) {
    try {
      const response = await fetch(page, { credentials: 'same-origin', cache: 'no-store', headers: { accept: 'text/html' } });
      if (!SW.isCacheable(response, 'page')) throw new Error(`HTTP ${response.status}`);
      const html = await response.clone().text();
      await pageCache.put(SW.pageKey(ORIGIN + page), response);
      await saveAssets(staticCache, SW.assetsIn(html));
      savedPages += 1;
    } catch {
      failed.push(page);
    }
  }

  await trim(pageCache, SW.LIMITS.pages);
  await trim(staticCache, SW.LIMITS.static);
  return { ok: savedPages === pages.length, pages: savedPages, failed };
}

async function saveAssets(cache, assets) {
  for (const asset of assets) {
    if (await cache.match(asset)) continue;
    try {
      const response = await fetch(asset);
      if (SW.isCacheable(response, 'static')) await cache.put(asset, response);
    } catch {
      // A missing chunk only matters if that part of the page is used offline.
    }
  }
}

async function trim(cache, limit) {
  const keys = await cache.keys();
  await Promise.all(SW.excess(keys, limit).map((key) => cache.delete(key)));
}

async function clearPrivate() {
  await Promise.all(SW.PRIVATE_CACHES.map((name) => caches.delete(name)));
}
