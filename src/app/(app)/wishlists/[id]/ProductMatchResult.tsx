'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, HelpCircle, Package } from 'lucide-react';
import { formatDiscount } from '@/utils/format-discount';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { WishlistPriority } from '@/components/ui/WishlistPriority';

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
  exact: {
    icon: CheckCircle2,
    label: 'Exact Match',
    color: 'text-success',
    badge: 'success' as const,
  },
  strong: {
    icon: CheckCircle2,
    label: 'Strong Match',
    color: 'text-success',
    badge: 'success' as const,
  },
  possible: {
    icon: AlertTriangle,
    label: 'Possible Match',
    color: 'text-yellow-400',
    badge: 'warning' as const,
  },
  needs_review: {
    icon: HelpCircle,
    label: 'Needs Review',
    color: 'text-orange-400',
    badge: 'warning' as const,
  },
  new: { icon: Package, label: 'New Product', color: 'text-accent', badge: 'default' as const },
  manual: {
    icon: Package,
    label: 'Manual Entry',
    color: 'text-muted-foreground',
    badge: 'default' as const,
  },
};

export function ProductMatchResult({ candidate, onUse, onEdit, loading }: ProductMatchResultProps) {
  const [starPriority, setStarPriority] = useState(1);
  const config = MATCH_CONFIG[candidate.matchType];
  const Icon = config.icon;

  return (
    <div className="border-border bg-card animate-fade-up rounded-xl border p-4">
      {/* Match header */}
      <div className="mb-3 flex items-center gap-2">
        <Icon className={`h-4 w-4 ${config.color}`} />
        <span className="text-foreground text-xs font-medium">{config.label}</span>
        <Badge variant={config.badge} className="text-[9px]">
          {candidate.confidence}% confidence
        </Badge>
        {candidate.verified && (
          <Badge variant="success" className="text-[9px]">
            Verified
          </Badge>
        )}
      </div>

      {/* Product card */}
      <div className="flex gap-3">
        {/* Image */}
        {candidate.image ? (
          <span className="bg-surface flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg">
            <img src={candidate.image} alt="" className="h-full w-full object-contain" />
          </span>
        ) : (
          <span className="bg-surface flex h-16 w-16 shrink-0 items-center justify-center rounded-lg">
            <Package className="text-muted-foreground/30 h-6 w-6" />
          </span>
        )}

        {/* Details */}
        <div className="flex flex-1 flex-col gap-1 overflow-hidden">
          <h4 className="text-foreground truncate text-sm font-semibold">{candidate.title}</h4>

          <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-[11px]">
            {candidate.brand && <span>{candidate.brand}</span>}
            {candidate.category && <span>• {candidate.category}</span>}
            {candidate.retailer && <span>• {candidate.retailer}</span>}
          </div>

          {candidate.description && (
            <p className="text-muted-foreground line-clamp-1 text-[11px]">
              {candidate.description}
            </p>
          )}

          <div className="flex items-center gap-2 pt-0.5">
            {candidate.currentPrice != null && (
              <span className="text-foreground text-sm font-bold">
                ${candidate.currentPrice.toFixed(2)}
              </span>
            )}
            {candidate.originalPrice != null &&
              candidate.originalPrice > (candidate.currentPrice ?? 0) && (
                <span className="text-muted-foreground text-[11px] line-through">
                  ${candidate.originalPrice.toFixed(2)}
                </span>
              )}
            {(() => {
              const discount = formatDiscount({
                currentPrice: candidate.currentPrice ?? undefined,
                originalPrice: candidate.originalPrice ?? undefined,
                dealInfo: candidate.dealInfo,
              });
              if (!discount) return null;
              return (
                <span className="rounded-full bg-green-500/10 px-1.5 py-0.5 text-[9px] font-medium text-green-400">
                  {discount.label}
                </span>
              );
            })()}
            {candidate.url && (
              <a
                href={candidate.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent ml-auto inline-flex items-center gap-1 text-[10px] hover:underline"
              >
                <ExternalLink className="h-3 w-3" /> View
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Priority + Actions */}
      <div className="border-border mt-4 flex flex-wrap items-center gap-3 border-t pt-3">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-[11px]">Priority:</span>
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
