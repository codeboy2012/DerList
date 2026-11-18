/**
 * Identification Providers — barrel export.
 */
export { AIIdentificationProvider, scratchOf } from './ai-provider';
export type { IdentificationScratch, ScratchInput } from './ai-provider';
export { SearchIdentificationProvider } from './search-provider';
export { StructuredDataProvider } from './structured-data-provider';
export { getKeepaImageCandidates } from './keepa-image-provider';
