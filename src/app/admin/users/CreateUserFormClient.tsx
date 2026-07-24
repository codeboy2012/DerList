'use client';

import { useActionState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Loader2 } from 'lucide-react';

import type { ActionState } from '../../(auth)/actions';
import { createUserAction } from './actions';

const initialState: ActionState = { success: false };

export function CreateUserFormClient() {
  const [state, formAction, pending] = useActionState(createUserAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {state.error && (
        <div role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {state.error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cu-email" className="text-sm font-medium text-foreground">Email</label>
          <Input id="cu-email" name="email" type="email" required placeholder="user@example.com" autoComplete="off" />
          {state.fieldErrors?.email && <p className="text-xs text-danger">{state.fieldErrors.email[0]}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="cu-username" className="text-sm font-medium text-foreground">Username</label>
          <Input id="cu-username" name="username" required placeholder="username" autoComplete="off" />
          {state.fieldErrors?.username && <p className="text-xs text-danger">{state.fieldErrors.username[0]}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="cu-displayName" className="text-sm font-medium text-foreground">Display Name</label>
          <Input id="cu-displayName" name="displayName" required placeholder="Full Name" autoComplete="off" />
          {state.fieldErrors?.displayName && <p className="text-xs text-danger">{state.fieldErrors.displayName[0]}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="cu-password" className="text-sm font-medium text-foreground">Temporary Password</label>
          <Input id="cu-password" name="password" type="password" required placeholder="Min 8 characters" autoComplete="new-password" />
          {state.fieldErrors?.password && <p className="text-xs text-danger">{state.fieldErrors.password[0]}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="cu-role" className="text-sm font-medium text-foreground">Role</label>
          <Select id="cu-role" name="role" defaultValue="USER">
            <option value="USER">User</option>
            <option value="ADMIN">Admin</option>
          </Select>
          {state.fieldErrors?.role && <p className="text-xs text-danger">{state.fieldErrors.role[0]}</p>}
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={pending} size="sm" className="gap-2">
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
          {pending ? 'Creating...' : 'Create User'}
        </Button>
        <Button asChild variant="ghost" size="sm">
          <a href="/admin/users">Cancel</a>
        </Button>
      </div>
    </form>
  );
}
