import { createClient } from '@/lib/supabase/server';
import { updateConceptState } from './cognition-graph';
import { createCardFromMistake } from './revision-engine';
import { resolveConceptByName } from './concept-resolver';
import { logger } from '@/lib/utils/logger';

interface AutopsyQuestion {
  questionNumber: number;
  subject: string;
  chapter: string;
  status: 'Correct' | 'Incorrect' | 'Unattempted';
  mistakeCategory?: string | null;
  questionText?: string | null;
  correctAnswer?: string | null;
  reasoning?: string | null;
  marksLost: number;
}

/**
 * THE CORE PIPELINE: After autopsy processes a mock test,
 * wire every mistake to ATLAS (downscale mastery) and MEMORY (create review card).
 * This is what makes Cognition OS an OS rather than a collection of tools.
 */
export async function runAutopsyPipeline(userId: string, questions: AutopsyQuestion[], testName?: string): Promise<void> {
  const incorrectQuestions = questions.filter(q => q.status === 'Incorrect');

  // Process each mistake: ATLAS downscale + MEMORY card
  const pipeline = incorrectQuestions.map(async (q) => {
    try {
      // 1. Resolve concept in ATLAS (fuzzy match by subject + chapter)
      const conceptId = await resolveConceptByName(userId, q.subject, q.chapter);

      if (conceptId) {
        // 2. ATLAS: Downscale mastery for this concept
        await updateConceptState(conceptId, false, q.marksLost);
        logger.info('AUTOPSY → ATLAS: downscaled mastery', { conceptId, chapter: q.chapter });
      }

      // 3. MEMORY: Auto-create flashcard from the mistake
      // Use the question itself as the front, correct answer as the back
      const questionDesc = q.questionText || (testName ? `Question #${q.questionNumber} from "${testName}"` : `Question #${q.questionNumber}`);
      const reasoning = q.reasoning || 'Review the core concept for this topic.';
      const correctAnswer = q.correctAnswer || 'Not recorded';

      await createCardFromMistake(
        userId,
        conceptId, // can be null
        q.subject,
        q.chapter,
        questionDesc,
        correctAnswer,
        reasoning
      );

      logger.info('AUTOPSY → MEMORY: created mistake recovery card', { chapter: q.chapter, category: q.mistakeCategory });
    } catch (err) {
      logger.error('Autopsy pipeline failed for question', { chapter: q.chapter, err });
      // Non-blocking — process the rest
    }
  });

  // Run all concurrently, but cap to avoid overwhelming DB
  const batchSize = 5;
  for (let i = 0; i < pipeline.length; i += batchSize) {
    await Promise.all(pipeline.slice(i, i + batchSize));
  }

  logger.info('AUTOPSY PIPELINE COMPLETE', {
    totalMistakes: incorrectQuestions.length,
    userId
  });
}
