// Who can call which trip endpoint. Viewers read; members tick boxes and add
// packing/grocery items; only admins change or delete anything else.
import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb } from '../support/test-db.mjs';
import { seedTrip } from '../support/fixtures.mjs';
import { actor } from '../support/users.mjs';
import { runHandler } from '../../src/lib/api/run.js';
import { createActivity, updateActivity, deleteActivity } from '../../src/lib/api/activities.js';
import { saveChecklistItem, deleteChecklistItem } from '../../src/lib/api/checklist.js';
import { toggleGroceryItem, createGroceryItem } from '../../src/lib/api/grocery.js';
import { saveLogisticsCard, deleteLogisticsCard } from '../../src/lib/api/logistics.js';
import { saveMeal } from '../../src/lib/api/meals.js';
import { archiveTrip, createTrip, deleteTrip, updateDay, updateTrip } from '../../src/lib/api/trips.js';

let db;
let trip;

before(async () => {
  db = await createTestDb();
});
after(() => db.cleanup());
beforeEach(async () => {
  await db.prisma.trip.deleteMany();
  trip = await seedTrip(db.prisma);
});

const firstChecklist = () => trip.checklist[0].id;
const key = (d) => new Date(d).toISOString().slice(0, 10);
const tripForm = () => ({
  id: trip.id, name: 'Renamed', tag: trip.tag, travelers: trip.travelers,
  startDate: key(trip.startDate), endDate: key(trip.endDate),
});

// [name, handler, body(), lowest role allowed]
const CASES = [
  ['tick a checklist item', saveChecklistItem, () => ({ id: firstChecklist(), isCompleted: true }), 'member'],
  ['add a checklist item', saveChecklistItem, () => ({ tripId: trip.id, text: 'Hats', category: 'packing' }), 'member'],
  ['rename a checklist item', saveChecklistItem, () => ({ id: firstChecklist(), text: 'Renamed' }), 'admin'],
  ['delete a checklist item', deleteChecklistItem, () => ({ id: firstChecklist() }), 'admin'],
  ['tick a grocery item', toggleGroceryItem, () => ({ id: trip.groceries[0].id, isBought: true }), 'member'],
  ['add a grocery item', createGroceryItem, () => ({ tripId: trip.id, name: 'Eggs', category: 'Breakfast' }), 'member'],
  ['add an activity', createActivity, () => ({ dayId: trip.days[0].id, description: 'Zoo' }), 'admin'],
  ['edit an activity', updateActivity, () => ({ id: trip.days[0].activities[0].id, description: 'Zoo' }), 'admin'],
  ['delete an activity', deleteActivity, () => ({ id: trip.days[0].activities[0].id }), 'admin'],
  ['save a logistics card', saveLogisticsCard, () => ({ tripId: trip.id, title: 'Car', content: 'Hertz' }), 'admin'],
  ['delete a logistics card', deleteLogisticsCard, () => ({ id: trip.logistics[0].id }), 'admin'],
  ['create a trip', createTrip, () => ({ name: 'New Place', tag: 'City', travelers: 'Us', startDate: '2030-01-01', endDate: '2030-01-02' }), 'admin'],
  ['edit a trip', updateTrip, tripForm, 'admin'],
  ['archive a trip', archiveTrip, () => ({ id: trip.id, archived: true }), 'admin'],
  ['delete a trip', deleteTrip, () => ({ id: trip.id, confirmName: trip.name }), 'admin'],
  ['rename a day', updateDay, () => ({ id: trip.days[0].id, title: 'Arrival' }), 'admin'],
  ['plan a meal', saveMeal, () => ({ tripId: trip.id, dayNumber: 2, mealType: 'Lunch', mealName: 'Subs' }), 'admin'],
];

const RANK = { viewer: 0, member: 1, admin: 2 };

describe('role matrix', () => {
  for (const [name, handler, body, minimum] of CASES) {
    test(`${name}: needs ${minimum}`, async () => {
      assert.equal((await runHandler(handler, { db: db.prisma, user: null, body: body() })).status, 401, 'anonymous');
      for (const role of ['viewer', 'member', 'admin']) {
        const res = await runHandler(handler, { db: db.prisma, user: actor(role), body: body() });
        const expected = RANK[role] >= RANK[minimum] ? 200 : 403;
        assert.equal(res.status, expected, `${role} → ${JSON.stringify(res.body)}`);
      }
    });
  }

  test('a disabled account is treated as signed out', async () => {
    const user = { ...actor('admin'), isActive: false };
    assert.equal((await runHandler(deleteActivity, { db: db.prisma, user, body: { id: trip.days[0].activities[0].id } })).status, 401);
  });

  test('members cannot sneak a rename in with a tick', async () => {
    const before = trip.checklist.find((i) => !i.isCompleted);
    const res = await runHandler(saveChecklistItem, { db: db.prisma, user: actor('member'), body: { id: before.id, isCompleted: true, text: 'Hacked' } });
    assert.equal(res.status, 403);
    const row = await db.prisma.checklistItem.findUnique({ where: { id: before.id } });
    assert.deepEqual([row.text, row.isCompleted], [before.text, false]);
  });
});
