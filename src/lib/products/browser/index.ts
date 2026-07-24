/**
 * Browser Rendering Module — Optional Playwright integration.
 *
 * This module is entirely optional. If Playwright is not installed,
 * all functions gracefully return null/false and the system continues
 * with HTTP-only extraction.
 */

import { requiresBrowser } from './domains';

export { requiresBrowser } from './domains';

export interface BrowserRenderResult {
  html: string;
  finalUrl: string;
}

let _playwrightAvailable: boolean | null = null;

/**
 * Check if Playwright is installed and available.
 * Result is cached after first check.
 */
export function isBrowserAvailable(): boolean {
  if (_playwrightAvailable !== null) return _playwrightAvailable;

  try {
    require.resolve('playwright');
    _playwrightAvailable = true;
  } catch {
    _playwrightAvailable = false;
  }

  return _playwrightAvailable;
}

/**
 * Render a page using a headless browser.
 * Returns null if Playwright is not installed or rendering fails.
 *
 * @param url - The URL to render
 * @param timeoutMs - Maximum time to wait (default 30s)
 */
export async function renderWithBrowser(
  url: string,
  timeoutMs: number = 30000,
): Promise<BrowserRenderResult | null> {
  if (!isBrowserAvailable()) {
    return null;
  }

  try {
    // Dynamic import to avoid bundling Playwright when not installed
    // @ts-ignore — optional dependency, only used when playwright is installed
    const { chromium } = await import('playwright');

    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    try {
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
      });

      const page = await context.newPage();

      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: timeoutMs,
      });

      // Small delay for any final JS rendering
      await page.waitForTimeout(1000);

      const html = await page.content();
      const finalUrl = page.url();

      await context.close();

      return { html, finalUrl };
    } finally {
      await browser.close();
    }
  } catch (err) {
    // Playwright not available or rendering failed — graceful fallback
    console.warn('[browser] Rendering failed:', err instanceof Error ? err.message : 'Unknown error');
    return null;
  }
}

/**
 * Determine if browser rendering should be attempted for a given result.
 */
export function shouldTryBrowser(
  domain: string | null,
  confidence: number,
  hasPrice: boolean,
): boolean {
  if (!isBrowserAvailable()) return false;

  // Always try for known JS-heavy domains if we got no price
  if (requiresBrowser(domain) && !hasPrice) return true;

  // Try if confidence is very low
  if (confidence < 40 && !hasPrice) return true;

  return false;
}
