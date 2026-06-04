import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin';
import { EventWorkerService } from '@/lib/events/worker';
import { logAdminAction } from '@/lib/admin/audit';

export const maxDuration = 60; // Allow more time for manual process
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { user, error, status } = await requireAdmin();
  if (error || !user) {
    return NextResponse.json({ error }, { status });
  }

  try {
    const result = await EventWorkerService.processBatch(50, 5, 50000); // 50 items, 5 min lease, 50s max runtime
    
    // Log the admin action asynchronously
    logAdminAction(user.id, 'manual_queue_process', { result }).catch(e => console.error(e));

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'Unknown queue processing error',
      },
      { status: 500 }
    );
  }
}
