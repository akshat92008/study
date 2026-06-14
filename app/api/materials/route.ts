import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';
import { checkRateLimit, rateLimitResponse } from '@/lib/middleware/rateLimit';
import { ensureGoalForUser } from '@/lib/services/goal-context.service';

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return apiErrorResponse('unauthorized', { status: 401, message: 'Authentication is required.', requestId });
    }

    const { allowed, remaining, resetAt } = await checkRateLimit({
      identifier: user.id,
      bucket: 'materials',
      maxTokens: 60,
      windowSeconds: 60,
      failClosed: true,
    });
    if (!allowed) return rateLimitResponse(remaining, resetAt);

    const { searchParams } = new URL(req.url);
    const goalId = searchParams.get('goalId');
    const includeGlobal = searchParams.get('includeGlobal') === 'true';
    if (goalId) await ensureGoalForUser(supabase, user.id, goalId);

    let query = supabase
      .from('study_materials')
      .select('id, title, original_filename, mime_type, source_type, goal_id, chat_session_id, exam_type, subject, chapter, topic, language, status, page_count, char_count, error_message, last_error, last_error_code, next_retry_at, retryable, retry_count, chunk_count, embedding_count, last_processed_at, processing_started_at, processing_finished_at, detected_subject, detected_chapter, goal_match_score, mismatch_warning_acknowledged, created_at, updated_at, study_material_chunks(count)')
      .eq('user_id', user.id)
      .neq('status', 'archived');

    if (goalId) {
      query = includeGlobal
        ? (query as any).or(`goal_id.eq.${goalId},goal_id.is.null`)
        : query.eq('goal_id', goalId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ materials: data || [] }, { headers: { 'x-request-id': requestId } });
  } catch (error) {
    return unexpectedApiErrorResponse(req, error, 'materials_list_unhandled', 'Unable to load study materials.');
  }
}
