import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';
import { EventDispatcher } from '@/lib/events/orchestrator';
import { computeQuestionStatus } from '@/lib/autopsy-v3/scoring';
import { jsonWithRequestId, requireAutopsyV3User } from '@/lib/autopsy-v3/permissions';

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

const QuestionInputSchema = z.object({
  id: z.string().uuid().optional(),
  questionNumber: z.number().int().positive(),
  subject: z.string().max(120).nullable().optional(),
  topic: z.string().max(160).nullable().optional(),
  subtopic: z.string().max(160).nullable().optional(),
  questionText: z.string().max(4000).nullable().optional(),
  options: z.unknown().nullable().optional(),
  correctAnswer: z.string().max(500).nullable().optional(),
  userAnswer: z.string().max(500).nullable().optional(),
  status: z.enum(['correct', 'incorrect', 'skipped', 'unattempted', 'unknown']).optional(),
  marksAwarded: z.number().nullable().optional(),
  negativeMarks: z.number().nullable().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard', 'unknown']).nullable().optional(),
  sourcePage: z.number().int().positive().nullable().optional(),
  extractionConfidence: z.number().min(0).max(1).nullable().optional(),
  userReviewed: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const BodySchema = z.object({
  questions: z.array(QuestionInputSchema).min(1),
});

export async function POST(req: NextRequest, context: RouteContext) {
  const requestId = getRequestId(req);
  try {
    const auth = await requireAutopsyV3User(requestId);
    if (auth.error) return auth.error;
    const { supabase, user, limits } = auth;
    const { id: assessmentId } = await context.params;

    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return apiErrorResponse('invalid_request', {
        status: 400,
        message: 'Question rows are invalid.',
        requestId,
        details: parsed.error.flatten(),
      });
    }
    if (parsed.data.questions.length > limits.maxQuestionsPerAssessment) {
      return apiErrorResponse('too_many_questions', {
        status: 413,
        message: `Deep Autopsy supports up to ${limits.maxQuestionsPerAssessment} questions per assessment.`,
        requestId,
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

    const rows = parsed.data.questions.map((question) => {
      const status = question.status ?? computeQuestionStatus(question.correctAnswer, question.userAnswer, question.options);
      return {
        id: question.id,
        assessment_id: assessmentId,
        user_id: user.id,
        question_number: question.questionNumber,
        subject: question.subject ?? null,
        topic: question.topic ?? null,
        subtopic: question.subtopic ?? null,
        question_text: question.questionText ?? null,
        options: question.options ?? null,
        correct_answer: question.correctAnswer ?? null,
        user_answer: question.userAnswer ?? null,
        status,
        marks_awarded: question.marksAwarded ?? null,
        negative_marks: question.negativeMarks ?? null,
        difficulty: question.difficulty ?? null,
        source_page: question.sourcePage ?? null,
        extraction_confidence: question.extractionConfidence ?? null,
        user_reviewed: question.userReviewed ?? false,
        metadata: question.metadata ?? {},
        updated_at: new Date().toISOString(),
      };
    });

    const { data, error } = await supabase
      .from('assessment_questions')
      .upsert(rows, { onConflict: 'assessment_id,question_number' })
      .select('*');
    if (error) throw error;

    await supabase
      .from('assessments')
      .update({ status: 'diagnosis_pending', updated_at: new Date().toISOString() })
      .eq('id', assessmentId)
      .eq('user_id', user.id);

    await EventDispatcher.publish({
      user_id: user.id,
      type: 'AUTOPSY_V3_QUESTIONS_UPSERTED',
      data: { assessmentId, questionCount: rows.length },
      metadata: { source: 'autopsy_v3_questions', goalId: assessment.goal_id },
      idempotency_key: `autopsy_v3_questions_upserted:${assessmentId}:${rows.length}:${Date.now()}`,
    }).catch(() => undefined);

    return jsonWithRequestId({ questions: data ?? [] }, requestId);
  } catch (error) {
    return unexpectedApiErrorResponse(req, error, 'autopsy_v3_questions', 'Unable to save Deep Autopsy questions.');
  }
}
