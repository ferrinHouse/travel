// Browser tests for the design system: themes (and no flash), per-trip
// colours, the trip hero, "today" highlighting, mobile tab bar, metadata
// and automated accessibility checks (axe-core) in both themes.
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { startApp } from './support/server.mjs';
import { openTrip } from './support/trip-page.mjs';
import { daysFromToday } from '../support/fixtures.mjs';
import { tripPhase, phaseLabel } from '../../src/lib/trip-status.js';
import { THEME_STORAGE_KEY } from '../../src/lib/theme.js';

const require = createRequire(import.meta.url);
const AXE_PATH = require.resolve('axe-core/axe.min.js');

const DARK_BG = 'rgb(13, 17, 23)'; // THEME_COLORS.dark
const LIGHT_BG = 'rgb(244, 246, 248)'; // THEME_COLORS.light
const XSS_COLOR = 'red;}</style><script>window.__pwned=1</script>';

let app;
let nowville;

const busyDay = (dayNumber) => ({
  dayNumber,
  dateLabel: `Day ${dayNumber}`,
  title: `Busy day ${dayNumber}`,
  activities: {
    create: [
      { time: '9:00 AM', description: 'Hotel breakfast', order: 0 },
      { time: '11:00 AM', description: 'Aquarium', order: 1 },
      { time: '1:00 PM', description: 'Picnic lunch', order: 2 },
      { time: '3:00 PM', description: 'Park', order: 3 },
      { time: '4:30 PM', description: 'Ice cream', order: 4 },
      { time: '6:30 PM', description: 'Dinner out', order: 5 },
      { time: '8:00 PM', description: 'Pool', order: 6 },
      { time: '9:00 PM', description: 'Movie night', order: 7 },
    ],
  },
});

before(async () => {
  app = await startApp();
  // A trip that is happening right now (yesterday → tomorrow).
  nowville = await app.prisma.trip.create({
    data: {
      id: 'nowville', name: 'Nowville Now', dates: 'This week', travelers: 'Family of 4', status: 'upcoming',
      tag: 'Beach', primaryColor: '#2c7a7b', accentColor: '#ed8936',
      startDate: daysFromToday(-1), endDate: daysFromToday(1),
      days: { create: [busyDay(1), busyDay(2), busyDay(3)] },
    },
  });
  // Junk colours must never reach the page as CSS or HTML.
  await app.prisma.trip.create({
    data: {
      id: 'junkcolor', name: 'Junk Colour Trip', dates: 'x', travelers: 'x', status: 'upcoming', tag: 'City',
      primaryColor: XSS_COLOR, accentColor: 'url(https://evil.example/x)',
      startDate: daysFromToday(60), endDate: daysFromToday(61),
    },
  });
});
after(() => app?.stop());

async function axeViolations(page) {
  await page.addScriptTag({ path: AXE_PATH });
  return page.evaluate(async () => {
    const result = await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });
    return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
  });
}

