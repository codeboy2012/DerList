'use client';

import { useActionState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { ActionState } from '../../../(auth)/actions';
import { changePasswordAction } from '../actions';

const initialState: ActionState = { success: false };

export function ChangePasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [state, formAction, pending] = useActionState(changePasswordAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.success && (
        <div
          role="status"
          className="border-success/30 bg-success/5 text-success flex items-center gap-2 rounded-lg border px-4 py-3 text-sm"
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          {hasPassword ? 'Password changed successfully.' : 'Password set successfully.'}
        </div>
      )}
      {state.error && (
        <div
          role="alert"
          className="border-danger/30 bg-danger/5 text-danger rounded-lg border px-4 py-3 text-sm"
        >
          {state.error}
        </div>
      )}

      {!hasPassword && (
        <p className="text-muted-foreground text-sm">
          This account was created with GitHub or Google and does not have a password yet. Set one
          to sign in with your email or username as well.
        </p>
      )}

      {hasPassword && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pw-current" className="text-foreground text-sm font-medium">
            Current Password
          </label>
          <Input
            id="pw-current"
            name="currentPassword"
            type="password"
            required
            autoComplete="current-password"
            aria-invalid={!!state.fieldErrors?.currentPassword}
          />
          {state.fieldErrors?.currentPassword && (
            <p className="text-danger text-xs">{state.fieldErrors.currentPassword[0]}</p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="pw-new" className="text-foreground text-sm font-medium">
          {hasPassword ? 'New Password' : 'Password'}
        </label>
        <Input
          id="pw-new"
          name="newPassword"
          type="password"
          required
          autoComplete="new-password"
          placeholder="Min 8 characters"
          aria-invalid={!!state.fieldErrors?.newPassword}
        />
        {state.fieldErrors?.newPassword && (
          <p className="text-danger text-xs">{state.fieldErrors.newPassword[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="pw-confirm" className="text-foreground text-sm font-medium">
          Confirm {hasPassword ? 'New ' : ''}Password
        </label>
        <Input
          id="pw-confirm"
          name="confirmPassword"
          type="password"
          required
          autoComplete="new-password"
          aria-invalid={!!state.fieldErrors?.confirmPassword}
        />
        {state.fieldErrors?.confirmPassword && (
          <p className="text-danger text-xs">{state.fieldErrors.confirmPassword[0]}</p>
        )}
      </div>

      <Button type="submit" disabled={pending} className="w-fit gap-2">
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {pending ? 'Saving…' : hasPassword ? 'Change Password' : 'Set Password'}
      </Button>
    </form>
  );
}
