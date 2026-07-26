'use client';

/**
 * UniversalInput — The single input field for adding products.
 *
 * Users paste anything: URLs, product names, shopping lists, PCPartPicker builds.
 * The backend decides what to do. The user never chooses between modes.
 *
 * Flow:
 * 1. User types/pastes into the input
 * 2. On submit, calls /api/products/identify
 * 3. If single result → opens ProductEditor with prefilled draft
 * 4. If batch result → shows batch preview with option to add all
 */
import { useState } from 'react';
import { AlertCircle, ListPlus, Loader2, Package, Plus } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { ProductEditor, type ProductEditorDraft } from './ProductEditor';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ImportDraft {
  title: string;
  description?: string;
  url?: string;
  image?: string;
  brand?: string;
  retailer?: string;
  currentPrice?: number;
  originalPrice?: number;
  currency?: string;
  dealInfo?: string;
  category?: string;
  sku?: string;
  confidence: number;
}

interface ImportResponse {
  success: boolean;
  drafts: ImportDraft[];
  isBatch: boolean;
  batchName?: string;
  batchMeta?: {
    description?: string;
    sourceUrl?: string;
    notes?: string;
  };
  error?: string;
}

type InputState =
  | { phase: 'input' }
  | { phase: 'loading' }
  | { phase: 'single'; draft: ProductEditorDraft }
  | {
      phase: 'batch';
      drafts: ImportDraft[];
      batchName: string;
      batchMeta?: ImportResponse['batchMeta'];
    }
  | { phase: 'error'; message: string };

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface UniversalInputProps {
  wishlistId: string;
  className?: string;
}

