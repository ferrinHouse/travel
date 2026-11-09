import { route } from '@/lib/api/next-route';
import { createTrip, deleteTrip, updateTrip } from '@/lib/api/trips';

// Logic and auth checks live in src/lib/api/trips.js (tested in tests/api).
export const POST = route(createTrip);
export const PATCH = route(updateTrip);
export const DELETE = route(deleteTrip);
