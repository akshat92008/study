import { createEmptyCard, fsrs, Rating, State, type Card as FSRSCard } from 'ts-fsrs';
import { createClient } from '@/lib/supabase/server';
import { generateJSON } from '@/lib/ai/gemini';
import { searchPersonalKnowledge } from './rag-engine';
import { FlashcardBatchSchema } from './memory-schemas';
import { logger } from '@/lib/utils/logger';

// Custom FSRS-5 Configuration and Implementation
const FSRS_WEIGHTS = [
  0.4072, 1.1829, 3.1262, 15.4722, 7.2102, 0.5316, 1.0651, 0.0589,
  1.4543, 0.1534, 1.0038, 1.9510, 0.1100, 0.2900, 2.2700, 0.1600,
  2.9898
];

export type CustomFSRSRating = 'again' | 'hard' | 'good' | 'easy';
const CUSTOM_RATING_MAP: Record<CustomFSRSRating, number> = { again: 1, hard: 2, good: 3, easy: 4 };

export interface CustomFSRSCard {
  stability: number;
  difficulty: number;
  retrievability: number;
  reps: number;
  lapses: number;
  lastReview: Date | null;
  state: 'new' | 'learning' | 'review' | 'relearning';
}

export function computeNextReview(
  card: CustomFSRSCard,
  rating: CustomFSRSRating,
  requestRetention: number = 0.9
): { nextDueAt: Date; newStability: number; newDifficulty: number } {
  const r = CUSTOM_RATING_MAP[rating];
  const w = FSRS_WEIGHTS;
  
  let stability = card.stability;
  let difficulty = card.difficulty;

  if (card.state === 'new') {
    // Initial stability based on rating
    stability = w[r - 1];
    difficulty = w[4] - w[5] * (r - 3);
    difficulty = Math.min(Math.max(difficulty, 1), 10);
  } else {
    // Recall stability update
    const retrievability = card.retrievability;
    
    if (rating === 'again') {
      // Forgetting — reduce stability
      stability = w[11] * Math.pow(difficulty, -w[12]) 
        * (Math.pow(stability + 1, w[13]) - 1) 
        * Math.exp((1 - retrievability) * w[14]);
    } else {
      // Recall — increase stability
      const hardPenalty = rating === 'hard' ? w[15] : 1;
      const easyBonus = rating === 'easy' ? w[16] : 1;
      
      stability = stability * (
        Math.exp(w[8]) 
        * (11 - difficulty) 
        * Math.pow(stability, -w[9]) 
        * (Math.exp((1 - retrievability) * w[10]) - 1) 
        * hardPenalty 
        * easyBonus + 1
      );
    }

    // Difficulty update
    const nextDifficulty = difficulty - w[6] * (r - 3);
    const diffDelta = nextDifficulty - difficulty;
    difficulty = difficulty + diffDelta * (10 - difficulty) / 9;
    difficulty = Math.min(Math.max(difficulty, 1), 10);
  }

  // Compute interval from stability
  const interval = Math.round(
    (stability / 9) * (Math.pow(requestRetention, 1 / -0.5) - 1)
  );

  const nextDueAt = new Date(Date.now() + Math.max(interval, 1) * 86400000);

  return { nextDueAt, newStability: stability, newDifficulty: difficulty };
}

export async function getDueCards(userId: string, limit: number = 75, pulseState: string = 'neutral') {
  const supabase = await createClient();
  const now = new Date().toISOString();

  // HARD CAP: Default to 75 cards max (~15-25 minutes per day).
  // Prioritize Overdue Recovery: 
  // Oldest due date first, then highest difficulty to rescue at-risk memories, 
  // then lowest stability (weakness reinforcement).
  
  let query = supabase
    .from('revision_cards')
    .select('*')
    .eq('user_id', userId)
    .lte('due', now);

  // PULSE Intervention: Throttle new cognitive load if overwhelmed/frustrated
  if (pulseState === 'overwhelmed' || pulseState === 'frustrated') {
    query = query.neq('state', State.New);
  }

  const { data } = await query
    .order('due', { ascending: true })
    .order('difficulty', { ascending: false })
    .order('stability', { ascending: true })
    .limit(limit);

  return data || [];
}

export async function getRevisionStats(userId: string) {
  const supabase = await createClient();

  const { data: cards } = await supabase.from('revision_cards').select('due, state, stability').eq('user_id', userId);
  if (!cards) return { total: 0, due: 0, new: 0, learning: 0, mature: 0, averageRetention: 0 };

  const due = cards.filter(c => new Date(c.due) <= new Date());
  const newCards = cards.filter(c => c.state === State.New);
  const learning = cards.filter(c => c.state === State.Learning || c.state === State.Relearning);
  const mature = cards.filter(c => c.state === State.Review && c.stability > 21);

  return {
    total: cards.length,
    due: due.length,
    new: newCards.length,
    learning: learning.length,
    mature: mature.length,
    averageRetention: cards.length > 0 ? 90 : 0, // FSRS targets 90% dynamically
  };
}

