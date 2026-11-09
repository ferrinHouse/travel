// Boots the production build (`next start`) against a throwaway database for
// end-to-end tests. Run `npm run build` first (npm run test:e2e does this).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { chromium } from 'playwright';
import { createDbFile, ROOT } from '../../support/test-db.mjs';
import { daysFromToday, seedTrip } from '../../support/fixtures.mjs';
import { createUser, PASSWORD } from '../../support/users.mjs';
import { startSession } from '../../../src/lib/api/auth.js';

const NEXT_BIN = path.join(ROOT, 'node_modules', 'next', 'dist', 'bin', 'next');

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function waitForHealthy(baseURL, child, output) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`next start exited early:\n${output()}`);
    try {
      const res = await fetch(`${baseURL}/api/health`);
      if (res.ok) return;
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Server did not become healthy:\n${output()}`);
}

export const SETUP_TOKEN = 'e2e-setup-token';
export const ROLES = ['viewer', 'member', 'admin'];

/**
 * Starts the app with two seeded trips: "testville" (upcoming) and "oldtown"
 * (past), and one user per role (usernames = role names, password PASSWORD).
 * Pass { users: false } for a brand-new site with nobody signed up yet.
 *
 * The browser talks to http://localhost:<port> (passkeys need a real hostname,
 * not an IP), mapped to 127.0.0.1 inside Chromium; Node-side fetches use
 * `apiURL` (127.0.0.1) to avoid IPv6 lookups.
 *
 * Returns { baseURL, apiURL, users, password, prisma, browser, stop }.
 */
export async function startApp({ users: withUsers = true } = {}) {
  if (!fs.existsSync(path.join(ROOT, '.next', 'BUILD_ID'))) {
    throw new Error('No production build found. Run `npm run build` (or `npm run test:e2e`).');
  }

  const db = createDbFile();
  const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: db.url }) });
  await seedTrip(prisma);
  await seedTrip(prisma, {
    id: 'oldtown',
    name: 'Oldtown Memories',
    startDate: daysFromToday(-40),
    endDate: daysFromToday(-35),
    status: 'past',
  });
  const users = {};
  if (withUsers) {
    for (const role of ROLES) users[role] = await createUser(prisma, { username: role, role, displayName: `${role[0].toUpperCase()}${role.slice(1)} Ferrin` });
  }

  const port = await freePort();
  const baseURL = `http://localhost:${port}`;
  const apiURL = `http://127.0.0.1:${port}`;
  let log = '';
  const child = spawn(process.execPath, [NEXT_BIN, 'start', '-p', String(port), '-H', '127.0.0.1'], {
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      DATABASE_URL: db.url,
      APP_ORIGIN: baseURL,
      SETUP_TOKEN,
      // Photos go next to the throwaway database and are removed with it.
      UPLOADS_DIR: path.join(db.dir, 'uploads'),
      NEXT_TELEMETRY_DISABLED: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => (log += d));
  child.stderr.on('data', (d) => (log += d));

  try {
    await waitForHealthy(apiURL, child, () => log);
  } catch (err) {
    child.kill();
    await prisma.$disconnect();
    throw err;
  }

  const browser = await chromium.launch({ args: [`--host-resolver-rules=MAP localhost 127.0.0.1`] });

  return {
    baseURL,
    apiURL,
    uploadsDir: path.join(db.dir, 'uploads'),
    users,
    password: PASSWORD,
    prisma,
    browser,
    serverLog: () => log,
    async stop() {
      await browser.close();
      await prisma.$disconnect();
      await new Promise((resolve) => {
        if (child.exitCode !== null) return resolve();
        child.once('exit', resolve);
        child.kill();
      });
      db.remove();
    },
  };
}

/** A fresh session token for a seeded user (straight in the DB: no login rate limit). */
export async function sessionToken(app, role) {
  const { token } = await startSession(app.prisma, app.users[role], { userAgent: 'e2e' });
  return token;
}

/** `Cookie` header value for Node-side fetches as `role`. */
export const sessionCookieHeader = async (app, role) => `travel_session=${await sessionToken(app, role)}`;

/** Signs a browser context in as `role` (viewer | member | admin). */
export async function signInContext(app, context, role) {
  await context.addCookies([{ name: 'travel_session', value: await sessionToken(app, role), url: app.baseURL, httpOnly: true, sameSite: 'Lax' }]);
}

/** A browser context, signed in as `as` (default member; null = signed out). */
export async function newContext(app, { as = 'member', ...options } = {}) {
  const context = await app.browser.newContext(options);
  if (as) await signInContext(app, context, as);
  return context;
}

/** Opens a page on a fresh context and waits until the network is idle. */
export async function openPage(app, urlPath, { context, viewport, as } = {}) {
  const ctx = context ?? (await newContext(app, { as, viewport: viewport ?? { width: 1280, height: 900 } }));
  const page = await ctx.newPage();
  await page.goto(`${app.baseURL}${urlPath}`);
  await page.waitForLoadState('networkidle');
  return { page, context: ctx };
}
