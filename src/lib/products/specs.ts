/**
 * Product specification metadata.
 *
 * `metadata.specs` is the canonical key. Imports written before v0.13.0 used
 * `metadata.specifications`, so readers fall back to it instead of hiding
 * specifications that are still stored. The canonical key always wins when
 * both are present.
 */
export function readSpecEntries(metadata: unknown): unknown[] {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return [];

  const record = metadata as Record<string, unknown>;
  if (Array.isArray(record.specs)) return record.specs;
  if (Array.isArray(record.specifications)) return record.specifications;
  return [];
}
