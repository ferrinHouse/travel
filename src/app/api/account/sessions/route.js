import { route } from '@/lib/api/next-route';
import { listMySessions, revokeMySession } from '@/lib/api/account';

export const GET = route(listMySessions);
export const DELETE = route(revokeMySession);
