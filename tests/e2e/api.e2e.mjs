// Real HTTP requests against the built app: routing, cookies, the sign-in
// redirect, cross-site write blocking and role checks through the route adapter.
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { sessionCookieHeader, startApp } from './support/server.mjs';

let app;
let trip;

const call = (method, path, body, headers = {}) =>
  fetch(`${app.apiURL}${path}`, {
    method,
    redirect: 'manual',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });

const cookieFrom = (res) => res.headers.get('set-cookie')?.split(';')[0];

before(async () => {
  app = await startApp();
  trip = await app.prisma.trip.findUnique({
    where: { id: 'testville' },
    include: { days: { include: { activities: true } }, checklist: true, logistics: true, groceries: true },
  });
});
after(() => app?.stop());

describe('health', () => {
  test('GET /api/health is ok without signing in', async () => {
    const res = await call('GET', '/api/health');
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: 'ok' });
  });
});

describe('pages need a session', () => {
  test('signed-out page loads redirect to /login with where they were going', async () => {
    for (const [path, location] of [
      ['/', '/login'],
      ['/trips/testville?tab=meals', '/login?next=%2Ftrips%2Ftestville%3Ftab%3Dmeals'],
      ['/account', '/login?next=%2Faccount'],
      ['/admin/users', '/login?next=%2Fadmin%2Fusers'],
    ]) {
      const res = await call('GET', path);
      assert.equal(res.status, 307, path);
      assert.equal(new URL(res.headers.get('location'), app.apiURL).pathname + new URL(res.headers.get('location'), app.apiURL).search, location, path);
    }
  });

  test('a stale cookie still ends on the login page (the page checks the session, not just the cookie)', async () => {
    const res = await call('GET', '/trips/testville', undefined, { cookie: 'travel_session=not-a-real-session' });
    assert.equal(res.status, 307);
    assert.match(res.headers.get('location'), /\/login\?next=/);
  });

  test('the sign-in page itself is open', async () => {
    assert.equal((await call('GET', '/login')).status, 200);
  });

  test('/setup is gone once users exist', async () => {
    assert.equal((await call('GET', '/setup')).status, 404);
    assert.equal((await call('POST', '/api/auth/setup', { token: 'e2e-setup-token', username: 'x', password: 'long enough pw' })).status, 404);
  });
});

describe('password sign-in over HTTP', () => {
  test('wrong password: 401 and no cookie', async () => {
    const res = await call('POST', '/api/auth/login', { username: 'member', password: 'nope nope nope' });
    assert.equal(res.status, 401);
    assert.equal(res.headers.get('set-cookie'), null);
  });

  test('malformed body is a 400', async () => {
    assert.equal((await call('POST', '/api/auth/login', '{not json')).status, 400);
  });

  test('right password sets an httpOnly, SameSite=Lax session cookie; /me reflects it; logout ends it', async () => {
    const res = await call('POST', '/api/auth/login', { username: 'Member', password: app.password });
    assert.equal(res.status, 200);
    const setCookie = res.headers.get('set-cookie');
    assert.match(setCookie, /^travel_session=[\w-]{43};/);
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Lax/i);
    assert.match(setCookie, /Max-Age=7776000/);
    assert.doesNotMatch(setCookie, /Secure/i, 'plain http in tests (APP_ORIGIN is http://localhost)');
    const cookie = cookieFrom(res);

    const me = await (await call('GET', '/api/auth/me', undefined, { cookie })).json();
    assert.equal(me.user.username, 'member');
    assert.equal(me.user.passwordHash, undefined);
    assert.equal((await (await call('GET', '/api/auth/me')).json()).user, null);

    const out = await call('POST', '/api/auth/logout', {}, { cookie });
    assert.match(out.headers.get('set-cookie'), /travel_session=;/);
    assert.equal((await (await call('GET', '/api/auth/me', undefined, { cookie })).json()).user, null, 'session is dead server-side');
  });

  test('a dead session cookie is cleared by the next API call', async () => {
    const res = await call('GET', '/api/auth/me', undefined, { cookie: 'travel_session=forged' });
    assert.match(res.headers.get('set-cookie') ?? '', /travel_session=;/);
  });
});

describe('cross-site writes are blocked', () => {
  test('a foreign Origin gets 403 even with a valid session', async () => {
    const cookie = await sessionCookieHeader(app, 'admin');
    const item = trip.checklist[0];
    const res = await call('DELETE', '/api/checklist', { id: item.id }, { cookie, origin: 'https://evil.example' });
    assert.equal(res.status, 403);
    assert.ok(await app.prisma.checklistItem.findUnique({ where: { id: item.id } }), 'nothing deleted');
  });

  test('our own Origin is fine', async () => {
    const cookie = await sessionCookieHeader(app, 'member');
    const grocery = trip.groceries[0];
    const res = await call('POST', '/api/grocery', { id: grocery.id, isBought: true }, { cookie, origin: app.baseURL });
    assert.equal(res.status, 200);
  });

  test('a cross-site login attempt is blocked too', async () => {
    const res = await call('POST', '/api/auth/login', { username: 'member', password: app.password }, { origin: 'https://evil.example' });
    assert.equal(res.status, 403);
    assert.equal(res.headers.get('set-cookie'), null);
  });
});

