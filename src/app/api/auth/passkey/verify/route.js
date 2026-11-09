import { route } from '@/lib/api/next-route';
import { loginVerify } from '@/lib/api/passkeys';

export const POST = route(loginVerify);
