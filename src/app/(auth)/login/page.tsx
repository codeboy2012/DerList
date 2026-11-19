import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { isGitHubEnabled, isGoogleEnabled } from '@/lib/auth/oauth';
import { isEmailConfigured } from '@/lib/email';
import { siteConfig } from '@/lib/site-config';
import { LogoIcon } from '@/components/ui/Logo';
import { LoginForm } from './LoginForm';
import { OAuthButtons } from './OAuthButtons';

export const metadata: Metadata = {
  title: `Sign In — ${siteConfig.name}`,
  description: 'Sign in to your DerList account with your email, username, GitHub or Google.',
};

interface LoginPageProps {
  searchParams: Promise<{ error?: string; verified?: string }>;
}

const OAUTH_ERRORS: Record<string, string> = {
  account_disabled: 'Your account has been disabled. Contact an administrator.',
  email_missing:
    'Your provider did not share an email address, so sign-in could not continue. Register with email and password instead.',
  email_unverified:
    'Your provider did not confirm a verified email address, so no account was created or linked. Verify the address with your provider, or register with email and password.',
  oauth_invalid_state: 'Authentication failed because the request expired. Please try again.',
  oauth_code_exchange_failed:
    'Authentication failed while contacting the provider. Please try again.',
  oauth_profile_failed: 'The provider profile could not be loaded. Please try again.',
  oauth_registration_failed: 'Your account could not be created. Please try again.',
  oauth_already_linked_other: 'That provider account is already linked to a different user.',
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getCurrentUser();
  if (user) redirect('/dashboard');

  const params = await searchParams;
  const oauthError = params.error ? OAUTH_ERRORS[params.error] : null;
  const githubEnabled = isGitHubEnabled();
  const googleEnabled = isGoogleEnabled();
  const hasOAuth = githubEnabled || googleEnabled;
  const passwordRecoveryEnabled = isEmailConfigured();

  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-4 py-12">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.08)_0%,transparent_60%)] blur-3xl" />
        <div className="absolute -right-40 bottom-0 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.06)_0%,transparent_60%)] blur-3xl" />
      </div>

      <div className="animate-fade-up w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Link href="/" className="mb-5" aria-label="DerList home">
            <LogoIcon size="lg" />
          </Link>
          <span className="border-accent/30 bg-accent/5 text-accent mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium tracking-wide uppercase">
            <span aria-hidden className="bg-accent h-1.5 w-1.5 rounded-full" />
            Open Beta
          </span>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">Welcome back</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Sign in to your {siteConfig.name} account
          </p>
        </div>

        {params.verified === '1' && (
          <div
            role="status"
            className="border-success/30 bg-success/5 text-success mb-5 rounded-xl border px-4 py-3 text-xs"
          >
            Your email address is verified. You can sign in now.
          </div>
        )}

        {oauthError && (
          <div
            role="alert"
            className="border-danger/20 bg-danger/5 text-danger mb-5 rounded-xl border px-4 py-3 text-xs"
          >
            {oauthError}
          </div>
        )}

        {hasOAuth && (
          <>
            <OAuthButtons githubEnabled={githubEnabled} googleEnabled={googleEnabled} />
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="border-border w-full border-t" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-background text-muted-foreground px-3 text-xs">
                  or sign in with email or username
                </span>
              </div>
            </div>
          </>
        )}

        <LoginForm passwordRecoveryEnabled={passwordRecoveryEnabled} />

        <p className="text-muted-foreground mt-6 text-center text-sm">
          New to {siteConfig.name}?{' '}
          <Link
            href="/register"
            className="text-accent focus-visible:ring-ring rounded-sm font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
          >
            Create a free account
          </Link>
        </p>
      </div>
    </div>
  );
}
