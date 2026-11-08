import { describe, expect, it } from 'vitest';
import {
  computeOverallSuccess,
  hasNoAiConfigured,
} from '@/lib/products/identification/overall-status';

describe('computeOverallSuccess', () => {
  it('is false for an empty result set', () => {
    expect(computeOverallSuccess([])).toBe(false);
  });

  it('is false when the only draft failed', () => {
    expect(computeOverallSuccess([{ status: 'failed' }])).toBe(false);
  });

  it('is false for conflicts and no-AI results', () => {
    expect(computeOverallSuccess([{ status: 'conflict' }])).toBe(false);
    expect(computeOverallSuccess([{ status: 'no-ai-configured' }])).toBe(false);
  });

  it('is true for identified and needs-review drafts', () => {
    expect(computeOverallSuccess([{ status: 'identified' }])).toBe(true);
    expect(computeOverallSuccess([{ status: 'needs-review' }])).toBe(true);
    expect(computeOverallSuccess([{ status: 'identified' }, { status: 'needs-review' }])).toBe(
      true
    );
  });

  it('is false when any draft in a batch failed', () => {
    expect(computeOverallSuccess([{ status: 'identified' }, { status: 'failed' }])).toBe(false);
  });
});

describe('hasNoAiConfigured', () => {
  it('requires every item to be no-ai-configured', () => {
    expect(hasNoAiConfigured([{ status: 'no-ai-configured' }])).toBe(true);
    expect(hasNoAiConfigured([{ status: 'no-ai-configured' }, { status: 'failed' }])).toBe(false);
  });
});
