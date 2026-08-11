'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { verifyPassword } from '@/lib/auth/password';
import {
  clearSessionCookie,
  createSession,
  getSessionToken,
  invalidateSession,
  setSessionCookie,
} from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
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
 * Server Action: Authenticate a user with email and password.
 *
 * Security considerations:
 * - Generic error message on failure to prevent user enumeration
 * - Checks disabled flag before granting session
 * - Records IP and User-Agent for audit trail
 * - Updates lastLoginAt timestamp
 */
export async function loginAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // Parse and validate input
  const raw = {
    email: formData.get('email'),
    password: formData.get('password'),
  };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { email, password } = parsed.data;

  // Look up user by email
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: {
      id: true,
      passwordHash: true,
      disabled: true,
    },
  });

  // Generic error to prevent user enumeration
  const invalidCredentialsError: ActionState = {
    success: false,
    error: 'Invalid email or password.',
  };

  if (!user) {
    return invalidCredentialsError;
  }

  // Check if account is disabled
  if (user.disabled) {
    return {
      success: false,
      error: 'This account has been disabled. Please contact an administrator.',
    };
  }

  // Verify password
  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) {
    return invalidCredentialsError;
  }

  // Get request metadata for audit
  const headerStore = await headers();
  const ipAddress =
    headerStore.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headerStore.get('x-real-ip') ??
    undefined;
  const userAgent = headerStore.get('user-agent') ?? undefined;

  // Create session
  const token = await createSession({
    userId: user.id,
    ipAddress,
    userAgent,
  });

  // Set cookie
  await setSessionCookie(token);

  // Update last login timestamp
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  // Redirect to dashboard
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
