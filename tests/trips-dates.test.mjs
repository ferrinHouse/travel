// Calendar maths for trips: dates are midnight-UTC calendar days, so nothing
// here may depend on the machine's time zone.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_TRIP_DAYS,
  addDays,
  dayKey,
  dayLabel,
  formatDateRange,
  parseDay,
  tripLength,
} from '../src/lib/trips/dates.js';

const d = (key) => new Date(`${key}T00:00:00Z`);

describe('parseDay', () => {
  test('reads YYYY-MM-DD as midnight UTC', () => {
    assert.equal(parseDay('2026-06-20').toISOString(), '2026-06-20T00:00:00.000Z');
  });

  test('accepts a Date or ISO string from the database', () => {
    assert.equal(dayKey(parseDay(d('2026-06-20'))), '2026-06-20');
    assert.equal(dayKey(parseDay('2026-06-20T00:00:00.000+00:00')), '2026-06-20');
  });

  test('rejects impossible or malformed dates', () => {
    for (const bad of ['2026-02-30', '2026-13-01', '2026-6-1', 'June 20', '', null, undefined, 42, {}, '2026-06-20x']) {
      assert.equal(parseDay(bad), null, String(bad));
    }
  });

  test('leap days only in leap years', () => {
    assert.ok(parseDay('2028-02-29'));
    assert.equal(parseDay('2027-02-29'), null);
  });
});

describe('day arithmetic', () => {
  test('addDays crosses months, years and DST changes without drifting', () => {
    assert.equal(dayKey(addDays(d('2026-12-30'), 3)), '2027-01-02');
    assert.equal(dayKey(addDays(d('2026-03-07'), 2)), '2026-03-09'); // US DST starts 2026-03-08
    assert.equal(dayKey(addDays(d('2026-11-01'), -1)), '2026-10-31');
  });

  test('tripLength counts both ends', () => {
    assert.equal(tripLength(d('2026-06-20'), d('2026-06-25')), 6);
    assert.equal(tripLength(d('2025-02-07'), d('2025-02-07')), 1);
    assert.equal(tripLength(d('2028-02-28'), d('2028-03-01')), 3);
  });

  test('the longest trip is 60 days', () => {
    assert.equal(MAX_TRIP_DAYS, 60);
  });
});

describe('formatDateRange', () => {
  test('one day', () => {
    assert.equal(formatDateRange(d('2025-02-07'), d('2025-02-07')), 'February 7, 2025');
  });
  test('same month', () => {
    assert.equal(formatDateRange(d('2026-06-20'), d('2026-06-25')), 'June 20 – 25, 2026');
  });
  test('across months', () => {
    assert.equal(formatDateRange(d('2026-06-28'), d('2026-07-03')), 'June 28 – July 3, 2026');
  });
  test('across years', () => {
    assert.equal(formatDateRange(d('2026-12-30'), d('2027-01-02')), 'December 30, 2026 – January 2, 2027');
  });
});

describe('dayLabel', () => {
  test('"Day N: Weekday, Month D"', () => {
    assert.equal(dayLabel(d('2026-06-21'), 1), 'Day 1: Sunday, June 21');
    assert.equal(dayLabel(d('2027-02-19'), 11), 'Day 11: Friday, February 19');
  });
});
