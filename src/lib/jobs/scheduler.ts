/**
 * Scheduler — determines which products need refreshing and queues them.
 *
 * Scheduling tiers:
 * - Recently fetched (< 6 hours): skip
 * - Normal products: refresh every 24 hours
 * - Products with wishlist items (popular): refresh every 12 hours
 *
 * The scheduler is designed to be called periodically (e.g. every 15 minutes
 * via cron) and will queue products that are due for a refresh.
 */

import { prisma } from '@/lib/prisma';
import { enqueueMultipleRefresh } from './queue';

/** Products with a wishlist item refresh more frequently. */
const POPULAR_REFRESH_HOURS = 12;

/** All other imported products refresh at this interval. */
const NORMAL_REFRESH_HOURS = 24;

/** Maximum products to schedule per run (prevents overload). */
const MAX_SCHEDULE_BATCH = 50;

/**
 * Schedule products that are due for a refresh.
 *
 * @returns Number of products queued.
 */
export async function scheduleProductRefreshes(): Promise<number> {
  const now = new Date();

  // Find imported products that need refreshing (have a canonical URL)
  // Priority 1: Popular products (referenced by wishlist items) due for refresh
  const popularThreshold = new Date(now.getTime() - POPULAR_REFRESH_HOURS * 60 * 60 * 1000);
  const normalThreshold = new Date(now.getTime() - NORMAL_REFRESH_HOURS * 60 * 60 * 1000);

  const productsToRefresh = await prisma.product.findMany({
    where: {
      source: 'IMPORTED',
      canonicalUrl: { not: null },
      OR: [
        // Popular products (have wishlist items) past their refresh window
        {
          wishlistItems: { some: {} },
          OR: [
            { lastFetchedAt: null },
            { lastFetchedAt: { lt: popularThreshold } },
          ],
        },
        // Normal products past their refresh window
        {
          OR: [
            { lastFetchedAt: null },
            { lastFetchedAt: { lt: normalThreshold } },
          ],
        },
      ],
    },
    orderBy: [
      // Prioritize products that have never been fetched
      { lastFetchedAt: 'asc' },
    ],
    take: MAX_SCHEDULE_BATCH,
    select: { id: true },
  });

  if (productsToRefresh.length === 0) return 0;

  const productIds = productsToRefresh.map((p) => p.id);
  return enqueueMultipleRefresh(productIds);
}

/**
 * Get scheduler status for admin display.
 */
export async function getSchedulerStatus() {
  const now = new Date();
  const normalThreshold = new Date(now.getTime() - NORMAL_REFRESH_HOURS * 60 * 60 * 1000);

  const [totalImported, needsRefresh, neverFetched] = await Promise.all([
    prisma.product.count({ where: { source: 'IMPORTED', canonicalUrl: { not: null } } }),
    prisma.product.count({
      where: {
        source: 'IMPORTED',
        canonicalUrl: { not: null },
        OR: [
          { lastFetchedAt: null },
          { lastFetchedAt: { lt: normalThreshold } },
        ],
      },
    }),
    prisma.product.count({
      where: { source: 'IMPORTED', canonicalUrl: { not: null }, lastFetchedAt: null },
    }),
  ]);

  return { totalImported, needsRefresh, neverFetched };
}
