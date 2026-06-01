import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getRequestId, apiErrorResponse } from '@/lib/api/errors';
import { logger } from '@/lib/utils/logger';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const requestId = getRequestId(req);
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return apiErrorResponse('unauthorized', { status: 401, message: 'Authentication required', requestId });

    const body = await req.json();
    const { title } = body;
    if (!title) return apiErrorResponse('bad_request', { status: 400, message: 'Title is required', requestId });

    const { data, error } = await supabase
      .from('chat_sessions')
      .update({ title })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id, title, is_global, updated_at, created_at')
      .single();

    if (error) throw error;
    return NextResponse.json({ session: data }, { headers: { 'x-request-id': requestId } });
  } catch (error) {
    logger.error('Failed to update chat session', error, { requestId });
    return apiErrorResponse('internal_error', { status: 500, message: 'Failed to update session', requestId });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const requestId = getRequestId(req);
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return apiErrorResponse('unauthorized', { status: 401, message: 'Authentication required', requestId });

    const { error } = await supabase
      .from('chat_sessions')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)
      .eq('is_global', false);

    if (error) throw error;
    return NextResponse.json({ success: true }, { headers: { 'x-request-id': requestId } });
  } catch (error) {
    logger.error('Failed to delete chat session', error, { requestId });
    return apiErrorResponse('internal_error', { status: 500, message: 'Failed to delete session', requestId });
  }
}
