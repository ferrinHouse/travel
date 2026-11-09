// Scrapbook API: uploading, captioning, covers, deleting, serving files and
// share links, against a real SQLite DB and a temp uploads folder.
import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { createTestDb } from '../support/test-db.mjs';
import { seedTrip } from '../support/fixtures.mjs';
import { createUser } from '../support/users.mjs';
import { runHandler } from '../../src/lib/api/run.js';
import { deletePhoto, photoFile, updatePhoto, uploadPhoto } from '../../src/lib/api/photos.js';
import { createShareLink, findSharedTrip, revokeShareLink, sharedPhotoFile } from '../../src/lib/api/share.js';
import { deleteTrip, updateTrip } from '../../src/lib/api/trips.js';
import { hashToken } from '../../src/lib/auth/tokens.js';
import { cameraJpeg } from '../support/photos.mjs';

let db;
let uploads;
let users;
const START = new Date('2025-02-07T00:00:00Z');

const config = () => ({ uploadsDir: uploads, maxUploadBytes: 2 * 1024 * 1024, origin: 'https://travel.example.org' });
const call = (handler, { as = 'member', body = null, file, user } = {}) =>
  runHandler(handler, { db: db.prisma, user: user ?? (as ? users[as] : null), body, file, config: config() });

const upload = async (fields = {}, { as = 'member', bytes, user } = {}) =>
  call(uploadPhoto, { as, user, body: { tripId: 'testville', ...fields }, file: { bytes: bytes ?? (await cameraJpeg()), truncated: false } });

const filesOf = (photo) => path.join(uploads, 'photos', photo.tripId, photo.storageKey);

before(async () => {
  db = await createTestDb();
  users = {
    viewer: await createUser(db.prisma, { role: 'viewer' }),
    member: await createUser(db.prisma, { role: 'member' }),
    member2: await createUser(db.prisma, { role: 'member' }),
    admin: await createUser(db.prisma, { role: 'admin' }),
  };
});
after(() => db.cleanup());
beforeEach(async () => {
  await db.prisma.trip.deleteMany();
  if (uploads) fs.rmSync(uploads, { recursive: true, force: true });
  uploads = fs.mkdtempSync(path.join(os.tmpdir(), 'travel-uploads-'));
  // Feb 7–8, 2025 (days 1 and 2), so the camera date Feb 9 is outside the trip.
  await seedTrip(db.prisma, { startDate: START, endDate: new Date('2025-02-08T00:00:00Z'), status: 'past' });
});

