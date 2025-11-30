import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger.js';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

// Log connection status
prisma.$connect().then(() => {
  logger.info('Database connected');
}).catch((error) => {
  logger.error({ error }, 'Database connection failed');
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export type { PrismaClient };
