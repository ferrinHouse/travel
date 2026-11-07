import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb } from '../support/test-db.mjs';
import { seedTrip } from '../support/fixtures.mjs';
import { saveChecklistItem, deleteChecklistItem } from '../../src/lib/api/checklist.js';
import { runHandler } from '../../src/lib/api/run.js';

let db;
let trip;
const admin = (body) => ({ db: db.prisma, isAdmin: true, body });
const guest = (body) => ({ db: db.prisma, isAdmin: false, body });
const item = (text) => trip.checklist.find((i) => i.text === text);

before(async () => {
  db = await createTestDb();
});
after(() => db.cleanup());
beforeEach(async () => {
  await db.prisma.trip.deleteMany();
  trip = await seedTrip(db.prisma);
});

describe('saveChecklistItem: toggling', () => {
  test('anyone can tick and untick an item', async () => {
    const sunscreen = item('Sunscreen');
    let res = await runHandler(saveChecklistItem, guest({ id: sunscreen.id, isCompleted: true }));
    assert.equal(res.status, 200);
    assert.equal(res.body.item.isCompleted, true);
    res = await runHandler(saveChecklistItem, guest({ id: sunscreen.id, isCompleted: false }));
    assert.equal(res.body.item.isCompleted, false);
  });

  test('404 for an unknown item', async () => {
    const res = await runHandler(saveChecklistItem, guest({ id: 999999, isCompleted: true }));
    assert.equal(res.status, 404);
  });

  test('400 when there is nothing to change', async () => {
    const res = await runHandler(saveChecklistItem, guest({ id: item('Sunscreen').id }));
    assert.equal(res.status, 400);
  });

  test('400 for a non-boolean isCompleted', async () => {
    const res = await runHandler(saveChecklistItem, guest({ id: item('Sunscreen').id, isCompleted: 'yes' }));
    assert.equal(res.status, 400);
  });
});

describe('saveChecklistItem: renaming', () => {
  test('requires admin, even when combined with a toggle', async () => {
    const sunscreen = item('Sunscreen');
    const res = await runHandler(saveChecklistItem, guest({ id: sunscreen.id, text: 'Hacked', isCompleted: true }));
    assert.equal(res.status, 401);
    const unchanged = await db.prisma.checklistItem.findUnique({ where: { id: sunscreen.id } });
    assert.equal(unchanged.text, 'Sunscreen');
    assert.equal(unchanged.isCompleted, false);
  });

  test('admin can rename (trimmed)', async () => {
    const res = await runHandler(saveChecklistItem, admin({ id: item('Sunscreen').id, text: '  Reef-safe sunscreen ' }));
    assert.equal(res.status, 200);
    assert.equal(res.body.item.text, 'Reef-safe sunscreen');
  });

  test('blank text is rejected', async () => {
    const res = await runHandler(saveChecklistItem, admin({ id: item('Sunscreen').id, text: '   ' }));
    assert.equal(res.status, 400);
  });
});

describe('saveChecklistItem: creating', () => {
  test('requires admin', async () => {
    const res = await runHandler(saveChecklistItem, guest({ tripId: trip.id, text: 'Hats', category: 'packing' }));
    assert.equal(res.status, 401);
    assert.equal(await db.prisma.checklistItem.count(), 3);
  });

  test('admin creates an unchecked item in the category', async () => {
    const res = await runHandler(saveChecklistItem, admin({ tripId: trip.id, text: ' Hats ', category: 'packing' }));
    assert.equal(res.status, 200);
    assert.equal(res.body.item.text, 'Hats');
    assert.equal(res.body.item.category, 'packing');
    assert.equal(res.body.item.isCompleted, false);
    assert.equal(res.body.item.tripId, trip.id);
  });

  test('custom categories are allowed', async () => {
    const res = await runHandler(saveChecklistItem, admin({ tripId: trip.id, text: 'Car seats', category: 'kids-gear' }));
    assert.equal(res.body.item.category, 'kids-gear');
  });

  test('rejects blank text or category, and unknown trips', async () => {
    assert.equal((await runHandler(saveChecklistItem, admin({ tripId: trip.id, text: ' ', category: 'packing' }))).status, 400);
    assert.equal((await runHandler(saveChecklistItem, admin({ tripId: trip.id, text: 'Hats', category: '' }))).status, 400);
    assert.equal((await runHandler(saveChecklistItem, admin({ tripId: 'nowhere', text: 'Hats', category: 'packing' }))).status, 404);
  });

  test('400 for a missing body', async () => {
    assert.equal((await runHandler(saveChecklistItem, admin(null))).status, 400);
  });
});

describe('deleteChecklistItem', () => {
  test('requires admin', async () => {
    const res = await runHandler(deleteChecklistItem, guest({ id: item('Sunscreen').id }));
    assert.equal(res.status, 401);
    assert.equal(await db.prisma.checklistItem.count(), 3);
  });

  test('admin deletes; unknown is 404; bad id is 400', async () => {
    const id = item('Sunscreen').id;
    assert.equal((await runHandler(deleteChecklistItem, admin({ id }))).status, 200);
    assert.equal(await db.prisma.checklistItem.findUnique({ where: { id } }), null);
    assert.equal((await runHandler(deleteChecklistItem, admin({ id }))).status, 404);
    assert.equal((await runHandler(deleteChecklistItem, admin({ id: '1' }))).status, 400);
  });
});
