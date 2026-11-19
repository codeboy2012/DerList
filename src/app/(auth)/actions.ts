'use server';

import { redirect } from 'next/navigation';
import { findUserByIdentifier } from '@/lib/auth/identity';
import { hasPassword, verifyPassword } from '@/lib/auth/password';
import {
  clearSessionCookie,
  createSession,
  getSessionToken,
  invalidateSession,
  setSessionCookie,
} from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { checkRateLimit, resetRateLimit } from '@/lib/security/rate-limit';
import { getRequestContext } from '@/lib/security/request';
import { loginSchema } from '@/lib/validations/auth';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ActionState = {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

// ─────────────────────────────────────────────────────────────────────────────
// Login action
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Server Action: Authenticate a user with an email address or username.
 *
 * Security considerations:
 * - Generic error message on failure to prevent user enumeration
 * - Checks disabled flag before granting session
 * - Records IP and User-Agent for audit trail
 * - Updates lastLoginAt timestamp
 */
export async function loginAction(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const raw = {
    identifier: formData.get('identifier'),
    password: formData.get('password'),
  };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const identifier = parsed.data.identifier.trim().toLowerCase();
  const { password } = parsed.data;

  // ── Brute-force protection ──
  // Limit both per-IP (spraying) and per-identifier (targeted guessing).
  const { ipAddress, userAgent } = await getRequestContext();
  const ipKey = `login:ip:${ipAddress}`;
  const accountKey = `login:account:${ipAddress}:${identifier}`;

  if (!checkRateLimit(ipKey, 20, 15 * 60 * 1000).allowed) {
    return { success: false, error: 'Too many login attempts. Try again later.' };
  }
  if (!checkRateLimit(accountKey, 5, 15 * 60 * 1000).allowed) {
    return { success: false, error: 'Too many login attempts. Try again later.' };
  }

  const user = await findUserByIdentifier(identifier);

  // Generic error to prevent user enumeration.
  const invalidCredentialsError: ActionState = {
    success: false,
    error: 'Invalid email/username or password.',
  };

  if (!user || !hasPassword(user.passwordHash)) {
    return invalidCredentialsError;
  }

  if (user.disabled) {
    return {
      success: false,
      error: 'This account has been disabled. Please contact an administrator.',
    };
  }

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) {
    return invalidCredentialsError;
  }

  // Successful login clears the targeted counter for this account.
  resetRateLimit(accountKey);

  const token = await createSession({
    userId: user.id,
    ipAddress,
    userAgent,
  });

  await setSessionCookie(token);

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  redirect('/dashboard');
}

// ─────────────────────────────────────────────────────────────────────────────
// Logout action
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Server Action: Log out the current user.
 *
 * Invalidates the session in the database and clears the cookie.
 */
export async function logoutAction(): Promise<void> {
  const token = await getSessionToken();
  if (token) {
    await invalidateSession(token);
  }
  await clearSessionCookie();
  redirect('/login');
}
