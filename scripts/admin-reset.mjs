#!/usr/bin/env node
// Lockout recovery: prints a one-time password-reset link for a user.
//
//   kubectl exec -n <ns> deploy/travel-site-deployment -- node scripts/admin-reset.mjs <username> [--make-admin]
//
// --make-admin also gives the account admin rights and turns it back on.
// Self-contained: the production image has no src/ and no Prisma adapter outside
// the Next bundle, so this talks to SQLite with better-sqlite3 directly, writing
// rows in the same format Prisma uses (ISO dates with +00:00, booleans as 0/1).
// Never enables WAL (the database lives on NFS).
import { createHash, randomBytes } from 'node:crypto';
import Database from 'better-sqlite3';

const LINK_DAYS = 2;
const args = process.argv.slice(2);
const makeAdmin = args.includes('--make-admin');
const username = args.find((a) => !a.startsWith('--'))?.trim().toLowerCase();

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!username) fail('Usage: node scripts/admin-reset.mjs <username> [--make-admin]');

const file = (process.env.DATABASE_URL || 'file:./dev.db').replace(/^file:/, '');
const db = new Database(file, { fileMustExist: true });
const iso = (date) => date.toISOString().replace('Z', '+00:00');

try {
  let user = db.prepare('SELECT * FROM "User" WHERE username = ?').get(username);
  if (!user) {
    const names = db.prepare('SELECT username FROM "User" ORDER BY username').all().map((u) => u.username);
    fail(`No user "${username}". Existing users: ${names.join(', ') || '(none; use /setup)'}`);
  }
  if (makeAdmin) {
    db.prepare(`UPDATE "User" SET role = 'admin', isActive = 1 WHERE id = ?`).run(user.id);
    user = { ...user, role: 'admin', isActive: 1 };
  } else if (!user.isActive) {
    fail(`"${username}" is turned off. Re-run with --make-admin to turn it back on as an admin.`);
  }

  const token = randomBytes(32).toString('base64url');
  const now = new Date();
  const expires = new Date(now.getTime() + LINK_DAYS * 24 * 60 * 60 * 1000);
  db.transaction(() => {
    db.prepare('UPDATE "Invite" SET usedAt = ? WHERE userId = ? AND usedAt IS NULL').run(iso(now), user.id);
    db.prepare('INSERT INTO "Invite" (id, userId, purpose, createdAt, expiresAt) VALUES (?, ?, ?, ?, ?)').run(
      createHash('sha256').update(token).digest('hex'),
      user.id,
      user.passwordHash ? 'reset' : 'invite',
      iso(now),
      iso(expires),
    );
  })();

  const origin = (process.env.APP_ORIGIN || '').replace(/\/+$/, '');
  console.log(`Reset link for ${user.displayName} (@${user.username}, ${user.role}), valid ${LINK_DAYS} days, works once:`);
  console.log(`${origin}/invite/${token}`);
} finally {
  db.close();
}
