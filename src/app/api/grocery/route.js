import { route } from '@/lib/api/next-route';
import { createGroceryItem, toggleGroceryItem } from '@/lib/api/grocery';

// Logic and auth checks live in src/lib/api/grocery.js (tested in tests/api).
export const POST = route(toggleGroceryItem);
export const PUT = route(createGroceryItem);
