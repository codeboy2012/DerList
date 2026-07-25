import { ExternalLink, FolderOpen } from 'lucide-react';
import { ItemRow } from './ItemRow';

interface CategoryItem {
  id: string;
  title: string;
  description: string | null;
  url: string | null;
  image: string | null;
  brand: string | null;
  retailer: string | null;
  currentPrice: unknown;
  originalPrice: unknown;
  dealInfo: string | null;
  currency: string;
  priority: string;
  starPriority: number;
  quantity: number;
  purchased: boolean;
  notes: string | null;
  category: string | null;
}

interface CategoryMeta {
  name: string;
  description?: string | null;
  externalLink?: string | null;
  externalLinkLabel?: string | null;
  icon?: string | null;
  notes?: string | null;
}

interface CategoryViewProps {
  items: CategoryItem[];
  wishlistId: string;
  categoryMeta?: CategoryMeta[];
}

/**
 * Groups wishlist items by category and renders each group with a section header,
 * total price, optional external link, and items sorted by star priority.
 */
export function CategoryView({ items, wishlistId, categoryMeta = [] }: CategoryViewProps) {
  // Group items by category
  const groups = new Map<string, CategoryItem[]>();
  const uncategorized: CategoryItem[] = [];

  for (const item of items) {
    const cat = item.category?.trim();
    if (cat) {
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(item);
    } else {
      uncategorized.push(item);
    }
  }

  // Build ordered category list — use categoryMeta order if available, then alphabetical for rest
  const metaOrder = categoryMeta.map((m) => m.name);
  const allCategoryNames = [...groups.keys()];
  const orderedNames = [
    ...metaOrder.filter((name) => groups.has(name)),
    ...allCategoryNames.filter((name) => !metaOrder.includes(name)).sort(),
  ];

  // Build metadata lookup
  const metaLookup = new Map(categoryMeta.map((m) => [m.name, m]));

  return (
    <div className="flex flex-col gap-6">
      {orderedNames.map((categoryName) => {
        const categoryItems = groups.get(categoryName)!;
        const meta = metaLookup.get(categoryName);
        const sortedItems = [...categoryItems].sort((a, b) => b.starPriority - a.starPriority);
        const total = sortedItems.reduce((sum, item) => sum + (Number(item.currentPrice) || 0), 0);

        return (
          <CategorySection
            key={categoryName}
            name={categoryName}
            meta={meta}
            items={sortedItems}
            total={total}
            wishlistId={wishlistId}
          />
        );
      })}

      {/* Uncategorized items */}
      {uncategorized.length > 0 && (
        <CategorySection
          name="Other"
          items={uncategorized.sort((a, b) => b.starPriority - a.starPriority)}
          total={uncategorized.reduce((sum, item) => sum + (Number(item.currentPrice) || 0), 0)}
          wishlistId={wishlistId}
        />
      )}
    </div>
  );
}

function CategorySection({
  name,
  meta,
  items,
  total,
  wishlistId,
}: {
  name: string;
  meta?: CategoryMeta;
  items: CategoryItem[];
  total: number;
  wishlistId: string;
}) {
  return (
    <section className="flex flex-col gap-2.5">
      {/* Category header */}
      <div className="flex items-center gap-2.5 border-b border-border pb-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface text-sm">
          {meta?.icon || <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />}
        </span>
        <div className="flex flex-1 items-baseline gap-3">
          <h3 className="text-sm font-semibold text-foreground">{name}</h3>
          {total > 0 && (
            <span className="text-[11px] tabular-nums text-muted-foreground">
              ${total.toFixed(2)} total
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">
            {items.length} item{items.length !== 1 ? 's' : ''}
          </span>
        </div>
        {meta?.externalLink && (
          <a
            href={meta.externalLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[10px] font-medium text-accent transition-colors hover:bg-card hover:text-accent"
          >
            <ExternalLink className="h-3 w-3" aria-hidden />
            {meta.externalLinkLabel || 'View Build'}
          </a>
        )}
      </div>

      {/* Category description */}
      {meta?.description && (
        <p className="text-xs text-muted-foreground">{meta.description}</p>
      )}

      {/* Items */}
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <ItemRow key={item.id} item={item} wishlistId={wishlistId} />
        ))}
      </div>

      {/* Category notes (expandable) */}
      {meta?.notes && (
        <details className="group mt-1">
          <summary className="cursor-pointer text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground">
            Category notes...
          </summary>
          <div className="mt-2 rounded-lg border border-border/50 bg-surface/50 p-3 text-xs leading-relaxed text-muted-foreground">
            {meta.notes}
          </div>
        </details>
      )}
    </section>
  );
}
