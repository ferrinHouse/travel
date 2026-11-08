// Throwaway SQLite databases for tests.
//
// The schema is pushed once into a template file (cached per schema.prisma
// hash under node_modules/.cache), then each test copies the template, so a
// test file gets a fresh database in milliseconds.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CACHE_DIR = path.join(ROOT, 'node_modules', '.cache', 'travel-tests');
const PRISMA_CLI = path.join(ROOT, 'node_modules', 'prisma', 'build', 'index.js');

const toUrl = (file) => `file:${file.replace(/\\/g, '/')}`;

function templateFile() {
  const schema = fs.readFileSync(path.join(ROOT, 'prisma', 'schema.prisma'));
  const hash = createHash('sha256').update(schema).digest('hex').slice(0, 16);
  return path.join(CACHE_DIR, `template-${hash}.db`);
}

export function ensureTemplate() {
  const template = templateFile();
  if (fs.existsSync(template)) return template;

  fs.mkdirSync(CACHE_DIR, { recursive: true });
  // Push into a unique temp file and rename, so parallel test processes can't
  // see a half-written template.
  const tmp = `${template}.${process.pid}.${Date.now()}.tmp`;
  execFileSync(process.execPath, [PRISMA_CLI, 'db', 'push'], {
    cwd: ROOT,
    env: { ...process.env, DATABASE_URL: toUrl(tmp) },
    stdio: 'pipe',
  });
  try {
    fs.renameSync(tmp, template);
  } catch (err) {
    if (!fs.existsSync(template)) throw err;
    fs.rmSync(tmp, { force: true });
  }
  return template;
}

/** Copies the template into a new temp dir. Returns { file, url, dir, remove }. */
export function createDbFile() {
  const template = ensureTemplate();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'travel-test-'));
  const file = path.join(dir, 'test.db');
  fs.copyFileSync(template, file);
  return {
    file,
    dir,
    url: toUrl(file),
    remove: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}

/** A fresh database plus a connected Prisma client. Call cleanup() in after(). */
export async function createTestDb() {
  const db = createDbFile();
  const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: db.url }) });
  return {
    prisma,
    url: db.url,
    file: db.file,
    async cleanup() {
      await prisma.$disconnect();
      db.remove();
    },
  };
}
