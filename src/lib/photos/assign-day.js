// Which itinerary day a photo belongs to, from the camera's wall-clock time.
// Times are stored "as if UTC" so the calendar day never shifts with time zones
// (the same convention as trip dates, see src/lib/trips/dates.js).
import { addDays, dayKey } from '../trips/dates.js';

const TAKEN_AT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/** 'YYYY-MM-DDTHH:mm[:ss]' → Date (wall time as UTC), or null if invalid / implausible. */
export function parseTakenAt(value) {
  if (typeof value !== 'string') return null;
  const m = TAKEN_AT.exec(value.trim());
  if (!m) return null;
  const [year, month, day, hour, minute, second = '0'] = m.slice(1).map((v) => (v === undefined ? undefined : Number(v)));
  if (year < 1990 || year > 2200 || hour > 23 || minute > 59 || second > 59) return null;
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

/** Stored Date → 'YYYY-MM-DDTHH:mm:ss' (the form the API accepts). */
export function takenAtKey(date) {
  if (!date) return null;
  return new Date(date).toISOString().slice(0, 19);
}

/**
 * The dayNumber of the itinerary day on the photo's calendar date, or null.
 * Days are matched by position (day date = startDate + position), so a trip
 * whose days are numbered from 0 still lines up.
 */
export function dayNumberFor(takenAt, trip, days) {
  if (!takenAt || !trip?.startDate || !days?.length) return null;
  const sorted = [...days].sort((a, b) => a.dayNumber - b.dayNumber);
  const key = dayKey(takenAt);
  const index = sorted.findIndex((_, i) => dayKey(addDays(trip.startDate, i)) === key);
  return index < 0 ? null : sorted[index].dayNumber;
}
