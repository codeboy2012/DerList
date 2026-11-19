import argon2 from 'argon2';

/**
 * Sentinel stored instead of a password hash for accounts created through
 * OAuth only. It can never match a password, and `hasPassword` lets the UI and
 * server actions distinguish "no password yet" from a real hash.
 */
export const PASSWORD_NOT_SET = '!no-password';

/** True when the account can sign in with, or verify, a password. */
export function hasPassword(passwordHash: string | null | undefined): boolean {
  return Boolean(passwordHash) && passwordHash !== PASSWORD_NOT_SET;
}

/**
 * Hash a plaintext password using Argon2id.
 *
 * Argon2id is the recommended variant — it combines Argon2i (resistant to
 * side-channel attacks) and Argon2d (resistant to GPU cracking). The default
 * parameters from the argon2 library already exceed OWASP minimum recommendations.
 */
export async function hashPassword(plaintext: string): Promise<string> {
  return argon2.hash(plaintext, {
    type: argon2.argon2id,
  });
}

/**
 * Verify a plaintext password against a stored Argon2id hash.
 *
 * Returns `false` for OAuth-only accounts and for malformed stored hashes
 * instead of throwing, so a corrupted row cannot turn a sign-in attempt into a
 * 500 response. Timing-safe by design (argon2 handles comparison).
 */
export async function verifyPassword(hash: string, plaintext: string): Promise<boolean> {
  if (!hasPassword(hash)) return false;
  try {
    return await argon2.verify(hash, plaintext);
  } catch {
    return false;
  }
}
