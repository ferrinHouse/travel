import { route } from '@/lib/api/next-route';
import { currentUser } from '@/lib/api/auth';

export const GET = route(currentUser);
