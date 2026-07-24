import { redirect } from 'next/navigation';

import { getSessionToken, validateSession } from '@/lib/auth/session';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** The shape of the user object returned by auth helpers. */
export type SessionUser = NonNullable<
  Awaited<ReturnType<typeof validateSession>>
>['user'];

// ─────────────────────────────────────────────────────────────────────────────
// Auth helpers for Server Components and Server Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the currently authenticated user, or `null` if not logged in.
 *
 * Use this when you need to conditionally render based on auth state
 * without redirecting (e.g. showing a login link vs user avatar).
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = await getSessionToken();
  if (!token) return null;

  const result = await validateSession(token);
  return result?.user ?? null;
}

/**
 * Require an authenticated user. Redirects to /login if not authenticated.
 *
 * Use in Server Components or Server Actions where a logged-in user is mandatory.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }
  return user;
}

/**
 * Require an ADMIN or OWNER role. Redirects to /login if not authenticated,
 * or throws a 403-equivalent redirect if the user lacks permission.
 *
 * Use for protecting admin pages and actions.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== 'ADMIN' && user.role !== 'OWNER') {
    redirect('/forbidden');
  }
  return user;
}

/**
 * Require the OWNER role. Redirects to /login if not authenticated,
 * or throws a 403-equivalent redirect if the user is not the owner.
 *
 * Use for instance-level operations (e.g. promoting other admins).
 */
export async function requireOwner(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== 'OWNER') {
    redirect('/forbidden');
  }
  return user;
}

// Re-export session and password utilities for convenient imports
export { createSession, invalidateSession, invalidateAllUserSessions } from '@/lib/auth/session';
export { hashPassword, verifyPassword } from '@/lib/auth/password';
