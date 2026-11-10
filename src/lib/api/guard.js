// The one authorisation check every handler starts with:
//   const denied = deny(ctx, 'edit'); if (denied) return denied;
// No user → 401 (sign in); signed in without the role → 403.
import { can } from '../auth/roles.js';
import { userKeyFor } from '../offline/state.js';
import { badRequest, conflict, forbidden, unauthorized } from './run.js';

export function deny(ctx, action) {
  if (!ctx.user || !ctx.user.isActive) return unauthorized();
  return can(ctx.user, action) ? null : forbidden();
}

/**
 * Ticks queued offline carry `queuedBy` (who made them). If someone else has
 * since signed in on that device, refuse rather than record it as them.
 */
export function wrongPerson(ctx) {
  const { queuedBy } = ctx.body;
  if (queuedBy === undefined) return null;
  if (typeof queuedBy !== 'string') return badRequest();
  return queuedBy === userKeyFor(ctx.user) ? null : conflict('This change was made by someone else on this device, so it wasn’t saved.');
}
