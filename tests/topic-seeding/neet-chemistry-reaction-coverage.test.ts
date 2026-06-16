import { test, expect, describe } from 'vitest';
import { ALL_NEET_CHAPTER_SEEDS } from '../../lib/topic-seeding/templates/neet';

describe('NEET Chemistry Reaction Coverage', () => {
  test('Organic Chemistry units must include reactions', () => {
    const organicChapters = ['goc', 'hydrocarbons', 'haloalkanes-haloarenes', 'oxygen-containing-compounds', 'nitrogen-containing-compounds', 'some-basic-principles-of-organic-chemistry'];
    
    for (const chapter of ALL_NEET_CHAPTER_SEEDS) {
      if (chapter.subject === 'Chemistry' && organicChapters.includes(chapter.chapterSlug)) {
        let hasReactions = false;
        for (const mission of chapter.missions) {
          for (const mt of mission.microtargets) {
            if (mt.reactions && mt.reactions.length > 0) {
              hasReactions = true;
            }
          }
        }
        expect(hasReactions).toBe(true);
      }
    }
  });
});
