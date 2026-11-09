// Password hashing with Node's built-in scrypt (no native dependency).
// Stored as `scrypt$N$r$p$salt$hash` (base64url) so parameters can be raised later.
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const N = 32768;
const R = 8;
const P = 1;
const KEY_LEN = 32;
const MIN_LENGTH = 10;
const MAX_LENGTH = 256;

function derive(password, salt, n, r, p) {
  return new Promise((resolve, reject) => {
    // maxmem must exceed 128 * N * r bytes.
    scrypt(password, salt, KEY_LEN, { N: n, r, p, maxmem: 256 * n * r }, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

function parse(stored) {
  if (typeof stored !== 'string') return null;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return null;
  const [n, r, p] = parts.slice(1, 4).map(Number);
  if (![n, r, p].every((v) => Number.isInteger(v) && v > 0)) return null;
  if (n > 2 ** 20 || r > 32 || p > 16) return null; // refuse absurd params (DoS)
  const salt = Buffer.from(parts[4], 'base64url');
  const hash = Buffer.from(parts[5], 'base64url');
  if (salt.length < 8 || hash.length !== KEY_LEN) return null;
  return { n, r, p, salt, hash };
}

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await derive(password, salt, N, R, P);
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64url')}$${key.toString('base64url')}`;
}

export async function verifyPassword(password, stored) {
  const parsed = parse(stored);
  if (!parsed || typeof password !== 'string' || password.length === 0 || password.length > MAX_LENGTH) return false;
  try {
    const key = await derive(password, parsed.salt, parsed.n, parsed.r, parsed.p);
    return timingSafeEqual(key, parsed.hash);
  } catch {
    return false;
  }
}

/** True when a stored hash uses weaker parameters than today's (rehash on next login). */
export function needsRehash(stored) {
  const parsed = parse(stored);
  return !parsed || parsed.n < N || parsed.r < R || parsed.p < P;
}

/** Human-readable reason a new password is unacceptable, or null. */
export function passwordProblem(password) {
  if (typeof password !== 'string') return 'A password is required.';
  if (password.trim().length < MIN_LENGTH) return `Use at least ${MIN_LENGTH} characters (a short phrase works well).`;
  if (password.length > MAX_LENGTH) return `Use at most ${MAX_LENGTH} characters.`;
  return null;
}
