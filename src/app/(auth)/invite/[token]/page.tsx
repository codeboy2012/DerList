import type { Metadata } from 'next';

import Link from 'next/link';

import { Button } from '@/components/ui/Button';
import { prisma } from '@/lib/prisma';
import { siteConfig } from '@/lib/site-config';

import { InviteForm } from './InviteForm';

export const metadata: Metadata = {
  title: `Accept Invitation — ${siteConfig.name}`,
  description: 'Accept your invitation and create your DerList account.',
};

interface InvitePageProps {
  params: Promise<{ token: string }>;
}

/**
 * /invite/[token] — Invitation acceptance page.
 *
 * Validates the token on the server side and shows appropriate messaging
 * if the invitation is invalid, expired, or already used.
 */
export default async function InvitePage({ params }: InvitePageProps) {
  const { token } = await params;

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    select: {
      email: true,
      expiresAt: true,
      acceptedAt: true,
    },
  });

  // Determine error state
  let errorMessage: string | null = null;

  if (!invitation) {
    errorMessage = 'This invitation link is invalid or does not exist.';
  } else if (invitation.acceptedAt) {
    errorMessage = 'This invitation has already been used. If you already created your account, you can sign in.';
  } else if (invitation.expiresAt < new Date()) {
    errorMessage = 'This invitation has expired. Please contact an administrator for a new one.';
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-4 py-12">
      {/* Ambient background */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.12)_0%,transparent_70%)] blur-3xl" />
        <div className="absolute -right-32 bottom-0 h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.08)_0%,transparent_70%)] blur-3xl" />
      </div>

      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 ring-1 ring-accent/20">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6 text-accent"
              aria-hidden
            >
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {errorMessage ? 'Invalid Invitation' : 'Create Your Account'}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {errorMessage
              ? 'There was a problem with your invitation.'
              : `You've been invited to join ${siteConfig.name}.`}
          </p>
        </div>

        {/* Error state or form */}
        {errorMessage ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">{errorMessage}</p>
            <Button asChild variant="outline">
              <Link href="/login">Go to Sign In</Link>
            </Button>
          </div>
        ) : (
          <InviteForm token={token} email={invitation!.email} />
        )}
      </div>
    </div>
  );
}
