import { route } from '@/lib/api/next-route';
import { archiveTrip } from '@/lib/api/trips';

export const POST = route(archiveTrip);
