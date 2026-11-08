import { describe, expect, it } from 'vitest';
import { getWorkerConfig, readPositiveInt } from '@/lib/jobs/worker-runtime';

describe('readPositiveInt', () => {
  it('uses the fallback for missing or non-numeric values', () => {
    expect(readPositiveInt(undefined, 5000, 500, 60_000)).toBe(5000);
    expect(readPositiveInt('nope', 5000, 500, 60_000)).toBe(5000);
  });

  it('clamps values into the allowed range', () => {
    expect(readPositiveInt('10', 5000, 500, 60_000)).toBe(500);
    expect(readPositiveInt('999999', 5000, 500, 60_000)).toBe(60_000);
    expect(readPositiveInt('3000', 5000, 500, 60_000)).toBe(3000);
  });
});

describe('getWorkerConfig', () => {
  it('provides safe defaults', () => {
    expect(getWorkerConfig({})).toEqual({
      pollIntervalMs: 5000,
      scheduleIntervalMs: 900_000,
      batchSize: 10,
    });
  });

  it('reads environment overrides and clamps the batch size', () => {
    const config = getWorkerConfig({
      WORKER_POLL_INTERVAL_MS: '1500',
      WORKER_SCHEDULE_INTERVAL_MS: '60000',
      WORKER_BATCH_SIZE: '999',
    });

    expect(config.pollIntervalMs).toBe(1500);
    expect(config.scheduleIntervalMs).toBe(60_000);
    expect(config.batchSize).toBe(50);
  });
});
