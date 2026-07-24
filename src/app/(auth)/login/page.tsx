import type { Metadata } from 'next';

import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getCurrentUser } from '@/lib/auth';
import { isGitHubEnabled, isGoogleEnabled } from '@/lib/auth/oauth';
import { siteConfig } from '@/lib/site-config';
import { Lock } from 'lucide-react';
import { LogoIcon } from '@/components/ui/Logo';

import { LoginForm } from './LoginForm';
import { OAuthButtons } from './OAuthButtons';

export const metadata: Metadata = {
  title: `Sign In — ${siteConfig.name}`,
  description: 'Sign in to your DerList account.',
};

interface LoginPageProps {
  searchParams: Promise<{ error?: string; redirect?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getCurrentUser();
  if (user) redirect('/dashboard');

  const params = await searchParams;
  const oauthError = params.error;
  const githubEnabled = isGitHubEnabled();
  const googleEnabled = isGoogleEnabled();
  const hasOAuth = githubEnabled || googleEnabled;

  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-4 py-12">
      {/* Background */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.08)_0%,transparent_60%)] blur-3xl" />
        <div className="absolute -right-40 bottom-0 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.06)_0%,transparent_60%)] blur-3xl" />
      </div>

      <div className="w-full max-w-sm animate-fade-up">
        {/* Brand */}
        <div className="mb-8 flex flex-col items-center text-center">
          <Link href="/" className="mb-5">
            <LogoIcon size="lg" />
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Welcome back
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Sign in to your {siteConfig.name} account
          </p>
        </div>

        {/* Closed Beta notice */}
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
          <Lock className="h-4 w-4 shrink-0 text-accent" aria-hidden />
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Closed Beta</span> — DerList is currently invite-only. Need access?{' '}
            <Link href="/#beta-access" className="text-accent hover:underline">Request an invite</Link>.
          </p>
        </div>

        {/* OAuth error */}
        {oauthError && (
          <div role="alert" className="mb-5 rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-xs text-danger">
            {oauthError === 'no_account' && 'No account found. You need an invitation to create an account.'}
            {oauthError === 'account_disabled' && 'Your account has been disabled. Contact an administrator.'}
            {oauthError === 'oauth_invalid_state' && 'Authentication failed. Please try again.'}
            {oauthError === 'oauth_code_exchange_failed' && 'Authentication failed. Please try again.'}
            {oauthError === 'oauth_profile_failed' && 'Could not fetch your profile. Please try again.'}
          </div>
        )}

        {/* OAuth */}
        {hasOAuth && (
          <>
            <OAuthButtons githubEnabled={githubEnabled} googleEnabled={googleEnabled} />
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-background px-3 text-xs text-muted-foreground">or</span>
              </div>
            </div>
          </>
        )}

        {/* Password form */}
        <LoginForm />
      </div>
    </div>
  );
}
