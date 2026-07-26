/**
 * Service Layer
 *
 * Business logic. Each service receives dependencies via constructor.
 * No circular dependencies. No god objects.
 */

export { ProductService } from './product';
export type { ProductDraft, SearchResponse } from './product';

export { WishlistService } from './wishlist';
export type { AddItemFromDraftOptions } from './wishlist';

export { AssistantService } from './assistant';
export type { AssistantResponse } from './assistant';

export { ProviderSettingsService, AVAILABLE_PROVIDERS } from './provider-settings';
export type { ProviderInfo, TestResult } from './provider-settings';

export { EnrichmentService } from './enrichment';
export type {
  EnrichmentInput,
  EnrichmentResult,
  EnrichmentSeller,
  EnrichmentSpec,
} from './enrichment';

export { createServices } from './create';

export { ProductResearchService } from './product-research';
export type {
  ResearchInput,
  ResearchResult,
  ResearchField,
  RetailerData,
} from './product-research';
