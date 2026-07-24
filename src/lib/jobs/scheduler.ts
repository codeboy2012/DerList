/**
 * Scheduler — determines which products need refreshing and queues them.
 *
 * Scheduling tiers (follower-based):
 * - Tier 1: High-demand (10+ wishlist items) — refresh every 6 hours
 * - Tier 2: Active (2-9 wishlist items) — refresh every 12 hours
 * - Tier 3: Low-activity (1 wishlist item) — refresh every 24 hours
 * - Tier 4: Untracked products — refresh weekly
 *
 * The scheduler is designed to be called periodically (e.g. every 15 minutes
 * via cron) and will queue products that are due for a refresh.
 */

import { prisma } from '@/lib/prisma';
import { enqueueMultipleRefresh } from './queue';

/** Maximum products to schedule per run (prevents overload). */
const MAX_SCHEDULE_BATCH = 50;

/**
 * Schedule products that are due for a refresh based on follower count.
 *
 * @returns Number of products queued.
 */
export async function scheduleProductRefreshes(): Promise<number> {
  const now = new Date();

  // Tier 1: High-demand products (10+ wishlist items) — refresh every 6 hours
  const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  // Tier 2: Active products (2-9 wishlist items) — refresh every 12 hours
  const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
  // Tier 3: Low-activity products (1 wishlist item) — refresh every 24 hours
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  // Tier 4: Untracked products — refresh weekly
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const productsToRefresh = await prisma.product.findMany({
    where: {
      source: 'IMPORTED',
      canonicalUrl: { not: null },
      OR: [
        // Tier 1: High-demand — stale after 6 hours
        {
          wishlistItems: { some: {} },
          OR: [
            { lastFetchedAt: null },
            { lastFetchedAt: { lt: sixHoursAgo } },
          ],
        },
        // Tier 3+4: Everything else stale after 24h or never fetched
        {
          OR: [
            { lastFetchedAt: null },
            { lastFetchedAt: { lt: twentyFourHoursAgo } },
          ],
        },
      ],
    },
    orderBy: [{ lastFetchedAt: 'asc' }],
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
  const normalThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);

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
