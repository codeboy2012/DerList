import type { Metadata } from 'next';
import Link from 'next/link';
import { isEmailConfigured } from '@/lib/email';
import { siteConfig } from '@/lib/site-config';
import { LogoIcon } from '@/components/ui/Logo';
import { ForgotPasswordForm } from './ForgotPasswordForm';

export const metadata: Metadata = {
  title: `Reset Password — ${siteConfig.name}`,
  description: 'Request a password reset link for your DerList account.',
};

// SMTP configuration is read at runtime; a static build would bake in the
// build machine's (usually unconfigured) state.
export const dynamic = 'force-dynamic';

export default function ForgotPasswordPage() {
  const emailConfigured = isEmailConfigured();

  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Link href="/" className="mb-5" aria-label="DerList home">
            <LogoIcon size="lg" />
          </Link>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">Reset your password</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            {emailConfigured
              ? 'Enter the email address on your account and we will send a reset link.'
              : 'Password recovery by email is not available on this instance.'}
          </p>
        </div>

        {emailConfigured ? (
          <ForgotPasswordForm />
        ) : (
          <div className="border-border bg-card flex flex-col gap-4 rounded-2xl border p-8 text-center">
            <p className="text-muted-foreground text-sm leading-relaxed">
              This DerList instance has no email delivery configured, so it cannot send reset links.
              Ask the person who runs this instance to reset your password from the admin panel.
            </p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              If you run this instance, set <code className="text-foreground">SMTP_HOST</code> and{' '}
              <code className="text-foreground">SMTP_FROM</code> and restart the app to enable
              password recovery and email verification.
            </p>
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
