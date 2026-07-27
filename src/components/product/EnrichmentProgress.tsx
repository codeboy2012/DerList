'use client';

/**
 * EnrichmentProgress — Real-time AI progress panel powered by SSE.
 *
 * Every status message comes from actual backend events.
 * No fake timers. No rotating messages. No simulated progress.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Loader2, Sparkles, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface EnrichProgressEvent {
  stage: string;
  message: string;
  percent: number;
  model?: string;
  provider?: string;
  success?: boolean;
  duration?: number;
  specifications?: number;
  images?: number;
  sellers?: number;
  tags?: number;
  fields?: number;
}

interface EnrichmentSummary {
  specifications?: number;
  images?: number;
  sellers?: number;
  tags?: number;
  fields?: number;
  duration?: number;
  model?: string;
  provider?: string;
  sources?: number;
}

export interface EnrichmentProgressProps {
  open: boolean;
  onClose: () => void;
  productTitle: string;
  /** Product data to send for enrichment */
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
  /** Called with the enrichment result when complete */
  onComplete: (result: unknown) => void;
}

export interface EnrichmentProgressResult {
  success: boolean;
  error?: string;
  summary?: EnrichmentSummary;
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
  const [events, setEvents] = useState<EnrichProgressEvent[]>([]);
  const [currentMessage, setCurrentMessage] = useState('Preparing...');
  const [percent, setPercent] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [summary, setSummary] = useState<EnrichmentSummary | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>(null);
  const startTimeRef = useRef(0);
  const toast = useToast();

