import { createHash, randomBytes } from 'crypto';
import { EmailTokenType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { siteConfig } from '@/lib/site-config';

/** Password-reset links are short-lived; verification links last a day. */
export const EMAIL_TOKEN_TTL_MS: Record<EmailTokenType, number> = {
  PASSWORD_RESET: 60 * 60 * 1000,
  EMAIL_VERIFICATION: 24 * 60 * 60 * 1000,
};

/** SHA-256 is sufficient here: tokens are 256 bits of random data. */
export function hashEmailToken(token: string): string {
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

/** Look up an unused, unexpired token without consuming it. */
export async function findEmailToken(rawToken: string, type: EmailTokenType) {
  if (!rawToken) return null;

  const record = await prisma.emailToken.findUnique({
    where: { tokenHash: hashEmailToken(rawToken) },
    select: { id: true, userId: true, type: true, expiresAt: true, usedAt: true },
  });

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
