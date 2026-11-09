import { route } from '@/lib/api/next-route';
import { changePassword } from '@/lib/api/account';

export const POST = route(changePassword);
