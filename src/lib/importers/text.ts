/**
 * Text / Shopping List Importer
 *
 * Handles plain text input that contains product names or shopping lists.
 * Detects multi-line input as a shopping list, single line as a product name.
 * Strips common prefixes (bullets, numbers, dashes).
 */

import type { ProductDraft } from '@/lib/services/product';
import type { DetectResult, Importer, ImportResult } from './types';

// A multi-line input with 2+ non-empty lines that aren't URLs
const MULTI_LINE_PATTERN = /\n/;
const URL_PATTERN = /^https?:\/\//i;

export const TextImporter: Importer = {
  id: 'text',
  name: 'Text / Shopping List',

  detect(input: string): DetectResult {
    const trimmed = input.trim();

    // Don't match URLs
    if (URL_PATTERN.test(trimmed)) {
      return { match: false, confidence: 0 };
    }

    // Match multi-line text (shopping list)
    if (MULTI_LINE_PATTERN.test(trimmed)) {
      const lines = trimmed.split('\n').filter((l) => l.trim().length > 0);
      if (lines.length >= 2) {
        return { match: true, confidence: 70 };
      }
    }

    // Single line of text that looks like a product name (at least 3 chars)
    if (trimmed.length >= 3 && trimmed.length <= 200) {
      return { match: true, confidence: 30 };
    }

    return { match: false, confidence: 0 };
  },

  async extract(input: string): Promise<ImportResult> {
    const trimmed = input.trim();
    const lines = trimmed
      .split('\n')
      .map((line) => cleanLine(line))
      .filter((line) => line.length >= 2);

    if (lines.length === 0) {
      return { drafts: [], isBatch: false };
    }

    // Single item
    if (lines.length === 1) {
      const parsed = parseLine(lines[0]);
      return {
        drafts: [parsed],
        isBatch: false,
      };
    }

    // Multiple items — this is a shopping list
    const drafts = lines.map(parseLine);

    return {
      drafts,
      isBatch: true,
      batchName: 'Shopping List',
      batchMeta: {
        description: `${drafts.length} items from pasted list`,
      },
    };
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Clean a single line: strip bullets, numbers, dashes, checkboxes.
 */
function cleanLine(line: string): string {
  return (
    line
      .trim()
      // Remove common list prefixes: "- ", "• ", "* ", "1. ", "1) ", "[] ", "[x] "
      .replace(/^[-•*]\s+/, '')
      .replace(/^\d+[.)]\s+/, '')
      .replace(/^\[[ x]?\]\s*/i, '')
      .trim()
  );
}

/**
 * Parse a single line into a ProductDraft.
 * Tries to extract price if present (e.g., "RTX 5070 Ti - $549")
 */
function parseLine(line: string): ProductDraft {
  // Try to extract price from the line
  const priceMatch = line.match(
    /[\$€£](\d+(?:[.,]\d{1,2})?)|(\d+(?:[.,]\d{1,2})?)\s*(?:USD|EUR|GBP|\$)/i
  );
  let price: number | undefined;
  let title = line;

  if (priceMatch) {
    const priceStr = (priceMatch[1] || priceMatch[2]).replace(',', '.');
    price = parseFloat(priceStr);
    if (isNaN(price)) price = undefined;

    // Remove the price from the title
    title = line
      .replace(priceMatch[0], '')
      .replace(/\s*[-–—]\s*$/, '')
      .trim();
  }

  // Try to extract quantity (e.g., "2x 16GB DDR5" or "RAM x2")
  const qtyMatch = title.match(/^(\d+)\s*[xX]\s+(.+)/) ?? title.match(/(.+?)\s*[xX]\s*(\d+)$/);
  if (qtyMatch) {
    if (qtyMatch[1] && /^\d+$/.test(qtyMatch[1])) {
      title = qtyMatch[2];
    } else if (qtyMatch[2] && /^\d+$/.test(qtyMatch[2])) {
      title = qtyMatch[1];
    }
  }

  return {
    title: title.trim(),
    currentPrice: price,
    currency: 'USD',
    source: 'manual',
    confidence: 50,
  };
}
