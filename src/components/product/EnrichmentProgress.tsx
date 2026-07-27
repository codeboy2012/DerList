'use client';

/**
 * EnrichmentProgress — Polished AI Research Experience.
 *
 * No developer logs. No debug info. Just clean research UX.
 * Shows: current activity → live discoveries → research summary.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Sparkles, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ResearchEvent {
  type: 'activity' | 'discovery' | 'stat' | 'source' | 'complete' | 'error';
  message: string;
  icon?: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

interface Summary {
  specs: number;
  images: number;
  sellers: number;
  sources: number;
  fields: number;
  identifiers: number;
  duration: number;
  model: string;
  provider: string;
}

export interface EnrichmentProgressProps {
  open: boolean;
  onClose: () => void;
  productTitle: string;
  productData: {
    title: string;
    brand?: string;
    category?: string;
    description?: string;
    url?: string;
    retailer?: string;
    currentPrice?: number;
    originalPrice?: number;
    image?: string;
    sku?: string;
    asin?: string;
    upc?: string;
    mpn?: string;
  };
  onComplete: (result: unknown) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function EnrichmentProgress({
  open,
  onClose,
  productTitle,
  productData,
  onComplete,
}: EnrichmentProgressProps) {
  const [phase, setPhase] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [activity, setActivity] = useState({ message: 'Starting research...', icon: '🧠' });
  const [discoveries, setDiscoveries] = useState<{ icon: string; message: string }[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>(null);
  const startRef = useRef(0);
  const listEndRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  const run = useCallback(async () => {
    setPhase('running');
    setDiscoveries([]);
    setSources([]);
    setElapsed(0);
    setSummary(null);
    setErrorMsg(null);
    setActivity({ message: 'Starting research...', icon: '🧠' });
    startRef.current = Date.now();

    timerRef.current = setInterval(() => {
      setElapsed(parseFloat(((Date.now() - startRef.current) / 1000).toFixed(1)));
    }, 200);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/products/enrich-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product: productData }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response stream');
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event: ResearchEvent = JSON.parse(line.slice(6));

            if (event.type === 'activity')
              setActivity({ message: event.message, icon: event.icon || '🔍' });
            if (event.type === 'discovery')
              setDiscoveries((prev) => [
                ...prev,
                { icon: event.icon || '✓', message: event.message },
              ]);
            if (event.type === 'source')
              setSources((prev) =>
                prev.includes(event.message) ? prev : [...prev, event.message]
              );

            if (event.type === 'complete') {
              if (timerRef.current) clearInterval(timerRef.current);
              const d = event.data;
              if (d?.duration) setElapsed(d.duration as number);
              setPhase('done');
              setSummary({
                specs: (d?.specs as number) || 0,
                images: (d?.images as number) || 0,
                sellers: (d?.sellers as number) || 0,
                sources: (d?.sources as number) || 0,
                fields: (d?.fields as number) || 0,
                identifiers: (d?.identifiers as number) || 0,
                duration: (d?.duration as number) || 0,
                model: (d?.model as string) || '',
                provider: (d?.provider as string) || '',
              });
              if (d?.result) onComplete(d.result);
              toast.success('Product researched successfully');
            }

            if (event.type === 'error') {
              if (timerRef.current) clearInterval(timerRef.current);
              setPhase('error');
              setErrorMsg(event.message);
            }
          } catch {
            /* skip malformed */
          }
        }
      }
      if (phase === 'running') {
        if (timerRef.current) clearInterval(timerRef.current);
        setPhase('done');
      }
    } catch (err) {
      if (timerRef.current) clearInterval(timerRef.current);
      if ((err as Error).name === 'AbortError') return;
      setPhase('error');
      setErrorMsg(err instanceof Error ? err.message : 'Connection failed');
    }
  }, [productData, onComplete, toast]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open && phase === 'idle') run();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [discoveries]);

  const handleCancel = () => {
    abortRef.current?.abort();
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase('idle');
    onClose();
    toast.info('Research cancelled');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="border-border bg-card flex max-h-[75vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-5 pt-5 pb-2">
          <div className="flex items-center gap-2.5">
            <Sparkles className="text-accent h-5 w-5" />
            <div>
              <h2 className="text-sm font-semibold">AI Research</h2>
              <p className="text-muted-foreground max-w-[220px] truncate text-[11px]">
                {productTitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground font-mono text-[11px] tabular-nums">
              {elapsed}s
            </span>
            <button
              type="button"
              onClick={handleCancel}
              className="text-muted-foreground hover:text-foreground hover:bg-surface rounded-lg p-1"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Current Activity (shown while running) */}
        {phase === 'running' && (
          <div className="border-border/50 flex items-center gap-3 border-b px-5 py-3">
            <span className="text-2xl">{activity.icon}</span>
            <p className="text-foreground flex-1 truncate text-sm font-medium">
              {activity.message}
            </p>
            <Loader2 className="text-accent h-4 w-4 shrink-0 animate-spin" />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {/* Live discoveries (running state) */}
          {phase === 'running' && discoveries.length > 0 && (
            <div className="space-y-1.5">
              {discoveries.slice(-10).map((d, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex items-center gap-2.5 transition-opacity duration-300',
                    i === discoveries.slice(-10).length - 1 ? 'opacity-100' : 'opacity-50'
                  )}
                >
                  <span className="shrink-0 text-base">{d.icon}</span>
                  <span className="text-foreground text-[13px]">{d.message}</span>
                </div>
              ))}
              <div ref={listEndRef} />
            </div>
          )}

          {/* Error */}
          {phase === 'error' && errorMsg && (
            <div className="border-danger/30 bg-danger/5 text-danger rounded-lg border px-4 py-3 text-sm">
              {errorMsg}
            </div>
          )}

          {/* ─── Completion: Research Summary ─── */}
          {phase === 'done' && summary && (
            <div className="space-y-5">
              {/* Success header */}
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">✅</span>
                <span className="text-foreground text-base font-semibold">
                  Product Successfully Researched
                </span>
              </div>

              {/* What was found (large readable list) */}
              <div className="space-y-2">
                {summary.fields > 0 && (
                  <SummaryRow icon="📋" text={`${summary.fields} fields completed`} />
                )}
                {summary.specs > 0 && (
                  <SummaryRow icon="⚙️" text={`${summary.specs} specifications found`} />
                )}
                {summary.images > 0 && (
                  <SummaryRow icon="🖼️" text={`${summary.images} images collected`} />
                )}
                {summary.sellers > 0 && (
                  <SummaryRow
                    icon="🛒"
                    text={`${summary.sellers} ${summary.sellers === 1 ? 'seller' : 'sellers'} found`}
                  />
                )}
                {summary.identifiers > 0 && (
                  <SummaryRow icon="🏷️" text={`${summary.identifiers} identifiers verified`} />
                )}
                {summary.sources > 0 && (
                  <SummaryRow icon="🌐" text={`${summary.sources} sources visited`} />
                )}
              </div>

              {/* Sources */}
              {sources.length > 0 && (
                <div className="space-y-1">
                  <span className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
                    Sources
                  </span>
                  <p className="text-foreground text-xs">{sources.join(' · ')}</p>
                </div>
              )}

              {/* Meta */}
              <div className="border-border/40 text-muted-foreground space-y-1.5 border-t pt-3 text-[12px]">
                <div>
                  Completed in{' '}
                  <span className="text-foreground font-medium">{summary.duration}s</span>
                </div>
                {summary.provider && (
                  <div>
                    Provider: <span className="text-foreground">{summary.provider}</span>
                  </div>
                )}
                {summary.model && summary.model !== summary.provider && (
                  <div>
                    Model:{' '}
                    <span className="text-foreground font-mono text-[11px]">{summary.model}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-border flex shrink-0 justify-end gap-3 border-t px-5 py-3">
          {phase === 'running' && (
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
          )}
          {(phase === 'done' || phase === 'error') && (
            <Button variant="primary" size="sm" onClick={onClose}>
              Done
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-base">{icon}</span>
      <span className="text-foreground text-sm">{text}</span>
    </div>
  );
}
