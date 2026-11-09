import { takenAtKey } from './assign-day.js';

/** What the browser gets for a photo: no storage key or file sizes. */
export function clientPhoto(photo) {
  const { id, dayNumber, caption, width, height, isCover, uploadedById } = photo;
  return { id, dayNumber, caption, takenAt: takenAtKey(photo.takenAt), width, height, isCover, uploadedById };
}

/** Columns the pages select for clientPhoto (plus ordering). */
export const PHOTO_SELECT = { id: true, dayNumber: true, caption: true, takenAt: true, width: true, height: true, isCover: true, uploadedById: true };
export const PHOTO_ORDER = [{ takenAt: 'asc' }, { id: 'asc' }];
