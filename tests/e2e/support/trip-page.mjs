import { newContext } from './server.mjs';

/**
 * Opens /trips/<id> as `as` (viewer | member | admin; default member) and waits
 * for hydration. `admin: true` is shorthand for signing in as an admin and
 * switching Edit mode on.
 */
export async function openTrip(app, { id = 'testville', tab, as, admin = false, viewport, contextOptions, setup } = {}) {
  const role = as ?? (admin ? 'admin' : 'member');
  const context = await newContext(app, { as: role, viewport: viewport ?? { width: 1280, height: 900 }, ...contextOptions });
  const page = await context.newPage();
  if (setup) await setup(page);
  const errors = [];
  page.on('pageerror', (err) => errors.push(err));
  await page.goto(`${app.baseURL}/trips/${id}${tab ? `?tab=${tab}` : ''}`);
  await page.locator('[data-hydrated]').waitFor({ state: 'attached' });
  if (admin) {
    await page.getByRole('button', { name: 'Edit mode' }).click();
    await page.getByText('Editing the plan').waitFor();
  }
  return { page, context, errors };
}

/** Resolves true if the page has no horizontal overflow. */
export const fitsWidth = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

export const toastText = (page) => page.locator('[role="status"][aria-live="polite"]').innerText();

/** Waits for a toast matching `pattern` (toasts appear after the request finishes). */
export const waitForToast = (page, pattern) => page.locator('[role="status"][aria-live="polite"]').getByText(pattern).first().waitFor();
