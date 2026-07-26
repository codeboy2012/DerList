/**
 * Service Factory
 *
 * Creates service instances with proper dependency injection.
 * Use this in API routes and server actions.
 */

import { getProviderManager } from '@/lib/providers';
import { AssistantService } from './assistant';
import { EnrichmentService } from './enrichment';
import { ProductService } from './product';
import { ProviderSettingsService } from './provider-settings';
import { WishlistService } from './wishlist';

/**
 * Create all services with shared dependencies.
 * Call this at the start of API routes / server actions.
 */
export function createServices() {
  const providers = getProviderManager();
  const productService = new ProductService(providers);
  const wishlistService = new WishlistService();
  const assistantService = new AssistantService(providers, productService);
  const providerSettingsService = new ProviderSettingsService(providers);
  const enrichmentService = new EnrichmentService(providers);

  return {
    products: productService,
    wishlists: wishlistService,
    assistant: assistantService,
    providerSettings: providerSettingsService,
    enrichment: enrichmentService,
  };
}
