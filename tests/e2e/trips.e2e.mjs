// Planning trips in the browser: the new-trip form, trip settings (dates,
// archive, delete), renaming days, who can do it, and accessibility.
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { newContext, sessionCookieHeader, startApp } from './support/server.mjs';
import { openTrip, toastText } from './support/trip-page.mjs';
import { axeViolations } from './support/axe.mjs';

let app;

before(async () => {
  app = await startApp();
});
after(() => app?.stop());

async function openForm(path, { as = 'admin', colorScheme } = {}) {
  const context = await newContext(app, { as, colorScheme, viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err));
  await page.goto(`${app.baseURL}${path}`);
  // The trip form marks itself hydrated; the dashboard is server-rendered.
  if (path === '/') await page.waitForLoadState('networkidle');
  else await page.locator('[data-hydrated]').waitFor({ state: 'attached' });
  return { page, context, errors };
}

async function fillTrip(page, { name, tag = 'Beach', travelers = 'Family of 6', start, end }) {
  await page.getByLabel('Trip name').fill(name);
  await page.getByLabel('Trip type').fill(tag);
  await page.getByLabel("Who's going").fill(travelers);
  if (start) await page.getByLabel('First day').fill(start);
  if (end) await page.getByLabel('Last day').fill(end);
}

const loadTrip = (id) =>
  app.prisma.trip.findUnique({
    where: { id },
    include: { days: { orderBy: { dayNumber: 'asc' } }, checklist: true },
  });

describe('planning a new trip', () => {
  test('an admin fills in the form and lands on the new trip, one day per date', async () => {
    const { page, context, errors } = await openForm('/trips/new');
    await fillTrip(page, { name: 'Lake Week', start: '2030-07-01', end: '2030-07-04' });

    const preview = page.getByRole('complementary', { name: 'Preview' });
    await preview.getByText('July 1 – 4, 2030').waitFor();
    assert.equal(await page.getByLabel('Web address').inputValue(), 'lake-week');
    await page.getByText('4 days: July 1 – 4, 2030.').waitFor();

    await page.getByRole('button', { name: 'Create trip' }).click();
    await page.waitForURL(`${app.baseURL}/trips/lake-week`);
    await page.getByRole('heading', { level: 1, name: 'Lake Week' }).waitFor();
    assert.match(await toastText(page), /Lake Week is ready to plan/);
    assert.equal(await page.locator('section.itinerary-day').count(), 4);
    await page.getByRole('region', { name: 'Day 1: Monday, July 1' }).waitFor();

    const saved = await loadTrip('lake-week');
    assert.equal(saved.tag, 'Beach');
    assert.ok(saved.checklist.length > 0, 'starter checklist');
    assert.deepEqual(errors, []);
    await context.close();
  });

  test('the dashboard shows it, with a "Plan a trip" button for admins only', async () => {
    const { page, context } = await openForm('/');
    await page.getByRole('link', { name: 'Plan a trip' }).waitFor();
    await page.getByRole('heading', { name: 'Lake Week' }).waitFor();
    await context.close();

    for (const role of ['member', 'viewer']) {
      const other = await openForm('/', { as: role });
      assert.equal(await other.page.getByRole('link', { name: 'Plan a trip' }).count(), 0, role);
      await other.context.close();
    }
  });

  test('mistakes are shown next to the fields before anything is sent', async () => {
    const { page, context } = await openForm('/trips/new');
    let posted = false;
    page.on('request', (r) => {
      if (r.url().endsWith('/api/trips') && r.method() === 'POST') posted = true;
    });
    await page.getByLabel('First day').fill('2030-07-10');
    await page.getByLabel('Last day').fill('2030-07-01');
    await page.getByRole('button', { name: 'Create trip' }).click();

    await page.getByText('Trip name is required.').waitFor();
    await page.getByText('The end date must be on or after the start date.').waitFor();
    assert.equal(await page.getByLabel('Trip name').getAttribute('aria-invalid'), 'true');
    assert.equal(await page.evaluate(() => document.activeElement.labels?.[0]?.textContent), 'Trip name', 'focus moves to the first problem');
    assert.equal(posted, false);

    await page.getByLabel('Trip name').fill('Fixed');
    assert.equal(await page.getByText('Trip name is required.').count(), 0, 'error clears when the field changes');
    await context.close();
  });

  test('a web address that is already used comes back as a field error', async () => {
    const { page, context } = await openForm('/trips/new');
    await fillTrip(page, { name: 'Another Testville', start: '2030-08-01', end: '2030-08-02' });
    await page.getByLabel('Web address').fill('testville');
    await page.getByRole('button', { name: 'Create trip' }).click();
    await page.getByText(/Another trip already uses \/trips\/testville/).first().waitFor();
    assert.equal(await page.getByLabel('Web address').getAttribute('aria-invalid'), 'true');
    assert.equal(await app.prisma.trip.count({ where: { name: 'Another Testville' } }), 0);
    await context.close();
  });

  test('the checklist can be copied from another trip', async () => {
    const { page, context } = await openForm('/trips/new');
    await fillTrip(page, { name: 'Copy Cat', start: '2030-09-01', end: '2030-09-01' });
    await page.getByRole('radio', { name: /Copy from another trip/ }).check();
    await page.getByLabel('Copy from', { exact: true }).selectOption('testville');
    await page.getByRole('button', { name: 'Create trip' }).click();
    await page.waitForURL(`${app.baseURL}/trips/copy-cat`);
    const copied = (await loadTrip('copy-cat')).checklist.map((i) => i.text).sort();
    const source = (await loadTrip('testville')).checklist.map((i) => i.text).sort();
    assert.deepEqual(copied, source);
    await context.close();
  });
});

