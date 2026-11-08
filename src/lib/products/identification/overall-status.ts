/**
 * Overall identification outcome helpers.
 *
 * The API used to derive `success` from the first draft alone and treated a
 * `failed` draft as success. Overall success now requires every draft to be
 * usable, and no-AI is reported separately from a genuine failure.
 */

export interface ItemStatusLike {
  status: string;
}

export function isSuccessfulItemStatus(status: string): boolean {
  return status === 'identified' || status === 'needs-review';
}

/** True only when there is at least one item and every item is usable. */
export function computeOverallSuccess(statuses: readonly ItemStatusLike[]): boolean {
  return statuses.length > 0 && statuses.every((item) => isSuccessfulItemStatus(item.status));
}

/** True when every item failed because no AI provider is configured. */
export function hasNoAiConfigured(statuses: readonly ItemStatusLike[]): boolean {
  return statuses.length > 0 && statuses.every((item) => item.status === 'no-ai-configured');
}
