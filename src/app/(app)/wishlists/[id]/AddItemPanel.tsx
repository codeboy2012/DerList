'use client';

/**
 * Add Item Panel — tabbed product import.
 *
 * Each import method has its own input and review flow. The panels share the
 * existing identify/import APIs and the existing wishlist-item model.
 */
import { Card } from '@/components/ui/Card';
import type { ExistingImportItem } from '@/components/product/ImportBatchReview';
import { ImportTabs } from './ImportTabs';

interface AddItemPanelProps {
  wishlistId: string;
  wishlistTitle: string;
  categories: string[];
  existingItems: ExistingImportItem[];
}

export function AddItemPanel({
  wishlistId,
  wishlistTitle,
  categories,
  existingItems,
}: AddItemPanelProps) {
  return (
    <Card className="max-w-3xl overflow-hidden p-0">
      <div className="px-4 pt-5 pb-3 sm:px-6">
        <h2 className="text-lg font-medium">Add Products</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Choose how you want to find products. Every method ends in the same review step before
          anything is saved.
        </p>
      </div>
      <ImportTabs
        wishlistId={wishlistId}
        wishlistTitle={wishlistTitle}
        categories={categories}
        existingItems={existingItems}
      />
    </Card>
  );
}
