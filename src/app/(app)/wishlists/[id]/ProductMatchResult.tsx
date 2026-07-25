'use client';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { WishlistPriority } from '@/components/ui/WishlistPriority';
import { CheckCircle2, AlertTriangle, HelpCircle, Package, ExternalLink } from 'lucide-react';
import { useState } from 'react';

export interface ProductCandidateUI {
  title: string;
  brand: string | null;
  model: string | null;
  sku: string | null;
  url: string | null;
  image: string | null;
  retailer: string | null;
  category: string | null;
  description: string | null;
  currentPrice: number | null;
  originalPrice: number | null;
  currency: string;
  dealInfo: string | null;
  confidence: number;
  matchType: 'exact' | 'strong' | 'possible' | 'needs_review' | 'new' | 'manual';
  productId: string | null;
  verified: boolean;
}

interface ProductMatchResultProps {
  candidate: ProductCandidateUI;
  onUse: (candidate: ProductCandidateUI, starPriority: number) => void;
  onEdit: (candidate: ProductCandidateUI) => void;
  loading?: boolean;
}

const MATCH_CONFIG = {
  exact: { icon: CheckCircle2, label: 'Exact Match', color: 'text-success', badge: 'success' as const },
  strong: { icon: CheckCircle2, label: 'Strong Match', color: 'text-success', badge: 'success' as const },
  possible: { icon: AlertTriangle, label: 'Possible Match', color: 'text-yellow-400', badge: 'warning' as const },
  needs_review: { icon: HelpCircle, label: 'Needs Review', color: 'text-orange-400', badge: 'warning' as const },
  new: { icon: Package, label: 'New Product', color: 'text-accent', badge: 'default' as const },
  manual: { icon: Package, label: 'Manual Entry', color: 'text-muted-foreground', badge: 'default' as const },
};

export function ProductMatchResult({ candidate, onUse, onEdit, loading }: ProductMatchResultProps) {
  const [starPriority, setStarPriority] = useState(1);
  const config = MATCH_CONFIG[candidate.matchType];
  const Icon = config.icon;

  return (
    <div className="rounded-xl border border-border bg-card p-4 animate-fade-up">
      {/* Match header */}
      <div className="mb-3 flex items-center gap-2">
        <Icon className={`h-4 w-4 ${config.color}`} />
        <span className="text-xs font-medium text-foreground">{config.label}</span>
        <Badge variant={config.badge} className="text-[9px]">
          {candidate.confidence}% confidence
        </Badge>
        {candidate.verified && (
          <Badge variant="success" className="text-[9px]">Verified</Badge>
        )}
      </div>

      {/* Product card */}
      <div className="flex gap-3">
        {/* Image */}
        {candidate.image ? (
          <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface">
            <img src={candidate.image} alt="" className="h-full w-full object-contain" />
          </span>
        ) : (
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-surface">
            <Package className="h-6 w-6 text-muted-foreground/30" />
          </span>
        )}

        {/* Details */}
        <div className="flex flex-1 flex-col gap-1 overflow-hidden">
          <h4 className="truncate text-sm font-semibold text-foreground">{candidate.title}</h4>

          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            {candidate.brand && <span>{candidate.brand}</span>}
            {candidate.category && <span>• {candidate.category}</span>}
            {candidate.retailer && <span>• {candidate.retailer}</span>}
          </div>

          {candidate.description && (
            <p className="line-clamp-1 text-[11px] text-muted-foreground">{candidate.description}</p>
          )}

          <div className="flex items-center gap-2 pt-0.5">
            {candidate.currentPrice != null && (
              <span className="text-sm font-bold text-foreground">
                ${candidate.currentPrice.toFixed(2)}
              </span>
            )}
            {candidate.originalPrice != null && candidate.originalPrice > (candidate.currentPrice ?? 0) && (
              <span className="text-[11px] text-muted-foreground line-through">
                ${candidate.originalPrice.toFixed(2)}
              </span>
            )}
            {candidate.dealInfo && (
              <span className="rounded-full bg-green-500/10 px-1.5 py-0.5 text-[9px] font-medium text-green-400">
                {candidate.dealInfo}
              </span>
            )}
            {candidate.url && (
              <a href={candidate.url} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 text-[10px] text-accent hover:underline">
                <ExternalLink className="h-3 w-3" /> View
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Priority + Actions */}
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">Priority:</span>
          <WishlistPriority value={starPriority} onChange={setStarPriority} size="sm" />
        </div>

        <div className="ml-auto flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => onEdit(candidate)}
          >
            Edit Details
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-7 text-xs"
            disabled={loading}
            onClick={() => onUse(candidate, starPriority)}
          >
            {loading ? 'Adding...' : 'Add to Wishlist'}
          </Button>
        </div>
      </div>
    </div>
  );
}
