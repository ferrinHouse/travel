// Browser tests for edit mode: unlocking, and every add/edit/delete flow.
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './support/server.mjs';
import { openTrip, toastText } from './support/trip-page.mjs';

let app;

before(async () => {
  app = await startApp();
});
after(() => app?.stop());

const activityRow = (page, text) => page.locator('.activity-item', { hasText: text });

describe('unlocking edit mode', () => {
  test('wrong passcode shows an error; Escape closes the dialog', async () => {
    const { page, context } = await openTrip(app);
    await page.getByRole('button', { name: 'Unlock Editing' }).click();
    const dialog = page.getByRole('dialog', { name: /Enter Admin Passcode/ });
    await dialog.waitFor();
    assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), 'Passcode', 'focus starts in the input');

    await dialog.getByLabel('Passcode').fill('definitely-wrong');
    await dialog.getByRole('button', { name: 'Unlock' }).click();
    await dialog.getByRole('alert').waitFor();
    assert.equal(await dialog.getByRole('alert').innerText(), 'Incorrect passcode. Try again.');

    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await page.getByText('VIEW ONLY MODE').count(), 1);
    await context.close();
  });

  test('correct passcode unlocks; Lock Editing locks again', async () => {
    const { page, context } = await openTrip(app);
    await page.getByRole('button', { name: 'Unlock Editing' }).click();
    await page.getByLabel('Passcode', { exact: true }).fill(app.passcode);
    await page.getByRole('button', { name: 'Unlock', exact: true }).click();
    await page.getByText('ADMIN EDIT MODE ENABLED').waitFor();
    assert.ok((await page.getByRole('button', { name: '+ Add Activity' }).count()) > 0);

    // Survives a reload (cookie)
    await page.reload();
    await page.getByText('ADMIN EDIT MODE ENABLED').waitFor();

    await page.getByRole('button', { name: 'Lock Editing' }).click();
    await page.getByText('VIEW ONLY MODE').waitFor();
    assert.equal(await page.getByRole('button', { name: '+ Add Activity' }).count(), 0);
    await context.close();
  });
});

describe('itinerary editing', () => {
  test('add an activity to a day', async () => {
    const { page, context } = await openTrip(app, { admin: true });
    const day2 = page.locator('section', { has: page.getByRole('heading', { name: /Day 2: Exploring/ }) });
    await day2.getByRole('button', { name: '+ Add Activity' }).click();
    await day2.getByLabel('Time').fill('2:00 PM');
    await day2.getByLabel('Description').fill('Botanical garden');
    await day2.getByLabel('Details / Note').fill('Buy tickets **online**');
    await day2.getByRole('checkbox', { name: /Highlight this event/ }).check();
    await day2.getByRole('button', { name: 'Add', exact: true }).click();

    const row = activityRow(day2, 'Botanical garden');
    await row.waitFor();
    assert.equal(await row.locator('.activity-time').innerText(), '2:00 PM');
    assert.equal(await row.locator('strong', { hasText: 'online' }).count(), 1);
    assert.match(await row.getAttribute('class'), /alert-box/);
    const saved = await app.prisma.itineraryActivity.findFirst({ where: { description: 'Botanical garden' } });
    assert.equal(saved.isAlert, true);
    await context.close();
  });

  test('add button stays disabled until there is a description', async () => {
    const { page, context } = await openTrip(app, { admin: true });
    const day2 = page.locator('section', { has: page.getByRole('heading', { name: /Day 2: Exploring/ }) });
    await day2.getByRole('button', { name: '+ Add Activity' }).click();
    assert.equal(await day2.getByRole('button', { name: 'Add', exact: true }).isDisabled(), true);
    await day2.getByLabel('Description').fill('   ');
    assert.equal(await day2.getByRole('button', { name: 'Add', exact: true }).isDisabled(), true);
    await day2.getByRole('button', { name: 'Cancel' }).click();
    assert.equal(await day2.getByLabel('Description').count(), 0);
    await context.close();
  });

  test('edit an activity', async () => {
    const { page, context } = await openTrip(app, { admin: true });
    await activityRow(page, 'Museum visit').getByRole('button', { name: 'Edit' }).click();
    await page.getByLabel('Description').fill('Science museum');
    await page.getByLabel('Time').fill('9:30 AM');
    await page.getByRole('button', { name: 'Save' }).click();
    await activityRow(page, 'Science museum').waitFor();
    assert.equal(await activityRow(page, 'Science museum').locator('.activity-time').innerText(), '9:30 AM');
    assert.ok(await app.prisma.itineraryActivity.findFirst({ where: { description: 'Science museum', time: '9:30 AM' } }));
    await context.close();
  });

  test('meals in the itinerary have no edit buttons', async () => {
    const { page, context } = await openTrip(app, { admin: true });
    const meal = activityRow(page, 'Dinner: Pizza');
    assert.equal(await meal.getByRole('button').count(), 0);
    assert.equal(await meal.getByText('Edit in Meals tab').count(), 1);
    await context.close();
  });

  test('deleting asks for confirmation; Cancel keeps it, Delete removes it', async () => {
    const { page, context } = await openTrip(app, { admin: true });
    const row = activityRow(page, 'Night market');
    await row.getByRole('button', { name: 'Delete' }).click();
    const dialog = page.getByRole('dialog', { name: 'Delete activity?' });
    await dialog.waitFor();
    assert.match(await dialog.innerText(), /“Night market” will be removed/);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await row.count(), 1);

    await row.getByRole('button', { name: 'Delete' }).click();
    await dialog.getByRole('button', { name: 'Delete' }).click();
    await row.waitFor({ state: 'detached' });
    assert.match(await toastText(page), /Activity deleted/);
    assert.equal(
      await app.prisma.itineraryActivity.count({ where: { description: 'Night market', day: { tripId: 'testville' } } }),
      0
    );
    await context.close();
  });

  test('a failed save keeps the form open and shows the error', async () => {
    const { page, context } = await openTrip(app, { admin: true });
    await page.route('**/api/activities', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"success":false,"message":"Server error"}' })
    );
    const day2 = page.locator('section', { has: page.getByRole('heading', { name: /Day 2: Exploring/ }) });
    await day2.getByRole('button', { name: '+ Add Activity' }).click();
    await day2.getByLabel('Description').fill('Will fail');
    await day2.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByText(/Couldn.t add activity: Server error/).waitFor();
    assert.equal(await day2.getByLabel('Description').inputValue(), 'Will fail');
    await context.close();
  });
});

