import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSwCore } from './support/sw-core.mjs';

const SW = loadSwCore();
const ORIGIN = 'https://travel.example';

/** A request-like object: what the fetch handler sees. */
const req = (path, { method = 'GET', mode = 'cors', headers = {} } = {}) => ({
  url: path.startsWith('http') ? path : `${ORIGIN}${path}`,
  method,
  mode,
  headers: new Headers(headers),
});
const nav = (path) => req(path, { mode: 'navigate', headers: { accept: 'text/html' } });
const kind = (r) => SW.classify(r, ORIGIN);

describe('classify', () => {
  test('built files, fonts and icons are cache-first static assets', () => {
    for (const p of ['/_next/static/chunks/app.js', '/_next/static/media/inter.woff2', '/_next/static/css/a.css', '/icons/icon-192.png', '/apple-icon.png', '/icon.svg', '/favicon.ico']) {
      assert.equal(kind(req(p)), 'static', p);
    }
  });

  test('the dashboard, trip pages and story pages are saved for offline', () => {
    for (const p of ['/', '/trips/chicago', '/trips/chicago?tab=meals', '/trips/new-york-2027', '/trips/chicago/story']) {
      assert.equal(kind(nav(p)), 'page', p);
    }
  });

  test('other pages load from the network only (offline page if that fails)', () => {
    for (const p of ['/login', '/setup', '/account', '/admin/users', '/trips/new', '/trips/chicago/edit', '/invite/abc', '/share/abc', '/offline']) {
      assert.equal(kind(nav(p)), 'navigate', p);
    }
  });

  test('small and large photos are cached; originals and downloads never are', () => {
    assert.equal(kind(req('/api/photos/12/sm')), 'photo');
    assert.equal(kind(req('/api/photos/12/lg')), 'photo');
    assert.equal(kind(req('/api/photos/12/orig')), 'bypass');
    assert.equal(kind(req('/api/photos/12/lg?download=1')), 'bypass');
  });

  test('never touched: writes, other APIs, shared links, RSC data, other origins, the worker itself', () => {
    const cases = [
      req('/api/checklist', { method: 'POST' }),
      req('/trips/chicago', { method: 'POST', mode: 'navigate' }),
      req('/api/auth/me'),
      req('/api/account/passkeys'),
      req('/api/users'),
      req('/api/share/tok/1/sm'),
      req('/api/health'),
      req('/trips/chicago', { headers: { rsc: '1' } }),
      req('/trips/chicago?_rsc=abc12'),
      nav('/trips/chicago?_rsc=abc12'),
      req('https://fonts.example/x.woff2'),
      nav('https://elsewhere.example/'),
      req('/sw.js'),
      req('/sw-core.js'),
      req('/manifest.webmanifest'),
    ];
    for (const r of cases) assert.equal(kind(r), 'bypass', `${r.method} ${r.url} ${r.headers.get('rsc') ?? ''}`);
  });
});

describe('pageKey', () => {
  test('one saved copy per page, whatever tab is in the address', () => {
    assert.equal(SW.pageKey(`${ORIGIN}/trips/chicago?tab=meals`), `${ORIGIN}/trips/chicago`);
    assert.equal(SW.pageKey(`${ORIGIN}/`), `${ORIGIN}/`);
  });
});

describe('isCacheable', () => {
  const html = (init = {}) =>
    Object.assign(new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' }, ...init }), init.extra);

  test('a normal page response is kept', () => {
    assert.equal(SW.isCacheable(html(), 'page'), true);
  });

  test('errors, redirects (e.g. to sign-in) and non-HTML pages are not', () => {
    assert.equal(SW.isCacheable(new Response('x', { status: 404, headers: { 'content-type': 'text/html' } }), 'page'), false);
    assert.equal(SW.isCacheable({ ok: true, status: 200, type: 'basic', redirected: true, headers: new Headers({ 'content-type': 'text/html' }) }, 'page'), false);
    assert.equal(SW.isCacheable(new Response('{}', { headers: { 'content-type': 'application/json' } }), 'page'), false);
    assert.equal(SW.isCacheable({ ok: false, status: 0, type: 'opaque', redirected: false, headers: new Headers() }, 'static'), false);
    assert.equal(SW.isCacheable(null, 'static'), false);
  });

  test('assets and photos only need a plain 200', () => {
    assert.equal(SW.isCacheable(new Response('x', { headers: { 'content-type': 'image/webp' } }), 'photo'), true);
    assert.equal(SW.isCacheable(new Response('x', { status: 206 }), 'photo'), false);
  });
});

describe('assetsIn', () => {
  test('finds each built script, stylesheet and font a saved page needs, once', () => {
    const page = `
      <link rel="preload" href="/_next/static/media/inter.p.woff2" as="font"/>
      <link rel="stylesheet" href="/_next/static/css/app.css" data-precedence="next"/>
      <script src="/_next/static/chunks/main.js" async=""></script>
      <script src="/_next/static/chunks/main.js" async=""></script>
      <script>self.__next_f.push([1,"\\"/_next/static/chunks/page-abc.js\\""])</script>
      <img src="/api/photos/1/sm"><a href="https://cdn.example/_next/static/x.js">x</a>`;
    assert.deepEqual(SW.assetsIn(page).sort(), [
      '/_next/static/chunks/main.js',
      '/_next/static/chunks/page-abc.js',
      '/_next/static/css/app.css',
      '/_next/static/media/inter.p.woff2',
    ]);
  });

  test('nothing to find is an empty list', () => {
    assert.deepEqual(SW.assetsIn(''), []);
  });
});

describe('cache housekeeping', () => {
  test('the oldest entries go first when a cache is over its limit', () => {
    assert.deepEqual(SW.excess(['a', 'b', 'c', 'd'], 2), ['a', 'b']);
    assert.deepEqual(SW.excess(['a'], 2), []);
  });

  test('only our own out-of-date caches are deleted on upgrade', () => {
    const current = Object.values(SW.CACHES);
    assert.deepEqual(SW.staleCaches(['travel-static-v0', 'other-app', ...current]), ['travel-static-v0']);
  });

  test('signing out clears saved pages and photos but keeps shared built files', () => {
    assert.deepEqual(SW.PRIVATE_CACHES.sort(), [SW.CACHES.pages, SW.CACHES.photos].sort());
    assert.ok(!SW.PRIVATE_CACHES.includes(SW.CACHES.static));
  });
});

describe('save requests', () => {
  test('only our own pages and photo URLs are accepted from the page', () => {
    const clean = SW.cleanSaveRequest({
      pages: ['/trips/chicago', '/account', 'https://evil.example/', '/trips/chicago', 42],
      photos: ['/api/photos/1/sm', '/api/photos/2/lg', '/api/photos/3/orig', '/etc/passwd', null],
    });
    assert.deepEqual(clean, { pages: ['/trips/chicago'], photos: ['/api/photos/1/sm', '/api/photos/2/lg'] });
  });

  test('a missing or odd payload saves nothing', () => {
    assert.deepEqual(SW.cleanSaveRequest(undefined), { pages: [], photos: [] });
    assert.deepEqual(SW.cleanSaveRequest({ pages: 'x' }), { pages: [], photos: [] });
  });
});
