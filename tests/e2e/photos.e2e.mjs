// Scrapbook end to end: uploading, the viewer, covers, the story page and
// share links, plus who can do what and accessibility in both themes.
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, newContext, sessionCookieHeader } from './support/server.mjs';
import { openTrip, fitsWidth, waitForToast } from './support/trip-page.mjs';
import { axeViolations } from './support/axe.mjs';
import { daysFromToday } from '../support/fixtures.mjs';
import { cameraJpeg, fakeHeic } from '../support/photos.mjs';

let app;

/** EXIF date string for `offset` days from today at `time`. */
const exifDay = (offset, time = '12:00:00') => `${daysFromToday(offset).toISOString().slice(0, 10).replaceAll('-', ':')} ${time}`;

// oldtown runs from 40 to 35 days ago, with days 1 and 2 seeded.
const photo = async (name, { offset = -40, time, color } = {}) => ({
  name,
  mimeType: 'image/jpeg',
  buffer: await cameraJpeg({ width: 600, height: 400, orientation: 1, original: exifDay(offset, time), color }),
});

const resetPhotos = async () => {
  await app.prisma.photo.deleteMany();
  await app.prisma.tripShareLink.deleteMany();
};

/** Uploads straight through the API (fast setup for viewer/story tests). */
async function uploadVia(role, { tripId = 'oldtown', offset = -40, caption } = {}) {
  const body = await cameraJpeg({ width: 600, height: 400, orientation: 1, original: exifDay(offset) });
  const params = new URLSearchParams({ tripId, ...(caption ? { caption } : {}) });
  const res = await fetch(`${app.apiURL}/api/photos?${params}`, {
    method: 'POST',
    headers: { Cookie: await sessionCookieHeader(app, role), 'Content-Type': 'image/jpeg', Origin: app.baseURL },
    body,
  });
  const data = await res.json();
  assert.equal(res.status, 200, JSON.stringify(data));
  return data.photo;
}

const chooser = (page) => page.getByLabel('Choose photos to add');

before(async () => {
  app = await startApp();
});
after(() => app?.stop());

describe('uploading', () => {
  test('past trips open on Photos; upcoming trips on the itinerary', async () => {
    await resetPhotos();
    const past = await openTrip(app, { id: 'oldtown' });
    assert.equal(await past.page.getByRole('tab', { name: /Photos/ }).getAttribute('aria-selected'), 'true');
    await past.context.close();
    const upcoming = await openTrip(app, { id: 'testville' });
    assert.equal(await upcoming.page.getByRole('tab', { name: /Itinerary/ }).getAttribute('aria-selected'), 'true');
    await upcoming.context.close();
  });

  test('a member adds photos and they land on the day they were taken', async () => {
    await resetPhotos();
    const { page, context, errors } = await openTrip(app, { id: 'oldtown' });
    await page.getByText('No photos yet.').waitFor();
    await chooser(page).setInputFiles([
      await photo('first-day.jpg', { offset: -40 }),
      await photo('second-day.jpg', { offset: -39, color: '#36c' }),
      await photo('long-ago.jpg', { offset: -400 }),
    ]);
    await waitForToast(page, /3 photos added/);

    const day1 = page.getByRole('region', { name: /Day 1/ });
    const day2 = page.getByRole('region', { name: /Day 2/ });
    const other = page.getByRole('region', { name: 'Other photos' });
    assert.equal(await day1.getByRole('button').count(), 1);
    assert.equal(await day2.getByRole('button').count(), 1);
    assert.equal(await other.getByRole('button').count(), 1);
    // Thumbnails really load from the photo route.
    const loaded = await page.locator('img[src^="/api/photos/"]').evaluateAll((imgs) => imgs.every((i) => i.complete && i.naturalWidth > 0));
    assert.ok(loaded, 'thumbnails loaded');
    assert.deepEqual(errors, []);

    await page.reload();
    await page.locator('[data-hydrated]').waitFor({ state: 'attached' });
    assert.equal(await page.locator('img[src^="/api/photos/"]').count(), 3, 'saved, not just shown');
    await context.close();
  });

  test('a photo the server refuses is listed with the reason and can be dismissed', async () => {
    await resetPhotos();
    const { page, context } = await openTrip(app, { id: 'oldtown' });
    await chooser(page).setInputFiles([{ name: 'IMG_0001.HEIC', mimeType: 'image/heic', buffer: fakeHeic() }]);
    // (Next's route announcer is also role=alert, so pick ours by its text.)
    const alert = page.getByRole('alert').filter({ hasText: 'didn’t upload' });
    await alert.waitFor();
    assert.match(await alert.innerText(), /IMG_0001\.HEIC/);
    assert.match(await alert.innerText(), /HEIC/);
    await alert.getByRole('button', { name: 'Dismiss' }).click();
    await alert.waitFor({ state: 'detached' });
    assert.equal(await app.prisma.photo.count(), 0);
    await context.close();
  });

  test('viewers see photos but cannot add, edit or delete them', async () => {
    await resetPhotos();
    await uploadVia('member', { caption: 'Harbour' });
    const { page, context } = await openTrip(app, { id: 'oldtown', as: 'viewer' });
    assert.equal(await page.getByRole('button', { name: /Add photos/ }).count(), 0);
    await page.getByRole('button', { name: 'Harbour' }).click();
    const viewer = page.getByRole('dialog', { name: 'Photo 1 of 1' });
    await viewer.waitFor();
    assert.equal(await viewer.getByRole('link', { name: 'Download' }).count(), 1);
    assert.equal(await viewer.getByRole('button', { name: /Edit caption|Delete|cover/ }).count(), 0);
    await context.close();
  });
});

