import { route } from '@/lib/api/next-route';
import { setup, setupStatus } from '@/lib/api/auth';

// First-run only: creates the first admin when SETUP_TOKEN is set and there are no users.
export const GET = route(setupStatus);
export const POST = route(setup);
