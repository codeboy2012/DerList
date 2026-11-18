'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useRef } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { ITEM_CONDITIONS } from '@/lib/wishlist/conditions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import type { ActionState } from '../../../(auth)/actions';
import { addItemAction } from './item-actions';

const initialState: ActionState = { success: false };

/**
 * Manual product entry — the reliable path when a URL cannot be imported or the
 * user simply wants to type something. Only the name is required; every other
 * field stays empty (unknown) until the user fills it in.
 */
export function ManualAddForm({ wishlistId }: { wishlistId: string }) {
  const [state, formAction, pending] = useActionState(addItemAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <details className="group border-border mt-4 border-t pt-4">
      <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-xs font-medium transition-colors">
        Or add a product manually
      </summary>

      <form ref={formRef} action={formAction} className="mt-4 flex flex-col gap-4">
        <input type="hidden" name="wishlistId" value={wishlistId} />

        {state.error && (
          <div role="alert" className="text-danger text-xs">
            {state.error}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="manual-title" className="text-foreground text-xs font-medium">
            Product name <span className="text-danger">*</span>
          </label>
          <Input id="manual-title" name="title" required placeholder="e.g. Keychron Q1 Pro" />
          {state.fieldErrors?.title && (
            <p className="text-danger text-xs">{state.fieldErrors.title[0]}</p>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="manual-brand" className="text-foreground text-xs font-medium">
              Brand
            </label>
            <Input id="manual-brand" name="brand" placeholder="Unknown" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="manual-model" className="text-foreground text-xs font-medium">
              Model
            </label>
            <Input id="manual-model" name="model" placeholder="Unknown" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="manual-category" className="text-foreground text-xs font-medium">
              Category
            </label>
            <Input id="manual-category" name="category" placeholder="e.g. Desk setup" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="manual-condition" className="text-foreground text-xs font-medium">
              Condition
            </label>
            <Select id="manual-condition" name="condition" defaultValue="">
              <option value="">Unknown</option>
              {ITEM_CONDITIONS.map((condition) => (
                <option key={condition} value={condition}>
                  {condition}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="manual-price" className="text-foreground text-xs font-medium">
              Current price
            </label>
            <Input id="manual-price" name="currentPrice" type="number" step="0.01" min="0" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="manual-target" className="text-foreground text-xs font-medium">
              Target price
            </label>
            <Input id="manual-target" name="targetPrice" type="number" step="0.01" min="0" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="manual-currency" className="text-foreground text-xs font-medium">
              Currency
            </label>
            <Input id="manual-currency" name="currency" defaultValue="USD" maxLength={3} />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="manual-quantity" className="text-foreground text-xs font-medium">
              Quantity
            </label>
            <Input
              id="manual-quantity"
              name="quantity"
              type="number"
              min="1"
              max="999"
              defaultValue={1}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="manual-url" className="text-foreground text-xs font-medium">
              Product URL
            </label>
            <Input id="manual-url" name="url" type="url" placeholder="https://" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="manual-notes" className="text-foreground text-xs font-medium">
            Notes
          </label>
          <Textarea
            id="manual-notes"
            name="notes"
            rows={2}
            placeholder="Anything worth remembering"
          />
        </div>

        <div>
          <Button type="submit" size="sm" disabled={pending} className="gap-2">
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Plus className="h-3.5 w-3.5" aria-hidden />
            )}
            {pending ? 'Adding…' : 'Add product'}
          </Button>
        </div>
      </form>
    </details>
  );
}
