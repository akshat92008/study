import { test, expect, describe } from 'vitest';
import { ALL_NEET_CHAPTER_SEEDS } from '../../lib/topic-seeding/templates/neet';
import { isTopicInChapter } from '../../lib/topic-seeding/templates/neet/topic-skeleton';

describe('NEET Taxonomy Paths', () => {
  test('Every active recall question must have a valid taxonomy path', () => {
    for (const chapter of ALL_NEET_CHAPTER_SEEDS) {
      for (const mission of chapter.missions) {
        for (const mt of mission.microtargets) {
          for (const q of mt.activeRecallQuestions || []) {
            expect(q.taxonomyPath).toBeDefined();
            expect(q.taxonomyPath.subtopicSlug).toBeTruthy();
            expect(q.taxonomyPath.topicSlug).toBeTruthy();
            expect(q.taxonomyPath.microskillSlug).toBeTruthy();
            expect(q.taxonomyPath.conceptSlug).toBeTruthy();
            
            // Should not contain placeholder numbers like topic-0 or skill-0-1
            expect(q.taxonomyPath.subtopicSlug).not.toMatch(/topic-0/i);
            expect(q.taxonomyPath.microskillSlug).not.toMatch(/skill-0-[0-9]+/i);
            expect(
              isTopicInChapter(q.taxonomyPath.topicSlug, q.taxonomyPath.chapterSlug),
              `${chapter.chapterSlug}/${mt.title} uses out-of-chapter topic ${q.taxonomyPath.topicSlug}`
            ).toBe(true);
          }
        }
      }
    }
  });
});
