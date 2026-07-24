/**
 * HTML Heuristic Extractor — generic fallback using CSS class patterns and page structure.
 * Lowest confidence (40-60) but catches data other extractors miss.
 */
import type { ExtractionResult } from '../engine/types';
import { extractBestPrice } from '../price';

export function extractFromHtmlHeuristic(html: string, domain: string | null): ExtractionResult {
  const result: ExtractionResult = {
    title: null, description: null, price: null, currency: null,
    image: null, gallery: [], brand: null, sku: null, mpn: null,
    gtin: null, inStock: null, availability: null, confidence: 0, source: 'html-heuristic',
  };

  // Title: <title> tag, cleaned
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) result.title = titleMatch[1].trim().replace(/\s*[-|–—].*$/, '').trim() || null;

  // Description: meta description
  const descMatch = html.match(/name=["']description["'][^>]*content=["']([^"']*)["']/i)
    ?? html.match(/content=["']([^"']*)["'][^>]*name=["']description["']/i);
  if (descMatch) result.description = descMatch[1].trim() || null;

  // Price: use the existing confidence-based price engine
  const priceResult = extractBestPrice(html, domain);
  if (priceResult) { result.price = priceResult.price; result.currency = priceResult.currency; }

  // Image extraction (prioritized)
  result.image = findBestImage(html);

  let conf = 0;
  if (result.title) conf += 15;
  if (result.price) conf += 25;
  if (result.image) conf += 10;
  result.confidence = Math.min(conf, 60);

  return result;
}

function findBestImage(html: string): string | null {
  // 1. OpenGraph image (reliable)
  const ogMatch = html.match(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
    ?? html.match(/content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
  if (ogMatch && isGoodImage(ogMatch[1])) return ogMatch[1];

  // 2. Twitter image
  const twMatch = html.match(/name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i)
    ?? html.match(/content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i);
  if (twMatch && isGoodImage(twMatch[1])) return twMatch[1];

  // 3. link rel="image_src"
  const linkMatch = html.match(/<link[^>]*rel=["']image_src["'][^>]*href=["']([^"']+)["']/i);
  if (linkMatch && isGoodImage(linkMatch[1])) return linkMatch[1];

  // 4. Large product images (score by attributes)
  const imgRegex = /<img[^>]*src=["']([^"']+)["'][^>]*>/gi;
  let bestUrl: string | null = null;
  let bestScore = 0;
  let match;

  while ((match = imgRegex.exec(html)) !== null) {
    const url = match[1];
    const tag = match[0];
    if (!isGoodImage(url)) continue;

    let score = 0;
    if (/product|hero|main|primary|feature/i.test(tag)) score += 4;
    if (/data-(?:zoom|large|full|high)/i.test(tag)) score += 5;
    if (/class=["'][^"']*(?:product|hero|gallery)/i.test(tag)) score += 3;

    const w = tag.match(/width=["']?(\d+)/i);
    if (w && parseInt(w[1]) >= 300) score += 2;
    if (w && parseInt(w[1]) >= 500) score += 3;

    if (score > bestScore) { bestScore = score; bestUrl = url; }
  }

  return bestUrl;
}

function isGoodImage(url: string): boolean {
  if (!url || url.length < 15) return false;
  if (!url.startsWith('http')) return false;
  if (/icon|logo|badge|sprite|pixel|spacer|transparent|1x1|avatar|button|arrow|star/i.test(url)) return false;
  if (/\.svg$/i.test(url)) return false;
  return true;
}
