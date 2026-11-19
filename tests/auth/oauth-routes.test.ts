import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => {
  class RedirectSignal extends Error {
    constructor(public readonly url: string) {
      super(url);
    }
  }

  return {
    RedirectSignal,
    cookieJar: new Map<string, string>(),
    validateAuthorizationCode: vi.fn(),
    handleOAuthCallback: vi.fn(),
    fetchMock: vi.fn(),
  };
});

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = harness.cookieJar.get(name);
      return value ? { value } : undefined;
    },
    set: (name: string, value: string) => {
      if (value === '') harness.cookieJar.delete(name);
      else harness.cookieJar.set(name, value);
    },
  }),
}));

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new harness.RedirectSignal(url);
  },
}));

vi.mock('@/lib/auth/oauth', () => ({
  getGitHub: () => ({ validateAuthorizationCode: harness.validateAuthorizationCode }),
}));

vi.mock('@/lib/auth/oauth-helpers', () => ({
  handleOAuthCallback: harness.handleOAuthCallback,
}));

const { GET } = await import('@/app/auth/github/callback/route');

function request(query: string) {
  return new Request(`http://localhost/auth/github/callback${query}`);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('GitHub OAuth callback route', () => {
  beforeEach(() => {
    harness.cookieJar.clear();
    harness.cookieJar.set('github_oauth_state', 'expected-state');
    harness.validateAuthorizationCode.mockReset();
    harness.handleOAuthCallback.mockReset();
    harness.fetchMock.mockReset();
    vi.stubGlobal('fetch', harness.fetchMock);
  });

  it('rejects a callback with no code or state', async () => {
    await expect(GET(request(''))).rejects.toBeInstanceOf(harness.RedirectSignal);
    await expect(GET(request(''))).rejects.toMatchObject({
      url: '/login?error=oauth_invalid_state',
    });
  });

  it('rejects a state that does not match the cookie', async () => {
    await expect(GET(request('?code=abc&state=wrong'))).rejects.toMatchObject({
      url: '/login?error=oauth_invalid_state',
    });
    expect(harness.validateAuthorizationCode).not.toHaveBeenCalled();
  });

  it('reports a failed code exchange', async () => {
    harness.validateAuthorizationCode.mockRejectedValue(new Error('bad code'));

    await expect(GET(request('?code=abc&state=expected-state'))).rejects.toMatchObject({
      url: '/login?error=oauth_code_exchange_failed',
    });
    expect(harness.handleOAuthCallback).not.toHaveBeenCalled();
  });

  it('reports a failed profile request', async () => {
    harness.validateAuthorizationCode.mockResolvedValue({ accessToken: () => 'token' });
    harness.fetchMock.mockResolvedValue(json({ message: 'nope' }, 401));

    await expect(GET(request('?code=abc&state=expected-state'))).rejects.toMatchObject({
      url: '/login?error=oauth_profile_failed',
    });
  });

  it('only forwards a verified email and creates an account', async () => {
    harness.validateAuthorizationCode.mockResolvedValue({ accessToken: () => 'token' });
    harness.handleOAuthCallback.mockResolvedValue('/dashboard?welcome=1');

    harness.fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/user/emails')) {
        return json([
          { email: 'unverified@example.com', primary: true, verified: false },
          { email: 'verified@example.com', primary: false, verified: true },
        ]);
      }
      return json({
        id: 42,
        login: 'octocat',
        name: 'The Octocat',
        email: null,
        avatar_url: 'https://example.com/avatar.png',
      });
    });

    await expect(GET(request('?code=abc&state=expected-state'))).rejects.toMatchObject({
      url: '/dashboard?welcome=1',
    });

    expect(harness.handleOAuthCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'github',
        providerAccountId: '42',
        email: 'verified@example.com',
        emailVerifiedByProvider: true,
      })
    );
  });

  it('does not treat an unverified profile email as verified', async () => {
    harness.validateAuthorizationCode.mockResolvedValue({ accessToken: () => 'token' });
    harness.handleOAuthCallback.mockResolvedValue('/login?error=email_unverified');

    harness.fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/user/emails')) {
        return json([{ email: 'unverified@example.com', primary: true, verified: false }]);
      }
      return json({
        id: 42,
        login: 'octocat',
        name: null,
        email: 'public@example.com',
        avatar_url: '',
      });
    });

    await expect(GET(request('?code=abc&state=expected-state'))).rejects.toMatchObject({
      url: '/login?error=email_unverified',
    });

    expect(harness.handleOAuthCallback).toHaveBeenCalledWith(
      expect.objectContaining({
        email: null,
        emailVerifiedByProvider: false,
      })
    );
  });
});
