import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, needsRehash, passwordProblem } from '../src/lib/auth/password.js';
import { newToken, hashToken } from '../src/lib/auth/tokens.js';
import { ROLES, isRole, can } from '../src/lib/auth/roles.js';
import { safeNextPath } from '../src/lib/auth/safe-redirect.js';
import { createRateLimiter } from '../src/lib/auth/rate-limit.js';
import { SESSION, sessionState, shouldTouch } from '../src/lib/auth/session-policy.js';
import { originAllowed } from '../src/lib/auth/origin.js';
import { normalizeUsername, displayNameProblem } from '../src/lib/auth/validate.js';

describe('password hashing', () => {
  test('hashes are salted, versioned and verify', async () => {
    const a = await hashPassword('correct horse battery');
    const b = await hashPassword('correct horse battery');
    assert.notEqual(a, b, 'random salt');
    assert.match(a, /^scrypt\$\d+\$\d+\$\d+\$[\w-]+\$[\w-]+$/);
    assert.equal(await verifyPassword('correct horse battery', a), true);
    assert.equal(await verifyPassword('correct horse batterY', a), false);
    assert.equal(await verifyPassword('', a), false);
  });

  test('malformed or missing hashes never verify (and never throw)', async () => {
    for (const bad of [null, undefined, '', 'plain', 'scrypt$1$2', 'bcrypt$x$y$z$a$b', 'scrypt$abc$8$1$AAAA$AAAA']) {
      assert.equal(await verifyPassword('anything', bad), false, String(bad));
    }
    assert.equal(await verifyPassword(undefined, await hashPassword('something long')), false);
  });

  test('needsRehash flags weaker parameters', async () => {
    assert.equal(needsRehash(await hashPassword('something long')), false);
    assert.equal(needsRehash('scrypt$1024$8$1$AAAA$AAAA'), true);
    assert.equal(needsRehash('garbage'), true);
  });

  test('passwordProblem explains weak passwords', () => {
    assert.match(passwordProblem('short'), /at least 10/);
    assert.match(passwordProblem('          '), /at least 10/);
    assert.match(passwordProblem('x'.repeat(257)), /256/);
    assert.match(passwordProblem(42), /required/i);
    assert.equal(passwordProblem('a long family passphrase'), null);
  });
});

