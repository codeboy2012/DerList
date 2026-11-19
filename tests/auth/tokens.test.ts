import { createHash, randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  buildEmailLink,
  consumeEmailToken,
  findEmailToken,
  hashEmailToken,
  issueEmailToken,
} from '@/lib/auth/tokens';

const hasDatabase = Boolean(process.env.DATABASE_URL);
const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

describe.skipIf(!hasDatabase)('email tokens', () => {
  let prisma: typeof import('@/lib/prisma').prisma;
  let userId: string;

  beforeAll(async () => {
    ({ prisma } = await import('@/lib/prisma'));
    const user = await prisma.user.create({
      data: {
        email: `tokens-${suffix}@example.test`,
        username: `tokens-${suffix}`,
        displayName: 'Token User',
        passwordHash: 'not-a-real-hash',
      },
      select: { id: true },
    });
    userId = user.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.user.deleteMany({ where: { email: `tokens-${suffix}@example.test` } });
    await prisma.$disconnect();
  });

  it('stores only a hash and consumes the token once', async () => {
    const token = await issueEmailToken(userId, 'PASSWORD_RESET');

    const stored = await prisma.emailToken.findUnique({
      where: { tokenHash: hashEmailToken(token) },
    });
    expect(stored).not.toBeNull();
    expect(stored?.tokenHash).not.toBe(token);

    await expect(findEmailToken(token, 'PASSWORD_RESET')).resolves.toMatchObject({ userId });
    await expect(consumeEmailToken(token, 'PASSWORD_RESET')).resolves.toBe(userId);
    await expect(consumeEmailToken(token, 'PASSWORD_RESET')).resolves.toBeNull();
    await expect(findEmailToken(token, 'PASSWORD_RESET')).resolves.toBeNull();
  });

  it('rejects a token used for the wrong purpose', async () => {
    const token = await issueEmailToken(userId, 'PASSWORD_RESET');
    await expect(findEmailToken(token, 'EMAIL_VERIFICATION')).resolves.toBeNull();
    await expect(consumeEmailToken(token, 'EMAIL_VERIFICATION')).resolves.toBeNull();
  });

  it('invalidates an older unused token when a new one is issued', async () => {
    const first = await issueEmailToken(userId, 'PASSWORD_RESET');
    const second = await issueEmailToken(userId, 'PASSWORD_RESET');

    await expect(findEmailToken(first, 'PASSWORD_RESET')).resolves.toBeNull();
    await expect(findEmailToken(second, 'PASSWORD_RESET')).resolves.toMatchObject({ userId });
  });

  it('rejects expired tokens', async () => {
    const token = await issueEmailToken(userId, 'EMAIL_VERIFICATION');
    await prisma.emailToken.update({
      where: { tokenHash: hashEmailToken(token) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await expect(findEmailToken(token, 'EMAIL_VERIFICATION')).resolves.toBeNull();
    await expect(consumeEmailToken(token, 'EMAIL_VERIFICATION')).resolves.toBeNull();
  });

  it('accepts and upgrades a legacy SHA-256 token record', async () => {
    const token = randomBytes(32).toString('hex');
    const legacyHash = createHash('sha256').update(token).digest('hex');
    await prisma.emailToken.create({
      data: {
        userId,
        type: 'PASSWORD_RESET',
        tokenHash: legacyHash,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    await expect(findEmailToken(token, 'PASSWORD_RESET')).resolves.toMatchObject({ userId });

    const upgraded = await prisma.emailToken.findUnique({ where: { tokenHash: legacyHash } });
    expect(upgraded).toBeNull();
    const current = await prisma.emailToken.findUnique({
      where: { tokenHash: hashEmailToken(token) },
    });
    expect(current?.userId).toBe(userId);
  });

  it('builds absolute links on the configured site origin', () => {
    expect(buildEmailLink('/reset-password', 'abc 123')).toMatch(
      /\/reset-password\?token=abc%20123$/
    );
  });
});
