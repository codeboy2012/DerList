'use client';

import { useActionState } from 'react';
import { CheckCircle2, Loader2, MailCheck, MailWarning } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import type { ActionState } from '../../../(auth)/actions';
import { resendVerificationAction } from '../actions';

const initialState: ActionState = { success: false };

interface EmailVerificationCardProps {
  email: string;
  username: string;
  verified: boolean;
  emailConfigured: boolean;
}

export function EmailVerificationCard({
  email,
  username,
  verified,
  emailConfigured,
}: EmailVerificationCardProps) {
  const [state, formAction, pending] = useActionState(resendVerificationAction, initialState);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MailCheck className="text-accent h-4 w-4" aria-hidden />
          Account identity
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground text-sm">Username</span>
          <span className="text-foreground font-mono text-sm">@{username}</span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-muted-foreground text-sm">Email</span>
          <span className="flex items-center gap-2">
            <span className="text-foreground text-sm">{email}</span>
            <Badge variant={verified ? 'success' : 'warning'}>
              {verified ? 'Verified' : 'Unverified'}
            </Badge>
          </span>
        </div>

        {!verified && emailConfigured && (
          <div className="border-border flex flex-col gap-3 border-t pt-4">
            <p className="text-muted-foreground flex items-start gap-2 text-xs">
              <MailWarning className="text-warning mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              Verify this address to confirm you can receive mail. Your collections stay private
              either way.
            </p>

            {state.success && (
              <p
                role="status"
                className="border-success/30 bg-success/5 text-success flex items-center gap-2 rounded-lg border px-3 py-2 text-xs"
              >
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                Verification email sent. Check your inbox.
              </p>
            )}
            {state.error && (
              <p role="alert" className="text-danger text-xs">
                {state.error}
              </p>
            )}

            <form action={formAction}>
              <Button
                type="submit"
                variant="secondary"
                size="sm"
                disabled={pending}
                className="gap-2"
              >
                {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                {pending ? 'Sending…' : 'Resend verification email'}
              </Button>
            </form>
          </div>
        )}

        {!verified && !emailConfigured && (
          <p className="text-muted-foreground border-border border-t pt-4 text-xs">
            Email delivery is not configured on this instance, so verification emails cannot be
            sent. This does not restrict your account.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
