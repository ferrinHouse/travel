import { route } from '@/lib/api/next-route';
import { photoFile } from '@/lib/api/photos';

// A photo's files never change, so browsers may keep them for a year (private: never shared caches).
export const GET = route(photoFile, { cache: 'private, max-age=31536000, immutable' });
