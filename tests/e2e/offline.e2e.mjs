// Offline app end to end: installability, the service worker's saved pages,
// "Save for offline", ticks made without a connection, and keeping one
// person's offline data away from the next.
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, newContext, signInContext } from './support/server.mjs';
import { openTrip, waitForToast } from './support/trip-page.mjs';
import { axeViolations } from './support/axe.mjs';
import { daysFromToday, seedTrip } from '../support/fixtures.mjs';

let app;

before(async () => {
  app = await startApp();
});
after(() => app?.stop());

// --- In-page helpers -------------------------------------------------------------

/** Waits until the service worker controls the page. */
const workerReady = (page) =>
  page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (navigator.serviceWorker.controller) return true;
    await new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
    return true;
  });

/** Paths of the pages saved in the offline cache. */
const savedPages = (page) =>
  page.evaluate(async () => {
    if (!(await caches.has('travel-pages-v1'))) return [];
    const keys = await (await caches.open('travel-pages-v1')).keys();
    return keys.map((r) => new URL(r.url).pathname).sort();
  });

/** Polls until `path` is in the saved pages (saving happens in the background). */
async function waitForSaved(page, path) {
  for (let i = 0; i < 100; i++) {
    if ((await savedPages(page)).includes(path)) return;
    await page.waitForTimeout(100);
  }
  assert.fail(`${path} was never saved; saved: ${await savedPages(page)}`);
}

const savedIndex = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('travel-offline-trips') || '{}'));

const outboxOps = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve) => {
        const open = indexedDB.open('travel-offline', 1);
        open.onupgradeneeded = () => open.result.createObjectStore('outbox', { keyPath: 'key' });
        open.onsuccess = () => {
          const req = open.result.transaction('outbox').objectStore('outbox').getAll();
          req.onsuccess = () => {
            open.result.close();
            resolve(req.result);
          };
        };
      })
  );

const strip = (page) => page.locator('[role="status"]:not([aria-live])');

const sunscreen = () => app.prisma.checklistItem.findFirst({ where: { tripId: 'testville', text: 'Sunscreen' } });
const resetSunscreen = async () => app.prisma.checklistItem.updateMany({ where: { tripId: 'testville', text: 'Sunscreen' }, data: { isCompleted: false } });

async function until(check, message) {
  for (let i = 0; i < 100; i++) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.fail(message);
}

/** A trip page opened online, with the worker running and the page saved. */
async function savedTrip(options = {}) {
  const opened = await openTrip(app, options);
  await workerReady(opened.page);
  await waitForSaved(opened.page, `/trips/${options.id ?? 'testville'}`);
  return opened;
}

// --- Installing ------------------------------------------------------------------

