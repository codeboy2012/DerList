'use client';

/**
 * Honest empty states for import methods that do not exist in this build.
 *
 * There is no HTML/Markdown/JSON document importer and no CSV/.derlist restore
 * route. Showing a working-looking form here would be misleading, so these tabs
 * explain the gap and route users to the import methods that do work.
 */
import { ArrowRight, Code2, FileUp, Info } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

interface ImportUnavailableTabProps {
  kind: 'website' | 'file';
  onSwitchTab: (tab: 'url' | 'text' | 'manual') => void;
}

export function ImportUnavailableTab({ kind, onSwitchTab }: ImportUnavailableTabProps) {
  const isWebsite = kind === 'website';

  return (
    <div className="space-y-4">
      <div className="border-border rounded-xl border border-dashed p-6">
        <div className="bg-surface mx-auto flex h-10 w-10 items-center justify-center rounded-lg">
          {isWebsite ? (
            <Code2 className="text-muted-foreground h-5 w-5" />
          ) : (
            <FileUp className="text-muted-foreground h-5 w-5" />
          )}
        </div>
        <div className="mt-3 text-center">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <h3 className="text-foreground text-sm font-medium">
              {isWebsite ? 'Structured website data' : 'File import'} is not available yet
            </h3>
            <Badge variant="secondary">Not implemented</Badge>
          </div>
          <p className="text-muted-foreground mx-auto mt-2 max-w-lg text-xs leading-relaxed">
            {isWebsite
              ? 'This build does not parse pasted HTML, Markdown, JSON, or JSON-LD documents. The Product URL tab can read a live product page, and Find Products from Text can extract products from copied text.'
              : 'This build does not implement CSV import or DerList .derlist restore. The existing account export is a JSON download and cannot be re-imported here.'}
          </p>
        </div>
      </div>

      <div className="border-border bg-surface/40 flex items-start gap-2 rounded-lg border p-3">
        <Info className="text-muted-foreground mt-0.5 h-3.5 w-3.5 shrink-0" />
        <p className="text-muted-foreground text-xs leading-relaxed">
          {isWebsite
            ? 'Nothing on this tab saves data. Use a working import method below; no HTML/JSON parser or mock preview is being shown.'
            : 'Nothing on this tab saves data. No fake file picker or restore flow is being shown.'}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onSwitchTab('url')}>
          Use Product URL
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="secondary" onClick={() => onSwitchTab('text')}>
          Find Products from Text
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onSwitchTab('manual')}>
          Manual Entry
        </Button>
      </div>
    </div>
  );
}
