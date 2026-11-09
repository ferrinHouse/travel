import { route } from '@/lib/api/next-route';
import { login } from '@/lib/api/auth';

// Logic, validation and rate limits live in src/lib/api/auth.js (tested in tests/api).
export const POST = route(login);
