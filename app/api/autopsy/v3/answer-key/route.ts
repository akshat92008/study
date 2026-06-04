import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';
import { parseAnswerKeyText } from '@/lib/autopsy-v3/extraction/answer-key-parser';
import { computeQuestionStatus } from '@/lib/autopsy-v3/scoring';
import { jsonWithRequestId, requireAutopsyV3User } from '@/lib/autopsy-v3/permissions';

const BodySchema = z.object({
  assessmentId: z.string().uuid().optional(),
  text: z.string().min(1).max(20000),
});

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const auth = await requireAutopsyV3User(requestId);
    if (auth.error) return auth.error;
    const { supabase, user } = auth;
    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return apiErrorResponse('invalid_request', { status: 400, message: 'Answer key text is invalid.', requestId });
    }

    const answers = parseAnswerKeyText(parsed.data.text);
    if (!parsed.data.assessmentId || answers.length === 0) {
      return jsonWithRequestId({ answers }, requestId);
    }

    const { data: questions, error: questionError } = await supabase
      .from('assessment_questions')
      .select('*')
      .eq('assessment_id', parsed.data.assessmentId)
      .eq('user_id', user.id);
    if (questionError) throw questionError;

    const rows = (questions ?? []).map((question: any) => {
      const answer = answers.find((item) => item.question_number === question.question_number);
      if (!answer) return null;
      return {
        ...question,
        correct_answer: answer.correct_answer,
        status: computeQuestionStatus(answer.correct_answer, question.user_answer, question.options),
        extraction_confidence: Math.max(question.extraction_confidence ?? 0, answer.confidence),
        updated_at: new Date().toISOString(),
      };
    }).filter(Boolean);

    if (rows.length > 0) {
      const { error } = await supabase
        .from('assessment_questions')
        .upsert(rows, { onConflict: 'assessment_id,question_number' });
      if (error) throw error;
    }

    return jsonWithRequestId({ answers, updatedQuestions: rows.length }, requestId);
  } catch (error) {
    return unexpectedApiErrorResponse(req, error, 'autopsy_v3_answer_key', 'Unable to parse answer key.');
  }
}
