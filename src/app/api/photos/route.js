import { route } from '@/lib/api/next-route';
import { deletePhoto, updatePhoto, uploadPhoto } from '@/lib/api/photos';

// POST: raw image body, details in the query string (see uploadPhoto).
export const POST = route(uploadPhoto, { upload: true });
export const PATCH = route(updatePhoto);
export const DELETE = route(deletePhoto);
