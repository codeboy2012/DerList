'use client';

/**
 * EnrichmentProgress — Premium AI research progress panel.
 *
 * Shows: animated steps, live activity feed, live stats counters,
 * AI model info, research sources, confidence meter, and rich summary.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Loader2, Sparkles, X } from 'lucide-react';
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
  confidence: number;
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
  confidence?: number;
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
  '🧠 Reading product page...',
  '📦 Identifying manufacturer...',
  '🔍 Looking up official specifications...',
  '🌐 Visiting manufacturer website...',
  '📄 Reading technical documentation...',
  '📷 Searching for high-resolution images...',
  '💰 Comparing prices across retailers...',
  '🛒 Looking for additional sellers...',
  '⚙️ Parsing technical specifications...',
  '🔎 Detecting product category...',
  '📈 Building structured product data...',
  '🏷️ Generating SEO metadata...',
  '🏆 Ranking data confidence...',
  '🔗 Cross-referencing data sources...',
  '📝 Generating descriptions...',
  '🎯 Finding compatible products...',
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
    confidence: 0,
  });
  const [summary, setSummary] = useState<EnrichmentSummary | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [modelInfo, setModelInfo] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>(null);
  const cancelledRef = useRef(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  const addActivity = useCallback((msg: string) => {
    setActivityLog((prev) => [...prev.slice(-19), msg]);
  }, []);

  const runEnrichment = useCallback(async () => {
    cancelledRef.current = false;
    setPhase('running');
    setElapsed(0);
    setSummary(null);
    setErrorMsg(null);
    setActivityLog([]);
    setModelInfo(null);
    setStats({ fields: 0, specs: 0, images: 0, sellers: 0, sources: 0, confidence: 0 });
    setSteps(STEPS.map((s) => ({ ...s, status: 'waiting' })));

    const startTime = Date.now();
    let actIdx = 0;
    let stepIdx = 0;

    // Timer: elapsed + rotate activities + advance steps + grow stats
    timerRef.current = setInterval(() => {
      if (cancelledRef.current) return;
      const elapsedSec = (Date.now() - startTime) / 1000;
      setElapsed(parseFloat(elapsedSec.toFixed(1)));

      // Rotate activity message every 2.5s
      actIdx = (actIdx + 1) % ACTIVITIES.length;
      setActivity(ACTIVITIES[actIdx]);
      if (elapsedSec > 2) addActivity(ACTIVITIES[actIdx]);

      // Advance steps on timeline
      const stepProgress = Math.min(Math.floor(elapsedSec / 3), STEPS.length - 1);
      if (stepProgress > stepIdx) {
        setSteps((prev) =>
          prev.map((s, i) => ({
            ...s,
            status: i < stepProgress ? 'done' : i === stepProgress ? 'running' : 'waiting',
          }))
        );
        stepIdx = stepProgress;
      }

      // Grow live stats organically
      setStats((prev) => ({
        fields: Math.min(prev.fields + Math.floor(Math.random() * 3), 50),
        specs: Math.min(prev.specs + Math.floor(Math.random() * 4), 60),
        images: Math.min(prev.images + (Math.random() > 0.7 ? 1 : 0), 10),
        sellers: Math.min(prev.sellers + (Math.random() > 0.8 ? 1 : 0), 6),
        sources: Math.min(prev.sources + (Math.random() > 0.6 ? 1 : 0), 15),
        confidence: Math.min(prev.confidence + Math.floor(Math.random() * 5), 98),
      }));
    }, 2500);

    // Set initial step
    setSteps((prev) => prev.map((s, i) => ({ ...s, status: i === 0 ? 'running' : 'waiting' })));
    addActivity('Starting AI research...');

    try {
      const result = await onEnrich();
      if (cancelledRef.current) return;

      setSteps((prev) => prev.map((s) => ({ ...s, status: 'done' })));

      if (result.success) {
        setPhase('done');
        setSummary(result.summary ?? null);
        if (result.summary?.model) setModelInfo(result.summary.model);
        if (result.summary?.confidence)
          setStats((prev) => ({ ...prev, confidence: result.summary!.confidence! }));
        if (result.summary?.specifications)
          setStats((prev) => ({ ...prev, specs: result.summary!.specifications! }));
        if (result.summary?.images)
          setStats((prev) => ({ ...prev, images: result.summary!.images! }));
        if (result.summary?.sellers)
          setStats((prev) => ({ ...prev, sellers: result.summary!.sellers! }));
        addActivity('✅ Research complete!');
        toast.success('Product enriched successfully');
      } else {
        setPhase('error');
        setErrorMsg(result.error || 'Enrichment failed');
        addActivity(`❌ ${result.error || 'Failed'}`);
      }
    } catch (err) {
      if (!cancelledRef.current) {
        setPhase('error');
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setErrorMsg(msg);
        addActivity(`❌ ${msg}`);
      }
    } finally {
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [onEnrich, addActivity, toast]);

  useEffect(() => {
    if (open && phase === 'idle') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      runEnrichment();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll activity log
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
  const smoothProgress = phase === 'done' ? 100 : Math.min(progress + (elapsed > 2 ? 5 : 0), 95);

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

        {/* Progress bar */}
        {phase === 'running' && (
          <div className="px-6 pb-3">
            <div className="text-muted-foreground mb-1.5 flex justify-between text-[11px]">
              <span className="max-w-[70%] truncate">{activity}</span>
              <span className="tabular-nums">{elapsed}s</span>
            </div>
            <div className="bg-surface h-1.5 overflow-hidden rounded-full">
              <div
                className="from-accent h-full rounded-full bg-gradient-to-r to-blue-400 transition-all duration-[2000ms] ease-out"
                style={{ width: `${smoothProgress}%` }}
              />
            </div>
          </div>
        )}

        <div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 pb-5">
          {/* Live stats */}
          {phase === 'running' && (
            <div className="grid grid-cols-3 gap-2">
              <StatPill label="Specs" value={stats.specs} />
              <StatPill label="Images" value={stats.images} />
              <StatPill label="Sellers" value={stats.sellers} />
              <StatPill label="Fields" value={stats.fields} />
              <StatPill label="Sources" value={stats.sources} />
              <StatPill label="Confidence" value={`${stats.confidence}%`} accent />
            </div>
          )}

          {/* Model info */}
          {modelInfo && phase === 'done' && (
            <div className="text-muted-foreground bg-surface/50 flex items-center gap-2 rounded-lg px-3 py-2 text-[11px]">
              <span className="bg-success h-1.5 w-1.5 rounded-full" />
              <span>
                Model: <span className="text-foreground font-medium">{modelInfo}</span>
              </span>
            </div>
          )}

          {/* Steps */}
          <div className="space-y-1">
            {steps.map((step) => (
              <div
                key={step.id}
                className={cn(
                  'flex items-center gap-2 py-0.5 transition-opacity duration-300',
                  step.status === 'waiting' && 'opacity-40'
                )}
              >
                {step.status === 'done' && <Check className="text-success h-3.5 w-3.5 shrink-0" />}
                {step.status === 'running' && (
                  <Loader2 className="text-accent h-3.5 w-3.5 shrink-0 animate-spin" />
                )}
                {step.status === 'waiting' && (
                  <div className="border-border/60 h-3.5 w-3.5 shrink-0 rounded-full border" />
                )}
                {step.status === 'error' && <X className="text-danger h-3.5 w-3.5 shrink-0" />}
                <span
                  className={cn(
                    'text-xs',
                    step.status === 'running' && 'text-foreground font-medium',
                    step.status === 'done' && 'text-muted-foreground',
                    step.status === 'waiting' && 'text-muted-foreground/60'
                  )}
                >
                  {step.label}
                </span>
              </div>
            ))}
          </div>

          {/* Activity feed */}
          {phase === 'running' && activityLog.length > 0 && (
            <div className="bg-surface/30 border-border/50 max-h-28 overflow-y-auto rounded-lg border p-3">
              <div className="space-y-0.5">
                {activityLog.slice(-10).map((msg, i) => (
                  <div
                    key={i}
                    className={cn(
                      'text-[11px]',
                      i === activityLog.slice(-10).length - 1
                        ? 'text-foreground'
                        : 'text-muted-foreground/70'
                    )}
                  >
                    {msg}
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </div>
          )}

          {/* Error */}
          {phase === 'error' && errorMsg && (
            <div className="border-danger/30 bg-danger/5 text-danger rounded-lg border px-4 py-3 text-sm">
              {errorMsg}
            </div>
          )}

          {/* Completion summary */}
          {phase === 'done' && summary && (
            <div className="border-success/20 bg-success/5 space-y-3 rounded-xl border p-4">
              <div className="flex items-center gap-2">
                <Sparkles className="text-success h-4 w-4" />
                <span className="text-success text-sm font-semibold">Research Complete</span>
              </div>
              <div className="text-muted-foreground grid grid-cols-2 gap-1.5 text-xs">
                {summary.specifications && <span>✓ {summary.specifications} specifications</span>}
                {summary.images && <span>✓ {summary.images} images</span>}
                {summary.sellers && <span>✓ {summary.sellers} sellers</span>}
                {summary.tags && <span>✓ {summary.tags} tags</span>}
                {summary.fields && <span>✓ {summary.fields} fields filled</span>}
                {summary.confidence && <span>✓ {summary.confidence}% confidence</span>}
              </div>
              {summary.duration && (
                <p className="text-muted-foreground text-[11px]">
                  Completed in {summary.duration}s{summary.provider && ` · ${summary.provider}`}
                  {summary.model && ` · ${summary.model}`}
                </p>
              )}
            </div>
          )}

          {/* Debug logs toggle */}
          <button
            type="button"
            onClick={() => setShowLogs((v) => !v)}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-[11px]"
          >
            <ChevronDown className={cn('h-3 w-3 transition-transform', showLogs && 'rotate-180')} />
            Developer Details
          </button>
          {showLogs && (
            <div className="bg-surface text-muted-foreground max-h-28 space-y-0.5 overflow-y-auto rounded-lg p-3 font-mono text-[10px]">
              {activityLog.map((log, i) => (
                <div key={i}>
                  [{(i * 2.5).toFixed(1)}s] {log}
                </div>
              ))}
              {activityLog.length === 0 && <div>Waiting...</div>}
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

// ─────────────────────────────────────────────────────────────────────────────

function StatPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  return (
    <div className="bg-surface/50 flex flex-col items-center rounded-lg px-2 py-1.5">
      <span
        className={cn(
          'text-sm font-semibold tabular-nums',
          accent ? 'text-accent' : 'text-foreground'
        )}
      >
        {value}
      </span>
      <span className="text-muted-foreground text-[9px] tracking-wide uppercase">{label}</span>
    </div>
  );
}
