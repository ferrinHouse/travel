// Optional read-only share link for a trip's story page (off by default).
// Only the token's hash is stored, so the link is shown once when made; making
// a new one retires the old. Shared pages show the story and the small/large
// photos only: no originals, logistics, checklists or meals.
import { deny } from './guard.js';
import { badRequest, isObject, notFound, ok } from './run.js';
import { fileResult } from './photos.js';
import { hashToken, newToken } from '../auth/tokens.js';

const TOKEN = /^[A-Za-z0-9_-]{43}$/;
const SHARED_SIZES = new Set(['sm', 'lg']);

/** The trip id a live share token opens, or null. */
export async function findSharedTrip(db, token) {
  if (typeof token !== 'string' || !TOKEN.test(token)) return null;
  const link = await db.tripShareLink.findUnique({ where: { id: hashToken(token) }, select: { tripId: true, revokedAt: true } });
  return link && !link.revokedAt ? link.tripId : null;
}

const tripIdFrom = (body) => (isObject(body) && typeof body.tripId === 'string' && body.tripId ? body.tripId : null);

/** POST /api/trips/share { tripId } → { url } */
export async function createShareLink(ctx) {
  const denied = deny(ctx, 'edit');
  if (denied) return denied;
  const { db, body, user, config } = ctx;
  const tripId = tripIdFrom(body);
  if (!tripId) return badRequest();
  if (!(await db.trip.count({ where: { id: tripId } }))) return notFound('Trip not found');
  const token = newToken();
  const now = ctx.now ?? new Date();
  await db.$transaction([
    db.tripShareLink.updateMany({ where: { tripId, revokedAt: null }, data: { revokedAt: now } }),
    db.tripShareLink.create({ data: { id: hashToken(token), tripId, createdById: user.id } }),
  ]);
  return ok({ url: `${config.origin}/share/${token}` });
}

/** DELETE /api/trips/share { tripId } */
export async function revokeShareLink(ctx) {
  const denied = deny(ctx, 'edit');
  if (denied) return denied;
  const tripId = tripIdFrom(ctx.body);
  if (!tripId) return badRequest();
  await ctx.db.tripShareLink.updateMany({ where: { tripId, revokedAt: null }, data: { revokedAt: ctx.now ?? new Date() } });
  return ok();
}

/** GET /api/share/<token>/<id>/<size>: no sign-in, but only that trip's sm/lg files. */
export async function sharedPhotoFile(ctx) {
  const { db, body, config } = ctx;
  const tripId = await findSharedTrip(db, body?.token);
  const id = Number(body?.id);
  if (!tripId || !Number.isInteger(id) || id < 1 || !SHARED_SIZES.has(body?.size)) return notFound();
  const photo = await db.photo.findFirst({ where: { id, tripId }, select: { tripId: true, storageKey: true } });
  return fileResult(config, photo, body.size);
}
