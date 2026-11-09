// Reads when a photo was taken from a JPEG's EXIF block, in the browser (before
// the photo is resized, which drops EXIF) and in Node. Pure: bytes in, string out.
//
// Returns the camera's wall-clock time as 'YYYY-MM-DDTHH:mm:ss' (EXIF has no
// time zone, and the local day is what matters for matching itinerary days),
// or null when there is no usable date.

const TAG_EXIF_IFD = 0x8769;
const TAG_DATETIME = 0x0132;
const TAG_DATETIME_ORIGINAL = 0x9003;
const TYPE_ASCII = 2;

function toBytes(input) {
  if (!input) return null;
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  return null;
}

/** Offset of the TIFF header inside the JPEG's Exif APP1 segment, or -1. */
function findTiff(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return -1;
  let pos = 2;
  while (pos + 4 <= bytes.length) {
    if (bytes[pos] !== 0xff) return -1;
    const marker = bytes[pos + 1];
    if (marker === 0xda || marker === 0xd9) return -1; // image data / end: no EXIF before it
    const length = (bytes[pos + 2] << 8) | bytes[pos + 3];
    if (length < 2) return -1;
    const start = pos + 4;
    if (
      marker === 0xe1 &&
      start + 6 <= bytes.length &&
      bytes[start] === 0x45 && // "Exif\0\0"
      bytes[start + 1] === 0x78 &&
      bytes[start + 2] === 0x69 &&
      bytes[start + 3] === 0x66 &&
      bytes[start + 4] === 0 &&
      bytes[start + 5] === 0
    ) {
      return start + 6;
    }
    pos += 2 + length;
  }
  return -1;
}

function reader(bytes, tiff) {
  const little = bytes[tiff] === 0x49 && bytes[tiff + 1] === 0x49;
  const big = bytes[tiff] === 0x4d && bytes[tiff + 1] === 0x4d;
  if (!little && !big) return null;
  const inRange = (at, n) => at >= 0 && at + n <= bytes.length;
  const u16 = (at) => {
    if (!inRange(at, 2)) throw new RangeError('EXIF out of range');
    return little ? bytes[at] | (bytes[at + 1] << 8) : (bytes[at] << 8) | bytes[at + 1];
  };
  const u32 = (at) => {
    if (!inRange(at, 4)) throw new RangeError('EXIF out of range');
    return little
      ? (bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16) | (bytes[at + 3] << 24)) >>> 0
      : ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0;
  };
  const ascii = (at, count) => {
    if (!inRange(at, count)) throw new RangeError('EXIF out of range');
    let s = '';
    for (let i = 0; i < count && bytes[at + i] !== 0; i++) s += String.fromCharCode(bytes[at + i]);
    return s;
  };
  return { u16, u32, ascii };
}

/** Map of tag → entry offset for the IFD at `offset` (relative to the TIFF header). */
function readIfd(r, tiff, offset) {
  const entries = new Map();
  const at = tiff + offset;
  const count = r.u16(at);
  for (let i = 0; i < count; i++) {
    const entry = at + 2 + i * 12;
    entries.set(r.u16(entry), entry);
  }
  return entries;
}

function asciiValue(r, tiff, entry) {
  if (entry === undefined || r.u16(entry + 2) !== TYPE_ASCII) return null;
  const count = r.u32(entry + 4);
  const at = count <= 4 ? entry + 8 : tiff + r.u32(entry + 8);
  return r.ascii(at, count);
}

/** 'YYYY:MM:DD HH:MM:SS' → 'YYYY-MM-DDTHH:mm:ss', or null for blank / zeroed dates. */
function normalise(value) {
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(value ?? '');
  if (!m || m[1] === '0000' || m[2] === '00' || m[3] === '00') return null;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`;
}

export function readTakenAt(input) {
  const bytes = toBytes(input);
  if (!bytes) return null;
  try {
    const tiff = findTiff(bytes);
    if (tiff < 0) return null;
    const r = reader(bytes, tiff);
    if (!r || r.u16(tiff + 2) !== 42) return null;
    const ifd0 = readIfd(r, tiff, r.u32(tiff + 4));

    const exifPointer = ifd0.get(TAG_EXIF_IFD);
    if (exifPointer !== undefined) {
      const exif = readIfd(r, tiff, r.u32(exifPointer + 8));
      const original = normalise(asciiValue(r, tiff, exif.get(TAG_DATETIME_ORIGINAL)));
      if (original) return original;
    }
    return normalise(asciiValue(r, tiff, ifd0.get(TAG_DATETIME)));
  } catch {
    return null; // truncated or corrupt EXIF: just no date
  }
}
