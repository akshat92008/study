import { describe, expect, it } from 'vitest';
import { areMcqAnswersEquivalent, normalizeMcqAnswer } from '@/lib/practice/answer-normalization';

describe('MCQ answer normalization', () => {
  const options = ['Ampere', 'Volt', 'Ohm', 'Coulomb'];

  it('normalizes common option letter formats', () => {
    expect(normalizeMcqAnswer('A', options)).toBe('A');
    expect(normalizeMcqAnswer('(A)', options)).toBe('A');
    expect(normalizeMcqAnswer('Option A', options)).toBe('A');
    expect(normalizeMcqAnswer('A) Ampere', options)).toBe('A');
  });

  it('matches answer text and trailing option labels when possible', () => {
    expect(normalizeMcqAnswer('Ampere', options)).toBe('A');
    expect(normalizeMcqAnswer('Ampere (A)', options)).toBe('A');
    expect(areMcqAnswersEquivalent('option a', 'Ampere (A)', options)).toBe(true);
    expect(areMcqAnswersEquivalent('Volt', 'A', options)).toBe(false);
  });
});
