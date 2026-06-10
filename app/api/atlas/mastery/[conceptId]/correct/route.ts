import { NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/middleware/withRateLimit';
import { apiErrorResponse, getRequestId } from '@/lib/api/errors';
import { createClient } from '@/lib/supabase/server';
import { projectLearningSignal } from '@/lib/learner-state/projector';

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

  if (!action || !['mark_known', 'mark_irrelevant', 'reset'].includes(action)) {
    return apiErrorResponse('bad_request', {
      status: 400,
      message: 'Valid action (mark_known, mark_irrelevant, reset) is required',
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

  // Determine mastery based on action
  let newMastery: 'mastered' | 'not_started' | 'exposed' = 'not_started';
  if (action === 'mark_known') {
    newMastery = 'mastered';
  } else if (action === 'mark_irrelevant') {
    newMastery = 'not_started'; // We might want a different state for irrelevant, but this works for now
  } else if (action === 'reset') {
    newMastery = 'not_started';
  }

  // Auditable correction event via projection
  await projectLearningSignal(supabase, userId, {
    source: 'autopsy',
    type: 'concept_understood',
    subject: concept.subject,
    chapter: concept.chapter,
    concept: concept.topic,
    confidence: 1.0,
    metadata: {
      mastery: newMastery,
      evidenceType: 'user_correction',
      reason: reason || `User manually corrected status to ${newMastery}`,
    }
  });

  return NextResponse.json({
    success: true,
    message: `Concept corrected to ${newMastery}`,
  }, { headers: { 'x-request-id': requestId } });
});
