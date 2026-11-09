import { route } from '@/lib/api/next-route';
import { registerOptions } from '@/lib/api/passkeys';

export const POST = route(registerOptions);
