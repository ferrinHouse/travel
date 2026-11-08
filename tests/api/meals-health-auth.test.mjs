import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb } from '../support/test-db.mjs';
import { seedTrip } from '../support/fixtures.mjs';
import { saveMeal } from '../../src/lib/api/meals.js';
import { checkHealth } from '../../src/lib/api/health.js';
import { runHandler } from '../../src/lib/api/run.js';
import { verifyPasscode } from '../../src/lib/auth/passcode.js';

let db;
let trip;
const admin = (body) => ({ db: db.prisma, isAdmin: true, body });
const guest = (body) => ({ db: db.prisma, isAdmin: false, body });
const mealsOn = (dayNumber) =>
  db.prisma.mealPlan.findMany({ where: { tripId: trip.id, dayNumber }, orderBy: { id: 'asc' } });

before(async () => {
  db = await createTestDb();
});
after(() => db.cleanup());
beforeEach(async () => {
  await db.prisma.trip.deleteMany();
  trip = await seedTrip(db.prisma);
});

describe('saveMeal', () => {
  test('requires admin', async () => {
    const res = await runHandler(saveMeal, guest({ tripId: trip.id, dayNumber: 1, mealType: 'Lunch', mealName: 'Subs' }));
    assert.equal(res.status, 401);
    assert.equal((await mealsOn(1)).length, 1);
  });

  test('creates a new meal slot', async () => {
    const res = await runHandler(saveMeal, admin({ tripId: trip.id, dayNumber: 2, mealType: 'Lunch', mealName: ' Subs ', time: '12:30 PM' }));
    assert.equal(res.status, 200);
    assert.equal(res.body.meal.mealName, 'Subs');
    assert.equal(res.body.meal.time, '12:30 PM');
    assert.equal((await mealsOn(2)).length, 1);
  });

  test('updating keeps the existing details and does not duplicate', async () => {
    const res = await runHandler(saveMeal, admin({ tripId: trip.id, dayNumber: 1, mealType: 'Dinner', mealName: 'Tacos', time: '7:00 PM' }));
    assert.equal(res.status, 200);
    const meals = await mealsOn(1);
    assert.equal(meals.length, 1);
    assert.equal(meals[0].mealName, 'Tacos');
    assert.equal(meals[0].details, 'Deep dish');
  });

  test('an empty name deletes the slot', async () => {
    const res = await runHandler(saveMeal, admin({ tripId: trip.id, dayNumber: 1, mealType: 'Dinner', mealName: '  ', time: '' }));
    assert.equal(res.status, 200);
    assert.equal(res.body.deleted, true);
    assert.equal((await mealsOn(1)).length, 0);
  });

  test('an empty name for an unplanned slot is a no-op', async () => {
    const res = await runHandler(saveMeal, admin({ tripId: trip.id, dayNumber: 2, mealType: 'Breakfast', mealName: '' }));
    assert.equal(res.status, 200);
    assert.equal(res.body.deleted, true);
    assert.equal(await db.prisma.mealPlan.count(), 1);
  });

  test('validates trip, day number and meal type', async () => {
    for (const body of [
      { dayNumber: 1, mealType: 'Lunch', mealName: 'Subs' },
      { tripId: trip.id, dayNumber: '1', mealType: 'Lunch', mealName: 'Subs' },
      { tripId: trip.id, dayNumber: 1, mealType: 'Brunch', mealName: 'Subs' },
      { tripId: trip.id, dayNumber: 1, mealType: 'Lunch', mealName: 42 },
      null,
    ]) {
      assert.equal((await runHandler(saveMeal, admin(body))).status, 400, JSON.stringify(body));
    }
    assert.equal(await db.prisma.mealPlan.count(), 1);
  });

  test('404 for an unknown trip', async () => {
    const res = await runHandler(saveMeal, admin({ tripId: 'nowhere', dayNumber: 1, mealType: 'Lunch', mealName: 'Subs' }));
    assert.equal(res.status, 404);
  });
});

describe('checkHealth', () => {
  test('ok when the database answers', async () => {
    const res = await runHandler(checkHealth, { db: db.prisma });
    assert.deepEqual(res, { status: 200, body: { status: 'ok' } });
  });

  test('503 when the database fails', async () => {
    const broken = { $queryRaw: async () => { throw new Error('disk gone'); } };
    const res = await runHandler(checkHealth, { db: broken });
    assert.equal(res.status, 503);
    assert.equal(res.body.status, 'error');
  });
});

describe('runHandler', () => {
  test('unexpected errors become a generic 500 without leaking details', async () => {
    const res = await runHandler(async () => {
      throw new Error('secret stack detail');
    }, {});
    assert.equal(res.status, 500);
    assert.deepEqual(res.body, { success: false, message: 'Server error' });
  });
});

describe('verifyPasscode', () => {
  test('accepts only the exact configured passcode', () => {
    assert.equal(verifyPasscode('open-sesame', 'open-sesame'), true);
    assert.equal(verifyPasscode('open-sesame ', 'open-sesame'), false);
    assert.equal(verifyPasscode('OPEN-SESAME', 'open-sesame'), false);
    assert.equal(verifyPasscode('', 'open-sesame'), false);
  });

  test('refuses everything when no passcode is configured (no default)', () => {
    for (const configured of [undefined, null, '']) {
      assert.equal(verifyPasscode('admin', configured), false);
      assert.equal(verifyPasscode('', configured), false);
    }
  });

  test('rejects non-string input', () => {
    assert.equal(verifyPasscode(undefined, 'x'), false);
    assert.equal(verifyPasscode(123, '123'), false);
    assert.equal(verifyPasscode(['x'], 'x'), false);
  });
});
