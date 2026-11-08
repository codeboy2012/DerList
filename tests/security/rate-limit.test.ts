import { beforeEach, describe, expect, it } from 'vitest';
import { checkRateLimit, clearRateLimits, resetRateLimit } from '@/lib/security/rate-limit';

describe('checkRateLimit', () => {
  beforeEach(() => clearRateLimits());

  it('allows requests up to the limit and blocks the next one', () => {
    const now = 1_000_000;

    expect(checkRateLimit('login:1', 3, 60_000, now).allowed).toBe(true);
    expect(checkRateLimit('login:1', 3, 60_000, now).allowed).toBe(true);
    expect(checkRateLimit('login:1', 3, 60_000, now).allowed).toBe(true);

    const blocked = checkRateLimit('login:1', 3, 60_000, now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(60);
  });

  it('resets after the window elapses', () => {
    const start = 1_000_000;
    checkRateLimit('ai:user', 1, 60_000, start);
    expect(checkRateLimit('ai:user', 1, 60_000, start + 30_000).allowed).toBe(false);
    expect(checkRateLimit('ai:user', 1, 60_000, start + 60_001).allowed).toBe(true);
  });

  it('isolates keys from each other', () => {
    checkRateLimit('a', 1, 60_000, 1_000_000);
    expect(checkRateLimit('b', 1, 60_000, 1_000_000).allowed).toBe(true);
  });

  it('can be reset explicitly after a successful login', () => {
    const now = 1_000_000;
    checkRateLimit('login:email', 1, 60_000, now);
    resetRateLimit('login:email');
    expect(checkRateLimit('login:email', 1, 60_000, now).allowed).toBe(true);
  });
});
