/**
 * Product Identification Pipeline — public API.
 */
export { identifyProduct } from './pipeline';
export type { ExtendedIdentificationResult } from './pipeline';
export { importLog } from './logging';
export { resolveProductImage, validateImageUrl } from './image-resolution';
export { calculateCompleteness } from './completeness';
export { validateProductIdentity, isUrlSafe, isValidAsin, isValidUpc, looksLikeUrl } from './identity-validator';
export { buildSystemPrompt, buildIdentificationPrompt, assembleIdentificationContext, parseAIResponse } from './ai-product-prompt';
export type {
  IdentificationInput,
  IdentificationResult,
  IdentificationSource,
  IdentifiedProduct,
  FieldSources,
  ImportStatus,
  StageTiming,
  ProviderAttempt,
} from './types';
export type {
  AIIdentificationResult,
  AIProductResponse,
  AIProductData,
  AIProductPricing,
  AIProductSeller,
  AIProductImage,
  AIProductSpecification,
  AIConfidenceScores,
  AIConflict,
  AIImportStatus,
  AIIdentificationStatus,
  FieldSourceType,
  FieldSourceEntry,
  FieldSourceMap,
  IdentityVerificationResult,
  IdentityCheck,
  IdentityConflict,
  AIIdentificationMetadata,
  NoAIConfiguredResult,
  AIIdentificationContext,
  SearchEvidenceContext,
  FullProductEditorDraft,
  ProductEditorImage,
  AIActivityEvent,
  AIActivityTimeline,
  AIActivityStatus,
} from './ai-identification-types';