describe('uploadPhoto', () => {
  test('stores three sizes, strips metadata and matches the day from the camera date', async () => {
    const res = await upload({ takenAt: '2025-02-08T14:30:00', caption: '  Sunset  ' });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const { photo } = res.body;
    assert.equal(photo.dayNumber, 2);
    assert.equal(photo.caption, 'Sunset');
    assert.equal(photo.takenAt, '2025-02-08T14:30:00');
    assert.equal(photo.isCover, false);
    assert.equal(photo.uploadedById, users.member.id);
    assert.deepEqual([photo.width, photo.height], [20, 40]); // EXIF orientation applied

    const saved = await db.prisma.photo.findUnique({ where: { id: photo.id } });
    assert.equal(saved.tripId, 'testville');
    const dir = filesOf(saved);
    assert.deepEqual(fs.readdirSync(dir).sort(), ['lg.webp', 'orig.jpg', 'sm.webp']);
    const total = ['lg.webp', 'orig.jpg', 'sm.webp'].reduce((n, f) => n + fs.statSync(path.join(dir, f)).size, 0);
    assert.equal(saved.bytes, total);
    assert.equal((await sharp(path.join(dir, 'orig.jpg')).metadata()).exif, undefined);
    assert.equal('storageKey' in photo, false, 'storage key stays on the server');
  });

  test('without a sent date, reads the date from the file itself', async () => {
    const res = await upload({}, { bytes: await cameraJpeg({ original: '2025:02:07 09:00:00' }) });
    assert.equal(res.body.photo.dayNumber, 1);
    assert.equal(res.body.photo.takenAt, '2025-02-07T09:00:00');
  });

  test('a photo from outside the trip dates is kept but not on a day', async () => {
    const res = await upload({}, { bytes: await cameraJpeg() }); // Feb 9
    assert.equal(res.status, 200);
    assert.equal(res.body.photo.dayNumber, null);
  });

  test('an explicit day wins over the date, but must be one of the trip’s days', async () => {
    const res = await upload({ takenAt: '2025-02-08T10:00:00', dayNumber: '1' });
    assert.equal(res.body.photo.dayNumber, 1);
    const bad = await upload({ dayNumber: '9' });
    assert.equal(bad.status, 400);
    assert.match(bad.body.message, /day/i);
  });

  test('rejects oversize, empty, HEIC and non-image uploads, writing nothing', async () => {
    const tooBig = await call(uploadPhoto, { body: { tripId: 'testville' }, file: { bytes: null, truncated: true } });
    assert.equal(tooBig.status, 413);
    const empty = await call(uploadPhoto, { body: { tripId: 'testville' }, file: { bytes: Buffer.alloc(0) } });
    assert.equal(empty.status, 400);
    const heic = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypheic'), Buffer.alloc(64)]);
    assert.equal((await upload({}, { bytes: heic })).status, 415);
    assert.equal((await upload({}, { bytes: Buffer.from('<svg/> not really an image at all') })).status, 415);
    // Looks like a JPEG but sharp can't read it.
    const corrupt = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200, 7)]);
    const unreadable = await upload({}, { bytes: corrupt });
    assert.equal(unreadable.status, 415);
    assert.match(unreadable.body.message, /couldn’t read/i);

    assert.equal(await db.prisma.photo.count(), 0);
    assert.equal(fs.existsSync(path.join(uploads, 'photos', 'testville')) ? fs.readdirSync(path.join(uploads, 'photos', 'testville')).length : 0, 0);
  });

  test('validates the trip, caption and date', async () => {
    assert.equal((await upload({ tripId: 'nowhere' })).status, 404);
    assert.equal((await upload({ tripId: '' })).status, 400);
    assert.equal((await upload({ caption: 'x'.repeat(301) })).status, 400);
    assert.equal((await upload({ takenAt: 'last tuesday' })).status, 400);
  });

  test('viewers and signed-out visitors cannot upload', async () => {
    assert.equal((await upload({}, { as: 'viewer' })).status, 403);
    assert.equal((await upload({}, { as: null })).status, 401);
    assert.equal(await db.prisma.photo.count(), 0);
  });
});

