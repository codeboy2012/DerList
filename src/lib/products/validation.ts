/**
 * Product Data Validation Module
 *
 * Validates extracted product data to reject obviously invalid results.
 * This prevents the system from silently accepting garbage like:
 * - Product name = "Amazon.com"
 * - Price = 10 (arbitrary fallback)
 * - Brand = retailer name
 * - Generic placeholder images
 *
 * Each validator returns a ValidationResult with a reason for rejection.
 * The pipeline uses these to decide whether to accept, fallback, or flag for review.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export interface ProductValidationInput {
  title?: string | null;
  price?: number | null;
  currency?: string | null;
  brand?: string | null;
  image?: string | null;
  retailer?: string | null;
  url?: string | null;
}

export interface ProductValidationReport {
  isAcceptable: boolean;
  titleValid: ValidationResult;
  priceValid: ValidationResult;
  brandValid: ValidationResult;
  imageValid: ValidationResult;
  overallConfidence: number;
  issues: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants — Invalid titles that indicate extraction failure
// ─────────────────────────────────────────────────────────────────────────────

/** Titles that are obviously not product names */
const INVALID_TITLE_EXACT: Set<string> = new Set([
  'amazon',
  'amazon.com',
  'amazon.co.uk',
  'amazon.ca',
  'amazon.de',
  'walmart',
  'walmart.com',
  'best buy',
  'bestbuy',
  'bestbuy.com',
  'target',
  'target.com',
  'newegg',
  'newegg.com',
  'ebay',
  'ebay.com',
  'home depot',
  'homedepot.com',
  'lowes',
  'lowes.com',
  'costco',
  'costco.com',
  'aliexpress',
  'aliexpress.com',
  'b&h photo',
  'bhphotovideo.com',
  'home',
  'product',
  'shop',
  'store',
  'search',
  'untitled product',
  'untitled',
  'undefined',
  'null',
  'unknown product',
  'unknown',
  'n/a',
  'none',
  'loading...',
  'loading',
  'page not found',
  '404',
  'access denied',
  'error',
  'sign in',
  'log in',
  'login',
  'verify',
  'captcha',
  'robot check',
  'are you a robot',
  'just a moment',
  'please wait',
  'redirecting',
]);

/** Patterns that indicate a generic page title rather than a product */
const INVALID_TITLE_PATTERNS: RegExp[] = [
  /^amazon\s*[-:|·]/i,
  /^walmart\s*[-:|·]/i,
  /^best\s*buy\s*[-:|·]/i,
  /^target\s*[-:|·]/i,
  /^ebay\s*[-:|·]/i,
  /^newegg\s*[-:|·]/i,
  /^home\s*depot\s*[-:|·]/i,
  /^lowe'?s\s*[-:|·]/i,
  /^costco\s*[-:|·]/i,
  // Generic patterns
  /^online shopping/i,
  /^shop (?:now|online|all)/i,
  /^buy (?:now|online)/i,
  /^welcome to/i,
  /^sign in to/i,
  /^please (?:enable|verify|confirm)/i,
  // Error pages
  /^sorry[,!]?\s/i,
  /something went wrong/i,
  /page (?:not found|unavailable)/i,
  /we couldn.?t find/i,
  /this item is no longer available/i,
  // Just a domain name with TLD
  /^[a-z0-9-]+\.(com|org|net|co\.\w+)$/i,
];

/**
 * Known retailer names — used to validate brand isn't just the retailer.
 *
 * NOTE: "Apple", "IKEA", "Etsy" are intentionally excluded because they are
 * both retailers AND legitimate product brands. We don't want to reject
 * "Apple" as a brand when someone imports an Apple product.
 */
const RETAILER_NAMES: Set<string> = new Set([
  'amazon',
  'walmart',
  'best buy',
  'bestbuy',
  'target',
  'newegg',
  'ebay',
  'home depot',
  'lowes',
  "lowe's",
  'costco',
  'aliexpress',
  'b&h photo',
  'b&h',
  'adorama',
  'micro center',
  'microcenter',
  'steam',
]);

/**
 * Retailer brand exceptions — products that are legitimately branded by the retailer.
 * Example: "Amazon Basics", "Amazon Echo", "Walmart Great Value"
 */
const RETAILER_BRAND_EXCEPTIONS: RegExp[] = [
  /^amazon\s+(basics|essentials|echo|fire|kindle|alexa|ring|blink|eero)/i,
  /^walmart\s+(great value|equate|onn|mainstays)/i,
  /^costco\s+(kirkland)/i,
  /^target\s+(threshold|made by design|room essentials|up & up)/i,
  /^best buy\s+(insignia|dynex|rocketfish)/i,
  /^home depot\s+(husky|hampton bay|glacier bay)/i,
];

/** Suspicious price values that likely indicate extraction failures */
const SUSPICIOUS_PRICES = new Set([0, 1, 10]);

