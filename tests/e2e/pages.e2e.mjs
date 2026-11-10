// Browser tests for viewing: dashboard, navigation, tabs, what each role sees,
// member checkbox toggling, error pages and mobile layout.
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { newContext, startApp } from './support/server.mjs';
import { fitsWidth, openTrip, toastText } from './support/trip-page.mjs';

let app;

/** Id of the selected tab, e.g. 'meals' (labels differ between phone and desktop). */
const selectedTab = async (page) =>
  (await page.getByRole('tab', { selected: true }).getAttribute('id')).replace('trip-tab-', '');

before(async () => {
  app = await startApp();
});
after(() => app?.stop());

describe('dashboard', () => {
  test('groups trips into upcoming and past and links to them', async () => {
    const context = await newContext(app);
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
    const context = await newContext(app, { timezoneId: 'America/Chicago' });
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
    const context = await newContext(app);
    const page = await context.newPage();
    const res = await page.goto(`${app.baseURL}/trips/atlantis`);
    assert.equal(res.status(), 404);
    // notFound() in this dynamic route comes back as a 404 whose body React
    // renders in the browser, so the heading can appear just after "load".
    await page.getByRole('heading', { name: 'Trip not found' }).waitFor();
    assert.equal(await page.getByRole('heading', { name: 'Trip not found' }).count(), 1);
    await page.getByRole('link', { name: 'Back to Adventures' }).click();
    await page.waitForURL(`${app.baseURL}/`);
    await context.close();
  });

  test('unknown route shows the page-not-found page', async () => {
    const context = await newContext(app);
    const page = await context.newPage();
    const res = await page.goto(`${app.baseURL}/no/such/page`);
    assert.equal(res.status(), 404);
    assert.equal(await page.getByRole('heading', { name: 'Page not found' }).count(), 1);
    await context.close();
  });
});

describe('trip page, view-only', () => {
  test('shows itinerary with meals interleaved and no edit controls', async () => {
    const { page, context, errors } = await openTrip(app, { as: 'viewer' });
    assert.equal(await page.getByText(/View only/).count(), 1);
    assert.equal(await page.getByRole('button', { name: 'Edit mode' }).count(), 0);
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
    assert.equal(await selectedTab(page), 'checklist');
    assert.match(page.url(), /\?tab=checklist$/);
    await page.keyboard.press('End');
    assert.match(page.url(), /\?tab=photos$/);
    await page.keyboard.press('Home');
    assert.match(page.url(), /\?tab=itinerary$/);
    await page.keyboard.press('ArrowLeft');
    assert.match(page.url(), /\?tab=photos$/, 'wraps around');

    await page.reload();
    assert.equal(await selectedTab(page), 'photos');
    await context.close();
  });

  test('an unknown ?tab falls back to the itinerary', async () => {
    const { page, context } = await openTrip(app, { tab: 'bogus' });
    assert.equal(await selectedTab(page), 'itinerary');
    await context.close();
  });

  test('on a past trip, an unknown ?tab falls back to Photos', async () => {
    const { page, context } = await openTrip(app, { id: 'oldtown', tab: 'bogus' });
    assert.equal(await selectedTab(page), 'photos');
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

  test('viewers get no grocery add form and see unplanned meals as text', async () => {
    const { page, context } = await openTrip(app, { tab: 'meals', as: 'viewer' });
    assert.equal(await page.getByText('Add Custom Grocery Item').count(), 0);
    assert.equal(await page.getByText('Not planned').count() > 0, true);
    await context.close();
  });
});

describe('what each role sees', () => {
  test('viewers see locked checkboxes and no add forms', async () => {
    const { page, context } = await openTrip(app, { tab: 'checklist', as: 'viewer' });
    assert.equal(await page.getByRole('checkbox', { name: 'Sunscreen' }).isDisabled(), true);
    assert.equal(await page.getByPlaceholder('Add new item...').count(), 0);
    await page.getByRole('tab', { name: /Meals/ }).click();
    assert.equal(await page.getByRole('checkbox', { name: 'Milk' }).isDisabled(), true);
    assert.equal(await page.getByLabel('Grocery item name').count(), 0);
    await context.close();
  });

  test('members can add packing and grocery items but not edit or delete', async () => {
    const { page, context } = await openTrip(app, { tab: 'checklist' });
    assert.equal(await page.getByRole('button', { name: 'Edit mode' }).count(), 0);
    assert.equal(await page.getByRole('button', { name: /^Delete “/ }).count(), 0);
    const packing = page.locator('.card', { has: page.getByRole('heading', { name: /Packing/ }) });
    await packing.getByPlaceholder('Add new item...').fill('Rain jackets');
    const saved = page.waitForResponse('**/api/checklist');
    await packing.getByRole('button', { name: 'Add' }).click();
    assert.equal((await saved).status(), 200);
    await page.getByText('Rain jackets').waitFor();

    await page.getByRole('tab', { name: /Meals/ }).click();
    await page.getByLabel('Grocery item name').fill('Marshmallows');
    const added = page.waitForResponse('**/api/grocery');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    assert.equal((await added).status(), 200);
    await page.getByText('Marshmallows').waitFor();
    await context.close();
  });
});

describe('member checkbox toggling', () => {
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

  // Network failures are kept and synced later (tests/e2e/offline.e2e.mjs);
  // a refusal from the server rolls the tick back.
  test('a checklist tick the server refuses rolls back and shows why', async () => {
    const { page, context } = await openTrip(app, { tab: 'checklist' });
    await page.route('**/api/checklist', (route) =>
      route.fulfill({ status: 404, contentType: 'application/json', body: '{"success":false,"message":"Item not found"}' })
    );
    const box = page.getByRole('checkbox', { name: 'Sunscreen' });
    await box.click();
    await page.getByText(/Couldn.t update “Sunscreen”/).waitFor();
    assert.equal(await box.isChecked(), false);
    assert.match(await toastText(page), /Item not found/);
    await context.close();
  });

  test('a bad grocery tick also rolls back', async () => {
    const { page, context } = await openTrip(app, { tab: 'meals' });
    await page.route('**/api/grocery', (route) =>
      route.fulfill({ status: 400, contentType: 'application/json', body: '{"success":false,"message":"Bad request"}' })
    );
    const box = page.getByRole('checkbox', { name: 'Milk' });
    await box.click();
    await page.getByText(/Couldn.t update “Milk”: Bad request/).waitFor();
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
    assert.equal(await selectedTab(page), 'meals');
    const box = await active.boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= 375 + 1, `active tab visible (x=${box.x}, w=${box.width})`);

    for (const name of [/Itinerary/, /Logistics/, /Packing/, /Meals/]) {
      await page.getByRole('tab', { name }).click();
      assert.ok(await fitsWidth(page), `${name} tab overflows`);
    }
    await context.close();
  });

  test('dashboard fits on a phone', async () => {
    const context = await newContext(app, { viewport: { width: 375, height: 812 } });
    const page = await context.newPage();
    await page.goto(app.baseURL);
    assert.ok(await fitsWidth(page));
    await context.close();
  });
});
