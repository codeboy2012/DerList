/**
 * Product page fetcher.
 *
 * Downloads the HTML content of a product URL with appropriate headers
 * to mimic a browser request and avoid bot blocks.
 *
 * Includes SSRF protection to prevent fetching internal/private network addresses.
 */

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const FETCH_TIMEOUT_MS = 15000;
const MAX_RESPONSE_SIZE = 5 * 1024 * 1024; // 5 MB max response

export interface FetchResult {
  html: string;
  finalUrl: string;
  status: number;
}

/**
 * Validate that a URL does not point to internal/private network addresses.
 * Prevents SSRF attacks through the product import feature.
 */
function validateUrlSafety(url: string): void {
  const parsed = new URL(url);
  const hostname = parsed.hostname.toLowerCase();

  // Block private/internal hostnames
  const blockedPatterns = [
    /^localhost$/,
    /^127\.\d+\.\d+\.\d+$/,
    /^10\.\d+\.\d+\.\d+$/,
    /^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/,
    /^192\.168\.\d+\.\d+$/,
    /^0\.0\.0\.0$/,
    /^::1$/,
    /^fc[0-9a-f]{2}:/i,
    /^fd[0-9a-f]{2}:/i,
    /^fe80:/i,
    /^169\.254\.\d+\.\d+$/, // Link-local
    /\.local$/,
    /\.internal$/,
    /^metadata\.google\.internal$/,
  ];

  for (const pattern of blockedPatterns) {
    if (pattern.test(hostname)) {
      throw new Error('URL points to a private or internal address.');
    }
  }

  // Block non-standard ports commonly used for internal services
  const port = parsed.port ? parseInt(parsed.port, 10) : null;
  if (port && (port < 80 || (port > 443 && port < 8000) || port > 9999)) {
    // Allow 80, 443, and 8000-9999 range (common web server ports)
    // Block everything else (databases, admin panels, etc.)
    throw new Error('URL uses a non-standard port.');
  }

  // Must be http or https
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only HTTP/HTTPS URLs are supported.');
  }
}

/**
 * Fetch the HTML content of a product page.
 *
 * Uses a browser-like User-Agent and follows redirects.
 * Throws on network errors or non-OK status codes.
 * Includes SSRF protection.
 */
export async function fetchProductPage(url: string): Promise<FetchResult> {
  // SSRF protection: validate the URL before fetching
  validateUrlSafety(url);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate',
        'Cache-Control': 'no-cache',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    // After redirect, validate the final URL too
    if (response.url && response.url !== url) {
      validateUrlSafety(response.url);
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      throw new Error('Response is not HTML.');
    }

    // Limit response size to prevent memory exhaustion
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_SIZE) {
      throw new Error('Response too large.');
    }

    const html = await response.text();

    if (html.length > MAX_RESPONSE_SIZE) {
      throw new Error('Response too large.');
    }

    const finalUrl = response.url || url;

    return { html, finalUrl, status: response.status };
  } finally {
    clearTimeout(timeout);
  }
}
