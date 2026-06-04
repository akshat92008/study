// lib/hermes/adapters/cognition-db-writer.ts
// Converts Hermes agent outputs into Supabase database mutations.
//
// RULES:
// - Every function verifies user owns the goal/session before writing
// - Only writes to allowed tables
// - Always attaches goal_id and chat_session_id
// - Returns created IDs for the calling route to return to the client
// - Never allows agents to write directly to DB
//
// Supabase remains the source of truth. Hermes only computes.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { HermesMistakeInput, HermesMistakeResult, WriteMistakeResultOutput, HermesRevisionResult, HermesTraceResult, HermesNextActionResult } from '../hermes-types';
import { hermesLogger } from '../hermes-logger';

/**
 * Validates that the provided user owns the specified resources.
 * This is crucial because Hermes often runs in a worker context using an admin client.
 */
export async function assertHermesWriteScope(
  supabase: SupabaseClient,
  scope: {
    userId: string;
    goalId?: string | null;
    chatSessionId?: string | null;
    materialId?: string | null;
    mistakeId?: string | null;
    cardIds?: string[] | null;
  }
): Promise<void> {
  const { userId, goalId, chatSessionId, materialId, mistakeId, cardIds } = scope;

  if (goalId) {
    const { data } = await supabase.from('learning_goals').select('id').eq('id', goalId).eq('user_id', userId).single();
    if (!data) throw new Error(`assertHermesWriteScope: User ${userId} does not own goal ${goalId}`);
  }

  if (chatSessionId) {
    const { data } = await supabase.from('chat_sessions').select('id, goal_id, is_global').eq('id', chatSessionId).eq('user_id', userId).single();
    if (!data) throw new Error(`assertHermesWriteScope: User ${userId} does not own session ${chatSessionId}`);
    if (goalId && !data.is_global && data.goal_id !== goalId) {
      throw new Error(`assertHermesWriteScope: Session ${chatSessionId} does not belong to goal ${goalId}`);
    }
  }

  if (materialId) {
    const { data } = await supabase.from('study_materials').select('id, goal_id').eq('id', materialId).eq('user_id', userId).single();
    if (!data) throw new Error(`assertHermesWriteScope: User ${userId} does not own material ${materialId}`);
    if (goalId && data.goal_id !== goalId) {
      throw new Error(`assertHermesWriteScope: Material ${materialId} does not belong to goal ${goalId}`);
    }
  }

  if (mistakeId) {
    const { data } = await supabase.from('mistakes').select('id, goal_id').eq('id', mistakeId).eq('user_id', userId).single();
    if (!data) throw new Error(`assertHermesWriteScope: User ${userId} does not own mistake ${mistakeId}`);
    if (goalId && data.goal_id !== goalId) {
      throw new Error(`assertHermesWriteScope: Mistake ${mistakeId} does not belong to goal ${goalId}`);
    }
  }

  if (cardIds && cardIds.length > 0) {
    const { data, error } = await supabase.from('revision_cards').select('id, goal_id').in('id', cardIds).eq('user_id', userId);
    if (error || !data || data.length !== cardIds.length) {
      throw new Error(`assertHermesWriteScope: User ${userId} does not own all cards in [${cardIds.join(', ')}]`);
    }
    if (goalId) {
      const mismatched = data.find(c => c.goal_id !== goalId);
      if (mismatched) {
        throw new Error(`assertHermesWriteScope: Card ${mismatched.id} does not belong to goal ${goalId}`);
      }
    }
  }
}

/**
 * Write the full result of the Mistake Agent to Supabase.
 *
 * Creates:
 *   - concept (or reuses existing scoped to goal)
 *   - mock_autopsies record (dummy, for schema compat)
 *   - mistakes row
 *   - revision_cards rows
 *   - student_events audit entry
 *
 * @param supabase - Server-side Supabase client with user context (RLS enforced)
 */
