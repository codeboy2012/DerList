/**
 * Specification metadata compatibility.
 *
 * `metadata.specs` is canonical; `metadata.specifications` is the legacy key
 * written by earlier imports. Readers must prefer canonical data while still
 * showing legacy specifications, and must ignore malformed metadata.
 */
import { describe, expect, it } from 'vitest';
import { readSpecEntries } from '@/lib/products/specs';

const canonical = [{ id: '1', key: 'Battery', value: '30', unit: 'hours' }];
const legacy = [{ id: '2', key: 'Weight', value: '250', unit: 'g' }];

describe('readSpecEntries', () => {
  it('reads the canonical `specs` key', () => {
    expect(readSpecEntries({ specs: canonical })).toEqual(canonical);
  });

  it('reads the legacy `specifications` key', () => {
    expect(readSpecEntries({ specifications: legacy })).toEqual(legacy);
  });

  it('prefers canonical specs when both keys exist', () => {
    expect(readSpecEntries({ specs: canonical, specifications: legacy })).toEqual(canonical);
  });

  it('treats an explicitly empty canonical list as authoritative', () => {
    expect(readSpecEntries({ specs: [], specifications: legacy })).toEqual([]);
  });

  it('preserves the stored entry objects, including extra fields', () => {
    const entries = [{ key: 'Colour', value: 'Black', source: 'import' }];
    expect(readSpecEntries({ specs: entries })[0]).toBe(entries[0]);
  });

  it('returns an empty list for missing or malformed metadata', () => {
    expect(readSpecEntries(null)).toEqual([]);
    expect(readSpecEntries(undefined)).toEqual([]);
    expect(readSpecEntries('not-json')).toEqual([]);
    expect(readSpecEntries([])).toEqual([]);
    expect(readSpecEntries({ specs: 'Battery' })).toEqual([]);
    expect(readSpecEntries({ specifications: { key: 'Battery' } })).toEqual([]);
    expect(readSpecEntries({})).toEqual([]);
  });
});
