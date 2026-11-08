import { cookies } from 'next/headers';

/**
 * Shared-passcode admin check (temporary). Replaced by per-user sessions and
 * role checks in the auth phase; kept in one place until then.
 */
export const ADMIN_COOKIE = 'admin_authenticated';

export async function isAdminRequest() {
  const cookieStore = await cookies();
  return cookieStore.get(ADMIN_COOKIE)?.value === 'true';
}
