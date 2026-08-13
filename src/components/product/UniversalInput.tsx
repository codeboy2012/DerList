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
 * 3. Shows identification progress and confidence
 * 4. If single result → opens ProductEditor with prefilled draft
 * 5. If batch result → shows batch preview with per-item status
 *
 * Key improvement: Shows clear feedback about identification quality.
 * Never silently accepts garbage data — alerts the user when confidence is low.
 */
import { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  ListPlus,
  Loader2,
  Package,
  Plus,
  Search,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
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

interface ItemStatus {
  index: number;
  status: 'identified' | 'needs-review' | 'failed';
  confidence: number;
  source: string;
  message: string;
  providersAttempted?: string[];
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
  itemStatuses?: ItemStatus[];
  error?: string;
}

type InputState =
  | { phase: 'input' }
  | { phase: 'loading'; message: string }
  | { phase: 'single'; draft: ProductEditorDraft; status?: ItemStatus }
  | {
      phase: 'batch';
      drafts: ImportDraft[];
      batchName: string;
      batchMeta?: ImportResponse['batchMeta'];
      statuses?: ItemStatus[];
    }
  | { phase: 'error'; message: string };

// ─────────────────────────────────────────────────────────────────────────────
// Confidence Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getConfidenceLevel(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence >= 75) return 'high';
  if (confidence >= 50) return 'medium';
  return 'low';
}

function getConfidenceColor(confidence: number): string {
  const level = getConfidenceLevel(confidence);
  switch (level) {
    case 'high':
      return 'text-success';
    case 'medium':
      return 'text-warning';
    case 'low':
      return 'text-danger';
  }
}

