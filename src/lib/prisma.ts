import { Pool } from 'pg';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma client singleton with pg driver adapter (required in Prisma 7).
 *
 * In development, Next.js hot-reloads modules which would create a new
 * PrismaClient on every reload, eventually exhausting database connections.
 * We attach the instance to `globalThis` so it persists across reloads.
 *
 * In production a single instance is created at module load time.
 */

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function createPrismaClient(): PrismaClient {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
