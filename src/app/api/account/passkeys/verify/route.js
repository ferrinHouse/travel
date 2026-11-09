import { route } from '@/lib/api/next-route';
import { registerVerify } from '@/lib/api/passkeys';

export const POST = route(registerVerify);
