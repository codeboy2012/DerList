/**
 * Worker runtime configuration.
 *
 * Kept separate from the entrypoint so it can be unit tested without a
 * database connection or a running event loop.
 */

export interface WorkerConfig {
  pollIntervalMs: number;
  scheduleIntervalMs: number;
  batchSize: number;
}

export function readPositiveInt(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  const parsed = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function getWorkerConfig(
  env: Record<string, string | undefined> = process.env
): WorkerConfig {
  return {
    // How long to wait before polling an empty queue again.
    pollIntervalMs: readPositiveInt(env.WORKER_POLL_INTERVAL_MS, 5_000, 500, 60_000),
    // How often to enqueue products that are due for a refresh.
    scheduleIntervalMs: readPositiveInt(
      env.WORKER_SCHEDULE_INTERVAL_MS,
      15 * 60 * 1000,
      60_000,
      24 * 60 * 60 * 1000
    ),
    // Maximum jobs claimed per batch.
    batchSize: readPositiveInt(env.WORKER_BATCH_SIZE, 10, 1, 50),
  };
}