export async function writeMistakeResult(
  supabase: SupabaseClient,
  userId: string,
  goalId: string | null | undefined,
  chatSessionId: string | null | undefined,
  mistakeInput: HermesMistakeInput,
  hermesResult: HermesMistakeResult,
  eventId?: string
): Promise<WriteMistakeResultOutput> {
  await assertHermesWriteScope(supabase, { userId, goalId, chatSessionId });

  if (eventId) {
    const { data: existing } = await supabase
      .from('mistakes')
      .select('id, concept_id')
      .eq('user_id', userId)
      .eq('metadata->>eventId', eventId)
      .maybeSingle();

    if (existing) {
      const { data: cards } = await supabase
        .from('revision_cards')
        .select('id')
        .eq('user_id', userId)
        .eq('metadata->>eventId', eventId);

      return {
        mistakeId: existing.id,
        conceptId: existing.concept_id,
        cardIds: cards ? cards.map((c: any) => c.id) : [],
        autopsyId: null,
      };
    }
  }

  // ── 1. Ensure/create concept scoped to goal ──────────────────────────────
  let conceptId: string | null = null;
  const wc = hermesResult.weakConcept;

  if (wc.subject || wc.chapter || wc.topic) {
    const subject = wc.subject || hermesResult.subject;
    const chapter = wc.chapter || hermesResult.chapter;
    const topic = wc.topic || hermesResult.topic || wc.name;

    if (subject && chapter && topic) {
      let conceptQuery = supabase
        .from('concepts')
        .select('id')
        .eq('user_id', userId)
        .eq('subject', subject)
        .eq('chapter', chapter)
        .eq('topic', topic);

      if (goalId) {
        conceptQuery = conceptQuery.eq('goal_id', goalId);
      }

      const { data: existingConcept } = await conceptQuery.maybeSingle();

      if (existingConcept) {
        conceptId = existingConcept.id;
      } else {
        const { data: newConcept, error: conceptError } = await supabase
          .from('concepts')
          .insert({
            user_id: userId,
            subject,
            chapter,
            topic,
            name: wc.name || topic,
            mastery: 'not_started',
            ...(goalId ? { goal_id: goalId } : {}),
            ...(chatSessionId ? { chat_session_id: chatSessionId } : {}),
          })
          .select('id')
          .single();

        if (conceptError) {
          hermesLogger.warn('Failed to create concept', {
            userId,
            goalId,
            error: conceptError.message,
          });
        } else if (newConcept) {
          conceptId = newConcept.id;
        }
      }
    }
  }

  // ── 2. Create mock_autopsies dummy row (schema compatibility) ────────────
  const { data: autopsy } = await supabase
    .from('mock_autopsies')
    .insert({
      user_id: userId,
      test_name: 'Manual Mistake Review',
      total_marks: 4,
      marks_obtained: -1,
      marks_lost: 5,
      status: 'completed',
      completed_at: new Date().toISOString(),
      ...(goalId ? { goal_id: goalId } : {}),
      ...(chatSessionId ? { chat_session_id: chatSessionId } : {}),
    })
    .select('id')
    .single();

  // ── 3. Create mistakes row ───────────────────────────────────────────────
  const { data: mistake, error: mistakeError } = await supabase
    .from('mistakes')
    .insert({
      user_id: userId,
      autopsy_id: autopsy?.id ?? null,
      concept_id: conceptId,
      category: hermesResult.category,
      question_text: mistakeInput.question,
      user_answer: mistakeInput.myAnswer,
      correct_answer: mistakeInput.correctAnswer,
      marks_lost: 5,
      subject: hermesResult.subject,
      chapter: hermesResult.chapter,
      metadata: {
        diagnosis: hermesResult.diagnosis,
        whyMyAnswerWasWrong: hermesResult.whyMyAnswerWasWrong,
        whyCorrectAnswerWorks: hermesResult.whyCorrectAnswerWorks,
        keyMissedClue: hermesResult.keyMissedClue,
        confidence: hermesResult.confidence,
        safetyFlags: hermesResult.safetyFlags,
        generatedByHermes: true,
        ...(eventId ? { eventId } : {}),
      },
      ...(goalId ? { goal_id: goalId } : {}),
      ...(chatSessionId ? { chat_session_id: chatSessionId } : {}),
    })
    .select('id')
    .single();

  if (mistakeError) {
    hermesLogger.error('Failed to insert mistake', mistakeError, { userId, goalId });
    throw mistakeError;
  }
  if (!mistake) {
    throw new Error('Mistake insert returned no data');
  }

  // ── 4. Create revision_cards ─────────────────────────────────────────────
  let cardIds: string[] = [];
  if (hermesResult.cards && hermesResult.cards.length > 0) {
    const cardsToInsert = hermesResult.cards.map((card) => ({
      user_id: userId,
      concept_id: conceptId,
      front: card.front,
      back: card.back,
      card_type: 'mistake',
      state: 0, // 'new'
      due: new Date().toISOString(),
      source_type: 'manual_mistake_review',
      metadata: {
        mistakeId: mistake.id,
        category: hermesResult.category,
        generated_type: card.type,
        difficulty: card.difficulty,
        question_snippet: mistakeInput.question.substring(0, 100),
        generatedByHermes: true,
        ...(eventId ? { eventId } : {}),
      },
      subject: hermesResult.subject,
      chapter: hermesResult.chapter,
      topic: hermesResult.topic,
      ...(goalId ? { goal_id: goalId } : {}),
      ...(chatSessionId ? { chat_session_id: chatSessionId } : {}),
    }));

    const { data: insertedCards, error: cardsError } = await supabase
      .from('revision_cards')
      .insert(cardsToInsert)
      .select('id');

    if (cardsError) {
      hermesLogger.warn('Failed to insert revision cards', {
        userId,
        goalId,
        error: cardsError.message,
      });
    } else if (insertedCards) {
      cardIds = insertedCards.map((c: { id: string }) => c.id);
    }
  }

  // ── 5. Emit student_events audit entry ───────────────────────────────────
  await supabase
    .from('student_events')
    .insert({
      user_id: userId,
      type: 'MISTAKE_LOGGED_MANUALLY',
      data: {
        mistakeId: mistake.id,
        goalId: goalId ?? null,
        chatSessionId: chatSessionId ?? null,
        conceptId,
        cardCount: cardIds.length,
        category: hermesResult.category,
        confidence: hermesResult.confidence,
        generatedByHermes: true,
      },
    })
    .then(({ error }: { error: any }) => {
      if (error) {
        hermesLogger.warn('Failed to insert student_events audit', {
          userId,
          error: error.message,
        });
      }
    });

  hermesLogger.info('Mistake result written to DB', {
    userId,
    goalId,
    mistakeId: mistake.id,
    conceptId,
    cardCount: cardIds.length,
  });

  return {
    autopsyId: autopsy?.id ?? null,
    mistakeId: mistake.id,
    conceptId,
    cardIds,
  };
}

