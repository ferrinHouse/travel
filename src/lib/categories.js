/** Baseline checklist categories; any other category found in the data is shown after these. */
export const CHECKLIST_BASE = ['pre-trip', 'packing', 'app'];

const CHECKLIST_LABELS = {
  'pre-trip': '✅ Pre-Trip To-Do',
  packing: '🎒 Packing List',
  app: '📱 Travel Apps',
};

export const GROCERY_BASE = ['General', 'Breakfast', 'Packed Lunches', 'Dinners', 'Snacks', 'Essentials'];

function withExtras(base, items) {
  const extras = [];
  for (const { category } of items) {
    if (category && !base.includes(category) && !extras.includes(category)) extras.push(category);
  }
  return [...base, ...extras];
}

export function checklistCategories(items) {
  return withExtras(CHECKLIST_BASE, items);
}

export function checklistLabel(category) {
  if (CHECKLIST_LABELS[category]) return CHECKLIST_LABELS[category];
  return category.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Categories that currently have grocery items, in first-seen order. */
export function groceryCategoriesInUse(items) {
  return withExtras([], items);
}

/** Options for the "add grocery" select: the defaults plus any custom ones in use. */
export function groceryCategoryOptions(items) {
  return withExtras(GROCERY_BASE, items);
}
