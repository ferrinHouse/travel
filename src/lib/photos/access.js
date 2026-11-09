import { can } from '../auth/roles.js';

/** Captions, day and delete: admins for any photo, members for their own uploads. */
export function canChangePhoto(user, photo) {
  if (can(user, 'edit')) return true;
  return can(user, 'upload') && photo?.uploadedById != null && photo.uploadedById === user.id;
}
