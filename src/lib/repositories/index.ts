/**
 * Repositories — Data Access Layer
 *
 * These are the ONLY files in the application that import Prisma.
 * Everything else accesses data through these repositories.
 */

export { ProductRepository } from './product';
export type { ProductCreateInput, ProductSearchResult } from './product';

export { WishlistRepository } from './wishlist';
export type {
  WishlistWithCounts,
  WishlistItemCreateInput,
  WishlistItemUpdateInput,
  CategoryCreateInput,
} from './wishlist';

export { ProviderRepository } from './provider';
export type {
  ProviderConfig,
  ProviderConfigCreateInput,
  ProviderConfigUpdateInput,
  UsageRecordInput,
} from './provider';
