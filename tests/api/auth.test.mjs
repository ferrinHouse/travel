import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { scryptSync, randomBytes } from 'node:crypto';
import { createTestDb } from '../support/test-db.mjs';
import { createUser, ctx, PASSWORD } from '../support/users.mjs';
import { runHandler } from '../../src/lib/api/run.js';
import {
  login,
  logout,
  currentUser,
  setupStatus,
  setup,
  inviteDetails,
  acceptInvite,
  userFromSessionToken,
  startSession,
} from '../../src/lib/api/auth.js';
import { hashToken } from '../../src/lib/auth/tokens.js';
import { createRateLimiter } from '../../src/lib/auth/rate-limit.js';
import { verifyPassword, needsRehash } from '../../src/lib/auth/password.js';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
let db;
let prisma;

before(async () => {
  db = await createTestDb();
  prisma = db.prisma;
});
after(() => db.cleanup());
beforeEach(async () => {
  await prisma.user.deleteMany();
  await prisma.authChallenge.deleteMany();
});

const cookieOf = (res) => res.cookies?.find((c) => c.name === 'travel_session');

describe('login', () => {
  test('correct password starts a session and sets a secure cookie', async () => {
    const mom = await createUser(prisma, { username: 'mom', role: 'member' });
    const res = await runHandler(login, ctx(prisma, { body: { username: '  MOM ', password: PASSWORD } }));
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.user, { id: mom.id, username: 'mom', displayName: mom.displayName, role: 'member' });

    const cookie = cookieOf(res);
    assert.match(cookie.value, /^[\w-]{43}$/);
    assert.deepEqual(
      { httpOnly: cookie.options.httpOnly, secure: cookie.options.secure, sameSite: cookie.options.sameSite, path: cookie.options.path },
      { httpOnly: true, secure: true, sameSite: 'lax', path: '/' }
    );
    assert.equal(cookie.options.maxAge, 90 * 24 * 60 * 60);

    const session = await prisma.session.findUnique({ where: { id: hashToken(cookie.value) } });
    assert.equal(session.userId, mom.id);
    assert.equal(session.userAgent, 'test-agent');
    assert.ok((await prisma.user.findUnique({ where: { id: mom.id } })).lastLoginAt);
    assert.equal(await prisma.session.count({ where: { id: cookie.value } }), 0, 'raw token never stored');
  });

  test('every failure gives the same 401 message', async () => {
    await createUser(prisma, { username: 'kid' });
    await createUser(prisma, { username: 'gone', isActive: false });
    await createUser(prisma, { username: 'newbie', password: false });
    for (const body of [
      { username: 'kid', password: 'wrong password!!' },
      { username: 'nobody', password: PASSWORD },
      { username: 'gone', password: PASSWORD },
      { username: 'newbie', password: PASSWORD },
      { username: 'kid' },
      null,
    ]) {
      const res = await runHandler(login, ctx(prisma, { body }));
      assert.equal(res.status, body === null ? 400 : 401, JSON.stringify(body));
      if (res.status === 401) assert.equal(res.body.message, 'Incorrect username or password.');
      assert.equal(cookieOf(res), undefined);
    }
    assert.equal(await prisma.session.count(), 0);
  });

  test('repeated failures are rate limited per IP and per username', async () => {
    await createUser(prisma, { username: 'kid' });
    const limiter = createRateLimiter({ limit: 3, windowMs: 15 * 60 * 1000 });
    const attempt = (ip, username = 'kid', password = 'nope nope nope') =>
      runHandler(login, ctx(prisma, { body: { username, password }, request: { ip }, limiter }));

    for (let i = 0; i < 3; i++) assert.equal((await attempt('1.1.1.1')).status, 401);
    const blocked = await attempt('1.1.1.1');
    assert.equal(blocked.status, 429);
    assert.match(blocked.body.message, /Too many attempts/);
    assert.ok(blocked.body.retryAfterSeconds > 0);

    // A different IP guessing the same username is also stopped.
    assert.equal((await attempt('2.2.2.2')).status, 429);
    // Unrelated users and IPs are unaffected.
    assert.equal((await attempt('3.3.3.3', 'someone-else')).status, 401);
  });

  test('a successful login clears the username counter', async () => {
    await createUser(prisma, { username: 'kid' });
    const limiter = createRateLimiter({ limit: 3, windowMs: 60_000 });
    const attempt = (password, ip) => runHandler(login, ctx(prisma, { body: { username: 'kid', password }, request: { ip }, limiter }));
    await attempt('nope nope nope', '9.9.9.1');
    await attempt('nope nope nope', '9.9.9.2');
    assert.equal((await attempt(PASSWORD, '9.9.9.3')).status, 200);
    assert.equal((await attempt('nope nope nope', '9.9.9.4')).status, 401, 'not 429');
  });

  test('old weaker hashes are upgraded on login', async () => {
    const salt = randomBytes(16);
    const weak = `scrypt$1024$8$1$${salt.toString('base64url')}$${scryptSync(PASSWORD, salt, 32, { N: 1024, r: 8, p: 1 }).toString('base64url')}`;
    const user = await prisma.user.create({ data: { username: 'legacy', displayName: 'Legacy', passwordHash: weak } });
    assert.equal((await runHandler(login, ctx(prisma, { body: { username: 'legacy', password: PASSWORD } }))).status, 200);
    const { passwordHash } = await prisma.user.findUnique({ where: { id: user.id } });
    assert.equal(needsRehash(passwordHash), false);
    assert.equal(await verifyPassword(PASSWORD, passwordHash), true);
  });
});

