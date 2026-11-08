import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleOAuthCallback } from '@/lib/auth/oauth-helpers';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  findOAuth: vi.fn(),
  createOAuth: vi.fn(),
  findUser: vi.fn(),
  updateUser: vi.fn(),
  createSession: vi.fn(),
  setSessionCookie: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock('@/lib/auth/session', () => ({
  createSession: mocks.createSession,
  setSessionCookie: mocks.setSessionCookie,
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    oAuthAccount: {
      findUnique: mocks.findOAuth,
      create: mocks.createOAuth,
    },
    user: {
      findUnique: mocks.findUser,
      update: mocks.updateUser,
    },
  },
}));

const baseProfile = {
  provider: 'github',
  providerAccountId: '123',
  email: 'owner@example.com',
  name: 'Owner',
  avatar: null,
  accessToken: 'token',
};

describe('handleOAuthCallback account linking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue(null);
    mocks.findOAuth.mockResolvedValue(null);
    mocks.findUser.mockResolvedValue({ id: 'user-1', disabled: false, avatarUrl: null });
    mocks.createSession.mockResolvedValue('session-token');
    mocks.setSessionCookie.mockResolvedValue(undefined);
    mocks.updateUser.mockResolvedValue(undefined);
    mocks.createOAuth.mockResolvedValue(undefined);
  });

  it('refuses to auto-link an existing account using an unverified email', async () => {
    const result = await handleOAuthCallback({
      ...baseProfile,
      emailVerifiedByProvider: false,
    });

    expect(result).toBe('/login?error=email_unverified');
    expect(mocks.createOAuth).not.toHaveBeenCalled();
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it('links and signs in when the provider verified the email', async () => {
    const result = await handleOAuthCallback({
      ...baseProfile,
      emailVerifiedByProvider: true,
    });

    expect(result).toBe('/dashboard');
    expect(mocks.createOAuth).toHaveBeenCalledTimes(1);
    expect(mocks.createOAuth.mock.calls[0][0].data).toMatchObject({
      userId: 'user-1',
      provider: 'github',
      providerAccountId: '123',
    });
    expect(mocks.createSession).toHaveBeenCalledWith({ userId: 'user-1' });
  });

  it('still allows an already-signed-in user to link an account', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-2', avatarUrl: null });

    const result = await handleOAuthCallback({
      ...baseProfile,
      emailVerifiedByProvider: false,
    });

    expect(result).toBe('/settings/account?success=provider_linked');
    expect(mocks.createOAuth.mock.calls[0][0].data.userId).toBe('user-2');
  });

  it('does not create accounts for unknown emails (invite-only)', async () => {
    mocks.findUser.mockResolvedValue(null);

    const result = await handleOAuthCallback({
      ...baseProfile,
      emailVerifiedByProvider: true,
    });

    expect(result).toBe('/login?error=no_account');
    expect(mocks.createOAuth).not.toHaveBeenCalled();
  });
});
