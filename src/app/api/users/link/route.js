import { route } from '@/lib/api/next-route';
import { createResetLink } from '@/lib/api/users';

// A fresh one-time invite or password-reset link for { id }.
export const POST = route(createResetLink);
