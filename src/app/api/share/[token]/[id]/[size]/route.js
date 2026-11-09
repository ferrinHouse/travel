import { route } from '@/lib/api/next-route';
import { sharedPhotoFile } from '@/lib/api/share';

// Short cache so turning the link off takes effect quickly.
export const GET = route(sharedPhotoFile, { cache: 'private, max-age=300' });