describe('trip settings', () => {
  test('admins reach settings from the trip page; others do not see the link', async () => {
    const { page, context } = await openTrip(app, { as: 'admin' });
    await page.getByRole('link', { name: 'Trip settings' }).click();
    await page.waitForURL(`${app.baseURL}/trips/testville/edit`);
    await page.getByRole('heading', { level: 1, name: 'Trip settings' }).waitFor();
    await context.close();

    const member = await openTrip(app, { as: 'member' });
    assert.equal(await member.page.getByRole('link', { name: 'Trip settings' }).count(), 0);
    await member.context.close();
  });

  test('saving new details and longer dates adds days at the end', async () => {
    await app.prisma.trip.create({
      data: {
        id: 'stretchy', name: 'Stretchy', dates: 'x', travelers: 'Us', status: 'upcoming', tag: 'City',
        startDate: new Date('2030-05-01T00:00:00Z'), endDate: new Date('2030-05-02T00:00:00Z'),
        days: { create: [{ dayNumber: 1, dateLabel: 'Day 1: Wednesday, May 1' }, { dayNumber: 2, dateLabel: 'Day 2: Thursday, May 2' }] },
      },
    });
    const { page, context } = await openForm('/trips/stretchy/edit');
    assert.equal(await page.getByLabel('Web address').count(), 0, 'the address is fixed after creation');
    await page.getByLabel('Trip name').fill('Stretchy Deluxe');
    await page.getByLabel('Last day').fill('2030-05-04');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.waitForURL(`${app.baseURL}/trips/stretchy`);
    await page.getByRole('heading', { level: 1, name: 'Stretchy Deluxe' }).waitFor();
    assert.match(await toastText(page), /Added 2 days/);
    assert.equal(await page.locator('section.itinerary-day').count(), 4);
    assert.equal((await loadTrip('stretchy')).dates, 'May 1 – 4, 2030');
    await context.close();
  });

  test('shortening past a day with plans is refused with the reason, and nothing changes', async () => {
    const { page, context } = await openForm('/trips/testville/edit');
    const start = await page.getByLabel('First day').inputValue();
    await page.getByLabel('Trip name').fill('Should not save');
    await page.getByLabel('Last day').fill(start);
    // Day 2 gets a plan behind the form's back.
    const day2 = (await loadTrip('testville')).days[1];
    await app.prisma.itineraryActivity.create({ data: { dayId: day2.id, description: 'Surprise' } });

    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.locator('.form-error', { hasText: /Day 2: Exploring still has plans/ }).waitFor();
    assert.equal(await page.getByLabel('Last day').getAttribute('aria-invalid'), 'true');
    const after = await loadTrip('testville');
    assert.equal(after.name, 'Testville Getaway');
    assert.equal(after.days.length, 2);
    await app.prisma.itineraryActivity.deleteMany({ where: { description: 'Surprise' } });
    await context.close();
  });

  test('archive moves the trip to the Archived section; restore brings it back', async () => {
    await app.prisma.trip.create({
      data: { id: 'shelf', name: 'Shelf Trip', dates: 'x', travelers: 'Us', status: 'upcoming', tag: 'City',
        startDate: new Date('2030-06-01T00:00:00Z'), endDate: new Date('2030-06-01T00:00:00Z') },
    });
    const { page, context } = await openForm('/trips/shelf/edit');
    await page.getByRole('button', { name: 'Archive trip' }).click();
    await page.getByRole('button', { name: 'Restore trip' }).waitFor();
    assert.ok((await loadTrip('shelf')).archivedAt);

    await page.goto(`${app.baseURL}/`);
    const upcoming = page.getByRole('region', { name: /Upcoming Trips/ });
    assert.equal(await upcoming.getByRole('heading', { name: 'Shelf Trip' }).count(), 0);
    const archived = page.getByRole('region', { name: /Archived/ });
    assert.equal(await archived.getByRole('heading', { name: 'Shelf Trip' }).isVisible(), false, 'collapsed by default');
    await archived.locator('summary').click();
    await archived.getByRole('heading', { name: 'Shelf Trip' }).waitFor();

    await page.goto(`${app.baseURL}/trips/shelf`);
    await page.getByText(/This trip is archived/).waitFor();
    await page.getByRole('link', { name: 'Restore it' }).click();
    await page.getByRole('button', { name: 'Restore trip' }).click();
    await page.getByRole('button', { name: 'Archive trip' }).waitFor();
    assert.equal((await loadTrip('shelf')).archivedAt, null);
    await context.close();
  });

  test('delete needs the trip name typed, then removes it', async () => {
    await app.prisma.trip.create({
      data: { id: 'doomed', name: 'Doomed Trip', dates: 'x', travelers: 'Us', status: 'upcoming', tag: 'City',
        startDate: new Date('2030-06-01T00:00:00Z'), endDate: new Date('2030-06-01T00:00:00Z') },
    });
    const { page, context } = await openForm('/trips/doomed/edit');
    await page.getByRole('button', { name: 'Delete trip…' }).click();
    const dialog = page.getByRole('dialog', { name: 'Delete Doomed Trip?' });
    const confirm = dialog.getByRole('button', { name: 'Delete forever' });
    assert.equal(await confirm.isDisabled(), true);
    await dialog.getByLabel('Trip name').fill('doomed trip');
    assert.equal(await confirm.isDisabled(), true, 'must match exactly');
    await dialog.getByLabel('Trip name').fill('Doomed Trip');
    await confirm.click();
    await page.waitForURL(`${app.baseURL}/`);
    assert.match(await toastText(page), /Doomed Trip was deleted/);
    assert.equal(await loadTrip('doomed'), null);
    await context.close();
  });
});

