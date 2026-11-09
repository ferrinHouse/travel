// Test users and handler contexts for API tests.
import { hashPassword } from '../../src/lib/auth/password.js';
import { createRateLimiter } from '../../src/lib/auth/rate-limit.js';

export const PASSWORD = 'correct horse battery staple';

// Hashing is deliberately slow; compute once per process.
let cachedHash;
const passwordHash = async () => (cachedHash ??= await hashPassword(PASSWORD));

export async function createUser(prisma, { username, role = 'viewer', displayName, password = true, isActive = true } = {}) {
  return prisma.user.create({
    data: {
      username: username ?? `${role}-${Math.random().toString(36).slice(2, 8)}`,
      displayName: displayName ?? `${role[0].toUpperCase()}${role.slice(1)} Person`,
      role,
      isActive,
      passwordHash: password ? await passwordHash() : null,
    },
  });
}

export const CONFIG = { setupToken: 'setup-token-for-tests', secureCookies: true, rpID: 'localhost', rpName: 'Family Adventures', origin: 'http://localhost:3000' };

/** Handler context with sensible defaults; pass `user` to act as someone. */
export function ctx(db, { user = null, body = null, request = {}, sessionToken, limiter, config, webauthn, now } = {}) {
  return {
    db,
    user,
    body,
    sessionToken,
    request: { method: 'POST', ip: '203.0.113.7', userAgent: 'test-agent', ...request },
    config: { ...CONFIG, ...config },
    limiter: limiter ?? createRateLimiter({ limit: 1000, windowMs: 60_000 }),
    webauthn,
    now,
  };
}

/**
 * An in-memory signed-in user for handlers that only look at the role
 * (no row needed). `actor(null)` is an anonymous request.
 */
let actorIds = 900_000;
export function actor(role) {
  if (!role) return null;
  return { id: ++actorIds, username: `${role}-actor`, displayName: `${role} actor`, role, isActive: true, hasPassword: true };
}
