import { createHash, timingSafeEqual } from 'node:crypto';

const digest = (value) => createHash('sha256').update(value, 'utf8').digest();

/**
 * Constant-time check of the shared admin passcode. With no passcode
 * configured, nothing unlocks (there is deliberately no default).
 */
export function verifyPasscode(input, configured) {
  if (typeof configured !== 'string' || configured === '') return false;
  if (typeof input !== 'string') return false;
  return timingSafeEqual(digest(input), digest(configured));
}
