import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';
import { OutcomeAnalyticsService } from '@/lib/services/outcome-analytics.service';

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return apiErrorResponse('unauthorized', {
        status: 401,
        message: 'Authentication is required.',
        requestId,
      });
    }

    const summary = await new OutcomeAnalyticsService(supabase).getSummary(user.id);
    return NextResponse.json({ summary }, { headers: { 'x-request-id': requestId } });
  } catch (error) {
    return unexpectedApiErrorResponse(request, error, 'outcome-analytics', 'Unable to load outcome analytics.');
  }
}
