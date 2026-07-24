'use client';

import { useActionState, useState } from 'react';

import { Eye, EyeOff, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

import { type ActionState, loginAction } from '../actions';

const initialState: ActionState = { success: false };

/**
 * LoginForm — Client Component handling the login form with show/hide password,
 * loading state, field-level and form-level error display.
 */
export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-8"
      noValidate
    >
      {/* Form-level error */}
      {state.error && (
        <div
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger"
        >
          {state.error}
        </div>
      )}

      {/* Email */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="login-email" className="text-sm font-medium text-foreground">
          Email
        </label>
        <Input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          aria-invalid={!!state.fieldErrors?.email}
          aria-describedby={state.fieldErrors?.email ? 'login-email-error' : undefined}
        />
        {state.fieldErrors?.email && (
          <p id="login-email-error" className="text-xs text-danger">
            {state.fieldErrors.email[0]}
          </p>
        )}
      </div>

      {/* Password */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="login-password" className="text-sm font-medium text-foreground">
          Password
        </label>
        <div className="relative">
          <Input
            id="login-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            placeholder="Enter your password"
            className="pr-10"
            aria-invalid={!!state.fieldErrors?.password}
            aria-describedby={state.fieldErrors?.password ? 'login-password-error' : undefined}
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
          <p id="login-password-error" className="text-xs text-danger">
            {state.fieldErrors.password[0]}
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
        {pending ? 'Signing in...' : 'Sign In'}
      </Button>
    </form>
  );
}
