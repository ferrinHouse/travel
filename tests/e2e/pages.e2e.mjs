// Browser tests for viewing: dashboard, navigation, tabs, view-only mode,
// open checkbox toggling, error pages and mobile layout.
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './support/server.mjs';
import { fitsWidth, openTrip, toastText } from './support/trip-page.mjs';

let app;

before(async () => {
  app = await startApp();
});
after(() => app?.stop());

describe('dashboard', () => {
  test('groups trips into upcoming and past and links to them', async () => {
    const context = await app.browser.newContext();
    const page = await context.newPage();
    await page.goto(app.baseURL);

    const upcoming = page.locator('section', { has: page.getByRole('heading', { name: 'Upcoming Trips' }) });
    const past = page.locator('section', { has: page.getByRole('heading', { name: 'Past Adventures' }) });
    assert.equal(await upcoming.getByText('Testville Getaway').count(), 1);
    assert.equal(await upcoming.getByText('Oldtown Memories').count(), 0);
    assert.equal(await past.getByText('Oldtown Memories').count(), 1);

    await upcoming.getByRole('link', { name: 'View Itinerary' }).click();
    await page.waitForURL('**/trips/testville');
    await page.getByRole('heading', { level: 1, name: 'Testville Getaway' }).waitFor();
    await context.close();
  });

  test('a trip ending today still counts as upcoming', async () => {
    const { daysFromToday } = await import('../support/fixtures.mjs');
    await app.prisma.trip.create({
      data: {
        id: 'lastday', name: 'Last Day Trip', dates: 'x', travelers: 'x', status: 'upcoming', tag: 'City',
        startDate: daysFromToday(-2), endDate: daysFromToday(0),
      },
    });
    const context = await app.browser.newContext({ timezoneId: 'America/Chicago' });
    const page = await context.newPage();
    await page.goto(app.baseURL);
    const upcoming = page.locator('section', { has: page.getByRole('heading', { name: 'Upcoming Trips' }) });
    assert.equal(await upcoming.getByText('Last Day Trip').count(), 1);
    await context.close();
    await app.prisma.trip.delete({ where: { id: 'lastday' } });
  });
});

describe('not found pages', () => {
  test('unknown trip shows the trip-not-found page with a 404', async () => {
    const context = await app.browser.newContext();
    const page = await context.newPage();
    const res = await page.goto(`${app.baseURL}/trips/atlantis`);
    assert.equal(res.status(), 404);
    assert.equal(await page.getByRole('heading', { name: 'Trip not found' }).count(), 1);
    await page.getByRole('link', { name: 'Back to Adventures' }).click();
    await page.waitForURL(`${app.baseURL}/`);
    await context.close();
  });

  test('unknown route shows the page-not-found page', async () => {
    const context = await app.browser.newContext();
    const page = await context.newPage();
    const res = await page.goto(`${app.baseURL}/no/such/page`);
    assert.equal(res.status(), 404);
    assert.equal(await page.getByRole('heading', { name: 'Page not found' }).count(), 1);
    await context.close();
  });
});

