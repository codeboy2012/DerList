'use client';

import { useActionState, useState } from 'react';

import { Eye, EyeOff, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { ActionState } from '../../actions';
import { acceptInvitationAction } from './actions';

const initialState: ActionState = { success: false };

interface InviteFormProps {
  token: string;
  email: string;
}

/**
 * InviteForm — Client Component for the invitation acceptance flow.
 * Pre-fills the token (hidden) and shows the invitee's email (read-only).
 */
export function InviteForm({ token, email }: InviteFormProps) {
  const [state, formAction, pending] = useActionState(acceptInvitationAction, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-8"
      noValidate
    >
      {/* Hidden token */}
      <input type="hidden" name="token" value={token} />

      {/* Form-level error */}
      {state.error && (
        <div
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
        >
          {state.error}
        </div>
      )}

      {/* Email (read-only, pre-filled from invitation) */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="invite-email" className="text-sm font-medium text-foreground">
          Email
        </label>
        <Input
          id="invite-email"
          type="email"
          value={email}
          readOnly
          disabled
          className="opacity-70"
        />
        <p className="text-xs text-muted-foreground">
          This is the email your invitation was sent to.
        </p>
      </div>

      {/* Username */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="invite-username" className="text-sm font-medium text-foreground">
          Username
        </label>
        <Input
          id="invite-username"
          name="username"
          required
          placeholder="yourname"
          autoComplete="username"
          aria-invalid={!!state.fieldErrors?.username}
          aria-describedby={state.fieldErrors?.username ? 'invite-username-error' : undefined}
        />
        {state.fieldErrors?.username ? (
          <p id="invite-username-error" className="text-xs text-danger">
            {state.fieldErrors.username[0]}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Lowercase letters, numbers, hyphens, underscores. 3–32 characters.
          </p>
        )}
      </div>

      {/* Display Name */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="invite-displayname" className="text-sm font-medium text-foreground">
          Display Name
        </label>
        <Input
          id="invite-displayname"
          name="displayName"
          required
          placeholder="Your Name"
          autoComplete="name"
          aria-invalid={!!state.fieldErrors?.displayName}
          aria-describedby={state.fieldErrors?.displayName ? 'invite-displayname-error' : undefined}
        />
        {state.fieldErrors?.displayName && (
          <p id="invite-displayname-error" className="text-xs text-danger">
            {state.fieldErrors.displayName[0]}
          </p>
        )}
      </div>

      {/* Password */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="invite-password" className="text-sm font-medium text-foreground">
          Password
        </label>
        <div className="relative">
          <Input
            id="invite-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            required
            placeholder="At least 8 characters"
            autoComplete="new-password"
            className="pr-10"
            aria-invalid={!!state.fieldErrors?.password}
            aria-describedby={state.fieldErrors?.password ? 'invite-password-error' : undefined}
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card rounded-sm"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" aria-hidden />
            ) : (
              <Eye className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>
        {state.fieldErrors?.password && (
          <p id="invite-password-error" className="text-xs text-danger">
            {state.fieldErrors.password[0]}
          </p>
        )}
      </div>

      {/* Confirm Password */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="invite-confirm" className="text-sm font-medium text-foreground">
          Confirm Password
        </label>
        <div className="relative">
          <Input
            id="invite-confirm"
            name="confirmPassword"
            type={showConfirm ? 'text' : 'password'}
            required
            placeholder="Re-enter your password"
            autoComplete="new-password"
            className="pr-10"
            aria-invalid={!!state.fieldErrors?.confirmPassword}
            aria-describedby={
              state.fieldErrors?.confirmPassword ? 'invite-confirm-error' : undefined
            }
          />
          <button
            type="button"
            onClick={() => setShowConfirm((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card rounded-sm"
            aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
          >
            {showConfirm ? (
              <EyeOff className="h-4 w-4" aria-hidden />
            ) : (
              <Eye className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>
        {state.fieldErrors?.confirmPassword && (
          <p id="invite-confirm-error" className="text-xs text-danger">
            {state.fieldErrors.confirmPassword[0]}
          </p>
        )}
      </div>

      {/* Submit */}
      <Button
        type="submit"
        disabled={pending}
        className="mt-1 w-full gap-2 bg-accent text-accent-foreground shadow-lg shadow-accent/20 hover:bg-accent/90 disabled:opacity-60"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {pending ? 'Creating account...' : 'Create Account'}
      </Button>
    </form>
  );
}
