'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  Archive,
  ArrowRightLeft,
  FolderInput,
  Loader2,
  RotateCcw,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import type { BulkOperation } from '@/lib/services/wishlist-bulk';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { bulkItemAction, type BulkActionState } from './bulk-actions';

const IDLE_STATE: BulkActionState = {
  success: false,
  operation: 'archive',
  requested: 0,
  updated: 0,
  skipped: 0,
};

const PRIORITY_LABELS = ['Want', 'Really want', 'I need this', 'Must have'] as const;

interface BulkActionToolbarProps {
  wishlistId: string;
  selectedIds: string[];
  collections: Array<{ id: string; title: string }>;
  categories: string[];
  mode: 'active' | 'archived';
  onClear: () => void;
}

/**
 * Bulk-action bar shown while products are selected.
 *
 * It is the only place that submits bulk changes, so selection is always
 * scoped to this collection. Partial results are surfaced instead of being
 * treated as a full success.
 */
export function BulkActionToolbar({
  wishlistId,
  selectedIds,
  collections,
  categories,
  mode,
  onClear,
}: BulkActionToolbarProps) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<BulkOperation | null>(null);

  const [moveOpen, setMoveOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const otherCollections = collections.filter((collection) => collection.id !== wishlistId);
  const [targetCollectionId, setTargetCollectionId] = useState(otherCollections[0]?.id ?? '');
  const [category, setCategory] = useState('');

  const count = selectedIds.length;
  if (count === 0) return null;

  const run = (operation: BulkOperation, extra: Record<string, string> = {}) => {
    setPendingAction(operation);

    const formData = new FormData();
    formData.set('wishlistId', wishlistId);
    formData.set('itemIds', JSON.stringify(selectedIds));
    formData.set('operation', operation);
    // Lets the server guarantee that an active selection cannot delete an
    // archived item (and vice versa) even if ids are injected.
    formData.set('mode', mode);
    for (const [key, value] of Object.entries(extra)) formData.set(key, value);

    startTransition(async () => {
      const result = await bulkItemAction(IDLE_STATE, formData);
      setPendingAction(null);
      setMoveOpen(false);
      setCategoryOpen(false);
      setDeleteOpen(false);

      if (!result.success) {
        toast.error(result.error ?? 'Could not apply the bulk action.');
        return;
      }

      if (result.skipped > 0) {
        toast.warning(result.message ?? `${result.updated} updated, ${result.skipped} skipped.`);
      } else {
        toast.success(result.message ?? 'Bulk action applied.');
      }

      onClear();
      router.refresh();
    });
  };

  const busy = (operation: BulkOperation) => pending && pendingAction === operation;

  return (
    <>
      <div
        role="toolbar"
        aria-label="Bulk product actions"
        className="border-border bg-card/95 sticky bottom-3 z-30 flex flex-col gap-2.5 rounded-xl border p-3 shadow-xl shadow-black/20 backdrop-blur"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-foreground text-sm font-semibold">
            {count} {count === 1 ? 'product' : 'products'} selected
          </span>
          <span className="text-muted-foreground text-[11px]">
            {mode === 'archived'
              ? 'Archived products'
              : 'Bulk changes apply only to this selection'}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-7 gap-1.5 text-[11px]"
            onClick={onClear}
            disabled={pending}
          >
            <X className="h-3 w-3" aria-hidden />
            Clear
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {mode === 'archived' ? (
            <>
              <Button
                size="sm"
                variant="secondary"
                className="h-8 gap-1.5 text-xs"
                onClick={() => run('restore')}
                disabled={pending}
              >
                {busy('restore') ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                )}
                Restore
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-danger border-danger/30 hover:bg-danger/10 h-8 gap-1.5 text-xs"
                onClick={() => setDeleteOpen(true)}
                disabled={pending}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Delete permanently
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="secondary"
                className="h-8 gap-1.5 text-xs"
                onClick={() => setMoveOpen(true)}
                disabled={pending || otherCollections.length === 0}
                title={
                  otherCollections.length === 0
                    ? 'Create another collection first'
                    : 'Move selected products'
                }
              >
                <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden />
                Move to…
              </Button>

              <Button
                size="sm"
                variant="secondary"
                className="h-8 gap-1.5 text-xs"
                onClick={() => setCategoryOpen(true)}
                disabled={pending}
              >
                <FolderInput className="h-3.5 w-3.5" aria-hidden />
                Set category
              </Button>

              <label className="border-border bg-surface text-muted-foreground inline-flex h-8 items-center gap-1.5 rounded-lg border px-2 text-xs">
                <Star className="h-3.5 w-3.5" aria-hidden />
                <span className="sr-only">Change priority</span>
                <select
                  value=""
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value) run('priority', { starPriority: value });
                  }}
                  disabled={pending}
                  aria-label="Change priority of selected products"
                  className="bg-surface text-foreground h-6 rounded border-0 text-xs focus:outline-none"
                >
                  <option value="">Priority…</option>
                  {PRIORITY_LABELS.map((label, index) => (
                    <option key={label} value={index + 1}>
                      {index + 1} · {label}
                    </option>
                  ))}
                </select>
              </label>

              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs"
                onClick={() => run('archive')}
                disabled={pending}
              >
                {busy('archive') ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <Archive className="h-3.5 w-3.5" aria-hidden />
                )}
                Archive
              </Button>

              <Button
                size="sm"
                variant="outline"
                className="text-danger border-danger/30 hover:bg-danger/10 h-8 gap-1.5 text-xs"
                onClick={() => setDeleteOpen(true)}
                disabled={pending}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Move */}
      <Modal
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        title="Move products"
        description={`${count} selected ${count === 1 ? 'product' : 'products'} will be moved with all notes, source URLs and metadata.`}
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <label className="text-foreground flex flex-col gap-1.5 text-xs font-medium">
            Destination collection
            <Select
              value={targetCollectionId}
              onChange={(event) => setTargetCollectionId(event.target.value)}
            >
              {otherCollections.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.title}
                </option>
              ))}
            </Select>
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setMoveOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => run('move', { targetCollectionId })}
              disabled={!targetCollectionId || pending}
              className="gap-2"
            >
              {busy('move') && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
              Move products
            </Button>
          </div>
        </div>
      </Modal>

      {/* Category */}
      <Modal
        open={categoryOpen}
        onClose={() => setCategoryOpen(false)}
        title="Set category"
        description={`Apply a category to ${count} selected ${count === 1 ? 'product' : 'products'}.`}
        size="sm"
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            run('category', { category });
          }}
        >
          <label className="text-foreground flex flex-col gap-1.5 text-xs font-medium">
            Category name
            <Input
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              list="bulk-category-options"
              placeholder="e.g. PC Upgrades"
              maxLength={100}
            />
          </label>
          <datalist id="bulk-category-options">
            {categories.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          <p className="text-muted-foreground text-[11px]">
            Leave the field empty to remove the category from the selected products.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setCategoryOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={pending} className="gap-2">
              {busy('category') && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
              Apply category
            </Button>
          </div>
        </form>
      </Modal>

      {/* Destructive confirmation */}
      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={mode === 'archived' ? 'Delete permanently?' : 'Delete products?'}
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <p className="text-muted-foreground text-sm">
            {count} {count === 1 ? 'product' : 'products'} will be deleted
            {mode === 'archived' ? ' permanently' : ''}. This cannot be undone.
            {mode === 'active'
              ? ' If you only want to hide them, archive them instead — archive is reversible.'
              : ''}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => run('delete')}
              disabled={pending}
              className="gap-2"
            >
              {busy('delete') && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
              Delete {count} {count === 1 ? 'product' : 'products'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
