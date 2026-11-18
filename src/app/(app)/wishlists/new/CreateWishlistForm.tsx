'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import type { ActionState } from '../../../(auth)/actions';
import { createWishlistAction } from '../actions';

const initialState: ActionState = { success: false };

export function CreateWishlistForm() {
  const [state, formAction, pending] = useActionState(createWishlistAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {state.error && (
        <div
          role="alert"
          className="border-danger/30 bg-danger/5 text-danger rounded-lg border px-4 py-3 text-sm"
        >
          {state.error}
        </div>
      )}

      {/* Title */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="wl-title" className="text-foreground text-sm font-medium">
          Title <span className="text-danger">*</span>
        </label>
        <Input
          id="wl-title"
          name="title"
          required
          placeholder="e.g. Birthday Wishlist"
          autoComplete="off"
        />
        {state.fieldErrors?.title && (
          <p className="text-danger text-xs">{state.fieldErrors.title[0]}</p>
        )}
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="wl-desc" className="text-foreground text-sm font-medium">
          Description
        </label>
        <Textarea
          id="wl-desc"
          name="description"
          placeholder="What is this wishlist for?"
          rows={3}
        />
        {state.fieldErrors?.description && (
          <p className="text-danger text-xs">{state.fieldErrors.description[0]}</p>
        )}
      </div>

      {/* Collections are always private — no sharing controls exist by design. */}
      <input type="hidden" name="visibility" value="PRIVATE" />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="wl-icon" className="text-foreground text-sm font-medium">
          Icon (emoji)
        </label>
        <Input id="wl-icon" name="icon" placeholder="🎁" maxLength={10} />
        {state.fieldErrors?.icon && (
          <p className="text-danger text-xs">{state.fieldErrors.icon[0]}</p>
        )}
      </div>

      {/* Color */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="wl-color" className="text-foreground text-sm font-medium">
          Color (optional)
        </label>
        <div className="flex items-center gap-3">
          <Input id="wl-color" name="color" placeholder="#3b82f6" className="max-w-40" />
          <span className="text-muted-foreground text-xs">Hex color for theming</span>
        </div>
        {state.fieldErrors?.color && (
          <p className="text-danger text-xs">{state.fieldErrors.color[0]}</p>
        )}
      </div>

      {/* Submit */}
      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={pending} className="gap-2">
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {pending ? 'Creating...' : 'Create Wishlist'}
        </Button>
        <Button asChild variant="ghost">
          <Link href="/wishlists">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
