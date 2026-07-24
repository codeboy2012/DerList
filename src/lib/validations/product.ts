import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Import URL validation
// ─────────────────────────────────────────────────────────────────────────────

export const importUrlSchema = z.object({
  url: z
    .string()
    .min(1, 'URL is required.')
    .url('Please enter a valid URL.')
    .refine(
      (url) => {
        try {
          const parsed = new URL(url);
          return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch {
          return false;
        }
      },
      { message: 'Only HTTP and HTTPS URLs are supported.' },
    ),
});

export type ImportUrlInput = z.infer<typeof importUrlSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Manual product creation
// ─────────────────────────────────────────────────────────────────────────────

export const createManualProductSchema = z.object({
  title: z
    .string()
    .min(1, 'Product name is required.')
    .max(300, 'Name must be at most 300 characters.'),
  description: z
    .string()
    .max(5000, 'Description must be at most 5000 characters.')
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
    .max(150, 'Brand must be at most 150 characters.')
    .optional()
    .or(z.literal('')),
  retailer: z
    .string()
    .max(150, 'Retailer must be at most 150 characters.')
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
  sku: z
    .string()
    .max(100, 'SKU must be at most 100 characters.')
    .optional()
    .or(z.literal('')),
});

export type CreateManualProductInput = z.infer<typeof createManualProductSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Imported product confirmation (from preview)
// ─────────────────────────────────────────────────────────────────────────────

export const confirmImportSchema = z.object({
  canonicalUrl: z.string().min(1),
  normalizedUrl: z.string().min(1),
  domain: z.string().nullable(),
  retailer: z.string().nullable(),
  title: z.string().min(1, 'Product title is required.').max(300),
  description: z.string().max(5000).nullable(),
  brand: z.string().max(150).nullable(),
  sku: z.string().max(100).nullable(),
  mpn: z.string().max(100).nullable(),
  gtin: z.string().max(100).nullable(),
  image: z.string().url().nullable().or(z.literal('')),
  gallery: z.string(), // JSON string of URLs
  currentPrice: z.coerce.number().min(0).nullable(),
  currency: z.string().length(3).default('USD'),
  inStock: z.coerce.boolean().nullable(),
  availability: z.string().max(200).nullable(),
});

export type ConfirmImportInput = z.infer<typeof confirmImportSchema>;
