/**
 * Worker — processes claimed jobs from the queue.
 *
 * Can be invoked:
 * - Inline (from a server action for manual refresh)
 * - From a cron endpoint
 * - From a CLI script
 * - From a separate worker container
 */

import { claimJobs, completeJob, failJob } from './queue';
import { syncProduct } from './product-sync';

/** Rate limit: minimum delay between job executions (ms). */
const JOB_DELAY_MS = 1000;

/**
 * Process a batch of pending jobs.
 *
 * @param batchSize Number of jobs to claim and process per run.
 * @returns Number of jobs processed.
 */
export async function processJobs(batchSize: number = 10): Promise<number> {
  const jobs = await claimJobs(batchSize);

  if (jobs.length === 0) return 0;

  let processed = 0;

  for (const job of jobs) {
    try {
      const result = await syncProduct(job.productId);

      if (result.success) {
        await completeJob(job.id);
      } else {
        await failJob(job.id, result.error ?? 'Unknown error');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected worker error';
      await failJob(job.id, message);
    }

    processed++;

    // Rate limiting between jobs
    if (processed < jobs.length) {
      await sleep(JOB_DELAY_MS);
    }
  }

  return processed;
}

/**
 * Run the worker continuously until no more jobs are available.
 * Useful for cron/CLI invocations that should drain the queue.
 *
 * @param maxIterations Safety limit to prevent infinite loops.
 */
export async function drainQueue(maxIterations: number = 100): Promise<number> {
  let totalProcessed = 0;
  let iteration = 0;

  while (iteration < maxIterations) {
    const processed = await processJobs(10);
    totalProcessed += processed;

    if (processed === 0) break; // Queue is empty

    iteration++;
    await sleep(500); // Brief pause between batches
  }

  return totalProcessed;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
