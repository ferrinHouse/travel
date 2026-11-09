const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF guard for state-changing requests. Browsers always send Origin on
 * cross-site POST/PUT/DELETE; if it's present it must be ours. Requests with
 * no Origin come from non-browser clients, which can't ride a user's cookie.
 */
export function originAllowed({ method, origin, appOrigin, host }) {
  if (SAFE_METHODS.has(String(method).toUpperCase())) return true;
  if (!origin) return true;
  if (appOrigin) return origin === appOrigin;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
