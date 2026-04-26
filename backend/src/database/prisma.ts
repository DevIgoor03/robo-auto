import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? [{ emit: 'event', level: 'query' }, 'warn', 'error']
      : ['warn', 'error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Log slow queries in development
if (process.env.NODE_ENV === 'development') {
  (prisma as any).$on('query', (e: any) => {
    if (e.duration > 200) {
      logger.warn({ query: e.query, duration: e.duration }, 'Slow query detected');
    }
  });
}

export async function connectDb(): Promise<void> {
  await prisma.$connect();
  logger.info('PostgreSQL connected via Prisma');
}

export async function disconnectDb(): Promise<void> {
  await prisma.$disconnect();
  logger.info('PostgreSQL disconnected');
}
