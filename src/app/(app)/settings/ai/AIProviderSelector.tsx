'use client';

/**
 * AI Provider Selector Component
 * 
 * Interactive UI for selecting and configuring AI providers.
 * Handles provider selection, configuration forms, and testing.
 */

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { ProviderMetadata } from '@/lib/ai/providers';
import { updateUserAIProvider, testAIProviderConfig } from '../actions';
import { CheckCircle, XCircle, ExternalLink, AlertTriangle } from 'lucide-react';

interface AIProviderSelectorProps {
  availableProviders: ProviderMetadata[];
  currentProviderId: string | null;
  currentConfig: Record<string, unknown>;
  userId: string;
}

export function AIProviderSelector({
  availableProviders,
  currentProviderId,
  currentConfig,
  userId,
}: AIProviderSelectorProps) {
  const [selectedProviderId, setSelectedProviderId] = useState(currentProviderId);
  const [config, setConfig] = useState<Record<string, unknown>>(currentConfig);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isPending, startTransition] = useTransition();

  const selectedProvider = availableProviders.find(p => p.id === selectedProviderId);

  const handleProviderChange = (providerId: string) => {
    setSelectedProviderId(providerId);
    setConfig({}); // Reset config when changing providers
    setTestResult(null);
  };

  const handleConfigChange = (key: string, value: unknown) => {
    setConfig(prev => ({
      ...prev,
      [key]: value,
    }));
    setTestResult(null); // Clear test result when config changes
  };

  const handleTest = async () => {
    if (!selectedProviderId) return;

    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await testAIProviderConfig(selectedProviderId, config);
      setTestResult({
        success: result.available,
        message: result.available 
          ? 'Provider configuration is working correctly!'
          : result.error || 'Provider test failed',
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to test provider',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    if (!selectedProviderId) return;

    startTransition(async () => {
      try {
        await updateUserAIProvider(userId, selectedProviderId, config);
        // Show success feedback
        setTestResult({
          success: true,
          message: 'AI provider settings saved successfully!',
        });
      } catch (error) {
        setTestResult({
          success: false,
          message: error instanceof Error ? error.message : 'Failed to save settings',
        });
      }
    });
  };

  const isConfigValid = selectedProvider && Object.entries(selectedProvider.configSchema)
    .filter(([, schema]) => schema.required)
    .every(([key]) => config[key]);

  return (
    <div className="space-y-6">
      {/* Provider Selection */}
      <div className="grid gap-4">
        <h3 className="font-medium">Available Providers</h3>
        <div className="grid gap-3">
          {availableProviders.map((provider) => (
            <Card
              key={provider.id}
              className={`p-4 cursor-pointer transition-colors ${
                selectedProviderId === provider.id
                  ? 'bg-accent/10 border-accent'
                  : 'hover:bg-surface/50'
              }`}
              onClick={() => handleProviderChange(provider.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium">{provider.name}</h4>
                    <Badge
                      variant={
                        provider.pricing?.type === 'free'
                          ? 'success'
                          : provider.pricing?.type === 'freemium'
                          ? 'warning'
                          : 'secondary'
                      }
                    >
                      {provider.pricing?.type || 'unknown'}
                    </Badge>
                    {provider.id === 'serpapi' && (
                      <Badge variant="accent">Recommended</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {provider.description}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {provider.pricing?.description || 'No pricing information available'}
                  </p>
                  
                  {/* Feature badges */}
                  <div className="flex flex-wrap gap-1 mt-3">
                    {Object.entries(provider.features)
                      .filter(([, supported]) => supported)
                      .map(([feature]) => (
                        <Badge key={feature} variant="outline" className="text-xs">
                          {feature.replace(/([A-Z])/g, ' $1').toLowerCase()}
                        </Badge>
                      ))}
                  </div>
                </div>
                
                {provider.homepage && (
                  <Button
                    variant="ghost"
                    size="sm"
                    asChild
                    onClick={(e) => e.stopPropagation()}
                  >
                    <a
                      href={provider.homepage}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Visit
                    </a>
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Provider Configuration */}
      {selectedProvider && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h3 className="font-medium">Configure {selectedProvider.name}</h3>
            {selectedProviderId === currentProviderId && (
              <Badge variant="success">Currently Active</Badge>
            )}
          </div>

          <Card className="p-4">
            <div className="space-y-4">
              {Object.entries(selectedProvider.configSchema).map(([key, schema]) => (
                <div key={key} className="space-y-2">
                  <label className="block text-sm font-medium">
                    {schema.label}
                    {schema.required && <span className="text-destructive ml-1">*</span>}
                  </label>
                  {schema.description && (
                    <p className="text-xs text-muted-foreground">{schema.description}</p>
                  )}
                  
                  {schema.type === 'select' && schema.options ? (
                    <Select
                      value={(config[key] as string) || ''}
                      onChange={(e) => handleConfigChange(key, e.target.value)}
                    >
                      <option value="">Select {schema.label}</option>
                      {schema.options.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>
                  ) : schema.type === 'boolean' ? (
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={Boolean(config[key])}
                        onChange={(e) => handleConfigChange(key, e.target.checked)}
                        className="rounded border border-input"
                      />
                      Enable {schema.label}
                    </label>
                  ) : (
                    <Input
                      type={schema.type === 'number' ? 'number' : key.toLowerCase().includes('key') || key.toLowerCase().includes('secret') ? 'password' : 'text'}
                      value={(config[key] as string) || ''}
                      onChange={(e) => handleConfigChange(key, schema.type === 'number' ? Number(e.target.value) : e.target.value)}
                      placeholder={`Enter ${schema.label.toLowerCase()}`}
                    />
                  )}
                </div>
              ))}

              {/* Available Models */}
              {selectedProvider.models.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium">Available Models</label>
                  <div className="text-xs text-muted-foreground space-y-1">
                    {selectedProvider.models.map((model) => (
                      <div key={model.id} className="flex items-center justify-between">
                        <span className="font-mono">{model.id}</span>
                        <span>{model.capabilities.join(', ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Test and Save Actions */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={!isConfigValid || isTesting}
            >
              {isTesting ? (
                <>
                  <Spinner className="h-4 w-4 mr-2" />
                  Testing...
                </>
              ) : (
                'Test Configuration'
              )}
            </Button>

            <Button
              onClick={handleSave}
              disabled={!isConfigValid || !testResult?.success || isPending}
            >
              {isPending ? (
                <>
                  <Spinner className="h-4 w-4 mr-2" />
                  Saving...
                </>
              ) : (
                'Save Settings'
              )}
            </Button>
          </div>

          {/* Test Result */}
          {testResult && (
            <div
              className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                testResult.success
                  ? 'bg-success/10 text-success border border-success/20'
                  : 'bg-destructive/10 text-destructive border border-destructive/20'
              }`}
            >
              {testResult.success ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              {testResult.message}
            </div>
          )}

          {/* Configuration Warning */}
          {!isConfigValid && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 text-warning border border-warning/20 text-sm">
              <AlertTriangle className="h-4 w-4" />
              Please fill in all required fields before testing or saving.
            </div>
          )}
        </div>
      )}
    </div>
  );
}