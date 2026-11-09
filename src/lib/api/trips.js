// Trips themselves: create (with its days and a starter checklist), edit
// (keeping the day list in step with the dates), archive, delete, and day titles.
import { badRequest, isId, isObject, notFound, ok, text } from './run.js';
import { deny } from './guard.js';
import { validateTrip } from '../trips/validation.js';
import { buildDays, reconcileDays } from '../trips/scaffold.js';
import { removeTripFiles } from '../photos/storage.js';
import { slugProblem, slugify, uniqueSlug } from '../trips/slug.js';
import { dayKey } from '../trips/dates.js';
import { STARTER_CHECKLIST } from '../trips/checklist-templates.js';
import { tripPhase } from '../trip-status.js';

export const DAY_TITLE_MAX = 80;

/** 400 with the first message up front and every field's message in `errors`. */
const invalid = (errors) => ({
  status: 400,
  body: { success: false, message: Object.values(errors)[0], errors },
});

const slugTaken = (slug) => {
  const message = `Another trip already uses /trips/${slug}. Pick a different web address.`;
  return { status: 409, body: { success: false, message, errors: { slug: message } } };
};

const statusFor = (value, now) => (tripPhase(value, now).phase === 'past' ? 'past' : 'upcoming');

async function checklistFor(db, from, errors) {
  if (from === undefined || from === null || from === 'starter') return STARTER_CHECKLIST;
  if (from === 'none') return [];
  if (typeof from === 'string') {
    const source = await db.trip.findUnique({
      where: { id: from },
      select: { checklist: { orderBy: { id: 'asc' }, select: { text: true, category: true } } },
    });
    if (source) return source.checklist;
  }
  errors.checklistFrom = 'Pick a trip to copy the checklist from.';
  return [];
}

export async function createTrip(ctx) {
  const denied = deny(ctx, 'edit');
  if (denied) return denied;
  const { db, body } = ctx;
  if (!isObject(body)) return badRequest();

  const { value, errors } = validateTrip(body);
  let slug = null;
  if (body.slug !== undefined && body.slug !== null && body.slug !== '') {
    const problem = slugProblem(body.slug);
    if (problem) errors.slug = problem;
    else slug = body.slug;
  }
  const checklist = await checklistFor(db, body.checklistFrom, errors);
  if (!slug && !errors.slug && value.name && !slugify(value.name)) {
    errors.slug = 'Choose a web address for this trip (letters and numbers).';
  }
  if (Object.keys(errors).length) return invalid(errors);

  if (slug) {
    if (await db.trip.count({ where: { id: slug } })) return slugTaken(slug);
  } else {
    const base = slugify(value.name);
    const taken = await db.trip.findMany({ where: { id: { startsWith: base } }, select: { id: true } });
    slug = uniqueSlug(base, new Set(taken.map((t) => t.id)));
  }

  try {
    await db.trip.create({
      data: {
        id: slug,
        ...value,
        status: statusFor(value, ctx.now),
        days: { create: buildDays(value.startDate, value.endDate) },
        checklist: { create: checklist.map(({ text: itemText, category }) => ({ text: itemText, category })) },
      },
    });
  } catch (error) {
    if (error?.code === 'P2002') return slugTaken(slug); // lost a race for the same address
    throw error;
  }
  return ok({ trip: { id: slug } });
}

