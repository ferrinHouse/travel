import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tripPermissions } from '../src/lib/trip-permissions.js';

test('viewers only look', () => {
  assert.deepEqual(tripPermissions({ role: 'viewer', isActive: true }, true), {
    canToggle: false, canAdd: false, canEdit: false, isAdmin: false,
  });
});

test('members tick and add, but never edit', () => {
  assert.deepEqual(tripPermissions({ role: 'member', isActive: true }, true), {
    canToggle: true, canAdd: true, canEdit: false, isAdmin: false,
  });
});

test('admins edit only with edit mode switched on', () => {
  const admin = { role: 'admin', isActive: true };
  assert.deepEqual(tripPermissions(admin, false), { canToggle: true, canAdd: true, canEdit: false, isAdmin: true });
  assert.deepEqual(tripPermissions(admin, true), { canToggle: true, canAdd: true, canEdit: true, isAdmin: true });
});

test('no user, no permissions', () => {
  assert.deepEqual(tripPermissions(null, true), { canToggle: false, canAdd: false, canEdit: false, isAdmin: false });
});

test('the user object sent to the browser keeps what the permission check needs', async () => {
  const { clientUser } = await import('../src/lib/auth/client-user.js');
  // Shaped like userFromSessionToken's result (a DB row minus the hash).
  const row = { id: 7, username: 'mom', displayName: 'Mom', role: 'admin', isActive: true, hasPassword: true, webauthnUserId: 'h', sessionId: 'secret-ish' };
  const sent = clientUser(row);
  assert.deepEqual(tripPermissions(sent, true), { canToggle: true, canAdd: true, canEdit: true, isAdmin: true });
  assert.deepEqual(Object.keys(sent).sort(), ['displayName', 'hasPassword', 'id', 'isActive', 'role', 'username']);
  assert.equal(clientUser(null), null);
});
