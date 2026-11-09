// Browser flows for accounts: signing in and out, first-run setup, invites,
// passkeys (Chromium's virtual authenticator), the account and People pages,
// and accessibility scans of every auth page in both themes.
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { newContext, SETUP_TOKEN, startApp } from './support/server.mjs';
import { axeViolations } from './support/axe.mjs';

let app;

before(async () => {
  app = await startApp();
});
after(() => app?.stop());

const path = (page) => {
  const url = new URL(page.url());
  return `${url.pathname}${url.search}`;
};

/** Gives the page a platform authenticator that always says yes (Face ID stand-in). */
async function virtualAuthenticator(context, page) {
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  return { cdp, authenticatorId };
}

/** The avatar menu in the header (a <details>/<summary>). */
const userMenu = (page) => page.getByRole('banner').locator('summary');
const signOutButton = (page) => page.getByRole('banner').getByRole('button', { name: 'Sign out' });
/** Form error message (Next's route announcer is also role=alert, so be specific). */
const formError = (page) => page.locator('p[role="alert"]');

async function signInWithPassword(page, username, password = app.password) {
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

describe('signing in and out', () => {
  test('a signed-out visitor is sent to /login and comes back to the same tab afterwards', async () => {
    const context = await newContext(app, { as: null });
    const page = await context.newPage();
    await page.goto(`${app.baseURL}/trips/testville?tab=meals`);
    await page.waitForURL('**/login?next=*');
    assert.equal(await page.title(), 'Sign in | Family Travel Adventures');
    assert.equal(await userMenu(page).count(), 0);

    await signInWithPassword(page, 'member');
    await page.waitForURL('**/trips/testville?tab=meals');
    await page.getByRole('heading', { level: 1, name: 'Testville Getaway' }).waitFor();
    assert.equal(await page.getByRole('tab', { selected: true }).getAttribute('id'), 'trip-tab-meals');
    await page.getByText('Member Ferrin').waitFor();
    await context.close();
  });

  test('a wrong password shows a message and stays on the page', async () => {
    const context = await newContext(app, { as: null });
    const page = await context.newPage();
    await page.goto(`${app.baseURL}/login`);
    await signInWithPassword(page, 'member', 'not the password');
    assert.equal(await formError(page).innerText(), 'Incorrect username or password.');
    assert.equal(path(page), '/login');
    await context.close();
  });

  test('a next= pointing off-site is ignored', async () => {
    const context = await newContext(app, { as: null });
    const page = await context.newPage();
    await page.goto(`${app.baseURL}/login?next=//evil.example/steal`);
    await signInWithPassword(page, 'viewer');
    await page.waitForURL(`${app.baseURL}/`);
    await context.close();
  });

  test('signed-in visitors skip the login page', async () => {
    const context = await newContext(app, { as: 'viewer' });
    const page = await context.newPage();
    await page.goto(`${app.baseURL}/login?next=/account`);
    await page.waitForURL('**/account');
    await context.close();
  });

  test('the user menu signs out, and the old cookie no longer works', async () => {
    const context = await newContext(app, { as: 'member' });
    const page = await context.newPage();
    await page.goto(app.baseURL);
    const [cookie] = await context.cookies();

    assert.match(await userMenu(page).innerText(), /Member Ferrin/);
    await userMenu(page).click();
    await signOutButton(page).click();
    await page.waitForURL('**/login');

    // Replaying the old cookie in a new browser gets nowhere.
    const replay = await app.browser.newContext();
    await replay.addCookies([cookie]);
    const p2 = await replay.newPage();
    await p2.goto(app.baseURL);
    await p2.waitForURL('**/login');
    await replay.close();
    await context.close();
  });

  test('the menu shows People only to admins', async () => {
    for (const [role, expected] of [['member', 0], ['admin', 1]]) {
      const context = await newContext(app, { as: role });
      const page = await context.newPage();
      await page.goto(app.baseURL);
      await userMenu(page).click();
      await page.getByRole('link', { name: 'Your account' }).waitFor();
      assert.equal(await page.getByRole('link', { name: 'People' }).count(), expected, role);
      await context.close();
    }
  });

  test('non-admins are sent home from the People page', async () => {
    const context = await newContext(app, { as: 'member' });
    const page = await context.newPage();
    await page.goto(`${app.baseURL}/admin/users`);
    await page.waitForURL(`${app.baseURL}/`);
    await context.close();
  });
});

describe('inviting someone', () => {
  test('admin adds a person, they set a password from the link, and the link only works once', async () => {
    const adminCtx = await newContext(app, { as: 'admin' });
    const admin = await adminCtx.newPage();
    await admin.goto(`${app.baseURL}/admin/users`);
    await admin.getByLabel('Name', { exact: true }).fill('Grandma');
    await admin.getByLabel('Username').fill('grandma');
    await admin.getByLabel('Role', { exact: true }).selectOption('member');
    await admin.getByRole('button', { name: 'Add and get link' }).click();
    const dialog = admin.getByRole('dialog', { name: 'Invite link for Grandma' });
    await dialog.waitFor();
    const link = await dialog.getByLabel('Link').inputValue();
    assert.match(link, new RegExp(`^${app.baseURL}/invite/[\\w-]{43}$`));
    await dialog.getByRole('button', { name: 'Done' }).click();
    await admin.getByText('Invite pending').waitFor();

    const guestCtx = await newContext(app, { as: null });
    const guest = await guestCtx.newPage();
    await guest.goto(link);
    await guest.getByRole('heading', { name: 'Welcome, Grandma!' }).waitFor();
    await guest.getByLabel('Choose a password').fill('cookies for everyone');
    await guest.getByLabel('Type it again').fill('cookies for everyone');
    await guest.getByRole('button', { name: 'Join' }).click();
    await guest.getByText("You're in!").waitFor();
    await guest.getByRole('button', { name: 'Not now' }).click();
    await guest.waitForURL(`${app.baseURL}/`);
    await guest.getByText('Grandma').first().waitFor();

    const reuse = await (await newContext(app, { as: null })).newPage();
    await reuse.goto(link);
    await reuse.getByRole('heading', { name: 'This link has expired' }).waitFor();

    const grandma = await app.prisma.user.findUnique({ where: { username: 'grandma' } });
    assert.equal(grandma.role, 'member');
    assert.ok(grandma.passwordHash);
    await guestCtx.close();
    await adminCtx.close();
  });

  test('mismatched passwords are caught before sending', async () => {
    const adminCtx = await newContext(app, { as: 'admin' });
    const admin = await adminCtx.newPage();
    await admin.goto(`${app.baseURL}/admin/users`);
    await admin.getByLabel('Name', { exact: true }).fill('Cousin');
    await admin.getByLabel('Username').fill('cousin');
    await admin.getByRole('button', { name: 'Add and get link' }).click();
    const link = await admin.getByRole('dialog').getByLabel('Link').inputValue();

    const page = await (await newContext(app, { as: null })).newPage();
    await page.goto(link);
    await page.getByLabel('Choose a password').fill('one long password');
    await page.getByLabel('Type it again').fill('another long password');
    await page.getByRole('button', { name: 'Join' }).click();
    assert.equal(await formError(page).innerText(), "Those passwords don't match.");
    await adminCtx.close();
  });
});

describe('People page', () => {
  test('turning someone off signs them out; their role can be changed', async () => {
    const victim = await newContext(app, { as: 'viewer' });
    const victimPage = await victim.newPage();
    await victimPage.goto(app.baseURL);

    const adminCtx = await newContext(app, { as: 'admin' });
    const admin = await adminCtx.newPage();
    await admin.goto(`${app.baseURL}/admin/users`);
    await admin.getByLabel('Role for Viewer Ferrin').selectOption('member');
    await admin.waitForResponse('**/api/users');
    assert.equal((await app.prisma.user.findUnique({ where: { username: 'viewer' } })).role, 'member');

    const row = admin.locator('li', { hasText: '@viewer' });
    await row.getByRole('button', { name: 'Turn off' }).click();
    await admin.getByRole('dialog').getByRole('button', { name: 'Turn off' }).click();
    await row.getByText('Off', { exact: true }).waitFor();

    await victimPage.reload();
    await victimPage.waitForURL('**/login');

    // Put things back for other tests.
    await row.getByRole('button', { name: 'Turn on' }).click();
    await row.getByText('Off', { exact: true }).waitFor({ state: 'detached' });
    await admin.getByLabel('Role for Viewer Ferrin').selectOption('viewer');
    await admin.waitForResponse('**/api/users');
    await victim.close();
    await adminCtx.close();
  });

  test('admins cannot demote themselves (their own role box is locked)', async () => {
    const context = await newContext(app, { as: 'admin' });
    const page = await context.newPage();
    await page.goto(`${app.baseURL}/admin/users`);
    assert.equal(await page.getByLabel('Role for Admin Ferrin').isDisabled(), true);
    await context.close();
  });
});

describe('passkeys', () => {
  test('add a passkey on the account page, then sign in with the button and with autofill', async () => {
    const context = await newContext(app, { as: 'member' });
    const page = await context.newPage();
    const { cdp, authenticatorId } = await virtualAuthenticator(context, page);
    await page.goto(`${app.baseURL}/account`);
    await page.getByText('No passkeys yet.').waitFor();
    await page.getByRole('button', { name: 'Add a passkey on this device' }).click();
    await page.getByText(/Passkey saved/).waitFor();
    assert.equal(await app.prisma.passkey.count({ where: { userId: app.users.member.id } }), 1);
    await page.getByRole('button', { name: /^Rename / }).click();
    await page.getByLabel('Passkey name').fill('Test laptop');
    await page.getByRole('button', { name: 'Save' }).click();
    await page.getByText('🔑 Test laptop').waitFor();

    // 1) The button. Autofill is switched off on this page so it can't jump in first.
    await page.addInitScript(() => {
      window.PublicKeyCredential.isConditionalMediationAvailable = async () => false;
    });
    await userMenu(page).click();
    await signOutButton(page).click();
    await page.waitForURL('**/login');
    await page.reload();
    await page.getByRole('button', { name: 'Sign in with a passkey' }).click();
    await page.waitForURL(`${app.baseURL}/`);
    await page.getByText('Member Ferrin').waitFor();
    const key = await app.prisma.passkey.findFirst({ where: { userId: app.users.member.id } });
    assert.ok(key.lastUsedAt, 'sign-in recorded on the passkey');

    // 2) Autofill: a fresh page with the same passkey signs in from the login page
    // itself (the virtual authenticator picks the suggestion straight away).
    const { credentials } = await cdp.send('WebAuthn.getCredentials', { authenticatorId });
    await userMenu(page).click();
    await signOutButton(page).click();
    await page.waitForURL('**/login');
    const page2 = await context.newPage();
    const second = await virtualAuthenticator(context, page2);
    await second.cdp.send('WebAuthn.addCredential', { authenticatorId: second.authenticatorId, credential: credentials[0] });
    await page2.goto(`${app.baseURL}/login`);
    await page2.waitForURL(`${app.baseURL}/`);
    await page2.getByText('Member Ferrin').waitFor();
    await context.close();
  });

  test('a passkey from another site’s account is refused politely', async () => {
    const context = await newContext(app, { as: null });
    const page = await context.newPage();
    const { cdp, authenticatorId } = await virtualAuthenticator(context, page);
    // A discoverable credential for this RP that the server has never seen.
    await cdp.send('WebAuthn.addCredential', {
      authenticatorId,
      credential: {
        credentialId: Buffer.from('unknown-credential').toString('base64'),
        isResidentCredential: true,
        rpId: 'localhost',
        userHandle: Buffer.from('nobody').toString('base64'),
        privateKey: (await import('node:crypto'))
          .generateKeyPairSync('ec', { namedCurve: 'P-256' })
          .privateKey.export({ format: 'der', type: 'pkcs8' })
          .toString('base64'),
        signCount: 0,
      },
    });
    await page.addInitScript(() => {
      window.PublicKeyCredential.isConditionalMediationAvailable = async () => false;
    });
    await page.goto(`${app.baseURL}/login`);
    await page.getByRole('button', { name: 'Sign in with a passkey' }).click();
    await formError(page).waitFor();
    assert.match(await formError(page).innerText(), /didn't work here/);
    assert.equal(path(page), '/login');
    await context.close();
  });
});

describe('account page', () => {
  test('changing the password signs out other devices but keeps this one', async () => {
    const other = await newContext(app, { as: 'admin' });
    const otherPage = await other.newPage();
    await otherPage.goto(app.baseURL);

    const context = await newContext(app, { as: 'admin' });
    const page = await context.newPage();
    await page.goto(`${app.baseURL}/account`);
    assert.ok((await page.locator('li', { hasText: 'This device' }).count()) === 1);
    await page.getByLabel('Current password').fill(app.password);
    await page.getByLabel('New password').fill('a brand new phrase');
    await page.getByLabel('Type it again').fill('a brand new phrase');
    await page.getByRole('button', { name: 'Change password' }).click();
    await page.getByText(/Password saved/).waitFor();

    await otherPage.reload();
    await otherPage.waitForURL('**/login');
    await page.reload();
    assert.equal(path(page), '/account');

    // Put it back for other tests.
    await page.getByLabel('Current password').fill('a brand new phrase');
    await page.getByLabel('New password').fill(app.password);
    await page.getByLabel('Type it again').fill(app.password);
    await page.getByRole('button', { name: 'Change password' }).click();
    await page.getByText(/Password saved/).waitFor();
    await other.close();
    await context.close();
  });

  test('a wrong current password is rejected', async () => {
    const context = await newContext(app, { as: 'viewer' });
    const page = await context.newPage();
    await page.goto(`${app.baseURL}/account`);
    await page.getByLabel('Current password').fill('wrong wrong wrong');
    await page.getByLabel('New password').fill('a brand new phrase');
    await page.getByLabel('Type it again').fill('a brand new phrase');
    await page.getByRole('button', { name: 'Change password' }).click();
    assert.equal(await formError(page).innerText(), 'Your current password is not right.');
    await context.close();
  });

  test('another device can be signed out from the list', async () => {
    await (await newContext(app, { as: 'viewer' })).close(); // creates a second "e2e" session
    const context = await newContext(app, { as: 'viewer' });
    const page = await context.newPage();
    await page.goto(`${app.baseURL}/account`);
    const sessions = page.getByRole('region', { name: 'Signed-in devices' }).getByRole('listitem');
    const before = await sessions.count();
    assert.ok(before >= 2);
    await sessions.filter({ hasNotText: 'This device' }).first().getByRole('button', { name: 'Sign out' }).click();
    await page.waitForResponse('**/api/account/sessions');
    assert.equal(await sessions.count(), before - 1);
    await context.close();
  });
});

describe('first-run setup', () => {
  let fresh;
  before(async () => {
    fresh = await startApp({ users: false });
  });
  after(() => fresh?.stop());

  test('the first visitor creates the admin with the setup code; then /setup is gone', async () => {
    const context = await fresh.browser.newContext();
    const page = await context.newPage();
    await page.goto(fresh.baseURL);
    await page.waitForURL('**/login');
    await page.getByRole('link', { name: 'Set up the first admin account' }).click();
    await page.waitForURL('**/setup');

    await page.getByLabel('Setup code').fill('not the code');
    await page.getByLabel('Username').fill('dad');
    await page.getByLabel('Your name').fill('Dad');
    await page.getByLabel('Password').fill('the first admin password');
    await page.getByRole('button', { name: 'Create admin account' }).click();
    assert.equal(await formError(page).innerText(), 'That setup code is not right.');

    await page.getByLabel('Setup code').fill(SETUP_TOKEN);
    await page.getByRole('button', { name: 'Create admin account' }).click();
    await page.waitForURL('**/account?welcome=1');
    await page.getByText(/You're all set up/).waitFor();
    assert.equal((await fresh.prisma.user.findUnique({ where: { username: 'dad' } })).role, 'admin');

    const res = await page.goto(`${fresh.baseURL}/setup`);
    assert.equal(page.url(), `${fresh.baseURL}/`, 'signed-in admins are sent home');
    assert.ok(res.ok());
    const anon = await (await fresh.browser.newContext()).newPage();
    assert.equal((await anon.goto(`${fresh.baseURL}/setup`)).status(), 404);
    await context.close();
  });
});

describe('accessibility of auth pages (axe, WCAG 2.1 AA)', () => {
  for (const colorScheme of ['light', 'dark']) {
    test(`login, invite and expired-link pages (${colorScheme})`, async () => {
      const context = await newContext(app, { as: null, colorScheme });
      const page = await context.newPage();
      await page.goto(`${app.baseURL}/login`);
      assert.deepEqual(await axeViolations(page), [], 'login');
      await signInWithPassword(page, 'nobody', 'wrong password!');
      await formError(page).waitFor();
      assert.deepEqual(await axeViolations(page), [], 'login with error');
      await page.goto(`${app.baseURL}/invite/not-a-real-token-at-all`);
      assert.deepEqual(await axeViolations(page), [], 'expired link');
      await context.close();
    });

    test(`account and People pages (${colorScheme})`, async () => {
      const context = await newContext(app, { as: 'admin', colorScheme });
      const page = await context.newPage();
      await page.goto(`${app.baseURL}/account`);
      assert.deepEqual(await axeViolations(page), [], 'account');
      await page.goto(`${app.baseURL}/admin/users`);
      assert.deepEqual(await axeViolations(page), [], 'people');
      await userMenu(page).click();
      assert.deepEqual(await axeViolations(page), [], 'open user menu');
      await context.close();
    });
  }
});
