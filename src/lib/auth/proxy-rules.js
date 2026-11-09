// Which paths a visitor without a session may load. The proxy (src/proxy.js)
// only checks that a cookie exists and redirects page loads to /login; pages
// and API handlers verify the session itself. API routes are excluded from the
// proxy matcher and answer 401 on their own, since a redirect would confuse fetch.

const OPEN_EXACT = new Set(['/login', '/setup', '/favicon.ico', '/robots.txt', '/api/health']);
const OPEN_PREFIXES = ['/invite/', '/_next/', '/api/auth/'];

export function isPublicPath(pathname) {
  return OPEN_EXACT.has(pathname) || OPEN_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function loginRedirect(pathname, search = '') {
  if (pathname === '/' && !search) return '/login';
  return `/login?next=${encodeURIComponent(`${pathname}${search}`)}`;
}
