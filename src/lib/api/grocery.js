import { badRequest, isId, isObject, notFound, ok, text, tripExists } from './run.js';
import { deny, wrongPerson } from './guard.js';

/** Members and admins mark items bought while shopping. */
export async function toggleGroceryItem(ctx) {
  const denied = deny(ctx, 'toggle');
  if (denied) return denied;
  const { db, body } = ctx;
  if (!isObject(body) || !isId(body.id) || typeof body.isBought !== 'boolean') return badRequest();
  const wrong = wrongPerson(ctx);
  if (wrong) return wrong;
  const item = await db.groceryItem.update({ where: { id: body.id }, data: { isBought: body.isBought } });
  return ok({ item });
}

export async function createGroceryItem(ctx) {
  const denied = deny(ctx, 'add-item');
  if (denied) return denied;
  const { db, body } = ctx;
  if (!isObject(body)) return badRequest();
  const name = text(body.name);
  const category = text(body.category);
  if (!name || !category) return badRequest('Name and category are required');
  if (!(await tripExists(db, body.tripId))) return notFound('Trip not found');

  const item = await db.groceryItem.create({ data: { tripId: body.tripId, name, category } });
  return ok({ item });
}
