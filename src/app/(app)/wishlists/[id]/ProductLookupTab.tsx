'use client';

/**
 * Product Lookup tab — searches the configured external shopping provider and
 * lets the user pick a result into the normal ProductEditor review.
 *
 * This does not search other DerList accounts or the instance-wide product
 * table. Only the provider's public catalogue results are shown.
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AlertCircle, ArrowLeft, ExternalLink, Loader2, Package, Search, Star } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ProductEditor } from '@/components/product';
import type { ExistingImportItem } from '@/components/product/ImportBatchReview';

interface LookupResult {
  title: string;
  url: string;
  price: number | null;
  currency: string;
  image: string | null;
  retailer: string | null;
  rating: number | null;
  reviewCount: number | null;
  snippet: string | null;
  inStock: boolean | null;
}

interface LookupResponse {
  success: boolean;
  provider?: string;
  results?: LookupResult[];
  error?: string;
  code?: string;
}

interface ProductLookupTabProps {
  wishlistId: string;
  wishlistTitle: string;
  existingItems: ExistingImportItem[];
}

function normalizeUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return `${parsed.hostname.toLowerCase()}${parsed.pathname.replace(/\/+$/, '')}`.toLowerCase();
  } catch {
    return null;
  }
}

function isDuplicate(result: LookupResult, existingItems: ExistingImportItem[]): boolean {
  const resultUrl = normalizeUrl(result.url);
  const title = result.title.trim().toLowerCase();
  return existingItems.some((item) => {
    if (resultUrl && normalizeUrl(item.url) === resultUrl) return true;
    return title.length >= 5 && item.title.trim().toLowerCase() === title;
  });
}

export function ProductLookupTab({
  wishlistId,
  wishlistTitle,
  existingItems,
}: ProductLookupTabProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LookupResult[]>([]);
  const [provider, setProvider] = useState<string | null>(null);
  const [selected, setSelected] = useState<LookupResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length < 2) return;

    setIsLoading(true);
    setError(null);
    setSelected(null);
    setSearched(true);

    try {
      const response = await fetch(`/api/products/lookup?q=${encodeURIComponent(trimmed)}`);
      const data = (await response.json()) as LookupResponse;

      if (!response.ok || !data.success) {
        setResults([]);
        setProvider(null);
        setError(data.error || 'Product lookup failed. Try again.');
        return;
      }

      setResults(data.results ?? []);
      setProvider(data.provider ?? null);
    } catch {
      setResults([]);
      setError('Product lookup failed. Check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (selected) {
    const duplicate = isDuplicate(selected, existingItems);

    return (
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-foreground text-sm font-medium">Review selected product</h3>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Search result from {selected.retailer || provider || 'the search provider'}. Confirm
              the match before adding it to {wishlistTitle}.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to results
          </Button>
        </div>

        <div className="border-border bg-surface/50 flex items-start gap-2 rounded-lg border px-3 py-2.5">
          <AlertCircle className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p className="text-muted-foreground text-xs">
            Search results are not AI-verified. Review the name, retailer, price, and source URL.
          </p>
        </div>

        {duplicate && (
          <div className="border-warning/30 bg-warning/5 flex items-start gap-2 rounded-lg border px-3 py-2.5">
            <AlertCircle className="text-warning mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p className="text-warning text-xs">
              A product with this title or URL is already in this wishlist.
            </p>
          </div>
        )}

        <ProductEditor
          draft={{
            title: selected.title,
            url: selected.url,
            image: selected.image ?? undefined,
            brand: undefined,
            retailer: selected.retailer ?? undefined,
            currentPrice: selected.price ?? undefined,
            currency: selected.currency || 'USD',
            description: selected.snippet ?? undefined,
          }}
          wishlistId={wishlistId}
          mode="create"
          onSave={() => router.refresh()}
          onCancel={() => setSelected(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="space-y-3">
        <label htmlFor="product-lookup-query" className="text-foreground text-sm font-medium">
          Search for a product
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="product-lookup-query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="e.g. Keychron Q1 Pro, RTX 5070 Ti, Sony WH-1000XM6"
            autoComplete="off"
            className="flex-1"
          />
          <Button
            type="submit"
            disabled={isLoading || query.trim().length < 2}
            className="shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {isLoading ? 'Searching…' : 'Search'}
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          Uses your configured shopping search provider. It does not search other users&apos;
          wishlists.
        </p>
      </form>

      {error && (
        <div className="border-danger/30 bg-danger/5 rounded-lg border p-3">
          <div className="text-danger flex items-start gap-2 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <div className="mt-2 pl-6">
            <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs">
              <Link href="/settings/providers">Open provider settings</Link>
            </Button>
          </div>
        </div>
      )}

      {!error && searched && !isLoading && results.length === 0 && (
        <div className="border-border rounded-lg border border-dashed p-6 text-center">
          <Package className="text-muted-foreground/50 mx-auto h-7 w-7" />
          <p className="text-foreground mt-2 text-sm font-medium">No matching products</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Try a more specific model name, or switch to Product URL and paste the product page.
          </p>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-xs">
              {results.length} result{results.length === 1 ? '' : 's'}
              {provider ? ` from ${provider}` : ''}
            </p>
          </div>

          <div className="max-h-[26rem] space-y-2 overflow-y-auto pr-1">
            {results.map((result, index) => {
              const duplicate = isDuplicate(result, existingItems);
              return (
                <button
                  key={`${result.url}-${index}`}
                  type="button"
                  onClick={() => setSelected(result)}
                  className="border-border bg-card hover:border-accent/50 hover:bg-surface/60 flex w-full min-w-0 items-start gap-3 rounded-lg border p-3 text-left transition-colors"
                >
                  {result.image ? (
                    <img
                      src={result.image}
                      alt=""
                      className="border-border h-14 w-14 shrink-0 rounded border object-cover"
                    />
                  ) : (
                    <div className="bg-surface border-border flex h-14 w-14 shrink-0 items-center justify-center rounded border">
                      <Package className="text-muted-foreground h-5 w-5" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-foreground min-w-0 flex-1 truncate text-sm font-medium">
                        {result.title}
                      </p>
                      {duplicate && <Badge variant="warning">Possible duplicate</Badge>}
                    </div>

                    <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                      {result.retailer && <span>{result.retailer}</span>}
                      {result.price != null && (
                        <span className="text-foreground font-medium">
                          {result.currency || 'USD'} {result.price.toFixed(2)}
                        </span>
                      )}
                      {result.inStock === false && (
                        <span className="text-danger">Out of stock</span>
                      )}
                      {result.inStock === true && <span className="text-success">In stock</span>}
                      {result.rating != null && (
                        <span className="flex items-center gap-0.5">
                          <Star className="h-3 w-3 fill-current" />
                          {result.rating.toFixed(1)}
                          {result.reviewCount != null && ` (${result.reviewCount})`}
                        </span>
                      )}
                    </div>

                    {result.snippet && (
                      <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                        {result.snippet}
                      </p>
                    )}
                  </div>

                  <ExternalLink className="text-muted-foreground mt-1 h-3.5 w-3.5 shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
