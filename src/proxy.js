import { NextResponse } from 'next/server';
import { SESSION } from '@/lib/auth/session-policy';
import { isPublicPath, loginRedirect } from '@/lib/auth/proxy-rules';

// Optimistic check only: no cookie → straight to /login. Whether the session is
// real is decided by requirePageUser() in each page and by every API handler.
export function proxy(request) {
  const { pathname, search } = request.nextUrl;
  if (isPublicPath(pathname) || request.cookies.has(SESSION.cookieName)) return NextResponse.next();
  return NextResponse.redirect(new URL(loginRedirect(pathname, search), request.url));
}

export const config = {
  // Static files and API routes skip the proxy; isPublicPath() decides the rest.
  matcher: ['/((?!api/|_next/static|_next/image|favicon.ico|robots.txt).*)'],
};
