// Scrapbook photos: upload (members), caption / day / delete (uploader or
// admin), cover (admin), and the signed-in file route. Files are handled by
// src/lib/photos/*; this module holds the checks and the database work.
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import { deny } from './guard.js';
import { badRequest, fail, forbidden, isObject, notFound, ok } from './run.js';
import { canChangePhoto } from '../photos/access.js';
import { dayNumberFor, parseTakenAt } from '../photos/assign-day.js';
import { clientPhoto } from '../photos/client-photo.js';
import { readTakenAt } from '../photos/exif.js';
import { processPhoto } from '../photos/process.js';
import { removePhotoFiles, savePhotoFiles, variantFile } from '../photos/storage.js';
import { CAPTION_MAX, uploadProblem } from '../photos/validate.js';

export { clientPhoto };

/** A handler result thrown by the input readers below and returned by checked(). */
class Rejection extends Error {
  constructor(result) {
    super(result.body.message);
    this.result = result;
  }
}

/** Caption from user input: undefined = leave alone, null = clear, string = set. */
function readCaption(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') throw new Rejection(badRequest('Captions must be text.'));
  const caption = value.trim();
  if (caption.length > CAPTION_MAX) throw new Rejection(badRequest(`Captions can be at most ${CAPTION_MAX} characters.`));
  return caption || null;
}

const toInt = (value) => {
  if (typeof value === 'number') return Number.isInteger(value) ? value : NaN;
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) return Number(value);
  return NaN;
};

/** dayNumber from user input, checked against the trip's days. undefined = not given. */
async function readDay(db, tripId, value) {
  if (value === undefined || value === '') return undefined;
  if (value === null) return null;
  const dayNumber = toInt(value);
  const exists = Number.isInteger(dayNumber) && (await db.itineraryDay.count({ where: { tripId, dayNumber } })) > 0;
  if (!exists) throw new Rejection(badRequest('Pick one of the trip’s days.'));
  return dayNumber;
}

async function checked(fn) {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof Rejection) return err.result;
    throw err;
  }
}

/**
 * POST /api/photos?tripId=…[&takenAt=…][&caption=…][&dayNumber=…] with the image
 * as the raw request body. ctx.file = { bytes, truncated } (see next-route.js).
 */
export async function uploadPhoto(ctx) {
  const denied = deny(ctx, 'upload');
  if (denied) return denied;
  return checked(async () => {
    const { db, body, file = {}, config } = ctx;
    const tripId = typeof body?.tripId === 'string' ? body.tripId : '';
    if (!tripId) return badRequest('Which trip is this photo for?');
    const trip = await db.trip.findUnique({
      where: { id: tripId },
      select: { id: true, startDate: true, days: { select: { dayNumber: true } } },
    });
    if (!trip) return notFound('Trip not found');

    const caption = readCaption(body.caption);
    let takenAt = null;
    if (body.takenAt !== undefined && body.takenAt !== '') {
      takenAt = parseTakenAt(body.takenAt);
      if (!takenAt) return badRequest('The photo date isn’t valid.');
    }
    const chosenDay = await readDay(db, tripId, body.dayNumber);

    const problem = uploadProblem({ bytes: file.bytes, truncated: file.truncated, maxBytes: config.maxUploadBytes });
    if (problem) return fail(problem.status, problem.message);

    takenAt ??= parseTakenAt(readTakenAt(file.bytes));
    let processed;
    try {
      processed = await processPhoto(file.bytes);
    } catch {
      return fail(415, 'We couldn’t read that photo. Try exporting it as a JPEG.');
    }

    const storageKey = randomUUID();
    const bytes = await savePhotoFiles(config.uploadsDir, tripId, storageKey, processed.files);
    try {
      const photo = await db.photo.create({
        data: {
          tripId,
          storageKey,
          dayNumber: chosenDay !== undefined ? chosenDay : dayNumberFor(takenAt, trip, trip.days),
          uploadedById: ctx.user.id,
          caption: caption ?? null,
          takenAt,
          width: processed.width,
          height: processed.height,
          bytes,
        },
      });
      return ok({ photo: clientPhoto(photo) });
    } catch (err) {
      await removePhotoFiles(config.uploadsDir, tripId, storageKey);
      throw err;
    }
  });
}

/** PATCH /api/photos { id, caption?, dayNumber?, isCover? } */
export async function updatePhoto(ctx) {
  const denied = deny(ctx, 'view');
  if (denied) return denied;
  return checked(async () => {
    const { db, body, user } = ctx;
    if (!isObject(body) || !Number.isInteger(body.id)) return badRequest();
    const photo = await db.photo.findUnique({ where: { id: body.id } });
    if (!photo) return notFound('Photo not found');
    if (!canChangePhoto(user, photo)) return forbidden();

    const data = {};
    const caption = readCaption(body.caption);
    if (caption !== undefined) data.caption = caption;
    if (body.dayNumber !== undefined) data.dayNumber = await readDay(db, photo.tripId, body.dayNumber);
    if (body.isCover !== undefined) {
      if (typeof body.isCover !== 'boolean') return badRequest();
      const notAdmin = deny(ctx, 'edit');
      if (notAdmin) return notAdmin;
      data.isCover = body.isCover;
    }

    const updated = await db.$transaction(async (tx) => {
      if (data.isCover) await tx.photo.updateMany({ where: { tripId: photo.tripId, isCover: true }, data: { isCover: false } });
      return tx.photo.update({ where: { id: photo.id }, data });
    });
    return ok({ photo: clientPhoto(updated) });
  });
}

/** DELETE /api/photos { id } */
export async function deletePhoto(ctx) {
  const denied = deny(ctx, 'view');
  if (denied) return denied;
  const { db, body, user, config } = ctx;
  if (!isObject(body) || !Number.isInteger(body.id)) return badRequest();
  const photo = await db.photo.findUnique({ where: { id: body.id } });
  if (!photo) return notFound('Photo not found');
  if (!canChangePhoto(user, photo)) return forbidden();
  await db.photo.delete({ where: { id: photo.id } });
  await removePhotoFiles(config.uploadsDir, photo.tripId, photo.storageKey);
  return ok();
}

/** { status: 200, file: { path, type } } for a file that exists, else 404. */
export async function fileResult(config, photo, size) {
  const file = photo ? variantFile(config.uploadsDir, photo, size) : null;
  if (!file) return notFound();
  try {
    await fs.access(file.path);
  } catch {
    return notFound();
  }
  return { status: 200, body: null, file };
}

/** GET /api/photos/<id>/<size> for signed-in users. */
export async function photoFile(ctx) {
  const denied = deny(ctx, 'view');
  if (denied) return denied;
  const id = toInt(ctx.body?.id);
  if (!Number.isInteger(id) || id < 1) return notFound();
  const photo = await ctx.db.photo.findUnique({ where: { id }, select: { tripId: true, storageKey: true } });
  return fileResult(ctx.config, photo, ctx.body?.size);
}
