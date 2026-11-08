/**
 * DerList background worker.
 *
 * Runs the refresh scheduler and drains the durable job queue. Safe to run as
 * a single long-lived service:
 *
 * - A PostgreSQL advisory lock guarantees only one worker processes jobs, even
 *   if the container is accidentally scaled or a cron invocation overlaps.
 * - Jobs stuck in RUNNING after a crash are recovered back to PENDING.
 * - SIGTERM/SIGINT finish the current batch, release the lock and disconnect.
 *
 * Usage:
 *   tsx scripts/worker.ts          # run continuously
 *   tsx scripts/worker.ts --once   # schedule + drain, then exit (cron/testing)
 */

import { Client } from 'pg';
import { recoverStaleJobs } from '../src/lib/jobs/queue';
import { scheduleProductRefreshes } from '../src/lib/jobs/scheduler';
import { processJobs } from '../src/lib/jobs/worker';
import { getWorkerConfig } from '../src/lib/jobs/worker-runtime';
import { prisma } from '../src/lib/prisma';

const WORKER_LOCK_KEY = 815_317_001;
const ONCE = process.argv.includes('--once');
const config = getWorkerConfig();

function log(message: string, data: Record<string, unknown> = {}): void {
  console.log(
    JSON.stringify({
      scope: 'derlist-worker',
      message,
      ...data,
      time: new Date().toISOString(),
    })
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function acquireLock(): Promise<Client | null> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to run the worker.');
  }

  const client = new Client({ connectionString });
  await client.connect();

  const result = await client.query<{ locked: boolean }>(
    'SELECT pg_try_advisory_lock($1) AS locked',
    [WORKER_LOCK_KEY]
  );

  if (!result.rows[0]?.locked) {
    await client.end();
    return null;
  }

  return client;
}

async function releaseLock(client: Client): Promise<void> {
  try {
    await client.query('SELECT pg_advisory_unlock($1)', [WORKER_LOCK_KEY]);
  } catch {
    // The connection may already be gone; PostgreSQL releases session locks.
  }
  await client.end().catch(() => undefined);
}

async function runOnce(): Promise<void> {
  const recovered = await recoverStaleJobs();
  const scheduled = await scheduleProductRefreshes();

  let processed = 0;
  for (let i = 0; i < 100; i++) {
    const batch = await processJobs(config.batchSize);
    if (batch === 0) break;
    processed += batch;
  }

  log('worker.once.complete', { recovered, scheduled, processed });
}

async function runForever(): Promise<void> {
  let shuttingDown = false;
  let lastScheduleAt = 0;

  const lock = await acquireLock();
  if (!lock) {
    log('worker.lock.held_elsewhere', { lockKey: WORKER_LOCK_KEY });
    return;
  }

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    log('worker.shutdown', { signal });
    await releaseLock(lock);
    await prisma.$disconnect().catch(() => undefined);
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  const recovered = await recoverStaleJobs();
  log('worker.started', { ...config, recovered });

  while (!shuttingDown) {
    try {
      if (Date.now() - lastScheduleAt >= config.scheduleIntervalMs) {
        lastScheduleAt = Date.now();
        const queued = await scheduleProductRefreshes();
        log('scheduler.run', { queued });
      }

      const processed = await processJobs(config.batchSize);
      if (processed > 0) {
        log('worker.batch.complete', { processed });
      } else {
        await sleep(config.pollIntervalMs);
      }
    } catch (error) {
      log('worker.loop.error', { error: errorMessage(error) });
      await sleep(config.pollIntervalMs);
    }
  }
}

async function main(): Promise<void> {
  if (ONCE) {
    const lock = await acquireLock();
    if (!lock) {
      log('worker.lock.held_elsewhere', { lockKey: WORKER_LOCK_KEY });
      return;
    }

    try {
      await runOnce();
    } finally {
      await releaseLock(lock);
      await prisma.$disconnect().catch(() => undefined);
    }
    return;
  }

  await runForever();
}

main().catch((error) => {
  log('worker.fatal', { error: errorMessage(error) });
  process.exitCode = 1;
});