describe('updatePhoto', () => {
  let mine;
  beforeEach(async () => {
    mine = (await upload({ takenAt: '2025-02-07T10:00:00' })).body.photo;
  });

  test('the uploader can change the caption and day', async () => {
    const res = await call(updatePhoto, { body: { id: mine.id, caption: 'Pier at dusk', dayNumber: 2 } });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.photo.caption, 'Pier at dusk');
    assert.equal(res.body.photo.dayNumber, 2);
    const cleared = await call(updatePhoto, { body: { id: mine.id, caption: '   ', dayNumber: null } });
    assert.equal(cleared.body.photo.caption, null);
    assert.equal(cleared.body.photo.dayNumber, null);
  });

  test('other members and viewers cannot; admins can', async () => {
    assert.equal((await call(updatePhoto, { as: 'member2', body: { id: mine.id, caption: 'nope' } })).status, 403);
    assert.equal((await call(updatePhoto, { as: 'viewer', body: { id: mine.id, caption: 'nope' } })).status, 403);
    assert.equal((await call(updatePhoto, { as: null, body: { id: mine.id, caption: 'nope' } })).status, 401);
    assert.equal((await call(updatePhoto, { as: 'admin', body: { id: mine.id, caption: 'Admin fix' } })).status, 200);
  });

  test('only admins pick the cover, and there is only ever one', async () => {
    const second = (await upload({})).body.photo;
    assert.equal((await call(updatePhoto, { body: { id: mine.id, isCover: true } })).status, 403);

    assert.equal((await call(updatePhoto, { as: 'admin', body: { id: mine.id, isCover: true } })).body.photo.isCover, true);
    await call(updatePhoto, { as: 'admin', body: { id: second.id, isCover: true } });
    const covers = await db.prisma.photo.findMany({ where: { isCover: true } });
    assert.deepEqual(covers.map((p) => p.id), [second.id]);

    await call(updatePhoto, { as: 'admin', body: { id: second.id, isCover: false } });
    assert.equal(await db.prisma.photo.count({ where: { isCover: true } }), 0);
  });

  test('rejects bad input', async () => {
    assert.equal((await call(updatePhoto, { body: { id: mine.id, caption: 'x'.repeat(301) } })).status, 400);
    assert.equal((await call(updatePhoto, { body: { id: mine.id, dayNumber: 7 } })).status, 400);
    assert.equal((await call(updatePhoto, { body: { id: mine.id, isCover: 'yes' } })).status, 400);
    assert.equal((await call(updatePhoto, { body: { id: 'one' } })).status, 400);
    assert.equal((await call(updatePhoto, { body: { id: 999999, caption: 'x' } })).status, 404);
  });
});

describe('deletePhoto', () => {
  test('removes the row and the files (uploader or admin only)', async () => {
    const photo = (await upload({})).body.photo;
    const saved = await db.prisma.photo.findUnique({ where: { id: photo.id } });
    assert.equal((await call(deletePhoto, { as: 'member2', body: { id: photo.id } })).status, 403);
    assert.equal((await call(deletePhoto, { as: 'viewer', body: { id: photo.id } })).status, 403);
    assert.equal((await call(deletePhoto, { body: { id: photo.id } })).status, 200);
    assert.equal(await db.prisma.photo.count(), 0);
    assert.ok(!fs.existsSync(filesOf(saved)));
    assert.equal((await call(deletePhoto, { as: 'admin', body: { id: photo.id } })).status, 404);
  });
});

describe('photoFile', () => {
  test('signed-in users get any size; unknown sizes, photos and missing files are 404', async () => {
    const photo = (await upload({})).body.photo;
    const res = await call(photoFile, { as: 'viewer', body: { id: String(photo.id), size: 'sm' } });
    assert.equal(res.status, 200);
    assert.equal(res.file.type, 'image/webp');
    assert.ok(fs.existsSync(res.file.path));
    assert.equal((await call(photoFile, { as: 'viewer', body: { id: String(photo.id), size: 'orig' } })).file.type, 'image/jpeg');

    assert.equal((await call(photoFile, { as: 'viewer', body: { id: String(photo.id), size: 'xl' } })).status, 404);
    assert.equal((await call(photoFile, { as: 'viewer', body: { id: '999999', size: 'sm' } })).status, 404);
    assert.equal((await call(photoFile, { as: 'viewer', body: { id: 'abc', size: 'sm' } })).status, 404);
    assert.equal((await call(photoFile, { as: null, body: { id: String(photo.id), size: 'sm' } })).status, 401);

    const saved = await db.prisma.photo.findUnique({ where: { id: photo.id } });
    fs.rmSync(filesOf(saved), { recursive: true });
    assert.equal((await call(photoFile, { as: 'viewer', body: { id: String(photo.id), size: 'sm' } })).status, 404);
  });
});