/**
 * Write Hermes source agent result to Supabase.
 * Updates study_materials.metadata with extracted concepts summary.
 * Card insertion is optional and gated by config.
 */
export async function writeSourceResult(
  supabase: SupabaseClient,
  userId: string,
  materialId: string,
  goalId: string | null | undefined,
  result: import('../hermes-types').HermesSourceResult,
  insertCards = false,
  eventId?: string
): Promise<{ conceptCount: number; cardCount: number }> {
  await assertHermesWriteScope(supabase, { userId, materialId, goalId });

  // Update material metadata
  await supabase
    .from('study_materials')
    .update({
      metadata: {
        hermesSummary: result.sourceSummary,
        extractedConceptsCount: result.extractedConcepts.length,
        suggestedCardsCount: result.suggestedCards.length,
        processedByHermes: true,
        processedAt: new Date().toISOString(),
        ...(eventId ? { sourceEventId: eventId } : {}),
      },
    })
    .eq('id', materialId)
    .eq('user_id', userId);

  let cardCount = 0;

  if (insertCards && result.suggestedCards.length > 0 && goalId) {
    // Idempotency check: Don't insert cards if already inserted for this event
    let shouldInsertCards = true;
    if (eventId) {
      const { data: existingCards } = await supabase
        .from('revision_cards')
        .select('id')
        .eq('user_id', userId)
        .eq('metadata->>eventId', eventId)
        .limit(1);
      
      if (existingCards && existingCards.length > 0) {
        shouldInsertCards = false;
        cardCount = existingCards.length; // Approximate, but avoids re-insertion
      }
    }

    if (shouldInsertCards) {
      const cardsToInsert = result.suggestedCards.slice(0, 5).map((card) => ({
        user_id: userId,
        goal_id: goalId,
        front: card.front,
        back: card.back,
        card_type: 'source',
        state: 0,
        due: new Date().toISOString(),
        source_type: 'hermes_source_processing',
        metadata: { 
          materialId, 
          generatedByHermes: true,
          ...(eventId ? { eventId } : {}),
        },
      }));

      const { data: inserted } = await supabase
        .from('revision_cards')
        .insert(cardsToInsert)
        .select('id');

      cardCount = inserted?.length ?? 0;
    }
  }

  return {
    conceptCount: result.extractedConcepts.length,
    cardCount,
  };
}

/**
 * Write Hermes revision quality result to Supabase.
 * Updates revision_cards metadata and flags rejected cards.
 */
