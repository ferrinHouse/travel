// Checks on an uploaded photo before sharp sees it. Pure.

export const PHOTO_SIZES = ['sm', 'lg', 'orig'];
export const CAPTION_MAX = 300;
export const ACCEPTED_TYPES = ['jpeg', 'png', 'webp'];

const startsWith = (bytes, ...values) => values.every((v, i) => bytes[i] === v);
const ascii = (bytes, from, to) => String.fromCharCode(...bytes.subarray(from, to));

/** The real image type from the file's first bytes (never trust the name or Content-Type). */
export function sniffImage(bytes) {
  if (!bytes || bytes.length < 12) return null;
  if (startsWith(bytes, 0xff, 0xd8, 0xff)) return 'jpeg';
  if (startsWith(bytes, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'png';
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return 'webp';
  if (ascii(bytes, 0, 4) === 'GIF8') return 'gif';
  if (ascii(bytes, 4, 8) === 'ftyp') {
    const brand = ascii(bytes, 8, 12);
    if (brand === 'avif' || brand === 'avis') return 'avif';
    if (['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'].includes(brand)) return 'heic';
  }
  return null;
}

const mb = (bytes) => `${Math.round(bytes / (1024 * 1024))} MB`;

/**
 * Why this upload can't be accepted, as { status, message }, or null if it's fine.
 * `truncated` means the request body went over `maxBytes` and reading stopped.
 */
export function uploadProblem({ bytes, truncated = false, maxBytes = Infinity }) {
  if (truncated || (bytes && bytes.length > maxBytes)) {
    return { status: 413, message: `That photo is too big. The limit is ${mb(maxBytes)}.` };
  }
  if (!bytes || bytes.length === 0) return { status: 400, message: 'No photo was sent.' };
  const type = sniffImage(bytes);
  if (type === 'heic' || type === 'avif') {
    return {
      status: 415,
      message:
        'This browser couldn’t convert the HEIC photo. Upload it from an iPhone or iPad (they convert it automatically), or export it as a JPEG first.',
    };
  }
  if (!ACCEPTED_TYPES.includes(type)) {
    return { status: 415, message: 'Only JPEG, PNG and WebP photos can be uploaded.' };
  }
  return null;
}
