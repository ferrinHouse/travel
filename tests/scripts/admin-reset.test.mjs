// scripts/admin-reset.mjs is the way back in when every admin is locked out:
//   kubectl exec deploy/travel-site-deployment -- node scripts/admin-reset.mjs <username>
import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { createDbFile, ROOT } from '../support/test-db.mjs';
import { createUser } from '../support/users.mjs';
import { hashToken } from '../../src/lib/auth/tokens.js';
import { inviteDetails } from '../../src/lib/api/auth.js';
import { runHandler } from '../../src/lib/api/run.js';

let db;
let prisma;

const run = (args = [], env = {}) =>
  spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'admin-reset.mjs'), ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, APP_ORIGIN: 'https://travel.test', DATABASE_URL: db.url, ...env },
  });

const tokenFrom = (stdout) => stdout.match(/\/invite\/([\w-]{43})/)?.[1];

before(() => {
  db = createDbFile();
  prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: db.url }) });
});
after(async () => {
  await prisma.$disconnect();
  db.remove();
});
beforeEach(async () => {
  await prisma.user.deleteMany();
});

describe('admin-reset', () => {
  test('prints usage without a username', () => {
    const res = run();
    assert.equal(res.status, 1);
    assert.match(res.stderr, /Usage: node scripts\/admin-reset\.mjs <username>/);
  });

  test('unknown users are listed so you can pick the right one', async () => {
    await createUser(prisma, { username: 'mom' });
    const res = run(['nobody']);
    assert.equal(res.status, 1);
    assert.match(res.stderr, /No user "nobody"/);
    assert.match(res.stderr, /mom/);
  });

  test('prints a single-use reset link and voids older ones', async () => {
    const dad = await createUser(prisma, { username: 'dad', role: 'admin' });
    const first = tokenFrom(run(['dad']).stdout);
    const res = run(['DAD']);
    assert.equal(res.status, 0, res.stderr);
    assert.match(res.stdout, /https:\/\/travel\.test\/invite\//);
    const token = tokenFrom(res.stdout);
    const invite = await prisma.invite.findUnique({ where: { id: hashToken(token) } });
    assert.equal(invite.userId, dad.id);
    assert.equal(invite.purpose, 'reset');
    assert.equal(invite.usedAt, null);
    assert.ok((await prisma.invite.findUnique({ where: { id: hashToken(first) } })).usedAt, 'older link voided');
    const days = (invite.expiresAt - Date.now()) / 86_400_000;
    assert.ok(days > 1.9 && days <= 2, `valid ~2 days (${days})`);

    // The app itself accepts the link (same row format Prisma writes).
    const details = await runHandler(inviteDetails, { db: prisma, body: { token } });
    assert.equal(details.status, 200);
    assert.deepEqual([details.body.username, details.body.purpose], ['dad', 'reset']);
    const old = await runHandler(inviteDetails, { db: prisma, body: { token: first } });
    assert.equal(old.status, 404);
  });

  test('--make-admin promotes and re-enables the account', async () => {
    await createUser(prisma, { username: 'mom', role: 'viewer', isActive: false, password: false });
    const res = run(['mom', '--make-admin']);
    assert.equal(res.status, 0, res.stderr);
    const mom = await prisma.user.findUnique({ where: { username: 'mom' } });
    assert.equal(mom.role, 'admin');
    assert.equal(mom.isActive, true);
    const invite = await prisma.invite.findUnique({ where: { id: hashToken(tokenFrom(res.stdout)) } });
    assert.equal(invite.purpose, 'invite', 'no password yet, so it is an invite');
  });

  test('a disabled account is refused without --make-admin', async () => {
    await createUser(prisma, { username: 'gone', isActive: false });
    const res = run(['gone']);
    assert.equal(res.status, 1);
    assert.match(res.stderr, /turned off/);
  });
});
