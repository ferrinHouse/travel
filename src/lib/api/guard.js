// The one authorisation check every handler starts with:
//   const denied = deny(ctx, 'edit'); if (denied) return denied;
// No user → 401 (sign in); signed in without the role → 403.
import { can } from '../auth/roles.js';
import { forbidden, unauthorized } from './run.js';

export function deny(ctx, action) {
  if (!ctx.user || !ctx.user.isActive) return unauthorized();
  return can(ctx.user, action) ? null : forbidden();
}
