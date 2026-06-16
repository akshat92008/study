import { test, expect, describe } from 'vitest';
import { ALL_NEET_CHAPTER_SEEDS } from '../../lib/topic-seeding/templates/neet';

describe('NEET Biology Diagram Coverage', () => {
  test('Diagram-heavy chapters must include diagrams', () => {
    const diagramHeavyBioChapters = ['human-physiology', 'plant-physiology', 'reproduction', 'ecology-and-environment', 'cell-structure-and-function', 'structural-organisation'];
    
    for (const chapter of ALL_NEET_CHAPTER_SEEDS) {
      if (chapter.subject === 'Biology' && diagramHeavyBioChapters.includes(chapter.chapterSlug)) {
        let hasDiagrams = false;
        for (const mission of chapter.missions) {
          for (const mt of mission.microtargets) {
            if (mt.diagrams && mt.diagrams.length > 0) {
              hasDiagrams = true;
            }
          }
        }
        expect(hasDiagrams).toBe(true);
      }
    }
  });
});
