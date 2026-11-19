'use client';

import { useActionState, useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { ActionState } from '../actions';
import { resetPasswordAction } from './actions';

const initialState: ActionState = { success: false };

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initialState);
  const [visible, setVisible] = useState(false);

  return (
    <form
      action={formAction}
      className="border-border bg-card flex flex-col gap-5 rounded-2xl border p-8"
      noValidate
    >
      <input type="hidden" name="token" value={token} />

      {state.error && (
        <div
          role="alert"
          className="border-danger/30 bg-danger/5 text-danger rounded-lg border px-4 py-3 text-sm"
        >
          {state.error}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="reset-password" className="text-foreground text-sm font-medium">
          New password
        </label>
        <div className="relative">
          <Input
            id="reset-password"
            name="password"
            type={visible ? 'text' : 'password'}
            required
            autoComplete="new-password"
            placeholder="At least 8 characters"
            className="pr-11"
            aria-invalid={!!state.fieldErrors?.password}
            aria-describedby={
              state.fieldErrors?.password ? 'reset-password-error' : 'reset-password-hint'
            }
          />
          <button
            type="button"
            onClick={() => setVisible((value) => !value)}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring focus-visible:ring-offset-card absolute top-1/2 right-3 -translate-y-1/2 rounded-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            aria-label={visible ? 'Hide password' : 'Show password'}
            aria-pressed={visible}
          >
            {visible ? (
              <EyeOff className="h-4 w-4" aria-hidden />
            ) : (
              <Eye className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>
        {state.fieldErrors?.password ? (
          <p id="reset-password-error" className="text-danger text-xs">
            {state.fieldErrors.password[0]}
          </p>
        ) : (
          <p id="reset-password-hint" className="text-muted-foreground text-xs">
            Use at least 8 characters. All other signed-in devices will be signed out.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="reset-confirm" className="text-foreground text-sm font-medium">
          Confirm new password
        </label>
        <Input
          id="reset-confirm"
          name="confirmPassword"
          type={visible ? 'text' : 'password'}
          required
          autoComplete="new-password"
          placeholder="Re-enter your password"
          aria-invalid={!!state.fieldErrors?.confirmPassword}
          aria-describedby={state.fieldErrors?.confirmPassword ? 'reset-confirm-error' : undefined}
        />
        {state.fieldErrors?.confirmPassword && (
          <p id="reset-confirm-error" className="text-danger text-xs">
            {state.fieldErrors.confirmPassword[0]}
          </p>
        )}
      </div>

      <Button type="submit" disabled={pending} className="w-full gap-2">
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {pending ? 'Saving…' : 'Save new password'}
      </Button>
    </form>
  );
}
