import { parseTimeToMinutes } from './helpers.js';

// Untimed meals sort just before the matching part of the day
// ("morning" = 480, "afternoon" = 840, "evening" = 1080 in parseTimeToMinutes).
const UNTIMED_MEAL_SLOT = { Breakfast: 479, Lunch: 839, Dinner: 1079 };

function sortKey(item) {
  if (item.time) return parseTimeToMinutes(item.time);
  if (item.isMeal) return UNTIMED_MEAL_SLOT[item.mealType] ?? 9999;
  return 9999;
}

/**
 * Merges a day's activities with that day's planned meals into one list
 * sorted by time. Meals are matched to days by dayNumber.
 */
export function buildDayTimeline(day, meals) {
  const dayMeals = meals
    .filter((m) => m.dayNumber === day.dayNumber && m.mealName)
    .map((m) => ({
      id: `meal-${m.id ?? `${m.dayNumber}-${m.mealType}`}`,
      time: m.time,
      description: `${m.mealType}: ${m.mealName}`,
      details: m.details || '',
      isMeal: true,
      mealType: m.mealType,
    }));

  // Array.prototype.sort is stable, so equal times keep activity order.
  return [...day.activities, ...dayMeals].sort((a, b) => sortKey(a) - sortKey(b));
}

// parseTimeToMinutes uses 9990+ for "no usable time".
const NO_TIME = 9990;

/** Id of the first timeline item at or after `nowMinutes`, or null once the day is done. */
export function nextUpId(timeline, nowMinutes) {
  const next = timeline.find((item) => {
    const key = sortKey(item);
    return key < NO_TIME && key >= nowMinutes;
  });
  return next ? next.id : null;
}
