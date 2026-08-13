'use client';

/**
 * ProductEditor — The unified component for adding and editing products.
 *
 * Used everywhere:
 * - Manual add (empty draft)
 * - Edit existing item (populated from DB)
 * - Import preview (populated from URL extraction)
 * - Search result (populated from search)
 * - AI identification (populated from AI)
 *
 * Features:
 * - AI confidence display with percentage
 * - Field source indicators (AI verified, URL verified, Search verified, Keepa verified)
 * - Import status display (analyzing, identifying, verifying, ready, etc.)
 * - No-AI-configured warning with manual entry prompt
 * - AI activity timeline
 *
 * Same fields, same validation, same save logic.
 */
import { useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  Shield,
  Sparkles,
  X,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ProductEditorDraft {
  title?: string;
  description?: string;
  url?: string;
  image?: string;
  brand?: string;
  retailer?: string;
  currentPrice?: number;
  originalPrice?: number;
  currency?: string;
  dealInfo?: string;
  category?: string;
  sku?: string;
  asin?: string;
  upc?: string;
  mpn?: string;
  notes?: string;
}

export interface AIIdentificationInfo {
  /** Current import status */
  importStatus: string;
  /** Overall confidence 0-100 */
  confidence?: number;
  /** Per-field source tracking */
  fieldSources?: Record<string, string>;
  /** Activity timeline */
  activity?: Array<{
    step: string;
    status: string;
    message: string;
    timestamp: string;
  }>;
  /** AI provider used */
  provider?: string;
  /** Whether identification was successful */
  identified: boolean;
  /** Status message */
  message?: string;
}

export interface ProductEditorProps {
  /** Pre-filled data (from import, search, AI, or existing item) */
  draft?: ProductEditorDraft;
  /** Wishlist ID to save to */
  wishlistId: string;
  /** Controls save behavior */
  mode: 'create' | 'edit';
  /** Item ID when editing */
  itemId?: string;
  /** Called after successful save */
  onSave?: () => void;
  /** Called when user cancels */
  onCancel?: () => void;
  /** Optional class name */
  className?: string;
  /** AI identification metadata (from identification pipeline) */
  aiInfo?: AIIdentificationInfo;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-Components
// ─────────────────────────────────────────────────────────────────────────────

/** Field source badge — shows where a field value came from */
function FieldSourceBadge({ source }: { source?: string }) {
  if (!source) return null;

  const config = getSourceConfig(source);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide',
        config.className,
      )}
      title={config.label}
    >
      {config.icon}
      {config.shortLabel}
    </span>
  );
}

function getSourceConfig(source: string): {
  label: string;
  shortLabel: string;
  className: string;
  icon: React.ReactNode;
} {
  switch (source) {
    case 'ai':
    case 'ai-identification':
    case 'ai-knowledge':
    case 'ai-from-evidence':
      return {
        label: 'AI verified',
        shortLabel: 'AI',
        className: 'bg-purple-500/10 text-purple-600',
        icon: <Sparkles className="h-2 w-2" />,
      };
    case 'url':
    case 'user-input':
      return {
        label: 'URL verified',
        shortLabel: 'URL',
        className: 'bg-blue-500/10 text-blue-600',
        icon: <CheckCircle2 className="h-2 w-2" />,
      };
    case 'search':
    case 'search-provider':
    case 'serpapi':
    case 'brave':
      return {
        label: 'Search verified',
        shortLabel: 'Search',
        className: 'bg-green-500/10 text-green-600',
        icon: <CheckCircle2 className="h-2 w-2" />,
      };
    case 'keepa':
      return {
        label: 'Keepa verified',
        shortLabel: 'Keepa',
        className: 'bg-orange-500/10 text-orange-600',
        icon: <Shield className="h-2 w-2" />,
      };
    case 'structured-data':
      return {
        label: 'Page data',
        shortLabel: 'Page',
        className: 'bg-slate-500/10 text-slate-600',
        icon: <CheckCircle2 className="h-2 w-2" />,
      };
    case 'manual':
    case 'user':
      return {
        label: 'Manual entry',
        shortLabel: 'Manual',
        className: 'bg-slate-500/10 text-slate-500',
        icon: null,
      };
    default:
      return {
        label: source,
        shortLabel: source,
        className: 'bg-slate-500/10 text-slate-500',
        icon: null,
      };
  }
}

