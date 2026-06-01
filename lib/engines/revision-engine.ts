import { createEmptyCard, fsrs, Rating, State, type Card as FSRSCard } from 'ts-fsrs';
import { createHash } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateJSON } from '@/lib/ai/provider-client';
import { retrieveRagContext } from '@/lib/rag/retrieval';
import { FlashcardBatchSchema } from './memory-schemas';
import { logger } from '@/lib/utils/logger';
import { invalidateSessionCards } from '@/lib/services/session-card-cache';
import { resolveConcept } from '@/lib/engines/concept-resolver';
import { recordMasteryEvidence } from '@/lib/engines/mastery-updater';
import { EventDispatcher } from '@/lib/events/orchestrator';
import { isVerifiedAutopsyMistake } from '@/lib/events/autopsy-evidence';
import { recordAgentAction } from '@/lib/agents/agent-runtime';

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

export async function getDueCards(userId: string, limit: number = 75) {
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
  await supabase.from('revision_logs').insert({
    user_id: row.user_id,
    card_id: cardId,
    rating,
    elapsed_days: Math.round(elapsedDays),
    scheduled_days: Math.max(interval, 1),
    state: newStateInt,
    response_time_ms: responseTimeMs,
  });

  // 5. Sync Ecosystem: Update parent Concept Mastery & Streak
  if (row.concept_id) {
    await supabase.from('concepts').update({
      last_reviewed_at: now.toISOString(),
      times_reviewed: row.reps + 1,
    }).eq('id', row.concept_id).eq('user_id', row.user_id);

    await recordMasteryEvidence({
      userId: row.user_id,
      conceptId: row.concept_id,
      evidenceType: ratingStr === 'again'
        ? 'revision_again'
        : ratingStr === 'hard'
          ? 'revision_hard'
          : ratingStr === 'easy'
            ? 'revision_easy'
            : 'revision_good',
      source: 'card_review',
      sourceId: `${cardId}:${now.toISOString()}`,
      evidence: `Revision card reviewed as ${ratingStr}`,
    });

    // 5b. Loop-Breaker: Repeated Failures (> 3 lapses)
    if (newLapses > 3 && rating === 1) {
      try {
        const { data: concept } = await supabase.from('concepts').select('subject, chapter').eq('id', row.concept_id).single();
        if (concept) {
          // Suspend card or flag it (using 4 for suspended)
          await supabase.from('revision_cards').update({ state: 4 }).eq('id', cardId);
          
          // Inject a deep review task for tomorrow's session-card selector
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
          await invalidateSessionCards(row.user_id, supabase, 'revision_repeated_failure_task_created');
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
    .select('id, metrics').eq('user_id', row.user_id).eq('snapshot_date', today).single();

  const isCorrect = rating > 1; // 2, 3, 4 count as correct recall
  
  if (snapshot) {
    const metrics = snapshot.metrics || {};
    await supabase.from('performance_snapshots').update({
      metrics: {
        ...metrics,
        questions_attempted: (metrics.questions_attempted || 0) + 1,
        questions_correct: (metrics.questions_correct || 0) + (isCorrect ? 1 : 0),
        concepts_revised: (metrics.questions_attempted || 0) + 1,
      }
    }).eq('id', snapshot.id);
  } else {
    await supabase.from('performance_snapshots').insert({
      user_id: row.user_id,
      snapshot_date: today,
      metrics: {
        questions_attempted: 1,
        questions_correct: isCorrect ? 1 : 0,
        concepts_revised: 1,
      }
    });
  }

  logger.info(`Card Reviewed`, { cardId, rating, newState: newStateInt, newDue: nextDueAt });

  await EventDispatcher.publish({
    user_id: row.user_id,
    type: 'MEMORY_CARD_REVIEWED',
    data: {
      cardId,
      conceptId: row.concept_id ?? null,
      rating: ratingStr,
      responseTimeMs: responseTimeMs ?? null,
    },
    metadata: { source: 'revision_engine' },
    idempotency_key: `card_review:${cardId}:${now.toISOString()}`,
  }).catch(err => logger.warn('Failed to publish MEMORY_CARD_REVIEWED', err));

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
  const ragResult = await retrieveRagContext({
    userId,
    query: searchQuery,
    subject,
    chapter,
    topK: 4
  });
  const relevantChunks = ragResult.chunks;
  
  const ragContext = relevantChunks.length > 0 
    ? `SOURCE MATERIAL:\n${relevantChunks.map((c: any) => c.text).join('\n\n')}`
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

  await invalidateSessionCards(userId, supabase, 'revision_cards_generated').catch(err =>
    logger.warn('Failed to invalidate session cards after generated cards', err)
  );
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
    await invalidateSessionCards(userId, supabase, 'mistake_revision_card_created').catch(err =>
      logger.warn('Failed to invalidate session cards after mistake card', err)
    );
    logger.info('Auto-generated card from mistake', { chapter });
  }
}

export async function createSingleCard(
  userId: string,
  conceptId: string | null,
  front: string,
  back: string,
  subject: string,
  chapter: string,
  client?: Awaited<ReturnType<typeof createClient>>,
  source?: {
    sourceType: string;
    sourceId: string;
    verified?: boolean;
    confidence?: number;
    originEventId?: string | null;
  }
) {
  const supabase = client ?? (await createClient());
  const emptyCard = createEmptyCard();
  const normalizedFront = front.trim();
  const normalizedBack = back.trim();
  const normalizedFrontKey = normalizeCardText(normalizedFront);
  const normalizedKey = createHash('sha256')
    .update([
      userId,
      conceptId ?? 'no-concept',
      source?.sourceType ?? 'manual',
      source?.sourceId ?? 'no-source',
      normalizedFrontKey,
    ].join('\n'))
    .digest('hex');
  const sourceHash = source
    ? createHash('sha256').update(`${normalizedFront}\n---\n${normalizedBack}`).digest('hex')
    : null;

  if (!isSpecificRevisionCard(normalizedFront, normalizedBack)) {
    logger.warn('Rejected low-specificity revision card', { userId, subject, chapter, sourceType: source?.sourceType });
    return null;
  }

  const { data: duplicate } = await supabase
    .from('revision_cards')
    .select('id')
    .eq('user_id', userId)
    .eq('normalized_key', normalizedKey)
    .maybeSingle();

  if (duplicate?.id) {
    logger.info('Revision card dedupe skip', {
      userId,
      conceptId,
      sourceType: source?.sourceType,
      sourceId: source?.sourceId,
    });
    return duplicate;
  }
  
  const { data, error } = await supabase.from('revision_cards').insert({
    user_id: userId,
    concept_id: conceptId,
    front: `[Tutor Gap] ${normalizedFront}`, // Tag it so the student knows where it came from
    back: normalizedBack,
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
    source_type: source?.sourceType ?? null,
    source_id: source?.sourceId ?? null,
    source_hash: sourceHash,
    normalized_key: normalizedKey,
    verified: source?.verified ?? false,
    confidence: source?.confidence ?? null,
    origin_event_id: source?.originEventId ?? null,
  }).select().single();
  
  if (error) {
    if ((error as any).code === '23505') return null;
    logger.error('Failed to create single flashcard from tutor session', error);
    return null; // Don't crash the tutor session if card creation fails
  }
  
  await invalidateSessionCards(userId, supabase, 'revision_card_created').catch(err =>
    logger.warn('Failed to invalidate session cards after single card', err)
  );

  await recordAgentAction({
    userId,
    agentName: 'memory',
    actionType: 'memory_card_created',
    targetType: 'revision_card',
    targetId: data.id,
    status: 'applied',
    confidence: source?.confidence ?? 1.0,
    evidence: { subject, chapter, front: normalizedFront, sourceType: source?.sourceType },
    idempotencyKey: `memory_card_creation:${userId}:${data.id}`,
  }, { client: supabase as any }).catch(err => logger.warn('Failed to record MEMORY card action', err));

  return data;
}

function normalizeCardText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function isSpecificRevisionCard(front: string, back: string): boolean {
  const normalizedFront = front.trim();
  const normalizedBack = back.trim();
  if (normalizedFront.length < 12 || normalizedBack.length < 8) return false;
  if (/what are the key concepts in/i.test(normalizedFront)) return false;
  if (/review your notes/i.test(normalizedBack)) return false;
  return /[?]|define|explain|why|how|calculate|derive|state|differentiate/i.test(normalizedFront);
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
  static async handleAutopsyProcessed(userId: string, metadata: any): Promise<void> {
    const wrongQuestions: Array<{
      subject: string;
      chapter: string;
      mistakeCategory: string | null;
      reasoning: string | null;
      correctExplanation: string | null;
      conceptualGap: string | null;
      status?: string;
      extractionConfidence?: number;
      extraction_confidence?: number;
      needsReview?: boolean;
      needs_review?: boolean;
      sourceQuestionId?: string;
      source_question_id?: string;
      trace_id?: string;
    }> = metadata?.wrongQuestions || [];

    if (wrongQuestions.length === 0) return;

    // Only create cards for conceptual gaps — not for silly mistakes or time pressure
    const cardWorthy = new Set([
      'conceptual_gap', 'calculation_error', 'incomplete_knowledge',
      'overconfidence', 'recall_failure',
    ]);

    const supabase = createAdminClient();
    let created = 0;

    for (const q of wrongQuestions) {
      if (!isVerifiedAutopsyMistake(q)) continue;
      if (!q.mistakeCategory || !cardWorthy.has(q.mistakeCategory)) continue;
      if (!q.reasoning && !q.correctExplanation && !q.conceptualGap) continue;

      const fallbackExplanation = q.correctExplanation || q.reasoning || q.conceptualGap || 'Review this concept carefully.';

      try {
        const resolution = await resolveConcept({
          userId,
          subject: q.subject,
          chapter: q.chapter,
          topic: q.conceptualGap || q.chapter,
          sourceType: 'autopsy',
          confidence: 0.8,
          client: supabase,
        });

        await createSingleCard(
          userId,
          resolution.conceptId,
          `Explain: ${q.conceptualGap || q.reasoning || 'this mistake'}`, // front of card = the specific gap
          fallbackExplanation,                       // back of card = correct explanation
          q.subject,
          q.chapter,
          supabase as any,
          {
            sourceType: 'autopsy_mistake',
            sourceId: String(q.sourceQuestionId ?? q.source_question_id ?? `${metadata?.autopsyId ?? 'autopsy'}:${q.subject}:${q.chapter}:${q.reasoning}`),
            verified: true,
            confidence: Number(q.extractionConfidence ?? q.extraction_confidence ?? 100),
            originEventId: metadata?.eventId ?? null,
          }
        );

        created++;
      } catch (err) {
        logger.warn('MemoryConsumer: failed to create card for wrong question', { q, err });
      }
    }

    if (created > 0) {
      await invalidateSessionCards(userId, supabase);
    }

    logger.info(`MemoryConsumer: created ${created} flashcards from autopsy mistakes`, { userId });
  }

  static async handleStudySessionCompleted(userId: string, data: any): Promise<void> {
    const { subject, chapter, durationMinutes = 0, sessionType, isSessionComplete, history, latestMessage, latestResponse, intent, understood, gapFound, sessionId } = data || {};

    if (!subject || !chapter || durationMinutes < 10) return;

    try {
      const supabase = createAdminClient();
      const resolution = await resolveConcept({
        userId,
        subject,
        chapter,
        topic: chapter,
        sourceType: 'session',
        confidence: 0.94,
        client: supabase,
      });

      let created = 0;

      if (sessionType !== 'chat' && isSessionComplete && understood === false && gapFound) {
        const card = await createSingleCard(
          userId,
          resolution.conceptId,
          `Explain this gap from ${chapter}: ${gapFound}`,
          `Correct the misconception and practice one targeted example for ${gapFound}.`,
          subject,
          chapter,
          supabase as any,
          {
            sourceType: 'session_gap',
            sourceId: String(sessionId ?? `${subject}:${chapter}:${gapFound}`),
            verified: true,
            confidence: 0.8,
            originEventId: data?.eventId ?? null,
          }
        );
        if (card) created++;
      }

      // If chat session, run the async analysis to generate specific cards from gaps
      if (sessionType === 'chat' && isSessionComplete && history && latestResponse) {
        const historySnippet = history.map((m: any) => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content.slice(0, 200)}`).join('\n');
        const isPractice = intent === 'PRACTICE';
        const analysisPrompt = isPractice
          ? `Analyze this practice interaction.\n${historySnippet}\nStudent Answer: ${latestMessage}\nAI Feedback: ${latestResponse.slice(0, 800)}\n\nDid the student answer correctly? Respond ONLY as JSON:\n{"summary":"1 sentence","understood":true,"gapFound":"flashcard question or null","gapAnswer":"flashcard answer or null"}`
          : `Analyze this tutor exchange.\n${historySnippet}\nStudent: ${latestMessage}\nTutor: ${latestResponse.slice(0, 800)}\n\nRespond ONLY as JSON:\n{"summary":"1 sentence","understood":true,"gapFound":"flashcard question or null","gapAnswer":"flashcard answer or null"}`;
        
        const { generateJSON } = await import('@/lib/ai/provider-client');
        const raw = await generateJSON<any>('flash', 'Expert analyzer. Return JSON only.', analysisPrompt);
        
        if (raw && !raw.understood && raw.gapFound && raw.gapAnswer) {
          const card = await createSingleCard(
            userId,
            resolution.conceptId,
            raw.gapFound,
            raw.gapAnswer,
            subject,
            chapter,
            supabase as any,
            {
              sourceType: 'tutor_gap',
              sourceId: String(sessionId ?? `${subject}:${chapter}:${raw.gapFound}`),
              verified: true,
              confidence: 0.75,
              originEventId: data?.eventId ?? null,
            }
          );
          if (card) created++;
          logger.info(`MemoryConsumer: created specific gap card for ${chapter}`, { userId });
        }
      }

      if (created > 0) {
        await invalidateSessionCards(userId, supabase);
      }
    } catch (err) {
      logger.warn('MemoryConsumer: failed to create study session card', err);
    }
  }

  static async handlePracticeAttempt(userId: string, data: any): Promise<void> {
    const { items = [], setType, practiceSetId } = data || {};
    if (items.length === 0) return;

    const supabase = createAdminClient();
    let created = 0;

    for (const item of items) {
      try {
        if (setType === 'mcq' && item.isCorrect === false) {
          // Got MCQ wrong -> Add to revision cards if we can extract a gap.
          // Since we might not have the full question/answer text here, we rely on the client
          // sending the context, OR we just record that a mistake was made if context isn't available.
          // The event payload (data.items) has practiceItemId and conceptId. 
          // If the backend recorded the items in practice_items, we can fetch them.
          const { data: practiceItem } = await supabase
            .from('practice_items')
            .select('question, correct_answer, explanation, subject, chapter')
            .eq('id', item.practiceItemId)
            .single();

          if (practiceItem && practiceItem.question && practiceItem.correct_answer) {
            const card = await createSingleCard(
              userId,
              item.conceptId || null,
              `Missed MCQ: ${practiceItem.question}`,
              `Correct: ${practiceItem.correct_answer}\n\nExplanation: ${practiceItem.explanation || 'No explanation provided.'}`,
              practiceItem.subject || 'General',
              practiceItem.chapter || 'Practice',
              supabase as any,
              {
                sourceType: 'practice_mistake',
                sourceId: item.practiceItemId,
                verified: true,
                confidence: 0.9,
              }
            );
            if (card) created++;
          }
        } else if (setType === 'flashcard' && ['again', 'forgot', 'hard'].includes(item.confidence)) {
          // Struggled with a flashcard -> ensure it's in their revision deck
          const { data: practiceItem } = await supabase
            .from('practice_items')
            .select('question, correct_answer, explanation, subject, chapter')
            .eq('id', item.practiceItemId)
            .single();

          if (practiceItem && practiceItem.question && practiceItem.correct_answer) {
            const card = await createSingleCard(
              userId,
              item.conceptId || null,
              practiceItem.question,
              practiceItem.correct_answer,
              practiceItem.subject || 'General',
              practiceItem.chapter || 'Practice',
              supabase as any,
              {
                sourceType: 'practice_flashcard',
                sourceId: item.practiceItemId,
                verified: true,
                confidence: 0.9,
              }
            );
            if (card) created++;
          }
        }
      } catch (err) {
        logger.warn('MemoryConsumer: failed to process practice item for memory', { item, err });
      }
    }

    if (created > 0) {
      await invalidateSessionCards(userId, supabase);
      logger.info(`MemoryConsumer: created ${created} flashcards from practice attempt`, { userId, setType, practiceSetId });
    }
  }
}
