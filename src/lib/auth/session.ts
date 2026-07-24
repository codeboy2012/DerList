import { createHash, randomBytes } from 'crypto';
import { cookies } from 'next/headers';

import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_MS,
  SESSION_REFRESH_THRESHOLD_MS,
  TOKEN_BYTE_LENGTH,
} from '@/lib/auth/constants';
import { prisma } from '@/lib/prisma';

// Re-export for convenience (keeps existing imports working)
export { SESSION_COOKIE_NAME } from '@/lib/auth/constants';

// ─────────────────────────────────────────────────────────────────────────────
// Token utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Generate a cryptographically random session token (hex-encoded). */
function generateToken(): string {
  return randomBytes(TOKEN_BYTE_LENGTH).toString('hex');
}

/**
 * Hash a session token with SHA-256.
 *
 * We store the hash in the database rather than the raw token. This way, even
 * if the database is compromised, an attacker cannot use the stored values to
 * impersonate users — they would need the original token from the cookie.
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// ─────────────────────────────────────────────────────────────────────────────
// Session CRUD
// ─────────────────────────────────────────────────────────────────────────────

interface CreateSessionOptions {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Create a new session for a user.
 *
 * Returns the raw token (to be stored in the cookie) — this is the only time
 * the raw token is available.
 */
export async function createSession(options: CreateSessionOptions): Promise<string> {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS);

  await prisma.session.create({
    data: {
      tokenHash,
      userId: options.userId,
      expiresAt,
      ipAddress: options.ipAddress ?? null,
      userAgent: options.userAgent ?? null,
    },
  });

  return token;
}

/**
 * Validate a session token.
 *
 * Returns the session with its associated user if valid and not expired.
 * Implements sliding window renewal: extends the session if it's past the
 * halfway point of its lifetime.
 *
 * Returns `null` if the token is invalid or expired.
 */
export async function validateSession(token: string) {
  const tokenHash = hashToken(token);

  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          role: true,
          emailVerified: true,
          disabled: true,
        },
      },
    },
  });

  if (!session) return null;

  // Check expiry
  if (session.expiresAt < new Date()) {
    // Clean up expired session
    await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  // Check if user is disabled
  if (session.user.disabled) {
    await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  // Sliding window renewal: extend if past the refresh threshold
  const timeRemaining = session.expiresAt.getTime() - Date.now();
  if (timeRemaining < SESSION_REFRESH_THRESHOLD_MS) {
    await prisma.session.update({
      where: { id: session.id },
      data: { expiresAt: new Date(Date.now() + SESSION_MAX_AGE_MS) },
    });
  }

  return { session, user: session.user };
}

/**
 * Invalidate (delete) a session by its raw token.
 */
export async function invalidateSession(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  await prisma.session.deleteMany({ where: { tokenHash } });
}

/**
 * Invalidate all sessions for a user (e.g. after password change or disable).
 */
export async function invalidateAllUserSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}

// ─────────────────────────────────────────────────────────────────────────────
// Cookie helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Set the session cookie on the response.
 *
 * Cookies are:
 * - HttpOnly: inaccessible to client-side JavaScript (XSS protection)
 * - Secure: only sent over HTTPS (in production)
 * - SameSite=Lax: prevents CSRF on cross-origin requests while allowing
 *   normal navigation links to carry the cookie
 * - Path=/: available on all routes
 */
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_MS / 1000, // maxAge is in seconds
  });
}

/**
 * Clear the session cookie (used during logout).
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

/**
 * Read the session token from the incoming request cookies.
 * Returns `null` if no session cookie is present.
 */
export async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
}
