// Sign-in, sessions, first-run setup and invite links. Framework-free like the
// other handlers: route.js adapts them, and tests call them directly.
import { timingSafeEqual, createHash } from 'node:crypto';
import { ok, fail, badRequest, notFound, isObject, text } from './run.js';
import { hashPassword, verifyPassword, needsRehash, passwordProblem } from '../auth/password.js';
import { newToken, hashToken } from '../auth/tokens.js';
import { SESSION, sessionState, shouldTouch, sessionExpiry } from '../auth/session-policy.js';
import { normalizeUsername, displayNameProblem } from '../auth/validate.js';
import { createRateLimiter } from '../auth/rate-limit.js';

const INVALID_LOGIN = 'Incorrect username or password.';

// One shared limiter per process (the app runs a single replica).
export const defaultLimiter = createRateLimiter({ limit: 20, windowMs: 15 * 60 * 1000 });

export const publicUser = (u) => ({ id: u.id, username: u.username, displayName: u.displayName, role: u.role });

const nowOf = (ctx) => ctx.now ?? new Date();

function tooMany(retryAfterMs) {
  const res = fail(429, 'Too many attempts. Please wait a few minutes and try again.');
  res.body.retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
  return res;
}

/** Hits every key; returns a 429 result if any is over the limit, else null. */
export function limit(ctx, keys, fallback = defaultLimiter) {
  const limiter = ctx.limiter ?? fallback;
  let worst = null;
  for (const key of keys) {
    const r = limiter.hit(key);
    if (!r.allowed && (!worst || r.retryAfterMs > worst)) worst = r.retryAfterMs;
  }
  return worst == null ? null : tooMany(worst);
}

export function sessionCookie(token, config = {}) {
  return {
    name: SESSION.cookieName,
    value: token,
    options: { httpOnly: true, secure: !!config.secureCookies, sameSite: 'lax', path: '/', maxAge: SESSION.maxAgeDays * 24 * 60 * 60 },
  };
}

export function clearSessionCookie(config = {}) {
  return { name: SESSION.cookieName, value: '', options: { ...sessionCookie('', config).options, maxAge: 0 } };
}

export async function startSession(db, user, { userAgent = null, now = new Date() } = {}) {
  const token = newToken();
  const session = await db.session.create({
    data: {
      id: hashToken(token),
      userId: user.id,
      createdAt: now,
      lastSeenAt: now,
      expiresAt: sessionExpiry(now),
      userAgent: userAgent ? String(userAgent).slice(0, 300) : null,
    },
  });
  return { token, session };
}

/** The signed-in user for a cookie token, or null. Cleans up dead sessions. */
export async function userFromSessionToken(db, token, now = new Date()) {
  if (typeof token !== 'string' || !token) return null;
  const id = hashToken(token);
  const session = await db.session.findUnique({ where: { id }, include: { user: true } });
  if (!session) return null;
  if (sessionState(session, now) !== 'valid' || !session.user.isActive) {
    await db.session.deleteMany({ where: { id } });
    return null;
  }
  if (shouldTouch(session, now)) {
    await db.session.update({ where: { id }, data: { lastSeenAt: now } });
  }
  const { passwordHash, ...user } = session.user;
  return { ...user, hasPassword: !!passwordHash, sessionId: id };
}

export async function signIn(ctx, user, status = 200) {
  const now = nowOf(ctx);
  const { token } = await startSession(ctx.db, user, { userAgent: ctx.request?.userAgent, now });
  await ctx.db.user.update({ where: { id: user.id }, data: { lastLoginAt: now } });
  return { status, body: { success: true, user: publicUser(user) }, cookies: [sessionCookie(token, ctx.config)] };
}

// ---- handlers ----

