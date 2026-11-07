import { route } from '@/lib/api/next-route';
import { deleteLogisticsCard, saveLogisticsCard } from '@/lib/api/logistics';

// Logic and auth checks live in src/lib/api/logistics.js (tested in tests/api).
export const POST = route(saveLogisticsCard);
export const DELETE = route(deleteLogisticsCard);
