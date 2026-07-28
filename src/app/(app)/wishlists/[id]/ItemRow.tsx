'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Copy,
  ExternalLink,
  FolderTree,
  FolderUp,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/Button';
import { Dropdown, type DropdownItem } from '@/components/ui/Dropdown';
import { WishlistPriority } from '@/components/ui/WishlistPriority';
import { ProductEditorDrawer } from '@/components/product/ProductEditorDrawer';
import { ProductPrice } from '@/components/product/ProductPrice';
import { togglePurchasedAction } from './item-actions';
import { updateStarPriorityAction } from './priority-action';

interface ItemRowProps {
  item: {
    id: string;
    title: string;
    description: string | null;
    url: string | null;
    image: string | null;
    brand: string | null;
    retailer: string | null;
    currentPrice: string | null;
    originalPrice?: string | null;
    dealInfo?: string | null;
    currency: string;
    priority: string;
    starPriority: number;
    quantity: number;
    purchased: boolean;
    notes: string | null;
    category?: string | null;
    parentId?: string | null;
  };
  wishlistId: string;
  onAddChild?: (parentId: string) => void;
  onContextAction?: (action: string, itemId: string) => void;
  /** Whether this item has children (renders with bolder styling) */
  isParent?: boolean;
  /** Nesting depth (affects padding/scale) */
  depth?: number;
}

// Retailer badge colors
const retailerStyles: Record<string, string> = {
  amazon: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  'best buy': 'bg-blue-600/10 text-blue-400 border-blue-600/20',
  walmart: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  newegg: 'bg-orange-600/10 text-orange-500 border-orange-600/20',
  target: 'bg-red-500/10 text-red-400 border-red-500/20',
  ebay: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  etsy: 'bg-orange-400/10 text-orange-300 border-orange-400/20',
  apple: 'bg-gray-400/10 text-gray-300 border-gray-400/20',
  steam: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  'b&h photo': 'bg-gray-500/10 text-gray-300 border-gray-500/20',
  'micro center': 'bg-red-600/10 text-red-400 border-red-600/20',
};

function getRetailerStyle(retailer: string | null): string {
  if (!retailer) return 'bg-surface text-muted-foreground border-border';
  const key = retailer
    .toLowerCase()
    .replace(/\s*(us|uk|de|ca)$/i, '')
    .trim();
  return retailerStyles[key] ?? 'bg-surface text-muted-foreground border-border';
}

