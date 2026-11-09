// Pure scrapbook helpers: EXIF dates, day matching, upload checks, storage paths
// and the sharp pipeline (orientation, sizes, metadata stripped).
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { readTakenAt } from '../src/lib/photos/exif.js';
import { dayNumberFor, parseTakenAt, takenAtKey } from '../src/lib/photos/assign-day.js';
import { CAPTION_MAX, PHOTO_SIZES, sniffImage, uploadProblem } from '../src/lib/photos/validate.js';
import {
  photoDir,
  removePhotoFiles,
  removeTripFiles,
  savePhotoFiles,
  variantFile,
} from '../src/lib/photos/storage.js';
import { MAX_EDGE, processPhoto } from '../src/lib/photos/process.js';
import { canChangePhoto } from '../src/lib/photos/access.js';
import { cameraJpeg } from './support/photos.mjs';

describe('readTakenAt (EXIF)', () => {
  test('reads DateTimeOriginal from a camera JPEG', async () => {
    assert.equal(readTakenAt(await cameraJpeg()), '2025-02-09T17:45:12');
  });

  test('falls back to IFD0 DateTime when there is no DateTimeOriginal', async () => {
    assert.equal(readTakenAt(await cameraJpeg({ original: null })), '2025-02-10T08:00:00');
  });

  test('accepts an ArrayBuffer or Uint8Array (what the browser has)', async () => {
    const buf = await cameraJpeg();
    const u8 = new Uint8Array(buf);
    assert.equal(readTakenAt(u8), '2025-02-09T17:45:12');
    assert.equal(readTakenAt(u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength)), '2025-02-09T17:45:12');
  });

  test('returns null for images without EXIF, non-JPEGs, junk and truncated files', async () => {
    const plain = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#000' } }).jpeg().toBuffer();
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#000' } }).png().toBuffer();
    const withExif = await cameraJpeg();
    assert.equal(readTakenAt(plain), null);
    assert.equal(readTakenAt(png), null);
    assert.equal(readTakenAt(Buffer.from('not an image')), null);
    assert.equal(readTakenAt(new Uint8Array(0)), null);
    assert.equal(readTakenAt(withExif.subarray(0, 30)), null);
    assert.equal(readTakenAt(null), null);
  });

  test('ignores a blank or zeroed camera date', async () => {
    assert.equal(readTakenAt(await cameraJpeg({ original: '0000:00:00 00:00:00', dateTime: null })), null);
  });
});

describe('parseTakenAt / dayNumberFor', () => {
  test('parses camera wall-clock time as if it were UTC', () => {
    assert.equal(parseTakenAt('2025-02-09T17:45:12').toISOString(), '2025-02-09T17:45:12.000Z');
    assert.equal(parseTakenAt('2025-02-09T17:45').toISOString(), '2025-02-09T17:45:00.000Z');
  });

  test('rejects anything else', () => {
    for (const bad of ['', 'yesterday', '2025-02-30T10:00:00', '2025-02-09', '1970-01-01T00:00:00', '2201-01-01T00:00:00', 42, null, undefined, '2025-02-09T25:00:00']) {
      assert.equal(parseTakenAt(bad), null, String(bad));
    }
  });

  test('takenAtKey turns a stored time back into the wire format', () => {
    assert.equal(takenAtKey(new Date('2025-02-09T17:45:12Z')), '2025-02-09T17:45:12');
    assert.equal(takenAtKey(null), null);
  });

  const trip = { startDate: new Date('2025-02-07T00:00:00Z') };
  const days = [{ dayNumber: 1 }, { dayNumber: 2 }, { dayNumber: 3 }];

  test('matches the photo to the itinerary day of its calendar date', () => {
    assert.equal(dayNumberFor(parseTakenAt('2025-02-07T00:00:00'), trip, days), 1);
    assert.equal(dayNumberFor(parseTakenAt('2025-02-08T23:59:59'), trip, days), 2);
    assert.equal(dayNumberFor(parseTakenAt('2025-02-09T12:00:00'), trip, days), 3);
  });

  test('null outside the trip, without a date, or without a start date', () => {
    assert.equal(dayNumberFor(parseTakenAt('2025-02-06T23:00:00'), trip, days), null);
    assert.equal(dayNumberFor(parseTakenAt('2025-02-10T08:00:00'), trip, days), null);
    assert.equal(dayNumberFor(null, trip, days), null);
    assert.equal(dayNumberFor(parseTakenAt('2025-02-07T10:00:00'), { startDate: null }, days), null);
  });

  test('follows day positions, so trips that start at Day 0 still line up', () => {
    const zeroBased = [{ dayNumber: 2 }, { dayNumber: 0 }, { dayNumber: 1 }]; // unsorted on purpose
    assert.equal(dayNumberFor(parseTakenAt('2025-02-07T09:00:00'), trip, zeroBased), 0);
    assert.equal(dayNumberFor(parseTakenAt('2025-02-09T09:00:00'), trip, zeroBased), 2);
  });
});

