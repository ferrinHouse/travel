import { badRequest, isId, isObject, notFound, ok, text, tripExists, unauthorized } from './run.js';

/**
 * POST /api/checklist does three things:
 *  - no `id`: create an item (admin)
 *  - `isCompleted`: tick/untick (anyone)
 *  - `text`: rename (admin)
 */
export async function saveChecklistItem({ db, isAdmin, body }) {
  if (!isObject(body)) return badRequest();

  if (body.id === undefined) {
    if (!isAdmin) return unauthorized();
    const itemText = text(body.text);
    const category = text(body.category);
    if (!itemText || !category) return badRequest('Text and category are required');
    if (!(await tripExists(db, body.tripId))) return notFound('Trip not found');
    const item = await db.checklistItem.create({
      data: { tripId: body.tripId, text: itemText, category, isCompleted: false },
    });
    return ok({ item });
  }

  if (!isId(body.id)) return badRequest();

  const data = {};
  if (body.text !== undefined) {
    if (!isAdmin) return unauthorized();
    data.text = text(body.text);
    if (!data.text) return badRequest('Text is required');
  }
  if (body.isCompleted !== undefined) {
    if (typeof body.isCompleted !== 'boolean') return badRequest();
    data.isCompleted = body.isCompleted;
  }
  if (Object.keys(data).length === 0) return badRequest('Nothing to update');

  const item = await db.checklistItem.update({ where: { id: body.id }, data });
  return ok({ item });
}

export async function deleteChecklistItem({ db, isAdmin, body }) {
  if (!isAdmin) return unauthorized();
  if (!isObject(body) || !isId(body.id)) return badRequest();
  await db.checklistItem.delete({ where: { id: body.id } });
  return ok();
}
