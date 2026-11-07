import { route } from '@/lib/api/next-route';
import { saveMeal } from '@/lib/api/meals';

// Logic and auth checks live in src/lib/api/meals.js (tested in tests/api).
export const POST = route(saveMeal);
