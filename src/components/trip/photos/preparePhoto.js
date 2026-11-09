// Browser only: reads the camera date, then shrinks / converts the photo to a
// JPEG before upload when the browser can decode it (this is what turns iPhone
// HEIC into JPEG on Safari). Anything it can't decode is sent as-is and the
// server explains if it can't take it.
import { readTakenAt } from '@/lib/photos/exif';
import { CLIENT_MAX_EDGE, fitWithin, needsReencode } from '@/lib/photos/upload';

const EXIF_BYTES = 256 * 1024;

export async function preparePhoto(file) {
  let takenAt = null;
  try {
    takenAt = readTakenAt(await file.slice(0, EXIF_BYTES).arrayBuffer());
  } catch {
    // no date; the server falls back to its own EXIF read
  }

  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return { blob: file, takenAt };
  }
  try {
    if (!needsReencode(file.type, bitmap.width, bitmap.height)) return { blob: file, takenAt };
    const { width, height } = fitWithin(bitmap.width, bitmap.height, CLIENT_MAX_EDGE);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    return { blob: blob ?? file, takenAt };
  } finally {
    bitmap.close?.();
  }
}
