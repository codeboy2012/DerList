'use client';

/**
 * ProviderConfigPanel — Multi-step wizard for adding/editing an integration.
 *
 * Steps:
 * 1. Choose (provider info + hosted/personal)
 * 2. Credentials (required fields with validation)
 * 3. Advanced (optional fields, timeout, retry, rate limit)
 * 4. Test Connection (real API call with detailed results)
 * 5. Save (confirm and persist)
 */
import { useCallback, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FileText,
  Globe,
  Loader2,
  Save,
  Shield,
  XCircle,
  Zap,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import type {
  ConfigField,
  IntegrationCatalogEntry,
} from '@/lib/providers/registry/integration-types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface SerializedProvider {
  id: string;
  providerId: string;
  name: string;
  category: string;
  enabled: boolean;
  priority: number;
  isDefault: boolean;
  lastStatus: string;
  lastHealthCheck: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TestConnectionResult {
  success: boolean;
  message: string;
  latencyMs?: number;
  details?: {
    modelCount?: number;
    quota?: string;
    plan?: string;
    rateLimitRemaining?: number;
    httpStatus?: number;
  };
  error?: {
    httpStatus?: number;
    suggestion?: string;
  };
}

interface ProviderConfigPanelProps {
  entry: IntegrationCatalogEntry;
  existingProvider: SerializedProvider | null;
  onBack: () => void;
  onSaved: (provider: SerializedProvider) => void;
}

type WizardStep = 'choose' | 'credentials' | 'advanced' | 'test' | 'save';

const STEPS: { id: WizardStep; label: string; icon: typeof Globe }[] = [
  { id: 'choose', label: 'Provider', icon: Globe },
  { id: 'credentials', label: 'Credentials', icon: Shield },
  { id: 'advanced', label: 'Settings', icon: Zap },
  { id: 'test', label: 'Test', icon: CheckCircle2 },
  { id: 'save', label: 'Save', icon: Save },
];

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function ProviderConfigPanel({
  entry,
  existingProvider,
  onBack,
  onSaved,
}: ProviderConfigPanelProps) {
  const isEditing = !!existingProvider;
  const toast = useToast();

  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>(isEditing ? 'credentials' : 'choose');

  // Form state
  const [config, setConfig] = useState<Record<string, string>>({});
  const [name, setName] = useState(existingProvider?.name ?? entry.name);
  const [enabled, setEnabled] = useState(existingProvider?.enabled ?? true);
  const [priority, setPriority] = useState(existingProvider?.priority ?? 10);
  const [mode, setMode] = useState<'hosted' | 'personal'>(
    entry.supportsHosted ? 'hosted' : 'personal'
  );

  // Advanced
  const [timeout, setTimeout_] = useState(30);
  const [retryCount, setRetryCount] = useState(3);
  const [rateLimit, setRateLimit] = useState(60);
  const [healthInterval, setHealthInterval] = useState(300);

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Test
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);

  // Save
  const [saving, setSaving] = useState(false);

  // ─── Validation ───

  const validateCredentials = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    if (mode === 'personal') {
      for (const field of entry.requiredConfig) {
        const value = config[field.key];
        if (!value || !value.trim()) {
          newErrors[field.key] = `${field.label} is required`;
          continue;
        }
        if (field.pattern) {
          const regex = new RegExp(field.pattern);
          if (!regex.test(value)) {
            newErrors[field.key] = field.patternMessage || `Invalid format`;
          }
        }
        if (field.type === 'url' && value) {
          try {
            new URL(value);
          } catch {
            newErrors[field.key] = 'Must be a valid URL';
          }
        }
      }
    }

    if (!name.trim()) {
      newErrors._name = 'Display name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [config, entry.requiredConfig, mode, name]);

  const handleConfigChange = useCallback((key: string, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    // Clear error for this field when user types
    setErrors((prev) => {
      if (prev[key]) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return prev;
    });
  }, []);

  // ─── Step Navigation ───

  const stepIndex = STEPS.findIndex((s) => s.id === currentStep);

  const canGoNext = useMemo(() => {
    switch (currentStep) {
      case 'choose':
        return true;
      case 'credentials':
        return true; // validated on click
      case 'advanced':
        return true;
      case 'test':
        return true; // can skip test
      case 'save':
        return false;
      default:
        return false;
    }
  }, [currentStep]);

  const goNext = useCallback(() => {
    if (currentStep === 'credentials') {
      if (!validateCredentials()) return;
    }
    const nextIdx = stepIndex + 1;
    if (nextIdx < STEPS.length) {
      setCurrentStep(STEPS[nextIdx].id);
    }
  }, [currentStep, stepIndex, validateCredentials]);

  const goPrev = useCallback(() => {
    const prevIdx = stepIndex - 1;
    if (prevIdx >= 0) {
      setCurrentStep(STEPS[prevIdx].id);
    } else {
      onBack();
    }
  }, [stepIndex, onBack]);

  // ─── Test Connection ───

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const endpoint = isEditing
        ? `/api/providers/${existingProvider.id}/test`
        : '/api/providers/test';
      const method = 'POST';
      const body = isEditing ? undefined : JSON.stringify({ providerId: entry.id, config });

      const res = await fetch(endpoint, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body,
      });
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ success: false, message: 'Network error during test' });
    } finally {
      setTesting(false);
    }
  };

  // ─── Save ───

  const handleSave = async () => {
    if (!validateCredentials()) {
      setCurrentStep('credentials');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        providerId: entry.id,
        category: entry.category.toUpperCase(),
        name,
        config: {
          ...config,
          _mode: mode,
          _timeout: String(timeout * 1000),
          _retryCount: String(retryCount),
          _rateLimit: String(rateLimit),
          _healthInterval: String(healthInterval),
        },
        enabled,
        priority,
        mode,
      };

      let res: Response;
      if (isEditing) {
        res = await fetch(`/api/providers/${existingProvider.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/providers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (data.success && data.provider) {
        onSaved(data.provider);
      } else {
        toast.error(data.error || 'Failed to save integration');
      }
    } catch {
      toast.error('Network error while saving');
    } finally {
      setSaving(false);
    }
  };

  // Group optional fields
  const optionalFields = entry.optionalConfig ?? [];
  const groupedOptional = useMemo(() => {
    const groups = new Map<string, ConfigField[]>();
    for (const f of optionalFields) {
      const group = f.group || 'General';
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push(f);
    }
    return groups;
  }, [optionalFields]);

  // ─── Render ───

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-muted-foreground hover:bg-surface hover:text-foreground flex h-8 w-8 items-center justify-center rounded-md transition-colors"
          aria-label="Back to catalog"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">
            {isEditing ? `Configure ${entry.name}` : `Add ${entry.name}`}
          </h1>
          <p className="text-muted-foreground mt-0.5 text-sm">{entry.description}</p>
        </div>
        <div className="flex items-center gap-2">
          {entry.website && (
            <a
              href={entry.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Website
            </a>
          )}
          {entry.docsUrl && (
            <a
              href={entry.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition-colors"
            >
              <FileText className="h-3.5 w-3.5" /> Docs
            </a>
          )}
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-1" role="navigation" aria-label="Wizard steps">
        {STEPS.map((step, idx) => {
          const isActive = step.id === currentStep;
          const isCompleted = idx < stepIndex;
          const StepIcon = step.icon;
          return (
            <div key={step.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => idx <= stepIndex && setCurrentStep(step.id)}
                disabled={idx > stepIndex}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                  isActive && 'bg-accent/10 text-accent ring-accent/20 ring-1',
                  isCompleted && !isActive && 'text-success',
                  !isActive && !isCompleted && 'text-muted-foreground',
                  idx > stepIndex && 'cursor-not-allowed opacity-50'
                )}
              >
                {isCompleted ? (
                  <Check className="text-success h-3.5 w-3.5" />
                ) : (
                  <StepIcon className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">{step.label}</span>
              </button>
              {idx < STEPS.length - 1 && <ChevronRight className="text-muted h-3 w-3" />}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <div className="min-h-[300px]">
        {/* Step 1: Choose */}
        {currentStep === 'choose' && (
          <div className="space-y-4">
            {/* Provider Info Card */}
            <div
              className="rounded-xl border p-5"
              style={{ borderColor: entry.brand?.color ? `${entry.brand.color}30` : undefined }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{entry.name}</h2>
                  <p className="text-muted-foreground mt-1 text-sm">{entry.description}</p>
                </div>
                {entry.brand?.color && (
                  <div
                    className="h-10 w-10 rounded-lg"
                    style={{ background: `${entry.brand.color}20` }}
                  />
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {entry.free && <Badge variant="success">Free</Badge>}
                {entry.pricing === 'freemium' && <Badge variant="accent">Free Tier</Badge>}
                {entry.selfHosted && <Badge variant="secondary">Self Hosted</Badge>}
                {entry.recommended && <Badge variant="accent">Recommended</Badge>}
                {entry.tags?.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
              {entry.freeTier && (
                <p className="text-muted-foreground mt-2 text-xs">{entry.freeTier}</p>
              )}
            </div>

            {/* Hosted vs Personal */}
            {entry.supportsHosted && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Connection Mode</h3>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMode('hosted')}
                    className={cn(
                      'rounded-lg border p-4 text-left transition-all',
                      mode === 'hosted'
                        ? 'border-accent bg-accent/5 ring-accent/20 ring-1'
                        : 'border-border hover:border-border-hover'
                    )}
                  >
                    <div className="text-sm font-medium">Use DerList Hosted</div>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      Shared service, no API key needed
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('personal')}
                    className={cn(
                      'rounded-lg border p-4 text-left transition-all',
                      mode === 'personal'
                        ? 'border-accent bg-accent/5 ring-accent/20 ring-1'
                        : 'border-border hover:border-border-hover'
                    )}
                  >
                    <div className="text-sm font-medium">Use My Personal API</div>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      Connect your own account & keys
                    </p>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Credentials */}
        {currentStep === 'credentials' && (
          <div className="border-border bg-card space-y-4 rounded-xl border p-5">
            <h2 className="text-sm font-semibold">Credentials</h2>

            {/* Display Name */}
            <div className="space-y-1.5">
              <label htmlFor="provider-name" className="text-muted-foreground text-xs font-medium">
                Display Name <span className="text-danger">*</span>
              </label>
              <Input
                id="provider-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setErrors((prev) => {
                    const n = { ...prev };
                    delete n._name;
                    return n;
                  });
                }}
                placeholder={entry.name}
                invalid={!!errors._name}
              />
              {errors._name && <p className="text-danger text-xs">{errors._name}</p>}
            </div>

            {/* Required fields */}
            {mode === 'personal' &&
              entry.requiredConfig.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <label
                    htmlFor={`field-${field.key}`}
                    className="text-muted-foreground text-xs font-medium"
                  >
                    {field.label} <span className="text-danger">*</span>
                  </label>
                  {field.type === 'select' ? (
                    <Select
                      id={`field-${field.key}`}
                      value={config[field.key] ?? ''}
                      onChange={(e) => handleConfigChange(field.key, e.target.value)}
                      invalid={!!errors[field.key]}
                    >
                      <option value="">Select...</option>
                      {field.options?.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Input
                      id={`field-${field.key}`}
                      type={field.type === 'password' ? 'password' : 'text'}
                      value={config[field.key] ?? ''}
                      onChange={(e) => handleConfigChange(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      invalid={!!errors[field.key]}
                    />
                  )}
                  {field.description && (
                    <p className="text-muted-foreground text-[10px]">{field.description}</p>
                  )}
                  {errors[field.key] && <p className="text-danger text-xs">{errors[field.key]}</p>}
                </div>
              ))}

            {mode === 'hosted' && (
              <div className="bg-accent/5 border-accent/20 text-muted-foreground rounded-lg border p-4 text-sm">
                <p>Using DerList hosted service. No API key required.</p>
                <p className="mt-1 text-xs">You can switch to your own API key anytime.</p>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Advanced Settings */}
        {currentStep === 'advanced' && (
          <div className="space-y-4">
            {/* Optional config fields grouped */}
            {mode === 'personal' && groupedOptional.size > 0 && (
              <div className="border-border bg-card space-y-4 rounded-xl border p-5">
                <h2 className="text-sm font-semibold">Optional Configuration</h2>
                {Array.from(groupedOptional.entries()).map(([group, fields]) => (
                  <div key={group}>
                    <h3 className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                      {group}
                    </h3>
                    <div className="space-y-3">
                      {fields.map((field) => (
                        <div key={field.key} className="space-y-1.5">
                          <label
                            htmlFor={`opt-${field.key}`}
                            className="text-muted-foreground text-xs font-medium"
                          >
                            {field.label}
                          </label>
                          {field.type === 'select' ? (
                            <Select
                              id={`opt-${field.key}`}
                              value={config[field.key] ?? (field.defaultValue as string) ?? ''}
                              onChange={(e) => handleConfigChange(field.key, e.target.value)}
                            >
                              <option value="">Default</option>
                              {field.options?.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </Select>
                          ) : (
                            <Input
                              id={`opt-${field.key}`}
                              type={
                                field.type === 'password'
                                  ? 'password'
                                  : field.type === 'number'
                                    ? 'number'
                                    : 'text'
                              }
                              value={config[field.key] ?? ''}
                              onChange={(e) => handleConfigChange(field.key, e.target.value)}
                              placeholder={
                                field.placeholder ??
                                (field.defaultValue != null
                                  ? String(field.defaultValue)
                                  : undefined)
                              }
                              min={field.min}
                              max={field.max}
                            />
                          )}
                          {field.description && (
                            <p className="text-muted-foreground text-[10px]">{field.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* System settings */}
            <div className="border-border bg-card space-y-4 rounded-xl border p-5">
              <h2 className="text-sm font-semibold">System Settings</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label
                    htmlFor="adv-enabled"
                    className="text-muted-foreground text-xs font-medium"
                  >
                    Status
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      id="adv-enabled"
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      onClick={() => setEnabled(!enabled)}
                      className={cn(
                        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                        enabled ? 'bg-accent' : 'bg-border'
                      )}
                    >
                      <span
                        className={cn(
                          'inline-block h-4 w-4 rounded-full bg-white transition-transform',
                          enabled ? 'translate-x-6' : 'translate-x-1'
                        )}
                      />
                    </button>
                    <span className="text-muted-foreground text-xs">
                      {enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="adv-priority"
                    className="text-muted-foreground text-xs font-medium"
                  >
                    Priority (1=highest)
                  </label>
                  <Input
                    id="adv-priority"
                    type="number"
                    min={1}
                    max={100}
                    value={priority}
                    onChange={(e) => setPriority(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="adv-timeout"
                    className="text-muted-foreground text-xs font-medium"
                  >
                    Timeout (seconds)
                  </label>
                  <Input
                    id="adv-timeout"
                    type="number"
                    min={5}
                    max={120}
                    value={timeout}
                    onChange={(e) => setTimeout_(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="adv-retry" className="text-muted-foreground text-xs font-medium">
                    Retries
                  </label>
                  <Input
                    id="adv-retry"
                    type="number"
                    min={0}
                    max={10}
                    value={retryCount}
                    onChange={(e) => setRetryCount(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="adv-rate" className="text-muted-foreground text-xs font-medium">
                    Rate Limit (req/min)
                  </label>
                  <Input
                    id="adv-rate"
                    type="number"
                    min={1}
                    max={1000}
                    value={rateLimit}
                    onChange={(e) => setRateLimit(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="adv-health" className="text-muted-foreground text-xs font-medium">
                    Health Check (seconds)
                  </label>
                  <Input
                    id="adv-health"
                    type="number"
                    min={60}
                    max={3600}
                    value={healthInterval}
                    onChange={(e) => setHealthInterval(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Test Connection */}
        {currentStep === 'test' && (
          <div className="border-border bg-card space-y-4 rounded-xl border p-5">
            <h2 className="text-sm font-semibold">Test Connection</h2>
            <p className="text-muted-foreground text-xs">
              Verify your configuration by making a real API call.
            </p>

            <Button
              variant="primary"
              size="md"
              onClick={handleTest}
              disabled={testing}
              className="gap-2"
            >
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {testing ? 'Testing...' : 'Run Test'}
            </Button>

            {/* Test Result */}
            {testResult && (
              <div
                className={cn(
                  'space-y-3 rounded-xl border p-5',
                  testResult.success
                    ? 'border-success/30 bg-success/5'
                    : 'border-danger/30 bg-danger/5'
                )}
              >
                {/* Status */}
                <div className="flex items-center gap-2">
                  {testResult.success ? (
                    <CheckCircle2 className="text-success h-5 w-5" />
                  ) : (
                    <XCircle className="text-danger h-5 w-5" />
                  )}
                  <span
                    className={cn(
                      'text-sm font-semibold',
                      testResult.success ? 'text-success' : 'text-danger'
                    )}
                  >
                    {testResult.message}
                  </span>
                </div>

                {/* Details Grid */}
                {testResult.success && testResult.details && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {testResult.latencyMs != null && (
                      <div className="bg-surface rounded-lg p-3">
                        <p className="text-muted-foreground text-[10px] font-medium uppercase">
                          Latency
                        </p>
                        <p className="text-foreground text-lg font-bold">
                          {testResult.latencyMs}ms
                        </p>
                      </div>
                    )}
                    {testResult.details.modelCount != null && (
                      <div className="bg-surface rounded-lg p-3">
                        <p className="text-muted-foreground text-[10px] font-medium uppercase">
                          Models
                        </p>
                        <p className="text-foreground text-lg font-bold">
                          {testResult.details.modelCount}
                        </p>
                      </div>
                    )}
                    {testResult.details.quota && (
                      <div className="bg-surface rounded-lg p-3">
                        <p className="text-muted-foreground text-[10px] font-medium uppercase">
                          Quota
                        </p>
                        <p className="text-foreground text-lg font-bold">
                          {testResult.details.quota}
                        </p>
                      </div>
                    )}
                    {testResult.details.plan && (
                      <div className="bg-surface rounded-lg p-3">
                        <p className="text-muted-foreground text-[10px] font-medium uppercase">
                          Plan
                        </p>
                        <p className="text-foreground text-lg font-bold">
                          {testResult.details.plan}
                        </p>
                      </div>
                    )}
                    {testResult.details.rateLimitRemaining != null && (
                      <div className="bg-surface rounded-lg p-3">
                        <p className="text-muted-foreground text-[10px] font-medium uppercase">
                          Remaining
                        </p>
                        <p className="text-foreground text-lg font-bold">
                          {testResult.details.rateLimitRemaining}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Error Details */}
                {!testResult.success && testResult.error && (
                  <div className="space-y-1 text-sm">
                    {testResult.error.httpStatus && (
                      <p className="text-danger">HTTP {testResult.error.httpStatus}</p>
                    )}
                    {testResult.error.suggestion && (
                      <p className="text-muted-foreground text-xs">{testResult.error.suggestion}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {!testResult && !testing && (
              <p className="text-muted-foreground text-xs">
                You can skip this step and save directly.
              </p>
            )}
          </div>
        )}

        {/* Step 5: Save */}
        {currentStep === 'save' && (
          <div className="border-border bg-card space-y-4 rounded-xl border p-5">
            <h2 className="text-sm font-semibold">Review & Save</h2>

            <div className="space-y-3">
              <div className="bg-surface flex items-center justify-between rounded-lg p-3">
                <span className="text-muted-foreground text-xs">Provider</span>
                <span className="text-sm font-medium">{entry.name}</span>
              </div>
              <div className="bg-surface flex items-center justify-between rounded-lg p-3">
                <span className="text-muted-foreground text-xs">Display Name</span>
                <span className="text-sm font-medium">{name}</span>
              </div>
              <div className="bg-surface flex items-center justify-between rounded-lg p-3">
                <span className="text-muted-foreground text-xs">Mode</span>
                <Badge variant="secondary">
                  {mode === 'hosted' ? 'DerList Hosted' : 'Personal API'}
                </Badge>
              </div>
              <div className="bg-surface flex items-center justify-between rounded-lg p-3">
                <span className="text-muted-foreground text-xs">Priority</span>
                <span className="text-sm font-medium">{priority}</span>
              </div>
              <div className="bg-surface flex items-center justify-between rounded-lg p-3">
                <span className="text-muted-foreground text-xs">Status</span>
                <Badge variant={enabled ? 'success' : 'secondary'}>
                  {enabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
              {testResult?.success && (
                <div className="bg-surface flex items-center justify-between rounded-lg p-3">
                  <span className="text-muted-foreground text-xs">Test</span>
                  <Badge variant="success">Passed ({testResult.latencyMs}ms)</Badge>
                </div>
              )}
            </div>

            <Button
              variant="primary"
              size="lg"
              onClick={handleSave}
              disabled={saving}
              className="w-full gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isEditing ? 'Save Changes' : 'Add Integration'}
            </Button>
          </div>
        )}
      </div>

      {/* Navigation Footer */}
      <div className="border-border flex items-center justify-between border-t pt-4">
        <Button variant="ghost" size="md" onClick={goPrev} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          {stepIndex === 0 ? 'Cancel' : 'Back'}
        </Button>

        {currentStep !== 'save' && (
          <Button
            variant="primary"
            size="md"
            onClick={goNext}
            disabled={!canGoNext}
            className="gap-1.5"
          >
            Next
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
