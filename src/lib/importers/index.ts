/**
 * Import Pipeline
 *
 * Universal import system. Every way of adding products flows through here.
 * Importers are plugins registered at startup.
 *
 * Usage:
 *   const result = await universalImport(userInput);
 *   // result.drafts → ProductDraft[] ready for ProductEditor
 */

// Import all importer plugins
import { AmazonImporter } from './amazon';
import { BestBuyImporter } from './bestbuy';
import { GenericUrlImporter } from './generic-url';
import { NeweggImporter } from './newegg';
import { PCPartPickerImporter } from './pcpartpicker';
import { detectAll, detectBestImporter, getImporters, registerImporter } from './registry';
import { TextImporter } from './text';
import type { ImportResult } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Register all importers (order matters for tie-breaking)
// ─────────────────────────────────────────────────────────────────────────────

// Specialized URL importers (high confidence for their domains)
registerImporter(PCPartPickerImporter);
registerImporter(AmazonImporter);
registerImporter(BestBuyImporter);
registerImporter(NeweggImporter);

// Generic URL importer (catches any URL not handled above)
registerImporter(GenericUrlImporter);

// Text importer (catches non-URL text input)
registerImporter(TextImporter);

// ─────────────────────────────────────────────────────────────────────────────
// Main Pipeline Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Universal import: detects input type and extracts ProductDrafts.
 *
 * This is the single entry point for ALL product imports in DerList.
 * Whether the user pastes a URL, types a product name, or pastes a shopping list —
 * it all goes through here.
 *
 * Returns an ImportResult with ProductDraft[] ready for the ProductEditor.
 */
export async function universalImport(input: string): Promise<ImportResult> {
  const trimmed = input.trim();

  if (!trimmed) {
    return { drafts: [], isBatch: false };
  }

  // Find the best importer for this input
  const importer = detectBestImporter(trimmed);

  if (!importer) {
    // Nothing matched — treat as a single product name
    return {
      drafts: [
        {
          title: trimmed,
          source: 'manual',
          confidence: 30,
        },
      ],
      isBatch: false,
    };
  }

  // Run the importer
  try {
    return await importer.extract(trimmed);
  } catch (error) {
    // Importer failed — still return something useful
    console.error(`Importer ${importer.id} failed:`, error);
    return {
      drafts: [
        {
          title: trimmed,
          source: 'manual',
          confidence: 20,
        },
      ],
      isBatch: false,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

export { registerImporter, detectBestImporter, detectAll, getImporters };
export type { Importer, DetectResult, ImportResult } from './types';