/** Import status banner */
function ImportStatusBanner({ aiInfo }: { aiInfo: AIIdentificationInfo }) {
  const { importStatus, confidence, message } = aiInfo;

  switch (importStatus) {
    case 'no_ai_configured':
      return (
        <div className="border-warning/30 bg-warning/5 flex items-start gap-3 rounded-lg border px-4 py-3">
          <AlertTriangle className="text-warning mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              AI identification isn&apos;t configured
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              DerList can&apos;t automatically identify this product yet. Please enter the product details manually below.
            </p>
          </div>
        </div>
      );

    case 'ready':
      return (
        <div className="border-success/30 bg-success/5 flex items-center gap-2 rounded-lg border px-4 py-2.5">
          <CheckCircle2 className="text-success h-4 w-4 shrink-0" />
          <span className="text-sm font-medium text-green-800 dark:text-green-200">
            AI identified — {confidence}% confidence
          </span>
        </div>
      );

    case 'needs_review':
      return (
        <div className="border-accent/30 bg-accent/5 flex items-center gap-2 rounded-lg border px-4 py-2.5">
          <Info className="text-accent h-4 w-4 shrink-0" />
          <span className="text-sm font-medium">
            Product identified — please review ({confidence}% confidence)
          </span>
        </div>
      );

    case 'conflict':
      return (
        <div className="border-danger/30 bg-danger/5 flex items-start gap-2 rounded-lg border px-4 py-2.5">
          <AlertCircle className="text-danger mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="text-danger text-sm font-medium">Identity conflict detected</p>
            {message && (
              <p className="text-muted-foreground mt-0.5 text-xs">{message}</p>
            )}
          </div>
        </div>
      );

    case 'failed':
      return (
        <div className="border-danger/30 bg-danger/5 flex items-start gap-2 rounded-lg border px-4 py-2.5">
          <AlertCircle className="text-danger mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="text-danger text-sm font-medium">
              Couldn&apos;t reliably identify this product
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {message || 'The connected AI couldn\'t verify enough information from this URL. Please enter the product details manually.'}
            </p>
          </div>
        </div>
      );

    case 'identifying':
      return (
        <div className="bg-accent/5 flex items-center gap-2 rounded-lg border px-4 py-2.5">
          <Loader2 className="text-accent h-4 w-4 animate-spin" />
          <span className="text-sm">AI is identifying this product...</span>
        </div>
      );

    case 'verifying':
      return (
        <div className="bg-accent/5 flex items-center gap-2 rounded-lg border px-4 py-2.5">
          <Shield className="text-accent h-4 w-4" />
          <span className="text-sm">Verifying product information...</span>
        </div>
      );

    default:
      return null;
  }
}

