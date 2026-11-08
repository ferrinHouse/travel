export const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner'];

export const MEAL_PLACEHOLDERS = {
  Breakfast: { name: 'Cereal / Restaurant / etc.', time: 'e.g. 8:00 AM' },
  Lunch: { name: 'Sandwiches / Out / etc.', time: 'e.g. 12:30 PM' },
  Dinner: { name: 'Tacos / Grill / Out / etc.', time: 'e.g. 5:30 PM' },
};

export function findMeal(meals, dayNumber, mealType) {
  return meals.find((m) => m.dayNumber === dayNumber && m.mealType === mealType) || null;
}

/** A meal with no name is treated as "not planned" and is deleted on save. */
export function isEmptyMeal(draft) {
  return !draft.mealName || !draft.mealName.trim();
}

export function buildMealPayload(tripId, dayNumber, mealType, draft) {
  return {
    tripId,
    dayNumber,
    mealType,
    mealName: (draft.mealName || '').trim(),
    time: (draft.time || '').trim(),
  };
}

/** True when the draft differs from what is saved (ignoring surrounding whitespace). */
export function mealChanged(saved, draft) {
  const a = { mealName: (saved?.mealName || '').trim(), time: (saved?.time || '').trim() };
  const b = { mealName: (draft.mealName || '').trim(), time: (draft.time || '').trim() };
  return a.mealName !== b.mealName || a.time !== b.time;
}
