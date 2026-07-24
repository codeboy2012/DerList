'use client';

import { useActionState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Loader2 } from 'lucide-react';

import type { ActionState } from '../../(auth)/actions';
import { createInvitationAction } from './actions';

const initialState: ActionState = { success: false };

export function CreateInvitationForm() {
  const [state, formAction, pending] = useActionState(createInvitationAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.error && (
        <div role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {state.error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="inv-email" className="text-sm font-medium text-foreground">Recipient Email</label>
          <Input id="inv-email" name="email" type="email" required placeholder="user@example.com" autoComplete="off" />
          {state.fieldErrors?.email && <p className="text-xs text-danger">{state.fieldErrors.email[0]}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="inv-expires" className="text-sm font-medium text-foreground">Expires In</label>
          <Select id="inv-expires" name="expiresInDays" defaultValue="7">
            <option value="1">1 day</option>
            <option value="3">3 days</option>
            <option value="7">7 days</option>
            <option value="14">14 days</option>
            <option value="30">30 days</option>
            <option value="90">90 days</option>
          </Select>
          {state.fieldErrors?.expiresInDays && <p className="text-xs text-danger">{state.fieldErrors.expiresInDays[0]}</p>}
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={pending} size="sm" className="gap-2">
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
          {pending ? 'Creating...' : 'Create Invitation'}
        </Button>
        <Button asChild variant="ghost" size="sm">
          <a href="/admin/invitations">Cancel</a>
        </Button>
      </div>
    </form>
  );
}
