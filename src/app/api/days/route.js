import { route } from '@/lib/api/next-route';
import { updateDay } from '@/lib/api/trips';

export const PATCH = route(updateDay);