export async function login(ctx) {
  const { db, body } = ctx;
  if (!isObject(body)) return badRequest();
  const username = normalizeUsername(body.username);
  const password = typeof body.password === 'string' ? body.password : '';

  const limited = limit(ctx, [`login-ip:${ctx.request?.ip}`, `login-user:${username ?? '?'}`]);
  if (limited) return limited;

  const user = username ? await db.user.findUnique({ where: { username } }) : null;
  // Verify even for unknown users so response time doesn't reveal which usernames exist.
  const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !user.isActive || !user.passwordHash || !valid) return fail(401, INVALID_LOGIN);

  (ctx.limiter ?? defaultLimiter).reset(`login-user:${username}`);
  if (needsRehash(user.passwordHash)) {
    await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password) } });
  }
  return signIn(ctx, user);
}

// A real hash of a random string, so failed lookups cost the same as real ones.
const DUMMY_HASH = await hashPassword(newToken());

export async function logout(ctx) {
  if (ctx.sessionToken) {
    await ctx.db.session.deleteMany({ where: { id: hashToken(ctx.sessionToken) } });
  }
  return { ...ok(), cookies: [clearSessionCookie(ctx.config)] };
}

export async function currentUser(ctx) {
  return ok({ user: ctx.user ? publicUser(ctx.user) : null });
}

export async function setupStatus(ctx) {
  const needed = !!ctx.config?.setupToken && (await ctx.db.user.count()) === 0;
  return ok({ needed });
}

function sameSecret(a, b) {
  const digest = (v) => createHash('sha256').update(String(v)).digest();
  return typeof a === 'string' && a.length > 0 && timingSafeEqual(digest(a), digest(b));
}

export async function setup(ctx) {
  const { db, body, config } = ctx;
  if (!config?.setupToken || (await db.user.count()) > 0) return notFound();
  if (!isObject(body)) return badRequest();

  const limited = limit(ctx, [`setup:${ctx.request?.ip}`]);
  if (limited) return limited;
  if (!sameSecret(body.token, config.setupToken)) return fail(403, 'That setup code is not right.');

  const username = normalizeUsername(body.username);
  if (!username) return badRequest('Usernames are 2–32 letters, numbers, dots, dashes or underscores.');
  const displayName = text(body.displayName) ?? username;
  const nameProblem = displayNameProblem(displayName);
  if (nameProblem) return badRequest(nameProblem);
  const pwProblem = passwordProblem(body.password);
  if (pwProblem) return badRequest(pwProblem);

  const passwordHash = await hashPassword(body.password);
  const user = await db.$transaction(async (tx) => {
    if ((await tx.user.count()) > 0) return null;
    return tx.user.create({ data: { username, displayName, role: 'admin', passwordHash } });
  });
  if (!user) return notFound();
  return signIn(ctx, user);
}

async function liveInvite(db, token, now) {
  if (typeof token !== 'string' || !token) return null;
  const invite = await db.invite.findUnique({ where: { id: hashToken(token) }, include: { user: true } });
  if (!invite || invite.usedAt || invite.expiresAt <= now || !invite.user.isActive) return null;
  return invite;
}

export async function inviteDetails(ctx) {
  const invite = await liveInvite(ctx.db, ctx.body?.token, nowOf(ctx));
  if (!invite) return notFound('This link has expired or was already used. Ask an admin for a new one.');
  return ok({ username: invite.user.username, displayName: invite.user.displayName, purpose: invite.purpose });
}

export async function acceptInvite(ctx) {
  const { db, body } = ctx;
  if (!isObject(body)) return badRequest();
  const limited = limit(ctx, [`invite:${ctx.request?.ip}`]);
  if (limited) return limited;

  const now = nowOf(ctx);
  const invite = await liveInvite(db, body.token, now);
  if (!invite) return notFound('This link has expired or was already used. Ask an admin for a new one.');
  const pwProblem = passwordProblem(body.password);
  if (pwProblem) return badRequest(pwProblem);

  const passwordHash = await hashPassword(body.password);
  await db.$transaction([
    db.user.update({ where: { id: invite.userId }, data: { passwordHash } }),
    // Burn this link and any other outstanding ones for the same person.
    db.invite.updateMany({ where: { userId: invite.userId, usedAt: null }, data: { usedAt: now } }),
    // A reset means the old password may be known to someone else.
    ...(invite.purpose === 'reset' ? [db.session.deleteMany({ where: { userId: invite.userId } })] : []),
  ]);
  return signIn(ctx, invite.user);
}
