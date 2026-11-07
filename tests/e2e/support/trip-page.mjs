import { loginContext } from './server.mjs';

/**
 * Opens /trips/<id> and waits for hydration, which we detect by the
 * client's GET /api/auth on mount.
 */
export async function openTrip(app, { id = 'testville', tab, admin = false, viewport } = {}) {
  const context = await app.browser.newContext({ viewport: viewport ?? { width: 1280, height: 900 } });
  if (admin) await loginContext(app, context);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err));
  const hydrated = page.waitForResponse((res) => res.url().endsWith('/api/auth') && res.request().method() === 'GET');
  await page.goto(`${app.baseURL}/trips/${id}${tab ? `?tab=${tab}` : ''}`);
  await hydrated;
  if (admin) await page.getByText('ADMIN EDIT MODE ENABLED').waitFor();
  return { page, context, errors };
}

/** Resolves true if the page has no horizontal overflow. */
export const fitsWidth = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

export const toastText = (page) => page.locator('[aria-live="polite"]').innerText();
