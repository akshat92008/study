import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { error, status } = await requireAdmin();
  if (error) {
    return NextResponse.json({ error }, { status });
  }

  const supabase = createAdminClient();

  try {
    const [failedResponse, dlqResponse] = await Promise.all([
      supabase
        .from('event_queue')
        .select('*')
        .in('status', ['FAILED', 'PARTIAL_FAILED'])
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('event_dlq')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
    ]);

    return NextResponse.json({
      failedQueueEvents: failedResponse.data || [],
      dlqEvents: dlqResponse.data || []
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 200 });
  }
}
