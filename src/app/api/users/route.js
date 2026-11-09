import { route } from '@/lib/api/next-route';
import { createUserAccount, listUsers, updateUser } from '@/lib/api/users';

// Admin only; checks live in src/lib/api/users.js (tested in tests/api).
export const GET = route(listUsers);
export const POST = route(createUserAccount);
export const PATCH = route(updateUser);