describe('tokens', () => {
  test('are long, url-safe and unique', () => {
    const t = newToken();
    assert.match(t, /^[\w-]{43}$/);
    assert.notEqual(t, newToken());
  });

  test('hashToken is a stable sha256 hex digest', () => {
    assert.equal(hashToken('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    assert.equal(hashToken('abc'), hashToken('abc'));
  });
});

describe('roles', () => {
  const user = (role, isActive = true) => ({ role, isActive });

  test('roles are ordered viewer < member < admin', () => {
    assert.deepEqual(ROLES, ['viewer', 'member', 'admin']);
    assert.equal(isRole('member'), true);
    assert.equal(isRole('owner'), false);
  });

  test('permission matrix', () => {
    const matrix = {
      view: ['viewer', 'member', 'admin'],
      toggle: ['member', 'admin'],
      'add-item': ['member', 'admin'],
      upload: ['member', 'admin'],
      edit: ['admin'],
      'manage-users': ['admin'],
    };
    for (const [action, allowed] of Object.entries(matrix)) {
      for (const role of ROLES) {
        assert.equal(can(user(role), action), allowed.includes(role), `${role} ${action}`);
      }
    }
  });

  test('nobody, disabled users and unknown actions get nothing', () => {
    assert.equal(can(null, 'view'), false);
    assert.equal(can(user('admin', false), 'view'), false);
    assert.equal(can(user('admin'), 'launch-missiles'), false);
    assert.equal(can(user('superuser'), 'view'), false);
  });
});

describe('safeNextPath', () => {
  test('keeps same-site relative paths', () => {
    assert.equal(safeNextPath('/trips/chicago?tab=meals'), '/trips/chicago?tab=meals');
    assert.equal(safeNextPath('/'), '/');
  });

  test('rejects anything that could leave the site or loop', () => {
    for (const bad of [
      null, '', 'trips', 'https://evil.example', '//evil.example', '/\\evil.example', '\\\\evil',
      '/%2F%2Fevil.example', 'javascript:alert(1)', '/login', '/login?next=/x', '/\nfoo', ' /trips',
    ]) {
      assert.equal(safeNextPath(bad), '/', JSON.stringify(bad));
    }
    assert.equal(safeNextPath('//evil', '/account'), '/account');
  });
});

describe('rate limiter', () => {
  test('allows `limit` hits per window, then reports when to retry', () => {
    let now = 1_000;
    const rl = createRateLimiter({ limit: 3, windowMs: 60_000, now: () => now });
    for (let i = 0; i < 3; i++) assert.equal(rl.hit('ip:1').allowed, true);
    const blocked = rl.hit('ip:1');
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.retryAfterMs, 60_000);
    assert.equal(rl.hit('ip:2').allowed, true, 'keys are independent');
    now += 60_000;
    assert.equal(rl.hit('ip:1').allowed, true, 'window resets');
  });

  test('reset clears a key (e.g. after a successful login)', () => {
    const rl = createRateLimiter({ limit: 1, windowMs: 1_000 });
    rl.hit('k');
    rl.reset('k');
    assert.equal(rl.hit('k').allowed, true);
  });
});

describe('session policy', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const now = new Date('2026-11-08T12:00:00Z');
  const ago = (ms) => new Date(now.getTime() - ms);

  test('constants', () => {
    assert.equal(SESSION.cookieName, 'travel_session');
    assert.equal(SESSION.maxAgeDays, 90);
    assert.equal(SESSION.idleDays, 30);
  });

  test('valid, idle and expired', () => {
    const later = new Date(now.getTime() + DAY);
    assert.equal(sessionState({ expiresAt: later, lastSeenAt: ago(DAY) }, now), 'valid');
    assert.equal(sessionState({ expiresAt: later, lastSeenAt: ago(31 * DAY) }, now), 'idle');
    assert.equal(sessionState({ expiresAt: ago(1), lastSeenAt: now }, now), 'expired');
    assert.equal(sessionState(null, now), 'expired');
  });

  test('lastSeenAt is written at most hourly', () => {
    assert.equal(shouldTouch({ lastSeenAt: ago(59 * 60 * 1000) }, now), false);
    assert.equal(shouldTouch({ lastSeenAt: ago(61 * 60 * 1000) }, now), true);
  });
});

describe('originAllowed (CSRF guard for mutating requests)', () => {
  const app = 'https://travel.example.com';
  test('reads are always allowed', () => {
    assert.equal(originAllowed({ method: 'GET', origin: 'https://evil.example', appOrigin: app }), true);
  });
  test('writes need a matching Origin when one is sent', () => {
    assert.equal(originAllowed({ method: 'POST', origin: app, appOrigin: app }), true);
    assert.equal(originAllowed({ method: 'DELETE', origin: 'https://evil.example', appOrigin: app }), false);
    assert.equal(originAllowed({ method: 'PUT', origin: 'null', appOrigin: app }), false);
  });
  test('non-browser clients without Origin are allowed (SameSite cookies cover browsers)', () => {
    assert.equal(originAllowed({ method: 'POST', origin: null, appOrigin: app }), true);
  });
  test('falls back to the request host when no app origin is configured', () => {
    assert.equal(originAllowed({ method: 'POST', origin: 'http://127.0.0.1:3000', host: '127.0.0.1:3000' }), true);
    assert.equal(originAllowed({ method: 'POST', origin: 'http://evil:3000', host: '127.0.0.1:3000' }), false);
  });
});

describe('username and display name', () => {
  test('usernames are normalised and restricted', () => {
    assert.equal(normalizeUsername('  Mike.Ferrin '), 'mike.ferrin');
    for (const bad of ['', 'a', 'has space', 'x'.repeat(33), 'émile', 'semi;colon', null]) {
      assert.equal(normalizeUsername(bad), null, String(bad));
    }
  });
  test('display names are required and bounded', () => {
    assert.equal(displayNameProblem('Mom'), null);
    assert.match(displayNameProblem('  '), /required/i);
    assert.match(displayNameProblem('x'.repeat(61)), /60/);
  });
});
