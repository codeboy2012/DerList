'use client';

import { useActionState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { ITEM_CONDITIONS } from '@/lib/wishlist/conditions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import type { ActionState } from '../../../(auth)/actions';
import { updateItemDetailsAction } from './item-actions';

const initialState: ActionState = { success: false };

export interface EditableItem {
  id: string;
  title: string;
  description: string | null;
  brand: string | null;
  model: string | null;
  category: string | null;
  condition: string | null;
  availability: string | null;
  currentPrice: string | null;
  targetPrice: string | null;
  currency: string;
  quantity: number;
  priority: string;
  notes: string | null;
}

interface ItemDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  item: EditableItem;
  wishlistId: string;
  collections: Array<{ id: string; title: string }>;
  onSaved: () => void;
  onOpenAdvanced: () => void;
}

/**
 * Personal-details editor for a saved wishlist product.
 *
 * Covers the fields that belong to *your* copy of a product — target price,
 * condition, quantity, notes and which collection it lives in. Anything that
 * came from an import lives in the advanced product editor.
 */
export function ItemDetailsDialog({
  open,
  onClose,
  item,
  wishlistId,
  collections,
  onSaved,
  onOpenAdvanced,
}: ItemDetailsDialogProps) {
  const [state, formAction, pending] = useActionState(updateItemDetailsAction, initialState);

  useEffect(() => {
    if (state.success) {
      onSaved();
    }
    // Only react to a new successful save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <Modal open={open} onClose={onClose} title="Edit product" size="lg">
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="itemId" value={item.id} />
        <input type="hidden" name="wishlistId" value={wishlistId} />

        {state.error && (
          <div
            role="alert"
            className="border-danger/30 bg-danger/5 text-danger rounded-lg border px-3 py-2 text-xs"
          >
            {state.error}
          </div>
        )}

        <Field label="Name" htmlFor="item-title" required>
          <Input id="item-title" name="title" defaultValue={item.title} required />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Brand" htmlFor="item-brand">
            <Input
              id="item-brand"
              name="brand"
              defaultValue={item.brand ?? ''}
              placeholder="Unknown"
            />
          </Field>
          <Field label="Model" htmlFor="item-model">
            <Input
              id="item-model"
              name="model"
              defaultValue={item.model ?? ''}
              placeholder="Unknown"
            />
          </Field>
          <Field label="Category" htmlFor="item-category">
            <Input
              id="item-category"
              name="category"
              defaultValue={item.category ?? ''}
              placeholder="e.g. PC Upgrades"
            />
          </Field>
          <Field label="Condition" htmlFor="item-condition">
            <Select id="item-condition" name="condition" defaultValue={item.condition ?? ''}>
              <option value="">Unknown</option>
              {ITEM_CONDITIONS.map((condition) => (
                <option key={condition} value={condition}>
                  {condition}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Current price" htmlFor="item-current-price">
            <Input
              id="item-current-price"
              name="currentPrice"
              type="number"
              step="0.01"
              min="0"
              defaultValue={item.currentPrice ?? ''}
              placeholder="—"
            />
          </Field>
          <Field label="Target price" htmlFor="item-target-price">
            <Input
              id="item-target-price"
              name="targetPrice"
              type="number"
              step="0.01"
              min="0"
              defaultValue={item.targetPrice ?? ''}
              placeholder="—"
            />
          </Field>
          <Field label="Currency" htmlFor="item-currency">
            <Input
              id="item-currency"
              name="currency"
              defaultValue={item.currency}
              maxLength={3}
              className="uppercase"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Availability" htmlFor="item-availability">
            <Input
              id="item-availability"
              name="availability"
              defaultValue={item.availability ?? ''}
              placeholder="Unknown"
            />
          </Field>
          <Field label="Quantity" htmlFor="item-quantity">
            <Input
              id="item-quantity"
              name="quantity"
              type="number"
              min="1"
              max="999"
              defaultValue={item.quantity}
            />
          </Field>
          <Field label="Priority" htmlFor="item-priority">
            <Select id="item-priority" name="priority" defaultValue={item.priority}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </Select>
          </Field>
        </div>

        <Field label="Description" htmlFor="item-description">
          <Textarea
            id="item-description"
            name="description"
            rows={2}
            defaultValue={item.description ?? ''}
            placeholder="Unknown"
          />
        </Field>

        <Field label="Notes" htmlFor="item-notes">
          <Textarea
            id="item-notes"
            name="notes"
            rows={3}
            defaultValue={item.notes ?? ''}
            placeholder="Why you want it, size, colour…"
          />
        </Field>

        <Field label="Collection" htmlFor="item-collection">
          <Select id="item-collection" name="collectionId" defaultValue={wishlistId}>
            {collections.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.title}
              </option>
            ))}
          </Select>
        </Field>
        <p className="text-muted-foreground -mt-2 text-[11px]">
          Changing the collection moves this entry only — the product itself is never deleted.
        </p>

        <div className="border-border flex flex-wrap items-center gap-2 border-t pt-4">
          <Button type="submit" size="sm" disabled={pending} className="gap-2">
            {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            {pending ? 'Saving…' : 'Save changes'}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={onOpenAdvanced}
          >
            Full product editor
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function Field({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-foreground text-xs font-medium">
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>
      {children}
    </div>
  );
}
