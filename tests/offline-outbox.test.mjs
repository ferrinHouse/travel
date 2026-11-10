import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { applyOps, isOp, opKey, outcome, patchAction, pendingFor, requestFor, upsert } from '../src/lib/offline/outbox-core.js';

const tick = (overrides = {}) => ({
  kind: 'checklist',
  id: 7,
  tripId: 'chicago',
  value: true,
  label: 'Sunscreen',
  userKey: 'u1',
  at: 1000,
  ...overrides,
});

describe('isOp', () => {
  test('checklist ticks and grocery ticks can wait offline', () => {
    assert.equal(isOp(tick()), true);
    assert.equal(isOp(tick({ kind: 'grocery', id: 3, value: false })), true);
  });

  test('anything else is refused', () => {
    for (const bad of [null, {}, tick({ kind: 'activity' }), tick({ id: '7' }), tick({ id: 0 }), tick({ value: 'yes' }), tick({ tripId: '' }), tick({ userKey: '' })]) {
      assert.equal(isOp(bad), false, JSON.stringify(bad));
    }
  });
});

describe('upsert', () => {
  test('one waiting change per item: the latest tick wins', () => {
    let ops = upsert([], tick({ value: true, at: 1 }));
    ops = upsert(ops, tick({ kind: 'grocery', id: 7, value: true, at: 2 }));
    ops = upsert(ops, tick({ value: false, at: 3 }));
    assert.equal(ops.length, 2);
    assert.deepEqual(
      ops.map((o) => [opKey(o), o.value]),
      [
        ['grocery:7', true],
        ['checklist:7', false],
      ]
    );
  });
});

describe('pendingFor', () => {
  const ops = [tick(), tick({ id: 8, tripId: 'denver' }), tick({ id: 9, userKey: 'u2' })];

  test('only this person’s changes, optionally for one trip', () => {
    assert.deepEqual(pendingFor(ops, 'u1').map((o) => o.id), [7, 8]);
    assert.deepEqual(pendingFor(ops, 'u1', 'chicago').map((o) => o.id), [7]);
    assert.deepEqual(pendingFor(ops, null), []);
  });
});

describe('applyOps', () => {
  const trip = {
    id: 'chicago',
    checklist: [
      { id: 7, text: 'Sunscreen', isCompleted: false },
      { id: 8, text: 'Hats', isCompleted: false },
    ],
    groceries: [{ id: 3, name: 'Milk', isBought: true }],
  };

  test('a saved page shows the ticks still waiting to sync', () => {
    const next = applyOps(trip, [tick(), tick({ kind: 'grocery', id: 3, value: false })]);
    assert.equal(next.checklist[0].isCompleted, true);
    assert.equal(next.checklist[1].isCompleted, false);
    assert.equal(next.groceries[0].isBought, false);
    assert.equal(trip.checklist[0].isCompleted, false, 'input untouched');
  });

  test('changes for other trips or deleted items are ignored', () => {
    const next = applyOps(trip, [tick({ tripId: 'denver' }), tick({ id: 99 })]);
    assert.deepEqual(next, trip);
  });
});

describe('patchAction', () => {
  test('matches the trip reducer’s actions', () => {
    assert.deepEqual(patchAction(tick()), { type: 'checklist/patch', id: 7, patch: { isCompleted: true } });
    assert.deepEqual(patchAction(tick({ kind: 'grocery', id: 3, value: false })), { type: 'grocery/patch', id: 3, patch: { isBought: false } });
  });
});

describe('requestFor', () => {
  test('sends the online tick plus who made it, so the server refuses it for anyone else', () => {
    assert.deepEqual(requestFor(tick()), { url: '/api/checklist', method: 'POST', body: { id: 7, isCompleted: true, queuedBy: 'u1' } });
    assert.deepEqual(requestFor(tick({ kind: 'grocery', id: 3, value: false })), {
      url: '/api/grocery',
      method: 'POST',
      body: { id: 3, isBought: false, queuedBy: 'u1' },
    });
  });
});

describe('outcome', () => {
  test('saved', () => {
    assert.equal(outcome(200), 'done');
  });

  test('no connection or a struggling server: keep it and try again later', () => {
    for (const status of [0, 408, 429, 500, 502, 503]) assert.equal(outcome(status), 'retry', String(status));
  });

  test('signed out: keep it until they sign in again', () => {
    assert.equal(outcome(401), 'auth');
  });

  test('refused for good (no permission, item gone, bad data): drop it', () => {
    for (const status of [400, 403, 404, 409, 413]) assert.equal(outcome(status), 'drop', String(status));
  });
});
