'use client';

import { useState } from 'react';
import { AlertTriangle, Bot, Check, List, Loader2, Shield, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';

interface Props {
  permissions: Record<string, boolean>;
}

const PERMISSION_ITEMS = [
  {
    key: 'wishlist.read',
    label: 'View wishlist',
    description: 'Allow the assistant to see your wishlist items',
    icon: List,
  },
  {
    key: 'wishlist.add',
    label: 'Add items',
    description: 'Allow the assistant to add products to your wishlists',
    icon: List,
  },
  {
    key: 'wishlist.remove',
    label: 'Remove items',
    description: 'Allow the assistant to remove items from your wishlists',
    icon: Trash2,
  },
  {
    key: 'wishlist.update',
    label: 'Edit items',
    description: 'Allow the assistant to edit wishlist item details',
    icon: List,
  },
] as const;

export function AISettingsForm({ permissions: initialPermissions }: Props) {
  const [permissions, setPermissions] = useState<Record<string, boolean>>(initialPermissions);
  const [isSaving, setIsSaving] = useState(false);
  const toast = useToast();

  const togglePermission = (key: string) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/settings/ai-permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions }),
      });
      if (res.ok) {
        toast.success('AI permissions saved');
      } else {
        toast.error('Failed to save permissions');
      }
    } catch {
      toast.error('Failed to save permissions');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevokeAll = async () => {
    if (!confirm('Revoke all AI access? The assistant will not be able to access your wishlist.')) return;
    const cleared: Record<string, boolean> = {};
    for (const item of PERMISSION_ITEMS) {
      cleared[item.key] = false;
    }
    setPermissions(cleared);
    setIsSaving(true);
    try {
      await fetch('/api/settings/ai-permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: cleared }),
      });
      toast.success('All AI access revoked');
    } catch {
      toast.error('Failed to revoke access');
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = JSON.stringify(permissions) !== JSON.stringify(initialPermissions);

  return (
    <div className="space-y-6">
      {/* Wishlist Access */}
      <Card className="p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="bg-accent/10 flex h-10 w-10 items-center justify-center rounded-xl">
            <Shield className="text-accent h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold">Wishlist Access</h2>
            <p className="text-muted-foreground text-sm">
              Control what the Shopping Assistant can do with your wishlists.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {PERMISSION_ITEMS.map((item) => {
            const enabled = permissions[item.key] ?? false;
            return (
              <label
                key={item.key}
                className="border-border hover:bg-surface/50 flex cursor-pointer items-center gap-4 rounded-xl border p-4 transition-colors"
              >
                <div className="flex-1">
                  <span className="text-sm font-medium">{item.label}</span>
                  <p className="text-muted-foreground text-xs">{item.description}</p>
                </div>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={() => togglePermission(item.key)}
                    className="peer sr-only"
                  />
                  <div className="peer-checked:bg-accent h-6 w-11 rounded-full bg-gray-600 transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-transform after:content-[''] peer-checked:after:translate-x-5" />
                </div>
              </label>
            );
          })}
        </div>

        <div className="mt-5 flex items-center gap-3">
          <Button onClick={handleSave} disabled={!hasChanges || isSaving} size="md" className="gap-2">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Save Permissions
          </Button>
        </div>
      </Card>

      {/* Danger zone */}
      <Card className="border-danger/20 p-6">
        <div className="mb-4 flex items-center gap-3">
          <AlertTriangle className="text-danger h-5 w-5" />
          <h3 className="font-semibold">Revoke All AI Access</h3>
        </div>
        <p className="text-muted-foreground mb-4 text-sm">
          Immediately prevent the Shopping Assistant from accessing or modifying your wishlists.
        </p>
        <Button variant="danger" size="sm" onClick={handleRevokeAll} className="gap-2">
          <Shield className="h-3.5 w-3.5" />
          Revoke All Access
        </Button>
      </Card>
    </div>
  );
}
