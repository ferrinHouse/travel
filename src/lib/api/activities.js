import { badRequest, isId, isObject, notFound, ok, optionalString, text, unauthorized } from './run.js';

function activityFields(body) {
  return {
    time: optionalString(body.time),
    description: text(body.description),
    details: optionalString(body.details),
    isAlert: !!body.isAlert,
  };
}

export async function createActivity({ db, isAdmin, body }) {
  if (!isAdmin) return unauthorized();
  if (!isObject(body) || !isId(body.dayId)) return badRequest();
  const fields = activityFields(body);
  if (!fields.description) return badRequest('Description is required');

  const day = await db.itineraryDay.findUnique({ where: { id: body.dayId }, select: { id: true } });
  if (!day) return notFound('Day not found');

  const last = await db.itineraryActivity.findFirst({ where: { dayId: day.id }, orderBy: { order: 'desc' } });
  const activity = await db.itineraryActivity.create({
    data: { dayId: day.id, ...fields, order: last ? last.order + 1 : 0 },
  });
  return ok({ activity });
}

export async function updateActivity({ db, isAdmin, body }) {
  if (!isAdmin) return unauthorized();
  if (!isObject(body) || !isId(body.id)) return badRequest();
  const fields = activityFields(body);
  if (!fields.description) return badRequest('Description is required');

  const activity = await db.itineraryActivity.update({ where: { id: body.id }, data: fields });
  return ok({ activity });
}

export async function deleteActivity({ db, isAdmin, body }) {
  if (!isAdmin) return unauthorized();
  if (!isObject(body) || !isId(body.id)) return badRequest();
  await db.itineraryActivity.delete({ where: { id: body.id } });
  return ok();
}
