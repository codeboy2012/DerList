/**
 * Importer Types
 *
 * Defines the contract for import plugins.
 * Every importer detects whether it can handle input, then extracts ProductDrafts.
 */

import type { ProductDraft } from '@/lib/services/product';

// ─────────────────────────────────────────────────────────────────────────────
// Importer Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface Importer {
  /** Unique identifier (e.g., 'amazon', 'pcpartpicker', 'text') */
  readonly id: string;
  /** Display name */
  readonly name: string;

  /**
   * Can this importer handle the given input?
   * Returns confidence 0-100. Higher = better match.
   * Should be fast (no network calls).
   */
  detect(input: string): DetectResult;

  /**
   * Extract product data from the input.
   * May make network calls (fetch pages, APIs).
   */
  extract(input: string): Promise<ImportResult>;
}

export interface DetectResult {
  /** Whether this importer can handle the input */
  match: boolean;
  /** Confidence score 0-100 */
  confidence: number;
}

export interface ImportResult {
  /** Extracted products */
  drafts: ProductDraft[];
  /** Whether this is a multi-item import (e.g., PCPartPicker build, shopping list) */
  isBatch: boolean;
  /** For batch imports: suggested folder/category name */
  batchName?: string;
  /** For batch imports: metadata about the batch (notes, links, etc.) */
  batchMeta?: {
    description?: string;
    sourceUrl?: string;
    notes?: string;
  };
}
