import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb } from '../support/test-db.mjs';
import { createUser, ctx } from '../support/users.mjs';
import { runHandler } from '../../src/lib/api/run.js';
import { listUsers, createUserAccount, updateUser, createResetLink, revokeUserSessions } from '../../src/lib/api/users.js';
import { startSession } from '../../src/lib/api/auth.js';
import { hashToken } from '../../src/lib/auth/tokens.js';

let db;
let prisma;
let admin;

before(async () => {
  db = await createTestDb();
  prisma = db.prisma;
});
after(() => db.cleanup());
beforeEach(async () => {
  await prisma.user.deleteMany();
  admin = await createUser(prisma, { username: 'boss', role: 'admin' });
});

const as = (user, body) => ctx(prisma, { user, body });

describe('only admins manage users', () => {
  for (const [name, handler, body] of [
    ['listUsers', listUsers, null],
    ['createUserAccount', createUserAccount, { username: 'kid', displayName: 'Kid', role: 'viewer' }],
    ['updateUser', updateUser, { id: 1, role: 'admin' }],
    ['createResetLink', createResetLink, { id: 1 }],
    ['revokeUserSessions', revokeUserSessions, { id: 1 }],
  ]) {
    test(name, async () => {
      assert.equal((await runHandler(handler, as(null, body))).status, 401);
      for (const role of ['viewer', 'member']) {
        const user = await createUser(prisma, { role });
        assert.equal((await runHandler(handler, as(user, body))).status, 403, role);
      }
    });
  }
});

describe('listUsers', () => {
  test('lists everyone with safe fields only', async () => {
    const kid = await createUser(prisma, { username: 'kid', password: false });
    await prisma.passkey.create({ data: { id: 'cred-1', userId: admin.id, publicKey: Buffer.from([1]), name: 'Phone' } });
    const res = await runHandler(listUsers, as(admin));
    assert.equal(res.status, 200);
    const byName = Object.fromEntries(res.body.users.map((u) => [u.username, u]));
    assert.equal(byName.boss.passkeyCount, 1);
    assert.equal(byName.boss.hasPassword, true);
    assert.equal(byName.kid.hasPassword, false);
    assert.equal(byName.kid.id, kid.id);
    for (const u of res.body.users) {
      assert.equal(u.passwordHash, undefined);
      assert.equal(u.webauthnUserId, undefined);
    }
  });
});

describe('createUserAccount', () => {
  test('creates a passwordless user and returns a one-time invite token', async () => {
    const res = await runHandler(createUserAccount, as(admin, { username: ' Kid ', displayName: 'Kiddo', role: 'member' }));
    assert.equal(res.status, 200);
    assert.equal(res.body.user.username, 'kid');
    assert.equal(res.body.user.role, 'member');
    assert.match(res.body.inviteToken, /^[\w-]{43}$/);
    const invite = await prisma.invite.findUnique({ where: { id: hashToken(res.body.inviteToken) } });
    assert.equal(invite.purpose, 'invite');
    assert.equal(invite.createdById, admin.id);
    const days = (invite.expiresAt - Date.now()) / 86_400_000;
    assert.ok(days > 6.9 && days <= 7, `expires in ~7 days (${days})`);
    assert.equal((await prisma.user.findUnique({ where: { username: 'kid' } })).passwordHash, null);
  });

  test('validates input and rejects duplicates', async () => {
    assert.equal((await runHandler(createUserAccount, as(admin, { username: 'x y', displayName: 'A', role: 'viewer' }))).status, 400);
    assert.equal((await runHandler(createUserAccount, as(admin, { username: 'kid', displayName: '', role: 'viewer' }))).status, 400);
    assert.equal((await runHandler(createUserAccount, as(admin, { username: 'kid', displayName: 'A', role: 'owner' }))).status, 400);
    const dup = await runHandler(createUserAccount, as(admin, { username: 'BOSS', displayName: 'A', role: 'viewer' }));
    assert.equal(dup.status, 409);
    assert.match(dup.body.message, /already taken/);
  });
});