describe('days', () => {
  test('admins rename a day in edit mode', async () => {
    const { page, context } = await openTrip(app, { admin: true });
    await page.getByRole('button', { name: 'Rename Day 2: Exploring' }).click();
    await page.getByLabel('Title for Day 2: Exploring').fill('Beach day');
    await page.getByRole('button', { name: 'Save title' }).click();
    await page.getByRole('region', { name: 'Day 2: Exploring' }).getByText('— Beach day').waitFor();
    assert.equal((await loadTrip('testville')).days[1].title, 'Beach day');
    await context.close();
  });

  test('no rename button outside edit mode', async () => {
    const { page, context } = await openTrip(app, { as: 'admin' });
    assert.equal(await page.getByRole('button', { name: /^Rename / }).count(), 0);
    await context.close();
  });
});

describe('who can open the pages', () => {
  const get = async (path, role) =>
    fetch(`${app.apiURL}${path}`, { redirect: 'manual', headers: role ? { cookie: await sessionCookieHeader(app, role) } : {} });

  test('signed out → sign in, and back here afterwards', async () => {
    const res = await get('/trips/new');
    assert.equal(res.status, 307);
    assert.match(res.headers.get('location'), /\/login\?next=%2Ftrips%2Fnew$/);
  });

  test('members and viewers are sent home', async () => {
    for (const role of ['member', 'viewer']) {
      for (const path of ['/trips/new', '/trips/testville/edit']) {
        const res = await get(path, role);
        assert.equal(res.status, 307, `${role} ${path}`);
        assert.equal(new URL(res.headers.get('location'), app.apiURL).pathname, '/', `${role} ${path}`);
      }
    }
  });

  test('settings for a trip that does not exist is a real 404', async () => {
    assert.equal((await get('/trips/nowhere/edit', 'admin')).status, 404);
  });

  test('"new" is the form, not a trip called new', async () => {
    assert.equal((await get('/trips/new', 'admin')).status, 200);
  });
});

