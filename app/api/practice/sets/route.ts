import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';
import { resolveActiveGoalForUser } from '@/lib/goals/resolve-active-goal';
import { budgetedGenerateJSON } from '@/lib/ai/budgeted';
import { EventDispatcher } from '@/lib/events/orchestrator';

const PracticeSetRequest = z.object({
  goalId: z.string().uuid().optional().nullable(),
  source: z.enum(['mind', 'session_card', 'memory', 'autopsy']),
  conceptIds: z.array(z.string().uuid()).max(12).default([]),
  count: z.number().int().min(1).max(10).default(3),
  mode: z.enum(['mcq', 'short_answer', 'mixed']).default('mcq'),
  idempotencyKey: z.string().min(8).max(200).optional(),
});

const GeneratedItem = z.object({
  conceptId: z.string().uuid().nullable().optional(),
  conceptName: z.string().min(1).max(160),
  question: z.string().min(1).max(1200),
  type: z.enum(['mcq', 'short_answer']),
  options: z.array(z.object({
    key: z.enum(['A', 'B', 'C', 'D']),
    text: z.string().min(1).max(500),
  })).optional(),
  correctAnswer: z.string().min(1).max(500),
  explanation: z.string().min(1).max(1200),
});

const GeneratedPractice = z.object({ items: z.array(GeneratedItem).min(1).max(10) });

async function loadPracticeSet(supabase: any, userId: string, practiceSetId: string) {
  const { data: set, error: setError } = await supabase
    .from('practice_sets')
    .select('id, goal_id, topic, subject, source, created_at')
    .eq('id', practiceSetId)
    .eq('user_id', userId)
    .single();
  if (setError) throw setError;

  const { data: items, error: itemsError } = await supabase
    .from('practice_items')
    .select('id, concept_id, concept_name, question, options, position')
    .eq('practice_set_id', practiceSetId)
    .eq('user_id', userId)
    .order('position', { ascending: true });
  if (itemsError) throw itemsError;

  return {
    id: set.id,
    goalId: set.goal_id,
    source: set.source,
    topic: set.topic,
    items: (items ?? []).map((item: any) => ({
      id: item.id,
      conceptId: item.concept_id,
      conceptName: item.concept_name,
      question: item.question,
      type: Array.isArray(item.options) && item.options.length > 0 ? 'mcq' : 'short_answer',
      options: Array.isArray(item.options)
        ? item.options.map((text: string, index: number) => ({ key: String.fromCharCode(65 + index), text }))
        : undefined,
      status: 'unanswered',
    })),
  };
}