describe('updateUser', () => {
  test('changes role and display name', async () => {
    const kid = await createUser(prisma, { username: 'kid' });
    const res = await runHandler(updateUser, as(admin, { id: kid.id, role: 'member', displayName: 'Big Kid' }));
    assert.equal(res.status, 200);
    assert.equal(res.body.user.role, 'member');
    assert.equal(res.body.user.displayName, 'Big Kid');
  });

  test('disabling someone signs them out everywhere', async () => {
    const kid = await createUser(prisma, { username: 'kid' });
    await startSession(prisma, kid);
    await startSession(prisma, kid);
    assert.equal((await runHandler(updateUser, as(admin, { id: kid.id, isActive: false }))).status, 200);
    assert.equal(await prisma.session.count({ where: { userId: kid.id } }), 0);
  });

  test('admins cannot demote or disable themselves, or remove the last admin', async () => {
    assert.equal((await runHandler(updateUser, as(admin, { id: admin.id, role: 'member' }))).status, 400);
    assert.equal((await runHandler(updateUser, as(admin, { id: admin.id, isActive: false }))).status, 400);
    const other = await createUser(prisma, { username: 'mom', role: 'admin' });
    // With two admins, one can demote the other...
    assert.equal((await runHandler(updateUser, as(admin, { id: other.id, role: 'member' }))).status, 200);
    // ...and a demoted admin's own edits still work for display names.
    assert.equal((await runHandler(updateUser, as(admin, { id: admin.id, displayName: 'The Boss' }))).status, 200);
  });

  test('rejects bad input and unknown users', async () => {
    const kid = await createUser(prisma, { username: 'kid' });
    assert.equal((await runHandler(updateUser, as(admin, { id: kid.id, role: 'owner' }))).status, 400);
    assert.equal((await runHandler(updateUser, as(admin, { id: kid.id, isActive: 'no' }))).status, 400);
    assert.equal((await runHandler(updateUser, as(admin, { id: kid.id }))).status, 400);
    assert.equal((await runHandler(updateUser, as(admin, { id: 99999, role: 'member' }))).status, 404);
  });
});

describe('createResetLink', () => {
  test('issues a reset token (valid 2 days) and voids older unused links', async () => {
    const kid = await createUser(prisma, { username: 'kid' });
    const first = await runHandler(createResetLink, as(admin, { id: kid.id }));
    const second = await runHandler(createResetLink, as(admin, { id: kid.id }));
    assert.equal(second.status, 200);
    const old = await prisma.invite.findUnique({ where: { id: hashToken(first.body.token) } });
    const fresh = await prisma.invite.findUnique({ where: { id: hashToken(second.body.token) } });
    assert.ok(old.usedAt, 'older link voided');
    assert.equal(fresh.usedAt, null);
    assert.equal(fresh.purpose, 'reset');
    const days = (fresh.expiresAt - Date.now()) / 86_400_000;
    assert.ok(days > 1.9 && days <= 2);
  });

  test('a user who never set a password gets a fresh invite instead', async () => {
    const kid = await createUser(prisma, { username: 'kid', password: false });
    const res = await runHandler(createResetLink, as(admin, { id: kid.id }));
    assert.equal((await prisma.invite.findUnique({ where: { id: hashToken(res.body.token) } })).purpose, 'invite');
  });

  test('unknown or disabled users', async () => {
    const gone = await createUser(prisma, { username: 'gone', isActive: false });
    assert.equal((await runHandler(createResetLink, as(admin, { id: 4242 }))).status, 404);
    assert.equal((await runHandler(createResetLink, as(admin, { id: gone.id }))).status, 400);
  });
});

describe('revokeUserSessions', () => {
  test('signs a user out of every device', async () => {
    const kid = await createUser(prisma, { username: 'kid' });
    await startSession(prisma, kid);
    const res = await runHandler(revokeUserSessions, as(admin, { id: kid.id }));
    assert.equal(res.status, 200);
    assert.equal(res.body.revoked, 1);
    assert.equal(await prisma.session.count({ where: { userId: kid.id } }), 0);
  });
});
