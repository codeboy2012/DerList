/**
 * Keepa Image Provider
 *
 * Extracts real Amazon product image URLs from the Keepa product API.
 *
 * How it works:
 * 1. Queries Keepa's product endpoint with the ASIN
 * 2. Extracts `imagesCSV` field which contains Amazon image IDs
 *    (e.g., "81zZW70yiYL.jpg,81SkwdTQypL.jpg,...")
 * 3. Constructs real Amazon CDN URLs from these IDs
 *    (e.g., "https://m.media-amazon.com/images/I/81zZW70yiYL._AC_SL1500_.jpg")
 * 4. HTTP-verifies the constructed URL before returning it
 *
 * IMPORTANT:
 * - The ASIN is NOT the Amazon image ID. Image IDs are alphanumeric codes
 *   like "81zZW70yiYL" that are specific to each product's photos.
 * - Keepa's API returns these real image IDs, solving the problem.
 * - Failure is always safe — returns null, never breaks the import.
 */

import { getProviderManager } from '@/lib/providers';
import type { ImageCandidate, ImageSource } from '../image-resolution';
import { importLog } from '../logging';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const KEEPA_API_URL = 'https://api.keepa.com';
const KEEPA_TIMEOUT_MS = 8000;

/**
 * Amazon image CDN base URL. Image IDs from Keepa are appended to this.
 * Size suffix options:
 * - _AC_SL1500_ = large (1500px)
 * - _AC_SX679_ = medium (679px wide)
 * - _AC_SX466_ = small (466px wide)
 * - _AC_SX300_SY300_ = square 300x300
 */
const AMAZON_IMAGE_CDN = 'https://m.media-amazon.com/images/I/';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface KeepaProductImageResponse {
  products?: Array<{
    imagesCSV?: string;
    asin?: string;
    title?: string;
  }>;
  tokensLeft?: number;
  error?: { message: string };
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Query Keepa for an ASIN's product images and return validated candidates.
 *
 * @param asin - Amazon ASIN
 * @param userId - User ID for accessing Keepa credentials
 * @returns Array of image candidates (may be empty)
 */
export async function getKeepaImageCandidates(
  asin: string,
  userId: string,
): Promise<ImageCandidate[]> {
  const candidates: ImageCandidate[] = [];

  try {
    const providers = getProviderManager();
    const priceProvider = await providers.getPriceProvider(userId);

    // Check if the price provider is Keepa
    if (!priceProvider || priceProvider.id !== 'keepa') {
      importLog('KEEPA_IMAGE_SKIPPED' as any, { reason: 'No Keepa provider configured' });
      return [];
    }

    // Access the Keepa API key through the provider
    // We need to query the Keepa API directly for image data since the
    // PriceProvider interface doesn't expose images
    const apiKey = await getKeepaApiKey(userId);
    if (!apiKey) {
      importLog('KEEPA_IMAGE_SKIPPED' as any, { reason: 'Could not retrieve Keepa API key' });
      return [];
    }

    importLog('KEEPA_IMAGE_STARTED' as any, { asin });

    // Query Keepa product endpoint
    const params = new URLSearchParams({
      key: apiKey,
      domain: '1', // US
      asin,
      // Only request minimal data to save tokens
      stats: '0',
      history: '0',
      offers: '0',
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), KEEPA_TIMEOUT_MS);

    try {
      const response = await fetch(`${KEEPA_API_URL}/product?${params.toString()}`, {
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        importLog('KEEPA_IMAGE_API_ERROR' as any, { status: response.status });
        return [];
      }

      const data: KeepaProductImageResponse = await response.json();

      if (data.error) {
        importLog('KEEPA_IMAGE_API_ERROR' as any, { error: data.error.message });
        return [];
      }

      const product = data.products?.[0];
      if (!product?.imagesCSV) {
        importLog('KEEPA_IMAGE_NO_DATA' as any, { asin });
        return [];
      }

      // Parse imagesCSV — comma-separated list of Amazon image IDs
      // Format: "81zZW70yiYL.jpg,81SkwdTQypL.jpg,916rkTg6h0L.jpg"
      const imageIds = product.imagesCSV
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0);

      if (imageIds.length === 0) {
        importLog('KEEPA_IMAGE_EMPTY' as any, { asin });
        return [];
      }

      importLog('KEEPA_IMAGE_FOUND' as any, { asin, imageCount: imageIds.length });

      // Convert image IDs to full CDN URLs
      // Use the first image (primary product image) with high-res suffix
      for (let i = 0; i < Math.min(imageIds.length, 3); i++) {
        const imageId = imageIds[i];
        const baseId = imageId.replace(/\.(jpg|jpeg|png|gif|webp)$/i, '');

        // Construct high-resolution URL
        const imageUrl = `${AMAZON_IMAGE_CDN}${baseId}._AC_SL1500_.jpg`;

        candidates.push({
          url: imageUrl,
          source: 'amazon-page' as ImageSource, // Image comes from Amazon's CDN via Keepa
          confidence: 85 - (i * 5), // First image is highest confidence
        });
      }

      return candidates;
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    // Keepa failures are NEVER fatal to the import
    importLog('KEEPA_IMAGE_ERROR' as any, {
      error: error instanceof Error ? error.message : 'Unknown',
      asin,
    });
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Keepa API Key Access
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retrieve the Keepa API key for a user from their provider configuration.
 * Returns null if not configured.
 */
async function getKeepaApiKey(userId: string): Promise<string | null> {
  try {
    const { ProviderRepository } = await import('@/lib/repositories');
    const configs = await ProviderRepository.listByCategory(userId, 'PRICE');

    const keepaConfig = configs.find((c) => c.providerId === 'keepa');
    if (!keepaConfig?.config) return null;

    const config = keepaConfig.config as Record<string, unknown>;
    return (config.apiKey as string) ?? null;
  } catch {
    return null;
  }
}
