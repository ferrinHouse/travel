import { badRequest, isId, isObject, notFound, ok, text, tripExists } from './run.js';
import { deny, wrongPerson } from './guard.js';

/**
 * POST /api/checklist does three things:
 *  - no `id`: create an item (member)
 *  - `isCompleted`: tick/untick (member; `queuedBy` when sent from the offline outbox)
 *  - `text`: rename (admin)
 */
export async function saveChecklistItem(ctx) {
  const { db, body } = ctx;
  if (!isObject(body)) return deny(ctx, 'toggle') ?? badRequest();

  if (body.id === undefined) {
    const denied = deny(ctx, 'add-item');
    if (denied) return denied;
    const itemText = text(body.text);
    const category = text(body.category);
    if (!itemText || !category) return badRequest('Text and category are required');
    if (!(await tripExists(db, body.tripId))) return notFound('Trip not found');
    const item = await db.checklistItem.create({
      data: { tripId: body.tripId, text: itemText, category, isCompleted: false },
    });
    return ok({ item });
  }

  const denied = deny(ctx, body.text !== undefined ? 'edit' : 'toggle') ?? wrongPerson(ctx);
  if (denied) return denied;
  if (!isId(body.id)) return badRequest();

  const data = {};
  if (body.text !== undefined) {
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

export async function deleteChecklistItem(ctx) {
  const denied = deny(ctx, 'edit');
  if (denied) return denied;
  const { db, body } = ctx;
  if (!isObject(body) || !isId(body.id)) return badRequest();
  await db.checklistItem.delete({ where: { id: body.id } });
  return ok();
}