/** Image URLs that are known to be placeholders or tracking pixels */
const INVALID_IMAGE_PATTERNS: RegExp[] = [
  /^data:/i,
  /pixel/i,
  /spacer/i,
  /transparent/i,
  /1x1/,
  /blank\./i,
  /placeholder/i,
  /no[-_]?image/i,
  /default[-_]?image/i,
  /coming[-_]?soon/i,
  // Google encrypted thumbnails (low quality, often wrong)
  /encrypted-tbn\d*\.gstatic\.com/i,
  // Common logo/icon patterns (not product images)
  /\/favicon/i,
  /\/logo\b/i,
  /\/icon\b/i,
  /apple-touch-icon/i,
];

/** Minimum acceptable image dimensions if extractable from URL */
const MIN_IMAGE_DIMENSION = 50;

// ─────────────────────────────────────────────────────────────────────────────
// Title Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate that a title represents an actual product name.
 *
 * Rejects:
 * - Empty/null titles
 * - Known retailer page titles
 * - Generic placeholders
 * - Error page titles
 * - Titles shorter than 3 characters
 * - Titles that are just a domain name
 */
export function validateTitle(title: string | null | undefined): ValidationResult {
  if (!title || typeof title !== 'string') {
    return { valid: false, reason: 'Title is missing or empty.' };
  }

  const trimmed = title.trim();

  if (trimmed.length < 3) {
    return { valid: false, reason: `Title too short: "${trimmed}"` };
  }

  if (trimmed.length > 500) {
    return { valid: false, reason: 'Title is suspiciously long (>500 chars).' };
  }

  const lower = trimmed.toLowerCase();

  // Exact match against known invalid titles
  if (INVALID_TITLE_EXACT.has(lower)) {
    return { valid: false, reason: `Title "${trimmed}" is a generic/retailer page title, not a product.` };
  }

  // Pattern match against invalid title patterns
  for (const pattern of INVALID_TITLE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { valid: false, reason: `Title "${trimmed}" matches invalid pattern (likely page title, not product).` };
    }
  }

  // Title is just a retailer name with extra whitespace/punctuation
  const stripped = lower.replace(/[^a-z0-9]/g, '');
  if (RETAILER_NAMES.has(stripped)) {
    return { valid: false, reason: `Title "${trimmed}" is just a retailer name.` };
  }

  return { valid: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Price Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate that a price is reasonable and not a fallback/default value.
 *
 * Returns valid=true with no concerns for null prices (price unavailable is OK).
 * Returns valid=false for suspicious values that likely indicate extraction bugs.
 *
 * @param price - The extracted price
 * @param source - Where the price came from (e.g., "json-ld", "regex-fallback")
 * @param confidence - Extraction confidence (0-100)
 */
export function validatePrice(
  price: number | null | undefined,
  source?: string,
  confidence?: number,
): ValidationResult {
  // Null price is valid — means "price unavailable"
  if (price == null) {
    return { valid: true };
  }

  if (typeof price !== 'number' || isNaN(price)) {
    return { valid: false, reason: 'Price is not a valid number.' };
  }

  // Negative prices are never valid
  if (price < 0) {
    return { valid: false, reason: `Negative price ($${price}) is invalid.` };
  }

  // Zero means free or extraction failure — flag but don't hard-reject
  if (price === 0) {
    return { valid: false, reason: 'Price is $0 — likely an extraction failure.' };
  }

  // Suspicious default values: only reject if confidence is low or source is weak
  if (SUSPICIOUS_PRICES.has(price)) {
    const isWeakSource = !source || source === 'broad-regex' || source === 'generic-fallback';
    const isLowConfidence = confidence != null && confidence < 60;

    if (isWeakSource || isLowConfidence) {
      return {
        valid: false,
        reason: `Price $${price} looks like a fallback/default (source: ${source ?? 'unknown'}, confidence: ${confidence ?? 'unknown'}).`,
      };
    }
  }

  // Unusually high prices (> $100,000) — flag for review but don't reject
  if (price > 100000) {
    return { valid: true, reason: `Price $${price.toLocaleString()} is very high — verify this is correct.` };
  }

  return { valid: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Brand Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate that a brand is a real manufacturer, not the retailer name.
 *
 * Rules:
 * - Brand = retailer name → invalid (unless it's a genuine store brand product)
 * - Brand = domain name → invalid
 * - Empty brand → valid (brands are optional)
 */
export function validateBrand(
  brand: string | null | undefined,
  retailer?: string | null,
): ValidationResult {
  // Null/empty brand is valid — not every product has a known brand
  if (!brand || typeof brand !== 'string' || brand.trim().length === 0) {
    return { valid: true };
  }

  const trimmed = brand.trim();
  const lower = trimmed.toLowerCase();

  // Check if brand is just the retailer name
  if (retailer) {
    const retailerLower = retailer.toLowerCase();
    if (lower === retailerLower || lower === retailerLower.replace(/[^a-z]/g, '')) {
      // Check if this is a legitimate store brand exception
      const isException = RETAILER_BRAND_EXCEPTIONS.some((pattern) => pattern.test(trimmed));
      if (!isException) {
        return {
          valid: false,
          reason: `Brand "${trimmed}" is the same as the retailer — likely extraction error.`,
        };
      }
    }
  }

  // Check if brand is a known retailer name (when retailer field differs)
  if (RETAILER_NAMES.has(lower) && lower !== retailer?.toLowerCase()) {
    const isException = RETAILER_BRAND_EXCEPTIONS.some((pattern) => pattern.test(trimmed));
    if (!isException) {
      return {
        valid: false,
        reason: `Brand "${trimmed}" is a retailer name, not a product brand.`,
      };
    }
  }

  // Brand looks like a URL/domain
  if (/^(https?:\/\/|www\.|\w+\.(com|org|net|co\.\w+))/i.test(trimmed)) {
    return { valid: false, reason: `Brand "${trimmed}" looks like a URL, not a brand name.` };
  }

  return { valid: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Image Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate that an image URL is likely a real product image.
 *
 * Rejects:
 * - Tracking pixels
 * - Placeholder images
 * - Google encrypted thumbnails (low quality, often wrong product)
 * - Logos/favicons
 * - Data URIs
 * - Broken/empty URLs
 */
export function validateImage(image: string | null | undefined): ValidationResult {
  if (!image || typeof image !== 'string' || image.trim().length === 0) {
    return { valid: true }; // Missing image is OK, not a failure
  }

  const trimmed = image.trim();

  // Must be a valid URL
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('//')) {
    if (trimmed.startsWith('data:')) {
      return { valid: false, reason: 'Image is a data URI, not a hosted image.' };
    }
    return { valid: false, reason: `Image URL is invalid: "${trimmed.slice(0, 80)}"` };
  }

  // Check against known invalid patterns
  for (const pattern of INVALID_IMAGE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        valid: false,
        reason: `Image URL matches invalid pattern (${pattern.source}): likely placeholder/logo.`,
      };
    }
  }

  // Check for very small image dimensions in URL params (common in CDN URLs)
  const widthMatch = trimmed.match(/[?&]w(?:idth)?=(\d+)/i) ?? trimmed.match(/\/(\d+)x\d+\//);
  const heightMatch = trimmed.match(/[?&]h(?:eight)?=(\d+)/i) ?? trimmed.match(/\/\d+x(\d+)\//);
  if (widthMatch && parseInt(widthMatch[1], 10) < MIN_IMAGE_DIMENSION) {
    return { valid: false, reason: `Image is too small (width ${widthMatch[1]}px).` };
  }
  if (heightMatch && parseInt(heightMatch[1], 10) < MIN_IMAGE_DIMENSION) {
    return { valid: false, reason: `Image is too small (height ${heightMatch[1]}px).` };
  }

  return { valid: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Full Product Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run all validators against a product and produce a comprehensive report.
 *
 * The overall confidence is adjusted based on validation results.
 * isAcceptable = true when the product has at minimum a valid title.
 */
export function validateProduct(
  input: ProductValidationInput,
  baseConfidence: number = 50,
): ProductValidationReport {
  const titleResult = validateTitle(input.title);
  const priceResult = validatePrice(input.price);
  const brandResult = validateBrand(input.brand, input.retailer);
  const imageResult = validateImage(input.image);

  const issues: string[] = [];
  let confidenceAdjustment = 0;

  if (!titleResult.valid) {
    issues.push(titleResult.reason!);
    confidenceAdjustment -= 40; // Bad title is a strong signal of failure
  }

  if (!priceResult.valid) {
    issues.push(priceResult.reason!);
    confidenceAdjustment -= 15;
  }

  if (!brandResult.valid) {
    issues.push(brandResult.reason!);
    confidenceAdjustment -= 10;
  }

  if (!imageResult.valid) {
    issues.push(imageResult.reason!);
    confidenceAdjustment -= 5;
  }

  // Title is the minimum requirement — without it, product is unacceptable
  const isAcceptable = titleResult.valid;

  // Clamp confidence between 0 and 100
  const overallConfidence = Math.min(100, Math.max(0, baseConfidence + confidenceAdjustment));

  return {
    isAcceptable,
    titleValid: titleResult,
    priceValid: priceResult,
    brandValid: brandResult,
    imageValid: imageResult,
    overallConfidence,
    issues,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility: sanitize price (null if invalid, number if valid)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the price if it passes validation, null otherwise.
 * Use this when populating product drafts to avoid storing garbage prices.
 */
export function sanitizePrice(
  price: number | null | undefined,
  source?: string,
  confidence?: number,
): number | null {
  if (price == null) return null;
  const result = validatePrice(price, source, confidence);
  return result.valid ? price : null;
}

/**
 * Returns the title if it passes validation, null otherwise.
 */
export function sanitizeTitle(title: string | null | undefined): string | null {
  if (!title) return null;
  const result = validateTitle(title);
  return result.valid ? title.trim() : null;
}

/**
 * Returns the brand if it passes validation, null otherwise.
 */
export function sanitizeBrand(
  brand: string | null | undefined,
  retailer?: string | null,
): string | null {
  if (!brand) return null;
  const result = validateBrand(brand, retailer);
  return result.valid ? brand.trim() : null;
}

/**
 * Returns the image URL if it passes validation, null otherwise.
 */
export function sanitizeImage(image: string | null | undefined): string | null {
  if (!image) return null;
  const result = validateImage(image);
  return result.valid ? image.trim() : null;
}
