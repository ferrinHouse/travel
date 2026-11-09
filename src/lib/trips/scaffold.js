// The itinerary's day list: built once when a trip is created, then kept in
// step with the trip's dates. A day's date is the trip start plus its
// position in the list, so no per-day date is stored.
import { addDays, dayLabel, tripLength } from './dates.js';

/** [{ dayNumber, dateLabel }] for every date from start to end. */
export function buildDays(start, end) {
  return Array.from({ length: tripLength(start, end) }, (_, i) => ({
    dayNumber: i + 1,
    dateLabel: dayLabel(addDays(start, i), i + 1),
  }));
}

/**
 * What to change when a trip's dates change.
 *
 * `days`: the trip's current days as [{ id, dayNumber, dateLabel, activityCount, mealCount }].
 * Days keep their position: the first day stays the first day.
 * - Labels the app generated for the old date are regenerated; custom labels are kept.
 * - A longer trip gets new days at the end, numbered after the current last day.
 * - A shorter trip drops days from the end, but only empty ones. A day that still has
 *   activities or meals is returned in `blocked` and the caller must not apply the plan.
 *
 * → { create: [{ dayNumber, dateLabel }], update: [{ id, dateLabel }], remove: [id], blocked: [{ id, dayNumber, dateLabel }] }
 */
export function reconcileDays({ days, oldStart, newStart, newEnd }) {
  const sorted = [...days].sort((a, b) => a.dayNumber - b.dayNumber);
  const length = tripLength(newStart, newEnd);
  const plan = { create: [], update: [], remove: [], blocked: [] };

  sorted.forEach((day, i) => {
    if (i >= length) {
      if (day.activityCount > 0 || day.mealCount > 0) {
        plan.blocked.push({ id: day.id, dayNumber: day.dayNumber, dateLabel: day.dateLabel });
      } else {
        plan.remove.push(day.id);
      }
      return;
    }
    if (!oldStart) return;
    const generated = day.dateLabel === dayLabel(addDays(oldStart, i), day.dayNumber);
    const next = dayLabel(addDays(newStart, i), day.dayNumber);
    if (generated && next !== day.dateLabel) plan.update.push({ id: day.id, dateLabel: next });
  });

  let nextNumber = sorted.length ? sorted[sorted.length - 1].dayNumber + 1 : 1;
  for (let i = sorted.length; i < length; i++, nextNumber++) {
    plan.create.push({ dayNumber: nextNumber, dateLabel: dayLabel(addDays(newStart, i), nextNumber) });
  }
  return plan;
}
