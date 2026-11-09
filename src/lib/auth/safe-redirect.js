const BASE = 'http://local.invalid';

/**
 * Where to send someone after login. Only same-site absolute paths are
 * allowed; anything that could leave the site (or loop back to /login)
 * becomes `fallback`.
 */
export function safeNextPath(next, fallback = '/') {
  if (typeof next !== 'string' || !next.startsWith('/')) return fallback;
  if (next.startsWith('//') || next.includes('\\')) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(next)) return fallback;
  let decoded;
  try {
    decoded = decodeURIComponent(next);
  } catch {
    return fallback;
  }
  if (decoded.startsWith('//') || decoded.includes('\\')) return fallback;
  const url = new URL(next, BASE);
  if (url.origin !== BASE) return fallback;
  if (url.pathname === '/login' || url.pathname.startsWith('/login/')) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}
