'use client';

/**
 * ProductEditorDrawer — Full-featured product editor in a right-side drawer.
 *
 * Persists ALL fields via PATCH /api/wishlists/items/[id].
 * Native columns: title, description, url, image, brand, retailer, currentPrice,
 *   originalPrice, dealInfo, currency, priority, quantity, purchased, notes, category.
 * Extended fields stored in `metadata` JSON column.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Archive,
  Check,
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
import { EnrichmentProgress, type EnrichmentProgressResult } from './EnrichmentProgress';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface Seller {
  id: string;
  name: string;
  logo: string;
  price: string;
  shipping: string;
  tax: string;
  coupon: string;
  promoCode: string;
  url: string;
  availability: string;
  notes: string;
  lastChecked: string;
  isPreferred: boolean;
  isVerified: boolean;
}

export interface SpecField {
  id: string;
  key: string;
  value: string;
  unit: string;
}

export interface ProductEditorData {
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
  sellers: Seller[];
  images: string[];
  primaryImageIndex: number;
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
  aiConfidence: string;
  aiTags: string;
  aiSuggestedCategory: string;
  aiSuggestedName: string;
  specs: SpecField[];
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

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

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
            logo: '',
            price: item.currentPrice || '',
            shipping: '',
            tax: '',
            coupon: '',
            promoCode: '',
            url: item.url || '',
            availability: 'In Stock',
            notes: '',
            lastChecked: '',
            isPreferred: true,
            isVerified: false,
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

/** Merge API response metadata into data state */
function mergeMetadata(base: ProductEditorData, meta: Record<string, unknown>): ProductEditorData {
  return {
    ...base,
    model: (meta.model as string) || base.model,
    subCategory: (meta.subCategory as string) || base.subCategory,
    sku: (meta.sku as string) || base.sku,
    upc: (meta.upc as string) || base.upc,
    asin: (meta.asin as string) || base.asin,
    mpn: (meta.mpn as string) || base.mpn,
    storeUrl: (meta.storeUrl as string) || base.storeUrl,
    tags: (meta.tags as string) || base.tags,
    salePrice: (meta.salePrice as string) || base.salePrice,
    dealAmount: (meta.dealAmount as string) || base.dealAmount,
    discountPercent: (meta.discountPercent as string) || base.discountPercent,
    shippingCost: (meta.shippingCost as string) || base.shippingCost,
    tax: (meta.tax as string) || base.tax,
    coupon: (meta.coupon as string) || base.coupon,
    promoCode: (meta.promoCode as string) || base.promoCode,
    finalTotal: (meta.finalTotal as string) || base.finalTotal,
    priceLocked: (meta.priceLocked as boolean) || base.priceLocked,
    sellers: (meta.sellers as Seller[]) || base.sellers,
    images: (meta.images as string[]) || base.images,
    primaryImageIndex: (meta.primaryImageIndex as number) ?? base.primaryImageIndex,
    desiredPrice: (meta.desiredPrice as string) || base.desiredPrice,
    purchaseStatus: (meta.purchaseStatus as string) || base.purchaseStatus,
    needByDate: (meta.needByDate as string) || base.needByDate,
    folder: (meta.folder as string) || base.folder,
    subFolder: (meta.subFolder as string) || base.subFolder,
    wishlistCategory: base.wishlistCategory, // Always from native DB column, not metadata
    wishlistNotes: (meta.wishlistNotes as string) || base.wishlistNotes,
    customLabels: (meta.customLabels as string) || base.customLabels,
    aiConfidence: (meta.aiConfidence as string) || base.aiConfidence,
    aiTags: (meta.aiTags as string) || base.aiTags,
    aiSuggestedCategory: (meta.aiSuggestedCategory as string) || base.aiSuggestedCategory,
    aiSuggestedName: (meta.aiSuggestedName as string) || base.aiSuggestedName,
    specs: (meta.specs as SpecField[]) || base.specs,
    importedFrom: (meta.importedFrom as string) || base.importedFrom,
    lastSynced: (meta.lastSynced as string) || base.lastSynced,
    provider: (meta.provider as string) || base.provider,
    extractionConfidence: (meta.extractionConfidence as string) || base.extractionConfidence,
  };
}

