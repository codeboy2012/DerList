'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  Copy,
  Loader2,
  MoreHorizontal,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dropdown } from '@/components/ui/Dropdown';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import {
  deleteWishlistAction,
  duplicateWishlistAction,
  moveWishlistAction,
  toggleArchiveAction,
} from './actions';

interface WishlistCardActionsProps {
  wishlistId: string;
  title: string;
  archived: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

/**
 * Per-card collection actions. Ordering is exposed as explicit move-up /
 * move-down buttons, which keeps it usable from the keyboard.
 */
export function WishlistCardActions({
  wishlistId,
  title,
  archived,
  canMoveUp,
  canMoveDown,
}: WishlistCardActionsProps) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const run = (
    action: (formData: FormData) => Promise<void>,
    extra: Record<string, string> = {}
  ) => {
    const formData = new FormData();
    formData.set('wishlistId', wishlistId);
    for (const [key, value] of Object.entries(extra)) formData.set(key, value);

    startTransition(async () => {
      await action(formData);
      router.refresh();
    });
  };

  const items = [
    {
      label: 'Move up',
      value: 'move-up',
      icon: <ArrowUp className="h-3.5 w-3.5" aria-hidden />,
      disabled: !canMoveUp || pending,
    },
    {
      label: 'Move down',
      value: 'move-down',
      icon: <ArrowDown className="h-3.5 w-3.5" aria-hidden />,
      disabled: !canMoveDown || pending,
    },
    {
      label: 'Duplicate',
      value: 'duplicate',
      icon: <Copy className="h-3.5 w-3.5" aria-hidden />,
      disabled: pending,
    },
    {
      label: archived ? 'Unarchive' : 'Archive',
      value: 'archive',
      icon: archived ? (
        <ArchiveRestore className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <Archive className="h-3.5 w-3.5" aria-hidden />
      ),
      disabled: pending,
    },
    {
      label: 'Delete',
      value: 'delete',
      icon: <Trash2 className="h-3.5 w-3.5" aria-hidden />,
      destructive: true,
      disabled: pending,
    },
  ];

  const handleSelect = (value: string) => {
    switch (value) {
      case 'move-up':
        run(moveWishlistAction, { direction: 'up' });
        break;
      case 'move-down':
        run(moveWishlistAction, { direction: 'down' });
        break;
      case 'duplicate':
        run(duplicateWishlistAction);
        break;
      case 'archive':
        run(toggleArchiveAction);
        toast.success(archived ? 'Wishlist restored.' : 'Wishlist archived.');
        break;
      case 'delete':
        setDeleteOpen(true);
        break;
      default:
        break;
    }
  };

  return (
    <>
      <div className="relative">
        <Dropdown
          items={items}
          onSelect={handleSelect}
          align="end"
          label={`Actions for ${title}`}
          trigger={
            <span className="text-muted-foreground hover:text-foreground border-border bg-surface inline-flex h-8 items-center gap-1.5 rounded-lg border px-2 text-[11px] font-medium transition-colors">
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <MoreHorizontal className="h-4 w-4" aria-hidden />
              )}
              Actions
            </span>
          }
        />
      </div>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete wishlist?"
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <p className="text-muted-foreground text-sm">
            “{title}” and all of its products will be deleted. This cannot be undone.
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
              disabled={pending}
              className="gap-2"
              onClick={() => {
                setDeleteOpen(false);
                run(deleteWishlistAction);
              }}
            >
              {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
              Delete wishlist
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
