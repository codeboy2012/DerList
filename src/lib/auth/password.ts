import argon2 from 'argon2';

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
 * Returns `true` if the password matches, `false` otherwise.
 * Timing-safe by design (argon2 library handles constant-time comparison).
 */
export async function verifyPassword(hash: string, plaintext: string): Promise<boolean> {
  return argon2.verify(hash, plaintext);
}