export async function writeRevisionQualityResult(
  supabase: SupabaseClient,
  userId: string,
  goalId: string | null | undefined,
  result: HermesRevisionResult
): Promise<void> {
  const cardIdsToVerify = result.improvedCards.map(c => c.cardId).concat(result.rejectedCardIds);
  if (cardIdsToVerify.length > 0) {
    await assertHermesWriteScope(supabase, { userId, goalId, cardIds: cardIdsToVerify });
  }

  const timestamp = new Date().toISOString();

  // 1. Update improved cards
  for (const card of result.improvedCards) {
    // Fetch original card to store old values
    const { data: originalCard } = await supabase
      .from('revision_cards')
      .select('front, back, metadata')
      .eq('id', card.cardId)
      .single();

    if (originalCard) {
      await supabase
        .from('revision_cards')
        .update({
          front: card.front,
          back: card.back,
          metadata: {
            ...originalCard.metadata,
            hermesImproved: true,
            improvedAt: timestamp,
            originalFront: originalCard.front,
            originalBack: originalCard.back,
            qualityReason: card.improvementReason,
          },
        })
        .eq('id', card.cardId);
    }
  }

  // 2. Update rejected cards
  if (result.rejectedCardIds.length > 0) {
    for (const cardId of result.rejectedCardIds) {
      const { data: originalCard } = await supabase
        .from('revision_cards')
        .select('metadata')
        .eq('id', cardId)
        .single();
      
      if (originalCard) {
        await supabase
          .from('revision_cards')
          .update({
            state: -1, // Archived/suspended state
            metadata: {
              ...originalCard.metadata,
              hermesImproved: false,
              hermesRejected: true,
              rejectedAt: timestamp,
            }
          })
          .eq('id', cardId);
      }
    }
  }

  // 3. Emit audit event
  if (result.improvedCards.length > 0 || result.rejectedCardIds.length > 0) {
    await supabase.from('student_events').insert({
      user_id: userId,
      type: 'REVISION_CARDS_IMPROVED_BY_HERMES',
      data: {
        goalId: goalId ?? null,
        improvedCount: result.improvedCards.length,
        rejectedCount: result.rejectedCardIds.length,
      }
    });
  }
}

/**
 * Write Hermes cognitive trace result to Supabase.
 * Stores trace in learning_goals.metadata.hermesTrace.
 */
export async function writeTraceResult(
  supabase: SupabaseClient,
  userId: string,
  goalId: string,
  result: HermesTraceResult
): Promise<void> {
  await assertHermesWriteScope(supabase, { userId, goalId });

  const traceData = {
    updatedAt: new Date().toISOString(),
    repeatedWeaknesses: result.cognitiveTrace.repeatedWeaknesses,
    avoidanceSignals: result.cognitiveTrace.avoidanceSignals,
    forgettingRisks: result.cognitiveTrace.forgettingRisks,
    improvementSignals: result.cognitiveTrace.improvementSignals,
    recommendations: result.recommendations,
  };

  const { data: goalData } = await supabase
    .from('learning_goals')
    .select('metadata')
    .eq('id', goalId)
    .single();

  if (goalData) {
    await supabase
      .from('learning_goals')
      .update({
        metadata: {
          ...goalData.metadata,
          hermesTrace: traceData,
        }
      })
      .eq('id', goalId);
  }

  await supabase.from('student_events').insert({
    user_id: userId,
    type: 'HERMES_TRACE_UPDATED',
    data: { goalId }
  });
}

/**
 * Write Hermes next action result to Supabase.
 * Creates daily microtasks and updates daily_plans metadata.
 */
export async function writeNextActionResult(
  supabase: SupabaseClient,
  userId: string,
  goalId: string,
  result: HermesNextActionResult,
  eventId?: string
): Promise<void> {
  await assertHermesWriteScope(supabase, { userId, goalId });

  // 1. Store the top level next action in daily_plans if it exists for today
  const today = new Date().toISOString().split('T')[0];
  const { data: planData } = await supabase
    .from('daily_plans')
    .select('id, metadata')
    .eq('user_id', userId)
    .eq('goal_id', goalId)
    .eq('plan_date', today)
    .single();

  if (planData) {
    await supabase
      .from('daily_plans')
      .update({
        metadata: {
          ...planData.metadata,
          hermesNextAction: result.nextAction,
          ...(eventId ? { sourceEventId: eventId } : {}),
        }
      })
      .eq('id', planData.id);
  }

  // 2. Create microtasks
  if (result.microtasks.length > 0) {
    let shouldInsertTasks = true;

    // Idempotency check: Don't insert tasks if already inserted for this event
    if (eventId) {
      const { data: existingTasks } = await supabase
        .from('daily_microtasks')
        .select('id')
        .eq('user_id', userId)
        .eq('metadata->>eventId', eventId)
        .limit(1);

      if (existingTasks && existingTasks.length > 0) {
        shouldInsertTasks = false;
      }
    }

    if (shouldInsertTasks) {
      const tasksToInsert = result.microtasks.map(task => ({
        user_id: userId,
        goal_id: goalId,
        task_date: today,
        type: task.type,
        title: task.title,
        status: 'pending',
        priority: 'medium',
        source: 'system',
        estimated_minutes: task.estimatedMinutes,
        metadata: { 
          generatedByHermes: true,
          ...(eventId ? { eventId } : {}),
        }
      }));

      await supabase.from('daily_microtasks').insert(tasksToInsert);
    }
  }
}

