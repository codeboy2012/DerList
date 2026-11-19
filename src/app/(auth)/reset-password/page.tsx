import type { Metadata } from 'next';
import Link from 'next/link';
import { findEmailToken } from '@/lib/auth/tokens';
import { siteConfig } from '@/lib/site-config';
import { Button } from '@/components/ui/Button';
import { LogoIcon } from '@/components/ui/Logo';
import { ResetPasswordForm } from './ResetPasswordForm';

export const metadata: Metadata = {
  title: `Choose a New Password — ${siteConfig.name}`,
  description: 'Choose a new password for your DerList account.',
};

interface ResetPasswordPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const { token } = await searchParams;
  const valid = token ? await findEmailToken(token, 'PASSWORD_RESET') : null;

  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Link href="/" className="mb-5" aria-label="DerList home">
            <LogoIcon size="lg" />
          </Link>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">
            {valid ? 'Choose a new password' : 'Reset link unavailable'}
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            {valid
              ? 'This link can be used once and expires one hour after it was sent.'
              : 'This password reset link is invalid, expired, or has already been used.'}
          </p>
        </div>

        {valid && token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <div className="border-border bg-card flex flex-col items-center gap-4 rounded-2xl border p-8 text-center">
            <p className="text-muted-foreground text-sm">
              Request a new link to continue. For security, previous reset links stop working when a
              new one is requested.
            </p>
            <Button asChild variant="outline">
              <Link href="/forgot-password">Request a new link</Link>
            </Button>
          </div>
        )}

        <p className="text-muted-foreground mt-6 text-center text-sm">
          <Link
            href="/login"
            className="text-accent focus-visible:ring-ring rounded-sm font-medium hover:underline focus-visible:ring-2 focus-visible:outline-none"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
