import { badRequest, isId, isObject, notFound, ok, text, tripExists, unauthorized } from './run.js';

/** Anyone can mark items bought; no login needed while shopping. */
export async function toggleGroceryItem({ db, body }) {
  if (!isObject(body) || !isId(body.id) || typeof body.isBought !== 'boolean') return badRequest();
  const item = await db.groceryItem.update({ where: { id: body.id }, data: { isBought: body.isBought } });
  return ok({ item });
}

export async function createGroceryItem({ db, isAdmin, body }) {
  if (!isAdmin) return unauthorized();
  if (!isObject(body)) return badRequest();
  const name = text(body.name);
  const category = text(body.category);
  if (!name || !category) return badRequest('Name and category are required');
  if (!(await tripExists(db, body.tripId))) return notFound('Trip not found');

  const item = await db.groceryItem.create({ data: { tripId: body.tripId, name, category } });
  return ok({ item });
}
