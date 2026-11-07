import test from 'node:test';
import assert from 'node:assert';
import { buildMealPayload, findMeal, isEmptyMeal, mealChanged, MEAL_TYPES } from '../src/lib/meals.js';
import { buildDayTimeline } from '../src/lib/itinerary.js';
import {
  checklistCategories,
  checklistLabel,
  groceryCategoriesInUse,
  groceryCategoryOptions,
  GROCERY_BASE,
} from '../src/lib/categories.js';

test('buildMealPayload trims values and never includes details', () => {
  assert.deepStrictEqual(buildMealPayload('chicago', 2, 'Lunch', { mealName: '  Subs ', time: ' 12:30 PM ' }), {
    tripId: 'chicago',
    dayNumber: 2,
    mealType: 'Lunch',
    mealName: 'Subs',
    time: '12:30 PM',
  });
  assert.deepStrictEqual(buildMealPayload('t', 1, 'Dinner', {}).mealName, '');
});

test('isEmptyMeal: blank names mean "not planned"', () => {
  assert.strictEqual(isEmptyMeal({ mealName: '' }), true);
  assert.strictEqual(isEmptyMeal({ mealName: '   ', time: '8:00 AM' }), true);
  assert.strictEqual(isEmptyMeal({ mealName: 'Cereal' }), false);
});

test('mealChanged ignores whitespace-only differences', () => {
  assert.strictEqual(mealChanged(null, { mealName: '', time: '' }), false);
  assert.strictEqual(mealChanged({ mealName: 'Pizza', time: '' }, { mealName: 'Pizza ', time: '' }), false);
  assert.strictEqual(mealChanged({ mealName: 'Pizza', time: '' }, { mealName: 'Pizza', time: '6 PM' }), true);
  assert.strictEqual(mealChanged(null, { mealName: 'Tacos', time: '' }), true);
});

test('findMeal matches on day and meal type', () => {
  const meals = [{ dayNumber: 1, mealType: 'Lunch', mealName: 'A' }, { dayNumber: 2, mealType: 'Lunch', mealName: 'B' }];
  assert.strictEqual(findMeal(meals, 2, 'Lunch').mealName, 'B');
  assert.strictEqual(findMeal(meals, 2, 'Dinner'), null);
  assert.deepStrictEqual(MEAL_TYPES, ['Breakfast', 'Lunch', 'Dinner']);
});

test('buildDayTimeline interleaves meals with activities by time', () => {
  const day = {
    dayNumber: 1,
    activities: [
      { id: 1, time: '10:00 AM', description: 'Museum' },
      { id: 2, time: 'Evening', description: 'Show' },
      { id: 3, time: '', description: 'Souvenirs' },
      { id: 4, time: 'Morning', description: 'Walk' },
    ],
  };
  const meals = [
    { id: 7, dayNumber: 1, mealType: 'Dinner', mealName: 'Pizza', time: '' },
    { id: 8, dayNumber: 1, mealType: 'Breakfast', mealName: 'Bagels', time: '' },
    { id: 9, dayNumber: 1, mealType: 'Lunch', mealName: '', time: '12:00 PM' }, // unplanned: skipped
    { id: 10, dayNumber: 2, mealType: 'Lunch', mealName: 'Other day', time: '' },
    { id: 11, dayNumber: 1, mealType: 'Lunch', mealName: 'Hot dogs', time: '12:30 PM' },
  ];
  const order = buildDayTimeline(day, meals).map((a) => a.description);
  assert.deepStrictEqual(order, [
    'Breakfast: Bagels',
    'Walk',
    'Museum',
    'Lunch: Hot dogs',
    'Dinner: Pizza',
    'Show',
    'Souvenirs',
  ]);
  const meal = buildDayTimeline(day, meals).find((a) => a.isMeal);
  assert.strictEqual(meal.id, 'meal-8');
});

test('checklist categories: baseline first, then extras from data', () => {
  assert.deepStrictEqual(checklistCategories([]), ['pre-trip', 'packing', 'app']);
  assert.deepStrictEqual(
    checklistCategories([{ category: 'packing' }, { category: 'kids-gear' }, { category: 'kids-gear' }]),
    ['pre-trip', 'packing', 'app', 'kids-gear']
  );
  assert.strictEqual(checklistLabel('packing'), '🎒 Packing List');
  assert.strictEqual(checklistLabel('kids-gear'), 'Kids Gear');
});

test('grocery categories', () => {
  const items = [{ category: 'Snacks' }, { category: "Trader Joe's" }, { category: 'Snacks' }];
  assert.deepStrictEqual(groceryCategoriesInUse(items), ['Snacks', "Trader Joe's"]);
  assert.deepStrictEqual(groceryCategoryOptions(items), [...GROCERY_BASE, "Trader Joe's"]);
});
