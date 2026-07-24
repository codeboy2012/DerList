'use client';

import { Button } from '@/components/ui/Button';
import { Trash2 } from 'lucide-react';

import { deleteWishlistAction } from '../actions';

interface DeleteWishlistButtonProps {
  wishlistId: string;
}

export function DeleteWishlistButton({ wishlistId }: DeleteWishlistButtonProps) {
  return (
    <form
      action={async (formData) => {
        if (!window.confirm('Are you sure you want to delete this wishlist and all its items? This cannot be undone.')) {
          return;
        }
        await deleteWishlistAction(formData);
      }}
    >
      <input type="hidden" name="wishlistId" value={wishlistId} />
      <Button type="submit" variant="danger" size="sm">
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
        Delete Wishlist
      </Button>
    </form>
  );
}
