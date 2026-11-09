// Turns an incoming request + environment into the plain values handlers use.
// Framework-free (Web-standard Headers/URL only) so it can be unit tested.

const DEFAULT_RP_NAME = 'Family Travel Adventures';

const blankToNull = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/**
 * App settings from env. APP_ORIGIN should be set in production (it is the
 * WebAuthn origin and the CSRF check); without it the request's own host is used.
 */
export function appConfig(env = process.env, request = {}) {
  let origin;
  if (blankToNull(env.APP_ORIGIN)) {
    try {
      origin = new URL(env.APP_ORIGIN.trim()).origin;
    } catch {
      throw new Error(`APP_ORIGIN is not a valid URL: ${env.APP_ORIGIN}`);
    }
    if (origin === 'null') throw new Error(`APP_ORIGIN is not a valid URL: ${env.APP_ORIGIN}`);
  } else {
    origin = `${request.proto ?? 'http'}://${request.host ?? 'localhost:3000'}`;
  }
  const { hostname, protocol } = new URL(origin);
  const secureCookies = blankToNull(env.APP_ORIGIN) ? protocol === 'https:' : env.NODE_ENV === 'production';

  return {
    origin,
    rpID: blankToNull(env.WEBAUTHN_RP_ID) ?? hostname,
    rpName: blankToNull(env.WEBAUTHN_RP_NAME) ?? DEFAULT_RP_NAME,
    setupToken: blankToNull(env.SETUP_TOKEN),
    secureCookies,
  };
}

/** The visitor's address as reported by the reverse proxy (used for rate limits only). */
export function clientIp(headers) {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim() || 'unknown';
  return headers.get('x-real-ip')?.trim() || 'unknown';
}

export function requestInfo({ method, headers }) {
  return {
    method: String(method).toUpperCase(),
    origin: headers.get('origin'),
    host: headers.get('x-forwarded-host') ?? headers.get('host'),
    proto: headers.get('x-forwarded-proto')?.split(',')[0].trim() || 'http',
    userAgent: headers.get('user-agent'),
    ip: clientIp(headers),
  };
}

/** GET handlers read their inputs from the query string. */
export function readQuery(url) {
  const params = new URL(url).searchParams;
  return params.size ? Object.fromEntries(params) : null;
}
