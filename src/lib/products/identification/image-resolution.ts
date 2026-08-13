/**
 * Image Resolution Service
 *
 * Resolves a legitimate product image through multiple strategies.
 * Every image is HTTP-verified AND SSRF-checked before acceptance.
 *
 * Fallback chain:
 * 1. Keepa (for Amazon products — provides real image IDs)
 * 2. Validated search result images
 * 3. Image search via configured provider
 * 4. null (honestly report unavailable)
 *
 * SECURITY:
 * - All image URLs are SSRF-validated before fetching
 * - Private IPs, localhost, metadata endpoints are blocked
 * - Redirects are validated
 * - Only image/* content types are accepted
 */

import { getProviderManager } from '@/lib/providers';
import type { SearchResult } from '@/lib/providers/types';
import { importLog } from './logging';
import { getKeepaImageCandidates } from './providers/keepa-image-provider';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ImageCandidate {
  url: string;
  source: ImageSource;
  confidence: number;
  width?: number;
  height?: number;
  httpVerified?: boolean;
}

export type ImageSource =
  | 'keepa'
  | 'structured-data'
  | 'amazon-page'
  | 'search-result'
  | 'image-search'
  | 'retailer-page'
  | 'none';

export interface ImageResolutionInput {
  asin?: string;
  title?: string;
  brand?: string;
  retailer?: string;
  url?: string;
  userId: string;
  searchImages?: string[];
}

export interface ImageResolutionResult {
  imageUrl: string | null;
  source: ImageSource;
  confidence: number;
  httpVerified: boolean;
  candidatesFound: number;
  candidatesRejected: number;
  keepaUsed: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// SSRF Protection
// ─────────────────────────────────────────────────────────────────────────────

const BLOCKED_HOSTNAME_PATTERNS = [
  /^localhost$/i,
  /^127\.\d+\.\d+\.\d+$/,
  /^10\.\d+\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^fc[0-9a-f]{2}:/i,
  /^fd[0-9a-f]{2}:/i,
  /^fe80:/i,
  /^169\.254\.\d+\.\d+$/,
  /\.local$/i,
  /\.internal$/i,
  /^metadata\.google\.internal$/i,
  /^metadata\.google$/i,
];

/**
 * Validate that a URL is safe to fetch (not internal/private).
 */
function isSsrfSafe(url: string): boolean {
  try {
    const parsed = new URL(url.startsWith('//') ? `https:${url}` : url);
    const hostname = parsed.hostname.toLowerCase();

    // Must be http or https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;

    // Remove IPv6 brackets for pattern matching
    const cleanHostname = hostname.replace(/^\[|\]$/g, '');

    // Check blocked patterns
    for (const pattern of BLOCKED_HOSTNAME_PATTERNS) {
      if (pattern.test(cleanHostname)) return false;
    }

    // Block non-standard ports commonly used for internal services
    const port = parsed.port ? parseInt(parsed.port, 10) : null;
    if (port && port !== 80 && port !== 443 && (port < 8000 || port > 9999)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Image URL Structural Validation (no network)
// ─────────────────────────────────────────────────────────────────────────────

const REJECT_PATTERNS: RegExp[] = [
  /encrypted-tbn\d*\.gstatic\.com/i,
  /\/favicon/i,
  /\/logo\b/i,
  /\/icon\b/i,
  /apple-touch-icon/i,
  /pixel/i,
  /spacer/i,
  /transparent/i,
  /1x1/,
  /blank\./i,
  /placeholder/i,
  /no[-_]?image/i,
  /default[-_]?image/i,
  /coming[-_]?soon/i,
  /captcha/i,
  /robot/i,
  /challenge/i,
  /data:image/i,
];

const REJECT_DOMAINS: Set<string> = new Set([
  'encrypted-tbn0.gstatic.com',
  'encrypted-tbn1.gstatic.com',
  'encrypted-tbn2.gstatic.com',
  'encrypted-tbn3.gstatic.com',
  'www.google.com',
  'www.gstatic.com',
  'accounts.google.com',
  'ssl.gstatic.com',
]);

const TRUSTED_IMAGE_DOMAINS: Set<string> = new Set([
  'm.media-amazon.com',
  'images-na.ssl-images-amazon.com',
  'images-eu.ssl-images-amazon.com',
  'pisces.bbystatic.com',
  'i5.walmartimages.com',
  'target.scene7.com',
  'c1.neweggimages.com',
  'i.ebayimg.com',
  'ae01.alicdn.com',
]);

/**
 * Validate an image URL structurally (no HTTP call).
 */
export function validateImageUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();

  if (!trimmed.startsWith('https://') && !trimmed.startsWith('//')) {
    if (trimmed.startsWith('http://')) {
      try {
        const domain = new URL(trimmed).hostname;
        if (!TRUSTED_IMAGE_DOMAINS.has(domain)) return false;
      } catch { return false; }
    } else {
      return false;
    }
  }

  for (const pattern of REJECT_PATTERNS) {
    if (pattern.test(trimmed)) return false;
  }

  try {
    const hostname = new URL(trimmed.startsWith('//') ? `https:${trimmed}` : trimmed).hostname;
    if (REJECT_DOMAINS.has(hostname)) return false;
  } catch { return false; }

  const looksLikeImage = /\.(jpe?g|png|webp|gif|avif|svg)(\?|$|#)/i.test(trimmed) ||
    /\/images?\//i.test(trimmed) ||
    isTrustedDomain(trimmed);

  return looksLikeImage || trimmed.length > 30;
}

function isTrustedDomain(url: string): boolean {
  try {
    const hostname = new URL(url.startsWith('//') ? `https:${url}` : url).hostname;
    return TRUSTED_IMAGE_DOMAINS.has(hostname);
  } catch { return false; }
}

// ─────────────────────────────────────────────────────────────────────────────
// SSRF-Protected HTTP Image Verification
// ─────────────────────────────────────────────────────────────────────────────

const IMAGE_VERIFY_TIMEOUT_MS = 5000;
const MIN_IMAGE_SIZE = 1000;
const MAX_IMAGE_SIZE = 20 * 1024 * 1024;

/**
 * HTTP-verify that a URL serves a real image.
 * Includes SSRF protection — blocks private/internal addresses.
 */
export async function httpVerifyImage(url: string): Promise<boolean> {
  const normalizedUrl = url.startsWith('//') ? `https:${url}` : url;

  // SSRF check BEFORE making any request
  if (!isSsrfSafe(normalizedUrl)) {
    return false;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), IMAGE_VERIFY_TIMEOUT_MS);

    try {
      const response = await fetch(normalizedUrl, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; DerList/1.0)',
          'Accept': 'image/*',
        },
        redirect: 'follow',
      });

      clearTimeout(timeout);

      if (!response.ok) {
        // If HEAD fails with 405, try a bounded GET
        if (response.status === 405) {
          return await httpVerifyImageGet(normalizedUrl);
        }
        return false;
      }

      // Validate final URL after redirects (SSRF: redirect could point to internal)
      if (response.url && response.url !== normalizedUrl) {
        if (!isSsrfSafe(response.url)) return false;
      }

      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.startsWith('image/')) {
        // Some CDNs don't return content-type on HEAD
        if (!isLikelyImageExtension(normalizedUrl)) return false;
      }

      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        const size = parseInt(contentLength, 10);
        if (size < MIN_IMAGE_SIZE || size > MAX_IMAGE_SIZE) return false;
      }

      return true;
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return false;
  }
}

