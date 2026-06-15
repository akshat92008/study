import { NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/middleware/withRateLimit';
import { apiErrorResponse, getRequestId } from '@/lib/api/errors';
import { createClient } from '@/lib/supabase/server';
import { applyLearningEvent } from '@/lib/learner-state/apply-learning-event';

export const POST = withRateLimit('atlas', async (req, userId, { params }) => {
  const requestId = getRequestId(req);
  const supabase = await createClient();
  const resolvedParams = await params;
  const conceptId = resolvedParams?.conceptId;

  if (!conceptId || typeof conceptId !== 'string') {
    return apiErrorResponse('bad_request', {
      status: 400,
      message: 'Concept ID is required',
      requestId,
    });
  }

  const body = await req.json().catch(() => ({}));
  const { action, reason } = body;

  if (action !== 'mark_known') {
    return apiErrorResponse('bad_request', {
      status: 409,
      message: 'Only verified mark_known evidence is currently delivered. Reset and irrelevant states are hidden until they have canonical learner-state semantics.',
      requestId,
    });
  }

  // Fetch concept to ensure it exists and get names
  const { data: concept, error: conceptError } = await supabase
    .from('concepts')
    .select('subject, chapter, topic')
    .eq('id', conceptId)
    .eq('user_id', userId)
    .single();

  if (conceptError || !concept) {
    return apiErrorResponse('not_found', {
      status: 404,
      message: 'Concept not found',
      requestId,
    });
  }

  const projection = await applyLearningEvent(supabase, {
    userId,
    goalId: null,
    source: 'manual_review',
    concept: {
      conceptId,
      canonicalName: concept.topic,
      subject: concept.subject,
      chapter: concept.chapter,
      topic: concept.topic,
    },
    result: {
      outcome: 'correct',
      confidence: 1,
      explanation: reason || 'User confirmed this concept as known.',
    },
    metadata: {
      evidenceType: 'user_correction',
      reason: reason || 'User confirmed this concept as known.',
      idempotencyKey: `manual-mastery:${userId}:${conceptId}:${requestId}`,
    },
  });
  if (!projection.ok) {
    return apiErrorResponse('learner_state_update_failed', {
      status: 500,
      message: projection.message,
      requestId,
    });
  }

  return NextResponse.json({
    success: true,
    message: 'Verified mastery evidence was recorded.',
    projection,
  }, { headers: { 'x-request-id': requestId } });
});
