import { badRequest, isId, isObject, notFound, ok, text, tripExists, unauthorized } from './run.js';

/** POST /api/logistics: creates a card when there is no `id`, otherwise updates it. */
export async function saveLogisticsCard({ db, isAdmin, body }) {
  if (!isAdmin) return unauthorized();
  if (!isObject(body)) return badRequest();
  const title = text(body.title);
  const content = typeof body.content === 'string' && body.content.trim() ? body.content : null;
  if (!title || !content) return badRequest('Title and content are required');

  if (body.id === undefined) {
    if (!(await tripExists(db, body.tripId))) {
      return typeof body.tripId === 'string' && body.tripId ? notFound('Trip not found') : badRequest();
    }
    const last = await db.logisticsCard.findFirst({ where: { tripId: body.tripId }, orderBy: { order: 'desc' } });
    const card = await db.logisticsCard.create({
      data: { tripId: body.tripId, title, content, order: last ? last.order + 1 : 0 },
    });
    return ok({ card });
  }

  if (!isId(body.id)) return badRequest();
  const card = await db.logisticsCard.update({ where: { id: body.id }, data: { title, content } });
  return ok({ card });
}

export async function deleteLogisticsCard({ db, isAdmin, body }) {
  if (!isAdmin) return unauthorized();
  if (!isObject(body) || !isId(body.id)) return badRequest();
  await db.logisticsCard.delete({ where: { id: body.id } });
  return ok();
}
