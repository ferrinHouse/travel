// Pure rules for which trips are kept offline, and whose data the device holds.
import { photoUrl } from '../photos/view.js';

/** Trips starting within this many days (or under way) are saved automatically. */
export const AUTO_SAVE_DAYS = 30;
const REFRESH_MS = 12 * 60 * 60 * 1000;
// A page rendered longer ago than this when it starts came from the saved copy.
const SAVED_COPY_MS = 2 * 60 * 1000;
const MAX_PHOTOS = 300;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** `status` is tripPhase(trip). */
export function shouldAutoSave(status) {
  if (status.phase === 'active') return true;
  return status.phase === 'upcoming' && status.daysUntil !== null && status.daysUntil <= AUTO_SAVE_DAYS;
}

/** `entry` is a trip's record in the saved list ({ savedAt }), if any. */
export function needsRefresh(entry, now) {
  return !entry || !(now - entry.savedAt < REFRESH_MS);
}

/** The saved-trips list from localStorage: { [tripId]: { name, dates, savedAt } }. */
export function parseSavedTrips(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  const trips = {};
  for (const [id, entry] of Object.entries(data)) {
    if (!SLUG.test(id) || !entry || typeof entry.name !== 'string' || !Number.isFinite(entry.savedAt)) continue;
    trips[id] = { name: entry.name, dates: typeof entry.dates === 'string' ? entry.dates : '', savedAt: entry.savedAt };
  }
  return trips;
}

/** What the service worker fetches to keep a trip offline. */
export function tripSaveRequest(tripId, photos = []) {
  const kept = photos.slice(0, MAX_PHOTOS);
  const cover = photos.find((p) => p.isCover);
  return {
    pages: [`/trips/${tripId}`, `/trips/${tripId}/story`],
    photos: [...kept.map((p) => photoUrl(p, 'sm')), ...(cover ? [photoUrl(cover, 'lg')] : [])],
  };
}

/** Whose offline data this is: stored with the data, compared on each visit. */
export const userKeyFor = (user) => (user ? `u${user.id}` : null);

/**
 * How the device's offline data relates to who is signed in now:
 * 'keep', 'set' (first visit), 'signed-out' (forget their pages, keep their
 * unsynced ticks for when they return) or 'switch' (another person: forget all).
 */
export function userChange(storedKey, currentKey) {
  if (storedKey === currentKey) return 'keep';
  if (!storedKey) return 'set';
  return currentKey ? 'switch' : 'signed-out';
}

/** Whether a page rendered at `renderedAt` is the saved copy, not a fresh load. */
export function isSavedCopy(renderedAt, now) {
  return Number.isFinite(renderedAt) && now - renderedAt > SAVED_COPY_MS;
}
