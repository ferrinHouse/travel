/**
 * Pure reducer for the trip detail page. The whole trip (with its checklist,
 * groceries, logistics, days/activities and meals) lives in one state object.
 *
 * Optimistic updates dispatch `checklist/patch` (or `grocery/patch`) with the
 * new value; on failure the caller dispatches the same action with the old
 * value to roll back.
 */

const patchById = (list, id, patch) =>
  list.map((item) => (item.id === id ? { ...item, ...patch } : item));

const sameMeal = (meal, dayNumber, mealType) =>
  meal.dayNumber === dayNumber && meal.mealType === mealType;

export function tripReducer(trip, action) {
  switch (action.type) {
    case 'checklist/add':
      return { ...trip, checklist: [...trip.checklist, action.item] };
    case 'checklist/patch':
      return { ...trip, checklist: patchById(trip.checklist, action.id, action.patch) };
    case 'checklist/remove':
      return { ...trip, checklist: trip.checklist.filter((i) => i.id !== action.id) };

    case 'grocery/add':
      return { ...trip, groceries: [...trip.groceries, action.item] };
    case 'grocery/patch':
      return { ...trip, groceries: patchById(trip.groceries, action.id, action.patch) };

    case 'logistics/add':
      return { ...trip, logistics: [...trip.logistics, action.card] };
    case 'logistics/replace':
      return { ...trip, logistics: patchById(trip.logistics, action.card.id, action.card) };
    case 'logistics/remove':
      return { ...trip, logistics: trip.logistics.filter((c) => c.id !== action.id) };

    case 'day/patch':
      return { ...trip, days: patchById(trip.days, action.id, action.patch) };

    case 'activity/add':
      return {
        ...trip,
        days: trip.days.map((day) =>
          day.id === action.dayId ? { ...day, activities: [...day.activities, action.activity] } : day
        ),
      };
    case 'activity/replace':
      return {
        ...trip,
        days: trip.days.map((day) => ({
          ...day,
          activities: patchById(day.activities, action.activity.id, action.activity),
        })),
      };
    case 'activity/remove':
      return {
        ...trip,
        days: trip.days.map((day) =>
          day.id === action.dayId
            ? { ...day, activities: day.activities.filter((a) => a.id !== action.id) }
            : day
        ),
      };

    case 'meal/upsert': {
      const { meal } = action;
      const exists = trip.meals.some((m) => sameMeal(m, meal.dayNumber, meal.mealType));
      return {
        ...trip,
        meals: exists
          ? trip.meals.map((m) => (sameMeal(m, meal.dayNumber, meal.mealType) ? { ...m, ...meal } : m))
          : [...trip.meals, meal],
      };
    }
    case 'meal/remove':
      return {
        ...trip,
        meals: trip.meals.filter((m) => !sameMeal(m, action.dayNumber, action.mealType)),
      };

    default:
      throw new Error(`Unknown trip action: ${action.type}`);
  }
}
