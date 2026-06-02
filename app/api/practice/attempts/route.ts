import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { apiErrorResponse, getRequestId } from '@/lib/api/errors';
import { EventDispatcher } from '@/lib/events/orchestrator';
import { areMcqAnswersEquivalent } from '@/lib/practice/answer-normalization';
import { checkRateLimit, rateLimitResponse } from '@/lib/middleware/rateLimit';
import { checkIdempotency } from '@/lib/middleware/idempotency';

const AttemptsSchema = z.object({
  messageId: z.string().optional(),
  practiceSetId: z.string().optional(),
  answers: z.array(z.object({
    position: z.number().int().positive(),
    answer: z.string(),
    timeTakenSeconds: z.number().optional()
  }))
});

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

    const idempotencyKey = req.headers.get('Idempotency-Key');
    const { isDuplicate, error: idempError } = await checkIdempotency(user.id, 'practice_attempt', idempotencyKey);
    if (idempError) {
      return apiErrorResponse('invalid_idempotency_key', { status: 400, message: idempError, requestId });
    }
    // Redis idempotency is advisory here. The database unique index is the
    // source of truth, so duplicate keys still flow through to fetch existing rows.
    void isDuplicate;
    const idempotencySeed = idempotencyKey ?? requestId;

    const body = await req.json();
    const parsed = AttemptsSchema.safeParse(body);
    if (!parsed.success) {
      return apiErrorResponse('invalid_request', { status: 400, message: 'Invalid payload', requestId });
    }

    const { messageId, practiceSetId, answers } = parsed.data;

    if (!practiceSetId && !messageId) {
      return apiErrorResponse('invalid_request', { status: 400, message: 'Either practiceSetId or messageId is required', requestId });
    }

    // Resolve practice set
    let set;
    if (practiceSetId) {
      const { data } = await supabase.from('practice_sets').select('*').eq('id', practiceSetId).eq('user_id', user.id).single();
      set = data;
    } else {
      const { data } = await supabase.from('practice_sets').select('*').eq('message_id', messageId).eq('set_type', 'mcq').eq('user_id', user.id).single();
      set = data;
    }

    if (!set) {
      return apiErrorResponse('not_found', { status: 404, message: 'Practice set not found', requestId });
    }

    // Fetch items to check correctness
    const positions = answers.map(a => a.position);
    const { data: items } = await supabase
      .from('practice_items')
      .select('id, correct_answer, options, concept_id, concept_name, position, question')
      .eq('practice_set_id', set.id)
      .in('position', positions);
    if (!items) {
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

    await EventDispatcher.publish({
      user_id: user.id,
      type: 'PRACTICE_ATTEMPT_RECORDED',
      data: {
        practiceSetId: set.id,
        setType: 'mcq',
        subject: set.subject ?? null,
        chapter: set.topic ?? null,
        metrics: {
          correctCount,
          wrongCount,
          wrongConceptIds,
          wrongConceptNames,
        },
        items: eventItems
      },
      metadata: { source: 'mind_chat_mcq' },
      idempotency_key: `practice_attempt:${set.id}:${eventItems.map((item) => `${item.practiceItemId}:${item.isCorrect}`).sort().join('|')}`
    });

    return NextResponse.json({
      success: true,
      attempts: persistedAttempts ?? [],
      metrics: { correctCount, wrongCount, wrongConceptIds, wrongConceptNames }
    });
  } catch (error) {
    const { unexpectedApiErrorResponse } = await import('@/lib/api/errors');
    return unexpectedApiErrorResponse(req, error, 'practice_attempt_unhandled');
  }
}
