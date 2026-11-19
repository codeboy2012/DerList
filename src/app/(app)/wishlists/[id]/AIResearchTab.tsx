'use client';

/**
 * AI Research tab — source-backed product research with a separate AI summary.
 *
 * The existing /api/products/research route fetches retailer metadata first and
 * only then optionally asks the configured AI provider to normalize it. This UI
 * keeps those two layers visually separate so inferred content is never shown
 * as verified retailer data.
 */
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Search,
  Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ProductEditor } from '@/components/product';

interface ResearchField {
  value: string;
  confidence: number;
  source: string;
}

interface NumberResearchField {
  value: number;
  confidence: number;
  source: string;
}

interface ResearchRetailer {
  name: string;
  url: string;
  price: NumberResearchField | null;
  salePrice: NumberResearchField | null;
  availability: ResearchField;
  shipping: string | null;
  image: string | null;
  lastChecked: string;
}

interface AIEnrichment {
  description?: string;
  shortDescription?: string;
  buyingAdvice?: string;
  pros?: string[];
  cons?: string[];
  model?: string;
}

interface ResearchResult {
  title: ResearchField | null;
  brand: ResearchField | null;
  model: ResearchField | null;
  sku: ResearchField | null;
  upc: ResearchField | null;
  mpn: ResearchField | null;
  asin: ResearchField | null;
  description: ResearchField | null;
  category: ResearchField | null;
  currentPrice: NumberResearchField | null;
  msrp: NumberResearchField | null;
  availability: ResearchField | null;
  primaryImage: ResearchField | null;
  retailers: ResearchRetailer[];
  specifications: Array<{ key: string; value: string; unit?: string; source: string }>;
  aiEnrichment: AIEnrichment | null;
  sourcesChecked: string[];
  researchedAt: string;
  cached: boolean;
}

interface ResearchResponse {
  success: boolean;
  research?: ResearchResult;
  error?: string;
}

interface AIResearchTabProps {
  wishlistId: string;
  wishlistTitle: string;
  onSwitchTab: (tab: 'url' | 'manual') => void;
}

function formatField(field: ResearchField | NumberResearchField | null): string | null {
  if (!field) return null;
  return typeof field.value === 'number' ? field.value.toFixed(2) : field.value;
}

function sourceLabel(source: string): string {
  if (source === 'user') return 'Your input';
  return source;
}