export function ItemRow({
  item,
  wishlistId,
  onAddChild,
  onContextAction,
  isParent,
  depth = 0,
}: ItemRowProps) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const router = useRouter();

  const price = item.currentPrice != null ? Number(item.currentPrice) : null;

  const handleCopy = async () => {
    if (!item.url) return;
    await navigator.clipboard.writeText(item.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-2">
      <article
        className={cn(
          'group relative overflow-hidden rounded-2xl border transition-all duration-200',
          item.purchased
            ? 'border-border/40 bg-card/50 opacity-75'
            : 'border-border bg-card hover:border-border-hover hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/5',
          depth > 0 && 'rounded-xl',
          depth > 1 && 'rounded-lg'
        )}
      >
        <div className="flex gap-0">
          {/* Image section */}
          <div className="relative w-24 shrink-0 sm:w-36">
            {item.image ? (
              <div className="flex h-full min-h-[120px] items-center justify-center bg-white/[0.03] p-3">
                <img
                  src={item.image}
                  alt=""
                  className="h-full max-h-28 w-full object-contain sm:max-h-32"
                  loading="lazy"
                />
              </div>
            ) : (
              <div className="bg-surface flex h-full min-h-[120px] items-center justify-center">
                <Package className="text-muted/20 h-10 w-10" />
              </div>
            )}
            {/* Purchased overlay */}
            {item.purchased && (
              <div className="bg-background/50 absolute inset-0 flex items-center justify-center backdrop-blur-[2px]">
                <CheckCircle2 className="text-success h-8 w-8" />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex flex-1 flex-col justify-between gap-3 p-4 sm:p-5">
            {/* Top row: title + price */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 overflow-hidden">
                <h3
                  className={cn(
                    'line-clamp-2 text-sm leading-snug font-semibold sm:text-base',
                    item.purchased && 'text-muted-foreground line-through',
                    !item.purchased && 'text-foreground',
                    isParent && !item.purchased && 'font-bold',
                    depth > 0 && 'text-[13px] sm:text-sm'
                  )}
                >
                  {isParent && (
                    <FolderTree className="text-accent/60 -mt-0.5 mr-1.5 inline h-3.5 w-3.5" />
                  )}
                  {item.title}
                </h3>

                {/* Meta: brand + retailer */}
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {item.retailer && (
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] leading-none font-medium ${getRetailerStyle(item.retailer)}`}
                    >
                      {item.retailer}
                    </span>
                  )}
                  {item.brand && (
                    <span className="text-muted-foreground text-[11px]">{item.brand}</span>
                  )}
                  <InlineStarPriority item={item} wishlistId={wishlistId} />
                  {item.quantity > 1 && (
                    <span className="bg-surface text-muted-foreground rounded px-1.5 py-0.5 text-[10px] font-medium">
                      ×{item.quantity}
                    </span>
                  )}
                </div>
              </div>

              {/* Price */}
              {price != null && (
                <ProductPrice
                  price={price}
                  originalPrice={
                    item.originalPrice != null ? Number(item.originalPrice) : undefined
                  }
                  currency={item.currency}
                  dealInfo={item.dealInfo}
                  purchased={item.purchased}
                  size="md"
                />
              )}
            </div>

            {/* Notes — expandable */}
            {item.notes && <ItemNotes notes={item.notes} />}

            {/* Actions row */}
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Purchased toggle */}
              <form action={togglePurchasedAction}>
                <input type="hidden" name="itemId" value={item.id} />
                <input type="hidden" name="wishlistId" value={wishlistId} />
                <Button
                  type="submit"
                  variant={item.purchased ? 'secondary' : 'outline'}
                  size="sm"
                  className="h-7 gap-1.5 rounded-lg text-[11px]"
                >
                  {item.purchased ? (
                    <>
                      <CheckCircle2 className="text-success h-3 w-3" /> Purchased
                    </>
                  ) : (
                    <>
                      <Circle className="h-3 w-3" /> Mark Bought
                    </>
                  )}
                </Button>
              </form>

              {/* Visit store */}
              {item.url && (
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 rounded-lg text-[11px]"
                >
                  <a href={item.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3" /> Visit Store
                  </a>
                </Button>
              )}

              {/* Copy */}
              {item.url && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 rounded-lg text-[11px]"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check className="text-success h-3 w-3" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              )}

              {/* Edit */}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 rounded-lg text-[11px]"
                onClick={() => setEditing(true)}
              >
                <Pencil className="h-3 w-3" /> Edit
              </Button>

              {/* Context Menu (three-dot) */}
              <Dropdown
                trigger={
                  <span className="text-muted-foreground hover:text-foreground hover:bg-surface inline-flex h-7 w-7 items-center justify-center rounded-lg transition-colors">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </span>
                }
                align="end"
                label="Item actions"
                items={[
                  ...(onAddChild
                    ? [
                        {
                          label: 'Add Child',
                          value: 'add-child',
                          icon: <Plus className="h-3.5 w-3.5" />,
                        },
                      ]
                    : []),
                  { label: 'Rename', value: 'edit', icon: <Pencil className="h-3.5 w-3.5" /> },
                  {
                    label: 'Duplicate Branch',
                    value: 'duplicate-branch',
                    icon: <Copy className="h-3.5 w-3.5" />,
                  },
                  ...(item.parentId
                    ? [
                        {
                          label: 'Convert to Root',
                          value: 'convert-to-root',
                          icon: <FolderUp className="h-3.5 w-3.5" />,
                        },
                      ]
                    : []),
                  {
                    label: 'Delete',
                    value: 'delete-branch',
                    destructive: true,
                    icon: <Trash2 className="h-3.5 w-3.5" />,
                  },
                ]}
                onSelect={(action) => {
                  if (action === 'add-child' && onAddChild) {
                    onAddChild(item.id);
                  } else if (action === 'edit') {
                    setEditing(true);
                  } else if (onContextAction) {
                    onContextAction(action, item.id);
                  }
                }}
              />
            </div>
          </div>
        </div>
      </article>

      {/* Product Editor Drawer */}
      <ProductEditorDrawer
        open={editing}
        onClose={() => setEditing(false)}
        item={item}
        wishlistId={wishlistId}
        onSave={() => {
          setEditing(false);
          router.refresh();
        }}
        onDelete={() => {
          setEditing(false);
          router.refresh();
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function InlineStarPriority({
  item,
  wishlistId,
}: {
  item: ItemRowProps['item'];
  wishlistId: string;
}) {
  const [optimistic, setOptimistic] = useState(item.starPriority);

  const handleChange = async (newValue: number) => {
    setOptimistic(newValue); // Optimistic update
    const fd = new FormData();
    fd.set('itemId', item.id);
    fd.set('wishlistId', wishlistId);
    fd.set('starPriority', String(newValue));
    await updateStarPriorityAction(fd);
  };

  return <WishlistPriority value={optimistic} onChange={handleChange} showLabel size="sm" />;
}

function ItemNotes({ notes }: { notes: string }) {
  const isLong = notes.length > 80;

  if (!isLong) {
    return <p className="text-muted-foreground text-[11px] italic">{notes}</p>;
  }

  return (
    <details className="group">
      <summary className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1 text-[11px] transition-colors">
        <ChevronRight className="h-3 w-3 transition-transform duration-150 group-open:rotate-90" />
        <span className="italic">{notes.slice(0, 60)}...</span>
      </summary>
      <div className="border-border/50 bg-surface/50 text-muted-foreground mt-1.5 rounded-lg border p-2.5 text-[11px] leading-relaxed whitespace-pre-wrap">
        {notes}
      </div>
    </details>
  );
}
