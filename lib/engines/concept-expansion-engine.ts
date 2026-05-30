import { createAdminClient } from '@/lib/supabase/admin';
import { generateJSON } from '@/lib/ai/provider-client';
import { logger } from '@/lib/utils/logger';

interface ConceptDiscoveredData {
  parentConceptId: string;
  subject: string;
  chapter: string;
}

export class ConceptExpansionConsumer {
  static async handleConceptDiscovered(userId: string, data: ConceptDiscoveredData): Promise<void> {
    const { parentConceptId, subject, chapter } = data;
    if (!subject || !chapter) return;

    logger.info('Starting dynamic concept expansion', { userId, subject, chapter });

    const prompt = `
You are an expert curriculum designer. The student has encountered a new chapter: "${chapter}" in the subject "${subject}".
We need to break this chapter down into 3-6 core subtopics that they need to learn to master this chapter.
Respond ONLY with a JSON array of strings, where each string is a subtopic name. Do not include markdown.
`.trim();

    try {
      const subtopics = await generateJSON<string[]>(
        'flash',
        'You are a curriculum expert. Output only a JSON array of strings.',
        prompt
      );

      if (!Array.isArray(subtopics) || subtopics.length === 0) {
        logger.warn('Concept expansion failed to generate subtopics', { subject, chapter });
        return;
      }

      const supabase = createAdminClient();
      
      const newConcepts = subtopics.map(subtopic => ({
        user_id: userId,
        subject: subject,
        chapter: chapter,
        name: subtopic,
        mastery: 'not_started',
        confidence: 'low',
        // Depending on DB schema, there might not be a parent_id, so we just group by chapter
      }));

      const { error } = await supabase.from('concepts').insert(newConcepts);

      if (error) {
        logger.error('Failed to insert dynamically expanded concepts', { error });
      } else {
        logger.info(`Successfully expanded chapter "${chapter}" into ${subtopics.length} subtopics`, { userId });
      }
    } catch (err) {
      logger.error('Concept expansion error', err);
    }
  }
}
