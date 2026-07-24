/**
 * URL normalization utilities for product import.
 *
 * Removes tracking parameters, normalizes protocol/host, and extracts domain info.
 */

/** Common tracking/affiliate query parameters to strip. */
const TRACKING_PARAMS = new Set([
  // Universal
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'utm_id', 'utm_source_platform',
  // Facebook/Meta
  'fbclid', 'fb_action_ids', 'fb_action_types', 'fb_source', 'fb_ref',
  // Google
  'gclid', 'gclsrc', 'dclid', 'gbraid', 'wbraid',
  // Microsoft
  'msclkid',
  // Amazon
  'tag', 'linkCode', 'linkId', 'ref_', 'ref', 'pf_rd_p', 'pf_rd_r',
  'pf_rd_s', 'pf_rd_t', 'pf_rd_i',
  // Misc affiliate/tracking
  'affiliate_id', 'aff_id', 'click_id', 'campaign_id',
  'source', 'medium', 'mc_cid', 'mc_eid',
  '_ga', '_gl', 'yclid', 'twclid',
]);

/**
 * Normalize a product URL by removing tracking parameters and standardizing format.
 *
 * @returns Cleaned URL string, or null if the URL is invalid.
 */
export function normalizeUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl.trim());

    // Only allow http/https
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    // Remove tracking parameters
    const params = new URLSearchParams();
    for (const [key, value] of url.searchParams) {
      if (!TRACKING_PARAMS.has(key.toLowerCase())) {
        params.set(key, value);
      }
    }

    // Rebuild URL
    url.search = params.toString() ? `?${params.toString()}` : '';

    // Remove hash fragments (usually not relevant for product identity)
    url.hash = '';

    // Normalize to https
    url.protocol = 'https:';

    // Lowercase hostname
    url.hostname = url.hostname.toLowerCase();

    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Extract the bare domain from a URL (without www prefix).
 */
export function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Map common domains to friendly retailer names.
 * Returns null for unknown domains — caller uses the domain itself.
 */
const RETAILER_MAP: Record<string, string> = {
  'amazon.com': 'Amazon',
  'amazon.co.uk': 'Amazon UK',
  'amazon.de': 'Amazon DE',
  'amazon.ca': 'Amazon CA',
  'ebay.com': 'eBay',
  'walmart.com': 'Walmart',
  'target.com': 'Target',
  'bestbuy.com': 'Best Buy',
  'newegg.com': 'Newegg',
  'bhphotovideo.com': 'B&H Photo',
  'adorama.com': 'Adorama',
  'apple.com': 'Apple',
  'store.steampowered.com': 'Steam',
  'etsy.com': 'Etsy',
  'aliexpress.com': 'AliExpress',
  'ikea.com': 'IKEA',
  'homedepot.com': 'Home Depot',
  'lowes.com': "Lowe's",
  'costco.com': 'Costco',
  'microcenter.com': 'Micro Center',
};

export function getRetailerName(domain: string | null): string | null {
  if (!domain) return null;
  return RETAILER_MAP[domain] ?? null;
}
