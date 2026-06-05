import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';

const PatchSchema = z.object({
  id: z.string().uuid().optional(),
  all: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);
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

    const now = new Date().toISOString();
    const limit = Math.max(1, Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 10), 25));

    let recentQuery = supabase
      .from('amaura_notifications')
      .select('*')
      .eq('user_id', user.id);
    recentQuery = (recentQuery as any).or(`expires_at.is.null,expires_at.gt.${now}`);

    let unreadQuery = supabase
      .from('amaura_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false);
    unreadQuery = (unreadQuery as any).or(`expires_at.is.null,expires_at.gt.${now}`);

    const [recentRes, unreadRes] = await Promise.all([
      recentQuery.order('created_at', { ascending: false }).limit(limit),
      unreadQuery,
    ]);

    if (recentRes.error) throw recentRes.error;
    if (unreadRes.error) throw unreadRes.error;

    return NextResponse.json({
      notifications: recentRes.data ?? [],
      unreadCount: unreadRes.count ?? 0,
    }, { headers: { 'x-request-id': requestId } });
  } catch (error) {
    return unexpectedApiErrorResponse(req, error, 'amaura_notifications_get_unhandled', 'Unable to load notifications.');
  }
}

export async function PATCH(req: NextRequest) {
  const requestId = getRequestId(req);
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

    const parsed = PatchSchema.safeParse(await req.json());
    if (!parsed.success || (!parsed.data.id && !parsed.data.all)) {
      return apiErrorResponse('invalid_request', {
        status: 400,
        message: 'Provide a notification id or all=true.',
        requestId,
      });
    }

    let query = supabase
      .from('amaura_notifications')
      .update({ read: true })
      .eq('user_id', user.id);

    query = parsed.data.all ? query.eq('read', false) : query.eq('id', parsed.data.id!);

    const { error } = await query;
    if (error) throw error;

    return NextResponse.json({ ok: true }, { headers: { 'x-request-id': requestId } });
  } catch (error) {
    return unexpectedApiErrorResponse(req, error, 'amaura_notifications_patch_unhandled', 'Unable to update notifications.');
  }
}
