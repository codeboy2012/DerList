import { Package, Trophy } from 'lucide-react';
import { formatDiscount } from '@/utils/format-discount';
import { WishlistPriorityDisplay } from '@/components/ui/WishlistPriority';

interface TopItem {
  id: string;
  title: string;
  currentPrice: string | null;
  originalPrice: string | null;
  currency: string;
  starPriority: number;
  dealInfo: string | null;
  notes: string | null;
  retailer: string | null;
  image: string | null;
  brand?: string | null;
}

interface TopPick {
  position: number;
  itemId: string;
}

interface TopMostWantedProps {
  items: TopItem[];
  /** User-curated picks. If provided and non-empty, these override auto-selection. */
  topPicks?: TopPick[];
}

/**
 * Displays the Top 3 Most Wanted items.
 * Uses curated Top Picks if set by the user, otherwise auto-selects
 * the three highest star-priority unpurchased items.
 */
export function TopMostWanted({ items, topPicks }: TopMostWantedProps) {
  let top3: TopItem[];

  if (topPicks && topPicks.length > 0) {
    // Use curated picks — resolve item IDs to actual items
    const itemMap = new Map(items.map((i) => [i.id, i]));
    top3 = topPicks
      .sort((a, b) => a.position - b.position)
      .map((p) => itemMap.get(p.itemId))
      .filter((item): item is TopItem => item !== undefined);
  } else {
    // Fallback: auto-select by priority then price
    top3 = [...items]
      .sort((a, b) => {
        if (b.starPriority !== a.starPriority) return b.starPriority - a.starPriority;
        return (Number(b.currentPrice) || 0) - (Number(a.currentPrice) || 0);
      })
      .slice(0, 3);
  }

  if (top3.length === 0) return null;

  const combinedTotal = top3.reduce((sum, item) => sum + (Number(item.currentPrice) || 0), 0);
  const isCurated = topPicks && topPicks.length > 0;
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <section className="via-card to-card rounded-2xl border border-yellow-500/20 bg-gradient-to-br from-yellow-500/5 p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-500/10">
          <Trophy className="h-4 w-4 text-yellow-400" />
        </span>
        <div>
          <h2 className="text-foreground text-sm font-semibold">
            {isCurated ? 'Top Picks' : 'Most Wanted'}
          </h2>
          {combinedTotal > 0 && (
            <span className="text-muted-foreground text-[11px]">
              Combined:{' '}
              <span className="text-foreground font-medium">${combinedTotal.toFixed(2)}</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {top3.map((item, index) => (
          <div
            key={item.id}
            className="border-border/50 bg-background/50 hover:border-border flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors"
          >
            {/* Medal / Rank */}
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-yellow-500/10 text-lg">
              {medals[index]}
            </span>

            {/* Image */}
            {item.image ? (
              <span className="bg-surface flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg">
                <img
                  src={item.image}
                  alt=""
                  className="h-full w-full object-contain"
                  loading="lazy"
                />
              </span>
            ) : (
              <span className="bg-surface flex h-12 w-12 shrink-0 items-center justify-center rounded-lg">
                <Package className="text-muted-foreground/30 h-5 w-5" />
              </span>
            )}

            {/* Content */}
            <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
              <span className="text-foreground truncate text-sm font-medium">{item.title}</span>
              <div className="flex items-center gap-2">
                <WishlistPriorityDisplay value={item.starPriority} showLabel={false} />
                {item.brand && (
                  <span className="text-muted-foreground text-[10px]">{item.brand}</span>
                )}
                {item.retailer && (
                  <span className="text-muted-foreground text-[10px]">{item.retailer}</span>
                )}
                {(() => {
                  const discount = formatDiscount({
                    currentPrice: Number(item.currentPrice) || undefined,
                    originalPrice: Number(item.originalPrice) || undefined,
                    dealInfo: item.dealInfo,
                    currency: 'USD',
                  });
                  if (!discount) return null;
                  return (
                    <span className="rounded-full bg-green-500/10 px-1.5 py-0.5 text-[9px] font-medium text-green-400">
                      {discount.label}
                    </span>
                  );
                })()}
              </div>
            </div>

            {/* Price */}
            <div className="shrink-0 text-right">
              {item.currentPrice != null && (
                <span className="text-foreground text-sm font-bold tabular-nums">
                  ${Number(item.currentPrice).toFixed(2)}
                </span>
              )}
              {item.originalPrice != null &&
                Number(item.originalPrice) > (Number(item.currentPrice) || 0) && (
                  <span className="text-muted-foreground block text-[10px] line-through">
                    ${Number(item.originalPrice).toFixed(2)}
                  </span>
                )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
