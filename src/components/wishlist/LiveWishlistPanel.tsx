'use client';

/**
 * LiveWishlistPanel — Real-time wishlist view that updates as the AI operates.
 *
 * Shows:
 * - Connection status indicator
 * - Active AI operation with progress
 * - Wishlist items with live state transitions
 * - Item count and total value
 */

import { useEffect, useRef } from 'react';
import {
  CheckCircle2,
  Circle,
  DollarSign,
  Loader2,
  Package,
  RefreshCw,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useLiveWishlist, type WishlistItem } from '@/lib/stores/wishlist-live';

export function LiveWishlistPanel() {
  const { items, loading, connectionStatus, activeOperation, totalValue, itemCount, refresh } =
    useLiveWishlist();

  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when new items appear during import
  useEffect(() => {
    if (activeOperation?.type === 'import' && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [itemCount, activeOperation]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="border-border flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Package className="text-accent h-4 w-4" />
          <span className="text-sm font-semibold">Wishlist</span>
          <span className="text-muted-foreground text-xs">({itemCount})</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Total value */}
          {totalValue > 0 && (
            <span className="text-muted-foreground flex items-center gap-1 text-xs">
              <DollarSign className="h-3 w-3" />
              {totalValue.toFixed(2)}
            </span>
          )}
          {/* Connection indicator */}
          <ConnectionDot status={connectionStatus} />
          {/* Refresh */}
          <button
            type="button"
            onClick={refresh}
            className="text-muted-foreground hover:text-foreground rounded p-1 transition-colors"
            aria-label="Refresh wishlist"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Active operation progress */}
      {activeOperation && (
        <div className="border-border bg-accent/5 border-b px-4 py-2">
          <div className="flex items-center gap-2">
            <Loader2 className="text-accent h-3.5 w-3.5 animate-spin" />
            <span className="text-xs font-medium">
              {activeOperation.type === 'import' ? 'Importing' : 'Removing'}...
            </span>
            <span className="text-muted-foreground text-xs">
              {activeOperation.completed}/{activeOperation.total}
            </span>
          </div>
          {/* Progress bar */}
          <div className="bg-border mt-1.5 h-1 overflow-hidden rounded-full">
            <div
              className="bg-accent h-full rounded-full transition-all duration-300"
              style={{ width: `${(activeOperation.completed / activeOperation.total) * 100}%` }}
            />
          </div>
          {activeOperation.current && (
            <p className="text-muted-foreground mt-1 truncate text-[10px]">{activeOperation.current}</p>
          )}
        </div>
      )}

      {/* Item list */}
      <div ref={listRef} className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
            <Package className="text-muted-foreground/30 h-8 w-8" />
            <p className="text-muted-foreground text-xs">No items yet</p>
          </div>
        ) : (
          <div className="divide-border divide-y">
            {items.map((item) => (
              <LiveWishlistItem key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function LiveWishlistItem({ item }: { item: WishlistItem }) {
  const isNew = item._liveStatus === 'added';
  const isRemoving = item._liveStatus === 'removing';

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-2.5 transition-all duration-300',
        isNew && 'bg-success/5 animate-in fade-in slide-in-from-bottom-1',
        isRemoving && 'opacity-50'
      )}
    >
      {/* Status icon */}
      <div className="shrink-0">
        {isNew ? (
          <CheckCircle2 className="text-success h-3.5 w-3.5" />
        ) : isRemoving ? (
          <X className="text-danger h-3.5 w-3.5" />
        ) : (
          <Circle className="text-muted-foreground/30 h-3.5 w-3.5" />
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{item.title}</p>
        {item.category && (
          <p className="text-muted-foreground truncate text-[10px]">{item.category}</p>
        )}
      </div>

      {/* Price */}
      {item.price != null && item.price > 0 && (
        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
          ${item.price.toFixed(2)}
        </span>
      )}

      {/* Priority dots */}
      {item.priority && item.priority > 1 && (
        <div className="flex shrink-0 gap-0.5">
          {Array.from({ length: item.priority }).map((_, i) => (
            <div key={i} className="bg-accent h-1.5 w-1.5 rounded-full" />
          ))}
        </div>
      )}
    </div>
  );
}

function ConnectionDot({ status }: { status: string }) {
  if (status === 'connected') {
    return <Wifi className="h-3 w-3 text-green-500" aria-label="Connected" />;
  }
  if (status === 'reconnecting') {
    return <Loader2 className="h-3 w-3 animate-spin text-yellow-500" aria-label="Reconnecting" />;
  }
  return <WifiOff className="text-muted-foreground h-3 w-3" aria-label="Offline" />;
}
