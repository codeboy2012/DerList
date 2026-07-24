'use client';

import { useState } from 'react';

import { Card, CardContent } from '@/components/ui/Card';
import { cn } from '@/utils/cn';
import { Link2, PenLine, Search } from 'lucide-react';

import { ImportTab } from './ImportTab';
import { ManualTab } from './ManualTab';
import { SearchTab } from './SearchTab';

interface AddItemPanelProps {
  wishlistId: string;
}

/**
 * Tabbed panel for adding items:
 * - Import Product (paste URL)
 * - Search Database (find existing products)
 * - Manual Entry (type details)
 */
export function AddItemPanel({ wishlistId }: AddItemPanelProps) {
  const [tab, setTab] = useState<'import' | 'search' | 'manual'>('import');

  return (
    <Card className="max-w-2xl">
      {/* Tab bar */}
      <div className="flex border-b border-border overflow-x-auto">
        <TabButton active={tab === 'import'} onClick={() => setTab('import')} icon={<Link2 className="h-4 w-4" />} label="Import URL" />
        <TabButton active={tab === 'search'} onClick={() => setTab('search')} icon={<Search className="h-4 w-4" />} label="Search Database" />
        <TabButton active={tab === 'manual'} onClick={() => setTab('manual')} icon={<PenLine className="h-4 w-4" />} label="Manual" />
      </div>

      <CardContent className="pt-6">
        {tab === 'import' && <ImportTab wishlistId={wishlistId} />}
        {tab === 'search' && <SearchTab wishlistId={wishlistId} />}
        {tab === 'manual' && <ManualTab wishlistId={wishlistId} />}
      </CardContent>
    </Card>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 whitespace-nowrap px-4 py-3 text-[13px] font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        active
          ? 'border-b-2 border-accent text-accent'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {icon}
      {label}
    </button>
  );
}