const htmlTheme = (page) => page.evaluate(() => document.documentElement.dataset.theme);
const bodyBg = (page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

describe('theme', () => {
  test('follows the system setting by default', async () => {
    const context = await app.browser.newContext({ colorScheme: 'dark' });
    const page = await context.newPage();
    await page.goto(app.baseURL);
    assert.equal(await htmlTheme(page), 'dark');
    assert.equal(await bodyBg(page), DARK_BG);
    assert.equal(await page.getByRole('radio', { name: 'System' }).isChecked(), true);
    await context.close();
  });

  test('a chosen theme is saved, survives reload and is applied before first paint', async () => {
    const context = await app.browser.newContext({ colorScheme: 'light' });
    // Record the theme at the moment <body> is first parsed, i.e. before any paint.
    await context.addInitScript(() => {
      new MutationObserver((_, obs) => {
        if (document.body) {
          window.__themeAtBody = document.documentElement.dataset.theme ?? 'unset';
          obs.disconnect();
        }
      }).observe(document, { childList: true, subtree: true });
    });
    const page = await context.newPage();
    await page.goto(app.baseURL);
    await page.waitForLoadState('networkidle');
    assert.equal(await htmlTheme(page), 'light');

    await page.getByRole('radio', { name: 'Dark' }).check();
    assert.equal(await htmlTheme(page), 'dark');
    // The background fades between themes, so wait for it to settle.
    await page.waitForFunction((bg) => getComputedStyle(document.body).backgroundColor === bg, DARK_BG);
    assert.equal(await page.evaluate((k) => localStorage.getItem(k), THEME_STORAGE_KEY), 'dark');

    await page.goto(`${app.baseURL}/trips/testville`);
    assert.equal(await page.evaluate(() => window.__themeAtBody), 'dark', 'no light flash on the next page');
    assert.equal(await page.getByRole('radio', { name: 'Dark' }).isChecked(), true);

    await page.getByRole('radio', { name: 'Light' }).check();
    await page.reload();
    assert.equal(await page.evaluate(() => window.__themeAtBody), 'light');
    assert.equal(await bodyBg(page), LIGHT_BG);
    await context.close();
  });

  test('"System" tracks OS changes live', async () => {
    const context = await app.browser.newContext({ colorScheme: 'light' });
    const page = await context.newPage();
    await page.goto(app.baseURL);
    await page.waitForLoadState('networkidle');
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
    await context.close();
  });

  test('declares theme-color for light and dark browser chrome', async () => {
    const context = await app.browser.newContext();
    const page = await context.newPage();
    await page.goto(app.baseURL);
    const metas = await page.locator('meta[name="theme-color"]').evaluateAll((els) =>
      els.map((e) => `${e.getAttribute('media')}=${e.getAttribute('content')}`)
    );
    assert.deepEqual(metas.sort(), ['(prefers-color-scheme: dark)=#0d1117', '(prefers-color-scheme: light)=#f4f6f8']);
    await context.close();
  });
});

describe('metadata', () => {
  test('pages get descriptive titles', async () => {
    const context = await app.browser.newContext();
    const page = await context.newPage();
    await page.goto(app.baseURL);
    assert.equal(await page.title(), 'Family Travel Adventures');
    await page.goto(`${app.baseURL}/trips/testville`);
    assert.equal(await page.title(), 'Testville Getaway | Family Travel Adventures');
    await page.goto(`${app.baseURL}/trips/atlantis`);
    assert.match(await page.title(), /not found/i);
    await context.close();
  });
});

describe('trip hero', () => {
  test('shows the name, tag, dates, travelers and a countdown', async () => {
    const { page, context } = await openTrip(app);
    const trip = await app.prisma.trip.findUnique({ where: { id: 'testville' } });
    const hero = page.locator('header', { has: page.getByRole('heading', { level: 1 }) });
    assert.equal(await hero.getByRole('heading', { level: 1 }).innerText(), 'Testville Getaway');
    assert.equal(await hero.getByText('City', { exact: true }).count(), 1);
    assert.equal(await hero.getByText(phaseLabel(tripPhase(trip))).count(), 1);
    assert.match(await hero.innerText(), /Test dates/);
    assert.match(await hero.innerText(), /Family of 4/);
    await page.getByRole('link', { name: /Adventures/ }).first().click();
    await page.waitForURL(`${app.baseURL}/`);
    await context.close();
  });

  test('trip colours become CSS variables', async () => {
    const { page, context } = await openTrip(app);
    const primary = await page.locator('[data-trip]').first().evaluate((el) =>
      getComputedStyle(el).getPropertyValue('--trip-primary').trim()
    );
    assert.equal(primary, '#004488');
    await context.close();
  });

  test('junk colours fall back safely and never reach the HTML', async () => {
    for (const path of ['/', '/trips/junkcolor']) {
      const html = await (await fetch(`${app.baseURL}${path}`)).text();
      assert.ok(!html.includes('__pwned'), `${path} leaks the payload`);
      assert.ok(!html.includes('evil.example'), `${path} leaks the url()`);
    }
    const { page, context, errors } = await openTrip(app, { id: 'junkcolor' });
    assert.equal(await page.evaluate(() => window.__pwned), undefined);
    const primary = await page.locator('[data-trip]').first().evaluate((el) =>
      getComputedStyle(el).getPropertyValue('--trip-primary').trim()
    );
    assert.match(primary, /^#[0-9a-f]{6}$/);
    assert.deepEqual(errors, []);
    await context.close();
  });
});

describe('during a trip', () => {
  test('the hero says which day it is, and today is highlighted and scrolled to', async () => {
    const phase = tripPhase(nowville);
    assert.equal(phase.phase, 'active');
    const now = new Date();
    const { page, context } = await openTrip(app, {
      id: 'nowville',
      setup: (p) => p.clock.setFixedTime(new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 30)),
    });
    const hero = page.locator('header', { has: page.getByRole('heading', { level: 1 }) });
    assert.equal(await hero.getByText(phaseLabel(phase)).count(), 1);

    const today = page.locator('section[aria-current="date"]');
    await today.waitFor();
    assert.equal(await page.locator('section[aria-current="date"]').count(), 1);
    assert.match(await today.getByRole('heading').first().innerText(), new RegExp(`Day ${phase.dayNumber}\\b`));
    assert.equal(await today.getByText('Today', { exact: true }).count(), 1);

    const next = today.locator('[aria-current="time"]');
    assert.equal(await next.count(), 1);
    assert.match(await next.innerText(), /Aquarium/);
    assert.match(await next.innerText(), /Next up/);

    if (phase.dayNumber > 1) {
      await page.waitForFunction(() => {
        const r = document.querySelector('section[aria-current="date"]').getBoundingClientRect();
        return r.top < window.innerHeight && r.bottom > 0;
      });
    }
    await context.close();
  });

  test('upcoming trips highlight nothing', async () => {
    const { page, context } = await openTrip(app);
    assert.equal(await page.locator('[aria-current="date"]').count(), 0);
    assert.equal(await page.locator('[aria-current="time"]').count(), 0);
    await context.close();
  });
});

describe('dashboard', () => {
  test('the next trip is featured with its countdown', async () => {
    const context = await app.browser.newContext();
    const page = await context.newPage();
    await page.goto(app.baseURL);
    const featured = page.locator('[data-featured]');
    assert.equal(await featured.count(), 1);
    // nowville is happening now, so it is the "next" adventure.
    assert.match(await featured.innerText(), /Nowville Now/);
    assert.match(await featured.innerText(), new RegExp(phaseLabel(tripPhase(nowville))));
    await context.close();
  });
});

describe('mobile tab bar', () => {
  test('tabs sit at the bottom of the screen on phones and never cover content', async () => {
    const { page, context } = await openTrip(app, { viewport: { width: 375, height: 700 } });
    const bar = await page.getByRole('tablist').boundingBox();
    assert.ok(Math.abs(bar.y + bar.height - 700) <= 1, `bar bottom at ${bar.y + bar.height}`);

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const last = page.locator('section.itinerary-day').last();
    const box = await last.boundingBox();
    assert.ok(box.y + box.height <= bar.y + 1, 'last card scrolls clear of the tab bar');

    const tabs = await page.getByRole('tab').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
    for (const h of tabs) assert.ok(h >= 44, `tab is a comfortable touch target (${h}px)`);
    await context.close();
  });

  test('on desktop the tabs stay inline under the hero', async () => {
    const { page, context } = await openTrip(app);
    const position = await page.getByRole('tablist').evaluate((el) => getComputedStyle(el).position);
    assert.notEqual(position, 'fixed');
    await context.close();
  });
});

describe('reduced motion', () => {
  test('hover and entrance animations are switched off', async () => {
    const context = await app.browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(app.baseURL);
    const duration = await page.locator('.card').first().evaluate((el) => getComputedStyle(el).transitionDuration);
    assert.ok(duration.split(',').every((d) => parseFloat(d) <= 0.01), duration);
    await context.close();
  });
});

describe('accessibility (axe, WCAG 2.1 AA)', () => {
  for (const colorScheme of ['light', 'dark']) {
    test(`dashboard has no violations (${colorScheme})`, async () => {
      const context = await app.browser.newContext({ colorScheme });
      const page = await context.newPage();
      await page.goto(app.baseURL);
      await page.waitForLoadState('networkidle');
      assert.deepEqual(await axeViolations(page), []);
      await context.close();
    });

    for (const id of ['testville', 'nowville', 'oldtown']) {
      test(`${id}: every tab has no violations (${colorScheme})`, async () => {
        const { page, context } = await openTrip(app, { id, contextOptions: { colorScheme } });
        for (const name of [/Itinerary/, /Logistics/, /Packing/, /Meals/]) {
          await page.getByRole('tab', { name }).click();
          assert.deepEqual(await axeViolations(page), [], `${name} tab`);
        }
        await context.close();
      });
    }

    test(`edit mode has no violations (${colorScheme})`, async () => {
      const { page, context } = await openTrip(app, { admin: true, contextOptions: { colorScheme } });
      assert.deepEqual(await axeViolations(page), [], 'itinerary');
      await page.getByRole('tab', { name: /Meals/ }).click();
      assert.deepEqual(await axeViolations(page), [], 'meals');
      await context.close();
    });
  }
});
