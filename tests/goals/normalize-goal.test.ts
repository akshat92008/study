import { describe, expect, it } from 'vitest';
import { normalizeGoal } from '@/lib/goals/normalize-goal';

describe('normalizeGoal', () => {
  it.each(['master biotechnology', 'revise biotech for neet', 'PCR and rDNA'])(
    'normalizes %s to NEET Biology Biotechnology',
    (input) => {
      expect(normalizeGoal(input)).toMatchObject({
        exam: 'NEET', subject: 'Biology', chapter: 'Biotechnology and Its Applications', chapterSlug: 'neet-biology-biotechnology',
      });
    }
  );
});
