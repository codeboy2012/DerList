'use client';

/**
 * TopPicksManager — Modal for curating the Top 3 Most Wanted items.
 *
 * Users click items from their wishlist to assign them to positions 1-3.
 * Clicking an occupied slot replaces the item.
 */
import { useCallback, useEffect, useState } from 'react';
import { Loader2, Sparkles, Star, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

interface TopPick {
  position: number;
  itemId: string;
}

interface WishlistItem {
  id: string;
  title: string;
  image: string | null;
  currentPrice: string | null;
  retailer: string | null;
  brand: string | null;
}

interface TopPicksManagerProps {
  wishlistId: string;
  items: WishlistItem[];
  initialPicks: TopPick[];
}

const MEDALS = ['🥇', '🥈', '🥉'];
const POSITION_LABELS = ['#1 Top Pick', '#2 Runner Up', '#3 Third Pick'];

export function TopPicksManager({ wishlistId, items, initialPicks }: TopPicksManagerProps) {
  const [open, setOpen] = useState(false);
  const [picks, setPicks] = useState<(TopPick | null)[]>([null, null, null]);
  const [isSaving, setIsSaving] = useState(false);
  const toast = useToast();

  // Initialize from props when modal opens
  useEffect(() => {
    if (!open) return;
    const slots: (TopPick | null)[] = [null, null, null];
    for (const pick of initialPicks) {
      if (pick.position >= 1 && pick.position <= 3) {
        slots[pick.position - 1] = pick;
      }
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPicks(slots);
  }, [open, initialPicks]);

  const getItemById = (id: string) => items.find((i) => i.id === id);

  const isItemPicked = (itemId: string) => picks.some((p) => p?.itemId === itemId);

  const handleAssign = (itemId: string, position: number) => {
    setPicks((prev) => {
      const next = [...prev];
      // Remove item from any other slot
      for (let i = 0; i < next.length; i++) {
        if (next[i]?.itemId === itemId) next[i] = null;
      }
      // Assign to the new position
      next[position] = { position: position + 1, itemId };
      return next;
    });
  };

  const handleRemove = (position: number) => {
    setPicks((prev) => {
      const next = [...prev];
      next[position] = null;
      return next;
    });
  };

  const handleQuickAssign = (itemId: string) => {
    // Find first empty slot
    const emptyIdx = picks.findIndex((p) => p === null);
    if (emptyIdx !== -1) {
      handleAssign(itemId, emptyIdx);
    } else {
      // Replace position 3 (last)
      handleAssign(itemId, 2);
    }
  };

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    const topPicks = picks
      .filter((p): p is TopPick => p !== null)
      .map((p, i) => ({ position: i + 1, itemId: p.itemId }));

    try {
      const res = await fetch(`/api/wishlists/${wishlistId}/top-picks`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topPicks }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Top Picks saved');
        setOpen(false);
        // Trigger page refresh to show updated picks
        window.location.reload();
      } else {
        toast.error(data.error || 'Failed to save');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setIsSaving(false);
    }
  }, [picks, wishlistId, toast]);

  // Items not currently picked (items are already pre-filtered to unpurchased)
  const availableItems = items.filter((i) => !isItemPicked(i.id));

  return (
    <>
      <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Star className="h-3.5 w-3.5" />
        Top Picks
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Manage Top Picks" size="lg">
        <div className="space-y-6">
          <p className="text-muted-foreground text-sm">
            Choose up to 3 items to showcase at the top of your wishlist. Click an item to assign it
            to the next available slot.
          </p>

          {/* ─── Slots ─── */}
          <div className="space-y-2">
            <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Current Top Picks
            </h3>
            <div className="grid gap-2 sm:grid-cols-3">
              {picks.map((pick, idx) => {
                const item = pick ? getItemById(pick.itemId) : null;
                return (
                  <PickSlot
                    key={idx}
                    position={idx}
                    item={item ?? null}
                    onRemove={() => handleRemove(idx)}
                  />
                );
              })}
            </div>
          </div>

          {/* ─── Available Items ─── */}
          <div className="space-y-2">
            <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Available Items ({availableItems.length})
            </h3>
            <div className="border-border max-h-64 overflow-y-auto rounded-lg border">
              {availableItems.length === 0 ? (
                <p className="text-muted-foreground px-4 py-6 text-center text-xs">
                  All items are assigned or purchased.
                </p>
              ) : (
                availableItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleQuickAssign(item.id)}
                    className="border-border hover:bg-surface/50 flex w-full items-center gap-3 border-b px-4 py-3 text-left transition-colors last:border-0"
                  >
                    {item.image ? (
                      <img
                        src={item.image}
                        alt=""
                        className="h-8 w-8 shrink-0 rounded-md object-cover"
                      />
                    ) : (
                      <div className="bg-surface text-muted-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
                        <Sparkles className="h-3 w-3" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground truncate text-sm font-medium">{item.title}</p>
                      <p className="text-muted-foreground text-xs">
                        {[item.brand, item.retailer].filter(Boolean).join(' · ')}
                        {item.currentPrice && ` · $${Number(item.currentPrice).toFixed(2)}`}
                      </p>
                    </div>
                    <span className="text-accent text-xs">+ Add</span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* ─── Footer ─── */}
          <div className="border-border flex justify-end gap-3 border-t pt-4">
            <Button variant="ghost" size="md" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleSave}
              disabled={isSaving}
              className="gap-2"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Top Picks
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function PickSlot({
  position,
  item,
  onRemove,
}: {
  position: number;
  item: WishlistItem | null;
  onRemove: () => void;
}) {
  return (
    <div
      className={cn(
        'relative flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-colors',
        item ? 'border-accent/30 bg-accent/5' : 'border-border border-dashed'
      )}
    >
      <span className="text-2xl">{MEDALS[position]}</span>
      {item ? (
        <>
          {item.image && (
            <img src={item.image} alt="" className="h-12 w-12 rounded-lg object-cover" />
          )}
          <p className="text-foreground line-clamp-2 text-xs font-medium">{item.title}</p>
          {item.currentPrice && (
            <p className="text-muted-foreground text-xs tabular-nums">
              ${Number(item.currentPrice).toFixed(2)}
            </p>
          )}
          <button
            type="button"
            onClick={onRemove}
            className="bg-danger absolute -top-1 -right-1 rounded-full p-0.5 text-white shadow-sm"
            aria-label="Remove"
          >
            <X className="h-3 w-3" />
          </button>
        </>
      ) : (
        <p className="text-muted-foreground text-[11px]">{POSITION_LABELS[position]}</p>
      )}
    </div>
  );
}
