import { describe, expect, it } from 'vitest';
import { computeQuestionStatus, normalizeAnswer } from '@/lib/autopsy-v3/scoring';

describe('Autopsy V3 scoring', () => {
  it('handles A/B/C/D option answers', () => {
    expect(computeQuestionStatus('A', 'Option A')).toBe('correct');
    expect(computeQuestionStatus('(B)', 'b')).toBe('correct');
  });

  it('treats empty user answer as skipped', () => {
    expect(computeQuestionStatus('C', '')).toBe('skipped');
    expect(computeQuestionStatus('C', 'blank')).toBe('skipped');
  });

  it('maps numeric options to letters', () => {
    expect(normalizeAnswer('1')).toBe('a');
    expect(computeQuestionStatus('D', '4')).toBe('correct');
  });

  it('detects incorrect answers', () => {
    expect(computeQuestionStatus('A', 'B')).toBe('incorrect');
  });
});
