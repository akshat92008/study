import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAdminAction } from '@/lib/admin/audit';
import { EventWorkerService } from '@/lib/events/worker';
import { readAdminUserRequest, requireTargetUserId } from '../_request';

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error || !auth.user) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await readAdminUserRequest(req);
    const targetUserId = requireTargetUserId(body);
    
    const supabase = createAdminClient();
    const { data: userDlq } = await supabase
      .from('event_dlq')
      .select('id, event_id, event_type')
      .is('resolved_at', null)
      .eq('payload->user_id', targetUserId);
      
    if (!userDlq || userDlq.length === 0) {
      return NextResponse.json({ ok: true, retriedCount: 0 });
    }

    // A simplified retry that resubmits to event_queue
    const eventsToInsert = userDlq.map((dlq: any) => ({
      type: dlq.event_type,
      payload: { user_id: targetUserId }, // Rough approximation, normally we'd parse the full payload
      source: 'admin_retry'
    }));
    
    // Using actual event worker service
    // Wait, the dlq row has the full payload. 
    const fullDlq = await supabase.from('event_dlq').select('*').is('resolved_at', null).contains('payload', { user_id: targetUserId });
    
    let retried = 0;
    if (fullDlq.data) {
       for (const dlq of fullDlq.data) {
          await supabase.from('event_queue').insert({
             type: dlq.event_type,
             payload: dlq.payload,
             source: dlq.source || 'admin_retry',
             priority: 0
          });
          await supabase.from('event_dlq').update({
             resolved_at: new Date().toISOString(),
             resolution_notes: 'Retried by admin'
          }).eq('id', dlq.id);
          retried++;
       }
    }

    await logAdminAction(auth.user.id, 'retry_user_dlq', { targetUserId, retriedCount: retried });
    return NextResponse.json({ ok: true, retriedCount: retried });
  } catch (error: any) {
    return NextResponse.json({ error: 'admin_action_failed', message: error.message }, { status: 400 });
  }
}
