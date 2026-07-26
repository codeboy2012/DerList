'use client';

import { useActionState, useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { Input } from '@/components/ui/Input';
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
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {state.success && (
        <div className="border-success/30 bg-success/5 text-success flex items-center gap-2 rounded-lg border px-4 py-3 text-sm">
          <CheckCircle2 className="h-4 w-4" /> Profile updated.
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

      {/* Avatar Upload */}
      <div>
        <label className="text-foreground mb-2 block text-sm font-medium">Profile Picture</label>
        <ImageUpload
          value={avatarUrl}
          onChange={setAvatarUrl}
          purpose="avatar"
          shape="circle"
          size="md"
          placeholder="Upload photo"
        />
        <input type="hidden" name="avatarUrl" value={avatarUrl ?? ''} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="prof-display" className="text-foreground text-sm font-medium">
            Display Name
          </label>
          <Input id="prof-display" name="displayName" defaultValue={user.displayName} required />
          {state.fieldErrors?.displayName && (
            <p className="text-danger text-xs">{state.fieldErrors.displayName[0]}</p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="prof-username" className="text-foreground text-sm font-medium">
            Username
          </label>
          <Input id="prof-username" name="username" defaultValue={user.username} required />
          {state.fieldErrors?.username && (
            <p className="text-danger text-xs">{state.fieldErrors.username[0]}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-foreground text-sm font-medium">Email</label>
        <Input value={user.email} disabled className="opacity-60" />
        <p className="text-muted-foreground text-xs">Email cannot be changed.</p>
      </div>

      <Button type="submit" disabled={pending} className="w-fit gap-2">
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {pending ? 'Saving...' : 'Save Changes'}
      </Button>
    </form>
  );
}
