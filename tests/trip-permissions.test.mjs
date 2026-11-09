import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canManagePhoto, tripPermissions } from '../src/lib/trip-permissions.js';

test('viewers only look', () => {
  assert.deepEqual(tripPermissions({ role: 'viewer', isActive: true }, true), {
    canToggle: false, canAdd: false, canUpload: false, canEdit: false, isAdmin: false,
  });
});

test('members tick and add, but never edit', () => {
  assert.deepEqual(tripPermissions({ role: 'member', isActive: true }, true), {
    canToggle: true, canAdd: true, canUpload: true, canEdit: false, isAdmin: false,
  });
});

test('admins edit only with edit mode switched on', () => {
  const admin = { role: 'admin', isActive: true };
  assert.deepEqual(tripPermissions(admin, false), { canToggle: true, canAdd: true, canUpload: true, canEdit: false, isAdmin: true });
  assert.deepEqual(tripPermissions(admin, true), { canToggle: true, canAdd: true, canUpload: true, canEdit: true, isAdmin: true });
});

test('no user, no permissions', () => {
  assert.deepEqual(tripPermissions(null, true), { canToggle: false, canAdd: false, canUpload: false, canEdit: false, isAdmin: false });
});

test('the user object sent to the browser keeps what the permission check needs', async () => {
  const { clientUser } = await import('../src/lib/auth/client-user.js');
  // Shaped like userFromSessionToken's result (a DB row minus the hash).
  const row = { id: 7, username: 'mom', displayName: 'Mom', role: 'admin', isActive: true, hasPassword: true, webauthnUserId: 'h', sessionId: 'secret-ish' };
  const sent = clientUser(row);
  assert.deepEqual(tripPermissions(sent, true), { canToggle: true, canAdd: true, canUpload: true, canEdit: true, isAdmin: true });
  assert.deepEqual(Object.keys(sent).sort(), ['displayName', 'hasPassword', 'id', 'isActive', 'role', 'username']);
  assert.equal(clientUser(null), null);
});

test('photos: members manage their own uploads; admins any photo, in edit mode', () => {
  const mine = { uploadedById: 7 };
  const theirs = { uploadedById: 8 };
  const member = tripPermissions({ id: 7, role: 'member', isActive: true });
  assert.equal(canManagePhoto(member, 7, mine), true);
  assert.equal(canManagePhoto(member, 7, theirs), false);
  assert.equal(canManagePhoto(tripPermissions({ id: 7, role: 'viewer', isActive: true }), 7, mine), false);
  const admin = { id: 1, role: 'admin', isActive: true };
  assert.equal(canManagePhoto(tripPermissions(admin, false), 1, theirs), false);
  assert.equal(canManagePhoto(tripPermissions(admin, true), 1, theirs), true);
  assert.equal(canManagePhoto(tripPermissions(admin, false), 1, { uploadedById: 1 }), true);
});
