// Browser-side scrapbook helpers: resize maths, URLs, the upload queue and
// grouping photos under itinerary days.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { CLIENT_MAX_EDGE, fitWithin, needsReencode, runQueue, uploadUrl } from '../src/lib/photos/upload.js';
import { groupByDay, photoAlt, photoUrl, sharedPhotoUrl, storyStats } from '../src/lib/photos/view.js';

describe('resizing before upload', () => {
  test('fitWithin scales the long edge down, keeping the shape, never up', () => {
    assert.deepEqual(fitWithin(4032, 3024, 3000), { width: 3000, height: 2250 });
    assert.deepEqual(fitWithin(3024, 4032, 3000), { width: 2250, height: 3000 });
    assert.deepEqual(fitWithin(800, 600, 3000), { width: 800, height: 600 });
    assert.equal(CLIENT_MAX_EDGE, 3000);
  });

  test('re-encode anything that is not a JPEG, or is bigger than the limit', () => {
    assert.equal(needsReencode('image/jpeg', 2000, 1500), false);
    assert.equal(needsReencode('image/jpeg', 4032, 3024), true);
    assert.equal(needsReencode('image/heic', 800, 600), true);
    assert.equal(needsReencode('image/png', 800, 600), true);
    assert.equal(needsReencode('', 800, 600), true);
  });

  test('uploadUrl carries the details in the query string', () => {
    assert.equal(uploadUrl('lake-week', {}), '/api/photos?tripId=lake-week');
    assert.equal(
      uploadUrl('lake-week', { takenAt: '2025-02-09T17:45:12', dayNumber: 2, caption: 'A & B' }),
      '/api/photos?tripId=lake-week&takenAt=2025-02-09T17%3A45%3A12&dayNumber=2&caption=A+%26+B'
    );
    assert.equal(uploadUrl('x', { takenAt: null, dayNumber: undefined }), '/api/photos?tripId=x');
  });
});

describe('runQueue', () => {
  test('runs every item, at most `concurrency` at once, and keeps going after failures', async () => {
    let running = 0;
    let peak = 0;
    const done = [];
    await runQueue([1, 2, 3, 4, 5], 2, async (n) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
      if (n === 3) throw new Error('boom');
      done.push(n);
    });
    assert.equal(peak, 2);
    assert.deepEqual(done.sort(), [1, 2, 4, 5]);
  });

  test('an empty list finishes straight away', async () => {
    await runQueue([], 2, async () => assert.fail('should not run'));
  });
});

describe('viewing', () => {
  const days = [
    { id: 11, dayNumber: 2, dateLabel: 'Day 2: Sunday' },
    { id: 10, dayNumber: 1, dateLabel: 'Day 1: Saturday' },
  ];
  const photos = [
    { id: 1, dayNumber: 2 },
    { id: 2, dayNumber: null },
    { id: 3, dayNumber: 1 },
    { id: 4, dayNumber: 9 }, // its day was removed
    { id: 5, dayNumber: 1 },
  ];

  test('groupByDay lists days in order with their photos, then everything else', () => {
    const groups = groupByDay(photos, days);
    assert.deepEqual(
      groups.map((g) => [g.day?.dayNumber ?? null, g.photos.map((p) => p.id)]),
      [
        [1, [3, 5]],
        [2, [1]],
        [null, [2, 4]],
      ]
    );
  });

  test('days without photos are left out', () => {
    assert.deepEqual(groupByDay([{ id: 1, dayNumber: 2 }], days).map((g) => g.day.dayNumber), [2]);
    assert.deepEqual(groupByDay([], days), []);
  });

  test('photo URLs', () => {
    assert.equal(photoUrl({ id: 7 }, 'sm'), '/api/photos/7/sm');
    assert.equal(photoUrl({ id: 7 }, 'orig', { download: true }), '/api/photos/7/orig?download=1');
    assert.equal(sharedPhotoUrl('tok_en', { id: 7 }, 'lg'), '/api/share/tok_en/7/lg');
  });

  test('alt text uses the caption, or says where the photo is from', () => {
    assert.equal(photoAlt({ caption: 'Pier at dusk' }, days[1], 0), 'Pier at dusk');
    assert.equal(photoAlt({ caption: null }, days[1], 2), 'Photo 3 from Day 1: Saturday');
    assert.equal(photoAlt({ caption: '' }, null, 0), 'Photo 1');
  });

  test('storyStats counts days, photos and plans', () => {
    const trip = {
      days: [{ activities: [{}, {}] }, { activities: [{}] }, { activities: [] }],
      photos: [{}, {}],
    };
    assert.deepEqual(storyStats(trip), { days: 3, photos: 2, activities: 3 });
  });
});
