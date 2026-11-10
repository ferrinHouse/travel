import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb } from '../support/test-db.mjs';
import { seedTrip } from '../support/fixtures.mjs';
import { toggleGroceryItem, createGroceryItem } from '../../src/lib/api/grocery.js';
import { saveLogisticsCard, deleteLogisticsCard } from '../../src/lib/api/logistics.js';
import { actor } from '../support/users.mjs';
import { runHandler } from '../../src/lib/api/run.js';

let db;
let trip;
const admin = (body) => ({ db: db.prisma, user: actor('admin'), body });
const guest = (body) => ({ db: db.prisma, user: null, body });
const member = (body) => ({ db: db.prisma, user: actor('member'), body });

before(async () => {
  db = await createTestDb();
});
after(() => db.cleanup());
beforeEach(async () => {
  await db.prisma.trip.deleteMany();
  trip = await seedTrip(db.prisma);
});

describe('toggleGroceryItem', () => {
  test('members can mark an item bought and unbought', async () => {
    const milk = trip.groceries.find((g) => g.name === 'Milk');
    let res = await runHandler(toggleGroceryItem, member({ id: milk.id, isBought: true }));
    assert.equal(res.status, 200);
    assert.equal(res.body.item.isBought, true);
    res = await runHandler(toggleGroceryItem, member({ id: milk.id, isBought: false }));
    assert.equal(res.body.item.isBought, false);
  });

  test('a tick queued offline must come from the person now signed in', async () => {
    const milk = trip.groceries.find((g) => g.name === 'Milk');
    const user = actor('member');
    const own = await runHandler(toggleGroceryItem, { db: db.prisma, user, body: { id: milk.id, isBought: true, queuedBy: `u${user.id}` } });
    assert.equal(own.status, 200);
    const other = await runHandler(toggleGroceryItem, member({ id: milk.id, isBought: false, queuedBy: 'u999999' }));
    assert.equal(other.status, 409);
    assert.equal((await db.prisma.groceryItem.findUnique({ where: { id: milk.id } })).isBought, true);
  });

  test('validates input and 404s unknown items', async () => {
    const milk = trip.groceries.find((g) => g.name === 'Milk');
    assert.equal((await runHandler(toggleGroceryItem, member({ id: milk.id }))).status, 400);
    assert.equal((await runHandler(toggleGroceryItem, member({ id: milk.id, isBought: 1 }))).status, 400);
    assert.equal((await runHandler(toggleGroceryItem, member(null))).status, 400);
    assert.equal((await runHandler(toggleGroceryItem, member({ id: 999999, isBought: true }))).status, 404);
  });
});

describe('createGroceryItem', () => {
  test('requires admin', async () => {
    const res = await runHandler(createGroceryItem, guest({ tripId: trip.id, name: 'Eggs', category: 'Breakfast' }));
    assert.equal(res.status, 401);
    assert.equal(await db.prisma.groceryItem.count(), 2);
  });

  test('admin adds a trimmed, unbought item', async () => {
    const res = await runHandler(createGroceryItem, admin({ tripId: trip.id, name: ' Eggs ', category: 'Breakfast' }));
    assert.equal(res.status, 200);
    assert.deepEqual(
      { name: res.body.item.name, category: res.body.item.category, isBought: res.body.item.isBought },
      { name: 'Eggs', category: 'Breakfast', isBought: false }
    );
  });

  test('rejects missing fields and unknown trips', async () => {
    assert.equal((await runHandler(createGroceryItem, admin({ tripId: trip.id, name: '', category: 'Snacks' }))).status, 400);
    assert.equal((await runHandler(createGroceryItem, admin({ tripId: trip.id, name: 'Eggs' }))).status, 400);
    assert.equal((await runHandler(createGroceryItem, admin({ tripId: 'nowhere', name: 'Eggs', category: 'Snacks' }))).status, 404);
  });
});

describe('saveLogisticsCard', () => {
  test('requires admin for create and update', async () => {
    assert.equal((await runHandler(saveLogisticsCard, guest({ tripId: trip.id, title: 'Car', content: 'Hertz' }))).status, 401);
    assert.equal((await runHandler(saveLogisticsCard, guest({ id: trip.logistics[0].id, title: 'X', content: 'Y' }))).status, 401);
    assert.equal(await db.prisma.logisticsCard.count(), 2);
  });

  test('creates a card at the end', async () => {
    const res = await runHandler(saveLogisticsCard, admin({ tripId: trip.id, title: ' Rental car ', content: 'Hertz #9' }));
    assert.equal(res.status, 200);
    assert.equal(res.body.card.title, 'Rental car');
    assert.equal(res.body.card.order, 2);
  });

  test('updates an existing card', async () => {
    const res = await runHandler(saveLogisticsCard, admin({ id: trip.logistics[1].id, title: 'Hotel', content: 'Conf #43' }));
    assert.equal(res.status, 200);
    assert.equal(res.body.card.content, 'Conf #43');
    assert.equal(res.body.card.order, 1);
  });

  test('validates input', async () => {
    assert.equal((await runHandler(saveLogisticsCard, admin({ tripId: trip.id, title: 'Car', content: '  ' }))).status, 400);
    assert.equal((await runHandler(saveLogisticsCard, admin({ tripId: trip.id, title: '', content: 'x' }))).status, 400);
    assert.equal((await runHandler(saveLogisticsCard, admin({ title: 'Car', content: 'x' }))).status, 400);
    assert.equal((await runHandler(saveLogisticsCard, admin({ id: 'abc', title: 'Car', content: 'x' }))).status, 400);
    assert.equal((await runHandler(saveLogisticsCard, admin(null))).status, 400);
  });

  test('404 for unknown trip or card', async () => {
    assert.equal((await runHandler(saveLogisticsCard, admin({ tripId: 'nowhere', title: 'Car', content: 'x' }))).status, 404);
    assert.equal((await runHandler(saveLogisticsCard, admin({ id: 999999, title: 'Car', content: 'x' }))).status, 404);
  });
});

describe('deleteLogisticsCard', () => {
  test('requires admin', async () => {
    assert.equal((await runHandler(deleteLogisticsCard, guest({ id: trip.logistics[0].id }))).status, 401);
    assert.equal(await db.prisma.logisticsCard.count(), 2);
  });

  test('deletes; 404 when already gone; 400 for bad id', async () => {
    const id = trip.logistics[0].id;
    assert.equal((await runHandler(deleteLogisticsCard, admin({ id }))).status, 200);
    assert.equal((await runHandler(deleteLogisticsCard, admin({ id }))).status, 404);
    assert.equal((await runHandler(deleteLogisticsCard, admin({}))).status, 400);
  });
});
