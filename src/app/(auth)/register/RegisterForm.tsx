'use client';

import { useActionState, useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { ActionState } from '../actions';
import { registerAction } from './actions';

const initialState: ActionState = { success: false };

interface RegisterFormProps {
  method: 'username' | 'email';
}

export function RegisterForm({ method }: RegisterFormProps) {
  const [state, formAction, pending] = useActionState(registerAction, initialState);

  return (
    <form
      action={formAction}
      className="border-border bg-card flex flex-col gap-5 rounded-2xl border p-8"
      noValidate
    >
      <input type="hidden" name="method" value={method} />

      {/* Honeypot — hidden from people and assistive technology. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-[9999px] h-0 w-0 overflow-hidden"
      >
        <label htmlFor="register-website">Website</label>
        <input id="register-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {state.error && (
        <div
          role="alert"
          className="border-danger/30 bg-danger/5 text-danger rounded-lg border px-4 py-3 text-sm"
        >
          {state.error}
        </div>
      )}

      {method === 'username' && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="register-username" className="text-foreground text-sm font-medium">
            Username
          </label>
          <Input
            id="register-username"
            name="username"
            required
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="yourname"
            aria-invalid={!!state.fieldErrors?.username}
            aria-describedby={
              state.fieldErrors?.username ? 'register-username-error' : 'register-username-hint'
            }
          />
          {state.fieldErrors?.username ? (
            <p id="register-username-error" className="text-danger text-xs">
              {state.fieldErrors.username[0]}
            </p>
          ) : (
            <p id="register-username-hint" className="text-muted-foreground text-xs">
              3–32 characters. Letters, numbers, hyphens and underscores; saved in lowercase.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="register-email" className="text-foreground text-sm font-medium">
          Email
        </label>
        <Input
          id="register-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="you@example.com"
          aria-invalid={!!state.fieldErrors?.email}
          aria-describedby={
            state.fieldErrors?.email ? 'register-email-error' : 'register-email-hint'
          }
        />
        {state.fieldErrors?.email ? (
          <p id="register-email-error" className="text-danger text-xs">
            {state.fieldErrors.email[0]}
          </p>
        ) : (
          <p id="register-email-hint" className="text-muted-foreground text-xs">
            {method === 'email'
              ? 'Your username is generated from this address and can be changed later.'
              : 'Used for account recovery and, when enabled, email verification.'}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="register-displayname" className="text-foreground text-sm font-medium">
          Display name <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <Input
          id="register-displayname"
          name="displayName"
          autoComplete="name"
          maxLength={64}
          placeholder="Your name"
          aria-invalid={!!state.fieldErrors?.displayName}
          aria-describedby={
            state.fieldErrors?.displayName ? 'register-displayname-error' : undefined
          }
        />
        {state.fieldErrors?.displayName && (
          <p id="register-displayname-error" className="text-danger text-xs">
            {state.fieldErrors.displayName[0]}
          </p>
        )}
      </div>

      <PasswordField
        id="register-password"
        name="password"
        label="Password"
        autoComplete="new-password"
        placeholder="At least 8 characters"
        error={state.fieldErrors?.password?.[0]}
        hint="Use at least 8 characters. A longer passphrase is easier to remember and harder to guess."
      />

      <PasswordField
        id="register-confirm"
        name="confirmPassword"
        label="Confirm password"
        autoComplete="new-password"
        placeholder="Re-enter your password"
        error={state.fieldErrors?.confirmPassword?.[0]}
      />

      <Button
        type="submit"
        disabled={pending}
        className="bg-accent text-accent-foreground shadow-accent/20 hover:bg-accent/90 mt-1 w-full gap-2 shadow-lg disabled:opacity-60"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {pending ? 'Creating account…' : 'Create account'}
      </Button>

      <p className="text-muted-foreground text-center text-[11px] leading-relaxed">
        By creating an account you agree to use DerList responsibly. Your collections stay private
        to your account.
      </p>
    </form>
  );
}

function PasswordField({
  id,
  name,
  label,
  autoComplete,
  placeholder,
  error,
  hint,
}: {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
  placeholder: string;
  error?: string;
  hint?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-foreground text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          required
          autoComplete={autoComplete}
          placeholder={placeholder}
          className="pr-11"
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring focus-visible:ring-offset-card absolute top-1/2 right-3 -translate-y-1/2 rounded-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={visible}
        >
          {visible ? (
            <EyeOff className="h-4 w-4" aria-hidden />
          ) : (
            <Eye className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-danger text-xs">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
