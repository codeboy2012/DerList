'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { loginAction, type ActionState } from '../actions';

const initialState: ActionState = { success: false };

interface LoginFormProps {
  passwordRecoveryEnabled: boolean;
}

/**
 * LoginForm — Client Component handling the login form with show/hide password,
 * loading state, field-level and form-level error display.
 */
export function LoginForm({ passwordRecoveryEnabled }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form
      action={formAction}
      className="border-border bg-card flex flex-col gap-5 rounded-2xl border p-8"
      noValidate
    >
      {/* Form-level error */}
      {state.error && (
        <div
          role="alert"
          className="border-danger/30 bg-danger/5 text-danger rounded-lg border px-4 py-3 text-sm"
        >
          {state.error}
        </div>
      )}

      {/* Email or username */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="login-identifier" className="text-foreground text-sm font-medium">
          Email or username
        </label>
        <Input
          id="login-identifier"
          name="identifier"
          type="text"
          autoComplete="username"
          required
          placeholder="you@example.com or yourname"
          aria-invalid={!!state.fieldErrors?.identifier}
          aria-describedby={state.fieldErrors?.identifier ? 'login-identifier-error' : undefined}
        />
        {state.fieldErrors?.identifier && (
          <p id="login-identifier-error" className="text-danger text-xs">
            {state.fieldErrors.identifier[0]}
          </p>
        )}
      </div>

      {/* Password */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="login-password" className="text-foreground text-sm font-medium">
            Password
          </label>
          {passwordRecoveryEnabled && (
            <Link
              href="/forgot-password"
              className="text-accent focus-visible:ring-ring rounded-sm text-xs hover:underline focus-visible:ring-2 focus-visible:outline-none"
            >
              Forgot password?
            </Link>
          )}
        </div>
        <div className="relative">
          <Input
            id="login-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            placeholder="Enter your password"
            className="pr-11"
            aria-invalid={!!state.fieldErrors?.password}
            aria-describedby={state.fieldErrors?.password ? 'login-password-error' : undefined}
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring focus-visible:ring-offset-card absolute top-1/2 right-3 -translate-y-1/2 rounded-sm transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" aria-hidden />
            ) : (
              <Eye className="h-4 w-4" aria-hidden />
            )}
          </button>
        </div>
        {state.fieldErrors?.password && (
          <p id="login-password-error" className="text-danger text-xs">
            {state.fieldErrors.password[0]}
          </p>
        )}
      </div>

      {/* Submit */}
      <Button
        type="submit"
        disabled={pending}
        className="bg-accent text-accent-foreground shadow-accent/20 hover:bg-accent/90 mt-1 w-full gap-2 shadow-lg disabled:opacity-60"
      >
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {pending ? 'Signing in…' : 'Sign In'}
      </Button>
    </form>
  );
}
