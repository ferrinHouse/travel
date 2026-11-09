// Admin user management: create people, change roles, disable, and hand out
// one-time invite or password-reset links (shown to the admin to text over).
import { ok, badRequest, notFound, conflict, isObject, isId, text } from './run.js';
import { deny } from './guard.js';
import { isRole } from '../auth/roles.js';
import { newToken, hashToken } from '../auth/tokens.js';
import { normalizeUsername, displayNameProblem } from '../auth/validate.js';
import { publicUser } from './auth.js';

const DAY = 24 * 60 * 60 * 1000;
export const INVITE_DAYS = 7;
export const RESET_DAYS = 2;

const nowOf = (ctx) => ctx.now ?? new Date();

function listed(u) {
  return {
    ...publicUser(u),
    isActive: u.isActive,
    hasPassword: !!u.passwordHash,
    passkeyCount: u._count?.passkeys ?? 0,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
  };
}

/** Issues a single-use link token for a user, voiding any older unused ones. */
async function issueLink(db, { userId, purpose, days, createdById, now }) {
  const token = newToken();
  await db.$transaction([
    db.invite.updateMany({ where: { userId, usedAt: null }, data: { usedAt: now } }),
    db.invite.create({
      data: { id: hashToken(token), userId, purpose, createdAt: now, expiresAt: new Date(now.getTime() + days * DAY), createdById },
    }),
  ]);
  return token;
}

const activeAdmins = (db) => db.user.count({ where: { role: 'admin', isActive: true } });

export async function listUsers(ctx) {
  const denied = deny(ctx, 'manage-users');
  if (denied) return denied;
  const users = await ctx.db.user.findMany({
    orderBy: [{ isActive: 'desc' }, { displayName: 'asc' }],
    include: { _count: { select: { passkeys: true } } },
  });
  return ok({ users: users.map(listed) });
}

export async function createUserAccount(ctx) {
  const denied = deny(ctx, 'manage-users');
  if (denied) return denied;
  const { db, body } = ctx;
  if (!isObject(body)) return badRequest();

  const username = normalizeUsername(body.username);
  if (!username) return badRequest('Usernames are 2–32 letters, numbers, dots, dashes or underscores.');
  const displayName = text(body.displayName) ?? '';
  const nameProblem = displayNameProblem(displayName);
  if (nameProblem) return badRequest(nameProblem);
  if (!isRole(body.role)) return badRequest('Pick a role: viewer, member or admin.');

  if (await db.user.findUnique({ where: { username } })) return conflict(`The username “${username}” is already taken.`);
  const user = await db.user.create({ data: { username, displayName, role: body.role } });
  const inviteToken = await issueLink(db, { userId: user.id, purpose: 'invite', days: INVITE_DAYS, createdById: ctx.user.id, now: nowOf(ctx) });
  return ok({ user: listed(user), inviteToken });
}

export async function updateUser(ctx) {
  const denied = deny(ctx, 'manage-users');
  if (denied) return denied;
  const { db, body } = ctx;
  if (!isObject(body) || !isId(body.id)) return badRequest();

  const data = {};
  if (body.role !== undefined) {
    if (!isRole(body.role)) return badRequest('Pick a role: viewer, member or admin.');
    data.role = body.role;
  }
  if (body.isActive !== undefined) {
    if (typeof body.isActive !== 'boolean') return badRequest();
    data.isActive = body.isActive;
  }
  if (body.displayName !== undefined) {
    const displayName = text(body.displayName) ?? '';
    const problem = displayNameProblem(displayName);
    if (problem) return badRequest(problem);
    data.displayName = displayName;
  }
  if (Object.keys(data).length === 0) return badRequest('Nothing to change.');

  const target = await db.user.findUnique({ where: { id: body.id } });
  if (!target) return notFound();

  const losesAdmin = target.role === 'admin' && target.isActive && ((data.role && data.role !== 'admin') || data.isActive === false);
  if (losesAdmin) {
    if (target.id === ctx.user.id) return badRequest("You can't remove your own admin access. Ask another admin.");
    if ((await activeAdmins(db)) <= 1) return badRequest('There must always be at least one admin.');
  }

  const [user] = await db.$transaction([
    db.user.update({ where: { id: target.id }, data, include: { _count: { select: { passkeys: true } } } }),
    ...(data.isActive === false ? [db.session.deleteMany({ where: { userId: target.id } })] : []),
  ]);
  return ok({ user: listed(user) });
}

export async function createResetLink(ctx) {
  const denied = deny(ctx, 'manage-users');
  if (denied) return denied;
  const { db, body } = ctx;
  if (!isObject(body) || !isId(body.id)) return badRequest();

  const target = await db.user.findUnique({ where: { id: body.id } });
  if (!target) return notFound();
  if (!target.isActive) return badRequest('Turn this account back on first.');

  // Someone who never finished their invite gets a new invite rather than a "reset".
  const purpose = target.passwordHash ? 'reset' : 'invite';
  const token = await issueLink(db, {
    userId: target.id,
    purpose,
    days: purpose === 'reset' ? RESET_DAYS : INVITE_DAYS,
    createdById: ctx.user.id,
    now: nowOf(ctx),
  });
  return ok({ token, purpose });
}

export async function revokeUserSessions(ctx) {
  const denied = deny(ctx, 'manage-users');
  if (denied) return denied;
  const { db, body } = ctx;
  if (!isObject(body) || !isId(body.id)) return badRequest();
  const { count } = await db.session.deleteMany({ where: { userId: body.id } });
  return ok({ revoked: count });
}
