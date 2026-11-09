import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb } from '../support/test-db.mjs';
import { createUser, ctx, PASSWORD } from '../support/users.mjs';
import { runHandler } from '../../src/lib/api/run.js';
import {
  changePassword,
  listMySessions,
  revokeMySession,
  listMyPasskeys,
  renameMyPasskey,
  deleteMyPasskey,
} from '../../src/lib/api/account.js';
import { startSession, userFromSessionToken } from '../../src/lib/api/auth.js';
import { verifyPassword } from '../../src/lib/auth/password.js';
import { hashToken } from '../../src/lib/auth/tokens.js';

let db;
let prisma;

before(async () => {
  db = await createTestDb();
  prisma = db.prisma;
});
after(() => db.cleanup());
beforeEach(async () => {
  await prisma.user.deleteMany();
});

/** A signed-in user as the route adapter would see them. */
async function signedIn(options) {
  const row = await createUser(prisma, options);
  const { token } = await startSession(prisma, row, { userAgent: 'This browser' });
  return { user: await userFromSessionToken(prisma, token), token };
}

const passkey = (userId, id, name = 'Phone') =>
  prisma.passkey.create({ data: { id, userId, publicKey: Buffer.from([1, 2, 3]), name } });

describe('account endpoints need a signed-in user', () => {
  for (const handler of [changePassword, listMySessions, revokeMySession, listMyPasskeys, renameMyPasskey, deleteMyPasskey]) {
    test(handler.name, async () => {
      assert.equal((await runHandler(handler, ctx(prisma, { body: {} }))).status, 401);
    });
  }
});

describe('changePassword', () => {
  test('needs the current password, then signs out other devices', async () => {
    const { user } = await signedIn({ username: 'mom' });
    await startSession(prisma, user); // another device
    const bad = await runHandler(changePassword, ctx(prisma, { user, body: { currentPassword: 'wrong wrong wrong', newPassword: 'a whole new phrase' } }));
    assert.equal(bad.status, 400);
    assert.match(bad.body.message, /current password/i);

    const weak = await runHandler(changePassword, ctx(prisma, { user, body: { currentPassword: PASSWORD, newPassword: 'short' } }));
    assert.equal(weak.status, 400);

    const res = await runHandler(changePassword, ctx(prisma, { user, body: { currentPassword: PASSWORD, newPassword: 'a whole new phrase' } }));
    assert.equal(res.status, 200);
    const saved = await prisma.user.findUnique({ where: { id: user.id } });
    assert.equal(await verifyPassword('a whole new phrase', saved.passwordHash), true);
    const sessions = await prisma.session.findMany({ where: { userId: user.id } });
    assert.deepEqual(sessions.map((s) => s.id), [user.sessionId], 'only this device stays signed in');
  });

  test('passkey-only users can add a password without a current one', async () => {
    const { user } = await signedIn({ username: 'kid', password: false });
    const res = await runHandler(changePassword, ctx(prisma, { user, body: { newPassword: 'my first password' } }));
    assert.equal(res.status, 200);
  });
});

describe('sessions', () => {
  test('lists only my sessions and marks this one', async () => {
    const { user } = await signedIn({ username: 'mom' });
    await startSession(prisma, user, { userAgent: 'Phone' });
    const other = await createUser(prisma, { username: 'dad' });
    await startSession(prisma, other);
    const res = await runHandler(listMySessions, ctx(prisma, { user }));
    assert.equal(res.body.sessions.length, 2);
    assert.equal(res.body.sessions.filter((s) => s.current).length, 1);
    assert.equal(res.body.sessions.find((s) => s.current).userAgent, 'This browser');
    for (const s of res.body.sessions) assert.match(s.id, /^[0-9a-f]{12}$/, 'only a short, non-secret handle');
  });

  test('can revoke my other sessions but not someone else’s', async () => {
    const { user } = await signedIn({ username: 'mom' });
    const { session: mine } = await startSession(prisma, user);
    const dad = await createUser(prisma, { username: 'dad' });
    const { session: his } = await startSession(prisma, dad);
    const handle = (s) => s.id.slice(0, 12);

    assert.equal((await runHandler(revokeMySession, ctx(prisma, { user, body: { id: handle(his) } }))).status, 404);
    assert.equal(await prisma.session.count({ where: { id: his.id } }), 1);
    assert.equal((await runHandler(revokeMySession, ctx(prisma, { user, body: { id: handle(mine) } }))).status, 200);
    assert.equal(await prisma.session.count({ where: { id: mine.id } }), 0);
  });
});

describe('passkeys', () => {
  test('list, rename and delete my own passkeys only', async () => {
    const { user } = await signedIn({ username: 'mom' });
    const dad = await createUser(prisma, { username: 'dad' });
    await passkey(user.id, 'mine-1', 'Phone');
    await passkey(dad.id, 'his-1', 'Laptop');

    const list = await runHandler(listMyPasskeys, ctx(prisma, { user }));
    assert.deepEqual(list.body.passkeys.map((p) => p.name), ['Phone']);
    assert.equal(list.body.passkeys[0].publicKey, undefined);

    assert.equal((await runHandler(renameMyPasskey, ctx(prisma, { user, body: { id: 'his-1', name: 'Mine now' } }))).status, 404);
    assert.equal((await runHandler(renameMyPasskey, ctx(prisma, { user, body: { id: 'mine-1', name: '  ' } }))).status, 400);
    const renamed = await runHandler(renameMyPasskey, ctx(prisma, { user, body: { id: 'mine-1', name: 'iPhone' } }));
    assert.equal(renamed.body.passkey.name, 'iPhone');

    assert.equal((await runHandler(deleteMyPasskey, ctx(prisma, { user, body: { id: 'his-1' } }))).status, 404);
    assert.equal((await runHandler(deleteMyPasskey, ctx(prisma, { user, body: { id: 'mine-1' } }))).status, 200);
    assert.equal(await prisma.passkey.count({ where: { userId: user.id } }), 0);
  });

  test('cannot delete the last way to sign in', async () => {
    const { user } = await signedIn({ username: 'kid', password: false });
    await passkey(user.id, 'only-1');
    const res = await runHandler(deleteMyPasskey, ctx(prisma, { user, body: { id: 'only-1' } }));
    assert.equal(res.status, 400);
    assert.match(res.body.message, /password first/i);
  });
});

test('session handles come from the stored hash, never the token', async () => {
  const { user, token } = await signedIn({ username: 'mom' });
  const res = await runHandler(listMySessions, ctx(prisma, { user }));
  assert.equal(res.body.sessions[0].id, hashToken(token).slice(0, 12));
});
