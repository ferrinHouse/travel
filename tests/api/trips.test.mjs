// Creating, editing, archiving and deleting trips, and renaming days.
import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb } from '../support/test-db.mjs';
import { seedTrip } from '../support/fixtures.mjs';
import { actor } from '../support/users.mjs';
import { runHandler } from '../../src/lib/api/run.js';
import { archiveTrip, createTrip, deleteTrip, updateDay, updateTrip } from '../../src/lib/api/trips.js';
import { STARTER_CHECKLIST } from '../../src/lib/trips/checklist-templates.js';

let db;
let trip;
const as = (role, body, extra = {}) => ({ db: db.prisma, user: role ? actor(role) : null, body, ...extra });
const call = (handler, body, role = 'admin', extra) => runHandler(handler, as(role, body, extra));

const lakeWeek = {
  name: 'Lake Week',
  tag: 'Beach',
  travelers: 'Family of 6',
  description: 'Cabin by the lake.',
  startDate: '2027-07-01',
  endDate: '2027-07-03',
  primaryColor: '#2c7a7b',
  accentColor: '#ed8936',
};

before(async () => {
  db = await createTestDb();
});
after(() => db.cleanup());
beforeEach(async () => {
  await db.prisma.trip.deleteMany();
  trip = await seedTrip(db.prisma);
});

const load = (id) =>
  db.prisma.trip.findUnique({
    where: { id },
    include: { days: { orderBy: { dayNumber: 'asc' } }, checklist: { orderBy: { id: 'asc' } } },
  });

describe('createTrip', () => {
  test('creates the trip with one day per date and a starter checklist', async () => {
    const res = await call(createTrip, lakeWeek);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.trip.id, 'lake-week');

    const saved = await load('lake-week');
    assert.equal(saved.name, 'Lake Week');
    assert.equal(saved.dates, 'July 1 – 3, 2027');
    assert.equal(saved.status, 'upcoming');
    assert.equal(saved.primaryColor, '#2c7a7b');
    assert.equal(saved.archivedAt, null);
    assert.equal(new Date(saved.startDate).toISOString(), '2027-07-01T00:00:00.000Z');
    assert.deepEqual(saved.days.map((d) => d.dateLabel), [
      'Day 1: Thursday, July 1',
      'Day 2: Friday, July 2',
      'Day 3: Saturday, July 3',
    ]);
    assert.equal(saved.checklist.length, STARTER_CHECKLIST.length);
    assert.ok(saved.checklist.every((i) => !i.isCompleted));
  });

  test('a trip in the past is marked past', async () => {
    const res = await call(createTrip, { ...lakeWeek, startDate: '2020-07-01', endDate: '2020-07-02' });
    assert.equal(res.status, 200);
    assert.equal((await load(res.body.trip.id)).status, 'past');
  });

  test('checklist can start empty', async () => {
    const res = await call(createTrip, { ...lakeWeek, checklistFrom: 'none' });
    assert.equal((await load(res.body.trip.id)).checklist.length, 0);
  });

  test('checklist can be copied (unticked) from another trip', async () => {
    const res = await call(createTrip, { ...lakeWeek, checklistFrom: trip.id });
    const copied = (await load(res.body.trip.id)).checklist;
    assert.deepEqual(copied.map((i) => [i.text, i.category]), trip.checklist.map((i) => [i.text, i.category]));
    assert.ok(copied.every((i) => !i.isCompleted), 'ticks are not copied');
    assert.equal((await load(trip.id)).checklist.length, trip.checklist.length, 'source untouched');
  });

  test('copying from a trip that does not exist is a 400', async () => {
    const res = await call(createTrip, { ...lakeWeek, checklistFrom: 'nowhere' });
    assert.equal(res.status, 400);
    assert.ok(res.body.errors.checklistFrom);
  });

  test('the same name twice gets a numbered address', async () => {
    await call(createTrip, lakeWeek);
    const res = await call(createTrip, lakeWeek);
    assert.equal(res.body.trip.id, 'lake-week-2');
  });

  test('a chosen web address is used as is', async () => {
    const res = await call(createTrip, { ...lakeWeek, slug: 'lake-2027' });
    assert.equal(res.body.trip.id, 'lake-2027');
  });

  test('a chosen address that is taken or reserved is refused', async () => {
    const taken = await call(createTrip, { ...lakeWeek, slug: trip.id });
    assert.equal(taken.status, 409);
    assert.match(taken.body.errors.slug, /already/);
    const reserved = await call(createTrip, { ...lakeWeek, slug: 'new' });
    assert.equal(reserved.status, 400);
    assert.match(reserved.body.errors.slug, /reserved/);
  });

  test('a name with nothing usable for an address needs one chosen', async () => {
    const res = await call(createTrip, { ...lakeWeek, name: '🌴🌴🌴' });
    assert.equal(res.status, 400);
    assert.ok(res.body.errors.slug);
  });

  test('invalid input is a 400 with per-field errors and creates nothing', async () => {
    const res = await call(createTrip, { ...lakeWeek, name: '', endDate: '2027-06-01' });
    assert.equal(res.status, 400);
    assert.ok(res.body.errors.name);
    assert.ok(res.body.errors.endDate);
    assert.equal(res.body.message, res.body.errors.name);
    assert.equal(await db.prisma.trip.count(), 1);
  });

  test('not an object', async () => {
    assert.equal((await call(createTrip, null)).status, 400);
  });

  test('admins only', async () => {
    assert.equal((await call(createTrip, lakeWeek, null)).status, 401);
    assert.equal((await call(createTrip, lakeWeek, 'member')).status, 403);
    assert.equal(await db.prisma.trip.count(), 1);
  });
});

