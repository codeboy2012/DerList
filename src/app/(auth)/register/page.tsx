import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cn } from '@/utils/cn';
import { getCurrentUser } from '@/lib/auth';
import { isGitHubEnabled, isGoogleEnabled } from '@/lib/auth/oauth';
import { siteConfig } from '@/lib/site-config';
import { LogoIcon } from '@/components/ui/Logo';
import { OAuthButtons } from '../login/OAuthButtons';
import { RegisterForm } from './RegisterForm';

export const metadata: Metadata = {
  title: `Create Account — ${siteConfig.name}`,
  description:
    'Create a free DerList account with a username, an email address, GitHub or Google. Open to everyone.',
};

interface RegisterPageProps {
  searchParams: Promise<{ method?: string; error?: string }>;
}

const METHOD_COPY = {
  username: {
    title: 'Choose a username',
    description: 'Your username is your public handle inside DerList and can be used to sign in.',
  },
  email: {
    title: 'Register with email',
    description: 'We create a username from your email address; you can change it later.',
  },
} as const;

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const user = await getCurrentUser();
  if (user) redirect('/dashboard');

  const params = await searchParams;
  const method = params.method === 'email' ? 'email' : 'username';
  const githubEnabled = isGitHubEnabled();
  const googleEnabled = isGoogleEnabled();
  const hasOAuth = githubEnabled || googleEnabled;

  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-4 py-12">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.1)_0%,transparent_60%)] blur-3xl" />
        <div className="absolute -right-40 bottom-0 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.08)_0%,transparent_60%)] blur-3xl" />
      </div>

      <div className="animate-fade-up w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <Link href="/" className="mb-5" aria-label="DerList home">
            <LogoIcon size="lg" />
          </Link>
          <span className="border-accent/30 bg-accent/5 text-accent mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium tracking-wide uppercase">
            <span aria-hidden className="bg-accent h-1.5 w-1.5 animate-pulse rounded-full" />
            Open Beta — everyone can join
          </span>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">Create your account</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Free forever. No invitation or approval needed.
          </p>
        </div>

        {params.error === 'email_unverified' && (
          <div
            role="alert"
            className="border-warning/30 bg-warning/5 text-warning mb-5 rounded-xl border px-4 py-3 text-xs"
          >
            Your provider did not confirm a verified email address, so no account was created.
            Verify the address with your provider, or register with email and password below.
          </div>
        )}

        {hasOAuth && (
          <>
            <OAuthButtons
              githubEnabled={githubEnabled}
              googleEnabled={googleEnabled}
              mode="register"
            />
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="border-border w-full border-t" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-background text-muted-foreground px-3 text-xs">
                  or register with
                </span>
              </div>
            </div>
          </>
        )}

        <div
          className="border-border bg-surface/60 mb-5 grid grid-cols-2 gap-1 rounded-xl border p-1"
          aria-label="Registration method"
        >
          <Link
            href="/register"
            aria-current={method === 'username' ? 'page' : undefined}
            className={cn(
              'rounded-lg px-3 py-2 text-center text-sm font-medium transition-colors',
              'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
              method === 'username'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Username
          </Link>
          <Link
            href="/register?method=email"
            aria-current={method === 'email' ? 'page' : undefined}
            className={cn(
              'rounded-lg px-3 py-2 text-center text-sm font-medium transition-colors',
              'focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
              method === 'email'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Email
          </Link>
        </div>

        <div className="mb-5">
          <h2 className="text-foreground text-sm font-semibold">{METHOD_COPY[method].title}</h2>
          <p className="text-muted-foreground mt-1 text-xs">{METHOD_COPY[method].description}</p>
        </div>

        <RegisterForm method={method} />

        {!hasOAuth && (
          <p className="text-muted-foreground mt-4 text-center text-xs">
            GitHub and Google sign-in are not configured on this instance.
          </p>
        )}

        <p className="text-muted-foreground mt-6 text-center text-sm">
          Already have an account?{' '}
          <Link
            href="/login"
            className="text-accent focus-visible:ring-ring rounded-sm font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
