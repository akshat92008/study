import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiErrorResponse, getRequestId } from '@/lib/api/errors';
import { withRateLimit } from '@/lib/middleware/withRateLimit';
import { randomUUID } from 'node:crypto';
import { EventDispatcher } from '@/lib/events/orchestrator';

export const PATCH = withRateLimit('autopsy', async (request, userId, { params }) => {
  const requestId = getRequestId(request);
  const questionId = params.id;

  try {
    const supabase = await createClient();
    const body = await request.json();

    const { evidence_status, mistake_type, concept_name, correct_answer, student_answer } = body;

    // 1. Fetch current question to verify ownership
    const { data: question, error: fetchError } = await supabase
      .from('autopsy_questions')
      .select('*')
      .eq('id', questionId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !question) {
      return apiErrorResponse('not_found', { status: 404, message: 'Question not found' });
    }

    const wasPending = question.evidence_status === 'pending_review' || question.evidence_status === 'needs_review';
    const isNowVerified = evidence_status === 'verified_mistake';

    // 2. Update autopsy_questions
    const { error: updateQError } = await supabase
      .from('autopsy_questions')
      .update({
        evidence_status: evidence_status ?? question.evidence_status,
        mistake_type: mistake_type ?? question.mistake_type,
        concept_name: concept_name ?? question.concept_name,
        correct_answer: correct_answer ?? question.correct_answer,
        student_answer: student_answer ?? question.student_answer,
        reviewed_at: new Date().toISOString(),
        reviewed_by: userId,
      })
      .eq('id', questionId);

    if (updateQError) throw updateQError;

    // 3. Update or create mistakes row
    if (evidence_status === 'verified_mistake' || evidence_status === 'pending_review' || evidence_status === 'needs_review') {
      await supabase
        .from('mistakes')
        .upsert({
          user_id: userId,
          autopsy_id: question.autopsy_id,
          autopsy_question_id: question.id,
          category: mistake_type ?? question.mistake_category,
          mistake_type: mistake_type ?? question.mistake_type,
          status: evidence_status,
          evidence_status: evidence_status,
          confidence: 1, // manual review sets confidence to 1
          subject: question.subject,
          chapter: question.chapter,
          topic: concept_name ?? question.subtopic,
          question_text: question.question_text,
          user_answer: student_answer ?? question.student_answer,
          correct_answer: correct_answer ?? question.correct_answer,
          marks_lost: question.marks_lost,
          source_autopsy_id: question.autopsy_id,
          source_question_number: question.question_number,
          extraction_confidence: 100, // manually verified
        }, { onConflict: 'user_id, source_autopsy_id, source_question_number' });
    } else {
      // User changed it to not a mistake (e.g. ignored, verified_correct)
      // Update mistake if exists to corrected_by_user or similar
      await supabase
        .from('mistakes')
        .update({ status: evidence_status, evidence_status: evidence_status })
        .eq('autopsy_question_id', question.id)
        .eq('user_id', userId);
    }

    // 4. If transitioning from pending/needs_review to verified_mistake, emit event
    if (wasPending && isNowVerified) {
      const traceId = randomUUID();
      const wrongQuestions = [{
        questionNumber: question.question_number,
        subject: question.subject,
        chapter: question.chapter,
        mistakeCategory: mistake_type ?? question.mistake_category,
        mistakeType: mistake_type ?? question.mistake_type,
        reasoning: question.reasoning,
        conceptualGap: concept_name ?? question.concept_name,
        status: evidence_status,
        evidenceStatus: evidence_status,
        extractionConfidence: 100,
        needsReview: false,
        sourceQuestionId: question.id,
        sourceAutopsyId: question.autopsy_id,
        trace_id: traceId
      }];

      await EventDispatcher.publish({
        user_id: userId,
        type: 'AUTOPSY_MISTAKE_APPROVED',
        data: {
          autopsyId: question.autopsy_id,
          isCorrection: true,
          verifiedCount: 1,
          wrongQuestions,
        },
        idempotency_key: `autopsy_mistake_approved:${question.id}:${evidence_status}`,
        metadata: {
          source: 'manual_review',
          autopsyId: question.autopsy_id,
          trace_id: traceId,
        },
      });
      
      // Bump learner state version safely
      const { data: profile } = await supabase.from('profiles').select('learner_state_version').eq('id', userId).single();
      const newVersion = (profile?.learner_state_version || 0) + 1;
      await supabase.from('profiles').update({ learner_state_version: newVersion, updated_at: new Date().toISOString() }).eq('id', userId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiErrorResponse('internal_error', { status: 500, message: String(error) });
  }
});
