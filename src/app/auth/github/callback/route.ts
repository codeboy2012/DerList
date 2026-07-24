import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { getGitHub } from '@/lib/auth/oauth';
import { handleOAuthCallback } from '@/lib/auth/oauth-helpers';

interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
}

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

/**
 * GET /auth/github/callback — Handles the GitHub OAuth callback.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  const cookieStore = await cookies();
  const storedState = cookieStore.get('github_oauth_state')?.value;
  cookieStore.set('github_oauth_state', '', { maxAge: 0, path: '/' });

  if (!code || !state || state !== storedState) {
    redirect('/login?error=oauth_invalid_state');
  }

  // Exchange code for token
  const github = getGitHub();
  let accessToken: string;
  try {
    const tokens = await github.validateAuthorizationCode(code);
    accessToken = tokens.accessToken();
  } catch {
    redirect('/login?error=oauth_code_exchange_failed');
  }

  // Fetch GitHub profile
  const userRes = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': 'DerList' },
  });
  if (!userRes.ok) redirect('/login?error=oauth_profile_failed');
  const ghUser = (await userRes.json()) as GitHubUser;

  // Fetch verified email
  let primaryEmail: string | null = null;
  const emailsRes = await fetch('https://api.github.com/user/emails', {
    headers: { Authorization: `Bearer ${accessToken}`, 'User-Agent': 'DerList' },
  });
  if (emailsRes.ok) {
    const emails = (await emailsRes.json()) as GitHubEmail[];
    primaryEmail = emails.find((e) => e.primary && e.verified)?.email
      ?? emails.find((e) => e.verified)?.email
      ?? null;
  }
  if (!primaryEmail) primaryEmail = ghUser.email;

  // Handle callback with shared logic
  const redirectUrl = await handleOAuthCallback({
    provider: 'github',
    providerAccountId: String(ghUser.id),
    email: primaryEmail,
    name: ghUser.name ?? ghUser.login,
    avatar: ghUser.avatar_url,
    accessToken,
  });

  redirect(redirectUrl);
}
