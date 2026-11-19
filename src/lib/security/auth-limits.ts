import { checkRateLimit, type RateLimitResult } from '@/lib/security/rate-limit';

/**
 * Abuse limits for the public authentication surface.
 *
 * These are per-process like the rest of the rate limiter; a multi-replica
 * deployment needs a shared store, which is documented in the README.
 */

export const REGISTRATION_IP_LIMIT = 10;
export const REGISTRATION_IP_WINDOW_MS = 60 * 60 * 1000;
export const REGISTRATION_ACCOUNT_LIMIT = 5;
export const REGISTRATION_ACCOUNT_WINDOW_MS = 60 * 60 * 1000;

export const PASSWORD_RESET_IP_LIMIT = 5;
export const PASSWORD_RESET_IP_WINDOW_MS = 15 * 60 * 1000;
export const PASSWORD_RESET_ACCOUNT_LIMIT = 3;
export const PASSWORD_RESET_ACCOUNT_WINDOW_MS = 15 * 60 * 1000;

export const EMAIL_SEND_LIMIT = 3;
export const EMAIL_SEND_WINDOW_MS = 60 * 60 * 1000;

export interface LimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}

function decide(...results: RateLimitResult[]): LimitDecision {
  const blocked = results.find((result) => !result.allowed);
  return blocked
    ? { allowed: false, retryAfterSeconds: blocked.retryAfterSeconds }
    : { allowed: true, retryAfterSeconds: 0 };
}

/** Limit registration by client IP and by target email. */
export function checkRegistrationLimits(
  ipAddress: string,
  email: string,
  now: number = Date.now()
): LimitDecision {
  return decide(
    checkRateLimit(
      `register:ip:${ipAddress}`,
      REGISTRATION_IP_LIMIT,
      REGISTRATION_IP_WINDOW_MS,
      now
    ),
    checkRateLimit(
      `register:account:${email.trim().toLowerCase()}`,
      REGISTRATION_ACCOUNT_LIMIT,
      REGISTRATION_ACCOUNT_WINDOW_MS,
      now
    )
  );
}

/** Limit password-recovery requests by client IP and by identifier. */
export function checkPasswordResetLimits(
  ipAddress: string,
  identifier: string,
  now: number = Date.now()
): LimitDecision {
  return decide(
    checkRateLimit(
      `reset:ip:${ipAddress}`,
      PASSWORD_RESET_IP_LIMIT,
      PASSWORD_RESET_IP_WINDOW_MS,
      now
    ),
    checkRateLimit(
      `reset:account:${identifier.trim().toLowerCase()}`,
      PASSWORD_RESET_ACCOUNT_LIMIT,
      PASSWORD_RESET_ACCOUNT_WINDOW_MS,
      now
    )
  );
}

/** Limit how often one account can trigger an outgoing email. */
export function checkEmailSendLimit(userId: string, now: number = Date.now()): LimitDecision {
  return decide(
    checkRateLimit(`email:user:${userId}`, EMAIL_SEND_LIMIT, EMAIL_SEND_WINDOW_MS, now)
  );
}
