import type { Metadata } from 'next';
import Link from 'next/link';
import { findEmailToken } from '@/lib/auth/tokens';
import { siteConfig } from '@/lib/site-config';
import { Button } from '@/components/ui/Button';
import { LogoIcon } from '@/components/ui/Logo';
import { verifyEmailAction } from './actions';

export const metadata: Metadata = {
  title: `Verify Email — ${siteConfig.name}`,
  description: 'Confirm your DerList email address.',
};

interface VerifyEmailPageProps {
  searchParams: Promise<{ token?: string; status?: string }>;
}

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const { token, status } = await searchParams;
  const valid =
    token && status !== 'invalid' ? await findEmailToken(token, 'EMAIL_VERIFICATION') : null;

  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Link href="/" className="mb-5" aria-label="DerList home">
            <LogoIcon size="lg" />
          </Link>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">
            {valid ? 'Verify your email' : 'Verification link unavailable'}
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            {valid
              ? `Confirm this address to finish setting up your ${siteConfig.name} account.`
              : 'This verification link is invalid, expired, or has already been used.'}
          </p>
        </div>

        {valid && token ? (
          <form
            action={verifyEmailAction}
            className="border-border bg-card flex flex-col gap-4 rounded-2xl border p-8 text-center"
          >
            <input type="hidden" name="token" value={token} />
            <p className="text-muted-foreground text-sm">
              Verifying confirms you can receive mail at this address. It does not make your
              collections public.
            </p>
            <Button type="submit" className="w-full">
              Confirm email address
            </Button>
          </form>
        ) : (
          <div className="border-border bg-card flex flex-col items-center gap-4 rounded-2xl border p-8 text-center">
            <p className="text-muted-foreground text-sm">
              Sign in and request a new verification email from your account settings.
            </p>
            <Button asChild variant="outline">
              <Link href="/login">Go to sign in</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
