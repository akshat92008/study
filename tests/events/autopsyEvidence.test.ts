import { describe, expect, it } from 'vitest';
import { isVerifiedAutopsyMistake } from '@/lib/events/autopsy-evidence';

describe('AUTOPSY verified evidence gate', () => {
  it('accepts only verified high-confidence mistakes', () => {
    expect(isVerifiedAutopsyMistake({
      status: 'verified_mistake',
      extractionConfidence: 91,
      needsReview: false,
    })).toBe(true);
  });

  it('rejects low-confidence and needs-review mistakes', () => {
    expect(isVerifiedAutopsyMistake({
      status: 'verified_mistake',
      extractionConfidence: 69,
      needsReview: false,
    })).toBe(false);

    expect(isVerifiedAutopsyMistake({
      status: 'verified_mistake',
      extractionConfidence: 92,
      needsReview: true,
    })).toBe(false);
  });

  it('rejects metadata that omits verified_mistake status', () => {
    expect(isVerifiedAutopsyMistake({
      extractionConfidence: 99,
      needsReview: false,
    })).toBe(false);
  });
});
