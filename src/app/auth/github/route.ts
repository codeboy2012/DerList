import { cookies } from 'next/headers';

import { arctic, getGitHub } from '@/lib/auth/oauth';

/**
 * GET /auth/github — Initiates GitHub OAuth flow.
 */
export async function GET() {
  const github = getGitHub();
  const state = arctic.generateState();
  const scopes = ['user:email', 'read:user'];
  const url = github.createAuthorizationURL(state, scopes);

  const cookieStore = await cookies();
  cookieStore.set('github_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });

  return Response.redirect(url.toString());
}
