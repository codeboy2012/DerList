import { Prisma } from '@prisma/client';
import { generateUniqueUsername, normalizeEmail, normalizeUsername } from '@/lib/auth/identity';
import { hashPassword, PASSWORD_NOT_SET } from '@/lib/auth/password';
import { prisma } from '@/lib/prisma';

export class DuplicateAccountError extends Error {
  constructor(public readonly field: 'email' | 'username') {
    super(`An account with this ${field} already exists.`);
    this.name = 'DuplicateAccountError';
  }
}

export interface CreateAccountInput {
  email: string;
  /** Supplied by username registration; generated from the email otherwise. */
  username?: string;
  displayName?: string | null;
  /** Omit for OAuth-only accounts, which cannot use password sign-in. */
  password?: string;
  emailVerified?: boolean;
}

/**
 * Create a user account with a normalised email and username.
 *
 * Uniqueness is checked case-insensitively before insert and the database's
 * unique indexes are the final guard against a concurrent duplicate. Generated
 * usernames retry with a new suffix; a user-chosen username reports the
 * conflict instead of silently changing it.
 */
export async function createAccount(input: CreateAccountInput) {
  const email = normalizeEmail(input.email);
  const providedUsername = input.username ? normalizeUsername(input.username) : null;

  const existingEmail = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true },
  });
  if (existingEmail) throw new DuplicateAccountError('email');

  let username = providedUsername;

  if (username) {
    const existingUsername = await prisma.user.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
      select: { id: true },
    });
    if (existingUsername) throw new DuplicateAccountError('username');
  } else {
    username = await generateUniqueUsername(email);
  }

  const passwordHash = input.password ? await hashPassword(input.password) : PASSWORD_NOT_SET;
  const displayName = input.displayName?.trim() || username;

  try {
    return await prisma.user.create({
      data: {
        email,
        username,
        displayName,
        passwordHash,
        emailVerified: input.emailVerified ?? false,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = String(error.meta?.target ?? '').toLowerCase();

      // A generated username can lose a race with another registration. Try a
      // fresh suffix a few times before surfacing the conflict.
      if (!providedUsername && target.includes('username')) {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          const retryUsername = await generateUniqueUsername(email);
          try {
            return await prisma.user.create({
              data: {
                email,
                username: retryUsername,
                displayName: input.displayName?.trim() || retryUsername,
                passwordHash,
                emailVerified: input.emailVerified ?? false,
              },
            });
          } catch (retryError) {
            if (
              !(retryError instanceof Prisma.PrismaClientKnownRequestError) ||
              retryError.code !== 'P2002'
            ) {
              throw retryError;
            }
          }
        }
        throw new DuplicateAccountError('username');
      }

      throw new DuplicateAccountError(target.includes('email') ? 'email' : 'username');
    }
    throw error;
  }
}
