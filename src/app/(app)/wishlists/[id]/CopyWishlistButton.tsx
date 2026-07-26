'use client';

/**
 * CopyWishlistButton — Opens a dialog with copy options, then creates a copy.
 * Redirects to the new wishlist on success.
 */
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Copy, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';

interface CopyWishlistButtonProps {
  wishlistId: string;
  wishlistTitle: string;
  itemCount: number;
}

export function CopyWishlistButton({
  wishlistId,
  wishlistTitle,
  itemCount,
}: CopyWishlistButtonProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(`${wishlistTitle} (Copy)`);
  const [isCopying, setIsCopying] = useState(false);
  const [options, setOptions] = useState({
    copyItems: true,
    copyCategories: true,
    copyNotes: true,
    copyPriorities: true,
    copyTags: true,
    copyMetadata: true,
    copyPurchasedStatus: false,
  });
  const router = useRouter();
  const toast = useToast();

  const toggleOption = (key: keyof typeof options) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCopy = async () => {
    if (!name.trim()) return;
    setIsCopying(true);

    try {
      const res = await fetch('/api/wishlists/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceWishlistId: wishlistId,
          name: name.trim(),
          ...options,
        }),
      });
      const data = await res.json();

      if (data.success && data.wishlist) {
        toast.success('Wishlist copied successfully');
        setOpen(false);
        router.push(`/wishlists/${data.wishlist.id}`);
      } else {
        toast.error(data.error || 'Failed to copy wishlist');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Copy className="h-3.5 w-3.5" aria-hidden />
        Copy
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Copy Wishlist" size="md">
        <div className="space-y-5">
          <p className="text-muted-foreground text-sm">
            Create a copy of this wishlist ({itemCount} items) in your account.
          </p>

          {/* Name */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">Wishlist Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Wishlist (Copy)"
            />
          </div>

          {/* Options */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Include</p>
            <OptionCheckbox
              label="All items"
              checked={options.copyItems}
              onChange={() => toggleOption('copyItems')}
            />
            <OptionCheckbox
              label="Folders / categories"
              checked={options.copyCategories}
              onChange={() => toggleOption('copyCategories')}
            />
            <OptionCheckbox
              label="Notes"
              checked={options.copyNotes}
              onChange={() => toggleOption('copyNotes')}
            />
            <OptionCheckbox
              label="Priorities"
              checked={options.copyPriorities}
              onChange={() => toggleOption('copyPriorities')}
            />
            <OptionCheckbox
              label="Tags"
              checked={options.copyTags}
              onChange={() => toggleOption('copyTags')}
            />
            <OptionCheckbox
              label="Product metadata"
              checked={options.copyMetadata}
              onChange={() => toggleOption('copyMetadata')}
            />
            <OptionCheckbox
              label="Purchased status"
              checked={options.copyPurchasedStatus}
              onChange={() => toggleOption('copyPurchasedStatus')}
            />
          </div>

          {/* Actions */}
          <div className="border-border flex justify-end gap-3 border-t pt-4">
            <Button variant="ghost" size="md" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleCopy}
              disabled={isCopying || !name.trim()}
              className="gap-2"
            >
              {isCopying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              Create Copy
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function OptionCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="hover:bg-surface/50 flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="border-border h-4 w-4 rounded"
      />
      <span className="text-sm">{label}</span>
    </label>
  );
}
