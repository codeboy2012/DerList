'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CheckCircle2, Loader2, Package, Search } from 'lucide-react';

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

export function SearchTab({ wishlistId }: SearchTabProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isPending, startTransition] = useTransition();
  const [addedId, setAddedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search
  const doSearch = useCallback((q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    startTransition(async () => {
      try {
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
    debounceRef.current = setTimeout(() => doSearch(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch]);

  const handleAdd = async (productId: string) => {
    setError(null);
    const formData = new FormData();
    formData.set('wishlistId', wishlistId);
    formData.set('productId', productId);
    const result = await addExistingProductAction({ success: false }, formData);
    if (result.success) {
      setAddedId(productId);
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
          Find products already in the DerList database — instantly add them without re-importing.
        </p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            id="search-products"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setAddedId(null); setError(null); }}
            placeholder="Search by name, brand, retailer..."
            className="pl-9"
            autoComplete="off"
          />
          {isPending && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
          {error}
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-2">
          {results.map((product) => (
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
                  onClick={() => handleAdd(product.id)}
                >
                  Add
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {query.length >= 2 && !isPending && results.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <Search className="h-6 w-6 text-muted/30" />
          <p className="text-xs text-muted-foreground">No products found. Try importing via URL instead.</p>
        </div>
      )}
    </div>
  );
}
