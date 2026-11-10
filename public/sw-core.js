/*
 * Rules for the service worker (public/sw.js), kept free of worker APIs so
 * tests/sw-core.test.mjs can run them. Loaded with importScripts(), so this is
 * a classic script: it sets self.TravelSW and has no imports or exports.
 */
(function (self) {
  'use strict';

  // Bump a version to drop that cache for everyone on the next worker update.
  var CACHES = {
    shell: 'travel-shell-v1', // the offline page and its build files (never trimmed)
    static: 'travel-static-v1', // hashed build files, fonts, icons (shared by all users)
    pages: 'travel-pages-v1', // saved HTML pages (this person's data)
  };
  // Photos are never kept on the device (a lot of space for little use
  // offline). The first worker had a travel-photos-v1 cache; it is not in
  // CACHES, so staleCaches() deletes it.
  // What signing out (or another person signing in) wipes.
  var PRIVATE_CACHES = [CACHES.pages];
  var LIMITS = { static: 400, pages: 60 };
  var OFFLINE_URL = '/offline';
  // Online but slow: after this long, show the saved copy instead.
  var NETWORK_TIMEOUT_MS = 10000;

  var STATIC_FILES = ['/favicon.ico', '/icon.svg', '/apple-icon.png'];
  var SLUG = '[a-z0-9]+(?:-[a-z0-9]+)*';
  // Pages that work from a saved copy. Editing, account and sign-in pages
  // always need the network, and so does the story page (it is mostly photos).
  var SAVED_PAGES = [new RegExp('^/$'), new RegExp('^/trips/(?!new$)' + SLUG + '$')];
  var PHOTO = /^\/api\/photos\/\d+\/(sm|lg)$/;

  function isSavedPage(pathname) {
    return SAVED_PAGES.some(function (re) {
      return re.test(pathname);
    });
  }

  /**
   * What the fetch handler does with a request:
   * 'static' cache-first, 'page' network-first with a saved copy,
   * 'navigate' network with the offline page as fallback, 'photo' network
   * with a blank stand-in when offline (never cached),
   * 'bypass' leave it to the browser.
   */
  function classify(request, origin) {
    if (request.method !== 'GET') return 'bypass';
    var url = new URL(request.url);
    if (url.origin !== origin) return 'bypass';
    // React Server Component data for client-side navigation: if it fails,
    // Next falls back to a full page load, which is served from the cache.
    if (request.headers.get('rsc') || url.searchParams.has('_rsc')) return 'bypass';

    var path = url.pathname;
    if (request.mode === 'navigate') return isSavedPage(path) ? 'page' : 'navigate';
    if (path.indexOf('/_next/static/') === 0 || path.indexOf('/icons/') === 0 || STATIC_FILES.indexOf(path) >= 0) {
      return 'static';
    }
    if (PHOTO.test(path) && !url.search) return 'photo';
    return 'bypass';
  }

  /** Saved pages are stored without the query string (?tab=…). */
  function pageKey(url) {
    var u = new URL(url);
    return u.origin + u.pathname;
  }

  function isCacheable(response, kind) {
    if (!response || response.status !== 200 || response.redirected) return false;
    if (response.type !== 'basic' && response.type !== 'default') return false;
    if (kind === 'page') {
      return (response.headers.get('content-type') || '').indexOf('text/html') === 0;
    }
    return true;
  }

  // A built file referenced from a saved page: in a src/href attribute, a CSS
  // url() or the inline React payload (where it follows an escaped quote).
  var ASSET = /(?<=["'(=\s\\])\/_next\/static\/[^"'\s\\<>)]+/g;

  /** The build files a saved page needs to run offline. */
  function assetsIn(html) {
    var found = String(html || '').match(ASSET) || [];
    return found.filter(function (item, i) {
      return found.indexOf(item) === i;
    });
  }

  /** Oldest keys to delete to bring a cache back to `limit` entries. */
  function excess(keys, limit) {
    return keys.length > limit ? keys.slice(0, keys.length - limit) : [];
  }

  var CURRENT = Object.keys(CACHES).map(function (k) {
    return CACHES[k];
  });

  /** Our caches from an older version of this worker. */
  function staleCaches(names) {
    return names.filter(function (name) {
      return name.indexOf('travel-') === 0 && CURRENT.indexOf(name) < 0;
    });
  }

  function strings(list) {
    return Array.isArray(list)
      ? list.filter(function (item, i) {
          return typeof item === 'string' && list.indexOf(item) === i;
        })
      : [];
  }

  /** A save request from a page, limited to our own saved pages. */
  function cleanSaveRequest(data) {
    var d = data || {};
    return {
      pages: strings(d.pages).filter(function (p) {
        return p.charAt(0) === '/' && p.charAt(1) !== '/' && isSavedPage(p);
      }),
    };
  }

  self.TravelSW = {
    CACHES: CACHES,
    PRIVATE_CACHES: PRIVATE_CACHES,
    LIMITS: LIMITS,
    OFFLINE_URL: OFFLINE_URL,
    NETWORK_TIMEOUT_MS: NETWORK_TIMEOUT_MS,
    classify: classify,
    pageKey: pageKey,
    isCacheable: isCacheable,
    assetsIn: assetsIn,
    excess: excess,
    staleCaches: staleCaches,
    cleanSaveRequest: cleanSaveRequest,
  };
})(self);
