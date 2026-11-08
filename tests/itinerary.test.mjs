import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDayTimeline, nextUpId } from '../src/lib/itinerary.js';
import { tagClass } from '../src/lib/tags.js';

const day = {
  dayNumber: 1,
  activities: [
    { id: 1, time: '9:00 AM', description: 'Breakfast walk' },
    { id: 2, time: 'Afternoon', description: 'Museum' },
    { id: 3, time: 'Sometime', description: 'Souvenirs' },
  ],
};
const meals = [{ id: 7, dayNumber: 1, mealType: 'Dinner', mealName: 'Pizza', time: '' }];

describe('buildDayTimeline', () => {
  test('puts untimed dinner just before evening and unknown times last', () => {
    const ids = buildDayTimeline(day, meals).map((i) => i.id);
    assert.deepEqual(ids, [1, 2, 'meal-7', 3]);
  });
});

describe('nextUpId', () => {
  const timeline = buildDayTimeline(day, meals);

  test('is the first item at or after now', () => {
    assert.equal(nextUpId(timeline, 8 * 60), 1);
    assert.equal(nextUpId(timeline, 9 * 60), 1);
    assert.equal(nextUpId(timeline, 9 * 60 + 1), 2);
    assert.equal(nextUpId(timeline, 15 * 60), 'meal-7');
  });

  test('ignores items without a usable time and returns null when the day is done', () => {
    assert.equal(nextUpId(timeline, 19 * 60), null);
    assert.equal(nextUpId([], 600), null);
  });
});

describe('tagClass', () => {
  test('maps trip tags to a colour class', () => {
    assert.equal(tagClass('City'), 'tag-city');
    assert.equal(tagClass('City & Sea'), 'tag-city');
    assert.equal(tagClass('Island'), 'tag-island');
    assert.equal(tagClass('National Parks'), 'tag-nature');
    assert.equal(tagClass('Beach'), 'tag-beach');
    assert.equal(tagClass('Road trip'), 'tag-sea');
    assert.equal(tagClass(null), 'tag-sea');
  });
});
