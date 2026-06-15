import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';
import { ensureGoalForUser } from '@/lib/services/goal-context.service';
import { applyLearningEvent } from '@/lib/learner-state/apply-learning-event';
import { stableKey } from '@/lib/agent/tools/learning/common';

const ManualMistakeSchema = z.object({
  goalId: z.string().uuid().nullable().optional(),
  subject: z.string().max(120).nullable().optional(),
  topic: z.string().max(160).nullable().optional(),
  chapter: z.string().max(160).nullable().optional(),
  concept: z.string().max(220).nullable().optional(),
  mistakeText: z.string().min(4).max(4000),
  correctAnswer: z.string().max(1000).nullable().optional(),
  whyWrong: z.string().max(1200).nullable().optional(),
  examTrap: z.string().max(1200).nullable().optional(),
  severity: z.number().int().min(1).max(5).nullable().optional(),
});

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return apiErrorResponse('unauthorized', { status: 401, message: 'Authentication is required.', requestId });
    }

    const { searchParams } = new URL(req.url);
    const goalId = searchParams.get('goalId');
    if (goalId) await ensureGoalForUser(supabase, user.id, goalId);

    let query = supabase
      .from('mistakes')
      .select('id, source, subject, topic, chapter, concept, mistake_text, correct_answer, why_wrong, exam_trap, severity, status, last_tested_at, next_retest_at, repaired_at, created_at, updated_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);
    if (goalId) query = query.eq('goal_id', goalId);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ mistakes: data ?? [] }, { headers: { 'x-request-id': requestId } });
  } catch (error) {
    return unexpectedApiErrorResponse(req, error, 'mistakes_get', 'Unable to load mistakes.');
  }
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return apiErrorResponse('unauthorized', { status: 401, message: 'Authentication is required.', requestId });
    }

    const parsed = ManualMistakeSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return apiErrorResponse('invalid_request', {
        status: 400,
        message: 'Mistake details are invalid.',
        requestId,
        details: parsed.error.flatten(),
      });
    }
    if (parsed.data.goalId) await ensureGoalForUser(supabase, user.id, parsed.data.goalId);

    const concept = parsed.data.concept ?? parsed.data.topic ?? parsed.data.chapter;
    if (!concept) {
      return apiErrorResponse('invalid_request', {
        status: 400,
        message: 'A concept, topic, or chapter is required so this mistake can update learner state.',
        requestId,
      });
    }

    const projection = await applyLearningEvent(supabase, {
      userId: user.id,
      goalId: parsed.data.goalId ?? null,
      source: 'manual_review',
      concept: {
        canonicalName: concept,
        subject: parsed.data.subject ?? undefined,
        chapter: parsed.data.chapter ?? undefined,
        topic: parsed.data.topic ?? concept,
      },
      result: {
        outcome: 'incorrect',
        confidence: 0.9,
        mistakeType: 'conceptual_gap',
        explanation: parsed.data.whyWrong ?? parsed.data.mistakeText,
      },
      metadata: {
        mistakeText: parsed.data.mistakeText,
        correctAnswer: parsed.data.correctAnswer ?? null,
        whyWrong: parsed.data.whyWrong ?? null,
        examTrap: parsed.data.examTrap ?? null,
        severity: parsed.data.severity ?? 2,
        entry: 'manual_paste',
        idempotencyKey: stableKey(['manual-mistake', user.id, concept, parsed.data.mistakeText]),
      },
    });
    if (!projection.ok) {
      return apiErrorResponse('learner_state_update_failed', {
        status: 500,
        message: projection.message,
        requestId,
      });
    }

    const mistakeId = projection.mistakeIds[0] ?? null;
    const { data: mistake } = mistakeId
      ? await supabase.from('mistakes').select('*').eq('id', mistakeId).eq('user_id', user.id).maybeSingle()
      : { data: null };

    return NextResponse.json({
      success: true,
      mistake,
      created: Boolean(mistakeId),
      loopSummary: {
        message: `Saved and verified. ${projection.mistakeIds.length} mistake projected for ${concept}; ${projection.revisionCardIds.length} repair card ready and delayed retest scheduled.`,
        mistakesCreated: projection.mistakeIds.length,
        repairCardsCreated: projection.revisionCardIds.length,
        retestsScheduled: projection.mistakeIds.length,
        tomorrowSessionUpdated: true,
      },
    }, { status: 201, headers: { 'x-request-id': requestId } });
  } catch (error) {
    return unexpectedApiErrorResponse(req, error, 'mistakes_post', 'Unable to save this mistake.');
  }
}
