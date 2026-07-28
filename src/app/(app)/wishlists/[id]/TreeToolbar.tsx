'use client';

/**
 * TreeToolbar — Expand All / Collapse All controls for the item tree.
 */
import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface TreeToolbarProps {
  onExpandAll: () => void;
  onCollapseAll: () => void;
  hasParents: boolean;
}

export function TreeToolbar({ onExpandAll, onCollapseAll, hasParents }: TreeToolbarProps) {
  if (!hasParents) return null;

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground h-7 gap-1.5 rounded-lg text-[10px]"
        onClick={onExpandAll}
        title="Expand all nested items"
      >
        <ChevronsUpDown className="h-3 w-3" />
        Expand
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground h-7 gap-1.5 rounded-lg text-[10px]"
        onClick={onCollapseAll}
        title="Collapse all nested items"
      >
        <ChevronsDownUp className="h-3 w-3" />
        Collapse
      </Button>
    </div>
  );
}
