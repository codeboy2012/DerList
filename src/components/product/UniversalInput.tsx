'use client';

/**
 * UniversalInput — shared URL/text import workflow.
 *
 * The backend still owns importer detection. This component only constrains the
 * input for the active tab (URL vs text), calls the existing identify endpoint,
 * and hands results to the shared review step. ProductEditor remains the single
 * item review path; ImportBatchReview is used for multi-product results.
 */
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2, Plus, Search } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import {
  ImportBatchReview,
  type ExistingImportItem,
  type ImportReviewDraft,
  type ImportReviewStatus,
} from './ImportBatchReview';
import { ProductEditor, type AIIdentificationInfo, type ProductEditorDraft } from './ProductEditor';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ImportDraft extends ImportReviewDraft {
  sku?: string;
  asin?: string;
  upc?: string;
  mpn?: string;
}

interface ItemStatus extends ImportReviewStatus {
  providersAttempted?: string[];
  fieldSources?: Record<string, unknown>;
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

interface UniversalInputProps {
  wishlistId: string;
  wishlistTitle?: string;
  categories?: string[];
  existingItems?: ExistingImportItem[];
  className?: string;
  /** Constrains and describes this tab's input without changing importer logic. */
  mode?: 'any' | 'url' | 'text';
  placeholder?: string;
  helperText?: string;
  submitLabel?: string;
  maxLength?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function validateInput(mode: UniversalInputProps['mode'], value: string): string | null {
  if (mode !== 'url') return null;

  const candidates = value
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (candidates.length === 0) {
    return 'Paste at least one product URL.';
  }

  const invalid = candidates.find((entry) => !/^https?:\/\//i.test(entry));
  if (invalid) {
    return 'Every product URL must start with http:// or https://.';
  }

  return null;
}

function toAIInfo(status?: ItemStatus): AIIdentificationInfo | undefined {
  if (!status) return undefined;

  const importStatus =
    status.status === 'no-ai-configured'
      ? 'no_ai_configured'
      : status.status === 'needs-review'
        ? 'needs_review'
        : status.status === 'conflict'
          ? 'conflict'
          : status.status === 'failed'
            ? 'failed'
            : 'ready';

  const fieldSources = status.fieldSources
    ? (Object.fromEntries(
        Object.entries(status.fieldSources).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string'
        )
      ) as Record<string, string>)
    : undefined;

  return {
    importStatus,
    confidence: status.confidence,
    fieldSources,
    identified: status.status === 'identified',
    message: status.message,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function UniversalInput({
  wishlistId,
  wishlistTitle = 'this wishlist',
  categories = [],
  existingItems = [],
  className,
  mode = 'any',
  placeholder,
  helperText,
  submitLabel,
  maxLength = 2000,
}: UniversalInputProps) {
  const [input, setInput] = useState('');
  const [state, setState] = useState<InputState>({ phase: 'input' });
  const [inputError, setInputError] = useState<string | null>(null);
  const router = useRouter();

  const resolvedPlaceholder =
    placeholder ??
    (mode === 'url'
      ? 'Paste a product URL — or several URLs, one per line'
      : mode === 'text'
        ? 'Paste a shopping list, product listing, or copied product details…'
        : 'Paste a URL, product name, shopping list, or PCPartPicker build…');

  const resolvedHelper =
    helperText ??
    (mode === 'url'
      ? 'Amazon, Best Buy, Newegg, PCPartPicker, and other product pages are supported.'
      : mode === 'text'
        ? 'Each non-empty line can become a product. Prices in the text are preserved when detected.'
        : 'URLs, product names, shopping lists, and PCPartPicker builds are detected automatically.');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || trimmed.length < 2) return;

    const validationError = validateInput(mode, trimmed);
    if (validationError) {
      setInputError(validationError);
      return;
    }

    setInputError(null);
    const isUrl = /^https?:\/\//i.test(trimmed);
    const loadingMsg =
      mode === 'url'
        ? 'Reading product URL...'
        : mode === 'text'
          ? 'Detecting products...'
          : isUrl
            ? 'Identifying product...'
            : 'Processing...';
    setState({ phase: 'loading', message: loadingMsg });

    try {
      const response = await fetch('/api/products/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: trimmed }),
      });

      const data = (await response.json()) as ImportResponse;

      // Partial results are still reviewable: a batch can contain failed or
      // no-AI items even when the overall response reports success=false.
      if (!response.ok || !data.drafts?.length) {
        const fallbackIsUrl = /^https?:\/\//i.test(trimmed);
        setState({
          phase: 'single',
          draft: {
            title: fallbackIsUrl ? '' : trimmed,
            url: fallbackIsUrl ? trimmed : undefined,
          },
          status: {
            index: 0,
            status: 'failed',
            confidence: 0,
            source: 'manual',
            message:
              data.error ||
              (fallbackIsUrl
                ? 'Could not identify this product. Enter the details manually below.'
                : 'Could not identify a product. Enter the details manually below.'),
          },
        });
        return;
      }

      if (data.isBatch && data.drafts.length > 1) {
        setState({
          phase: 'batch',
          drafts: data.drafts,
          batchName: data.batchName || 'Import',
          batchMeta: data.batchMeta,
          statuses: data.itemStatuses,
        });
        return;
      }

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
          asin: draft.asin,
          upc: draft.upc,
          mpn: draft.mpn,
        },
        status: data.itemStatuses?.[0],
      });
    } catch {
      setState({ phase: 'error', message: 'Failed to process input. Please try again.' });
    }
  };

  const handleBack = () => {
    setInputError(null);
    setState({ phase: 'input' });
  };

  const handleReset = () => {
    setState({ phase: 'input' });
    setInput('');
    setInputError(null);
  };

  // ─── Loading ───
  if (state.phase === 'loading') {
    return (
      <div className={cn('flex flex-col items-center justify-center gap-2 py-8', className)}>
        <div className="flex items-center gap-3">
          <Loader2 className="text-accent h-5 w-5 animate-spin" />
          <span className="text-foreground text-sm font-medium">{state.message}</span>
        </div>
        <p className="text-muted-foreground text-xs">
          Checking product sources and verifying what can be identified…
        </p>
      </div>
    );
  }

  // ─── Error ───
  if (state.phase === 'error') {
    return (
      <div className={cn('space-y-3', className)}>
        <div className="border-danger/30 bg-danger/5 text-danger flex items-center gap-2 rounded-lg border px-4 py-3 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {state.message}
        </div>
        <Button variant="ghost" size="sm" onClick={handleBack}>
          Try Again
        </Button>
      </div>
    );
  }

  // ─── Single item review ───
  if (state.phase === 'single') {
    return (
      <div className={cn('space-y-3', className)}>
        {state.status && <IdentificationBanner status={state.status} />}

        <div className="flex items-center justify-between gap-3">
          <h3 className="text-muted-foreground text-sm font-medium">Review &amp; add</h3>
          <Button variant="ghost" size="sm" onClick={handleBack}>
            ← Back
          </Button>
        </div>
        <ProductEditor
          draft={state.draft}
          wishlistId={wishlistId}
          mode="create"
          aiInfo={toAIInfo(state.status)}
          onSave={() => {
            handleReset();
            router.refresh();
          }}
          onCancel={handleBack}
        />
      </div>
    );
  }

  // ─── Batch review ───
  if (state.phase === 'batch') {
    return (
      <ImportBatchReview
        key={state.drafts.map((draft) => draft.url || draft.title).join('|')}
        drafts={state.drafts}
        statuses={state.statuses}
        wishlistId={wishlistId}
        wishlistTitle={wishlistTitle}
        categories={categories}
        existingItems={existingItems}
        onBack={handleBack}
        onDone={handleReset}
      />
    );
  }

  // ─── Input ───
  return (
    <form onSubmit={handleSubmit} className={cn('space-y-3', className)}>
      <Textarea
        value={input}
        onChange={(event) => {
          setInput(event.target.value);
          if (inputError) setInputError(null);
        }}
        placeholder={resolvedPlaceholder}
        rows={mode === 'text' ? 6 : 3}
        maxLength={maxLength}
        className="resize-none"
        aria-label={mode === 'url' ? 'Product URLs' : 'Products to import'}
        aria-invalid={inputError ? true : undefined}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            handleSubmit(event);
          }
        }}
      />

      {inputError ? (
        <p className="text-danger text-xs">{inputError}</p>
      ) : (
        <p className="text-muted-foreground text-xs">{resolvedHelper}</p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-muted-foreground text-[11px]">
          {input.length}/{maxLength} characters
        </span>
        <Button
          type="submit"
          size="sm"
          disabled={!input.trim() || input.trim().length < 2}
          className="gap-2"
        >
          {mode === 'url' ? <Search className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {submitLabel ?? (mode === 'url' ? 'Find product' : 'Detect products')}
        </Button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Identification status
// ─────────────────────────────────────────────────────────────────────────────

function IdentificationBanner({ status }: { status: ItemStatus }) {
  if (status.status === 'identified' && status.confidence >= 75) {
    return (
      <div className="border-success/20 bg-success/5 flex items-center gap-3 rounded-lg border px-4 py-2.5">
        <CheckCircle2 className="text-success h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{status.message}</p>
          <p className="text-muted-foreground text-xs">
            Source: {status.source} · Confidence: {status.confidence}%
          </p>
        </div>
      </div>
    );
  }

  if (status.status === 'identified' || status.status === 'needs-review') {
    return (
      <div className="border-warning/20 bg-warning/5 flex items-center gap-3 rounded-lg border px-4 py-2.5">
        <AlertTriangle className="text-warning h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{status.message}</p>
          <p className="text-muted-foreground text-xs">
            Please verify the product details below are correct.
            {status.confidence > 0 && ` Confidence: ${status.confidence}%.`}
          </p>
        </div>
      </div>
    );
  }

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
