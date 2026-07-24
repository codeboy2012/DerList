'use client';

import { useActionState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CheckCircle2, Loader2 } from 'lucide-react';

import type { ActionState } from '../../../(auth)/actions';
import { updateProfileAction } from '../actions';

const initialState: ActionState = { success: false };

interface ProfileFormProps {
  user: {
    id: string;
    email: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

export function ProfileForm({ user }: ProfileFormProps) {
  const [state, formAction, pending] = useActionState(updateProfileAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {state.success && (
        <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">
          <CheckCircle2 className="h-4 w-4" /> Profile updated.
        </div>
      )}
      {state.error && (
        <div role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {state.error}
        </div>
      )}

      {/* Avatar */}
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent/10 text-lg font-medium text-accent">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            user.displayName.charAt(0).toUpperCase()
          )}
        </span>
        <div className="flex flex-col gap-1">
          <label htmlFor="prof-avatar" className="text-sm font-medium text-foreground">Avatar URL</label>
          <Input id="prof-avatar" name="avatarUrl" defaultValue={user.avatarUrl ?? ''} placeholder="https://..." className="max-w-xs" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="prof-display" className="text-sm font-medium text-foreground">Display Name</label>
          <Input id="prof-display" name="displayName" defaultValue={user.displayName} required />
          {state.fieldErrors?.displayName && <p className="text-xs text-danger">{state.fieldErrors.displayName[0]}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="prof-username" className="text-sm font-medium text-foreground">Username</label>
          <Input id="prof-username" name="username" defaultValue={user.username} required />
          {state.fieldErrors?.username && <p className="text-xs text-danger">{state.fieldErrors.username[0]}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">Email</label>
        <Input value={user.email} disabled className="opacity-60" />
        <p className="text-xs text-muted-foreground">Email cannot be changed.</p>
      </div>

      <Button type="submit" disabled={pending} className="w-fit gap-2">
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {pending ? 'Saving...' : 'Save Changes'}
      </Button>
    </form>
  );
}
