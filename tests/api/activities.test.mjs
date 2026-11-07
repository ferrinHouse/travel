import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb } from '../support/test-db.mjs';
import { seedTrip } from '../support/fixtures.mjs';
import { createActivity, updateActivity, deleteActivity } from '../../src/lib/api/activities.js';
import { runHandler } from '../../src/lib/api/run.js';

let db;
let trip;
const admin = (body) => ({ db: db.prisma, isAdmin: true, body });
const guest = (body) => ({ db: db.prisma, isAdmin: false, body });

before(async () => {
  db = await createTestDb();
});
after(() => db.cleanup());
beforeEach(async () => {
  await db.prisma.trip.deleteMany();
  trip = await seedTrip(db.prisma);
});

describe('createActivity', () => {
  test('requires admin', async () => {
    const res = await runHandler(createActivity, guest({ dayId: trip.days[0].id, description: 'Zoo' }));
    assert.equal(res.status, 401);
    assert.equal(await db.prisma.itineraryActivity.count(), 2);
  });

  test('appends to the end of the day', async () => {
    const day = trip.days[0];
    const res = await runHandler(createActivity, admin({ dayId: day.id, time: '3:00 PM', description: 'Zoo', details: 'Lions', isAlert: true }));
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.activity.description, 'Zoo');
    assert.equal(res.body.activity.order, 2);
    assert.equal(res.body.activity.isAlert, true);
    assert.equal(res.body.activity.dayId, day.id);
  });

  test('first activity on an empty day gets order 0', async () => {
    const res = await runHandler(createActivity, admin({ dayId: trip.days[1].id, description: 'Beach' }));
    assert.equal(res.body.activity.order, 0);
    assert.equal(res.body.activity.isAlert, false);
  });

  test('rejects missing or blank description and bad dayId', async () => {
    for (const body of [
      { dayId: trip.days[0].id },
      { dayId: trip.days[0].id, description: '   ' },
      { dayId: String(trip.days[0].id), description: 'Zoo' },
      { description: 'Zoo' },
      null,
    ]) {
      const res = await runHandler(createActivity, admin(body));
      assert.equal(res.status, 400, JSON.stringify(body));
    }
  });

  test('returns 404 for an unknown day', async () => {
    const res = await runHandler(createActivity, admin({ dayId: 999999, description: 'Zoo' }));
    assert.equal(res.status, 404);
  });

  test('trims the description', async () => {
    const res = await runHandler(createActivity, admin({ dayId: trip.days[0].id, description: '  Zoo  ' }));
    assert.equal(res.body.activity.description, 'Zoo');
  });
});

describe('updateActivity', () => {
  test('requires admin', async () => {
    const act = trip.days[0].activities[0];
    const res = await runHandler(updateActivity, guest({ id: act.id, description: 'Changed' }));
    assert.equal(res.status, 401);
    const unchanged = await db.prisma.itineraryActivity.findUnique({ where: { id: act.id } });
    assert.equal(unchanged.description, 'Museum visit');
  });

  test('updates fields', async () => {
    const act = trip.days[0].activities[0];
    const res = await runHandler(updateActivity, admin({ id: act.id, time: '11:00 AM', description: 'Art museum', details: 'Free Thursday', isAlert: true }));
    assert.equal(res.status, 200);
    assert.deepEqual(
      { time: res.body.activity.time, description: res.body.activity.description, details: res.body.activity.details, isAlert: res.body.activity.isAlert },
      { time: '11:00 AM', description: 'Art museum', details: 'Free Thursday', isAlert: true }
    );
  });

  test('rejects invalid input', async () => {
    const act = trip.days[0].activities[0];
    for (const body of [{ id: act.id }, { id: act.id, description: '' }, { id: 'x', description: 'Hi' }, null]) {
      const res = await runHandler(updateActivity, admin(body));
      assert.equal(res.status, 400, JSON.stringify(body));
    }
  });

  test('returns 404 for an unknown activity', async () => {
    const res = await runHandler(updateActivity, admin({ id: 999999, description: 'Ghost' }));
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
  });
});

describe('deleteActivity', () => {
  test('requires admin', async () => {
    const res = await runHandler(deleteActivity, guest({ id: trip.days[0].activities[0].id }));
    assert.equal(res.status, 401);
    assert.equal(await db.prisma.itineraryActivity.count(), 2);
  });

  test('deletes the activity', async () => {
    const id = trip.days[0].activities[0].id;
    const res = await runHandler(deleteActivity, admin({ id }));
    assert.equal(res.status, 200);
    assert.equal(await db.prisma.itineraryActivity.findUnique({ where: { id } }), null);
  });

  test('400 for a bad id and 404 for an unknown one', async () => {
    assert.equal((await runHandler(deleteActivity, admin({ id: 'nope' }))).status, 400);
    assert.equal((await runHandler(deleteActivity, admin({ id: 999999 }))).status, 404);
  });
});