describe('roles through the real routes', () => {
  const adminOnly = () => [
    ['PUT', '/api/activities', { dayId: trip.days[0].id, description: 'Sneaky' }],
    ['POST', '/api/activities', { id: trip.days[0].activities[0].id, description: 'Sneaky' }],
    ['DELETE', '/api/activities', { id: trip.days[0].activities[0].id }],
    ['POST', '/api/checklist', { id: trip.checklist[0].id, text: 'Sneaky' }],
    ['DELETE', '/api/checklist', { id: trip.checklist[0].id }],
    ['POST', '/api/logistics', { tripId: trip.id, title: 'Sneaky', content: 'x' }],
    ['DELETE', '/api/logistics', { id: trip.logistics[0].id }],
    ['POST', '/api/meals', { tripId: trip.id, dayNumber: 2, mealType: 'Lunch', mealName: 'Sneaky' }],
    ['GET', '/api/users'],
    ['POST', '/api/users', { username: 'sneaky', displayName: 'Sneaky', role: 'admin' }],
  ];

  test('signed out: 401 everywhere, nothing changes', async () => {
    const before = JSON.stringify(await snapshot());
    for (const [method, path, body] of adminOnly()) {
      const res = await call(method, path, body);
      assert.equal(res.status, 401, `${method} ${path}`);
    }
    assert.equal((await call('POST', '/api/grocery', { id: trip.groceries[0].id, isBought: true })).status, 401, 'even ticking');
    assert.equal(JSON.stringify(await snapshot()), before);
  });

  test('members: 403 on admin endpoints, nothing changes', async () => {
    const cookie = await sessionCookieHeader(app, 'member');
    const before = JSON.stringify(await snapshot());
    for (const [method, path, body] of adminOnly()) {
      const res = await call(method, path, body, { cookie });
      assert.equal(res.status, 403, `${method} ${path}`);
    }
    assert.equal(JSON.stringify(await snapshot()), before);
  });

  test('viewers cannot tick; members can', async () => {
    const item = trip.checklist.find((i) => !i.isCompleted);
    const viewer = await sessionCookieHeader(app, 'viewer');
    assert.equal((await call('POST', '/api/checklist', { id: item.id, isCompleted: true }, { cookie: viewer })).status, 403);
    const member = await sessionCookieHeader(app, 'member');
    assert.equal((await call('POST', '/api/checklist', { id: item.id, isCompleted: true }, { cookie: member })).status, 200);
    assert.equal((await app.prisma.checklistItem.findUnique({ where: { id: item.id } })).isCompleted, true);
  });

  test('admins can use admin endpoints', async () => {
    const cookie = await sessionCookieHeader(app, 'admin');
    const res = await call('PUT', '/api/grocery', { tripId: trip.id, name: 'Admin eggs', category: 'Breakfast' }, { cookie });
    assert.equal(res.status, 200);
    const users = await (await call('GET', '/api/users', undefined, { cookie })).json();
    assert.deepEqual(users.users.map((u) => u.username).sort(), ['admin', 'member', 'viewer']);
  });

  test('invalid JSON is a 400 and unknown ids are 404', async () => {
    const cookie = await sessionCookieHeader(app, 'member');
    assert.equal((await call('POST', '/api/checklist', '{oops', { cookie })).status, 400);
    assert.equal((await call('POST', '/api/grocery', { id: 999999, isBought: true }, { cookie })).status, 404);
  });

  test('API responses are never cached', async () => {
    const cookie = await sessionCookieHeader(app, 'member');
    assert.match((await call('GET', '/api/auth/me', undefined, { cookie })).headers.get('cache-control'), /no-store/);
  });
});

describe('rate limiting', () => {
  test('repeated wrong passwords for one account are cut off with 429', async () => {
    let last;
    for (let i = 0; i < 21; i++) {
      last = await call('POST', '/api/auth/login', { username: 'viewer', password: `wrong guess ${i}` });
    }
    assert.equal(last.status, 429);
    assert.ok((await last.json()).retryAfterSeconds > 0);
  });
});

async function snapshot() {
  const p = app.prisma;
  return {
    activities: await p.itineraryActivity.findMany({ orderBy: { id: 'asc' } }),
    checklist: await p.checklistItem.findMany({ orderBy: { id: 'asc' }, select: { id: true, text: true, category: true } }),
    groceries: await p.groceryItem.findMany({ orderBy: { id: 'asc' }, select: { id: true, name: true } }),
    logistics: await p.logisticsCard.findMany({ orderBy: { id: 'asc' } }),
    meals: await p.mealPlan.findMany({ orderBy: { id: 'asc' } }),
    users: await p.user.findMany({ orderBy: { id: 'asc' }, select: { username: true, role: true } }),
  };
}
