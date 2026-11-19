'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { BulkActionToolbar } from './BulkActionToolbar';
import { CategoryView } from './CategoryView';
import { ItemRow, type WishlistItemData } from './ItemRow';

interface CategoryMeta {
  name: string;
  description?: string | null;
  externalLink?: string | null;
  externalLinkLabel?: string | null;
  icon?: string | null;
  notes?: string | null;
}

interface WishlistItemsPanelProps {
  wishlistId: string;
  /** Items visible under the current search, filter and sort. */
  items: WishlistItemData[];
  /** Every active item in the collection, including filtered-out ones. */
  allItemIds: string[];
  collections: Array<{ id: string; title: string }>;
  categoryMeta: CategoryMeta[];
  view: string;
}

/**
 * Owns bulk selection for a collection.
 *
 * Selection is keyed by item id and never assumes the visible list is the
 * whole collection: "select all shown" and "select all in collection" are
 * separate, clearly labelled actions.
 */
export function WishlistItemsPanel({
  wishlistId,
  items,
  allItemIds,
  collections,
  categoryMeta,
  view,
}: WishlistItemsPanelProps) {
  const [selected, setSelected] = useState<string[]>([]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const validSelected = allItemIds.filter((id) => selectedSet.has(id));
  const shownSelected = items.filter((item) => selectedSet.has(item.id)).length;
  const allShownSelected = items.length > 0 && shownSelected === items.length;
  const allCollectionSelected = allItemIds.length > 0 && validSelected.length === allItemIds.length;

  const toggle = (id: string, checked: boolean) => {
    setSelected((current) =>
      checked ? [...new Set([...current, id])] : current.filter((value) => value !== id)
    );
  };

  const clear = () => setSelected([]);
  // Add the visible products to the selection without discarding products the
  // user already selected from a previous, narrower search.
  const selectAllShown = () =>
    setSelected((current) => [...new Set([...current, ...items.map((item) => item.id)])]);

  const unpurchased = items.filter((item) => !item.purchased);
  const purchased = items.filter((item) => item.purchased);
  const categoryView = view === 'category' && items.some((item) => item.category);

  const row = (item: WishlistItemData) => (
    <ItemRow
      key={item.id}
      item={item}
      wishlistId={wishlistId}
      collections={collections}
      selectable
      selected={selectedSet.has(item.id)}
      onSelectChange={(checked) => toggle(item.id, checked)}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Selection controls */}
      <div className="flex flex-wrap items-center gap-2">
        <Checkbox
          checked={allShownSelected}
          onChange={(event) => (event.target.checked ? selectAllShown() : clear())}
          label={`Select all ${items.length} shown`}
          aria-label={`Select all ${items.length} visible products`}
        />
        {!allCollectionSelected && allItemIds.length > items.length && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[11px]"
            onClick={() => setSelected(allItemIds)}
            disabled={allCollectionSelected}
          >
            Select all {allItemIds.length} in this collection
          </Button>
        )}
        {validSelected.length > 0 && (
          <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={clear}>
            Clear selection
          </Button>
        )}
        <span className="text-muted-foreground ml-auto text-[11px]">
          {items.length} shown · {allItemIds.length} in collection
          {allCollectionSelected ? ' · all selected' : ''}
        </span>
      </div>

      {categoryView ? (
        <div className="flex flex-col gap-6">
          <CategoryView
            items={unpurchased}
            wishlistId={wishlistId}
            collections={collections}
            categoryMeta={categoryMeta}
            selectedIds={validSelected}
            onSelectChange={toggle}
          />
          {purchased.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="text-success h-4 w-4" aria-hidden />
                Purchased ({purchased.length})
              </h2>
              <div className="flex flex-col gap-2 opacity-70">{purchased.map(row)}</div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {unpurchased.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-foreground text-sm font-medium">Items ({unpurchased.length})</h2>
              <div className="flex flex-col gap-2">{unpurchased.map(row)}</div>
            </div>
          )}

          {purchased.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="text-success h-4 w-4" aria-hidden />
                Purchased ({purchased.length})
              </h2>
              <div className="flex flex-col gap-2 opacity-70">{purchased.map(row)}</div>
            </div>
          )}
        </div>
      )}

      <BulkActionToolbar
        wishlistId={wishlistId}
        selectedIds={validSelected}
        collections={collections}
        categories={categoryMeta.map((category) => category.name)}
        mode="active"
        onClear={clear}
      />
    </div>
  );
}
