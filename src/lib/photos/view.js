// Showing photos: URLs, alt text, grouping under itinerary days. Pure.

export const photoUrl = (photo, size, { download = false } = {}) =>
  `/api/photos/${photo.id}/${size}${download ? '?download=1' : ''}`;

export const sharedPhotoUrl = (token, photo, size) => `/api/share/${token}/${photo.id}/${size}`;

/** Caption, else "Photo 3 from Day 1: Saturday". */
export function photoAlt(photo, day, index) {
  if (photo.caption) return photo.caption;
  return `Photo ${index + 1}${day ? ` from ${day.dateLabel}` : ''}`;
}

/**
 * [{ day, photos }] in day order, skipping days without photos, then
 * { day: null, photos } for photos not on any current day.
 */
export function groupByDay(photos, days) {
  const sorted = [...days].sort((a, b) => a.dayNumber - b.dayNumber);
  const known = new Set(sorted.map((d) => d.dayNumber));
  const groups = sorted
    .map((day) => ({ day, photos: photos.filter((p) => p.dayNumber === day.dayNumber) }))
    .filter((g) => g.photos.length);
  const other = photos.filter((p) => p.dayNumber === null || p.dayNumber === undefined || !known.has(p.dayNumber));
  if (other.length) groups.push({ day: null, photos: other });
  return groups;
}

export function storyStats(trip) {
  return {
    days: trip.days.length,
    photos: trip.photos.length,
    activities: trip.days.reduce((n, d) => n + (d.activities?.length ?? 0), 0),
  };
}
