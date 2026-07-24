'use client';

import { useActionState } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { CheckCircle2, Loader2 } from 'lucide-react';

import type { ActionState } from '../../../../(auth)/actions';
import { updateWishlistAction } from '../../actions';

const initialState: ActionState = { success: false };

interface EditWishlistFormProps {
  wishlist: {
    id: string;
    title: string;
    description: string | null;
    visibility: string;
    icon: string | null;
    color: string | null;
    archived: boolean;
  };
}

export function EditWishlistForm({ wishlist }: EditWishlistFormProps) {
  const [state, formAction, pending] = useActionState(updateWishlistAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <input type="hidden" name="wishlistId" value={wishlist.id} />
      <input type="hidden" name="archived" value={String(wishlist.archived)} />

      {state.success && (
        <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">
          <CheckCircle2 className="h-4 w-4" />
          Wishlist updated successfully.
        </div>
      )}

      {state.error && (
        <div role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {state.error}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="edit-title" className="text-sm font-medium text-foreground">Title</label>
        <Input id="edit-title" name="title" required defaultValue={wishlist.title} />
        {state.fieldErrors?.title && <p className="text-xs text-danger">{state.fieldErrors.title[0]}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="edit-desc" className="text-sm font-medium text-foreground">Description</label>
        <Textarea id="edit-desc" name="description" defaultValue={wishlist.description ?? ''} rows={3} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-vis" className="text-sm font-medium text-foreground">Visibility</label>
          <Select id="edit-vis" name="visibility" defaultValue={wishlist.visibility}>
            <option value="PRIVATE">Private</option>
            <option value="UNLISTED">Unlisted</option>
            <option value="PUBLIC">Public</option>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-icon" className="text-sm font-medium text-foreground">Icon</label>
          <Input id="edit-icon" name="icon" defaultValue={wishlist.icon ?? ''} maxLength={10} />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="edit-color" className="text-sm font-medium text-foreground">Color</label>
        <Input id="edit-color" name="color" defaultValue={wishlist.color ?? ''} placeholder="#3b82f6" className="max-w-40" />
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={pending} className="gap-2">
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {pending ? 'Saving...' : 'Save Changes'}
        </Button>
        <Button asChild variant="ghost">
          <a href={`/wishlists/${wishlist.id}`}>Cancel</a>
        </Button>
      </div>
    </form>
  );
}
