'use client';

import { useActionState, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Ban,
  CheckCircle2,
  Key,
  LogOut,
  MoreHorizontal,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from 'lucide-react';

import type { ActionState } from '../../(auth)/actions';
import {
  changeRoleAction,
  deleteUserAction,
  disableUserAction,
  enableUserAction,
  forceLogoutAction,
  resetPasswordAction,
} from './actions';

interface UserActionsProps {
  user: {
    id: string;
    role: string;
    disabled: boolean;
    displayName: string;
  };
  actorRole: string;
  actorId: string;
}

/**
 * UserActions — dropdown-style action menu for each user row.
 * Renders as a button that toggles an action panel.
 */
export function UserActions({ user, actorRole, actorId }: UserActionsProps) {
  const [open, setOpen] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);

  const isSelf = user.id === actorId;
  const isOwnerTarget = user.role === 'OWNER';
  const canModify = !isSelf && (!isOwnerTarget || actorRole === 'OWNER');
  const canDelete = actorRole === 'OWNER' && !isSelf && !isOwnerTarget;
  const canChangeRole = actorRole === 'OWNER' && !isSelf && !isOwnerTarget;

  if (isSelf) {
    return <span className="text-xs text-muted-foreground">You</span>;
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Actions for ${user.displayName}`}
        aria-expanded={open}
        className="h-8 w-8"
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-52 rounded-lg border border-border bg-card p-1 shadow-xl">
          {/* Enable/Disable */}
          {canModify && (
            user.disabled ? (
              <ActionButton
                action={enableUserAction}
                userId={user.id}
                icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                label="Enable Account"
                onDone={() => setOpen(false)}
              />
            ) : (
              <ActionButton
                action={disableUserAction}
                userId={user.id}
                icon={<Ban className="h-3.5 w-3.5" />}
                label="Disable Account"
                onDone={() => setOpen(false)}
              />
            )
          )}

          {/* Force Logout */}
          {canModify && (
            <ActionButton
              action={forceLogoutAction}
              userId={user.id}
              icon={<LogOut className="h-3.5 w-3.5" />}
              label="Force Logout"
              onDone={() => setOpen(false)}
            />
          )}

          {/* Change Role */}
          {canChangeRole && (
            <>
              {user.role === 'USER' ? (
                <RoleChangeButton userId={user.id} newRole="ADMIN" label="Promote to Admin" icon={<ShieldCheck className="h-3.5 w-3.5" />} onDone={() => setOpen(false)} />
              ) : (
                <RoleChangeButton userId={user.id} newRole="USER" label="Demote to User" icon={<ShieldAlert className="h-3.5 w-3.5" />} onDone={() => setOpen(false)} />
              )}
            </>
          )}

          {/* Reset Password */}
          {canModify && (
            <button
              type="button"
              onClick={() => setShowResetPassword(true)}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-foreground transition-colors hover:bg-surface"
            >
              <Key className="h-3.5 w-3.5" aria-hidden />
              Reset Password
            </button>
          )}

          {/* Delete */}
          {canDelete && (
            <div className="mt-1 border-t border-border pt-1">
              <ActionButton
                action={deleteUserAction}
                userId={user.id}
                icon={<Trash2 className="h-3.5 w-3.5" />}
                label="Delete User"
                className="text-danger hover:bg-danger/10"
                confirm="Are you sure? This cannot be undone."
                onDone={() => setOpen(false)}
              />
            </div>
          )}
        </div>
      )}

      {/* Password reset modal */}
      {showResetPassword && (
        <ResetPasswordPanel userId={user.id} onClose={() => { setShowResetPassword(false); setOpen(false); }} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal sub-components
// ─────────────────────────────────────────────────────────────────────────────

function ActionButton({
  action,
  userId,
  icon,
  label,
  className,
  confirm,
  onDone,
}: {
  action: (formData: FormData) => Promise<void>;
  userId: string;
  icon: React.ReactNode;
  label: string;
  className?: string;
  confirm?: string;
  onDone: () => void;
}) {
  const handleSubmit = async (formData: FormData) => {
    if (confirm && !window.confirm(confirm)) return;
    await action(formData);
    onDone();
  };

  return (
    <form action={handleSubmit}>
      <input type="hidden" name="userId" value={userId} />
      <button
        type="submit"
        className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-foreground transition-colors hover:bg-surface ${className ?? ''}`}
      >
        {icon}
        {label}
      </button>
    </form>
  );
}

function RoleChangeButton({
  userId,
  newRole,
  label,
  icon,
  onDone,
}: {
  userId: string;
  newRole: string;
  label: string;
  icon: React.ReactNode;
  onDone: () => void;
}) {
  const handleSubmit = async (formData: FormData) => {
    await changeRoleAction(formData);
    onDone();
  };

  return (
    <form action={handleSubmit}>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="role" value={newRole} />
      <button
        type="submit"
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-foreground transition-colors hover:bg-surface"
      >
        {icon}
        {label}
      </button>
    </form>
  );
}

function ResetPasswordPanel({ userId, onClose }: { userId: string; onClose: () => void }) {
  const initialState: ActionState = { success: false };
  const [state, formAction, pending] = useActionState(resetPasswordAction, initialState);

  if (state.success) {
    return (
      <div className="absolute right-0 top-full z-30 mt-1 w-64 rounded-lg border border-border bg-card p-4 shadow-xl">
        <p className="text-xs text-success">Password reset successfully.</p>
        <Button type="button" size="sm" variant="ghost" onClick={onClose} className="mt-2">
          Close
        </Button>
      </div>
    );
  }

  return (
    <div className="absolute right-0 top-full z-30 mt-1 w-64 rounded-lg border border-border bg-card p-4 shadow-xl">
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="userId" value={userId} />
        <label className="text-xs font-medium text-foreground">New Password</label>
        <Input name="newPassword" type="password" placeholder="Min 8 characters" autoComplete="new-password" />
        {state.error && <p className="text-xs text-danger">{state.error}</p>}
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? 'Resetting...' : 'Reset'}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
