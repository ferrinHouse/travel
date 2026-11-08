// The seed scripts wipe tables, so they must refuse to run without --force.
// With --force they must still work against the current schema.
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { createDbFile, ROOT } from '../support/test-db.mjs';
import { seedTrip } from '../support/fixtures.mjs';

let db;
let prisma;

const runSeed = (script, args = [], env = {}) =>
  spawnSync(process.execPath, [path.join(ROOT, 'prisma', script), ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    // Always point at the throwaway DB so a test can never touch dev.db.
    env: { ...process.env, ALLOW_DESTRUCTIVE_SEED: '', DATABASE_URL: db.url, ...env },
  });

before(async () => {
  db = createDbFile();
  prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: db.url }) });
  await seedTrip(prisma, { id: 'family-made' });
});
after(async () => {
  await prisma.$disconnect();
  db.remove();
});

describe('seed guards', () => {
  for (const script of ['seed.js', 'seed-meals.js']) {
    test(`${script} refuses without --force and leaves data alone`, async () => {
      const res = runSeed(script);
      assert.equal(res.status, 1);
      assert.match(res.stderr, /Refusing to run/);
      assert.ok(await prisma.trip.findUnique({ where: { id: 'family-made' } }), 'existing trip kept');
      assert.equal(await prisma.mealPlan.count(), 1);
    });
  }

  test('ALLOW_DESTRUCTIVE_SEED=1 also opts in', () => {
    const res = runSeed('seed.js', [], { ALLOW_DESTRUCTIVE_SEED: '1' });
    assert.equal(res.status, 0, res.stderr);
  });
});

describe('seeding with --force', () => {
  test('seed.js replaces data with the sample trips', async () => {
    const res = runSeed('seed.js', ['--force']);
    assert.equal(res.status, 0, res.stderr);
    const ids = (await prisma.trip.findMany({ select: { id: true } })).map((t) => t.id).sort();
    assert.deepEqual(ids, ['boston', 'chicago', 'hawaii', 'sioux-falls', 'southwest']);
    assert.ok((await prisma.itineraryDay.count()) > 0);
  });

  test('seed-meals.js adds meal plans on top of the sample trips', async () => {
    const res = runSeed('seed-meals.js', ['--force']);
    assert.equal(res.status, 0, res.stderr);
    assert.ok((await prisma.mealPlan.count()) > 0);
    assert.ok((await prisma.groceryItem.count()) > 0);
  });
});
