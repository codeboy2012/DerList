'use client';

/**
 * ImportBatchReview — shared review step for batch imports.
 *
 * Every batch importer (URLs, pasted text, PCPartPicker builds) normalizes to
 * ProductDraft[] and lands here before anything is written to a wishlist.
 * Users can inspect source/confidence, correct fields, exclude duplicates and
 * remove unwanted rows. Saving still goes through the existing
 * /api/wishlists/import route, so enrichment and ownership checks are unchanged.
 */
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Loader2,
  Trash2,
  XCircle,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ImportReviewDraft {
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

export interface ImportReviewStatus {
  index: number;
  status: 'identified' | 'needs-review' | 'failed' | 'no-ai-configured' | 'conflict';
  confidence: number;
  source: string;
  message: string;
}

export interface ExistingImportItem {
  title: string;
  url: string | null;
}

interface ReviewItem {
  key: string;
  sourceIndex: number;
  selected: boolean;
  editing: boolean;
  draft: ImportReviewDraft;
}

interface ImportSummary {
  added: number;
  deduplicated: number;
  failed: number;
  errors: string[];
}

interface ImportBatchReviewProps {
  drafts: ImportReviewDraft[];
  statuses?: ImportReviewStatus[];
  wishlistId: string;
  wishlistTitle: string;
  categories: string[];
  existingItems: ExistingImportItem[];
  onBack: () => void;
  onDone?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function normalizeUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return `${parsed.hostname.toLowerCase()}${parsed.pathname.replace(/\/+$/, '')}`.toLowerCase();
  } catch {
    return null;
  }
}

function isSameProduct(a: ImportReviewDraft, b: ImportReviewDraft): boolean {
  const aUrl = normalizeUrl(a.url);
  const bUrl = normalizeUrl(b.url);
  if (aUrl && bUrl && aUrl === bUrl) return true;

  const aTitle = a.title.trim().toLowerCase();
  const bTitle = b.title.trim().toLowerCase();
  return aTitle.length >= 5 && aTitle === bTitle;
}

function isDuplicate(draft: ImportReviewDraft, existingItems: ExistingImportItem[]): boolean {
  const draftUrl = normalizeUrl(draft.url);
  const draftTitle = draft.title.trim().toLowerCase();

  return existingItems.some((item) => {
    if (draftUrl && normalizeUrl(item.url) === draftUrl) return true;
    return draftTitle.length >= 5 && item.title.trim().toLowerCase() === draftTitle;
  });
}

function statusMeta(status?: ImportReviewStatus): {
  label: string;
  variant: 'success' | 'warning' | 'danger' | 'secondary';
} {
  if (!status) return { label: 'Unreviewed', variant: 'secondary' };
  if (status.status === 'identified' && status.confidence >= 75) {
    return { label: 'Identified', variant: 'success' };
  }
  if (status.status === 'identified' || status.status === 'needs-review') {
    return { label: 'Review needed', variant: 'warning' };
  }
  if (status.status === 'no-ai-configured') {
    return { label: 'Manual details needed', variant: 'warning' };
  }
  if (status.status === 'conflict') return { label: 'Identity conflict', variant: 'danger' };
  return { label: 'Manual details needed', variant: 'danger' };
}

