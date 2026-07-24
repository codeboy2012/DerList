'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { CheckCircle2, MoreHorizontal, Trash2, XCircle } from 'lucide-react';

import {
  approveWaitlistAction,
  bulkApproveWaitlistAction,
  bulkDeleteWaitlistAction,
  deleteWaitlistAction,
  rejectWaitlistAction,
} from './actions';

// ─────────────────────────────────────────────────────────────────────────────
// Single row actions
// ─────────────────────────────────────────────────────────────────────────────

interface WaitlistRowActionsProps {
  entryId: string;
  isPending: boolean;
}

export function WaitlistRowActions({ entryId, isPending }: WaitlistRowActionsProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => setOpen((o) => !o)}
        aria-label="Actions"
        aria-expanded={open}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border border-border bg-card p-1 shadow-xl">
          {isPending && (
            <>
              <form
                action={async (formData) => {
                  await approveWaitlistAction(formData);
                  setOpen(false);
                }}
              >
                <input type="hidden" name="entryId" value={entryId} />
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-foreground transition-colors hover:bg-surface"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden />
                  Approve &amp; Invite
                </button>
              </form>

              <form
                action={async (formData) => {
                  await rejectWaitlistAction(formData);
                  setOpen(false);
                }}
              >
                <input type="hidden" name="entryId" value={entryId} />
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-foreground transition-colors hover:bg-surface"
                >
                  <XCircle className="h-3.5 w-3.5 text-warning" aria-hidden />
                  Reject
                </button>
              </form>
            </>
          )}

          <form
            action={async (formData) => {
              if (!window.confirm('Delete this waitlist entry permanently?')) return;
              await deleteWaitlistAction(formData);
              setOpen(false);
            }}
          >
            <input type="hidden" name="entryId" value={entryId} />
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

// ─────────────────────────────────────────────────────────────────────────────
// Bulk action bar
// ─────────────────────────────────────────────────────────────────────────────

interface BulkActionsProps {
  selectedIds: string[];
  onClear: () => void;
}

export function BulkActions({ selectedIds, onClear }: BulkActionsProps) {
  if (selectedIds.length === 0) return null;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-accent/30 bg-accent/5 px-4 py-2">
      <span className="text-xs font-medium text-foreground">
        {selectedIds.length} selected
      </span>

      <form
        action={async (formData) => {
          await bulkApproveWaitlistAction(formData);
          onClear();
        }}
      >
        {selectedIds.map((id) => (
          <input key={id} type="hidden" name="ids" value={id} />
        ))}
        <Button type="submit" size="sm" variant="secondary" className="h-7 text-xs">
          Approve All
        </Button>
      </form>

      <form
        action={async (formData) => {
          if (!window.confirm(`Delete ${selectedIds.length} entries permanently?`)) return;
          await bulkDeleteWaitlistAction(formData);
          onClear();
        }}
      >
        {selectedIds.map((id) => (
          <input key={id} type="hidden" name="ids" value={id} />
        ))}
        <Button type="submit" size="sm" variant="danger" className="h-7 text-xs">
          Delete All
        </Button>
      </form>

      <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={onClear}>
        Clear
      </Button>
    </div>
  );
}
