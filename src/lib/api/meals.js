import { MEAL_TYPES } from '../meals.js';
import { badRequest, isObject, notFound, ok, optionalString, tripExists, unauthorized } from './run.js';

/** Upserts one meal slot (trip + day + meal type). An empty name deletes it. */
export async function saveMeal({ db, isAdmin, body }) {
  if (!isAdmin) return unauthorized();
  if (!isObject(body)) return badRequest();
  const { tripId, dayNumber, mealType, mealName } = body;
  if (typeof tripId !== 'string' || !tripId) return badRequest();
  if (!Number.isInteger(dayNumber) || dayNumber < 1) return badRequest();
  if (!MEAL_TYPES.includes(mealType)) return badRequest('Unknown meal type');
  if (mealName !== undefined && mealName !== null && typeof mealName !== 'string') return badRequest();
  if (!(await tripExists(db, tripId))) return notFound('Trip not found');

  const existing = await db.mealPlan.findFirst({ where: { tripId, dayNumber, mealType } });
  const name = (mealName || '').trim();

  if (!name) {
    if (existing) await db.mealPlan.delete({ where: { id: existing.id } });
    return ok({ deleted: true });
  }

  // `details` is left untouched when not sent, so seeded notes survive renames.
  const data = { mealName: name, time: optionalString(body.time), details: optionalString(body.details) };
  const meal = existing
    ? await db.mealPlan.update({ where: { id: existing.id }, data })
    : await db.mealPlan.create({ data: { tripId, dayNumber, mealType, ...data } });
  return ok({ meal });
}
