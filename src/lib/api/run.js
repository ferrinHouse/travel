/**
 * Framework-free API handlers. Each handler takes `{ db, isAdmin, body }` and
 * returns `{ status, body }`; route.js files adapt that to NextResponse (see
 * next-adapter.js). Keeping handlers free of Next imports lets `node --test`
 * run them against a real SQLite database.
 */

export const ok = (data = {}) => ({ status: 200, body: { success: true, ...data } });

export const fail = (status, message) => ({ status, body: { success: false, message } });

export const badRequest = (message = 'Invalid input') => fail(400, message);
export const unauthorized = () => fail(401, 'Unauthorized');
export const notFound = (message = 'Not found') => fail(404, message);

// Prisma: P2025 = record to update/delete not found, P2003 = foreign key failed.
const NOT_FOUND_CODES = new Set(['P2025', 'P2003']);

export async function runHandler(handler, ctx) {
  try {
    return await handler(ctx);
  } catch (error) {
    if (NOT_FOUND_CODES.has(error?.code)) return notFound();
    console.error(`API error in ${handler.name || 'handler'}:`, error);
    return fail(500, 'Server error');
  }
}

// ---- small input helpers ----

export const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export const isId = (value) => Number.isInteger(value) && value > 0;

/** Trimmed non-empty string, or null. */
export function text(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/** Optional string field: undefined stays undefined (leave as is), anything else must be a string or null. */
export function optionalString(value) {
  if (value === undefined || value === null) return value;
  return typeof value === 'string' ? value : undefined;
}

export async function tripExists(db, tripId) {
  if (typeof tripId !== 'string' || !tripId) return false;
  return (await db.trip.count({ where: { id: tripId } })) > 0;
}
