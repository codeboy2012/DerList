'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Check, Copy, MoreHorizontal, Trash2, XCircle } from 'lucide-react';

import { deleteInvitationAction, revokeInvitationAction } from './actions';

interface InvitationActionsProps {
  invitation: {
    id: string;
    token: string;
    acceptedAt: Date | null;
    expiresAt: Date;
  };
  baseUrl: string;
}

export function InvitationActions({ invitation, baseUrl }: InvitationActionsProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const isAccepted = !!invitation.acceptedAt;
  const isExpired = new Date(invitation.expiresAt) < new Date();
  const isPending = !isAccepted && !isExpired;

  const inviteUrl = `${baseUrl}/invite/${invitation.token}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text
      const input = document.createElement('input');
      input.value = inviteUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="relative flex items-center gap-1">
      {/* Copy link button (always visible for pending) */}
      {isPending && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleCopy}
          aria-label="Copy invitation link"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-success" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </Button>
      )}

      {/* More actions */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => setOpen((o) => !o)}
        aria-label="More actions"
        aria-expanded={open}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border border-border bg-card p-1 shadow-xl">
          {/* Revoke */}
          {isPending && (
            <form
              action={async (formData) => {
                await revokeInvitationAction(formData);
                setOpen(false);
              }}
            >
              <input type="hidden" name="invitationId" value={invitation.id} />
              <button
                type="submit"
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-foreground transition-colors hover:bg-surface"
              >
                <XCircle className="h-3.5 w-3.5" aria-hidden />
                Revoke
              </button>
            </form>
          )}

          {/* Delete */}
          <form
            action={async (formData) => {
              if (!window.confirm('Delete this invitation permanently?')) return;
              await deleteInvitationAction(formData);
              setOpen(false);
            }}
          >
            <input type="hidden" name="invitationId" value={invitation.id} />
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-danger transition-colors hover:bg-danger/10"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Delete
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
