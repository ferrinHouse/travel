import { route } from '@/lib/api/next-route';
import { loginOptions } from '@/lib/api/passkeys';

export const POST = route(loginOptions);
