import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';
import { EventDispatcher } from '@/lib/events/orchestrator';
import { classifyMistakeDeterministically } from '@/lib/autopsy-v3/mistake-classifier';
import { jsonWithRequestId, requireAutopsyV3User } from '@/lib/autopsy-v3/permissions';

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

const ReasonSchema = z.object({
  questionId: z.string().uuid(),
  userReasonCategory: z.string().max(80).nullable().optional(),
  userReason: z.string().max(1000).nullable().optional(),
});

const BodySchema = z.object({
  reasons: z.array(ReasonSchema).min(1),
});

export async function POST(req: NextRequest, context: RouteContext) {
  const requestId = getRequestId(req);
  try {
    const auth = await requireAutopsyV3User(requestId);
    if (auth.error) return auth.error;
    const { supabase, user } = auth;
    const { id: assessmentId } = await context.params;

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return apiErrorResponse('invalid_request', {
        status: 400,
        message: 'Reason payload is invalid.',
        requestId,
        details: parsed.error.flatten(),
      });
    }

    const { data: assessment, error: assessmentError } = await supabase
      .from('assessments')
      .select('id, user_id, goal_id')
      .eq('id', assessmentId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (assessmentError) throw assessmentError;
    if (!assessment) {
      return apiErrorResponse('not_found', { status: 404, message: 'Assessment not found.', requestId });
    }

    const questionIds = parsed.data.reasons.map((reason) => reason.questionId);
    const { data: questions, error: questionError } = await supabase
      .from('assessment_questions')
      .select('*')
      .eq('assessment_id', assessmentId)
      .eq('user_id', user.id)
      .in('id', questionIds);
    if (questionError) throw questionError;

    const questionById = new Map((questions ?? []).map((question: any) => [question.id, question]));
    const rows = parsed.data.reasons
      .map((reason) => {
        const question = questionById.get(reason.questionId);
        if (!question) return null;
        return classifyMistakeDeterministically({
          userId: user.id,
          assessmentId,
          question,
          goalId: assessment.goal_id,
          userReason: reason.userReason,
          userReasonCategory: reason.userReasonCategory,
        });
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    if (rows.length === 0) {
      return apiErrorResponse('not_found', { status: 404, message: 'No matching question rows were found.', requestId });
    }

    const { data, error } = await supabase
      .from('mistake_diagnoses')
      .upsert(rows as any[], { onConflict: 'question_id' })
      .select('*');
    if (error) throw error;

    await supabase
      .from('assessments')
      .update({ status: 'diagnosis_pending', updated_at: new Date().toISOString() })
      .eq('id', assessmentId)
      .eq('user_id', user.id);

    await EventDispatcher.publish({
      user_id: user.id,
      type: 'AUTOPSY_V3_REASONS_COLLECTED',
      data: { assessmentId, diagnosisCount: rows.length },
      metadata: { source: 'autopsy_v3_reasons', goalId: assessment.goal_id },
      idempotency_key: `autopsy_v3_reasons:${assessmentId}:${rows.length}:${Date.now()}`,
    }).catch(() => undefined);

    return jsonWithRequestId({ diagnoses: data ?? [] }, requestId);
  } catch (error) {
    return unexpectedApiErrorResponse(req, error, 'autopsy_v3_reasons', 'Unable to save Deep Autopsy reasons.');
  }
}