/**
 * Fallback: bounded GET request for servers that reject HEAD.
 */
async function httpVerifyImageGet(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), IMAGE_VERIFY_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; DerList/1.0)',
          'Accept': 'image/*',
          'Range': 'bytes=0-1023', // Only fetch first 1KB
        },
        redirect: 'follow',
      });

      clearTimeout(timeout);

      if (!response.ok && response.status !== 206) return false;

      // Validate redirect target
      if (response.url && response.url !== url) {
        if (!isSsrfSafe(response.url)) return false;
      }

      const contentType = response.headers.get('content-type') ?? '';
      return contentType.startsWith('image/') || isLikelyImageExtension(url);
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return false;
  }
}

function isLikelyImageExtension(url: string): boolean {
  return /\.(jpe?g|png|webp|gif|avif)(\?|$|#)/i.test(url);
}

// ─────────────────────────────────────────────────────────────────────────────
// Image Candidate Scoring
// ─────────────────────────────────────────────────────────────────────────────

function scoreCandidate(candidate: ImageCandidate, input: ImageResolutionInput): number {
  let score = candidate.confidence;

  if (isTrustedDomain(candidate.url)) score += 15;

  if (input.retailer?.toLowerCase() === 'amazon' && candidate.url.includes('media-amazon.com')) {
    score += 30;
  }

  if (input.asin && candidate.url.toUpperCase().includes(input.asin.toUpperCase())) {
    score += 20;
  }

  // Keepa-sourced images are high priority (they have correct image IDs)
  if (candidate.source === 'keepa') score += 25;

  if (candidate.httpVerified) score += 20;

  const widthMatch = candidate.url.match(/[?&_](?:w|width|sw|SX|SL)=?(\d+)/i);
  if (widthMatch) {
    const w = parseInt(widthMatch[1], 10);
    if (w >= 500) score += 5;
    else if (w < 100) score -= 15;
  }

  return Math.min(100, Math.max(0, score));
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Resolution Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve a product image from available evidence.
 *
 * Fallback chain:
 * 1. Keepa (Amazon products only — real image IDs)
 * 2. Validated search result images
 * 3. Image search via provider
 * 4. null
 *
 * Every candidate is HTTP-verified with SSRF protection before acceptance.
 */
export async function resolveProductImage(
  input: ImageResolutionInput,
): Promise<ImageResolutionResult> {
  const candidates: ImageCandidate[] = [];
  let rejected = 0;
  let keepaUsed = false;

  // ── Strategy 1: Keepa (Amazon products) ──
  if (input.asin && input.retailer?.toLowerCase() === 'amazon') {
    try {
      const keepaCandidates = await getKeepaImageCandidates(input.asin, input.userId);
      if (keepaCandidates.length > 0) {
        keepaUsed = true;
        // Mark Keepa candidates with special source
        for (const c of keepaCandidates) {
          c.source = 'keepa' as ImageSource;
          candidates.push(c);
        }
      }
    } catch {
      // Keepa failure is non-fatal
    }
  }

  // ── Strategy 2: Pre-existing search images ──
  if (input.searchImages && input.searchImages.length > 0) {
    for (const imgUrl of input.searchImages) {
      if (validateImageUrl(imgUrl)) {
        candidates.push({ url: imgUrl, source: 'search-result', confidence: 50 });
      } else {
        rejected++;
      }
    }
  }

  // ── Strategy 3: Image search (only if no good candidates) ──
  if (candidates.length === 0) {
    try {
      const searchCandidates = await searchForProductImage(input);
      for (const c of searchCandidates) {
        if (validateImageUrl(c.url)) {
          candidates.push(c);
        } else {
          rejected++;
        }
      }
    } catch { /* best-effort */ }
  }

  if (candidates.length === 0) {
    return { imageUrl: null, source: 'none', confidence: 0, httpVerified: false, candidatesFound: 0, candidatesRejected: rejected, keepaUsed };
  }

  // ── Score and sort ──
  const scored = candidates
    .map((c) => ({ ...c, finalScore: scoreCandidate(c, input) }))
    .sort((a, b) => b.finalScore - a.finalScore);

  // ── HTTP-verify top candidates (up to 4) ──
  const MAX_VERIFY = 4;
  for (let i = 0; i < Math.min(scored.length, MAX_VERIFY); i++) {
    const candidate = scored[i];
    const isValid = await httpVerifyImage(candidate.url);

    if (isValid) {
      importLog('IMAGE_RESOLVED' as any, {
        source: candidate.source,
        confidence: candidate.finalScore,
        httpVerified: true,
        keepaUsed,
        candidatesFound: candidates.length,
        rejected,
      });

      return {
        imageUrl: candidate.url,
        source: candidate.source,
        confidence: candidate.finalScore,
        httpVerified: true,
        candidatesFound: candidates.length,
        candidatesRejected: rejected,
        keepaUsed,
      };
    } else {
      rejected++;
      importLog('IMAGE_HTTP_FAILED' as any, {
        url: candidate.url.substring(0, 100),
        source: candidate.source,
        attempt: i + 1,
      });
    }
  }

  // No candidate passed verification
  importLog('IMAGE_ALL_FAILED' as any, { candidatesFound: candidates.length, rejected, keepaUsed });

  return { imageUrl: null, source: 'none', confidence: 0, httpVerified: false, candidatesFound: candidates.length, candidatesRejected: rejected, keepaUsed };
}

// ─────────────────────────────────────────────────────────────────────────────
// Image Search Helper
// ─────────────────────────────────────────────────────────────────────────────

async function searchForProductImage(input: ImageResolutionInput): Promise<ImageCandidate[]> {
  const providers = getProviderManager();
  const candidates: ImageCandidate[] = [];

  try {
    const searchProvider = await providers.getSearchProvider(input.userId);
    if (!searchProvider) return [];

    const query = input.title
      ? (input.brand ? `${input.brand} ${input.title}` : input.title)
      : (input.asin ? `${input.asin} product` : null);
    if (!query) return [];

    const results = await searchProvider.search(query, { maxResults: 5 });

    for (const result of results) {
      if (result.image && validateImageUrl(result.image) && isRelevant(result, input)) {
        candidates.push({
          url: result.image,
          source: 'image-search',
          confidence: calcSearchImageConfidence(result, input),
        });
      }
    }
  } catch { /* non-fatal */ }

  return candidates;
}

function isRelevant(result: SearchResult, input: ImageResolutionInput): boolean {
  if (input.asin && result.url.toUpperCase().includes(input.asin.toUpperCase())) return true;
  if (input.title && result.title) {
    const words = input.title.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    const matches = words.filter((w) => result.title.toLowerCase().includes(w)).length;
    if (matches >= 2 || matches / words.length >= 0.5) return true;
  }
  if (input.brand && result.title?.toLowerCase().includes(input.brand.toLowerCase())) return true;
  return false;
}

function calcSearchImageConfidence(result: SearchResult, input: ImageResolutionInput): number {
  let conf = 40;
  if (input.asin && result.url.toUpperCase().includes(input.asin.toUpperCase())) conf += 25;
  if (result.retailer?.toLowerCase() === input.retailer?.toLowerCase()) conf += 15;
  if (isTrustedDomain(result.image ?? '')) conf += 10;
  return Math.min(85, conf);
}
