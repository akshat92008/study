import { NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/middleware/withRateLimit';
import { apiErrorResponse, getRequestId } from '@/lib/api/errors';
import { createClient } from '@/lib/supabase/server';

export const GET = withRateLimit('atlas', async (req, userId, { params }) => {
  const requestId = getRequestId(req);
  const supabase = await createClient();
  const conceptId = params?.conceptId;

  if (!conceptId || typeof conceptId !== 'string') {
    return apiErrorResponse('bad_request', {
      status: 400,
      message: 'Concept ID is required',
      requestId,
    });
  }

  // Fetch the concept details
  const { data: concept, error: conceptError } = await supabase
    .from('concepts')
    .select('*')
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

  // Fetch the recent evidence log for this concept
  // Explainability: show what caused the current mastery level
  const { data: events, error: eventsError } = await supabase
    .from('mastery_events')
    .select('*')
    .eq('concept_id', conceptId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (eventsError) {
    // Log error but continue
    console.warn('Failed to fetch mastery events for concept', conceptId, eventsError);
  }

  // Explainability "Why this?" summary
  const explainability = {
    totalEvents: concept.evidence_count || events?.length || 0,
    lastUpdateReason: concept.last_updated_reason || 'Initial state',
    recentEvidence: events || [],
    score: concept.mastery_score,
    confidence: concept.confidence,
    retention: concept.retention_strength,
    forgetting: concept.forgetting_probability,
  };

  return NextResponse.json({
    concept,
    explainability,
  }, { headers: { 'x-request-id': requestId } });
});