describe('share links', () => {
  const tokenFrom = (url) => url.split('/share/')[1];

  test('admins create a link; making a new one retires the old one', async () => {
    assert.equal((await call(createShareLink, { body: { tripId: 'testville' } })).status, 403);
    const first = await call(createShareLink, { as: 'admin', body: { tripId: 'testville' } });
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.match(first.body.url, /^https:\/\/travel\.example\.org\/share\/[A-Za-z0-9_-]{43}$/);
    const firstToken = tokenFrom(first.body.url);
    assert.equal(await findSharedTrip(db.prisma, firstToken), 'testville');
    // Only the hash is stored.
    assert.ok(await db.prisma.tripShareLink.findUnique({ where: { id: hashToken(firstToken) } }));

    const second = await call(createShareLink, { as: 'admin', body: { tripId: 'testville' } });
    assert.equal(await findSharedTrip(db.prisma, firstToken), null);
    assert.equal(await findSharedTrip(db.prisma, tokenFrom(second.body.url)), 'testville');
    assert.equal((await call(createShareLink, { as: 'admin', body: { tripId: 'nowhere' } })).status, 404);
  });

  test('revoking turns the link off', async () => {
    const { url } = (await call(createShareLink, { as: 'admin', body: { tripId: 'testville' } })).body;
    assert.equal((await call(revokeShareLink, { as: 'member', body: { tripId: 'testville' } })).status, 403);
    assert.equal((await call(revokeShareLink, { as: 'admin', body: { tripId: 'testville' } })).status, 200);
    assert.equal(await findSharedTrip(db.prisma, tokenFrom(url)), null);
  });

  test('unknown, blank and malformed tokens find nothing', async () => {
    assert.equal(await findSharedTrip(db.prisma, 'x'.repeat(43)), null);
    assert.equal(await findSharedTrip(db.prisma, ''), null);
    assert.equal(await findSharedTrip(db.prisma, undefined), null);
  });

  test('the shared photo route serves only that trip’s small and large photos, while the link is live', async () => {
    const photo = (await upload({})).body.photo;
    await seedTrip(db.prisma, { id: 'elsewhere' });
    const other = (await upload({ tripId: 'elsewhere' })).body.photo;
    const { url } = (await call(createShareLink, { as: 'admin', body: { tripId: 'testville' } })).body;
    const token = tokenFrom(url);
    const get = (id, size, t = token) => call(sharedPhotoFile, { as: null, body: { token: t, id: String(id), size } });

    assert.equal((await get(photo.id, 'lg')).status, 200);
    assert.equal((await get(photo.id, 'sm')).status, 200);
    assert.equal((await get(photo.id, 'orig')).status, 404, 'no full-size originals on public links');
    assert.equal((await get(other.id, 'sm')).status, 404, 'other trips stay private');
    assert.equal((await get(photo.id, 'sm', 'y'.repeat(43))).status, 404);

    await call(revokeShareLink, { as: 'admin', body: { tripId: 'testville' } });
    assert.equal((await get(photo.id, 'sm')).status, 404);
  });
});

describe('trip changes and photos', () => {
  test('deleting a trip deletes its photo files', async () => {
    await upload({});
    const tripDir = path.join(uploads, 'photos', 'testville');
    assert.ok(fs.existsSync(tripDir));
    const res = await call(deleteTrip, { as: 'admin', body: { id: 'testville', confirmName: 'Testville Getaway' } });
    assert.equal(res.status, 200);
    assert.ok(!fs.existsSync(tripDir));
  });

  test('shortening the dates will not drop a day that has photos', async () => {
    await upload({ takenAt: '2025-02-08T12:00:00' }); // day 2
    const res = await call(updateTrip, {
      as: 'admin',
      body: { id: 'testville', name: 'Testville Getaway', tag: 'City', travelers: 'Family of 4', startDate: '2025-02-07', endDate: '2025-02-07', primaryColor: '#004488', accentColor: '#d9534f' },
    });
    assert.equal(res.status, 409);
    assert.match(res.body.message, /Day 2/);
  });
});
