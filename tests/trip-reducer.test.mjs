import test from 'node:test';
import assert from 'node:assert';
import { tripReducer } from '../src/lib/trip-reducer.js';

const baseTrip = () => ({
  id: 'chicago',
  checklist: [
    { id: 1, text: 'Sunscreen', isCompleted: false, category: 'packing' },
    { id: 2, text: 'Passports', isCompleted: true, category: 'pre-trip' },
  ],
  groceries: [{ id: 10, name: 'Milk', isBought: false, category: 'General' }],
  logistics: [{ id: 20, title: 'Hotel', content: 'Conf #1', order: 0 }],
  days: [
    { id: 100, dayNumber: 1, activities: [{ id: 1000, description: 'Museum' }] },
    { id: 101, dayNumber: 2, activities: [] },
  ],
  meals: [{ id: 5, dayNumber: 1, mealType: 'Dinner', mealName: 'Pizza', details: 'Lou Malnati’s', time: '' }],
});

test('optimistic toggle and rollback restore the original state', () => {
  const start = baseTrip();
  const optimistic = tripReducer(start, { type: 'checklist/patch', id: 1, patch: { isCompleted: true } });
  assert.strictEqual(optimistic.checklist[0].isCompleted, true);
  assert.strictEqual(start.checklist[0].isCompleted, false, 'original state is not mutated');

  const rolledBack = tripReducer(optimistic, { type: 'checklist/patch', id: 1, patch: { isCompleted: false } });
  assert.deepStrictEqual(rolledBack, start);
});

test('grocery patch only touches the matching item', () => {
  const next = tripReducer(baseTrip(), { type: 'grocery/patch', id: 10, patch: { isBought: true } });
  assert.strictEqual(next.groceries[0].isBought, true);
  assert.strictEqual(tripReducer(next, { type: 'grocery/patch', id: 999, patch: { isBought: false } }).groceries[0].isBought, true);
});

test('checklist add and remove', () => {
  let trip = tripReducer(baseTrip(), { type: 'checklist/add', item: { id: 3, text: 'Snacks', isCompleted: false, category: 'packing' } });
  assert.strictEqual(trip.checklist.length, 3);
  trip = tripReducer(trip, { type: 'checklist/remove', id: 1 });
  assert.deepStrictEqual(trip.checklist.map((i) => i.id), [2, 3]);
});

test('activity add, replace and remove', () => {
  let trip = tripReducer(baseTrip(), { type: 'activity/add', dayId: 101, activity: { id: 1001, description: 'Zoo' } });
  assert.strictEqual(trip.days[1].activities.length, 1);
  trip = tripReducer(trip, { type: 'activity/replace', activity: { id: 1000, description: 'Field Museum' } });
  assert.strictEqual(trip.days[0].activities[0].description, 'Field Museum');
  trip = tripReducer(trip, { type: 'activity/remove', dayId: 100, id: 1000 });
  assert.strictEqual(trip.days[0].activities.length, 0);
  assert.strictEqual(trip.days[1].activities.length, 1);
});

test('logistics add, replace and remove', () => {
  let trip = tripReducer(baseTrip(), { type: 'logistics/add', card: { id: 21, title: 'Flight', content: 'AA1' } });
  trip = tripReducer(trip, { type: 'logistics/replace', card: { id: 20, title: 'Hotel', content: 'Conf #2' } });
  assert.strictEqual(trip.logistics[0].content, 'Conf #2');
  trip = tripReducer(trip, { type: 'logistics/remove', id: 21 });
  assert.deepStrictEqual(trip.logistics.map((c) => c.id), [20]);
});

test('meal upsert updates an existing slot without losing fields, or inserts a new one', () => {
  let trip = tripReducer(baseTrip(), {
    type: 'meal/upsert',
    meal: { id: 5, dayNumber: 1, mealType: 'Dinner', mealName: 'Tacos', time: '6:00 PM' },
  });
  assert.strictEqual(trip.meals.length, 1);
  assert.strictEqual(trip.meals[0].mealName, 'Tacos');
  assert.strictEqual(trip.meals[0].details, 'Lou Malnati’s');

  trip = tripReducer(trip, { type: 'meal/upsert', meal: { id: 6, dayNumber: 2, mealType: 'Lunch', mealName: 'Subs' } });
  assert.strictEqual(trip.meals.length, 2);

  trip = tripReducer(trip, { type: 'meal/remove', dayNumber: 1, mealType: 'Dinner' });
  assert.deepStrictEqual(trip.meals.map((m) => m.id), [6]);
});

test('day patch renames one day and keeps its activities', () => {
  const start = baseTrip();
  const next = tripReducer(start, { type: 'day/patch', id: 100, patch: { title: 'Arrival' } });
  assert.strictEqual(next.days[0].title, 'Arrival');
  assert.deepStrictEqual(next.days[0].activities, start.days[0].activities);
  assert.strictEqual(next.days[1], start.days[1]);
  assert.strictEqual(start.days[0].title, undefined, 'original state is not mutated');
});

test('photos: add, patch, remove, and only one cover at a time', () => {
  const start = { ...baseTrip(), photos: [{ id: 1, caption: null, isCover: true }] };
  const added = tripReducer(start, { type: 'photo/add', photo: { id: 2, caption: 'Pier', isCover: false } });
  assert.deepStrictEqual(added.photos.map((p) => p.id), [1, 2]);
  assert.strictEqual(start.photos.length, 1, 'original state is not mutated');

  const captioned = tripReducer(added, { type: 'photo/patch', id: 1, patch: { caption: 'Beach' } });
  assert.strictEqual(captioned.photos[0].caption, 'Beach');

  const cover = tripReducer(captioned, { type: 'photo/patch', id: 2, patch: { isCover: true } });
  assert.deepStrictEqual(cover.photos.map((p) => p.isCover), [false, true]);

  const removed = tripReducer(cover, { type: 'photo/remove', id: 2 });
  assert.deepStrictEqual(removed.photos.map((p) => p.id), [1]);
});

test('unknown actions throw', () => {
  assert.throws(() => tripReducer(baseTrip(), { type: 'nope' }), /Unknown trip action/);
});
