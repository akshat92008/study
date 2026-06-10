import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getRequestId, apiErrorResponse } from '@/lib/api/errors';
import { requireAdmin } from '@/lib/auth/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const requestId = getRequestId(req);

  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const supabase = createAdminClient();

    const { data: runs, error } = await supabase
      .from('agent_runs')
      .select('id, user_id, agent_name, trigger_type, status, started_at, completed_at, error, idempotency_key')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    return NextResponse.json({
      status: 'ok',
      runs: runs || [],
    }, { headers: { 'x-request-id': requestId } });
  } catch (error: any) {
    return NextResponse.json({
      status: 'error',
      error: error.message,
    }, { status: 500, headers: { 'x-request-id': requestId } });
  }
}
