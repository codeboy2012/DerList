'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useIsClient } from '@/lib/hooks/use-is-client';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { bulkItemAction, type BulkActionState } from '../../bulk-actions';

const IDLE_STATE: BulkActionState = {
  success: false,
  operation: 'delete',
  requested: 0,
  updated: 0,
  skipped: 0,
};

interface ArchivedItemActionsProps {
  wishlistId: string;
  itemId: string;
  itemTitle: string;
  /** Archive URL including the active search/category context. */
  archiveHref: string;
  className?: string;
}

/**
 * Actions for one archived product.
 *
 * Restoring is reversible and needs no confirmation. Permanent deletion is
 * always confirmed and uses the ownership-scoped bulk service with
 * `mode: "archived"`, so an id cannot target an active or foreign product.
 */
export function ArchivedItemActions({
  wishlistId,
  itemId,
  itemTitle,
  archiveHref,
  className,
}: ArchivedItemActionsProps) {
  const router = useRouter();
  const toast = useToast();
  // The server-rendered buttons are disabled until React has hydrated. This
  // prevents a fast click on a freshly navigated page from being lost before
  // its action handler is attached.
  const hydrated = useIsClient();
  const [pending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<'restore' | 'delete' | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const run = (operation: 'restore' | 'delete') => {
    setPendingAction(operation);

    const formData = new FormData();
    formData.set('wishlistId', wishlistId);
    formData.set('itemIds', JSON.stringify([itemId]));
    formData.set('operation', operation);
    formData.set('mode', 'archived');

    startTransition(async () => {
      const result = await bulkItemAction(IDLE_STATE, formData);
      setPendingAction(null);
      setDeleteOpen(false);

      if (!result.success) {
        toast.error(result.error ?? 'Could not update the archived product.');
        return;
      }

      if (result.skipped > 0) {
        toast.warning(result.message ?? `${result.updated} updated, ${result.skipped} skipped.`);
      } else {
        toast.success(
          result.message ??
            (operation === 'restore'
              ? 'Product restored to the collection.'
              : 'Archived product permanently deleted.')
        );
      }

      // Return to the archive with the search/category context intact. The
      // action already revalidated the affected paths; refreshing here as well
      // can race the push and leave the detail URL in place.
      router.push(archiveHref);
    });
  };

  return (
    <div
      className={cn('flex flex-wrap items-center gap-2', className)}
      data-hydrated={hydrated ? 'true' : 'false'}
    >
      <Button
        variant="secondary"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        onClick={() => run('restore')}
        disabled={pending || !hydrated}
        aria-label={`Restore ${itemTitle}`}
      >
        {pendingAction === 'restore' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
        )}
        Restore product
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="text-danger border-danger/30 hover:bg-danger/10 h-8 gap-1.5 text-xs"
        onClick={() => setDeleteOpen(true)}
        disabled={pending || !hydrated}
        aria-label={`Delete ${itemTitle} permanently`}
      >
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
        Delete permanently
      </Button>

      <Modal
        open={deleteOpen}
        onClose={() => {
          if (!pending) setDeleteOpen(false);
        }}
        title="Delete permanently?"
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <p className="text-muted-foreground text-sm">
            “{itemTitle}” will be removed from your account. This cannot be undone, and the product
            cannot be restored after deletion.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleteOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => run('delete')}
              disabled={pending}
              className="gap-2"
            >
              {pendingAction === 'delete' && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              )}
              Delete permanently
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