describe('upload checks', () => {
  test('sniffs the real file type from its first bytes', async () => {
    const base = sharp({ create: { width: 4, height: 4, channels: 3, background: '#000' } });
    assert.equal(sniffImage(await base.clone().jpeg().toBuffer()), 'jpeg');
    assert.equal(sniffImage(await base.clone().png().toBuffer()), 'png');
    assert.equal(sniffImage(await base.clone().webp().toBuffer()), 'webp');
    assert.equal(sniffImage(await base.clone().gif().toBuffer()), 'gif');
    const heic = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypheic'), Buffer.alloc(16)]);
    assert.equal(sniffImage(heic), 'heic');
    const avif = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypavif'), Buffer.alloc(16)]);
    assert.equal(sniffImage(avif), 'avif');
    assert.equal(sniffImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')), null);
    assert.equal(sniffImage(Buffer.alloc(0)), null);
  });

  test('accepts JPEG, PNG and WebP under the size limit', async () => {
    const jpeg = await cameraJpeg();
    assert.equal(uploadProblem({ bytes: jpeg, maxBytes: 1024 * 1024 }), null);
  });

  test('explains what is wrong with everything else', async () => {
    const jpeg = await cameraJpeg();
    assert.equal(uploadProblem({ bytes: null }).status, 400);
    assert.equal(uploadProblem({ bytes: Buffer.alloc(0) }).status, 400);
    const big = uploadProblem({ bytes: jpeg, maxBytes: 100 });
    assert.equal(big.status, 413);
    assert.match(big.message, /too big/i);
    assert.equal(uploadProblem({ bytes: null, truncated: true, maxBytes: 25 * 1024 * 1024 }).status, 413);
    const heic = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypheic'), Buffer.alloc(16)]);
    const heicProblem = uploadProblem({ bytes: heic, maxBytes: 1e6 });
    assert.equal(heicProblem.status, 415);
    assert.match(heicProblem.message, /HEIC/);
    assert.equal(uploadProblem({ bytes: Buffer.from('hello'), maxBytes: 1e6 }).status, 415);
  });

  test('sizes and caption limit', () => {
    assert.deepEqual(PHOTO_SIZES, ['sm', 'lg', 'orig']);
    assert.equal(CAPTION_MAX, 300);
  });
});

describe('storage', () => {
  let root;
  before(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'travel-photos-'));
  });
  after(() => fs.rmSync(root, { recursive: true, force: true }));

  const key = '3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b';
  const files = { orig: Buffer.from('orig'), lg: Buffer.from('large'), sm: Buffer.from('s') };

  test('saves the three files under photos/<trip>/<key> and reports their size', async () => {
    const bytes = await savePhotoFiles(root, 'lake-week', key, files);
    assert.equal(bytes, 4 + 5 + 1);
    const dir = photoDir(root, 'lake-week', key);
    assert.equal(dir, path.join(root, 'photos', 'lake-week', key));
    assert.deepEqual(fs.readdirSync(dir).sort(), ['lg.webp', 'orig.jpg', 'sm.webp']);
    // No temp folders left behind.
    assert.deepEqual(fs.readdirSync(path.join(root, 'photos', 'lake-week')), [key]);
  });

  test('variantFile gives the path and content type for a size', () => {
    const photo = { tripId: 'lake-week', storageKey: key };
    assert.deepEqual(variantFile(root, photo, 'sm'), { path: path.join(root, 'photos', 'lake-week', key, 'sm.webp'), type: 'image/webp' });
    assert.equal(variantFile(root, photo, 'orig').type, 'image/jpeg');
    assert.equal(variantFile(root, photo, 'huge'), null);
  });

  test('refuses names that could escape the uploads folder', () => {
    for (const [trip, k] of [['..', key], ['lake-week', '../../etc'], ['a/b', key], ['lake-week', ''], ['', key], ['Lake Week', key]]) {
      assert.throws(() => photoDir(root, trip, k), /Unsafe/, `${trip} / ${k}`);
    }
  });

  test('removes one photo, then a whole trip; both are fine if already gone', async () => {
    const other = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
    await savePhotoFiles(root, 'lake-week', other, files);
    await removePhotoFiles(root, 'lake-week', key);
    assert.ok(!fs.existsSync(photoDir(root, 'lake-week', key)));
    assert.ok(fs.existsSync(photoDir(root, 'lake-week', other)));
    await removePhotoFiles(root, 'lake-week', key);
    await removeTripFiles(root, 'lake-week');
    assert.ok(!fs.existsSync(path.join(root, 'photos', 'lake-week')));
    await removeTripFiles(root, 'lake-week');
  });
});

