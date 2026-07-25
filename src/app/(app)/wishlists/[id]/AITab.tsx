'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { CheckCircle2, Loader2, Sparkles, AlertCircle } from 'lucide-react';

import { ProductMatchResult, type ProductCandidateUI } from './ProductMatchResult';

interface AITabProps {
  wishlistId: string;
}

type Status = 'idle' | 'thinking' | 'searching' | 'done' | 'error';

const PLACEHOLDER = `Paste a product, URL, list, or describe what you need...

Try:
• "ASRock B760 motherboard"
• "Find a 2TB NVMe under $150"
• "7800X3D, 5070 Ti, 32GB DDR5"
• https://amazon.com/dp/B0...`;

/**
 * AI Product Getter tab — paste anything, natural language, multi-product support.
 */
export function AITab({ wishlistId }: AITabProps) {
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [candidates, setCandidates] = useState<ProductCandidateUI[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const handleSubmit = async () => {
    if (!input.trim() || status === 'thinking' || status === 'searching') return;

    setStatus('thinking');
    setStatusMessage('Understanding your request...');
    setCandidates([]);
    setError(null);

    try {
      // Determine input type
      const trimmed = input.trim();
      let type: string;
      let payload: Record<string, unknown>;

      if (isUrl(trimmed)) {
        type = 'url';
        payload = { type: 'url', url: trimmed };
        setStatusMessage('Fetching product page...');
      } else {
        type = 'text';
        payload = { type: 'text', text: trimmed };
      }

      setStatus('searching');
      if (type === 'text') setStatusMessage('Identifying products...');

      const res = await fetch('/api/products/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!data.success && data.error) {
        setStatus('error');
        setError(data.error);
        return;
      }

      if (!data.candidates || data.candidates.length === 0) {
        setStatus('error');
        setError(data.error || 'No products found. Try a more specific product name or paste a URL.');
        return;
      }

      setCandidates(data.candidates);
      setStatus('done');
      setStatusMessage(`Found ${data.candidates.length} product${data.candidates.length !== 1 ? 's' : ''}`);
    } catch {
      setStatus('error');
      setError('Failed to connect to DerList. Please try again.');
    }
  };

  const handleUse = async (candidate: ProductCandidateUI, starPriority: number) => {
    const key = candidate.productId || candidate.title;
    setAddingId(key);

    try {
      // If the candidate has a productId, use the existing add-to-wishlist flow
      if (candidate.productId) {
        const fd = new FormData();
        fd.set('wishlistId', wishlistId);
        fd.set('productId', candidate.productId);

        const res = await fetch('/api/products/identify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'manual',
            data: { title: candidate.title },
          }),
        });
        // Actually add via the existing action
        const addRes = await fetch(`/wishlists/${wishlistId}`, { method: 'GET' });
        // Use a simpler approach: call the add existing product action
        const response = await fetch('/api/products/identify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'search', query: candidate.title }),
        });
      }

      // For now, directly create via the product-actions confirmImport approach
      // We'll use a dedicated add endpoint
      const addPayload = {
        wishlistId,
        productId: candidate.productId,
        title: candidate.title,
        url: candidate.url,
        image: candidate.image,
        brand: candidate.brand,
        retailer: candidate.retailer,
        currentPrice: candidate.currentPrice,
        currency: candidate.currency,
        category: candidate.category,
        starPriority,
        description: candidate.description,
      };

      const res = await fetch('/api/wishlists/add-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addPayload),
      });

      if (res.ok) {
        setAddedIds((prev) => new Set(prev).add(key));
      }
    } catch {
      // silent fail — UI still shows the candidate
    } finally {
      setAddingId(null);
    }
  };

  const handleEdit = (candidate: ProductCandidateUI) => {
    // Switch to manual mode is handled by parent — for now just set input to title
    setInput(candidate.title);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Input area */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-foreground">
          What are you looking for?
        </label>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={PLACEHOLDER}
          rows={4}
          className="text-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={!input.trim() || status === 'thinking' || status === 'searching'}
            onClick={handleSubmit}
            className="gap-2"
          >
            {status === 'thinking' || status === 'searching' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {status === 'thinking' || status === 'searching' ? 'Working...' : 'Find Product'}
          </Button>
          <span className="text-[11px] text-muted-foreground">
            Ctrl+Enter to submit
          </span>
        </div>
      </div>

      {/* Status indicator */}
      {status !== 'idle' && status !== 'done' && status !== 'error' && (
        <div className="flex items-center gap-2 rounded-lg border border-accent/20 bg-accent/5 px-3 py-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
          <span className="text-xs text-accent">{statusMessage}</span>
        </div>
      )}

      {/* Success status */}
      {status === 'done' && (
        <div className="flex items-center gap-2 rounded-lg border border-success/20 bg-success/5 px-3 py-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
          <span className="text-xs text-success">{statusMessage}</span>
        </div>
      )}

      {/* Error */}
      {status === 'error' && error && (
        <div className="flex items-start gap-2 rounded-lg border border-danger/20 bg-danger/5 px-3 py-2.5">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />
          <div className="flex flex-col gap-1">
            <span className="text-xs text-danger">{error}</span>
            <span className="text-[11px] text-muted-foreground">
              Try a more specific product name, paste a URL, or use the Manual tab.
            </span>
          </div>
        </div>
      )}

      {/* Results */}
      {candidates.length > 0 && (
        <div className="flex flex-col gap-3">
          {candidates.map((candidate, i) => {
            const key = candidate.productId || `${candidate.title}-${i}`;
            const isAdded = addedIds.has(candidate.productId || candidate.title);

            if (isAdded) {
              return (
                <div key={key} className="flex items-center gap-2 rounded-lg border border-success/20 bg-success/5 px-4 py-3">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span className="text-sm text-foreground">Added "{candidate.title}" to wishlist</span>
                </div>
              );
            }

            return (
              <ProductMatchResult
                key={key}
                candidate={candidate}
                onUse={handleUse}
                onEdit={handleEdit}
                loading={addingId === (candidate.productId || candidate.title)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function isUrl(text: string): boolean {
  try {
    const url = new URL(text);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
