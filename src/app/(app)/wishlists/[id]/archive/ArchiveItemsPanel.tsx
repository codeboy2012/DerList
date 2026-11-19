'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Eye, Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { bulkItemAction, restoreItemAction, type BulkActionState } from '../bulk-actions';
import { BulkActionToolbar } from '../BulkActionToolbar';

export interface ArchivedItemData {
  id: string;
  title: string;
  image: string | null;
  brand: string | null;
  retailer: string | null;
  category: string | null;
  currentPrice: string | null;
  currency: string;
  archivedAt: string | null;
}

const IDLE_STATE: BulkActionState = {
  success: false,
  operation: 'delete',
  requested: 0,
  updated: 0,
  skipped: 0,
};

interface ArchiveItemsPanelProps {
  wishlistId: string;
  items: ArchivedItemData[];
  categories: string[];
  /** Current archive search, preserved when opening an item and returning. */
  query?: string;
  /** Current archive category filter, preserved with the item link. */
  category?: string;
}

export function ArchiveItemsPanel({
  wishlistId,
  items,
  categories,
  query = '',
  category = '',
}: ArchiveItemsPanelProps) {
  const router = useRouter();
  const toast = useToast();
  const [selected, setSelected] = useState<string[]>([]);
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null);
  const [pending, startTransition] = useTransition();

  const selectedSet = new Set(selected);
  const allSelected = items.length > 0 && items.every((item) => selectedSet.has(item.id));

  const detailParams = new URLSearchParams();
  if (query) detailParams.set('q', query);
  if (category) detailParams.set('category', category);
  const detailSuffix = detailParams.toString() ? `?${detailParams.toString()}` : '';
  const detailHref = (itemId: string) =>
    `/wishlists/${wishlistId}/archive/${itemId}${detailSuffix}`;

  const toggle = (id: string, checked: boolean) =>
    setSelected((current) =>
      checked ? [...new Set([...current, id])] : current.filter((value) => value !== id)
    );

  const confirmDelete = () => {
    if (!deleteIds || deleteIds.length === 0) return;

    const formData = new FormData();
    formData.set('wishlistId', wishlistId);
    formData.set('itemIds', JSON.stringify(deleteIds));
    formData.set('operation', 'delete');
    formData.set('mode', 'archived');

    startTransition(async () => {
      const result = await bulkItemAction(IDLE_STATE, formData);
      setDeleteIds(null);

      if (!result.success) {
        toast.error(result.error ?? 'Could not delete the archived products.');
        return;
      }
      if (result.skipped > 0) {
        toast.warning(result.message ?? `${result.updated} deleted, ${result.skipped} skipped.`);
      } else {
        toast.success(result.message ?? 'Archived products deleted.');
      }
      setSelected((current) => current.filter((id) => !deleteIds.includes(id)));
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Checkbox
          checked={allSelected}
          onChange={(event) =>
            setSelected(event.target.checked ? items.map((item) => item.id) : [])
          }
          label={`Select all ${items.length} archived`}
          aria-label={`Select all ${items.length} archived products`}
        />
        {selected.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[11px]"
            onClick={() => setSelected([])}
          >
            Clear selection
          </Button>
        )}
        <span className="text-muted-foreground ml-auto text-[11px]">
          {items.length} archived {items.length === 1 ? 'product' : 'products'}
        </span>
      </div>

      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="border-border bg-card flex flex-wrap items-center gap-3 rounded-xl border p-3 sm:flex-nowrap"
          >
            <Checkbox
              checked={selectedSet.has(item.id)}
              onChange={(event) => toggle(item.id, event.target.checked)}
              aria-label={`Select ${item.title}`}
            />

            <span className="bg-surface flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg">
              {item.image ? (
                <img src={item.image} alt="" className="h-full w-full object-contain" />
              ) : (
                <Trash2 className="text-muted/30 h-5 w-5" aria-hidden />
              )}
            </span>

            <div className="min-w-0 flex-1">
              <Link
                href={detailHref(item.id)}
                className="text-foreground hover:text-accent block truncate text-sm font-medium transition-colors"
              >
                {item.title}
              </Link>
              <p className="text-muted-foreground truncate text-[11px]">
                {[item.brand, item.retailer, item.category].filter(Boolean).join(' · ') ||
                  'No product details'}
                {item.archivedAt
                  ? ` · archived ${new Date(item.archivedAt).toLocaleDateString()}`
                  : ''}
              </p>
            </div>

            {item.currentPrice != null && (
              <span className="text-foreground shrink-0 text-xs font-semibold tabular-nums">
                {item.currency} {Number(item.currentPrice).toFixed(2)}
              </span>
            )}

            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              <Button asChild variant="ghost" size="sm" className="h-7 gap-1.5 text-[11px]">
                <Link href={detailHref(item.id)} aria-label={`View details for ${item.title}`}>
                  <Eye className="h-3 w-3" aria-hidden />
                  Details
                </Link>
              </Button>
              <form action={restoreItemAction}>
                <input type="hidden" name="itemId" value={item.id} />
                <input type="hidden" name="wishlistId" value={wishlistId} />
                <Button
                  type="submit"
                  variant="secondary"
                  size="sm"
                  className="h-7 gap-1.5 text-[11px]"
                >
                  <RotateCcw className="h-3 w-3" aria-hidden />
                  Restore
                </Button>
              </form>
              <Button
                variant="ghost"
                size="sm"
                className="text-danger hover:bg-danger/10 h-7 gap-1.5 text-[11px]"
                onClick={() => setDeleteIds([item.id])}
              >
                <Trash2 className="h-3 w-3" aria-hidden />
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <BulkActionToolbar
        wishlistId={wishlistId}
        selectedIds={selected}
        collections={[]}
        categories={categories}
        mode="archived"
        onClear={() => setSelected([])}
      />

      <Modal
        open={deleteIds !== null}
        onClose={() => setDeleteIds(null)}
        title="Delete permanently?"
        size="sm"
      >
        <div className="flex flex-col gap-4">
          <p className="text-muted-foreground text-sm">
            {deleteIds?.length ?? 0} archived {deleteIds?.length === 1 ? 'product' : 'products'}{' '}
            will be removed from your account. This cannot be undone — restoring is not possible
            after deletion.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDeleteIds(null)} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={confirmDelete}
              disabled={pending}
              className="gap-2"
            >
              {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
              Delete permanently
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