describe('logistics editing', () => {
  test('add a card; hostile markdown renders inert', async () => {
    const { page, context } = await openTrip(app, { tab: 'logistics', admin: true });
    let alerted = false;
    page.on('dialog', async (d) => {
      alerted = true;
      await d.dismiss();
    });

    await page.getByRole('button', { name: '➕ Add Logistics Card' }).click();
    await page.getByLabel('Title').fill('Rental car');
    await page.getByLabel('Content (Markdown supported)').fill(
      '[click](javascript:alert(1)) <img src=x onerror=alert(2)> [x](https://a.com/" onmouseover="alert(3)) [ok](https://example.com)'
    );
    await page.getByRole('button', { name: 'Save Card' }).click();

    const card = page.locator('.card', { hasText: 'Rental car' });
    await card.waitFor();
    assert.equal(await card.locator('img').count(), 0);
    const hrefs = await card.locator('a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    assert.ok(hrefs.every((h) => h.startsWith('https://')), JSON.stringify(hrefs));
    const handlers = await card.evaluate((el) =>
      [...el.querySelectorAll('*')].filter((n) => [...n.attributes].some((a) => a.name.startsWith('on'))).length
    );
    assert.equal(handlers, 0);
    await card.locator('a').first().hover();
    assert.equal(alerted, false);
    await context.close();
  });

  test('edit a card', async () => {
    const { page, context } = await openTrip(app, { tab: 'logistics', admin: true });
    await page.locator('.card', { hasText: 'Flights' }).getByRole('button', { name: 'Edit' }).click();
    await page.getByLabel('Content (Markdown supported)').fill('UA 456 at noon');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByText('UA 456 at noon').waitFor();
    assert.equal((await app.prisma.logisticsCard.findFirst({ where: { tripId: 'testville', title: 'Flights' } })).content, 'UA 456 at noon');
    await context.close();
  });

  test('delete a card through the confirm dialog', async () => {
    const { page, context } = await openTrip(app, { tab: 'logistics', admin: true });
    await page.locator('.card', { hasText: 'Hotel' }).getByRole('button', { name: 'Edit' }).click();
    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('dialog', { name: 'Delete logistics card?' }).getByRole('button', { name: 'Delete' }).click();
    await page.getByText('Card deleted').waitFor();
    assert.equal(await app.prisma.logisticsCard.count({ where: { tripId: 'testville', title: 'Hotel' } }), 0);
    await context.close();
  });
});

describe('checklist editing', () => {
  test('add, rename and delete an item', async () => {
    const { page, context } = await openTrip(app, { tab: 'checklist', admin: true });
    const input = page.getByLabel('Add item to 🎒 Packing List');
    await input.fill('Beach towels');
    await input.press('Enter');
    await page.getByRole('checkbox', { name: 'Beach towels' }).waitFor();
    assert.equal(await input.inputValue(), '');

    await page.getByRole('button', { name: 'Edit “Beach towels”' }).click();
    const edit = page.getByLabel('Item text');
    await edit.fill('Beach towels (x4)');
    await edit.press('Enter');
    await page.getByRole('checkbox', { name: 'Beach towels (x4)' }).waitFor();
    assert.ok(await app.prisma.checklistItem.findFirst({ where: { text: 'Beach towels (x4)', category: 'packing' } }));

    await page.getByRole('button', { name: 'Delete “Beach towels (x4)”' }).click();
    await page.getByRole('dialog', { name: 'Delete item?' }).getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('checkbox', { name: 'Beach towels (x4)' }).waitFor({ state: 'detached' });
    assert.equal(await app.prisma.checklistItem.count({ where: { text: { startsWith: 'Beach towels' } } }), 0);
    await context.close();
  });

  test('Escape cancels a rename', async () => {
    const { page, context } = await openTrip(app, { tab: 'checklist', admin: true });
    await page.getByRole('button', { name: 'Edit “Book hotel”' }).click();
    await page.getByLabel('Item text').fill('Changed my mind');
    await page.getByLabel('Item text').press('Escape');
    assert.equal(await page.getByRole('checkbox', { name: 'Book hotel' }).count(), 1);
    assert.ok(await app.prisma.checklistItem.findFirst({ where: { text: 'Book hotel' } }));
    await context.close();
  });

  test('custom categories from the data get their own list', async () => {
    await app.prisma.checklistItem.create({ data: { tripId: 'testville', text: 'Car seats', category: 'kids-gear' } });
    const { page, context } = await openTrip(app, { tab: 'checklist' });
    assert.equal(await page.getByRole('heading', { name: 'Kids Gear' }).count(), 1);
    await context.close();
  });
});

describe('meals and groceries editing', () => {
  test('typing a meal sends one save after a pause and persists', async () => {
    const { page, context } = await openTrip(app, { tab: 'meals', admin: true });
    const requests = [];
    page.on('request', (r) => r.url().endsWith('/api/meals') && requests.push(r));

    const day2 = page.getByRole('heading', { name: 'Day 2: Exploring' }).locator('..');
    await day2.getByLabel('Lunch:').pressSequentially('Food truck tacos', { delay: 20 });
    await page.waitForResponse('**/api/meals');
    await day2.locator('[role=status]', { hasText: '✓' }).first().waitFor();
    assert.equal(requests.length, 1, 'one request for the whole word');

    const saved = await app.prisma.mealPlan.findFirst({ where: { tripId: 'testville', dayNumber: 2, mealType: 'Lunch' } });
    assert.equal(saved.mealName, 'Food truck tacos');
    await context.close();
  });

  test('changing the time keeps the name and the seeded details', async () => {
    const { page, context } = await openTrip(app, { tab: 'meals', admin: true });
    const day1 = page.getByRole('heading', { name: 'Day 1: Arrival' }).locator('..');
    const time = day1.getByLabel('Dinner time');
    await time.fill('7:15 PM');
    await time.blur();
    await page.waitForResponse('**/api/meals');
    const saved = await app.prisma.mealPlan.findFirst({ where: { tripId: 'testville', dayNumber: 1, mealType: 'Dinner' } });
    assert.deepEqual([saved.mealName, saved.time, saved.details], ['Pizza', '7:15 PM', 'Deep dish']);
    await context.close();
  });

  test('clearing a meal waits for blur, then deletes it', async () => {
    await app.prisma.mealPlan.create({ data: { tripId: 'testville', dayNumber: 2, mealType: 'Breakfast', mealName: 'Bagels' } });
    const { page, context } = await openTrip(app, { tab: 'meals', admin: true });
    const requests = [];
    page.on('request', (r) => r.url().endsWith('/api/meals') && requests.push(r));

    const breakfast = page.getByRole('heading', { name: 'Day 2: Exploring' }).locator('..').getByLabel('Breakfast:');
    await breakfast.fill('');
    await page.waitForTimeout(1000);
    assert.equal(requests.length, 0, 'no save while the field is empty and focused');

    await breakfast.blur();
    await page.waitForResponse('**/api/meals');
    assert.equal(await app.prisma.mealPlan.count({ where: { tripId: 'testville', dayNumber: 2, mealType: 'Breakfast' } }), 0);
    await context.close();
  });

  test('switching tabs mid-typing still saves the meal', async () => {
    const { page, context } = await openTrip(app, { tab: 'meals', admin: true });
    const day2 = page.getByRole('heading', { name: 'Day 2: Exploring' }).locator('..');
    const saved = page.waitForResponse('**/api/meals');
    await day2.getByLabel('Dinner:').fill('Ramen');
    await page.getByRole('tab', { name: /Itinerary/ }).click();
    await saved;
    assert.ok(await app.prisma.mealPlan.findFirst({ where: { tripId: 'testville', dayNumber: 2, mealType: 'Dinner', mealName: 'Ramen' } }));
    await activityRow(page, 'Dinner: Ramen').waitFor();
    await context.close();
  });

  test('add a grocery item to a category', async () => {
    const { page, context } = await openTrip(app, { tab: 'meals', admin: true });
    await page.getByLabel('Grocery item name').fill('Bananas');
    await page.getByLabel('Grocery category').selectOption('Snacks');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Bananas' }).waitFor();
    assert.equal(await page.getByLabel('Grocery item name').inputValue(), '');
    const item = await app.prisma.groceryItem.findFirst({ where: { tripId: 'testville', name: 'Bananas' } });
    assert.equal(item.category, 'Snacks');
    await context.close();
  });
});
