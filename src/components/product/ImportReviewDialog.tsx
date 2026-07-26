'use client';

/**
 * ImportReviewDialog — Post-import folder suggestion UI.
 *
 * Shown after products are imported and AI enrichment completes.
 * Analyzes items as a group and suggests folder organization.
 *
 * Flow:
 * 1. Show import summary (products imported, identified, enriched)
 * 2. If AI detects a grouping, show folder suggestion
 * 3. User can: create folder, use existing, rename, or skip
 * 4. On accept, bulk-assigns items to the folder
 */
import { useCallback, useEffect, useState } from 'react';
import { Check, ChevronRight, FolderPlus, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface FolderSuggestion {
  shouldGroup: boolean;
  folderName: string;
  description: string;
  icon: string;
  color: string;
  category: string;
  subfolders: { name: string; itemIds: string[] }[];
  existingFolder?: { id: string; name: string; similarity: number };
  confidence: number;
  reasoning: string;
}

export interface ImportReviewDialogProps {
  open: boolean;
  onClose: () => void;
  /** Summary stats */
  importedCount: number;
  identifiedCount: number;
  enrichedCount: number;
  /** The wishlist these items were added to */
  wishlistId: string;
  /** IDs of all imported items */
  itemIds: string[];
}

type Step = 'summary' | 'loading' | 'suggestion' | 'rename' | 'done';
type Choice = 'create' | 'existing' | 'skip';

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function ImportReviewDialog({
  open,
  onClose,
  importedCount,
  identifiedCount,
  enrichedCount,
  wishlistId,
  itemIds,
}: ImportReviewDialogProps) {
  const [step, setStep] = useState<Step>('summary');
  const [suggestion, setSuggestion] = useState<FolderSuggestion | null>(null);
  const [choice, setChoice] = useState<Choice>('create');
  const [folderName, setFolderName] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const toast = useToast();

  // Fetch folder suggestion when dialog opens
  useEffect(() => {
    if (!open || itemIds.length < 2) return;
    let cancelled = false;

    const analyze = async () => {
      const r = await fetch('/api/wishlists/suggest-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wishlistId, itemIds }),
      });
      const res = await r.json();
      if (cancelled) return;
      if (res.success && res.suggestion) {
        setSuggestion(res.suggestion);
        setFolderName(res.suggestion.folderName);
        setStep('suggestion');
      } else {
        setStep('summary');
      }
    };

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStep('loading');
    analyze().catch(() => {
      if (!cancelled) setStep('summary');
    });
    return () => {
      cancelled = true;
    };
  }, [open, wishlistId, itemIds]);

  const handleApply = useCallback(async () => {
    if (!suggestion) return;
    setIsApplying(true);

    const body: Record<string, unknown> = {
      wishlistId,
      itemIds,
      folderName: choice === 'existing' ? suggestion.existingFolder?.name : folderName,
      subfolders: suggestion.subfolders.length > 0 ? suggestion.subfolders : undefined,
      useExistingFolderId: choice === 'existing' ? suggestion.existingFolder?.id : undefined,
    };

    try {
      const res = await fetch('/api/wishlists/apply-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (result.success) {
        toast.success(
          `Items organized into "${choice === 'existing' ? suggestion.existingFolder?.name : folderName}"`
        );
        setStep('done');
      } else {
        toast.error(result.error || 'Failed to apply folder');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setIsApplying(false);
    }
  }, [suggestion, wishlistId, itemIds, choice, folderName, toast]);

  const handleSkip = () => {
    setStep('done');
  };

  return (
    <Modal open={open} onClose={onClose} size="lg" title="Import Complete">
      <div className="space-y-6">
        {/* ─── Import Summary ─── */}
        <div className="space-y-2">
          <SummaryRow icon="✓" label={`${importedCount} products imported`} done />
          <SummaryRow icon="✓" label={`${identifiedCount} products identified`} done />
          <SummaryRow
            icon="✓"
            label={`AI enrichment complete`}
            done={enrichedCount > 0}
            loading={enrichedCount === 0 && step === 'loading'}
          />
        </div>

        {/* ─── Loading State ─── */}
        {step === 'loading' && (
          <div className="border-border bg-surface/50 flex items-center gap-3 rounded-lg border px-4 py-3">
            <Loader2 className="text-accent h-4 w-4 animate-spin" />
            <span className="text-muted-foreground text-sm">
              Analyzing items for folder suggestions...
            </span>
          </div>
        )}

        {/* ─── No Suggestion (just summary) ─── */}
        {step === 'summary' && itemIds.length >= 2 && !suggestion && (
          <p className="text-muted-foreground text-sm">
            Items don&apos;t appear to share a common theme. You can organize them manually later.
          </p>
        )}

        {/* ─── Folder Suggestion ─── */}
        {step === 'suggestion' && suggestion && (
          <FolderSuggestionCard
            suggestion={suggestion}
            choice={choice}
            setChoice={setChoice}
            folderName={folderName}
            setFolderName={setFolderName}
          />
        )}

        {/* ─── Done ─── */}
        {step === 'done' && (
          <div className="border-success/30 bg-success/5 flex items-center gap-3 rounded-lg border px-4 py-3">
            <Check className="text-success h-5 w-5" />
            <span className="text-sm font-medium">All done! Your items are ready.</span>
          </div>
        )}

        {/* ─── Actions ─── */}
        <div className="border-border flex justify-end gap-3 border-t pt-4">
          {step === 'suggestion' && (
            <>
              <Button variant="ghost" size="md" onClick={handleSkip}>
                Skip
              </Button>
              {choice === 'create' || choice === 'existing' ? (
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleApply}
                  disabled={isApplying}
                  className="gap-2"
                >
                  {isApplying ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FolderPlus className="h-4 w-4" />
                  )}
                  {choice === 'existing' ? 'Use Existing Folder' : 'Create Folder'}
                </Button>
              ) : null}
            </>
          )}
          {(step === 'summary' || step === 'done') && (
            <Button variant="primary" size="md" onClick={onClose}>
              Done
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function SummaryRow({
  icon,
  label,
  done,
  loading,
}: {
  icon: string;
  label: string;
  done?: boolean;
  loading?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      {loading ? (
        <Loader2 className="text-accent h-4 w-4 animate-spin" />
      ) : (
        <span className={cn('text-sm', done ? 'text-success' : 'text-muted-foreground')}>
          {icon}
        </span>
      )}
      <span className={cn('text-sm', done ? 'text-foreground' : 'text-muted-foreground')}>
        {label}
      </span>
    </div>
  );
}

function FolderSuggestionCard({
  suggestion,
  choice,
  setChoice,
  folderName,
  setFolderName,
}: {
  suggestion: FolderSuggestion;
  choice: Choice;
  setChoice: (c: Choice) => void;
  folderName: string;
  setFolderName: (n: string) => void;
}) {
  return (
    <div className="space-y-4">
      {/* Intro */}
      <div className="border-accent/20 bg-accent/5 flex items-start gap-3 rounded-lg border px-4 py-3">
        <Sparkles className="text-accent mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="text-sm font-medium">We noticed these items appear to belong together.</p>
          <p className="text-muted-foreground mt-0.5 text-xs">{suggestion.reasoning}</p>
        </div>
      </div>

      {/* Suggested folder preview */}
      <div className="border-border bg-card rounded-xl border p-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{suggestion.icon}</span>
          <div>
            <p className="font-semibold">{suggestion.folderName}</p>
            <p className="text-muted-foreground text-xs">{suggestion.description}</p>
          </div>
          <span
            className={cn(
              'ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium',
              `bg-${suggestion.color}-500/10 text-${suggestion.color}-500`
            )}
          >
            {suggestion.confidence}% match
          </span>
        </div>

        {/* Subfolders */}
        {suggestion.subfolders.length > 0 && (
          <div className="border-border mt-3 border-t pt-3">
            <p className="text-muted-foreground mb-2 text-xs font-medium">Suggested structure:</p>
            <div className="space-y-1">
              {suggestion.subfolders.map((sf) => (
                <div key={sf.name} className="flex items-center gap-2 text-sm">
                  <ChevronRight className="text-muted-foreground h-3 w-3" />
                  <span>{sf.name}</span>
                  <span className="text-muted-foreground text-xs">({sf.itemIds.length} items)</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Existing folder match */}
      {suggestion.existingFolder && (
        <div className="border-warning/20 bg-warning/5 rounded-lg border px-4 py-3">
          <p className="text-sm font-medium">Existing folder found</p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            &ldquo;{suggestion.existingFolder.name}&rdquo; looks similar. Add items there instead?
          </p>
        </div>
      )}

      {/* Choice radio group */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Would you like to:</p>

        <label
          className={cn(
            'flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors',
            choice === 'create' ? 'border-accent bg-accent/5' : 'border-border hover:bg-surface/50'
          )}
        >
          <input
            type="radio"
            name="folder-choice"
            checked={choice === 'create'}
            onChange={() => setChoice('create')}
            className="h-4 w-4"
          />
          <span className="text-sm">Create a new folder</span>
        </label>

        {suggestion.existingFolder && (
          <label
            className={cn(
              'flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors',
              choice === 'existing'
                ? 'border-accent bg-accent/5'
                : 'border-border hover:bg-surface/50'
            )}
          >
            <input
              type="radio"
              name="folder-choice"
              checked={choice === 'existing'}
              onChange={() => setChoice('existing')}
              className="h-4 w-4"
            />
            <span className="text-sm">Add to &ldquo;{suggestion.existingFolder.name}&rdquo;</span>
          </label>
        )}

        <label
          className={cn(
            'flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors',
            choice === 'skip' ? 'border-accent bg-accent/5' : 'border-border hover:bg-surface/50'
          )}
        >
          <input
            type="radio"
            name="folder-choice"
            checked={choice === 'skip'}
            onChange={() => setChoice('skip')}
            className="h-4 w-4"
          />
          <span className="text-sm">Keep everything uncategorized</span>
        </label>
      </div>

      {/* Rename input (only shown when creating) */}
      {choice === 'create' && (
        <div>
          <label className="mb-1.5 block text-sm font-medium">Folder name</label>
          <Input
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            placeholder="Enter folder name"
          />
        </div>
      )}
    </div>
  );
}
