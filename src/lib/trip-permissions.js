import { can } from './auth/roles.js';

/**
 * What the trip page lets this user do. Admins edit only while "Edit mode" is
 * on so a stray tap can't delete anything; the server enforces the same roles.
 */
export function tripPermissions(user, editMode = false) {
  const isAdmin = can(user, 'edit');
  return {
    canToggle: can(user, 'toggle'),
    canAdd: can(user, 'add-item'),
    canUpload: can(user, 'upload'),
    canEdit: isAdmin && !!editMode,
    isAdmin,
  };
}

/**
 * Caption, day and delete controls for one photo: members for their own
 * uploads, admins for any photo while Edit mode is on (the server allows
 * admins always; see src/lib/photos/access.js).
 */
export function canManagePhoto(permissions, userId, photo) {
  if (permissions.canEdit) return true;
  return permissions.canUpload && photo?.uploadedById != null && photo.uploadedById === userId;
}
