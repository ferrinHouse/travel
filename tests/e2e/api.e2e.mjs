// Real HTTP requests against the built app: routing, cookies and auth wiring.
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './support/server.mjs';

let app;
let trip;

const call = (method, path, body, headers = {}) =>
  fetch(`${app.baseURL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });

async function adminCookie() {
  const res = await call('POST', '/api/auth', { passcode: app.passcode });
  assert.equal(res.status, 200);
  return res.headers.get('set-cookie').split(';')[0];
}

before(async () => {
  app = await startApp();
  trip = await app.prisma.trip.findUnique({
    where: { id: 'testville' },
    include: { days: { include: { activities: true } }, checklist: true, logistics: true, groceries: true },
  });
});
after(() => app?.stop());

describe('health', () => {
  test('GET /api/health is ok', async () => {
    const res = await call('GET', '/api/health');
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: 'ok' });
  });
});

describe('passcode login', () => {
  test('wrong passcode is rejected and sets no cookie', async () => {
    const res = await call('POST', '/api/auth', { passcode: 'nope' });
    assert.equal(res.status, 401);
    assert.equal(res.headers.get('set-cookie'), null);
  });

  test('missing or malformed body is rejected', async () => {
    assert.equal((await call('POST', '/api/auth', '{not json')).status, 401);
    assert.equal((await call('POST', '/api/auth', {})).status, 401);
  });

  test('correct passcode sets an httpOnly, SameSite=Strict cookie; GET reflects it; DELETE clears it', async () => {
    const res = await call('POST', '/api/auth', { passcode: app.passcode });
    assert.equal(res.status, 200);
    const setCookie = res.headers.get('set-cookie');
    assert.match(setCookie, /admin_authenticated=true/);
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Strict/i);
    const cookie = setCookie.split(';')[0];

    assert.deepEqual(await (await call('GET', '/api/auth', undefined, { cookie })).json(), { authenticated: true });
    assert.deepEqual(await (await call('GET', '/api/auth')).json(), { authenticated: false });

    const out = await call('DELETE', '/api/auth', undefined, { cookie });
    assert.match(out.headers.get('set-cookie'), /admin_authenticated=;/);
  });
});

describe('mutations require edit mode', () => {
  const cases = () => [
    ['PUT', '/api/activities', { dayId: trip.days[0].id, description: 'Sneaky' }],
    ['POST', '/api/activities', { id: trip.days[0].activities[0].id, description: 'Sneaky' }],
    ['DELETE', '/api/activities', { id: trip.days[0].activities[0].id }],
    ['POST', '/api/checklist', { tripId: trip.id, text: 'Sneaky', category: 'packing' }],
    ['POST', '/api/checklist', { id: trip.checklist[0].id, text: 'Sneaky' }],
    ['DELETE', '/api/checklist', { id: trip.checklist[0].id }],
    ['PUT', '/api/grocery', { tripId: trip.id, name: 'Sneaky', category: 'Snacks' }],
    ['POST', '/api/logistics', { tripId: trip.id, title: 'Sneaky', content: 'x' }],
    ['POST', '/api/logistics', { id: trip.logistics[0].id, title: 'Sneaky', content: 'x' }],
    ['DELETE', '/api/logistics', { id: trip.logistics[0].id }],
    ['POST', '/api/meals', { tripId: trip.id, dayNumber: 2, mealType: 'Lunch', mealName: 'Sneaky' }],
  ];

  test('every admin endpoint returns 401 without the cookie and changes nothing', async () => {
    const before = JSON.stringify(await snapshot());
    for (const [method, path, body] of cases()) {
      const res = await call(method, path, body);
      assert.equal(res.status, 401, `${method} ${path} ${JSON.stringify(body)}`);
      assert.equal((await res.json()).success, false);
    }
    assert.equal(JSON.stringify(await snapshot()), before);
  });

  test('a forged cookie value other than "true" is not accepted', async () => {
    const res = await call('PUT', '/api/grocery', { tripId: trip.id, name: 'Sneaky', category: 'Snacks' }, { cookie: 'admin_authenticated=yes' });
    assert.equal(res.status, 401);
  });

  test('with the cookie, an admin endpoint works', async () => {
    const cookie = await adminCookie();
    const res = await call('PUT', '/api/grocery', { tripId: trip.id, name: 'Admin eggs', category: 'Breakfast' }, { cookie });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).item.name, 'Admin eggs');
  });
});

describe('open endpoints', () => {
  test('anyone can tick checklist and grocery items', async () => {
    const item = trip.checklist.find((i) => !i.isCompleted);
    assert.equal((await call('POST', '/api/checklist', { id: item.id, isCompleted: true })).status, 200);
    assert.equal((await app.prisma.checklistItem.findUnique({ where: { id: item.id } })).isCompleted, true);

    const grocery = trip.groceries.find((g) => !g.isBought);
    assert.equal((await call('POST', '/api/grocery', { id: grocery.id, isBought: true })).status, 200);
    assert.equal((await app.prisma.groceryItem.findUnique({ where: { id: grocery.id } })).isBought, true);
  });

  test('invalid JSON is a 400, not a 500', async () => {
    const res = await call('POST', '/api/checklist', '{oops');
    assert.equal(res.status, 400);
  });

  test('unknown ids are 404', async () => {
    assert.equal((await call('POST', '/api/grocery', { id: 999999, isBought: true })).status, 404);
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
  };
}
