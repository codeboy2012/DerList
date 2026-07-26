'use client';

/**
 * ProductEditorDrawer — Full-featured product editor in a right-side drawer.
 *
 * Sections:
 * - Product Information (name, brand, model, identifiers, URLs)
 * - Pricing (current, original, sale, shipping, tax, coupons)
 * - Sellers (multiple retailers with price/link/availability)
 * - Images (upload, paste URL, reorder, delete)
 * - Wishlist (priority, quantity, desired price, status, notes)
 * - AI Metadata (confidence, tags, suggestions)
 * - Specifications (dynamic key-value pairs)
 * - History (price history, import info, timestamps)
 *
 * All existing API logic is preserved. This is UI-only.
 */
import { useCallback, useMemo, useState } from 'react';
import {
  AlertCircle,
  Archive,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  MoreHorizontal,
  Plus,
  Save,
  Share2,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface Seller {
  id: string;
  name: string;
  price: string;
  shipping: string;
  url: string;
  availability: string;
  isPreferred: boolean;
}

export interface SpecField {
  id: string;
  key: string;
  value: string;
}

export interface ProductEditorData {
  // Identity
  title: string;
  brand: string;
  model: string;
  category: string;
  subCategory: string;
  sku: string;
  upc: string;
  asin: string;
  mpn: string;
  url: string;
  storeUrl: string;
  description: string;
  notes: string;
  tags: string;
  // Pricing
  currentPrice: string;
  originalPrice: string;
  salePrice: string;
  dealAmount: string;
  discountPercent: string;
  shippingCost: string;
  tax: string;
  coupon: string;
  promoCode: string;
  finalTotal: string;
  priceLocked: boolean;
  // Sellers
  sellers: Seller[];
  // Images
  images: string[];
  primaryImageIndex: number;
  // Wishlist
  priority: string;
  quantity: string;
  desiredPrice: string;
  purchaseStatus: string;
  needByDate: string;
  wishlistNotes: string;
  folder: string;
  subFolder: string;
  wishlistCategory: string;
  customLabels: string;
  // AI Metadata
  aiConfidence: string;
  aiTags: string;
  aiSuggestedCategory: string;
  aiSuggestedName: string;
  // Specs
  specs: SpecField[];
  // History (read-only display)
  createdAt: string;
  updatedAt: string;
  importedFrom: string;
  lastSynced: string;
  provider: string;
  extractionConfidence: string;
}

export interface ProductEditorDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Pre-filled data from existing item */
  item: {
    id: string;
    title: string;
    description: string | null;
    url: string | null;
    image: string | null;
    brand: string | null;
    retailer: string | null;
    currentPrice: string | null;
    originalPrice?: string | null;
    dealInfo?: string | null;
    currency: string;
    priority: string;
    starPriority: number;
    quantity: number;
    purchased: boolean;
    notes: string | null;
    category?: string | null;
  };
  wishlistId: string;
  onSave?: () => void;
  onDelete?: () => void;
}