describe('processPhoto (sharp)', () => {
  test('applies the EXIF rotation and strips camera metadata and GPS', async () => {
    const result = await processPhoto(await cameraJpeg({ width: 40, height: 20, orientation: 6 }));
    // Rotated 90°: 40×20 becomes 20×40.
    assert.equal(result.width, 20);
    assert.equal(result.height, 40);
    for (const size of PHOTO_SIZES) {
      const meta = await sharp(result.files[size]).metadata();
      assert.equal(meta.exif, undefined, `${size} still has EXIF`);
      assert.ok(!meta.orientation || meta.orientation === 1, `${size} orientation`);
      assert.ok(!result.files[size].toString('latin1').includes('TestCam'), `${size} still names the camera`);
    }
  });

  test('makes a JPEG original and WebP large/small copies, never upscaling', async () => {
    const big = await sharp({ create: { width: 2400, height: 1200, channels: 3, background: '#39c' } }).png().toBuffer();
    const { width, height, files } = await processPhoto(big);
    assert.deepEqual([width, height], [2400, 1200]);
    const meta = Object.fromEntries(await Promise.all(PHOTO_SIZES.map(async (s) => [s, await sharp(files[s]).metadata()])));
    assert.equal(meta.orig.format, 'jpeg');
    assert.deepEqual([meta.orig.width, meta.orig.height], [2400, 1200]);
    assert.equal(meta.lg.format, 'webp');
    assert.deepEqual([meta.lg.width, meta.lg.height], [MAX_EDGE.lg, 800]);
    assert.equal(meta.sm.format, 'webp');
    assert.deepEqual([meta.sm.width, meta.sm.height], [MAX_EDGE.sm, 240]);

    const tiny = await processPhoto(await cameraJpeg({ width: 40, height: 20, orientation: 1 }));
    assert.equal((await sharp(tiny.files.lg).metadata()).width, 40);
  });

  test('caps the original at 4096px on the long edge', async () => {
    const huge = await sharp({ create: { width: 5000, height: 1000, channels: 3, background: '#fff' } }).jpeg().toBuffer();
    const { width, height } = await processPhoto(huge);
    assert.equal(MAX_EDGE.orig, 4096);
    assert.deepEqual([width, height], [4096, 819]);
  });

  test('throws on files that are not images', async () => {
    await assert.rejects(processPhoto(Buffer.from('definitely not a jpeg')));
  });
});

describe('canChangePhoto', () => {
  const photo = { uploadedById: 7 };
  test('admins always; members only their own uploads; viewers never', () => {
    assert.equal(canChangePhoto({ id: 1, role: 'admin', isActive: true }, photo), true);
    assert.equal(canChangePhoto({ id: 7, role: 'member', isActive: true }, photo), true);
    assert.equal(canChangePhoto({ id: 8, role: 'member', isActive: true }, photo), false);
    assert.equal(canChangePhoto({ id: 7, role: 'viewer', isActive: true }, photo), false);
    assert.equal(canChangePhoto({ id: 7, role: 'member', isActive: false }, photo), false);
    assert.equal(canChangePhoto(null, photo), false);
    assert.equal(canChangePhoto({ id: 7, role: 'member', isActive: true }, { uploadedById: null }), false);
  });
});
