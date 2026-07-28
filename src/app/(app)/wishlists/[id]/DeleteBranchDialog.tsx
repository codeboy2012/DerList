'use client';

/**
 * DeleteBranchDialog — Asks user how to handle children when deleting a parent.
 *
 * Options:
 * 1. Delete only this item (promote children to root)
 * 2. Delete entire branch (parent + all descendants)
 */
import { useState } from 'react';
import { AlertTriangle, Loader2, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

interface DeleteBranchDialogProps {
  open: boolean;
  onClose: () => void;
  itemId: string;
  itemTitle: string;
  childCount: number;
  wishlistId: string;
  onDeleted: () => void;
}

export function DeleteBranchDialog({
  open,
  onClose,
  itemId,
  itemTitle,
  childCount,
  wishlistId,
  onDeleted,
}: DeleteBranchDialogProps) {
  const [deleting, setDeleting] = useState<'promote' | 'branch' | null>(null);
  const toast = useToast();

  const handleDeletePromote = async () => {
    setDeleting('promote');
    try {
      // First promote all children to root (set parentId to null)
      const res = await fetch(`/api/wishlists/items/${itemId}/promote-children`, {
        method: 'POST',
      });
      if (!res.ok) {
        toast.error('Failed to promote children');
        return;
      }

      // Then delete just this item
      const deleteRes = await fetch(`/api/wishlists/items/${itemId}`, { method: 'DELETE' });
      if (deleteRes.ok) {
        toast.success('Item deleted, children promoted');
        onDeleted();
        onClose();
      } else {
        toast.error('Failed to delete item');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteBranch = async () => {
    setDeleting('branch');
    try {
      // Cascade delete handled by DB (onDelete: Cascade on parentId FK)
      const res = await fetch(`/api/wishlists/items/${itemId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Branch deleted');
        onDeleted();
        onClose();
      } else {
        toast.error('Failed to delete branch');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={
        <span className="text-danger flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Delete Item
        </span>
      }
      description={
        <span>
          <strong className="text-foreground">{itemTitle}</strong> has{' '}
          <strong className="text-foreground">{childCount}</strong> nested item
          {childCount !== 1 ? 's' : ''}. How would you like to proceed?
        </span>
      }
    >
      <div className="flex flex-col gap-3 pt-2">
        {/* Option 1: Promote children */}
        <button
          type="button"
          onClick={handleDeletePromote}
          disabled={!!deleting}
          className="border-border bg-card hover:border-border-hover hover:bg-card-hover flex items-start gap-3 rounded-xl border p-4 text-left transition-colors disabled:opacity-50"
        >
          <Upload className="text-accent mt-0.5 h-5 w-5 flex-shrink-0" />
          <div>
            <p className="text-foreground text-sm font-medium">Delete only this item</p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Children will be promoted to the parent level.
            </p>
          </div>
          {deleting === 'promote' && <Loader2 className="ml-auto h-4 w-4 animate-spin" />}
        </button>

        {/* Option 2: Delete entire branch */}
        <button
          type="button"
          onClick={handleDeleteBranch}
          disabled={!!deleting}
          className="border-danger/30 bg-danger/5 hover:bg-danger/10 flex items-start gap-3 rounded-xl border p-4 text-left transition-colors disabled:opacity-50"
        >
          <Trash2 className="text-danger mt-0.5 h-5 w-5 flex-shrink-0" />
          <div>
            <p className="text-danger text-sm font-medium">Delete entire branch</p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              This item and all {childCount} nested item{childCount !== 1 ? 's' : ''} will be
              permanently removed.
            </p>
          </div>
          {deleting === 'branch' && <Loader2 className="ml-auto h-4 w-4 animate-spin" />}
        </button>

        {/* Cancel */}
        <Button variant="ghost" size="sm" onClick={onClose} disabled={!!deleting} className="mt-1">
          Cancel
        </Button>
      </div>
    </Modal>
  );
}
