// Building the day list for a new trip, and reconciling it when the dates of
// an existing trip change. Reconciling must never throw away plans.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDays, reconcileDays } from '../src/lib/trips/scaffold.js';
import { dayLabel } from '../src/lib/trips/dates.js';

const d = (key) => new Date(`${key}T00:00:00Z`);

/** Days as the server hands them to reconcileDays. */
function existing(start, count, { firstNumber = 1, busy = {}, labels = {} } = {}) {
  return Array.from({ length: count }, (_, i) => {
    const dayNumber = firstNumber + i;
    const date = new Date(d(start).getTime() + i * 86400000);
    return {
      id: 100 + i,
      dayNumber,
      dateLabel: labels[dayNumber] ?? dayLabel(date, dayNumber),
      activityCount: busy[dayNumber]?.activities ?? 0,
      mealCount: busy[dayNumber]?.meals ?? 0,
    };
  });
}

describe('buildDays', () => {
  test('one numbered, labelled day per date', () => {
    assert.deepEqual(buildDays(d('2026-06-20'), d('2026-06-22')), [
      { dayNumber: 1, dateLabel: 'Day 1: Saturday, June 20' },
      { dayNumber: 2, dateLabel: 'Day 2: Sunday, June 21' },
      { dayNumber: 3, dateLabel: 'Day 3: Monday, June 22' },
    ]);
  });

  test('a one-day trip has one day', () => {
    assert.equal(buildDays(d('2025-02-07'), d('2025-02-07')).length, 1);
  });

  test('handles month and year ends', () => {
    const days = buildDays(d('2026-12-31'), d('2027-01-01'));
    assert.deepEqual(days.map((x) => x.dateLabel), ['Day 1: Thursday, December 31', 'Day 2: Friday, January 1']);
  });
});

describe('reconcileDays', () => {
  const oldStart = d('2026-06-20');

  test('same dates: nothing to do', () => {
    const plan = reconcileDays({ days: existing('2026-06-20', 3), oldStart, newStart: oldStart, newEnd: d('2026-06-22') });
    assert.deepEqual(plan, { create: [], update: [], remove: [], blocked: [] });
  });

  test('moving the trip relabels generated labels and keeps custom ones', () => {
    const days = existing('2026-06-20', 3, { labels: { 2: 'Day 2 (Jun 21): Museum day' } });
    const plan = reconcileDays({ days, oldStart, newStart: d('2026-07-04'), newEnd: d('2026-07-06') });
    assert.deepEqual(plan.update, [
      { id: 100, dateLabel: 'Day 1: Saturday, July 4' },
      { id: 102, dateLabel: 'Day 3: Monday, July 6' },
    ]);
    assert.deepEqual(plan.create, []);
    assert.deepEqual(plan.remove, []);
  });

  test('a longer trip gets new days at the end', () => {
    const plan = reconcileDays({ days: existing('2026-06-20', 2), oldStart, newStart: oldStart, newEnd: d('2026-06-23') });
    assert.deepEqual(plan.create, [
      { dayNumber: 3, dateLabel: 'Day 3: Monday, June 22' },
      { dayNumber: 4, dateLabel: 'Day 4: Tuesday, June 23' },
    ]);
  });

  test('numbering continues from the last day when a trip starts at Day 0', () => {
    const days = existing('2026-06-20', 2, { firstNumber: 0 });
    const plan = reconcileDays({ days, oldStart, newStart: oldStart, newEnd: d('2026-06-22') });
    assert.deepEqual(plan.create, [{ dayNumber: 2, dateLabel: 'Day 2: Monday, June 22' }]);
  });

  test('a shorter trip drops empty days from the end', () => {
    const plan = reconcileDays({ days: existing('2026-06-20', 4), oldStart, newStart: oldStart, newEnd: d('2026-06-21') });
    assert.deepEqual(plan.remove, [102, 103]);
    assert.deepEqual(plan.blocked, []);
  });

  test('days with activities or meals are never dropped: they block the change', () => {
    const days = existing('2026-06-20', 4, { busy: { 3: { activities: 2 }, 4: { meals: 1 } } });
    const plan = reconcileDays({ days, oldStart, newStart: oldStart, newEnd: d('2026-06-21') });
    assert.deepEqual(plan.blocked.map((x) => x.dayNumber), [3, 4]);
    assert.deepEqual(plan.blocked[0], { id: 102, dayNumber: 3, dateLabel: 'Day 3: Monday, June 22' });
  });

  test('days are matched by position even if numbering has gaps', () => {
    const days = [
      { id: 1, dayNumber: 1, dateLabel: 'Arrive', activityCount: 0, mealCount: 0 },
      { id: 2, dayNumber: 5, dateLabel: 'Leave', activityCount: 0, mealCount: 0 },
    ];
    const plan = reconcileDays({ days, oldStart, newStart: oldStart, newEnd: d('2026-06-22') });
    assert.deepEqual(plan.create, [{ dayNumber: 6, dateLabel: 'Day 6: Monday, June 22' }]);
  });

  test('unsorted input is handled', () => {
    const days = existing('2026-06-20', 3).reverse();
    const plan = reconcileDays({ days, oldStart, newStart: oldStart, newEnd: d('2026-06-21') });
    assert.deepEqual(plan.remove, [102]);
  });

  test('a trip with no old start date only gets new labels for new days', () => {
    const days = [{ id: 7, dayNumber: 1, dateLabel: 'Archived Trip Details', activityCount: 0, mealCount: 0 }];
    const plan = reconcileDays({ days, oldStart: null, newStart: d('2024-05-14'), newEnd: d('2024-05-15') });
    assert.deepEqual(plan.update, []);
    assert.deepEqual(plan.create, [{ dayNumber: 2, dateLabel: 'Day 2: Wednesday, May 15' }]);
  });
});
