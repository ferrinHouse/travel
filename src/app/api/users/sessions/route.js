import { route } from '@/lib/api/next-route';
import { revokeUserSessions } from '@/lib/api/users';

// Sign { id } out of every device.
export const DELETE = route(revokeUserSessions);
