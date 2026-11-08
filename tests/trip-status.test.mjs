import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { tripPhase, phaseLabel, localDateKey } from '../src/lib/trip-status.js';
import { isTripPast } from '../src/lib/helpers.js';

// Trips are stored as midnight UTC calendar dates; "today" is the viewer's local date.
const trip = { startDate: '2026-06-20T00:00:00Z', endDate: '2026-06-25T00:00:00Z', status: 'upcoming' };
const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h); // local time

describe('localDateKey', () => {
  test('uses local calendar fields', () => {
    assert.equal(localDateKey(at(2026, 1, 5)), '2026-01-05');
    assert.equal(localDateKey(at(2026, 12, 31, 23)), '2026-12-31');
  });
});

describe('tripPhase', () => {
  test('upcoming trips count whole days until the start', () => {
    assert.deepEqual(tripPhase(trip, at(2026, 6, 1)), { phase: 'upcoming', daysUntil: 19 });
    assert.deepEqual(tripPhase(trip, at(2026, 6, 19, 23)), { phase: 'upcoming', daysUntil: 1 });
  });

  test('counts across a month and year boundary and DST', () => {
    const winter = { startDate: '2027-01-02T00:00:00Z', endDate: '2027-01-04T00:00:00Z' };
    assert.deepEqual(tripPhase(winter, at(2026, 12, 30)), { phase: 'upcoming', daysUntil: 3 });
    const spring = { startDate: '2027-03-20T00:00:00Z', endDate: '2027-03-21T00:00:00Z' };
    assert.deepEqual(tripPhase(spring, at(2027, 3, 1)), { phase: 'upcoming', daysUntil: 19 });
  });

  test('active trips report the day number, first and last day inclusive', () => {
    assert.deepEqual(tripPhase(trip, at(2026, 6, 20, 0)), { phase: 'active', dayNumber: 1, totalDays: 6 });
    assert.deepEqual(tripPhase(trip, at(2026, 6, 22)), { phase: 'active', dayNumber: 3, totalDays: 6 });
    assert.deepEqual(tripPhase(trip, at(2026, 6, 25, 23)), { phase: 'active', dayNumber: 6, totalDays: 6 });
  });

  test('single-day trips', () => {
    const day = { startDate: '2025-02-07T00:00:00Z', endDate: '2025-02-07T00:00:00Z' };
    assert.deepEqual(tripPhase(day, at(2025, 2, 7)), { phase: 'active', dayNumber: 1, totalDays: 1 });
  });

  test('past trips', () => {
    assert.deepEqual(tripPhase(trip, at(2026, 6, 26)), { phase: 'past', daysAgo: 1 });
  });

  test('trips without dates fall back to the stored status', () => {
    assert.deepEqual(tripPhase({ status: 'past' }, at(2026, 1, 1)), { phase: 'past', daysAgo: null });
    assert.deepEqual(tripPhase({ status: 'upcoming' }, at(2026, 1, 1)), { phase: 'upcoming', daysUntil: null });
  });

  test('agrees with isTripPast', () => {
    for (let d = 15; d <= 30; d++) {
      const today = at(2026, 6, d);
      assert.equal(tripPhase(trip, today).phase === 'past', isTripPast(trip, today), `June ${d}`);
    }
  });
});

describe('phaseLabel', () => {
  test('reads naturally', () => {
    assert.equal(phaseLabel({ phase: 'upcoming', daysUntil: 30 }), 'In 30 days');
    assert.equal(phaseLabel({ phase: 'upcoming', daysUntil: 1 }), 'Tomorrow!');
    assert.equal(phaseLabel({ phase: 'upcoming', daysUntil: null }), 'Coming up');
    assert.equal(phaseLabel({ phase: 'active', dayNumber: 3, totalDays: 6 }), 'Day 3 of 6');
    assert.equal(phaseLabel({ phase: 'active', dayNumber: 1, totalDays: 1 }), 'Today!');
    assert.equal(phaseLabel({ phase: 'past', daysAgo: 4 }), 'Trip complete');
  });
});
