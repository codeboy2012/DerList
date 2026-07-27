'use client';

/**
 * EnrichmentProgress — AI Research Experience.
 *
 * Renders real backend events as a live research timeline.
 * Every entry comes from actual backend work — zero fake progress.
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
  const [currentActivity, setCurrentActivity] = useState<{ message: string; icon: string }>({
    message: 'Starting research...',
    icon: '🧠',
  });
  const [timeline, setTimeline] = useState<ResearchEvent[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [sources, setSources] = useState<string[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [summary, setSummary] = useState<{
    specs?: number;
    images?: number;
    sellers?: number;
    sources?: number;
    fields?: number;
    identifiers?: number;
    duration?: number;
    model?: string;
    provider?: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>(null);
  const startRef = useRef(0);
  const timelineEndRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  const run = useCallback(async () => {
    setPhase('running');
    setTimeline([]);
    setStats({});
    setSources([]);
    setElapsed(0);
    setSummary(null);
    setErrorMsg(null);
    setCurrentActivity({ message: 'Starting research...', icon: '🧠' });
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

            // Update current activity
            if (event.type === 'activity') {
              setCurrentActivity({ message: event.message, icon: event.icon || '🔍' });
            }

            // Add discoveries to timeline
            if (event.type === 'discovery') {
              setTimeline((prev) => [...prev, event]);
            }

            // Track sources
            if (event.type === 'source') {
              setSources((prev) =>
                prev.includes(event.message) ? prev : [...prev, event.message]
              );
            }

            // Update stats
            if (event.type === 'stat' && event.data) {
              setStats((prev) => ({ ...prev, ...(event.data as Record<string, number>) }));
            }

            // Completion
            if (event.type === 'complete') {
              if (timerRef.current) clearInterval(timerRef.current);
              const d = event.data;
              if (d?.duration) setElapsed(d.duration as number);
              setPhase('done');
              setSummary(
                d
                  ? {
                      specs: d.specs as number,
                      images: d.images as number,
                      sellers: d.sellers as number,
                      sources: d.sources as number,
                      fields: d.fields as number,
                      identifiers: d.identifiers as number,
                      duration: d.duration as number,
                      model: d.model as string,
                      provider: d.provider as string,
                    }
                  : null
              );
              setStats((prev) => ({ ...prev, ...(d as Record<string, number>) }));
              if (d?.result) onComplete(d.result);
              toast.success('Product researched successfully');
            }

            // Error
            if (event.type === 'error') {
              if (timerRef.current) clearInterval(timerRef.current);
              setPhase('error');
              setErrorMsg(event.message);
            }
          } catch {
            /* skip */
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
    timelineEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [timeline]);

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
      <div className="border-border bg-card flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border shadow-2xl">
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

        {/* Current Activity */}
        {phase === 'running' && (
          <div className="border-border/50 flex items-center gap-3 border-b px-5 py-3">
            <span className="text-xl">{currentActivity.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-foreground truncate text-sm font-medium">
                {currentActivity.message}
              </p>
              {sources.length > 0 && (
                <p className="text-muted-foreground mt-0.5 text-[10px]">
                  Sources: {sources.slice(-3).join(' · ')}
                </p>
              )}
            </div>
            <Loader2 className="text-accent h-4 w-4 shrink-0 animate-spin" />
          </div>
        )}

        {/* Content area */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-3">
          {/* Live Stats */}
          {Object.keys(stats).length > 0 && phase === 'running' && (
            <div className="flex flex-wrap gap-2">
              {stats.specs > 0 && <Pill label="Specs" value={stats.specs} />}
              {stats.images > 0 && <Pill label="Images" value={stats.images} />}
              {stats.sellers > 0 && <Pill label="Sellers" value={stats.sellers} />}
              {stats.sources > 0 && <Pill label="Sources" value={stats.sources} />}
              {stats.identifiers > 0 && <Pill label="IDs" value={stats.identifiers} />}
              {stats.prices > 0 && <Pill label="Prices" value={stats.prices} />}
            </div>
          )}

          {/* Timeline */}
          {timeline.length > 0 && (
            <div className="space-y-1">
              {timeline.map((event, i) => (
                <div
                  key={i}
                  className={cn(
                    'animate-in fade-in flex items-start gap-2 py-0.5 duration-300',
                    i === timeline.length - 1 ? 'opacity-100' : 'opacity-60'
                  )}
                >
                  <span className="mt-0.5 shrink-0 text-sm">{event.icon || '✓'}</span>
                  <span className="text-foreground text-xs">{event.message}</span>
                  <span className="text-muted-foreground/50 ml-auto shrink-0 text-[9px] tabular-nums">
                    {event.timestamp}s
                  </span>
                </div>
              ))}
              <div ref={timelineEndRef} />
            </div>
          )}

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
                <span className="text-lg">✅</span>
                <span className="text-success text-sm font-semibold">
                  Product Successfully Researched
                </span>
              </div>
              <div className="text-muted-foreground grid grid-cols-2 gap-1.5 text-xs">
                {(summary.specs as number) > 0 && <span>✓ {summary.specs} specifications</span>}
                {(summary.images as number) > 0 && <span>✓ {summary.images} images</span>}
                {(summary.sellers as number) > 0 && <span>✓ {summary.sellers} retailers</span>}
                {(summary.sources as number) > 0 && <span>✓ {summary.sources} sources</span>}
                {(summary.fields as number) > 0 && <span>✓ {summary.fields} fields filled</span>}
                {(summary.identifiers as number) > 0 && (
                  <span>✓ {summary.identifiers} identifiers</span>
                )}
              </div>
              <div className="border-border/40 text-muted-foreground space-y-0.5 border-t pt-2 text-[11px]">
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
                    <span className="text-foreground font-mono text-[10px]">{summary.model}</span>
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

function Pill({ label, value }: { label: string; value: number }) {
  return (
    <span className="bg-surface/60 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px]">
      <span className="text-foreground font-semibold tabular-nums">{value}</span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}