/** Form values for the seeded trip (2 days, day 1 has activities and a meal). */
async function current(id = trip.id) {
  const t = await db.prisma.trip.findUnique({ where: { id } });
  const key = (d) => new Date(d).toISOString().slice(0, 10);
  return {
    id,
    name: t.name,
    tag: t.tag,
    travelers: t.travelers,
    description: t.description,
    startDate: key(t.startDate),
    endDate: key(t.endDate),
    primaryColor: t.primaryColor,
    accentColor: t.accentColor,
  };
}

const plusDays = (key, n) => new Date(Date.parse(`${key}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

describe('updateTrip', () => {
  test('saves the details and keeps the address', async () => {
    const res = await call(updateTrip, { ...(await current()), name: 'Testville Deluxe', tag: 'Island', primaryColor: '#123456' });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const saved = await db.prisma.trip.findUnique({ where: { id: trip.id } });
    assert.equal(saved.name, 'Testville Deluxe');
    assert.equal(saved.tag, 'Island');
    assert.equal(saved.primaryColor, '#123456');
    assert.equal(saved.dates, 'Test dates', 'display dates only change when the dates do');
  });

  test('an address change in the body is ignored', async () => {
    await call(updateTrip, { ...(await current()), slug: 'other' });
    assert.ok(await db.prisma.trip.findUnique({ where: { id: trip.id } }));
    assert.equal(await db.prisma.trip.count({ where: { id: 'other' } }), 0);
  });

  test('longer dates add days at the end and refresh the display dates', async () => {
    const form = await current();
    const res = await call(updateTrip, { ...form, endDate: plusDays(form.endDate, 2) });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const saved = await load(trip.id);
    assert.deepEqual(saved.days.map((d) => d.dayNumber), [1, 2, 3, 4]);
    assert.match(saved.days[3].dateLabel, /^Day 4: \w+day, \w+ \d+$/);
    assert.notEqual(saved.dates, 'Test dates');
    assert.deepEqual(res.body.days, { added: 2, removed: 0 });
  });

  test('shorter dates drop empty days', async () => {
    const form = await current();
    const res = await call(updateTrip, { ...form, endDate: form.startDate });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.deepEqual((await load(trip.id)).days.map((d) => d.dayNumber), [1]);
    assert.deepEqual(res.body.days, { added: 0, removed: 1 });
  });

  test('a day with plans is never dropped: 409, and nothing changes', async () => {
    await db.prisma.itineraryActivity.create({ data: { dayId: trip.days[1].id, description: 'Zoo' } });
    const form = await current();
    const res = await call(updateTrip, { ...form, name: 'Renamed', endDate: form.startDate });
    assert.equal(res.status, 409);
    assert.match(res.body.message, /Day 2: Exploring/);
    assert.deepEqual(res.body.blocked.map((d) => d.dayNumber), [2]);
    const saved = await load(trip.id);
    assert.equal(saved.days.length, 2);
    assert.equal(saved.name, 'Testville Getaway', 'all or nothing');
  });

  test('a day with only a meal planned also blocks', async () => {
    await db.prisma.mealPlan.create({ data: { tripId: trip.id, dayNumber: 2, mealType: 'Lunch', mealName: 'Subs' } });
    const form = await current();
    assert.equal((await call(updateTrip, { ...form, endDate: form.startDate })).status, 409);
  });

  test('moving the trip keeps activities on their day and renames generated labels', async () => {
    const created = await call(createTrip, lakeWeek);
    const id = created.body.trip.id;
    const days = (await load(id)).days;
    await db.prisma.itineraryActivity.create({ data: { dayId: days[1].id, description: 'Kayaks' } });
    await db.prisma.itineraryDay.update({ where: { id: days[2].id }, data: { dateLabel: 'Going home' } });

    const res = await call(updateTrip, { ...(await current(id)), startDate: '2027-07-08', endDate: '2027-07-10' });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const moved = await db.prisma.trip.findUnique({
      where: { id },
      include: { days: { orderBy: { dayNumber: 'asc' }, include: { activities: true } } },
    });
    assert.deepEqual(moved.days.map((d) => d.dateLabel), ['Day 1: Thursday, July 8', 'Day 2: Friday, July 9', 'Going home']);
    assert.equal(moved.days[1].activities[0].description, 'Kayaks');
    assert.equal(moved.dates, 'July 8 – 10, 2027');
  });

  test('validation errors are a 400', async () => {
    const res = await call(updateTrip, { ...(await current()), travelers: '' });
    assert.equal(res.status, 400);
    assert.ok(res.body.errors.travelers);
  });

  test('unknown trip is a 404; missing id is a 400', async () => {
    assert.equal((await call(updateTrip, { ...lakeWeek, id: 'nowhere' })).status, 404);
    assert.equal((await call(updateTrip, lakeWeek)).status, 400);
  });

  test('admins only', async () => {
    const form = await current();
    assert.equal((await call(updateTrip, { ...form, name: 'x' }, 'member')).status, 403);
    assert.equal((await call(updateTrip, { ...form, name: 'x' }, null)).status, 401);
  });
});

describe('archiveTrip', () => {
  const now = new Date('2026-11-09T12:00:00Z');

  test('archives and restores', async () => {
    const res = await call(archiveTrip, { id: trip.id, archived: true }, 'admin', { now });
    assert.equal(res.status, 200);
    assert.equal(new Date((await load(trip.id)).archivedAt).toISOString(), now.toISOString());
    await call(archiveTrip, { id: trip.id, archived: false });
    assert.equal((await load(trip.id)).archivedAt, null);
  });

  test('archived must be true or false', async () => {
    assert.equal((await call(archiveTrip, { id: trip.id, archived: 'yes' })).status, 400);
  });

  test('unknown trip is a 404', async () => {
    assert.equal((await call(archiveTrip, { id: 'nowhere', archived: true })).status, 404);
  });

  test('admins only', async () => {
    assert.equal((await call(archiveTrip, { id: trip.id, archived: true }, 'member')).status, 403);
  });
});

describe('deleteTrip', () => {
  test('needs the trip name typed exactly', async () => {
    const res = await call(deleteTrip, { id: trip.id, confirmName: 'testville getaway' });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /Type the trip name/);
    assert.ok(await load(trip.id));
  });

  test('deletes the trip and everything in it', async () => {
    const res = await call(deleteTrip, { id: trip.id, confirmName: ' Testville Getaway ' });
    assert.equal(res.status, 200);
    assert.equal(await db.prisma.trip.count(), 0);
    for (const model of ['itineraryDay', 'itineraryActivity', 'checklistItem', 'logisticsCard', 'mealPlan', 'groceryItem']) {
      assert.equal(await db.prisma[model].count(), 0, model);
    }
  });

  test('unknown trip is a 404', async () => {
    assert.equal((await call(deleteTrip, { id: 'nowhere', confirmName: 'x' })).status, 404);
  });

  test('admins only', async () => {
    assert.equal((await call(deleteTrip, { id: trip.id, confirmName: 'Testville Getaway' }, 'member')).status, 403);
    assert.ok(await load(trip.id));
  });
});

describe('updateDay', () => {
  test('sets and clears the day title', async () => {
    const day = trip.days[1];
    const res = await call(updateDay, { id: day.id, title: '  Beach day ' });
    assert.equal(res.status, 200);
    assert.equal(res.body.day.title, 'Beach day');
    await call(updateDay, { id: day.id, title: '' });
    assert.equal((await db.prisma.itineraryDay.findUnique({ where: { id: day.id } })).title, null);
  });

  test('title length is limited and must be text', async () => {
    assert.equal((await call(updateDay, { id: trip.days[0].id, title: 'x'.repeat(81) })).status, 400);
    assert.equal((await call(updateDay, { id: trip.days[0].id, title: 5 })).status, 400);
  });

  test('unknown day is a 404', async () => {
    assert.equal((await call(updateDay, { id: 99999, title: 'x' })).status, 404);
  });

  test('admins only', async () => {
    assert.equal((await call(updateDay, { id: trip.days[0].id, title: 'x' }, 'member')).status, 403);
  });
});
