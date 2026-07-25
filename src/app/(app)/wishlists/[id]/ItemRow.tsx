'use client';

import { useActionState, useState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { WishlistPriority } from '@/components/ui/WishlistPriority';
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Copy,
  ExternalLink,
  MoreHorizontal,
  Package,
  Pencil,
  Trash2,
} from 'lucide-react';

import type { ActionState } from '../../../(auth)/actions';
import { deleteItemAction, quickEditItemAction, togglePurchasedAction } from './item-actions';
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
    currentPrice: unknown;
    originalPrice?: unknown;
    dealInfo?: string | null;
    currency: string;
    priority: string;
    starPriority: number;
    quantity: number;
    purchased: boolean;
    notes: string | null;
    category?: string | null;
  };
  wishlistId: string;
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
  const key = retailer.toLowerCase().replace(/\s*(us|uk|de|ca)$/i, '').trim();
  return retailerStyles[key] ?? 'bg-surface text-muted-foreground border-border';
}

export function ItemRow({ item, wishlistId }: ItemRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);

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
        className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 ${
          item.purchased
            ? 'border-border/40 bg-card/50 opacity-75'
            : 'border-border bg-card hover:border-border-hover hover:shadow-xl hover:shadow-black/10 hover:-translate-y-0.5'
        }`}
      >
        <div className="flex gap-0 sm:gap-0">
          {/* Image section */}
          <div className="relative shrink-0 w-28 sm:w-36">
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
              <div className="flex h-full min-h-[120px] items-center justify-center bg-surface">
                <Package className="h-10 w-10 text-muted/20" />
              </div>
            )}
            {/* Purchased overlay */}
            {item.purchased && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-[2px]">
                <CheckCircle2 className="h-8 w-8 text-success" />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex flex-1 flex-col justify-between gap-3 p-4 sm:p-5">
            {/* Top row: title + price */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 overflow-hidden">
                <h3 className={`line-clamp-2 text-sm font-semibold leading-snug sm:text-base ${
                  item.purchased ? 'text-muted-foreground line-through' : 'text-foreground'
                }`}>
                  {item.title}
                </h3>

                {/* Meta: brand + retailer */}
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {item.retailer && (
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none ${getRetailerStyle(item.retailer)}`}>
                      {item.retailer}
                    </span>
                  )}
                  {item.brand && (
                    <span className="text-[11px] text-muted-foreground">{item.brand}</span>
                  )}
                  <InlineStarPriority item={item} wishlistId={wishlistId} />
                  {item.quantity > 1 && (
                    <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      ×{item.quantity}
                    </span>
                  )}
                </div>
              </div>

              {/* Price */}
              {price != null && (
                <div className="shrink-0 text-right">
                  <span className={`text-lg font-bold tabular-nums leading-tight ${
                    item.purchased ? 'text-muted-foreground' : 'text-foreground'
                  }`}>
                    ${price.toFixed(2)}
                  </span>
                  {item.originalPrice != null && Number(item.originalPrice) > price && (
                    <span className="block text-[10px] text-muted-foreground line-through">
                      ${Number(item.originalPrice).toFixed(2)}
                    </span>
                  )}
                  {!(item.originalPrice != null && Number(item.originalPrice) > price) && (
                    <span className="block text-[10px] text-muted-foreground">{item.currency}</span>
                  )}
                  {item.dealInfo && (
                    <span className="mt-0.5 inline-block rounded-full bg-green-500/10 px-1.5 py-0.5 text-[9px] font-medium text-green-400">
                      {item.dealInfo}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Notes — expandable */}
            {item.notes && (
              <ItemNotes notes={item.notes} />
            )}

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
                    <><CheckCircle2 className="h-3 w-3 text-success" /> Purchased</>
                  ) : (
                    <><Circle className="h-3 w-3" /> Mark Bought</>
                  )}
                </Button>
              </form>

              {/* Visit store */}
              {item.url && (
                <Button asChild variant="ghost" size="sm" className="h-7 gap-1.5 rounded-lg text-[11px]">
                  <a href={item.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3" /> Visit Store
                  </a>
                </Button>
              )}

              {/* Copy */}
              {item.url && (
                <Button variant="ghost" size="sm" className="h-7 gap-1.5 rounded-lg text-[11px]" onClick={handleCopy}>
                  {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              )}

              {/* Edit */}
              <Button variant="ghost" size="sm" className="h-7 gap-1.5 rounded-lg text-[11px]" onClick={() => setEditing((e) => !e)}>
                <Pencil className="h-3 w-3" /> Edit
              </Button>

              {/* More */}
              <div className="relative ml-auto">
                <Button variant="ghost" size="sm" className="h-7 w-7 rounded-lg p-0" onClick={() => setMenuOpen((o) => !o)} aria-label="More">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
                {menuOpen && (
                  <div className="absolute right-0 top-full z-20 mt-1 w-36 rounded-xl border border-border bg-card p-1 shadow-xl animate-scale-in">
                    <form action={async (fd) => { if (!window.confirm('Delete this item?')) return; await deleteItemAction(fd); setMenuOpen(false); }}>
                      <input type="hidden" name="itemId" value={item.id} />
                      <input type="hidden" name="wishlistId" value={wishlistId} />
                      <button type="submit" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-danger transition-colors hover:bg-danger/10">
                        <Trash2 className="h-3.5 w-3.5" /> Remove
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </article>

      {/* Inline edit panel */}
      {editing && <InlineEditForm item={item} wishlistId={wishlistId} onDone={() => setEditing(false)} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: string }) {
  const config: Record<string, { variant: 'warning' | 'danger' | 'default'; label: string }> = {
    LOW: { variant: 'default', label: 'Low' },
    HIGH: { variant: 'warning', label: 'High Priority' },
    CRITICAL: { variant: 'danger', label: 'Must Have' },
  };
  const c = config[priority];
  if (!c) return null;
  return <Badge variant={c.variant} className="text-[9px] leading-none">{c.label}</Badge>;
}

function InlineStarPriority({ item, wishlistId }: { item: ItemRowProps['item']; wishlistId: string }) {
  const [optimistic, setOptimistic] = useState(item.starPriority);

  const handleChange = async (newValue: number) => {
    setOptimistic(newValue); // Optimistic update
    const fd = new FormData();
    fd.set('itemId', item.id);
    fd.set('wishlistId', wishlistId);
    fd.set('starPriority', String(newValue));
    await updateStarPriorityAction(fd);
  };

  return (
    <WishlistPriority value={optimistic} onChange={handleChange} showLabel size="sm" />
  );
}

function InlineEditForm({ item, wishlistId, onDone }: { item: ItemRowProps['item']; wishlistId: string; onDone: () => void }) {
  const initialState: ActionState = { success: false };
  const [state, formAction, pending] = useActionState(quickEditItemAction, initialState);
  const [starPriority, setStarPriority] = useState(item.starPriority);

  if (state.success) onDone();

  return (
    <form action={formAction} className="rounded-xl border border-accent/20 bg-card-hover p-4 animate-fade-up" noValidate>
      <input type="hidden" name="itemId" value={item.id} />
      <input type="hidden" name="wishlistId" value={wishlistId} />
      <input type="hidden" name="priority" value={item.priority} />
      <input type="hidden" name="starPriority" value={starPriority} />
      {state.error && <p className="mb-3 text-xs text-danger">{state.error}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className="text-[11px] font-medium text-muted-foreground">Title</label>
          <Input name="title" defaultValue={item.title} className="h-8 text-xs" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground">Priority</label>
          <WishlistPriority value={starPriority} onChange={setStarPriority} size="md" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-muted-foreground">Quantity</label>
          <Input name="quantity" type="number" min={1} max={999} defaultValue={item.quantity} className="h-8 text-xs" />
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className="text-[11px] font-medium text-muted-foreground">Category</label>
          <Input name="category" defaultValue={item.category ?? ''} className="h-8 text-xs" placeholder="e.g. PC Upgrades, Smart Home" />
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className="text-[11px] font-medium text-muted-foreground">Notes</label>
          <Textarea name="notes" defaultValue={item.notes ?? ''} rows={2} className="text-xs" placeholder="Personal notes, specs, reasons..." />
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button type="submit" size="sm" disabled={pending} className="h-7 text-xs">{pending ? 'Saving...' : 'Save'}</Button>
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={onDone}>Cancel</Button>
      </div>
    </form>
  );
}

function ItemNotes({ notes }: { notes: string }) {
  const isLong = notes.length > 80;

  if (!isLong) {
    return (
      <p className="text-[11px] italic text-muted-foreground">{notes}</p>
    );
  }

  return (
    <details className="group">
      <summary className="flex cursor-pointer items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground">
        <ChevronRight className="h-3 w-3 transition-transform duration-150 group-open:rotate-90" />
        <span className="italic">{notes.slice(0, 60)}...</span>
      </summary>
      <div className="mt-1.5 rounded-lg border border-border/50 bg-surface/50 p-2.5 text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap">
        {notes}
      </div>
    </details>
  );
}
