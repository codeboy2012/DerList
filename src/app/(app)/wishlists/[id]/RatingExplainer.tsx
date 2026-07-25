'use client';

import { useState } from 'react';
import { Star, ChevronDown } from 'lucide-react';
import { cn } from '@/utils/cn';

const LEVELS = [
  { stars: 4, label: 'O.M.G. MUST HAVE!!', shortLabel: 'Must Have!', description: 'Cannot live without it. Top priority.' },
  { stars: 3, label: 'I NEED This', shortLabel: 'Need This', description: 'Strong need. Will buy soon.' },
  { stars: 2, label: 'Really Want', shortLabel: 'Really Want', description: 'High on the list. Watching for deals.' },
  { stars: 1, label: 'Want', shortLabel: 'Want', description: 'Would be nice to have eventually.' },
] as const;

/**
 * Collapsible rating system explainer.
 * Shows the 4-star priority system so new users understand immediately.
 */
export function RatingExplainer() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-surface/50"
        aria-expanded={open}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-yellow-500/10">
          <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
        </span>
        <span className="flex-1 text-xs font-medium text-foreground">Priority Rating System</span>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div className="border-t border-border px-4 pb-4 pt-3 animate-fade-up">
          <p className="mb-3 text-[11px] text-muted-foreground">
            Stars indicate how badly you want something — not a product review.
          </p>
          <div className="flex flex-col gap-2">
            {LEVELS.map((level) => (
              <div key={level.stars} className="flex items-center gap-3">
                {/* Stars */}
                <div className="flex shrink-0 items-center gap-0.5">
                  {[1, 2, 3, 4].map((s) => (
                    <Star
                      key={s}
                      className={cn(
                        'h-3.5 w-3.5',
                        s <= level.stars
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'fill-transparent text-muted-foreground/30',
                      )}
                    />
                  ))}
                </div>
                {/* Label */}
                <span className="min-w-[120px] text-xs font-medium text-foreground">
                  {level.label}
                </span>
                {/* Description */}
                <span className="text-[11px] text-muted-foreground">
                  {level.description}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
