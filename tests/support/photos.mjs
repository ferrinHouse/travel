// Sample photos for tests, made with sharp.
import sharp from 'sharp';

/** A small JPEG with camera EXIF (orientation 6, dates, GPS, maker). */
export async function cameraJpeg({ width = 40, height = 20, orientation = 6, original = '2025:02:09 17:45:12', dateTime = '2025:02:10 08:00:00', color = '#c33' } = {}) {
  const exif = { IFD0: { Make: 'TestCam', ...(dateTime ? { DateTime: dateTime } : {}) }, IFD3: { GPSLatitudeRef: 'N', GPSLongitudeRef: 'W' } };
  if (original) exif.IFD2 = { DateTimeOriginal: original };
  return sharp({ create: { width, height, channels: 3, background: color } })
    .withMetadata({ orientation })
    .withExif(exif)
    .jpeg()
    .toBuffer();
}

/** A minimal file that claims to be HEIC (enough for type sniffing). */
export const fakeHeic = () => Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypheic'), Buffer.alloc(64)]);
