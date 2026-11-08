/**
 * Product page fetcher.
 *
 * Downloads the HTML content of a product URL with appropriate headers
 * to mimic a browser request and avoid bot blocks.
 *
 * Includes SSRF protection to prevent fetching internal/private network
 * addresses. Redirects are validated hop-by-hop before being requested.
 */

import { safeFetch } from '@/lib/security/safe-fetch';

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
 * Fetch the HTML content of a product page.
 *
 * Uses a browser-like User-Agent and follows validated redirects.
 * Throws on network errors, unsafe URLs, or non-OK status codes.
 */
export async function fetchProductPage(url: string): Promise<FetchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await safeFetch(
      url,
      {
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate',
          'Cache-Control': 'no-cache',
        },
        signal: controller.signal,
      },
      { maxRedirects: 5 }
    );

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
