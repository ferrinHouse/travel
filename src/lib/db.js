import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

// Production keeps SQLite on an NFS volume. Do NOT enable WAL journal mode:
// WAL relies on shared memory that NFS can't provide, which corrupts the DB.
// For the same reason the deployment runs one replica with a Recreate strategy.

let prisma;

if (process.env.NODE_ENV === 'production') {
  const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL || 'file:./dev.db' });
  prisma = new PrismaClient({ adapter });
} else {
  if (!global.prisma) {
    const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL || 'file:./dev.db' });
    global.prisma = new PrismaClient({ adapter });
  }
  prisma = global.prisma;
}

export default prisma;
