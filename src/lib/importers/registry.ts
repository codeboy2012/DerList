/**
 * Importer Registry
 *
 * Plugin system for import sources.
 * registerImporter() adds new importers.
 * detectBestImporter() finds the right one for any input.
 */

import type { DetectResult, Importer } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────────────

const importers: Importer[] = [];

/**
 * Register an importer plugin.
 * Importers are tested in order of registration, but the one
 * with highest confidence wins.
 */
export function registerImporter(importer: Importer): void {
  importers.push(importer);
}

/**
 * Find the best importer for the given input.
 * Returns the importer with the highest confidence, or null if none match.
 */
export function detectBestImporter(input: string): Importer | null {
  let best: Importer | null = null;
  let bestConfidence = 0;

  for (const importer of importers) {
    const result = importer.detect(input);
    if (result.match && result.confidence > bestConfidence) {
      best = importer;
      bestConfidence = result.confidence;
    }
  }

  return best;
}

/**
 * Get all registered importers with their detection results for a given input.
 * Useful for debugging or showing the user which importers matched.
 */
export function detectAll(input: string): Array<{ importer: Importer; result: DetectResult }> {
  return importers
    .map((importer) => ({ importer, result: importer.detect(input) }))
    .filter(({ result }) => result.match)
    .sort((a, b) => b.result.confidence - a.result.confidence);
}

/**
 * Get all registered importers.
 */
export function getImporters(): readonly Importer[] {
  return importers;
}
