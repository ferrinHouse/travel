import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb } from '../support/test-db.mjs';
import { createUser, ctx, CONFIG } from '../support/users.mjs';
import { runHandler } from '../../src/lib/api/run.js';
import { registerOptions, registerVerify, loginOptions, loginVerify, CHALLENGE_TTL_MS } from '../../src/lib/api/passkeys.js';
import { createRateLimiter } from '../../src/lib/auth/rate-limit.js';
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
  await prisma.authChallenge.deleteMany();
});

/**
 * Stand-in for @simplewebauthn/server: records what the handlers ask it to
 * check and lets each test decide whether verification passes.
 */
function fakeWebauthn({ verified = true, credentialId = 'cred-new', newCounter = 5, throws = false } = {}) {
  const calls = [];
  return {
    calls,
    async generateRegistrationOptions(opts) {
      calls.push(['genReg', opts]);
      return { challenge: 'reg-challenge', rp: { id: opts.rpID, name: opts.rpName }, user: { name: opts.userName } };
    },
    async verifyRegistrationResponse(opts) {
      calls.push(['verifyReg', opts]);
      if (throws) throw new Error('bad attestation');
      return verified
        ? {
            verified: true,
            registrationInfo: {
              credential: { id: credentialId, publicKey: new Uint8Array([9, 9, 9]), counter: 0, transports: ['internal', 'hybrid'] },
              credentialDeviceType: 'multiDevice',
              credentialBackedUp: true,
            },
          }
        : { verified: false };
    },
    async generateAuthenticationOptions(opts) {
      calls.push(['genAuth', opts]);
      return { challenge: 'auth-challenge', rpId: opts.rpID };
    },
    async verifyAuthenticationResponse(opts) {
      calls.push(['verifyAuth', opts]);
      if (throws) throw new Error('bad signature');
      return verified ? { verified: true, authenticationInfo: { newCounter } } : { verified: false };
    },
  };
}

async function addPasskey(user, id = 'cred-1', counter = 1) {
  return prisma.passkey.create({
    data: { id, userId: user.id, publicKey: Buffer.from([1, 2, 3]), counter: BigInt(counter), transports: '["internal"]', name: 'Phone' },
  });
}

