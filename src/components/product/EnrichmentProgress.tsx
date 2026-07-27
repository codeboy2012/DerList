'use client';

/**
 * EnrichmentProgress — Live progress panel for AI product enrichment.
 *
 * Shows animated step-by-step progress, elapsed time, provider info,
 * friendly rotating messages, and a summary on completion.
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
  detail?: string;
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
}

export interface EnrichmentProgressProps {
  /** Whether the panel is open */
  open: boolean;
  /** Close the panel */
  onClose: () => void;
  /** The product being enriched */
  productTitle: string;
  /** Trigger enrichment — returns the result */
  onEnrich: () => Promise<EnrichmentProgressResult>;
}

export interface EnrichmentProgressResult {
  success: boolean;
  error?: string;
  summary?: EnrichmentSummary;
}

const STEPS: { id: string; label: string }[] = [
  { id: 'prepare', label: 'Preparing product data' },
  { id: 'connect', label: 'Connecting to AI provider' },
  { id: 'research', label: 'AI is researching the product' },
  { id: 'specs', label: 'Extracting specifications' },
  { id: 'pricing', label: 'Finding pricing & sellers' },
  { id: 'images', label: 'Collecting images' },
  { id: 'build', label: 'Building product object' },
  { id: 'validate', label: 'Validating AI response' },
  { id: 'merge', label: 'Merging with existing data' },
  { id: 'save', label: 'Saving product' },
];

