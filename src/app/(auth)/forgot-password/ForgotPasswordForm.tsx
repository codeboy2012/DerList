'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { ActionState } from '../actions';
import { requestPasswordResetAction } from './actions';

const initialState: ActionState = { success: false };

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, initialState);

  if (state.success) {
    return (
      <div
        role="status"
        className="border-success/30 bg-success/5 text-success flex flex-col items-center gap-3 rounded-2xl border p-8 text-center text-sm"
      >
        <CheckCircle2 className="h-6 w-6" aria-hidden />
        <p>
          If an account exists for that email address, a password reset link has been sent. The link
          expires in one hour.
        </p>
        <Link href="/login" className="text-accent rounded-sm text-xs font-medium hover:underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="border-border bg-card flex flex-col gap-5 rounded-2xl border p-8"
      noValidate
    >
      {state.error && (
        <div
          role="alert"
          className="border-danger/30 bg-danger/5 text-danger rounded-lg border px-4 py-3 text-sm"
        >
          {state.error}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="forgot-email" className="text-foreground text-sm font-medium">
          Email
        </label>
        <Input
          id="forgot-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="you@example.com"
          aria-invalid={!!state.fieldErrors?.email}
          aria-describedby={state.fieldErrors?.email ? 'forgot-email-error' : undefined}
        />
        {state.fieldErrors?.email && (
          <p id="forgot-email-error" className="text-danger text-xs">
            {state.fieldErrors.email[0]}
          </p>
        )}
      </div>

      <Button type="submit" disabled={pending} className="w-full gap-2">
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {pending ? 'Sending…' : 'Send reset link'}
      </Button>
    </form>
  );
}
