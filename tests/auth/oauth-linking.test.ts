import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  findOAuth: vi.fn(),
  createOAuth: vi.fn(),
  updateOAuth: vi.fn(),
  updateUser: vi.fn(),
  findUserByEmail: vi.fn(),
  createAccount: vi.fn(),
  createSession: vi.fn(),
  setSessionCookie: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock('@/lib/auth/identity', () => ({ findUserByEmail: mocks.findUserByEmail }));
vi.mock('@/lib/auth/registration', () => {
  class DuplicateAccountError extends Error {
    constructor(public readonly field: 'email' | 'username') {
      super('duplicate');
    }
  }
  return { createAccount: mocks.createAccount, DuplicateAccountError };
});
vi.mock('@/lib/auth/session', () => ({
  createSession: mocks.createSession,
  setSessionCookie: mocks.setSessionCookie,
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    oAuthAccount: {
      findUnique: mocks.findOAuth,
      create: mocks.createOAuth,
      update: mocks.updateOAuth,
    },
    user: {
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

const { handleOAuthCallback } = await import('@/lib/auth/oauth-helpers');

describe('handleOAuthCallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue(null);
    mocks.findOAuth.mockResolvedValue(null);
    mocks.findUserByEmail.mockResolvedValue(null);
    mocks.createAccount.mockResolvedValue({
      id: 'user-new',
      email: 'owner@example.com',
      username: 'owner',
      avatarUrl: null,
    });
    mocks.createSession.mockResolvedValue('session-token');
    mocks.setSessionCookie.mockResolvedValue(undefined);
    mocks.updateUser.mockResolvedValue(undefined);
    mocks.createOAuth.mockResolvedValue(undefined);
    mocks.updateOAuth.mockResolvedValue(undefined);
  });

  it('refuses to link or create an account using an unverified email', async () => {
    const result = await handleOAuthCallback({
      ...baseProfile,
      emailVerifiedByProvider: false,
    });

    expect(result).toBe('/login?error=email_unverified');
    expect(mocks.createOAuth).not.toHaveBeenCalled();
    expect(mocks.createAccount).not.toHaveBeenCalled();
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it('refuses to create an account when the provider shares no email', async () => {
    const result = await handleOAuthCallback({
      ...baseProfile,
      email: null,
      emailVerifiedByProvider: true,
    });

    expect(result).toBe('/login?error=email_missing');
    expect(mocks.createAccount).not.toHaveBeenCalled();
  });

  it('links and signs in when the provider verified an existing email', async () => {
    mocks.findUserByEmail.mockResolvedValue({
      id: 'user-1',
      disabled: false,
      avatarUrl: null,
      emailVerified: false,
    });

    const result = await handleOAuthCallback({
      ...baseProfile,
      emailVerifiedByProvider: true,
    });

    expect(result).toBe('/dashboard');
    expect(mocks.createAccount).not.toHaveBeenCalled();
    expect(mocks.createOAuth.mock.calls[0][0].data).toMatchObject({
      userId: 'user-1',
      provider: 'github',
      providerAccountId: '123',
    });
    expect(mocks.createSession).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(mocks.updateUser).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { emailVerified: true },
    });
  });

  it('creates a new account for a first-time verified provider email', async () => {
    const result = await handleOAuthCallback({
      ...baseProfile,
      emailVerifiedByProvider: true,
    });

    expect(result).toBe('/dashboard?welcome=1');
    expect(mocks.createAccount).toHaveBeenCalledWith({
      email: 'owner@example.com',
      displayName: 'Owner',
      emailVerified: true,
    });
    expect(mocks.createOAuth.mock.calls[0][0].data.userId).toBe('user-new');
    expect(mocks.createSession).toHaveBeenCalledWith({ userId: 'user-new' });
  });

  it('signs an already-linked provider account back in', async () => {
    mocks.findOAuth.mockResolvedValue({
      id: 'oauth-1',
      userId: 'user-9',
      refreshToken: null,
      expiresAt: null,
      user: { id: 'user-9', disabled: false },
    });

    const result = await handleOAuthCallback({
      ...baseProfile,
      emailVerifiedByProvider: true,
    });

    expect(result).toBe('/dashboard');
    expect(mocks.createAccount).not.toHaveBeenCalled();
    expect(mocks.createSession).toHaveBeenCalledWith({ userId: 'user-9' });
  });

  it('rejects a disabled linked account', async () => {
    mocks.findOAuth.mockResolvedValue({
      id: 'oauth-1',
      userId: 'user-9',
      refreshToken: null,
      expiresAt: null,
      user: { id: 'user-9', disabled: true },
    });

    const result = await handleOAuthCallback({
      ...baseProfile,
      emailVerifiedByProvider: true,
    });

    expect(result).toBe('/login?error=account_disabled');
    expect(mocks.createSession).not.toHaveBeenCalled();
  });

  it('still allows an already-signed-in user to link an account', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-2', avatarUrl: null });

    const result = await handleOAuthCallback({
      ...baseProfile,
      emailVerifiedByProvider: false,
    });

    expect(result).toBe('/settings/account?success=provider_linked');
    expect(mocks.createOAuth.mock.calls[0][0].data.userId).toBe('user-2');
    expect(mocks.createAccount).not.toHaveBeenCalled();
  });

  it('does not link a provider account owned by another user', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-2', avatarUrl: null });
    mocks.findOAuth.mockResolvedValue({ userId: 'user-3' });

    const result = await handleOAuthCallback({
      ...baseProfile,
      emailVerifiedByProvider: true,
    });

    expect(result).toBe('/settings/account?error=oauth_already_linked_other');
    expect(mocks.createOAuth).not.toHaveBeenCalled();
  });
});