  const runEnrichment = useCallback(async () => {
    setPhase('running');
    setEvents([]);
    setCurrentMessage('Connecting...');
    setPercent(0);
    setElapsed(0);
    setSummary(null);
    setErrorMsg(null);
    setModelUsed(null);
    startTimeRef.current = Date.now();

    // Elapsed timer (real, 200ms updates)
    timerRef.current = setInterval(() => {
      setElapsed(parseFloat(((Date.now() - startTimeRef.current) / 1000).toFixed(1)));
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
          const json = line.slice(6);
          try {
            const event: EnrichProgressEvent = JSON.parse(json);
            setEvents((prev) => [...prev, event]);
            setCurrentMessage(event.message);
            if (event.percent >= 0) setPercent(event.percent);
            if (event.model) setModelUsed(event.model);

            if (event.stage === 'complete' && event.success) {
              if (timerRef.current) clearInterval(timerRef.current);
              setElapsed(
                event.duration ??
                  parseFloat(((Date.now() - startTimeRef.current) / 1000).toFixed(1))
              );
              setPhase('done');
              setSummary({
                specifications: event.specifications,
                images: event.images,
                sellers: event.sellers,
                tags: event.tags,
                fields: event.fields,
                duration: event.duration,
                model: event.model,
                provider: event.provider,
              });
              // Pass result back to parent
              onComplete((event as unknown as Record<string, unknown>).result);
              toast.success('Product enriched successfully');
            }

            if (event.stage === 'error') {
              if (timerRef.current) clearInterval(timerRef.current);
              setPhase('error');
              setErrorMsg(event.message);
            }
          } catch {
            /* skip malformed events */
          }
        }
      }

      // If stream ended without explicit complete/error
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
    if (open && phase === 'idle') runEnrichment();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCancel = () => {
    abortRef.current?.abort();
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase('idle');
    onClose();
    toast.info('Enrichment cancelled');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="border-border bg-card w-full max-w-lg overflow-hidden rounded-2xl border shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="bg-accent/10 flex h-8 w-8 items-center justify-center rounded-lg">
              <Sparkles className="text-accent h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">AI Auto Fill</h2>
              <p className="text-muted-foreground max-w-[250px] truncate text-[11px]">
                {productTitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            className="text-muted-foreground hover:text-foreground hover:bg-surface rounded-lg p-1.5 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Progress bar + current message */}
        {phase === 'running' && (
          <div className="px-6 pb-3">
            <div className="text-muted-foreground mb-1.5 flex justify-between text-[11px]">
              <span className="max-w-[75%] truncate">{currentMessage}</span>
              <span className="font-mono tabular-nums">{elapsed}s</span>
            </div>
            <div className="bg-surface h-1.5 overflow-hidden rounded-full">
              <div
                className="from-accent h-full rounded-full bg-gradient-to-r to-blue-400 transition-all duration-500 ease-out"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )}

        <div className="max-h-[55vh] space-y-4 overflow-y-auto px-6 pb-5">
          {/* Live stats (from real events) */}
          {phase === 'running' && events.length > 2 && (
            <div className="grid grid-cols-5 gap-1.5">
              <StatPill label="Events" value={events.length} />
              <StatPill
                label="Specs"
                value={events.find((e) => e.specifications)?.specifications ?? 0}
              />
              <StatPill label="Images" value={events.find((e) => e.images)?.images ?? 0} />
              <StatPill label="Sellers" value={events.find((e) => e.sellers)?.sellers ?? 0} />
              <StatPill label="Fields" value={events.find((e) => e.fields)?.fields ?? 0} />
            </div>
          )}

          {/* Real event log */}
          <div className="space-y-0.5">
            {events.slice(-12).map((event, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-center gap-2 py-0.5',
                  i === events.slice(-12).length - 1 ? 'opacity-100' : 'opacity-50'
                )}
              >
                {event.stage === 'complete' ? (
                  <Check className="text-success h-3.5 w-3.5 shrink-0" />
                ) : event.stage === 'error' ? (
                  <X className="text-danger h-3.5 w-3.5 shrink-0" />
                ) : event.percent >= 0 && i === events.slice(-12).length - 1 ? (
                  <Loader2 className="text-accent h-3.5 w-3.5 shrink-0 animate-spin" />
                ) : (
                  <Check className="text-muted-foreground/40 h-3.5 w-3.5 shrink-0" />
                )}
                <span
                  className={cn(
                    'text-xs',
                    i === events.slice(-12).length - 1
                      ? 'text-foreground'
                      : 'text-muted-foreground/70'
                  )}
                >
                  {event.message}
                </span>
              </div>
            ))}
          </div>

          {/* Error */}
          {phase === 'error' && errorMsg && (
            <div className="border-danger/30 bg-danger/5 text-danger rounded-lg border px-4 py-3 text-sm">
              {errorMsg}
            </div>
          )}

          {/* Completion */}
          {phase === 'done' && summary && (
            <div className="border-success/20 bg-success/5 space-y-3 rounded-xl border p-4">
              <div className="flex items-center gap-2">
                <Sparkles className="text-success h-4 w-4" />
                <span className="text-success text-sm font-semibold">Research Complete</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-xs">
                {(summary.fields ?? 0) > 0 && (
                  <span className="text-muted-foreground">✓ {summary.fields} fields filled</span>
                )}
                {(summary.specifications ?? 0) > 0 && (
                  <span className="text-muted-foreground">
                    ✓ {summary.specifications} specifications
                  </span>
                )}
                {(summary.images ?? 0) > 0 && (
                  <span className="text-muted-foreground">✓ {summary.images} images</span>
                )}
                {(summary.sellers ?? 0) > 0 && (
                  <span className="text-muted-foreground">✓ {summary.sellers} sellers</span>
                )}
                {(summary.tags ?? 0) > 0 && (
                  <span className="text-muted-foreground">✓ {summary.tags} tags</span>
                )}
              </div>
              <div className="border-border/50 text-muted-foreground space-y-1 border-t pt-2.5 text-[11px]">
                {summary.duration != null && (
                  <div>
                    Time: <span className="text-foreground font-medium">{summary.duration}s</span>
                  </div>
                )}
                {summary.provider && (
                  <div>
                    Provider: <span className="text-foreground">{summary.provider}</span>
                  </div>
                )}
                {modelUsed && modelUsed !== summary.provider && (
                  <div>
                    Model:{' '}
                    <span className="text-foreground font-mono text-[10px]">{modelUsed}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-border flex justify-end gap-3 border-t px-6 py-4">
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

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-surface/40 flex flex-col items-center rounded-lg px-1.5 py-1.5">
      <span className="text-foreground text-sm font-semibold tabular-nums">{value}</span>
      <span className="text-muted-foreground text-[8px] tracking-wider uppercase">{label}</span>
    </div>
  );
}