describe('accessibility (axe, WCAG 2.1 AA)', () => {
  for (const colorScheme of ['light', 'dark']) {
    test(`new trip form, with errors (${colorScheme})`, async () => {
      const { page, context } = await openForm('/trips/new', { colorScheme });
      assert.deepEqual(await axeViolations(page), [], 'blank form');
      await page.getByRole('radio', { name: /Copy from another trip/ }).check();
      await page.getByRole('button', { name: 'Create trip' }).click();
      await page.getByText('Trip name is required.').waitFor();
      assert.deepEqual(await axeViolations(page), [], 'with errors');
      await context.close();
    });

    test(`trip settings and the delete dialog (${colorScheme})`, async () => {
      const { page, context } = await openForm('/trips/testville/edit', { colorScheme });
      assert.deepEqual(await axeViolations(page), [], 'settings');
      await page.getByRole('button', { name: 'Delete trip…' }).click();
      await page.getByRole('dialog').waitFor();
      assert.deepEqual(await axeViolations(page), [], 'delete dialog');
      await context.close();
    });

    test(`dashboard with archived trips open (${colorScheme})`, async () => {
      await app.prisma.trip.upsert({
        where: { id: 'boxed' },
        update: {},
        create: { id: 'boxed', name: 'Boxed Trip', dates: 'x', travelers: 'Us', status: 'past', tag: 'City',
          startDate: new Date('2020-06-01T00:00:00Z'), endDate: new Date('2020-06-01T00:00:00Z'), archivedAt: new Date() },
      });
      const { page, context } = await openForm('/', { colorScheme });
      await page.getByRole('region', { name: /Archived/ }).locator('summary').click();
      assert.deepEqual(await axeViolations(page), []);
      await context.close();
    });

    test(`archived trip page and day rename form (${colorScheme})`, async () => {
      const { page, context } = await openTrip(app, { id: 'boxed', admin: true, contextOptions: { colorScheme } });
      await page.getByText(/This trip is archived/).waitFor();
      assert.deepEqual(await axeViolations(page), [], 'archived notice');
      await context.close();

      const editing = await openTrip(app, { admin: true, contextOptions: { colorScheme } });
      await editing.page.getByRole('button', { name: /^Rename Day 1/ }).click();
      assert.deepEqual(await axeViolations(editing.page), [], 'rename form');
      await editing.context.close();
    });
  }
});