export async function reviewCard(cardId: string, rating: 1 | 2 | 3 | 4, responseTimeMs?: number) {
  const supabase = await createClient();
  
  // 1. Fetch Card
  const { data: row } = await supabase.from('revision_cards').select('*').eq('id', cardId).single();
  if (!row) throw new Error('Card not found');

  const now = new Date();

  // Mapping rating integer to CustomFSRSRating string
  const ratingStrMap: Record<1 | 2 | 3 | 4, CustomFSRSRating> = {
    1: 'again',
    2: 'hard',
    3: 'good',
    4: 'easy',
  };
  const ratingStr = ratingStrMap[rating];

  // Mapping state integer to state string
  const stateIntMap: Record<number, 'new' | 'learning' | 'review' | 'relearning'> = {
    0: 'new',
    1: 'learning',
    2: 'review',
    3: 'relearning',
  };
  const stateStrMap: Record<'new' | 'learning' | 'review' | 'relearning', number> = {
    new: 0,
    learning: 1,
    review: 2,
    relearning: 3,
  };

  const lastReviewDate = row.last_review ? new Date(row.last_review) : null;
  const lastReviewTime = lastReviewDate ? lastReviewDate.getTime() : new Date(row.created_at || Date.now()).getTime();
  const elapsedDays = (Date.now() - lastReviewTime) / 86400000;
  const retrievability = row.stability > 0 ? Math.exp(Math.log(0.9) * elapsedDays / row.stability) : 1.0;

  const fsrsCard: CustomFSRSCard = {
    stability: row.stability || 1,
    difficulty: row.difficulty || 5,
    retrievability: retrievability,
    reps: row.reps || 0,
    lapses: row.lapses || 0,
    lastReview: lastReviewDate,
    state: stateIntMap[row.state as number] || 'new',
  };

  // 2. Execute FSRS-5 Math using custom function
  const { nextDueAt, newStability, newDifficulty } = computeNextReview(fsrsCard, ratingStr);

  const newReps = ratingStr === 'again' ? 0 : (row.reps || 0) + 1;
  const newLapses = ratingStr === 'again' ? (row.lapses || 0) + 1 : (row.lapses || 0);
  
  const newStateStr = ratingStr === 'again' ? 'relearning' : 'review';
  const newStateInt = stateStrMap[newStateStr];
  const interval = Math.round((newStability / 9) * (Math.pow(0.9, 1 / -0.5) - 1));

  // 3. Update Card DB
  await supabase.from('revision_cards').update({
    due: nextDueAt.toISOString(),
    stability: newStability,
    difficulty: newDifficulty,
    elapsed_days: Math.round(elapsedDays),
    scheduled_days: Math.max(interval, 1),
    reps: newReps,
    lapses: newLapses,
    state: newStateInt,
    last_review: now.toISOString(),
  }).eq('id', cardId);

  // 4. Log Review Telemetry
  await supabase.from('review_logs').insert({
    user_id: row.user_id,
    card_id: cardId,
    rating,
    elapsed_days: Math.round(elapsedDays),
    scheduled_days: Math.max(interval, 1),
    state: newStateInt,
    response_time_ms: responseTimeMs,
  });

  // Log PULSE friction signal if response time degrades significantly (> 15s)
  if (responseTimeMs && responseTimeMs > 15000) {
    try {
      await supabase.from('pulse_signals').insert({
        user_id: row.user_id,
        signal_type: 'performance_trend',
        emotional_state: 'frustrated',
        confidence: 0.7,
        notes: `Slow revision response time: ${responseTimeMs}ms`,
      });
    } catch (e) {
      logger.error('Failed to log slow response time pulse signal', e);
    }
  }

  // 5. Sync Ecosystem: Update parent Concept Mastery & Streak
  if (row.concept_id) {
    let newMastery = 'developing';
    if (newStateStr === 'review') {
      if (newStability > 21) newMastery = 'automated';
      else if (newStability > 7) newMastery = 'mastered';
      else newMastery = 'proficient';
    }

    await supabase.from('concepts').update({
      mastery: newMastery,
      last_reviewed_at: now.toISOString(),
      times_reviewed: row.reps + 1,
    }).eq('id', row.concept_id);

    // 5b. Loop-Breaker: Repeated Failures (> 3 lapses)
    if (newLapses > 3 && rating === 1) {
      try {
        const { data: concept } = await supabase.from('concepts').select('subject, chapter').eq('id', row.concept_id).single();
        if (concept) {
          // Suspend card or flag it (using 4 for suspended)
          await supabase.from('revision_cards').update({ state: 4 }).eq('id', cardId);
          
          // Inject deep review task into COMMAND planner
          const d = new Date();
          d.setDate(d.getDate() + 1); // schedule for tomorrow
          await supabase.from('study_tasks').insert({
            user_id: row.user_id,
            title: `[Deep Review Required] Repeated failures on ${concept.chapter}. Trigger MIND Tutor session.`,
            scheduled_date: d.toISOString(),
            estimated_minutes: 30,
            priority: 'critical',
            type: 'revision',
            subject: concept.subject,
            chapter: concept.chapter,
            is_completed: false
          });
          logger.info('Repeated failure loop-breaker triggered. Card suspended, MIND session scheduled.', { cardId, concept_id: row.concept_id });
        }
      } catch (e) {
        logger.error('Failed to trigger repeated failure loop-breaker', e);
      }
    }
  }

  // 6. Update Daily Performance Telemetry (Accuracy tracking)
  const today = now.toISOString().split('T')[0];
  const { data: snapshot } = await supabase.from('performance_snapshots')
    .select('id, questions_attempted, questions_correct').eq('user_id', row.user_id).eq('date', today).single();

  const isCorrect = rating > 1; // 2, 3, 4 count as correct recall
  
  if (snapshot) {
    await supabase.from('performance_snapshots').update({
      questions_attempted: snapshot.questions_attempted + 1,
      questions_correct: snapshot.questions_correct + (isCorrect ? 1 : 0),
      concepts_revised: snapshot.questions_attempted + 1, // rough mapping
    }).eq('id', snapshot.id);
  } else {
    await supabase.from('performance_snapshots').insert({
      user_id: row.user_id,
      date: today,
      questions_attempted: 1,
      questions_correct: isCorrect ? 1 : 0,
      concepts_revised: 1,
    });
  }

  logger.info(`Card Reviewed`, { cardId, rating, newState: newStateInt, newDue: nextDueAt });

  return { nextDue: nextDueAt, scheduledDays: Math.max(interval, 1) };
}

