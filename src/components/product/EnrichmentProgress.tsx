'use client';

/**
 * EnrichmentProgress — Premium AI research progress panel.
 *
 * Shows: animated steps, live activity feed, live stats counters,
 * AI model info, and rich completion summary with real metrics.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Loader2, Sparkles, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type StepStatus = 'waiting' | 'running' | 'done' | 'error';
interface Step {
  id: string;
  label: string;
  status: StepStatus;
}
interface LiveStats {
  fields: number;
  specs: number;
  images: number;
  sellers: number;
  sources: number;
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
  onEnrich: () => Promise<EnrichmentProgressResult>;
}

export interface EnrichmentProgressResult {
  success: boolean;
  error?: string;
  summary?: EnrichmentSummary;
}

const STEPS: { id: string; label: string }[] = [
  { id: 'prepare', label: 'Preparing product' },
  { id: 'connect', label: 'Connecting to AI' },
  { id: 'research', label: 'Researching product' },
  { id: 'specs', label: 'Reading specifications' },
  { id: 'pricing', label: 'Finding pricing' },
  { id: 'images', label: 'Collecting images' },
  { id: 'build', label: 'Building product' },
  { id: 'save', label: 'Saving' },
];

const ACTIVITIES = [
  '🧠 Analyzing product page...',
  '📦 Identifying manufacturer...',
  '🔍 Extracting specifications...',
  '🌐 Checking manufacturer website...',
  '📷 Downloading product images...',
  '💰 Comparing retailer prices...',
  '🛒 Finding additional sellers...',
  '⚙️ Parsing structured data...',
  '🔎 Detecting category & model...',
  '📈 Building product metadata...',
  '🏷️ Generating tags & keywords...',
  '🎯 Finding compatible products...',
  '📄 Validating identifiers...',
  '🔗 Cross-referencing sources...',
];

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function EnrichmentProgress({
  open,
  onClose,
  productTitle,
  onEnrich,
}: EnrichmentProgressProps) {
  const [steps, setSteps] = useState<Step[]>(STEPS.map((s) => ({ ...s, status: 'waiting' })));
  const [phase, setPhase] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [activity, setActivity] = useState(ACTIVITIES[0]);
  const [activityLog, setActivityLog] = useState<string[]>([]);
  const [stats, setStats] = useState<LiveStats>({
    fields: 0,
    specs: 0,
    images: 0,
    sellers: 0,
    sources: 0,
  });
  const [summary, setSummary] = useState<EnrichmentSummary | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>(null);
  const cancelledRef = useRef(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  const addLog = useCallback((msg: string) => {
    setActivityLog((prev) => [...prev.slice(-19), msg]);
  }, []);

  const runEnrichment = useCallback(async () => {
    cancelledRef.current = false;
    setPhase('running');
    setElapsed(0);
    setSummary(null);
    setErrorMsg(null);
    setActivityLog([]);
    setStats({ fields: 0, specs: 0, images: 0, sellers: 0, sources: 0 });
    setSteps(STEPS.map((s) => ({ ...s, status: 'waiting' })));

    const startTime = Date.now();
    let actIdx = 0;
    let stepIdx = 0;

    // Fast timer for elapsed display
    timerRef.current = setInterval(() => {
      if (cancelledRef.current) return;
      setElapsed(parseFloat(((Date.now() - startTime) / 1000).toFixed(1)));
    }, 200);

    // Activity rotation + step advancement + stat growth
    const activityInterval = setInterval(() => {
      if (cancelledRef.current) return;
      const sec = (Date.now() - startTime) / 1000;

      actIdx = (actIdx + 1) % ACTIVITIES.length;
      setActivity(ACTIVITIES[actIdx]);
      if (sec > 1.5) addLog(ACTIVITIES[actIdx]);

      // Advance steps
      const nextStep = Math.min(Math.floor(sec / 3.5), STEPS.length - 1);
      if (nextStep > stepIdx) {
        setSteps((prev) =>
          prev.map((s, i) => ({
            ...s,
            status: i < nextStep ? 'done' : i === nextStep ? 'running' : 'waiting',
          }))
        );
        stepIdx = nextStep;
      }

      // Grow stats (smooth small increments)
      setStats((prev) => ({
        fields: Math.min(prev.fields + 1 + Math.floor(Math.random() * 2), 45),
        specs: Math.min(prev.specs + 1 + Math.floor(Math.random() * 3), 55),
        images: Math.min(prev.images + (Math.random() > 0.6 ? 1 : 0), 8),
        sellers: Math.min(prev.sellers + (Math.random() > 0.75 ? 1 : 0), 5),
        sources: Math.min(prev.sources + (Math.random() > 0.5 ? 1 : 0), 12),
      }));
    }, 2000);

    setSteps((prev) => prev.map((s, i) => ({ ...s, status: i === 0 ? 'running' : 'waiting' })));
    addLog('Starting AI research...');

    try {
      const result = await onEnrich();
      if (cancelledRef.current) return;

      // Stop timers IMMEDIATELY
      if (timerRef.current) clearInterval(timerRef.current);
      clearInterval(activityInterval);

      // Freeze elapsed at the exact backend duration (source of truth)
      if (result.summary?.duration) {
        setElapsed(result.summary.duration);
      } else {
        setElapsed(parseFloat(((Date.now() - startTime) / 1000).toFixed(1)));
      }

      setSteps((prev) => prev.map((s) => ({ ...s, status: 'done' })));

      if (result.success) {
        setPhase('done');
        setSummary(result.summary ?? null);
        // Set final stats from backend
        if (result.summary) {
          setStats({
            fields: result.summary.fields ?? 0,
            specs: result.summary.specifications ?? 0,
            images: result.summary.images ?? 0,
            sellers: result.summary.sellers ?? 0,
            sources: 0,
          });
        }
        addLog(`✅ Research complete!`);
        toast.success('Product enriched successfully');
      } else {
        setPhase('error');
        setErrorMsg(result.error || 'Enrichment failed');
        addLog(`❌ ${result.error || 'Failed'}`);
      }
    } catch (err) {
      if (timerRef.current) clearInterval(timerRef.current);
      clearInterval(activityInterval);
      if (!cancelledRef.current) {
        setPhase('error');
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setErrorMsg(msg);
        addLog(`❌ ${msg}`);
      }
    }
  }, [onEnrich, addLog, toast]);

  useEffect(() => {
    if (open && phase === 'idle') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      runEnrichment();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activityLog]);

  const handleCancel = () => {
    cancelledRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase('idle');
    onClose();
    toast.info('Enrichment cancelled');
  };

  if (!open) return null;

  const progress = Math.round(
    (steps.filter((s) => s.status === 'done').length / steps.length) * 100
  );
  const smoothProgress = phase === 'done' ? 100 : Math.min(progress + 5, 95);

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

        {/* Progress bar + elapsed */}
        {phase === 'running' && (
          <div className="px-6 pb-3">
            <div className="text-muted-foreground mb-1.5 flex justify-between text-[11px]">
              <span className="max-w-[70%] truncate">{activity}</span>
              <span className="font-mono tabular-nums">{elapsed}s</span>
            </div>
            <div className="bg-surface h-1.5 overflow-hidden rounded-full">
              <div
                className="from-accent h-full rounded-full bg-gradient-to-r to-blue-400 transition-all duration-[1500ms] ease-out"
                style={{ width: `${smoothProgress}%` }}
              />
            </div>
          </div>
        )}

        <div className="max-h-[55vh] space-y-4 overflow-y-auto px-6 pb-5">
          {/* Live stats */}
          {phase === 'running' && (
            <div className="grid grid-cols-5 gap-1.5">
              <StatPill label="Fields" value={stats.fields} />
              <StatPill label="Specs" value={stats.specs} />
              <StatPill label="Images" value={stats.images} />
              <StatPill label="Sellers" value={stats.sellers} />
              <StatPill label="Sources" value={stats.sources} />
            </div>
          )}

          {/* Steps */}
          <div className="space-y-0.5">
            {steps.map((step) => (
              <div
                key={step.id}
                className={cn(
                  'flex items-center gap-2 py-0.5 transition-all duration-300',
                  step.status === 'waiting' && 'opacity-30'
                )}
              >
                {step.status === 'done' && <Check className="text-success h-3.5 w-3.5 shrink-0" />}
                {step.status === 'running' && (
                  <Loader2 className="text-accent h-3.5 w-3.5 shrink-0 animate-spin" />
                )}
                {step.status === 'waiting' && (
                  <div className="border-border/50 h-3.5 w-3.5 shrink-0 rounded-full border" />
                )}
                {step.status === 'error' && <X className="text-danger h-3.5 w-3.5 shrink-0" />}
                <span
                  className={cn(
                    'text-xs',
                    step.status === 'running' && 'text-foreground font-medium',
                    step.status === 'done' && 'text-muted-foreground',
                    step.status === 'waiting' && 'text-muted-foreground/50'
                  )}
                >
                  {step.label}
                </span>
              </div>
            ))}
          </div>

          {/* Activity feed */}
          {phase === 'running' && activityLog.length > 0 && (
            <div className="bg-surface/30 border-border/40 max-h-24 overflow-y-auto rounded-lg border p-2.5">
              {activityLog.slice(-8).map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    'py-0.5 text-[11px]',
                    i === activityLog.slice(-8).length - 1
                      ? 'text-foreground'
                      : 'text-muted-foreground/60'
                  )}
                >
                  {msg}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          )}

          {/* Error */}
          {phase === 'error' && errorMsg && (
            <div className="border-danger/30 bg-danger/5 text-danger rounded-lg border px-4 py-3 text-sm">
              {errorMsg}
            </div>
          )}

          {/* ─── Completion Card ─── */}
          {phase === 'done' && summary && (
            <div className="border-success/20 bg-success/5 space-y-3 rounded-xl border p-4">
              <div className="flex items-center gap-2">
                <Sparkles className="text-success h-4 w-4" />
                <span className="text-success text-sm font-semibold">Research Complete</span>
              </div>

              {/* Stats grid */}
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

              {/* Sources */}
              {(summary.sources ?? 0) > 0 && (
                <div className="text-muted-foreground text-xs">
                  ✓ {summary.sources} sources visited
                </div>
              )}

              {/* Provider & Model (separate lines, never duplicated) */}
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
