import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { jsonWithRequestId } from '@/lib/autopsy-v3/permissions';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function GET(req: NextRequest) {
  const reqId = req.headers.get('x-request-id') || crypto.randomUUID();
  
  const authHeader = req.headers.get('authorization');
  if (!authHeader || authHeader !== `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  try {
    // 1. Pending Events
    const { count: pendingEvents } = await supabaseAdmin
      .from('event_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // 2. Failed Events
    const { count: failedEvents } = await supabaseAdmin
      .from('event_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed');

    // 3. Locked Events
    const { count: lockedEvents } = await supabaseAdmin
      .from('event_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'processing');

    // 4. Autopsy Uploads Today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count: uploadsToday } = await supabaseAdmin
      .from('assessments')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());

    return jsonWithRequestId({
      status: 'ok',
      events: {
        pending: pendingEvents || 0,
        failed: failedEvents || 0,
        locked: lockedEvents || 0,
      },
      uploadsToday: uploadsToday || 0,
    }, reqId);

  } catch (error) {
    console.error('[Admin Status Route] error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
}
