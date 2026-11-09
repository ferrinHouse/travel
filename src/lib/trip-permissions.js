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
    canEdit: isAdmin && !!editMode,
    isAdmin,
  };
}