describe('the photo viewer', () => {
  test('arrow keys move between photos; the uploader captions and deletes', async () => {
    await resetPhotos();
    await uploadVia('member', { offset: -40 });
    await uploadVia('member', { offset: -39 });
    const { page, context } = await openTrip(app, { id: 'oldtown' });
    await page.getByRole('button', { name: /Photo 1 from Day 1/ }).click();
    await page.getByRole('dialog', { name: 'Photo 1 of 2' }).waitFor();
    await page.keyboard.press('ArrowRight');
    const second = page.getByRole('dialog', { name: 'Photo 2 of 2' });
    await second.waitFor();

    await second.getByRole('button', { name: 'Edit caption & day' }).click();
    await second.getByLabel('Caption').fill('Lighthouse at noon');
    await second.getByLabel('Day').selectOption({ label: 'Day 1: Arrival' });
    await second.getByRole('button', { name: 'Save', exact: true }).click();
    await waitForToast(page, /Photo updated/);
    await second.getByText('Lighthouse at noon').waitFor();

    await page.keyboard.press('Escape');
    await second.waitFor({ state: 'hidden' });
    // Moved to Day 1, so Day 2 has no photos left and drops out.
    assert.equal(await page.getByRole('region', { name: /Day 1/ }).getByRole('button').count(), 2);
    assert.equal(await page.getByRole('region', { name: /Day 2/ }).count(), 0);

    await page.getByRole('button', { name: 'Lighthouse at noon' }).click();
    await page.getByRole('dialog', { name: /Photo \d of 2/ }).getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Delete photo' }).click();
    await waitForToast(page, /Photo deleted/);
    await page.getByRole('dialog', { name: 'Photo 1 of 1' }).waitFor();
    assert.equal(await app.prisma.photo.count(), 1);
    await context.close();
  });

  test('members cannot change someone else’s photo', async () => {
    await resetPhotos();
    await uploadVia('admin', { caption: 'Admin shot' });
    const { page, context } = await openTrip(app, { id: 'oldtown', as: 'member' });
    await page.getByRole('button', { name: 'Admin shot' }).click();
    const viewer = page.getByRole('dialog', { name: 'Photo 1 of 1' });
    await viewer.waitFor();
    assert.equal(await viewer.getByRole('button', { name: /Edit caption|Delete/ }).count(), 0);
    await context.close();
  });

  test('an admin in Edit mode picks the cover, which shows on the trip and the dashboard', async () => {
    await resetPhotos();
    await uploadVia('member', { caption: 'Sunset pier' });
    const { page, context } = await openTrip(app, { id: 'oldtown', admin: true, tab: 'photos' });
    await page.getByRole('button', { name: 'Sunset pier' }).click();
    await page.getByRole('button', { name: 'Make trip cover' }).click();
    await waitForToast(page, /trip cover/i);
    await page.getByRole('button', { name: 'Trip cover ✓' }).waitFor();
    await page.keyboard.press('Escape');

    await page.reload();
    await page.locator('header.hero img.hero-cover[alt="Sunset pier"]').waitFor();
    await page.goto(app.baseURL);
    await page.locator('[data-trip="oldtown"] img.trip-card-cover').waitFor();
    await context.close();
  });
});