export function UniversalInput({ wishlistId, className }: UniversalInputProps) {
  const [input, setInput] = useState('');
  const [state, setState] = useState<InputState>({ phase: 'input' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || trimmed.length < 2) return;

    setState({ phase: 'loading' });

    try {
      const res = await fetch('/api/products/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: trimmed }),
      });

      const data: ImportResponse = await res.json();

      if (!data.success || !data.drafts?.length) {
        // No results from pipeline — open ProductEditor with just the title
        setState({
          phase: 'single',
          draft: { title: trimmed },
        });
        return;
      }

      if (data.isBatch && data.drafts.length > 1) {
        // Multiple items (shopping list, PCPartPicker build)
        setState({
          phase: 'batch',
          drafts: data.drafts,
          batchName: data.batchName || 'Import',
          batchMeta: data.batchMeta,
        });
      } else {
        // Single item — open ProductEditor
        const draft = data.drafts[0];
        setState({
          phase: 'single',
          draft: {
            title: draft.title,
            description: draft.description,
            url: draft.url,
            image: draft.image,
            brand: draft.brand,
            retailer: draft.retailer,
            currentPrice: draft.currentPrice,
            originalPrice: draft.originalPrice,
            currency: draft.currency,
            dealInfo: draft.dealInfo,
            category: draft.category,
            sku: draft.sku,
          },
        });
      }
    } catch {
      setState({ phase: 'error', message: 'Failed to process input. Please try again.' });
    }
  };

  const handleReset = () => {
    setState({ phase: 'input' });
    setInput('');
  };

  const handleBatchAdd = async () => {
    if (state.phase !== 'batch') return;

    setState({ phase: 'loading' });

    try {
      // Add all items in batch via the wishlist add-item endpoint
      for (const draft of state.drafts) {
        const formData = new FormData();
        formData.set('wishlistId', wishlistId);
        formData.set('title', draft.title);
        if (draft.url) formData.set('url', draft.url);
        if (draft.image) formData.set('image', draft.image);
        if (draft.brand) formData.set('brand', draft.brand);
        if (draft.retailer) formData.set('retailer', draft.retailer);
        if (draft.currentPrice) formData.set('currentPrice', String(draft.currentPrice));
        if (draft.currency) formData.set('currency', draft.currency);
        if (draft.category) formData.set('category', draft.category);

        await fetch('/api/wishlists/add-item', { method: 'POST', body: formData });
      }

      // Reset and reload
      handleReset();
      window.location.reload();
    } catch {
      setState({ phase: 'error', message: 'Failed to add items. Please try again.' });
    }
  };

  // ─── Render by Phase ───

  // Loading
  if (state.phase === 'loading') {
    return (
      <div className={cn('flex items-center justify-center py-8', className)}>
        <Loader2 className="text-accent h-6 w-6 animate-spin" />
        <span className="text-muted-foreground ml-3 text-sm">Processing...</span>
      </div>
    );
  }

  // Error
  if (state.phase === 'error') {
    return (
      <div className={cn('space-y-3', className)}>
        <div className="border-danger/30 bg-danger/5 text-danger flex items-center gap-2 rounded-lg border px-4 py-3 text-sm">
          <AlertCircle className="h-4 w-4" />
          {state.message}
        </div>
        <Button variant="ghost" size="sm" onClick={handleReset}>
          Try Again
        </Button>
      </div>
    );
  }

  // Single item → ProductEditor
  if (state.phase === 'single') {
    return (
      <div className={cn('space-y-3', className)}>
        <div className="flex items-center justify-between">
          <h3 className="text-muted-foreground text-sm font-medium">
            Review &amp; add to wishlist
          </h3>
          <Button variant="ghost" size="sm" onClick={handleReset}>
            ← Back
          </Button>
        </div>
        <ProductEditor
          draft={state.draft}
          wishlistId={wishlistId}
          mode="create"
          onSave={handleReset}
          onCancel={handleReset}
        />
      </div>
    );
  }

  // Batch → Preview list with "Add All" button
  if (state.phase === 'batch') {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">{state.batchName}</h3>
            {state.batchMeta?.description && (
              <p className="text-muted-foreground text-xs">{state.batchMeta.description}</p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={handleReset}>
            ← Back
          </Button>
        </div>

        <div className="border-border max-h-80 overflow-y-auto rounded-lg border">
          {state.drafts.map((draft, i) => (
            <div
              key={i}
              className="border-border flex items-center gap-3 border-b p-3 last:border-0"
            >
              {draft.image ? (
                <img
                  src={draft.image}
                  alt={draft.title}
                  className="h-10 w-10 rounded border object-cover"
                />
              ) : (
                <div className="bg-surface flex h-10 w-10 items-center justify-center rounded border">
                  <Package className="text-muted-foreground h-4 w-4" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{draft.title}</p>
                <div className="text-muted-foreground flex items-center gap-2 text-xs">
                  {draft.category && <span>{draft.category}</span>}
                  {draft.retailer && <span>· {draft.retailer}</span>}
                </div>
              </div>
              {draft.currentPrice != null && (
                <span className="text-sm font-medium">${draft.currentPrice.toFixed(2)}</span>
              )}
            </div>
          ))}
        </div>

        {state.batchMeta?.notes && (
          <pre className="bg-surface text-muted-foreground rounded-lg p-3 text-xs whitespace-pre-wrap">
            {state.batchMeta.notes}
          </pre>
        )}

        <div className="flex gap-2">
          <Button size="sm" className="gap-2" onClick={handleBatchAdd}>
            <ListPlus className="h-4 w-4" />
            Add All {state.drafts.length} Items
          </Button>
          <Button variant="ghost" size="sm" onClick={handleReset}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // Default: Input phase
  return (
    <form onSubmit={handleSubmit} className={cn('space-y-3', className)}>
      <Textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Paste anything... URL, product name, shopping list, PCPartPicker build"
        rows={3}
        className="resize-none"
        onKeyDown={(e) => {
          // Submit on Cmd/Ctrl+Enter
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            handleSubmit(e);
          }
        }}
      />
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-xs">
          URLs, product names, shopping lists, PCPartPicker builds — paste anything
        </p>
        <Button
          type="submit"
          size="sm"
          disabled={!input.trim() || input.trim().length < 2}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>
    </form>
  );
}
