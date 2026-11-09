import { route } from '@/lib/api/next-route';
import { deleteMyPasskey, listMyPasskeys, renameMyPasskey } from '@/lib/api/account';

export const GET = route(listMyPasskeys);
export const PATCH = route(renameMyPasskey);
export const DELETE = route(deleteMyPasskey);
