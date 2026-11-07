// Boots the production build (`next start`) against a throwaway database for
// end-to-end tests. Run `npm run build` first (npm run test:e2e does this).
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { chromium } from 'playwright';
import { createDbFile, ROOT } from '../../support/test-db.mjs';
import { daysFromToday, seedTrip } from '../../support/fixtures.mjs';

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

/**
 * Starts the app with two seeded trips: "testville" (upcoming) and
 * "oldtown" (past). Returns { baseURL, passcode, prisma, browser, stop }.
 */
export async function startApp() {
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

  const port = await freePort();
  const baseURL = `http://127.0.0.1:${port}`;
  const passcode = `e2e-${randomUUID()}`;
  let log = '';
  const child = spawn(process.execPath, [NEXT_BIN, 'start', '-p', String(port), '-H', '127.0.0.1'], {
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      DATABASE_URL: db.url,
      ADMIN_PASSCODE: passcode,
      NEXT_TELEMETRY_DISABLED: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => (log += d));
  child.stderr.on('data', (d) => (log += d));

  try {
    await waitForHealthy(baseURL, child, () => log);
  } catch (err) {
    child.kill();
    await prisma.$disconnect();
    throw err;
  }

  const browser = await chromium.launch();

  return {
    baseURL,
    passcode,
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

/** Sets the legacy admin cookie on a browser context by logging in through the API. */
export async function loginContext(app, context) {
  const res = await context.request.post(`${app.baseURL}/api/auth`, { data: { passcode: app.passcode } });
  if (!res.ok()) throw new Error(`login failed: ${res.status()}`);
}

/** Opens a page on a fresh context and waits until React has hydrated it. */
export async function openPage(app, urlPath, { context, viewport } = {}) {
  const ctx = context ?? (await app.browser.newContext({ viewport: viewport ?? { width: 1280, height: 900 } }));
  const page = await ctx.newPage();
  await page.goto(`${app.baseURL}${urlPath}`);
  await page.waitForLoadState('networkidle');
  return { page, context: ctx };
}