function getStatusIcon(status: ItemStatus['status'], confidence: number) {
  switch (status) {
    case 'identified':
      return confidence >= 75 ? (
        <CheckCircle2 className="text-success h-4 w-4" />
      ) : (
        <ShieldCheck className="text-warning h-4 w-4" />
      );
    case 'needs-review':
      return <AlertTriangle className="text-warning h-4 w-4" />;
    case 'failed':
      return <XCircle className="text-danger h-4 w-4" />;
  }
}

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

    // Show contextual loading message
    const isUrl = /^https?:\/\//i.test(trimmed);
    const loadingMsg = isUrl ? 'Identifying product...' : 'Processing...';
    setState({ phase: 'loading', message: loadingMsg });

    try {
      const res = await fetch('/api/products/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: trimmed }),
      });

      const data: ImportResponse = await res.json();

      if (!data.success || !data.drafts?.length) {
        // No results from pipeline — open ProductEditor for manual entry
        setState({
          phase: 'single',
          draft: { title: trimmed },
          status: {
            index: 0,
            status: 'failed',
            confidence: 0,
            source: 'manual',
            message: data.error || 'Could not identify product. Please enter details manually.',
          },
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
          statuses: data.itemStatuses,
        });
      } else {
        // Single item — open ProductEditor
        const draft = data.drafts[0];
        const status = data.itemStatuses?.[0];

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
          status,
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

    setState({ phase: 'loading', message: `Adding ${state.drafts.length} items...` });

    try {
      // Fast import: creates items instantly, enrichment runs in background
      const promises = state.drafts.map((draft) =>
        fetch('/api/wishlists/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wishlistId,
            title: draft.title,
            url: draft.url,
            image: draft.image,
            brand: draft.brand,
            retailer: draft.retailer,
            price: draft.currentPrice,
            category: draft.category,
          }),
        })
      );

      // Run up to 3 at a time for speed without overloading
      for (let i = 0; i < promises.length; i += 3) {
        await Promise.allSettled(promises.slice(i, i + 3));
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
      <div className={cn('flex flex-col items-center justify-center gap-2 py-8', className)}>
        <div className="flex items-center gap-3">
          <Loader2 className="text-accent h-5 w-5 animate-spin" />
          <span className="text-foreground text-sm font-medium">{state.message}</span>
        </div>
        <p className="text-muted-foreground text-xs">
          Checking multiple sources for product data...
        </p>
      </div>
    );
  }

  // Error
  if (state.phase === 'error') {
    return (
      <div className={cn('space-y-3', className)}>
        <div className="border-danger/30 bg-danger/5 text-danger flex items-center gap-2 rounded-lg border px-4 py-3 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {state.message}
        </div>
        <Button variant="ghost" size="sm" onClick={handleReset}>
          Try Again
        </Button>
      </div>
    );
  }

  // Single item → ProductEditor with identification status
  if (state.phase === 'single') {
    return (
      <div className={cn('space-y-3', className)}>
        {/* Identification Status Banner */}
        {state.status && <IdentificationBanner status={state.status} />}

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

  // Batch → Preview list with per-item status
  if (state.phase === 'batch') {
    const statuses = state.statuses ?? [];
    const identified = statuses.filter((s) => s.status === 'identified').length;
    const needsReview = statuses.filter((s) => s.status === 'needs-review').length;
    const failed = statuses.filter((s) => s.status === 'failed').length;

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

        {/* Batch summary */}
        {statuses.length > 0 && (
          <div className="border-border bg-surface/50 flex items-center gap-4 rounded-lg border px-4 py-2 text-xs">
            {identified > 0 && (
              <span className="text-success flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> {identified} identified
              </span>
            )}
            {needsReview > 0 && (
              <span className="text-warning flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> {needsReview} need review
              </span>
            )}
            {failed > 0 && (
              <span className="text-danger flex items-center gap-1">
                <XCircle className="h-3 w-3" /> {failed} failed
              </span>
            )}
          </div>
        )}

        <div className="border-border max-h-80 overflow-y-auto rounded-lg border">
          {state.drafts.map((draft, i) => {
            const itemStatus = statuses.find((s) => s.index === i);
            return (
              <div
                key={i}
                className="border-border flex items-center gap-3 border-b p-3 last:border-0"
              >
                {/* Status indicator */}
                <div className="shrink-0">
                  {itemStatus ? (
                    getStatusIcon(itemStatus.status, itemStatus.confidence)
                  ) : (
                    <HelpCircle className="text-muted-foreground h-4 w-4" />
                  )}
                </div>

                {/* Product image */}
                {draft.image ? (
                  <img
                    src={draft.image}
                    alt={draft.title}
                    className="h-10 w-10 shrink-0 rounded border object-cover"
                  />
                ) : (
                  <div className="bg-surface flex h-10 w-10 shrink-0 items-center justify-center rounded border">
                    <Package className="text-muted-foreground h-4 w-4" />
                  </div>
                )}

                {/* Product info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{draft.title}</p>
                  <div className="text-muted-foreground flex items-center gap-2 text-xs">
                    {draft.category && <span>{draft.category}</span>}
                    {draft.retailer && <span>· {draft.retailer}</span>}
                    {itemStatus && (
                      <span className={cn('ml-auto', getConfidenceColor(itemStatus.confidence))}>
                        {itemStatus.confidence}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Price */}
                {draft.currentPrice != null ? (
                  <span className="shrink-0 text-sm font-medium">
                    ${draft.currentPrice.toFixed(2)}
                  </span>
                ) : (
                  <span className="text-muted-foreground shrink-0 text-xs">No price</span>
                )}
              </div>
            );
          })}
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

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Shows the identification result status above the ProductEditor.
 * Communicates confidence level and data source to the user.
 */
function IdentificationBanner({ status }: { status: ItemStatus }) {
  if (status.status === 'identified' && status.confidence >= 75) {
    // High confidence — subtle success indicator
    return (
      <div className="border-success/20 bg-success/5 flex items-center gap-3 rounded-lg border px-4 py-2.5">
        <CheckCircle2 className="text-success h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{status.message}</p>
          {status.providersAttempted && status.providersAttempted.length > 0 && (
            <p className="text-muted-foreground text-xs">
              Source: {status.source} · Confidence: {status.confidence}%
            </p>
          )}
        </div>
      </div>
    );
  }

  if (status.status === 'needs-review' || (status.status === 'identified' && status.confidence < 75)) {
    // Medium confidence — show warning
    return (
      <div className="border-warning/20 bg-warning/5 flex items-center gap-3 rounded-lg border px-4 py-2.5">
        <AlertTriangle className="text-warning h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{status.message}</p>
          <p className="text-muted-foreground text-xs">
            Please verify the product details below are correct.
            {status.confidence > 0 && ` Confidence: ${status.confidence}%`}
          </p>
        </div>
      </div>
    );
  }

  // Failed — clear error with manual entry guidance
  return (
    <div className="border-danger/20 bg-danger/5 flex items-center gap-3 rounded-lg border px-4 py-2.5">
      <Search className="text-danger h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{status.message}</p>
        <p className="text-muted-foreground text-xs">
          Enter the product details manually below.
          {status.providersAttempted && status.providersAttempted.length > 0 && (
            <> Tried: {status.providersAttempted.join(', ')}</>
          )}
        </p>
      </div>
    </div>
  );
}
