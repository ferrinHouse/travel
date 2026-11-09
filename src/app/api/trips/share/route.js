import { route } from '@/lib/api/next-route';
import { createShareLink, revokeShareLink } from '@/lib/api/share';

export const POST = route(createShareLink);
export const DELETE = route(revokeShareLink);
