import { beforeEach, describe, expect, it } from 'vitest';
import {
  checkEmailSendLimit,
  checkPasswordResetLimits,
  checkRegistrationLimits,
  EMAIL_SEND_LIMIT,
  PASSWORD_RESET_ACCOUNT_LIMIT,
  PASSWORD_RESET_IP_LIMIT,
  REGISTRATION_ACCOUNT_LIMIT,
  REGISTRATION_IP_LIMIT,
} from '@/lib/security/auth-limits';
import { clearRateLimits } from '@/lib/security/rate-limit';

describe('public auth abuse limits', () => {
  const now = 1_000_000;

  beforeEach(() => clearRateLimits());

  it('limits registration by IP', () => {
    for (let attempt = 0; attempt < REGISTRATION_IP_LIMIT; attempt += 1) {
      expect(
        checkRegistrationLimits('203.0.113.5', `user${attempt}@example.test`, now).allowed
      ).toBe(true);
    }

    const blocked = checkRegistrationLimits('203.0.113.5', 'another@example.test', now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('limits repeated registrations against the same email across IPs', () => {
    for (let attempt = 0; attempt < REGISTRATION_ACCOUNT_LIMIT; attempt += 1) {
      expect(
        checkRegistrationLimits(`198.51.100.${attempt}`, 'Target@Example.test', now).allowed
      ).toBe(true);
    }

    expect(checkRegistrationLimits('198.51.100.99', 'target@example.test', now).allowed).toBe(
      false
    );
  });

  it('limits password recovery by IP and account', () => {
    for (let attempt = 0; attempt < PASSWORD_RESET_IP_LIMIT; attempt += 1) {
      expect(
        checkPasswordResetLimits('203.0.113.9', `acct${attempt}@example.test`, now).allowed
      ).toBe(true);
    }
    expect(checkPasswordResetLimits('203.0.113.9', 'fresh@example.test', now).allowed).toBe(false);

    clearRateLimits();

    for (let attempt = 0; attempt < PASSWORD_RESET_ACCOUNT_LIMIT; attempt += 1) {
      expect(
        checkPasswordResetLimits(`203.0.113.${attempt + 20}`, 'same@example.test', now).allowed
      ).toBe(true);
    }
    expect(checkPasswordResetLimits('203.0.113.99', 'same@example.test', now).allowed).toBe(false);
  });

  it('limits how often one account can trigger email', () => {
    for (let attempt = 0; attempt < EMAIL_SEND_LIMIT; attempt += 1) {
      expect(checkEmailSendLimit('user-1', now).allowed).toBe(true);
    }
    expect(checkEmailSendLimit('user-1', now).allowed).toBe(false);
    expect(checkEmailSendLimit('user-2', now).allowed).toBe(true);
  });

  it('allows requests again after the window', () => {
    for (let attempt = 0; attempt < REGISTRATION_IP_LIMIT; attempt += 1) {
      checkRegistrationLimits('203.0.113.7', `window${attempt}@example.test`, now);
    }

    expect(
      checkRegistrationLimits('203.0.113.7', 'later@example.test', now + 60 * 60 * 1000 + 1).allowed
    ).toBe(true);
  });
});
