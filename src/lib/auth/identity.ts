import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';

/** Username rules shared by registration, invitations, admin and settings. */
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 32;
export const USERNAME_PATTERN = /^[a-z0-9]([a-z0-9_-]*[a-z0-9])?$/;

export const USERNAME_REQUIREMENTS =
  'Lowercase letters, numbers, hyphens and underscores. 3–32 characters, starting and ending with a letter or number.';

/** Normalise an email address for storage and lookup. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Normalise a username for storage and lookup. */
export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export function isValidUsername(username: string): boolean {
  return (
    username.length >= USERNAME_MIN_LENGTH &&
    username.length <= USERNAME_MAX_LENGTH &&
    USERNAME_PATTERN.test(username)
  );
}

/**
 * Derive a valid username from an email local-part.
 *
 * Used when the user chooses email-only registration or signs up through an
 * OAuth provider, where no username was supplied. The result is only a base —
 * {@link generateUniqueUsername} resolves collisions.
 */
export function usernameFromEmail(email: string): string {
  const localPart = normalizeEmail(email).split('@')[0] ?? '';
  let candidate = localPart
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 26);

  if (candidate.length < USERNAME_MIN_LENGTH) {
    candidate = `user-${randomBytes(3).toString('hex')}`;
  }

  if (!USERNAME_PATTERN.test(candidate)) {
    candidate = `user-${randomBytes(3).toString('hex')}`;
  }

  return candidate;
}

async function usernameExists(username: string): Promise<boolean> {
  const existing = await prisma.user.findFirst({
    where: { username: { equals: username, mode: 'insensitive' } },
    select: { id: true },
  });
  return Boolean(existing);
}

/**
 * Produce a username that is not in use, adding a short random suffix when the
 * natural candidate is taken. Case-insensitive so `Alice` and `alice` collide.
 */
export async function generateUniqueUsername(email: string): Promise<string> {
  const base = usernameFromEmail(email);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const suffix = randomBytes(2).toString('hex');
    const candidate =
      attempt === 0 ? base : `${base.slice(0, USERNAME_MAX_LENGTH - suffix.length - 1)}-${suffix}`;

    if (isValidUsername(candidate) && !(await usernameExists(candidate))) {
      return candidate;
    }
  }

  // Extremely unlikely fallback: a fully random, valid username.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = `user-${randomBytes(6).toString('hex')}`;
    if (!(await usernameExists(candidate))) return candidate;
  }

  throw new Error('Could not allocate a unique username.');
}

/**
 * Find an account by email or username, case-insensitively. Email is detected
 * by the presence of `@`; usernames cannot contain it.
 */
export async function findUserByIdentifier(identifier: string) {
  const normalized = identifier.trim().toLowerCase();
  if (!normalized) return null;

  return prisma.user.findFirst({
    where: normalized.includes('@')
      ? { email: { equals: normalized, mode: 'insensitive' } }
      : { username: { equals: normalized, mode: 'insensitive' } },
    select: {
      id: true,
      username: true,
      email: true,
      passwordHash: true,
      disabled: true,
      avatarUrl: true,
      emailVerified: true,
    },
  });
}

/** Find an account by email, case-insensitively. */
export async function findUserByEmail(email: string) {
  return prisma.user.findFirst({
    where: { email: { equals: normalizeEmail(email), mode: 'insensitive' } },
    select: {
      id: true,
      username: true,
      email: true,
      disabled: true,
      emailVerified: true,
      avatarUrl: true,
    },
  });
}

/** Find an account by username, case-insensitively. */
export async function findUserByUsername(username: string) {
  return prisma.user.findFirst({
    where: { username: { equals: normalizeUsername(username), mode: 'insensitive' } },
    select: { id: true },
  });
}
