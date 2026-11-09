// Photo files on the uploads volume:
//   <root>/photos/<tripId>/<storageKey>/{orig.jpg, lg.webp, sm.webp}
// Each folder is written to a temp name first and renamed into place, so a
// half-written photo never shows up. Files never change once written.
import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const VARIANTS = {
  orig: { file: 'orig.jpg', type: 'image/jpeg' },
  lg: { file: 'lg.webp', type: 'image/webp' },
  sm: { file: 'sm.webp', type: 'image/webp' },
};

const SAFE_TRIP = /^[a-z0-9][a-z0-9-]{0,79}$/;
const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9_-]{7,63}$/;

export function tripPhotosDir(root, tripId) {
  if (!SAFE_TRIP.test(String(tripId))) throw new Error(`Unsafe trip id for storage: ${tripId}`);
  return path.join(root, 'photos', tripId);
}

export function photoDir(root, tripId, key) {
  if (!SAFE_KEY.test(String(key))) throw new Error(`Unsafe photo key for storage: ${key}`);
  return path.join(tripPhotosDir(root, tripId), key);
}

/** { path, type } of one size of a photo, or null for an unknown size. */
export function variantFile(root, photo, size) {
  const variant = Object.hasOwn(VARIANTS, size) ? VARIANTS[size] : null;
  if (!variant) return null;
  return { path: path.join(photoDir(root, photo.tripId, photo.storageKey), variant.file), type: variant.type };
}

/** Writes all sizes; resolves with their total size in bytes. */
export async function savePhotoFiles(root, tripId, key, files) {
  const dir = photoDir(root, tripId, key);
  const tmp = `${dir}.tmp-${randomBytes(4).toString('hex')}`;
  await fs.mkdir(tmp, { recursive: true });
  try {
    let bytes = 0;
    for (const [size, { file }] of Object.entries(VARIANTS)) {
      await fs.writeFile(path.join(tmp, file), files[size]);
      bytes += files[size].length;
    }
    await fs.rename(tmp, dir);
    return bytes;
  } catch (err) {
    await fs.rm(tmp, { recursive: true, force: true });
    throw err;
  }
}

export async function removePhotoFiles(root, tripId, key) {
  await fs.rm(photoDir(root, tripId, key), { recursive: true, force: true });
}

export async function removeTripFiles(root, tripId) {
  await fs.rm(tripPhotosDir(root, tripId), { recursive: true, force: true });
}