/** Calculate pricing totals */
function calcPricing(data: ProductEditorData) {
  const price = parseFloat(data.currentPrice) || 0;
  const original = parseFloat(data.originalPrice) || 0;
  const shipping = parseFloat(data.shippingCost) || 0;
  const tax = parseFloat(data.tax) || 0;

  const savings = original > price && price > 0 ? original - price : 0;
  const savingsPercent = original > 0 && savings > 0 ? Math.round((savings / original) * 100) : 0;
  const total = price + shipping + tax;

  return { savings: savings.toFixed(2), savingsPercent, total: total.toFixed(2) };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

type SaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved' | 'error';

export function ProductEditorDrawer({
  open,
  onClose,
  item,
  onSave,
  onDelete,
}: ProductEditorDrawerProps) {
  const [data, setData] = useState<ProductEditorData>(() => buildInitialData(item));
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [enrichOpen, setEnrichOpen] = useState(false);
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
  const toast = useToast();
  const savedTimer = useRef<ReturnType<typeof setTimeout>>(null);

  const isDirty = saveStatus === 'unsaved' || saveStatus === 'error';

  // Load full item data from API on open
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const loadItem = async () => {
      const r = await fetch(`/api/wishlists/items/${item.id}`);
      const res = await r.json();
      if (cancelled) return;
      if (res.success && res.item) {
        const base = buildInitialData({
          ...item,
          title: res.item.title,
          description: res.item.description,
          url: res.item.url,
          image: res.item.image,
          brand: res.item.brand,
          retailer: res.item.retailer,
          currentPrice: res.item.currentPrice,
          originalPrice: res.item.originalPrice,
          dealInfo: res.item.dealInfo,
          priority: res.item.priority,
          quantity: res.item.quantity,
          purchased: res.item.purchased,
          notes: res.item.notes,
          category: res.item.category,
        });
        const merged = mergeMetadata(base, res.item.metadata || {});
        merged.createdAt = res.item.createdAt || '';
        merged.updatedAt = res.item.updatedAt || '';
        // Native DB column is source of truth for category
        if (res.item.category) {
          merged.category = res.item.category;
          merged.wishlistCategory = res.item.category;
        }
        setData(merged);
      }
      setIsLoading(false);
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    loadItem().catch(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [open, item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSection = (key: string) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const updateField = useCallback(
    <K extends keyof ProductEditorData>(key: K, value: ProductEditorData[K]) => {
      setData((prev) => ({ ...prev, [key]: value }));
      setSaveStatus('unsaved');
    },
    []
  );

  const handleBeforeClose = useCallback((): boolean => {
    if (!isDirty) return true;
    return window.confirm('You have unsaved changes. Discard them?');
  }, [isDirty]);

  // ─── Save (persists everything) ───
  const handleSave = useCallback(
    async (closeAfter = false) => {
      if (!data.title.trim()) {
        setError('Product name is required.');
        return;
      }
      setSaveStatus('saving');
      setError(null);

      // Build metadata object with all extended fields
      const metadata = {
        model: data.model,
        subCategory: data.subCategory,
        sku: data.sku,
        upc: data.upc,
        asin: data.asin,
        mpn: data.mpn,
        storeUrl: data.storeUrl,
        tags: data.tags,
        salePrice: data.salePrice,
        dealAmount: data.dealAmount,
        discountPercent: data.discountPercent,
        shippingCost: data.shippingCost,
        tax: data.tax,
        coupon: data.coupon,
        promoCode: data.promoCode,
        finalTotal: data.finalTotal,
        priceLocked: data.priceLocked,
        sellers: data.sellers,
        images: data.images,
        primaryImageIndex: data.primaryImageIndex,
        desiredPrice: data.desiredPrice,
        purchaseStatus: data.purchaseStatus,
        needByDate: data.needByDate,
        folder: data.folder,
        subFolder: data.subFolder,
        wishlistNotes: data.wishlistNotes,
        customLabels: data.customLabels,
        aiConfidence: data.aiConfidence,
        aiTags: data.aiTags,
        aiSuggestedCategory: data.aiSuggestedCategory,
        aiSuggestedName: data.aiSuggestedName,
        specs: data.specs,
        importedFrom: data.importedFrom,
        lastSynced: data.lastSynced,
        provider: data.provider,
        extractionConfidence: data.extractionConfidence,
      };

      // Determine retailer from preferred seller
      const preferredSeller = data.sellers.find((s) => s.isPreferred) || data.sellers[0];

      const body = {
        title: data.title.trim(),
        description: data.description || undefined,
        url: data.url || undefined,
        image:
          data.images.length > 0
            ? data.images[data.primaryImageIndex] || data.images[0]
            : undefined,
        brand: data.brand || undefined,
        retailer: preferredSeller?.name || undefined,
        currentPrice: data.currentPrice || undefined,
        originalPrice: data.originalPrice || undefined,
        dealInfo: data.dealAmount || undefined,
        currency: 'USD',
        priority: data.priority,
        quantity: parseInt(data.quantity) || 1,
        purchased: data.purchaseStatus === 'PURCHASED',
        notes: data.wishlistNotes || data.notes || undefined,
        category: data.wishlistCategory || data.category || undefined,
        metadata,
      };

      try {
        const res = await fetch(`/api/wishlists/items/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const result = await res.json();

        if (!res.ok || !result.success) {
          setError(result.error || 'Failed to save.');
          setSaveStatus('error');
          return;
        }

        setSaveStatus('saved');
        if (savedTimer.current) clearTimeout(savedTimer.current);
        savedTimer.current = setTimeout(() => setSaveStatus('idle'), 2000);
        toast.success('Saved');
        onSave?.();
        if (closeAfter) onClose();
      } catch {
        setError('Network error. Please try again.');
        setSaveStatus('error');
      }
    },
    [data, item.id, toast, onSave, onClose]
  );

  // Ctrl+S keyboard shortcut
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave(false);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, handleSave]);

  // ─── Delete ───
  const handleDelete = useCallback(async () => {
    try {
      const res = await fetch(`/api/wishlists/items/${item.id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        toast.success('Product removed');
        onDelete?.();
        onClose();
      } else {
        toast.error('Failed to delete');
      }
    } catch {
      toast.error('Failed to delete product');
    }
  }, [item.id, toast, onDelete, onClose]);

  // ─── AI Identify ───
  const handleAiIdentify = async (): Promise<{
    modelUsed?: string;
    provider?: string;
    confidence?: number;
    specs?: number;
    images?: number;
    sellers?: number;
    tags?: number;
  } | null> => {
    if (!data.title.trim()) return null;
    updateField('aiConfidence', 'loading');
    try {
      const res = await fetch('/api/products/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: {
            title: data.title,
            brand: data.brand || undefined,
            category: data.category || undefined,
            description: data.description || undefined,
            url: data.url || undefined,
            retailer: data.sellers.find((s) => s.isPreferred)?.name || undefined,
            currentPrice: data.currentPrice ? parseFloat(data.currentPrice) : undefined,
            originalPrice: data.originalPrice ? parseFloat(data.originalPrice) : undefined,
            image: data.images[0] || undefined,
            sku: data.sku || undefined,
            asin: data.asin || undefined,
            upc: data.upc || undefined,
            mpn: data.mpn || undefined,
          },
        }),
      });
      const result = await res.json();

      if (result.success && result.enrichment) {
        const e = result.enrichment;
        // Fill empty fields only — never overwrite user data
        if (e.brand && !data.brand) updateField('brand', e.brand);
        if (e.model && !data.model) updateField('model', e.model);
        if (e.category && !data.category) {
          updateField('category', e.category);
          updateField('wishlistCategory', e.category);
        }
        if (e.subCategory && !data.subCategory) updateField('subCategory', e.subCategory);
        if (e.description && !data.description) updateField('description', e.description);
        if (e.sku && !data.sku) updateField('sku', e.sku);
        if (e.upc && !data.upc) updateField('upc', e.upc);
        if (e.asin && !data.asin) updateField('asin', e.asin);
        if (e.mpn && !data.mpn) updateField('mpn', e.mpn);
        if (e.msrp && !data.originalPrice) updateField('originalPrice', String(e.msrp));
        if (e.currentPrice && !data.currentPrice)
          updateField('currentPrice', String(e.currentPrice));

        // Tags: append
        if (e.tags && e.tags.length > 0) {
          const existingTags = data.tags
            ? data.tags.split(',').map((t: string) => t.trim().toLowerCase())
            : [];
          const newTags = e.tags.filter((t: string) => !existingTags.includes(t.toLowerCase()));
          if (newTags.length > 0) {
            updateField(
              'tags',
              data.tags ? `${data.tags}, ${newTags.join(', ')}` : newTags.join(', ')
            );
          }
        }

        // Images: append new ones
        if (e.images && e.images.length > 0) {
          const existing = new Set(data.images);
          const newImages = e.images.filter((img: string) => !existing.has(img));
          if (newImages.length > 0) {
            setData((prev) => ({ ...prev, images: [...prev.images, ...newImages] }));
            setSaveStatus('unsaved');
          }
        }

        // Sellers: append new
        if (e.sellers && e.sellers.length > 0) {
          const existingNames = new Set(data.sellers.map((s) => s.name.toLowerCase()));
          const newSellers = e.sellers
            .filter((s: { name: string }) => s.name && !existingNames.has(s.name.toLowerCase()))
            .map(
              (s: {
                name: string;
                url?: string;
                price?: number;
                shipping?: string;
                availability?: string;
              }) => ({
                id: String(Date.now() + Math.random()),
                name: s.name,
                logo: '',
                price: s.price ? String(s.price) : '',
                shipping: s.shipping || '',
                tax: '',
                coupon: '',
                promoCode: '',
                url: s.url || '',
                availability: s.availability || 'Unknown',
                notes: '',
                lastChecked: '',
                isPreferred: false,
                isVerified: false,
              })
            );
          if (newSellers.length > 0) {
            setData((prev) => ({ ...prev, sellers: [...prev.sellers, ...newSellers] }));
            setSaveStatus('unsaved');
          }
        }

        // Specifications: append new
        if (e.specifications && e.specifications.length > 0) {
          const existingKeys = new Set(data.specs.map((s) => s.key.toLowerCase()));
          const newSpecs = e.specifications
            .filter((s: { key: string }) => s.key && !existingKeys.has(s.key.toLowerCase()))
            .map((s: { key: string; value: string; unit?: string }) => ({
              id: String(Date.now() + Math.random()),
              key: s.key,
              value: s.value,
              unit: s.unit || '',
            }));
          if (newSpecs.length > 0) {
            setData((prev) => ({ ...prev, specs: [...prev.specs, ...newSpecs] }));
            setSaveStatus('unsaved');
          }
        }

        // AI metadata
        updateField('aiConfidence', String(e.confidence || ''));
        if (e.suggestedTitle) updateField('aiSuggestedName', e.suggestedTitle);
        if (e.suggestedCategory) updateField('aiSuggestedCategory', e.suggestedCategory);
        if (e.tags) updateField('aiTags', e.tags.join(', '));

        // Provider switch notification
        if (result.providerSwitched) {
          toast.info(`AI switched providers: ${result.switchReason}`);
        }

        toast.success('AI Autofill complete');
        return {
          modelUsed: result.modelUsed || result.enrichment?.modelUsed || undefined,
          provider: 'OpenRouter',
          confidence: result.enrichment?.confidence || undefined,
          specs: result.enrichment?.specifications?.length || undefined,
          images: result.enrichment?.images?.length || undefined,
          sellers: result.enrichment?.sellers?.length || undefined,
          tags: result.enrichment?.tags?.length || undefined,
        };
      } else {
        updateField('aiConfidence', '');
        toast.error(result.error || 'Could not enrich product');
        return null;
      }
    } catch {
      updateField('aiConfidence', '');
      toast.error('AI Autofill failed');
      return null;
    }
  };

  // ─── Overflow Menu ───
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
    ],
    [data.url, toast]
  );

  // ─── Pricing calculations ───
  const pricing = useMemo(() => calcPricing(data), [data]);

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
          <SaveStatusBadge status={saveStatus} />
        </div>
      }
      description={data.title || 'New product'}
      footer={
        <DrawerFooter
          saveStatus={saveStatus}
          onSave={() => handleSave(false)}
          onSaveClose={() => handleSave(true)}
          onCancel={() => {
            if (handleBeforeClose()) onClose();
          }}
          onDelete={() => setDeleteConfirm(true)}
          onAiAutofill={() => setEnrichOpen(true)}
          aiLoading={enrichOpen}
        />
      }
    >
      {/* Loading overlay */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        </div>
      )}

      {!isLoading && (
        <div className="relative">
          {/* Overflow menu */}
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
                      className="text-foreground hover:bg-surface flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors"
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
            <CollapsibleSection
              title="Product Information"
              expanded={sections.info}
              onToggle={() => toggleSection('info')}
            >
              <ProductInfoSection data={data} updateField={updateField} />
            </CollapsibleSection>

            <CollapsibleSection
              title="Pricing"
              expanded={sections.pricing}
              onToggle={() => toggleSection('pricing')}
            >
              <PricingSection data={data} updateField={updateField} pricing={pricing} />
            </CollapsibleSection>

            <CollapsibleSection
              title="Sellers"
              expanded={sections.sellers}
              onToggle={() => toggleSection('sellers')}
              badge={data.sellers.length > 0 ? String(data.sellers.length) : undefined}
            >
              <SellersSection data={data} setData={setData} setSaveStatus={setSaveStatus} />
            </CollapsibleSection>

            <CollapsibleSection
              title="Images"
              expanded={sections.images}
              onToggle={() => toggleSection('images')}
              badge={data.images.length > 0 ? String(data.images.length) : undefined}
            >
              <ImagesSection data={data} setData={setData} setSaveStatus={setSaveStatus} />
            </CollapsibleSection>

            <CollapsibleSection
              title="Wishlist"
              expanded={sections.wishlist}
              onToggle={() => toggleSection('wishlist')}
            >
              <WishlistSection data={data} updateField={updateField} />
            </CollapsibleSection>

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

            <CollapsibleSection
              title="Specifications"
              expanded={sections.specs}
              onToggle={() => toggleSection('specs')}
              badge={data.specs.length > 0 ? String(data.specs.length) : undefined}
            >
              <SpecsSection data={data} setData={setData} setSaveStatus={setSaveStatus} />
            </CollapsibleSection>

            <CollapsibleSection
              title="History & Import"
              expanded={sections.history}
              onToggle={() => toggleSection('history')}
            >
              <HistorySection data={data} />
            </CollapsibleSection>
          </div>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="border-border bg-card w-full max-w-sm rounded-xl border p-6 shadow-2xl">
            <h3 className="text-lg font-semibold">Delete Product</h3>
            <p className="text-muted-foreground mt-2 text-sm">
              Are you sure you want to delete &ldquo;{data.title}&rdquo;? This action cannot be
              undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" size="md" onClick={() => setDeleteConfirm(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="md"
                onClick={() => {
                  setDeleteConfirm(false);
                  handleDelete();
                }}
              >
                Delete Product
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Enrichment Progress Panel */}
      <EnrichmentProgress
        open={enrichOpen}
        onClose={() => setEnrichOpen(false)}
        productTitle={data.title}
        onEnrich={async (): Promise<EnrichmentProgressResult> => {
          const startTime = Date.now();
          try {
            const result = await handleAiIdentify();
            const duration = parseFloat(((Date.now() - startTime) / 1000).toFixed(1));
            if (result) {
              return {
                success: true,
                summary: {
                  specifications: result.specs,
                  images: result.images,
                  sellers: result.sellers,
                  tags: result.tags,
                  fields: Object.values(data).filter((v) => v && v !== '' && v !== 'loading')
                    .length,
                  duration,
                  confidence: result.confidence,
                  provider: result.provider,
                  model: result.modelUsed,
                },
              };
            }
            return { success: false, error: 'No results returned' };
          } catch (err) {
            return {
              success: false,
              error: err instanceof Error ? err.message : 'Enrichment failed',
            };
          }
        }}
      />
    </Drawer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Save Status Badge
// ─────────────────────────────────────────────────────────────────────────────

function SaveStatusBadge({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null;
  const config = {
    unsaved: { variant: 'warning' as const, label: 'Unsaved', icon: null },
    saving: { variant: 'accent' as const, label: 'Saving...', icon: Loader2 },
    saved: { variant: 'success' as const, label: 'Saved', icon: Check },
    error: { variant: 'danger' as const, label: 'Error', icon: AlertCircle },
  };
  const c = config[status];
  if (!c) return null;
  return (
    <Badge variant={c.variant} className="gap-1 text-[10px]">
      {c.icon && <c.icon className="h-3 w-3" />}
      {c.label}
    </Badge>
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
  const urlInvalid = data.url !== '' && !data.url.startsWith('http');
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <FieldLabel label="Product Name" required />
        <Input
          value={data.title}
          onChange={(e) => updateField('title', e.target.value)}
          placeholder="e.g. NVIDIA RTX 5070 Ti"
          invalid={data.title.length === 0}
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
          onChange={(e) => {
            updateField('category', e.target.value);
            updateField('wishlistCategory', e.target.value);
          }}
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
          invalid={urlInvalid}
        />
        {urlInvalid && (
          <p className="text-danger mt-1 text-xs">Must be a valid URL starting with http</p>
        )}
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
// Pricing Section (with live calculations)
// ─────────────────────────────────────────────────────────────────────────────

function PricingSection({
  data,
  updateField,
  pricing,
}: {
  data: ProductEditorData;
  updateField: UpdateFn;
  pricing: { savings: string; savingsPercent: number; total: string };
}) {
  const priceInvalid =
    data.currentPrice !== '' && (isNaN(Number(data.currentPrice)) || Number(data.currentPrice) < 0);
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
            invalid={priceInvalid}
          />
          {priceInvalid && (
            <p className="text-danger mt-1 text-xs">Price must be a positive number</p>
          )}
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

      {/* Live pricing summary */}
      {parseFloat(data.currentPrice) > 0 && (
        <div className="bg-surface/50 space-y-1 rounded-lg p-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">${parseFloat(data.currentPrice).toFixed(2)}</span>
          </div>
          {parseFloat(data.shippingCost) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">+ Shipping</span>
              <span>${parseFloat(data.shippingCost).toFixed(2)}</span>
            </div>
          )}
          {parseFloat(data.tax) > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">+ Tax</span>
              <span>${parseFloat(data.tax).toFixed(2)}</span>
            </div>
          )}
          {pricing.savingsPercent > 0 && (
            <div className="text-success flex justify-between text-sm">
              <span>Savings ({pricing.savingsPercent}%)</span>
              <span>-${pricing.savings}</span>
            </div>
          )}
          <div className="border-border flex justify-between border-t pt-1 text-sm font-semibold">
            <span>Total</span>
            <span>${pricing.total}</span>
          </div>
        </div>
      )}

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
// Sellers Section (full fields)
// ─────────────────────────────────────────────────────────────────────────────

function SellersSection({
  data,
  setData,
  setSaveStatus,
}: {
  data: ProductEditorData;
  setData: React.Dispatch<React.SetStateAction<ProductEditorData>>;
  setSaveStatus: React.Dispatch<React.SetStateAction<SaveStatus>>;
}) {
  const addSeller = () => {
    setData((prev) => ({
      ...prev,
      sellers: [
        ...prev.sellers,
        {
          id: String(Date.now()),
          name: '',
          logo: '',
          price: '',
          shipping: '',
          tax: '',
          coupon: '',
          promoCode: '',
          url: '',
          availability: 'In Stock',
          notes: '',
          lastChecked: '',
          isPreferred: prev.sellers.length === 0,
          isVerified: false,
        },
      ],
    }));
    setSaveStatus('unsaved');
  };

  const removeSeller = (id: string) => {
    setData((prev) => ({ ...prev, sellers: prev.sellers.filter((s) => s.id !== id) }));
    setSaveStatus('unsaved');
  };

  const updateSeller = (id: string, field: keyof Seller, value: string | boolean) => {
    setData((prev) => ({
      ...prev,
      sellers: prev.sellers.map((s) => {
        if (s.id === id) return { ...s, [field]: value };
        if (field === 'isPreferred' && value === true) return { ...s, isPreferred: false };
        return s;
      }),
    }));
    setSaveStatus('unsaved');
  };

  return (
    <div className="space-y-3">
      {data.sellers.map((seller) => (
        <div
          key={seller.id}
          className={cn(
            'space-y-3 rounded-lg border p-3',
            seller.isPreferred ? 'border-accent/40 bg-accent/5' : 'border-border'
          )}
        >
          <div className="flex items-center gap-2">
            <Input
              value={seller.name}
              onChange={(e) => updateSeller(seller.id, 'name', e.target.value)}
              placeholder="Store name"
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
            <label className="flex cursor-pointer items-center gap-1.5 text-xs whitespace-nowrap">
              <input
                type="checkbox"
                checked={seller.isVerified}
                onChange={(e) => updateSeller(seller.id, 'isVerified', e.target.checked)}
                className="h-3 w-3"
              />
              Verified
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
          <div className="grid gap-2 sm:grid-cols-3">
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
              value={seller.tax}
              onChange={(e) => updateSeller(seller.id, 'tax', e.target.value)}
              placeholder="Tax"
              type="number"
              step="0.01"
            />
            <Input
              value={seller.coupon}
              onChange={(e) => updateSeller(seller.id, 'coupon', e.target.value)}
              placeholder="Coupon"
            />
            <Input
              value={seller.promoCode}
              onChange={(e) => updateSeller(seller.id, 'promoCode', e.target.value)}
              placeholder="Promo code"
              className="font-mono"
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
          <Input
            value={seller.url}
            onChange={(e) => updateSeller(seller.id, 'url', e.target.value)}
            placeholder="Product URL at this store"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              value={seller.logo}
              onChange={(e) => updateSeller(seller.id, 'logo', e.target.value)}
              placeholder="Store logo URL (optional)"
            />
            <Input
              value={seller.lastChecked}
              onChange={(e) => updateSeller(seller.id, 'lastChecked', e.target.value)}
              type="date"
              placeholder="Last checked"
            />
          </div>
          <Textarea
            value={seller.notes}
            onChange={(e) => updateSeller(seller.id, 'notes', e.target.value)}
            placeholder="Seller notes..."
            rows={1}
            className="text-xs"
          />
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
  setSaveStatus,
}: {
  data: ProductEditorData;
  setData: React.Dispatch<React.SetStateAction<ProductEditorData>>;
  setSaveStatus: React.Dispatch<React.SetStateAction<SaveStatus>>;
}) {
  const [urlInput, setUrlInput] = useState('');
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const addImage = (url: string) => {
    if (!url.trim()) return;
    setData((prev) => ({ ...prev, images: [...prev.images, url.trim()] }));
    setSaveStatus('unsaved');
    setUrlInput('');
  };

  const removeImage = (index: number) => {
    setData((prev) => {
      const images = prev.images.filter((_, i) => i !== index);
      const primaryImageIndex =
        prev.primaryImageIndex >= images.length ? 0 : prev.primaryImageIndex;
      return { ...prev, images, primaryImageIndex };
    });
    setSaveStatus('unsaved');
  };

  const setPrimary = (index: number) => {
    setData((prev) => ({ ...prev, primaryImageIndex: index }));
    setSaveStatus('unsaved');
  };

  const moveImage = (from: number, to: number) => {
    if (to < 0 || to >= data.images.length) return;
    setData((prev) => {
      const images = [...prev.images];
      const [moved] = images.splice(from, 1);
      images.splice(to, 0, moved);
      let pi = prev.primaryImageIndex;
      if (prev.primaryImageIndex === from) pi = to;
      else if (from < prev.primaryImageIndex && to >= prev.primaryImageIndex) pi--;
      else if (from > prev.primaryImageIndex && to <= prev.primaryImageIndex) pi++;
      return { ...prev, images, primaryImageIndex: pi };
    });
    setSaveStatus('unsaved');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const url = e.dataTransfer.getData('text/plain');
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) addImage(url);
  };

  return (
    <div className="space-y-4">
      {data.images.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {data.images.map((img, i) => (
            <div
              key={`${img}-${i}`}
              className={cn(
                'group relative aspect-square cursor-pointer overflow-hidden rounded-lg border',
                i === data.primaryImageIndex
                  ? 'border-accent ring-accent/30 ring-2'
                  : 'border-border'
              )}
            >
              <img
                src={img}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
                onClick={() => setZoomedImage(img)}
              />
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

      {/* Image zoom modal */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-[60] flex cursor-pointer items-center justify-center bg-black/80"
          onClick={() => setZoomedImage(null)}
        >
          <img
            src={zoomedImage}
            alt="Zoomed"
            className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain"
          />
          <button
            type="button"
            className="absolute top-4 right-4 text-white"
            onClick={() => setZoomedImage(null)}
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      )}
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
          onChange={(e) => {
            updateField('wishlistCategory', e.target.value);
            updateField('category', e.target.value);
          }}
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
        disabled={isLoading || !data.title.trim()}
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
                className="text-accent shrink-0 text-xs"
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
                className="text-accent shrink-0 text-xs"
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
// Specifications Section (with units)
// ─────────────────────────────────────────────────────────────────────────────

function SpecsSection({
  data,
  setData,
  setSaveStatus,
}: {
  data: ProductEditorData;
  setData: React.Dispatch<React.SetStateAction<ProductEditorData>>;
  setSaveStatus: React.Dispatch<React.SetStateAction<SaveStatus>>;
}) {
  const addSpec = () => {
    setData((prev) => ({
      ...prev,
      specs: [...prev.specs, { id: String(Date.now()), key: '', value: '', unit: '' }],
    }));
    setSaveStatus('unsaved');
  };

  const removeSpec = (id: string) => {
    setData((prev) => ({ ...prev, specs: prev.specs.filter((s) => s.id !== id) }));
    setSaveStatus('unsaved');
  };

  const updateSpec = (id: string, field: 'key' | 'value' | 'unit', value: string) => {
    setData((prev) => ({
      ...prev,
      specs: prev.specs.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
    }));
    setSaveStatus('unsaved');
  };

  return (
    <div className="space-y-3">
      {data.specs.length > 0 && (
        <div className="space-y-2">
          <div className="text-muted-foreground grid grid-cols-[1fr_1fr_80px_32px] gap-2 px-1 text-[10px] font-medium">
            <span>Name</span>
            <span>Value</span>
            <span>Unit</span>
            <span />
          </div>
          {data.specs.map((spec) => (
            <div key={spec.id} className="grid grid-cols-[1fr_1fr_80px_32px] items-center gap-2">
              <Input
                value={spec.key}
                onChange={(e) => updateSpec(spec.id, 'key', e.target.value)}
                placeholder="e.g. VRAM"
                className="text-sm"
              />
              <Input
                value={spec.value}
                onChange={(e) => updateSpec(spec.id, 'value', e.target.value)}
                placeholder="e.g. 16"
                className="text-sm"
              />
              <Input
                value={spec.unit}
                onChange={(e) => updateSpec(spec.id, 'unit', e.target.value)}
                placeholder="GB"
                className="text-sm"
              />
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-danger h-8 w-8 p-0"
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
          Add custom specs like VRAM: 16 GB, Weight: 2.1 lb, Socket: AM5
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
    { label: 'Created', value: data.createdAt ? new Date(data.createdAt).toLocaleString() : '' },
    {
      label: 'Last Updated',
      value: data.updatedAt ? new Date(data.updatedAt).toLocaleString() : '',
    },
    { label: 'Imported From', value: data.importedFrom },
    { label: 'Last Synced', value: data.lastSynced },
    { label: 'Provider', value: data.provider },
    {
      label: 'Extraction Confidence',
      value: data.extractionConfidence ? `${data.extractionConfidence}%` : '',
    },
  ].filter((f) => f.value);

  if (fields.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No history data available yet. Information appears here after the product is synced or
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
  saveStatus,
  onSave,
  onSaveClose,
  onCancel,
  onDelete,
  onAiAutofill,
  aiLoading,
}: {
  saveStatus: SaveStatus;
  onSave: () => void;
  onSaveClose: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onAiAutofill: () => void;
  aiLoading: boolean;
}) {
  const isSaving = saveStatus === 'saving';
  return (
    <>
      <div className="flex items-center gap-2">
        <Button type="button" variant="danger" size="sm" onClick={onDelete} className="gap-1.5">
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onAiAutofill}
          disabled={aiLoading}
          className="gap-1.5"
        >
          {aiLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" />
          )}
          AI Autofill
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="md" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="md"
          onClick={onSave}
          disabled={isSaving}
          className="gap-2"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save
        </Button>
        <Button
          type="button"
          variant="primary"
          size="md"
          onClick={onSaveClose}
          disabled={isSaving}
          className="gap-2"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save & Close
        </Button>
      </div>
    </>
  );
}
