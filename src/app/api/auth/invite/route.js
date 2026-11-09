import { route } from '@/lib/api/next-route';
import { acceptInvite, inviteDetails } from '@/lib/api/auth';

// GET ?token=… describes the link; POST { token, password } accepts it.
export const GET = route(inviteDetails);
export const POST = route(acceptInvite);
