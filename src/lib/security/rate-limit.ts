/**
 * Lightweight fixed-window rate limiter.
 *
 * Scope: per Node.js process. This is sufficient for the single-instance
 * Docker deployment this project targets, and it is a strict improvement over
 * having no limit at all. A multi-replica deployment must replace the Map with
 * a shared store (Redis/Postgres); the call sites do not need to change.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const MAX_TRACKED_KEYS = 10_000;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

function prune(now: number): void {
  if (buckets.size <= MAX_TRACKED_KEYS) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now()
): RateLimitResult {
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    prune(now);
    return { allowed: true, remaining: Math.max(0, limit - 1), retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSeconds: 0,
  };
}

export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

/** Test helper — clears all buckets. */
export function clearRateLimits(): void {
  buckets.clear();
}
