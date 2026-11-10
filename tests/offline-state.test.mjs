import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AUTO_SAVE_DAYS,
  isSavedCopy,
  needsRefresh,
  parseSavedTrips,
  shouldAutoSave,
  tripSaveRequest,
  userChange,
  userKeyFor,
} from '../src/lib/offline/state.js';

const HOUR = 60 * 60 * 1000;

describe('shouldAutoSave', () => {
  test('trips under way or starting within 30 days are saved without asking', () => {
    assert.equal(shouldAutoSave({ phase: 'active', dayNumber: 2, totalDays: 5 }), true);
    assert.equal(shouldAutoSave({ phase: 'upcoming', daysUntil: 0 }), true);
    assert.equal(shouldAutoSave({ phase: 'upcoming', daysUntil: AUTO_SAVE_DAYS }), true);
  });

  test('later, undated and past trips are saved only on request', () => {
    assert.equal(shouldAutoSave({ phase: 'upcoming', daysUntil: AUTO_SAVE_DAYS + 1 }), false);
    assert.equal(shouldAutoSave({ phase: 'upcoming', daysUntil: null }), false);
    assert.equal(shouldAutoSave({ phase: 'past', daysAgo: 3 }), false);
  });
});

describe('needsRefresh', () => {
  const now = 100 * HOUR;
  test('never saved, or saved more than 12 hours ago', () => {
    assert.equal(needsRefresh(undefined, now), true);
    assert.equal(needsRefresh({ savedAt: now - 13 * HOUR }, now), true);
    assert.equal(needsRefresh({ savedAt: now - 2 * HOUR }, now), false);
  });
});

describe('parseSavedTrips', () => {
  test('reads the list of saved trips, ignoring anything malformed', () => {
    const raw = JSON.stringify({
      chicago: { name: 'Chicago', dates: 'May 1 – 5', savedAt: 5 },
      broken: { name: 3 },
      '../x': { name: 'Bad id', savedAt: 1 },
    });
    assert.deepEqual(parseSavedTrips(raw), { chicago: { name: 'Chicago', dates: 'May 1 – 5', savedAt: 5 } });
  });

  test('missing or corrupt storage is an empty list', () => {
    assert.deepEqual(parseSavedTrips(null), {});
    assert.deepEqual(parseSavedTrips('{not json'), {});
    assert.deepEqual(parseSavedTrips('[1,2]'), {});
  });
});

describe('tripSaveRequest', () => {
  test('just the trip page: no story page and no photos', () => {
    assert.deepEqual(tripSaveRequest('chicago'), { pages: ['/trips/chicago'] });
  });
});

describe('userChange', () => {
  test('first visit signed in: remember who this is', () => {
    assert.equal(userChange(null, 'u1'), 'set');
  });

  test('same person: nothing to do', () => {
    assert.equal(userChange('u1', 'u1'), 'keep');
    assert.equal(userChange(null, null), 'keep');
  });

  test('signed out: forget their saved pages but keep unsynced ticks for when they return', () => {
    assert.equal(userChange('u1', null), 'signed-out');
  });

  test('someone else signed in: everything of the previous person goes', () => {
    assert.equal(userChange('u1', 'u2'), 'switch');
  });

  test('a user key is stable per account', () => {
    assert.equal(userKeyFor({ id: 4 }), 'u4');
    assert.equal(userKeyFor(null), null);
  });
});

describe('isSavedCopy', () => {
  test('a page rendered minutes ago came from the offline copy', () => {
    const now = 10_000_000;
    assert.equal(isSavedCopy(now - 5_000, now), false);
    assert.equal(isSavedCopy(now - 3 * 60_000, now), true);
    assert.equal(isSavedCopy(undefined, now), false);
  });
});
