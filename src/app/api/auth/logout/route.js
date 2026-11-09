import { route } from '@/lib/api/next-route';
import { logout } from '@/lib/api/auth';

export const POST = route(logout);
