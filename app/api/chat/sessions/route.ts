import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getRequestId, apiErrorResponse } from '@/lib/api/errors';
import { logger } from '@/lib/utils/logger';

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return apiErrorResponse('unauthorized', { status: 401, message: 'Authentication required', requestId });

    const { data, error } = await supabase
      .from('chat_sessions')
      .select('id, title, is_global, updated_at, created_at')
      .eq('user_id', user.id)
      .is('archived_at', null)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ sessions: data }, { headers: { 'x-request-id': requestId } });
  } catch (error) {
    logger.error('Failed to load chat sessions', error, { requestId });
    return apiErrorResponse('internal_error', { status: 500, message: 'Failed to load sessions', requestId });
  }
}

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return apiErrorResponse('unauthorized', { status: 401, message: 'Authentication required', requestId });

    let body;
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const { data, error } = await supabase
      .from('chat_sessions')
      .insert({
        user_id: user.id,
        session_type: 'thread',
        is_global: false,
        title: body.title || 'New Chat'
      })
      .select('id, title, is_global, updated_at, created_at')
      .single();

    if (error) throw error;
    return NextResponse.json({ session: data }, { headers: { 'x-request-id': requestId } });
  } catch (error) {
    logger.error('Failed to create chat session', error, { requestId });
    return apiErrorResponse('internal_error', { status: 500, message: 'Failed to create session', requestId });
  }
}
