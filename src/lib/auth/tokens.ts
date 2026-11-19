import { createHash, randomBytes, scryptSync } from 'crypto';
import { EmailTokenType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { siteConfig } from '@/lib/site-config';

/** Password-reset links are short-lived; verification links last a day. */
export const EMAIL_TOKEN_TTL_MS: Record<EmailTokenType, number> = {
  PASSWORD_RESET: 60 * 60 * 1000,
  EMAIL_VERIFICATION: 24 * 60 * 60 * 1000,
};

/**
 * Token digests use scrypt rather than a single fast hash.
 *
 * Tokens are 256 bits of random data, so a fast hash would already make
 * guessing infeasible. The deliberately expensive KDF is defence in depth: it
 * keeps the stored digest resistant even if a future caller ever issues a
 * lower-entropy token, and it satisfies the same storage contract as password
 * hashing without storing the raw credential.
 *
 * The salt is derived from the token itself. That keeps lookup deterministic
 * (the server receives only the raw token) while ensuring identical raw tokens
 * cannot be compared across databases through a shared rainbow table.
 */
const SCRYPT_OPTIONS = { N: 32_768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;

function tokenSalt(token: string): Buffer {
  return createHash('sha256')
    .update('derlist:email-token-salt:v1\0')
    .update(token)
    .digest()
    .subarray(0, 16);
}

export function hashEmailToken(token: string): string {
  return scryptSync(token, tokenSalt(token), 32, SCRYPT_OPTIONS).toString('hex');
}

/**
 * Digest format used before the scrypt migration. Kept only so reset and
 * verification links issued immediately before a deployment continue to work.
 * Any record found this way is upgraded in place; new records never use it.
 */
function legacyHashEmailToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Issue a new single-use token, invalidating any unused token of the same type
 * for that user. Returns the raw token — the only time it exists in memory.
 */
export async function issueEmailToken(userId: string, type: EmailTokenType): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const tokenHash = hashEmailToken(token);
  const expiresAt = new Date(Date.now() + EMAIL_TOKEN_TTL_MS[type]);

  await prisma.$transaction([
    prisma.emailToken.deleteMany({ where: { userId, type, usedAt: null } }),
    prisma.emailToken.create({
      data: { userId, type, tokenHash, expiresAt },
    }),
  ]);

  return token;
}

async function findTokenRecord(rawToken: string) {
  const tokenHash = hashEmailToken(rawToken);
  const current = await prisma.emailToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, type: true, expiresAt: true, usedAt: true },
  });
  if (current) return current;

  const legacyHash = legacyHashEmailToken(rawToken);
  if (legacyHash === tokenHash) return null;

  const legacy = await prisma.emailToken.findUnique({
    where: { tokenHash: legacyHash },
    select: { id: true, userId: true, type: true, expiresAt: true, usedAt: true },
  });
  if (!legacy) return null;

  // Upgrade the stored digest so the next lookup uses scrypt. If another
  // request wins the race, the unique constraint simply leaves the existing
  // upgraded record in place.
  try {
    await prisma.emailToken.update({
      where: { id: legacy.id },
      data: { tokenHash },
    });
  } catch {
    // A concurrent upgrade already replaced it; continue with the record.
  }

  return legacy;
}

/** Look up an unused, unexpired token without consuming it. */
export async function findEmailToken(rawToken: string, type: EmailTokenType) {
  if (!rawToken) return null;

  const record = await findTokenRecord(rawToken);

  if (!record || record.type !== type || record.usedAt || record.expiresAt <= new Date()) {
    return null;
  }

  return record;
}

/**
 * Atomically consume a token. Returns the owning user id, or null when the
 * token is unknown, expired, of the wrong type, or already used.
 */
export async function consumeEmailToken(
  rawToken: string,
  type: EmailTokenType
): Promise<string | null> {
  const record = await findEmailToken(rawToken, type);
  if (!record) return null;

  const result = await prisma.emailToken.updateMany({
    where: {
      id: record.id,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { usedAt: new Date() },
  });

  return result.count === 1 ? record.userId : null;
}

/** Absolute link for an emailed token, based on the configured app URL. */
export function buildEmailLink(path: string, token: string): string {
  const base = siteConfig.url.replace(/\/+$/, '');
  const separator = path.includes('?') ? '&' : '?';
  return `${base}${path}${separator}token=${encodeURIComponent(token)}`;
}
