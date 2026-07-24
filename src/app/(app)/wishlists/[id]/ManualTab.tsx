'use client';

import { useActionState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { CheckCircle2, Loader2 } from 'lucide-react';

import type { ActionState } from '../../../(auth)/actions';
import { createManualProductAction } from './product-actions';

const initialState: ActionState = { success: false };

interface ManualTabProps {
  wishlistId: string;
}

export function ManualTab({ wishlistId }: ManualTabProps) {
  const [state, formAction, pending] = useActionState(createManualProductAction, initialState);

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
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="wishlistId" value={wishlistId} />

      {state.error && (
        <div role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {state.error}
        </div>
      )}

      {/* Title */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="manual-title" className="text-sm font-medium text-foreground">
          Product Name <span className="text-danger">*</span>
        </label>
        <Input id="manual-title" name="title" required placeholder="e.g. Sony WH-1000XM5" />
        {state.fieldErrors?.title && <p className="text-xs text-danger">{state.fieldErrors.title[0]}</p>}
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
          <Input id="manual-brand" name="brand" placeholder="e.g. Sony" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="manual-retailer" className="text-sm font-medium text-foreground">Retailer</label>
          <Input id="manual-retailer" name="retailer" placeholder="e.g. Amazon" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="manual-sku" className="text-sm font-medium text-foreground">SKU</label>
          <Input id="manual-sku" name="sku" placeholder="Optional" />
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
