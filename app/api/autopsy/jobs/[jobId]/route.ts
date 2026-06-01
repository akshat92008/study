import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';
import { checkRateLimit, rateLimitResponse } from '@/lib/middleware/rateLimit';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ jobId: string }> | { jobId: string } }
) {
  try {
    const requestId = getRequestId(req);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return apiErrorResponse('unauthorized', {
        status: 401,
        message: 'Authentication is required.',
        requestId,
      });
    }

    const { allowed, remaining, resetAt } = await checkRateLimit({
      identifier: user.id,
      bucket: 'autopsy-job-status',
      maxTokens: 60,
      windowSeconds: 60,
      failClosed: true,
    });
    if (!allowed) return rateLimitResponse(remaining, resetAt);

    const params = await context.params;
    const { data, error } = await supabase
      .from('autopsy_jobs')
      .select('id, status, result_autopsy_id, error_message, created_at, updated_at, completed_at')
      .eq('id', params.jobId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return apiErrorResponse('not_found', {
        status: 404,
        message: 'AUTOPSY job was not found.',
        requestId,
      });
    }

    return NextResponse.json({
      jobId: data.id,
      status: data.status,
      autopsyId: data.result_autopsy_id,
      error: data.error_message,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      completedAt: data.completed_at,
    }, { headers: { 'x-request-id': requestId } });
  } catch (error) {
    return unexpectedApiErrorResponse(req, error, 'autopsy-job-status', 'Unable to load AUTOPSY job.');
  }
}
