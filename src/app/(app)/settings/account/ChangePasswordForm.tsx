'use client';

import { useActionState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CheckCircle2, Loader2 } from 'lucide-react';

import type { ActionState } from '../../../(auth)/actions';
import { changePasswordAction } from '../actions';

const initialState: ActionState = { success: false };

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.success && (
        <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">
          <CheckCircle2 className="h-4 w-4" /> Password changed successfully.
        </div>
      )}
      {state.error && (
        <div role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {state.error}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="pw-current" className="text-sm font-medium text-foreground">Current Password</label>
        <Input id="pw-current" name="currentPassword" type="password" required autoComplete="current-password" />
        {state.fieldErrors?.currentPassword && <p className="text-xs text-danger">{state.fieldErrors.currentPassword[0]}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="pw-new" className="text-sm font-medium text-foreground">New Password</label>
        <Input id="pw-new" name="newPassword" type="password" required autoComplete="new-password" placeholder="Min 8 characters" />
        {state.fieldErrors?.newPassword && <p className="text-xs text-danger">{state.fieldErrors.newPassword[0]}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="pw-confirm" className="text-sm font-medium text-foreground">Confirm New Password</label>
        <Input id="pw-confirm" name="confirmPassword" type="password" required autoComplete="new-password" />
        {state.fieldErrors?.confirmPassword && <p className="text-xs text-danger">{state.fieldErrors.confirmPassword[0]}</p>}
      </div>

      <Button type="submit" disabled={pending} className="w-fit gap-2">
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {pending ? 'Changing...' : 'Change Password'}
      </Button>
    </form>
  );
}
