'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CheckCircle2, Loader2, Package, Search, Sparkles } from 'lucide-react';

import { addExistingProductAction } from './product-actions';

interface SearchResult {
  id: string;
  title: string;
  brand: string | null;
  retailer: string | null;
  image: string | null;
  price: number | null;
  currency: string;
  inStock: boolean | null;
  url: string | null;
  domain: string | null;
}

interface SearchTabProps {
  wishlistId: string;
}

/** Heuristic: does the query look like natural language rather than a product name? */
function isNaturalLanguage(q: string): boolean {
  const nlWords = ['find', 'need', 'want', 'looking', 'under', 'over', 'less than', 'more than', 'best', 'cheap', 'for my', 'with', 'without', 'compatible', 'alternative', 'like', 'similar'];
  const lower = q.toLowerCase();
  return nlWords.some((w) => lower.includes(w)) || q.split(/\s+/).length > 5;
}

export function SearchTab({ wishlistId }: SearchTabProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isPending, startTransition] = useTransition();
  const [addedId, setAddedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiMode, setAiMode] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search
  const doSearch = useCallback((q: string) => {
    if (q.length < 2) {
      setResults([]);
      setAiMode(false);
      return;
    }

    startTransition(async () => {
      try {
        // If it looks like natural language, use the AI-powered identify endpoint
        if (isNaturalLanguage(q)) {
          setAiMode(true);
          const res = await fetch('/api/products/identify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'text', text: q }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.candidates && data.candidates.length > 0) {
              // Convert candidates to SearchResult format
              setResults(data.candidates.map((c: Record<string, unknown>) => ({
                id: (c.productId as string) || `ai-${(c.title as string)?.slice(0, 20)}`,
                title: c.title as string,
                brand: c.brand as string | null,
                retailer: c.retailer as string | null,
                image: c.image as string | null,
                price: c.currentPrice as number | null,
                currency: (c.currency as string) || 'USD',
                inStock: null,
                url: c.url as string | null,
                domain: null,
                _productId: c.productId as string | null,
                _confidence: c.confidence as number,
                _verified: c.verified as boolean,
              })));
              return;
            }
          }
          // Fallback to standard search if AI finds nothing
        }

        setAiMode(false);
        const res = await fetch(`/api/products/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results ?? []);
        }
      } catch { /* ignore */ }
    });
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch]);

  const handleAdd = async (product: SearchResult) => {
    setError(null);
    const productId = (product as unknown as { _productId?: string })._productId || product.id;

    // If it's an AI result without a real productId, use the add-item API
    if (productId.startsWith('ai-') || !productId) {
      try {
        const res = await fetch('/api/wishlists/add-item', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wishlistId,
            title: product.title,
            brand: product.brand,
            retailer: product.retailer,
            image: product.image,
            currentPrice: product.price,
            currency: product.currency,
            url: product.url,
          }),
        });
        if (res.ok) {
          setAddedId(product.id);
        } else {
          const data = await res.json();
          setError(data.error || 'Failed to add product.');
        }
      } catch {
        setError('Failed to add product.');
      }
      return;
    }

    // Standard flow for existing products
    const formData = new FormData();
    formData.set('wishlistId', wishlistId);
    formData.set('productId', productId);
    const result = await addExistingProductAction({ success: false }, formData);
    if (result.success) {
      setAddedId(product.id);
    } else {
      setError(result.error ?? 'Failed to add product.');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="search-products" className="text-sm font-medium text-foreground">
          Search Products
        </label>
        <p className="text-xs text-muted-foreground">
          Search by name, brand, or describe what you need — AI will interpret natural language requests.
        </p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            id="search-products"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setAddedId(null); setError(null); }}
            placeholder='e.g. "ASRock B760" or "motherboard for i7-12700KF under $150"'
            className="pl-9"
            autoComplete="off"
          />
          {isPending && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
        {aiMode && !isPending && results.length > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] text-accent">
            <Sparkles className="h-3 w-3" />
            AI-interpreted search results
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
          {error}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-2">
          {results.map((product) => {
            const confidence = (product as unknown as { _confidence?: number })._confidence;
            const verified = (product as unknown as { _verified?: boolean })._verified;

            return (
              <div
                key={product.id}
                className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-card-hover"
              >
                {/* Image */}
                {product.image ? (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/5">
                    <img src={product.image} alt="" className="h-full w-full object-contain" loading="lazy" />
                  </span>
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-card text-muted-foreground">
                    <Package className="h-4 w-4" />
                  </span>
                )}

                {/* Info */}
                <div className="flex-1 overflow-hidden">
                  <span className="block truncate text-sm font-medium text-foreground">{product.title}</span>
                  <div className="flex items-center gap-2">
                    {product.retailer && (
                      <span className="text-[10px] text-muted-foreground">{product.retailer}</span>
                    )}
                    {product.brand && (
                      <span className="text-[10px] text-muted-foreground">· {product.brand}</span>
                    )}
                    {confidence != null && (
                      <Badge variant={verified ? 'success' : 'warning'} className="text-[8px]">
                        {confidence}%
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Price */}
                {product.price != null && (
                  <span className="shrink-0 text-xs font-semibold text-foreground">
                    ${product.price.toFixed(2)}
                  </span>
                )}

                {/* Add button */}
                {addedId === product.id ? (
                  <Badge variant="success" className="shrink-0 gap-1 text-[10px]">
                    <CheckCircle2 className="h-3 w-3" /> Added
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    className="h-7 shrink-0 text-[11px]"
                    onClick={() => handleAdd(product)}
                  >
                    Add
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {query.length >= 2 && !isPending && results.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <Search className="h-6 w-6 text-muted/30" />
          <p className="text-xs text-muted-foreground">No products found. Try the AI tab or import via URL.</p>
        </div>
      )}
    </div>
  );
}
