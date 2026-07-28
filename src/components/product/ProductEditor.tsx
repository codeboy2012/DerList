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
 * Same fields, same validation, same save logic.
 */
import { useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Sparkles, X } from 'lucide-react';
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
  notes?: string;
}

export interface ProductEditorProps {
  /** Pre-filled data (from import, search, AI, or existing item) */
  draft?: ProductEditorDraft;
  /** Wishlist ID to save to */
  wishlistId: string;
  /** Parent item ID for creating child items */
  parentId?: string;
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
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function ProductEditor({
  draft,
  wishlistId,
  parentId,
  mode,
  itemId,
  onSave,
  onCancel,
  className,
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

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiStatus, setAiStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [aiMessage, setAiMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);

  // ─── AI Identify ───

  const handleIdentify = async () => {
    if (!title.trim() || title.length < 2) {
      setAiStatus('error');
      setAiMessage('Enter a product name first (at least 2 characters).');
      return;
    }

    setAiStatus('loading');
    setAiMessage('Identifying product...');

    try {
      const res = await fetch('/api/products/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: title }),
      });

      const data = await res.json();

      if (!data.success || !data.candidates?.length) {
        setAiStatus('error');
        setAiMessage(data.error || 'Could not identify product. Try adding more details.');
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

      const verified = candidate.verified ? 'Verified' : 'AI-identified';
      setAiStatus('done');
      setAiMessage(`${verified} (${candidate.confidence}% confidence)`);
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
    if (parentId) formData.set('parentId', parentId);
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
    if (itemId) formData.set('itemId', itemId);

    try {
      const endpoint =
        mode === 'edit'
          ? '/api/wishlists/add-item' // TODO: separate update endpoint
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
      {error && (
        <div className="border-danger/30 bg-danger/5 text-danger flex items-center gap-2 rounded-lg border px-4 py-3 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Title + AI Identify */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="pe-title" className="text-sm font-medium">
          Product Name <span className="text-danger">*</span>
        </label>
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
        </div>
      )}

      {/* Core Fields */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pe-url" className="text-sm font-medium">
            URL
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
          <label htmlFor="pe-image" className="text-sm font-medium">
            Image URL
          </label>
          <Input
            id="pe-image"
            value={image}
            onChange={(e) => setImage(e.target.value)}
            type="url"
            placeholder="https://..."
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pe-price" className="text-sm font-medium">
            Price
          </label>
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
          <label htmlFor="pe-brand" className="text-sm font-medium">
            Brand
          </label>
          <Input
            id="pe-brand"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="e.g. NVIDIA"
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
          <label htmlFor="pe-category" className="text-sm font-medium">
            Category
          </label>
          <Input
            id="pe-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. GPU, SSD, Monitor"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pe-sku" className="text-sm font-medium">
            SKU / ASIN
          </label>
          <Input
            id="pe-sku"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
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
