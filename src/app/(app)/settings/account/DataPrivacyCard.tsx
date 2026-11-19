'use client';

import { useActionState } from 'react';
import { Download, Loader2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import type { ActionState } from '../../../(auth)/actions';
import { deleteAccountAction } from './account-actions';

const initialState: ActionState = { success: false };

/**
 * Data ownership controls: JSON export and permanent account deletion.
 * Both act only on the signed-in user's own account.
 */
export function DataPrivacyCard({ hasPassword }: { hasPassword: boolean }) {
  const [state, formAction, pending] = useActionState(deleteAccountAction, initialState);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Download className="text-accent h-4 w-4" aria-hidden />
          Your data
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-sm">
            Download every collection, product and note in your account as JSON. API keys are never
            included.
          </p>
          <div>
            <Button asChild variant="secondary" size="sm" className="gap-2">
              <a href="/api/account/export" download>
                <Download className="h-3.5 w-3.5" aria-hidden />
                Export my data
              </a>
            </Button>
          </div>
        </div>

        <div className="border-danger/25 bg-danger/[0.03] rounded-lg border p-4">
          <div className="flex items-start gap-2">
            <ShieldAlert className="text-danger mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div className="flex flex-col gap-1">
              <p className="text-foreground text-sm font-medium">Delete account</p>
              <p className="text-muted-foreground text-xs">
                Permanently removes your account, collections and products. This cannot be undone.
              </p>
            </div>
          </div>

          <details className="group mt-3">
            <summary className="text-danger hover:text-danger/80 cursor-pointer text-xs font-medium">
              I want to delete my account
            </summary>

            <form action={formAction} className="mt-4 flex flex-col gap-3">
              {state.error && (
                <div role="alert" className="text-danger text-xs">
                  {state.error}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                {hasPassword && (
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="delete-password"
                      className="text-foreground text-xs font-medium"
                    >
                      Password
                    </label>
                    <Input
                      id="delete-password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                    />
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="delete-confirm" className="text-foreground text-xs font-medium">
                    Type DELETE to confirm
                  </label>
                  <Input id="delete-confirm" name="confirmation" placeholder="DELETE" required />
                </div>
              </div>
              {!hasPassword && (
                <p className="text-muted-foreground text-xs">
                  This account has no password. Typing DELETE is required because you are signed in.
                </p>
              )}

              <div>
                <Button
                  type="submit"
                  variant="danger"
                  size="sm"
                  disabled={pending}
                  className="gap-2"
                >
                  {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                  {pending ? 'Deleting…' : 'Delete my account permanently'}
                </Button>
              </div>
            </form>
          </details>
        </div>
      </CardContent>
    </Card>
  );
}
