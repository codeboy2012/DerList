import { Trophy } from 'lucide-react';
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
}

interface TopMostWantedProps {
  items: TopItem[];
}

/**
 * Displays the Top 3 Most Wanted items from the wishlist.
 * Auto-selects the three highest star-priority unpurchased items.
 */
export function TopMostWanted({ items }: TopMostWantedProps) {
  // Get top 3 by star priority (highest first), then by price (highest first as tiebreaker)
  const top3 = [...items]
    .sort((a, b) => {
      if (b.starPriority !== a.starPriority) return b.starPriority - a.starPriority;
      return (Number(b.currentPrice) || 0) - (Number(a.currentPrice) || 0);
    })
    .slice(0, 3);

  if (top3.length === 0) return null;

  // Calculate combined total
  const combinedTotal = top3.reduce((sum, item) => sum + (Number(item.currentPrice) || 0), 0);

  return (
    <section className="rounded-2xl border border-yellow-500/20 bg-gradient-to-br from-yellow-500/5 via-card to-card p-5">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-500/10">
          <Trophy className="h-4 w-4 text-yellow-400" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Top 3 Most Wanted Right Now</h2>
          {combinedTotal > 0 && (
            <span className="text-[11px] text-muted-foreground">
              Combined total: <span className="font-medium text-foreground">${combinedTotal.toFixed(2)}</span>
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {top3.map((item, index) => (
          <div
            key={item.id}
            className="flex items-center gap-3 rounded-xl border border-border/50 bg-background/50 px-4 py-3 transition-colors hover:border-border"
          >
            {/* Rank badge */}
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-yellow-500/10 text-xs font-bold text-yellow-400">
              {index + 1}
            </span>

            {/* Image thumbnail */}
            {item.image && (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface">
                <img src={item.image} alt="" className="h-full w-full object-contain" loading="lazy" />
              </span>
            )}

            {/* Content */}
            <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-foreground">{item.title}</span>
              </div>
              <div className="flex items-center gap-2">
                <WishlistPriorityDisplay value={item.starPriority} showLabel={false} />
                {item.retailer && (
                  <span className="text-[10px] text-muted-foreground">{item.retailer}</span>
                )}
                {item.dealInfo && (
                  <span className="rounded-full bg-green-500/10 px-1.5 py-0.5 text-[9px] font-medium text-green-400">
                    {item.dealInfo}
                  </span>
                )}
              </div>
            </div>

            {/* Price */}
            <div className="shrink-0 text-right">
              {item.currentPrice != null && (
                <span className="text-sm font-bold tabular-nums text-foreground">
                  ${Number(item.currentPrice).toFixed(2)}
                </span>
              )}
              {item.originalPrice != null && Number(item.originalPrice) > (Number(item.currentPrice) || 0) && (
                <span className="block text-[10px] text-muted-foreground line-through">
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
