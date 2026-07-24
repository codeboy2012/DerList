import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { getGoogle } from '@/lib/auth/oauth';
import { handleOAuthCallback } from '@/lib/auth/oauth-helpers';

interface GoogleTokenInfo {
  sub: string;
  name?: string;
  email?: string;
  email_verified?: boolean;
  picture?: string;
}

/**
 * GET /auth/google/callback — Handles the Google OAuth callback.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  const cookieStore = await cookies();
  const storedState = cookieStore.get('google_oauth_state')?.value;
  const codeVerifier = cookieStore.get('google_code_verifier')?.value;
  cookieStore.set('google_oauth_state', '', { maxAge: 0, path: '/' });
  cookieStore.set('google_code_verifier', '', { maxAge: 0, path: '/' });

  if (!code || !state || state !== storedState || !codeVerifier) {
    redirect('/login?error=oauth_invalid_state');
  }

  // Exchange code for tokens
  const google = getGoogle();
  let accessToken: string;
  try {
    const tokens = await google.validateAuthorizationCode(code, codeVerifier);
    accessToken = tokens.accessToken();
  } catch {
    redirect('/login?error=oauth_code_exchange_failed');
  }

  // Fetch Google user info
  const userRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!userRes.ok) redirect('/login?error=oauth_profile_failed');
  const googleUser = (await userRes.json()) as GoogleTokenInfo;

  const email = googleUser.email_verified ? googleUser.email ?? null : null;

  // Handle callback with shared logic
  const redirectUrl = await handleOAuthCallback({
    provider: 'google',
    providerAccountId: googleUser.sub,
    email,
    name: googleUser.name ?? null,
    avatar: googleUser.picture ?? null,
    accessToken,
  });

  redirect(redirectUrl);
}