describe('sessions', () => {
  test('a valid token resolves to its user', async () => {
    const user = await createUser(prisma, { role: 'admin' });
    const { token } = await startSession(prisma, user, { userAgent: 'x' });
    const found = await userFromSessionToken(prisma, token);
    assert.equal(found.id, user.id);
    assert.equal(found.role, 'admin');
    assert.equal(found.passwordHash, undefined, 'never exposes the hash');
  });

  test('unknown, idle, expired and disabled sessions resolve to nobody and are cleaned up', async () => {
    const user = await createUser(prisma);
    assert.equal(await userFromSessionToken(prisma, 'not-a-real-token'), null);
    assert.equal(await userFromSessionToken(prisma, undefined), null);

    const now = new Date();
    const idle = await startSession(prisma, user, { now: new Date(now.getTime() - 31 * DAY) });
    assert.equal(await userFromSessionToken(prisma, idle.token, now), null);
    assert.equal(await prisma.session.count({ where: { id: hashToken(idle.token) } }), 0);

    const expired = await startSession(prisma, user, { now: new Date(now.getTime() - 91 * DAY) });
    await prisma.session.update({ where: { id: hashToken(expired.token) }, data: { lastSeenAt: now } });
    assert.equal(await userFromSessionToken(prisma, expired.token, now), null);

    const live = await startSession(prisma, user);
    await prisma.user.update({ where: { id: user.id }, data: { isActive: false } });
    assert.equal(await userFromSessionToken(prisma, live.token), null);
  });

  test('lastSeenAt is refreshed at most hourly', async () => {
    const user = await createUser(prisma);
    const t0 = new Date('2026-11-08T12:00:00Z');
    const { token } = await startSession(prisma, user, { now: t0 });
    const seen = async () => (await prisma.session.findUnique({ where: { id: hashToken(token) } })).lastSeenAt.getTime();

    await userFromSessionToken(prisma, token, new Date(t0.getTime() + 30 * 60 * 1000));
    assert.equal(await seen(), t0.getTime());
    const later = new Date(t0.getTime() + 2 * HOUR);
    await userFromSessionToken(prisma, token, later);
    assert.equal(await seen(), later.getTime());
  });

  test('logout deletes the session and clears the cookie', async () => {
    const user = await createUser(prisma);
    const { token } = await startSession(prisma, user);
    const res = await runHandler(logout, ctx(prisma, { user, sessionToken: token }));
    assert.equal(res.status, 200);
    assert.equal(await prisma.session.count(), 0);
    const cookie = cookieOf(res);
    assert.equal(cookie.value, '');
    assert.equal(cookie.options.maxAge, 0);
  });

  test('currentUser reports who is signed in, or null', async () => {
    const user = await createUser(prisma, { role: 'member', username: 'dad' });
    assert.deepEqual((await runHandler(currentUser, ctx(prisma, { user }))).body.user, {
      id: user.id, username: 'dad', displayName: user.displayName, role: 'member',
    });
    assert.equal((await runHandler(currentUser, ctx(prisma))).body.user, null);
  });
});

