'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { MoreHorizontal, RefreshCw, Trash2, Zap } from 'lucide-react';

import { deleteProductAction, queueRefreshAction, syncNowAction } from './actions';

interface ProductRowActionsProps {
  productId: string;
  hasUrl: boolean;
}

export function ProductRowActions({ productId, hasUrl }: ProductRowActionsProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen((o) => !o)} aria-label="Actions">
        <MoreHorizontal className="h-4 w-4" />
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-lg border border-border bg-card p-1 shadow-xl">
          {hasUrl && (
            <>
              <form action={async (fd) => { await syncNowAction(fd); setOpen(false); }}>
                <input type="hidden" name="productId" value={productId} />
                <button type="submit" className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-foreground transition-colors hover:bg-surface">
                  <Zap className="h-3.5 w-3.5" aria-hidden /> Sync Now
                </button>
              </form>
              <form action={async (fd) => { await queueRefreshAction(fd); setOpen(false); }}>
                <input type="hidden" name="productId" value={productId} />
                <button type="submit" className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-foreground transition-colors hover:bg-surface">
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Queue Refresh
                </button>
              </form>
            </>
          )}
          <form action={async (fd) => { if (!window.confirm('Delete this product?')) return; await deleteProductAction(fd); setOpen(false); }}>
            <input type="hidden" name="productId" value={productId} />
            <button type="submit" className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-danger transition-colors hover:bg-danger/10">
              <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