describe('installing the app', () => {
  test('the manifest and its icons load without signing in', async () => {
    const res = await fetch(`${app.apiURL}/manifest.webmanifest`, { redirect: 'manual' });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /manifest\+json/);
    const manifest = await res.json();
    assert.equal(manifest.name, 'Family Travel Adventures');
    assert.equal(manifest.display, 'standalone');
    for (const icon of manifest.icons) {
      const img = await fetch(`${app.apiURL}${icon.src}`, { redirect: 'manual' });
      assert.equal(img.status, 200, icon.src);
      assert.equal(img.headers.get('content-type'), 'image/png', icon.src);
    }
    for (const file of ['/apple-icon.png', '/icon.svg']) {
      assert.equal((await fetch(`${app.apiURL}${file}`, { redirect: 'manual' })).status, 200, file);
    }
  });

  test('the service worker is public and never cached', async () => {
    for (const file of ['/sw.js', '/sw-core.js']) {
      const res = await fetch(`${app.apiURL}${file}`, { redirect: 'manual' });
      assert.equal(res.status, 200, file);
      assert.match(res.headers.get('content-type'), /javascript/, file);
      assert.match(res.headers.get('cache-control'), /no-store/, file);
    }
  });

  test('pages link the manifest and home-screen icon, and send the security headers', async () => {
    const res = await fetch(`${app.apiURL}/login`);
    const html = await res.text();
    assert.match(html, /<link rel="manifest" href="\/manifest\.webmanifest"/);
    assert.match(html, /<link rel="apple-touch-icon" href="\/apple-icon\.png/);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  });

  test('the offline page is public and holds nobody’s data', async () => {
    const res = await fetch(`${app.apiURL}/offline`, { redirect: 'manual' });
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /You’re offline/);
    assert.doesNotMatch(html, /Ferrin/, 'no signed-in user rendered');
  });
});

// --- Saved pages -----------------------------------------------------------------

describe('using the app offline', () => {
  test('a trip opened once still opens with no connection, on the tab in the address', async () => {
    const { page, context } = await savedTrip();
    await context.setOffline(true);
    await page.goto(`${app.baseURL}/trips/testville?tab=checklist`);
    await page.locator('[data-hydrated]').waitFor({ state: 'attached' });
    assert.equal(await page.getByRole('heading', { level: 1, name: 'Testville Getaway' }).count(), 1);
    assert.equal(await page.getByRole('tab', { name: /Packing/ }).getAttribute('aria-selected'), 'true');
    await strip(page).getByText(/You’re offline\./).waitFor();
    await context.close();
  });

  test('a page that isn’t saved shows the offline page listing the saved trips', async () => {
    const { page, context } = await savedTrip({ id: 'oldtown' });
    await page.getByRole('button', { name: /Save for offline/ }).click();
    await waitForToast(page, /Saved for offline/);
    await context.setOffline(true);
    await page.goto(`${app.baseURL}/account`);
    await page.getByRole('heading', { name: 'You’re offline' }).waitFor();
    assert.equal(await page.getByRole('link', { name: /Oldtown Memories/ }).count(), 1);
    assert.equal(await strip(page).locator('p').count(), 0, 'the page explains itself; no strip repeating it');
    await page.getByRole('link', { name: /Oldtown Memories/ }).click();
    await page.getByRole('heading', { level: 1, name: 'Oldtown Memories' }).waitFor();
    await context.close();
  });

  test('“Save for offline” keeps the trip page (no photos) and says when', async () => {
    const { page, context } = await openTrip(app, { id: 'oldtown' });
    await workerReady(page);
    await page.getByRole('button', { name: /Save for offline/ }).click();
    await waitForToast(page, /Saved for offline/);
    await page.getByText(/Available offline · saved/).waitFor();
    assert.equal(await page.getByRole('button', { name: /Update offline copy/ }).count(), 1);
    assert.deepEqual(Object.keys(await savedIndex(page)), ['oldtown']);
    const pages = await savedPages(page);
    assert.deepEqual(pages, ['/trips/oldtown']);
    const cacheNames = await page.evaluate(() => caches.keys());
    assert.ok(!cacheNames.some((n) => n.includes('photo')), cacheNames.join());

    await context.setOffline(true);
    await page.reload();
    await page.getByRole('heading', { level: 1, name: 'Oldtown Memories' }).waitFor();
    // Photos aren't kept: offline they come back as a blank stand-in, not a broken image.
    const photo = await page.evaluate(async () => {
      const response = await fetch('/api/photos/1/sm');
      return { status: response.status, type: response.headers.get('content-type') };
    });
    assert.deepEqual(photo, { status: 200, type: 'image/svg+xml' });
    await page.goto(`${app.baseURL}/trips/oldtown/story`);
    await page.getByRole('heading', { name: 'You’re offline' }).waitFor();
    await context.close();
  });

  test('trips starting soon are saved from the dashboard without asking', async () => {
    await seedTrip(app.prisma, { id: 'soonville', name: 'Soonville Weekend', startDate: daysFromToday(5), endDate: daysFromToday(6) });
    try {
      const context = await newContext(app);
      const page = await context.newPage();
      await page.goto(`${app.baseURL}/`);
      await workerReady(page);
      await until(async () => 'soonville' in (await savedIndex(page)), 'soonville was not saved automatically');
      assert.ok(!('oldtown' in (await savedIndex(page))), 'past trips are not saved automatically');

      await context.setOffline(true);
      await page.goto(`${app.baseURL}/trips/soonville`);
      await page.getByRole('heading', { level: 1, name: 'Soonville Weekend' }).waitFor();
      await context.close();
    } finally {
      await app.prisma.trip.delete({ where: { id: 'soonville' } });
    }
  });

  test('the offline page and the offline strip pass axe in both themes', async () => {
    for (const colorScheme of ['light', 'dark']) {
      const { page, context } = await savedTrip({ tab: 'checklist', contextOptions: { colorScheme } });
      await context.setOffline(true);
      await page.reload();
      await strip(page).getByText(/You’re offline/).waitFor();
      assert.deepEqual(await axeViolations(page), [], `trip page offline (${colorScheme})`);
      await page.goto(`${app.baseURL}/admin/users`);
      await page.getByRole('heading', { name: 'You’re offline' }).waitFor();
      assert.deepEqual(await axeViolations(page), [], `offline page (${colorScheme})`);
      await context.close();
    }
  });
});

// --- Ticks without a connection --------------------------------------------------

describe('ticking items offline', () => {
  test('a tick made offline is kept through a reload and syncs when back online', async () => {
    await resetSunscreen();
    const { page, context } = await savedTrip({ tab: 'checklist' });
    await context.setOffline(true);
    await page.getByRole('checkbox', { name: 'Sunscreen' }).check();
    await strip(page).getByText(/1 change will sync when you’re back online/).waitFor();

    await page.reload();
    await page.locator('[data-hydrated]').waitFor({ state: 'attached' });
    await until(() => page.getByRole('checkbox', { name: 'Sunscreen' }).isChecked(), 'waiting tick not shown after reload');
    assert.equal((await sunscreen()).isCompleted, false, 'not sent yet');

    await context.setOffline(false);
    await until(async () => (await sunscreen()).isCompleted, 'tick never synced');
    await until(async () => (await outboxOps(page)).length === 0, 'outbox not emptied');
    await strip(page).getByText(/change/).waitFor({ state: 'detached' });
    await context.close();
    await resetSunscreen();
  });

  test('a network failure while online keeps the tick and “Sync now” sends it', async () => {
    await resetSunscreen();
    const { page, context } = await openTrip(app, { tab: 'checklist' });
    await page.route('**/api/checklist', (route) => route.abort());
    const box = page.getByRole('checkbox', { name: 'Sunscreen' });
    await box.click();
    await strip(page).getByText(/1 change waiting to sync/).waitFor();
    assert.equal(await box.isChecked(), true, 'not rolled back');
    await page.unroute('**/api/checklist');
    await strip(page).getByRole('button', { name: 'Sync now' }).click();
    await until(async () => (await sunscreen()).isCompleted, 'tick never synced');
    await context.close();
    await resetSunscreen();
  });

  test('a tick the server refuses is rolled back with the reason', async () => {
    const { page, context } = await openTrip(app, { tab: 'meals' });
    await page.route('**/api/grocery', (route) =>
      route.fulfill({ status: 403, contentType: 'application/json', body: '{"success":false,"message":"Not allowed"}' })
    );
    const box = page.getByRole('checkbox', { name: 'Milk' });
    await box.click();
    await page.getByText(/Couldn.t update “Milk”: Not allowed/).waitFor();
    assert.equal(await box.isChecked(), false);
    assert.deepEqual(await outboxOps(page), []);
    await context.close();
  });
});

// --- Whose data -------------------------------------------------------------------

describe('signing out and switching people', () => {
  test('signing out with unsynced ticks asks first, then removes offline copies', async () => {
    await resetSunscreen();
    const { page, context } = await savedTrip({ tab: 'checklist' });
    await page.route('**/api/checklist', (route) => route.abort());
    await page.getByRole('checkbox', { name: 'Sunscreen' }).click();
    await strip(page).getByText(/1 change waiting to sync/).waitFor();

    const signOut = async () => {
      await page.getByText('Member Ferrin').click();
      await page.getByRole('button', { name: 'Sign out' }).click();
    };
    await signOut();
    const dialog = page.getByRole('dialog', { name: 'Sign out without syncing?' });
    await dialog.waitFor();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    assert.equal(page.url().endsWith('/login'), false, 'cancel stays signed in');

    await signOut();
    await page.getByRole('dialog', { name: 'Sign out without syncing?' }).getByRole('button', { name: 'Sign out anyway' }).click();
    await page.waitForURL(/\/login/);
    assert.deepEqual(await savedPages(page), []);
    assert.deepEqual(await outboxOps(page), []);
    assert.deepEqual(await savedIndex(page), {});
    assert.equal((await sunscreen()).isCompleted, false);
    await context.close();
  });

  test('someone else signing in on the device never sends the previous person’s ticks', async () => {
    await resetSunscreen();
    const { page, context } = await savedTrip({ tab: 'checklist' });
    await context.setOffline(true);
    await page.getByRole('checkbox', { name: 'Sunscreen' }).check();
    await until(async () => (await outboxOps(page)).length === 1, 'tick not queued');

    // Their session ends without signing out; an admin signs in on the same device.
    await context.clearCookies();
    await signInContext(app, context, 'admin');
    await context.setOffline(false);
    await page.goto(`${app.baseURL}/account`);
    await until(async () => (await outboxOps(page)).length === 0, 'previous person’s tick kept');
    assert.ok(!(await savedPages(page)).includes('/trips/testville'), 'previous person’s pages kept');
    assert.equal((await sunscreen()).isCompleted, false, 'sent as the wrong person');
    await context.close();
  });
});
