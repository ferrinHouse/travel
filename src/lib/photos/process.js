// Turns an upload into the three stored sizes with sharp: honours the camera's
// rotation, then strips all metadata (EXIF, GPS, maker notes). sharp keeps no
// metadata unless asked to, and we never ask.
import sharp from 'sharp';

// Small server (a Raspberry Pi): one thread, no cache, refuse decompression bombs.
sharp.concurrency(1);
sharp.cache(false);

export const MAX_EDGE = { orig: 4096, lg: 1600, sm: 480 };
const MAX_INPUT_PIXELS = 100_000_000;

const fit = (edge) => ({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true });

/** Buffer → { width, height, files: { orig, lg, sm } }. Throws if it isn't a readable image. */
export async function processPhoto(input) {
  const source = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' }).rotate();
  const { data: orig, info } = await source
    .clone()
    .resize(fit(MAX_EDGE.orig))
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  // Smaller sizes come from the (already rotated, already capped) original.
  const [lg, sm] = await Promise.all([
    sharp(orig).resize(fit(MAX_EDGE.lg)).webp({ quality: 80 }).toBuffer(),
    sharp(orig).resize(fit(MAX_EDGE.sm)).webp({ quality: 75 }).toBuffer(),
  ]);
  return { width: info.width, height: info.height, files: { orig, lg, sm } };
}
