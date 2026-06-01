import { describe, expect, it } from 'vitest';
import {
  buildConceptKey,
  normalizeChapter,
  normalizeConceptName,
  normalizeSubject,
} from '@/lib/engines/concept-normalization';
import { isAutopsyUploadIntent } from '@/lib/autopsy/upload-intent';

describe('canonical MVP normalization helpers', () => {
  it('resolves common ATLAS chapter variants together', () => {
    expect(normalizeChapter('Electric Charges and Fields')).toBe('electric charge field');
    expect(normalizeChapter('Electric Charge & Field')).toBe('electric charge field');
    expect(normalizeChapter('Electrostatics')).toBe('electric charge field');
  });

  it('normalizes subject casing and concept names', () => {
    expect(normalizeSubject('Biology')).toBe('biology');
    expect(normalizeSubject('biology')).toBe('biology');
    expect(normalizeConceptName('Biological Classifications')).toBe('biological classification');
  });

  it('builds stable concept keys', () => {
    expect(buildConceptKey({
      subject: 'Physics',
      chapter: 'Electric Charges and Fields',
      name: 'Electric Charge & Field',
    })).toBe('physics::electric charge field::electric charge field');
  });

  it('routes mock/test uploads to AUTOPSY without hijacking explanation uploads', () => {
    expect(isAutopsyUploadIntent('analyze my mock', 'neet-result.pdf')).toBe(true);
    expect(isAutopsyUploadIntent('explain this pdf', 'electrostatics.pdf')).toBe(false);
  });
});