async function publishPracticeSetCreated(input: {
  userId: string;
  practiceSetId: string;
  goalId: string;
  count: number;
  source: string;
  idempotencyKey: string;
}) {
  await EventDispatcher.publish({
    user_id: input.userId,
    type: 'PRACTICE_SET_CREATED',
    data: { practiceSetId: input.practiceSetId, goalId: input.goalId, count: input.count },
    metadata: { source: input.source },
    idempotency_key: `practice_set_created:${input.userId}:${input.idempotencyKey}`,
  });
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return apiErrorResponse('unauthorized', { status: 401, message: 'Authentication required.', requestId });

    const parsed = PracticeSetRequest.safeParse(await req.json());
    if (!parsed.success) {
      return apiErrorResponse('invalid_request', { status: 400, message: 'Invalid practice-set request.', requestId });
    }

    const idempotencyKey = req.headers.get('Idempotency-Key') ?? parsed.data.idempotencyKey ?? requestId;
    const activeGoal = await resolveActiveGoalForUser(supabase, user.id, parsed.data.goalId);
    if (!activeGoal.goalId) {
      return NextResponse.json({
        ok: false,
        code: 'ACTIVE_GOAL_MISSING',
        message: 'Create or select a learning goal before generating practice.',
        retryable: false,
        traceId: requestId,
      }, { status: 409 });
    }

    const { data: existing } = await supabase
      .from('practice_sets')
      .select('id')
      .eq('user_id', user.id)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();
    if (existing?.id) {
      const practiceSet = await loadPracticeSet(supabase, user.id, existing.id);
      if (practiceSet.items.length === 0) {
        await supabase.from('practice_sets').delete().eq('id', existing.id).eq('user_id', user.id);
      } else {
        await publishPracticeSetCreated({
          userId: user.id,
          practiceSetId: existing.id,
          goalId: activeGoal.goalId,
          count: practiceSet.items.length,
          source: parsed.data.source,
          idempotencyKey,
        });
        return NextResponse.json({ ok: true, practiceSet });
      }
    }

    let conceptQuery = supabase
      .from('concepts')
      .select('id, name, subject, chapter, topic, mastery, mastery_score')
      .eq('user_id', user.id)
      .eq('goal_id', activeGoal.goalId);
    conceptQuery = parsed.data.conceptIds.length > 0
      ? conceptQuery.in('id', parsed.data.conceptIds)
      : conceptQuery.order('mastery_score', { ascending: true }).limit(Math.max(parsed.data.count, 3));

    const { data: concepts, error: conceptsError } = await conceptQuery;
    if (conceptsError) throw conceptsError;
    if (!concepts || concepts.length === 0) {
      return NextResponse.json({
        ok: false,
        code: 'CONCEPT_RESOLUTION_FAILED',
        message: 'No goal-scoped concepts are available for practice yet.',
        retryable: false,
        traceId: requestId,
      }, { status: 409 });
    }

    const generated = await budgetedGenerateJSON<z.infer<typeof GeneratedPractice>>({
      userId: user.id,
      feature: 'tutor',
      route: 'practice:sets',
      model: 'flash',
      systemPrompt: [
        'Create rigorous study practice as JSON only.',
        'Never use markdown. Every MCQ must have exactly four options and one correct key.',
        'Use only the supplied concepts. Keep explanations concise and factual.',
      ].join(' '),
      userPrompt: JSON.stringify({
        goal: activeGoal.goal?.title,
        source: parsed.data.source,
        mode: parsed.data.mode,
        count: parsed.data.count,
        concepts,
        responseShape: {
          items: [{ conceptId: 'uuid', conceptName: 'string', question: 'string', type: 'mcq|short_answer', options: [{ key: 'A', text: 'string' }], correctAnswer: 'A or answer text', explanation: 'string' }],
        },
      }),
      schema: GeneratedPractice,
      maxOutputTokens: Math.max(700, parsed.data.count * 280),
    });
    const validated = GeneratedPractice.parse(generated);
    const generatedItems = validated.items.slice(0, parsed.data.count);

    const firstConcept = concepts[0];
    const { data: practiceSet, error: setError } = await supabase
      .from('practice_sets')
      .insert({
        user_id: user.id,
        goal_id: activeGoal.goalId,
        topic: firstConcept.topic ?? firstConcept.name,
        subject: firstConcept.subject,
        set_type: 'mcq',
        source: parsed.data.source,
        idempotency_key: idempotencyKey,
      })
      .select('id')
      .single();
    if (setError || !practiceSet) throw setError ?? new Error('Practice set was not created.');

    const conceptById = new Map(concepts.map((concept: any) => [concept.id, concept]));
    const itemsToInsert = generatedItems.map((item, index) => {
      const concept = (item.conceptId && conceptById.get(item.conceptId)) || firstConcept;
      const optionTexts = item.type === 'mcq'
        ? (item.options ?? []).sort((a, b) => a.key.localeCompare(b.key)).map((option) => option.text)
        : null;
      if (item.type === 'mcq' && optionTexts?.length !== 4) {
        throw new Error('Generated MCQ did not contain exactly four options.');
      }
      return {
        practice_set_id: practiceSet.id,
        user_id: user.id,
        concept_id: concept.id,
        concept_name: concept.name,
        question: item.question,
        options: optionTexts,
        correct_answer: item.correctAnswer,
        explanation: item.explanation,
        subject: concept.subject,
        chapter: concept.chapter,
        topic: concept.topic ?? concept.name,
        position: index + 1,
      };
    });

    const { error: itemsError } = await supabase.from('practice_items').insert(itemsToInsert);
    if (itemsError) {
      await supabase.from('practice_sets').delete().eq('id', practiceSet.id).eq('user_id', user.id);
      throw itemsError;
    }

    await publishPracticeSetCreated({
      userId: user.id,
      practiceSetId: practiceSet.id,
      goalId: activeGoal.goalId,
      count: itemsToInsert.length,
      source: parsed.data.source,
      idempotencyKey,
    });

    return NextResponse.json({ ok: true, practiceSet: await loadPracticeSet(supabase, user.id, practiceSet.id) });
  } catch (error) {
    return unexpectedApiErrorResponse(req, error, 'practice_set_generation_failed', 'Practice could not be generated.');
  }
}
