import { createAdminClient } from '@/lib/supabase/admin';
import { generateJSON } from '@/lib/ai/provider-client';
import { logger } from '@/lib/utils/logger';
import { reserveBudgetForModelCall } from '@/lib/ai/cost-guard';

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
      const reservation = await reserveBudgetForModelCall(
        userId,
        'planner',
        'router:concept-expansion',
        Math.max(1, Math.ceil(prompt.length / 4)),
        300
      );

      const subtopics = await generateJSON<string[]>(
        'flash',
        'You are a curriculum expert. Output only a JSON array of strings.',
        prompt,
        undefined,
        0.3,
        3,
        reservation.reservationId
      );

      if (!Array.isArray(subtopics) || subtopics.length === 0) {
        logger.warn('Concept expansion failed to generate subtopics', { subject, chapter });
        return;
      }

      const supabase = createAdminClient();
      
      const { data: existing } = await supabase
        .from('concepts')
        .select('name')
        .eq('user_id', userId)
        .eq('subject', subject)
        .eq('chapter', chapter);
      const existingNames = new Set((existing ?? []).map((row: any) => String(row.name).toLowerCase()));

      const newConcepts = subtopics
      .filter(subtopic => !existingNames.has(String(subtopic).toLowerCase()))
      .map(subtopic => ({
        user_id: userId,
        subject: subject,
        chapter: chapter,
        name: subtopic,
        mastery: 'not_started',
        confidence: 'low',
        // Depending on DB schema, there might not be a parent_id, so we just group by chapter
      }));

      if (newConcepts.length === 0) {
        logger.info('Concept expansion idempotency hit; no new subtopics to insert', { userId, subject, chapter });
        return;
      }

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