describe('trip page, view-only', () => {
  test('shows itinerary with meals interleaved and no edit controls', async () => {
    const { page, context, errors } = await openTrip(app);
    assert.equal(await page.getByText('VIEW ONLY MODE').count(), 1);
    assert.equal(await page.getByRole('button', { name: 'Edit', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Delete', exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: '+ Add Activity' }).count(), 0);

    const day1 = page.locator('section', { has: page.getByRole('heading', { name: /Day 1: Arrival/ }) });
    const rows = await day1.locator('.activity-item').allInnerTexts();
    const order = rows.map((r) => (r.includes('Museum') ? 'museum' : r.includes('Pizza') ? 'dinner' : r.includes('Night market') ? 'market' : '?'));
    assert.deepEqual(order, ['museum', 'dinner', 'market']);
    assert.equal(await day1.locator('.alert-box').count(), 1, 'alert activity highlighted');
    assert.deepEqual(errors, []);
    await context.close();
  });

  test('tabs: click, arrow keys, and ?tab= deep links', async () => {
    const { page, context } = await openTrip(app);
    await page.getByRole('tab', { name: /Logistics/ }).click();
    assert.match(page.url(), /\?tab=logistics$/);
    assert.equal(await page.getByRole('heading', { name: 'Flights' }).count(), 1);

    await page.keyboard.press('ArrowRight');
    assert.equal(await page.getByRole('tab', { selected: true }).innerText(), '✅ Packing & Tasks');
    assert.match(page.url(), /\?tab=checklist$/);
    await page.keyboard.press('End');
    assert.match(page.url(), /\?tab=meals$/);
    await page.keyboard.press('Home');
    assert.match(page.url(), /\?tab=itinerary$/);
    await page.keyboard.press('ArrowLeft');
    assert.match(page.url(), /\?tab=meals$/, 'wraps around');

    await page.reload();
    assert.equal(await page.getByRole('tab', { selected: true }).innerText(), '🥣 Meals & Groceries');
    await context.close();
  });

  test('an unknown ?tab falls back to the itinerary', async () => {
    const { page, context } = await openTrip(app, { tab: 'bogus' });
    assert.equal(await page.getByRole('tab', { selected: true }).innerText(), '🗓️ Daily Itinerary');
    await context.close();
  });

  test('logistics markdown renders bold and safe links', async () => {
    const { page, context } = await openTrip(app, { tab: 'logistics' });
    const flights = page.locator('.card', { hasText: 'Flights' });
    assert.equal(await flights.locator('strong', { hasText: '8:00 AM' }).count(), 1);
    const link = page.locator('.card', { hasText: 'Hotel' }).getByRole('link', { name: 'map' });
    assert.equal(await link.getAttribute('href'), 'https://maps.example.com');
    assert.equal(await link.getAttribute('rel'), 'noopener noreferrer');
    await context.close();
  });

  test('grocery add form is hidden when not editing', async () => {
    const { page, context } = await openTrip(app, { tab: 'meals' });
    assert.equal(await page.getByText('Add Custom Grocery Item').count(), 0);
    assert.equal(await page.getByText('Not planned').count() > 0, true);
    await context.close();
  });
});

describe('open checkbox toggling', () => {
  test('ticking a checklist item saves and survives a reload', async () => {
    const { page, context } = await openTrip(app, { tab: 'checklist' });
    const box = page.getByRole('checkbox', { name: 'Transit app' });
    assert.equal(await box.isChecked(), false);
    const saved = page.waitForResponse('**/api/checklist');
    await box.check();
    assert.equal((await saved).status(), 200);
    await page.reload();
    assert.equal(await page.getByRole('checkbox', { name: 'Transit app' }).isChecked(), true);
    await context.close();
  });

  test('a failed checklist save rolls the checkbox back and shows an error', async () => {
    const { page, context } = await openTrip(app, { tab: 'checklist' });
    await page.route('**/api/checklist', (route) => route.abort());
    const box = page.getByRole('checkbox', { name: 'Sunscreen' });
    await box.click();
    await page.getByText(/Couldn.t update “Sunscreen”/).waitFor();
    assert.equal(await box.isChecked(), false);
    assert.match(await toastText(page), /Network error/);
    await context.close();
  });

  test('a server error on a grocery tick also rolls back', async () => {
    const { page, context } = await openTrip(app, { tab: 'meals' });
    await page.route('**/api/grocery', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"success":false,"message":"Server error"}' })
    );
    const box = page.getByRole('checkbox', { name: 'Milk' });
    await box.click();
    await page.getByText(/Couldn.t update “Milk”: Server error/).waitFor();
    assert.equal(await box.isChecked(), false);
    await context.close();
  });

  test('ticking a grocery item persists', async () => {
    const { page, context } = await openTrip(app, { tab: 'meals' });
    const saved = page.waitForResponse('**/api/grocery');
    await page.getByRole('checkbox', { name: 'Milk' }).check();
    assert.equal((await saved).status(), 200);
    const milk = await app.prisma.groceryItem.findFirst({ where: { tripId: 'testville', name: 'Milk' } });
    assert.equal(milk.isBought, true);
    await context.close();
  });
});

describe('mobile layout (375px)', () => {
  test('no tab scrolls sideways, and the active tab is visible', async () => {
    const { page, context } = await openTrip(app, { tab: 'meals', viewport: { width: 375, height: 812 } });
    const active = page.getByRole('tab', { selected: true });
    assert.equal(await active.innerText(), '🥣 Meals & Groceries');
    const box = await active.boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= 375 + 1, `active tab visible (x=${box.x}, w=${box.width})`);

    for (const name of [/Itinerary/, /Logistics/, /Packing/, /Meals/]) {
      await page.getByRole('tab', { name }).click();
      assert.ok(await fitsWidth(page), `${name} tab overflows`);
    }
    await context.close();
  });

  test('dashboard fits on a phone', async () => {
    const context = await app.browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await context.newPage();
    await page.goto(app.baseURL);
    assert.ok(await fitsWidth(page));
    await context.close();
  });
});
