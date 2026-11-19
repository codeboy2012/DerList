import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createSession,
  invalidateAllUserSessions,
  invalidateSession,
  validateSession,
} from '@/lib/auth/session';

const hasDatabase = Boolean(process.env.DATABASE_URL);
const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function hash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

describe.skipIf(!hasDatabase)('sessions', () => {
  let prisma: typeof import('@/lib/prisma').prisma;
  let userId: string;

  beforeAll(async () => {
    ({ prisma } = await import('@/lib/prisma'));
    const user = await prisma.user.create({
      data: {
        email: `sessions-${suffix}@example.test`,
        username: `sessions-${suffix}`,
        displayName: 'Session User',
        passwordHash: 'not-a-real-hash',
      },
      select: { id: true },
    });
    userId = user.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.user.deleteMany({ where: { email: `sessions-${suffix}@example.test` } });
    await prisma.$disconnect();
  });

  it('creates a valid session and stores only its hash', async () => {
    const token = await createSession({ userId, ipAddress: '127.0.0.1', userAgent: 'vitest' });

    const row = await prisma.session.findUnique({ where: { tokenHash: hash(token) } });
    expect(row?.tokenHash).not.toBe(token);
    await expect(validateSession(token)).resolves.toMatchObject({ user: { id: userId } });
  });

  it('rejects and removes an expired session', async () => {
    const token = await createSession({ userId });
    await prisma.session.update({
      where: { tokenHash: hash(token) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await expect(validateSession(token)).resolves.toBeNull();
    await expect(
      prisma.session.findUnique({ where: { tokenHash: hash(token) } })
    ).resolves.toBeNull();
  });

  it('invalidates a single session on sign-out', async () => {
    const token = await createSession({ userId });
    await invalidateSession(token);
    await expect(validateSession(token)).resolves.toBeNull();
  });

  it('invalidates every session for an account', async () => {
    const first = await createSession({ userId });
    const second = await createSession({ userId });

    await invalidateAllUserSessions(userId);

    await expect(validateSession(first)).resolves.toBeNull();
    await expect(validateSession(second)).resolves.toBeNull();
  });
});
