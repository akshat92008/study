import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { apiErrorResponse, getRequestId } from '@/lib/api/errors';
import { areMcqAnswersEquivalent } from '@/lib/practice/answer-normalization';
import { checkRateLimit, rateLimitResponse } from '@/lib/middleware/rateLimit';
import { checkIdempotency } from '@/lib/middleware/idempotency';
import { PracticeService } from '@/lib/services/practice.service';
import { runHermesTurn } from '@/lib/agent/runtime';
import { logger } from '@/lib/utils/logger';
import { resolveActiveGoalForUser } from '@/lib/goals/resolve-active-goal';
import { syncStudyProfileAfterPracticeAttempt } from '@/lib/services/study-profile-sync.service';

const AttemptsSchema = z.object({
  idempotencyKey: z.string().min(8).optional(),
  messageId: z.string().optional(),
  practiceSetId: z.string().optional(),
  messageContent: z.string().optional(),
  chatSessionId: z.string().optional().nullable(),
  goalId: z.string().optional().nullable(),
  answers: z.array(z.object({
    position: z.number().int().positive(),
    answer: z.string(),
    timeTakenSeconds: z.number().optional()
  }))
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function findPracticeSet(
  supabase: any,
  userId: string,
  identifiers: { practiceSetId?: string; messageId?: string }
) {
  if (identifiers.practiceSetId) {
    const { data, error } = await supabase
      .from('practice_sets')
      .select('*')
      .eq('id', identifiers.practiceSetId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  }

  if (!identifiers.messageId || !UUID_RE.test(identifiers.messageId)) {
    return null;
  }

  const { data, error } = await supabase
    .from('practice_sets')
    .select('*')
    .eq('message_id', identifiers.messageId)
    .eq('set_type', 'mcq')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

async function materializePracticeSetFromChat(
  supabase: any,
  userId: string,
  input: {
    messageId?: string;
    messageContent?: string;
    chatSessionId?: string | null;
    goalId?: string | null;
  }
) {
  const safeMessageId = input.messageId && UUID_RE.test(input.messageId) ? input.messageId : undefined;
  let fullResponse = input.messageContent?.trim() || '';
  let chatSessionId = input.chatSessionId;
  let goalId = input.goalId ?? null;
  let source: 'mind' | 'rag' = 'mind';
  let sourceMaterialIds: string[] = [];
  let sourceChunkIds: string[] = [];

  if (safeMessageId) {
    const { data: message, error } = await supabase
      .from('chat_messages')
      .select('id, session_id, content, metadata')
      .eq('id', safeMessageId)
      .eq('user_id', userId)
      .eq('role', 'assistant')
      .maybeSingle();
    if (error) throw error;

    if (message?.content) {
      fullResponse = message.content;
      chatSessionId = message.session_id ?? chatSessionId;
      const ragChunks = Array.isArray(message.metadata?.ragChunks) ? message.metadata.ragChunks : [];
      source = ragChunks.length > 0 ? 'rag' : 'mind';
      sourceMaterialIds = ragChunks.map((chunk: any) => chunk.materialId).filter(Boolean);
      sourceChunkIds = ragChunks.map((chunk: any) => chunk.id).filter(Boolean);
    }
  }

  if (!goalId && chatSessionId && UUID_RE.test(chatSessionId)) {
    const { data: session, error } = await supabase
      .from('chat_sessions')
      .select('goal_id')
      .eq('id', chatSessionId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    goalId = session?.goal_id ?? null;
  }

  if (!fullResponse || !/<artifact[^>]+type=["'](?:practice-test|mcq-set)["']/i.test(fullResponse)) {
    return null;
  }

  const extraction = await PracticeService.extractAndStorePracticeArtifacts(supabase as any, {
    userId,
    chatSessionId: chatSessionId ?? undefined,
    goalId,
    messageId: safeMessageId,
    fullResponse,
    source,
    sourceMaterialIds,
    sourceChunkIds,
  });

  const practiceSetId = extraction.practiceSetIds[0];
  if (practiceSetId) {
    return findPracticeSet(supabase, userId, { practiceSetId });
  }

  if (safeMessageId) {
    return findPracticeSet(supabase, userId, { messageId: safeMessageId });
  }

  return null;
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return apiErrorResponse('unauthorized', { status: 401, message: 'Authentication required', requestId });
    }

    const { allowed, remaining, resetAt } = await checkRateLimit({
      identifier: user.id,
      bucket: 'practice',
      maxTokens: 50,
      windowSeconds: 60,
      failClosed: true,
    });
    if (!allowed) return rateLimitResponse(remaining, resetAt);

    const body = await req.json();
    const parsed = AttemptsSchema.safeParse(body);
    if (!parsed.success) {
      return apiErrorResponse('invalid_request', { status: 400, message: 'Invalid payload', requestId });
    }

    const { idempotencyKey: bodyIdempotencyKey, messageId, practiceSetId, messageContent, chatSessionId, goalId, answers } = parsed.data;
    const idempotencyKey = req.headers.get('Idempotency-Key') || bodyIdempotencyKey || null;
    const { isDuplicate, error: idempError } = await checkIdempotency(user.id, 'practice_attempt', idempotencyKey);
    if (idempError) {
      return apiErrorResponse('invalid_idempotency_key', { status: 400, message: idempError, requestId });
    }
    // Redis idempotency is advisory here. The database unique index is the
    // source of truth, so duplicate keys still flow through to fetch existing rows.
    void isDuplicate;
    const idempotencySeed = idempotencyKey ?? requestId;

    if (!practiceSetId && !messageId) {
      return apiErrorResponse('invalid_request', { status: 400, message: 'Either practiceSetId or messageId is required.', requestId });
    }

    // Resolve practice set
    let set = await findPracticeSet(supabase, user.id, { practiceSetId, messageId });

    if (!set && messageId) {
      set = await materializePracticeSetFromChat(supabase, user.id, {
        messageId,
        messageContent,
        chatSessionId,
        goalId,
      });
    }

    if (!set) {
      return apiErrorResponse('quiz_still_indexing', {
        status: 409,
        message: 'Amaura is still indexing this quiz. Wait a moment and submit again.',
        requestId,
      });
    }

    const goalResolution = await resolveActiveGoalForUser(supabase, user.id, set.goal_id ?? goalId ?? null);
    const resolvedGoalId = goalResolution.goalId;
    if (!resolvedGoalId) {
      return NextResponse.json({
        ok: false,
        code: 'ACTIVE_GOAL_MISSING',
        message: 'Select an active learning goal before submitting practice.',
        retryable: false,
        traceId: requestId,
        attemptSaved: false,
      }, { status: 409 });
    }
    if (!set.goal_id) {
      const { error: setGoalError } = await supabase
        .from('practice_sets')
        .update({ goal_id: resolvedGoalId })
        .eq('id', set.id)
        .eq('user_id', user.id);
      if (setGoalError) throw setGoalError;
      set.goal_id = resolvedGoalId;
    }

    // Fetch items to check correctness
    const positions = answers.map(a => a.position);
    const { data: items } = await supabase
      .from('practice_items')
      .select('id, correct_answer, options, concept_id, concept_name, position, question')
      .eq('practice_set_id', set.id)
      .in('position', positions);
    if (!items || items.length === 0) {
      return apiErrorResponse('not_found', { status: 404, message: 'Practice items not found', requestId });
    }

    let correctCount = 0;
    let wrongCount = 0;
    const wrongConceptIds: string[] = [];
    const wrongConceptNames: string[] = [];
    const eventItems: any[] = [];
    const attemptKeys: string[] = [];

    const attemptsToInsert = answers.map(ans => {
      const item = items.find(i => i.position === ans.position);
      const options = Array.isArray(item?.options) ? item.options : [];
      const isCorrect = item ? areMcqAnswersEquivalent(ans.answer, item.correct_answer, options) : false;
      const attemptKey = item?.id
        ? `${idempotencySeed}:${set.id}:${item.id}`
        : `${idempotencySeed}:${set.id}:missing:${ans.position}`;
      
      if (isCorrect) correctCount++;
      else {
        wrongCount++;
        if (item?.concept_id && !wrongConceptIds.includes(item.concept_id)) wrongConceptIds.push(item.concept_id);
        if (item?.concept_name && !wrongConceptNames.includes(item.concept_name)) wrongConceptNames.push(item.concept_name);
      }

      eventItems.push({
        practiceItemId: item?.id,
        questionId: item?.id,
        question: item?.question,
        conceptId: item?.concept_id,
        conceptName: item?.concept_name,
        subject: set.subject ?? null,
        chapter: set.topic ?? null,
        topic: item?.concept_name ?? set.topic ?? null,
        isCorrect,
        selectedAnswer: ans.answer,
        correctAnswer: item?.correct_answer,
        timeTakenSeconds: ans.timeTakenSeconds ?? null,
        source: 'practice_attempt',
        idempotencyKey: attemptKey,
      });
      attemptKeys.push(attemptKey);

      return {
        user_id: user.id,
        practice_set_id: set.id,
        practice_item_id: item?.id,
        answer: ans.answer,
        is_correct: isCorrect,
        time_taken_seconds: ans.timeTakenSeconds,
        idempotency_key: attemptKey,
      };
    }).filter(a => a.practice_item_id); // Filter out any that didn't match an item

    if (attemptsToInsert.length === 0) {
      return apiErrorResponse('invalid_request', { status: 400, message: 'No matching practice items found', requestId });
    }

    const { data: existingAttempts, error: existingAttemptsError } = await supabase
      .from('practice_attempts')
      .select('idempotency_key')
      .eq('user_id', user.id)
      .in('idempotency_key', attemptKeys);
    if (existingAttemptsError) throw existingAttemptsError;
    const existingAttemptKeys = new Set((existingAttempts ?? []).map((attempt: any) => attempt.idempotency_key));
    const newAttemptKeys = attemptKeys.filter((key) => !existingAttemptKeys.has(key));

    const { error: insertError } = await supabase
      .from('practice_attempts')
      .upsert(attemptsToInsert, {
        onConflict: 'user_id,idempotency_key',
        ignoreDuplicates: true,
      });
    if (insertError) throw insertError;

    const { data: persistedAttempts, error: fetchAttemptsError } = await supabase
      .from('practice_attempts')
      .select('id, practice_item_id, idempotency_key, answer, is_correct, time_taken_seconds, created_at')
      .eq('user_id', user.id)
      .in('idempotency_key', attemptKeys);
    if (fetchAttemptsError) throw fetchAttemptsError;

    const attemptsByKey = new Map((persistedAttempts ?? []).map((attempt: any) => [attempt.idempotency_key, attempt]));
    for (const item of eventItems) {
      const attempt = attemptsByKey.get(item.idempotencyKey);
      if (attempt) {
        item.attemptId = attempt.id;
        item.sourceId = attempt.id;
      }
    }

    const persistedEventItems = eventItems.filter((item) => item.attemptId && item.practiceItemId);

    let agentLoopResult: any;
    try {
      agentLoopResult = await runHermesTurn({
        userId: user.id,
        channel: 'practice',
        goalId: resolvedGoalId,
        payload: {
          practiceSetId: set.id,
          items: persistedEventItems.slice(0, 50).map((item: any) => ({
            attemptId: item.attemptId,
            practiceItemId: item.practiceItemId,
            conceptId: item.conceptId,
            conceptName: item.conceptName,
            topic: item.topic,
            chapter: item.chapter,
            subject: item.subject,
            question: item.question,
            isCorrect: item.isCorrect,
            selectedAnswer: item.selectedAnswer,
            correctAnswer: item.correctAnswer,
          })),
          metrics: { correctCount, wrongCount, wrongConceptIds, wrongConceptNames },
          source: 'practice_attempt_channel',
        },
        sessionId: chatSessionId ?? undefined,
      }, {
        supabase: supabase as any,
        idempotencyKey: `practice-agent:${user.id}:${set.id}:${idempotencySeed}`,
      });

      if (!agentLoopResult.verification?.ok) {
        throw new Error(agentLoopResult.verification?.errors?.join('; ') || 'Learner-state verification failed.');
      }

      logger.info('Practice agent runtime completed', {
        userId: user.id,
        practiceSetId: set.id,
        changed: agentLoopResult?.mutationSummary?.changed,
      });
    } catch (runtimeError) {
      if (newAttemptKeys.length > 0) {
        await supabase
          .from('practice_attempts')
          .delete()
          .eq('user_id', user.id)
          .in('idempotency_key', newAttemptKeys);
      }
      logger.error('Practice learner-state projection failed', runtimeError, {
        userId: user.id,
        practiceSetId: set.id,
      });
      return NextResponse.json({
        ok: false,
        code: 'PRACTICE_PROJECTION_FAILED',
        message: 'Answer was graded, but learner state could not be updated.',
        retryable: true,
        traceId: requestId,
        attemptSaved: false,
      }, { status: 500 });
    }

    let profileSync;
    try {
      profileSync = await syncStudyProfileAfterPracticeAttempt(supabase, {
        userId: user.id,
        goalId: resolvedGoalId,
        practiceSetId: set.id,
        metrics: { correctCount, wrongCount, wrongConceptIds, wrongConceptNames },
        items: persistedEventItems,
        runtimeOutput: agentLoopResult,
      });
    } catch (profileError) {
      if (newAttemptKeys.length > 0) {
        await supabase.from('practice_attempts').delete().eq('user_id', user.id).in('idempotency_key', newAttemptKeys);
      }
      logger.error('Practice profile synchronization failed', profileError, {
        userId: user.id,
        practiceSetId: set.id,
      });
      return NextResponse.json({
        ok: false,
        code: 'PRACTICE_PROJECTION_FAILED',
        message: 'Answer was graded, but learner profile synchronization failed.',
        retryable: true,
        traceId: requestId,
        attemptSaved: false,
      }, { status: 500 });
    }

    const loopSummary = {
      saved: true,
      mistakesCreated: (profileSync as any)?.mistakesCreated ?? 0,
      repairCardsCreated: (profileSync as any)?.repairCardsCreated ?? 0,
      retestsScheduled: (profileSync as any)?.retestsScheduled ?? 0,
      tomorrowSessionUpdated: (profileSync as any)?.sessionCardInvalidated === true,
      message: wrongCount > 0
        ? [
            'Saved.',
            `${(profileSync as any)?.mistakesCreated ?? wrongCount} mistake${((profileSync as any)?.mistakesCreated ?? wrongCount) === 1 ? '' : 's'} tracked.`,
            `MEMORY: ${(profileSync as any)?.repairCardsCreated ?? 0} repair card${((profileSync as any)?.repairCardsCreated ?? 0) === 1 ? '' : 's'} created.`,
            `Retest: ${(profileSync as any)?.retestsScheduled ?? 0} scheduled.`,
            'Tomorrow/session updated around unresolved risk.',
          ].join(' ')
        : 'Saved. No new mistakes created from this submission.',
    };

    return NextResponse.json({
      ok: true,
      success: true,
      attempts: persistedAttempts ?? [],
      metrics: { correctCount, wrongCount, wrongConceptIds, wrongConceptNames },
      goalId: set.goal_id ?? goalId ?? null,
      profileSync,
      agentMutationSummary: agentLoopResult?.mutationSummary ?? null,
      loopSummary,
    });
  } catch (error) {
    const { unexpectedApiErrorResponse } = await import('@/lib/api/errors');
    return unexpectedApiErrorResponse(req, error, 'practice_attempt_unhandled');
  }
}
