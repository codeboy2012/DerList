'use client';

/**
 * ProviderCard — Rich card for displaying an integration in the catalog.
 *
 * Shows provider icon, name, description, badges, connection status,
 * and action menu (Edit, Disable, Duplicate, Delete, Test, Health).
 */
import { useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Copy,
  Edit3,
  ExternalLink,
  FileText,
  Loader2,
  MoreVertical,
  Plus,
  Power,
  PowerOff,
  Trash2,
  Zap,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import type { IntegrationCatalogEntry } from '@/lib/providers/registry/integration-types';
import { Badge } from '@/components/ui/Badge';
import { Dropdown, type DropdownItem } from '@/components/ui/Dropdown';
import { useToast } from '@/components/ui/Toast';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ConfiguredProvider {
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

interface ProviderCardProps {
  entry: IntegrationCatalogEntry;
  configured: ConfiguredProvider | null;
  onConfigure: () => void;
  onToggle?: (enabled: boolean) => void;
  onDelete?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Status helpers
// ─────────────────────────────────────────────────────────────────────────────

function getStatusColor(status: string): string {
  switch (status) {
    case 'healthy':
    case 'HEALTHY':
      return 'bg-success';
    case 'degraded':
    case 'DEGRADED':
      return 'bg-warning';
    case 'error':
    case 'ERROR':
      return 'bg-danger';
    default:
      return 'bg-muted';
  }
}

function getPricingBadge(entry: IntegrationCatalogEntry) {
  if (entry.free || entry.pricing === 'free') {
    return <Badge variant="success">Free</Badge>;
  }
  if (entry.pricing === 'freemium') {
    return <Badge variant="accent">Free Tier</Badge>;
  }
  if (entry.pricing === 'enterprise') {
    return <Badge variant="warning">Enterprise</Badge>;
  }
  return <Badge variant="secondary">Paid</Badge>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function ProviderCard({
  entry,
  configured,
  onConfigure,
  onToggle,
  onDelete,
}: ProviderCardProps) {
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const toast = useToast();

  const isConnected = !!configured;
  const isEnabled = configured?.enabled ?? false;

  const handleTest = async () => {
    if (!configured) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/providers/${configured.id}/test`, { method: 'POST' });
      const data = await res.json();
      const result = {
        success: data.success,
        message: data.message || (data.success ? 'Healthy' : 'Failed'),
      };
      setTestResult(result);
      if (data.success) toast.success(`${entry.name}: Connection verified`);
      else toast.error(`${entry.name}: ${result.message}`);
    } catch {
      setTestResult({ success: false, message: 'Test failed' });
      toast.error('Connection test failed');
    } finally {
      setIsTesting(false);
    }
  };

  const handleDelete = async () => {
    if (!configured) return;
    if (!confirm(`Remove ${entry.name}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/providers/${configured.id}`, { method: 'DELETE' });
      if (res.ok) onDelete?.();
      else toast.error('Failed to remove integration');
    } catch {
      toast.error('Failed to remove integration');
    }
  };

  const handleDuplicate = async () => {
    if (!configured) return;
    toast.success(`Duplicating ${entry.name}...`);
    // Opens configure with a clone (handled in parent)
    onConfigure();
  };

  // Build dropdown menu items
  const menuItems: DropdownItem[] = [];
  if (isConnected) {
    menuItems.push(
      { label: 'Edit', value: 'edit', icon: <Edit3 className="h-3.5 w-3.5" /> },
      {
        label: isEnabled ? 'Disable' : 'Enable',
        value: 'toggle',
        icon: isEnabled ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />,
      },
      { label: 'Test Connection', value: 'test', icon: <Activity className="h-3.5 w-3.5" /> },
      { label: 'Duplicate', value: 'duplicate', icon: <Copy className="h-3.5 w-3.5" /> },
      {
        label: 'Delete',
        value: 'delete',
        destructive: true,
        icon: <Trash2 className="h-3.5 w-3.5" />,
      }
    );
  }

  const handleMenuAction = (value: string) => {
    switch (value) {
      case 'edit':
        onConfigure();
        break;
      case 'toggle':
        onToggle?.(!isEnabled);
        break;
      case 'test':
        handleTest();
        break;
      case 'duplicate':
        handleDuplicate();
        break;
      case 'delete':
        handleDelete();
        break;
    }
  };

  return (
    <div
      className={cn(
        'group relative flex flex-col rounded-xl border p-4 transition-all duration-200',
        'hover:shadow-md',
        isConnected && isEnabled
          ? 'border-accent/30 bg-accent/[0.03] hover:border-accent/50'
          : 'border-border bg-card hover:border-border-hover hover:bg-card-hover',
        entry.comingSoon && 'pointer-events-none opacity-60'
      )}
      style={
        entry.brand?.color && isConnected ? { borderColor: `${entry.brand.color}30` } : undefined
      }
    >
      {/* Top Row: Brand dot + Status + Action menu */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          {/* Brand color dot or status indicator */}
          {isConnected ? (
            <span
              className={cn(
                'h-2.5 w-2.5 flex-shrink-0 rounded-full',
                getStatusColor(configured.lastStatus)
              )}
              title={configured.lastStatus}
            />
          ) : entry.brand?.color ? (
            <span
              className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
              style={{ background: entry.brand.color }}
            />
          ) : null}

          {/* Provider Name */}
          <h3 className="truncate text-sm font-semibold">{entry.name}</h3>
        </div>

        {/* Action Menu */}
        {isConnected && menuItems.length > 0 && (
          <Dropdown
            trigger={
              <span className="text-muted-foreground hover:text-foreground transition-colors">
                <MoreVertical className="h-4 w-4" />
              </span>
            }
            items={menuItems}
            onSelect={handleMenuAction}
            align="end"
            label={`Actions for ${entry.name}`}
          />
        )}
      </div>

      {/* Description */}
      <p className="text-muted-foreground mt-2 line-clamp-2 text-xs leading-relaxed">
        {entry.description}
      </p>

      {/* Badges */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {isConnected && (
          <Badge variant="success">
            <CheckCircle2 className="h-3 w-3" />
            Connected
          </Badge>
        )}
        {getPricingBadge(entry)}
        {entry.selfHosted && <Badge variant="secondary">Self Hosted</Badge>}
        {entry.recommended && <Badge variant="accent">Recommended</Badge>}
        {entry.supportsHosted && <Badge variant="secondary">BYOAPI</Badge>}
        {entry.comingSoon && <Badge variant="warning">Coming Soon</Badge>}
        {entry.freeTier && !isConnected && (
          <span className="text-muted-foreground text-[10px]">{entry.freeTier}</span>
        )}
      </div>

      {/* Test Result */}
      {testResult && (
        <div
          className={cn(
            'mt-2 rounded-md px-2.5 py-1.5 text-xs',
            testResult.success ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
          )}
        >
          {testResult.message}
        </div>
      )}

      {/* Footer: Links + Connect button */}
      <div className="mt-auto flex items-center justify-between pt-3">
        <div className="flex items-center gap-2">
          {entry.website && (
            <a
              href={entry.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Website"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          {entry.docsUrl && (
            <a
              href={entry.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Documentation"
            >
              <FileText className="h-3.5 w-3.5" />
            </a>
          )}
        </div>

        {!isConnected && !entry.comingSoon && (
          <button
            type="button"
            onClick={onConfigure}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium',
              'bg-accent text-accent-foreground hover:bg-accent/90 transition-colors'
            )}
          >
            <Plus className="h-3 w-3" />
            Connect
          </button>
        )}

        {isConnected && (
          <button
            type="button"
            onClick={onConfigure}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium',
              'border-border text-foreground hover:bg-surface border transition-colors'
            )}
          >
            <Edit3 className="h-3 w-3" />
            Configure
          </button>
        )}

        {isTesting && <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />}
      </div>
    </div>
  );
}