const FRIENDLY_MESSAGES = [
  '🧠 Reading product information...',
  '🔎 Looking for manufacturer specifications...',
  '📦 Finding official images...',
  '💲 Checking current pricing...',
  '🛒 Looking for trusted sellers...',
  '📊 Comparing technical specifications...',
  '⚙️ Organizing structured data...',
  '✨ Making everything look nice...',
  '🌐 Cross-referencing data sources...',
  '📝 Generating descriptions...',
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
  const [friendlyMsg, setFriendlyMsg] = useState(FRIENDLY_MESSAGES[0]);
  const [summary, setSummary] = useState<EnrichmentSummary | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval>>(null);
  const msgRef = useRef<ReturnType<typeof setInterval>>(null);
  const cancelledRef = useRef(false);
  const toast = useToast();

  const addLog = (msg: string) =>
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  const advanceStep = useCallback((stepId: string, status: StepStatus, detail?: string) => {
    setSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, status, detail } : s)));
  }, []);

  // Auto-advance steps based on timing (simulated milestones)
  const runEnrichment = useCallback(async () => {
    cancelledRef.current = false;
    setPhase('running');
    setElapsed(0);
    setSummary(null);
    setErrorMsg(null);
    setLogs([]);
    setSteps(STEPS.map((s) => ({ ...s, status: 'waiting' })));

    const startTime = Date.now();

    // Start timer
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    // Rotate friendly messages
    let msgIdx = 0;
    msgRef.current = setInterval(() => {
      msgIdx = (msgIdx + 1) % FRIENDLY_MESSAGES.length;
      setFriendlyMsg(FRIENDLY_MESSAGES[msgIdx]);
    }, 3000);

    // Advance steps on a timeline while the real request runs
    const stepTimeline = [0, 500, 1500, 3000, 6000, 10000, 15000, 20000, 25000, 28000];
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    stepTimeline.forEach((delay, i) => {
      const t = setTimeout(() => {
        if (cancelledRef.current) return;
        if (i > 0) advanceStep(STEPS[i - 1].id, 'done');
        advanceStep(STEPS[i].id, 'running');
        addLog(STEPS[i].label);
      }, delay);
      timeouts.push(t);
    });

    // Run the actual enrichment
    try {
      addLog('Starting AI enrichment...');
      const result = await onEnrich();

      if (cancelledRef.current) return;

      // Mark all steps done
      setSteps((prev) => prev.map((s) => ({ ...s, status: 'done' })));

      if (result.success) {
        setPhase('done');
        setSummary(result.summary ?? null);
        addLog(`Enrichment complete in ${Math.floor((Date.now() - startTime) / 1000)}s`);
        if (result.summary?.model) addLog(`Model used: ${result.summary.model}`);
        toast.success('Product enriched successfully');
      } else {
        setPhase('error');
        setErrorMsg(result.error || 'Enrichment failed');
        addLog(`Error: ${result.error}`);
      }
    } catch (err) {
      if (!cancelledRef.current) {
        setPhase('error');
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setErrorMsg(msg);
        addLog(`Error: ${msg}`);
      }
    } finally {
      if (timerRef.current) clearInterval(timerRef.current);
      if (msgRef.current) clearInterval(msgRef.current);
      timeouts.forEach(clearTimeout);
    }
  }, [onEnrich, advanceStep, toast]);

  // Start enrichment when panel opens
  // Start enrichment when panel opens
  useEffect(() => {
    if (open && phase === 'idle') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      runEnrichment();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCancel = () => {
    cancelledRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    if (msgRef.current) clearInterval(msgRef.current);
    setPhase('idle');
    onClose();
    toast.info('Enrichment cancelled');
  };

  if (!open) return null;

  const progress = Math.round(
    (steps.filter((s) => s.status === 'done').length / steps.length) * 100
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="border-border bg-card w-full max-w-lg rounded-2xl border p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="text-accent h-5 w-5" />
            <h2 className="text-lg font-semibold">AI Auto Fill</h2>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-muted-foreground mb-4 truncate text-sm">{productTitle}</p>

        {/* Progress bar */}
        {phase === 'running' && (
          <div className="mb-4">
            <div className="text-muted-foreground mb-1 flex justify-between text-xs">
              <span>{friendlyMsg}</span>
              <span>{elapsed}s</span>
            </div>
            <div className="bg-surface h-2 overflow-hidden rounded-full">
              <div
                className="bg-accent h-full rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${Math.min(progress + 5, 95)}%` }}
              />
            </div>
          </div>
        )}

        {/* Steps */}
        <div className="mb-4 max-h-60 space-y-1.5 overflow-y-auto">
          {steps.map((step) => (
            <div key={step.id} className="flex items-center gap-2.5 py-1">
              {step.status === 'done' && <Check className="text-success h-4 w-4 shrink-0" />}
              {step.status === 'running' && (
                <Loader2 className="text-accent h-4 w-4 shrink-0 animate-spin" />
              )}
              {step.status === 'waiting' && (
                <div className="border-border h-4 w-4 shrink-0 rounded-full border" />
              )}
              {step.status === 'error' && <X className="text-danger h-4 w-4 shrink-0" />}
              <span
                className={cn(
                  'text-sm',
                  step.status === 'done' && 'text-muted-foreground',
                  step.status === 'running' && 'text-foreground font-medium',
                  step.status === 'waiting' && 'text-muted-foreground/60'
                )}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>

        {/* Error */}
        {phase === 'error' && errorMsg && (
          <div className="border-danger/30 bg-danger/5 text-danger mb-4 rounded-lg border px-4 py-3 text-sm">
            {errorMsg}
          </div>
        )}

        {/* Summary */}
        {phase === 'done' && summary && (
          <div className="border-success/30 bg-success/5 mb-4 rounded-lg border px-4 py-3">
            <p className="text-success mb-2 text-sm font-medium">Enrichment complete!</p>
            <div className="text-muted-foreground grid grid-cols-2 gap-1 text-xs">
              {summary.specifications && <span>✓ {summary.specifications} specs</span>}
              {summary.images && <span>✓ {summary.images} images</span>}
              {summary.sellers && <span>✓ {summary.sellers} sellers</span>}
              {summary.tags && <span>✓ {summary.tags} tags</span>}
              {summary.fields && <span>✓ {summary.fields} fields filled</span>}
              {summary.duration && <span>⏱ {summary.duration}s</span>}
            </div>
            {summary.provider && summary.model && (
              <p className="text-muted-foreground mt-2 text-[11px]">
                Provider: {summary.provider} · Model: {summary.model}
              </p>
            )}
          </div>
        )}

        {/* Logs toggle */}
        <button
          type="button"
          onClick={() => setShowLogs((v) => !v)}
          className="text-muted-foreground hover:text-foreground mb-2 flex items-center gap-1 text-xs"
        >
          <ChevronDown className={cn('h-3 w-3 transition-transform', showLogs && 'rotate-180')} />
          Details
        </button>
        {showLogs && (
          <div className="bg-surface text-muted-foreground max-h-32 space-y-0.5 overflow-y-auto rounded-lg p-3 font-mono text-[11px]">
            {logs.map((log, i) => (
              <div key={i}>{log}</div>
            ))}
            {logs.length === 0 && <div>No logs yet.</div>}
          </div>
        )}

        {/* Footer */}
        <div className="border-border mt-4 flex justify-end gap-3 border-t pt-4">
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
