import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { isPublicPath, loginRedirect } from '../src/lib/auth/proxy-rules.js';

describe('isPublicPath', () => {
  test('sign-in pages and health checks are open', () => {
    for (const path of ['/login', '/setup', '/invite/abc123', '/api/health', '/api/auth/login', '/_next/static/x.js', '/favicon.ico']) {
      assert.equal(isPublicPath(path), true, path);
    }
  });

  test('everything else needs a session', () => {
    for (const path of ['/', '/trips/chicago', '/account', '/admin/users', '/loginx', '/invite', '/setup-wizard', '/api/checklist']) {
      assert.equal(isPublicPath(path), false, path);
    }
  });
});

describe('loginRedirect', () => {
  test('keeps where the visitor was going', () => {
    assert.equal(loginRedirect('/trips/chicago', '?tab=meals'), '/login?next=%2Ftrips%2Fchicago%3Ftab%3Dmeals');
  });

  test('the dashboard needs no next parameter', () => {
    assert.equal(loginRedirect('/', ''), '/login');
  });
});
