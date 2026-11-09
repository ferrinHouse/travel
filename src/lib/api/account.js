// "My account": password, signed-in devices and passkeys for the current user.
import { ok, badRequest, notFound, isObject, text } from './run.js';
import { deny } from './guard.js';
import { hashPassword, verifyPassword, passwordProblem } from '../auth/password.js';
import { clearSessionCookie } from './auth.js';

// Sessions are identified to the browser by a short prefix of the stored hash.
// The full hash is never sent back, and the cookie token is never stored.
const HANDLE_LENGTH = 12;
const handleOf = (sessionId) => sessionId.slice(0, HANDLE_LENGTH);
const isHandle = (v) => typeof v === 'string' && /^[0-9a-f]{12}$/.test(v);

const nameOf = (v) => {
  const name = text(v);
  return name && name.length <= 60 ? name : null;
};

export async function changePassword(ctx) {
  const denied = deny(ctx, 'view');
  if (denied) return denied;
  const { db, body, user } = ctx;
  if (!isObject(body)) return badRequest();

  const row = await db.user.findUnique({ where: { id: user.id } });
  if (row.passwordHash && !(await verifyPassword(String(body.currentPassword ?? ''), row.passwordHash))) {
    return badRequest('Your current password is not right.');
  }
  const problem = passwordProblem(body.newPassword);
  if (problem) return badRequest(problem);

  const passwordHash = await hashPassword(body.newPassword);
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { passwordHash } }),
    // Anyone who knew the old password is signed out; this device stays in.
    db.session.deleteMany({ where: { userId: user.id, NOT: { id: user.sessionId ?? '' } } }),
  ]);
  return ok();
}

export async function listMySessions(ctx) {
  const denied = deny(ctx, 'view');
  if (denied) return denied;
  const sessions = await ctx.db.session.findMany({ where: { userId: ctx.user.id }, orderBy: { lastSeenAt: 'desc' } });
  return ok({
    sessions: sessions.map((s) => ({
      id: handleOf(s.id),
      userAgent: s.userAgent,
      createdAt: s.createdAt,
      lastSeenAt: s.lastSeenAt,
      current: s.id === ctx.user.sessionId,
    })),
  });
}

export async function revokeMySession(ctx) {
  const denied = deny(ctx, 'view');
  if (denied) return denied;
  const { db, body, user } = ctx;
  if (!isObject(body) || !isHandle(body.id)) return badRequest();
  const matches = await db.session.findMany({ where: { userId: user.id, id: { startsWith: body.id } }, select: { id: true } });
  if (matches.length !== 1) return notFound();
  await db.session.delete({ where: { id: matches[0].id } });
  const signedOutHere = matches[0].id === user.sessionId;
  return { ...ok({ signedOut: signedOutHere }), ...(signedOutHere ? { cookies: [clearSessionCookie(ctx.config)] } : {}) };
}

export async function listMyPasskeys(ctx) {
  const denied = deny(ctx, 'view');
  if (denied) return denied;
  const passkeys = await ctx.db.passkey.findMany({
    where: { userId: ctx.user.id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, deviceType: true, backedUp: true, createdAt: true, lastUsedAt: true },
  });
  return ok({ passkeys });
}

async function myPasskey(ctx, id) {
  if (typeof id !== 'string' || !id) return null;
  return ctx.db.passkey.findFirst({ where: { id, userId: ctx.user.id } });
}

export async function renameMyPasskey(ctx) {
  const denied = deny(ctx, 'view');
  if (denied) return denied;
  const { body } = ctx;
  if (!isObject(body)) return badRequest();
  if (!(await myPasskey(ctx, body.id))) return notFound();
  const name = nameOf(body.name);
  if (!name) return badRequest('Give the passkey a name (up to 60 characters).');
  const passkey = await ctx.db.passkey.update({ where: { id: body.id }, data: { name }, select: { id: true, name: true } });
  return ok({ passkey });
}

export async function deleteMyPasskey(ctx) {
  const denied = deny(ctx, 'view');
  if (denied) return denied;
  const { db, body, user } = ctx;
  if (!isObject(body)) return badRequest();
  if (!(await myPasskey(ctx, body.id))) return notFound();

  const row = await db.user.findUnique({ where: { id: user.id }, include: { _count: { select: { passkeys: true } } } });
  if (!row.passwordHash && row._count.passkeys <= 1) {
    return badRequest('This is your only way to sign in. Set a password first, then remove it.');
  }
  await db.passkey.delete({ where: { id: body.id } });
  return ok();
}