describe('registering a passkey', () => {
  test('needs a signed-in user', async () => {
    const webauthn = fakeWebauthn();
    assert.equal((await runHandler(registerOptions, ctx(prisma, { webauthn }))).status, 401);
    assert.equal((await runHandler(registerVerify, ctx(prisma, { webauthn, body: {} }))).status, 401);
  });

  test('options: stable webauthn handle, excludes existing keys, stores a short-lived challenge', async () => {
    const user = await createUser(prisma, { username: 'mom', displayName: 'Mom' });
    await addPasskey(user, 'old-key');
    const webauthn = fakeWebauthn();
    const res = await runHandler(registerOptions, ctx(prisma, { user, webauthn }));
    assert.equal(res.status, 200);
    assert.equal(res.body.options.challenge, 'reg-challenge');

    const [, opts] = webauthn.calls[0];
    assert.equal(opts.rpID, CONFIG.rpID);
    assert.equal(opts.rpName, CONFIG.rpName);
    assert.equal(opts.userName, 'mom');
    assert.equal(opts.userDisplayName, 'Mom');
    assert.deepEqual(opts.excludeCredentials, [{ id: 'old-key', transports: ['internal'] }]);
    assert.equal(opts.authenticatorSelection.residentKey, 'required');

    const saved = await prisma.user.findUnique({ where: { id: user.id } });
    assert.ok(saved.webauthnUserId, 'handle generated');
    assert.deepEqual([...opts.userID], [...Buffer.from(saved.webauthnUserId, 'base64url')]);

    // The handle doesn't change on the next registration.
    await runHandler(registerOptions, ctx(prisma, { user: saved, webauthn }));
    assert.equal((await prisma.user.findUnique({ where: { id: user.id } })).webauthnUserId, saved.webauthnUserId);

    const challenge = await prisma.authChallenge.findUnique({ where: { id: res.body.challengeId } });
    assert.equal(challenge.purpose, 'register');
    assert.equal(challenge.userId, user.id);
    assert.equal(challenge.challenge, 'reg-challenge');
    assert.ok(challenge.expiresAt - Date.now() <= CHALLENGE_TTL_MS);
  });

  test('verify: saves the passkey and burns the challenge', async () => {
    const user = await createUser(prisma, { username: 'mom' });
    const webauthn = fakeWebauthn();
    const { body } = await runHandler(registerOptions, ctx(prisma, { user, webauthn }));
    const response = { id: 'cred-new', response: {} };
    const res = await runHandler(registerVerify, ctx(prisma, { user, webauthn, body: { challengeId: body.challengeId, response, name: 'My phone' } }));
    assert.equal(res.status, 200);
    assert.equal(res.body.passkey.name, 'My phone');

    const [, opts] = webauthn.calls.find(([n]) => n === 'verifyReg');
    assert.equal(opts.expectedChallenge, 'reg-challenge');
    assert.equal(opts.expectedOrigin, CONFIG.origin);
    assert.equal(opts.expectedRPID, CONFIG.rpID);
    assert.equal(opts.response, response);

    const saved = await prisma.passkey.findUnique({ where: { id: 'cred-new' } });
    assert.equal(saved.userId, user.id);
    assert.deepEqual([...saved.publicKey], [9, 9, 9]);
    assert.deepEqual(JSON.parse(saved.transports), ['internal', 'hybrid']);
    assert.equal(saved.deviceType, 'multiDevice');
    assert.equal(saved.backedUp, true);
    assert.equal(await prisma.authChallenge.count(), 0, 'challenge is single-use');

    const again = await runHandler(registerVerify, ctx(prisma, { user, webauthn, body: { challengeId: body.challengeId, response } }));
    assert.equal(again.status, 400);
  });

  test('verify: a default name, failed checks, and other people’s challenges', async () => {
    const user = await createUser(prisma, { username: 'mom' });
    const dad = await createUser(prisma, { username: 'dad' });

    let webauthn = fakeWebauthn({ verified: false });
    let { body } = await runHandler(registerOptions, ctx(prisma, { user, webauthn }));
    assert.equal((await runHandler(registerVerify, ctx(prisma, { user, webauthn, body: { challengeId: body.challengeId, response: {} } }))).status, 400);

    webauthn = fakeWebauthn({ throws: true });
    ({ body } = await runHandler(registerOptions, ctx(prisma, { user, webauthn })));
    assert.equal((await runHandler(registerVerify, ctx(prisma, { user, webauthn, body: { challengeId: body.challengeId, response: {} } }))).status, 400);

    webauthn = fakeWebauthn();
    ({ body } = await runHandler(registerOptions, ctx(prisma, { user, webauthn })));
    assert.equal(
      (await runHandler(registerVerify, ctx(prisma, { user: dad, webauthn, body: { challengeId: body.challengeId, response: {} } }))).status,
      400,
      'a challenge only works for the user it was issued to',
    );
    ({ body } = await runHandler(registerOptions, ctx(prisma, { user, webauthn })));
    const ok = await runHandler(registerVerify, ctx(prisma, { user, webauthn, body: { challengeId: body.challengeId, response: {} } }));
    assert.equal(ok.body.passkey.name, 'Passkey');
  });

  test('verify: expired challenges are refused', async () => {
    const user = await createUser(prisma, { username: 'mom' });
    const webauthn = fakeWebauthn();
    const { body } = await runHandler(registerOptions, ctx(prisma, { user, webauthn }));
    const later = new Date(Date.now() + CHALLENGE_TTL_MS + 1000);
    const res = await runHandler(registerVerify, ctx(prisma, { user, webauthn, now: later, body: { challengeId: body.challengeId, response: {} } }));
    assert.equal(res.status, 400);
    assert.match(res.body.message, /try again/i);
  });

  test('verify: the same authenticator cannot be registered twice', async () => {
    const user = await createUser(prisma, { username: 'mom' });
    await addPasskey(user, 'cred-new');
    const webauthn = fakeWebauthn({ credentialId: 'cred-new' });
    const { body } = await runHandler(registerOptions, ctx(prisma, { user, webauthn }));
    assert.equal((await runHandler(registerVerify, ctx(prisma, { user, webauthn, body: { challengeId: body.challengeId, response: {} } }))).status, 409);
  });
});

