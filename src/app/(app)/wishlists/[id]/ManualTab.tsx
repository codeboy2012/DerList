'use client';

import { useActionState, useRef, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { CheckCircle2, Loader2, Sparkles } from 'lucide-react';

import type { ActionState } from '../../../(auth)/actions';
import { createManualProductAction } from './product-actions';

const initialState: ActionState = { success: false };

interface ManualTabProps {
  wishlistId: string;
}

export function ManualTab({ wishlistId }: ManualTabProps) {
  const [state, formAction, pending] = useActionState(createManualProductAction, initialState);
  const [aiStatus, setAiStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [aiMessage, setAiMessage] = useState('');
  const formRef = useRef<HTMLFormElement>(null);

  const handleAutoFill = async () => {
    const form = formRef.current;
    if (!form) return;

    const titleInput = form.querySelector<HTMLInputElement>('[name="title"]');
    const title = titleInput?.value?.trim();
    if (!title || title.length < 2) {
      setAiStatus('error');
      setAiMessage('Enter a product name first.');
      return;
    }

    setAiStatus('loading');
    setAiMessage('Identifying product...');

    try {
      const res = await fetch('/api/products/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'manual', data: { title } }),
      });

      const data = await res.json();

      if (!data.success || !data.candidates || data.candidates.length === 0) {
        setAiStatus('error');
        setAiMessage(data.error || 'Could not identify product. Try adding more details.');
        return;
      }

      const candidate = data.candidates[0];

      // Fill fields — only fill empty fields (don't overwrite user input)
      fillIfEmpty(form, 'brand', candidate.brand);
      fillIfEmpty(form, 'retailer', candidate.retailer);
      fillIfEmpty(form, 'category', candidate.category);
      fillIfEmpty(form, 'url', candidate.url);
      fillIfEmpty(form, 'image', candidate.image);
      fillIfEmpty(form, 'sku', candidate.sku);
      fillIfEmpty(form, 'description', candidate.description);

      if (candidate.currentPrice != null) {
        fillIfEmpty(form, 'currentPrice', String(candidate.currentPrice));
      }
      if (candidate.originalPrice != null) {
        fillIfEmpty(form, 'originalPrice', String(candidate.originalPrice));
      }
      if (candidate.dealInfo) {
        fillIfEmpty(form, 'dealInfo', candidate.dealInfo);
      }
      if (candidate.currency && candidate.currency !== 'USD') {
        fillIfEmpty(form, 'currency', candidate.currency);
      }

      // Update title if AI found a better/more complete one
      if (candidate.title && candidate.title.length > title.length && titleInput) {
        titleInput.value = candidate.title;
      }

      const verified = candidate.verified ? '✓ Verified in DerList' : '⚠ AI-identified (unverified)';
      setAiStatus('done');
      setAiMessage(`Product identified (${candidate.confidence}% confidence). ${verified}`);
    } catch {
      setAiStatus('error');
      setAiMessage('Failed to connect to AI. Try again later.');
    }
  };

  if (state.success) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/5 px-4 py-4">
        <CheckCircle2 className="h-5 w-5 text-success" />
        <div>
          <p className="text-sm font-medium text-foreground">Product added!</p>
          <p className="text-xs text-muted-foreground">The item has been added to your wishlist.</p>
        </div>
        <Button asChild size="sm" variant="ghost" className="ml-auto">
          <a href={`/wishlists/${wishlistId}?add=true`}>Add Another</a>
        </Button>
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="wishlistId" value={wishlistId} />

      {state.error && (
        <div role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {state.error}
        </div>
      )}

      {/* Title + AI Auto-Fill */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="manual-title" className="text-sm font-medium text-foreground">
          Product Name <span className="text-danger">*</span>
        </label>
        <div className="flex gap-2">
          <Input id="manual-title" name="title" required placeholder="e.g. ASRock B760 Pro RS WiFi 6E" className="flex-1" />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="shrink-0 gap-1.5 text-xs"
            onClick={handleAutoFill}
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
        {state.fieldErrors?.title && <p className="text-xs text-danger">{state.fieldErrors.title[0]}</p>}

        {/* AI Status */}
        {aiStatus === 'loading' && (
          <div className="flex items-center gap-2 rounded-md bg-accent/5 px-2.5 py-1.5">
            <Loader2 className="h-3 w-3 animate-spin text-accent" />
            <span className="text-[11px] text-accent">{aiMessage}</span>
          </div>
        )}
        {aiStatus === 'done' && (
          <div className="flex items-center gap-2 rounded-md bg-success/5 px-2.5 py-1.5">
            <CheckCircle2 className="h-3 w-3 text-success" />
            <span className="text-[11px] text-success">{aiMessage}</span>
          </div>
        )}
        {aiStatus === 'error' && (
          <div className="rounded-md bg-danger/5 px-2.5 py-1.5">
            <span className="text-[11px] text-danger">{aiMessage}</span>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="manual-url" className="text-sm font-medium text-foreground">URL</label>
          <Input id="manual-url" name="url" type="url" placeholder="https://..." />
          {state.fieldErrors?.url && <p className="text-xs text-danger">{state.fieldErrors.url[0]}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="manual-image" className="text-sm font-medium text-foreground">Image URL</label>
          <Input id="manual-image" name="image" type="url" placeholder="https://..." />
          {state.fieldErrors?.image && <p className="text-xs text-danger">{state.fieldErrors.image[0]}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="manual-price" className="text-sm font-medium text-foreground">Price</label>
          <Input id="manual-price" name="currentPrice" type="number" step="0.01" min="0" placeholder="0.00" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="manual-currency" className="text-sm font-medium text-foreground">Currency</label>
          <Input id="manual-currency" name="currency" defaultValue="USD" maxLength={3} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="manual-brand" className="text-sm font-medium text-foreground">Brand</label>
          <Input id="manual-brand" name="brand" placeholder="e.g. ASRock" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="manual-retailer" className="text-sm font-medium text-foreground">Retailer</label>
          <Input id="manual-retailer" name="retailer" placeholder="e.g. Amazon" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="manual-sku" className="text-sm font-medium text-foreground">SKU</label>
          <Input id="manual-sku" name="sku" placeholder="Optional" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="manual-category" className="text-sm font-medium text-foreground">Category</label>
          <Input id="manual-category" name="category" placeholder="e.g. Motherboard, GPU, SSD" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="manual-originalPrice" className="text-sm font-medium text-foreground">Original Price</label>
          <Input id="manual-originalPrice" name="originalPrice" type="number" step="0.01" min="0" placeholder="List/MSRP price" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="manual-dealInfo" className="text-sm font-medium text-foreground">Deal Info</label>
          <Input id="manual-dealInfo" name="dealInfo" placeholder="e.g. $50 off coupon" />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="manual-desc" className="text-sm font-medium text-foreground">Description</label>
        <Textarea id="manual-desc" name="description" placeholder="Optional description..." rows={2} />
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={pending} size="sm" className="gap-2">
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
          {pending ? 'Adding...' : 'Add to Wishlist'}
        </Button>
        <Button asChild variant="ghost" size="sm">
          <a href={`/wishlists/${wishlistId}`}>Cancel</a>
        </Button>
      </div>
    </form>
  );
}

/** Fill a form field only if it's currently empty. */
function fillIfEmpty(form: HTMLFormElement, name: string, value: string | null | undefined) {
  if (!value) return;
  const input = form.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`);
  if (input && !input.value.trim()) {
    // Use native setter to trigger React's change detection
    const nativeSetter = Object.getOwnPropertyDescriptor(
      input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
      'value',
    )?.set;
    if (nativeSetter) {
      nativeSetter.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      input.value = value;
    }
  }
}