describe('story and share links', () => {
  test('the story page shows each day’s plans and photos', async () => {
    await resetPhotos();
    await uploadVia('member', { caption: 'Museum steps' });
    const context = await newContext(app, { as: 'viewer' });
    const page = await context.newPage();
    await page.goto(`${app.baseURL}/trips/oldtown/story`);
    await page.getByRole('heading', { level: 1, name: 'Oldtown Memories' }).waitFor();
    await page.getByRole('heading', { name: /Day 1: Arrival/ }).waitFor();
    await page.getByText('Museum visit').waitFor();
    await page.getByRole('img', { name: 'Museum steps' }).first().waitFor();
    assert.ok(await page.getByText('1 photo').isVisible());
    assert.ok(await page.getByRole('button', { name: /Print/ }).isVisible());
    // Never the private parts of the trip.
    assert.equal(await page.getByText('AA 123').count(), 0, 'logistics');
    assert.equal(await page.getByText('Sunscreen').count(), 0, 'checklist');
    await context.close();
  });

  test('an admin shares the story; anyone with the link sees it until it is turned off', async () => {
    await resetPhotos();
    const shot = await uploadVia('member', { caption: 'Shared shot' });
    const admin = await newContext(app, { as: 'admin', permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await admin.newPage();
    await page.goto(`${app.baseURL}/trips/oldtown/edit`);
    await page.locator('[data-hydrated]').waitFor({ state: 'attached' });
    await page.getByText('Sharing is off').waitFor();
    await page.getByRole('button', { name: 'Make a share link' }).click();
    const url = await page.getByLabel(/Share link/).inputValue();
    assert.match(url, new RegExp(`^${app.baseURL}/share/[A-Za-z0-9_-]{43}$`));
    await page.getByText('Sharing is on').waitFor();

    const stranger = await app.browser.newContext();
    const shared = await stranger.newPage();
    const res = await shared.goto(url);
    assert.equal(res.status(), 200);
    await shared.getByRole('heading', { level: 1, name: 'Oldtown Memories' }).waitFor();
    await shared.getByRole('img', { name: 'Shared shot' }).first().waitFor();
    assert.equal(await shared.locator('meta[name="robots"]').getAttribute('content'), 'noindex, nofollow');
    const token = url.split('/share/')[1];
    assert.equal((await fetch(`${app.apiURL}/api/share/${token}/${shot.id}/lg`)).status, 200);
    assert.equal((await fetch(`${app.apiURL}/api/share/${token}/${shot.id}/orig`)).status, 404, 'no originals');
    assert.equal((await fetch(`${app.apiURL}/api/photos/${shot.id}/lg`)).status, 401, 'the private route still needs sign-in');

    await page.getByRole('button', { name: 'Turn off' }).click();
    await page.getByText('Sharing is off').waitFor();
    assert.equal((await shared.goto(url)).status(), 404);
    assert.equal((await fetch(`${app.apiURL}/api/share/${token}/${shot.id}/lg`)).status, 404);
    await stranger.close();
    await admin.close();
  });
});

describe('HTTP access', () => {
  test('photo files need a session; uploads need a member', async () => {
    await resetPhotos();
    const shot = await uploadVia('member');
    assert.equal((await fetch(`${app.apiURL}/api/photos/${shot.id}/sm`)).status, 401);
    const viewer = await sessionCookieHeader(app, 'viewer');
    const file = await fetch(`${app.apiURL}/api/photos/${shot.id}/sm`, { headers: { Cookie: viewer } });
    assert.equal(file.status, 200);
    assert.equal(file.headers.get('content-type'), 'image/webp');
    assert.match(file.headers.get('cache-control'), /private/);
    assert.equal(file.headers.get('x-content-type-options'), 'nosniff');
    const original = await fetch(`${app.apiURL}/api/photos/${shot.id}/orig?download=1`, { headers: { Cookie: viewer } });
    assert.match(original.headers.get('content-disposition'), /attachment/);

    const denied = await fetch(`${app.apiURL}/api/photos?tripId=oldtown`, {
      method: 'POST',
      headers: { Cookie: viewer, 'Content-Type': 'image/jpeg', Origin: app.baseURL },
      body: await cameraJpeg(),
    });
    assert.equal(denied.status, 403);
  });

  test('uploads from another site are blocked', async () => {
    const res = await fetch(`${app.apiURL}/api/photos?tripId=oldtown`, {
      method: 'POST',
      headers: { Cookie: await sessionCookieHeader(app, 'member'), 'Content-Type': 'image/jpeg', Origin: 'https://evil.example' },
      body: await cameraJpeg(),
    });
    assert.equal(res.status, 403);
  });

  test('a declared body over the limit is refused without reading it', async () => {
    const res = await fetch(`${app.apiURL}/api/photos?tripId=oldtown`, {
      method: 'POST',
      headers: { Cookie: await sessionCookieHeader(app, 'member'), 'Content-Type': 'image/jpeg', Origin: app.baseURL },
      body: new Uint8Array(26 * 1024 * 1024),
    });
    assert.equal(res.status, 413);
  });

  test('story pages need a session; unknown share links are 404', async () => {
    const res = await fetch(`${app.apiURL}/trips/oldtown/story`, { redirect: 'manual' });
    assert.equal(res.status, 307);
    assert.equal((await fetch(`${app.apiURL}/share/${'x'.repeat(43)}`)).status, 404);
    assert.equal((await fetch(`${app.apiURL}/trips/nowhere/story`, { headers: { Cookie: await sessionCookieHeader(app, 'viewer') } })).status, 404);
  });
});

describe('layout and accessibility', () => {
  test('the Photos tab fits a phone screen', async () => {
    await resetPhotos();
    await uploadVia('member', { caption: 'Phone check' });
    const { page, context } = await openTrip(app, { id: 'oldtown', viewport: { width: 375, height: 812 } });
    assert.ok(await fitsWidth(page));
    await page.getByRole('button', { name: 'Phone check' }).click();
    await page.getByRole('dialog', { name: 'Photo 1 of 1' }).waitFor();
    assert.ok(await fitsWidth(page));
    await context.close();
  });

  for (const colorScheme of ['light', 'dark']) {
    test(`photos, viewer, story and share pages have no violations (${colorScheme})`, async () => {
      await resetPhotos();
      await uploadVia('member', { caption: 'Axe photo', offset: -40 });
      await uploadVia('member', { offset: -400 });
      const cover = await app.prisma.photo.findFirst({ where: { caption: 'Axe photo' } });
      await app.prisma.photo.update({ where: { id: cover.id }, data: { isCover: true } });

      const { page, context } = await openTrip(app, { id: 'oldtown', admin: true, tab: 'photos', contextOptions: { colorScheme } });
      assert.deepEqual(await axeViolations(page), [], 'photos tab');
      await page.getByRole('button', { name: 'Axe photo' }).click();
      await page.getByRole('dialog', { name: /Photo 1 of 2/ }).waitFor();
      assert.deepEqual(await axeViolations(page), [], 'viewer');
      await page.getByRole('button', { name: 'Edit caption & day' }).click();
      assert.deepEqual(await axeViolations(page), [], 'viewer edit form');
      await page.keyboard.press('Escape');

      await page.goto(`${app.baseURL}/trips/oldtown/story`);
      await page.waitForLoadState('networkidle');
      assert.deepEqual(await axeViolations(page), [], 'story');

      await page.goto(`${app.baseURL}/trips/oldtown/edit`);
      await page.locator('[data-hydrated]').waitFor({ state: 'attached' });
      await page.getByRole('button', { name: 'Make a share link' }).click();
      const url = await page.getByLabel(/Share link/).inputValue();
      assert.deepEqual(await axeViolations(page), [], 'settings with share link');

      const stranger = await app.browser.newContext({ colorScheme });
      const shared = await stranger.newPage();
      await shared.goto(url);
      await shared.waitForLoadState('networkidle');
      assert.deepEqual(await axeViolations(shared), [], 'shared story');
      await stranger.close();
      await context.close();
    });
  }
});
