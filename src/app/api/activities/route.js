import { route } from '@/lib/api/next-route';
import { createActivity, deleteActivity, updateActivity } from '@/lib/api/activities';

// Logic and auth checks live in src/lib/api/activities.js (tested in tests/api).
export const POST = route(updateActivity);
export const PUT = route(createActivity);
export const DELETE = route(deleteActivity);