export type RatingString = 'again' | 'hard' | 'good' | 'easy';

export async function processCardReview(
  userId: string,
  cardId: string, 
  rating: RatingString
): Promise<void> {
  const ratingIntMap: Record<RatingString, 1 | 2 | 3 | 4> = {
    again: 1,
    hard: 2,
    good: 3,
    easy: 4,
  };
  await reviewCard(cardId, ratingIntMap[rating]);
}

// RAG-Driven Auto Card Generation
export async function generateCardsForConcept(
  userId: string, 
  conceptId: string, 
  subject: string, 
  chapter: string, 
  maxCards: number = 5 // Added dynamic limit parameter
) {
  const supabase = await createClient();
  
  // 1. Fetch Context from Student's Uploaded Materials via RAG
  const searchQuery = `${subject} ${chapter} core concepts and formulas`;
  const relevantChunks = await searchPersonalKnowledge(userId, searchQuery, 0.4, 4);
  
  const ragContext = relevantChunks.length > 0 
    ? `SOURCE MATERIAL:\n${relevantChunks.map((c: any) => c.chunk_text).join('\n\n')}`
    : `*No personal materials uploaded. Use general expert knowledge for ${subject}: ${chapter}.*`;

  // 2. Strict Prompting
  const prompt = `
    You are an elite automated flashcard extraction engine.
    Extract exactly ${maxCards} high-yield flashcards for the chapter: "${chapter}" (${subject}).
    
    CRITICAL INSTRUCTIONS:
    - Base the questions strictly on the SOURCE MATERIAL provided below if available.
    - If no source material is provided, use your expert knowledge.
    - Mix question types: Definitions, Formulas/Application, and Conceptual.
    - Keep answers concise and direct.
    - Format mathematical equations using LaTeX inside $...$ or $$...$$.
    
    ${ragContext}
  `;

  // 3. Generate with Zod Schema & Retries
  const result = await generateJSON('pro', 'You are an expert curriculum extraction engine.', prompt, FlashcardBatchSchema);

  if (!result || !result.cards || result.cards.length === 0) {
    logger.error('Failed to generate cards', { conceptId });
    throw new Error('AI failed to generate valid flashcards. Please try again.');
  }

  // 4. Inject into FSRS DB
  const emptyCard = createEmptyCard();
  
  const rows = result.cards.slice(0, maxCards).map((c: { front: string; back: string }) => ({
    user_id: userId,
    concept_id: conceptId,
    front: c.front,
    back: c.back,
    subject,
    chapter,
    due: emptyCard.due.toISOString(),
    stability: emptyCard.stability,
    difficulty: emptyCard.difficulty,
    elapsed_days: emptyCard.elapsed_days,
    scheduled_days: emptyCard.scheduled_days,
    reps: emptyCard.reps,
    lapses: emptyCard.lapses,
    state: emptyCard.state,
  }));

  const { data, error } = await supabase.from('revision_cards').insert(rows).select();
  if (error) throw new Error('Failed to save generated cards to database.');

  logger.info(`Auto-generated ${rows.length} cards via RAG`, { conceptId });
  return data;
}

