/**
 * Job Queue — manages product fetch jobs in PostgreSQL.
 *
 * Uses the ProductFetchJob table as a durable queue. Supports:
 * - Enqueuing new jobs (with deduplication)
 * - Claiming jobs for processing (atomic status transition)
 * - Marking jobs complete or failed
 * - Retry with exponential backoff
 */

import { prisma } from '@/lib/prisma';

const MAX_ATTEMPTS = 5;

/** Base delay between retries (doubles each attempt). */
const BASE_RETRY_DELAY_MS = 60_000; // 1 minute

// ─────────────────────────────────────────────────────────────────────────────
// Enqueue
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Queue a product for refresh. Deduplicates — won't create a new job if
 * a PENDING or RUNNING job already exists for this product.
 */
export async function enqueueProductRefresh(
  productId: string,
  runAt?: Date,
): Promise<string | null> {
  // Check for existing pending/running job
  const existing = await prisma.productFetchJob.findFirst({
    where: {
      productId,
      status: { in: ['PENDING', 'RUNNING'] },
    },
    select: { id: true },
  });

  if (existing) return existing.id;

  const job = await prisma.productFetchJob.create({
    data: {
      productId,
      status: 'PENDING',
      nextRunAt: runAt ?? new Date(),
    },
  });

  return job.id;
}

/**
 * Queue multiple products for refresh (batch).
 * Skips products that already have pending/running jobs.
 */
export async function enqueueMultipleRefresh(productIds: string[]): Promise<number> {
  // Find products already queued
  const existingJobs = await prisma.productFetchJob.findMany({
    where: {
      productId: { in: productIds },
      status: { in: ['PENDING', 'RUNNING'] },
    },
    select: { productId: true },
  });
  const queuedIds = new Set(existingJobs.map((j) => j.productId));

  const toQueue = productIds.filter((id) => !queuedIds.has(id));
  if (toQueue.length === 0) return 0;

  const result = await prisma.productFetchJob.createMany({
    data: toQueue.map((productId) => ({
      productId,
      status: 'PENDING' as const,
      nextRunAt: new Date(),
    })),
  });

  return result.count;
}

// ─────────────────────────────────────────────────────────────────────────────
// Claim
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Claim the next batch of jobs ready for processing.
 * Atomically transitions them from PENDING to RUNNING.
 *
 * @param limit Maximum number of jobs to claim at once.
 */
export async function claimJobs(limit: number = 10) {
  const now = new Date();

  // Find eligible jobs
  const jobs = await prisma.productFetchJob.findMany({
    where: {
      status: 'PENDING',
      nextRunAt: { lte: now },
    },
    orderBy: { nextRunAt: 'asc' },
    take: limit,
    select: { id: true, productId: true, attempts: true },
  });

  if (jobs.length === 0) return [];

  // Mark as RUNNING
  await prisma.productFetchJob.updateMany({
    where: { id: { in: jobs.map((j) => j.id) } },
    data: { status: 'RUNNING', startedAt: now, attempts: { increment: 1 } },
  });

  return jobs;
}

// ─────────────────────────────────────────────────────────────────────────────
// Complete / Fail
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mark a job as successfully completed.
 */
export async function completeJob(jobId: string): Promise<void> {
  await prisma.productFetchJob.update({
    where: { id: jobId },
    data: { status: 'SUCCESS', finishedAt: new Date(), error: null },
  });
}

/**
 * Mark a job as failed. If retries remain, reschedule with exponential backoff.
 * If max attempts reached, mark as permanently FAILED.
 */
export async function failJob(jobId: string, error: string): Promise<void> {
  const job = await prisma.productFetchJob.findUnique({
    where: { id: jobId },
    select: { attempts: true },
  });

  if (!job) return;

  if (job.attempts < MAX_ATTEMPTS) {
    // Reschedule with exponential backoff
    const delayMs = BASE_RETRY_DELAY_MS * Math.pow(2, job.attempts - 1);
    const nextRunAt = new Date(Date.now() + delayMs);

    await prisma.productFetchJob.update({
      where: { id: jobId },
      data: { status: 'PENDING', error, nextRunAt },
    });
  } else {
    // Max attempts reached — permanent failure
    await prisma.productFetchJob.update({
      where: { id: jobId },
      data: { status: 'FAILED', error, finishedAt: new Date() },
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats
// ─────────────────────────────────────────────────────────────────────────────

export async function getQueueStats() {
  const [pending, running, failed, successToday] = await Promise.all([
    prisma.productFetchJob.count({ where: { status: 'PENDING' } }),
    prisma.productFetchJob.count({ where: { status: 'RUNNING' } }),
    prisma.productFetchJob.count({ where: { status: 'FAILED' } }),
    prisma.productFetchJob.count({
      where: {
        status: 'SUCCESS',
        finishedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    }),
  ]);
  return { pending, running, failed, successToday };
}