/** AI Activity Timeline panel */
function AIActivityTimeline({ activity }: { activity: AIIdentificationInfo['activity'] }) {
  if (!activity || activity.length === 0) return null;

  return (
    <div className="border-border rounded-lg border p-3">
      <h4 className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
        AI Activity
      </h4>
      <div className="space-y-1.5">
        {activity.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2 text-xs">
            {item.status === 'completed' && (
              <CheckCircle2 className="text-success h-3 w-3 shrink-0" />
            )}
            {item.status === 'in_progress' && (
              <Loader2 className="text-accent h-3 w-3 shrink-0 animate-spin" />
            )}
            {item.status === 'failed' && (
              <AlertCircle className="text-danger h-3 w-3 shrink-0" />
            )}
            {item.status === 'skipped' && (
              <span className="text-muted-foreground h-3 w-3 shrink-0 text-center">—</span>
            )}
            <span className={cn(
              'text-foreground',
              item.status === 'failed' && 'text-danger',
              item.status === 'skipped' && 'text-muted-foreground line-through',
            )}>
              {item.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function ProductEditor({
  draft,
  wishlistId,
  mode,
  itemId,
  onSave,
  onCancel,
  className,
  aiInfo,
}: ProductEditorProps) {
  // Form state
  const [title, setTitle] = useState(draft?.title ?? '');
  const [description, setDescription] = useState(draft?.description ?? '');
  const [url, setUrl] = useState(draft?.url ?? '');
  const [image, setImage] = useState(draft?.image ?? '');
  const [brand, setBrand] = useState(draft?.brand ?? '');
  const [retailer, setRetailer] = useState(draft?.retailer ?? '');
  const [currentPrice, setCurrentPrice] = useState(draft?.currentPrice?.toString() ?? '');
  const [originalPrice, setOriginalPrice] = useState(draft?.originalPrice?.toString() ?? '');
  const [currency, setCurrency] = useState(draft?.currency ?? 'USD');
  const [dealInfo, setDealInfo] = useState(draft?.dealInfo ?? '');
  const [category, setCategory] = useState(draft?.category ?? '');
  const [sku, setSku] = useState(draft?.sku ?? '');
  const [notes, setNotes] = useState(draft?.notes ?? '');

  // Extended fields
  const [asin] = useState(draft?.asin ?? '');
  const [upc] = useState(draft?.upc ?? '');
  const [mpn] = useState(draft?.mpn ?? '');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiStatus, setAiStatus] = useState<'idle' | 'loading' | 'done' | 'error' | 'no_ai'>(
    aiInfo?.importStatus === 'no_ai_configured' ? 'no_ai' :
    aiInfo?.identified ? 'done' : 'idle'
  );
  const [aiMessage, setAiMessage] = useState(
    aiInfo?.identified
      ? `AI identified — ${aiInfo.confidence ?? 0}% confidence`
      : aiInfo?.message ?? ''
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);

  // Field sources from AI identification
  const fieldSources = aiInfo?.fieldSources ?? {};

  // ─── AI Identify ───

  const handleIdentify = async () => {
    const identifyInput = url || title;
    if (!identifyInput.trim() || identifyInput.length < 2) {
      setAiStatus('error');
      setAiMessage('Enter a product name or URL first (at least 2 characters).');
      return;
    }

    setAiStatus('loading');
    setAiMessage('AI is identifying this product...');

    try {
      const res = await fetch('/api/products/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: identifyInput }),
      });

      const data = await res.json();

      // Handle no-AI-configured
      if (data.aiIdentification?.importStatus === 'no_ai_configured') {
        setAiStatus('no_ai');
        setAiMessage("AI identification isn't configured. Please enter product details manually.");
        return;
      }

      if (!data.success || !data.candidates?.length) {
        setAiStatus('error');
        setAiMessage(data.error || "Couldn't reliably identify this product. Please enter details manually.");
        return;
      }

      const candidate = data.candidates[0];

      // Fill empty fields only (don't overwrite user input)
      if (!brand && candidate.brand) setBrand(candidate.brand);
      if (!retailer && candidate.retailer) setRetailer(candidate.retailer);
      if (!category && candidate.category) setCategory(candidate.category);
      if (!url && candidate.url) setUrl(candidate.url);
      if (!image && candidate.image) setImage(candidate.image);
      if (!sku && candidate.sku) setSku(candidate.sku);
      if (!description && candidate.description) setDescription(candidate.description);
      if (!currentPrice && candidate.currentPrice != null) {
        setCurrentPrice(String(candidate.currentPrice));
      }
      if (!originalPrice && candidate.originalPrice != null) {
        setOriginalPrice(String(candidate.originalPrice));
      }
      if (!dealInfo && candidate.dealInfo) setDealInfo(candidate.dealInfo);
      if (candidate.currency && candidate.currency !== 'USD') {
        setCurrency(candidate.currency);
      }

      // Update title if AI found a better/more complete one
      if (candidate.title && candidate.title.length > title.length) {
        setTitle(candidate.title);
      }

      setAiStatus('done');
      setAiMessage(`AI identified — ${candidate.confidence}% confidence`);
    } catch {
      setAiStatus('error');
      setAiMessage('Failed to connect. Try again later.');
    }
  };

  // ─── Submit ───

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setError('Product name is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.set('wishlistId', wishlistId);
    formData.set('title', title.trim());
    if (description) formData.set('description', description);
    if (url) formData.set('url', url);
    if (image) formData.set('image', image);
    if (brand) formData.set('brand', brand);
    if (retailer) formData.set('retailer', retailer);
    if (currentPrice) formData.set('currentPrice', currentPrice);
    if (originalPrice) formData.set('originalPrice', originalPrice);
    formData.set('currency', currency);
    if (dealInfo) formData.set('dealInfo', dealInfo);
    if (category) formData.set('category', category);
    if (sku) formData.set('sku', sku);
    if (notes) formData.set('notes', notes);
    if (asin) formData.set('asin', asin);
    if (upc) formData.set('upc', upc);
    if (mpn) formData.set('mpn', mpn);
    if (itemId) formData.set('itemId', itemId);

    try {
      const endpoint =
        mode === 'edit'
          ? '/api/wishlists/add-item'
          : '/api/wishlists/add-item';

      const res = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      const result = await res.json();

      if (!result.success && !res.ok) {
        setError(result.error || 'Failed to save. Please try again.');
        setIsSubmitting(false);
        return;
      }

      setSuccess(true);
      onSave?.();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Success State ───

  if (success) {
    return (
      <div
        className={cn(
          'border-success/30 bg-success/5 flex items-center gap-3 rounded-lg border px-4 py-4',
          className
        )}
      >
        <CheckCircle2 className="text-success h-5 w-5" />
        <div>
          <p className="text-sm font-medium">
            {mode === 'edit' ? 'Product updated!' : 'Product added!'}
          </p>
          <p className="text-muted-foreground text-xs">
            {title} has been {mode === 'edit' ? 'updated in' : 'added to'} your wishlist.
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto"
          onClick={() => {
            setSuccess(false);
            setTitle('');
            setDescription('');
            setUrl('');
            setImage('');
            setBrand('');
            setRetailer('');
            setCurrentPrice('');
            setOriginalPrice('');
            setDealInfo('');
            setCategory('');
            setSku('');
            setNotes('');
            setAiStatus('idle');
            setAiMessage('');
          }}
        >
          Add Another
        </Button>
      </div>
    );
  }

  // ─── Form ───

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className={cn('flex flex-col gap-4', className)}
      noValidate
    >
      {/* Import Status Banner */}
      {aiInfo && <ImportStatusBanner aiInfo={aiInfo} />}

      {error && (
        <div className="border-danger/30 bg-danger/5 text-danger flex items-center gap-2 rounded-lg border px-4 py-3 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* AI Activity Timeline */}
      {aiInfo?.activity && aiInfo.activity.length > 0 && (
        <AIActivityTimeline activity={aiInfo.activity} />
      )}

      {/* Title + AI Identify */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <label htmlFor="pe-title" className="text-sm font-medium">
            Product Name <span className="text-danger">*</span>
          </label>
          <FieldSourceBadge source={fieldSources.name} />
        </div>
        <div className="flex gap-2">
          <Input
            id="pe-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. NVIDIA RTX 5070 Ti"
            className="flex-1"
            required
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="shrink-0 gap-1.5 text-xs"
            onClick={handleIdentify}
            disabled={aiStatus === 'loading'}
          >
            {aiStatus === 'loading' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {aiStatus === 'loading' ? 'Identifying...' : 'Identify'}
          </Button>
        </div>

        {/* AI Status */}
        {aiStatus === 'loading' && (
          <div className="bg-accent/5 flex items-center gap-2 rounded-md px-2.5 py-1.5">
            <Loader2 className="text-accent h-3 w-3 animate-spin" />
            <span className="text-accent text-[11px]">{aiMessage}</span>
          </div>
        )}
        {aiStatus === 'done' && (
          <div className="bg-success/5 flex items-center gap-2 rounded-md px-2.5 py-1.5">
            <CheckCircle2 className="text-success h-3 w-3" />
            <span className="text-success text-[11px]">{aiMessage}</span>
          </div>
        )}
        {aiStatus === 'error' && (
          <div className="bg-danger/5 rounded-md px-2.5 py-1.5">
            <span className="text-danger text-[11px]">{aiMessage}</span>
          </div>
        )}
        {aiStatus === 'no_ai' && (
          <div className="bg-warning/5 flex items-center gap-2 rounded-md px-2.5 py-1.5">
            <AlertTriangle className="text-warning h-3 w-3" />
            <span className="text-warning text-[11px]">{aiMessage}</span>
          </div>
        )}
      </div>

      {/* Image Preview */}
      {image && (
        <div className="relative w-fit">
          <img
            src={image}
            alt={title || 'Product'}
            className="border-border h-20 w-20 rounded-lg border object-cover"
          />
          <button
            type="button"
            onClick={() => setImage('')}
            className="bg-danger absolute -top-1.5 -right-1.5 rounded-full p-0.5 text-white"
            aria-label="Remove image"
          >
            <X className="h-3 w-3" />
          </button>
          {fieldSources.image && (
            <div className="absolute -bottom-1 -right-1">
              <FieldSourceBadge source={fieldSources.image} />
            </div>
          )}
        </div>
      )}

      {/* Core Fields */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <label htmlFor="pe-brand" className="text-sm font-medium">
              Brand
            </label>
            <FieldSourceBadge source={fieldSources.brand} />
          </div>
          <Input
            id="pe-brand"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="e.g. Apple, NVIDIA"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <label htmlFor="pe-category" className="text-sm font-medium">
              Category
            </label>
            <FieldSourceBadge source={fieldSources.category} />
          </div>
          <Input
            id="pe-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Headphones, GPU"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pe-url" className="text-sm font-medium">
            Product URL
          </label>
          <Input
            id="pe-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            type="url"
            placeholder="https://..."
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <label htmlFor="pe-image" className="text-sm font-medium">
              Image URL
            </label>
            <FieldSourceBadge source={fieldSources.image} />
          </div>
          <Input
            id="pe-image"
            value={image}
            onChange={(e) => setImage(e.target.value)}
            type="url"
            placeholder="https://..."
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <label htmlFor="pe-price" className="text-sm font-medium">
              Price
            </label>
            <FieldSourceBadge source={fieldSources.price} />
          </div>
          <Input
            id="pe-price"
            value={currentPrice}
            onChange={(e) => setCurrentPrice(e.target.value)}
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pe-currency" className="text-sm font-medium">
            Currency
          </label>
          <Input
            id="pe-currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            maxLength={3}
            placeholder="USD"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pe-retailer" className="text-sm font-medium">
            Retailer
          </label>
          <Input
            id="pe-retailer"
            value={retailer}
            onChange={(e) => setRetailer(e.target.value)}
            placeholder="e.g. Amazon, Best Buy"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <label htmlFor="pe-asin" className="text-sm font-medium">
              ASIN
            </label>
            <FieldSourceBadge source={fieldSources.asin} />
          </div>
          <Input
            id="pe-asin"
            value={asin}
            readOnly={!!draft?.asin}
            className={draft?.asin ? 'bg-muted' : ''}
            placeholder="Amazon ASIN"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <label htmlFor="pe-sku" className="text-sm font-medium">
              SKU
            </label>
            <FieldSourceBadge source={fieldSources.sku} />
          </div>
          <Input
            id="pe-sku"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="Optional"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pe-upc" className="text-sm font-medium">
            UPC
          </label>
          <Input
            id="pe-upc"
            value={upc}
            readOnly
            className={upc ? 'bg-muted' : ''}
            placeholder="Optional"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pe-original-price" className="text-sm font-medium">
            Original Price
          </label>
          <Input
            id="pe-original-price"
            value={originalPrice}
            onChange={(e) => setOriginalPrice(e.target.value)}
            type="number"
            step="0.01"
            min="0"
            placeholder="MSRP/list price"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pe-deal" className="text-sm font-medium">
            Deal Info
          </label>
          <Input
            id="pe-deal"
            value={dealInfo}
            onChange={(e) => setDealInfo(e.target.value)}
            placeholder="e.g. $50 off coupon"
          />
        </div>
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="pe-desc" className="text-sm font-medium">
          Description
        </label>
        <Textarea
          id="pe-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional notes or description..."
          rows={2}
        />
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="pe-notes" className="text-sm font-medium">
          Personal Notes
        </label>
        <Textarea
          id="pe-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Why you want this, alternatives, etc."
          rows={2}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={isSubmitting} size="sm" className="gap-2">
          {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {isSubmitting ? 'Saving...' : mode === 'edit' ? 'Update Product' : 'Add to Wishlist'}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