export async function createCardFromMistake(
  userId: string,
  conceptId: string | null,
  subject: string,
  chapter: string,
  question: string,
  correctAnswer: string,
  reasoning: string
) {
  const supabase = await createClient();
  const emptyCard = createEmptyCard();
  
  const { error } = await supabase.from('revision_cards').insert({
    user_id: userId,
    concept_id: conceptId,
    front: `[Mistake Recovery]\n${question}`,
    back: `Correct: ${correctAnswer}\n\nWhy you got it wrong: ${reasoning}`,
    subject,
    chapter,
    due: emptyCard.due.toISOString(),
    stability: emptyCard.stability,
    difficulty: emptyCard.difficulty,
    elapsed_days: emptyCard.elapsed_days,
    scheduled_days: emptyCard.scheduled_days,
    reps: emptyCard.reps,
    lapses: emptyCard.lapses,
    state: emptyCard.state,
  });

  if (error) {
    logger.error('Failed to create flashcard from mistake', { error: error.message });
  } else {
    logger.info('Auto-generated card from mistake', { chapter });
  }
}

export async function createSingleCard(
  userId: string,
  conceptId: string | null,
  front: string,
  back: string,
  subject: string,
  chapter: string
) {
  const supabase = await createClient();
  const emptyCard = createEmptyCard();
  
  const { data, error } = await supabase.from('revision_cards').insert({
    user_id: userId,
    concept_id: conceptId,
    front: `[Tutor Gap] ${front}`, // Tag it so the student knows where it came from
    back,
    subject,
    chapter,
    due: emptyCard.due.toISOString(),
    stability: emptyCard.stability,
    difficulty: emptyCard.difficulty + 0.2, // Slight difficulty bump for tutor-identified gaps
    elapsed_days: emptyCard.elapsed_days,
    scheduled_days: emptyCard.scheduled_days,
    reps: emptyCard.reps,
    lapses: emptyCard.lapses,
    state: emptyCard.state,
  }).select().single();
  
  if (error) {
    logger.error('Failed to create single flashcard from tutor session', error);
    return null; // Don't crash the tutor session if card creation fails
  }
  
  return data;
}

// Exam Mode (Cramming) - Bypasses FSRS due dates
export async function getExamModeCards(userId: string, subject: string, limit: number = 100) {
  const supabase = await createClient();

  // Pulls all cards for a specific subject, prioritizing the weakest (lowest stability)
  const { data } = await supabase
    .from('revision_cards')
    .select('*')
    .eq('user_id', userId)
    .ilike('subject', `%${subject}%`)
    .neq('state', 4) // Exclude suspended cards (state = 4)
    .order('stability', { ascending: true }) // Weakest memories first
    .limit(limit);

  return data || [];
}

// ------------------------------------------------------------------
// CONSUMERS
// ------------------------------------------------------------------
export class MemoryConsumer {
  static async handleAutopsyProcessed(userId: string, metadata: any) {
    const autopsyId = metadata?.autopsyId || metadata?.mockId;
    if (!autopsyId) return;

    const supabase = await createClient();
    const { data: questions } = await supabase
      .from('autopsy_questions')
      .select('subject, chapter, question_number, correct_answer, student_answer, mistake_category, suggested_fix')
      .eq('autopsy_id', autopsyId)
      .eq('status', 'Incorrect');

    if (!questions || questions.length === 0) return;
    
    // Lazy load concept resolver to avoid circular dependency
    const { resolveConceptByName } = await import('./concept-resolver');

    // Run concurrently with a batch limit
    const batchSize = 5;
    for (let i = 0; i < questions.length; i += batchSize) {
      const batch = questions.slice(i, i + batchSize);
      await Promise.all(batch.map(async (q: any) => {
        try {
          const conceptId = await resolveConceptByName(userId, q.subject, q.chapter);
          
          const testName = metadata.testName || metadata.test_name;
          const questionDesc = `[Mistake from ${testName || 'mock test'}] Q${q.question_number}: ${q.chapter}`;
          const reasoning = q.suggested_fix || 'Review the core concept for this topic.';
          const correctAnswer = q.correct_answer || 'Not recorded';

          await createCardFromMistake(
            userId,
            conceptId, // can be null
            q.subject,
            q.chapter,
            questionDesc,
            correctAnswer,
            reasoning
          );
        } catch (err) {
          logger.error('MEMORY: Failed to map and create card from autopsy', err);
        }
      }));
    }
  }
}
