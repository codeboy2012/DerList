'use client';

/**
 * CustomApiBuilder — Generic REST API builder.
 *
 * Users can connect ANY REST API with full configuration:
 * name, category, base URL, auth type, custom headers,
 * endpoint definitions, timeout, rate limit, response format,
 * JSON path mapping, and test request.
 */
import { useCallback, useState } from 'react';
import { ArrowLeft, CheckCircle2, Code, Loader2, Plus, Save, Trash2, Zap } from 'lucide-react';
import { cn } from '@/utils/cn';
import {
  CATEGORIES,
  type AuthType,
  type IntegrationCategory,
} from '@/lib/providers/registry/integration-types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface HeaderEntry {
  key: string;
  value: string;
}

interface EndpointEntry {
  type: string;
  path: string;
}

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

interface CustomApiBuilderProps {
  onBack: () => void;
  onSaved: (provider: SerializedProvider) => void;
}

const AUTH_TYPES: { value: AuthType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'bearer', label: 'Bearer Token' },
  { value: 'basic', label: 'Basic Auth' },
  { value: 'api-key-header', label: 'API Key Header' },
  { value: 'oauth2', label: 'OAuth2' },
  { value: 'custom', label: 'Custom Headers' },
];

const ENDPOINT_TYPES = [
  'search',
  'images',
  'news',
  'autocomplete',
  'chat',
  'price',
  'webhook',
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function CustomApiBuilder({ onBack, onSaved }: CustomApiBuilderProps) {
  const toast = useToast();

  // Basic
  const [name, setName] = useState('');
  const [category, setCategory] = useState<IntegrationCategory>('custom');
  const [baseUrl, setBaseUrl] = useState('');

  // Auth
  const [authType, setAuthType] = useState<AuthType>('none');
  const [authToken, setAuthToken] = useState('');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authHeaderName, setAuthHeaderName] = useState('X-API-Key');
  const [authHeaderValue, setAuthHeaderValue] = useState('');

  // Headers
  const [headers, setHeaders] = useState<HeaderEntry[]>([]);

  // Endpoints
  const [endpoints, setEndpoints] = useState<EndpointEntry[]>([]);

  // Advanced
  const [timeout, setTimeout_] = useState(30);
  const [rateLimit, setRateLimit] = useState(60);
  const [responseFormat, setResponseFormat] = useState<'json' | 'xml' | 'text'>('json');
  const [jsonPathMapping, setJsonPathMapping] = useState('');

  // UI
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // ─── Header management ───

  const addHeader = () => setHeaders((prev) => [...prev, { key: '', value: '' }]);
  const removeHeader = (idx: number) => setHeaders((prev) => prev.filter((_, i) => i !== idx));
  const updateHeader = (idx: number, field: 'key' | 'value', val: string) => {
    setHeaders((prev) => prev.map((h, i) => (i === idx ? { ...h, [field]: val } : h)));
  };

  // ─── Endpoint management ───

  const addEndpoint = () => setEndpoints((prev) => [...prev, { type: 'search', path: '' }]);
  const removeEndpoint = (idx: number) => setEndpoints((prev) => prev.filter((_, i) => i !== idx));
  const updateEndpoint = (idx: number, field: 'type' | 'path', val: string) => {
    setEndpoints((prev) => prev.map((e, i) => (i === idx ? { ...e, [field]: val } : e)));
  };

  // ─── Build config ───

  const buildConfig = useCallback(() => {
    const authConfig: Record<string, string> = {};
    switch (authType) {
      case 'bearer':
        authConfig.token = authToken;
        break;
      case 'basic':
        authConfig.username = authUsername;
        authConfig.password = authPassword;
        break;
      case 'api-key-header':
        authConfig.headerName = authHeaderName;
        authConfig.headerValue = authHeaderValue;
        break;
    }

    const headerMap: Record<string, string> = {};
    for (const h of headers) {
      if (h.key.trim()) headerMap[h.key.trim()] = h.value;
    }

    const endpointMap: Record<string, string> = {};
    for (const e of endpoints) {
      if (e.path.trim()) endpointMap[e.type] = e.path.trim();
    }

    return {
      baseUrl,
      authType,
      authConfig,
      headers: headerMap,
      endpoints: endpointMap,
      timeout,
      rateLimit,
      responseFormat,
      jsonPathMapping: jsonPathMapping.trim() || undefined,
    };
  }, [
    authType,
    authToken,
    authUsername,
    authPassword,
    authHeaderName,
    authHeaderValue,
    headers,
    endpoints,
    baseUrl,
    timeout,
    rateLimit,
    responseFormat,
    jsonPathMapping,
  ]);

  // ─── Test ───

  const handleTest = async () => {
    if (!baseUrl.trim()) {
      toast.error('Base URL is required');
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/providers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: 'custom-api',
          config: buildConfig(),
        }),
      });
      const data = await res.json();
      setTestResult({
        success: data.success,
        message: data.message || (data.success ? 'Connection successful' : 'Connection failed'),
      });
    } catch {
      setTestResult({ success: false, message: 'Test request failed' });
    } finally {
      setTesting(false);
    }
  };

  // ─── Save ───

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Integration name is required');
      return;
    }
    if (!baseUrl.trim()) {
      toast.error('Base URL is required');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: `custom-${category}-${Date.now()}`,
          category: category.toUpperCase(),
          name: name.trim(),
          config: buildConfig(),
          enabled: true,
          priority: 50,
        }),
      });
      const data = await res.json();
      if (data.success && data.provider) {
        onSaved(data.provider);
        toast.success(`${name} connected successfully`);
      } else {
        toast.error(data.error || 'Failed to save');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  };

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
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <Code className="text-accent h-5 w-5" />
            Custom API Builder
          </h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Connect any REST API as a DerList integration.
          </p>
        </div>
      </div>

      {/* Basic Info */}
      <div className="border-border bg-card space-y-4 rounded-xl border p-5">
        <h2 className="text-sm font-semibold">Basic Information</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="custom-name" className="text-muted-foreground text-xs font-medium">
              Integration Name <span className="text-danger">*</span>
            </label>
            <Input
              id="custom-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Custom API"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="custom-category" className="text-muted-foreground text-xs font-medium">
              Category
            </label>
            <Select
              id="custom-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as IntegrationCategory)}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="custom-baseurl" className="text-muted-foreground text-xs font-medium">
            Base URL <span className="text-danger">*</span>
          </label>
          <Input
            id="custom-baseurl"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.example.com/v1"
          />
        </div>
      </div>

      {/* Authentication */}
      <div className="border-border bg-card space-y-4 rounded-xl border p-5">
        <h2 className="text-sm font-semibold">Authentication</h2>

        <div className="space-y-1.5">
          <label htmlFor="custom-auth" className="text-muted-foreground text-xs font-medium">
            Auth Type
          </label>
          <Select
            id="custom-auth"
            value={authType}
            onChange={(e) => setAuthType(e.target.value as AuthType)}
          >
            {AUTH_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>

        {authType === 'bearer' && (
          <div className="space-y-1.5">
            <label htmlFor="auth-token" className="text-muted-foreground text-xs font-medium">
              Bearer Token
            </label>
            <Input
              id="auth-token"
              type="password"
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
              placeholder="your-bearer-token"
            />
          </div>
        )}

        {authType === 'basic' && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="auth-user" className="text-muted-foreground text-xs font-medium">
                Username
              </label>
              <Input
                id="auth-user"
                value={authUsername}
                onChange={(e) => setAuthUsername(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="auth-pass" className="text-muted-foreground text-xs font-medium">
                Password
              </label>
              <Input
                id="auth-pass"
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
              />
            </div>
          </div>
        )}

        {authType === 'api-key-header' && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="auth-hdr-name" className="text-muted-foreground text-xs font-medium">
                Header Name
              </label>
              <Input
                id="auth-hdr-name"
                value={authHeaderName}
                onChange={(e) => setAuthHeaderName(e.target.value)}
                placeholder="X-API-Key"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="auth-hdr-val" className="text-muted-foreground text-xs font-medium">
                Header Value
              </label>
              <Input
                id="auth-hdr-val"
                type="password"
                value={authHeaderValue}
                onChange={(e) => setAuthHeaderValue(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Custom Headers */}
      <div className="border-border bg-card space-y-4 rounded-xl border p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Custom Headers</h2>
          <button
            type="button"
            onClick={addHeader}
            className="text-accent hover:text-accent-hover inline-flex items-center gap-1 text-xs transition-colors"
          >
            <Plus className="h-3 w-3" /> Add Header
          </button>
        </div>

        {headers.length === 0 && (
          <p className="text-muted-foreground text-xs">No custom headers configured.</p>
        )}

        {headers.map((h, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <Input
              value={h.key}
              onChange={(e) => updateHeader(idx, 'key', e.target.value)}
              placeholder="Header-Name"
              className="flex-1"
            />
            <Input
              value={h.value}
              onChange={(e) => updateHeader(idx, 'value', e.target.value)}
              placeholder="value"
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => removeHeader(idx)}
              className="text-muted-foreground hover:text-danger transition-colors"
              aria-label="Remove header"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Endpoints */}
      <div className="border-border bg-card space-y-4 rounded-xl border p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Endpoints</h2>
          <button
            type="button"
            onClick={addEndpoint}
            className="text-accent hover:text-accent-hover inline-flex items-center gap-1 text-xs transition-colors"
          >
            <Plus className="h-3 w-3" /> Add Endpoint
          </button>
        </div>

        <p className="text-muted-foreground text-xs">
          Define which endpoints this API exposes. Paths are relative to the base URL.
        </p>

        {endpoints.map((ep, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <Select
              value={ep.type}
              onChange={(e) => updateEndpoint(idx, 'type', e.target.value)}
              className="w-36"
            >
              {ENDPOINT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
            <Input
              value={ep.path}
              onChange={(e) => updateEndpoint(idx, 'path', e.target.value)}
              placeholder="/search?q={query}"
              className="flex-1"
            />
            <button
              type="button"
              onClick={() => removeEndpoint(idx)}
              className="text-muted-foreground hover:text-danger transition-colors"
              aria-label="Remove endpoint"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Advanced */}
      <div className="border-border bg-card space-y-4 rounded-xl border p-5">
        <h2 className="text-sm font-semibold">Advanced Settings</h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label htmlFor="custom-timeout" className="text-muted-foreground text-xs font-medium">
              Timeout (seconds)
            </label>
            <Input
              id="custom-timeout"
              type="number"
              min={5}
              max={120}
              value={timeout}
              onChange={(e) => setTimeout_(Number(e.target.value))}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="custom-rate" className="text-muted-foreground text-xs font-medium">
              Rate Limit (req/min)
            </label>
            <Input
              id="custom-rate"
              type="number"
              min={1}
              max={1000}
              value={rateLimit}
              onChange={(e) => setRateLimit(Number(e.target.value))}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="custom-format" className="text-muted-foreground text-xs font-medium">
              Response Format
            </label>
            <Select
              id="custom-format"
              value={responseFormat}
              onChange={(e) => setResponseFormat(e.target.value as 'json' | 'xml' | 'text')}
            >
              <option value="json">JSON</option>
              <option value="xml">XML</option>
              <option value="text">Text</option>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="custom-jsonpath" className="text-muted-foreground text-xs font-medium">
            JSON Path Mapping
          </label>
          <Input
            id="custom-jsonpath"
            value={jsonPathMapping}
            onChange={(e) => setJsonPathMapping(e.target.value)}
            placeholder='{"results": "$.data.items", "title": "$.name", "price": "$.cost"}'
          />
          <p className="text-muted-foreground text-[10px]">
            Map response fields to DerList standard fields using JSON path expressions.
          </p>
        </div>
      </div>

      {/* Test Result */}
      {testResult && (
        <div
          className={cn(
            'rounded-xl border p-4 text-sm',
            testResult.success
              ? 'border-success/30 bg-success/5 text-success'
              : 'border-danger/30 bg-danger/5 text-danger'
          )}
        >
          <div className="flex items-center gap-2">
            {testResult.success ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            {testResult.message}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="md"
          onClick={handleTest}
          disabled={testing || !baseUrl.trim()}
          className="gap-2"
        >
          {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          Test Request
        </Button>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="md" onClick={onBack}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleSave}
            disabled={saving || !name.trim() || !baseUrl.trim()}
            className="gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Integration
          </Button>
        </div>
      </div>
    </div>
  );
}
