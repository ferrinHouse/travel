import { PrismaClient } from '@prisma/client';

let prisma;

if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL || 'file:./dev.db',
      },
    },
  });
} else {
  if (!global.prisma) {
    global.prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL || 'file:./dev.db',
        },
      },
    });
  }
  prisma = global.prisma;
}

export default prisma;
