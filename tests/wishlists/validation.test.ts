/**
 * Regression test for archived-state parsing.
 *
 * `z.coerce.boolean()` treats the string "false" as truthy, which silently
 * archived a wishlist whenever its edit form was submitted.
 */
import { describe, expect, it } from 'vitest';
import { updateWishlistSchema } from '@/lib/validations/wishlist';

const base = {
  title: 'Test wishlist',
  visibility: 'PRIVATE' as const,
  icon: '',
  color: '',
};

describe('updateWishlistSchema archived state', () => {
  it('parses the string "false" as false', () => {
    const parsed = updateWishlistSchema.parse({ ...base, archived: 'false' });
    expect(parsed.archived).toBe(false);
  });

  it('parses the string "true" as true', () => {
    const parsed = updateWishlistSchema.parse({ ...base, archived: 'true' });
    expect(parsed.archived).toBe(true);
  });

  it('leaves an omitted value undefined so the current state is preserved', () => {
    const parsed = updateWishlistSchema.parse(base);
    expect(parsed.archived).toBeUndefined();
  });

  it('accepts real booleans', () => {
    expect(updateWishlistSchema.parse({ ...base, archived: true }).archived).toBe(true);
    expect(updateWishlistSchema.parse({ ...base, archived: false }).archived).toBe(false);
  });
});
