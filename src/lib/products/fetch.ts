/**
 * Product page fetcher.
 *
 * Downloads the HTML content of a product URL with appropriate headers
 * to mimic a browser request and avoid bot blocks.
 */

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const FETCH_TIMEOUT_MS = 15000;

export interface FetchResult {
  html: string;
  finalUrl: string;
  status: number;
}

/**
 * Fetch the HTML content of a product page.
 *
 * Uses a browser-like User-Agent and follows redirects.
 * Throws on network errors or non-OK status codes.
 */
export async function fetchProductPage(url: string): Promise<FetchResult> {
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

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      throw new Error('Response is not HTML.');
    }

    const html = await response.text();
    const finalUrl = response.url || url;

    return { html, finalUrl, status: response.status };
  } finally {
    clearTimeout(timeout);
  }
}