function buildInitialData(item: ProductEditorDrawerProps['item']): ProductEditorData {
  return {
    title: item.title || '',
    brand: item.brand || '',
    model: '',
    category: item.category || '',
    subCategory: '',
    sku: '',
    upc: '',
    asin: '',
    mpn: '',
    url: item.url || '',
    storeUrl: '',
    description: item.description || '',
    notes: item.notes || '',
    tags: '',
    currentPrice: item.currentPrice || '',
    originalPrice: item.originalPrice || '',
    salePrice: '',
    dealAmount: item.dealInfo || '',
    discountPercent: '',
    shippingCost: '',
    tax: '',
    coupon: '',
    promoCode: '',
    finalTotal: '',
    priceLocked: false,
    sellers: item.retailer
      ? [
          {
            id: '1',
            name: item.retailer,
            price: item.currentPrice || '',
            shipping: '',
            url: item.url || '',
            availability: 'In Stock',
            isPreferred: true,
          },
        ]
      : [],
    images: item.image ? [item.image] : [],
    primaryImageIndex: 0,
    priority: item.priority || 'MEDIUM',
    quantity: String(item.quantity || 1),
    desiredPrice: '',
    purchaseStatus: item.purchased ? 'PURCHASED' : 'WANTED',
    needByDate: '',
    wishlistNotes: item.notes || '',
    folder: '',
    subFolder: '',
    wishlistCategory: item.category || '',
    customLabels: '',
    aiConfidence: '',
    aiTags: '',
    aiSuggestedCategory: '',
    aiSuggestedName: '',
    specs: [],
    createdAt: '',
    updatedAt: '',
    importedFrom: '',
    lastSynced: '',
    provider: '',
    extractionConfidence: '',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Drawer Component
// ─────────────────────────────────────────────────────────────────────────────

export function ProductEditorDrawer({
  open,
  onClose,
  item,
  wishlistId,
  onSave,
  onDelete,
}: ProductEditorDrawerProps) {
  const [data, setData] = useState<ProductEditorData>(() => buildInitialData(item));
  const [isDirty, setIsDirty] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const toast = useToast();

  // Track which sections are expanded
  const [sections, setSections] = useState<Record<string, boolean>>({
    info: true,
    pricing: true,
    sellers: false,
    images: false,
    wishlist: true,
    ai: false,
    specs: false,
    history: false,
  });

  const toggleSection = (key: string) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const updateField = useCallback(
    <K extends keyof ProductEditorData>(key: K, value: ProductEditorData[K]) => {
      setData((prev) => ({ ...prev, [key]: value }));
      setIsDirty(true);
    },
    []
  );

  const handleBeforeClose = useCallback((): boolean => {
    if (!isDirty) return true;
    return window.confirm('You have unsaved changes. Discard them?');
  }, [isDirty]);

  // ─── Save ───
  const handleSave = async (closeAfter = false) => {
    if (!data.title.trim()) {
      setError('Product name is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.set('wishlistId', wishlistId);
    formData.set('itemId', item.id);
    formData.set('title', data.title.trim());
    if (data.description) formData.set('description', data.description);
    if (data.url) formData.set('url', data.url);
    if (data.images.length > 0)
      formData.set('image', data.images[data.primaryImageIndex] || data.images[0]);
    if (data.brand) formData.set('brand', data.brand);
    if (data.sellers.length > 0) {
      const preferred = data.sellers.find((s) => s.isPreferred) || data.sellers[0];
      formData.set('retailer', preferred.name);
    }
    if (data.currentPrice) formData.set('currentPrice', data.currentPrice);
    formData.set('currency', item.currency || 'USD');
    formData.set('priority', data.priority);
    formData.set('quantity', data.quantity || '1');
    if (data.wishlistNotes) formData.set('notes', data.wishlistNotes);
    formData.set('purchased', data.purchaseStatus === 'PURCHASED' ? 'true' : 'false');

    try {
      const res = await fetch('/api/wishlists/add-item', {
        method: 'POST',
        body: formData,
      });
      const result = await res.json();

      if (!result.success && !res.ok) {
        setError(result.error || 'Failed to save.');
        setIsSubmitting(false);
        return;
      }

      setIsDirty(false);
      toast.success('Product updated successfully');
      onSave?.();
      if (closeAfter) onClose();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Delete ───
  const handleDelete = useCallback(async () => {
    if (!window.confirm('Delete this product? This cannot be undone.')) return;
    const fd = new FormData();
    fd.set('itemId', item.id);
    fd.set('wishlistId', wishlistId);
    try {
      await fetch('/api/wishlists/add-item', {
        method: 'DELETE',
        body: fd,
      });
      toast.success('Product removed');
      onDelete?.();
      onClose();
    } catch {
      toast.error('Failed to delete product');
    }
  }, [item.id, wishlistId, toast, onDelete, onClose]);

  // ─── AI Identify ───
  const handleAiIdentify = async () => {
    if (!data.title.trim()) return;
    updateField('aiConfidence', 'loading');
    try {
      const res = await fetch('/api/products/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: data.title }),
      });
      const result = await res.json();
      if (result.success && result.candidates?.length) {
        const c = result.candidates[0];
        updateField('aiConfidence', String(c.confidence || ''));
        updateField('aiSuggestedName', c.title || '');
        updateField('aiSuggestedCategory', c.category || '');
        updateField('aiTags', c.tags?.join(', ') || '');
        toast.success('AI identification complete');
      } else {
        updateField('aiConfidence', '');
        toast.error('Could not identify product');
      }
    } catch {
      updateField('aiConfidence', '');
      toast.error('AI identification failed');
    }
  };

  // ─── Overflow Menu Actions ───
  const overflowActions = useMemo(
    () => [
      {
        label: 'Duplicate',
        icon: Copy,
        action: () => {
          toast.info('Duplicate coming soon');
          setOverflowOpen(false);
        },
      },
      {
        label: 'Share',
        icon: Share2,
        action: () => {
          toast.info('Share coming soon');
          setOverflowOpen(false);
        },
      },
      {
        label: 'Copy Link',
        icon: ExternalLink,
        action: () => {
          if (data.url) {
            navigator.clipboard.writeText(data.url);
            toast.success('Link copied');
          }
          setOverflowOpen(false);
        },
      },
      {
        label: 'Archive',
        icon: Archive,
        action: () => {
          toast.info('Archive coming soon');
          setOverflowOpen(false);
        },
      },
      {
        label: 'Delete',
        icon: Trash2,
        action: () => {
          handleDelete();
          setOverflowOpen(false);
        },
        danger: true,
      },
    ],
    [data.url, toast, handleDelete]
  );

  // ─── Render ───
  return (
    <Drawer
      open={open}
      onClose={onClose}
      onBeforeClose={handleBeforeClose}
      size="xl"
      title={
        <div className="flex items-center gap-3">
          <span className="truncate">Edit Product</span>
          {isDirty && (
            <Badge variant="warning" className="text-[10px]">
              Unsaved
            </Badge>
          )}
        </div>
      }
      description={data.title || 'New product'}
      footer={
        <DrawerFooter
          isSubmitting={isSubmitting}
          onSave={() => handleSave(false)}
          onSaveClose={() => handleSave(true)}
          onCancel={() => {
            if (handleBeforeClose()) onClose();
          }}
        />
      }
    >
      <div className="relative">
        {/* Overflow menu button */}
        <div className="absolute top-4 right-4 z-10">
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setOverflowOpen((o) => !o)}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
            {overflowOpen && (
              <div className="border-border bg-card absolute top-full right-0 z-20 mt-1 w-44 rounded-xl border p-1 shadow-xl">
                {overflowActions.map((a) => (
                  <button
                    key={a.label}
                    type="button"
                    onClick={a.action}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                      'danger' in a && a.danger
                        ? 'text-danger hover:bg-danger/10'
                        : 'text-foreground hover:bg-surface'
                    )}
                  >
                    <a.icon className="h-4 w-4" />
                    {a.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="border-danger/30 bg-danger/5 text-danger mx-6 mt-4 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
            <button type="button" onClick={() => setError(null)} className="ml-auto">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="space-y-1 p-4">
          {/* ─── Product Information ─── */}
          <CollapsibleSection
            title="Product Information"
            expanded={sections.info}
            onToggle={() => toggleSection('info')}
          >
            <ProductInfoSection data={data} updateField={updateField} />
          </CollapsibleSection>

          {/* ─── Pricing ─── */}
          <CollapsibleSection
            title="Pricing"
            expanded={sections.pricing}
            onToggle={() => toggleSection('pricing')}
          >
            <PricingSection data={data} updateField={updateField} />
          </CollapsibleSection>

          {/* ─── Sellers ─── */}
          <CollapsibleSection
            title="Sellers"
            expanded={sections.sellers}
            onToggle={() => toggleSection('sellers')}
            badge={data.sellers.length > 0 ? String(data.sellers.length) : undefined}
          >
            <SellersSection data={data} setData={setData} setIsDirty={setIsDirty} />
          </CollapsibleSection>

          {/* ─── Images ─── */}
          <CollapsibleSection
            title="Images"
            expanded={sections.images}
            onToggle={() => toggleSection('images')}
            badge={data.images.length > 0 ? String(data.images.length) : undefined}
          >
            <ImagesSection data={data} setData={setData} setIsDirty={setIsDirty} />
          </CollapsibleSection>

          {/* ─── Wishlist ─── */}
          <CollapsibleSection
            title="Wishlist"
            expanded={sections.wishlist}
            onToggle={() => toggleSection('wishlist')}
          >
            <WishlistSection data={data} updateField={updateField} />
          </CollapsibleSection>

          {/* ─── AI Metadata ─── */}
          <CollapsibleSection
            title="AI Metadata"
            expanded={sections.ai}
            onToggle={() => toggleSection('ai')}
          >
            <AIMetadataSection
              data={data}
              updateField={updateField}
              onIdentify={handleAiIdentify}
            />
          </CollapsibleSection>

          {/* ─── Specifications ─── */}
          <CollapsibleSection
            title="Specifications"
            expanded={sections.specs}
            onToggle={() => toggleSection('specs')}
            badge={data.specs.length > 0 ? String(data.specs.length) : undefined}
          >
            <SpecsSection data={data} setData={setData} setIsDirty={setIsDirty} />
          </CollapsibleSection>

          {/* ─── History ─── */}
          <CollapsibleSection
            title="History & Import"
            expanded={sections.history}
            onToggle={() => toggleSection('history')}
          >
            <HistorySection data={data} />
          </CollapsibleSection>
        </div>
      </div>
    </Drawer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Collapsible Section
// ─────────────────────────────────────────────────────────────────────────────

function CollapsibleSection({
  title,
  expanded,
  onToggle,
  badge,
  children,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-border overflow-hidden rounded-xl border">
      <button
        type="button"
        onClick={onToggle}
        className="hover:bg-surface/50 flex w-full items-center gap-2 px-4 py-3 text-left transition-colors"
      >
        {expanded ? (
          <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0" />
        ) : (
          <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
        )}
        <span className="text-sm font-semibold">{title}</span>
        {badge && (
          <Badge variant="secondary" className="ml-auto text-[10px]">
            {badge}
          </Badge>
        )}
      </button>
      {expanded && <div className="border-border border-t px-4 py-4">{children}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Product Info Section
// ─────────────────────────────────────────────────────────────────────────────

type UpdateFn = <K extends keyof ProductEditorData>(key: K, value: ProductEditorData[K]) => void;

function ProductInfoSection({
  data,
  updateField,
}: {
  data: ProductEditorData;
  updateField: UpdateFn;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <FieldLabel label="Product Name" required />
        <Input
          value={data.title}
          onChange={(e) => updateField('title', e.target.value)}
          placeholder="e.g. NVIDIA RTX 5070 Ti"
        />
      </div>
      <div>
        <FieldLabel label="Brand" />
        <Input
          value={data.brand}
          onChange={(e) => updateField('brand', e.target.value)}
          placeholder="e.g. NVIDIA"
        />
      </div>
      <div>
        <FieldLabel label="Model" />
        <Input
          value={data.model}
          onChange={(e) => updateField('model', e.target.value)}
          placeholder="e.g. RTX 5070 Ti"
        />
      </div>
      <div>
        <FieldLabel label="Category" />
        <Input
          value={data.category}
          onChange={(e) => updateField('category', e.target.value)}
          placeholder="e.g. Graphics Cards"
        />
      </div>
      <div>
        <FieldLabel label="Sub Category" />
        <Input
          value={data.subCategory}
          onChange={(e) => updateField('subCategory', e.target.value)}
          placeholder="e.g. High-End"
        />
      </div>
      <div>
        <FieldLabel label="SKU" />
        <Input
          value={data.sku}
          onChange={(e) => updateField('sku', e.target.value)}
          placeholder="Retailer SKU"
          className="font-mono text-sm"
        />
      </div>
      <div>
        <FieldLabel label="UPC" />
        <Input
          value={data.upc}
          onChange={(e) => updateField('upc', e.target.value)}
          placeholder="UPC barcode"
          className="font-mono text-sm"
        />
      </div>
      <div>
        <FieldLabel label="ASIN" />
        <Input
          value={data.asin}
          onChange={(e) => updateField('asin', e.target.value)}
          placeholder="Amazon ASIN"
          className="font-mono text-sm"
        />
      </div>
      <div>
        <FieldLabel label="MPN" />
        <Input
          value={data.mpn}
          onChange={(e) => updateField('mpn', e.target.value)}
          placeholder="Manufacturer Part #"
          className="font-mono text-sm"
        />
      </div>
      <div className="sm:col-span-2">
        <FieldLabel label="Product URL" />
        <Input
          value={data.url}
          onChange={(e) => updateField('url', e.target.value)}
          type="url"
          placeholder="https://..."
        />
      </div>
      <div className="sm:col-span-2">
        <FieldLabel label="Store URL" />
        <Input
          value={data.storeUrl}
          onChange={(e) => updateField('storeUrl', e.target.value)}
          type="url"
          placeholder="https://..."
        />
      </div>
      <div className="sm:col-span-2">
        <FieldLabel label="Description" />
        <Textarea
          value={data.description}
          onChange={(e) => updateField('description', e.target.value)}
          placeholder="Product description..."
          rows={3}
        />
      </div>
      <div className="sm:col-span-2">
        <FieldLabel label="Notes" />
        <Textarea
          value={data.notes}
          onChange={(e) => updateField('notes', e.target.value)}
          placeholder="Personal notes..."
          rows={2}
        />
      </div>
      <div className="sm:col-span-2">
        <FieldLabel label="Tags" />
        <Input
          value={data.tags}
          onChange={(e) => updateField('tags', e.target.value)}
          placeholder="Comma-separated tags"
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pricing Section
// ─────────────────────────────────────────────────────────────────────────────

function PricingSection({ data, updateField }: { data: ProductEditorData; updateField: UpdateFn }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel label="Current Price" />
          <Input
            value={data.currentPrice}
            onChange={(e) => updateField('currentPrice', e.target.value)}
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
          />
        </div>
        <div>
          <FieldLabel label="Original Price" />
          <Input
            value={data.originalPrice}
            onChange={(e) => updateField('originalPrice', e.target.value)}
            type="number"
            step="0.01"
            min="0"
            placeholder="MSRP"
          />
        </div>
        <div>
          <FieldLabel label="Sale Price" />
          <Input
            value={data.salePrice}
            onChange={(e) => updateField('salePrice', e.target.value)}
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
          />
        </div>
        <div>
          <FieldLabel label="Deal Amount" />
          <Input
            value={data.dealAmount}
            onChange={(e) => updateField('dealAmount', e.target.value)}
            placeholder="e.g. $50 off"
          />
        </div>
        <div>
          <FieldLabel label="Discount %" />
          <Input
            value={data.discountPercent}
            onChange={(e) => updateField('discountPercent', e.target.value)}
            type="number"
            min="0"
            max="100"
            placeholder="0"
          />
        </div>
        <div>
          <FieldLabel label="Shipping Cost" />
          <Input
            value={data.shippingCost}
            onChange={(e) => updateField('shippingCost', e.target.value)}
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
          />
        </div>
        <div>
          <FieldLabel label="Tax" />
          <Input
            value={data.tax}
            onChange={(e) => updateField('tax', e.target.value)}
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
          />
        </div>
        <div>
          <FieldLabel label="Coupon" />
          <Input
            value={data.coupon}
            onChange={(e) => updateField('coupon', e.target.value)}
            placeholder="Coupon description"
          />
        </div>
        <div>
          <FieldLabel label="Promo Code" />
          <Input
            value={data.promoCode}
            onChange={(e) => updateField('promoCode', e.target.value)}
            placeholder="SAVE20"
            className="font-mono"
          />
        </div>
        <div>
          <FieldLabel label="Final Total" />
          <Input
            value={data.finalTotal}
            onChange={(e) => updateField('finalTotal', e.target.value)}
            type="number"
            step="0.01"
            min="0"
            placeholder="Calculated total"
          />
        </div>
      </div>
      {/* Price Lock */}
      <label className="border-border hover:bg-surface/50 flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors">
        <input
          type="checkbox"
          checked={data.priceLocked}
          onChange={(e) => updateField('priceLocked', e.target.checked)}
          className="border-border h-4 w-4 rounded"
        />
        <div>
          <p className="text-sm font-medium">Lock Manual Pricing</p>
          <p className="text-muted-foreground text-xs">
            Prevent automatic price refreshes from overwriting manual values
          </p>
        </div>
      </label>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sellers Section
// ─────────────────────────────────────────────────────────────────────────────

function SellersSection({
  data,
  setData,
  setIsDirty,
}: {
  data: ProductEditorData;
  setData: React.Dispatch<React.SetStateAction<ProductEditorData>>;
  setIsDirty: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const addSeller = () => {
    setData((prev) => ({
      ...prev,
      sellers: [
        ...prev.sellers,
        {
          id: String(Date.now()),
          name: '',
          price: '',
          shipping: '',
          url: '',
          availability: 'In Stock',
          isPreferred: prev.sellers.length === 0,
        },
      ],
    }));
    setIsDirty(true);
  };

  const removeSeller = (id: string) => {
    setData((prev) => ({
      ...prev,
      sellers: prev.sellers.filter((s) => s.id !== id),
    }));
    setIsDirty(true);
  };

  const updateSeller = (id: string, field: keyof Seller, value: string | boolean) => {
    setData((prev) => ({
      ...prev,
      sellers: prev.sellers.map((s) =>
        s.id === id
          ? { ...s, [field]: value }
          : field === 'isPreferred' && value === true
            ? { ...s, isPreferred: false }
            : s
      ),
    }));
    setIsDirty(true);
  };

  return (
    <div className="space-y-3">
      {data.sellers.map((seller) => (
        <div key={seller.id} className="border-border space-y-3 rounded-lg border p-3">
          <div className="flex items-center gap-2">
            <Input
              value={seller.name}
              onChange={(e) => updateSeller(seller.id, 'name', e.target.value)}
              placeholder="Retailer name"
              className="flex-1 font-medium"
            />
            <label className="flex cursor-pointer items-center gap-1.5 text-xs whitespace-nowrap">
              <input
                type="radio"
                name="preferredSeller"
                checked={seller.isPreferred}
                onChange={() => updateSeller(seller.id, 'isPreferred', true)}
                className="h-3 w-3"
              />
              Preferred
            </label>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-danger h-7 w-7 p-0"
              onClick={() => removeSeller(seller.id)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              value={seller.price}
              onChange={(e) => updateSeller(seller.id, 'price', e.target.value)}
              placeholder="Price"
              type="number"
              step="0.01"
            />
            <Input
              value={seller.shipping}
              onChange={(e) => updateSeller(seller.id, 'shipping', e.target.value)}
              placeholder="Shipping"
              type="number"
              step="0.01"
            />
            <Input
              value={seller.url}
              onChange={(e) => updateSeller(seller.id, 'url', e.target.value)}
              placeholder="Product URL"
              className="sm:col-span-2"
            />
            <Select
              value={seller.availability}
              onChange={(e) => updateSeller(seller.id, 'availability', e.target.value)}
            >
              <option value="In Stock">In Stock</option>
              <option value="Out of Stock">Out of Stock</option>
              <option value="Pre-order">Pre-order</option>
              <option value="Backorder">Backorder</option>
              <option value="Unknown">Unknown</option>
            </Select>
          </div>
        </div>
      ))}
      <Button type="button" variant="secondary" size="sm" className="gap-2" onClick={addSeller}>
        <Plus className="h-3.5 w-3.5" /> Add Seller
      </Button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Images Section
// ─────────────────────────────────────────────────────────────────────────────

function ImagesSection({
  data,
  setData,
  setIsDirty,
}: {
  data: ProductEditorData;
  setData: React.Dispatch<React.SetStateAction<ProductEditorData>>;
  setIsDirty: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const [urlInput, setUrlInput] = useState('');

  const addImage = (url: string) => {
    if (!url.trim()) return;
    setData((prev) => ({ ...prev, images: [...prev.images, url.trim()] }));
    setIsDirty(true);
    setUrlInput('');
  };

  const removeImage = (index: number) => {
    setData((prev) => {
      const images = prev.images.filter((_, i) => i !== index);
      const primaryImageIndex =
        prev.primaryImageIndex >= images.length ? 0 : prev.primaryImageIndex;
      return { ...prev, images, primaryImageIndex };
    });
    setIsDirty(true);
  };

  const setPrimary = (index: number) => {
    setData((prev) => ({ ...prev, primaryImageIndex: index }));
    setIsDirty(true);
  };

  const moveImage = (from: number, to: number) => {
    if (to < 0 || to >= data.images.length) return;
    setData((prev) => {
      const images = [...prev.images];
      const [moved] = images.splice(from, 1);
      images.splice(to, 0, moved);
      let primaryImageIndex = prev.primaryImageIndex;
      if (prev.primaryImageIndex === from) primaryImageIndex = to;
      else if (from < prev.primaryImageIndex && to >= prev.primaryImageIndex) primaryImageIndex--;
      else if (from > prev.primaryImageIndex && to <= prev.primaryImageIndex) primaryImageIndex++;
      return { ...prev, images, primaryImageIndex };
    });
    setIsDirty(true);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const url = e.dataTransfer.getData('text/plain');
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      addImage(url);
    }
  };

  return (
    <div className="space-y-4">
      {/* Image grid */}
      {data.images.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {data.images.map((img, i) => (
            <div
              key={`${img}-${i}`}
              className={cn(
                'group relative aspect-square overflow-hidden rounded-lg border',
                i === data.primaryImageIndex
                  ? 'border-accent ring-accent/30 ring-2'
                  : 'border-border'
              )}
            >
              <img src={img} alt="" className="h-full w-full object-cover" loading="lazy" />
              <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => setPrimary(i)}
                  className="rounded bg-white/20 p-1 text-white hover:bg-white/40"
                  title="Set as primary"
                >
                  <ImageIcon className="h-3 w-3" />
                </button>
                {i > 0 && (
                  <button
                    type="button"
                    onClick={() => moveImage(i, i - 1)}
                    className="rounded bg-white/20 p-1 text-white hover:bg-white/40"
                    title="Move left"
                  >
                    ←
                  </button>
                )}
                {i < data.images.length - 1 && (
                  <button
                    type="button"
                    onClick={() => moveImage(i, i + 1)}
                    className="rounded bg-white/20 p-1 text-white hover:bg-white/40"
                    title="Move right"
                  >
                    →
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="rounded bg-red-500/80 p-1 text-white hover:bg-red-500"
                  title="Remove"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              {i === data.primaryImageIndex && (
                <span className="bg-accent text-accent-foreground absolute bottom-1 left-1 rounded px-1.5 py-0.5 text-[9px] font-bold">
                  Primary
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Drop zone / URL input */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="border-border hover:border-accent/50 flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-6 text-center transition-colors"
      >
        <ImageIcon className="text-muted-foreground h-8 w-8" />
        <p className="text-muted-foreground text-sm">Drag and drop an image URL here</p>
        <div className="flex w-full max-w-sm gap-2">
          <Input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Paste image URL"
            className="flex-1 text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addImage(urlInput);
              }
            }}
          />
          <Button type="button" variant="secondary" size="sm" onClick={() => addImage(urlInput)}>
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Wishlist Section
// ─────────────────────────────────────────────────────────────────────────────

function WishlistSection({
  data,
  updateField,
}: {
  data: ProductEditorData;
  updateField: UpdateFn;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <FieldLabel label="Priority" />
        <Select value={data.priority} onChange={(e) => updateField('priority', e.target.value)}>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="CRITICAL">Critical / Must Have</option>
        </Select>
      </div>
      <div>
        <FieldLabel label="Quantity" />
        <Input
          value={data.quantity}
          onChange={(e) => updateField('quantity', e.target.value)}
          type="number"
          min="1"
          max="999"
        />
      </div>
      <div>
        <FieldLabel label="Desired Price" />
        <Input
          value={data.desiredPrice}
          onChange={(e) => updateField('desiredPrice', e.target.value)}
          type="number"
          step="0.01"
          min="0"
          placeholder="Target price"
        />
      </div>
      <div>
        <FieldLabel label="Purchase Status" />
        <Select
          value={data.purchaseStatus}
          onChange={(e) => updateField('purchaseStatus', e.target.value)}
        >
          <option value="WANTED">Wanted</option>
          <option value="CONSIDERING">Considering</option>
          <option value="DECIDED">Decided</option>
          <option value="ORDERED">Ordered</option>
          <option value="PURCHASED">Purchased</option>
        </Select>
      </div>
      <div>
        <FieldLabel label="Need By Date" />
        <Input
          value={data.needByDate}
          onChange={(e) => updateField('needByDate', e.target.value)}
          type="date"
        />
      </div>
      <div>
        <FieldLabel label="Folder" />
        <Input
          value={data.folder}
          onChange={(e) => updateField('folder', e.target.value)}
          placeholder="e.g. PC Build"
        />
      </div>
      <div>
        <FieldLabel label="Sub Folder" />
        <Input
          value={data.subFolder}
          onChange={(e) => updateField('subFolder', e.target.value)}
          placeholder="e.g. Components"
        />
      </div>
      <div>
        <FieldLabel label="Category" />
        <Input
          value={data.wishlistCategory}
          onChange={(e) => updateField('wishlistCategory', e.target.value)}
          placeholder="e.g. GPU"
        />
      </div>
      <div className="sm:col-span-2">
        <FieldLabel label="Custom Labels" />
        <Input
          value={data.customLabels}
          onChange={(e) => updateField('customLabels', e.target.value)}
          placeholder="Comma-separated labels"
        />
      </div>
      <div className="sm:col-span-2">
        <FieldLabel label="Wishlist Notes" />
        <Textarea
          value={data.wishlistNotes}
          onChange={(e) => updateField('wishlistNotes', e.target.value)}
          placeholder="Why you want this, alternatives..."
          rows={2}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Metadata Section
// ─────────────────────────────────────────────────────────────────────────────

function AIMetadataSection({
  data,
  updateField,
  onIdentify,
}: {
  data: ProductEditorData;
  updateField: UpdateFn;
  onIdentify: () => void;
}) {
  const isLoading = data.aiConfidence === 'loading';

  return (
    <div className="space-y-4">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="gap-2"
        onClick={onIdentify}
        disabled={isLoading}
      >
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
        {isLoading ? 'Identifying...' : 'Run AI Identification'}
      </Button>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel label="AI Confidence" />
          <Input
            value={isLoading ? '' : data.aiConfidence}
            readOnly
            placeholder="—"
            className="bg-surface/50"
          />
        </div>
        <div>
          <FieldLabel label="Generated Tags" />
          <Input
            value={data.aiTags}
            onChange={(e) => updateField('aiTags', e.target.value)}
            placeholder="AI-generated tags"
          />
        </div>
        <div>
          <FieldLabel label="Suggested Category" />
          <div className="flex gap-2">
            <Input
              value={data.aiSuggestedCategory}
              readOnly
              placeholder="—"
              className="bg-surface/50 flex-1"
            />
            {data.aiSuggestedCategory && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 text-xs"
                onClick={() => updateField('category', data.aiSuggestedCategory)}
              >
                Accept
              </Button>
            )}
          </div>
        </div>
        <div>
          <FieldLabel label="Suggested Name" />
          <div className="flex gap-2">
            <Input
              value={data.aiSuggestedName}
              readOnly
              placeholder="—"
              className="bg-surface/50 flex-1"
            />
            {data.aiSuggestedName && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="shrink-0 text-xs"
                onClick={() => updateField('title', data.aiSuggestedName)}
              >
                Accept
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Specifications Section
// ─────────────────────────────────────────────────────────────────────────────

function SpecsSection({
  data,
  setData,
  setIsDirty,
}: {
  data: ProductEditorData;
  setData: React.Dispatch<React.SetStateAction<ProductEditorData>>;
  setIsDirty: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const addSpec = () => {
    setData((prev) => ({
      ...prev,
      specs: [...prev.specs, { id: String(Date.now()), key: '', value: '' }],
    }));
    setIsDirty(true);
  };

  const removeSpec = (id: string) => {
    setData((prev) => ({
      ...prev,
      specs: prev.specs.filter((s) => s.id !== id),
    }));
    setIsDirty(true);
  };

  const updateSpec = (id: string, field: 'key' | 'value', value: string) => {
    setData((prev) => ({
      ...prev,
      specs: prev.specs.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
    }));
    setIsDirty(true);
  };

  return (
    <div className="space-y-3">
      {data.specs.length > 0 && (
        <div className="space-y-2">
          {data.specs.map((spec) => (
            <div key={spec.id} className="flex items-center gap-2">
              <Input
                value={spec.key}
                onChange={(e) => updateSpec(spec.id, 'key', e.target.value)}
                placeholder="e.g. CPU, Weight, Color"
                className="w-40 shrink-0 text-sm font-medium"
              />
              <Input
                value={spec.value}
                onChange={(e) => updateSpec(spec.id, 'value', e.target.value)}
                placeholder="Value"
                className="flex-1 text-sm"
              />
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-danger h-8 w-8 shrink-0 p-0"
                onClick={() => removeSpec(spec.id)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
      <Button type="button" variant="secondary" size="sm" className="gap-2" onClick={addSpec}>
        <Plus className="h-3.5 w-3.5" /> Add Specification
      </Button>
      {data.specs.length === 0 && (
        <p className="text-muted-foreground text-xs">
          Add custom specifications like CPU, GPU, VRAM, Weight, Dimensions, etc.
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// History Section
// ─────────────────────────────────────────────────────────────────────────────

function HistorySection({ data }: { data: ProductEditorData }) {
  const fields = [
    { label: 'Created', value: data.createdAt },
    { label: 'Last Updated', value: data.updatedAt },
    { label: 'Imported From', value: data.importedFrom },
    { label: 'Last Synced', value: data.lastSynced },
    { label: 'Provider', value: data.provider },
    { label: 'Extraction Confidence', value: data.extractionConfidence },
  ].filter((f) => f.value);

  if (fields.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No history data available yet. Information will appear here after the product is synced or
        imported.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {fields.map((f) => (
        <div
          key={f.label}
          className="bg-surface/50 flex items-center justify-between rounded-lg px-3 py-2"
        >
          <span className="text-muted-foreground text-xs font-medium">{f.label}</span>
          <span className="text-sm">{f.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared Helpers
// ─────────────────────────────────────────────────────────────────────────────

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <label className="text-foreground mb-1.5 block text-sm font-medium">
      {label}
      {required && <span className="text-danger ml-0.5">*</span>}
    </label>
  );
}

function DrawerFooter({
  isSubmitting,
  onSave,
  onSaveClose,
  onCancel,
}: {
  isSubmitting: boolean;
  onSave: () => void;
  onSaveClose: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <Button type="button" variant="ghost" size="md" onClick={onCancel}>
        Cancel
      </Button>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={onSave}
          disabled={isSubmitting}
          className="gap-2"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save
        </Button>
        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={onSaveClose}
          disabled={isSubmitting}
          className="gap-2"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save & Close
        </Button>
      </div>
    </>
  );
}