describe('signing in with a passkey', () => {
  test('options are public, discoverable (no allow list) and stored', async () => {
    const webauthn = fakeWebauthn();
    const res = await runHandler(loginOptions, ctx(prisma, { webauthn }));
    assert.equal(res.status, 200);
    const [, opts] = webauthn.calls[0];
    assert.equal(opts.rpID, CONFIG.rpID);
    assert.equal(opts.allowCredentials, undefined);
    const challenge = await prisma.authChallenge.findUnique({ where: { id: res.body.challengeId } });
    assert.equal(challenge.purpose, 'login');
    assert.equal(challenge.userId, null);
  });

  test('options clear out stale challenges', async () => {
    await prisma.authChallenge.create({ data: { id: 'stale', challenge: 'x', purpose: 'login', expiresAt: new Date(Date.now() - 1000) } });
    await runHandler(loginOptions, ctx(prisma, { webauthn: fakeWebauthn() }));
    assert.equal(await prisma.authChallenge.count({ where: { id: 'stale' } }), 0);
  });

  test('verify: signs in, bumps the counter and sets the cookie', async () => {
    const user = await createUser(prisma, { username: 'mom' });
    await addPasskey(user, 'cred-1', 1);
    const webauthn = fakeWebauthn({ newCounter: 7 });
    const { body } = await runHandler(loginOptions, ctx(prisma, { webauthn }));
    const response = { id: 'cred-1', response: {} };
    const res = await runHandler(loginVerify, ctx(prisma, { webauthn, body: { challengeId: body.challengeId, response } }));
    assert.equal(res.status, 200);
    assert.equal(res.body.user.username, 'mom');
    const cookie = res.cookies.find((c) => c.name === 'travel_session');
    assert.ok(cookie.value);
    assert.equal(await prisma.session.count({ where: { id: hashToken(cookie.value), userId: user.id } }), 1);

    const [, opts] = webauthn.calls.find(([n]) => n === 'verifyAuth');
    assert.equal(opts.expectedChallenge, 'auth-challenge');
    assert.equal(opts.expectedOrigin, CONFIG.origin);
    assert.equal(opts.credential.id, 'cred-1');
    assert.equal(opts.credential.counter, 1);
    assert.deepEqual([...opts.credential.publicKey], [1, 2, 3]);
    assert.deepEqual(opts.credential.transports, ['internal']);

    const key = await prisma.passkey.findUnique({ where: { id: 'cred-1' } });
    assert.equal(key.counter, 7n);
    assert.ok(key.lastUsedAt);
    assert.ok((await prisma.user.findUnique({ where: { id: user.id } })).lastLoginAt);
    assert.equal(await prisma.authChallenge.count(), 0);
  });

  test('verify: unknown keys, disabled users and failed checks get the same 401', async () => {
    const mom = await createUser(prisma, { username: 'mom' });
    const gone = await createUser(prisma, { username: 'gone', isActive: false });
    await addPasskey(mom, 'cred-mom');
    await addPasskey(gone, 'cred-gone');

    for (const [webauthn, credId] of [
      [fakeWebauthn(), 'cred-unknown'],
      [fakeWebauthn(), 'cred-gone'],
      [fakeWebauthn({ verified: false }), 'cred-mom'],
      [fakeWebauthn({ throws: true }), 'cred-mom'],
    ]) {
      const { body } = await runHandler(loginOptions, ctx(prisma, { webauthn }));
      const res = await runHandler(loginVerify, ctx(prisma, { webauthn, body: { challengeId: body.challengeId, response: { id: credId } } }));
      assert.equal(res.status, 401, credId);
      assert.equal(res.cookies, undefined);
    }
    assert.equal(await prisma.session.count(), 0);
  });

  test('verify: challenge must exist, be a login challenge and be fresh', async () => {
    const user = await createUser(prisma, { username: 'mom' });
    await addPasskey(user, 'cred-1');
    const webauthn = fakeWebauthn();
    assert.equal((await runHandler(loginVerify, ctx(prisma, { webauthn, body: { challengeId: 'nope', response: { id: 'cred-1' } } }))).status, 400);

    const reg = await runHandler(registerOptions, ctx(prisma, { user, webauthn }));
    assert.equal(
      (await runHandler(loginVerify, ctx(prisma, { webauthn, body: { challengeId: reg.body.challengeId, response: { id: 'cred-1' } } }))).status,
      400,
      'register challenges cannot be used to sign in',
    );
    assert.equal((await runHandler(loginVerify, ctx(prisma, { webauthn, body: null }))).status, 400);
  });

  test('both endpoints are rate limited per IP', async () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 60_000 });
    const webauthn = fakeWebauthn();
    await runHandler(loginOptions, ctx(prisma, { webauthn, limiter }));
    await runHandler(loginOptions, ctx(prisma, { webauthn, limiter }));
    assert.equal((await runHandler(loginOptions, ctx(prisma, { webauthn, limiter }))).status, 429);
    assert.equal((await runHandler(loginVerify, ctx(prisma, { webauthn, limiter, body: { challengeId: 'x', response: {} } }))).status, 429);
  });
});

describe('with the real @simplewebauthn/server', () => {
  test('generates options the browser can use', async () => {
    const user = await createUser(prisma, { username: 'mom', displayName: 'Mom' });
    const reg = await runHandler(registerOptions, ctx(prisma, { user }));
    assert.equal(reg.status, 200);
    assert.equal(reg.body.options.rp.id, CONFIG.rpID);
    assert.equal(reg.body.options.user.name, 'mom');
    assert.equal(reg.body.options.authenticatorSelection.residentKey, 'required');
    const saved = await prisma.authChallenge.findUnique({ where: { id: reg.body.challengeId } });
    assert.equal(saved.challenge, reg.body.options.challenge);

    const auth = await runHandler(loginOptions, ctx(prisma));
    assert.equal(auth.status, 200);
    assert.equal(auth.body.options.rpId, CONFIG.rpID);
    assert.ok(auth.body.options.challenge.length >= 16);
  });

  test('rejects a forged registration response', async () => {
    const user = await createUser(prisma, { username: 'mom' });
    const { body } = await runHandler(registerOptions, ctx(prisma, { user }));
    const forged = { id: 'abc', rawId: 'abc', type: 'public-key', response: { clientDataJSON: 'e30', attestationObject: 'AA' }, clientExtensionResults: {} };
    const res = await runHandler(registerVerify, ctx(prisma, { user, body: { challengeId: body.challengeId, response: forged } }));
    assert.equal(res.status, 400);
    assert.equal(await prisma.passkey.count(), 0);
  });
});
