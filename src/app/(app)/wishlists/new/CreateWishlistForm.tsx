'use client';

import { useActionState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

import type { ActionState } from '../../../(auth)/actions';
import { createWishlistAction } from '../actions';

const initialState: ActionState = { success: false };

export function CreateWishlistForm() {
  const [state, formAction, pending] = useActionState(createWishlistAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {state.error && (
        <div role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {state.error}
        </div>
      )}

      {/* Title */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="wl-title" className="text-sm font-medium text-foreground">
          Title <span className="text-danger">*</span>
        </label>
        <Input id="wl-title" name="title" required placeholder="e.g. Birthday Wishlist" autoComplete="off" />
        {state.fieldErrors?.title && <p className="text-xs text-danger">{state.fieldErrors.title[0]}</p>}
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="wl-desc" className="text-sm font-medium text-foreground">
          Description
        </label>
        <Textarea id="wl-desc" name="description" placeholder="What is this wishlist for?" rows={3} />
        {state.fieldErrors?.description && <p className="text-xs text-danger">{state.fieldErrors.description[0]}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Visibility */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="wl-visibility" className="text-sm font-medium text-foreground">
            Visibility
          </label>
          <Select id="wl-visibility" name="visibility" defaultValue="PRIVATE">
            <option value="PRIVATE">Private — Only you</option>
            <option value="UNLISTED">Unlisted — Anyone with the link</option>
            <option value="PUBLIC">Public — Visible on your profile</option>
          </Select>
          {state.fieldErrors?.visibility && <p className="text-xs text-danger">{state.fieldErrors.visibility[0]}</p>}
        </div>

        {/* Icon */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="wl-icon" className="text-sm font-medium text-foreground">
            Icon (emoji)
          </label>
          <Input id="wl-icon" name="icon" placeholder="🎁" maxLength={10} />
          {state.fieldErrors?.icon && <p className="text-xs text-danger">{state.fieldErrors.icon[0]}</p>}
        </div>
      </div>

      {/* Color */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="wl-color" className="text-sm font-medium text-foreground">
          Color (optional)
        </label>
        <div className="flex items-center gap-3">
          <Input id="wl-color" name="color" placeholder="#3b82f6" className="max-w-40" />
          <span className="text-xs text-muted-foreground">Hex color for theming</span>
        </div>
        {state.fieldErrors?.color && <p className="text-xs text-danger">{state.fieldErrors.color[0]}</p>}
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