describe('first-run setup', () => {
  const body = { token: 'setup-token-for-tests', username: 'Mike', displayName: 'Mike', password: 'a long family passphrase' };

  test('is only offered while there are no users and a setup token is configured', async () => {
    assert.equal((await runHandler(setupStatus, ctx(prisma))).body.needed, true);
    assert.equal((await runHandler(setupStatus, ctx(prisma, { config: { setupToken: '' } }))).body.needed, false);
    await createUser(prisma);
    assert.equal((await runHandler(setupStatus, ctx(prisma))).body.needed, false);
  });

  test('creates the first admin and signs them in', async () => {
    const res = await runHandler(setup, ctx(prisma, { body }));
    assert.equal(res.status, 200);
    assert.equal(res.body.user.role, 'admin');
    assert.equal(res.body.user.username, 'mike');
    assert.ok(cookieOf(res).value);
  });

  test('refuses a wrong token, bad input, or a second run', async () => {
    assert.equal((await runHandler(setup, ctx(prisma, { body: { ...body, token: 'guess' } }))).status, 403);
    assert.equal((await runHandler(setup, ctx(prisma, { body: { ...body, token: undefined } }))).status, 403);
    assert.equal((await runHandler(setup, ctx(prisma, { body: { ...body, password: 'short' } }))).status, 400);
    assert.equal((await runHandler(setup, ctx(prisma, { body: { ...body, username: 'no spaces allowed' } }))).status, 400);
    assert.equal((await runHandler(setup, ctx(prisma, { body, config: { setupToken: '' } }))).status, 404);
    assert.equal((await runHandler(setup, ctx(prisma, { body }))).status, 200);
    assert.equal((await runHandler(setup, ctx(prisma, { body: { ...body, username: 'second' } }))).status, 404);
    assert.equal(await prisma.user.count(), 1);
  });

  test('wrong setup tokens are rate limited', async () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 });
    for (let i = 0; i < 2; i++) assert.equal((await runHandler(setup, ctx(prisma, { body: { ...body, token: 'x' }, limiter }))).status, 403);
    assert.equal((await runHandler(setup, ctx(prisma, { body, limiter }))).status, 429);
  });
});

describe('invite and reset links', () => {
  async function invite(user, { purpose = 'invite', expiresIn = DAY, usedAt = null } = {}) {
    const token = randomBytes(32).toString('base64url');
    await prisma.invite.create({
      data: { id: hashToken(token), userId: user.id, purpose, expiresAt: new Date(Date.now() + expiresIn), usedAt },
    });
    return token;
  }

  test('details show who the link is for', async () => {
    const kid = await createUser(prisma, { username: 'kid', displayName: 'Kiddo', password: false });
    const token = await invite(kid);
    const res = await runHandler(inviteDetails, ctx(prisma, { body: { token } }));
    assert.deepEqual(res.body, { success: true, username: 'kid', displayName: 'Kiddo', purpose: 'invite' });
  });

  test('unknown, expired, used and disabled-user links are all 404', async () => {
    const kid = await createUser(prisma, { username: 'kid', password: false });
    const gone = await createUser(prisma, { username: 'gone', isActive: false });
    for (const token of ['nope', await invite(kid, { expiresIn: -1 }), await invite(kid, { usedAt: new Date() }), await invite(gone)]) {
      assert.equal((await runHandler(inviteDetails, ctx(prisma, { body: { token } }))).status, 404);
      assert.equal((await runHandler(acceptInvite, ctx(prisma, { body: { token, password: 'a long family passphrase' } }))).status, 404);
    }
  });

  test('accepting sets the password, signs in, and burns the link', async () => {
    const kid = await createUser(prisma, { username: 'kid', password: false });
    const token = await invite(kid);
    assert.equal((await runHandler(acceptInvite, ctx(prisma, { body: { token, password: 'short' } }))).status, 400);

    const res = await runHandler(acceptInvite, ctx(prisma, { body: { token, password: 'a long family passphrase' } }));
    assert.equal(res.status, 200);
    assert.equal(res.body.user.username, 'kid');
    assert.ok(cookieOf(res).value);
    const saved = await prisma.user.findUnique({ where: { id: kid.id } });
    assert.equal(await verifyPassword('a long family passphrase', saved.passwordHash), true);
    assert.ok((await prisma.invite.findUnique({ where: { id: hashToken(token) } })).usedAt);

    assert.equal((await runHandler(acceptInvite, ctx(prisma, { body: { token, password: 'another long phrase' } }))).status, 404);
  });

  test('a reset link signs out every other session', async () => {
    const mom = await createUser(prisma, { username: 'mom' });
    await startSession(prisma, mom);
    await startSession(prisma, mom);
    const token = await invite(mom, { purpose: 'reset' });
    const res = await runHandler(acceptInvite, ctx(prisma, { body: { token, password: 'a brand new passphrase' } }));
    assert.equal(res.status, 200);
    const sessions = await prisma.session.findMany({ where: { userId: mom.id } });
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].id, hashToken(cookieOf(res).value));
  });
});
