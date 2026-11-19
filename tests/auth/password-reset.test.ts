import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => {
  class RedirectSignal extends Error {
    constructor(public readonly url: string) {
      super(url);
    }
  }
  return { RedirectSignal };
});

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': '127.0.0.1', 'user-agent': 'vitest' }),
  cookies: async () => ({ get: () => undefined, set: () => {} }),
}));

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new harness.RedirectSignal(url);
  },
}));

const hasDatabase = Boolean(process.env.DATABASE_URL);
const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

describe.skipIf(!hasDatabase)('password reset action', () => {
  let prisma: typeof import('@/lib/prisma').prisma;
  let resetPasswordAction: typeof import('@/app/(auth)/reset-password/actions').resetPasswordAction;
  let issueEmailToken: typeof import('@/lib/auth/tokens').issueEmailToken;
  let hashPassword: typeof import('@/lib/auth/password').hashPassword;
  let verifyPassword: typeof import('@/lib/auth/password').verifyPassword;
  let createSession: typeof import('@/lib/auth/session').createSession;
  let userId: string;

  beforeAll(async () => {
    ({ prisma } = await import('@/lib/prisma'));
    ({ resetPasswordAction } = await import('@/app/(auth)/reset-password/actions'));
    ({ issueEmailToken } = await import('@/lib/auth/tokens'));
    ({ hashPassword, verifyPassword } = await import('@/lib/auth/password'));
    ({ createSession } = await import('@/lib/auth/session'));

    const user = await prisma.user.create({
      data: {
        email: `reset-${suffix}@example.test`,
        username: `reset-${suffix}`,
        displayName: 'Reset User',
        passwordHash: await hashPassword('old-password-123'),
      },
      select: { id: true },
    });
    userId = user.id;
  });

  beforeEach(async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { disabled: false, passwordHash: await hashPassword('old-password-123') },
    });
    await prisma.session.deleteMany({ where: { userId } });
    await prisma.emailToken.deleteMany({ where: { userId } });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.user.deleteMany({ where: { email: `reset-${suffix}@example.test` } });
    await prisma.$disconnect();
  });

  function form(token: string, password = 'new-password-123') {
    const data = new FormData();
    data.set('token', token);
    data.set('password', password);
    data.set('confirmPassword', password);
    return data;
  }

  it('resets the password, consumes the token and revokes existing sessions', async () => {
    const token = await issueEmailToken(userId, 'PASSWORD_RESET');
    await createSession({ userId });
    await createSession({ userId });

    await expect(resetPasswordAction({ success: false }, form(token))).rejects.toBeInstanceOf(
      harness.RedirectSignal
    );

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true, emailVerified: true },
    });
    expect(await verifyPassword(user.passwordHash, 'new-password-123')).toBe(true);
    expect(user.emailVerified).toBe(true);
    await expect(prisma.session.count({ where: { userId } })).resolves.toBe(1);
    await expect(prisma.emailToken.count({ where: { userId, usedAt: null } })).resolves.toBe(0);
  });

  it('rejects an invalid or already-used token', async () => {
    const token = await issueEmailToken(userId, 'PASSWORD_RESET');
    await expect(resetPasswordAction({ success: false }, form(token))).rejects.toBeInstanceOf(
      harness.RedirectSignal
    );

    await expect(resetPasswordAction({ success: false }, form(token))).resolves.toMatchObject({
      success: false,
      error: expect.stringContaining('invalid or has expired'),
    });
  });

  it('rejects expired tokens without changing the password', async () => {
    const token = await issueEmailToken(userId, 'PASSWORD_RESET');
    const { hashEmailToken } = await import('@/lib/auth/tokens');
    await prisma.emailToken.update({
      where: { tokenHash: hashEmailToken(token) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await expect(resetPasswordAction({ success: false }, form(token))).resolves.toMatchObject({
      success: false,
    });

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true },
    });
    expect(await verifyPassword(user.passwordHash, 'old-password-123')).toBe(true);
  });

  it('rejects a reset for a disabled account', async () => {
    const token = await issueEmailToken(userId, 'PASSWORD_RESET');
    await prisma.user.update({ where: { id: userId }, data: { disabled: true } });

    await expect(resetPasswordAction({ success: false }, form(token))).resolves.toMatchObject({
      success: false,
      error: expect.stringContaining('administrator'),
    });
    await expect(prisma.session.count({ where: { userId } })).resolves.toBe(0);
  });

  it('rejects mismatched confirmation passwords before consuming the token', async () => {
    const token = await issueEmailToken(userId, 'PASSWORD_RESET');
    const data = form(token);
    data.set('confirmPassword', 'different-password');

    await expect(resetPasswordAction({ success: false }, data)).resolves.toMatchObject({
      success: false,
      fieldErrors: { confirmPassword: ['Passwords do not match.'] },
    });
    await expect(prisma.emailToken.count({ where: { userId, usedAt: null } })).resolves.toBe(1);
  });
});