export function AIResearchTab({ wishlistId, wishlistTitle, onSwitchTab }: AIResearchTabProps) {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [research, setResearch] = useState<ResearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleResearch = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (trimmed.length < 2) return;

    setIsLoading(true);
    setError(null);
    setResearch(null);

    const isUrl = /^https?:\/\//i.test(trimmed);

    try {
      const response = await fetch('/api/products/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isUrl ? { url: trimmed } : { title: trimmed }),
      });
      const data = (await response.json()) as ResearchResponse;

      if (!response.ok || !data.success || !data.research) {
        setError(
          data.error ||
            'Research is unavailable right now. Check your AI/provider settings and try again.'
        );
        return;
      }

      setResearch(data.research);
    } catch {
      setError('Research failed. Check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (research) {
    const fields = [
      { label: 'Product name', field: research.title },
      { label: 'Brand', field: research.brand },
      { label: 'Model', field: research.model },
      { label: 'Category', field: research.category },
      { label: 'Current price', field: research.currentPrice },
      { label: 'MSRP', field: research.msrp },
      { label: 'Availability', field: research.availability },
      { label: 'SKU', field: research.sku },
      { label: 'UPC', field: research.upc },
      { label: 'MPN', field: research.mpn },
      { label: 'ASIN', field: research.asin },
    ].filter((entry) => entry.field != null);

    const sourceTitle = research.title?.value;
    const hasAISummary = Boolean(
      research.aiEnrichment &&
      (research.aiEnrichment.shortDescription ||
        research.aiEnrichment.description ||
        research.aiEnrichment.buyingAdvice ||
        (research.aiEnrichment.pros?.length ?? 0) > 0 ||
        (research.aiEnrichment.cons?.length ?? 0) > 0)
    );
    const draft = sourceTitle
      ? {
          title: sourceTitle,
          description: research.description?.value,
          image: research.primaryImage?.value,
          brand: research.brand?.value,
          retailer: research.retailers[0]?.name,
          currentPrice: research.currentPrice?.value,
          originalPrice: research.msrp?.value,
          url:
            research.retailers[0]?.url ??
            (research.title?.source !== 'user' && /^https?:\/\//i.test(input.trim())
              ? input.trim()
              : undefined),
          category: research.category?.value,
          sku: research.sku?.value,
          asin: research.asin?.value,
          upc: research.upc?.value,
          mpn: research.mpn?.value,
          currency: 'USD',
        }
      : null;

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-foreground text-sm font-medium">Research result</h3>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {research.sourcesChecked.length > 0
                ? `Checked ${research.sourcesChecked.join(', ')}`
                : 'No retailer pages were fetched'}
              {research.cached ? ' · cached result' : ''}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setResearch(null);
              setError(null);
            }}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            New research
          </Button>
        </div>

        {fields.length > 0 && (
          <div className="border-border overflow-hidden rounded-lg border">
            <div className="border-border bg-surface/60 border-b px-3 py-2">
              <p className="text-foreground flex items-center gap-1.5 text-xs font-medium">
                <CheckCircle2 className="text-success h-3.5 w-3.5" />
                Source data
              </p>
              <p className="text-muted-foreground mt-0.5 text-[11px]">
                Fields below were read from the named source, not generated by AI.
              </p>
            </div>
            <div className="divide-border divide-y">
              {fields.map(({ label, field }) => {
                if (!field) return null;
                return (
                  <div
                    key={label}
                    className="flex flex-wrap items-start gap-x-3 gap-y-1 px-3 py-2 text-xs"
                  >
                    <span className="text-muted-foreground w-24 shrink-0">{label}</span>
                    <span className="text-foreground min-w-0 flex-1 break-words">
                      {formatField(field)}
                    </span>
                    <span className="text-muted-foreground shrink-0">
                      {sourceLabel(field.source)} · {field.confidence}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {research.retailers.length > 0 && (
          <div className="border-border rounded-lg border p-3">
            <p className="text-foreground mb-2 text-xs font-medium">Retailers checked</p>
            <div className="space-y-2">
              {research.retailers.map((retailer) => (
                <div
                  key={`${retailer.name}-${retailer.url}`}
                  className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs"
                >
                  <a
                    href={retailer.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-foreground hover:text-accent flex min-w-0 items-center gap-1 font-medium underline-offset-4 hover:underline"
                  >
                    <span className="truncate">{retailer.name}</span>
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                  {retailer.price && (
                    <span className="text-foreground">{formatField(retailer.price)}</span>
                  )}
                  <span className="text-muted-foreground">
                    {retailer.availability.value} · {retailer.availability.confidence}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="border-accent/20 bg-accent/5 rounded-lg border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className="text-accent h-3.5 w-3.5" />
            <p className="text-foreground text-xs font-medium">AI-generated summary</p>
            <Badge variant="warning">Not source-verified</Badge>
          </div>
          {research.aiEnrichment && hasAISummary ? (
            <div className="mt-2 space-y-2">
              {(research.aiEnrichment.shortDescription || research.aiEnrichment.description) && (
                <p className="text-muted-foreground text-xs leading-relaxed">
                  {research.aiEnrichment.shortDescription || research.aiEnrichment.description}
                </p>
              )}
              {research.aiEnrichment.buyingAdvice && (
                <p className="text-muted-foreground text-xs leading-relaxed">
                  <span className="text-foreground font-medium">Buying advice: </span>
                  {research.aiEnrichment.buyingAdvice}
                </p>
              )}
              {research.aiEnrichment.pros && research.aiEnrichment.pros.length > 0 && (
                <p className="text-muted-foreground text-xs">
                  <span className="text-foreground font-medium">Pros: </span>
                  {research.aiEnrichment.pros.join(' · ')}
                </p>
              )}
              {research.aiEnrichment.cons && research.aiEnrichment.cons.length > 0 && (
                <p className="text-muted-foreground text-xs">
                  <span className="text-foreground font-medium">Cons: </span>
                  {research.aiEnrichment.cons.join(' · ')}
                </p>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">
              No AI summary was generated. This can happen when no AI provider is configured or the
              provider request failed. The source data above is still usable.
            </p>
          )}
        </div>

        {draft ? (
          <div className="space-y-3">
            <div>
              <h4 className="text-foreground text-sm font-medium">Review &amp; add</h4>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Adding to {wishlistTitle}. Verify every field before saving.
              </p>
            </div>
            <ProductEditor
              draft={draft}
              wishlistId={wishlistId}
              mode="create"
              onSave={() => router.refresh()}
              onCancel={() => setResearch(null)}
            />
          </div>
        ) : (
          <div className="border-border rounded-lg border border-dashed p-5 text-center">
            <AlertCircle className="text-muted-foreground/50 mx-auto h-6 w-6" />
            <p className="text-foreground mt-2 text-sm font-medium">No reliable product match</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Research did not return a usable product name. Try a product URL or enter it manually.
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => onSwitchTab('url')}>
                Use Product URL
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onSwitchTab('manual')}>
                Manual Entry
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleResearch} className="space-y-3">
        <label htmlFor="ai-research-input" className="text-foreground text-sm font-medium">
          Research a product
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="ai-research-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Product name or product URL"
            autoComplete="off"
            className="flex-1"
          />
          <Button
            type="submit"
            disabled={isLoading || input.trim().length < 2}
            className="shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            {isLoading ? 'Researching…' : 'Research'}
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          Fetches retailer data first, then optionally asks your configured AI provider for a
          summary. AI content is labeled separately.
        </p>
      </form>

      {error && (
        <div className="border-danger/30 bg-danger/5 text-danger flex items-start gap-2 rounded-lg border p-3 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isLoading && (
        <div className="border-border flex items-center gap-3 rounded-lg border p-4">
          <Loader2 className="text-accent h-4 w-4 animate-spin" />
          <div>
            <p className="text-foreground text-sm font-medium">Researching product…</p>
            <p className="text-muted-foreground text-xs">
              Fetching source pages and checking for an AI provider.
            </p>
          </div>
        </div>
      )}

      {!isLoading && !error && (
        <div className="border-border bg-surface/40 rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <Bot className="text-muted-foreground h-4 w-4" />
            <p className="text-foreground text-xs font-medium">What this tab does</p>
          </div>
          <ul className="text-muted-foreground mt-2 space-y-1 text-xs">
            <li>Reads publicly available product metadata from source pages.</li>
            <li>Shows each field&apos;s source and confidence.</li>
            <li>Keeps AI-generated summaries separate from verified source data.</li>
            <li>Lets you review and edit before anything is added to a wishlist.</li>
          </ul>
        </div>
      )}
    </div>
  );
}
