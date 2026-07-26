/**
 * PCPartPicker Build Importer
 *
 * Imports a PCPartPicker build list URL.
 * Creates one ProductDraft per component, with batch metadata for the build.
 * Scrapes the build page to extract individual parts, prices, and compatibility.
 */

import type { ProductDraft } from '@/lib/services/product';
import type { DetectResult, Importer, ImportResult } from './types';

const PCPP_PATTERN =
  /^https?:\/\/(www\.)?(pcpartpicker\.com|uk\.pcpartpicker\.com|ca\.pcpartpicker\.com|de\.pcpartpicker\.com|au\.pcpartpicker\.com)\/list\//i;
const PCPP_USER_PATTERN = /^https?:\/\/(www\.)?pcpartpicker\.com\/user\/[^/]+\/saved\//i;

export const PCPartPickerImporter: Importer = {
  id: 'pcpartpicker',
  name: 'PCPartPicker',

  detect(input: string): DetectResult {
    const trimmed = input.trim();
    if (PCPP_PATTERN.test(trimmed) || PCPP_USER_PATTERN.test(trimmed)) {
      return { match: true, confidence: 95 };
    }
    return { match: false, confidence: 0 };
  },

  async extract(input: string): Promise<ImportResult> {
    const url = input.trim();

    // Fetch the PCPartPicker page
    let html: string;
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html',
        },
      });

      if (!response.ok) {
        return { drafts: [], isBatch: true, batchName: 'PC Build' };
      }

      html = await response.text();
    } catch {
      return { drafts: [], isBatch: true, batchName: 'PC Build' };
    }

    // Parse the parts table
    const parts = parsePCPartPickerHtml(html);
    const buildName = extractBuildName(html) || 'PC Build';
    const totalPrice = parts.reduce((sum, p) => sum + (p.currentPrice ?? 0), 0);

    // Build notes with compatibility and wattage info
    const wattage = extractWattage(html);
    const compatibility = extractCompatibility(html);

    const notes = [
      wattage ? `Estimated Wattage: ${wattage}W` : null,
      `Total Cost: $${totalPrice.toFixed(2)}`,
      `Components: ${parts.length}`,
      compatibility ? `Compatibility: ${compatibility}` : null,
      `Source: ${url}`,
    ]
      .filter(Boolean)
      .join('\n');

    return {
      drafts: parts,
      isBatch: true,
      batchName: buildName,
      batchMeta: {
        description: `PCPartPicker build with ${parts.length} components`,
        sourceUrl: url,
        notes,
      },
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// HTML Parsing
// ─────────────────────────────────────────────────────────────────────────────

function parsePCPartPickerHtml(html: string): ProductDraft[] {
  const drafts: ProductDraft[] = [];

  // PCPartPicker renders parts in a table with class "xs-col-12"
  // Each row has: component type, product name, price, buy link
  // We use regex since we don't have a DOM parser on the server

  // Match table rows with part data
  // Pattern: look for component type + product name + price
  const rowPattern = /<tr[^>]*class="[^"]*tr__product[^"]*"[^>]*>([\s\S]*?)<\/tr>/gi;
  const typePattern = /class="[^"]*td__component[^"]*"[^>]*>([\s\S]*?)<\/td>/i;
  const namePattern = /class="[^"]*td__name[^"]*"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i;
  const pricePattern = /class="[^"]*td__price[^"]*"[^>]*>([\s\S]*?)<\/td>/i;
  const linkPattern = /class="[^"]*td__name[^"]*"[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>/i;

  let match;
  while ((match = rowPattern.exec(html)) !== null) {
    const row = match[1];

    const typeMatch = row.match(typePattern);
    const nameMatch = row.match(namePattern);
    const priceMatch = row.match(pricePattern);
    const linkMatch = row.match(linkPattern);

    if (!nameMatch) continue;

    const category = typeMatch ? stripHtml(typeMatch[1]).trim() : undefined;
    const title = stripHtml(nameMatch[1]).trim();
    const priceText = priceMatch ? stripHtml(priceMatch[1]).trim() : '';
    const productUrl = linkMatch?.[1] ? resolveUrl(linkMatch[1]) : undefined;

    if (!title) continue;

    const price = parsePrice(priceText);

    drafts.push({
      title,
      url: productUrl,
      currentPrice: price ?? undefined,
      currency: 'USD',
      category: category || undefined,
      retailer: 'PCPartPicker',
      source: 'import',
      confidence: 85,
    });
  }

  // Fallback: if regex didn't match (PCPP changes HTML often), try simpler approach
  if (drafts.length === 0) {
    return parsePCPartPickerFallback(html);
  }

  return drafts;
}

/**
 * Fallback parser: looks for product names and prices in a less structured way.
 */
function parsePCPartPickerFallback(html: string): ProductDraft[] {
  const drafts: ProductDraft[] = [];

  // Look for product links in the page
  const productPattern = /href="\/product\/([^"]+)"[^>]*>([^<]+)</gi;
  const pricePattern = /\$(\d+(?:\.\d{2})?)/g;

  // Extract all product names
  const products: Array<{ name: string; url: string }> = [];
  let productMatch;
  while ((productMatch = productPattern.exec(html)) !== null) {
    const name = productMatch[2].trim();
    const productUrl = `https://pcpartpicker.com/product/${productMatch[1]}`;
    if (name.length > 5 && !products.some((p) => p.name === name)) {
      products.push({ name, url: productUrl });
    }
  }

  // Extract all prices
  const prices: number[] = [];
  let priceMatch;
  while ((priceMatch = pricePattern.exec(html)) !== null) {
    prices.push(parseFloat(priceMatch[1]));
  }

  // Combine (best effort — prices may not align perfectly)
  for (let i = 0; i < products.length; i++) {
    drafts.push({
      title: products[i].name,
      url: products[i].url,
      currentPrice: prices[i] ?? undefined,
      currency: 'USD',
      retailer: 'PCPartPicker',
      source: 'import',
      confidence: 60,
    });
  }

  return drafts;
}

function extractBuildName(html: string): string | null {
  // Look for the build title in page header
  const titleMatch =
    html.match(/<h1[^>]*id="partlist_name"[^>]*>([\s\S]*?)<\/h1>/i) ??
    html.match(/<title>([^<]*?)(?:\s*-\s*PCPartPicker)?<\/title>/i);

  if (titleMatch) {
    const name = stripHtml(titleMatch[1]).trim();
    if (name && name !== 'PCPartPicker' && name.length > 2) {
      return name;
    }
  }
  return null;
}

function extractWattage(html: string): number | null {
  const wattMatch =
    html.match(/Estimated Wattage:\s*(\d+)\s*W/i) ?? html.match(/(\d+)\s*W\s*estimated/i);
  return wattMatch ? parseInt(wattMatch[1], 10) : null;
}

function extractCompatibility(html: string): string | null {
  if (html.includes('compatibility-note--type-error')) return 'Issues found';
  if (html.includes('compatibility-note--type-warning')) return 'Warnings';
  if (html.includes('No issues/incompatibilities found')) return 'No issues';
  return null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function parsePrice(text: string): number | null {
  const match = text.match(/\$?([\d,]+\.?\d*)/);
  if (!match) return null;
  const num = parseFloat(match[1].replace(/,/g, ''));
  return isNaN(num) ? null : num;
}

function resolveUrl(path: string): string {
  if (path.startsWith('http')) return path;
  return `https://pcpartpicker.com${path}`;
}
