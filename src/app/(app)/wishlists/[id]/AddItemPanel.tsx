'use client';

/**
 * Add Item Panel — Unified product input for wishlists.
 *
 * Single smart input field. Paste anything:
 * - URLs (Amazon, Best Buy, Newegg, any product page)
 * - Product names ("RTX 5070 Ti")
 * - Shopping lists (multi-line)
 * - PCPartPicker builds
 *
 * The system detects the input type and handles it automatically.
 */
import { Card } from '@/components/ui/Card';
import { UniversalInput } from '@/components/product';

interface AddItemPanelProps {
  wishlistId: string;
  parentId?: string;
}

export function AddItemPanel({ wishlistId, parentId }: AddItemPanelProps) {
  return (
    <Card className="max-w-2xl p-6">
      <div className="mb-4">
        <h2 className="text-lg font-medium">{parentId ? 'Add Child Item' : 'Add Products'}</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {parentId
            ? 'Add a sub-item nested under the parent.'
            : 'Paste a URL, type a product name, or paste a shopping list.'}
        </p>
      </div>
      <UniversalInput wishlistId={wishlistId} parentId={parentId} />
    </Card>
  );
}
