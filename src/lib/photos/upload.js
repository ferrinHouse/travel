// Browser-side upload helpers (pure, so node --test can check them).
// Phones take 12–48 MP photos; shrinking to 3000px before upload saves data on
// trips and turns iPhone HEIC into JPEG wherever the browser can decode it.

export const CLIENT_MAX_EDGE = 3000;

/** { width, height } scaled so the long edge is at most `max` (never enlarged). */
export function fitWithin(width, height, max) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Whether the browser should redraw the photo as a JPEG before sending it. */
export function needsReencode(type, width, height, max = CLIENT_MAX_EDGE) {
  return type !== 'image/jpeg' || Math.max(width, height) > max;
}

/** POST target: the image is the body; details ride in the query string. */
export function uploadUrl(tripId, { takenAt, dayNumber, caption } = {}) {
  const params = new URLSearchParams({ tripId });
  if (takenAt) params.set('takenAt', takenAt);
  if (dayNumber !== undefined && dayNumber !== null) params.set('dayNumber', String(dayNumber));
  if (caption) params.set('caption', caption);
  return `/api/photos?${params}`;
}

/** Runs `worker(item)` for every item, `concurrency` at a time. Failures don't stop the rest. */
export async function runQueue(items, concurrency, worker) {
  let next = 0;
  const lane = async () => {
    while (next < items.length) {
      const item = items[next++];
      try {
        await worker(item);
      } catch {
        // the worker reports its own failures
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, lane));
}
