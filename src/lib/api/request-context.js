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
    // Photo files (the 20Gi NFS volume in production); relative = from the app folder.
    uploadsDir: blankToNull(env.UPLOADS_DIR) ?? 'uploads',
    maxUploadBytes: positiveNumber(env.MAX_UPLOAD_MB, DEFAULT_MAX_UPLOAD_MB) * 1024 * 1024,
  };
}

const DEFAULT_MAX_UPLOAD_MB = 25;
function positiveNumber(value, fallback) {
  const n = Number(value);
  return blankToNull(value) && Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Reads a request body stream into a Buffer, giving up (and cancelling the
 * stream) as soon as it passes `maxBytes`, so a huge upload never sits in memory.
 * → { bytes: Buffer | null, truncated: boolean }
 */
export async function readLimited(stream, maxBytes) {
  if (!stream) return { bytes: Buffer.alloc(0), truncated: false };
  const reader = stream.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => {});
      return { bytes: null, truncated: true };
    }
    chunks.push(value);
  }
  return { bytes: Buffer.concat(chunks.map((c) => Buffer.from(c.buffer, c.byteOffset, c.byteLength))), truncated: false };
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
