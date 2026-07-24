import { cookies } from 'next/headers';

import { arctic, getGoogle } from '@/lib/auth/oauth';

/**
 * GET /auth/google — Initiates Google OAuth flow.
 */
export async function GET() {
  const google = getGoogle();
  const state = arctic.generateState();
  const codeVerifier = arctic.generateCodeVerifier();
  const scopes = ['openid', 'profile', 'email'];
  const url = google.createAuthorizationURL(state, codeVerifier, scopes);

  const cookieStore = await cookies();
  cookieStore.set('google_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });
  cookieStore.set('google_code_verifier', codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });

  return Response.redirect(url.toString());
}
