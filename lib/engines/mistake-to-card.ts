import { createEmptyCard } from 'ts-fsrs';
import { createClient } from '@/lib/supabase/server';
import { resolveConceptByName } from '@/lib/engines/concept-resolver';
import { logger } from '@/lib/utils/logger';

/**
 * Batch pipeline: Convert all incorrect questions from an autopsy into FSRS revision cards.
 * Boosts initial difficulty by +0.5 so mistake cards surface more aggressively in the queue.
 */
export async function createCardsFromAutopsyMistakes(userId: string, autopsyId: string) {
  const supabase = await createClient();

  // Fetch all incorrect questions from this autopsy
  const { data: questions } = await supabase
    .from('autopsy_questions')
    .select('*')
    .eq('autopsy_id', autopsyId)
    .eq('status', 'Incorrect');

  if (!questions || questions.length === 0) return 0;

  const emptyCard = createEmptyCard();
  const cards = [];

  for (const q of questions) {
    // Resolve concept ID for cross-module linking (ATLAS -> MEMORY)
    const conceptId = await resolveConceptByName(userId, q.subject, q.chapter || '');

    cards.push({
      user_id: userId,
      concept_id: conceptId, // Links card to Atlas Graph
      front: `[Mock Recovery] Q${q.question_number}: ${q.subject} > ${q.chapter || 'General'}\n\n**Mistake type:** ${q.mistake_category?.replace('_', ' ') || 'Unknown'}`,
      back: `**Correct Answer:** ${q.correct_answer || 'Review source material'}\n\n**Why you got it wrong:** ${q.suggested_fix || 'Review the underlying concept.'}`,
      subject: q.subject,
      chapter: q.chapter || 'General',
      due: emptyCard.due.toISOString(),
      stability: emptyCard.stability,
      difficulty: Math.min(10, emptyCard.difficulty + 0.5), // Boost difficulty for mistake cards
      elapsed_days: 0,
      scheduled_days: 0,
      reps: 0,
      lapses: 0,
      state: 0, // State.New
    });
  }

  // Batch insert in chunks of 50 to avoid Supabase payload limits
  for (let i = 0; i < cards.length; i += 50) {
    const { error } = await supabase.from('revision_cards').insert(cards.slice(i, i + 50));
    if (error) {
      logger.error(`Failed to insert mistake cards batch at offset ${i}`, error);
    }
  }

  logger.info(`Created ${cards.length} revision cards from autopsy mistakes`, { userId, autopsyId });
  return cards.length;
}
