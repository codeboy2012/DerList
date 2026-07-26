'use client';

/**
 * AIOrganizer — Analyzes entire wishlist and suggests bulk improvements.
 *
 * Shows a button that triggers analysis, then displays a confirmation
 * dialog with a preview of proposed changes before applying anything.
 */
import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

interface AnalysisResult {
  duplicates: number;
  titlesImproved: number;
  descriptionsCleaned: number;
  categoriesCreated: number;
  foldersCreated: number;
  itemsReorganized: number;
  detailsAdded: number;
  suggestions: string[];
}

interface AIOrganizerProps {
  wishlistId: string;
  itemCount: number;
}

type Phase = 'idle' | 'analyzing' | 'preview' | 'applying' | 'done';

export function AIOrganizer({ wishlistId, itemCount }: AIOrganizerProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [changes, setChanges] = useState<unknown[]>([]);
  const toast = useToast();

  const handleAnalyze = async () => {
    if (itemCount < 2) {
      toast.info('Need at least 2 items to organize');
      return;
    }

    setPhase('analyzing');

    try {
      const res = await fetch('/api/wishlists/organize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wishlistId, mode: 'analyze' }),
      });
      const data = await res.json();

      if (data.success && data.analysis) {
        setResult(data.analysis);
        setChanges(data.changes || []);
        setPhase('preview');
      } else {
        toast.error(data.error || 'Analysis failed');
        setPhase('idle');
      }
    } catch {
      toast.error('Failed to analyze wishlist');
      setPhase('idle');
    }
  };

  const handleApply = async () => {
    setPhase('applying');

    try {
      const res = await fetch('/api/wishlists/organize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wishlistId, mode: 'apply', changes }),
      });
      const data = await res.json();

      if (data.success) {
        setPhase('done');
        toast.success(`Wishlist organized — ${data.applied} changes applied`);
        setTimeout(() => window.location.reload(), 1500);
      } else {
        toast.error(data.error || 'Failed to apply changes');
        setPhase('preview');
      }
    } catch {
      toast.error('Network error');
      setPhase('preview');
    }
  };

  const handleClose = () => {
    setPhase('idle');
    setResult(null);
  };

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        className="gap-1.5"
        onClick={handleAnalyze}
        disabled={phase === 'analyzing'}
      >
        {phase === 'analyzing' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
        AI Organizer
      </Button>

      {/* Preview Dialog */}
      <Modal
        open={phase === 'preview' || phase === 'applying' || phase === 'done'}
        onClose={handleClose}
        title="AI Organizer"
        size="lg"
      >
        <div className="space-y-5">
          {phase === 'done' ? (
            <div className="border-success/30 bg-success/5 flex items-center gap-3 rounded-lg border px-4 py-3">
              <span className="text-success text-lg">✓</span>
              <span className="text-sm font-medium">Wishlist organized successfully!</span>
            </div>
          ) : result ? (
            <>
              <p className="text-muted-foreground text-sm">
                AI analyzed your {itemCount} items and found the following improvements:
              </p>

              <div className="border-border bg-surface/30 space-y-2 rounded-xl border p-4">
                {result.duplicates > 0 && (
                  <ResultRow label={`${result.duplicates} duplicate items`} />
                )}
                {result.titlesImproved > 0 && (
                  <ResultRow label={`${result.titlesImproved} titles improved`} />
                )}
                {result.descriptionsCleaned > 0 && (
                  <ResultRow label={`${result.descriptionsCleaned} descriptions cleaned`} />
                )}
                {result.categoriesCreated > 0 && (
                  <ResultRow label={`${result.categoriesCreated} categories created`} />
                )}
                {result.foldersCreated > 0 && (
                  <ResultRow label={`${result.foldersCreated} folders created`} />
                )}
                {result.itemsReorganized > 0 && (
                  <ResultRow label={`${result.itemsReorganized} items reorganized`} />
                )}
                {result.detailsAdded > 0 && (
                  <ResultRow label={`${result.detailsAdded} missing product details added`} />
                )}
              </div>

              {result.suggestions.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-muted-foreground text-xs font-medium">Key changes:</p>
                  <ul className="space-y-1">
                    {result.suggestions.slice(0, 5).map((s, i) => (
                      <li key={i} className="text-muted-foreground text-xs">
                        • {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="border-border flex justify-end gap-3 border-t pt-4">
                <Button variant="ghost" size="md" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleApply}
                  disabled={phase === 'applying'}
                  className="gap-2"
                >
                  {phase === 'applying' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Apply Changes
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </Modal>
    </>
  );
}

function ResultRow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2.5 text-sm">
      <span className="text-success">✓</span>
      <span>{label}</span>
    </div>
  );
}