/** "Day 3: Monday" · "Day 3 and Day 4" · "Day 3, Day 4 and Day 5" */
function listDays(days) {
  const names = days.map((d) => d.dateLabel);
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

export async function updateTrip(ctx) {
  const denied = deny(ctx, 'edit');
  if (denied) return denied;
  const { db, body } = ctx;
  if (!isObject(body) || typeof body.id !== 'string' || !body.id) return badRequest();

  const trip = await db.trip.findUnique({
    where: { id: body.id },
    include: {
      days: { select: { id: true, dayNumber: true, dateLabel: true, _count: { select: { activities: true } } } },
      meals: { select: { dayNumber: true } },
      photos: { select: { dayNumber: true } },
    },
  });
  if (!trip) return notFound('Trip not found');

  const { value, errors } = validateTrip(body);
  if (Object.keys(errors).length) return invalid(errors);

  const datesChanged =
    !trip.startDate ||
    !trip.endDate ||
    dayKey(trip.startDate) !== dayKey(value.startDate) ||
    dayKey(trip.endDate) !== dayKey(value.endDate);

  const plan = datesChanged
    ? reconcileDays({
        days: trip.days.map((d) => ({
          id: d.id,
          dayNumber: d.dayNumber,
          dateLabel: d.dateLabel,
          activityCount: d._count.activities,
          mealCount: trip.meals.filter((m) => m.dayNumber === d.dayNumber).length,
          photoCount: trip.photos.filter((p) => p.dayNumber === d.dayNumber).length,
        })),
        oldStart: trip.startDate,
        newStart: value.startDate,
        newEnd: value.endDate,
      })
    : { create: [], update: [], remove: [], blocked: [] };

  if (plan.blocked.length) {
    const verb = plan.blocked.length === 1 ? 'has' : 'have';
    return {
      status: 409,
      body: {
        success: false,
        message: `${listDays(plan.blocked)} still ${verb} plans. Move or delete them first, or keep the later end date.`,
        blocked: plan.blocked,
      },
    };
  }

  const data = { ...value, status: statusFor(value, ctx.now) };
  if (!datesChanged) delete data.dates; // keep hand-written display dates until the dates change

  await db.$transaction([
    db.trip.update({ where: { id: trip.id }, data }),
    ...plan.update.map(({ id, dateLabel }) => db.itineraryDay.update({ where: { id }, data: { dateLabel } })),
    db.itineraryDay.deleteMany({ where: { id: { in: plan.remove } } }),
    ...plan.create.map((day) => db.itineraryDay.create({ data: { tripId: trip.id, ...day } })),
  ]);
  return ok({ trip: { id: trip.id }, days: { added: plan.create.length, removed: plan.remove.length } });
}

export async function archiveTrip(ctx) {
  const denied = deny(ctx, 'edit');
  if (denied) return denied;
  const { db, body } = ctx;
  if (!isObject(body) || typeof body.id !== 'string' || typeof body.archived !== 'boolean') return badRequest();
  const trip = await db.trip.update({
    where: { id: body.id },
    data: { archivedAt: body.archived ? (ctx.now ?? new Date()) : null },
    select: { id: true, archivedAt: true },
  });
  return ok({ trip });
}

export async function deleteTrip(ctx) {
  const denied = deny(ctx, 'edit');
  if (denied) return denied;
  const { db, body } = ctx;
  if (!isObject(body) || typeof body.id !== 'string') return badRequest();
  const trip = await db.trip.findUnique({ where: { id: body.id }, select: { id: true, name: true } });
  if (!trip) return notFound('Trip not found');
  if (text(body.confirmName) !== trip.name) {
    return badRequest(`Type the trip name (“${trip.name}”) exactly to delete it.`);
  }
  await db.trip.delete({ where: { id: trip.id } }); // days, items, meals, photo rows… cascade
  if (ctx.config?.uploadsDir) {
    // The rows are gone either way; a leftover folder is only wasted space.
    await removeTripFiles(ctx.config.uploadsDir, trip.id).catch((err) => console.error(`Couldn't remove photos for ${trip.id}:`, err));
  }
  return ok();
}

export async function updateDay(ctx) {
  const denied = deny(ctx, 'edit');
  if (denied) return denied;
  const { db, body } = ctx;
  if (!isObject(body) || !isId(body.id)) return badRequest();
  if (body.title !== null && typeof body.title !== 'string') return badRequest('Day title must be text.');
  const title = text(body.title);
  if (title && title.length > DAY_TITLE_MAX) return badRequest(`Day titles can be at most ${DAY_TITLE_MAX} characters.`);
  const day = await db.itineraryDay.update({
    where: { id: body.id },
    data: { title },
    select: { id: true, title: true },
  });
  return ok({ day });
}