function priceLabel(draft: ImportReviewDraft): string | null {
  if (draft.currentPrice == null || Number.isNaN(draft.currentPrice)) return null;
  return `${draft.currency || 'USD'} ${draft.currentPrice.toFixed(2)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function ImportBatchReview({
  drafts,
  statuses = [],
  wishlistId,
  wishlistTitle,
  categories,
  existingItems,
  onBack,
  onDone,
}: ImportBatchReviewProps) {
  const router = useRouter();
  const [items, setItems] = useState<ReviewItem[]>(() => {
    const seen: ImportReviewDraft[] = [];
    return drafts.map((draft, index) => {
      // Exclude products already in the wishlist, and repeated products inside
      // this same batch, so nothing is added twice without an explicit choice.
      const duplicate =
        isDuplicate(draft, existingItems) || seen.some((entry) => isSameProduct(entry, draft));
      if (!duplicate) seen.push(draft);
      return {
        key: `import-${index}`,
        sourceIndex: index,
        selected: !duplicate,
        editing: false,
        draft: { ...draft },
      };
    });
  });
  const [destinationCategory, setDestinationCategory] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const selectedItems = items.filter((item) => item.selected);
  const missingNameCount = selectedItems.filter((item) => !item.draft.title.trim()).length;
  const canImport = selectedItems.length > 0 && missingNameCount === 0 && !isImporting;
  const duplicateCount = items.filter(
    (item, index) =>
      isDuplicate(item.draft, existingItems) ||
      items.slice(0, index).some((previous) => isSameProduct(previous.draft, item.draft))
  ).length;

  const updateDraft = (key: string, patch: Partial<ImportReviewDraft>) => {
    setItems((current) =>
      current.map((item) =>
        item.key === key ? { ...item, draft: { ...item.draft, ...patch } } : item
      )
    );
  };

  const handleImport = async () => {
    if (!canImport) return;

    setIsImporting(true);
    setSummary(null);

    let added = 0;
    let deduplicated = 0;
    let failed = 0;
    const errors: string[] = [];

    // Keep concurrency low; this mirrors the previous three-at-a-time import.
    for (let i = 0; i < selectedItems.length; i += 3) {
      const batch = selectedItems.slice(i, i + 3);
      await Promise.all(
        batch.map(async (item) => {
          try {
            const response = await fetch('/api/wishlists/import', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                wishlistId,
                title: item.draft.title.trim(),
                description: item.draft.description,
                url: item.draft.url,
                image: item.draft.image,
                brand: item.draft.brand,
                retailer: item.draft.retailer,
                price: item.draft.currentPrice,
                originalPrice: item.draft.originalPrice,
                currency: item.draft.currency,
                category: destinationCategory.trim() || item.draft.category,
              }),
            });

            const data = (await response.json().catch(() => null)) as {
              success?: boolean;
              deduplicated?: boolean;
              error?: string;
            } | null;

            if (response.ok && data?.success) {
              if (data.deduplicated) deduplicated += 1;
              else added += 1;
            } else {
              failed += 1;
              if (errors.length < 3) {
                errors.push(
                  `${item.draft.title || 'Untitled item'}: ${data?.error || 'Import failed.'}`
                );
              }
            }
          } catch {
            failed += 1;
            if (errors.length < 3) {
              errors.push(`${item.draft.title || 'Untitled item'}: Network error.`);
            }
          }
        })
      );
    }

    setSummary({ added, deduplicated, failed, errors });
    setIsImporting(false);
    router.refresh();
  };

  if (summary) {
    return (
      <div className="space-y-4">
        <div className="border-border bg-card rounded-xl border p-5">
          <div className="flex items-start gap-3">
            {summary.failed > 0 ? (
              <AlertTriangle className="text-warning mt-0.5 h-5 w-5 shrink-0" />
            ) : (
              <CheckCircle2 className="text-success mt-0.5 h-5 w-5 shrink-0" />
            )}
            <div className="min-w-0">
              <h3 className="text-foreground text-sm font-medium">Import finished</h3>
              <p className="text-muted-foreground mt-1 text-xs">
                {summary.added} added
                {summary.deduplicated > 0 ? ` · ${summary.deduplicated} already present` : ''}
                {summary.failed > 0 ? ` · ${summary.failed} failed` : ''}
              </p>
            </div>
          </div>

          {summary.errors.length > 0 && (
            <ul className="text-danger mt-3 space-y-1 text-xs">
              {summary.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" onClick={onDone ?? onBack}>
              Done
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSummary(null);
                router.refresh();
              }}
            >
              Review again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-foreground text-sm font-medium">
            Review {items.length} detected {items.length === 1 ? 'product' : 'products'}
          </h3>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Adding to <span className="text-foreground font-medium">{wishlistTitle}</span>. Nothing
            is saved until you confirm.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onBack}>
          ← Back
        </Button>
      </div>

      <div className="border-border bg-surface/50 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border px-3 py-2 text-xs">
        <span className="text-foreground font-medium">
          {selectedItems.length} selected of {items.length}
        </span>
        {duplicateCount > 0 && (
          <span className="text-warning flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            {duplicateCount} possible {duplicateCount === 1 ? 'duplicate' : 'duplicates'}
          </span>
        )}
        {missingNameCount > 0 && (
          <span className="text-warning flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            {missingNameCount} selected {missingNameCount === 1 ? 'item needs' : 'items need'} a
            product name
          </span>
        )}
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground ml-auto underline-offset-4 hover:underline"
          onClick={() =>
            setItems((current) => current.map((item) => ({ ...item, selected: true })))
          }
        >
          Select all
        </button>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
          onClick={() =>
            setItems((current) => current.map((item) => ({ ...item, selected: false })))
          }
        >
          Clear
        </button>
      </div>

      <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
        {items.map((item, index) => {
          const status = statuses.find((entry) => entry.index === item.sourceIndex);
          const meta = statusMeta(status);
          const duplicate = isDuplicate(item.draft, existingItems);
          const duplicateInBatch = items
            .slice(0, index)
            .some((previous) => isSameProduct(previous.draft, item.draft));
          const price = priceLabel(item.draft);

          return (
            <div
              key={item.key}
              className={cn(
                'border-border bg-card rounded-lg border p-3 transition-colors',
                !item.selected && 'opacity-60'
              )}
            >
              <div className="flex min-w-0 items-start gap-3">
                <input
                  type="checkbox"
                  checked={item.selected}
                  onChange={(event) =>
                    setItems((current) =>
                      current.map((entry) =>
                        entry.key === item.key
                          ? { ...entry, selected: event.target.checked }
                          : entry
                      )
                    )
                  }
                  aria-label={`Include ${item.draft.title || 'product'}`}
                  className="mt-1 h-4 w-4 shrink-0"
                />

                {item.draft.image ? (
                  <img
                    src={item.draft.image}
                    alt=""
                    className="border-border h-12 w-12 shrink-0 rounded border object-cover"
                  />
                ) : (
                  <div className="bg-surface border-border flex h-12 w-12 shrink-0 items-center justify-center rounded border">
                    <ImageIcon className="text-muted-foreground h-4 w-4" aria-hidden />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="text-foreground min-w-0 flex-1 truncate text-sm font-medium">
                      {item.draft.title || 'Untitled product'}
                    </p>
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                    {duplicate && <Badge variant="warning">Already in wishlist</Badge>}
                    {duplicateInBatch && <Badge variant="warning">Repeated in batch</Badge>}
                  </div>

                  <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    {item.draft.brand && <span>{item.draft.brand}</span>}
                    {item.draft.retailer && <span>· {item.draft.retailer}</span>}
                    {price && <span className="text-foreground font-medium">{price}</span>}
                    {status && (
                      <span className="w-full sm:w-auto">
                        Source: {status.source} · {status.confidence}% confidence
                      </span>
                    )}
                  </div>

                  {(duplicate || duplicateInBatch) && (
                    <p className="text-warning mt-1 text-[11px]">
                      {duplicate
                        ? 'A product with this title or URL is already in this wishlist.'
                        : 'This product appears more than once in the detected batch.'}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() =>
                      setItems((current) =>
                        current.map((entry) =>
                          entry.key === item.key ? { ...entry, editing: !entry.editing } : entry
                        )
                      )
                    }
                    aria-expanded={item.editing}
                  >
                    {item.editing ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-danger h-7 px-2"
                    onClick={() =>
                      setItems((current) => current.filter((entry) => entry.key !== item.key))
                    }
                    aria-label={`Remove ${item.draft.title || 'product'}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {item.editing && (
                <div className="border-border mt-3 grid gap-3 border-t pt-3 sm:grid-cols-2">
                  <ReviewField label="Product name">
                    <Input
                      value={item.draft.title}
                      onChange={(event) => updateDraft(item.key, { title: event.target.value })}
                    />
                  </ReviewField>
                  <ReviewField label="Brand">
                    <Input
                      value={item.draft.brand ?? ''}
                      onChange={(event) => updateDraft(item.key, { brand: event.target.value })}
                    />
                  </ReviewField>
                  <ReviewField label="Retailer">
                    <Input
                      value={item.draft.retailer ?? ''}
                      onChange={(event) => updateDraft(item.key, { retailer: event.target.value })}
                    />
                  </ReviewField>
                  <ReviewField label="Category">
                    <Input
                      value={item.draft.category ?? ''}
                      onChange={(event) => updateDraft(item.key, { category: event.target.value })}
                      placeholder="Optional"
                    />
                  </ReviewField>
                  <ReviewField label="Price">
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.draft.currentPrice ?? ''}
                        onChange={(event) =>
                          updateDraft(item.key, {
                            currentPrice: event.target.value
                              ? Number(event.target.value)
                              : undefined,
                          })
                        }
                      />
                      <Input
                        value={item.draft.currency ?? 'USD'}
                        maxLength={3}
                        onChange={(event) =>
                          updateDraft(item.key, { currency: event.target.value })
                        }
                        className="w-20 shrink-0"
                        aria-label="Currency"
                      />
                    </div>
                  </ReviewField>
                  <ReviewField label="Image URL">
                    <Input
                      type="url"
                      value={item.draft.image ?? ''}
                      onChange={(event) => updateDraft(item.key, { image: event.target.value })}
                      placeholder="https://"
                    />
                  </ReviewField>
                  <ReviewField label="Product URL" className="sm:col-span-2">
                    <Input
                      type="url"
                      value={item.draft.url ?? ''}
                      onChange={(event) => updateDraft(item.key, { url: event.target.value })}
                      placeholder="https://"
                    />
                  </ReviewField>
                  <ReviewField label="Description" className="sm:col-span-2">
                    <Textarea
                      rows={2}
                      value={item.draft.description ?? ''}
                      onChange={(event) =>
                        updateDraft(item.key, { description: event.target.value })
                      }
                    />
                  </ReviewField>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="border-border bg-surface/40 rounded-lg border p-3">
        <label
          htmlFor="import-destination-category"
          className="text-foreground text-xs font-medium"
        >
          Collection / folder for these items
        </label>
        <p className="text-muted-foreground mt-0.5 mb-2 text-[11px]">
          Optional. This groups the imported items inside {wishlistTitle}; it does not move them to
          another wishlist.
        </p>
        <Input
          id="import-destination-category"
          list="import-category-options"
          value={destinationCategory}
          onChange={(event) => setDestinationCategory(event.target.value)}
          placeholder="Uncategorized, or an existing/new collection name"
        />
        <datalist id="import-category-options">
          {categories.map((category) => (
            <option key={category} value={category} />
          ))}
        </datalist>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={handleImport} disabled={!canImport}>
          {isImporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          {isImporting
            ? 'Importing…'
            : `Import ${selectedItems.length} selected ${selectedItems.length === 1 ? 'item' : 'items'}`}
        </Button>
        <Button variant="ghost" onClick={onBack} disabled={isImporting}>
          Cancel
        </Button>
        {items.length === 0 && (
          <span className="text-muted-foreground flex items-center gap-1 text-xs">
            <XCircle className="h-3.5 w-3.5" />
            All detected items were removed.
          </span>
        )}
      </div>
    </div>
  );
}

function ReviewField({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <span className="text-foreground text-xs font-medium">{label}</span>
      {children}
    </div>
  );
}
