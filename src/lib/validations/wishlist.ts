import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Wishlist
// ─────────────────────────────────────────────────────────────────────────────

export const createWishlistSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required.')
    .max(100, 'Title must be at most 100 characters.'),
  description: z
    .string()
    .max(500, 'Description must be at most 500 characters.')
    .optional()
    .or(z.literal('')),
  visibility: z.enum(['PRIVATE', 'UNLISTED', 'PUBLIC'], {
    error: 'Visibility must be PRIVATE, UNLISTED, or PUBLIC.',
  }),
  icon: z
    .string()
    .max(10, 'Icon must be at most 10 characters.')
    .optional()
    .or(z.literal('')),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a valid hex color (e.g. #3b82f6).')
    .optional()
    .or(z.literal('')),
});

export type CreateWishlistInput = z.infer<typeof createWishlistSchema>;

export const updateWishlistSchema = createWishlistSchema.extend({
  archived: z.coerce.boolean().optional(),
});

export type UpdateWishlistInput = z.infer<typeof updateWishlistSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Wishlist Item
// ─────────────────────────────────────────────────────────────────────────────

export const createItemSchema = z.object({
  title: z
    .string()
    .min(1, 'Item name is required.')
    .max(200, 'Name must be at most 200 characters.'),
  description: z
    .string()
    .max(1000, 'Description must be at most 1000 characters.')
    .optional()
    .or(z.literal('')),
  url: z
    .string()
    .url('Please enter a valid URL.')
    .max(2000, 'URL is too long.')
    .optional()
    .or(z.literal('')),
  image: z
    .string()
    .url('Please enter a valid image URL.')
    .max(2000, 'Image URL is too long.')
    .optional()
    .or(z.literal('')),
  brand: z
    .string()
    .max(100, 'Brand must be at most 100 characters.')
    .optional()
    .or(z.literal('')),
  retailer: z
    .string()
    .max(100, 'Retailer must be at most 100 characters.')
    .optional()
    .or(z.literal('')),
  currentPrice: z
    .string()
    .optional()
    .or(z.literal(''))
    .transform((val) => {
      if (!val || val === '') return null;
      const num = parseFloat(val);
      if (isNaN(num) || num < 0) return null;
      return num;
    }),
  currency: z
    .string()
    .length(3, 'Currency must be a 3-letter code.')
    .default('USD'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], {
    error: 'Priority must be LOW, MEDIUM, HIGH, or CRITICAL.',
  }),
  quantity: z.coerce
    .number()
    .int('Quantity must be a whole number.')
    .min(1, 'Quantity must be at least 1.')
    .max(999, 'Quantity must be at most 999.')
    .default(1),
  notes: z
    .string()
    .max(2000, 'Notes must be at most 2000 characters.')
    .optional()
    .or(z.literal('')),
});

export type CreateItemInput = z.infer<typeof createItemSchema>;

export const updateItemSchema = createItemSchema.extend({
  purchased: z.coerce.boolean().optional(),
});

export type UpdateItemInput = z.infer<typeof updateItemSchema>;
