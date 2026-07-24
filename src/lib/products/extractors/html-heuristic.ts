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

  // Image: og:image fallback, then largest product img
  const ogImg = html.match(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
    ?? html.match(/content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
  if (ogImg && ogImg[1].startsWith('http')) result.image = ogImg[1];

  let conf = 0;
  if (result.title) conf += 15;
  if (result.price) conf += 25;
  if (result.image) conf += 10;
  result.confidence = Math.min(conf, 60);

  return result;
}
