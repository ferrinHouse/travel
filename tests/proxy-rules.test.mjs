import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { isPublicPath, loginRedirect } from '../src/lib/auth/proxy-rules.js';

describe('isPublicPath', () => {
  test('sign-in pages and health checks are open', () => {
    for (const path of ['/login', '/setup', '/invite/abc123', '/share/abc123', '/api/share/abc/1/sm', '/api/health', '/api/auth/login', '/_next/static/x.js', '/favicon.ico']) {
      assert.equal(isPublicPath(path), true, path);
    }
  });

  test('the app shell is open: installing and the offline page work before sign-in', () => {
    for (const path of ['/sw.js', '/sw-core.js', '/manifest.webmanifest', '/offline', '/icons/icon-192.png', '/icon.svg', '/apple-icon.png']) {
      assert.equal(isPublicPath(path), true, path);
    }
  });

  test('everything else needs a session', () => {
    for (const path of ['/', '/trips/chicago', '/account', '/admin/users', '/loginx', '/invite', '/share', '/trips/x/story', '/api/photos/1/sm', '/setup-wizard', '/api/checklist', '/offline/x', '/icons', '/sw.jsx']) {
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
