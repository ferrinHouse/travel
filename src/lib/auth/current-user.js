import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import prisma from '@/lib/db';
import { userFromSessionToken } from '@/lib/api/auth';
import { SESSION } from './session-policy';
import { can } from './roles';
import { loginRedirect } from './proxy-rules';

/** The signed-in user for this request (one DB lookup per render), or null. */
export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(SESSION.cookieName)?.value;
  return token ? userFromSessionToken(prisma, token) : null;
});

/**
 * For server pages: the signed-in user, or a redirect to /login that comes
 * back to `path`. With `action`, signed-in users without that permission get
 * sent home instead.
 */
export async function requirePageUser(path = '/', action = 'view') {
  const user = await getCurrentUser();
  if (!user) redirect(loginRedirect(path));
  if (!can(user, action)) redirect('/');
  return user;
}

export { clientUser } from './client-user';
