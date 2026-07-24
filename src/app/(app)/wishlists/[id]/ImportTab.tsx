'use client';

import { useActionState } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CheckCircle2, Loader2, Package } from 'lucide-react';

import type { ActionState } from '../../../(auth)/actions';
import {
  confirmImportAction,
  fetchImportPreviewAction,
  type ImportPreviewState,
} from './product-actions';

const initialPreviewState: ImportPreviewState = { success: false };
const initialConfirmState: ActionState = { success: false };

interface ImportTabProps {
  wishlistId: string;
}

export function ImportTab({ wishlistId }: ImportTabProps) {
  const [previewState, fetchPreview, fetching] = useActionState(fetchImportPreviewAction, initialPreviewState);
  const [confirmState, confirmImport, confirming] = useActionState(confirmImportAction, initialConfirmState);

  // Show success
  if (confirmState.success) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/5 px-4 py-4">
        <CheckCircle2 className="h-5 w-5 text-success" />
        <div>
          <p className="text-sm font-medium text-foreground">Product imported successfully!</p>
          <p className="text-xs text-muted-foreground">The item has been added to your wishlist.</p>
        </div>
        <Button asChild size="sm" variant="ghost" className="ml-auto">
          <a href={`/wishlists/${wishlistId}?add=true`}>Import Another</a>
        </Button>
      </div>
    );
  }

  // Show preview if fetched
  if (previewState.success && previewState.preview) {
    const p = previewState.preview;
    return (
      <div className="flex flex-col gap-5">
        <h3 className="text-sm font-medium text-foreground">Import Preview</h3>

        {/* Preview card */}
        <div className="flex gap-4 rounded-xl border border-border bg-surface p-4">
          {p.image ? (
            <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-card">
              <img src={p.image} alt="" className="h-full w-full object-cover" />
            </span>
          ) : (
            <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-card text-muted-foreground">
              <Package className="h-8 w-8" />
            </span>
          )}
          <div className="flex flex-1 flex-col gap-1.5 overflow-hidden">
            <span className="truncate text-sm font-semibold text-foreground">{p.title}</span>
            {p.brand && <span className="text-xs text-muted-foreground">{p.brand}</span>}
            <div className="flex items-center gap-2">
              {p.currentPrice != null && (
                <span className="text-sm font-medium text-foreground">
                  {p.currency} {p.currentPrice.toFixed(2)}
                </span>
              )}
              {p.retailer && (
                <Badge variant="secondary" className="text-[10px]">{p.retailer}</Badge>
              )}
              {p.inStock != null && (
                <Badge variant={p.inStock ? 'success' : 'danger'} className="text-[10px]">
                  {p.inStock ? 'In Stock' : 'Out of Stock'}
                </Badge>
              )}
            </div>
            {p.description && (
              <p className="line-clamp-2 text-xs text-muted-foreground">{p.description}</p>
            )}
          </div>
        </div>

        {/* Extraction confidence */}
        <div className="flex items-center gap-2">
          <ConfidenceBadge confidence={p.confidence} />
          <span className="text-[11px] text-muted-foreground">
            via {p.priceSource}
          </span>
          {p.needsReview && (
            <Badge variant="warning" className="text-[9px]">Needs Review</Badge>
          )}
        </div>

        {/* Price candidates (show if multiple exist and not 100% confident) */}
        {p.priceCandidates.length > 1 && p.confidence < 95 && (
          <details className="rounded-lg border border-border bg-surface p-3">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
              {p.priceCandidates.length} price candidates detected
            </summary>
            <div className="mt-2 space-y-1.5">
              {p.priceCandidates.map((candidate, i) => (
                <div key={i} className="flex items-center justify-between rounded-md bg-card px-3 py-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold ${candidate.confidence >= 80 ? 'text-foreground' : 'text-muted-foreground'}`}>
                      ${candidate.price.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{candidate.method}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">{candidate.reason}</span>
                    <ConfidenceDot confidence={candidate.confidence} />
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* Confirm form */}
        <form action={confirmImport} className="flex flex-col gap-3">
          <input type="hidden" name="wishlistId" value={wishlistId} />
          <input type="hidden" name="canonicalUrl" value={p.canonicalUrl} />
          <input type="hidden" name="normalizedUrl" value={p.normalizedUrl} />
          <input type="hidden" name="domain" value={p.domain ?? ''} />
          <input type="hidden" name="retailer" value={p.retailer ?? ''} />
          <input type="hidden" name="title" value={p.title} />
          <input type="hidden" name="description" value={p.description ?? ''} />
          <input type="hidden" name="brand" value={p.brand ?? ''} />
          <input type="hidden" name="sku" value={p.sku ?? ''} />
          <input type="hidden" name="mpn" value={p.mpn ?? ''} />
          <input type="hidden" name="gtin" value={p.gtin ?? ''} />
          <input type="hidden" name="image" value={p.image ?? ''} />
          <input type="hidden" name="gallery" value={JSON.stringify(p.gallery)} />
          <input type="hidden" name="currentPrice" value={p.currentPrice?.toString() ?? ''} />
          <input type="hidden" name="currency" value={p.currency} />
          <input type="hidden" name="inStock" value={p.inStock?.toString() ?? ''} />
          <input type="hidden" name="availability" value={p.availability ?? ''} />

          {confirmState.error && (
            <p className="text-xs text-danger">{confirmState.error}</p>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={confirming} size="sm" className="gap-2">
              {confirming && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
              {confirming ? 'Adding...' : 'Add to Wishlist'}
            </Button>
            <Button asChild variant="ghost" size="sm">
              <a href={`/wishlists/${wishlistId}?add=true`}>Cancel</a>
            </Button>
          </div>
        </form>
      </div>
    );
  }

  // URL input form
  return (
    <form action={fetchPreview} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="import-url" className="text-sm font-medium text-foreground">
          Product URL
        </label>
        <p className="text-xs text-muted-foreground">
          Paste a product link from any store — DerList will automatically import the details.
        </p>
        <Input
          id="import-url"
          name="url"
          type="url"
          required
          placeholder="https://www.amazon.com/dp/B0..."
          autoComplete="off"
        />
        {previewState.fieldErrors?.url && (
          <p className="text-xs text-danger">{previewState.fieldErrors.url[0]}</p>
        )}
        {previewState.error && (
          <p className="text-xs text-danger">{previewState.error}</p>
        )}
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={fetching} size="sm" className="gap-2">
          {fetching && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
          {fetching ? 'Importing...' : 'Import'}
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Works with any store that uses standard metadata (OpenGraph, JSON-LD, Schema.org).
      </p>
    </form>
  );
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const color = confidence >= 90 ? 'text-success' : confidence >= 70 ? 'text-warning' : 'text-danger';
  const bg = confidence >= 90 ? 'bg-success/10' : confidence >= 70 ? 'bg-warning/10' : 'bg-danger/10';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${color} ${bg}`}>
      {confidence}% confidence
    </span>
  );
}

function ConfidenceDot({ confidence }: { confidence: number }) {
  const color = confidence >= 80 ? 'bg-success' : confidence >= 50 ? 'bg-warning' : 'bg-danger';
  return <span className={`h-1.5 w-1.5 rounded-full ${color}`} title={`${confidence}%`} />;
}
